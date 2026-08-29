import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/028_listing_launch_plan.sql"),
  importJobMigration: path.join(PROJECT_ROOT, "db/migrations/033_listing_launch_plan_import_jobs.sql"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/listing-launch-plans.ts"),
  service: path.join(PROJECT_ROOT, "web/server/services/listing-launch-plans.ts"),
  importJobService: path.join(PROJECT_ROOT, "web/server/services/listing-launch-plan-import-jobs.ts"),
  spreadsheetWorkerService: path.join(PROJECT_ROOT, "web/server/services/spreadsheet-worker.ts"),
  spreadsheetParserWorker: path.join(PROJECT_ROOT, "scripts/lib/spreadsheet_parse_worker.mjs"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  sidebar: path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx"),
  page: path.join(PROJECT_ROOT, "web/src/pages/listing-launch-plans/page.tsx"),
  draftListPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx"),
};

test("listing launch plan schema stores imports and normalized rows separately from draft source rows", async () => {
  const migration = await readFile(files.migration, "utf8");
  const importJobMigration = await readFile(files.importJobMigration, "utf8");

  assert.match(migration, /postgres-only/);
  assert.match(migration, /create table if not exists listing_launch_plan_import/);
  assert.match(migration, /create table if not exists listing_launch_plan_row/);
  assert.match(migration, /source_batch_ids_json jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /official_category text/);
  assert.match(migration, /vip_category text/);
  assert.match(migration, /douyin_category text/);
  assert.match(migration, /raw_row_json jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /idx_listing_launch_plan_row_spu/);
  assert.match(migration, /idx_listing_launch_plan_row_category/);
  assert.doesNotMatch(migration, /sqlite|autoincrement|strftime/i);

  assert.match(importJobMigration, /postgres-only/);
  assert.match(importJobMigration, /create table if not exists listing_launch_plan_import_job/);
  assert.match(importJobMigration, /result_json jsonb not null default '\{\}'::jsonb/);
  assert.match(importJobMigration, /check\(status in \('queued', 'running', 'completed'\)\)/);
  assert.doesNotMatch(importJobMigration, /sqlite|autoincrement|strftime/i);
});

test("listing launch plan API and page expose server-side upload and parsed row browsing", async () => {
  const [server, route, service, importJobService, router, sidebar, page, draftRoute, draftService, draftListPage] = await Promise.all([
    readFile(files.server, "utf8"),
    readFile(files.route, "utf8"),
    readFile(files.service, "utf8"),
    readFile(files.importJobService, "utf8"),
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.page, "utf8"),
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftService, "utf8"),
    readFile(files.draftListPage, "utf8"),
  ]);

  assert.match(server, /import listingLaunchPlans from "\.\/routes\/listing-launch-plans"/);
  assert.match(server, /app\.route\("\/api\/listing-launch-plans", listingLaunchPlans\)/);
  assert.match(route, /listingLaunchPlans\.get\("\/imports"/);
  assert.match(route, /listingLaunchPlans\.get\("\/rows"/);
  assert.match(route, /listingLaunchPlans\.post\("\/imports"/);
  assert.match(route, /listingLaunchPlans\.get\("\/import-jobs\/:jobId"/);
  assert.match(route, /c\.req\.formData\(\)/);
  assert.match(route, /randomUUID/);
  assert.match(route, /enqueueListingLaunchPlanImportJob/);
  assert.match(route, /getListingLaunchPlanImportJob/);
  assert.match(service, /export function importListingLaunchPlanSheets/);
  assert.match(service, /export async function importListingLaunchPlanSheetsInChunks/);
  assert.match(service, /normalizeListingLaunchPlanRows/);
  assert.match(service, /insert into listing_launch_plan_import/);
  assert.match(service, /insert into listing_launch_plan_row/);
  assert.match(service, /export function listListingLaunchPlanRows/);
  assert.match(service, /max\(import_id\) as import_id/);
  assert.match(service, /latest\.spu_code = row\.spu_code/);
  assert.match(service, /latest\.import_id = row\.import_id/);
  assert.match(service, /export function listListingLaunchPlanImports/);
  assert.match(importJobService, /readSpreadsheetSheetsFromFile/);
  assert.match(importJobService, /importProductArchiveSourceRows/);
  assert.match(importJobService, /refreshProductArchiveDraftsFromSourceBatchInChunks/);
  assert.match(importJobService, /importListingLaunchPlanSheetsInChunks/);
  assert.doesNotMatch(importJobService, /importListingLaunchPlanSheets\(getDb\(\)/);
  assert.match(draftService, /export async function refreshProductArchiveDraftsFromSourceBatchInChunks/);
  assert.match(importJobService, /export function enqueueListingLaunchPlanImportJob/);
  assert.match(importJobService, /export function getListingLaunchPlanImportJob/);
  assert.match(importJobService, /scheduleListingLaunchPlanImportJobs/);
  assert.doesNotMatch(importJobService, /id:\s*job\.actor\.id\s*\?\?\s*0/);

  assert.match(router, /ListingLaunchPlansPage/);
  assert.match(router, /path: "listing-launch-plans"/);
  assert.match(sidebar, /上市计划表/);
  assert.match(sidebar, /\/listing-launch-plans/);
  assert.match(page, /上市计划表/);
  assert.match(page, /同款号以最近一次导入为准/);
  assert.match(page, /覆盖同款号的生效明细/);
  assert.match(page, /FormData/);
  assert.match(page, /\/listing-launch-plans\/imports/);
  assert.match(page, /\/listing-launch-plans\/import-jobs\/\$\{job\.id\}/);
  assert.match(page, /useAsyncTasks/);
  assert.match(page, /addTask/);
  assert.match(page, /openTaskCenter/);
  assert.match(page, /listing_launch_plan_import/);
  assert.match(page, /\/listing-launch-plans\/rows/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /官方发布类目/);
  assert.match(page, /款号、款色、类目/);

  assert.match(draftRoute, /productArchiveDrafts\.post\("\/source-imports\/upload"/);
  assert.match(draftRoute, /readSpreadsheetSheetsFromFile/);
  assert.match(draftRoute, /refreshProductArchiveDraftsFromSourceBatch/);
  assert.match(draftListPage, /FormData/);
  assert.doesNotMatch(draftListPage, /readSpreadsheetWorkbook/);
});

test("draft source import refreshes existing drafts after launch plan or copywriting uploads", async () => {
  const draftService = await readFile(files.draftService, "utf8");

  assert.match(draftService, /export function refreshProductArchiveDraftsFromSourceBatch/);
  assert.match(draftService, /chooseDeepdrawTradeFromLaunchPlanRows/);
  assert.match(draftService, /applyProductArchiveDraftTrade/);
  assert.match(draftService, /rebuildProductArchiveDraftFields/);
  assert.match(draftService, /sourceBatchIds/);
});

test("listing launch plan import jobs offload spreadsheet parsing and chunk source writes", async () => {
  const [service, importJobService, spreadsheetWorkerService, spreadsheetParserWorker, draftService] = await Promise.all([
    readFile(files.service, "utf8"),
    readFile(files.importJobService, "utf8"),
    readFile(files.spreadsheetWorkerService, "utf8"),
    readFile(files.spreadsheetParserWorker, "utf8"),
    readFile(files.draftService, "utf8"),
  ]);

  assert.match(importJobService, /readSpreadsheetSheetsFromFileInWorker/);
  assert.doesNotMatch(importJobService, /import \{ readSpreadsheetSheetsFromFile \}/);
  assert.match(spreadsheetWorkerService, /from "node:worker_threads"/);
  assert.match(spreadsheetWorkerService, /new Worker/);
  assert.match(spreadsheetWorkerService, /spreadsheet_parse_worker\.mjs/);
  assert.match(spreadsheetParserWorker, /streamSpreadsheetSheetsFromFile/);
  assert.match(spreadsheetParserWorker, /port\.postMessage/);
  assert.match(spreadsheetParserWorker, /type: "chunk"/);
  assert.match(spreadsheetParserWorker, /type !== "ack"/);

  assert.match(service, /normalizeListingLaunchPlanRowsInChunks/);
  assert.match(draftService, /export async function importProductArchiveSourceRowsInChunks/);
  assert.match(importJobService, /importProductArchiveSourceRowsInChunks/);
  assert.match(importJobService, /onProgress: \(\{ sourceBatchId, insertedRowCount, totalRowCount \}\)/);
});
