import { randomUUID } from "node:crypto";
import {
  readProductArchiveJobLeaseMs,
  readProductArchiveSyncConcurrency,
} from "./product_archive_performance_config.mjs";

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_MAX_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 3000;
const DEFAULT_JOB_LEASE_MS = 60 * 1000;
const MAX_RECOVERY_BATCH = 200;
const MAX_CODES_PER_JOB = 2000;
const DEFAULT_JOB_SLICE_SIZE = 0;
const DEFAULT_SYNC_CONCURRENCY = 1;
const PRODUCT_ARCHIVE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function clampInterval(value) {
  const number = Number(value ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_MS;
  return Math.max(0, Math.min(60000, Math.floor(number)));
}

function clampMaxAttempts(value) {
  const number = Number(value ?? DEFAULT_MAX_ATTEMPTS);
  if (!Number.isFinite(number)) return DEFAULT_MAX_ATTEMPTS;
  return Math.max(1, Math.min(10, Math.floor(number)));
}

function clampJobSliceSize(value) {
  const number = Number(value ?? DEFAULT_JOB_SLICE_SIZE);
  if (!Number.isFinite(number)) return DEFAULT_JOB_SLICE_SIZE;
  return Math.max(0, Math.min(1000, Math.floor(number)));
}

function clampSyncConcurrency(value) {
  return readProductArchiveSyncConcurrency(value ?? DEFAULT_SYNC_CONCURRENCY);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function scheduleProductArchiveSyncWorker(run) {
  if (typeof setImmediate === "function") {
    setImmediate(run);
    return;
  }
  setTimeout(run, 0);
}

function yieldProductArchiveSyncWorker() {
  return new Promise((resolve) => scheduleProductArchiveSyncWorker(resolve));
}

export class ProductArchiveSyncLeaseError extends Error {
  constructor(message = "Product archive sync job lease was lost", options = undefined) {
    super(message, options);
    this.name = "ProductArchiveSyncLeaseError";
    this.code = "PRODUCT_ARCHIVE_SYNC_LEASE_LOST";
  }
}

export function isProductArchiveSyncLeaseError(error) {
  return error?.code === "PRODUCT_ARCHIVE_SYNC_LEASE_LOST";
}

export function isRetryableProductArchiveSyncError(error) {
  const message = errorMessage(error);
  return /访问频率过高|稍后重试|超时|中止|已取消|too many requests|rate.?limit|HTTP (408|425|429|500|502|503|504)\b|fetch failed|network|socket|timeout|timed out|aborted|operation was aborted|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|AbortError/i.test(message);
}

function normalizeSyncContextValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || null;
}

function isExplicitMdmSpuNotFoundMessage(message) {
  return /请求的资源未在服务器上发现|资源未在服务器上发现|\b(?:mdm|business|spu|product)\s+(?:is\s+)?not[ -]?found\b|\bnot[ -]?found\s+(?:in\s+mdm|for\s+(?:spu|product))\b/i.test(message);
}

export function classifyProductArchiveSyncError(error, context = {}) {
  const message = errorMessage(error);
  const source = normalizeSyncContextValue(context.source ?? error?.productArchiveSyncSource);
  const stage = normalizeSyncContextValue(context.stage ?? error?.productArchiveSyncStage);
  const provider = normalizeSyncContextValue(context.provider ?? error?.productArchiveSyncProvider);
  const hasExplicitStageOrProvider = Boolean(stage || provider);
  const mdmNotFoundContext = provider === "mdm"
    || stage === "mdm"
    || (!hasExplicitStageOrProvider && (source === "mdm" || source === "mdm_draft"));
  if (mdmNotFoundContext && isExplicitMdmSpuNotFoundMessage(message)) {
    return { retryable: false, reasonCode: "mdm_spu_not_found" };
  }
  if (isRetryableProductArchiveSyncError(error)) {
    return { retryable: true, reasonCode: "transient" };
  }
  return { retryable: false, reasonCode: "sync_failed" };
}

export function filterKnownProductArchiveSyncCandidates(db, source, codes, { now = new Date().toISOString() } = {}) {
  const acceptedInputCodes = parseSpuCodes(codes);
  if (acceptedInputCodes.length === 0) return { acceptedCodes: [], skippedItems: [] };
  const normalizedSource = String(source ?? "").toLowerCase();
  if (!normalizedSource.includes("mdm")) {
    return { acceptedCodes: acceptedInputCodes, skippedItems: [] };
  }
  const rows = db.prepare(`
    select spu_code, reason_code
    from product_archive_sync_negative_cache
    where source = ?
      and spu_code = any(?::text[])
      and reason_code = 'mdm_spu_not_found'
      and expires_at > ?::timestamptz
  `).all(normalizedSource, acceptedInputCodes, now);
  const cached = new Set((rows ?? []).map((row) => String(row.spu_code)));
  return {
    acceptedCodes: acceptedInputCodes.filter((code) => !cached.has(code)),
    skippedItems: acceptedInputCodes
      .filter((code) => cached.has(code))
      .map((code) => ({
        spu_code: code,
        status: "failed",
        reasonCode: "mdm_spu_not_found_cached",
        retryable: false,
        attempt_count: 0,
      })),
  };
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
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  isRetryableError = isRetryableProductArchiveSyncError,
  onInternalError = (error) => console.error("Product archive sync queue internal error", error),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  leaseHeartbeatIntervalMs = null,
  jobSliceSize = process.env.LISTINGIFY_PRODUCT_ARCHIVE_JOB_SLICE_SIZE ?? DEFAULT_JOB_SLICE_SIZE,
  concurrency = process.env.LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY ?? DEFAULT_SYNC_CONCURRENCY,
  runWithSlot = async (_context, run) => run(),
  filterCandidates = null,
  cacheNegativeResult = async () => {},
  invalidateNegativeResult = async () => {},
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (typeof syncOne !== "function") {
    throw new Error("syncOne is required");
  }

  const jobs = new Map();
  const pending = [];
  const normalizedMaxAttempts = clampMaxAttempts(maxAttempts);
  const normalizedRetryDelayMs = clampInterval(retryDelayMs);
  const normalizedJobSliceSize = clampJobSliceSize(jobSliceSize);
  const normalizedConcurrency = clampSyncConcurrency(concurrency);
  let running = false;
  let processScheduled = false;
  let idleResolvers = [];
  const normalizedLeaseHeartbeatIntervalMs = Number(leaseHeartbeatIntervalMs ?? store?.leaseRenewIntervalMs);

  function reportInternalError(error, context) {
    try {
      onInternalError?.(error, context);
    } catch {
      // Error reporting must never stop the product sync worker.
    }
  }

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

  function evictLeaseJob(job) {
    if (store?.requiresLease) jobs.delete(job.id);
  }

  function persist(job) {
    if (typeof store?.save !== "function") return true;
    try {
      const saved = store.save(snapshot(job));
      if (saved === false) {
        evictLeaseJob(job);
        return !store?.requiresLease;
      }
      return true;
    } catch (error) {
      reportInternalError(error, { phase: "persist", jobId: job.id });
      evictLeaseJob(job);
      return !store?.requiresLease;
    }
  }

  async function persistNegativeResult(job, item, reasonCode) {
    if (reasonCode !== "mdm_spu_not_found" || !String(job.source).includes("mdm")) return;
    try {
      await cacheNegativeResult({
        source: job.source,
        spuCode: item.spu_code,
        reasonCode,
        checkedAt: new Date(now()).toISOString(),
        expiresAt: new Date(now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      reportInternalError(error, { phase: "negative_cache_save", jobId: job.id, spuCode: item.spu_code });
    }
  }

  async function clearNegativeResult(job, item) {
    if (!String(job.source).includes("mdm")) return;
    try {
      await invalidateNegativeResult({
        source: job.source,
        spuCode: item.spu_code,
      });
    } catch (error) {
      reportInternalError(error, { phase: "negative_cache_invalidate", jobId: job.id, spuCode: item.spu_code });
    }
  }

  async function processItem(job, item, leaseIsLost) {
    item.max_attempts = clampMaxAttempts(item.max_attempts ?? job.max_attempts);
    item.attempt_count = Math.max(0, Number(item.attempt_count) || 0);
    item.started_at ??= new Date(now()).toISOString();

    while (item.attempt_count < item.max_attempts) {
      if (leaseIsLost()) break;
      item.status = "running";
      item.attempt_count += 1;
      item.next_retry_at = null;
      if (!persist(job)) return false;
      try {
        const result = await runWithSlot({
          queue: "product_archive_sync",
          source: job.source,
          jobId: job.id,
          spuCode: item.spu_code,
          attempt: item.attempt_count,
          maxAttempts: item.max_attempts,
        }, () => syncOne({
          source: job.source,
          spuCode: item.spu_code,
          jobId: job.id,
          options: job.options,
          attempt: item.attempt_count,
          maxAttempts: item.max_attempts,
        }));
        if (leaseIsLost()) break;
        item.status = "completed";
        item.result = result ?? null;
        item.error = null;
        item.retryable = false;
        item.reasonCode = null;
        item.finished_at = new Date(now()).toISOString();
        job.completed_count += 1;
        await clearNegativeResult(job, item);
        return true;
      } catch (error) {
        if (leaseIsLost()) break;
        const classification = classifyProductArchiveSyncError(error, { source: job.source });
        const retryable = classification.reasonCode === "mdm_spu_not_found"
          ? false
          : Boolean(isRetryableError?.(error));
        const reasonCode = classification.reasonCode;
        const retryDelay = normalizedRetryDelayMs * item.attempt_count;
        item.error = errorMessage(error);
        item.retryable = retryable;
        item.reasonCode = reasonCode;

        if (retryable && item.attempt_count < item.max_attempts) {
          item.status = "retrying";
          item.next_retry_at = new Date(now() + retryDelay).toISOString();
          if (!persist(job)) return false;
          if (retryDelay > 0) {
            try {
              await wait(retryDelay);
            } catch (waitError) {
              reportInternalError(waitError, { phase: "retry_delay", jobId: job.id });
            }
          }
          if (leaseIsLost()) break;
          continue;
        }

        if (leaseIsLost()) break;
        item.status = "failed";
        item.finished_at = new Date(now()).toISOString();
        item.next_retry_at = null;
        job.failed_count += 1;
        await persistNegativeResult(job, item, reasonCode);
        return true;
      }
    }
    return true;
  }

  function startLeaseHeartbeat(job, onLost) {
    if (
      typeof store?.renew !== "function"
      || !Number.isFinite(normalizedLeaseHeartbeatIntervalMs)
      || normalizedLeaseHeartbeatIntervalMs <= 0
    ) {
      return () => {};
    }
    let stopped = false;
    let timer = null;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer != null) clearIntervalFn(timer);
    };
    const lose = (error = new ProductArchiveSyncLeaseError()) => {
      if (stopped) return;
      onLost(error);
      stop();
    };
    const renew = () => {
      if (stopped) return;
      try {
        const result = store.renew(job.id);
        if (result && typeof result.then === "function") {
          Promise.resolve(result).then((renewed) => {
            if (!renewed) lose();
          }).catch((error) => lose(error));
        } else if (!result) {
          lose();
        }
      } catch (error) {
        lose(error);
      }
    };
    timer = setIntervalFn(renew, Math.max(1, Math.floor(normalizedLeaseHeartbeatIntervalMs)));
    timer?.unref?.();
    return stop;
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
    try {
      while (pending.length > 0) {
        const job = pending.shift();
        job.status = "running";
        job.started_at ??= new Date(now()).toISOString();
        if (!persist(job)) continue;

        let processedCount = 0;
        let leaseLost = false;
        let stopLeaseHeartbeat = () => {};
        const markLeaseLost = (error) => {
          if (leaseLost) return;
          leaseLost = true;
          evictLeaseJob(job);
          reportInternalError(
            error instanceof ProductArchiveSyncLeaseError
              ? error
              : new ProductArchiveSyncLeaseError(errorMessage(error)),
            { phase: "lease_renew", jobId: job.id },
          );
        };
        try {
          stopLeaseHeartbeat = startLeaseHeartbeat(job, markLeaseLost);
          let sliceExhausted = false;
          const openItems = job.items.filter((item) => !["completed", "failed"].includes(item.status));
          const sliceItems = normalizedJobSliceSize > 0 ? openItems.slice(0, normalizedJobSliceSize) : openItems;
          sliceExhausted = normalizedJobSliceSize > 0 && openItems.length > sliceItems.length;
          let nextIndex = 0;
          const inFlightCodes = new Set();
          const takeItem = () => {
            if (leaseLost) return null;
            for (let index = nextIndex; index < sliceItems.length; index += 1) {
              const item = sliceItems[index];
              if (inFlightCodes.has(item.spu_code)) continue;
              nextIndex = index + 1;
              inFlightCodes.add(item.spu_code);
              return item;
            }
            return null;
          };
          const worker = async () => {
            while (!leaseLost) {
              const item = takeItem();
              if (!item) return;
              try {
                if (processedCount > 0 && job.interval_ms > 0) {
                  try {
                    await wait(job.interval_ms);
                  } catch (error) {
                    reportInternalError(error, { phase: "item_interval", jobId: job.id });
                  }
                }
                if (leaseLost) return;
                processedCount += 1;
                const processed = await processItem(job, item, () => leaseLost);
                if (!processed) {
                  leaseLost = true;
                  return;
                }
                if (!leaseLost && !persist(job)) {
                  leaseLost = true;
                  return;
                }
              } finally {
                inFlightCodes.delete(item.spu_code);
              }
            }
          };
          const workerCount = Math.min(normalizedConcurrency, sliceItems.length);
          await Promise.all(Array.from({ length: workerCount }, () => worker()));
          if (!leaseLost && sliceExhausted && job.items.some((item) => !["completed", "failed"].includes(item.status))) {
            job.status = "queued";
            if (!persist(job)) {
              leaseLost = true;
            } else {
              pending.push(job);
              await yieldProductArchiveSyncWorker();
            }
          }
        } finally {
          stopLeaseHeartbeat();
        }

        if (leaseLost) continue;
        if (job.status === "queued") continue;

        job.status = "completed";
        job.outcome = job.failed_count === 0
          ? "succeeded"
          : job.completed_count === 0
            ? "failed"
            : "partial_failure";
        job.finished_at = new Date(now()).toISOString();
        persist(job);
      }
    } finally {
      running = false;
      resolveIdleIfNeeded();
    }
  }

  function enqueue({ source, rawCodes, intervalMs, options = {}, skippedItems = [], idempotencyKey = null } = {}) {
    const normalizedSource = String(source ?? "").toLowerCase();
    const normalizedAllowedSources = allowedSources.map((item) => String(item).toLowerCase());
    if (!normalizedAllowedSources.includes(normalizedSource)) {
      throw new Error(`source must be ${normalizedAllowedSources.join(", or ")}`);
    }

    const normalizedIdempotencyKey = String(idempotencyKey ?? options.idempotencyKey ?? "").trim() || null;
    const jobId = normalizedIdempotencyKey ? `product-archive-sync:${normalizedIdempotencyKey}` : randomUUID();
    if (normalizedIdempotencyKey) {
      const existing = jobs.get(jobId) ?? store?.get?.(jobId);
      if (existing) return snapshot(existing);
    }

    const codes = parseSpuCodes(rawCodes);
    const normalizedSkippedItems = Array.isArray(skippedItems)
      ? skippedItems.map((item) => ({
          spu_code: String(item?.spu_code ?? "").trim(),
          status: "failed",
          started_at: null,
          finished_at: new Date(now()).toISOString(),
          result: null,
          error: null,
          retryable: false,
          attempt_count: 0,
          max_attempts: normalizedMaxAttempts,
          next_retry_at: null,
          reasonCode: String(item?.reasonCode ?? "skipped"),
        })).filter((item) => item.spu_code)
      : [];
    if (codes.length === 0 && normalizedSkippedItems.length === 0) {
      throw new Error("At least one product code is required");
    }

    const job = {
      id: jobId,
      idempotency_key: normalizedIdempotencyKey,
      source: normalizedSource,
      status: "queued",
      interval_ms: clampInterval(intervalMs),
      options: {
        ...options,
        idempotencyKey: normalizedIdempotencyKey,
        deepdrawTenantName: options.deepdrawTenantName ?? null,
      },
      codes,
      total_count: codes.length + normalizedSkippedItems.length,
      completed_count: 0,
      failed_count: normalizedSkippedItems.length,
      max_attempts: normalizedMaxAttempts,
      created_at: new Date(now()).toISOString(),
      started_at: null,
      finished_at: null,
      items: [
        ...normalizedSkippedItems,
        ...codes.map((code) => ({
          spu_code: code,
          status: "queued",
          started_at: null,
          finished_at: null,
          result: null,
          error: null,
          retryable: null,
          attempt_count: 0,
          max_attempts: normalizedMaxAttempts,
          next_retry_at: null,
          reasonCode: null,
        })),
      ],
    };

    jobs.set(job.id, job);
    if (!persist(job) && store?.requiresLease) {
      jobs.delete(job.id);
      const existing = normalizedIdempotencyKey ? store?.get?.(job.id) : null;
      if (existing) return snapshot(existing);
      throw new ProductArchiveSyncLeaseError("Unable to acquire the initial product archive sync job lease");
    }
    pending.push(job);
    if (!processScheduled) {
      processScheduled = true;
      scheduleProductArchiveSyncWorker(() => {
        void processLoop().catch((error) => {
          reportInternalError(error, { phase: "process_loop" });
        });
      });
    }
    return snapshot(job);
  }

  function waitForIdle() {
    if (!running && !processScheduled && pending.length === 0) return Promise.resolve();
    return new Promise((resolve) => idleResolvers.push(resolve));
  }

  function retryFailed(id, { intervalMs } = {}) {
    const original = getJob(id);
    if (!original) throw new Error("Sync job not found");
    if (original.status !== "completed") throw new Error("Sync job is still running");
    const { idempotencyKey: _idempotencyKey, ...retryOptions } = original.options ?? {};
    const failedCodes = original.items
      .filter((item) => item.status === "failed" && item.retryable === true)
      .map((item) => item.spu_code);
    if (failedCodes.length === 0) throw new Error("Sync job has no retryable failed items");
    const filtered = typeof filterCandidates === "function"
      ? filterCandidates(original.source, failedCodes, { job: original, mode: "retry_failed" }) ?? {}
      : {};

    return enqueue({
      source: original.source,
      rawCodes: filtered.acceptedCodes ?? failedCodes,
      skippedItems: filtered.skippedItems ?? [],
      intervalMs: intervalMs ?? original.interval_ms,
      options: {
        ...retryOptions,
        retryOfJobId: original.id,
      },
    });
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
        if (!["running", "retrying"].includes(item.status)) continue;
        item.status = "queued";
        item.started_at = null;
        item.finished_at = null;
        item.error = null;
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length;
      job.failed_count = job.items.filter((item) => item.status === "failed").length;
      if (!persist(job)) continue;
      jobs.set(job.id, job);
      pending.push(job);
    }
    if (pending.length > 0 && !processScheduled) {
      processScheduled = true;
      scheduleProductArchiveSyncWorker(() => {
        void processLoop().catch((error) => {
          reportInternalError(error, { phase: "recovery_loop" });
        });
      });
    }
  }
  if (autoRecover) resume();

  return {
    enqueue,
    getJob,
    retryFailed,
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

export function createPostgresProductArchiveSyncJobStore({
  getDb,
  queueName,
  leaseMs = process.env.LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS ?? DEFAULT_JOB_LEASE_MS,
  recoveryBatchSize = MAX_RECOVERY_BATCH,
} = {}) {
  if (typeof getDb !== "function") throw new Error("getDb is required");
  const normalizedQueueName = String(queueName ?? "").trim();
  if (!normalizedQueueName) throw new Error("queueName is required");
  const normalizedLeaseMs = readProductArchiveJobLeaseMs(leaseMs ?? DEFAULT_JOB_LEASE_MS);
  const normalizedRecoveryBatchSize = Math.max(1, Math.min(MAX_RECOVERY_BATCH, Number(recoveryBatchSize) || MAX_RECOVERY_BATCH));
  const leaseRenewIntervalMs = Math.max(1000, Math.floor(normalizedLeaseMs / 3));
  const workerToken = randomUUID();
  const claimedJobs = new Map();

  return {
    requiresLease: true,
    leaseRenewIntervalMs,
    save(job) {
      const now = new Date().toISOString();
      const leaseToken = claimedJobs.get(job.id) ?? workerToken;
      const row = getDb().prepare(`
        insert into product_archive_sync_job (
          id, queue_name, source, status, payload_json,
          lease_token, lease_expires_at, lease_version,
          created_at, updated_at
        )
        values (
          ?, ?, ?, ?, ?::jsonb,
          ?, clock_timestamp() + (?::double precision * interval '1 millisecond'), 1,
          ?::timestamptz, ?::timestamptz
        )
        on conflict (id) do update set
          queue_name = excluded.queue_name,
          source = excluded.source,
          status = excluded.status,
          payload_json = excluded.payload_json,
          lease_token = case when excluded.status = 'completed' then null else excluded.lease_token end,
          lease_expires_at = case
            when excluded.status = 'completed' then null
            else clock_timestamp() + (?::double precision * interval '1 millisecond')
          end,
          updated_at = excluded.updated_at
        where product_archive_sync_job.lease_token = excluded.lease_token
          and product_archive_sync_job.queue_name = excluded.queue_name
        returning lease_token, lease_version
      `).get(
        job.id,
        normalizedQueueName,
        job.source,
        job.status,
        JSON.stringify(job),
        leaseToken,
        normalizedLeaseMs,
        job.created_at ?? now,
        now,
        normalizedLeaseMs,
      );
      if (!row) {
        claimedJobs.delete(job.id);
        return false;
      }
      if (job.status === "completed") claimedJobs.delete(job.id);
      else claimedJobs.set(job.id, leaseToken);
      return true;
    },
    renew(id) {
      const leaseToken = claimedJobs.get(id);
      if (!leaseToken) return false;
      const row = getDb().prepare(`
        update product_archive_sync_job
        set lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
            updated_at = clock_timestamp()
        where queue_name = ?
          and id = ?
          and lease_token = ?
          and status in ('queued', 'running')
        returning id
      `).get(normalizedLeaseMs, normalizedQueueName, id, leaseToken);
      if (!row) {
        claimedJobs.delete(id);
        return false;
      }
      return true;
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
      const recovered = [];
      let rows;
      do {
        rows = getDb().prepare(`
          with candidates as (
            select id
            from product_archive_sync_job
            where queue_name = ?
              and status in ('queued', 'running')
              and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
            order by created_at, id
            for update skip locked
            limit ?
          )
          update product_archive_sync_job as job
          set lease_token = ?,
            lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
            lease_version = job.lease_version + 1,
            updated_at = clock_timestamp()
          from candidates
          where job.id = candidates.id
          returning job.id, job.payload_json, job.lease_version
        `).all(
          normalizedQueueName,
          normalizedRecoveryBatchSize,
          workerToken,
          normalizedLeaseMs,
        );
        for (const row of rows) {
          claimedJobs.set(row.id, workerToken);
          const job = parseStoredJob(row.payload_json);
          if (job) recovered.push(job);
        }
      } while (rows.length === normalizedRecoveryBatchSize);
      return recovered;
    },
  };
}
