import { randomUUID } from "node:crypto";

const DEFAULT_INTERVAL_MS = 1500;
const MAX_CODES_PER_JOB = 500;

function clampInterval(value) {
  const number = Number(value ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_MS;
  return Math.max(0, Math.min(60000, Math.floor(number)));
}

export function parseSpuCodes(input) {
  const values = Array.isArray(input) ? input : String(input ?? "").split(/[\s,，;；]+/);
  const seen = new Set();
  const codes = [];
  for (const value of values) {
    const code = String(value ?? "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length >= MAX_CODES_PER_JOB) break;
  }
  return codes;
}

export function createProductArchiveSyncQueue({
  syncOne,
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
    return job ? snapshot(job) : null;
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

      for (let index = 0; index < job.items.length; index += 1) {
        const item = job.items[index];
        if (index > 0 && job.interval_ms > 0) {
          await wait(job.interval_ms);
        }

        item.status = "running";
        item.started_at = new Date(now()).toISOString();
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
      }

      job.status = "completed";
      job.finished_at = new Date(now()).toISOString();
    }
    running = false;
    resolveIdleIfNeeded();
  }

  function enqueue({ source, rawCodes, intervalMs, options = {} } = {}) {
    const normalizedSource = String(source ?? "").toLowerCase();
    if (!["mdm", "deepdraw"].includes(normalizedSource)) {
      throw new Error("source must be mdm or deepdraw");
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

  return {
    enqueue,
    getJob,
    waitForIdle,
  };
}
