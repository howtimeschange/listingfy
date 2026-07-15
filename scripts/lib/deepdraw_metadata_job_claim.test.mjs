import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { SyncPostgresDatabase } from "./postgres_db.mjs";

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
