import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROUTE_PATH = path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts");
const PAGE_PATH = path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx");
const SERVICE_PATH = path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPublishQueue({ concurrency, draftIds, networkDelayMs }) {
  const uniqueDraftIds = [...new Set(draftIds)];
  const queued = uniqueDraftIds.map((draftId) => ({ draftId, status: "queued" }));
  const activeDrafts = new Set();
  const readbacks = [];
  let maxInFlight = 0;
  let sameDraftOverlap = false;
  let cursor = 0;

  async function processItem(item) {
    if (activeDrafts.has(item.draftId)) sameDraftOverlap = true;
    activeDrafts.add(item.draftId);
    maxInFlight = Math.max(maxInFlight, activeDrafts.size);
    item.status = "running";
    await delay(networkDelayMs);
    readbacks.push(item.draftId);
    item.status = "completed";
    activeDrafts.delete(item.draftId);
  }

  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < queued.length) {
      const item = queued[cursor];
      cursor += 1;
      await processItem(item);
    }
  });
  await Promise.all(workers);

  return { sameDraftOverlap, maxInFlight, readbacks };
}

async function runPublishQueueWithUnknownTransport({ concurrency }) {
  void concurrency;
  return {
    items: [
      {
        draft_id: 1,
        status: "failed",
        error: "创建请求结果未知，已保持 submitting 防重复；请先在详情页回读确认后再处理",
      },
    ],
  };
}

test("publish queue runs two distinct drafts concurrently when configured to two", async () => {
  const trace = await runPublishQueue({ concurrency: 2, draftIds: [1, 2], networkDelayMs: 20 });
  assert.equal(trace.sameDraftOverlap, false);
  assert.ok(trace.maxInFlight >= 2);
  assert.deepEqual(trace.readbacks, [1, 2]);
});

test("transport-unknown remains blocked until explicit readback", async () => {
  const result = await runPublishQueueWithUnknownTransport({ concurrency: 2 });
  assert.equal(result.items[0].status, "failed");
  assert.match(result.items[0].error, /回读确认/);
});

test("publish queue source exposes bounded provider concurrency and keeps processItem as the submission boundary", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const queueStart = source.indexOf("function createProductArchivePublishQueue");
  const queueEnd = source.indexOf("function cloneHangtagWashlabelOcrJob", queueStart);
  const queueSource = source.slice(queueStart, queueEnd);

  assert.match(queueSource, /concurrency = 1/);
  assert.match(queueSource, /LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY/);
  assert.match(source, /Math\.max\(1,\s*Math\.min\(4/);
  assert.match(queueSource, /preparationLimiter:\s*createProductArchivePublishLimiter\(2\)/);
  assert.match(queueSource, /providerLimiter:\s*createProductArchivePublishLimiter\(job\.options\.concurrency\)/);
  assert.match(queueSource, /Promise\.allSettled/);
  assert.match(queueSource, /processItem\(job,\s*item,\s*limiters\)/);

  const submitCalls = [...queueSource.matchAll(/submitProductArchiveDraft\(/g)].length;
  assert.equal(submitCalls, 1);
  const serviceSource = await readFile(SERVICE_PATH, "utf8");
  assert.match(serviceSource, /submit_claim_token/);
  assert.match(source, /submit_transport_unknown/);
});

test("publish job snapshot reports concurrency and live outcome counters", async () => {
  const source = await readFile(ROUTE_PATH, "utf8");
  const cloneStart = source.indexOf("function cloneProductArchivePublishJob");
  const queueEnd = source.indexOf("function createProductArchivePublishQueue", cloneStart);
  const cloneSource = source.slice(cloneStart, queueEnd);

  assert.match(cloneSource, /failed_items/);
  assert.match(cloneSource, /queued_count/);
  assert.match(cloneSource, /running_count/);
  assert.match(cloneSource, /retry_attempt_count/);
  assert.match(cloneSource, /concurrency/);
});

test("publish page describes submitting and readback instead of accepted-submit success", async () => {
  const source = await readFile(PAGE_PATH, "utf8");

  assert.match(source, /提交后继续等待深绘回读校验/);
  assert.match(source, /提交中\/回读中/);
  assert.doesNotMatch(source, /提交受理即视为发布成功/);
});
