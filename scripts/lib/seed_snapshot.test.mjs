import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PACKAGE_FILE = path.join(PROJECT_ROOT, "package.json");
const EXPORT_SCRIPT = path.join(PROJECT_ROOT, "scripts/seed_export.mjs");
const IMPORT_SCRIPT = path.join(PROJECT_ROOT, "scripts/seed_import.mjs");
const CONFIG_FILE = path.join(PROJECT_ROOT, "scripts/lib/seed_snapshot_config.mjs");

test("seed snapshot scripts bundle metadata and business data in the project seed", async () => {
  const [pkg, exportScript, importScript, config] = await Promise.all([
    readFile(PACKAGE_FILE, "utf8"),
    readFile(EXPORT_SCRIPT, "utf8").catch(() => ""),
    readFile(IMPORT_SCRIPT, "utf8").catch(() => ""),
    readFile(CONFIG_FILE, "utf8").catch(() => ""),
  ]);

  assert.match(pkg, /"seed:export": "NODE_OPTIONS=--no-warnings=ExperimentalWarning node scripts\/seed_export\.mjs"/);
  assert.match(pkg, /"seed:import": "NODE_OPTIONS=--no-warnings=ExperimentalWarning node scripts\/seed_import\.mjs"/);

  assert.match(exportScript, /DEFAULT_METADATA_DIR = path\.join\(PROJECT_ROOT, "db", "seeds", "listingify-baseline"\)/);
  assert.match(exportScript, /DEFAULT_BUSINESS_DIR = path\.join\(DEFAULT_METADATA_DIR, "business"\)/);
  assert.match(exportScript, /METADATA_TABLES/);
  assert.match(exportScript, /BUSINESS_TABLES/);
  assert.match(exportScript, /createGzip/);
  assert.match(config, /channel_attribute_value/);
  assert.match(config, /product_weight_import/);

  assert.match(importScript, /--metadata-source/);
  assert.match(importScript, /DEFAULT_BUSINESS_DIR = path\.join\(DEFAULT_METADATA_DIR, "business"\)/);
  assert.match(importScript, /--business-source/);
  assert.match(importScript, /--replace/);
  assert.match(importScript, /gunzipRows/);
  assert.match(importScript, /loadTableSnapshot/);
  assert.match(importScript, /setIdentitySequence/);
});
