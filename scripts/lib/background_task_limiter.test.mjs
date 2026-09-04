import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  BackgroundTaskTimeoutError,
  backgroundTaskLimiterSnapshot,
  withBackgroundTaskSlot,
} from "../../web/server/lib/background-task-limiter.ts";

test("background limiter times out cooperative work and releases slots after it settles", async () => {
  const previousMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  const previousTimeout = process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS;
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "2";
  process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS = "30";
  const keepAlive = setInterval(() => {}, 1_000);
  try {
    let abortedCount = 0;
    const hung = () => withBackgroundTaskSlot("product_archive_draft", async (signal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          abortedCount += 1;
          reject(signal.reason);
        }, { once: true });
      });
    });
    const first = hung();
    const second = hung();
    const third = withBackgroundTaskSlot("product_archive_draft", async () => "released");

    await assert.rejects(first, BackgroundTaskTimeoutError);
    assert.equal(await third, "released");
    await assert.rejects(second, BackgroundTaskTimeoutError);
    assert.equal(abortedCount, 2);
    assert.deepEqual(backgroundTaskLimiterSnapshot().activeByLane, {});
    assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
    assert.equal(backgroundTaskLimiterSnapshot().queuedCount, 0);
  } finally {
    clearInterval(keepAlive);
    if (previousMax == null) delete process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
    else process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = previousMax;
    if (previousTimeout == null) delete process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS;
    else process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS = previousTimeout;
  }
});

test("background limiter removes an aborted waiter without consuming a slot", async () => {
  const previousMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "1";
  try {
    let releaseBlocker;
    const blocker = withBackgroundTaskSlot("product_archive_sync", () => new Promise((resolve) => {
      releaseBlocker = resolve;
    }), { timeoutMs: 1_000 });
    const controller = new AbortController();
    const waiting = withBackgroundTaskSlot("product_archive_sync", async () => "unexpected", {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort();
    await assert.rejects(waiting, { name: "AbortError" });
    assert.equal(backgroundTaskLimiterSnapshot().queuedCount, 0);
    releaseBlocker("done");
    assert.equal(await blocker, "done");
    assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
  } finally {
    if (previousMax == null) delete process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
    else process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = previousMax;
  }
});

test("background limiter allows tested AI-fill isolation capacity up to the configured cap", () => {
  const previousMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "32";
  try {
    assert.equal(backgroundTaskLimiterSnapshot().maxActive, 16);
  } finally {
    if (previousMax == null) delete process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
    else process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = previousMax;
  }
});

test("background limiter releases an active slot when cancelled work settles", async () => {
  const controller = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const running = withBackgroundTaskSlot("product_archive_ocr", async (signal) => {
    markStarted();
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }, {
    signal: controller.signal,
    timeoutMs: 1_000,
  });
  await started;
  controller.abort(new Error("caller cancelled"));
  await assert.rejects(running, /caller cancelled/);
  assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
});

test("background limiter keeps a timed-out slot until the underlying task settles", async () => {
  const previousMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "1";
  let settleTimedOutTask;
  let queuedTaskStarted = false;
  try {
    const timedOut = withBackgroundTaskSlot(
      "product_archive_ai_fill",
      () => new Promise((resolve) => {
        settleTimedOutTask = resolve;
      }),
      { timeoutMs: 20 },
    );
    const queued = withBackgroundTaskSlot(
      "product_archive_ai_fill",
      async () => {
        queuedTaskStarted = true;
        return "queued task completed";
      },
      { timeoutMs: 1_000 },
    );

    const timeoutAssertion = assert.rejects(timedOut, BackgroundTaskTimeoutError);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await timeoutAssertion;
    const beforeUnderlyingSettlement = backgroundTaskLimiterSnapshot();
    const startedBeforeUnderlyingSettlement = queuedTaskStarted;

    settleTimedOutTask("late completion");
    assert.equal(await queued, "queued task completed");

    assert.equal(startedBeforeUnderlyingSettlement, false);
    assert.equal(beforeUnderlyingSettlement.activeCount, 1);
    assert.equal(beforeUnderlyingSettlement.queuedCount, 1);
    assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
  } finally {
    settleTimedOutTask?.("test cleanup");
    if (previousMax == null) delete process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
    else process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = previousMax;
  }
});

test("product archive AI item concurrency keeps OCR on its separate lane", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const route = await readFile(path.join(root, "web/server/routes/product-archive-drafts.ts"), "utf8");
  const aiQueueStart = route.indexOf("export function createProductArchiveAiFillQueue");
  const ocrQueueStart = route.indexOf("function cloneHangtagWashlabelOcrJob");
  const aiQueueSection = route.slice(aiQueueStart, ocrQueueStart);
  const ocrQueueSection = route.slice(ocrQueueStart);

  assert.match(route, /LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY/);
  assert.match(aiQueueSection, /product_archive_ai_fill/);
  assert.doesNotMatch(aiQueueSection, /product_archive_ocr/);
  assert.match(ocrQueueSection, /withBackgroundTaskSlot\("product_archive_ocr"/);
});
