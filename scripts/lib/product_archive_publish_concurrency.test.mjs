import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  createProductArchivePublishQueue,
  requeueTargets,
} from "../../web/server/routes/product-archive-drafts.ts";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROUTE_PATH = path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts");
const PAGE_PATH = path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx");
const SERVICE_PATH = path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMemoryStore() {
  const rows = new Map();
  const saves = [];
  return {
    requiresLease: false,
    saves,
    save(job) {
      const snapshot = clone(job);
      rows.set(job.id, snapshot);
      saves.push(snapshot);
      return true;
    },
    get(id) {
      const row = rows.get(id);
      return row ? clone(row) : null;
    },
    recover() {
      return [...rows.values()].map(clone);
    },
  };
}

function createLeasedMemoryStore({ leaseRenewIntervalMs = 5, renew = () => true } = {}) {
  const store = createMemoryStore();
  const renewedJobIds = [];
  return {
    ...store,
    requiresLease: true,
    leaseRenewIntervalMs,
    renewedJobIds,
    renew(jobId) {
      renewedJobIds.push(jobId);
      return renew(jobId);
    },
  };
}

function createFakeDb({ transportUnknown = false } = {}) {
  return {
    prepare(sql) {
      return {
        get() {
          if (/from product_archive_draft/i.test(sql)) {
            return transportUnknown
              ? { status: "submitting", duplicate_result_json: { submit_transport_unknown: "socket timeout" } }
              : { status: "ready", duplicate_result_json: {} };
          }
          return {};
        },
        run() {
          return { changes: 1 };
        },
      };
    },
  };
}

async function waitForCompletedJob(queue, jobId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = queue.getJob(jobId);
    if (job?.status === "completed") return job;
    await delay(5);
  }
  assert.fail("publish queue did not finish");
}

test("publish queue runs two distinct drafts concurrently and completes only after readback_verified", async () => {
  const store = createMemoryStore();
  const activeDrafts = new Set();
  const readbackVerified = new Set();
  const completedBeforeReadback = [];
  const trace = [];
  let maxInFlight = 0;
  let sameDraftOverlap = false;

  const queue = createProductArchivePublishQueue({
    store,
    concurrency: 2,
    wait: delay,
    getDatabase: () => createFakeDb(),
    prepareDraftForSubmit: (_db, draftId) => {
      trace.push(`prepare:${draftId}`);
      return { payload: {}, validation: { summary: { blocker_count: 0 } } };
    },
    submitDraft: async (_db, draftId) => {
      if (activeDrafts.has(draftId)) sameDraftOverlap = true;
      activeDrafts.add(draftId);
      maxInFlight = Math.max(maxInFlight, activeDrafts.size);
      trace.push(`submit:start:${draftId}`);
      await delay(25);
      readbackVerified.add(draftId);
      trace.push(`readback:verified:${draftId}`);
      activeDrafts.delete(draftId);
      return { ok: true, status: "readback_verified" };
    },
    runWithSlot: async (run) => await run(new AbortController().signal),
    onSnapshot: (job) => {
      for (const item of job.items ?? []) {
        if (item.status === "completed" && !readbackVerified.has(item.draft_id)) {
          completedBeforeReadback.push(item.draft_id);
        }
      }
    },
  });

  const queued = queue.enqueue({
    targets: [
      { draftId: 1, spuCode: "SPU-1" },
      { draftId: 1, spuCode: "SPU-1-DUP" },
      { draftId: 2, spuCode: "SPU-2" },
    ],
    actor: null,
    ipAddress: null,
    maxAttempts: 1,
    retryDelayMs: 1,
    submitMode: "create",
  });
  const finalJob = await waitForCompletedJob(queue, queued.id);

  assert.equal(finalJob.total_count, 2);
  assert.equal(sameDraftOverlap, false);
  assert.ok(maxInFlight >= 2);
  assert.deepEqual([...readbackVerified].sort(), [1, 2]);
  assert.deepEqual(completedBeforeReadback, []);
  assert.equal(finalJob.completed_count, 2);
  assert.equal(finalJob.failed_count, 0);
  assert.equal(finalJob.result.publishedCount, 2);
  assert.equal(finalJob.result.concurrency, 2);
  assert.deepEqual(trace.filter((entry) => entry.startsWith("prepare:")), ["prepare:1", "prepare:2"]);
});

test("submit_transport_unknown remains unsafe_retry_blocked and is not requeued before explicit readback", async () => {
  const store = createMemoryStore();
  const queue = createProductArchivePublishQueue({
    store,
    concurrency: 2,
    wait: delay,
    getDatabase: () => createFakeDb({ transportUnknown: true }),
    prepareDraftForSubmit: () => ({ payload: {}, validation: { summary: { blocker_count: 0 } } }),
    submitDraft: async () => {
      throw new Error("socket timeout");
    },
    runWithSlot: async (run) => await run(new AbortController().signal),
  });

  const queued = queue.enqueue({
    targets: [{ draftId: 10, spuCode: "SPU-10" }],
    actor: null,
    ipAddress: null,
    maxAttempts: 2,
    retryDelayMs: 1,
    submitMode: "create",
  });
  const finalJob = await waitForCompletedJob(queue, queued.id);

  assert.equal(finalJob.failed_count, 1);
  assert.equal(finalJob.items[0].status, "failed");
  assert.equal(finalJob.items[0].result.resultKind, "unsafe_retry_blocked");
  assert.match(finalJob.items[0].error, /回读确认/);
  assert.deepEqual(requeueTargets(finalJob.items), []);
});

test("publish queue renews a durable lease while provider submission is still running", async () => {
  const store = createLeasedMemoryStore();
  let resolveSubmission;
  let submissionStartedResolve;
  const submissionStarted = new Promise((resolve) => {
    submissionStartedResolve = resolve;
  });
  const submission = new Promise((resolve) => {
    resolveSubmission = resolve;
  });
  const queue = createProductArchivePublishQueue({
    store,
    getDatabase: () => createFakeDb(),
    prepareDraftForSubmit: () => ({ payload: {}, validation: { summary: { blocker_count: 0 } } }),
    submitDraft: async () => {
      submissionStartedResolve();
      await submission;
      return { ok: true, status: "readback_verified" };
    },
    runWithSlot: async (run) => await run(new AbortController().signal),
    onInternalError: () => {},
  });

  const queued = queue.enqueue({
    targets: [{ draftId: 11, spuCode: "SPU-11" }],
    actor: null,
    ipAddress: null,
    maxAttempts: 1,
    retryDelayMs: 1,
    submitMode: "create",
  });
  await submissionStarted;
  await delay(20);

  assert.ok(store.renewedJobIds.includes(queued.id));
  resolveSubmission();
  const finalJob = await waitForCompletedJob(queue, queued.id);
  const renewalsAfterCompletion = store.renewedJobIds.length;
  await delay(20);

  assert.equal(finalJob.status, "completed");
  assert.equal(store.renewedJobIds.length, renewalsAfterCompletion);
});

test("publish queue does not complete after its durable lease renewal fails", async () => {
  const store = createLeasedMemoryStore({ renew: () => false });
  let resolveSubmission;
  let submissionStartedResolve;
  const submissionStarted = new Promise((resolve) => {
    submissionStartedResolve = resolve;
  });
  const submission = new Promise((resolve) => {
    resolveSubmission = resolve;
  });
  const queue = createProductArchivePublishQueue({
    store,
    getDatabase: () => createFakeDb(),
    prepareDraftForSubmit: () => ({ payload: {}, validation: { summary: { blocker_count: 0 } } }),
    submitDraft: async () => {
      submissionStartedResolve();
      await submission;
      return { ok: true, status: "readback_verified" };
    },
    runWithSlot: async (run) => await run(new AbortController().signal),
    onInternalError: () => {},
  });

  const queued = queue.enqueue({
    targets: [{ draftId: 12, spuCode: "SPU-12" }],
    actor: null,
    ipAddress: null,
    maxAttempts: 1,
    retryDelayMs: 1,
    submitMode: "create",
  });
  await submissionStarted;
  await delay(20);
  resolveSubmission();
  await delay(20);

  assert.ok(store.renewedJobIds.includes(queued.id));
  assert.equal(store.get(queued.id)?.status, "running");
});

test("every durable product archive queue starts the shared lease heartbeat", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const queueSections = [
    ["export function createProductArchiveAiFillQueue", "function cloneProductArchivePrecheckJob"],
    ["function createProductArchivePrecheckQueue", "function createProductArchivePublishLimiter"],
    ["export function createProductArchivePublishQueue", "function cloneHangtagWashlabelOcrJob"],
    ["function createHangtagWashlabelOcrQueue", "const productArchiveAiFillQueue"],
  ];

  for (const [startMarker, endMarker] of queueSections) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing queue section: ${startMarker}`);
    assert.match(source.slice(start, end), /startProductArchiveQueueLeaseHeartbeat\(/);
  }
});

test("publish queue source keeps submitProductArchiveDraft as the single production submission boundary", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const queueStart = source.indexOf("function createProductArchivePublishQueue");
  const queueEnd = source.indexOf("function cloneHangtagWashlabelOcrJob", queueStart);
  const queueSource = source.slice(queueStart, queueEnd);

  assert.match(queueSource, /submitDraft = \(_db,\s*draftId/);
  assert.match(queueSource, /submitProductArchiveDraft\(getDatabase\(\),\s*draftId/);
  assert.match(queueSource, /LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY/);
  assert.match(queueSource, /Promise\.allSettled/);

  const serviceSource = await readFile(SERVICE_PATH, "utf8");
  assert.match(serviceSource, /submit_claim_token/);
  assert.match(serviceSource, /return await readbackProductArchiveDraft/);
});

test("publish page describes submitting and readback instead of accepted-submit success", async () => {
  const source = await readFile(PAGE_PATH, "utf8");

  assert.match(source, /提交后继续等待深绘回读校验/);
  assert.match(source, /提交中\/回读中/);
  assert.doesNotMatch(source, /提交受理即视为发布成功/);
});
