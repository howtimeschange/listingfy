import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createPostgresProductArchiveSyncJobStore,
  createProductArchiveSyncQueue,
  filterKnownProductArchiveSyncCandidates,
  parseSpuCodes,
} from "./product_archive_sync_queue.mjs";

test("parseSpuCodes splits pasted text, trims noise, and deduplicates codes", () => {
  assert.deepEqual(
    parseSpuCodes(`
      208226102001
      208226103201, 208226102001
      208226104001，208226105001
      208226106001\t208226104001
    `),
    [
      "208226102001",
      "208226103201",
      "208226104001",
      "208226105001",
      "208226106001",
    ],
  );
});

test("parseSpuCodes drops script-like and path-like payloads", () => {
  assert.deepEqual(
    parseSpuCodes([
      "208226102001",
      "<iframe src=javascript:alert(1)>",
      "../config",
      "208226103201<script>alert(1)</script>",
    ]),
    ["208226102001"],
  );
});

test("parseSpuCodes keeps a full launch-plan sized batch", () => {
  const codes = Array.from({ length: 614 }, (_, index) => `209326${String(index + 1).padStart(6, "0")}`);
  assert.equal(parseSpuCodes(codes).length, 614);
});

test("parseSpuCodes supports a larger explicit limit for platform product sync", () => {
  const codes = Array.from({ length: 20050 }, (_, index) => `SPU${String(index + 1).padStart(6, "0")}`);

  assert.equal(parseSpuCodes(codes).length, 2000);
  assert.equal(parseSpuCodes(codes, { maxCodes: 20000 }).length, 20000);
});

test("queue processes product sync jobs serially with a delay between codes", async () => {
  const events = [];
  let now = 1000;
  const queue = createProductArchiveSyncQueue({
    now: () => now,
    wait: async (ms) => {
      events.push(["wait", ms]);
      now += ms;
    },
    syncOne: async ({ source, spuCode }) => {
      events.push(["sync", source, spuCode, now]);
      return { counts: { spu: 1 } };
    },
  });

  const job = queue.enqueue({
    source: "mdm",
    rawCodes: "208226102001\n208226103201\n208226102001",
    intervalMs: 250,
  });

  assert.equal(job.status, "queued");
  assert.deepEqual(job.codes, ["208226102001", "208226103201"]);
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.completed_count, 2);
  assert.equal(finished.failed_count, 0);
  assert.deepEqual(
    events,
    [
      ["sync", "mdm", "208226102001", 1000],
      ["wait", 250],
      ["sync", "mdm", "208226103201", 1250],
    ],
  );
});

test("queue keeps going after one code fails", async () => {
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      if (spuCode === "208226103201") {
        throw new Error("upstream failed");
      }
      return { counts: { spu: 1 } };
    },
  });

  const job = queue.enqueue({
    source: "deepdraw",
    rawCodes: ["208226102001", "208226103201", "208226104001"],
    intervalMs: 0,
  });

  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.completed_count, 2);
  assert.equal(finished.failed_count, 1);
  assert.equal(finished.items[1].status, "failed");
  assert.match(finished.items[1].error, /upstream failed/);
});

test("queue slices long jobs so later jobs can run between chunks", async () => {
  const events = [];
  const queue = createProductArchiveSyncQueue({
    jobSliceSize: 2,
    wait: async () => {},
    syncOne: async ({ spuCode, jobId }) => {
      events.push([jobId, spuCode]);
      return { ok: true };
    },
  });

  const longJob = queue.enqueue({
    source: "mdm",
    rawCodes: ["A001", "A002", "A003"],
    intervalMs: 0,
  });
  const quickJob = queue.enqueue({
    source: "mdm",
    rawCodes: ["B001"],
    intervalMs: 0,
  });

  await queue.waitForIdle();

  assert.deepEqual(events, [
    [longJob.id, "A001"],
    [longJob.id, "A002"],
    [quickJob.id, "B001"],
    [longJob.id, "A003"],
  ]);
  assert.equal(queue.getJob(longJob.id).status, "completed");
  assert.equal(queue.getJob(quickJob.id).status, "completed");
});

test("queue reuses a persisted workflow idempotency key after restart", async () => {
  const storedJobs = new Map();
  const store = {
    save(job) {
      storedJobs.set(job.id, structuredClone(job));
      return true;
    },
    get(id) {
      const job = storedJobs.get(id);
      return job ? structuredClone(job) : null;
    },
  };
  let syncCount = 0;
  const queueOptions = {
    autoRecover: false,
    store,
    wait: async () => {},
    syncOne: async () => {
      syncCount += 1;
      return { ok: true };
    },
  };
  const firstQueue = createProductArchiveSyncQueue(queueOptions);
  const first = firstQueue.enqueue({
    source: "mdm",
    rawCodes: ["A001"],
    intervalMs: 0,
    idempotencyKey: "workflow:job-1:draft_refresh",
  });
  const restartedQueue = createProductArchiveSyncQueue(queueOptions);
  const replayed = restartedQueue.enqueue({
    source: "mdm",
    rawCodes: ["A001"],
    intervalMs: 0,
    idempotencyKey: "workflow:job-1:draft_refresh",
  });

  assert.equal(replayed.id, first.id);
  await Promise.all([firstQueue.waitForIdle(), restartedQueue.waitForIdle()]);
  assert.equal(syncCount, 1);
});

test("retrying a failed idempotent workflow job creates a new sync job", async () => {
  let attempts = 0;
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 1,
    retryDelayMs: 0,
    wait: async () => {},
    syncOne: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("访问频率过高，请稍后重试");
      return { ok: true };
    },
  });
  const failed = queue.enqueue({
    source: "mdm",
    rawCodes: ["A001"],
    intervalMs: 0,
    idempotencyKey: "workflow:job-2:draft_refresh",
  });
  await queue.waitForIdle();

  const retried = queue.retryFailed(failed.id);

  assert.notEqual(retried.id, failed.id);
  await queue.waitForIdle();
  assert.equal(attempts, 2);
  assert.equal(queue.getJob(retried.id).completed_count, 1);
});

test("queue retries transient rate-limit failures with bounded backoff", async () => {
  const waits = [];
  let attempts = 0;
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 3,
    retryDelayMs: 200,
    wait: async (ms) => waits.push(ms),
    syncOne: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("访问频率过高，请稍后重试");
      return { ok: true };
    },
  });

  const job = queue.enqueue({
    source: "deepdraw",
    rawCodes: ["208326120201"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.completed_count, 1);
  assert.equal(finished.failed_count, 0);
  assert.equal(finished.items[0].attempt_count, 3);
  assert.equal(finished.items[0].max_attempts, 3);
  assert.deepEqual(waits, [200, 400]);
});

test("queue does not retry terminal not-found failures", async () => {
  let attempts = 0;
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 3,
    retryDelayMs: 0,
    wait: async () => {},
    syncOne: async () => {
      attempts += 1;
      throw new Error("请求失败，请求的资源未在服务器上发现");
    },
  });

  const job = queue.enqueue({
    source: "deepdraw",
    rawCodes: ["231326108202"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(attempts, 1);
  assert.equal(finished.completed_count, 0);
  assert.equal(finished.failed_count, 1);
  assert.equal(finished.items[0].attempt_count, 1);
  assert.equal(finished.items[0].retryable, false);
});

test("terminal MDM not-found is persisted once and is not retried", async () => {
  const cached = [];
  const queue = createProductArchiveSyncQueue({
    concurrency: 2,
    maxAttempts: 3,
    retryDelayMs: 0,
    wait: async () => {},
    cacheNegativeResult: async (entry) => {
      cached.push(entry);
    },
    syncOne: async () => {
      throw new Error("请求的资源未在服务器上发现");
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["A001"], intervalMs: 0 });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.items[0].attempt_count, 1);
  assert.equal(finished.items[0].retryable, false);
  assert.equal(finished.items[0].reasonCode, "mdm_spu_not_found");
  assert.equal(cached.length, 1);
  assert.equal(cached[0].source, "mdm");
  assert.equal(cached[0].spuCode, "A001");
  assert.equal(cached[0].reasonCode, "mdm_spu_not_found");
});

test("generic MDM HTTP 404 is not persisted as a terminal SPU miss", async () => {
  const cached = [];
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 1,
    wait: async () => {},
    cacheNegativeResult: async (entry) => {
      cached.push(entry);
    },
    syncOne: async () => {
      throw new Error("HTTP 404");
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["A001"], intervalMs: 0 });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.items[0].reasonCode, "sync_failed");
  assert.equal(finished.items[0].retryable, false);
  assert.equal(cached.length, 0);
});

test("different valid codes can overlap but one code cannot overlap itself", async () => {
  let active = 0;
  let maxActive = 0;
  const activeCodes = new Set();
  let sameCodeOverlap = false;
  const starts = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const queue = createProductArchiveSyncQueue({
    concurrency: 2,
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      starts.push(spuCode);
      if (activeCodes.has(spuCode)) sameCodeOverlap = true;
      activeCodes.add(spuCode);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await wait(25);
      active -= 1;
      activeCodes.delete(spuCode);
      return { ok: true };
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["A001", "B001", "A001"], intervalMs: 0 });
  await queue.waitForIdle();

  assert.deepEqual(job.codes, ["A001", "B001"]);
  assert.ok(maxActive >= 2, `expected two distinct codes to overlap; maxActive=${maxActive}`);
  assert.equal(sameCodeOverlap, false);
  assert.deepEqual(starts.sort(), ["A001", "B001"]);
});

test("negative MDM cache skips candidates before external sync", () => {
  const calls = [];
  const now = "2026-09-04T00:00:00.000Z";
  const db = {
    prepare(sql) {
      return {
        all(...args) {
          calls.push({ sql, args });
          return [{ spu_code: "A001", reason_code: "mdm_spu_not_found" }];
        },
      };
    },
  };

  const filtered = filterKnownProductArchiveSyncCandidates(db, "mdm", ["A001", "B001", "A001"], { now });

  assert.deepEqual(filtered.acceptedCodes, ["B001"]);
  assert.deepEqual(filtered.skippedItems, [{
    spu_code: "A001",
    status: "failed",
    reasonCode: "mdm_spu_not_found_cached",
    retryable: false,
    attempt_count: 0,
  }]);
  assert.match(calls[0].sql, /product_archive_sync_negative_cache/i);
  assert.match(calls[0].sql, /expires_at > \?::timestamptz/i);
  assert.deepEqual(calls[0].args, ["mdm", ["A001", "B001"], now]);
});

test("retryFailed only retries retryable items and reapplies negative-cache filtering", async () => {
  const syncCalls = [];
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 1,
    wait: async () => {},
    filterCandidates: (_source, codes) => ({
      acceptedCodes: [],
      skippedItems: codes.map((code) => ({
        spu_code: code,
        status: "failed",
        reasonCode: "mdm_spu_not_found_cached",
        retryable: false,
        attempt_count: 0,
      })),
    }),
    syncOne: async ({ spuCode }) => {
      syncCalls.push(spuCode);
      if (spuCode === "A001") throw new Error("network timeout");
      throw new Error("请求的资源未在服务器上发现");
    },
  });

  const original = queue.enqueue({
    source: "mdm",
    rawCodes: ["A001", "B001"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  const finished = queue.getJob(original.id);
  assert.equal(finished.items.find((item) => item.spu_code === "A001")?.retryable, true);
  assert.equal(finished.items.find((item) => item.spu_code === "B001")?.retryable, false);

  const retry = queue.retryFailed(original.id);
  await queue.waitForIdle();

  const retried = queue.getJob(retry.id);
  assert.deepEqual(retry.codes, []);
  assert.equal(retried.total_count, 1);
  assert.equal(retried.failed_count, 1);
  assert.equal(retried.items[0].spu_code, "A001");
  assert.equal(retried.items[0].reasonCode, "mdm_spu_not_found_cached");
  assert.deepEqual(syncCalls, ["A001", "B001"]);
});

test("mdm_deepdraw deepdraw-stage 404 does not write MDM negative cache", async () => {
  const cached = [];
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 1,
    wait: async () => {},
    cacheNegativeResult: async (entry) => {
      cached.push(entry);
    },
    syncOne: async () => {
      const error = new Error("HTTP 404");
      error.productArchiveSyncStage = "deepdraw";
      error.productArchiveSyncProvider = "deepdraw";
      throw error;
    },
  });

  const job = queue.enqueue({
    source: "mdm_deepdraw",
    rawCodes: ["A001"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.items[0].reasonCode, "sync_failed");
  assert.equal(finished.items[0].retryable, false);
  assert.equal(cached.length, 0);
});

test("mdm_draft source does not override explicit deepdraw not-found context", async () => {
  const cached = [];
  const queue = createProductArchiveSyncQueue({
    allowedSources: ["draft", "mdm_draft"],
    maxAttempts: 1,
    wait: async () => {},
    cacheNegativeResult: async (entry) => {
      cached.push(entry);
    },
    syncOne: async () => {
      const error = new Error("请求的资源未在服务器上发现");
      error.productArchiveSyncStage = "deepdraw";
      error.productArchiveSyncProvider = "deepdraw";
      throw error;
    },
  });

  const job = queue.enqueue({
    source: "mdm_draft",
    rawCodes: ["A001"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.items[0].reasonCode, "sync_failed");
  assert.equal(finished.items[0].retryable, false);
  assert.equal(cached.length, 0);
});

test("queue continues when one persistence write fails", async () => {
  let saveCount = 0;
  const seen = [];
  const queue = createProductArchiveSyncQueue({
    onInternalError: () => {},
    store: {
      recover: () => [],
      get: () => null,
      save: () => {
        saveCount += 1;
        if (saveCount === 3) throw new Error("temporary database failure");
      },
    },
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      seen.push(spuCode);
      return { ok: true };
    },
  });

  const job = queue.enqueue({
    source: "mdm",
    rawCodes: ["208326102001", "208326105104"],
    intervalMs: 0,
  });
  await queue.waitForIdle();

  assert.deepEqual(seen, ["208326102001", "208326105104"]);
  assert.equal(queue.getJob(job.id).completed_count, 2);
});

test("queue can enqueue only the failed items from a completed job", async () => {
  const failedOnce = new Set(["208326120201"]);
  const queue = createProductArchiveSyncQueue({
    maxAttempts: 1,
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      if (failedOnce.delete(spuCode)) throw new Error("network timeout");
      return { ok: true };
    },
  });

  const original = queue.enqueue({
    source: "mdm_deepdraw",
    rawCodes: ["208326120201", "208326102001"],
    intervalMs: 0,
    options: { deepdrawTenantName: "电商巴拉巴拉" },
  });
  await queue.waitForIdle();

  const retry = queue.retryFailed(original.id);
  assert.deepEqual(retry.codes, ["208326120201"]);
  assert.equal(retry.source, "mdm_deepdraw");
  assert.equal(retry.options.deepdrawTenantName, "电商巴拉巴拉");
  assert.equal(retry.options.retryOfJobId, original.id);
  await queue.waitForIdle();
  assert.equal(queue.getJob(retry.id).completed_count, 1);
});

test("queue passes sync options to each item", async () => {
  const seen = [];
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ spuCode, options }) => {
      seen.push([spuCode, options.deepdrawTenantName]);
      return { ok: true };
    },
  });

  queue.enqueue({
    source: "deepdraw",
    rawCodes: ["208226102001"],
    options: { deepdrawTenantName: "迷你巴拉" },
  });
  await queue.waitForIdle();

  assert.deepEqual(seen, [["208226102001", "迷你巴拉"]]);
});

test("queue accepts combined mdm and deepdraw sync jobs", async () => {
  const events = [];
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ source, spuCode, options }) => {
      events.push([source, spuCode, options.deepdrawTenantName]);
      return {
        mdm: { ok: true },
        deepdraw: { ok: true },
      };
    },
  });

  const job = queue.enqueue({
    source: "mdm_deepdraw",
    rawCodes: ["208226102001"],
    options: { deepdrawTenantName: "电商巴拉巴拉" },
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.source, "mdm_deepdraw");
  assert.deepEqual(events, [["mdm_deepdraw", "208226102001", "电商巴拉巴拉"]]);
  assert.deepEqual(finished.items[0].result, {
    mdm: { ok: true },
    deepdraw: { ok: true },
  });
});

test("queue accepts custom draft creation jobs when allowed by the caller", async () => {
  const events = [];
  const queue = createProductArchiveSyncQueue({
    allowedSources: ["draft"],
    wait: async () => {},
    syncOne: async ({ source, spuCode, options }) => {
      events.push([source, spuCode, options.deepdrawTenantName, options.createdBy]);
      return { draftId: 101 };
    },
  });

  const job = queue.enqueue({
    source: "draft",
    rawCodes: ["208226102001"],
    options: { deepdrawTenantName: "电商巴拉巴拉", createdBy: 7 },
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.deepEqual(events, [["draft", "208226102001", "电商巴拉巴拉", 7]]);
  assert.deepEqual(finished.items[0].result, { draftId: 101 });
});

test("queue recovers persisted running jobs and keeps completed jobs readable after restart", async () => {
  let persisted = {
    id: "persisted-job-1",
    source: "mdm",
    status: "running",
    interval_ms: 0,
    options: { deepdrawTenantName: null },
    codes: ["208226102001"],
    total_count: 1,
    completed_count: 0,
    failed_count: 0,
    created_at: "2026-07-15T00:00:00.000Z",
    started_at: "2026-07-15T00:00:01.000Z",
    finished_at: null,
    items: [{
      spu_code: "208226102001",
      status: "running",
      started_at: "2026-07-15T00:00:01.000Z",
      finished_at: null,
      result: null,
      error: null,
    }],
  };
  const store = {
    recover() {
      return [structuredClone(persisted)];
    },
    save(job) {
      persisted = structuredClone(job);
    },
    get(id) {
      return id === persisted.id ? structuredClone(persisted) : null;
    },
  };
  const seen = [];
  const queue = createProductArchiveSyncQueue({
    store,
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      seen.push(spuCode);
      return { recovered: true };
    },
  });

  await queue.waitForIdle();
  assert.deepEqual(seen, ["208226102001"]);
  assert.equal(persisted.status, "completed");
  assert.equal(persisted.items[0].status, "completed");

  const readOnlyStore = {
    recover: () => [],
    save: store.save,
    get: store.get,
  };
  const restarted = createProductArchiveSyncQueue({
    store: readOnlyStore,
    syncOne: async () => {
      throw new Error("completed work must not rerun");
    },
  });
  assert.equal(restarted.getJob(persisted.id).status, "completed");
});

test("a recovered worker that loses its PostgreSQL lease stops before the external sync", async () => {
  let syncCalls = 0;
  const queue = createProductArchiveSyncQueue({
    autoRecover: false,
    store: {
      requiresLease: true,
      recover: () => [{
        id: "stale-lease-job",
        source: "mdm",
        status: "running",
        interval_ms: 0,
        options: { deepdrawTenantName: null },
        codes: ["208226102001"],
        total_count: 1,
        completed_count: 0,
        failed_count: 0,
        created_at: "2026-08-19T00:00:00.000Z",
        started_at: "2026-08-19T00:00:01.000Z",
        finished_at: null,
        items: [{
          spu_code: "208226102001",
          status: "running",
          started_at: "2026-08-19T00:00:01.000Z",
          finished_at: null,
          result: null,
          error: null,
          attempt_count: 0,
          max_attempts: 1,
          next_retry_at: null,
        }],
      }],
      save: () => false,
      get: () => null,
    },
    syncOne: async () => {
      syncCalls += 1;
      return { ok: true };
    },
  });

  queue.resume();
  await queue.waitForIdle();

  assert.equal(syncCalls, 0);
});

test("queue renews a held lease repeatedly during a long sync and clears its timer", async () => {
  const renewals = [];
  let heartbeat = null;
  let clearCount = 0;
  let resolveSync;
  let resolveStarted;
  const syncStarted = new Promise((resolve) => {
    resolveStarted = resolve;
  });
  const store = {
    requiresLease: true,
    leaseRenewIntervalMs: 5,
    save: () => true,
    renew: (id) => {
      renewals.push(id);
      return true;
    },
  };
  const queue = createProductArchiveSyncQueue({
    store,
    onInternalError: () => {},
    setIntervalFn: (callback, intervalMs) => {
      assert.equal(intervalMs, 5);
      heartbeat = callback;
      return { unref() {} };
    },
    clearIntervalFn: () => {
      clearCount += 1;
    },
    syncOne: async () => {
      resolveStarted();
      return new Promise((resolve) => {
        resolveSync = resolve;
      });
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["208226102001"] });
  await syncStarted;
  assert.equal(typeof heartbeat, "function");
  heartbeat();
  heartbeat();
  resolveSync({ ok: true });
  await queue.waitForIdle();

  assert.deepEqual(renewals, [job.id, job.id]);
  assert.equal(clearCount, 1);
  assert.equal(queue.getJob(job.id).status, "completed");
});

test("a lost lease fences the in-flight result and all subsequent items", async () => {
  let heartbeat = null;
  let clearCount = 0;
  let resolveSync;
  let resolveStarted;
  let syncCalls = 0;
  const syncStarted = new Promise((resolve) => {
    resolveStarted = resolve;
  });
  const saved = [];
  const store = {
    requiresLease: true,
    leaseRenewIntervalMs: 5,
    save: (job) => {
      saved.push(structuredClone(job));
      return true;
    },
    renew: () => false,
  };
  const queue = createProductArchiveSyncQueue({
    store,
    onInternalError: () => {},
    setIntervalFn: (callback) => {
      heartbeat = callback;
      return { unref() {} };
    },
    clearIntervalFn: () => {
      clearCount += 1;
    },
    syncOne: async () => {
      syncCalls += 1;
      resolveStarted();
      return new Promise((resolve) => {
        resolveSync = resolve;
      });
    },
  });

  const job = queue.enqueue({
    source: "mdm",
    rawCodes: ["208226102001", "208226103201"],
    intervalMs: 0,
  });
  await syncStarted;
  heartbeat();
  resolveSync({ shouldNotPersist: true });
  await queue.waitForIdle();

  assert.equal(syncCalls, 1);
  assert.equal(clearCount, 1);
  assert.equal(queue.getJob(job.id), null);
  assert.equal(saved.some((entry) => entry.status === "completed"), false);
  assert.equal(saved.some((entry) => entry.items.some((item) => item.spu_code === "208226103201" && item.status !== "queued")), false);
});

test("lease loss evicts the stale local snapshot so a recovered owner state is readable", async () => {
  let heartbeat = null;
  let resolveSync;
  let resolveStarted;
  let stored = null;
  const syncStarted = new Promise((resolve) => {
    resolveStarted = resolve;
  });
  const store = {
    requiresLease: true,
    leaseRenewIntervalMs: 5,
    save: (job) => {
      stored = structuredClone(job);
      return true;
    },
    get: () => structuredClone(stored),
    renew: () => false,
  };
  const queue = createProductArchiveSyncQueue({
    store,
    onInternalError: () => {},
    setIntervalFn: (callback) => {
      heartbeat = callback;
      return { unref() {} };
    },
    clearIntervalFn: () => {},
    syncOne: async () => {
      resolveStarted();
      return new Promise((resolve) => {
        resolveSync = resolve;
      });
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["208226102001"] });
  await syncStarted;
  heartbeat();
  stored = {
    ...stored,
    status: "completed",
    outcome: "succeeded",
    completed_count: 1,
    finished_at: "2026-08-19T00:01:00.000Z",
    items: [{
      spu_code: "208226102001",
      status: "completed",
      result: { recovered: true },
    }],
  };
  resolveSync({ stale: true });
  await queue.waitForIdle();

  assert.equal(queue.getJob(job.id).status, "completed");
  assert.deepEqual(queue.getJob(job.id).items[0].result, { recovered: true });
});

test("lease heartbeat runs while retry and item interval waits are pending", async () => {
  let heartbeat = null;
  let clearCount = 0;
  let renewCount = 0;
  let attempts = 0;
  const queue = createProductArchiveSyncQueue({
    store: {
      requiresLease: true,
      leaseRenewIntervalMs: 5,
      save: () => true,
      renew: () => {
        renewCount += 1;
        return true;
      },
    },
    maxAttempts: 2,
    retryDelayMs: 5,
    onInternalError: () => {},
    setIntervalFn: (callback) => {
      heartbeat = callback;
      return { unref() {} };
    },
    clearIntervalFn: () => {
      clearCount += 1;
    },
    wait: async () => {
      heartbeat?.();
    },
    syncOne: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("network timeout");
      return { ok: true };
    },
  });

  const job = queue.enqueue({
    source: "mdm",
    rawCodes: ["208226102001", "208226103201"],
    intervalMs: 5,
  });
  await queue.waitForIdle();

  assert.equal(queue.getJob(job.id).status, "completed");
  assert.ok(renewCount >= 2);
  assert.equal(clearCount, 1);
});

test("lease heartbeat timer is cleared after a terminal sync exception", async () => {
  let clearCount = 0;
  const queue = createProductArchiveSyncQueue({
    store: {
      requiresLease: true,
      leaseRenewIntervalMs: 5,
      save: () => true,
      renew: () => true,
    },
    onInternalError: () => {},
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {
      clearCount += 1;
    },
    syncOne: async () => {
      throw new Error("terminal sync failure");
    },
  });

  const job = queue.enqueue({ source: "mdm", rawCodes: ["208226102001"] });
  await queue.waitForIdle();

  assert.equal(clearCount, 1);
  assert.equal(queue.getJob(job.id).status, "completed");
  assert.equal(queue.getJob(job.id).items[0].status, "failed");
});

test("queue without a persistent store keeps its existing no-heartbeat behavior", async () => {
  let intervalCalled = false;
  const queue = createProductArchiveSyncQueue({
    setIntervalFn: () => {
      intervalCalled = true;
      return { unref() {} };
    },
    syncOne: async () => ({ ok: true }),
  });

  queue.enqueue({ source: "mdm", rawCodes: ["208226102001"] });
  await queue.waitForIdle();

  assert.equal(intervalCalled, false);
});

test("PostgreSQL job recovery atomically claims rows with lease fencing", async () => {
  const source = await readFile(path.join(path.resolve(import.meta.dirname, "../.."), "scripts/lib/product_archive_sync_queue.mjs"), "utf8");
  const leaseMigration = await readFile(
    path.join(path.resolve(import.meta.dirname, "../.."), "db/migrations/051_product_archive_sync_job_leases.sql"),
    "utf8",
  ).catch(() => "");

  assert.equal(typeof createPostgresProductArchiveSyncJobStore, "function");
  assert.match(source, /for update skip locked/i);
  assert.match(source, /lease_token/i);
  assert.match(source, /lease_expires_at/i);
  assert.match(source, /on conflict[\s\S]*where product_archive_sync_job\.lease_token = excluded\.lease_token/i);
  assert.match(leaseMigration, /add column if not exists lease_token text/i);
  assert.match(leaseMigration, /add column if not exists lease_expires_at timestamptz/i);
  assert.match(leaseMigration, /add column if not exists lease_version bigint/i);
});

test("PostgreSQL lease renew extends only the matching queue job token", () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        get(...args) {
          calls.push({ sql, args });
          if (/insert into product_archive_sync_job/i.test(sql)) {
            return { lease_token: args[5], lease_version: 1 };
          }
          return { id: args[2] };
        },
      };
    },
  };
  const store = createPostgresProductArchiveSyncJobStore({
    getDb: () => db,
    queueName: "product_archives",
    leaseMs: 60000,
  });
  const job = {
    id: "renew-job-1",
    source: "mdm",
    status: "running",
    payload: true,
    codes: ["208226102001"],
    options: {},
    items: [],
    created_at: "2026-08-19T00:00:00.000Z",
  };

  assert.equal(store.save(job), true);
  assert.equal(store.renew(job.id), true);

  const renewCall = calls.at(-1);
  assert.match(renewCall.sql, /update product_archive_sync_job/i);
  assert.match(renewCall.sql, /set lease_expires_at[\s\S]*updated_at/);
  assert.match(renewCall.sql, /where queue_name = \?[\s\S]*id = \?[\s\S]*lease_token = \?/);
  assert.doesNotMatch(renewCall.sql, /payload_json\s*=|status\s*=\s*excluded/i);
  assert.equal(renewCall.args[0], 60000);
  assert.equal(renewCall.args[1], "product_archives");
  assert.equal(renewCall.args[2], job.id);
  assert.equal(typeof renewCall.args[3], "string");
  assert.ok(renewCall.args[3].length > 0);
  assert.equal(store.leaseRenewIntervalMs, 20000);
});

test("PostgreSQL save fencing failure evicts the claim before the next renew", () => {
  let saveCalls = 0;
  let prepareCalls = 0;
  const db = {
    prepare(sql) {
      return {
        get(...args) {
          if (!/insert into product_archive_sync_job/i.test(sql)) return { id: args[2] };
          prepareCalls += 1;
          if (saveCalls++ === 0) return { lease_token: args[5], lease_version: 1 };
          return null;
        },
      };
    },
  };
  const store = createPostgresProductArchiveSyncJobStore({
    getDb: () => db,
    queueName: "product_archives",
  });
  const job = {
    id: "fenced-save-job",
    source: "mdm",
    status: "running",
    codes: ["208226102001"],
    options: {},
    items: [],
    created_at: "2026-08-19T00:00:00.000Z",
  };

  assert.equal(store.save(job), true);
  assert.equal(store.save({ ...job, status: "running" }), false);
  const callsAfterFence = prepareCalls;
  assert.equal(store.renew(job.id), false);
  assert.equal(prepareCalls, callsAfterFence);
});

test("PostgreSQL job recovery drains bounded batches without duplicates", () => {
  const persisted = Array.from({ length: 3 }, (_, index) => ({
    id: `recovery-job-${index + 1}`,
    payload_json: JSON.stringify({
      id: `recovery-job-${index + 1}`,
      source: "mdm",
      status: "queued",
    }),
  }));
  const prepareCalls = [];
  const allBatchSizes = [];
  const db = {
    prepare(sql) {
      prepareCalls.push(sql);
      return {
        all(_queueName, limit, _workerToken, _leaseMs) {
          const rows = persisted.splice(0, limit);
          allBatchSizes.push(rows.length);
          return rows;
        },
      };
    },
  };

  const store = createPostgresProductArchiveSyncJobStore({
    getDb: () => db,
    queueName: "product_archives",
    recoveryBatchSize: 2,
  });
  const recovered = store.recover();

  assert.deepEqual(recovered.map((job) => job.id), [
    "recovery-job-1",
    "recovery-job-2",
    "recovery-job-3",
  ]);
  assert.deepEqual(allBatchSizes, [2, 1]);
  assert.equal(prepareCalls.length, 2);
  assert.ok(prepareCalls.every((sql) => /for update\s+skip locked/i.test(sql)));
  assert.ok(prepareCalls.every((sql) => /limit \?/i.test(sql)));
  assert.equal(persisted.length, 0);
});

test("product archive and draft routes use separate PostgreSQL-backed queue stores", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const [archiveRoute, draftRoute, migration] = await Promise.all([
    readFile(path.join(root, "web/server/routes/product-archives.ts"), "utf8"),
    readFile(path.join(root, "web/server/routes/product-archive-drafts.ts"), "utf8"),
    readFile(path.join(root, "db/migrations/039_product_archive_sync_jobs.sql"), "utf8"),
  ]);

  assert.match(archiveRoute, /createPostgresProductArchiveSyncJobStore/);
  assert.match(archiveRoute, /queueName:\s*"product_archives"/);
  assert.match(draftRoute, /createPostgresProductArchiveSyncJobStore/);
  assert.match(draftRoute, /queueName:\s*"product_archive_drafts"/);
  assert.match(migration, /create table if not exists product_archive_sync_job/i);
  assert.match(migration, /payload_json jsonb/i);
});
