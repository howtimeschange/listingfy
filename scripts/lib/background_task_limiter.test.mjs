import assert from "node:assert/strict";
import test from "node:test";
import {
  BackgroundTaskTimeoutError,
  backgroundTaskLimiterSnapshot,
  withBackgroundTaskSlot,
} from "../../web/server/lib/background-task-limiter.ts";

test("background limiter times out hung work and releases slots for queued tasks", async () => {
  const previousMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  const previousTimeout = process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS;
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "2";
  process.env.LISTINGIFY_BACKGROUND_TASK_TIMEOUT_MS = "30";
  const keepAlive = setInterval(() => {}, 1_000);
  try {
    let abortedCount = 0;
    const hung = () => withBackgroundTaskSlot("product_archive_draft", async (signal) => {
      signal.addEventListener("abort", () => { abortedCount += 1; }, { once: true });
      return new Promise(() => {});
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

test("background limiter releases an active slot when the caller cancels hung work", async () => {
  const controller = new AbortController();
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const running = withBackgroundTaskSlot("product_archive_ocr", async () => {
    markStarted();
    return new Promise(() => {});
  }, {
    signal: controller.signal,
    timeoutMs: 1_000,
  });
  await started;
  controller.abort(new Error("caller cancelled"));
  await assert.rejects(running, /caller cancelled/);
  assert.equal(backgroundTaskLimiterSnapshot().activeCount, 0);
});
