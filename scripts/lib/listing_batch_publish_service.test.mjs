import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const service = await import("../../web/server/services/publish/publish-job-service.ts");

function addTransactionShim(db) {
  db.transaction = (fn) => (...args) => {
    db.exec("begin immediate");
    try {
      const result = fn(...args);
      db.exec("commit");
      return result;
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  };
  return db;
}

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-batch-publish-"));
  const db = addTransactionShim(new DatabaseSync(path.join(tempPath, "test.sqlite")));
  db.exec("pragma foreign_keys = on");
  db.exec(`
    create table listing_batch (
      id integer primary key autoincrement,
      platform text not null default 'SHEIN',
      batch_no text not null unique,
      batch_name text not null,
      status text not null default 'ACTIVE',
      source_type text not null default 'MANUAL',
      note text,
      publish_status_summary_json text not null default '{}',
      last_status_synced_at text,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    create table product_spu (
      id integer primary key,
      spu_code text not null,
      spu_name text,
      brand_name text
    );
    create table listing (
      id integer primary key,
      platform text not null,
      channel_account_id integer not null default 1,
      product_spu_id integer not null,
      spu_code text not null,
      listing_batch_no text,
      title text,
      status text not null default 'READY_TO_PUBLISH',
      validation_status text not null default 'PASSED',
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    create table shein_product_bucket (
      spu_code text primary key,
      latest_listing_id integer,
      latest_version_no integer,
      latest_publish_status text,
      updated_at text
    );
    create table listing_validation_result (
      id integer primary key autoincrement,
      listing_id integer not null,
      severity text not null,
      module text not null,
      field_key text,
      owner_type text,
      owner_id integer,
      message text not null,
      suggestion text,
      resolved integer not null default 0,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    create table listing_publish_version (
      id integer primary key autoincrement,
      listing_id integer not null,
      version_no integer not null,
      version_type text not null,
      status text not null default 'DRAFT',
      change_summary text,
      source_snapshot_json text not null default '{}',
      request_payload_json text,
      response_payload_json text,
      error_code text,
      error_message text,
      created_by text,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      submitted_at text,
      unique(listing_id, version_no)
    );
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
  db.prepare("insert into listing_batch (platform, batch_no, batch_name) values ('SHEIN', 'BATCH-1', 'Batch 1')").run();
  db.prepare("insert into product_spu (id, spu_code, spu_name, brand_name) values (1, 'SPU-1', 'One', 'Brand')").run();
  db.prepare("insert into product_spu (id, spu_code, spu_name, brand_name) values (2, 'SPU-2', 'Two', 'Brand')").run();
  db.prepare("insert into product_spu (id, spu_code, spu_name, brand_name) values (3, 'SPU-3', 'Three', 'Brand')").run();
  db.prepare("insert into listing (id, platform, product_spu_id, spu_code, listing_batch_no, title) values (101, 'SHEIN', 1, 'SPU-1', 'BATCH-1', 'Ready')").run();
  db.prepare("insert into listing (id, platform, product_spu_id, spu_code, listing_batch_no, title) values (102, 'SHEIN', 2, 'SPU-2', 'BATCH-1', 'Blocked')").run();
  db.prepare("insert into listing (id, platform, product_spu_id, spu_code, listing_batch_no, title) values (103, 'SHEIN', 3, 'SPU-3', 'BATCH-1', 'Missing payload')").run();
  db.prepare("insert into shein_product_bucket (spu_code) values ('SPU-1')").run();
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

test("ensureBatchPublishTasks creates idempotent tasks and reports skipped listings", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into listing_publish_version (
        id, listing_id, version_no, version_type, status, source_snapshot_json, request_payload_json
      )
      values (201, 101, 1, 'PUBLISH', 'DRAFT', '{}', '{"supplier_code":"SPU-1"}')
    `).run();
    db.prepare(`
      insert into listing_validation_result (
        listing_id, severity, module, field_key, owner_type, owner_id, message
      )
      values (102, 'ERROR', 'LOCAL', 'title', 'LISTING', 102, '标题缺失')
    `).run();

    const first = service.ensureBatchPublishTasks(db, {
      platform: "SHEIN",
      batchNo: "BATCH-1",
      status: "PENDING_CONFIRM",
    });
    const second = service.ensureBatchPublishTasks(db, {
      platform: "SHEIN",
      batchNo: "BATCH-1",
      status: "PENDING_CONFIRM",
    });

    assert.equal(first.created_count, 1);
    assert.equal(first.existing_count, 0);
    assert.equal(first.skipped_count, 2);
    assert.equal(second.created_count, 0);
    assert.equal(second.existing_count, 1);
    assert.equal(db.prepare("select count(*) as count from listing_publish_task").get().count, 1);

    const task = db.prepare("select * from listing_publish_task").get();
    assert.equal(task.listing_id, 101);
    assert.equal(task.publish_version_id, 201);
    assert.equal(task.status, "PENDING_CONFIRM");
    assert.equal(task.attempt_count, 0);
    assert.equal(task.idempotency_key, "SHEIN:PUBLISH_LISTING:listing:101:version:201");
    assert.match(first.skipped.map((item) => item.reason).join("\n"), /阻断/);
    assert.match(first.skipped.map((item) => item.reason).join("\n"), /payload/);
  } finally {
    await cleanup();
  }
});

test("publishSummaryForBatch groups task statuses and failure reasons", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into listing_publish_task (
        listing_id, publish_version_id, platform, status, request_payload_json,
        error_code, error_message, failure_category, failure_fingerprint, retryable
      )
      values
        (101, 201, 'SHEIN', 'PUBLISH_FAILED', '{}', '429', 'too many requests item 123', 'RATE_LIMIT', 'RATE_LIMIT:too many requests item #', 1),
        (102, 202, 'SHEIN', 'PUBLISH_FAILED', '{}', '429', 'too many requests item 456', 'RATE_LIMIT', 'RATE_LIMIT:too many requests item #', 1),
        (103, 203, 'SHEIN', 'UNDER_REVIEW', '{}', null, null, null, null, 0)
    `).run();

    const summary = service.publishSummaryForBatch(db, { platform: "SHEIN", batchNo: "BATCH-1" });
    assert.equal(summary.total_listings, 3);
    assert.equal(summary.total_tasks, 3);
    assert.equal(summary.by_task_status.PUBLISH_FAILED, 2);
    assert.equal(summary.by_task_status.UNDER_REVIEW, 1);
    assert.equal(summary.failure_groups.length, 1);
    assert.equal(summary.failure_groups[0].category, "RATE_LIMIT");
    assert.equal(summary.failure_groups[0].count, 2);
    assert.equal(summary.failure_groups[0].retryable_count, 2);

    const refreshed = service.refreshBatchPublishSummary(db, { platform: "SHEIN", batchNo: "BATCH-1" });
    const stored = JSON.parse(db.prepare("select publish_status_summary_json from listing_batch where batch_no = 'BATCH-1'").get().publish_status_summary_json);
    assert.equal(refreshed.by_task_status.PUBLISH_FAILED, 2);
    assert.equal(stored.failure_groups[0].fingerprint, "RATE_LIMIT:too many requests item #");
  } finally {
    await cleanup();
  }
});

test("retryFailedBatchTasks creates idempotent retry versions and pending tasks", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into listing_publish_version (
        id, listing_id, version_no, version_type, status, source_snapshot_json, request_payload_json
      )
      values (201, 101, 1, 'PUBLISH', 'FAILED', '{}', '{"supplier_code":"SPU-1"}')
    `).run();
    db.prepare(`
      insert into listing_publish_task (
        id, listing_id, publish_version_id, platform, status, request_payload_json,
        response_payload_json, error_code, error_message, failure_category, failure_fingerprint, retryable
      )
      values (301, 101, 201, 'SHEIN', 'PUBLISH_FAILED', '{"supplier_code":"SPU-1"}',
        '{"code":"429"}', '429', 'too many requests item 123', 'RATE_LIMIT', 'RATE_LIMIT:too many requests item #', 1)
    `).run();

    const first = service.retryFailedBatchTasks(db, {
      platform: "SHEIN",
      batchNo: "BATCH-1",
      retryableOnly: true,
      now: new Date("2026-04-30T02:00:00.000Z"),
    });
    const second = service.retryFailedBatchTasks(db, {
      platform: "SHEIN",
      batchNo: "BATCH-1",
      retryableOnly: true,
      now: new Date("2026-04-30T02:01:00.000Z"),
    });

    assert.equal(first.created_count, 1);
    assert.equal(first.existing_count, 0);
    assert.equal(second.created_count, 0);
    assert.equal(second.existing_count, 1);
    assert.equal(db.prepare("select count(*) as count from listing_publish_version where version_type = 'RETRY'").get().count, 1);
    assert.equal(db.prepare("select count(*) as count from listing_publish_task where publish_version_id <> 201").get().count, 1);

    const retryVersion = db.prepare("select * from listing_publish_version where version_type = 'RETRY'").get();
    assert.equal(retryVersion.version_no, 2);
    assert.match(retryVersion.source_snapshot_json, /"retry_from_task_id":301/);

    const retryTask = db.prepare("select * from listing_publish_task where publish_version_id = ?").get(retryVersion.id);
    assert.equal(retryTask.status, "PENDING_CONFIRM");
    assert.equal(retryTask.attempt_count, 0);
    assert.equal(db.prepare("select last_retry_at from listing_publish_task where id = 301").get().last_retry_at, "2026-04-30T02:00:00.000Z");
  } finally {
    await cleanup();
  }
});

test("findUnresolvedPublishTask deduplicates publishing and unknown-result attempts", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into listing_publish_task (
        id, listing_id, publish_version_id, platform, task_type, status, request_payload_json
      ) values (301, 101, 201, 'SHEIN', 'PUBLISH_LISTING', 'PUBLISHING', '{}')
    `).run();

    assert.equal(service.findUnresolvedPublishTask(db, 101)?.id, 301);
    db.prepare("update listing_publish_task set status = 'PUBLISH_RESULT_UNKNOWN' where id = 301").run();
    assert.equal(service.findUnresolvedPublishTask(db, 101)?.id, 301);
    db.prepare("update listing_publish_task set status = 'PUBLISH_FAILED' where id = 301").run();
    assert.equal(service.findUnresolvedPublishTask(db, 101), null);
  } finally {
    await cleanup();
  }
});

test("markPublishTransportUnknown closes publishing state without allowing blind retry", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into listing_publish_version (
        id, listing_id, version_no, version_type, status, source_snapshot_json, request_payload_json
      ) values (201, 101, 1, 'PUBLISH', 'PUBLISHING', '{}', '{}')
    `).run();
    db.prepare(`
      insert into listing_publish_task (
        id, listing_id, publish_version_id, platform, task_type, status, request_payload_json
      ) values (301, 101, 201, 'SHEIN', 'PUBLISH_LISTING', 'PUBLISHING', '{}')
    `).run();
    db.prepare("update listing set status = 'PUBLISHING' where id = 101").run();

    service.markPublishTransportUnknown(db, {
      taskId: 301,
      versionId: 201,
      listingId: 101,
      spuCode: "SPU-1",
      versionNo: 1,
      errorCode: "ETIMEDOUT",
      errorMessage: "publish request timed out",
      now: new Date("2026-07-15T08:00:00.000Z"),
    });

    const task = db.prepare("select * from listing_publish_task where id = 301").get();
    const version = db.prepare("select * from listing_publish_version where id = 201").get();
    const listing = db.prepare("select * from listing where id = 101").get();
    const bucket = db.prepare("select * from shein_product_bucket where spu_code = 'SPU-1'").get();
    assert.equal(task.status, "PUBLISH_RESULT_UNKNOWN");
    assert.equal(task.retryable, 0);
    assert.equal(task.finished_at, "2026-07-15T08:00:00.000Z");
    assert.equal(version.status, "RESULT_UNKNOWN");
    assert.equal(listing.status, "PUBLISH_RESULT_UNKNOWN");
    assert.equal(bucket.latest_publish_status, "PUBLISH_RESULT_UNKNOWN");
  } finally {
    await cleanup();
  }
});
