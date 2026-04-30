import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const requireFromWeb = createRequire(path.join(PROJECT_ROOT, "web/package.json"));
const Database = requireFromWeb("better-sqlite3");

const service = await import("../../web/server/services/publish/publish-job-service.ts");

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-publish-job-"));
  const db = new Database(path.join(tempPath, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table listing_publish_task (
      id integer primary key autoincrement,
      listing_id integer not null,
      publish_version_id integer,
      platform text not null default 'SHEIN',
      task_type text not null default 'PUBLISH_LISTING',
      status text not null default 'PENDING_CONFIRM',
      attempt_count integer not null default 0,
      max_attempts integer not null default 3,
      request_payload_json text not null default '{}',
      response_payload_json text not null default '{}',
      platform_trace_id text,
      platform_version text,
      error_code text,
      error_message text,
      started_at text,
      finished_at text,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      idempotency_key text,
      next_retry_at text,
      last_retry_at text,
      failure_category text,
      failure_fingerprint text,
      retryable integer not null default 0,
      last_status_synced_at text
    );
    create unique index ux_listing_publish_task_idempotency
      on listing_publish_task(platform, idempotency_key)
      where idempotency_key is not null;
  `);
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

test("publish reliability migration adds idempotency retry and failure attribution fields", async () => {
  const migration = await readFile(path.join(PROJECT_ROOT, "db/migrations/016_publish_job_reliability.sql"), "utf8");
  const batchMigration = await readFile(path.join(PROJECT_ROOT, "db/migrations/017_listing_batch_publish_status_summary.sql"), "utf8");
  assert.match(migration, /idempotency_key/);
  assert.match(migration, /ux_listing_publish_task_idempotency/);
  assert.match(migration, /next_retry_at/);
  assert.match(migration, /failure_category/);
  assert.match(migration, /failure_fingerprint/);
  assert.match(migration, /last_status_synced_at/);
  assert.match(batchMigration, /last_status_synced_at/);
  assert.match(batchMigration, /publish_status_summary_json/);
});

test("markPublishTaskStatusSynced stores polling timestamp and clears retry markers for active review states", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    const { task } = service.ensurePublishTask(db, {
      listingId: 101,
      publishVersionId: 202,
      platform: "SHEIN",
      taskType: "PUBLISH_LISTING",
      status: "PUBLISH_SUBMITTED",
      attemptCount: 1,
      requestPayload: { supplier_code: "SPU101" },
    });

    const updated = service.markPublishTaskStatusSynced(db, {
      taskId: task.id,
      status: "UNDER_REVIEW",
      responsePayload: { code: "0", info: { data: [] } },
      now: new Date("2026-04-30T01:00:00.000Z"),
    });

    assert.equal(updated.status, "UNDER_REVIEW");
    assert.equal(updated.last_status_synced_at, "2026-04-30T01:00:00.000Z");
    assert.equal(updated.retryable, 0);
    assert.equal(updated.next_retry_at, null);
  } finally {
    await cleanup();
  }
});

test("ensurePublishTask creates exactly one task for the same platform idempotency key", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    const input = {
      listingId: 101,
      publishVersionId: 202,
      platform: "SHEIN",
      taskType: "PUBLISH_LISTING",
      status: "PUBLISHING",
      attemptCount: 1,
      requestPayload: { supplier_code: "SPU101" },
    };
    const first = service.ensurePublishTask(db, input);
    const second = service.ensurePublishTask(db, input);

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.task.id, first.task.id);
    assert.equal(second.task.idempotency_key, "SHEIN:PUBLISH_LISTING:listing:101:version:202");

    const count = db.prepare("select count(*) as count from listing_publish_task").get().count;
    assert.equal(count, 1);
  } finally {
    await cleanup();
  }
});

test("markPublishTaskFailed records stable failure category fingerprint and retry scheduling", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    const { task } = service.ensurePublishTask(db, {
      listingId: 101,
      publishVersionId: 202,
      platform: "SHEIN",
      taskType: "PUBLISH_LISTING",
      status: "PUBLISHING",
      attemptCount: 1,
      requestPayload: { supplier_code: "SPU101" },
    });

    const result = service.markPublishTaskFailed(db, {
      taskId: task.id,
      responsePayload: { code: "429", msg: "too many requests for item 12345" },
      errorCode: "429",
      errorMessage: "too many requests for item 12345",
      now: new Date("2026-04-30T00:00:00.000Z"),
    });

    assert.equal(result.failure.category, "RATE_LIMIT");
    assert.equal(result.failure.retryable, true);
    assert.equal(result.task.retryable, 1);
    assert.equal(result.task.next_retry_at, "2026-04-30T00:05:00.000Z");
    assert.equal(result.task.failure_fingerprint, "RATE_LIMIT:too many requests for item #");
  } finally {
    await cleanup();
  }
});
