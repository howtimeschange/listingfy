import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/010_shein_product_bucket.sql");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/shein-products.ts");
const PRE_PUBLISH_ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-products/page.tsx");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");
const SIDEBAR_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx");
const HEADER_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-header.tsx");

test("SHEIN product bucket has its own table, API, page, and navigation", async () => {
  const [migration, route, server, page, router, sidebar, header] = await Promise.all([
    readFile(MIGRATION_FILE, "utf8"),
    readFile(ROUTE_FILE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
    readFile(PAGE_FILE, "utf8"),
    readFile(ROUTER_FILE, "utf8"),
    readFile(SIDEBAR_FILE, "utf8"),
    readFile(HEADER_FILE, "utf8"),
  ]);

  assert.match(migration, /create table if not exists shein_product_bucket/);
  assert.match(migration, /unique\(product_spu_id\)/);
  assert.match(migration, /latest_listing_id/);
  assert.match(migration, /readiness_status/);
  assert.match(migration, /insert or ignore into shein_product_bucket/);

  assert.match(server, /import sheinProducts from "\.\/routes\/shein-products"/);
  assert.match(server, /app\.route\("\/api\/shein-products", sheinProducts\)/);

  assert.match(route, /const sheinProducts = new Hono/);
  assert.match(route, /sheinProducts\.get\("\/"/);
  assert.match(route, /sheinProducts\.post\("\/import"/);
  assert.match(route, /sheinProducts\.post\("\/:spuCode\/refresh"/);
  assert.match(route, /shein_product_bucket/);
  assert.match(route, /refreshBucketProduct/);
  assert.match(route, /category_statuses/);
  assert.match(route, /readiness_statuses/);
  assert.match(route, /json_type\(raw_payload_json, '\$\.weight_scope'\) is null/);
  assert.match(route, /weight_scope'\) = 'MISSING'/);

  assert.match(router, /SheinProductsPage/);
  assert.match(router, /shein-products/);
  assert.match(sidebar, /SHEIN 商品分桶/);
  assert.match(header, /SHEIN 商品分桶/);

  assert.match(page, /SHEIN 商品分桶/);
  assert.match(page, /业务字段清洗/);
  assert.match(page, /勾选发布商品/);
  assert.match(page, /字段完整度/);
  assert.match(page, /AI 补齐人工判断字段/);
  assert.match(page, /从商品档案同步款号/);
  assert.match(page, /importBucketMutation/);
  assert.match(page, /\/shein-products\/import/);
  assert.match(page, /batchImportText/);
  assert.match(page, /批量搜索款号/);
  assert.match(page, /categoryStatusFilter/);
  assert.match(page, /readinessStatusFilter/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /\/pre-publish\/ai-fill/);
  assert.match(page, /\/shein-products/);
  assert.doesNotMatch(page, /StatCard/);
});

test("SHEIN product bucket drills into SKC rows and creates drafts from selected SKCs", async () => {
  const [route, prePublishRoute, page] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(PRE_PUBLISH_ROUTE_FILE, "utf8"),
    readFile(PAGE_FILE, "utf8"),
  ]);

  assert.match(route, /skc_details/);
  assert.match(route, /bucketSkcDetails/);
  assert.match(route, /normalized_url/);
  assert.match(prePublishRoute, /skc_codes_by_spu/);
  assert.match(prePublishRoute, /applyDraftSkcSelection/);

  assert.match(page, /selectedSkcCodesBySpu/);
  assert.match(page, /expandedSpus/);
  assert.match(page, /toggleSkcSelection/);
  assert.match(page, /skc_details/);
  assert.match(page, /SKC 款色/);
  assert.match(page, /创建所选款色草稿/);
  assert.match(page, /skc_codes_by_spu/);
});

test("SHEIN product bucket keeps product images square and previewable", async () => {
  const page = await readFile(PAGE_FILE, "utf8");

  assert.match(page, /ImagePreviewState/);
  assert.match(page, /setPreviewImage/);
  assert.match(page, /aspect-square/);
  assert.match(page, /object-contain/);
  assert.match(page, /查看大图/);
  assert.match(page, /previewImage/);
});
