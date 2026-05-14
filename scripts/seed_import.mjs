#!/usr/bin/env node

import fs from "node:fs";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
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
    metadataSource: DEFAULT_METADATA_DIR,
    businessSource: DEFAULT_BUSINESS_DIR,
    metadataOnly: false,
    businessOnly: false,
    replace: false,
    requireBusiness: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--metadata-source") args.metadataSource = path.resolve(next());
    else if (arg === "--business-source") args.businessSource = path.resolve(next());
    else if (arg === "--metadata-only") args.metadataOnly = true;
    else if (arg === "--business-only") args.businessOnly = true;
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--require-business") args.requireBusiness = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.metadataOnly && args.businessOnly) {
    throw new Error("--metadata-only and --business-only cannot be used together.");
  }
  return args;
}

function usage() {
  process.stdout.write(`Listingify seed snapshot import

Options:
  --database-url <url>          PostgreSQL URL. Default: DATABASE_URL.
  --metadata-source <dir>       Project metadata seed directory. Default: db/seeds/listingify-baseline
  --business-source <dir>       Business seed directory. Default: db/seeds/listingify-baseline/business
  --metadata-only               Import only SHEIN metadata.
  --business-only               Import only business rule data.
  --replace                     Delete target snapshot rows before import.
  --require-business            Fail if the business seed directory is missing.

Examples:
  npm run db:migrate
  npm run seed:import
  npm run seed:import -- --business-source /secure/listingify-business-seed --replace
`);
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function fileForTable(sourceDir, table) {
  return path.join(sourceDir, `${table.name}.jsonl.gz`);
}

async function* gunzipRows(filePath) {
  const input = createReadStream(filePath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

function insertSql(table, batchLength) {
  const columns = table.columns.map(quoteIdentifier);
  const placeholders = [];
  const valuesPerRow = columns.length;
  for (let rowIndex = 0; rowIndex < batchLength; rowIndex += 1) {
    const rowPlaceholders = [];
    for (let columnIndex = 0; columnIndex < valuesPerRow; columnIndex += 1) {
      rowPlaceholders.push(`$${rowIndex * valuesPerRow + columnIndex + 1}`);
    }
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  }
  const conflict = table.conflictColumns.map(quoteIdentifier).join(", ");
  const updateColumns = table.columns.filter((column) => !table.conflictColumns.includes(column));
  const updateSql = updateColumns.length
    ? `do update set ${updateColumns.map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(", ")}`
    : "do nothing";
  return `
    insert into ${quoteIdentifier(table.name)} (${columns.join(", ")})
    values ${placeholders.join(", ")}
    on conflict (${conflict}) ${updateSql}
  `;
}

async function loadTableSnapshot(client, table, sourceDir) {
  const filePath = fileForTable(sourceDir, table);
  if (!fs.existsSync(filePath)) {
    return { table: table.name, rows: 0, skipped: true };
  }

  const batch = [];
  let count = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    const values = [];
    for (const row of batch) {
      for (const column of table.columns) values.push(row[column] ?? null);
    }
    await client.query(insertSql(table, batch.length), values);
    count += batch.length;
    batch.length = 0;
  };

  for await (const row of gunzipRows(filePath)) {
    batch.push(row);
    if (batch.length >= 500) await flush();
  }
  await flush();
  return { table: table.name, rows: count, skipped: false };
}

async function replaceTableRows(client, table) {
  const where = table.where ? ` where ${table.where}` : "";
  await client.query(`delete from ${quoteIdentifier(table.name)}${where}`);
}

async function setIdentitySequence(client, table) {
  if (!table.identityColumn) return;
  await client.query(`
    select setval(
      pg_get_serial_sequence($1, $2),
      greatest(coalesce((select max(${quoteIdentifier(table.identityColumn)}) from ${quoteIdentifier(table.name)}), 0), 1),
      true
    )
  `, [table.name, table.identityColumn]);
}

async function importGroup(pool, { name, tables, sourceDir, replace, required }) {
  if (!fs.existsSync(sourceDir)) {
    if (required) throw new Error(`Missing ${name} seed directory: ${sourceDir}`);
    return { kind: name, source_dir: sourceDir, skipped: true, tables: [] };
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    if (replace) {
      for (const table of [...tables].reverse()) {
        await replaceTableRows(client, table);
      }
    }
    const imported = [];
    for (const table of tables) {
      imported.push(await loadTableSnapshot(client, table, sourceDir));
    }
    for (const table of tables) {
      await setIdentitySequence(client, table);
    }
    await client.query("commit");
    return { kind: name, source_dir: sourceDir, skipped: false, tables: imported };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
    result.metadata = await importGroup(pool, {
      name: "metadata",
      tables: METADATA_TABLES,
      sourceDir: args.metadataSource,
      replace: args.replace,
      required: true,
    });
  }
  if (!args.metadataOnly) {
    result.business = await importGroup(pool, {
      name: "business",
      tables: BUSINESS_TABLES,
      sourceDir: args.businessSource,
      replace: args.replace,
      required: args.requireBusiness,
    });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await pool.end();
}
