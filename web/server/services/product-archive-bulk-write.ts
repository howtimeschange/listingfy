import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

type BulkDatabase = Pick<SyncPostgresDatabase, "prepare">

export type BulkWriteProgress = {
  batchCount: number
  insertedRowCount: number
  totalRowCount: number
}

export type BulkWriteResult = {
  insertedRowCount: number
  batchCount: number
  durationMs: number
}

export type BulkInsertSpec<Row> = {
  readonly table: string
  readonly columns: readonly string[]
  readonly valueCasts?: readonly ("jsonb" | "timestamptz" | "date" | null)[]
  readonly values: (row: Row) => readonly unknown[]
}

type ProductArchiveSourceBulkRow = {
  sourceBatchId: unknown
  sourceType: unknown
  spuCode: unknown
  skcCode: unknown
  rowJson: unknown
  createdAt: unknown
}

type ProductArchiveFieldRuleBulkRow = {
  sourceBatchId: unknown
  deepdrawField: unknown
  sourceType: unknown
  sourceTable: unknown
  sourceField: unknown
  defaultValue: unknown
  transformRule: unknown
  blocking: unknown
  notes: unknown
  updatedAt: unknown
}

type ListingLaunchPlanBulkRow = {
  importId: unknown
  sheetName: unknown
  rowNumber: unknown
  spuCode: unknown
  skcCode: unknown
  productSeason: unknown
  productLine: unknown
  scene: unknown
  attribute: unknown
  ageGroup: unknown
  sizeRange: unknown
  gender: unknown
  categoryName: unknown
  subcategoryName: unknown
  colorName: unknown
  colorCode: unknown
  tagPrice: unknown
  calculatedTagPrice: unknown
  fabric: unknown
  fab: unknown
  launchBatch: unknown
  launchDate: unknown
  launchDateText: unknown
  searchLaunchDate: unknown
  searchLaunchDateText: unknown
  contentLaunchDate: unknown
  contentLaunchDateText: unknown
  listingChannel: unknown
  officialCategory: unknown
  vipCategory: unknown
  vipStyleCategory: unknown
  douyinCategory: unknown
  rawRowJson: unknown
  createdAt: unknown
}

const PRODUCT_ARCHIVE_SOURCE_ROW_COLUMNS = [
  "source_batch_id",
  "source_type",
  "spu_code",
  "skc_code",
  "row_json",
  "created_at",
] as const

const PRODUCT_ARCHIVE_FIELD_RULE_COLUMNS = [
  "source_batch_id",
  "deepdraw_field",
  "source_type",
  "source_table",
  "source_field",
  "default_value",
  "transform_rule_json",
  "blocking",
  "notes",
  "updated_at",
] as const

const LISTING_LAUNCH_PLAN_ROW_COLUMNS = [
  "import_id",
  "sheet_name",
  "row_number",
  "spu_code",
  "skc_code",
  "product_season",
  "product_line",
  "scene",
  "attribute",
  "age_group",
  "size_range",
  "gender",
  "category_name",
  "subcategory_name",
  "color_name",
  "color_code",
  "tag_price",
  "calculated_tag_price",
  "fabric",
  "fab",
  "launch_batch",
  "launch_date",
  "launch_date_text",
  "search_launch_date",
  "search_launch_date_text",
  "content_launch_date",
  "content_launch_date_text",
  "listing_channel",
  "official_category",
  "vip_category",
  "vip_style_category",
  "douyin_category",
  "raw_row_json",
  "created_at",
] as const

const ALLOWED_COLUMNS_BY_TABLE: Record<string, readonly string[]> = {
  product_archive_source_row: PRODUCT_ARCHIVE_SOURCE_ROW_COLUMNS,
  product_archive_field_rule: PRODUCT_ARCHIVE_FIELD_RULE_COLUMNS,
  listing_launch_plan_row: LISTING_LAUNCH_PLAN_ROW_COLUMNS,
}

export const sourceRowSpec: BulkInsertSpec<ProductArchiveSourceBulkRow> = {
  table: "product_archive_source_row",
  columns: PRODUCT_ARCHIVE_SOURCE_ROW_COLUMNS,
  valueCasts: [null, null, null, null, "jsonb", "timestamptz"],
  values: (row) => [
    row.sourceBatchId,
    row.sourceType,
    row.spuCode,
    row.skcCode,
    row.rowJson ?? {},
    row.createdAt,
  ],
}

export const fieldRuleSpec: BulkInsertSpec<ProductArchiveFieldRuleBulkRow> = {
  table: "product_archive_field_rule",
  columns: PRODUCT_ARCHIVE_FIELD_RULE_COLUMNS,
  valueCasts: [null, null, null, null, null, null, "jsonb", null, null, "timestamptz"],
  values: (row) => [
    row.sourceBatchId,
    row.deepdrawField,
    row.sourceType,
    row.sourceTable,
    row.sourceField,
    row.defaultValue,
    row.transformRule ?? {},
    row.blocking,
    row.notes,
    row.updatedAt,
  ],
}

export const listingLaunchPlanRowSpec: BulkInsertSpec<ListingLaunchPlanBulkRow> = {
  table: "listing_launch_plan_row",
  columns: LISTING_LAUNCH_PLAN_ROW_COLUMNS,
  valueCasts: [
    null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, "date", null,
    "date", null, "date", null, null, null, null, null, null, "jsonb", "timestamptz",
  ],
  values: (row) => [
    row.importId,
    row.sheetName,
    row.rowNumber,
    row.spuCode,
    row.skcCode,
    row.productSeason,
    row.productLine,
    row.scene,
    row.attribute,
    row.ageGroup,
    row.sizeRange,
    row.gender,
    row.categoryName,
    row.subcategoryName,
    row.colorName,
    row.colorCode,
    row.tagPrice,
    row.calculatedTagPrice,
    row.fabric,
    row.fab,
    row.launchBatch,
    row.launchDate,
    row.launchDateText,
    row.searchLaunchDate,
    row.searchLaunchDateText,
    row.contentLaunchDate,
    row.contentLaunchDateText,
    row.listingChannel,
    row.officialCategory,
    row.vipCategory,
    row.vipStyleCategory,
    row.douyinCategory,
    row.rawRowJson ?? {},
    row.createdAt,
  ],
}

function validateSpec<Row>(spec: BulkInsertSpec<Row>) {
  const allowedColumns = spec && Object.prototype.hasOwnProperty.call(ALLOWED_COLUMNS_BY_TABLE, spec.table)
    ? ALLOWED_COLUMNS_BY_TABLE[spec.table]
    : null
  if (!allowedColumns) throw new Error(`unsupported bulk table: ${String(spec?.table)}`)
  if (!Array.isArray(spec?.columns) || spec.columns.length === 0) {
    throw new Error("unsupported bulk columns: empty column list")
  }
  const seen = new Set<string>()
  for (const column of spec.columns) {
    if (!allowedColumns.includes(column)) throw new Error(`unsupported bulk column: ${String(column)}`)
    if (seen.has(column)) throw new Error(`duplicate bulk column: ${column}`)
    seen.add(column)
  }
  if (spec.valueCasts && spec.valueCasts.length !== spec.columns.length) {
    throw new Error("bulk column and cast counts do not match")
  }
  for (const cast of spec.valueCasts ?? []) {
    if (cast !== null && !["jsonb", "timestamptz", "date"].includes(cast)) {
      throw new Error(`unsupported bulk cast: ${String(cast)}`)
    }
  }
  if (typeof spec.values !== "function") throw new Error("bulk row value mapper is required")
}

function normalizeBatchSize(value: unknown) {
  const batchSize = Number(value ?? 500)
  if (!Number.isFinite(batchSize) || batchSize < 1) throw new Error("bulk batch size must be a positive integer")
  return Math.floor(batchSize)
}

function buildValueExpression(cast: "jsonb" | "timestamptz" | "date" | null | undefined) {
  return cast ? `?::${cast}` : "?"
}

function buildInsertSql<Row>(spec: BulkInsertSpec<Row>, rowCount: number) {
  const groups = Array.from({ length: rowCount }, () => (
    `(${spec.columns.map((_, index) => buildValueExpression(spec.valueCasts?.[index])).join(", ")})`
  )).join(",\n")
  return `insert into ${spec.table} (${spec.columns.join(", ")}) values\n${groups}\nreturning id`
}

export function insertRowsInBatches<Row>(
  db: BulkDatabase,
  spec: BulkInsertSpec<Row>,
  rows: readonly Row[] = [],
  options: {
    batchSize?: number
    onProgress?: (progress: BulkWriteProgress) => void
  } = {},
): BulkWriteResult {
  validateSpec(spec)
  const batchSize = normalizeBatchSize(options.batchSize)
  const startedAt = performance.now()
  let batchCount = 0
  let insertedRowCount = 0

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const params: unknown[] = []
    for (const row of batch) {
      const values = spec.values(row)
      if (values.length !== spec.columns.length) {
        throw new Error(`bulk value count ${values.length} does not match column count ${spec.columns.length}`)
      }
      params.push(...values)
    }
    db.prepare(buildInsertSql(spec, batch.length)).run(...params)
    batchCount += 1
    insertedRowCount += batch.length
    options.onProgress?.({
      batchCount,
      insertedRowCount,
      totalRowCount: rows.length,
    })
  }

  return {
    insertedRowCount,
    batchCount,
    durationMs: Math.max(0, performance.now() - startedAt),
  }
}
