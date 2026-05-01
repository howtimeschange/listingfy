import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SIZE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/size-conversion/page.tsx");
const PRICE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/price-rules/page.tsx");
const PACKAGE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/package-rules/page.tsx");
const PAGINATION_COMPONENT = path.join(PROJECT_ROOT, "web/src/components/server-pagination.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/business-rules.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/007_business_rules_and_publish_readiness.sql");
const SKU_WEIGHT_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/011_sku_weight_and_publish_tasks.sql");

test("business rule migration creates import, size, discount, weight, and field fill tables", async () => {
  const migration = await readFile(MIGRATION_FILE, "utf8");

  for (const table of [
    "business_import_batch",
    "size_conversion_rule",
    "supply_discount_rule",
    "product_weight_import",
    "listing_field_fill",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }
});

test("business rules API exposes import export search and CRUD endpoints", async () => {
  const [route, server, skuWeightMigration] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
    readFile(SKU_WEIGHT_MIGRATION_FILE, "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/business-rules", businessRules\)/);
  assert.match(route, /\/size-conversions\/import/);
  assert.match(route, /\/size-conversions\/export/);
  assert.match(route, /\/size-conversions\/:id/);
  assert.match(route, /offset/);
  assert.match(route, /pagination/);
  assert.match(route, /select count\(\*\) as count/);
  assert.match(route, /\/discount-rules\/import/);
  assert.match(route, /\/discount-rules\/export/);
  assert.match(route, /\/discount-rules\/:id/);
  assert.match(route, /\/price-config/);
  assert.match(route, /batch_search/);
  assert.match(route, /product-weights/);
  assert.match(route, /\/product-weights\/import/);
  assert.match(route, /\/product-weights\/export/);
  assert.match(route, /\/product-weights\/:id/);
  assert.match(route, /sku重量/);
  assert.match(route, /款号/);
  assert.match(route, /sku_code/);
  assert.match(route, /validBySku/);
  assert.match(route, /coalesce\(sku_code, ''\) <> ''/);
  assert.match(skuWeightMigration, /unique index if not exists ux_product_weight_import_active_sku/);
  assert.doesNotMatch(route, /avgWeight/);
  assert.doesNotMatch(route, /按款号汇总/);
  assert.doesNotMatch(route, /legacy_spu/);
});

test("size conversion page supports spreadsheet import export batch search and CRUD", async () => {
  const [page, pagination] = await Promise.all([
    readFile(SIZE_PAGE, "utf8"),
    readFile(PAGINATION_COMPONENT, "utf8"),
  ]);

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /SHEIN 尺码转换/);
  assert.match(page, /SHEIN 适配规则/);
  assert.match(page, /导入表格/);
  assert.match(page, /导出/);
  assert.match(page, /批量搜索/);
  assert.match(page, /编辑/);
  assert.match(page, /删除/);
  assert.match(page, /size-conversions\/import/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /pagination/);
  assert.match(page, /offset=/);
  assert.match(pagination, /每页数量/);
});

test("price rules page subsumes low-rate list import export batch search and CRUD", async () => {
  const page = await readFile(PRICE_PAGE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /SHEIN 价格规则/);
  assert.match(page, /默认配置/);
  assert.match(page, /SHEIN 供货折扣规则/);
  assert.match(page, /价格试算/);
  assert.match(page, /低倍率款号/);
  assert.match(page, /供货折扣/);
  assert.match(page, /导入价格规则/);
  assert.match(page, /导出/);
  assert.match(page, /批量搜索/);
  assert.match(page, /编辑/);
  assert.match(page, /删除/);
  assert.match(page, /discount-rules\/import/);
  assert.match(page, /discount-rules\/summary/);
  assert.match(page, /discount-rules\/preview/);
  assert.match(page, /business-rules\/price-config/);
  assert.match(page, /default_discount/);
  assert.match(page, /usd_exchange_rate/);
  assert.match(page, /保存默认配置/);
  assert.doesNotMatch(page, /基础参数/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /pagination/);
  assert.match(page, /offset=/);
});

test("package rules page keeps product weight report available as an empty import-backed list", async () => {
  const page = await readFile(PACKAGE_PAGE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /包装规则/);
  assert.match(page, /产品毛重报表/);
  assert.match(page, /SKU 维度/);
  assert.match(page, /SKU 毛重记录/);
  assert.match(page, /当前页/);
  assert.match(page, /导入库存毛重表/);
  assert.match(page, /导出/);
  assert.match(page, /批量搜索/);
  assert.match(page, /编辑/);
  assert.match(page, /删除/);
  assert.match(page, /product-weights/);
  assert.match(page, /product-weights\/import/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /pagination/);
  assert.match(page, /offset=/);
  assert.match(page, /款号（可选）/);
  assert.match(page, /必填，导入源表第 3 列/);
  assert.doesNotMatch(page, /avgWeight/);
  assert.doesNotMatch(page, /平均毛重/);
});
