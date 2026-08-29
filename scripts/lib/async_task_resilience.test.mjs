import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const file = (relativePath) => readFile(path.join(PROJECT_ROOT, relativePath), "utf8");

test("category AI stop fences stale workers before suggestion business writes", async () => {
  const [migration, categoryRoute, systemRoute] = await Promise.all([
    file("db/migrations/054_async_task_resilience.sql"),
    file("web/server/routes/category-mapping.ts"),
    file("web/server/routes/system.ts"),
  ]);

  assert.match(migration, /claim_token text/);
  assert.match(migration, /claim_version bigint not null default 0/);
  assert.match(migration, /claim_expires_at timestamptz/);
  assert.match(categoryRoute, /function claimCategoryAiSuggestionJob/);
  assert.match(categoryRoute, /and claim_token = \?/);
  assert.match(categoryRoute, /and claim_version = \?/);
  assert.match(categoryRoute, /assertCategoryAiClaim[\s\S]+persistAiSuggestions[\s\S]+updateClaimedCategoryAiJob/);
  assert.match(categoryRoute, /async function processCategoryAiSuggestionQueue[\s\S]+try \{[\s\S]+finally \{[\s\S]+categoryAiRunning = false/);
  assert.match(systemRoute, /claim_token = null[\s\S]+claim_version = claim_version \+ 1/);
});

test("source imports stay invisible until every chunk is committed", async () => {
  const [migration, service, route] = await Promise.all([
    file("db/migrations/054_async_task_resilience.sql"),
    file("web/server/services/product-archive-drafts.ts"),
    file("web/server/routes/product-archive-drafts.ts"),
  ]);

  assert.match(migration, /import_status text not null default 'committed'/);
  assert.match(service, /'importing'/);
  assert.match(service, /set import_status = 'committed'/);
  assert.match(service, /batch\.import_status = 'committed'/);
  assert.match(service, /and import_status = 'committed'/);
  assert.match(route, /product_archive_source_import/);
  assert.match(route, /readSpreadsheetSheetsFromFileInWorker\(filePath, \{ fileName, signal \}\)/);
});

test("all backend requeue helpers reject active parent jobs", async () => {
  const [categoryRoute, draftRoute, platformJobs] = await Promise.all([
    file("web/server/routes/category-mapping.ts"),
    file("web/server/routes/product-archive-drafts.ts"),
    file("web/server/services/shein-platform-product-jobs.ts"),
  ]);

  assert.match(categoryRoute, /normalizeText\(row\.status\) !== "completed"/);
  assert.match(categoryRoute, /select \*[\s\S]+category_ai_suggestion_job[\s\S]+for update/);
  assert.equal((draftRoute.match(/readCompletedProductArchiveTask<NonNullable<ReturnType/g) ?? []).length, 5);
  assert.match(draftRoute, /from product_archive_sync_job[\s\S]+for update[\s\S]+!== "completed"/);
  assert.match(platformJobs, /shein_platform_product_job[\s\S]+for update[\s\S]+job\.status !== "completed"/);
});

test("spreadsheet worker protocol never clones a whole workbook in one message", async () => {
  const [worker, service] = await Promise.all([
    file("scripts/lib/spreadsheet_parse_worker.mjs"),
    file("web/server/services/spreadsheet-worker.ts"),
  ]);

  assert.match(worker, /type: "chunk"/);
  assert.match(worker, /type !== "ack"/);
  assert.doesNotMatch(worker, /ok: true, sheets/);
  assert.match(service, /message\.rows\.length > limits\.chunkRows/);
  assert.match(service, /maxRows/);
  assert.match(service, /maxCells/);
  assert.match(service, /maxTotalChars/);
  assert.match(service, /maxOldGenerationSizeMb/);
  assert.match(service, /maxFileBytes/);
});
