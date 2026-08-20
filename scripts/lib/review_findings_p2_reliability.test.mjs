import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../..");
const file = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8");

test("PostgreSQL migration discovery and application share one advisory-locked connection", async () => {
  const source = await file("scripts/lib/postgres_db.mjs");
  const start = source.indexOf("export async function applyPostgresMigrations");
  const implementation = source.slice(start);

  assert.match(implementation, /const client = await pool\.connect\(\)/);
  assert.match(implementation, /pg_advisory_lock/i);
  assert.match(implementation, /select version from schema_migration/);
  assert.match(implementation, /pg_advisory_unlock/i);
  assert.match(implementation, /finally[\s\S]*client\.release\(\)/);
});

test("seed replace validates every manifest snapshot before one cross-group transaction", async () => {
  const source = await file("scripts/seed_import.mjs");

  assert.match(source, /validateSeedSnapshotGroup/);
  assert.match(source, /manifest\.json/);
  assert.match(source, /expectedRows|expected_rows|manifestEntry\.rows/);
  assert.match(source, /await client\.query\("begin"\)/);
  assert.match(source, /await importGroup\(client,[\s\S]*await importGroup\(client,[\s\S]*await client\.query\("commit"\)/);
  assert.doesNotMatch(source, /async function importGroup\(pool/);
});

test("SHEIN metadata sync treats partial output as failed and never advances latest", async () => {
  const [sync, client] = await Promise.all([
    file("scripts/shein_metadata_sync.mjs"),
    file("scripts/lib/shein_client.mjs"),
  ]);

  assert.match(sync, /sheinPost\([\s\S]*args\.language/);
  assert.match(client, /requestShein\([\s\S]*language/);
  assert.match(sync, /if \(manifest\.failures_count === 0\)[\s\S]*latest-manifest\.json/);
  assert.match(sync, /if \(manifest\.failures_count > 0\)[\s\S]*process\.exitCode = 1/);
});

test("SHEIN metadata import is atomic and skip-values preserves historical enums", async () => {
  const source = await file("scripts/shein_metadata_import.mjs");
  const main = source.slice(source.indexOf("async function main"));

  assert.match(main, /db\.exec\("begin"\)/);
  assert.match(main, /await importCategories[\s\S]*await importPublishStandards[\s\S]*await importAttributeTemplates[\s\S]*await importRequiredAttributes[\s\S]*db\.exec\("commit"\)/);
  assert.match(main, /catch \(error\)[\s\S]*db\.exec\("rollback"\)/);
  assert.match(source, /if \(!skipAttributeValues\)\s*\{\s*statements\.deleteAttributeValues\.run/);
});

test("SQLite migration defaults to append and requires an exact target confirmation for replace", async () => {
  const source = await file("scripts/sqlite_to_postgres_data_migrate.mjs");

  assert.match(source, /truncate:\s*false/);
  assert.match(source, /--replace/);
  assert.match(source, /--confirm-target/);
  assert.match(source, /targetDatabaseFingerprint/);
  assert.match(source, /Refusing to replace|拒绝.*覆盖/i);
});
