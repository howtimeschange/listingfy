#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local_env.mjs";
import {
  DEFAULT_DB_PATH,
  applyMigrations,
  openDatabase,
} from "./lib/sqlite_db.mjs";
import { importDeepdrawPayloads } from "./lib/deepdraw_content_importer.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv({ cwd: PROJECT_ROOT });
const LATEST_MANIFEST_PATH = path.join(PROJECT_ROOT, "data", "deepdraw-content", "latest-manifest.json");

function parseArgs(argv) {
  const args = {
    dbPath: process.env.APP_DB_PATH || DEFAULT_DB_PATH,
    sourceDir: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--db") args.dbPath = next();
    else if (arg === "--source") args.sourceDir = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.dbPath = path.resolve(args.dbPath);
  return args;
}

function usage() {
  process.stdout.write(`Import DeepDraw content packages into local database

Options:
  --source <dir>   DeepDraw sync output directory. Default: latest manifest output.
  --db <path>      SQLite database path. Default: ${DEFAULT_DB_PATH}

Examples:
  npm run deepdraw:import
  npm run deepdraw:import -- --source data/deepdraw-content/20260429T054418Z
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveSourceDir(sourceDir) {
  if (sourceDir) return path.resolve(sourceDir);
  if (!fs.existsSync(LATEST_MANIFEST_PATH)) {
    throw new Error(`Missing latest DeepDraw manifest: ${LATEST_MANIFEST_PATH}`);
  }
  const latest = readJson(LATEST_MANIFEST_PATH);
  if (latest.files?.manifest) {
    return path.dirname(path.resolve(PROJECT_ROOT, latest.files.manifest));
  }
  throw new Error("latest-manifest.json does not contain files.manifest");
}

function readPayloads(sourceDir, manifest) {
  const productsDir = path.resolve(PROJECT_ROOT, manifest.products_dir || path.join(sourceDir, "products"));
  const codes = manifest.requested_codes?.length
    ? manifest.requested_codes
    : fs.readdirSync(productsDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.basename(file, ".json"));
  return codes
    .map((productCode) => {
      const filePath = path.join(productsDir, `${productCode}.json`);
      if (!fs.existsSync(filePath)) return null;
      return {
        productCode,
        payload: readJson(filePath),
      };
    })
    .filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const sourceDir = resolveSourceDir(args.sourceDir);
const manifestPath = path.join(sourceDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing DeepDraw manifest: ${manifestPath}`);
}

const manifest = readJson(manifestPath);
const payloads = readPayloads(sourceDir, manifest);
if (!payloads.length) {
  throw new Error(`No DeepDraw product payloads found under: ${sourceDir}`);
}

const db = openDatabase(args.dbPath);
try {
  const applied = applyMigrations(db);
  const summary = importDeepdrawPayloads(db, {
    payloads,
    sourceDir: path.relative(PROJECT_ROOT, sourceDir),
    manifest,
  });
  process.stdout.write(`${JSON.stringify({
    db_path: args.dbPath,
    source_dir: sourceDir,
    applied_migrations: applied,
    ...summary,
  }, null, 2)}\n`);
} finally {
  db.close();
}
