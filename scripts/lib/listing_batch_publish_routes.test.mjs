import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

test("listing batch routes expose batch publish task summary sync and retry endpoints", async () => {
  const route = await readFile(path.join(PROJECT_ROOT, "web/server/routes/listing-batches.ts"), "utf8");
  assert.match(route, /post\("\/:id\/publish-tasks"/);
  assert.match(route, /get\("\/:id\/publish-summary"/);
  assert.match(route, /post\("\/:id\/sync-status"/);
  assert.match(route, /post\("\/:id\/retry-failed"/);
  assert.match(route, /ensureBatchPublishTasks/);
  assert.match(route, /publishSummaryForBatch/);
  assert.match(route, /retryFailedBatchTasks/);
  assert.match(route, /refreshBatchPublishSummary/);
});
