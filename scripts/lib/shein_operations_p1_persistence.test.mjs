import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const requireFromWeb = createRequire(path.join(PROJECT_ROOT, "web/package.json"));
const Database = requireFromWeb("better-sqlite3");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/022_shein_operations_p1.sql");
const SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/shein-operations.ts");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/shein-operations.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");

async function fileText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-shein-operations-p1-"));
  const db = new Database(path.join(tempPath, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table platform_integration (
      id integer primary key autoincrement
    );
    create table app_user (
      id integer primary key autoincrement
    );
  `);
  db.exec(await readFile(MIGRATION_FILE, "utf8"));
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

test("SHEIN P1 operations migration creates durable regression, identity, barcode, price, and audit tables", async () => {
  const migration = await fileText(MIGRATION_FILE);

  for (const table of [
    "shein_real_data_regression_log",
    "shein_platform_identity_snapshot",
    "shein_supplier_sku_check",
    "shein_barcode_size_snapshot",
    "shein_barcode_print_task",
    "shein_barcode_print_task_item",
    "shein_cost_change_reason",
    "shein_audit_status_snapshot",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }

  assert.match(migration, /scenario text not null/);
  assert.match(migration, /trace_id text/);
  assert.match(migration, /request_payload_json text not null default '\{\}'/);
  assert.match(migration, /response_payload_json text not null default '\{\}'/);
  assert.match(migration, /unique\(platform, platform_account_key, number_type, skc_name, sku_code, design_code, supplier_sku\)/);
  assert.match(migration, /unique\(platform, platform_account_key, barcode\)/);
  assert.match(migration, /source_type text not null/);
  assert.match(migration, /handled_status text not null default 'OPEN'/);
});

test("SHEIN P1 operations migration is executable and stores fallback price reasons", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    for (const table of [
      "shein_real_data_regression_log",
      "shein_platform_identity_snapshot",
      "shein_supplier_sku_check",
      "shein_barcode_size_snapshot",
      "shein_barcode_print_task",
      "shein_barcode_print_task_item",
      "shein_cost_change_reason",
      "shein_audit_status_snapshot",
    ]) {
      const row = db.prepare("select name from sqlite_master where type = 'table' and name = ?").get(table);
      assert.equal(row?.name, table);
    }

    const reasons = db.prepare("select reason_code, reason_text from shein_cost_change_reason order by reason_code").all();
    assert.deepEqual(reasons.map((row) => row.reason_code), ["1", "2", "3", "4", "5"]);
    assert.match(reasons.map((row) => row.reason_text).join(" / "), /商品成本上涨/);
  } finally {
    await cleanup();
  }
});

test("SHEIN operations backend exposes P0 regression, P1-A, P1-B, and audit routes", async () => {
  const [server, route, service] = await Promise.all([
    fileText(SERVER_INDEX),
    fileText(ROUTE_FILE),
    fileText(SERVICE_FILE),
  ]);

  assert.match(server, /import sheinOperations from "\.\/routes\/shein-operations"/);
  assert.match(server, /app\.route\("\/api\/shein-operations", sheinOperations\)/);

  for (const routePattern of [
    /sheinOperations\.post\("\/p0-regression\/logs"/,
    /sheinOperations\.get\("\/p0-regression\/logs"/,
    /sheinOperations\.post\("\/platform-identities\/number-list\/sync"/,
    /sheinOperations\.get\("\/platform-identities\/number-list"/,
    /sheinOperations\.post\("\/platform-identities\/supplier-sku\/check"/,
    /sheinOperations\.get\("\/platform-identities\/supplier-sku\/checks"/,
    /sheinOperations\.post\("\/barcodes\/batch-skc-size"/,
    /sheinOperations\.get\("\/barcodes\/sizes"/,
    /sheinOperations\.post\("\/barcodes\/print"/,
    /sheinOperations\.get\("\/barcodes\/print-tasks"/,
    /sheinOperations\.post\("\/price-reasons\/sync"/,
    /sheinOperations\.get\("\/price-reasons"/,
    /sheinOperations\.get\("\/audit-status"/,
    /sheinOperations\.post\("\/audit-status\/sync"/,
    /sheinOperations\.patch\("\/audit-status\/:id\/handling"/,
  ]) {
    assert.match(route, routePattern);
  }

  for (const serviceSymbol of [
    "createRegressionLog",
    "syncNumberList",
    "checkSupplierSkuRepeated",
    "syncBarcodeSizes",
    "createBarcodePrintTask",
    "syncCostChangeReasons",
    "listAuditStatus",
    "syncAuditStatus",
    "updateAuditHandling",
    "upsertAuditStatusSnapshots",
  ]) {
    assert.match(service, new RegExp(`export .*${serviceSymbol}|export function ${serviceSymbol}|export async function ${serviceSymbol}`));
  }
});
