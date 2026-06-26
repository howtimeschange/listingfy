import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { normalizeListingLaunchPlanRows } from "../../../scripts/lib/listing_launch_plan_importer.mjs"

type JsonRecord = Record<string, unknown>

interface SpreadsheetSheetInput {
  name: string
  rows: JsonRecord[]
}

interface ImportListingLaunchPlanInput {
  fileName?: string | null
  fileSizeBytes?: number | null
  sheets: SpreadsheetSheetInput[]
  sourceBatchIds?: number[]
  createdBy?: number | null
}

interface ListRowsInput {
  q?: string | null
  sheetName?: string | null
  limit?: unknown
  offset?: unknown
}

function nowIso() {
  return new Date().toISOString()
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function importNo() {
  return `LLP-${Date.now()}`
}

function readLimit(value: unknown, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function dateOnly(value: unknown) {
  const text = stringValue(value)
  if (!text) return null
  const normalized = text.replace(/[.]/g, "/")
  const slashMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (slashMatch) {
    return [
      slashMatch[1],
      slashMatch[2].padStart(2, "0"),
      slashMatch[3].padStart(2, "0"),
    ].join("-")
  }
  const parsed = new Date(text)
  if (!Number.isFinite(parsed.getTime())) return null
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-")
}

export function importListingLaunchPlanSheets(db: SyncPostgresDatabase, input: ImportListingLaunchPlanInput) {
  const sheets = Array.isArray(input.sheets) ? input.sheets : []
  const normalizedRows = sheets.flatMap((sheet) =>
    normalizeListingLaunchPlanRows(sheet.rows, { sheetName: sheet.name }),
  )
  const now = nowIso()
  const sourceBatchIds = Array.from(
    new Set((input.sourceBatchIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
  )

  const importId = db.transaction(() => {
    const inserted = db.prepare(`
      insert into listing_launch_plan_import (
        import_no,
        file_name,
        file_size_bytes,
        sheet_count,
        input_row_count,
        normalized_row_count,
        source_batch_ids_json,
        raw_manifest_json,
        created_by,
        created_at
      )
      values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?::timestamptz)
    `).run(
      importNo(),
      stringValue(input.fileName) || null,
      numberValue(input.fileSizeBytes) ?? 0,
      sheets.length,
      sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
      normalizedRows.length,
      jsonText(sourceBatchIds),
      jsonText({
        sheet_names: sheets.map((sheet) => sheet.name),
        source_batch_ids: sourceBatchIds,
      }),
      input.createdBy ?? null,
      now,
    )
    const importId = Number(inserted.lastInsertRowid)
    const insertRow = db.prepare(`
      insert into listing_launch_plan_row (
        import_id,
        sheet_name,
        row_number,
        spu_code,
        skc_code,
        product_season,
        product_line,
        scene,
        attribute,
        age_group,
        size_range,
        gender,
        category_name,
        subcategory_name,
        color_name,
        color_code,
        tag_price,
        calculated_tag_price,
        fabric,
        fab,
        launch_batch,
        launch_date,
        launch_date_text,
        search_launch_date,
        search_launch_date_text,
        content_launch_date,
        content_launch_date_text,
        listing_channel,
        official_category,
        vip_category,
        vip_style_category,
        douyin_category,
        raw_row_json,
        created_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::date, ?, ?::date, ?, ?::date, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
    `)
    for (const row of normalizedRows) {
      insertRow.run(
        importId,
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
        dateOnly(row.launchDateText),
        row.launchDateText || null,
        dateOnly(row.searchLaunchDateText),
        row.searchLaunchDateText || null,
        dateOnly(row.contentLaunchDateText),
        row.contentLaunchDateText || null,
        row.listingChannel,
        row.officialCategory,
        row.vipCategory,
        row.vipStyleCategory,
        row.douyinCategory,
        jsonText(row.rawRowJson),
        now,
      )
    }
    return importId
  })()

  return {
    import: db.prepare("select * from listing_launch_plan_import where id = ?").get(importId),
    inputRowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    insertedRowCount: normalizedRows.length,
    sheetCount: sheets.length,
  }
}

export function listListingLaunchPlanImports(db: SyncPostgresDatabase, input: { limit?: unknown; offset?: unknown } = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const items = db.prepare(`
    select *
    from listing_launch_plan_import
    order by created_at desc, id desc
    limit ? offset ?
  `).all(limit, offset)
  const total = db.prepare("select count(*) as count from listing_launch_plan_import").get() as { count: number }
  return { items, pagination: { total: Number(total.count ?? 0), limit, offset } }
}

export function listListingLaunchPlanRows(db: SyncPostgresDatabase, input: ListRowsInput = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const q = stringValue(input.q)
  const sheetName = stringValue(input.sheetName)
  const where: string[] = []
  const params: unknown[] = []
  if (q) {
    where.push(`(
      row.spu_code ilike ?
      or row.skc_code ilike ?
      or row.official_category ilike ?
      or row.vip_category ilike ?
      or row.douyin_category ilike ?
      or row.category_name ilike ?
      or row.subcategory_name ilike ?
      or row.color_name ilike ?
    )`)
    params.push(...Array.from({ length: 8 }, () => likeQuery(q)))
  }
  if (sheetName && sheetName !== "all") {
    where.push("row.sheet_name = ?")
    params.push(sheetName)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const items = db.prepare(`
    select
      row.*,
      imp.file_name,
      imp.import_no,
      imp.created_at as imported_at
    from listing_launch_plan_row row
    join listing_launch_plan_import imp on imp.id = row.import_id
    ${clause}
    order by imp.created_at desc, row.sheet_name, row.row_number, row.id
    limit ? offset ?
  `).all(...params, limit, offset)
  const total = db.prepare(`
    select count(*) as count
    from listing_launch_plan_row row
    ${clause}
  `).get(...params) as { count: number }
  const sheets = db.prepare(`
    select sheet_name, count(*) as count
    from listing_launch_plan_row
    group by sheet_name
    order by sheet_name
  `).all()
  return {
    items,
    sheets,
    pagination: { total: Number(total.count ?? 0), limit, offset },
  }
}
