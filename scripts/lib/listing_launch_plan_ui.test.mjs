import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/028_listing_launch_plan.sql"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/listing-launch-plans.ts"),
  service: path.join(PROJECT_ROOT, "web/server/services/listing-launch-plans.ts"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  sidebar: path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx"),
  page: path.join(PROJECT_ROOT, "web/src/pages/listing-launch-plans/page.tsx"),
  draftListPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx"),
};

test("listing launch plan schema stores imports and normalized rows separately from draft source rows", async () => {
  const migration = await readFile(files.migration, "utf8");

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
});

test("listing launch plan API and page expose server-side upload and parsed row browsing", async () => {
  const [server, route, service, router, sidebar, page, draftRoute, draftListPage] = await Promise.all([
    readFile(files.server, "utf8"),
    readFile(files.route, "utf8"),
    readFile(files.service, "utf8"),
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.page, "utf8"),
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftListPage, "utf8"),
  ]);

  assert.match(server, /import listingLaunchPlans from "\.\/routes\/listing-launch-plans"/);
  assert.match(server, /app\.route\("\/api\/listing-launch-plans", listingLaunchPlans\)/);
  assert.match(route, /listingLaunchPlans\.get\("\/imports"/);
  assert.match(route, /listingLaunchPlans\.get\("\/rows"/);
  assert.match(route, /listingLaunchPlans\.post\("\/imports"/);
  assert.match(route, /c\.req\.formData\(\)/);
  assert.match(route, /readSpreadsheetSheetsFromFile/);
  assert.match(route, /importProductArchiveSourceRows/);
  assert.match(service, /export function importListingLaunchPlanSheets/);
  assert.match(service, /normalizeListingLaunchPlanRows/);
  assert.match(service, /insert into listing_launch_plan_import/);
  assert.match(service, /insert into listing_launch_plan_row/);
  assert.match(service, /export function listListingLaunchPlanRows/);
  assert.match(service, /export function listListingLaunchPlanImports/);

  assert.match(router, /ListingLaunchPlansPage/);
  assert.match(router, /path: "listing-launch-plans"/);
  assert.match(sidebar, /上市计划表/);
  assert.match(sidebar, /\/listing-launch-plans/);
  assert.match(page, /上市计划表/);
  assert.match(page, /FormData/);
  assert.match(page, /\/listing-launch-plans\/imports/);
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
