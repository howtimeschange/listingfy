import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SIZE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/size-conversion/page.tsx");
const LOW_RATE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/low-rate-list/page.tsx");
const PACKAGE_PAGE = path.join(PROJECT_ROOT, "web/src/pages/package-rules/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/business-rules.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/007_business_rules_and_publish_readiness.sql");

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
  const [route, server] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/business-rules", businessRules\)/);
  assert.match(route, /\/size-conversions\/import/);
  assert.match(route, /\/size-conversions\/export/);
  assert.match(route, /\/size-conversions\/:id/);
  assert.match(route, /\/discount-rules\/import/);
  assert.match(route, /\/discount-rules\/export/);
  assert.match(route, /\/discount-rules\/:id/);
  assert.match(route, /batch_search/);
  assert.match(route, /product-weights/);
});

test("size conversion page supports spreadsheet import export batch search and CRUD", async () => {
  const page = await readFile(SIZE_PAGE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /尺码转换规则/);
  assert.match(page, /导入表格/);
  assert.match(page, /导出/);
  assert.match(page, /批量搜索/);
  assert.match(page, /编辑/);
  assert.match(page, /删除/);
  assert.match(page, /size-conversions\/import/);
});

test("low rate list page supports spreadsheet import export batch search and CRUD", async () => {
  const page = await readFile(LOW_RATE_PAGE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /低倍率清单/);
  assert.match(page, /供货折扣/);
  assert.match(page, /导入表格/);
  assert.match(page, /导出/);
  assert.match(page, /批量搜索/);
  assert.match(page, /编辑/);
  assert.match(page, /删除/);
  assert.match(page, /discount-rules\/import/);
});

test("package rules page keeps product weight report available as an empty import-backed list", async () => {
  const page = await readFile(PACKAGE_PAGE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /包装规则/);
  assert.match(page, /产品毛重报表/);
  assert.match(page, /暂无毛重数据/);
  assert.match(page, /product-weights/);
});
