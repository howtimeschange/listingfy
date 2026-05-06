#!/usr/bin/env node

import path from "node:path";
import { createRequire } from "node:module";
import { getDatabaseConfig } from "./lib/database_config.mjs";
import { loadLocalEnv } from "./lib/local_env.mjs";
import { createPostgresPool, identitySequenceSetvalSql } from "./lib/postgres_db.mjs";

const requireFromWeb = createRequire(new URL("../web/package.json", import.meta.url));
const Database = requireFromWeb("better-sqlite3");

const DEFAULT_SQLITE_PATH = path.resolve("data", "app.sqlite");
const DEFAULT_BATCH_SIZE = 500;

loadLocalEnv();

function parseArgs(argv) {
  const args = {
    databaseUrl: process.env.DATABASE_URL,
    sqlitePath: process.env.SQLITE_SOURCE_PATH || DEFAULT_SQLITE_PATH,
    batchSize: Number(process.env.SQLITE_MIGRATION_BATCH_SIZE || DEFAULT_BATCH_SIZE),
    truncate: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--sqlite") args.sqlitePath = next();
    else if (arg === "--batch-size") args.batchSize = Number(next());
    else if (arg === "--no-truncate") args.truncate = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.sqlitePath = path.resolve(args.sqlitePath);
  if (!Number.isInteger(args.batchSize) || args.batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer.");
  }
  return args;
}

function usage() {
  process.stdout.write(`SQLite to PostgreSQL data migration

Options:
  --database-url <url>  PostgreSQL connection URL. Default: DATABASE_URL.
  --sqlite <path>       SQLite source file. Default: data/app.sqlite.
  --batch-size <n>      Insert batch size. Default: ${DEFAULT_BATCH_SIZE}.
  --no-truncate         Append to PostgreSQL instead of replacing table data.

Examples:
  DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify npm run db:migrate:sqlite-data
  npm run db:migrate:sqlite-data -- --sqlite data/app.sqlite
`);
}

function quoteIdent(identifier) {
  return `"${String(identifier).replaceAll("\"", "\"\"")}"`;
}

function sqliteTables(sqlite) {
  return sqlite.prepare(`
    select name
    from sqlite_master
    where type = 'table'
      and name not like 'sqlite_%'
    order by name
  `).all().map((row) => row.name);
}

function sqliteColumns(sqlite, tableName) {
  return sqlite.prepare(`pragma table_info(${quoteString(tableName)})`).all().map((row) => row.name);
}

function quoteString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function postgresTables(client) {
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `);
  return result.rows.map((row) => row.table_name);
}

async function postgresColumns(client) {
  const result = await client.query(`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `);

  const byTable = new Map();
  for (const row of result.rows) {
    if (!byTable.has(row.table_name)) byTable.set(row.table_name, []);
    byTable.get(row.table_name).push({
      name: row.column_name,
      type: row.data_type,
    });
  }
  return byTable;
}

function diffLists(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function normalizeValue(value, column) {
  if (value === "" && ["bigint", "integer", "numeric", "real"].includes(column.type)) return null;
  return value;
}

async function truncateTables(client, tables) {
  if (tables.length === 0) return;
  const tableList = tables.map((table) => `public.${quoteIdent(table)}`).join(", ");
  await client.query(`truncate table ${tableList} restart identity cascade`);
}

async function insertBatch(client, table, columns, rows) {
  if (rows.length === 0) return 0;
  const columnList = columns.map((column) => quoteIdent(column.name)).join(", ");
  const values = [];
  const placeholders = [];

  for (const row of rows) {
    const rowPlaceholders = [];
    for (const column of columns) {
      values.push(normalizeValue(row[column.name], column));
      rowPlaceholders.push(`$${values.length}`);
    }
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  await client.query(
    `insert into public.${quoteIdent(table)} (${columnList}) values ${placeholders.join(", ")}`,
    values,
  );
  return rows.length;
}

async function syncIdentitySequences(client) {
  const rows = await client.query(`
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and identity_generation is not null
    order by table_name, column_name
  `);

  for (const row of rows.rows) {
    const qualifiedTable = `${quoteIdent(row.table_schema)}.${quoteIdent(row.table_name)}`;
    const columnName = quoteIdent(row.column_name);
    await client.query(
      identitySequenceSetvalSql(qualifiedTable, columnName),
      [`${row.table_schema}.${row.table_name}`, row.column_name],
    );
  }
}

async function postgresRowCounts(client, tables) {
  const counts = new Map();
  for (const table of tables) {
    const result = await client.query(`select count(*)::bigint as count from public.${quoteIdent(table)}`);
    counts.set(table, Number(result.rows[0].count));
  }
  return counts;
}

function sqliteRowCounts(sqlite, tables) {
  const counts = new Map();
  for (const table of tables) {
    counts.set(table, sqlite.prepare(`select count(*) as count from ${quoteIdent(table)}`).get().count);
  }
  return counts;
}

async function migrateData({ databaseUrl, sqlitePath, batchSize, truncate }) {
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const pool = createPostgresPool(databaseUrl, { max: 1 });
  const client = await pool.connect();

  try {
    const sourceTables = sqliteTables(sqlite);
    const targetTables = await postgresTables(client);
    const missingInPostgres = diffLists(sourceTables, targetTables);
    const extraInPostgres = diffLists(targetTables, sourceTables);
    if (missingInPostgres.length > 0 || extraInPostgres.length > 0) {
      throw new Error(`Table mismatch. Missing in PostgreSQL: ${missingInPostgres.join(", ") || "none"}. Extra in PostgreSQL: ${extraInPostgres.join(", ") || "none"}.`);
    }

    const targetColumnsByTable = await postgresColumns(client);
    for (const table of sourceTables) {
      const sourceColumns = sqliteColumns(sqlite, table);
      const targetColumns = (targetColumnsByTable.get(table) ?? []).map((column) => column.name);
      const missingColumns = diffLists(sourceColumns, targetColumns);
      const extraColumns = diffLists(targetColumns, sourceColumns);
      if (missingColumns.length > 0 || extraColumns.length > 0) {
        throw new Error(`Column mismatch on ${table}. Missing in PostgreSQL: ${missingColumns.join(", ") || "none"}. Extra in PostgreSQL: ${extraColumns.join(", ") || "none"}.`);
      }
    }

    const sourceCounts = sqliteRowCounts(sqlite, sourceTables);
    const summary = [];

    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    if (truncate) await truncateTables(client, sourceTables);

    for (const table of sourceTables) {
      const columns = targetColumnsByTable.get(table);
      const iterator = sqlite.prepare(`select * from ${quoteIdent(table)}`).iterate();
      let batch = [];
      let inserted = 0;

      for (const row of iterator) {
        batch.push(row);
        if (batch.length >= batchSize) {
          inserted += await insertBatch(client, table, columns, batch);
          batch = [];
        }
      }

      inserted += await insertBatch(client, table, columns, batch);
      summary.push({
        table,
        source: sourceCounts.get(table),
        inserted,
      });
    }

    await syncIdentitySequences(client);
    await client.query("commit");

    const targetCounts = await postgresRowCounts(client, sourceTables);
    const mismatches = summary
      .map((row) => ({ ...row, target: targetCounts.get(row.table) }))
      .filter((row) => row.source !== row.target);
    if (mismatches.length > 0) {
      throw new Error(`PostgreSQL row count mismatch after import: ${JSON.stringify(mismatches.slice(0, 20))}`);
    }

    return {
      sqlite_path: sqlitePath,
      tables: summary.length,
      rows: summary.reduce((total, row) => total + row.inserted, 0),
      truncate,
      largest_tables: summary
        .slice()
        .sort((a, b) => b.inserted - a.inserted)
        .slice(0, 10),
    };
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // The transaction may already be closed.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
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

const summary = await migrateData({
  databaseUrl: config.url,
  sqlitePath: args.sqlitePath,
  batchSize: args.batchSize,
  truncate: args.truncate,
});

process.stdout.write(`${JSON.stringify({
  provider: config.provider,
  database_url: config.url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@"),
  ...summary,
}, null, 2)}\n`);
