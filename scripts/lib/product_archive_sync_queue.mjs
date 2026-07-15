import { randomUUID } from "node:crypto";

const DEFAULT_INTERVAL_MS = 1500;
const MAX_CODES_PER_JOB = 2000;
const PRODUCT_ARCHIVE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function clampInterval(value) {
  const number = Number(value ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_MS;
  return Math.max(0, Math.min(60000, Math.floor(number)));
}

export function parseSpuCodes(input, options = {}) {
  const maxCodes = Number.isFinite(Number(options.maxCodes))
    ? Math.max(1, Math.floor(Number(options.maxCodes)))
    : MAX_CODES_PER_JOB;
  const values = Array.isArray(input) ? input : String(input ?? "").split(/[\s,，;；]+/);
  const seen = new Set();
  const codes = [];
  for (const value of values) {
    const code = String(value ?? "").trim();
    if (!code || !PRODUCT_ARCHIVE_CODE_PATTERN.test(code) || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= maxCodes) break;
  }
  return codes;
}

export function createProductArchiveSyncQueue({
  syncOne,
  allowedSources = ["mdm", "deepdraw", "mdm_deepdraw"],
  store = null,
  autoRecover = true,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  if (typeof syncOne !== "function") {
    throw new Error("syncOne is required");
  }

  const jobs = new Map();
  const pending = [];
  let running = false;
  let processScheduled = false;
  let idleResolvers = [];

  function snapshot(job) {
    return {
      ...job,
      codes: [...job.codes],
      options: { ...job.options },
      items: job.items.map((item) => ({ ...item })),
    };
  }

  function getJob(id) {
    const job = jobs.get(id);
    if (job) return snapshot(job);
    const stored = store?.get?.(id);
    return stored ? snapshot(stored) : null;
  }

  function persist(job) {
    store?.save?.(snapshot(job));
  }

  function resolveIdleIfNeeded() {
    if (running || pending.length > 0) return;
    const resolvers = idleResolvers;
    idleResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  async function processLoop() {
    processScheduled = false;
    if (running) return;
    running = true;
    while (pending.length > 0) {
      const job = pending.shift();
      job.status = "running";
      job.started_at = new Date(now()).toISOString();
      persist(job);

      let processedCount = 0;
      for (let index = 0; index < job.items.length; index += 1) {
        const item = job.items[index];
        if (["completed", "failed"].includes(item.status)) continue;
        if (processedCount > 0 && job.interval_ms > 0) {
          await wait(job.interval_ms);
        }
        processedCount += 1;

        item.status = "running";
        item.started_at = new Date(now()).toISOString();
        persist(job);
        try {
          const result = await syncOne({
            source: job.source,
            spuCode: item.spu_code,
            jobId: job.id,
            options: job.options,
          });
          item.status = "completed";
          item.result = result ?? null;
          item.finished_at = new Date(now()).toISOString();
          job.completed_count += 1;
        } catch (error) {
          item.status = "failed";
          item.error = error instanceof Error ? error.message : String(error);
          item.finished_at = new Date(now()).toISOString();
          job.failed_count += 1;
        }
        persist(job);
      }

      job.status = "completed";
      job.finished_at = new Date(now()).toISOString();
      persist(job);
    }
    running = false;
    resolveIdleIfNeeded();
  }

  function enqueue({ source, rawCodes, intervalMs, options = {} } = {}) {
    const normalizedSource = String(source ?? "").toLowerCase();
    const normalizedAllowedSources = allowedSources.map((item) => String(item).toLowerCase());
    if (!normalizedAllowedSources.includes(normalizedSource)) {
      throw new Error(`source must be ${normalizedAllowedSources.join(", or ")}`);
    }

    const codes = parseSpuCodes(rawCodes);
    if (codes.length === 0) {
      throw new Error("At least one product code is required");
    }

    const job = {
      id: randomUUID(),
      source: normalizedSource,
      status: "queued",
      interval_ms: clampInterval(intervalMs),
      options: {
        ...options,
        deepdrawTenantName: options.deepdrawTenantName ?? null,
      },
      codes,
      total_count: codes.length,
      completed_count: 0,
      failed_count: 0,
      created_at: new Date(now()).toISOString(),
      started_at: null,
      finished_at: null,
      items: codes.map((code) => ({
        spu_code: code,
        status: "queued",
        started_at: null,
        finished_at: null,
        result: null,
        error: null,
      })),
    };

    jobs.set(job.id, job);
    persist(job);
    pending.push(job);
    if (!processScheduled) {
      processScheduled = true;
      queueMicrotask(() => {
        void processLoop();
      });
    }
    return snapshot(job);
  }

  function waitForIdle() {
    if (!running && !processScheduled && pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => idleResolvers.push(resolve));
  }

  let recoveryStarted = false;
  function resume() {
    if (recoveryStarted) return;
    recoveryStarted = true;
    const recovered = store?.recover?.() ?? [];
    for (const storedJob of recovered) {
      const job = snapshot(storedJob);
      if (!["queued", "running"].includes(job.status)) continue;
      job.status = "queued";
      job.started_at = null;
      job.finished_at = null;
      for (const item of job.items) {
        if (item.status !== "running") continue;
        item.status = "queued";
        item.started_at = null;
        item.finished_at = null;
        item.error = null;
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length;
      job.failed_count = job.items.filter((item) => item.status === "failed").length;
      jobs.set(job.id, job);
      pending.push(job);
      persist(job);
    }
    if (pending.length > 0 && !processScheduled) {
      processScheduled = true;
      queueMicrotask(() => {
        void processLoop();
      });
    }
  }
  if (autoRecover) resume();

  return {
    enqueue,
    getJob,
    resume,
    waitForIdle,
  };
}

function parseStoredJob(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function createPostgresProductArchiveSyncJobStore({ getDb, queueName } = {}) {
  if (typeof getDb !== "function") throw new Error("getDb is required");
  const normalizedQueueName = String(queueName ?? "").trim();
  if (!normalizedQueueName) throw new Error("queueName is required");

  return {
    save(job) {
      const now = new Date().toISOString();
      getDb().prepare(`
        insert into product_archive_sync_job (
          id, queue_name, source, status, payload_json, created_at, updated_at
        )
        values (?, ?, ?, ?, ?::jsonb, ?::timestamptz, ?::timestamptz)
        on conflict (id) do update set
          queue_name = excluded.queue_name,
          source = excluded.source,
          status = excluded.status,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).run(
        job.id,
        normalizedQueueName,
        job.source,
        job.status,
        JSON.stringify(job),
        job.created_at ?? now,
        now,
      );
    },
    get(id) {
      const row = getDb().prepare(`
        select payload_json
        from product_archive_sync_job
        where id = ? and queue_name = ?
      `).get(id, normalizedQueueName);
      return parseStoredJob(row?.payload_json);
    },
    recover() {
      return getDb().prepare(`
        select payload_json
        from product_archive_sync_job
        where queue_name = ?
          and status in ('queued', 'running')
        order by created_at, id
      `).all(normalizedQueueName)
        .map((row) => parseStoredJob(row.payload_json))
        .filter(Boolean);
    },
  };
}
