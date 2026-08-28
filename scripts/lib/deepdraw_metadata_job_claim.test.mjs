import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { SyncPostgresDatabase } from "./postgres_db.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/deepdraw-metadata.ts");
const service = await import("../../web/server/services/deepdraw-metadata.ts");

test("DeepDraw metadata workers atomically claim queued jobs and recover stale running jobs", () => {
  const databaseUrl = process.env.DATABASE_URL
    ?? "postgres://listingify:listingify@localhost:5432/listingify";
  const db = new SyncPostgresDatabase(databaseUrl, { connectionTimeoutMillis: 1000 });
  const jobId = `test-${randomUUID()}`;

  try {
    db.prepare(`
      insert into deepdraw_metadata_sync_job (
        id, tenant_name, field_concurrency, field_retry_count, status
      ) values (?, 'claim-test', 1, 0, 'queued')
    `).run(jobId);

    const first = service.claimNextMetadataSyncJob(db, {
      workerId: "worker-a",
      now: new Date("2026-07-15T08:00:00.000Z"),
    });
    assert.equal(first.id, jobId);
    assert.equal(first.status, "running");
    assert.equal(service.claimNextMetadataSyncJob(db, {
      workerId: "worker-b",
      now: new Date("2026-07-15T08:00:30.000Z"),
    }), null);

    db.prepare(`
      update deepdraw_metadata_sync_job
      set heartbeat_at = ?::timestamptz
      where id = ?
    `).run("2026-07-15T07:55:00.000Z", jobId);
    const recovered = service.claimNextMetadataSyncJob(db, {
      workerId: "worker-b",
      now: new Date("2026-07-15T08:01:00.000Z"),
      staleAfterMs: 60_000,
    });
    assert.equal(recovered.id, jobId);
    assert.equal(service.updateMetadataSyncJobProgress(db, jobId, {
      workerId: "worker-a",
      completedCount: 99,
      heartbeatAt: "2026-07-15T08:01:01.000Z",
    }), null);
    assert.equal(service.updateMetadataSyncJobProgress(db, jobId, {
      workerId: "worker-b",
      completedCount: 1,
      heartbeatAt: "2026-07-15T08:01:02.000Z",
    })?.completed_count, 1);
  } finally {
    db.prepare("delete from deepdraw_metadata_sync_job where id = ?").run(jobId);
    db.close();
  }
});

test("DeepDraw metadata scheduler drains again when scheduled during an active drain", async () => {
  assert.equal(typeof service.createMetadataSyncScheduler, "function");

  const firstDrainStarted = Promise.withResolvers();
  const releaseFirstDrain = Promise.withResolvers();
  let drainCount = 0;
  const schedule = service.createMetadataSyncScheduler(async () => {
    drainCount += 1;
    if (drainCount === 1) {
      firstDrainStarted.resolve();
      await releaseFirstDrain.promise;
    }
  });

  const firstRun = schedule();
  await firstDrainStarted.promise;
  const rescheduledRun = schedule();
  releaseFirstDrain.resolve();

  await Promise.all([firstRun, rescheduledRun]);
  assert.equal(drainCount, 2);
});

test("DeepDraw metadata scheduler starts after enqueue responses can flush", async () => {
  const source = await readFile(SERVICE_FILE, "utf8");

  assert.match(source, /function scheduleMetadataSyncWorker/);
  assert.match(source, /setImmediate|setTimeout/);
  assert.doesNotMatch(source, /Promise\.resolve\(\)\s*\.then/);
  assert.doesNotMatch(source, /queueMicrotask/);
});

test("DeepDraw metadata sync defaults to proven concurrency and caps explicit values", () => {
  assert.equal(service.DEFAULT_DEEPDRAW_FIELD_CONCURRENCY, 4);
  assert.equal(service.normalizeDeepdrawFieldConcurrency(undefined), 4);
  assert.equal(service.normalizeDeepdrawFieldConcurrency(null), 4);
  assert.equal(service.normalizeDeepdrawFieldConcurrency(0), 1);
  assert.equal(service.normalizeDeepdrawFieldConcurrency(99), 12);
  assert.equal(service.normalizeDeepdrawFieldRetryCount(undefined), 2);
  assert.equal(service.normalizeDeepdrawFieldRetryCount(99), 4);
});

test("DeepDraw metadata retries use exponential backoff with jitter", async () => {
  const delays = [];
  let attempts = 0;
  const result = await service.retryDeepdrawMetadataOperation(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("fetch failed");
    return "ok";
  }, {
    retryCount: 4,
    random: () => 0.5,
    waitFn: async (delay) => {
      delays.push(delay);
    },
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [600, 1200]);
  assert.notEqual(service.deepdrawMetadataRetryDelayMs(0, () => 0), service.deepdrawMetadataRetryDelayMs(0, () => 1));
});

test("DeepDraw metadata drain marks one failed job and continues with the next job", async () => {
  assert.equal(typeof service.drainMetadataSyncJobs, "function");

  const queued = [{ id: "first" }, { id: "second" }];
  const processed = [];
  const failed = [];
  await service.drainMetadataSyncJobs({
    claimNext: () => queued.shift() ?? null,
    processJob: async (job) => {
      processed.push(job.id);
      if (job.id === "first") throw new Error("first failed");
    },
    markFailed: async (job, error) => {
      failed.push([job.id, error.message]);
    },
  });

  assert.deepEqual(processed, ["first", "second"]);
  assert.deepEqual(failed, [["first", "first failed"]]);
});

test("DeepDraw metadata drain keeps a long-running claimed job alive with periodic heartbeats", async () => {
  const releaseJob = Promise.withResolvers();
  const secondHeartbeat = Promise.withResolvers();
  const heartbeats = [];
  let claimed = false;
  const drain = service.drainMetadataSyncJobs({
    claimNext: () => {
      if (claimed) return null;
      claimed = true;
      return { id: "slow-job" };
    },
    processJob: async () => {
      await releaseJob.promise;
    },
    markFailed: () => {},
    heartbeatIntervalMs: 5,
    heartbeat: (job) => {
      heartbeats.push(job.id);
      if (heartbeats.length === 2) secondHeartbeat.resolve();
    },
  });

  let heartbeatTimeout;
  try {
    await Promise.race([
      secondHeartbeat.promise,
      new Promise((_, reject) => {
        heartbeatTimeout = setTimeout(() => reject(new Error("heartbeat did not fire twice")), 200);
      }),
    ]);
  } finally {
    clearTimeout(heartbeatTimeout);
  }
  releaseJob.resolve();
  await drain;
  const countAtCompletion = heartbeats.length;
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(heartbeats.length, countAtCompletion);
});
