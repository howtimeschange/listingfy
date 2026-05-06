import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
const { Pool, types } = requireFromWeb("pg");
const deasync = requireFromWeb("deasync");

const NOW_SQL = "to_char((clock_timestamp() at time zone 'UTC'), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";
const POSTGRES_WORKER_URL = new URL("./postgres_worker.mjs", import.meta.url);

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(700, (value) => Number(value));
types.setTypeParser(701, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      current += char;
      if (sql.startsWith(dollarTag, index)) {
        current += sql.slice(index + 1, index + dollarTag.length);
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

function replaceFunctionCall(sql, functionName, replacementName, suffix = "") {
  let result = "";
  let index = 0;
  const pattern = new RegExp(`\\b${functionName}\\s*\\(`, "ig");

  while (index < sql.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(sql);
    if (!match) {
      result += sql.slice(index);
      break;
    }

    const callStart = match.index;
    let cursor = pattern.lastIndex;
    let depth = 1;
    let quote = null;
    while (cursor < sql.length && depth > 0) {
      const char = sql[cursor];
      if (quote) {
        if (char === quote && sql[cursor - 1] !== "\\") quote = null;
        cursor += 1;
        continue;
      }
      if (char === "'" || char === "\"") {
        quote = char;
        cursor += 1;
        continue;
      }
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      cursor += 1;
    }

    if (depth !== 0) {
      result += sql.slice(index);
      break;
    }

    const args = sql.slice(pattern.lastIndex, cursor - 1);
    result += sql.slice(index, callStart);
    result += `${replacementName}(${args})${suffix}`;
    index = cursor;
  }

  return result;
}

function replaceJsonExtract(sql) {
  const jsonExtractPattern = /json_extract\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*,\s*'\$\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'\s*\)/gi;
  const jsonTextExpression = (column, pathExpression) => {
    const path = String(pathExpression).split(".").join(",");
    return `(${column}::jsonb #>> '{${path}}')`;
  };

  let converted = sql.replace(
    new RegExp(`coalesce\\(\\s*${jsonExtractPattern.source}\\s*,\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\)`, "gi"),
    (_match, column, pathExpression, fallback) => `coalesce(${jsonTextExpression(column, pathExpression)}, '${fallback}')`,
  );

  converted = converted.replace(
    new RegExp(`${jsonExtractPattern.source}\\s*=\\s*\\?`, "gi"),
    (_match, column, pathExpression) => `${jsonTextExpression(column, pathExpression)} = ?::text`,
  );

  return converted.replace(
    jsonExtractPattern,
    (_match, column, pathExpression) => {
      return jsonTextExpression(column, pathExpression);
    },
  );
}

function replaceJsonType(sql) {
  return sql.replace(
    /json_type\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*,\s*'\$\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)'\s*\)/gi,
    (_match, column, pathExpression) => {
      const path = String(pathExpression).split(".").join(",");
      return `jsonb_typeof(${column}::jsonb #> '{${path}}')`;
    },
  );
}

function convertProductSkcSummaryGroupBy(statement) {
  if (!/\bv_product_skc_summary\b/i.test(statement)) return statement;

  const baseColumns = [
    "spu.id",
    "spu.spu_code",
    "spu.spu_name",
    "spu.brand_name",
    "spu.year",
    "spu.season_name",
    "skc.id",
    "skc.skc_code",
    "skc.skc_name",
    "skc.color_code",
    "skc.color_name",
    "skc.status_name",
    "skc.enable_status",
    "skc.updated_at",
  ];

  if (/\bspu\.listing_title_cn\b/i.test(statement)) {
    baseColumns.splice(3, 0, "spu.listing_title_cn", "spu.listing_title_en");
  }

  return statement.replace(/\bgroup\s+by\s+skc\.id\b/i, `group by\n  ${baseColumns.join(",\n  ")}`);
}

export function convertSqliteStatement(statement) {
  const original = statement;
  let converted = statement
    .replace(/\binteger\s+primary\s+key\s+autoincrement\b/gi, "bigint generated by default as identity primary key")
    .replace(/\binteger\s+primary\s+key\s+check\s*\(/gi, "bigint primary key check (")
    .replace(/\binteger(\s+not\s+null)?(\s+references\b)/gi, "bigint$1$2")
    .replace(/\binsert\s+or\s+ignore\s+into\b/gi, "insert into")
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ', 'now'\)/gi, NOW_SQL)
    .replace(/\bgroup_concat\s*\(\s*distinct\s+([^)]+?)\s*\)/gi, "string_agg(distinct $1::text, ',')")
    .replace(/\bgroup_concat\s*\(\s*([^)]+?)\s*\)/gi, "string_agg($1::text, ',')")
    .replace(/\bjson_group_array\s*\(\s*distinct\s+([^)]+?)\s*\)/gi, "jsonb_agg(distinct $1)::text")
    .replace(/\bjson_group_array\s*\(\s*([^)]+?)\s*\)/gi, "jsonb_agg($1)::text")
    .replace(/\bjoin\s+rbac_permission\s+permission\s+where\b/gi, "cross join rbac_permission permission where")
    .replace(/\bpragma\s+table_info\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/gi, "select column_name as name from information_schema.columns where table_schema = 'public' and table_name = '$1'")
    .replace(/\bbegin\s+immediate\b/gi, "begin")
    .replace(/\bcreate\s+view\s+if\s+not\s+exists\b/gi, "create or replace view");

  converted = replaceFunctionCall(converted, "json_object", "json_build_object", "::text");
  converted = replaceJsonType(converted);
  converted = replaceJsonExtract(converted);
  converted = appendDoNothingForInsertOrIgnore(original, converted);
  converted = convertProductSkcSummaryGroupBy(converted);
  return converted;
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

export function toPostgresQuery(sql) {
  let parameterIndex = 0;
  const text = convertSqliteStatement(sql).replace(/\?/g, () => `$${++parameterIndex}`);
  return text;
}

export function syncAwait(promise) {
  return syncWithTimeout(
    (callback) => promise.then((result) => callback(null, result), (error) => callback(error)),
    "PostgreSQL synchronous operation",
  );
}

function syncWithTimeout(register, label) {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.DATABASE_SYNC_TIMEOUT_MS ?? process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 3000);
  const wait = deasync((callback) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(error, result);
    };
    const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => {
          finish(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    try {
      register(finish);
    } catch (error) {
      finish(error);
    }
  });
  const result = wait();
  if (Number.isFinite(timeoutMs) && timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }
  return result;
}

function querySync(executor, sql, params = []) {
  return syncWithTimeout(
    (callback) => executor.query(sql, params, callback),
    "PostgreSQL synchronous query",
  );
}

function connectSync(pool) {
  return syncWithTimeout(
    (callback) => pool.connect(callback),
    "PostgreSQL synchronous connect",
  );
}

function endPoolSync(pool) {
  return syncWithTimeout(
    (callback) => pool.end(callback),
    "PostgreSQL synchronous close",
  );
}

class PostgresStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = toPostgresQuery(sql);
  }

  all(...params) {
    return this.db.queryRows(this.sql, normalizeParams(params));
  }

  get(...params) {
    return this.all(...params)[0];
  }

  run(...params) {
    const result = this.db.queryResult(this.sqlForRun(), normalizeParams(params));
    const row = result.rows?.[0] ?? {};
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: row.id ?? row.lastInsertRowid ?? null,
    };
  }

  sqlForRun() {
    if (/\breturning\b/i.test(this.sql)) return this.sql;
    const match = this.sql.match(/^\s*insert\s+into\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (!match) return this.sql;
    return this.db.tableHasColumn(match[1], "id") ? `${this.sql} returning id` : this.sql;
  }
}

let workerCounter = 0;

class SyncPostgresWorker {
  constructor(databaseUrl, options = {}) {
    this.databaseUrl = databaseUrl;
    this.options = options;
    this.sharedBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    this.state = new Int32Array(this.sharedBuffer);
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), `listingify-pg-${process.pid}-${++workerCounter}-`));
    this.requestPath = path.join(this.dir, "request.json");
    this.responsePath = path.join(this.dir, "response.json");
    this.worker = new Worker(POSTGRES_WORKER_URL, {
      workerData: {
        sharedBuffer: this.sharedBuffer,
        requestPath: this.requestPath,
        responsePath: this.responsePath,
        databaseUrl,
        connectionTimeoutMillis: options.connectionTimeoutMillis ?? process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 3000,
      },
    });
  }

  request(payload) {
    const timeoutMs = Number(process.env.DATABASE_SYNC_TIMEOUT_MS ?? process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 3000);
    fs.writeFileSync(this.requestPath, JSON.stringify(payload));
    try {
      fs.rmSync(this.responsePath, { force: true });
    } catch {
      // Ignore cleanup races on repeated requests.
    }
    Atomics.store(this.state, 0, 1);
    Atomics.notify(this.state, 0);
    const waitResult = Atomics.wait(this.state, 0, 1, timeoutMs);
    if (waitResult === "timed-out") {
      throw new Error(`PostgreSQL synchronous query timed out after ${timeoutMs}ms`);
    }

    const response = JSON.parse(fs.readFileSync(this.responsePath, "utf8"));
    Atomics.store(this.state, 0, 0);
    if (!response.ok) {
      const error = new Error(response.error?.message ?? "PostgreSQL worker query failed");
      if (response.error?.stack) error.stack = response.error.stack;
      if (response.error?.code) error.code = response.error.code;
      throw error;
    }
    return response.result ?? null;
  }

  query(sql, params = []) {
    return this.request({ action: "query", sql, params });
  }

  close() {
    try {
      this.request({ action: "close" });
    } finally {
      Atomics.store(this.state, 0, 3);
      Atomics.notify(this.state, 0);
      this.worker.terminate();
      fs.rmSync(this.dir, { recursive: true, force: true });
    }
  }
}

export class SyncPostgresDatabase {
  constructor(databaseUrl, options = {}) {
    this.worker = new SyncPostgresWorker(databaseUrl, options);
  }

  prepare(sql) {
    return new PostgresStatement(this, sql);
  }

  queryRows(sql, params = []) {
    return this.queryResult(sql, params).rows;
  }

  queryResult(sql, params = []) {
    return this.worker.query(sql, params);
  }

  tableHasColumn(tableName, columnName) {
    this.columnCache ??= new Map();
    const cacheKey = `${tableName}.${columnName}`;
    if (this.columnCache.has(cacheKey)) return this.columnCache.get(cacheKey);
    const result = this.queryResult(`
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = $2
      limit 1
    `, [tableName, columnName]);
    const hasColumn = result.rows.length > 0;
    this.columnCache.set(cacheKey, hasColumn);
    return hasColumn;
  }

  exec(sql) {
    const statements = splitSqlStatements(convertSqliteMigration(sql));
    for (const statement of statements) {
      this.queryResult(statement);
    }
  }

  transaction(fn) {
    return (...args) => {
      try {
        this.queryResult("begin");
        const result = fn(...args);
        this.queryResult("commit");
        return result;
      } catch (error) {
        this.queryResult("rollback");
        throw error;
      }
    };
  }

  syncIdentitySequences() {
    const rows = this.queryRows(`
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and identity_generation is not null
      order by table_name, column_name
    `);

    for (const row of rows) {
      const qualifiedTable = `"${row.table_schema}"."${row.table_name}"`;
      const columnName = `"${row.column_name}"`;
      this.queryResult(`
        select setval(
          pg_get_serial_sequence($1, $2)::regclass,
          greatest(coalesce((select max(${columnName}) from ${qualifiedTable}), 0), 1),
          false
        )
      `, [`${row.table_schema}.${row.table_name}`, row.column_name]);
    }
  }

  close() {
    this.worker.close();
  }
}

function conflictTargetForInsert(statement) {
  const match = statement.match(/insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (!match) return null;
  const table = match[1];
  const targets = {
    app_user_role: "(user_id, role_id)",
    channel_account: "(platform, account_name)",
    rbac_permission: "(permission_key)",
    rbac_role: "(role_key)",
    rbac_role_permission: "(role_id, permission_id)",
    shein_product_bucket: "(product_spu_id)",
  };
  return targets[table] ?? null;
}

function appendDoNothingForInsertOrIgnore(original, converted) {
  if (!/\binsert\s+or\s+ignore\s+into\b/i.test(original)) return converted;
  if (/\bon\s+conflict\b/i.test(converted)) return converted;
  const target = conflictTargetForInsert(converted);
  return `${converted}\non conflict${target ? ` ${target}` : ""} do nothing`;
}

export function convertSqliteMigration(sql) {
  return splitSqlStatements(sql)
    .map((statement) => appendDoNothingForInsertOrIgnore(statement, convertSqliteStatement(statement)))
    .join(";\n\n");
}

export function createPostgresPool(databaseUrl, options = {}) {
  return new Pool({
    connectionString: databaseUrl,
    max: Number(options.max ?? process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(options.idleTimeoutMillis ?? process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(options.connectionTimeoutMillis ?? process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 3000),
  });
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
    const qualifiedTable = `"${row.table_schema}"."${row.table_name}"`;
    const columnName = `"${row.column_name}"`;
    await client.query(`
      select setval(
        pg_get_serial_sequence($1, $2)::regclass,
        greatest(coalesce((select max(${columnName}) from ${qualifiedTable}), 0), 1),
        false
      )
    `, [`${row.table_schema}.${row.table_name}`, row.column_name]);
  }
}

export async function applyPostgresMigrations(pool, migrationsDir = path.resolve("db", "migrations")) {
  await pool.query(`
    create table if not exists schema_migration (
      version text primary key,
      applied_at text not null default (${NOW_SQL})
    )
  `);

  const appliedRows = await pool.query("select version from schema_migration");
  const applied = new Set(appliedRows.rows.map((row) => row.version));
  const migrations = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const appliedNow = [];
  for (const file of migrations) {
    if (applied.has(file)) continue;

    const sourceSql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const sql = convertSqliteMigration(sourceSql);
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const statement of splitSqlStatements(sql)) {
        await client.query(statement);
      }
      await syncIdentitySequences(client);
      await client.query("insert into schema_migration(version) values ($1)", [file]);
      await client.query("commit");
      appliedNow.push(file);
    } catch (error) {
      await client.query("rollback");
      error.message = `Failed to apply ${file}: ${error.message}`;
      throw error;
    } finally {
      client.release();
    }
  }

  return appliedNow;
}
