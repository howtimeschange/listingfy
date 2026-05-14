#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { getDatabaseConfig } from "./lib/database_config.mjs";
import { loadLocalEnv } from "./lib/local_env.mjs";
import { createPostgresPool } from "./lib/postgres_db.mjs";
import { BUSINESS_TABLES, METADATA_TABLES } from "./lib/seed_snapshot_config.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_METADATA_DIR = path.join(PROJECT_ROOT, "db", "seeds", "listingify-baseline");
const DEFAULT_BUSINESS_DIR = path.join(DEFAULT_METADATA_DIR, "business");

loadLocalEnv({ cwd: PROJECT_ROOT });

function parseArgs(argv) {
  const args = {
    databaseUrl: process.env.DATABASE_URL,
    metadataDir: DEFAULT_METADATA_DIR,
    businessDir: DEFAULT_BUSINESS_DIR,
    metadataOnly: false,
    businessOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--metadata-dir") args.metadataDir = path.resolve(next());
    else if (arg === "--business-dir") args.businessDir = path.resolve(next());
    else if (arg === "--metadata-only") args.metadataOnly = true;
    else if (arg === "--business-only") args.businessOnly = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.metadataOnly && args.businessOnly) {
    throw new Error("--metadata-only and --business-only cannot be used together.");
  }
  return args;
}

function usage() {
  process.stdout.write(`Listingify seed snapshot export

Options:
  --database-url <url>       PostgreSQL URL. Default: DATABASE_URL.
  --metadata-dir <dir>       Project metadata seed directory. Default: db/seeds/listingify-baseline
  --business-dir <dir>       Business seed directory. Default: db/seeds/listingify-baseline/business
  --metadata-only            Export only SHEIN metadata.
  --business-only            Export only business rule data.

Examples:
  npm run seed:export
  npm run seed:export -- --business-only --business-dir /secure/listingify-business-seed
`);
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function selectedColumns(table) {
  return table.columns.map((column) => quoteIdentifier(column)).join(", ");
}

function tableQuery(table) {
  const where = table.where ? ` where ${table.where}` : "";
  const orderBy = table.orderBy ? ` order by ${table.orderBy}` : "";
  return `select ${selectedColumns(table)} from ${quoteIdentifier(table.name)}${where}${orderBy}`;
}

async function exportTable(pool, table, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${table.name}.jsonl.gz`);
  const client = await pool.connect();
  let count = 0;
  const batchSize = 5000;
  const gzip = createGzip();
  const output = createWriteStream(filePath);
  gzip.pipe(output);
  try {
    for (let offset = 0;; offset += batchSize) {
      const rows = await client.query(`${tableQuery(table)} limit $1 offset $2`, [batchSize, offset]);
      if (rows.rows.length === 0) break;
      for (const row of rows.rows) {
        if (!gzip.write(`${JSON.stringify(row)}\n`)) {
          await once(gzip, "drain");
        }
      }
      count += rows.rows.length;
      if (rows.rows.length < batchSize) break;
    }
    gzip.end();
    await once(output, "finish");
    return { table: table.name, rows: count, file: path.relative(PROJECT_ROOT, filePath) };
  } finally {
    client.release();
  }
}

async function exportGroup(pool, { name, tables, dir }) {
  await mkdir(dir, { recursive: true });
  const exported = [];
  for (const table of tables) {
    exported.push(await exportTable(pool, table, dir));
  }
  const manifest = {
    kind: name,
    exported_at: new Date().toISOString(),
    format: "jsonl.gz",
    tables: exported,
  };
  await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const config = getDatabaseConfig({
  ...process.env,
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: args.databaseUrl,
});

const pool = createPostgresPool(config.url);
try {
  const result = {};
  if (!args.businessOnly) {
    result.metadata = await exportGroup(pool, {
      name: "metadata",
      tables: METADATA_TABLES,
      dir: args.metadataDir,
    });
  }
  if (!args.metadataOnly) {
    result.business = await exportGroup(pool, {
      name: "business",
      tables: BUSINESS_TABLES,
      dir: args.businessDir,
    });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await pool.end();
}
