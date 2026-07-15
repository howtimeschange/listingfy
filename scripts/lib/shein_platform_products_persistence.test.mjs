import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/021_shein_platform_products.sql");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/shein-platform-products.ts");
const SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/shein-platform-products.ts");
const JOB_SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/shein-platform-product-jobs.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-platform-products/page.tsx");
const TASK_CENTER_FILE = path.join(PROJECT_ROOT, "web/src/components/async-task-center.tsx");
const JOB_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/027_shein_platform_product_jobs.sql");
const JOB_ITEM_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/034_shein_platform_product_job_items.sql");
const SYNC_SCHEDULE_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/035_shein_platform_product_sync_schedule.sql");
const SYNC_SCHEDULE_OPT_IN_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/041_shein_sync_schedule_opt_in.sql");
const SALE_SITE_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/037_shein_platform_product_sale_sites.sql");

async function fileText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-shein-platform-products-"));
  const db = new DatabaseSync(path.join(tempPath, "test.sqlite"));
  db.exec("pragma foreign_keys = on");
  db.exec(`
    create table platform_integration (
      id integer primary key autoincrement
    );
    create table app_user (
      id integer primary key autoincrement
    );
  `);
  db.exec(await readFile(MIGRATION_FILE, "utf8"));
  db.exec(`
    create table shein_platform_product_sale_site (
      id integer primary key autoincrement,
      platform text not null default 'SHEIN',
      platform_account_key text not null default 'default',
      product_id integer not null references shein_platform_product(id) on delete cascade,
      skc_id integer references shein_platform_skc(id) on delete cascade,
      spu_name text not null,
      skc_name text,
      skc_supplier_code text,
      site_abbr text not null,
      site_name text,
      shelf_status integer,
      first_shelf_time text,
      last_shelf_time text,
      link text,
      source text not null default 'SPU',
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

async function createTempScheduledSyncDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-shein-scheduled-sync-"));
  const db = new DatabaseSync(path.join(tempPath, "test.sqlite"));
  db.exec("pragma foreign_keys = on");
  db.exec(`
    create table platform_integration (
      id integer primary key autoincrement,
      platform text,
      status text,
      open_key_id text,
      secret_key text,
      is_default integer,
      base_url text,
      language text
    );
    create table app_user (
      id integer primary key autoincrement,
      username text,
      display_name text,
      status text
    );
  `);
  db.exec(await readFile(MIGRATION_FILE, "utf8"));
  db.exec(await readFile(JOB_MIGRATION_FILE, "utf8"));
  db.exec(await readFile(JOB_ITEM_MIGRATION_FILE, "utf8"));
  db.exec(await readFile(SYNC_SCHEDULE_MIGRATION_FILE, "utf8"));
  db.prepare(`
    insert into app_user (id, username, display_name, status)
    values (1, 'admin', '系统管理员', 'ACTIVE')
  `).run();
  db.prepare(`
    insert into shein_platform_product (
      platform,
      platform_account_key,
      spu_name,
      product_name,
      last_list_synced_at,
      updated_at,
      created_at
    )
    values ('SHEIN', 'env:default', ?, ?, ?, ?, ?)
  `).run("SPU-SCHEDULE-001", "定时同步测试商品", "2026-07-07T00:00:00.000Z", "2026-07-07T00:00:00.000Z", "2026-07-07T00:00:00.000Z");
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

async function importService() {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/listingify_test";
  return await import("../../web/server/services/shein-platform-products.ts");
}

async function importJobService() {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/listingify_test";
  return await import("../../web/server/services/shein-platform-product-jobs.ts");
}

function testContext() {
  return {
    credentials: {
      source: "environment",
      platformIntegrationId: null,
      baseUrl: "https://example.invalid",
      language: "zh-cn",
      openKeyId: "test-open-key",
      secretKey: "test-secret",
    },
    platform: "SHEIN",
    platformAccountKey: "test-account",
    platformIntegrationId: null,
  };
}

test("SHEIN platform products have persistent product, variant, site, and operation tables", async () => {
  const migration = await fileText(MIGRATION_FILE);

  assert.match(migration, /create table if not exists shein_platform_product/);
  assert.match(migration, /spu_name text not null/);
  assert.match(migration, /raw_list_payload_json text not null default '\{\}'/);
  assert.match(migration, /raw_detail_payload_json text not null default '\{\}'/);
  assert.match(migration, /unique\(platform, platform_account_key, spu_name\)/);
  assert.match(migration, /brand_name text/);
  assert.match(migration, /category_name text/);

  assert.match(migration, /create table if not exists shein_platform_skc/);
  assert.match(migration, /skc_name text not null/);
  assert.match(migration, /unique\(product_id, skc_name\)/);

  assert.match(migration, /create table if not exists shein_platform_sku/);
  assert.match(migration, /sku_code text not null/);
  assert.match(migration, /supplier_sku/);
  assert.match(migration, /cost_price numeric/);
  assert.match(migration, /unique\(skc_id, sku_code\)/);

  assert.match(migration, /create table if not exists shein_platform_site/);
  assert.match(migration, /site_abbr text not null/);
  assert.match(migration, /currency text/);

  assert.match(migration, /create table if not exists shein_lifecycle_operation/);
  assert.match(migration, /operation_type text not null/);
  assert.match(migration, /request_payload_json text not null default '\{\}'/);
  assert.match(migration, /response_payload_json text not null default '\{\}'/);
});

test("SHEIN platform products normalize sale sites for indexed list filtering", async () => {
  const [migration, service] = await Promise.all([
    fileText(SALE_SITE_MIGRATION_FILE),
    fileText(SERVICE_FILE),
  ]);

  assert.match(migration, /create table if not exists shein_platform_product_sale_site/);
  assert.match(migration, /site_abbr text not null/);
  assert.match(migration, /shelf_status integer/);
  assert.match(migration, /idx_shein_platform_sale_site_lookup/);
  assert.doesNotMatch(migration, /::jsonb/);
  assert.doesNotMatch(migration, /jsonb_array_elements/);

  assert.match(service, /persistProductSaleSites/);
  assert.match(service, /insert into shein_platform_product_sale_site/);
  assert.match(service, /from shein_platform_product_sale_site sale_site/);
  assert.match(service, /count\(distinct product_id\) as count/);
});

test("SHEIN platform product async jobs are durable across API workers", async () => {
  const [migration, jobService] = await Promise.all([
    fileText(JOB_MIGRATION_FILE),
    fileText(JOB_SERVICE_FILE),
  ]);

  assert.match(migration, /create table if not exists shein_platform_product_job/);
  assert.match(migration, /id text primary key/);
  assert.match(migration, /job_type text not null/);
  assert.match(migration, /payload_json text not null default '\{\}'/);
  assert.match(migration, /items_json text not null default '\[\]'/);
  assert.match(migration, /download_url text/);
  assert.match(migration, /file_path text/);
  assert.match(migration, /idx_shein_platform_product_job_status/);

  assert.match(jobService, /createPlatformProductJob/);
  assert.match(jobService, /updatePlatformProductJob/);
  assert.match(jobService, /loadPlatformProductJob/);
  assert.match(jobService, /from shein_platform_product_job/);
  assert.match(jobService, /insert into shein_platform_product_job/);
  assert.match(jobService, /update shein_platform_product_job/);
  assert.match(jobService, /getPlatformProductExportJob[\s\S]*loadPlatformProductJob/);
  assert.match(jobService, /readPlatformProductExportFile[\s\S]*loadPlatformProductJob/);
  assert.doesNotMatch(jobService, /exportJobs = new Map/);
});

test("SHEIN platform product detail sync uses durable shards and summary polling for large jobs", async () => {
  const [migration, jobService, taskContext, taskCenter] = await Promise.all([
    fileText(JOB_ITEM_MIGRATION_FILE),
    fileText(JOB_SERVICE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/src/lib/async-task-context.ts")),
    fileText(TASK_CENTER_FILE),
  ]);

  assert.match(migration, /create table if not exists shein_platform_product_job_item/);
  assert.match(migration, /job_id text not null/);
  assert.match(migration, /item_index integer not null/);
  assert.match(migration, /shard_index integer not null default 0/);
  assert.match(migration, /unique\(job_id, item_index\)/);
  assert.match(migration, /idx_shein_platform_product_job_item_status/);

  assert.match(jobService, /MAX_DETAIL_CODES_PER_JOB\s*=\s*20_000/);
  assert.match(jobService, /DETAIL_SYNC_SHARD_SIZE\s*=\s*2_000/);
  assert.match(jobService, /parseSpuCodes\([\s\S]*maxCodes: MAX_DETAIL_CODES_PER_JOB[\s\S]*\)/);
  assert.match(jobService, /createPlatformProductJobItems/);
  assert.match(jobService, /nextPlatformProductJobItem/);
  assert.match(jobService, /loadPlatformProductJobSummary/);
  assert.match(jobService, /current_item/);
  assert.match(jobService, /failed_items/);
  assert.doesNotMatch(jobService, /items: codes\.map\(\(code\) => \(\{ spu_code: code/);

  assert.match(taskContext, /current_item\?: AsyncTaskJobItem \| null/);
  assert.match(taskContext, /failed_items\?: AsyncTaskJobItem\[\]/);
  assert.match(taskCenter, /task\.job\?\.current_item/);
  assert.match(taskCenter, /task\.job\?\.failed_items/);
  assert.doesNotMatch(taskCenter, /task\.job\?\.items\?\.find/);
});

test("SHEIN platform product jobs start after the enqueue response can flush", async () => {
  const jobService = await fileText(JOB_SERVICE_FILE);

  assert.match(jobService, /function schedulePlatformProductJobs/);
  assert.match(jobService, /setImmediate|setTimeout/);
  assert.doesNotMatch(jobService, /queueMicrotask\(\(\) => \{\s*void processLoop\(\)/);
  assert.match(jobService, /await wait\(0\)/);
  assert.match(jobService, /await savePlatformProductJob\(job\)/);
});

test("SHEIN platform product export streams workbook files with progress heartbeats", async () => {
  const [jobService, route] = await Promise.all([
    fileText(JOB_SERVICE_FILE),
    fileText(ROUTE_FILE),
  ]);

  assert.match(jobService, /async function writePlatformProductWorkbookFromPages/);
  assert.match(jobService, /ExcelJS\.stream\.xlsx\.WorkbookWriter/);
  assert.match(jobService, /addRow\(\[\.\.\.columns\]\)\.commit\(\)/);
  assert.match(jobService, /addRow\(columns\.map[\s\S]*\.commit\(\)/);
  assert.match(jobService, /await workbook\.commit\(\)/);
  assert.match(jobService, /writePlatformProductWorkbookFromPages[\s\S]*await savePlatformProductJob\(job\)/);
  assert.match(jobService, /processExportJob[\s\S]*await writePlatformProductWorkbookFromPages\(filePath, job\)/);
  assert.doesNotMatch(jobService, /rows\.push\(\.\.\.response\.items/);
  assert.doesNotMatch(jobService, /readFile\(job\.filePath\)/);
  assert.match(route, /createReadStream/);
  assert.match(route, /Readable\.toWeb/);
  assert.doesNotMatch(route, /c\.body\(result\.buffer/);
  assert.doesNotMatch(jobService, /workbook\.xlsx\.writeBuffer\(\)/);
  assert.doesNotMatch(jobService, /Buffer\.from\(buffer\)/);
  assert.doesNotMatch(jobService, /writeFile\(filePath/);
});

test("SHEIN platform product export keeps final workbook generation visible and recoverable", async () => {
  const [jobService, taskCenter] = await Promise.all([
    fileText(JOB_SERVICE_FILE),
    fileText(TASK_CENTER_FILE),
  ]);

  assert.match(jobService, /const RUNNING_JOB_STALE_MS\s*=/);
  assert.match(jobService, /status = 'running'[\s\S]*updated_at < \?/);
  assert.match(jobService, /job\.status !== "completed"[\s\S]*schedulePlatformProductJobs\(\)/);
  assert.match(jobService, /spu_code: "读取平台商品数据"/);
  assert.match(jobService, /job\.items\[0\]\.spu_code = "生成 Excel 文件"/);
  assert.match(jobService, /job\.completed_count = rowCount/);
  assert.match(taskCenter, /if \(job\.status !== "completed"\) return Math\.min\(99, progress\)/);
  assert.match(taskCenter, /当前：\{runningItem\.spu_code\}/);
});

test("SHEIN platform products backend exposes durable sync and lifecycle actions", async () => {
  const [server, route, service, adapterTypes, adapter] = await Promise.all([
    fileText(SERVER_INDEX),
    fileText(ROUTE_FILE),
    fileText(SERVICE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/types.ts")),
    fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/shein.ts")),
  ]);

  assert.match(server, /import sheinPlatformProducts from "\.\/routes\/shein-platform-products"/);
  assert.match(server, /app\.route\("\/api\/shein-platform-products", sheinPlatformProducts\)/);

  assert.match(route, /sheinPlatformProducts\.get\("\/"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/sync"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/sites"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/sites\/sync"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/detail"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/sync-detail"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/check-edit-permission"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/partial-edit"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/edit-template"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/field-edit"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/variant-template"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/add-variants"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/update-cost"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/sync-status"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/status\/sync"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/operations\/:operationId\/retry"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/revoke"/);
  assert.match(route, /requirePermission\(c,\s*"LISTING_READ"\)/);
  assert.match(route, /requirePermission\(c,\s*"SYNC_RUN"\)/);
  assert.match(route, /requirePermission\(c,\s*"PUBLISH_RUN"\)/);

  assert.match(service, /persistProductListResult/);
  assert.match(service, /persistProductDetailResult/);
  assert.match(service, /recordLifecycleOperation/);
  assert.match(service, /syncPlatformProducts/);
  assert.match(service, /syncProductDetail/);
  assert.match(service, /checkEditPermission/);
  assert.match(service, /partialEditProduct/);
  assert.match(service, /buildEditPayloadFromForm/);
  assert.match(service, /buildVariantTemplateFromDetail/);
  assert.match(service, /fieldEditProduct/);
  assert.match(service, /syncProductDocumentState/);
  assert.match(service, /batchSyncProductDocumentStates/);
  assert.match(service, /retryLifecycleOperation/);
  assert.match(service, /addVariantsToProduct/);
  assert.match(service, /updateProductCost/);
  assert.match(service, /revokeProduct/);
  assert.match(service, /shein_platform_product/);
  assert.match(service, /shein_platform_skc/);
  assert.match(service, /shein_platform_sku/);
  assert.match(service, /shein_lifecycle_operation/);

  assert.match(adapterTypes, /queryDocumentState/);
  assert.match(adapter, /\/open-api\/goods\/query-document-state/);
});

test("SHEIN platform products page reads local durable data and exposes lifecycle controls", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /\/shein-platform-products\?/);
  assert.match(page, /\/shein-platform-products\/sync/);
  assert.match(page, /\/shein-platform-products\/sites/);
  assert.match(page, /\/shein-platform-products\/sites\/sync/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/detail/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/sync-detail/);
  assert.match(page, /\/check-edit-permission/);
  assert.match(page, /\/partial-edit/);
  assert.match(page, /\/edit-template/);
  assert.match(page, /\/field-edit/);
  assert.match(page, /\/variant-template/);
  assert.match(page, /\/add-variants/);
  assert.match(page, /\/update-cost/);
  assert.match(page, /\/sync-status/);
  assert.match(page, /\/status\/sync/);
  assert.match(page, /\/operations\/\$\{.*operation.*id.*\}\/retry/);
  assert.match(page, /\/revoke/);

  assert.match(page, /同步平台商品/);
  assert.match(page, /同步详情/);
  assert.match(page, /检查可编辑/);
  assert.match(page, /常用字段编辑/);
  assert.match(page, /编辑商品资料/);
  assert.match(page, /拼款模板/);
  assert.match(page, /拼款\/追加变体/);
  assert.match(page, /更新成本价/);
  assert.match(page, /同步状态/);
  assert.match(page, /重试失败操作/);
  assert.match(page, /撤回商品/);
  assert.match(page, /最近操作/);
});

test("SHEIN platform product sync paginates list rows and hydrates SPU details incrementally", async () => {
  const service = await fileText(SERVICE_FILE);
  const adapter = await fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/shein.ts"));

  assert.match(adapter, /\/open-api\/openapi-business-backend\/product\/query/);
  assert.match(adapter, /\/open-api\/goods\/spu-info/);
  assert.match(service, /maxPages/);
  assert.match(service, /syncDetails/);
  assert.match(service, /detailLimit/);
  assert.match(service, /while\s*\(|for\s*\(/);
  assert.match(service, /rows\.length\s*<\s*pageSize/);
  assert.match(service, /syncProductDetail/);
  assert.match(service, /last_list_synced_at/);
  assert.match(service, /insertTimeStart/);
  assert.match(service, /updateTimeStart/);
  assert.match(service, /brandName/);
  assert.match(service, /categoryName/);
  assert.match(service, /product\.brand_name/);
  assert.match(service, /product\.category_name/);
  assert.match(service, /filters:\s*\{\s*brands/);
  assert.match(service, /queryProductList\(\{ credentials: context\.credentials, payload: pagePayload \}\)/);
  assert.match(service, /queryProductDetail\(\{ credentials: context\.credentials, payload: requestPayload \}\)/);
  assert.match(service, /spuName: normalizedSpuName/);
  assert.match(service, /languageList: \["zh-cn", "en"\]/);
  assert.doesNotMatch(service, /queryProductList\(\{ credentials: context\.credentials, payload: requestPayload \}\),\s*\)\s*const persistence/s);
});

test("SHEIN platform products list resolves brand and category display names from metadata tables", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.match(service, /shein_brand_rule/);
  assert.match(service, /channel_category/);
  assert.match(service, /brand_display_name/);
  assert.match(service, /category_display_name/);
  assert.match(service, /brand_rule\.local_brand_name/);
  assert.match(service, /brand_rule\.brand_name/);
  assert.match(service, /category_mapping\.category_name/);
  assert.doesNotMatch(service, /coalesce\(nullif\(brand_name, ''\), nullif\(brand_code, ''\)\) as label/);
  assert.doesNotMatch(service, /coalesce\(nullif\(category_name, ''\), nullif\(category_id, ''\)\) as label/);
});

test("SHEIN platform product list stays read-only and avoids full-table sale site filter scans", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.doesNotMatch(service, /ensurePlatformProductNameColumns/);
  assert.doesNotMatch(service, /alter table shein_platform_product add column if not exists/);
  assert.doesNotMatch(service, /create index if not exists idx_shein_platform_product_brand_category/);
  assert.doesNotMatch(service, /export function listPlatformProducts[\s\S]*ensureProductSaleSitesIndexed[\s\S]*const params/);
  assert.match(service, /from shein_platform_site/);
  assert.doesNotMatch(service, /function saleSiteFilterOptions[\s\S]*from shein_platform_product product[\s\S]*function safeProductFilterOptions/);
  assert.doesNotMatch(service, /function productIdsForSaleSite/);
  assert.match(service, /appendSaleSiteFilter/);
  assert.match(service, /from shein_platform_product_sale_site sale_site/);
  assert.doesNotMatch(service, /function appendSaleSiteFilter[\s\S]*jsonb_array_elements[\s\S]*function productFilterOptions/);
  assert.doesNotMatch(service, /function appendSaleSiteFilter[\s\S]*cross join lateral[\s\S]*function productFilterOptions/);
});

test("SHEIN platform products derive sale site details from synced SPU detail payloads", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.match(service, /interface SaleSiteDetail/);
  assert.match(service, /saleSitesFromProduct/);
  assert.match(service, /shelfStatusInfoList/);
  assert.match(service, /shelf_status_info_list/);
  assert.match(service, /siteAbbr/);
  assert.match(service, /shelfStatus/);
  assert.match(service, /firstShelfTime/);
  assert.match(service, /lastShelfTime/);
  assert.match(service, /link/);
  assert.match(service, /saleSites/);
  assert.match(service, /skcSaleSitesFromProduct/);
  assert.match(service, /saleSiteDetails/);
  assert.match(service, /skcSupplierCode/);
  assert.match(service, /saleSiteSummary/);
  assert.match(service, /saleSiteCount/);
  assert.match(service, /saleSitesFromProduct\(\s*row,\s*skcs/);
  assert.match(service, /sites:\s*filters\.sites/);
  assert.match(service, /input\.site/);
});

test("SHEIN platform products keep list pagination light and cache filter options", async () => {
  const [route, service, page] = await Promise.all([
    fileText(ROUTE_FILE),
    fileText(SERVICE_FILE),
    fileText(PAGE_FILE),
  ]);

  assert.match(route, /includeDetails/);
  assert.match(service, /includeDetails\?: boolean \| number \| string/);
  assert.match(service, /PRODUCT_FILTER_CACHE_TTL_MS/);
  assert.match(service, /productFilterCache/);
  assert.match(service, /clearProductFilterCache/);
  assert.match(service, /readListIncludeDetails\(input\.includeDetails\)/);
  assert.match(service, /prefetchProductSummaryRows\(db, rows, includeDetails\)/);
  assert.match(service, /skcsByProductId/);
  assert.match(service, /skuDetailRows:\s*prefetched\.skusByProductId/);
  assert.match(service, /safeProductFilterOptions/);
  assert.match(service, /safeProductOperations/);
  assert.match(service, /warnAuxiliaryQuery/);
  assert.match(service, /skus: includeDetails \?/);
  assert.match(page, /placeholderData:\s*keepPreviousData/);
  assert.match(page, /includeDetails:\s*true/);
});

test("SHEIN platform product detail passes platform context into summary serialization", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.match(service, /serializeProductSummary\(db, product, context/);
  assert.match(service, /product:\s*serializeProductSummary\(db, product, context/);
});

test("SHEIN platform products merge duplicate sale-site rows by site code", async () => {
  const service = await importService();

  const merged = service.saleSitesFromProduct(
    {
      raw_detail_payload_json: {
        info: {
          shelfStatusInfoList: [
            {
              siteAbbr: "shein-ar",
              shelfStatus: 1,
              firstShelfTime: "2026-05-15 13:58:27",
              lastShelfTime: "2026-05-15 13:58:27",
              link: "https://example.invalid/ar-1",
            },
          ],
        },
      },
    },
    [
      {
        raw_payload_json: {
          shelfStatusInfoList: [
            {
              siteAbbr: "shein-ar",
              shelfStatus: 1,
              firstShelfTime: "2026-05-15 13:58:28",
              lastShelfTime: "2026-05-15 13:58:28",
              link: "https://example.invalid/ar-2",
            },
            {
              siteAbbr: "shein-asia",
              shelfStatus: 1,
              firstShelfTime: "2026-05-15 13:58:30",
              lastShelfTime: "2026-05-15 13:58:30",
              link: "https://example.invalid/asia",
            },
          ],
        },
        skc_name: "SKC001",
      },
      {
        raw_payload_json: {
          shelfStatusInfoList: [
            {
              siteAbbr: "shein-ar",
              shelfStatus: 0,
              firstShelfTime: "2026-05-15 13:58:29",
              lastShelfTime: "2026-05-15 13:58:29",
              link: "https://example.invalid/ar-3",
            },
          ],
        },
        skc_name: "SKC002",
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((site) => site.siteAbbr), ["shein-ar", "shein-asia"]);
  assert.equal(merged[0].source, "SPU / SKC001 / SKC002");
  assert.equal(merged[0].link, "https://example.invalid/ar-1");
  assert.equal(merged[0].shelfStatus, 1);
  assert.equal(merged[1].source, "SKC001");
  assert.equal(merged[1].link, "https://example.invalid/asia");
});

test("SHEIN common edit form payload preserves required published identifiers while applying safe fields", async () => {
  const service = await importService();
  const payload = service.buildEditPayloadFromForm(
    {
      spuName: "SPU001",
      supplierCode: "SUP-OLD",
      brandCode: "BRAND-OLD",
      categoryId: "123",
      productTypeId: "456",
      productMultiNameList: [
        { language: "zh-cn", productName: "旧中文标题" },
        { language: "en", productName: "Old English Title" },
      ],
      productMultiDescList: [{ language: "zh-cn", productDesc: "旧描述" }],
      skcInfoList: [
        {
          skcName: "SKC001",
          supplierCode: "SKC-SUP-OLD",
          attributeId: 1000248,
          attributeValueId: 1001484,
          skcImageInfoList: [{ imageGroupCode: "G-SKC", imageUrl: "https://example.invalid/skc.jpg", imageType: 1, imageSort: 1 }],
          skuInfoList: [
            {
              skuCode: "SKU001",
              supplierSku: "SKU-SUP-OLD",
              weight: "120",
              length: "10",
              width: "20",
              height: "3",
              mallState: 1,
              stopPurchase: 1,
              saleAttributeList: [{ attributeId: 1001184, attributeValueId: 19268998 }],
              costInfoList: [{ costPrice: "9.99", currency: "EUR" }],
              priceInfoList: [{ basePrice: "19.99", currency: "EUR" }],
              stockInfoList: [{ inventoryNum: 100 }],
            },
          ],
        },
      ],
    },
    {
      productTitleZh: "新中文标题",
      productTitleEn: "New English Title",
      productDescriptionZh: "新描述",
      brandCode: "BRAND-NEW",
      supplierCode: "SUP-NEW",
      skuUpdates: [
        {
          skuCode: "SKU001",
          supplierSku: "SKU-SUP-NEW",
          weight: "130",
          length: "11",
          width: "21",
          height: "4",
          mallState: "1",
          stopPurchase: "1",
        },
      ],
    },
  );

  assert.equal(payload.spu_name, "SPU001");
  assert.equal(payload.supplier_code, "SUP-NEW");
  assert.equal(payload.brand_code, "BRAND-NEW");
  assert.deepEqual(payload.multi_language_name_list, [
    { language: "zh-cn", name: "新中文标题" },
    { language: "en", name: "New English Title" },
  ]);
  assert.equal(payload.skc_list[0].skc_name, "SKC001");
  assert.equal(payload.skc_list[0].sku_list[0].sku_code, "SKU001");
  assert.equal(payload.skc_list[0].sku_list[0].supplier_sku, "SKU-SUP-NEW");
  assert.equal(payload.skc_list[0].sku_list[0].weight, "130");
  assert.equal(payload.skc_list[0].sku_list[0].length, "11");
  assert.equal(payload.skc_list[0].sku_list[0].width, "21");
  assert.equal(payload.skc_list[0].sku_list[0].height, "4");
  assert.equal(payload.skc_list[0].sku_list[0].cost_info, undefined);
  assert.equal(payload.skc_list[0].sku_list[0].price_info_list, undefined);
  assert.equal(payload.skc_list[0].sku_list[0].stock_info_list, undefined);
});

test("SHEIN variant template starts from synced detail and separates existing identifiers from new variant fields", async () => {
  const service = await importService();
  const template = service.buildVariantTemplateFromDetail({
    spuName: "SPU001",
    supplierCode: "SUP001",
    categoryId: "123",
    productTypeId: "456",
    productMultiNameList: [{ language: "zh-cn", productName: "测试商品" }],
    skcInfoList: [
      {
        skcName: "SKC001",
        supplierCode: "SKC-SUP-OLD",
        attributeId: 1000248,
        attributeValueId: 1001484,
        skuInfoList: [
          {
            skuCode: "SKU001",
            supplierSku: "SKU-SUP-OLD",
            weight: "120",
            length: "10",
            width: "20",
            height: "3",
            mallState: 1,
            stopPurchase: 1,
            saleAttributeList: [{ attributeId: 1001184, attributeValueId: 19268998 }],
          },
        ],
      },
    ],
  });

  assert.equal(template.payload.spu_name, "SPU001");
  assert.equal(template.payload.skc_list[0].skc_name, "SKC001");
  assert.equal(template.payload.skc_list[0].sku_list[0].sku_code, "SKU001");
  assert.equal(template.newVariant.skc.supplier_code, "");
  assert.equal(template.newVariant.sku.supplier_sku, "");
  assert.equal(template.newVariant.sku.cost_info.currency, "CNY");
  assert.match(template.notes.join("\n"), /新增 SKC\/SKU/);
});

test("SHEIN platform product persistence stores list rows and SPU detail variants", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    const service = await importService();
    const context = testContext();

    const listSummary = service.persistProductListResult(db, context, {
      status: 200,
      payload: {
        code: "0",
        info: {
          data: [
            {
              spuName: "SPU001",
              skcName: "SKC001",
              skuCodeList: ["SKU001", "SKU002"],
              supplierCode: "SUP001",
              productName: "Test Product",
            },
          ],
        },
      },
    });

    assert.deepEqual(listSummary, { rowCount: 1, productCount: 1 });
    assert.equal(db.prepare("select count(*) as count from shein_platform_product").get().count, 1);
    assert.equal(db.prepare("select count(*) as count from shein_platform_skc").get().count, 1);
    assert.equal(db.prepare("select count(*) as count from shein_platform_sku").get().count, 2);

    const detailSummary = service.persistProductDetailResult(db, context, {
      status: 200,
      payload: {
        code: "0",
        info: {
          spuName: "SPU001",
          supplierCode: "SUP001",
          brandCode: "BRAND001",
          categoryId: "123",
          productTypeId: "456",
          productMultiNameList: [{ language: "zh-cn", productName: "测试商品" }],
          skcInfoList: [
            {
              skcName: "SKC001",
              supplierCode: "SUP-SKC",
              skcImageInfoList: [{ imageMediumUrl: "https://example.invalid/skc.jpg" }],
              shelfStatusInfoList: [{ shelfStatus: 1, siteAbbr: "DE" }],
              skuInfoList: [
                {
                  skuCode: "SKU001",
                  supplierSku: "SUP-SKU-1",
                  mallState: 1,
                  stopPurchase: 1,
                  weight: "120",
                  length: "10",
                  width: "20",
                  height: "3",
                  costInfoList: [{ costPrice: "10.55", currency: "EUR" }],
                  priceInfoList: [{ site: "DE", basePrice: "19.99", currency: "EUR" }],
                },
              ],
            },
          ],
        },
      },
    });

    assert.deepEqual(detailSummary, { persisted: true, skcCount: 1, skuCount: 1 });

    const product = db.prepare("select * from shein_platform_product where spu_name = ?").get("SPU001");
    assert.equal(product.product_name, "测试商品");
    assert.equal(product.brand_code, "BRAND001");
    assert.equal(product.skc_count, 1);
    assert.equal(product.sku_count, 1);

    const sku = db.prepare(`
      select sku.*
      from shein_platform_sku sku
      join shein_platform_skc skc on skc.id = sku.skc_id
      where skc.skc_name = 'SKC001'
        and sku.sku_code = 'SKU001'
    `).get();
    assert.equal(sku.supplier_sku, "SUP-SKU-1");
    assert.equal(sku.cost_price, 10.55);
    assert.equal(sku.currency, "EUR");

    const saleSite = db.prepare(`
      select *
      from shein_platform_product_sale_site
      where product_id = ?
        and skc_name = 'SKC001'
        and site_abbr = 'DE'
    `).get(product.id);
    assert.equal(saleSite.spu_name, "SPU001");
    assert.equal(saleSite.skc_supplier_code, "SUP-SKC");
    assert.equal(saleSite.shelf_status, 1);
  } finally {
    await cleanup();
  }
});

test("SHEIN platform product list summary includes every SKC with nested SKU rows for display and export", async () => {
  const service = await fileText(SERVICE_FILE);
  const jobService = await fileText(JOB_SERVICE_FILE);
  const page = await fileText(PAGE_FILE);

  assert.match(service, /const skuDetailsBySkc = new Map/);
  assert.match(service, /skuCount:\s*includeDetails/);
  assert.match(service, /skus:\s*includeDetails \?/);
  assert.doesNotMatch(service, /from shein_platform_skc[\s\S]{0,120}limit 8/);

  assert.match(jobService, /platformProductWorkbookRows/);
  assert.match(jobService, /includeDetails:\s*true/);
  assert.match(page, /SKC供方/);
  assert.match(page, /详情同步后显示 SKC/);
  assert.match(page, /<ProductThumb src=\{skc\.imageUrl\} alt=\{skc\.skcName\} size="xs" \/>/);
});

test("SHEIN platform product async detail sync throttles requests and cools down on QPS limits", async () => {
  const jobService = await fileText(JOB_SERVICE_FILE);

  assert.match(jobService, /SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT\s*=\s*800/);
  assert.match(jobService, /SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS\s*=\s*1800\s*\*\s*1000/);
  assert.match(jobService, /DEFAULT_DETAIL_SYNC_INTERVAL_MS\s*=\s*Math\.ceil\(SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS \/ SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT\) \+ 250/);
  assert.match(jobService, /platformProductDetailSyncIntervalMs/);
  assert.match(jobService, /detailIntervalMs/);
  assert.match(jobService, /if \(processedInThisRun > 0 && detailIntervalMs > 0\)/);
  assert.match(jobService, /await wait\(detailIntervalMs\)/);
  assert.match(jobService, /isSheinRateLimitMessage/);
  assert.match(jobService, /QPS限流/);
  assert.match(jobService, /限流ID/);
  assert.match(jobService, /总阈值/);
  assert.match(jobService, /await wait\(rateLimitCooldownMs\)/);
});

test("SHEIN platform product queue prioritizes lightweight work before scheduled full sync", async () => {
  const jobService = await importJobService();
  const priority = jobService.platformProductJobQueuePriority;

  assert.equal(typeof priority, "function");

  const exportPriority = priority({ job_type: "export", payload_json: "{}" });
  const manualDetailPriority = priority({
    job_type: "sync",
    payload_json: JSON.stringify({ spuNames: ["SPU001"] }),
  });
  const listSyncPriority = priority({
    job_type: "sync",
    payload_json: JSON.stringify({ mode: "incremental", syncDetails: true }),
  });
  const scheduledFullPriority = priority({
    job_type: "sync",
    payload_json: JSON.stringify({
      source: "scheduled_platform_product_sync",
      spuNames: ["SPU001"],
    }),
  });

  assert.ok(exportPriority < manualDetailPriority);
  assert.ok(manualDetailPriority < listSyncPriority);
  assert.ok(listSyncPriority < scheduledFullPriority);
});

test("SHEIN platform product detail sync slices yield so later priority work can run", async () => {
  const [jobService, jobServiceText] = await Promise.all([
    importJobService(),
    fileText(JOB_SERVICE_FILE),
  ]);
  const shouldYield = jobService.shouldYieldPlatformProductDetailSyncSlice;

  assert.equal(typeof shouldYield, "function");
  assert.equal(shouldYield({ processedInSlice: 9, queuedCount: 1 }), false);
  assert.equal(shouldYield({ processedInSlice: 10, queuedCount: 1 }), true);
  assert.equal(shouldYield({ processedInSlice: 10, queuedCount: 0 }), false);

  assert.match(jobServiceText, /PLATFORM_PRODUCT_JOB_WORKER_TYPES\s*=\s*\["sync", "export"\]/);
  assert.match(jobServiceText, /processLoop\("sync"\)/);
  assert.match(jobServiceText, /processLoop\("export"\)/);
  assert.match(jobServiceText, /claimNextPlatformProductJob\(type\)/);
  assert.match(jobServiceText, /yieldPlatformProductDetailSyncJob/);
});

test("SHEIN platform product scheduled detail sync is configurable, opt-in, and reuses resumable job items", async () => {
  const [server, service, jobService, scheduleMigration, optInMigration, route] = await Promise.all([
    fileText(SERVER_INDEX),
    fileText(SERVICE_FILE),
    fileText(JOB_SERVICE_FILE),
    fileText(SYNC_SCHEDULE_MIGRATION_FILE),
    fileText(SYNC_SCHEDULE_OPT_IN_MIGRATION_FILE),
    fileText(ROUTE_FILE),
  ]);

  assert.match(server, /startPlatformProductNightlyFullSyncScheduler/);
  assert.match(server, /startPlatformProductNightlyFullSyncScheduler\(\)/);

  assert.match(service, /export function listPlatformProductSpuNames/);
  assert.match(service, /from shein_platform_product/);
  assert.match(service, /last_detail_synced_at/);

  assert.match(scheduleMigration, /create table if not exists shein_platform_product_sync_schedule/);
  assert.match(scheduleMigration, /enabled integer not null default 1/);
  assert.match(scheduleMigration, /schedule_hour integer not null default 23/);
  assert.match(scheduleMigration, /sync_scope text not null default 'full'/);
  assert.match(scheduleMigration, /spu_names_json text not null default '\[\]'/);
  assert.match(scheduleMigration, /last_enqueued_date text/);
  assert.match(scheduleMigration, /last_enqueued_job_id text/);
  assert.match(scheduleMigration, /check\(schedule_hour >= 0 and schedule_hour <= 23\)/);
  assert.match(scheduleMigration, /check\(sync_scope in \('full', 'spu'\)\)/);
  assert.match(scheduleMigration, /values \('default', 1, 23, 'full', '\[\]'\)/);
  assert.match(optInMigration, /alter column enabled set default 0/i);
  assert.match(optInMigration, /set enabled = 0/i);
  assert.match(jobService, /values \(\?, 0, \?, 'full', '\[\]'\)/);
  assert.match(jobService, /enabled:\s*booleanEnv\(row\?\.enabled, false\)/);

  assert.match(route, /get\("\/sync-schedule"/);
  assert.match(route, /put\("\/sync-schedule"/);
  assert.match(route, /getPlatformProductSyncScheduleConfig/);
  assert.match(route, /savePlatformProductSyncScheduleConfig/);

  assert.match(jobService, /DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR\s*=\s*23/);
  assert.match(jobService, /SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE\s*=\s*"scheduled_platform_product_sync"/);
  assert.match(jobService, /function localNightlySyncDateKey/);
  assert.match(jobService, /export function getPlatformProductSyncScheduleConfig/);
  assert.match(jobService, /export function savePlatformProductSyncScheduleConfig/);
  assert.match(jobService, /function activeScheduledPlatformProductSyncJob/);
  assert.match(jobService, /function scheduledPlatformProductSyncJobForDate/);
  assert.match(jobService, /function scheduledPlatformProductSyncCodes/);
  assert.match(jobService, /export function enqueueScheduledPlatformProductSyncJob/);
  assert.match(jobService, /export function enqueueNightlyPlatformProductFullSyncJob/);
  assert.match(jobService, /export function runPlatformProductNightlyFullSyncOnce/);
  assert.match(jobService, /export function startPlatformProductNightlyFullSyncScheduler/);
  assert.match(jobService, /schedule\.enabled/);
  assert.match(jobService, /platformProductSyncScheduleHour\(now\) !== schedule\.schedule_hour/);
  assert.match(jobService, /listPlatformProductSpuNames\(\{[\s\S]*limit: MAX_DETAIL_CODES_PER_JOB/);
  assert.match(jobService, /schedule\.sync_scope === "spu"/);
  assert.match(jobService, /title:\s*schedule\.sync_scope === "spu"[\s\S]*定时按款号同步 SHEIN 平台商品详情[\s\S]*定时全量同步 SHEIN 平台商品详情/);
  assert.match(jobService, /source:\s*SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE/);
  assert.match(jobService, /scheduleDate/);
  assert.match(jobService, /scheduleHour:\s*schedule\.schedule_hour/);
  assert.match(jobService, /syncScope:\s*schedule\.sync_scope/);
  assert.match(jobService, /retryFailedItems:\s*true/);
  assert.match(jobService, /update shein_platform_product_sync_schedule[\s\S]*last_enqueued_date/);
  assert.match(jobService, /active_job:\s*activeJob \? snapshot\(activeJob, db\) : null/);
  assert.match(jobService, /function requeueFailedPlatformProductJobItems/);
  assert.match(jobService, /failedItemRetryPasses/);
  assert.match(jobService, /shouldRetryFailedPlatformProductJobItems/);
  assert.match(jobService, /createPlatformProductJobItems\(job\.id, codes, db\)/);
  assert.match(jobService, /setInterval\(\(\) => \{/);
  assert.match(jobService, /schedulePlatformProductJobs\(\)/);
});

test("SHEIN platform product sync schedule persists custom SPU arrays", async () => {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-shein-sync-schedule-"));
  const db = new DatabaseSync(path.join(tempPath, "test.sqlite"));
  try {
    db.exec(await readFile(JOB_MIGRATION_FILE, "utf8"));
    db.exec(await readFile(SYNC_SCHEDULE_MIGRATION_FILE, "utf8"));
    const jobService = await importJobService();

    const saved = jobService.savePlatformProductSyncScheduleConfig({
      enabled: true,
      schedule_hour: 22,
      sync_scope: "spu",
      spu_names: ["s2409195445", "s2409195445", "c250722589993"],
    }, db);
    const reloaded = jobService.getPlatformProductSyncScheduleConfig(db);

    assert.equal(saved.sync_scope, "spu");
    assert.equal(saved.schedule_hour, 22);
    assert.deepEqual(reloaded.spu_names, ["s2409195445", "c250722589993"]);
  } finally {
    db.close();
    await rm(tempPath, { recursive: true, force: true });
  }
});

test("SHEIN platform product scheduled sync evaluates schedule hours in Asia Shanghai time", async () => {
  const jobService = await importJobService();

  assert.equal(typeof jobService.platformProductSyncScheduleHour, "function");
  assert.equal(jobService.platformProductSyncScheduleHour(new Date("2026-07-07T14:59:59.000Z")), 22);
  assert.equal(jobService.platformProductSyncScheduleHour(new Date("2026-07-07T15:00:00.000Z")), 23);
});

test("SHEIN platform product scheduled sync uses admin actor and normalizes legacy system actor rows", async () => {
  const { db, cleanup } = await createTempScheduledSyncDb();
  try {
    const jobService = await importJobService();

    assert.equal(typeof jobService.scheduledPlatformProductSyncActor, "function");
    assert.deepEqual(jobService.scheduledPlatformProductSyncActor(), { id: 1, username: "admin" });

    const job = jobService.createPlatformProductJob({
      id: "scheduled-legacy-actor",
      type: "sync",
      status: "queued",
      title: "定时全量同步 SHEIN 平台商品详情",
      total_count: 1,
      completed_count: 0,
      failed_count: 0,
      created_at: "2026-07-07T15:00:00.000Z",
      started_at: null,
      finished_at: null,
      items: [],
      payload: { source: "scheduled_platform_product_sync", scheduleDate: "2026-07-07" },
      actor: jobService.scheduledPlatformProductSyncActor(),
      error: null,
    }, db);

    const stored = db.prepare("select * from shein_platform_product_job where id = ?").get(job.id);
    assert.deepEqual(JSON.parse(stored.actor_json), { id: 1, username: "admin" });

    jobService.createPlatformProductJob({
      id: "scheduled-legacy-actor-zero",
      type: "sync",
      status: "queued",
      title: "定时全量同步 SHEIN 平台商品详情",
      total_count: 1,
      completed_count: 0,
      failed_count: 0,
      created_at: "2026-07-07T15:00:00.000Z",
      started_at: null,
      finished_at: null,
      items: [],
      payload: { source: "scheduled_platform_product_sync", scheduleDate: "2026-07-07" },
      actor: { id: 0, username: "system:scheduled-shein-platform-product-sync" },
      error: null,
    }, db);

    const reloaded = jobService.loadPlatformProductJob("sync", "scheduled-legacy-actor-zero", db);
    assert.deepEqual(reloaded.actor, { id: 1, username: "admin" });
  } finally {
    await cleanup();
  }
});

test("SHEIN platform product scheduled sync enqueues at the configured Asia Shanghai hour", async () => {
  const { db, cleanup } = await createTempScheduledSyncDb();
  try {
    const jobService = await importJobService();

    assert.equal(jobService.runPlatformProductNightlyFullSyncOnce({
      now: new Date("2026-07-07T14:00:00.000Z"),
      db,
      scheduleJobs: false,
    }), null);

    const job = jobService.runPlatformProductNightlyFullSyncOnce({
      now: new Date("2026-07-07T15:00:00.000Z"),
      db,
      scheduleJobs: false,
    });
    assert.ok(job);
    const stored = db.prepare("select actor_json, payload_json from shein_platform_product_job where id = ?").get(job.id);
    assert.equal(JSON.parse(stored.payload_json).scheduleDate, "2026-07-07");
    assert.deepEqual(JSON.parse(stored.actor_json), { id: 1, username: "admin" });
  } finally {
    await cleanup();
  }
});

test("SHEIN platform product account key resolver keeps historical platform rows visible", async () => {
  const service = await importService();
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        get(value) {
          calls.push(["get", sql, value]);
          if (sql.includes("where platform = 'SHEIN'") && sql.includes("platform_account_key = ?")) {
            return { count: value === "env:legacy-open-key" ? 3572 : 0 };
          }
          throw new Error(`Unexpected get SQL: ${sql}`);
        },
        all() {
          calls.push(["all", sql]);
          return [];
        },
      };
    },
  };

  const accountKey = service.resolveSheinPlatformAccountKey(db, {
    source: "database",
    platformIntegrationId: 1,
    baseUrl: "https://example.invalid",
    language: "zh-cn",
    openKeyId: "legacy-open-key",
    secretKey: "secret",
  });

  assert.equal(accountKey, "env:legacy-open-key");
  assert.equal(calls.some((call) => call[2] === "integration:1"), true);
  assert.equal(calls.some((call) => call[2] === "env:legacy-open-key"), true);
});
