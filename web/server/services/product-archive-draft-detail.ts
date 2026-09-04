import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { normalizeDeepdrawSize } from "../../../scripts/lib/product_archive_size_chart.mjs"

type JsonRecord = Record<string, unknown>

type PageInput = {
  limit?: unknown
  offset?: unknown
}

type PageResult<T> = {
  items: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

export type ProductArchiveDraftSummary = {
  draft: JsonRecord
  tradeSelectionDecision: JsonRecord | null
  tradePlatforms: string[]
  launchPlanReference: {
    matched: boolean
    fields: Array<{ key: string; label: string; value: string }>
  }
  sizeChartMappings: Array<{
    fieldName: string
    targetField: string
    sourcePoint: string | null
    confidence: string
    source: string
    reviewStatus: string
    reason: string
  }>
  counts: {
    fields: number
    skus: number
    issues: number
    images: number
    referenceImages: number
    hangtagImages: number
    washlabelImages: number
  }
  thumbnail: ProductArchiveDraftAsset | null
}

export type ProductArchiveDraftField = JsonRecord
export type ProductArchiveDraftSku = JsonRecord
export type ProductArchiveDraftIssue = JsonRecord
export type ProductArchiveDraftActivity = JsonRecord

export type ProductArchiveDraftAsset = JsonRecord & {
  kind: "reference" | "hangtag" | "washlabel"
  asset_kind: string | null
  preview_url: string | null
  full_url: string | null
  thumbnail_url: string | null
}

export type ProductArchiveDraftSourceSnapshot = {
  source: unknown
  duplicate: unknown
}

export type ProductArchiveDraftSizeChartSourceRow = {
  spuCode: string
  measurementPoint: string
  size: string
  sizeValue: string
  sheetName: string
  rowNumber: number | null
  rowJson: JsonRecord
}

export type ProductArchiveDraftFieldPage = PageResult<ProductArchiveDraftField>
export type ProductArchiveDraftSkuPage = PageResult<ProductArchiveDraftSku>
export type ProductArchiveDraftIssuePage = PageResult<ProductArchiveDraftIssue>
export type ProductArchiveDraftActivityPage = PageResult<ProductArchiveDraftActivity>
export type ProductArchiveDraftAssetResponse = PageResult<ProductArchiveDraftAsset> & {
  counts: {
    reference: number
    hangtag: number
    washlabel: number
  }
}
export type ProductArchiveDraftSizeChartSourcePage = PageResult<ProductArchiveDraftSizeChartSourceRow>

const DEFAULT_PAGE_LIMIT = 100
const MAX_PAGE_LIMIT = 500

const LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS = [
  {
    key: "officialCategory",
    label: "官方发布类目",
    aliases: ["官方发布类目", "发布类目(官方)", "发布类目 (官方)", "发布类目（官方）", "发布类目\n(官方)"],
  },
  {
    key: "vipCategory",
    label: "唯品发布类目",
    aliases: ["发布类目 (唯品)", "发布类目(唯品)", "发布类目（唯品）"],
  },
  {
    key: "vipStyleCategory",
    label: "唯品四级品类",
    aliases: ["主款式 （唯品四级品类）", "主款式（唯品四级品类）", "主款式 (唯品四级品类)"],
  },
  {
    key: "douyinCategory",
    label: "抖音发布类目",
    aliases: ["发布类目 (抖音)", "发布类目(抖音)", "发布类目（抖音）"],
  },
  {
    key: "planCategory",
    label: "上市计划品类",
    aliases: ["品类", "类目", "分类"],
  },
  {
    key: "planSubCategory",
    label: "上市计划小类",
    aliases: ["小类", "子类", "细分类目"],
  },
] as const

const DEEPDRAW_PLATFORM_LABELS: Record<string, string> = {
  ALIBABA: "1688",
  ALIEXPRESS: "AliExpress",
  TAOBAO: "天猫/淘宝",
  TMALL: "天猫",
  JD: "京东",
  JINGDONG: "京东",
  VIP: "唯品会",
  VIPSHOP: "唯品会",
  PDD: "拼多多",
  DOUYIN: "抖音",
  DOUYINXSG: "抖音小时达",
  KUAISHOU: "快手",
  WECHAT: "微信视频小店",
  WEIXIN: "微信视频小店",
  WEIXINXIAODIAN: "微信视频小店",
  WECHATVIDEO: "微信视频小店",
  XHS: "小红书",
  XIAOHONGSHU: "小红书",
  YOUZAN: "有赞",
  AIKUCUN: "爱库存",
  HAOYK: "好衣库",
  KAOLA: "考拉",
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseJson(value: unknown, fallback: unknown) {
  if (value == null || value === "") return fallback
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function recordValue(value: unknown): JsonRecord {
  const parsed = parseJson(value, {})
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {}
}

function uniqueTextValues(values: unknown[]) {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const text = stringValue(value)
    if (!text || seen.has(text)) continue
    seen.add(text)
    output.push(text)
  }
  return output
}

function pageInput(input: PageInput = {}) {
  const requestedLimit = numberValue(input.limit)
  const requestedOffset = numberValue(input.offset)
  return {
    limit: Math.max(1, Math.min(MAX_PAGE_LIMIT, Math.floor(requestedLimit ?? DEFAULT_PAGE_LIMIT))),
    offset: Math.max(0, Math.floor(requestedOffset ?? 0)),
  }
}

function countValue(value: unknown) {
  return Math.max(0, Math.floor(numberValue(value) ?? 0))
}

function draftExists(db: SyncPostgresDatabase, draftId: number) {
  return Boolean(db.prepare("select id from product_archive_draft where id = ?").get(draftId))
}

function paginationTotal(db: SyncPostgresDatabase, sql: string, ...params: unknown[]) {
  const row = db.prepare(sql).get(...params) as JsonRecord | undefined
  return countValue(row?.count)
}

function imageUrl(imageId: unknown, variant?: "thumbnail" | "preview") {
  const id = numberValue(imageId)
  if (id === null || id <= 0) return null
  const suffix = variant ? `?variant=${variant}` : ""
  return `/api/product-archive-drafts/images/${id}/file${suffix}`
}

function imageKind(row: JsonRecord): "reference" | "hangtag" | "washlabel" {
  const assetKind = stringValue(row.asset_kind).toLowerCase()
  if (assetKind === "hangtag" || assetKind === "washlabel") return assetKind
  const name = [row.original_file_name, row.source_ref, row.file_name].map(stringValue).join(" ")
  if (/(洗唛|洗标|水洗|wash)/i.test(name)) return "washlabel"
  if (/(吊牌|合格证|hangtag|(?:^|[_\-\s])tag(?:[_\-\s.]|$))/i.test(name)) return "hangtag"
  return "reference"
}

function serializeAsset(row: JsonRecord): ProductArchiveDraftAsset {
  const kind = imageKind(row)
  const isPdf = stringValue(row.mime_type).toLowerCase() === "application/pdf"
    || /\.pdf$/i.test(stringValue(row.file_name))
    || /\.pdf$/i.test(stringValue(row.original_file_name))
    || /\.pdf$/i.test(stringValue(row.source_ref))
  const id = numberValue(row.id)
  return {
    id,
    draft_id: numberValue(row.draft_id),
    spu_code: stringValue(row.spu_code),
    source_type: stringValue(row.source_type),
    source_ref: stringValue(row.source_ref) || null,
    file_name: stringValue(row.file_name),
    original_file_name: stringValue(row.original_file_name) || null,
    mime_type: stringValue(row.mime_type) || null,
    file_size: numberValue(row.file_size),
    width: numberValue(row.width),
    height: numberValue(row.height),
    sort_no: numberValue(row.sort_no),
    kind,
    asset_kind: stringValue(row.asset_kind) || null,
    label: stringValue(row.original_file_name) || stringValue(row.source_ref) || stringValue(row.file_name) || `图片 ${id ?? ""}`,
    preview_url: isPdf ? imageUrl(id) : imageUrl(id, "preview"),
    full_url: imageUrl(id),
    thumbnail_url: isPdf ? null : imageUrl(id, "thumbnail"),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

function parseTradeSelection(value: unknown) {
  const result = recordValue(value)
  return Object.keys(result).length > 0 ? result : null
}

function loadTradePlatforms(db: SyncPostgresDatabase, row: JsonRecord) {
  if (!stringValue(row.trade_id)) return []
  try {
    const rows = db.prepare(`
      select distinct nullif(trim(raw_payload_json #>> '{attributes,thirdPlatform}'), '') as platform
      from deepdraw_trade_field_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
        and nullif(trim(raw_payload_json #>> '{attributes,thirdPlatform}'), '') is not null
      order by platform
    `).all(row.tenant_name, row.merchant_id, row.trade_id) as JsonRecord[]
    return uniqueTextValues(rows.flatMap((item) => stringValue(item.platform)
      .split(/[,，;；、\s]+/)
      .filter(Boolean)
      .map((value) => DEEPDRAW_PLATFORM_LABELS[value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()] ?? value)))
  } catch (error) {
    if (/deepdraw_trade_field_cache|unexpected sql|does not exist|no such table/i.test(error instanceof Error ? error.message : String(error))) return []
    throw error
  }
}

function meaningfulLaunchPlanValue(value: unknown) {
  const text = stringValue(value)
  return Boolean(text) && !["/", "-", "--", "—", "0", "无", "暂无", "null", "NULL"].includes(text.replace(/\s+/g, ""))
}

function launchPlanReference(db: SyncPostgresDatabase, spuCode: string) {
  const aliases = Array.from(new Set(LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS.flatMap((field) => field.aliases)))
  if (!spuCode || aliases.length === 0) return { matched: false, fields: [] }
  const values = aliases.map((_, index) => `source.row_json ->> ? as value_${index}`).join(",\n        ")
  const rows = db.prepare(`
    select source.source_batch_id, source.id,
      ${values}
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_type = 'launch_plan'
    order by source.source_batch_id desc, source.id desc
  `).all(...aliases, spuCode) as JsonRecord[]
  const fields = LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS.flatMap((field) => {
    const aliasIndexes = field.aliases.map((alias) => aliases.indexOf(alias)).filter((index) => index >= 0)
    const batchIds = Array.from(new Set(rows
      .map((row) => numberValue(row.source_batch_id))
      .filter((value): value is number => value !== null && value > 0)))
      .sort((left, right) => right - left)
    const groups = batchIds.length > 0
      ? batchIds.map((batchId) => rows.filter((row) => numberValue(row.source_batch_id) === batchId))
      : [rows]
    for (const group of groups) {
      const groupValues = uniqueTextValues(group.flatMap((row) => aliasIndexes.map((index) => row[`value_${index}`]))
        .filter(meaningfulLaunchPlanValue))
      if (groupValues.length > 0) return [{ key: field.key, label: field.label, value: groupValues.join("；") }]
    }
    return []
  })
  return { matched: fields.length > 0, fields }
}

function sizeChartMappings(db: SyncPostgresDatabase, row: JsonRecord) {
  if (!stringValue(row.trade_id)) return []
  try {
    const mappings = db.prepare(`
      select field_name, target_field, source_point, confidence, source, review_status, evidence_json
      from product_archive_size_chart_mapping
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
        and review_status = 'approved'
        and coalesce(source_point, '') <> ''
      order by field_name,
        case confidence when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end,
        target_field
    `).all(row.tenant_name, row.merchant_id, row.trade_id) as JsonRecord[]
    return mappings.map((mapping) => ({
      fieldName: stringValue(mapping.field_name),
      targetField: stringValue(mapping.target_field),
      sourcePoint: stringValue(mapping.source_point) || null,
      confidence: stringValue(mapping.confidence),
      source: stringValue(mapping.source),
      reviewStatus: stringValue(mapping.review_status),
      reason: stringValue(recordValue(mapping.evidence_json).reason),
    }))
  } catch (error) {
    if (/product_archive_size_chart_mapping|unexpected sql|does not exist|no such table/i.test(error instanceof Error ? error.message : String(error))) return []
    throw error
  }
}

function summaryRow(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select
      draft.id,
      draft.draft_no,
      draft.spu_code,
      draft.title,
      draft.tenant_name,
      draft.merchant_id,
      draft.trade_id,
      draft.trade_path,
      draft.retail_price,
      draft.status,
      draft.validation_summary_json,
      draft.created_product_id,
      draft.created_product_code,
      draft.updated_at,
      (draft.submit_claim_token is not null) as submit_in_progress,
      draft.source_snapshot_json #> '{tradeSelection}' as trade_selection_json,
      (select count(*) from product_archive_draft_field field where field.draft_id = draft.id) as field_count,
      (select count(*) from product_archive_draft_sku sku where sku.draft_id = draft.id) as sku_count,
      (select count(*) from product_archive_validation_issue issue where issue.draft_id = draft.id) as issue_count,
      (select count(*) from product_archive_draft_image image where image.draft_id = draft.id) as image_count,
      (select count(*) from product_archive_draft_image image
        where image.draft_id = draft.id
          and coalesce(image.raw_payload_json #>> '{asset_kind}', '') not in ('hangtag', 'washlabel')) as reference_image_count,
      (select count(*) from product_archive_draft_image image
        where image.draft_id = draft.id
          and image.raw_payload_json #>> '{asset_kind}' = 'hangtag') as hangtag_image_count,
      (select count(*) from product_archive_draft_image image
        where image.draft_id = draft.id
          and image.raw_payload_json #>> '{asset_kind}' = 'washlabel') as washlabel_image_count,
      thumbnail.id as thumbnail_id,
      thumbnail.draft_id as thumbnail_draft_id,
      thumbnail.spu_code as thumbnail_spu_code,
      thumbnail.source_type as thumbnail_source_type,
      thumbnail.source_ref as thumbnail_source_ref,
      thumbnail.file_name as thumbnail_file_name,
      thumbnail.original_file_name as thumbnail_original_file_name,
      thumbnail.mime_type as thumbnail_mime_type,
      thumbnail.file_size as thumbnail_file_size,
      thumbnail.width as thumbnail_width,
      thumbnail.height as thumbnail_height,
      thumbnail.sort_no as thumbnail_sort_no,
      thumbnail.asset_kind as thumbnail_asset_kind,
      thumbnail.created_at as thumbnail_created_at,
      thumbnail.updated_at as thumbnail_updated_at
    from product_archive_draft draft
    left join lateral (
      select
        image.id,
        image.draft_id,
        image.spu_code,
        image.source_type,
        image.source_ref,
        image.file_name,
        image.original_file_name,
        image.mime_type,
        image.file_size,
        image.width,
        image.height,
        image.sort_no,
        image.raw_payload_json #>> '{asset_kind}' as asset_kind,
        image.created_at,
        image.updated_at
      from product_archive_draft_image image
      where image.draft_id = draft.id
        and coalesce(image.raw_payload_json #>> '{asset_kind}', '') not in ('hangtag', 'washlabel')
      order by
        case image.raw_payload_json #>> '{asset_kind}'
          when 'flat_image' then 0
          when 'model_image' then 1
          else 2
        end,
        image.sort_no,
        image.id
      limit 1
    ) thumbnail on true
    where draft.id = ?
  `).get(draftId) as JsonRecord | undefined
}

export function getProductArchiveDraftSummary(db: SyncPostgresDatabase, draftId: number): ProductArchiveDraftSummary | null {
  const row = summaryRow(db, draftId)
  if (!row) return null
  const thumbnailRow = row.thumbnail_id == null
    ? null
    : {
        id: row.thumbnail_id,
        draft_id: row.thumbnail_draft_id,
        spu_code: row.thumbnail_spu_code,
        source_type: row.thumbnail_source_type,
        source_ref: row.thumbnail_source_ref,
        file_name: row.thumbnail_file_name,
        original_file_name: row.thumbnail_original_file_name,
        mime_type: row.thumbnail_mime_type,
        file_size: row.thumbnail_file_size,
        width: row.thumbnail_width,
        height: row.thumbnail_height,
        sort_no: row.thumbnail_sort_no,
        asset_kind: row.thumbnail_asset_kind,
        created_at: row.thumbnail_created_at,
        updated_at: row.thumbnail_updated_at,
      }
  const draft = {
    id: numberValue(row.id),
    draft_no: stringValue(row.draft_no),
    spu_code: stringValue(row.spu_code),
    title: stringValue(row.title) || null,
    tenant_name: stringValue(row.tenant_name),
    merchant_id: stringValue(row.merchant_id),
    trade_id: stringValue(row.trade_id) || null,
    trade_path: stringValue(row.trade_path) || null,
    retail_price: numberValue(row.retail_price),
    status: stringValue(row.status),
    validation_summary_json: recordValue(row.validation_summary_json),
    created_product_id: stringValue(row.created_product_id) || null,
    created_product_code: stringValue(row.created_product_code) || null,
    updated_at: row.updated_at ?? null,
    submit_state: row.submit_in_progress === true || stringValue(row.submit_in_progress).toLowerCase() === "true"
      ? "submitting"
      : "idle",
  }
  return {
    draft,
    tradeSelectionDecision: parseTradeSelection(row.trade_selection_json),
    tradePlatforms: loadTradePlatforms(db, row),
    launchPlanReference: launchPlanReference(db, stringValue(row.spu_code)),
    sizeChartMappings: sizeChartMappings(db, row),
    counts: {
      fields: countValue(row.field_count),
      skus: countValue(row.sku_count),
      issues: countValue(row.issue_count),
      images: countValue(row.image_count),
      referenceImages: countValue(row.reference_image_count),
      hangtagImages: countValue(row.hangtag_image_count),
      washlabelImages: countValue(row.washlabel_image_count),
    },
    thumbnail: thumbnailRow ? serializeAsset(thumbnailRow) : null,
  }
}

export function getProductArchiveDraftFields(
  db: SyncPostgresDatabase,
  draftId: number,
  input: PageInput = {},
): ProductArchiveDraftFieldPage | null {
  if (!draftExists(db, draftId)) return null
  const page = pageInput(input)
  const items = db.prepare(`
    select
      field.id,
      field.draft_id,
      field.field_name,
      field.field_id,
      field.source_type,
      field.source_ref,
      field.value_text,
      field.value_json,
      field.required,
      field.blocking,
      field.manual_override,
      field.validation_status,
      field.validation_message,
      field.updated_at,
      template.field_id as template_field_id,
      template.field_name as template_field_name,
      template.options_json,
      template.field_type,
      template.raw_payload_json #>> '{attributes,thirdPlatform}' as template_third_platform
    from product_archive_draft_field field
    left join lateral (
      select field_id, field_name, options_json, field_type, raw_payload_json
      from deepdraw_trade_field_cache template
      where template.tenant_name = (select tenant_name from product_archive_draft where id = ?)
        and template.merchant_id = (select merchant_id from product_archive_draft where id = ?)
        and template.trade_id = (select trade_id from product_archive_draft where id = ?)
        and (template.field_id = field.field_id or template.field_name = field.field_name)
      order by case when template.field_id = field.field_id then 0 else 1 end, template.field_id
      limit 1
    ) template on true
    where field.draft_id = ?
    order by field.required desc, field.blocking desc, field.field_name, field.id
    limit ? offset ?
  `).all(draftId, draftId, draftId, draftId, page.limit, page.offset) as JsonRecord[]
  const total = paginationTotal(
    db,
    "select count(*) as count from product_archive_draft_field where draft_id = ?",
    draftId,
  )
  return { items, pagination: { total, ...page } }
}

export function getProductArchiveDraftSkus(
  db: SyncPostgresDatabase,
  draftId: number,
  input: PageInput = {},
): ProductArchiveDraftSkuPage | null {
  if (!draftExists(db, draftId)) return null
  const page = pageInput(input)
  const items = db.prepare(`
    select id, draft_id, skc_code, sku_code, barcode, color_name, size_name, size_code, price, seller_code
    from product_archive_draft_sku
    where draft_id = ?
    order by skc_code nulls first, size_code nulls first, sku_code, id
    limit ? offset ?
  `).all(draftId, page.limit, page.offset) as JsonRecord[]
  const total = paginationTotal(
    db,
    "select count(*) as count from product_archive_draft_sku where draft_id = ?",
    draftId,
  )
  return { items, pagination: { total, ...page } }
}

export function getProductArchiveDraftIssues(
  db: SyncPostgresDatabase,
  draftId: number,
  input: PageInput = {},
): ProductArchiveDraftIssuePage | null {
  if (!draftExists(db, draftId)) return null
  const page = pageInput(input)
  const items = db.prepare(`
    select id, draft_id, severity, issue_type, field_name, sku_code, message, resolved_at, created_at
    from product_archive_validation_issue
    where draft_id = ?
    order by resolved_at nulls first,
      case severity when 'blocker' then 0 when 'warning' then 1 else 2 end,
      id
    limit ? offset ?
  `).all(draftId, page.limit, page.offset) as JsonRecord[]
  const total = paginationTotal(
    db,
    "select count(*) as count from product_archive_validation_issue where draft_id = ?",
    draftId,
  )
  return { items, pagination: { total, ...page } }
}

export function getProductArchiveDraftAssets(
  db: SyncPostgresDatabase,
  draftId: number,
): ProductArchiveDraftAssetResponse | null {
  if (!draftExists(db, draftId)) return null
  const page = pageInput({ limit: DEFAULT_PAGE_LIMIT })
  const rows = db.prepare(`
    select id, draft_id, spu_code, source_type, source_ref, file_name, original_file_name,
      mime_type, file_size, width, height, sort_no,
      raw_payload_json #>> '{asset_kind}' as asset_kind,
      created_at, updated_at
    from product_archive_draft_image
    where draft_id = ?
    order by sort_no, id
    limit ? offset ?
  `).all(draftId, page.limit, page.offset) as JsonRecord[]
  const totalRow = db.prepare(`
    select
      count(*) as total,
      count(*) filter (where coalesce(raw_payload_json #>> '{asset_kind}', '') not in ('hangtag', 'washlabel')) as reference,
      count(*) filter (where raw_payload_json #>> '{asset_kind}' = 'hangtag') as hangtag,
      count(*) filter (where raw_payload_json #>> '{asset_kind}' = 'washlabel') as washlabel
    from product_archive_draft_image
    where draft_id = ?
  `).get(draftId) as JsonRecord | undefined
  return {
    items: rows.map(serializeAsset),
    pagination: { total: countValue(totalRow?.total), ...page },
    counts: {
      reference: countValue(totalRow?.reference),
      hangtag: countValue(totalRow?.hangtag),
      washlabel: countValue(totalRow?.washlabel),
    },
  }
}

export function getProductArchiveDraftActivity(
  db: SyncPostgresDatabase,
  draftId: number,
  input: PageInput = {},
): ProductArchiveDraftActivityPage | null {
  if (!draftExists(db, draftId)) return null
  const page = pageInput(input)
  const items = db.prepare(`
    select id, draft_id, operation, http_status, response_code, response_reason,
      request_id, product_id, created_at
    from product_archive_submit_log
    where draft_id = ?
    order by created_at desc, id desc
    limit ? offset ?
  `).all(draftId, page.limit, page.offset) as JsonRecord[]
  const total = paginationTotal(
    db,
    "select count(*) as count from product_archive_submit_log where draft_id = ?",
    draftId,
  )
  return { items, pagination: { total, ...page } }
}

export function getProductArchiveDraftSourceSnapshot(
  db: SyncPostgresDatabase,
  draftId: number,
): ProductArchiveDraftSourceSnapshot | null {
  const row = db.prepare(`
    select source_snapshot_json, duplicate_result_json
    from product_archive_draft
    where id = ?
  `).get(draftId) as JsonRecord | undefined
  if (!row) return null
  return {
    source: parseJson(row.source_snapshot_json, {}),
    duplicate: parseJson(row.duplicate_result_json, {}),
  }
}

function requestedSizeChartBatchIds(snapshot: JsonRecord) {
  const sourceBatchIds = recordValue(snapshot.sourceBatchIds).size_chart
  const values = Array.isArray(sourceBatchIds)
    ? sourceBatchIds
    : Array.isArray(snapshot.sourceBatchIds) ? snapshot.sourceBatchIds : []
  return Array.from(new Set(values
    .map(numberValue)
    .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)))
}

export function getProductArchiveDraftSizeChartSource(
  db: SyncPostgresDatabase,
  draftId: number,
  input: PageInput = {},
): ProductArchiveDraftSizeChartSourcePage | null {
  const draft = db.prepare(`
    select spu_code, source_snapshot_json
    from product_archive_draft
    where id = ?
  `).get(draftId) as JsonRecord | undefined
  if (!draft) return null
  const page = pageInput(input)
  const batchIds = requestedSizeChartBatchIds(recordValue(draft.source_snapshot_json))
  const batchClause = batchIds.length > 0
    ? `and source.source_batch_id in (${batchIds.map(() => "?").join(", ")})`
    : ""
  const rows = db.prepare(`
    select source.id, source.source_batch_id, source.row_json, batch.sheet_name
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_type = 'size_chart'
      ${batchClause}
    order by source.source_batch_id desc, source.id desc
    limit ? offset ?
  `).all(stringValue(draft.spu_code), ...batchIds, page.limit, page.offset) as JsonRecord[]
  const totalSql = `
    select count(*) as count
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_type = 'size_chart'
      ${batchClause}
  `
  const total = paginationTotal(db, totalSql, stringValue(draft.spu_code), ...batchIds)
  const items = rows.map((row) => {
    const rowJson = recordValue(row.row_json)
    return {
      spuCode: stringValue(rowJson.款号 ?? rowJson.spuCode ?? rowJson.spu_code ?? draft.spu_code),
      measurementPoint: stringValue(rowJson.测量点 ?? rowJson.measurementPoint ?? rowJson.measurement_point),
      size: normalizeDeepdrawSize(rowJson.size ?? rowJson.尺码),
      sizeValue: stringValue(rowJson.尺码值 ?? rowJson.sizeValue ?? rowJson.size_value),
      sheetName: stringValue(row.sheet_name),
      rowNumber: numberValue(rowJson.rowNumber ?? rowJson.row_number),
      rowJson,
    }
  })
  return { items, pagination: { total, ...page } }
}
