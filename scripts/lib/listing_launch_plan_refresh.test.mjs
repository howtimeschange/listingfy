import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { refreshProductArchiveDraftsFromSourceBatchInChunks } from "../../web/server/services/product-archive-drafts.ts";
import { withBackgroundTaskSlot, backgroundTaskLimiterSnapshot } from "../../web/server/lib/background-task-limiter.ts";
import { isAsyncTaskTerminal } from "../../web/src/lib/async-task-context.ts";

const db = { prepare: () => ({ all: () => Array.from({ length: 6 }, (_, id) => ({ id: id + 1 })) }) };
const summary = {
  scannedDraftCount: 1, processedDraftCount: 1, refreshedDraftCount: 1,
  validatedDraftCount: 0, autoAppliedTradeCount: 0, skippedNoTradeMatchCount: 0, failedDrafts: [],
};

test("large refresh spans multiple timeout windows while each chunk stays bounded", async () => {
  const progress = [];
  let calls = 0;
  const started = Date.now();
  const result = await refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
    sourceBatchId: 168, sourceType: "launch_plan",
  }, {
    chunkSize: 1,
    runChunk: () => withBackgroundTaskSlot("listing_launch_plan_import", async () => {
      calls += 1;
      await delay(30);
      return summary;
    }, { timeoutMs: 150 }),
    onProgress: (value) => progress.push(value.processedDraftCount),
  });
  assert.ok(Date.now() - started > 150);
  assert.equal(calls, 6);
  assert.equal(result.refreshedDraftCount, 6);
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6]);
  assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
});

test("cancelling a refresh between chunks prevents remaining draft work", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
    sourceBatchId: 168, sourceType: "launch_plan",
  }, {
    chunkSize: 1, signal: controller.signal,
    runChunk: async () => { calls += 1; return summary; },
    onProgress: () => controller.abort(new Error("stop refresh")),
  }), /stop refresh/);
  assert.equal(calls, 1);
});

test("task center recognizes failed and cancelled imports as terminal", () => {
  for (const status of ["completed", "failed", "cancelled"]) assert.equal(isAsyncTaskTerminal({ status }), true);
  for (const status of ["queued", "running"]) assert.equal(isAsyncTaskTerminal({ status }), false);
  assert.equal(isAsyncTaskTerminal(null), false);
});

test("a cancelled slot cannot enter the draft transaction", async () => {
  const controller = new AbortController();
  await assert.rejects(refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
    sourceBatchId: 168, sourceType: "launch_plan",
  }, {
    runChunk: async (run) => {
      controller.abort(new Error("slot expired"));
      return run(controller.signal);
    },
  }), /slot expired/);
});
