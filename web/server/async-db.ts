import { createRequire } from "node:module"
import { pipeline } from "node:stream/promises"
import { Readable } from "node:stream"
import { getAsyncPool } from "./db"
import {
  fieldRuleSpec,
  listingLaunchPlanRowSpec,
  sourceRowSpec,
  validateBulkInsertSpec,
  type BulkInsertSpec,
} from "./services/product-archive-bulk-write"

const requireFromWeb = createRequire(import.meta.url)
const { from: copyFrom } = requireFromWeb("pg-copy-streams")

type AsyncClient = {
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows?: Array<Record<string, unknown>>, rowCount?: number }> | { rows?: Array<Record<string, unknown>>, rowCount?: number }
  release?: () => void
  queryCopyStream?: (sql: string) => NodeJS.WritableStream
}

type AsyncPool = {
  connect: () => Promise<AsyncClient> | AsyncClient
}

type CopyRowsOptions = {
  stagingTable?: string
}

const REQUIRED_COLUMNS_BY_TABLE: Record<string, readonly string[]> = {
  product_archive_source_row: ["source_batch_id", "source_type", "spu_code", "row_json", "created_at"],
  product_archive_field_rule: ["deepdraw_field", "source_type", "transform_rule_json", "blocking", "updated_at"],
  listing_launch_plan_row: ["import_id", "sheet_name", "row_number", "spu_code", "raw_row_json", "created_at"],
}

const CONFLICT_TARGET_BY_TABLE: Record<string, string | null> = {
  product_archive_source_row: null,
  product_archive_field_rule: null,
  listing_launch_plan_row: "(import_id, sheet_name, row_number)",
}

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error(`unsupported bulk identifier: ${identifier}`)
  return `"${identifier}"`
}

function quoteQualifiedIdentifier(identifier: string) {
  return identifier.split(".").map(quoteIdentifier).join(".")
}

function createStagingTableName(table: string) {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `pg_temp.${table}_stage_${suffix}`
}

function copyValue(value: unknown) {
  if (value == null) return "\\N"
  const serialized = typeof value === "object" ? JSON.stringify(value) : String(value)
  return serialized
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
}

function copyTextForRows<Row>(spec: BulkInsertSpec<Row>, rows: readonly Row[]) {
  return rows.map((row) => {
    const values = spec.values(row)
    if (values.length !== spec.columns.length) {
      throw new Error(`bulk value count ${values.length} does not match column count ${spec.columns.length}`)
    }
    return values.map(copyValue).join("\t")
  }).join("\n") + (rows.length ? "\n" : "")
}

function mergeSql<Row>(spec: BulkInsertSpec<Row>, stagingTable: string) {
  const table = quoteIdentifier(spec.table)
  const columns = spec.columns.map(quoteIdentifier)
  const targetColumns = columns.join(", ")
  const sourceColumns = columns.join(", ")
  const conflictTarget = CONFLICT_TARGET_BY_TABLE[spec.table] ?? null
  const conflictSql = conflictTarget
    ? `\non conflict ${conflictTarget} do update set\n  ${spec.columns
        .filter((column) => !["import_id", "sheet_name", "row_number"].includes(column))
        .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
        .join(",\n  ")}`
    : ""
  return `
    insert into ${table} (${targetColumns})
    select ${sourceColumns}
    from ${quoteQualifiedIdentifier(stagingTable)}
    ${conflictSql}
  `
}

async function queryCount(client: AsyncClient, sql: string) {
  const result = await client.query(sql)
  const row = result.rows?.[0] ?? {}
  return Number(row.count ?? row.invalid_count ?? 0)
}

export async function withAsyncTransaction<Result>(
  poolOrRun: AsyncPool | ((client: AsyncClient) => Promise<Result>),
  maybeRun?: (client: AsyncClient) => Promise<Result>,
): Promise<Result> {
  const pool = typeof poolOrRun === "function" ? getAsyncPool() : poolOrRun
  const run = typeof poolOrRun === "function" ? poolOrRun : maybeRun
  if (typeof run !== "function") throw new Error("async transaction callback is required")

  const client = await pool.connect()
  try {
    await client.query("begin")
    const result = await run(client)
    await client.query("commit")
    return result
  } catch (error) {
    try {
      await client.query("rollback")
    } catch (rollbackError) {
      if (error && typeof error === "object" && !("cause" in error)) {
        ;(error as Error & { cause?: unknown }).cause = rollbackError
      }
    }
    throw error
  } finally {
    client.release?.()
  }
}

export async function copyRowsToStaging<Row>(
  client: AsyncClient,
  spec: BulkInsertSpec<Row>,
  rows: readonly Row[] = [],
  options: CopyRowsOptions = {},
): Promise<{ rowCount: number }> {
  validateBulkInsertSpec(spec)
  const stagingTable = options.stagingTable ?? createStagingTableName(spec.table)
  const stagingTableSql = quoteQualifiedIdentifier(stagingTable)
  const targetTableSql = quoteIdentifier(spec.table)
  const columnSql = spec.columns.map(quoteIdentifier).join(", ")

  await client.query(`create temporary table ${stagingTableSql} (like ${targetTableSql} including defaults) on commit drop`)

  if (rows.length > 0) {
    const copySql = `copy ${stagingTableSql} (${columnSql}) from stdin with (format text, null '\\N')`
    const stream = client.queryCopyStream
      ? client.queryCopyStream(copySql)
      : client.query(copyFrom(copySql)) as unknown as NodeJS.WritableStream
    await pipeline(Readable.from([copyTextForRows(spec, rows)]), stream)
  }

  const stagingCount = await queryCount(client, `select count(*)::integer as count from ${stagingTableSql}`)
  if (stagingCount !== rows.length) {
    throw new Error(`staging row count mismatch for ${spec.table}: expected ${rows.length}, got ${stagingCount}`)
  }

  const requiredColumns = REQUIRED_COLUMNS_BY_TABLE[spec.table] ?? []
  if (requiredColumns.length > 0) {
    const invalidWhere = requiredColumns
      .map((column) => `${quoteIdentifier(column)} is null${["spu_code", "sheet_name", "deepdraw_field", "source_type"].includes(column) ? ` or btrim(${quoteIdentifier(column)}) = ''` : ""}`)
      .map((condition) => `(${condition})`)
      .join(" or ")
    const invalidCount = await queryCount(client, `select count(*)::integer as invalid_count from ${stagingTableSql} where ${invalidWhere}`)
    if (invalidCount > 0) {
      throw new Error(`staging required key validation failed for ${spec.table}: ${invalidCount} invalid rows`)
    }
  }

  const mergeResult = await client.query(mergeSql(spec, stagingTable))
  if (Number(mergeResult.rowCount ?? 0) !== rows.length) {
    throw new Error(`target row count mismatch for ${spec.table}: expected ${rows.length}, got ${Number(mergeResult.rowCount ?? 0)}`)
  }

  return { rowCount: rows.length }
}

export {
  fieldRuleSpec,
  listingLaunchPlanRowSpec,
  sourceRowSpec,
}
