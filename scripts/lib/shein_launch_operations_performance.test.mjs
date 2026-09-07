import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { convertSqliteMigration } from "./postgres_db.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PRE_PUBLISH_FILE = path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts");
const PLATFORM_SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/shein-platform-products.ts");
const PERFORMANCE_MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/057_shein_launch_operations_performance.sql");

async function source(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  return startIndex < 0 ? "" : text.slice(startIndex, endIndex < 0 ? undefined : endIndex);
}

test("SHEIN draft detail batches required-attribute values and reuses them for sale attributes", async () => {
  const route = await source(PRE_PUBLISH_FILE);
  const requiredAttributes = between(route, "function getRequiredAttributes", "function getAttributeById");
  const detail = between(route, "function getListingDetail", "function getListingDetailForAiWarning");

  assert.match(requiredAttributes, /const valuePlaceholders = rows\.map\(\(\) => "\?"\)\.join\(", "\)/);
  assert.match(requiredAttributes, /row_number\(\) over\s*\(\s*partition by attribute_id\s+order by is_show desc, attribute_value\s*\)/i);
  assert.match(requiredAttributes, /attribute_id in \(\$\{valuePlaceholders\}\)/);
  assert.doesNotMatch(requiredAttributes, /valueStmt\.all\(productTypeId, Number\(row\.attribute_id\)\)/);
  assert.match(detail, /onRequiredAttributes:\s*\(attributes\) => \{\s*requiredAttributes = attributes\s*\}/);
  assert.match(detail, /const sale_attributes = requiredAttributes\.filter\(\(attr\) => attr\.attribute_type === 1\)/);
  assert.doesNotMatch(detail, /const sale_attributes = getRequiredAttributes\(/);
});

test("SHEIN detail query state keeps list initial load light while enabling the selected sale-sites dialog", async () => {
  const { detailQueryForView } = await import("../../web/src/lib/shein-platform-product-page-state.ts");
  assert.deepEqual(
    detailQueryForView({ view: "list", selectedSpuName: "", saleSitesDialogSpuName: "" }),
    { enabled: false, spuName: "" },
  );
  assert.deepEqual(
    detailQueryForView({ view: "list", selectedSpuName: "SPU-A", saleSitesDialogSpuName: "SPU-A" }),
    { enabled: true, spuName: "SPU-A" },
  );
  assert.deepEqual(
    detailQueryForView({ view: "detail", selectedSpuName: "SPU-B", saleSitesDialogSpuName: "SPU-A" }),
    { enabled: true, spuName: "SPU-B" },
  );
});

test("SHEIN operation performance migration adds lifecycle ordering and sale-site summary backfill", async () => {
  const migration = await source(PERFORMANCE_MIGRATION_FILE);

  assert.match(migration, /create table if not exists shein_platform_sale_site_summary/);
  assert.match(migration, /primary key \(platform, platform_account_key, site_abbr\)/);
  assert.match(migration, /active_product_count integer not null default 0/);
  assert.match(migration, /insert into shein_platform_sale_site_summary[\s\S]*count\(distinct product_id\)/);
  assert.match(migration, /where shelf_status = 1/);
  assert.match(migration, /on conflict \(platform, platform_account_key, site_abbr\) do update set/);
  assert.match(migration, /create index if not exists idx_shein_lifecycle_operation_recent/);
  assert.match(migration, /on shein_lifecycle_operation\(platform, platform_account_key, created_at desc, id desc\)/);
  const postgresMigration = convertSqliteMigration(migration);
  assert.doesNotMatch(postgresMigration, /strftime/i);
  assert.match(postgresMigration, /count\(distinct product_id\)/);
});

test("SHEIN operation performance migration backfills distinct active products per site", async () => {
  const migration = await source(PERFORMANCE_MIGRATION_FILE);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      create table shein_platform_product_sale_site (
        platform text not null,
        platform_account_key text not null,
        product_id integer not null,
        site_abbr text not null,
        site_name text,
        shelf_status integer
      );
      create table shein_lifecycle_operation (
        id integer primary key,
        platform text not null,
        platform_account_key text not null,
        created_at text not null
      );
      insert into shein_platform_product_sale_site values
        ('SHEIN', 'integration:1', 101, 'DE', '德国站', 1),
        ('SHEIN', 'integration:1', 101, 'DE', '德国站', 1),
        ('SHEIN', 'integration:1', 102, 'DE', '德国站', 1),
        ('SHEIN', 'integration:1', 103, 'DE', '德国站', 0),
        ('SHEIN', 'integration:1', 104, 'FR', '法国站', 1);
    `);
    db.exec(migration);
    assert.deepEqual(
      db.prepare(`
        select site_abbr, site_name, active_product_count
        from shein_platform_sale_site_summary
        order by site_abbr
      `).all().map((row) => ({ ...row })),
      [
        { site_abbr: "DE", site_name: "德国站", active_product_count: 2 },
        { site_abbr: "FR", site_name: "法国站", active_product_count: 1 },
      ],
    );
  } finally {
    db.close();
  }
});

test("SHEIN sale-site filters read the maintained summary and detail persistence updates it synchronously", async () => {
  const service = await source(PLATFORM_SERVICE_FILE);
  const saleSiteOptions = between(service, "function saleSiteFilterOptions", "function safeProductFilterOptions");

  assert.match(service, /function saleSiteSummaryCountRows[\s\S]*from shein_platform_sale_site_summary/);
  assert.doesNotMatch(saleSiteOptions, /count\(distinct product_id\) as count/);
  assert.match(service, /for update/);
  assert.match(service, /export function reconcileProductSaleSiteSummary/);
});
