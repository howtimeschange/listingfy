import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  normalizeListingLaunchPlanRows,
  normalizeListingLaunchPlanRowsInChunks,
} from "../../../scripts/lib/listing_launch_plan_importer.mjs"
import {
  insertRowsInBatches,
  listingLaunchPlanRowSpec,
} from "./product-archive-bulk-write"

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
  afterSpuCode?: string | null
  afterRowId?: unknown
  includeTotal?: unknown
}

interface ImportListingLaunchPlanChunkOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (progress: {
    importId: number
    insertedRowCount: number
    totalRowCount: number
  }) => void | Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error("上市计划导入已取消")
  error.name = "AbortError"
  throw error
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

function readPositiveInteger(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const integer = Math.floor(number)
  return integer > 0 ? integer : null
}

function readBoolean(value: unknown, fallback = true) {
  if (value == null || value === "") return fallback
  if (typeof value === "boolean") return value
  const text = String(value).trim().toLowerCase()
  if (["0", "false", "no"].includes(text)) return false
  if (["1", "true", "yes"].includes(text)) return true
  return fallback
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

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function prepareListingLaunchPlanImport(input: ImportListingLaunchPlanInput) {
  const sheets = Array.isArray(input.sheets) ? input.sheets : []
  const normalizedRows = sheets.flatMap((sheet) =>
    normalizeListingLaunchPlanRows(sheet.rows, { sheetName: sheet.name }),
  )
  const now = nowIso()
  const sourceBatchIds = Array.from(
    new Set((input.sourceBatchIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
  )
  return {
    sheets,
    normalizedRows,
    now,
    sourceBatchIds,
    inputRowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
  }
}

async function prepareListingLaunchPlanImportInChunks(
  input: ImportListingLaunchPlanInput,
  options: Pick<ImportListingLaunchPlanChunkOptions, "chunkSize" | "signal"> = {},
) {
  const sheets = Array.isArray(input.sheets) ? input.sheets : []
  const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? 1000)))
  const normalizedRows: JsonRecord[] = []
  for (const sheet of sheets) {
    throwIfAborted(options.signal)
    normalizedRows.push(...await normalizeListingLaunchPlanRowsInChunks(sheet.rows, {
      sheetName: sheet.name,
      chunkSize,
      signal: options.signal,
    }))
    throwIfAborted(options.signal)
    await wait()
  }
  const now = nowIso()
  const sourceBatchIds = Array.from(
    new Set((input.sourceBatchIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
  )
  return {
    sheets,
    normalizedRows,
    now,
    sourceBatchIds,
    inputRowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
  }
}

function insertListingLaunchPlanImportRecord(
  db: SyncPostgresDatabase,
  input: ImportListingLaunchPlanInput,
  prepared: ReturnType<typeof prepareListingLaunchPlanImport>,
) {
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
    prepared.sheets.length,
    prepared.inputRowCount,
    prepared.normalizedRows.length,
    jsonText(prepared.sourceBatchIds),
    jsonText({
      sheet_names: prepared.sheets.map((sheet) => sheet.name),
      source_batch_ids: prepared.sourceBatchIds,
    }),
    input.createdBy ?? null,
    prepared.now,
  )
  return Number(inserted.lastInsertRowid)
}

function listingLaunchPlanDbRow(importId: number, row: JsonRecord, now: string) {
  return {
    importId,
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    spuCode: row.spuCode,
    skcCode: row.skcCode,
    productSeason: row.productSeason,
    productLine: row.productLine,
    scene: row.scene,
    attribute: row.attribute,
    ageGroup: row.ageGroup,
    sizeRange: row.sizeRange,
    gender: row.gender,
    categoryName: row.categoryName,
    subcategoryName: row.subcategoryName,
    colorName: row.colorName,
    colorCode: row.colorCode,
    tagPrice: row.tagPrice,
    calculatedTagPrice: row.calculatedTagPrice,
    fabric: row.fabric,
    fab: row.fab,
    launchBatch: row.launchBatch,
    launchDate: dateOnly(row.launchDateText),
    launchDateText: row.launchDateText || null,
    searchLaunchDate: dateOnly(row.searchLaunchDateText),
    searchLaunchDateText: row.searchLaunchDateText || null,
    contentLaunchDate: dateOnly(row.contentLaunchDateText),
    contentLaunchDateText: row.contentLaunchDateText || null,
    listingChannel: row.listingChannel,
    officialCategory: row.officialCategory,
    vipCategory: row.vipCategory,
    vipStyleCategory: row.vipStyleCategory,
    douyinCategory: row.douyinCategory,
    rawRowJson: jsonText(row.rawRowJson),
    createdAt: now,
  }
}

function importResult(db: SyncPostgresDatabase, importId: number, prepared: ReturnType<typeof prepareListingLaunchPlanImport>) {
  return {
    import: db.prepare("select * from listing_launch_plan_import where id = ?").get(importId),
    inputRowCount: prepared.inputRowCount,
    insertedRowCount: prepared.normalizedRows.length,
    sheetCount: prepared.sheets.length,
  }
}

function refreshListingLaunchPlanSummaries(db: SyncPostgresDatabase, importId: number) {
  listingLaunchPlanCountCache.clear()

  db.prepare(`
    insert into listing_launch_plan_import_sheet_stat (
      import_id,
      sheet_name,
      row_count,
      spu_count,
      updated_at
    )
    select
      import_id,
      sheet_name,
      count(*)::integer as row_count,
      count(distinct spu_code)::integer as spu_count,
      now()
    from listing_launch_plan_row
    where import_id = ?
    group by import_id, sheet_name
    on conflict (import_id, sheet_name) do update set
      row_count = excluded.row_count,
      spu_count = excluded.spu_count,
      updated_at = excluded.updated_at
  `).run(importId)

  db.prepare(`
    insert into listing_launch_plan_spu_latest (
      spu_code,
      import_id,
      row_id,
      sheet_name,
      row_count,
      updated_at
    )
    select
      spu_code,
      import_id,
      id as row_id,
      sheet_name,
      row_count,
      now()
    from (
      select
        row.*,
        count(*) over (partition by row.spu_code)::integer as row_count,
        row_number() over (partition by row.spu_code order by row.id desc) as latest_rank
      from listing_launch_plan_row row
      where row.import_id = ?
    ) ranked
    where latest_rank = 1
    on conflict (spu_code) do update set
      import_id = excluded.import_id,
      row_id = excluded.row_id,
      sheet_name = excluded.sheet_name,
      row_count = excluded.row_count,
      updated_at = excluded.updated_at
    where listing_launch_plan_spu_latest.import_id < excluded.import_id
  `).run(importId)
}

export function importListingLaunchPlanSheets(db: SyncPostgresDatabase, input: ImportListingLaunchPlanInput) {
  const prepared = prepareListingLaunchPlanImport(input)
  const importId = db.transaction(() => {
    const id = insertListingLaunchPlanImportRecord(db, input, prepared)
    insertRowsInBatches(
      db,
      listingLaunchPlanRowSpec,
      prepared.normalizedRows.map((row) => listingLaunchPlanDbRow(id, row, prepared.now)),
      { batchSize: 250 },
    )
    refreshListingLaunchPlanSummaries(db, id)
    return id
  })()
  return importResult(db, importId, prepared)
}

export async function importListingLaunchPlanSheetsInChunks(
  db: SyncPostgresDatabase,
  input: ImportListingLaunchPlanInput,
  options: ImportListingLaunchPlanChunkOptions = {},
) {
  const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? 100)))
  const prepared = await prepareListingLaunchPlanImportInChunks(input, { chunkSize, signal: options.signal })
  throwIfAborted(options.signal)
  let importId: number | null = null
  try {
    importId = db.transaction(() => {
      const id = insertListingLaunchPlanImportRecord(db, input, prepared)
      for (let start = 0; start < prepared.normalizedRows.length; start += chunkSize) {
        throwIfAborted(options.signal)
        const end = Math.min(start + chunkSize, prepared.normalizedRows.length)
        const batchRows = prepared.normalizedRows
          .slice(start, end)
          .map((row) => listingLaunchPlanDbRow(id, row, prepared.now))
        insertRowsInBatches(db, listingLaunchPlanRowSpec, batchRows, { batchSize: 250 })
      }
      refreshListingLaunchPlanSummaries(db, id)
      return id
    })()
    for (let start = 0; start < prepared.normalizedRows.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, prepared.normalizedRows.length)
      await options.onProgress?.({
        importId,
        insertedRowCount: end,
        totalRowCount: prepared.normalizedRows.length,
      })
      throwIfAborted(options.signal)
      await wait()
    }
    return importResult(db, importId, prepared)
  } catch (error) {
    if (importId != null) {
      db.prepare("delete from listing_launch_plan_import where id = ?").run(importId)
    }
    throw error
  }
}

const LISTING_LAUNCH_PLAN_COUNT_CACHE_MS = 15_000
const listingLaunchPlanCountCache = new Map<string, { expiresAt: number; total: number }>()

function countCacheKey(input: { q: string; sheetName: string }) {
  return JSON.stringify(input)
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
  const afterSpuCode = stringValue(input.afterSpuCode)
  const afterRowId = readPositiveInteger(input.afterRowId)
  const useCursor = Boolean(afterSpuCode && afterRowId)
  const includeTotal = readBoolean(input.includeTotal, true)
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
  const filterClause = where.length ? `where ${where.join(" and ")}` : ""
  const filterParams = [...params]
  if (useCursor) {
    where.push("(row.spu_code, row.id) > (?, ?)")
    params.push(afterSpuCode, afterRowId)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const activeRowsFrom = `
    from listing_launch_plan_row row
    join listing_launch_plan_spu_latest latest on latest.row_id = row.id
    join listing_launch_plan_import imp on imp.id = row.import_id
  `
  const itemParams = useCursor ? [...params, limit + 1] : [...params, limit + 1, offset]
  const items = db.prepare(`
    select
      row.id,
      row.sheet_name,
      row.row_number,
      row.spu_code,
      row.skc_code,
      row.product_season,
      row.product_line,
      row.scene,
      row.attribute,
      row.gender,
      row.category_name,
      row.subcategory_name,
      row.color_name,
      row.tag_price,
      row.launch_date_text,
      row.search_launch_date_text,
      row.content_launch_date_text,
      row.listing_channel,
      row.official_category,
      row.vip_category,
      row.vip_style_category,
      row.douyin_category,
      latest.row_count,
      imp.file_name,
      imp.import_no,
      imp.created_at as imported_at
    ${activeRowsFrom}
    ${clause}
    order by row.spu_code, row.id
    limit ?${useCursor ? "" : " offset ?"}
  `).all(...itemParams)
  const pageItems = items.slice(0, limit)
  const lastItem = pageItems.at(-1) as { spu_code?: string; id?: number } | undefined
  const nextCursor = useCursor
    ? items.length > limit && lastItem?.spu_code && lastItem.id
      ? { afterSpuCode: lastItem.spu_code, afterRowId: Number(lastItem.id) }
      : null
    : items.length > limit && lastItem?.spu_code && lastItem.id
      ? { afterSpuCode: lastItem.spu_code, afterRowId: Number(lastItem.id) }
      : null
  let total = 0
  if (includeTotal) {
    const cacheKey = countCacheKey({ q, sheetName })
    const cached = listingLaunchPlanCountCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      total = cached.total
    } else {
      const row = db.prepare(`
        select count(*) as count
        ${activeRowsFrom}
        ${filterClause}
      `).get(...filterParams) as { count: number }
      total = Number(row.count ?? 0)
      listingLaunchPlanCountCache.set(cacheKey, {
        total,
        expiresAt: Date.now() + LISTING_LAUNCH_PLAN_COUNT_CACHE_MS,
      })
    }
  }
  const sheets = db.prepare(`
    select
      latest.sheet_name,
      count(*)::integer as count
    from listing_launch_plan_spu_latest latest
    group by latest.sheet_name
    order by latest.sheet_name
  `).all()
  return {
    items: pageItems,
    sheets,
    nextCursor,
    pagination: { total, limit, offset },
  }
}
