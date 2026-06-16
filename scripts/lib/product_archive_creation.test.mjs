import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/024_deepdraw_product_archive_creation.sql"),
  sqliteDb: path.join(PROJECT_ROOT, "scripts/lib/sqlite_db.mjs"),
  metadataService: path.join(PROJECT_ROOT, "web/server/services/deepdraw-metadata.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  metadataRoute: path.join(PROJECT_ROOT, "web/server/routes/deepdraw-metadata.ts"),
  deepdrawClient: path.join(PROJECT_ROOT, "scripts/lib/deepdraw_client.mjs"),
};

test("new deepdraw archive schema is a PostgreSQL-only schema revision, not a SQLite compatibility layer", async () => {
  const [migration, sqliteDb] = await Promise.all([
    readFile(files.migration, "utf8"),
    readFile(files.sqliteDb, "utf8"),
  ]);

  assert.match(migration, /postgres-only/);
  assert.match(migration, /bigserial primary key/i);
  assert.match(migration, /timestamptz not null default now\(\)/i);
  assert.match(migration, /jsonb not null default '\{\}'::jsonb/i);
  assert.match(migration, /jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /on conflict \(permission_key\) do nothing/i);
  assert.match(sqliteDb, /postgres-only/);
  assert.doesNotMatch(migration, /autoincrement|strftime|insert or ignore/i);
});

test("deepdraw metadata service uses SyncPostgresDatabase and reuses the shared DeepDraw client", async () => {
  const [service, client] = await Promise.all([
    readFile(files.metadataService, "utf8"),
    readFile(files.deepdrawClient, "utf8"),
  ]);

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /from ".{0,20}\.\.\/\.\.\/\.\.\/scripts\/lib\/deepdraw_client\.mjs"/);
  assert.match(service, /requestDeepdrawPost/);
  assert.match(client, /buildDeepdrawGetRequest/);
  assert.match(client, /buildDeepdrawPostRequest/);
  assert.match(client, /REST_PATH = "\/rest"/);
  assert.match(service, /MERCHANT_TRADES_TYPE|dp\.merchant\.trades/);
  assert.match(service, /TRADE_FIELDS_TYPE|dp\.trade\.fields/);
  assert.match(service, /flattenTrades/);
  assert.match(service, /attributes\.isRequired/);
  assert.match(service, /insert into deepdraw_trade_cache/i);
  assert.match(service, /insert into deepdraw_trade_field_cache/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id\) do update/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id, field_id\) do update/i);
  assert.match(service, /raw_payload_json/);
});

test("product archive draft service is PG-first and covers build validate patch duplicate dry-run submit contracts", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /export function listProductArchiveDrafts/);
  assert.match(service, /export function importProductArchiveSourceRows/);
  assert.match(service, /export function createProductArchiveDraftFromSpu/);
  assert.match(service, /export function getProductArchiveDraftDetail/);
  assert.match(service, /export function patchProductArchiveDraftFields/);
  assert.match(service, /export function validateProductArchiveDraft/);
  assert.match(service, /export async function checkDuplicateProductArchiveDraft/);
  assert.match(service, /export async function submitProductArchiveDraft/);
  assert.match(service, /export async function readbackProductArchiveDraft/);
  assert.match(service, /db\.transaction/);
  assert.match(service, /product_spu/);
  assert.match(service, /product_skc/);
  assert.match(service, /product_sku/);
  assert.match(service, /product_archive_draft/);
  assert.match(service, /product_archive_draft_field/);
  assert.match(service, /product_archive_draft_sku/);
  assert.match(service, /product_archive_validation_issue/);
  assert.match(service, /product_archive_submit_log/);
  assert.match(service, /parseProductArchiveFieldRuleRows/);
  assert.match(service, /normalizeProductArchiveSourceRows/);
  assert.match(service, /dryRun/);
  assert.match(service, /duplicate_found/);
  assert.match(service, /readback_mismatch/);
  assert.match(service, /sanitizeDeepdrawLogPayload/);
  assert.doesNotMatch(service, /openDatabase|applyMigrations|better-sqlite3|node:sqlite/);
});

test("product archive draft service resolves merchant identity from DeepDraw credentials and keeps it out of create payload overrides", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /resolveDeepdrawConfig/);
  assert.match(service, /const deepdrawConfig = resolveDeepdrawConfig/);
  assert.match(service, /merchantId = String\(deepdrawConfig\.merchantId\)/);
  assert.doesNotMatch(service, /const merchantId = input\.merchantId \|\| process\.env\.DEEPDRAW_MERCHANT_ID \|\| ""/);
  assert.doesNotMatch(service, /merchantId:\s*stringValue\(draft\.merchant_id\)/);
});

test("product archive draft service blocks ready status when required template and duplicate checks fail", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /deepdraw_template_missing/);
  assert.match(service, /duplicate_product_found/);
  assert.match(service, /sku_color_not_in_template/);
  assert.match(service, /sku_size_not_in_template/);
});

test("routes delegate to PG services and enforce the deepdraw archive permission boundary", async () => {
  const [draftRoute, metadataRoute] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.metadataRoute, "utf8"),
  ]);

  assert.match(draftRoute, /from "\.\.\/services\/product-archive-drafts"/);
  assert.match(metadataRoute, /from "\.\.\/services\/deepdraw-metadata"/);
  for (const permission of [
    "PRODUCT_ARCHIVE_DRAFT_READ",
    "PRODUCT_ARCHIVE_DRAFT_WRITE",
    "PRODUCT_ARCHIVE_DRAFT_SUBMIT",
    "DEEPDRAW_METADATA_MANAGE",
    "PRODUCT_ARCHIVE_RULE_MANAGE",
  ]) {
    assert.match(`${draftRoute}\n${metadataRoute}`, new RegExp(permission));
  }
  assert.match(draftRoute, /assertSafeProductArchiveCode/);
  assert.match(draftRoute, /productArchiveDrafts\.post\("\/source-imports"/);
  assert.match(draftRoute, /submitProductArchiveDraft/);
  assert.match(metadataRoute, /syncDeepdrawTrades/);
  assert.match(metadataRoute, /syncDeepdrawTradeFields/);
});
