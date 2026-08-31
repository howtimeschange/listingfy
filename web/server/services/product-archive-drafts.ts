import fs from "node:fs"
import { randomUUID } from "node:crypto"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  normalizeProductArchiveSourceRowsInChunks,
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
} from "../../../scripts/lib/product_archive_source_importer.mjs"
import {
  balabalaApparelAgeTextForSizeRange,
  buildSizeChartForTemplate,
  normalizeDeepdrawSize,
  normalizePlmSizeChartRows,
} from "../../../scripts/lib/product_archive_size_chart.mjs"
import {
  createDeepdrawProduct,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
  updateDeepdrawProduct,
} from "../../../scripts/lib/deepdraw_client.mjs"
import {
  compareDeepdrawLegacyShoePayloadToResource,
  deepdrawLegacyShoePostCreateUpdateRequired,
  selectDeepdrawLegacyShoeCreateFields,
  selectDeepdrawLegacyShoeUpdateFields,
} from "../../../scripts/lib/deepdraw_sdk_adapter.mjs"
import {
  getDefaultAiScenarioRouter,
  withAiRoutingHashes,
} from "../../../scripts/lib/ai_routing_context.mjs"
import { recognizeProductArchiveOcrFiles } from "../../../scripts/lib/product_archive_hangtag_ocr.mjs"
import { extractDeepdrawTradeFieldRows } from "./deepdraw-metadata"
import {
  buildShoeSizeRemarks,
  buildShoeSizeChartFieldValues,
  isShoeProductContext,
  loadShoeSizeChartRows,
  normalizeAgeFieldOptionValue,
  normalizeShoeSkuSize,
  shoeEnumClassificationPrompt,
  resolveShoeSizeChartMatch,
  shoeSandalVisualClassificationPrompt,
} from "./shoe-size-chart-matching"

type JsonRecord = Record<string, unknown>

interface ListDraftsInput {
  q?: string | null
  spuCodes?: string | string[] | null
  status?: string | null
  tenant?: string | null
  limit?: unknown
  offset?: unknown
}

interface CreateDraftInput {
  spuCode: string
  deepdrawTenantName?: string | null
  tradeId?: string | null
  tradePath?: string | null
  sourceBatchId?: number | null
  sourceBatchIds?: Record<string, number[]> | number[] | null
  createdBy?: number | null
  projectRoot?: string
}

interface PatchFieldInput {
  expectedDraftUpdatedAt?: string | null
  expected_draft_updated_at?: string | null
  fields: Array<{
    id?: number
    fieldName?: string
    field_name?: string
    expectedUpdatedAt?: string | null
    expected_updated_at?: string | null
    valueText?: string | null
    value_text?: string | null
    valueJson?: unknown
    value_json?: unknown
  }>
}

interface ApplyTradeInput {
  tradeId?: string | null
  tradePath?: string | null
}

interface ConfirmTradeInput {
  recommendedTradeId?: string | null
}

const PRODUCT_ARCHIVE_TRADE_BACKFILL_EDITABLE_STATUSES = new Set([
  "draft",
  "manual_review",
  "ready",
])

const PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES = [
  "draft",
  "missing_fields",
  "manual_review",
  "ready",
] as const

export function isProductArchiveTradeBackfillStatus(status: unknown) {
  return PRODUCT_ARCHIVE_TRADE_BACKFILL_EDITABLE_STATUSES.has(stringValue(status))
}

export function isReusableProductArchiveDraftStatus(status: unknown) {
  return (PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES as readonly string[]).includes(stringValue(status))
}

type ProductArchiveValidationIssueLike = {
  severity?: unknown
  issueType?: unknown
  issue_type?: unknown
}

export function productArchiveDraftStatusFromValidationIssues(
  issues: ProductArchiveValidationIssueLike[],
  fields: JsonRecord[] = [],
) {
  const blockers = issues.filter((issue) => stringValue(issue.severity) === "blocker")
  if (blockers.length === 0) return "ready"
  if (blockers.some((issue) => stringValue(issue.issueType ?? issue.issue_type) === "duplicate_product_found")) {
    return "duplicate_found"
  }
  return fields.some((field) => stringValue(field.source_type) === "manual" && stringValue(field.validation_status) === "missing")
    ? "manual_review"
    : "missing_fields"
}

export type TradeSelectionStatus =
  | "auto_applied"
  | "pending_confirmation"
  | "manual_selection_required"
  | "human_confirmed"
  | "human_adjusted"

export type TradeSelectionReasonCode =
  | "unique_high_confidence"
  | "medium_confidence"
  | "source_category_conflict"
  | "missing_source_category"
  | "missing_platform_coverage"
  | "missing_size_template_coverage"
  | "missing_semantic_match"
  | "ambiguous_match"
  | "applied_trade_mismatch"
  | "legacy_backfill_confirmation_required"
  | "human_confirmed"
  | "human_adjusted"

export interface TradeSelectionDecision {
  status: TradeSelectionStatus
  confidence: "high" | "medium" | "none"
  reasonCode: TradeSelectionReasonCode
  recommendedTrade: { tradeId: string; tradePath: string } | null
  appliedTrade: { tradeId: string; tradePath: string } | null
  matchedField: string | null
  matchedValue: string | null
  requiredPlatforms: string[]
  coveredPlatforms: string[]
  sourceConflict: boolean
  reason: string
  evaluatedAt: string
  confirmedAt: string | null
}

interface DeepdrawResult {
  status: number
  ok: boolean
  requestId?: string | null
  payload: unknown
}

interface SubmitOptions {
  dryRun?: boolean
  updateExisting?: boolean
  claimToken?: string
  search?: () => Promise<DeepdrawResult>
  create?: (payload: JsonRecord) => Promise<DeepdrawResult>
  update?: (payload: JsonRecord, productId: string) => Promise<DeepdrawResult>
  readback?: () => Promise<DeepdrawResult>
  projectRoot?: string
}

interface AiFillOptions {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
  router?: {
    callJson: (input: Record<string, unknown>) => Promise<{
      json: Record<string, unknown>
    }>
  }
  fileExists?: (filePath: string) => boolean
  ocrRecognizer?: typeof recognizeProductArchiveOcrFiles
  ocrOptions?: JsonRecord
}

type ProductArchiveAiFillWarning = {
  code: string
  message: string
}

interface ProductArchiveDraftImageInput {
  draftId: number
  spuCode: string
  sourceType: "manual_upload" | "batch_upload" | "crawshrimp_asset_package"
  sourceRef?: string | null
  localPath: string
  fileName: string
  originalFileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  width?: number | null
  height?: number | null
  uploadedBy?: number | null
  rawPayload?: JsonRecord
}

export type ProductArchiveAssetPackageFileKind =
  | "hangtag"
  | "washlabel"
  | "reference_image"
  | "spreadsheet"
  | "hidden"
  | "unsupported"

interface SourceImportInput {
  sourceType?: string | null
  fileName?: string | null
  sheetName?: string | null
  rows?: JsonRecord[]
}

interface SourceImportChunkOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (progress: {
    sourceBatchId: number
    insertedRowCount: number
    totalRowCount: number
  }) => void | Promise<void>
}

interface RefreshSourceBatchInput {
  sourceBatchId: number
  sourceType: string
}

interface RefreshSourceBatchChunkOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (progress: {
    sourceBatchId: number
    scannedDraftCount: number
    processedDraftCount: number
    refreshedDraftCount: number
    autoAppliedTradeCount: number
    skippedNoTradeMatchCount: number
    failedDraftCount: number
  }) => void | Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

function timestampIsoValue(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  const text = stringValue(value)
  if (!text) return ""
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString()
}

function nextTimestampIso(values: unknown[]) {
  const latest = Math.max(
    0,
    ...values.map((value) => new Date(timestampIsoValue(value)).getTime()).filter(Number.isFinite),
  )
  return new Date(Math.max(Date.now(), latest + 1)).toISOString()
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error("后台处理已取消")
  error.name = "AbortError"
  throw error
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

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function optionText(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return stringValue(value)
  const record = recordValue(value)
  const display = fieldOptionText(value, [
    "attrValueName",
    "attr_value_name",
    "label",
    "name",
    "text",
    "optionName",
    "option_name",
    "title",
  ])
  if (display) return display
  return stringValue(
    record.value
      ?? record.optionValue
      ?? record.option_value
      ?? record.attrValueId
      ?? record.attr_value_id
      ?? record.code
      ?? record.key
      ?? record.name
      ?? record.label
      ?? record.text
      ?? record.optionName
      ?? record.option_name
      ?? record.id,
  )
}

function isPrimitiveOptionToken(value: unknown) {
  return value == null || typeof value !== "object"
}

function looksLikeDeepdrawOptionIdToken(value: unknown) {
  const text = stringValue(value)
  return /^\d{4,}$/.test(text)
}

function hasReadableOptionText(value: unknown) {
  const text = stringValue(value)
  return Boolean(text && !looksLikeDeepdrawOptionIdToken(text) && /[A-Za-z\u4e00-\u9fff]/.test(text))
}

function primitiveOptionTokenIsPairedId(options: unknown[], index: number) {
  const option = options[index]
  if (!isPrimitiveOptionToken(option) || !looksLikeDeepdrawOptionIdToken(option)) return false
  const readablePeerCount = options.filter((candidate) => (
    isPrimitiveOptionToken(candidate)
    && hasReadableOptionText(candidate)
  )).length
  if (readablePeerCount < 2 && !(options.length === 2 && readablePeerCount === 1)) return false
  return [
    options[index - 1],
    options[index + 1],
  ].some((candidate) => isPrimitiveOptionToken(candidate) && hasReadableOptionText(candidate))
}

function visibleOptionText(option: unknown, options: unknown[] = [], index = -1) {
  if (index >= 0 && primitiveOptionTokenIsPairedId(options, index)) return ""
  return optionText(option).replace(/\s*[（(]\s*\d{4,}\s*[）)]\s*$/g, "").trim()
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function recordValue(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {}
    } catch {
      return {}
    }
  }
  return {}
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function parseDraftSpuCodes(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => stringValue(item).split(/[\s,，;；]+/))
    : stringValue(value).split(/[\s,，;；]+/)
  return uniqueTextValues(rawValues)
}

function draftNo(spuCode: string) {
  return `PAD-${spuCode}-${Date.now()}`
}

function sourceBatchNo(sourceType: string) {
  return `PAS-${sourceType}-${Date.now()}`
}

function sourceImportType(value: unknown) {
  const sourceType = stringValue(value)
  if (["field_mapping", "launch_plan", "copywriting", "size_chart"].includes(sourceType)) return sourceType
  throw new Error("sourceType must be field_mapping, launch_plan, copywriting, or size_chart")
}

function hasValue(value: unknown) {
  if (value == null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

function sourceFieldValue(rows: JsonRecord[], sourceType: string, sourceField: string, skcCode?: string | null) {
  if (!sourceField) return ""
  const candidates = rows.filter((row) => stringValue(row.source_type) === sourceType)
  const ordered = skcCode
    ? [
        ...candidates.filter((row) => stringValue(row.skc_code) === skcCode),
        ...candidates.filter((row) => !stringValue(row.skc_code)),
      ]
    : candidates
  for (const row of ordered) {
    const rowJson = recordValue(row.row_json)
    const value = stringValue(rowJson[sourceField])
    if (value) return value
  }
  return ""
}

function sourceFieldValueAny(rows: JsonRecord[], sourceType: string, sourceFields: string[], skcCode?: string | null) {
  for (const sourceField of sourceFields) {
    const value = sourceFieldValue(rows, sourceType, sourceField, skcCode)
    if (value) return value
  }
  return ""
}

function sourceFieldValuesAny(rows: JsonRecord[], sourceType: string, sourceFields: string[]) {
  return uniqueTextValues(rows
    .filter((row) => stringValue(row.source_type) === sourceType)
    .map((row) => {
      const rowJson = recordValue(row.row_json)
      return sourceFields.map((sourceField) => stringValue(rowJson[sourceField])).find(Boolean) ?? ""
    }))
}

function compactFieldKey(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）.。]/g, "").toLowerCase()
}

function uploadPathText(value: unknown) {
  return stringValue(value).replace(/\\/g, "/")
}

function uploadBaseName(value: unknown) {
  const text = uploadPathText(value)
  return text.split("/").filter(Boolean).at(-1) ?? text
}

function uploadExtension(value: unknown) {
  const base = uploadBaseName(value)
  const index = base.lastIndexOf(".")
  return index >= 0 ? base.slice(index).toLowerCase() : ""
}

export function productArchiveImageHasModelShot(value: unknown) {
  return /有模拍/.test(uploadBaseName(value))
}

function productArchiveLegacyWashlabelName(value: unknown) {
  const base = uploadBaseName(value)
  const ext = uploadExtension(base)
  const stem = ext ? base.slice(0, -ext.length) : base
  return /^yq(?:[-_ ]?\d+|\s*\(\d+\))?$/i.test(stem)
}

export function classifyProductArchiveAssetPackageFileName(value: unknown): ProductArchiveAssetPackageFileKind {
  const text = uploadPathText(value)
  const base = uploadBaseName(text)
  if (!base || base === ".DS_Store" || base.startsWith("~$")) return "hidden"
  const ext = uploadExtension(base)
  if ([".xlsx", ".xlsm"].includes(ext)) return "spreadsheet"
  if ([".pdf"].includes(ext)) {
    if (/(洗唛|洗标|水洗|wash)/i.test(base)) return "washlabel"
    return "hangtag"
  }
  if ([".jpg", ".jpeg", ".png"].includes(ext)) {
    if (/(洗唛|洗标|水洗|wash)/i.test(base)) return "washlabel"
    if (/(吊牌|合格证|鞋盒|hangtag|tag|shoe[-_ ]?box)/i.test(base)) return "hangtag"
    if (productArchiveLegacyWashlabelName(base)) return "washlabel"
    return "reference_image"
  }
  if (ext === ".webp") return "reference_image"
  return "unsupported"
}

const LIST_PRICE_REFERENCE_KEYS = new Set([
  "吊牌价格",
  "吊牌价",
  "核算吊牌价",
  "挂牌价",
  "挂牌单价",
  "京东市场价",
  "京东价",
  "奥莱店折扣价",
  "产品单价",
  "抖音参考价",
  "抖音参考价格",
  "市场价",
  "商品市场价",
])

const PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS = new Set([
  "划线价",
  "唯品会市场价",
  "拼多多单买价",
  "拼多多团购价",
  "天猫特卖折扣价",
  "天猫特卖专柜价",
  "采购价",
  "京东自营市场价",
  "有赞标准价",
  "有赞价格",
  "原价",
  "小红书市场价",
  "抖音结算价格",
  "抖音价",
  "快手价",
  "爱库存供货价",
  "爱库存最低价",
  "好衣库结算价",
  "好衣库供货价",
  "好衣库价",
  "好衣库原价",
  "微信视频小店价格",
])

const LAUNCH_PLAN_REFERENCE_FIELDS = new Set([
  "款号",
  "大货款号",
  "货号",
  "吊牌价格",
  "吊牌价",
  "核算吊牌价",
  "挂牌单价",
  "挂牌价",
  "京东市场价",
  "市场价",
  "颜色",
  "颜色名称",
  "上市时间",
  "内容上市时间",
  "搜索上市时间",
  "产品季",
  "产品季类",
  "对应日期",
  "官方发布类目",
  "发布类目",
  "发布类目 (官方)",
  "发布类目(官方)",
  "发布类目 (唯品)",
  "发布类目(唯品)",
  "发布类目 (抖音)",
  "发布类目(抖音)",
  "首批sap到货时间",
  "首批 SAP 到货时间",
  "主款式 （唯品四级品类）",
  "主款式（唯品四级品类）",
  "主款式",
  "属性",
  "执行标准",
])

const COPYWRITING_REFERENCE_FIELDS = new Set([
  "搜索标题",
  "商品标题",
  "标题",
  "唯品标题",
  "唯品会标题",
  "内容平台标题",
  "内容标题",
  "导购标题",
  "推荐理由",
  "FAB",
  "面料成分",
  "材质成分",
  "大身面料",
  "帮面材料",
  "帮面材质",
  "里料材质",
  "内里材质",
  "鞋底材质",
  "品类",
  "名称",
  "商品名称",
  "年龄段",
  "尺码段",
  "性别",
  "面料名称",
  "面料文案",
  "面料三个关键词",
  "细节文案",
  "主图4第1句",
  "主图4第2-3句",
  "面料名称-面料文案*面料三个关键词",
  "去掉巴拉巴拉",
  "柔软度",
  "厚薄",
  "弹性",
  "版型",
])

function listPriceReferenceKey(value: unknown) {
  return compactFieldKey(sourceReferenceText(value))
}

function isProductArchiveListPriceReference(value: unknown) {
  const key = listPriceReferenceKey(value)
  return LIST_PRICE_REFERENCE_KEYS.has(key) || PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS.has(key)
}

function sourceReferenceText(value: unknown) {
  return stringValue(value)
    .replace(/^(固定|默认|取|读取|来自)\s*/i, "")
    .replace(/^mdm\s*/i, "")
    .trim()
}

function productArchiveSourceReference(value: unknown) {
  const sourceField = sourceReferenceText(value)
  if (!sourceField) return null
  if (LAUNCH_PLAN_REFERENCE_FIELDS.has(sourceField)) return { sourceType: "launch_plan", sourceField }
  if (COPYWRITING_REFERENCE_FIELDS.has(sourceField)) return { sourceType: "copywriting", sourceField }
  return null
}

function productArchiveListPriceText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return moneyText(spu.price_tag) || launchValue(sourceRows, "吊牌价格") || launchValue(sourceRows, "吊牌价")
}

function productArchiveOffsetPriceText(value: unknown, offset: number) {
  const number = numberValue(value)
  if (number === null) return ""
  const output = number + offset
  return Number.isInteger(output) ? String(output) : output.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
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

function moneyText(value: unknown) {
  const number = numberValue(value)
  return number === null ? stringValue(value) : String(number)
}

const PRODUCT_ARCHIVE_MERCHANT_SKU_BASE_COLUMNS = [
  "价格",
  "货号",
  "上市时间",
  "数量",
  "商家编码",
  "条形码",
  "零售价",
  "供货价",
  "唯品会货号",
  "唯品会条形码",
]

const PRODUCT_ARCHIVE_MERCHANT_SKU_RULE_COLUMNS = [
  ...PRODUCT_ARCHIVE_MERCHANT_SKU_BASE_COLUMNS,
  "京东价",
  "划线价",
  "拼多多单买价",
  "拼多多团购价",
  "天猫特卖折扣价",
  "天猫特卖专柜价",
  "采购价",
  "京东自营市场价",
  "有赞标准价",
  "有赞价格",
  "原价",
  "小红书市场价",
  "抖音结算价格",
  "抖音价",
  "快手价",
  "爱库存供货价",
  "爱库存最低价",
  "好衣库结算价",
  "好衣库供货价",
  "好衣库价",
  "好衣库原价",
  "微信视频小店价格",
  "单品货号",
  "小红书商家编码",
  "天猫SKU搜索标题",
]

function merchantSkuColumns(templateOptions: unknown[] = []) {
  const supported = new Set(optionValues(templateOptions))
  if (supported.size === 0) return PRODUCT_ARCHIVE_MERCHANT_SKU_BASE_COLUMNS
  return PRODUCT_ARCHIVE_MERCHANT_SKU_RULE_COLUMNS.filter((column) => supported.has(column))
}

function productArchiveSkuLaunchMonth(value: unknown) {
  return dateFromText(value).match(/^\d{4}-\d{2}/)?.[0] ?? ""
}

function merchantSkuFieldValue(spu: JsonRecord, skus: JsonRecord[], input: {
  dateText?: string
  sourceRows?: JsonRecord[]
  templateOptions?: unknown[]
} = {}) {
  const productCode = stringValue(spu.spu_code)
  const retailPrice = moneyText(spu.price_tag)
  const sourceRows = input.sourceRows ?? []
  const shoeProduct = isShoeProduct(spu, sourceRows)
  const skuDate = productArchiveSkuLaunchMonth(input.dateText)
  const guideTitle = copywritingValue(sourceRows, "导购标题")
  const columns = merchantSkuColumns(input.templateOptions)
  const output: JsonRecord = {
    title: columns.join(","),
  }
  for (const sku of skus) {
    const color = stringValue(sku.color_name)
    const size = shoeProduct
      ? shoeSizeDisplayLabel(sku.size_name ?? sku.size_code)
      : deepdrawSizeValue(sku.size_name ?? sku.size_code)
    if (!color || !size) continue
    const price = moneyText(sku.price_tag) || retailPrice
    const sellerCode = stringValue(sku.inner_code) || stringValue(sku.ean_code) || stringValue(sku.sku_code)
    const barcode = stringValue(sku.ean_code)
    const skuCode = stringValue(sku.sku_code) || sellerCode
    const skcCode = stringValue(sku.skc_code) || productCode
    const valuesByColumn: Record<string, string> = {
      价格: price,
      货号: productCode,
      上市时间: skuDate,
      数量: "0",
      商家编码: sellerCode,
      条形码: shoeProduct || isApparelProduct(spu, sourceRows) ? "" : barcode,
      零售价: retailPrice || price,
      供货价: price,
      唯品会货号: skcCode,
      唯品会条形码: barcode,
      京东价: retailPrice || price,
      划线价: retailPrice || price,
      拼多多单买价: productArchiveOffsetPriceText(retailPrice || price, -1),
      拼多多团购价: productArchiveOffsetPriceText(retailPrice || price, -2),
      天猫特卖折扣价: retailPrice || price,
      天猫特卖专柜价: retailPrice || price,
      单品货号: barcode,
      小红书商家编码: shoeProduct ? skcCode : skuCode,
      天猫SKU搜索标题: guideTitle,
    }
    if (shoeProduct || isApparelProduct(spu, sourceRows)) {
      for (const column of PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS) {
        if (!(column in valuesByColumn)) valuesByColumn[column] = retailPrice || price
      }
    }
    const colorBucket = recordValue(output[color])
    colorBucket[size] = columns.map((column) => valuesByColumn[column] ?? "").join(",")
    output[color] = colorBucket
  }
  return output
}

function isProductArchiveStructuredSizeFieldName(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "多平台尺码" || key.includes("尺码表")
}

function isProductArchiveMultiPlatformSizeFieldName(fieldName: unknown) {
  return compactFieldKey(fieldName) === "多平台尺码"
}

function isProductArchiveSkuSizeTemplateFieldName(fieldName: unknown) {
  const text = stringValue(fieldName)
  return /尺码|尺寸|规格|size/i.test(text) && !isProductArchiveStructuredSizeFieldName(text)
}

function isProductArchiveSkuSizeFieldName(fieldName: unknown) {
  if (/^尺码\s*[.。]$/.test(stringValue(fieldName))) return false
  const key = compactFieldKey(fieldName)
  return key === "尺码" || key === "尺寸" || key === "规格" || key === "size"
}

function isProductArchiveSizeSegmentFieldName(fieldName: unknown) {
  return /^尺码\s*[.。]$/.test(stringValue(fieldName))
}

function isProductArchiveMerchantSkuFieldName(fieldName: unknown) {
  return compactFieldKey(fieldName) === "商家sku"
}

function productArchiveSaleSizeValues(value: unknown) {
  return stringValue(value).split(/[;；]/).map((item) => item.trim()).filter(Boolean)
}

function productArchiveSaleSizeLookup(saleSizeValueText: unknown) {
  const lookup = new Map<string, string>()
  for (const saleSize of productArchiveSaleSizeValues(saleSizeValueText)) {
    for (const key of sizeMatchKeys(saleSize)) {
      if (!lookup.has(key)) lookup.set(key, saleSize)
    }
  }
  return lookup
}

function productArchiveSizeValueAlignedToSaleSize(value: unknown, saleSizeLookup: Map<string, string>) {
  if (saleSizeLookup.size === 0) return stringValue(value)
  for (const key of sizeMatchKeys(value)) {
    const matched = saleSizeLookup.get(key)
    if (matched) return matched
  }
  return stringValue(value)
}

function shouldAlignProductArchiveStructuredSizeKey(value: unknown) {
  const text = stringValue(value)
  if (!text || text === "title") return false
  return !SIZE_CHART_METADATA_KEYS.has(compactFieldKey(text))
}

function shouldPreserveProductArchiveDisplaySizeKey(
  fieldName: unknown,
  value: unknown,
  saleSizeLookup: Map<string, string>,
) {
  const fieldKey = compactFieldKey(fieldName)
  if (fieldKey !== compactFieldKey("多平台尺码") && !fieldKey.includes("尺码表")) return false
  const text = stringValue(value)
  if (!/(?:cm|厘米|公分|码)\s*$/i.test(text)) return false
  return sizeMatchKeys(text).some((key) => saleSizeLookup.has(key))
}

function alignProductArchiveFlatSizeRows(
  fieldName: unknown,
  value: unknown,
  saleSizeLookup: Map<string, string>,
) {
  const record = recordValue(value)
  if (!hasValue(record) || saleSizeLookup.size === 0) return value
  const output: JsonRecord = {}
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = shouldAlignProductArchiveStructuredSizeKey(rawKey)
      ? shouldPreserveProductArchiveDisplaySizeKey(fieldName, rawKey, saleSizeLookup)
        ? rawKey
        : productArchiveSizeValueAlignedToSaleSize(rawKey, saleSizeLookup)
      : rawKey
    output[key] = rawValue
  }
  return output
}

function alignProductArchiveMerchantSkuSizeRows(value: unknown, saleSizeLookup: Map<string, string>) {
  const record = recordValue(value)
  if (!hasValue(record) || saleSizeLookup.size === 0) return value
  const output: JsonRecord = {}
  for (const [color, sizeRows] of Object.entries(record)) {
    if (color === "title" || !sizeRows || typeof sizeRows !== "object" || Array.isArray(sizeRows)) {
      output[color] = sizeRows
      continue
    }
    const alignedRows: JsonRecord = {}
    for (const [rawSize, rowValue] of Object.entries(recordValue(sizeRows))) {
      alignedRows[productArchiveSizeValueAlignedToSaleSize(rawSize, saleSizeLookup)] = rowValue
    }
    output[color] = alignedRows
  }
  return output
}

export function alignProductArchivePayloadSizeFieldValue(fieldName: unknown, value: unknown, saleSizeValueText: unknown) {
  const saleSizeLookup = productArchiveSaleSizeLookup(saleSizeValueText)
  if (saleSizeLookup.size === 0) return value
  if (isProductArchiveMerchantSkuFieldName(fieldName)) {
    return alignProductArchiveMerchantSkuSizeRows(value, saleSizeLookup)
  }
  if (isProductArchiveStructuredSizeFieldName(fieldName)) {
    return alignProductArchiveFlatSizeRows(fieldName, value, saleSizeLookup)
  }
  return value
}

function baseColorName(value: unknown) {
  const text = stringValue(value)
  if (/卡其|贝壳卡|沙卡|卡色/.test(text)) return "卡其"
  if (text.includes("粉")) return "粉红"
  const colors = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "灰色", "棕色", "橙色"]
  for (const color of colors) {
    if (text.includes(color.slice(0, 1))) return color
  }
  return text
}

function isProductArchiveSkuSizeTemplateOptionValue(value: unknown) {
  const text = stringValue(value)
  if (!text) return false
  if (/^(?:均码|one\s*size)$/i.test(text)) return true
  if (/^(?:\d+xl|\d+xs|x{1,4}l|x{1,4}s|[sml])$/i.test(text)) return true
  if (/^0*\d{1,3}\s*(?:cm|厘米|码)?$/i.test(text)) return true
  return false
}

function productArchiveSkuSizeTemplateOptionTexts(options: unknown[]) {
  return optionValues(options).filter(isProductArchiveSkuSizeTemplateOptionValue)
}

function colorFamily(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  if (/黑/.test(text)) return "black"
  if (/白|米白|乳白|象牙/.test(text)) return "white"
  if (/灰|银/.test(text)) return "gray"
  if (/粉|玫|桃|藕|樱/.test(text)) return "pink"
  if (/红/.test(text)) return "red"
  if (/橙|桔/.test(text)) return "orange"
  if (/黄|金/.test(text)) return "yellow"
  if (/绿|青|橄榄/.test(text)) return "green"
  if (/蓝/.test(text)) return "blue"
  if (/紫/.test(text)) return "purple"
  if (/棕|褐|咖|卡其|沙卡|驼|杏|米|裸/.test(text)) return "neutral"
  return ""
}

function nearestProductArchiveColorOption(value: unknown, options: unknown[]) {
  const family = colorFamily(value)
  if (family) {
    const sameFamily = pickOption(options, [(option) => colorFamily(option) === family])
    if (sameFamily) return sameFamily
  }
  return pickOption(options, [(option) => /^(?:扩展选项\d*|其他(?:颜色|色)?|其他)$/.test(option)])
}

function deepdrawColorValue(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  const base = baseColorName(text)
  return base && base !== text ? `${base},${text}` : text
}

function deepdrawSizeValue(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  if (/cm$/i.test(text)) return text
  const match = text.match(/^0*(\d{2,3})$/)
  return match ? `${Number(match[1])}cm` : text
}

function shoeSizeDisplayLabel(value: unknown) {
  const size = normalizeShoeSkuSize(value)
  return size ? `${size}码` : ""
}

function sourceAliases(sourceField: string) {
  const field = stringValue(sourceField)
  const aliases: Record<string, string[]> = {
    款号: ["款号", "大货款号", "货号", "商品品种编号"],
    吊牌价格: ["吊牌价格", "吊牌价", "核算吊牌价", "挂牌单价"],
    吊牌价: ["吊牌价", "吊牌价格", "核算吊牌价", "挂牌单价"],
    颜色: ["颜色", "颜色名称"],
    尺码段: ["尺码段", "尺码范围", "尺码区间", "尺码"],
    上市时间: ["上市时间", "内容上市时间", "搜索上市时间"],
    首批sap到货时间: ["首批sap到货时间", "首批 SAP 到货时间", "首批SAP到货时间"],
    产品季类: ["产品季类", "MDM产品季类", "产品季", "季类"],
    产品季: ["产品季", "产品季类", "MDM产品季类", "季类"],
    对应日期: ["内容上市时间", "搜索上市时间", "上市时间"],
    主款式: ["主款式", "主款式 （唯品四级品类）", "主款式（唯品四级品类）"],
    "主款式 （唯品四级品类）": ["主款式 （唯品四级品类）", "主款式（唯品四级品类）", "主款式"],
    搜索标题: ["搜索标题", "商品标题", "标题", "内容平台标题", "内容标题", "天猫标题"],
    内容平台标题: ["内容平台标题", "内容标题"],
    内容标题: ["内容标题", "内容平台标题"],
    唯品标题: ["唯品标题", "唯品会标题"],
    唯品会标题: ["唯品会标题", "唯品标题"],
    细节文案: [
      "细节文案",
      "细节文案（不限定8个字，细节数量3-4个）",
      "细节文案（不限定8个字，细节数量3-4个，字数尽量不超过12字）",
    ],
    "设计师说——主图4": ["设计师说——主图4", "主图4"],
    主图4: ["主图4", "设计师说——主图4"],
    材质成分: ["材质成分", "面料成分"],
    面料成分: ["面料成分", "材质成分"],
    大身面料: ["大身面料", "帮面材料", "帮面材质", "面料成分"],
    帮面材料: ["帮面材料", "帮面材质", "大身面料", "面料成分"],
    帮面材质: ["帮面材质", "帮面材料", "大身面料", "面料成分"],
    内里材质: ["内里材质", "里料材质", "里料", "衬里"],
    里料材质: ["里料材质", "内里材质", "里料", "衬里", "鞋垫材质"],
    鞋底材质: ["鞋底材质", "大底材质", "鞋品大底材质/用品材质", "鞋品大底材质", "用品材质"],
    鞋垫材质: ["鞋垫材质", "鞋垫材料", "鞋垫面料", "鞋垫"],
    名称: ["名称", "商品名称", "品类"],
    商品名称: ["商品名称", "名称", "品类"],
    品类: ["品类", "名称", "商品名称"],
    产品类别: ["产品类别", "商品类别", "品类", "类目", "分类", "主款式", "主款式 （唯品四级品类）", "主款式（唯品四级品类）"],
    商品类别: ["商品类别", "产品类别", "品类", "类目", "分类", "主款式", "主款式 （唯品四级品类）", "主款式（唯品四级品类）"],
    年龄段: ["年龄段", "适用年龄", "人群"],
    性别: ["性别", "适用性别"],
    版型: ["版型", "服装版型"],
    服装版型: ["服装版型", "版型"],
    填充物: ["填充物", "填充物种类"],
    填充物种类: ["填充物种类", "填充物"],
    文案表: ["搜索标题", "唯品标题", "内容平台标题", "内容标题", "导购标题"],
    鞋品生产企业名称: ["鞋品生产企业名称", "鞋品企业名称", "生产企业名称", "生产企业", "生产厂家", "厂家", "工厂", "制造商"],
    生产企业名称: ["生产企业名称", "鞋品生产企业名称", "鞋品企业名称", "生产企业", "生产厂家", "厂家", "工厂", "制造商"],
    属性: ["属性", "属性-销", "商品属性"],
    执行标准: ["执行标准", "鞋盒执行标准", "鞋盒标签执行标准"],
  }
  return uniqueTextValues([field, ...(aliases[field] ?? [])])
}

function launchValue(sourceRows: JsonRecord[], sourceField: string) {
  return sourceFieldValueAny(sourceRows, "launch_plan", sourceAliases(sourceField))
}

function copywritingValue(sourceRows: JsonRecord[], sourceField: string) {
  return sourceFieldValueAny(sourceRows, "copywriting", sourceAliases(sourceField))
}

function businessRuleFieldKey(value: unknown) {
  return compactFieldKey(value).replace(/[._\-\u2010-\u2015－]/g, "")
}

export type ProductArchiveAiFieldPriority = "P0" | "P1" | "P2"

type ProductArchiveAiFieldStrategyDefinition = {
  id: string
  priority: ProductArchiveAiFieldPriority
  label: string
  fieldNames: string[]
  fieldKeyPatterns?: RegExp[]
  evidence: string[]
  decision: string
  guardrail: string
  includeWhenSourceSkipped?: boolean
}

export type ProductArchiveAiFieldStrategy = {
  id: string
  priority: ProductArchiveAiFieldPriority
  label: string
  evidence: string[]
  decision: string
  guardrail: string
  includeWhenSourceSkipped: boolean
}

const PRODUCT_ARCHIVE_AI_FIELD_STRATEGIES: ProductArchiveAiFieldStrategyDefinition[] = [
  {
    id: "p0_visual_style",
    priority: "P0",
    label: "款式结构与可见细节",
    fieldNames: [
      "款式",
      "款式(多选)",
      "款式(单选)",
      "类型",
      "分类",
      "产品类别",
      "商品类别",
      "图案",
      "图案(多选)",
      "流行元素",
      "流行元素(多选)",
      "袖长",
      "袖长(多选)",
      "袖长多选",
      "衣长",
      "领型",
      "衣门襟",
      "衣门襟(多选)",
      "裤门襟",
      "裤门襟(多选)",
      "裤长",
      "腰型",
      "版型",
      "服装版型",
      "是否带帽",
      "是否有腰带",
      "是否有毛领",
      "是否多件套",
      "穿着方式",
      "件数(单选)",
      "内胆类型",
      "22Q4-童鞋尺码表",
      "25鞋子尺码表",
      "25鞋子模板类型",
      "靴筒高度",
    ],
    fieldKeyPatterns: [
      /^(?:模板)?版型$/,
      /^是否(?:带帽|有腰带|有毛领|多件套)$/,
      /^穿着方式$/,
      /^(?:衣|裤)门襟(?:多选)?$/,
      /^流行元素(?:多选)?$/,
      /^图案(?:多选)?$/,
      /^袖长(?:多选)?$/,
      /^款式(?:多选|单选)?$/,
      /^(?:产品|商品)类别$/,
      /^内胆类型$/,
      /^22q4童鞋尺码表$/,
      /^25鞋子尺码表$/,
      /^25鞋子模板类型$/,
      /^靴筒高度$/,
    ],
    evidence: ["reference_images", "product_title", "trade_path", "source_rows", "filled_fields"],
    decision: "优先根据商品图判断款式、结构、图案、门襟、领型、帽子、腰带、毛领、套件数量和鞋品细分类；标题和类目只作为辅助。",
    guardrail: "图片看不清、只有字段名、或无法从标题/类目交叉验证时不要填写；非鞋品不要填写鞋品枚举。",
    includeWhenSourceSkipped: true,
  },
  {
    id: "p1_age_fit_context",
    priority: "P1",
    label: "年龄人群与季节风格",
    fieldNames: [
      "适用年龄",
      "适用年龄(多选)",
      "适用年龄文本",
      "适用年龄段",
      "适用年龄段(多选)",
      "淘宝天猫适用年龄",
      "适合年龄段",
      "适合年龄段(多选)",
      "适用人群",
      "适用人群(多选)",
      "适用季节",
      "适用季节(多选)",
      "适用性别",
      "适用性别(多选)",
      "性别",
      "性别(多选)",
      "风格",
      "风格(多选)",
    ],
    fieldKeyPatterns: [
      /^(?:淘宝天猫)?适用年龄(?:段)?(?:多选|文本)?$/,
      /^适合年龄段(?:多选)?$/,
      /^适用人群(?:多选)?$/,
      /^适用季节(?:多选)?$/,
      /^适用性别(?:多选)?$/,
      /^性别(?:多选)?$/,
      /^风格(?:多选)?$/,
    ],
    evidence: ["mdm_master", "sku_sizes", "source_rows", "product_title", "reference_images"],
    decision: "年龄优先用 MDM 年龄段和上市计划尺码段推导，季节/性别/风格结合主数据、标题和图片保守选择。",
    guardrail: "年龄字段不要凭图片猜；尺码段或 MDM 证据缺失时只允许标题有明确年龄表达才填写。",
    includeWhenSourceSkipped: true,
  },
  {
    id: "p1_material_evidence",
    priority: "P1",
    label: "材质成分与手感功能",
    fieldNames: [
      "面料",
      "面料(多选)",
      "面料俗称",
      "抖音面料材质",
      "材质",
      "材质(多选)",
      "材质成分",
      "材质成分(多选)",
      "材质成分(文本)",
      "京东材质成分",
      "质地/材质",
      "主面料成分",
      "主面料成分含量",
      "里料成分",
      "里料成分(多选)",
      "里料成分含量",
      "里料成分含量(多选)",
      "成分含量",
      "里料材质",
      "里料材质(多选)",
      "里料材质成分含量(多选)",
      "填充物",
      "填充物(多选)",
      "填充物含量",
      "含绒量(多选)",
      "绒子含量",
      "厚薄",
      "厚度",
      "25厚薄指数",
      "弹力",
      "25弹力指数",
      "柔软度",
      "25柔软指数",
      "中幼童-弹性指数",
      "中幼童-柔软指数",
      "功能",
      "功能(多选)",
      "面料工艺",
      "帮面材质(多选)",
      "材质(1688)",
      "材质功能",
      "鞋垫材质",
    ],
    fieldKeyPatterns: [
      /^(?:抖音)?面料(?:多选|俗称|工艺|材质)?$/,
      /^材质(?:成分)?(?:多选|文本)?$/,
      /^主面料成分(?:含量)?$/,
      /^里料(?:材质)?成分(?:含量)?(?:多选)?$/,
      /^里料材质(?:成分含量)?(?:多选)?$/,
      /^填充物(?:含量|多选)?$/,
      /^含绒量(?:多选)?$/,
      /^绒子含量$/,
      /^(?:25)?厚(?:薄|度)指数?$/,
      /^(?:25|中幼童)?弹(?:力|性)指数?$/,
      /^(?:25|中幼童)?柔软(?:度|指数)$/,
      /^功能(?:多选)?$/,
      /^帮面材质(?:多选)?$/,
      /^材质1688$/,
      /^材质功能$/,
      /^鞋垫材质$/,
    ],
    evidence: ["copywriting_material", "ocr_hangtag", "ocr_washlabel", "source_rows", "filled_fields", "reference_images"],
    decision: "材质/成分必须先看文案、吊牌、洗唛或已填成分；厚薄、弹力、功能可结合文案和图片观感保守选择。",
    guardrail: "没有成分证据时不要凭图片猜材质或含量；图片只能辅助面料观感、厚薄、功能等非合规枚举。",
    includeWhenSourceSkipped: true,
  },
  {
    id: "p2_image_content_tags",
    priority: "P2",
    label: "图片内容与运营标记",
    fieldNames: [
      "详情页AI标注",
      "模特实拍",
    ],
    fieldKeyPatterns: [
      /^详情页ai标注$/,
      /^模特实拍$/,
    ],
    evidence: ["reference_images", "source_rows", "filled_fields"],
    decision: "用于补充图片内容、详情页或运营标记，只在图片包结构和画面内容明确时填写。",
    guardrail: "这类字段优先级低于建档阻断字段；图片证据不足时宁可留空。",
    includeWhenSourceSkipped: true,
  },
]

function strategyMatchesField(strategy: ProductArchiveAiFieldStrategyDefinition, fieldName: unknown) {
  const key = businessRuleFieldKey(fieldName)
  if (!key) return false
  if (strategy.fieldNames.some((name) => businessRuleFieldKey(name) === key)) return true
  return Boolean(strategy.fieldKeyPatterns?.some((pattern) => pattern.test(key)))
}

function serializeAiFieldStrategy(strategy: ProductArchiveAiFieldStrategyDefinition): ProductArchiveAiFieldStrategy {
  return {
    id: strategy.id,
    priority: strategy.priority,
    label: strategy.label,
    evidence: [...strategy.evidence],
    decision: strategy.decision,
    guardrail: strategy.guardrail,
    includeWhenSourceSkipped: Boolean(strategy.includeWhenSourceSkipped),
  }
}

export function productArchiveAiFieldStrategyForField(fieldName: unknown): ProductArchiveAiFieldStrategy | null {
  const strategy = PRODUCT_ARCHIVE_AI_FIELD_STRATEGIES.find((item) => strategyMatchesField(item, fieldName))
  return strategy ? serializeAiFieldStrategy(strategy) : null
}

export function shouldProductArchiveAiFill25ShoeSizeTable(input: {
  tradeId?: unknown
  tradePath?: unknown
}) {
  return resolveShoeSizeChartMatch({
    tradeId: input.tradeId,
    tradePath: input.tradePath,
  }).status === "needs_visual_classification"
}

export function isProductArchiveShoeAiEnumField(fieldName: unknown) {
  return PRODUCT_ARCHIVE_SHOE_AI_ENUM_FIELDS.has(compactFieldKey(fieldName))
}

function isShoeDraftContext(input: {
  draft?: JsonRecord
  spu?: JsonRecord
  sourceRows?: JsonRecord[]
}) {
  return isShoeProduct(input.spu, input.sourceRows ?? [])
    || isShoeProductContext({
      tradeId: input.draft?.trade_id,
      tradePath: input.draft?.trade_path,
      productLineName: input.spu?.product_line_name,
    })
}

export function shouldProductArchiveAiFillShoeEnumField(input: {
  fieldName?: unknown
  tradeId?: unknown
  tradePath?: unknown
  productLineName?: unknown
}) {
  if (!isProductArchiveShoeAiEnumField(input.fieldName)) return false
  if (!isShoeProductContext({
    tradeId: input.tradeId,
    tradePath: input.tradePath,
    productLineName: input.productLineName,
  })) return false
  if (compactFieldKey(input.fieldName) === compactFieldKey("25鞋子尺码表")) {
    return shouldProductArchiveAiFill25ShoeSizeTable(input)
  }
  return true
}

export function isStaleNonSandalAi25ShoeSizeTable(input: {
  fieldName?: unknown
  sourceType?: unknown
  tradeId?: unknown
  tradePath?: unknown
}) {
  return compactFieldKey(input.fieldName) === compactFieldKey("25鞋子尺码表")
    && ["ai", "ai_rule_fallback"].includes(stringValue(input.sourceType))
    && !shouldProductArchiveAiFill25ShoeSizeTable(input)
}

export function listProductArchiveAiFieldStrategies() {
  return PRODUCT_ARCHIVE_AI_FIELD_STRATEGIES.map(serializeAiFieldStrategy)
}

const PRODUCT_ARCHIVE_ALWAYS_BLANK_FIELDS = new Set([
  "商品描述",
  "微信视频小店副标题",
  "快手商品卖点",
])

const PRODUCT_ARCHIVE_SHOE_BLANK_FIELDS = new Set([
  "试穿报告表",
  "balaone仅专供新品",
  "balaone仅专供新品勾选",
  "25柔软指数",
  "25厚薄指数",
  "25弹力指数",
  "25版型指数",
  "25服饰细节文案",
  "25服饰品牌样式",
  "25服装面料文案",
  "羽绒服洗涤说明",
  "详情页ai标注",
  "单色平台ai标",
  "多色平台ai",
  "主图4文案1",
  "主图4文案2",
  "主图4样式",
])

function isProductArchiveShoeBusinessBlankFieldKey(key: string) {
  return PRODUCT_ARCHIVE_SHOE_BLANK_FIELDS.has(key)
    || (!key.includes("京东") && /^(?:商品)?(?:包裹|包装)(?:重量|长度|宽度|高度|长|宽|高)$/.test(key))
    || /^唯品(?:会)?重量$/.test(key)
    || /^唯品(?:会)?(?:商品)?【?包装】?(?:重量|长度|宽度|高度|长|宽|高)$/.test(key)
}

function isProductArchiveShoeBusinessBlankField(fieldName: string) {
  return isProductArchiveShoeBusinessBlankFieldKey(businessRuleFieldKey(fieldName))
}

const PRODUCT_ARCHIVE_COMPATIBLE_PLATFORMS = [
  "1688",
  "天猫",
  "京东",
  "唯品会",
  "有赞",
  "拼多多",
  "小红书",
  "抖音",
  "快手",
  "微信视频小店",
]

const PRODUCT_ARCHIVE_SHOE_CONTEXT_FIELDS = new Set([
  "22q4童鞋卖点",
  "22q4童鞋卖点解析",
  "22q4童鞋品名",
  "22q4-童鞋尺码表",
  "22q4童鞋尺码表",
  "童鞋核心卖点",
  "品名童鞋",
  "尺码童鞋",
  "25鞋子尺码表",
  "25鞋子模板类型",
  "鞋子尺码表",
  "鞋子模板类型",
])

const PRODUCT_ARCHIVE_SHOE_AI_ENUM_FIELDS = new Set([
  "22q4-童鞋尺码表",
  "22q4童鞋尺码表",
  "25鞋子尺码表",
  "25鞋子模板类型",
])

const PRODUCT_ARCHIVE_BRA_CONTEXT_FIELDS = new Set([
  "文胸图标",
])

const PRODUCT_ARCHIVE_CUP_CONTEXT_FIELDS = new Set([
  "水杯说明",
])

const PRODUCT_ARCHIVE_ACCESSORY_CONTEXT_FIELDS = new Set([
  "配饰版默认文案",
])

function sourceRowsCategoryText(sourceRows: JsonRecord[]) {
  const values: unknown[] = []
  for (const row of sourceRows) {
    const rowJson = recordValue(row.row_json)
    values.push(
      rowJson["官方发布类目"],
      rowJson["发布类目"],
      rowJson["发布类目 (官方)"],
      rowJson["发布类目 (唯品)"],
      rowJson["发布类目 (抖音)"],
      rowJson["主款式 （唯品四级品类）"],
      rowJson["产品线"],
      rowJson["产品类别"],
      rowJson["商品类别"],
      rowJson["品类"],
      rowJson["大类"],
      rowJson["中类"],
      rowJson["小类"],
      rowJson["尺码段"],
    )
  }
  return uniqueTextValues(values).join(" ")
}

function productCategoryText(spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  return uniqueTextValues([
    spu.product_line_name,
    spu.product_line,
    spu.category_name,
    spu.category,
    spu.subclass_name,
    spu.spu_name,
    sourceRowsCategoryText(sourceRows),
  ]).join(" ")
}

function productTextIncludesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function isShoeProduct(spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  return productTextIncludesAny(productCategoryText(spu, sourceRows), ["鞋", "靴"])
}

function isApparelProduct(spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  if (isShoeProduct(spu, sourceRows)) return false
  return productTextIncludesAny(productCategoryText(spu, sourceRows), [
    "服装",
    "服饰",
    "童装",
    "羽绒服",
    "外套",
    "上衣",
    "裤",
    "裙",
    "衫",
    "连体衣",
    "内衣",
  ])
}

function isCupProduct(spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  const categoryText = productCategoryText(spu, sourceRows)
  return productTextIncludesAny(categoryText, ["水杯", "杯子"])
    || /(?:^|[>\s/／])杯(?:$|[>\s/／])/.test(categoryText)
}

function isAccessoryProduct(spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  const categoryText = productCategoryText(spu, sourceRows)
  return productTextIncludesAny(categoryText, ["配饰", "饰品", "帽子", "帽类"])
    || /(?:^|[>\s/／])帽(?:$|[>\s/／])/.test(categoryText)
}

function isProductArchivePddPlatform(value: unknown) {
  return /^(?:pdd|拼多多)$/i.test(stringValue(value))
}

export function isProductArchiveBusinessBlankField(
  fieldName: string,
  spu: JsonRecord = {},
  sourceRows: JsonRecord[] = [],
  templatePlatform: unknown = "",
) {
  const key = businessRuleFieldKey(fieldName)
  const shoeProduct = isShoeProduct(spu, sourceRows)
  const apparelProduct = isApparelProduct(spu, sourceRows)
  if ((shoeProduct || apparelProduct) && (key === "拼多多标题" || key === "拼多多短标题")) return true
  if ((shoeProduct || apparelProduct) && key === "商品短标题" && isProductArchivePddPlatform(templatePlatform)) return true
  if (shoeProduct && isProductArchiveShoeBusinessBlankFieldKey(key)) return true
  if (shoeProduct && ["微信视频小店副标题", "快手商品卖点"].includes(key)) return false
  if (PRODUCT_ARCHIVE_ALWAYS_BLANK_FIELDS.has(key)) return true
  const categoryText = productCategoryText(spu, sourceRows)
  if (PRODUCT_ARCHIVE_SHOE_CONTEXT_FIELDS.has(key)) return !isShoeProduct(spu, sourceRows)
  if (PRODUCT_ARCHIVE_BRA_CONTEXT_FIELDS.has(key)) return !productTextIncludesAny(categoryText, ["文胸"])
  if (PRODUCT_ARCHIVE_CUP_CONTEXT_FIELDS.has(key)) return !isCupProduct(spu, sourceRows)
  if (PRODUCT_ARCHIVE_ACCESSORY_CONTEXT_FIELDS.has(key)) return !isAccessoryProduct(spu, sourceRows)
  return false
}

function isProductArchiveDocumentOptionalField(fieldName: string) {
  const key = businessRuleFieldKey(fieldName)
  return isProductArchiveStructuredSizeFieldName(fieldName)
    || PRODUCT_ARCHIVE_ALWAYS_BLANK_FIELDS.has(key)
    || PRODUCT_ARCHIVE_SHOE_CONTEXT_FIELDS.has(key)
    || PRODUCT_ARCHIVE_BRA_CONTEXT_FIELDS.has(key)
    || PRODUCT_ARCHIVE_CUP_CONTEXT_FIELDS.has(key)
    || PRODUCT_ARCHIVE_ACCESSORY_CONTEXT_FIELDS.has(key)
}

export function isProductArchiveFieldLocallyRequired(fieldName: string, input: {
  templateRequired?: unknown
  templatePresent?: unknown
  ruleBlocking?: unknown
  sourceType?: unknown
  shoeProduct?: unknown
  apparelProduct?: unknown
} = {}) {
  const apparelRequiredSizeChart = Boolean(input.apparelProduct)
    && ["尺码表", "唯品会尺码表", "抖音尺码表"].includes(compactFieldKey(fieldName))
  if (Boolean(input.shoeProduct) && isProductArchiveShoeBusinessBlankField(fieldName)) return false
  if (Object.prototype.hasOwnProperty.call(input, "templatePresent")) {
    if (!input.templatePresent) return false
    const persistedStructuredRequirement = isProductArchiveStructuredSizeFieldName(fieldName) && Boolean(input.ruleBlocking)
    return apparelRequiredSizeChart || persistedStructuredRequirement || Boolean(input.templateRequired)
  }
  if (stringValue(input.sourceType) === "skip") return false
  const shoeRequiredSizeChart = Boolean(input.shoeProduct) && compactFieldKey(fieldName) === compactFieldKey("尺码表")
  if (!shoeRequiredSizeChart && !apparelRequiredSizeChart && isProductArchiveDocumentOptionalField(fieldName)) return false
  return Boolean(input.templateRequired) || Boolean(input.ruleBlocking)
}

function aggregateSourceValues(sourceRows: JsonRecord[], sourceType: string, fields: string[]) {
  const values: unknown[] = []
  for (const row of sourceRows) {
    if (stringValue(row.source_type) !== sourceType) continue
    const rowJson = recordValue(row.row_json)
    for (const field of fields) values.push(rowJson[field])
  }
  return uniqueTextValues(values)
}

function dateFromText(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  const compactDate = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compactDate) return `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`
  const parsed = new Date(text)
  if (Number.isFinite(parsed.getTime())) {
    const year = parsed.getUTCFullYear()
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0")
    const day = String(parsed.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
  }
  return text
}

function launchDateValue(sourceRows: JsonRecord[]) {
  for (const sourceField of ["内容上市时间", "搜索上市时间", "上市时间"]) {
    const date = dateFromText(launchValue(sourceRows, sourceField))
    if (dateLooksLikeDeepdrawPayloadDate(date)) return date
  }
  return ""
}

function draftDateFieldValue(fields: JsonRecord[]) {
  for (const fieldName of ["上市时间(文本)", "对应日期", "内容上市时间", "搜索上市时间"]) {
    const field = fields.find((candidate) => stringValue(candidate.field_name) === fieldName)
    const date = dateFromText(field?.value_text)
    if (dateLooksLikeDeepdrawPayloadDate(date)) return date
  }
  return ""
}

export function buildProductArchivePayloadDate(sourceRows: JsonRecord[], fields: JsonRecord[] = []) {
  return draftDateFieldValue(fields) || launchDateValue(sourceRows)
}

function copyTextBlock(sourceRows: JsonRecord[]) {
  return [
    copywritingValue(sourceRows, "FAB") || launchValue(sourceRows, "FAB"),
    copywritingValue(sourceRows, "推荐理由"),
    copywritingValue(sourceRows, "面料文案"),
    copywritingValue(sourceRows, "细节文案"),
  ].filter(Boolean).join("\n")
}

function copyOrLaunchValue(sourceRows: JsonRecord[], sourceField: string) {
  return copywritingValue(sourceRows, sourceField) || launchValue(sourceRows, sourceField)
}

function shoeEvidenceText(sourceRows: JsonRecord[]) {
  return [
    copyOrLaunchValue(sourceRows, "FAB"),
    copyOrLaunchValue(sourceRows, "推荐理由"),
    copyOrLaunchValue(sourceRows, "细节文案"),
    copyOrLaunchValue(sourceRows, "搜索标题"),
    copyOrLaunchValue(sourceRows, "内容平台标题"),
    copyOrLaunchValue(sourceRows, "导购标题"),
    copyOrLaunchValue(sourceRows, "品类"),
    copyOrLaunchValue(sourceRows, "名称"),
  ].filter(Boolean).join("\n")
}

function sourceAttributeText(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "属性")
}

function shoeSameMallStyleValue(sourceRows: JsonRecord[]) {
  const attribute = sourceAttributeText(sourceRows)
  if (/全域/.test(attribute)) return "是"
  if (/专供|温州/.test(attribute)) return "否"
  return ""
}

function shoeSurfaceMaterialText(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "帮面材料")
    || copyOrLaunchValue(sourceRows, "帮面材质")
    || copyOrLaunchValue(sourceRows, "大身面料")
    || copyOrLaunchValue(sourceRows, "面料成分").replace(/^帮面材料\s*[:：]\s*/, "")
}

function shoeLiningMaterialText(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "内里材质") || copyOrLaunchValue(sourceRows, "里料材质")
}

function shoeSoleMaterialText(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "鞋底材质")
}

function shoeInsoleMaterialText(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "鞋垫材质")
    || sectionTextFromMaterialSource(sourceRows, ["鞋垫材质", "鞋垫材料", "鞋垫面料", "鞋垫"])
}

function stripGenericMaterialPrefix(value: unknown) {
  return stringValue(value).replace(/^面料成分\s*[:：]\s*/, "").trim()
}

function labeledMaterialLine(label: string, value: unknown) {
  const text = stripGenericMaterialPrefix(value)
  if (!text) return ""
  if (/^[^:：\n]{1,16}\s*[:：]/.test(text)) return text
  return `${label}：${text}`
}

function shoeDetailSurfaceMaterialText(sourceRows: JsonRecord[]) {
  const composition = stripGenericMaterialPrefix(copyOrLaunchValue(sourceRows, "面料成分"))
  if (composition && /^[^:：\n]{1,16}\s*[:：]/.test(composition)) return composition
  return labeledMaterialLine("帮面材料", shoeSurfaceMaterialText(sourceRows) || composition)
}

function shoeDetailMaterialText(sourceRows: JsonRecord[]) {
  return [
    shoeDetailSurfaceMaterialText(sourceRows),
    labeledMaterialLine("里料材质", shoeLiningMaterialText(sourceRows)),
    labeledMaterialLine("鞋底材质", shoeSoleMaterialText(sourceRows)),
  ].filter(Boolean).join("\n")
}

function shoeProductNameValue(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "名称")
    || copyOrLaunchValue(sourceRows, "商品名称")
    || copyOrLaunchValue(sourceRows, "品类")
}

function addProductArchiveCategoryEvidenceValue(values: unknown[], value: unknown) {
  const text = stringValue(value)
  if (!isMeaningfulLaunchPlanValue(text)) return
  values.push(text)
  const officialLeaf = officialCategoryLeaf(text)
  if (officialLeaf && officialLeaf !== text) values.push(officialLeaf)
  const deepdrawLeaf = tradeLeaf(text)
  if (deepdrawLeaf && deepdrawLeaf !== text && deepdrawLeaf !== officialLeaf) values.push(deepdrawLeaf)
}

function productArchiveCategoryEvidenceCandidates(input: {
  draft?: JsonRecord
  spu?: JsonRecord
  sourceRows?: JsonRecord[]
}) {
  const values: unknown[] = []
  const sourceRows = input.sourceRows ?? []
  addProductArchiveCategoryEvidenceValue(values, input.draft?.trade_path)
  for (const value of latestNonEmptyLaunchPlanValues(sourceRows, [
    "官方发布类目",
    "发布类目",
    "发布类目 (官方)",
    "发布类目(官方)",
    "发布类目（官方）",
    "发布类目 (唯品)",
    "发布类目(唯品)",
    "发布类目（唯品）",
    "发布类目 (抖音)",
    "发布类目(抖音)",
    "发布类目（抖音）",
  ])) {
    addProductArchiveCategoryEvidenceValue(values, value)
  }
  for (const value of [
    copyOrLaunchValue(sourceRows, "产品类别"),
    copyOrLaunchValue(sourceRows, "商品类别"),
    copyOrLaunchValue(sourceRows, "品类"),
    copyOrLaunchValue(sourceRows, "主款式"),
    copyOrLaunchValue(sourceRows, "名称"),
    input.spu?.subclass_name,
    input.spu?.category_name,
    input.spu?.spu_name,
  ]) {
    addProductArchiveCategoryEvidenceValue(values, value)
  }
  return uniqueTextValues(values)
}

function shoeSellingPointValue(sourceRows: JsonRecord[]) {
  return copyOrLaunchValue(sourceRows, "推荐理由") || copyOrLaunchValue(sourceRows, "FAB")
}

function truncateCompleteWords(value: unknown, maxLength: number) {
  const text = stringValue(value)
  if (!text || text.length <= maxLength) return text
  const segments = Array.from(new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(text))
  let output = ""
  for (const { segment } of segments) {
    if (`${output}${segment}`.length > maxLength) break
    output += segment
  }
  return output.replace(/[\s,，、。；;：:|/]+$/g, "").trim()
}

function firstClause(value: unknown, maxLength = 10) {
  const clause = stringValue(value).split(/[，,。；;\n]/).map((part) => part.trim()).find(Boolean) ?? ""
  return truncateCompleteWords(clause, maxLength)
}

function detailCopyLinesValue(sourceRows: JsonRecord[]) {
  const text = copywritingValue(sourceRows, "细节文案")
    || copywritingValue(sourceRows, "细节文案（不限定8个字，细节数量3-4个）")
  return text
    .split(/\s*(?:\d+[.、]|[;；*]|\r?\n)\s*/g)
    .map((part) => part.trim().replace(/[：:]/g, "-"))
    .filter(Boolean)
    .join("*")
}

function apparelFabricCopyValue(sourceRows: JsonRecord[]) {
  const name = copywritingValue(sourceRows, "面料名称")
  const copy = copywritingValue(sourceRows, "面料文案")
  const keywords = copywritingValue(sourceRows, "面料三个关键词")
    .split(/[\s,，、;；]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .join("-")
  return [`${name}${name && copy ? "-" : ""}${copy}`, keywords].filter(Boolean).join("*")
}

function fullMaterialCompositionText(sourceRows: JsonRecord[], maxLength = 200) {
  const source = normalizeMaterialSourceSections(materialCompositionSourceText(sourceRows))
  if (!source) return ""
  const lines = source
    .split(/\n|[;；]/)
    .map((part) => part.trim())
    .filter((part, index) => part && !(index === 0 && /^成分[:：]?$/.test(part)))
  const groups: string[][] = []
  for (const line of lines) {
    if (/^[^：:]+[：:]/.test(line) || groups.length === 0) groups.push([line])
    else groups.at(-1)?.push(line)
  }
  while (groups.length > 1 && groups.flat().join("\n").length > maxLength) groups.pop()
  const joined = groups.flat().join("\n")
  if (joined.length <= maxLength) return joined

  // Once only one complete garment group remains, a source export may still
  // flatten many materials onto one line. Remove whole trailing material items;
  // never retain a label with only part of its garment group or slice a name.
  const match = joined.match(/^([^：:]+[：:])(.*)$/)
  const prefix = match?.[1] ?? ""
  const body = match?.[2] ?? joined
  const items = body.split(/\s*[,，、/]\s*/).map((item) => item.trim()).filter(Boolean)
  while (items.length > 0 && `${prefix}${items.join("、")}`.length > maxLength) items.pop()
  return items.length > 0 ? `${prefix}${items.join("、")}` : ""
}

function tmallRecommendationReasonValue(sourceRows: JsonRecord[], maxLength = 15) {
  return firstClause(copywritingValue(sourceRows, "推荐理由"), maxLength)
}

function platformContentTitleValue(sourceRows: JsonRecord[]) {
  return copywritingValue(sourceRows, "内容标题")
    || copywritingValue(sourceRows, "内容平台标题")
    || copywritingValue(sourceRows, "搜索标题")
}

function kuaishouTitleValue(spu: JsonRecord, sourceRows: JsonRecord[], shoeProduct: boolean) {
  const title = shoeProduct ? platformContentTitleValue(sourceRows) : copywritingTitleValue(spu, sourceRows)
  const productCode = stringValue(spu.spu_code) || launchValue(sourceRows, "款号")
  if (shoeProduct || !productCode || title.includes(productCode)) return title.slice(0, 60)
  const suffix = ` ${productCode}`
  const maxTitleLength = Math.max(0, 60 - suffix.length)
  const withoutLeadingAdjectives = title.replace(/^(?:(?:百搭|舒适|时尚|潮流|休闲|简约)[，、,\s]*)+/, "") || title
  return `${withoutLeadingAdjectives.slice(0, maxTitleLength)}${suffix}`
}

function productArchiveDisplayTitleValue(spu: JsonRecord, sourceRows: JsonRecord[], includeAge = true) {
  const genderValues = uniqueTextValues([
    ...sourceFieldValuesAny(sourceRows, "copywriting", sourceAliases("性别")),
    ...sourceFieldValuesAny(sourceRows, "launch_plan", sourceAliases("性别")),
  ])
  const hasMale = genderValues.some((value) => /男/.test(value))
  const hasFemale = genderValues.some((value) => /女/.test(value))
  const rawGender = hasMale && hasFemale
    ? "男 and 女"
    : genderValues[0] || stringValue(spu.gender_name)
  const gender = /^(?:中|中性|男女通用)$/.test(rawGender) ? "男女" : rawGender
  return uniqueTextValues([
    stringValue(spu.brand_name) || "巴拉巴拉",
    gender,
    includeAge ? copyOrLaunchValue(sourceRows, "年龄段") : "",
    copyOrLaunchValue(sourceRows, "品类") || stringValue(spu.subclass_name),
  ]).join("")
}

function productArchiveSeasonText(value: unknown, fallbackYear: unknown = "") {
  const text = stringValue(value)
  if (!text) return ""
  const dateText = dateFromText(text)
  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-\d{2}/)
  if (dateMatch) return `${dateMatch[1]}年${seasonFromMonth(Number(dateMatch[2]))}季`
  const year = text.match(/(20\d{2})/)?.[1] ?? stringValue(fallbackYear).match(/(20\d{2})/)?.[1] ?? ""
  const quarter = text.match(/(?:^|\b)Q([1-4])(?:\b|$)/i)?.[1] ?? ""
  const compactSeasonCode = text.match(/^([1-4])(\d{2})$/)
  const seasonCode = quarter || compactSeasonCode?.[1] || ""
  const seasonYear = year || (compactSeasonCode ? `20${compactSeasonCode[2]}` : "")
  const quarterSeason = ({ "1": "春", "2": "夏", "3": "秋", "4": "冬" } as Record<string, string>)[seasonCode] ?? ""
  if (quarterSeason) return seasonYear ? `${seasonYear}年${quarterSeason}季` : `${quarterSeason}季`
  const season = text.match(/[春夏秋冬]/)?.[0] ?? ""
  if (year && season) return `${year}年${season}季`
  if (season) return `${season}季`
  return text
}

function shoeSeasonValue(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return productArchiveSeasonText(copyOrLaunchValue(sourceRows, "产品季类"), spu.year)
    || productArchiveSeasonText(copyOrLaunchValue(sourceRows, "产品季"), spu.year)
    || productArchiveSeasonText(spu.season_name, spu.year)
    || productArchiveSeasonText(launchDateValue(sourceRows))
}

function shoeUsageOccasionValue() {
  return "日常;校园;公路"
}

function shoeUsageSceneValue() {
  return "休闲"
}

function shoeFunctionValue(sourceRows: JsonRecord[]) {
  const text = shoeEvidenceText(sourceRows)
  return uniqueTextValues([
    /防滑/.test(text) ? "防滑" : "",
    /耐磨/.test(text) ? "耐磨" : "",
    /透气/.test(text) ? "透气" : "",
    /防泼水|防水|防渗水/.test(text) ? "防泼水" : "",
    /保温|保暖|抗寒/.test(text) ? "保暖" : "",
  ]).join(";")
}

function shoeClosureValue(sourceRows: JsonRecord[]) {
  const text = shoeEvidenceText(sourceRows)
  if (/旋钮|随芯|旋扣/.test(text)) return "旋钮扣"
  if (/魔术贴|粘扣|搭带|一拉一贴/.test(text)) return "魔术贴"
  if (/松紧带|套脚/.test(text)) return "松紧带"
  if (/系带|鞋带/.test(text)) return "系带"
  return ""
}

function shoeUpperHeightValue(sourceRows: JsonRecord[]) {
  const text = shoeEvidenceText(sourceRows)
  if (/高帮/.test(text)) return "高帮"
  if (/中帮/.test(text)) return "中帮"
  if (/低帮|浅口/.test(text)) return "低帮"
  return ""
}

function shoeStyleValue(sourceRows: JsonRecord[]) {
  const text = shoeEvidenceText(sourceRows)
  if (/户外|运动|跑鞋|篮球|足球/.test(text)) return "运动"
  if (/休闲|板鞋|学步|帆布/.test(text)) return "休闲"
  return ""
}

function shoePopularElementValue(sourceRows: JsonRecord[]) {
  const text = shoeEvidenceText(sourceRows)
  const values = [
    /反光|3m/i.test(text) ? "反光" : "",
    /魔术贴|粘扣|搭带/.test(text) ? "魔术贴" : "",
    /旋钮|随芯/.test(text) ? "旋钮扣" : "",
    /蝴蝶结/.test(text) ? "蝴蝶结" : "",
    /星星/.test(text) ? "星星" : "",
    /字母/.test(text) ? "字母" : "",
  ]
  return uniqueTextValues(values).join(";")
}

function stripBalabalaBrand(value: string) {
  return value.replace(/【?balaOne】?/gi, "").replace(/巴拉巴拉/g, "").replace(/\s+/g, "").trim()
}

function firstLines(value: unknown) {
  return stringValue(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function materialPercentText(sourceRows: JsonRecord[]) {
  const component = primaryMaterialComponents(sourceRows)[0]
  return component ? `${component.percent}%` : ""
}

type MaterialComponent = {
  name: string
  percent: string
}

const MATERIAL_SECTION_LABEL = [
  "主面料复合面布",
  "主面料",
  "大身面料",
  "复合面布",
  "复合底布",
  "梭织面料",
  "针织面料",
  "帽里料",
  "填充物",
  "填充料",
  "里料",
  "衬里",
  "花边",
  "配料",
  "辅料",
  "罗纹",
  "帽里",
  "胆料",
  "内胆",
  "装饰物",
  "鞋面",
  "鞋底",
  "面料",
].join("|")

const SECONDARY_MATERIAL_SECTION = "复合底布|梭织面料|针织面料|帽里料|里料|衬里|花边|填充物|填充料|配料|辅料|罗纹|帽里|胆料|内胆|装饰物|鞋面|鞋底"

function normalizeMaterialSourceSections(value: unknown) {
  return stringValue(value)
    .replace(/\u00a0/g, " ")
    .replace(/％/g, "%")
    .replace(/\r/g, "")
    .replace(/^\s*成分\s*[:：]?\s*/i, "")
    .replace(new RegExp(`\\s*(${MATERIAL_SECTION_LABEL})\\s*[:：]\\s*`, "g"), "\n$1：")
    .replace(/^\n/, "")
}

function formatMaterialPercent(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return stringValue(value)
  return String(Number(number.toFixed(4)))
}

function normalizeMaterialName(value: unknown) {
  const text = stringValue(value)
    .replace(/^[,，;；:：\s]+|[,，;；:：\s]+$/g, "")
    .replace(/[（(][^）)]*(?:除外|不含)[）)]/g, "")
    .replace(/(?:薄膜|配料|辅料|装饰物|罗纹)?\s*(?:除外|不含).*$/g, "")
    .trim()
  if (/^(?:纯棉|全棉)$/.test(text)) return "棉"
  if (/^(?:涤纶|涤纶[（(]聚酯纤维[）)]|聚酯纤维[（(]涤纶[）)])$/.test(text)) return "聚酯纤维"
  if (/^(?:锦纶|尼龙|聚酰胺纤维|锦纶[（(]聚酰胺纤维[）)]|聚酰胺纤维[（(]锦纶[）)])$/.test(text)) return "聚酰胺纤维"
  if (/^(?:粘纤|黏纤|粘胶|黏胶|粘胶纤维|黏胶纤维|粘胶纤维[（(]粘纤[）)]|黏胶纤维[（(]黏纤[）)])$/.test(text)) return "粘胶纤维"
  return text
}

function primaryMaterialRawSection(value: unknown) {
  const text = normalizeMaterialSourceSections(value)
  if (!text) return ""
  const primaryLabel = /(?:^|\n)(?:主面料复合面布|主面料|大身面料|复合面布|面料)\s*[:：]\s*/g
  const labelMatch = primaryLabel.exec(text)
  const afterLabel = labelMatch ? text.slice(labelMatch.index + labelMatch[0].length) : text
  const secondaryLabel = new RegExp(`(?:^|\\n)(?:${SECONDARY_MATERIAL_SECTION})\\s*[:：]`)
  const secondaryIndex = afterLabel.search(secondaryLabel)
  return (secondaryIndex >= 0 ? afterLabel.slice(0, secondaryIndex) : afterLabel).trim()
}

function primaryMaterialSection(value: unknown) {
  return primaryMaterialRawSection(value)
    .split("\n")
    .map((line) => line.replace(/[（(][^）)]*(?:除外|不含)[）)]/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .trim()
}

function primaryMaterialExclusionText(value: unknown) {
  return Array.from(primaryMaterialRawSection(value).matchAll(/[（(][^）)]*(?:除外|不含)[）)]/g))
    .map((match) => match[0])
    .join("")
}

function parseMaterialComponents(section: string): MaterialComponent[] {
  if (!section) return []
  const components: MaterialComponent[] = []
  const addComponent = (rawName: unknown, rawPercent: unknown) => {
    const name = normalizeMaterialName(rawName)
    const percent = formatMaterialPercent(rawPercent)
    if (!name || !percent) return
    const existing = components.find((component) => component.name === name)
    if (existing) {
      existing.percent = formatMaterialPercent(Number(existing.percent) + Number(percent))
    } else {
      components.push({ name, percent })
    }
  }
  const percentFirst = /(\d+(?:\.\d+)?)\s*%\s*([^\d%]+?)(?=(?:\s*[,，;；]?\s*\d+(?:\.\d+)?\s*%)|$)/g
  for (const match of section.matchAll(percentFirst)) addComponent(match[2], match[1])
  if (components.length > 0) return components
  const nameFirst = /([^\d%]+?)\s*(\d+(?:\.\d+)?)\s*%(?=\s*[,，;；]|\s*$)/g
  for (const match of section.matchAll(nameFirst)) addComponent(match[1], match[2])
  return components
}

function materialComponentsFromText(value: unknown): MaterialComponent[] {
  return parseMaterialComponents(primaryMaterialSection(value))
}

function allMaterialNamesFromText(value: unknown) {
  const names: string[] = []
  for (const section of normalizeMaterialSourceSections(value).split(/\n+/)) {
    const body = section.replace(/^[^：:\n]+[：:]\s*/, "")
    for (const component of parseMaterialComponents(body)) names.push(component.name)
  }
  return uniqueTextValues(names)
}

function materialCompositionSourceText(sourceRows: JsonRecord[]) {
  return copywritingValue(sourceRows, "面料成分")
    || copywritingValue(sourceRows, "材质成分")
}

function apparelDetailMaterialText(sourceRows: JsonRecord[]) {
  const sourceText = materialCompositionSourceText(sourceRows)
    .replace(/\u00a0/g, " ")
    .replace(/％/g, "%")
    .replace(/\r/g, "")
    .replace(/^\s*(?:成分|材质成分|面料成分)\s*[:：]?\s*/i, "")
  if (!sourceText) return ""
  const fillerIndex = sourceText.search(/(?:^|\n)\s*(?:填充物|填充料)\s*(?:[:：]|\n|$)/)
  return (fillerIndex >= 0 ? sourceText.slice(0, fillerIndex) : sourceText)
    .split("\n")
    .map((line) => line.trim().replace(/^([^:：\n]{1,24})\s*:\s*/, "$1："))
    .filter(Boolean)
    .join("\n")
}

function sectionTextFromMaterialSource(sourceRows: JsonRecord[], labels: string[]) {
  const sourceText = normalizeMaterialSourceSections(materialCompositionSourceText(sourceRows))
  if (!sourceText) return ""
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const labelMatch = new RegExp(`(?:^|\\n)(?:${labelPattern})\\s*[:：]\\s*`).exec(sourceText)
  if (!labelMatch) return ""
  const afterLabel = sourceText.slice(labelMatch.index + labelMatch[0].length)
  const nextLabel = new RegExp(`(?:^|\\n)(?:${SECONDARY_MATERIAL_SECTION}|主面料复合面布|主面料|大身面料|复合面布|面料)\\s*(?:[:：]|\\n|$)`)
  const nextIndex = afterLabel.search(nextLabel)
  return (nextIndex >= 0 ? afterLabel.slice(0, nextIndex) : afterLabel)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("；")
}

function liningCompositionText(sourceRows: JsonRecord[]) {
  return sectionTextFromMaterialSource(sourceRows, ["帽里料", "帽里", "里料", "衬里"])
}

function downMaterialText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return stringValue(spu.filler) || sectionTextFromMaterialSource(sourceRows, ["填充物", "填充料"])
}

function downContentPercentFromText(value: unknown) {
  const sourceText = stringValue(value).replace(/％/g, "%")
  const labeled = sourceText.match(/(?:绒子含量|含绒量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%?/)
  if (labeled) return `${formatMaterialPercent(labeled[1])}%`
  const filler = sourceText.match(/(\d+(?:\.\d+)?)\s*#\s*绒子/)
  if (filler) return `${formatMaterialPercent(filler[1])}%`
  const standalone = sourceText.trim().match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (standalone) return `${formatMaterialPercent(standalone[1])}%`
  return ""
}

function hasExplicitNoFiller(value: unknown) {
  const text = stringValue(value).replace(/\s+/g, "")
  if (/^无(?:填充)?$/.test(text)) return true
  return /(?:填充物|填充料)[:：]?(?:无|不填充|无填充)/.test(text)
}

function downContentEvidenceValue(spu: JsonRecord, sourceRows: JsonRecord[]) {
  const sourceText = `${downMaterialText(spu, sourceRows)}\n${materialCompositionSourceText(sourceRows)}`
  return downContentPercentFromText(sourceText) || (hasExplicitNoFiller(sourceText) ? "无" : "")
}

function copywritingDownContentEvidenceValue(sourceRows: JsonRecord[]) {
  const sourceText = materialCompositionSourceText(sourceRows)
  return downContentPercentFromText(sourceText) || (hasExplicitNoFiller(sourceText) ? "无" : "")
}

function isProductArchiveDownContentFieldKey(key: string) {
  return [
    "充绒量",
    "填充物含量",
    "含绒量",
    "含绒量多选",
    "含绒量文本",
    "绒子含量",
    "绒子含量多选",
    "绒子含量文本",
  ].includes(key)
}

function isProductArchiveFillerFieldKey(key: string) {
  return ["填充物", "填充物多选", "填充物种类", "填充物文本"].includes(key)
}

function copywritingTitleValue(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return copywritingValue(sourceRows, "搜索标题")
    || copywritingValue(sourceRows, "内容平台标题")
    || copywritingValue(sourceRows, "天猫标题")
    || copywritingValue(sourceRows, "商品标题")
    || copywritingValue(sourceRows, "标题")
    || stringValue(spu.listing_title_cn)
    || stringValue(spu.spu_name)
}

function productionEnterpriseName(spu: JsonRecord) {
  const rawPayload = recordValue(spu.raw_payload_json)
  const explicit = stringValue(rawPayload.productionEnterpriseName)
    || stringValue(rawPayload.manufacturer)
    || stringValue(rawPayload.producerName)
    || stringValue(rawPayload.factoryName)
  if (explicit) return explicit
  const brandText = `${stringValue(spu.brand_name)} ${stringValue(spu.brand_code)}`
  if (/巴拉巴拉|森马|balabala|semir/i.test(brandText)) return "浙江森马服饰股份有限公司"
  return ""
}

function productionEnterpriseAddress(spu: JsonRecord) {
  const rawPayload = recordValue(spu.raw_payload_json)
  const explicit = stringValue(rawPayload.productionEnterpriseAddress)
    || stringValue(rawPayload.manufacturerAddress)
    || stringValue(rawPayload.producerAddress)
    || stringValue(rawPayload.factoryAddress)
  if (explicit) return explicit
  const brandText = `${stringValue(spu.brand_name)} ${stringValue(spu.brand_code)}`
  if (/巴拉巴拉|森马|balabala|semir/i.test(brandText)) return "温州市瓯海区娄桥工业园南汇路98号"
  return ""
}

function primaryMaterialComponents(sourceRows: JsonRecord[]) {
  return materialComponentsFromText(materialCompositionSourceText(sourceRows))
}

function materialCompositionValue(sourceRows: JsonRecord[], jd = false) {
  return primaryMaterialComponents(sourceRows)
    .map((component) => {
      const name = jd && component.name === "聚酯纤维" ? "涤纶(聚酯纤维)" : component.name
      return `${name},${component.percent}`
    })
    .join(";")
}

function materialChoiceValue(sourceRows: JsonRecord[]) {
  return allMaterialNamesFromText(materialCompositionSourceText(sourceRows)).join(";")
}

function materialSummaryValue(sourceRows: JsonRecord[], fieldName: string) {
  const components = primaryMaterialComponents(sourceRows)
  if (!components.length) return ""
  const key = compactFieldKey(fieldName)
  if (components.length === 1) {
    const component = components[0]
    if (key === "面料" && component.name === "棉" && Number(component.percent) === 100) {
      return "纯棉(棉含量100%)"
    }
    return component.name
  }
  const dominant = [...components].sort((left, right) => Number(right.percent) - Number(left.percent))[0]
  return `${dominant.name}混纺`
}

function materialCompositionText(sourceRows: JsonRecord[]) {
  const components = primaryMaterialComponents(sourceRows)
  if (components.length > 0) {
    const composition = components.map((component) => `${component.percent}%${component.name}`).join("；")
    return `${composition}${primaryMaterialExclusionText(materialCompositionSourceText(sourceRows))}`
  }
  return primaryMaterialSection(materialCompositionSourceText(sourceRows))
}

const DOWN_FILLER_NAMES = ["白鸭绒", "灰鸭绒", "白鹅绒", "灰鹅绒", "鸭绒", "鹅绒", "羽绒", "棉", "聚酯纤维"]

function sourceRowJsonByType(sourceRows: JsonRecord[], sourceType: string) {
  return sourceRows
    .filter((row) => stringValue(row.source_type) === sourceType)
    .map((row) => recordValue(row.row_json))
    .filter((row) => hasValue(row))
}

function downFillerNameFromText(value: unknown) {
  const text = stringValue(value)
  for (const name of DOWN_FILLER_NAMES) {
    if (text.includes(name)) return name === "白鸭绒" ? "鸭绒" : name
  }
  return ""
}

function colorHintsFromCopywritingRow(row: JsonRecord) {
  return uniqueTextValues([
    row.颜色名称,
    row.款色号,
    row.颜色,
  ].flatMap((value) => stringValue(value).split(/[，,；;\s]+/)))
    .map((value) => value.replace(/\d{3,}$/g, ""))
    .filter(Boolean)
}

function downFillerFromCompositionForColor(composition: string, colorHints: string[]) {
  for (const color of colorHints) {
    if (!color || color.length < 2) continue
    const pattern = new RegExp(`${color}[^\\n]{0,20}成分([\\s\\S]*?)(?=\\n[^\\n]{0,20}成分|$)`)
    const section = composition.match(pattern)?.[1] ?? ""
    const filler = downFillerNameFromText(section.match(/填充物[\s\S]{0,160}/)?.[0] ?? section)
    if (filler) return filler
  }
  return ""
}

function copywritingFillerMaterialValue(sourceRows: JsonRecord[]) {
  for (const row of sourceRowJsonByType(sourceRows, "copywriting")) {
    const composition = stringValue(row.面料成分 ?? row.材质成分)
    if (!composition) continue
    const colorMatched = downFillerFromCompositionForColor(composition, colorHintsFromCopywritingRow(row))
    if (colorMatched) return colorMatched
    const afterFillerLabel = composition.match(/填充物[\s\S]{0,220}/)?.[0] ?? ""
    const filler = downFillerNameFromText(afterFillerLabel) || downFillerNameFromText(composition)
    if (filler) return filler
  }
  return ""
}

function sizeSegmentRanges(value: unknown) {
  const normalized = stringValue(value).replace(/[－—–~～至到]/g, "-")
  const ranges: Array<[number, number]> = []
  for (const match of normalized.matchAll(/(\d{1,3})\s*-\s*(\d{1,3})/g)) {
    const start = Number(match[1])
    const end = Number(match[2])
    if (Number.isFinite(start) && Number.isFinite(end)) ranges.push(start <= end ? [start, end] : [end, start])
  }
  return ranges
}

function ageTextForSizeSegment(value: unknown, shoeProduct: boolean) {
  const ranges = sizeSegmentRanges(value)
  if (!ranges.length) return ""
  const exactClothing = new Map<string, string>([
    ["52-66", "新生儿, 3个月"],
    ["66-90", "3-18个月"],
    ["73-100", "6个月-2岁"],
    ["90-130", "2-7岁"],
    ["90-140", "2-8岁"],
    ["90-180", "全阶段"],
    ["130-175", "7-16岁"],
    ["140-175", "8-16岁"],
  ])
  const exactShoe = new Map<string, string>([
    ["19-24", "4-24个月"],
    ["25-33", "3-7岁"],
    ["34-39", "8-14岁"],
  ])
  const exactMap = shoeProduct ? exactShoe : exactClothing
  if (!shoeProduct) {
    const referenceAge = balabalaApparelAgeTextForSizeRange(value)
    if (referenceAge) return referenceAge
  }
  for (const [start, end] of ranges) {
    const exact = exactMap.get(`${start}-${end}`)
    if (exact) return exact
  }
  const [start, end] = ranges[0]
  if (shoeProduct) {
    if (end <= 24) return "4-24个月"
    if (end <= 33) return "3-7岁"
    if (end <= 39) return "8-14岁"
    if (end <= 40) return "7岁-14岁"
    return ""
  }
  if (end <= 66) return "新生儿, 3个月"
  if (end <= 90) return "3-18个月"
  if (end <= 100) return "6个月-2岁"
  if (end <= 130) return "2-7岁"
  if (end <= 140) return "2-8岁"
  if (end <= 175) return start >= 140 ? "8-16岁" : "7-16岁"
  if (start <= 100 && end >= 175) return "全阶段"
  return ""
}

function applicableAgeText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  const sizeSegment = launchValue(sourceRows, "尺码段")
    || copywritingValue(sourceRows, "尺码段")
    || stringValue(spu.spec_range)
    || stringValue(spu.order_size_group_name)
  return ageTextForSizeSegment(sizeSegment, isShoeProduct(spu, sourceRows))
}

function shoe1688OriginValue() {
  return "浙江杭州"
}

function shoeMaterial1688Evidence(sourceRows: JsonRecord[]) {
  const text = `${shoeSurfaceMaterialText(sourceRows)}\n${shoeEvidenceText(sourceRows)}`
  if (/羊巴革|油蜡(?:革|材料)|pu\b|合成革/i.test(text)) return "合成革"
  if (/超纤/.test(text)) return "超纤皮"
  if (/牛反绒|磨砂皮/.test(text)) return "牛反绒"
  if (/牛皮/.test(text)) return "牛皮"
  if (/羊皮/.test(text)) return "羊皮"
  return ""
}

export function buildProductArchiveSourceDerivedFieldValue(fieldName: string, input: {
  spu: JsonRecord
  sourceRows: JsonRecord[]
  sourceField?: string | null
  templatePlatform?: unknown
}) {
  const key = compactFieldKey(fieldName)
  const sourceField = stringValue(input.sourceField)
  const sourceRows = activeProductArchiveSourceRows(input.sourceRows ?? [])
  const shoeProduct = isShoeProduct(input.spu, sourceRows)
  const apparelProduct = isApparelProduct(input.spu, sourceRows)
  if (isProductArchiveBusinessBlankField(fieldName, input.spu, sourceRows, input.templatePlatform)) return ""
  if ((shoeProduct || apparelProduct) && /单买价/.test(fieldName)) {
    return productArchiveOffsetPriceText(productArchiveListPriceText(input.spu, sourceRows), -1)
  }
  if ((shoeProduct || apparelProduct) && /(?:拼团价|团购价)/.test(fieldName)) {
    return productArchiveOffsetPriceText(productArchiveListPriceText(input.spu, sourceRows), -2)
  }
  if ((shoeProduct || apparelProduct) && PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS.has(key)) {
    return productArchiveListPriceText(input.spu, sourceRows)
  }
  if (key === "库存计数") return "买家拍下减库存"
  if (key === "会员打折") return "不参与会员打折"
  if (shoeProduct && (key.includes("专柜价") || key === "天猫特卖专柜价")) return "10000"
  if (shoeProduct && key === "抖音参考价格类型") return "吊牌价"
  if (shoeProduct && (key.includes("产品单价") || key.includes("奥莱店折扣价") || key.includes("抖音参考价"))) {
    return productArchiveListPriceText(input.spu, sourceRows)
  }
  if (shoeProduct && key === "是否商场同款") {
    return shoeSameMallStyleValue(sourceRows)
  }
  if (shoeProduct && ["是否新品", "是否库存", "是否外贸"].includes(key)) {
    return key === "是否新品" ? "是" : "否"
  }
  if (shoeProduct && key === "货源类别") return "现货"
  if (shoeProduct && key === "发货方式") return "快递发货"
  if (shoeProduct && key === "最快出货时间") return "48小时"
  if (shoeProduct && key === "最晚发货时间") return "2天"
  if (shoeProduct && ["单用户累计限购件", "每次限购件"].includes(businessRuleFieldKey(fieldName))) return "5"
  if (shoeProduct && key.includes("京东发货地")) return "杭州"
  if (shoeProduct && key.includes("京东商品重量")) return "1"
  if (shoeProduct && /京东.*包装.*[宽长高]/.test(fieldName)) return "100"
  if (shoeProduct && ["微信视频小店商品编码", "唯品会款号"].includes(key)) {
    return stringValue(input.spu.spu_code) || launchValue(sourceRows, "款号")
  }
  if (shoeProduct && key === "天猫sku搜索标题") return copywritingValue(sourceRows, "导购标题")
  if (shoeProduct && ["微信视频小店标题", "小红书标题", "抖音标题"].includes(key)) {
    return platformContentTitleValue(sourceRows)
  }
  if (shoeProduct && key === "快手标题") return kuaishouTitleValue(input.spu, sourceRows, true)
  if (shoeProduct && key === "微信视频小店副标题") return copywritingValue(sourceRows, "导购标题")
  if (shoeProduct && key === "快手商品卖点") return copywritingValue(sourceRows, "导购标题") || shoeSellingPointValue(sourceRows)
  if (shoeProduct && key === "商品展示标题") return productArchiveDisplayTitleValue(input.spu, sourceRows)
  if (shoeProduct && key === "唯品会标题") return copywritingValue(sourceRows, "唯品标题")
  if (shoeProduct && ["商品详情", "天猫商品卖点", "天猫推荐理由"].includes(key)) return shoeSellingPointValue(sourceRows)
  if (shoeProduct && key === "天猫导购标题") return copywritingValue(sourceRows, "导购标题")
  if (shoeProduct && key === "25实拍文案") return detailCopyLinesValue(sourceRows)
  if (shoeProduct && key === "尺码类型") return "欧码（童鞋）"
  if (shoeProduct && key === "售后服务承诺") {
    const text = productCategoryText(input.spu, sourceRows)
    return /板鞋|运动鞋/.test(text) ? "延保90天" : "不设置"
  }
  if (shoeProduct && (key === "质检报告" || key === "质检报告表")) return "否"
  if (shoeProduct && ["帮面材质", "帮面材质多选", "鞋面材质", "鞋面材质多选", "配皮材质", "配皮材质多选"].includes(key)) {
    return shoeSurfaceMaterialText(sourceRows)
  }
  if (shoeProduct && ["内里材质", "内里材质多选", "里料材质", "里料材质多选"].includes(key)) {
    return shoeLiningMaterialText(sourceRows)
  }
  if (shoeProduct && ["鞋底材质", "鞋底材质多选"].includes(key)) return shoeSoleMaterialText(sourceRows)
  if (shoeProduct && key === "鞋垫材质") return shoeInsoleMaterialText(sourceRows)
  if (shoeProduct && ["详情页面料", "唯品会材质", "25面料成分"].includes(key)) return shoeDetailMaterialText(sourceRows)
  if (shoeProduct && ["商品名称", "产品名称", "25产品名称"].includes(key)) return shoeProductNameValue(sourceRows)
  if (shoeProduct && ["商品卖点", "产品卖点", "卖点", "销售卖点"].includes(key)) return shoeSellingPointValue(sourceRows)
  if (shoeProduct && ["唯品会副标题"].includes(key)) {
    return firstClause(copyOrLaunchValue(sourceRows, "推荐理由"), 10)
  }
  if (shoeProduct && ["闭合方式", "闭合方式多选"].includes(key)) return shoeClosureValue(sourceRows)
  if (shoeProduct && ["鞋帮高度", "鞋帮高度多选", "靴筒高度"].includes(key)) return shoeUpperHeightValue(sourceRows)
  if (shoeProduct && ["流行元素", "流行元素多选"].includes(key)) return shoePopularElementValue(sourceRows)
  if (shoeProduct && ["风格", "风格多选"].includes(key)) return shoeStyleValue(sourceRows)
  if (shoeProduct && ["适用季节", "适用季节多选", "上市时间文本"].includes(key)) return shoeSeasonValue(input.spu, sourceRows)
  if (shoeProduct && ["适用人群", "适用人群多选"].includes(key)) {
    return copyOrLaunchValue(sourceRows, "年龄段") || applicableAgeText(input.spu, sourceRows)
  }
  if (shoeProduct && ["适用场合", "适用场合多选"].includes(key)) return shoeUsageOccasionValue()
  if (shoeProduct && ["适用场景", "适用场景多选"].includes(key)) return shoeUsageSceneValue()
  if (shoeProduct && ["功能", "功能多选"].includes(key)) return shoeFunctionValue(sourceRows) || shoeSellingPointValue(sourceRows)
  if (shoeProduct && key === "执行标准") return copyOrLaunchValue(sourceRows, "执行标准")
  if (shoeProduct && isProductArchiveProductCategoryFieldKey(key)) {
    return productArchiveCategoryEvidenceCandidates({
      spu: input.spu,
      sourceRows,
    })[0] ?? ""
  }
  if (shoeProduct && ["款式", "款式多选", "款式单选", "类型", "类型多选"].includes(key)) {
    return copyOrLaunchValue(sourceRows, "主款式")
      || copyOrLaunchValue(sourceRows, "品类")
      || shoeProductNameValue(sourceRows)
  }
  if (shoeProduct && key === "材质1688") return shoeSurfaceMaterialText(sourceRows) || shoeMaterial1688Evidence(sourceRows)
  if (shoeProduct && key === "材质功能") {
    const fab = shoeEvidenceText(sourceRows)
    if (/防渗水|防水/.test(fab)) return "防渗水"
    if (/防泼水/.test(fab)) return "防泼水"
    if (/保温|保暖|抗寒/.test(fab)) return "抗寒"
    return fab
  }
  if (shoeProduct && (key === "产地" || isProductArchiveOriginCountryField(fieldName))) {
    return key === "产地" ? shoe1688OriginValue() : "中国"
  }
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return materialCompositionText(sourceRows)
  if (apparelProduct && key === "主面料成分含量") return fullMaterialCompositionText(sourceRows)
  if (apparelProduct && key === "25面料成分") return materialCompositionSourceText(sourceRows)
  if (apparelProduct && key === "25服饰细节文案") return detailCopyLinesValue(sourceRows)
  if (apparelProduct && key === "25版型指数") return copywritingValue(sourceRows, "版型")
  if (apparelProduct && key === "25服装面料文案") return apparelFabricCopyValue(sourceRows)
  if (apparelProduct && key === "主图4文案1") return firstLines(copywritingValue(sourceRows, "设计师说——主图4"))[0] ?? ""
  if (apparelProduct && key === "主图4文案2") return firstLines(copywritingValue(sourceRows, "设计师说——主图4")).slice(1).join("\n")
  if (apparelProduct && key === "主图4样式") return "225"
  if (apparelProduct && key === "商品展示标题") return productArchiveDisplayTitleValue(input.spu, sourceRows, false)
  if (apparelProduct && ["快手标题", "抖音标题", "小红书标题", "微信视频小店标题"].includes(key)) return platformContentTitleValue(sourceRows)
  if (apparelProduct && key === "天猫导购标题") return copywritingValue(sourceRows, "导购标题")
  if (apparelProduct && key === "天猫推荐理由") return tmallRecommendationReasonValue(sourceRows)
  if (apparelProduct && key === "羽绒服洗涤说明" && downContentEvidenceValue(input.spu, sourceRows)) return "羽绒服洗涤说明"
  if (apparelProduct && key === "报价方式") return "按产品数量报价"
  if (apparelProduct && key === "件重尺") return "按规格设置"
  if (apparelProduct && (key === "1688供货方式" || key === "供货方式1688")) return "现货"
  if ((shoeProduct || apparelProduct) && key === "所在地") return "浙江,杭州"
  if (key === "材质成分") return materialCompositionValue(sourceRows)
  if (key === "京东材质成分") return materialCompositionValue(sourceRows, true)
  if (key === "面料多选" || key === "材质多选" || key === "材质成分多选") return materialChoiceValue(sourceRows)
  if (key === "详情页面料") return apparelDetailMaterialText(sourceRows)
  if (apparelProduct && key === "里料材质成分含量多选") {
    return parseMaterialComponents(liningCompositionText(sourceRows))
      .map((component) => `${component.percent}%${component.name}`)
      .join(";")
  }
  if (apparelProduct && ["里料", "里料成分", "里料材质", "内里材质"].includes(key)) {
    return liningCompositionText(sourceRows)
  }
  if (key === "面料" || key === "材质" || key === "面料俗称" || key === "抖音面料材质") {
    return materialSummaryValue(sourceRows, fieldName)
  }
  if (key === "上市时间" || key === "上市时间文本") return shoeSeasonValue(input.spu, sourceRows)
  if (key === "适用季节" || key === "适用季节多选") return shoeSeasonValue(input.spu, sourceRows)
  if (key.endsWith("兼容平台")) return PRODUCT_ARCHIVE_COMPATIBLE_PLATFORMS.join(";")
  const sourceReference = productArchiveSourceReference(sourceField)
  if (isProductArchiveListPriceReference(sourceField) || isProductArchiveListPriceReference(fieldName)) {
    return productArchiveListPriceText(input.spu, sourceRows)
  }
  if (sourceReference) {
    const referenceField = sourceReference.sourceField
    if (referenceField === "款号" || referenceField === "大货款号" || referenceField === "货号") {
      return launchValue(sourceRows, "款号") || stringValue(input.spu.spu_code)
    }
    if (referenceField === "颜色" || referenceField === "颜色名称") {
      return aggregateSourceValues(sourceRows, "launch_plan", ["颜色名称", "颜色"]).join(";")
    }
    if (referenceField === "上市时间" || referenceField === "内容上市时间" || referenceField === "搜索上市时间" || referenceField === "对应日期") {
      return dateFromText(launchValue(sourceRows, referenceField) || launchDateValue(sourceRows))
    }
    if (referenceField === "主图4第1句") return firstLines(copywritingValue(sourceRows, "设计师说——主图4"))[0] ?? ""
    if (referenceField === "主图4第2-3句") return firstLines(copywritingValue(sourceRows, "设计师说——主图4")).slice(1, 3).join("\n")
    if (referenceField === "面料名称-面料文案*面料三个关键词") {
      return [
        copywritingValue(sourceRows, "面料名称"),
        copywritingValue(sourceRows, "面料文案"),
        copywritingValue(sourceRows, "面料三个关键词"),
      ].filter(Boolean).join("\n")
    }
    if (referenceField === "去掉巴拉巴拉") return stripBalabalaBrand(copywritingValue(sourceRows, "搜索标题"))
    if (sourceReference.sourceType === "launch_plan") return launchValue(sourceRows, referenceField)
    if (sourceReference.sourceType === "copywriting") return copywritingValue(sourceRows, referenceField)
  }
  if (sourceField === "款号") return launchValue(sourceRows, "款号") || stringValue(input.spu.spu_code)
  if (sourceField === "颜色") return aggregateSourceValues(sourceRows, "launch_plan", ["颜色名称", "颜色"]).join(";")
  if (sourceField === "内容平台标题") return copywritingValue(sourceRows, "内容平台标题")
  if (sourceField === "细节文案") return copywritingValue(sourceRows, "细节文案")
  if (sourceField === "材质成分") return copywritingValue(sourceRows, "材质成分")
  if (sourceField === "主图4第1句") return firstLines(copywritingValue(sourceRows, "设计师说——主图4"))[0] ?? ""
  if (sourceField === "主图4第2-3句") return firstLines(copywritingValue(sourceRows, "设计师说——主图4")).slice(1, 3).join("\n")
  if (sourceField === "面料名称-面料文案*面料三个关键词") {
    return [
      copywritingValue(sourceRows, "面料名称"),
      copywritingValue(sourceRows, "面料文案"),
      copywritingValue(sourceRows, "面料三个关键词"),
    ].filter(Boolean).join("\n")
  }
  if (sourceField === "去掉巴拉巴拉") return stripBalabalaBrand(copywritingValue(sourceRows, "搜索标题"))

  if (key === "单位" || key === "计量单位") return "件"
  if (key === "型号") return stringValue(input.spu.spu_code) || launchValue(sourceRows, "款号")
  if (key === "选择期数") return launchValue(sourceRows, "产品季") || stringValue(input.spu.season_name) || stringValue(input.spu.year)
  if (key === "厚薄") return copywritingValue(sourceRows, "厚薄")
  if (key === "服装版型" || key === "版型") return copywritingValue(sourceRows, "版型")
  if (key === "分类" || key === "类型") return "外套"
  if (key === "品牌单选") return stringValue(input.spu.brand_name) || "巴拉巴拉"
  if (key === "品牌" || key === "品牌文本") return stringValue(input.spu.brand_name) || copywritingValue(sourceRows, "品牌") || "巴拉巴拉"
  if (key === "生产企业名称" || key === "生产经销厂家" || key === "生产/经销厂家" || key === "生产经销企业") {
    return productionEnterpriseName(input.spu)
  }
  if (key === "厂家地址") return productionEnterpriseAddress(input.spu)
  if (isProductArchiveDownContentFieldKey(key)) return downContentEvidenceValue(input.spu, sourceRows)
  if (key === "里料成分含量") return liningCompositionText(sourceRows)
  if (key === "功能多选") return copywritingValue(sourceRows, "面料三个关键词") || copywritingValue(sourceRows, "推荐理由")
  if (key === "安全等级" || key === "安全等级多选") return ""
  if (key === "尺码表") return ""
  if (key === "性别多选") return launchValue(sourceRows, "性别") || stringValue(input.spu.gender_name)
  if (key === "成分含量") return materialPercentText(sourceRows)
  if (key === "是否带帽") return "连帽"
  if (key === "是否库存") return "否"
  if (key === "主面料成分含量") return materialPercentText(sourceRows)
  if (key === "唯品会副标题") return copywritingValue(sourceRows, "唯品标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "弹力") return copywritingValue(sourceRows, "弹性")
  if (key === "商品短标题") return copywritingValue(sourceRows, "导购标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "导购短标题" || key === "抖音导购短标题") {
    return truncateCompleteWords(copywritingValue(sourceRows, "导购标题"), 30)
  }
  if (key === "商品详情") return copywritingValue(sourceRows, "推荐理由") || launchValue(sourceRows, "FAB") || copyTextBlock(sourceRows)
  if (key === "最快出货时间") {
    return dateFromText(launchValue(sourceRows, "首批sap到货时间") || launchValue(sourceRows, "上市时间"))
  }
  if (key === "材质akc" && isShoeProduct(input.spu, sourceRows)) {
    return launchValue(sourceRows, "大身面料") || launchValue(sourceRows, "鞋品大底材质/用品材质")
  }
  if ((key === "单色平台ai标" || key === "多色平台ai") && isShoeProduct(input.spu, sourceRows)) return "坑位1"
  if (key === "详情页ai标注" && isShoeProduct(input.spu, sourceRows) && copyTextBlock(sourceRows)) return "展示"
  if (key === "商品描述") return ""
  if (key === "微信视频小店副标题" || key === "快手商品卖点") return copywritingValue(sourceRows, "推荐理由") || copyTextBlock(sourceRows)
  if (key === "微信视频小店标题" || key === "抖音标题") return copywritingValue(sourceRows, "内容平台标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "快手标题") return kuaishouTitleValue(input.spu, sourceRows, false)
  if (key === "拼多多标题") return copywritingTitleValue(input.spu, sourceRows)
  if (key === "计量单位") return stringValue(input.spu.unit_name) || "件"
  if (key === "是否跨境出口专供货源" || key === "是否加绒" || key === "是否可开档" || key === "是否开裆") return "否"
  if (key === "是否可定制") return "不可定制"
  if (key === "售后服务承诺") return "不设置"
  if (key === "balaone仅专供新品") return launchValue(sourceRows, "属性").includes("专供新品") ? "是" : ""
  if (key === "货源类别") {
    const sourceText = launchValue(sourceRows, "属性") || launchValue(sourceRows, "属性-销")
    if (/现货/.test(sourceText)) return "现货"
    if (/专供新品|订货|新品/.test(sourceText)) return "订货"
    return ""
  }
  if (isProductArchiveFillerFieldKey(key)) {
    const sourceText = `${stringValue(input.spu.filler)}\n${materialCompositionSourceText(sourceRows)}`
    const sourceValue = hasExplicitNoFiller(sourceText) ? "无" : copywritingFillerMaterialValue(sourceRows)
    return sourceValue || stringValue(input.spu.filler) || launchValue(sourceRows, "填充物") || "无"
  }
  if (key === "款式" || key === "款式多选" || key === "款式单选") {
    return launchValue(sourceRows, "主款式 （唯品四级品类）")
      || stringValue(input.spu.subclass_name)
      || stringValue(input.spu.spu_name)
  }
  if (key === "袖长多选") return "长袖"
  if (key === "袖长") return "长袖"
  if (key === "衣长") return "常规"
  if (key === "腰型" || key === "裤长" || key === "裤门襟") return "不适用"
  if (isProductArchiveOriginCountryField(fieldName)) return "中国"
  if (key === "童装产地多选") return "中国大陆"
  if (key === "适用场合") return "日常"
  if (key === "退款规则") return "支持7天无理由退货"
  if (key === "适用人群" || key === "适用人群多选") {
    return applicableAgeText(input.spu, sourceRows)
      || launchValue(sourceRows, "年龄段")
      || stringValue(input.spu.age_group_name)
  }
  if (
    key === "适用年龄"
    || key === "适用年龄多选"
    || key === "适用年龄段"
    || key === "适用年龄段多选"
    || key === "淘宝天猫适用年龄"
    || key === "适合年龄段"
    || key === "适合年龄段多选"
  ) {
    return applicableAgeText(input.spu, sourceRows) || launchValue(sourceRows, "年龄段") || stringValue(input.spu.age_group_name)
  }
  if (key === "适用年龄文本") return applicableAgeText(input.spu, sourceRows) || launchValue(sourceRows, "年龄段") || stringValue(input.spu.age_group_name)
  if (key === "面料工艺") return "涂层"
  if (key === "领型") return "连帽"
  if (key === "风格" || key === "风格多选") return "休闲"
  if (key === "京东自营子属性" || key === "京东规格子属性") return ""
  return ""
}

export function buildProductArchiveMdmDerivedFieldValue(fieldName: string, input: {
  spu: JsonRecord
  skus: JsonRecord[]
  dateText?: string
  sourceRows?: JsonRecord[]
  templateOptions?: unknown[]
}) {
  const key = compactFieldKey(fieldName)
  const shoeProduct = isShoeProduct(input.spu, input.sourceRows ?? [])
  const apparelProduct = isApparelProduct(input.spu, input.sourceRows ?? [])
  if (isProductArchiveOriginCountryField(fieldName)) {
    return { valueText: "中国", valueJson: {} }
  }
  if (key === "货号" || key === "款号") {
    return { valueText: stringValue(input.spu.spu_code), valueJson: {} }
  }
  if (key === "价格" || key === "吊牌价格" || key === "吊牌价") {
    return { valueText: moneyText(input.spu.price_tag), valueJson: {} }
  }
  if (apparelProduct && key === "价格区间") {
    const price = productArchiveListPriceText(input.spu, input.sourceRows ?? [])
    return price
      ? { valueText: "", valueJson: { title: "产品单价（元）", 1: price } }
      : { valueText: "", valueJson: {} }
  }
  if (key === "上市时间") {
    return { valueText: stringValue(input.dateText), valueJson: {} }
  }
  if (key === "颜色" || key === "颜色文本" || key === "颜色名称文本") {
    return { valueText: uniqueTextValues(input.skus.map((sku) => deepdrawColorValue(sku.color_name))).join(";"), valueJson: {} }
  }
  if (key === "尺码" || key === "尺寸") {
    const values = input.skus.map((sku) => shoeProduct
      ? shoeSizeDisplayLabel(sku.size_name ?? sku.size_code)
      : deepdrawSizeValue(sku.size_name ?? sku.size_code))
    return { valueText: uniqueTextValues(values).join(";"), valueJson: {} }
  }
  if (key === "京东自营子属性" || key === "京东规格子属性") {
    const values = input.skus.map((sku) => shoeProduct
      ? normalizeShoeSkuSize(sku.size_name ?? sku.size_code)
      : deepdrawSizeValue(sku.size_name ?? sku.size_code).replace(/cm$/i, ""))
    return { valueText: uniqueTextValues(values).join(";"), valueJson: {} }
  }
  if (key === "尺码表") {
    // SKU master data proves which sizes exist, but it does not provide garment
    // measurements. Keep the table empty until a real PLM/size-chart source is
    // present instead of inventing zero-valued measurements.
    return { valueText: "", valueJson: {} }
  }
  if (key === "商家sku") {
    return {
      valueText: "",
      valueJson: merchantSkuFieldValue(input.spu, input.skus, {
        dateText: stringValue(input.dateText),
        sourceRows: input.sourceRows,
        templateOptions: input.templateOptions,
      }),
    }
  }
  return { valueText: "", valueJson: {} }
}

function sizeChartSourceRowJson(sourceRows: JsonRecord[]) {
  return sourceRows
    .filter((row) => stringValue(row.source_type) === "size_chart")
    .map((row) => recordValue(row.row_json))
    .filter((row) => hasValue(row))
}

function sizeChartTitleOptions(valueJson: unknown) {
  return stringValue(recordValue(valueJson).title)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

const SIZE_CHART_METADATA_KEYS = new Set([
  "ai_fill",
  "aifill",
  "confidence",
  "fallback",
  "mappings",
  "reason",
  "source",
  "unmatchedtargets",
])

function sizeChartDataEntries(valueJson: unknown) {
  return Object.entries(recordValue(valueJson)).filter(([rawKey, rawValue]) => {
    const key = compactFieldKey(rawKey)
    return key !== "title" && !SIZE_CHART_METADATA_KEYS.has(key) && hasValue(rawValue)
  })
}

function sizeChartLooksLikeTable(valueJson: unknown) {
  const titles = sizeChartTitleOptions(valueJson)
  if (titles.length > 0) return true
  return sizeChartDataEntries(valueJson).some(([rawSize]) => sizeMatchKeys(rawSize).length > 0)
}

function hasProductArchiveSizeChartTableValue(valueJson: unknown) {
  return sizeChartTitleOptions(valueJson).length > 0 && sizeChartDataEntries(valueJson).length > 0
}

function sizeChartCellValues(value: unknown) {
  return stringValue(value).split(",").map((item) => item.trim())
}

function isBlankSizeChartCellValue(value: unknown) {
  const text = stringValue(value)
  if (!text) return true
  const numeric = Number(text)
  return Number.isFinite(numeric) && numeric === 0
}

function cleanProductArchiveSizeChartTableValue(valueJson: unknown) {
  const titles = sizeChartTitleOptions(valueJson)
  const entries = sizeChartDataEntries(valueJson)
  if (titles.length === 0 || entries.length === 0) return {}

  const rows = entries.map(([rawSize, rawValues]) => ({
    rawSize,
    values: sizeChartCellValues(rawValues),
  }))
  const activeIndexes = titles
    .map((_, index) => index)
    .filter((index) => rows.every((row) => !isBlankSizeChartCellValue(row.values[index])))
  if (activeIndexes.length === 0) return {}

  const output: JsonRecord = {
    title: activeIndexes.map((index) => titles[index]).join(","),
  }
  for (const row of rows) {
    output[row.rawSize] = activeIndexes.map((index) => row.values[index]).join(",")
  }
  return output
}

function sizeChartTemplateOptionsForField(templateOptions: unknown, existingValueJson: unknown, fieldName: string) {
  const options = arrayValue(templateOptions)
  if (options.length > 0) return options
  const existingTitles = sizeChartTitleOptions(existingValueJson)
  if (existingTitles.length > 0) return existingTitles
  if (compactFieldKey(fieldName) === compactFieldKey("多平台尺码")) {
    return ["京东", "拼多多", "小红书", "微信视频小店"]
  }
  return compactFieldKey(fieldName) === compactFieldKey("尺码表") ? ["身高", "衣长", "胸围", "袖长"] : []
}

export function buildProductArchiveSizeChartFieldValue(input: {
  fieldName: string
  spuCode: string
  sourceRows: JsonRecord[]
  templateOptions: unknown[]
  mappings?: JsonRecord[]
  allowedSizes?: unknown[]
  spu?: JsonRecord
  gender?: unknown
  garmentType?: unknown
}) {
  const gender = stringValue(input.gender)
    || copywritingValue(input.sourceRows, "性别")
    || launchValue(input.sourceRows, "性别")
    || stringValue(input.spu?.gender_name)
  const garmentType = stringValue(input.garmentType)
    || copywritingValue(input.sourceRows, "品类")
    || launchValue(input.sourceRows, "主款式")
    || stringValue(input.spu?.subclass_name)
    || stringValue(input.spu?.spu_name)
  const result = buildSizeChartForTemplate({
    rows: sizeChartSourceRowJson(input.sourceRows),
    spuCode: input.spuCode,
    template: {
      fieldName: input.fieldName,
      options: sizeChartTemplateOptionsForField(input.templateOptions, {}, input.fieldName),
    },
    mappings: input.mappings ?? [],
    allowedSizes: input.allowedSizes ?? [],
    gender,
    garmentType,
  })
  const valueJson = recordValue(result.valueJson)
  return {
    valueText: compactFieldKey(input.fieldName) === compactFieldKey("多平台尺码")
      ? sizeChartTitleOptions(valueJson).join(";")
      : "",
    valueJson,
    sourceType: hasValue(valueJson) ? "size_chart" : "",
    mappings: result.mappings.map((mapping: JsonRecord) => ({ fieldName: input.fieldName, ...mapping })),
    unmatchedTargets: result.unmatchedTargets,
  }
}

function sizeChartMappingsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  try {
    return db.prepare(`
      select
        field_name,
        target_field,
        source_point,
        confidence,
        source,
        review_status,
        evidence_json
      from product_archive_size_chart_mapping
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
        and review_status = 'approved'
        and coalesce(source_point, '') <> ''
      order by
        field_name,
        case confidence when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end,
        target_field
    `).all(draft.tenant_name, draft.merchant_id, draft.trade_id) as JsonRecord[]
  } catch (error) {
    if (/product_archive_size_chart_mapping/i.test(error instanceof Error ? error.message : String(error))) return []
    throw error
  }
}

function serializeSizeChartMapping(row: JsonRecord) {
  return {
    fieldName: stringValue(row.fieldName ?? row.field_name),
    targetField: stringValue(row.targetField ?? row.target_field),
    sourcePoint: stringValue(row.sourcePoint ?? row.source_point) || null,
    confidence: stringValue(row.confidence),
    source: stringValue(row.source),
    reviewStatus: stringValue(row.reviewStatus ?? row.review_status),
    reason: stringValue(row.reason ?? recordValue(row.evidence_json).reason),
  }
}

export function validateProductArchiveSizeChartValue(input: {
  fieldName: string
  valueJson: unknown
  allowedSizes: unknown[]
  blocking?: boolean
}) {
  const valueJson = recordValue(input.valueJson)
  if (!hasValue(valueJson)) return []
  if (!sizeChartLooksLikeTable(valueJson)) return []
  const severity = input.blocking === false ? "warning" : "blocker"
  const titles = stringValue(valueJson.title).split(",").map((item) => item.trim()).filter(Boolean)
  if (titles.length === 0) {
    return [{
      severity,
      issueType: "size_chart_title_missing",
      fieldName: input.fieldName,
      message: "尺码表缺少表头",
    }]
  }
  const allowedSizeKeys = sizeValueKeySet(input.allowedSizes)
  const issues: Array<{ severity: string; issueType: string; fieldName?: string | null; skuCode?: string | null; message: string }> = []
  for (const [rawSize, rawValues] of sizeChartDataEntries(valueJson)) {
    const size = deepdrawSizeValue(rawSize)
    const values = stringValue(rawValues).split(",")
    if (values.length !== titles.length) {
      issues.push({
        severity,
        issueType: "size_chart_column_count_mismatch",
        fieldName: input.fieldName,
        message: `尺码表 ${size} 行的值数量与表头不一致`,
      })
    }
    if (allowedSizeKeys.size > 0 && !sizeMatchKeys(rawSize).some((key) => allowedSizeKeys.has(key))) {
      issues.push({
        severity,
        issueType: "size_chart_size_not_in_sku",
        fieldName: input.fieldName,
        message: `尺码表 ${size} 不在草稿 SKU 尺码中`,
      })
    }
  }
  return issues
}

function productArchiveDownFillWeightPairs(value: unknown) {
  return Array.from(stringValue(value).matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|厘米|码)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|克)/gi))
    .map((match) => ({
      size: formatMaterialPercent(match[1]),
      weight: formatMaterialPercent(match[2]),
    }))
}

function productArchiveSizeNumber(value: unknown) {
  const match = stringValue(value).match(/\d{2,3}/)
  return match ? String(Number(match[0])) : ""
}

function productArchiveDownFillWeightColumnIndex(valueJson: JsonRecord) {
  return sizeChartTitleOptions(valueJson).findIndex((title) => /充绒|填充.*(?:g|克|量)/i.test(compactFieldKey(title)))
}

export function buildProductArchiveDownFillWeightSizeChartUpdates(fields: JsonRecord[]) {
  const fillSource = fields.find((field) => (
    compactFieldKey(field.field_name) === "充绒量文本"
    && productArchiveDownFillWeightPairs(field.value_text).length > 0
  )) ?? fields.find((field) => (
    compactFieldKey(field.field_name) === "充绒量"
    && productArchiveDownFillWeightPairs(field.value_text).length > 0
  ))
  if (!fillSource) return []

  const weightsBySize = new Map(productArchiveDownFillWeightPairs(fillSource.value_text)
    .map((pair) => [productArchiveSizeNumber(pair.size), pair.weight])
    .filter(([size]) => Boolean(size)))
  if (!weightsBySize.size) return []

  const updates: Array<{
    fieldId: number
    fieldName: string
    valueJson: JsonRecord
    sourceType: string
    sourceRef: string | null
  }> = []
  for (const field of fields) {
    if (!compactFieldKey(field.field_name).includes("尺码表")) continue
    const fieldId = Number(field.id)
    if (!Number.isInteger(fieldId) || fieldId <= 0) continue
    const currentValue = recordValue(field.value_json)
    const columnIndex = productArchiveDownFillWeightColumnIndex(currentValue)
    if (columnIndex < 0) continue
    const titles = sizeChartTitleOptions(currentValue)
    const nextValue = { ...currentValue }
    let changed = false
    for (const [rawSize, rawValues] of sizeChartDataEntries(currentValue)) {
      const weight = weightsBySize.get(productArchiveSizeNumber(rawSize))
      if (!weight) continue
      const values = stringValue(rawValues).split(",")
      while (values.length < titles.length) values.push("0")
      if (values[columnIndex] === weight) continue
      values[columnIndex] = weight
      nextValue[rawSize] = values.join(",")
      changed = true
    }
    if (!changed) continue
    updates.push({
      fieldId,
      fieldName: stringValue(field.field_name),
      valueJson: nextValue,
      sourceType: stringValue(fillSource.source_type) || stringValue(field.source_type) || "washlabel_ocr",
      sourceRef: stringValue(fillSource.source_ref) || stringValue(field.source_ref) || null,
    })
  }
  return updates
}

export function syncProductArchiveDownFillWeightSizeCharts(db: SyncPostgresDatabase, draftId: number) {
  const fields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const updates = buildProductArchiveDownFillWeightSizeChartUpdates(fields)
  if (!updates.length) return updates
  const now = nowIso()
  const updateField = db.prepare(`
    update product_archive_draft_field
    set value_json = ?::jsonb,
      source_type = ?,
      source_ref = ?,
      manual_override = true,
      validation_status = 'valid',
      validation_message = null,
      updated_at = ?::timestamptz
    where draft_id = ? and id = ?
  `)
  for (const update of updates) {
    updateField.run(
      jsonText(update.valueJson),
      update.sourceType,
      update.sourceRef,
      now,
      draftId,
      update.fieldId,
    )
  }
  return updates
}

function issueValueList(values: string[]) {
  const visible = values.slice(0, 8).join("、")
  return values.length > 8 ? `${visible} 等 ${values.length} 个` : visible
}

function productArchiveKnownSizeNumbersBetween(start: number, end: number) {
  const knownSizeNumbers = [44, 52, 59, 66, 73, 80, 90, 100, 110, 120, 130, 140, 150, 160, 165, 170, 175]
  return knownSizeNumbers.filter((size) => size >= start && size <= end)
}

function productArchiveSizeRangeValues(value: unknown) {
  const text = stringValue(value)
  if (!text) return []
  const sizes: string[] = []
  for (const match of text.matchAll(/0*(\d{2,3})\s*(?:cm|厘米|码)?\s*(?:[-~～至—－])\s*0*(\d{2,3})/gi)) {
    const start = Number(match[1])
    const end = Number(match[2])
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const min = Math.min(start, end)
    const max = Math.max(start, end)
    const knownSizes = productArchiveKnownSizeNumbersBetween(min, max)
    for (const size of knownSizes.length > 0 ? knownSizes : [min, max]) {
      sizes.push(deepdrawSizeValue(size))
    }
  }
  for (const match of text.matchAll(/0*(\d{2,3})(?:cm|厘米|码)?/gi)) {
    sizes.push(deepdrawSizeValue(match[1]))
  }
  return uniqueTextValues(sizes)
}

function launchPlanSizeValues(sourceRows: JsonRecord[]) {
  return uniqueTextValues(
    aggregateSourceValues(sourceRows, "launch_plan", sourceAliases("尺码段"))
      .flatMap((value) => productArchiveSizeRangeValues(value)),
  )
}

function productArchiveSizeChartAllowedSizes(sourceRows: JsonRecord[], skus: JsonRecord[]) {
  const skuSizes = draftSkuSizeValues(skus)
  const launchSizes = launchPlanSizeValues(sourceRows)
  if (skuSizes.length > 0 && launchSizes.length > 0) {
    const launchKeys = sizeValueKeySet(launchSizes)
    const intersection = skuSizes.filter((size) => sizeMatchKeys(size).some((key) => launchKeys.has(key)))
    return intersection.length > 0 ? intersection : skuSizes
  }
  return skuSizes.length > 0 ? skuSizes : launchSizes
}

function sizeValueKeySet(values: unknown[]) {
  const keys = new Set<string>()
  for (const value of values) {
    for (const key of sizeMatchKeys(value)) keys.add(key)
  }
  return keys
}

function draftSkuSizeValues(skus: JsonRecord[] = []) {
  return uniqueTextValues(skus.flatMap((sku) => [
    deepdrawSizeValue(sku.size_name),
    deepdrawSizeValue(sku.size_code),
  ]))
}

export function validateProductArchiveSkuSizeFieldValue(input: {
  fieldName: string
  valueText: unknown
  skus: JsonRecord[]
}) {
  if (/^尺码\s*[.。]$/.test(stringValue(input.fieldName))) return []
  const skuSizes = draftSkuSizeValues(input.skus)
  if (skuSizes.length === 0) return []
  const fieldSizes = uniqueTextValues(stringValue(input.valueText).split(/[;；,，]/).map((size) => deepdrawSizeValue(size)))
  const fieldKeys = sizeValueKeySet(fieldSizes)
  const skuKeys = sizeValueKeySet(skuSizes)
  const issues: Array<{ severity: string; issueType: string; fieldName?: string | null; skuCode?: string | null; message: string }> = []
  const missingSkuSizes = skuSizes.filter((size) => !sizeMatchKeys(size).some((key) => fieldKeys.has(key)))
  if (missingSkuSizes.length > 0) {
    issues.push({
      severity: "blocker",
      issueType: "sku_size_field_missing_sku",
      fieldName: input.fieldName,
      message: `${input.fieldName} 字段缺少草稿 SKU 尺码：${issueValueList(missingSkuSizes)}`,
    })
  }
  const extraFieldSizes = fieldSizes.filter((size) => !sizeMatchKeys(size).some((key) => skuKeys.has(key)))
  if (extraFieldSizes.length > 0) {
    issues.push({
      severity: "blocker",
      issueType: "sku_size_field_extra",
      fieldName: input.fieldName,
      message: `${input.fieldName} 字段包含非草稿 SKU 尺码：${issueValueList(extraFieldSizes)}`,
    })
  }
  return issues
}

function mdmSkuRowsForSpu(db: SyncPostgresDatabase, spuCode: string) {
  return db.prepare(`
    select
      sku.sku_code,
      sku.ean_code,
      sku.inner_code,
      sku.size_code,
      sku.size_name,
      sku.price_tag,
      skc.skc_code,
      skc.color_code,
      skc.color_name
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    join product_spu spu on spu.id = skc.spu_id
    where spu.spu_code = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(spuCode) as JsonRecord[]
}

function sourceRowsForSpu(db: SyncPostgresDatabase, spuCode: string, sourceBatchId?: number | null) {
  const batchId = numberValue(sourceBatchId)
  const where = ["source.spu_code = ?"]
  const params: unknown[] = [spuCode]
  if (batchId !== null && Number.isInteger(batchId) && batchId > 0) {
    where.push("source.source_batch_id = ?")
    params.push(batchId)
  }
  const rows = db.prepare(`
    select source.*
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where ${where.join(" and ")}
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(...params) as JsonRecord[]
  return activeProductArchiveSourceRows(rows)
}

function sourceRowsForSpuBatchIds(db: SyncPostgresDatabase, spuCode: string, sourceBatchIds: number[]) {
  const batchIds = Array.from(new Set(sourceBatchIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (batchIds.length === 0) return sourceRowsForSpu(db, spuCode, null)
  const rows = db.prepare(`
    select source.*
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_batch_id in (${batchIds.map(() => "?").join(", ")})
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(spuCode, ...batchIds) as JsonRecord[]
  return activeProductArchiveSourceRows(rows)
}

const SHOE_STATIC_EVIDENCE_FIELDS = [
  "鞋品生产企业名称",
  "生产企业名称",
  "生产企业",
  "生产厂家",
  "厂家",
  "工厂",
  "制造商",
  "里料材质",
  "里料",
  "衬里",
  "FAB",
  "大身面料",
]

function sourceRowIdentity(row: JsonRecord) {
  const id = numberValue(row.id)
  if (id !== null && id > 0) return `id:${id}`
  return [
    stringValue(row.source_type),
    numberValue(row.source_batch_id) ?? "",
    stringValue(row.skc_code),
    jsonText(recordValue(row.row_json)),
  ].join("|")
}

function shoeStaticEvidenceRow(row: JsonRecord) {
  if (stringValue(row.source_type) !== "launch_plan") return null
  const source = recordValue(row.row_json)
  const rowJson = Object.fromEntries(
    SHOE_STATIC_EVIDENCE_FIELDS
      .map((field) => [field, source[field]])
      .filter(([, value]) => hasValue(value)),
  )
  if (Object.keys(rowJson).length === 0) return null
  return { ...row, row_json: rowJson, __shoe_static_evidence: true }
}

/**
 * Keep the latest launch-plan batch authoritative for dynamic values, while
 * retaining only static shoe facts from older same-SPU batches as a fallback.
 * This prevents a newer batch that omitted the factory/lining fields from
 * turning a valid shoe draft into an unsafe generic value such as "中国".
 */
export function mergeProductArchiveShoeStaticEvidenceRows(
  rows: JsonRecord[],
  fallbackRows: JsonRecord[] = [],
) {
  const output = activeProductArchiveSourceRows(rows)
  const seen = new Set(output.map(sourceRowIdentity))
  for (const row of fallbackRows) {
    const identity = sourceRowIdentity(row)
    if (seen.has(identity)) continue
    const narrowed = shoeStaticEvidenceRow(row)
    if (!narrowed) continue
    output.push(narrowed)
    seen.add(identity)
  }
  return output
}

function sourceRowsWithShoeStaticEvidenceFallback(
  db: SyncPostgresDatabase,
  spuCode: string,
  spu: JsonRecord,
  rows: JsonRecord[],
) {
  const activeRows = activeProductArchiveSourceRows(rows)
  if (!isShoeProduct(spu, activeRows)) return activeRows
  const fallbackRows = db.prepare(`
    select source.*
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_type = 'launch_plan'
    order by source.skc_code nulls first, source.id desc
  `).all(spuCode) as JsonRecord[]
  return mergeProductArchiveShoeStaticEvidenceRows(activeRows, fallbackRows)
}

function activeProductArchiveSourceRows(rows: JsonRecord[]) {
  const latestLaunchPlanBatchId = Math.max(
    0,
    ...rows
      .filter((row) => stringValue(row.source_type) === "launch_plan")
      .map((row) => numberValue(row.source_batch_id))
      .filter((value): value is number => value !== null && value > 0),
  )
  if (latestLaunchPlanBatchId <= 0) return rows
  return rows.filter((row) => (
    stringValue(row.source_type) !== "launch_plan"
    || row.__shoe_static_evidence === true
    || numberValue(row.source_batch_id) === latestLaunchPlanBatchId
  ))
}

function sourceBatchIdsFromSnapshot(snapshot: JsonRecord) {
  const ids = new Set<number>()
  const legacy = numberValue(snapshot.sourceBatchId)
  if (legacy !== null && legacy > 0) ids.add(legacy)
  const sourceBatchIds = snapshot.sourceBatchIds
  if (Array.isArray(sourceBatchIds)) {
    for (const value of sourceBatchIds) {
      const id = numberValue(value)
      if (id !== null && id > 0) ids.add(id)
    }
  } else {
    const byType = recordValue(sourceBatchIds)
    for (const value of Object.values(byType)) {
      for (const item of arrayValue(value)) {
        const id = numberValue(item)
        if (id !== null && id > 0) ids.add(id)
      }
    }
  }
  return Array.from(ids)
}

function normalizeSourceBatchIds(value: unknown, legacySourceBatchId?: unknown) {
  const byType: Record<string, number[]> = {}
  const push = (sourceType: string, item: unknown) => {
    const id = numberValue(item)
    if (id === null || id <= 0) return
    const key = stringValue(sourceType) || "source"
    byType[key] = byType[key] ?? []
    if (!byType[key].includes(id)) byType[key].push(id)
  }

  if (Array.isArray(value)) {
    for (const item of value) push("source", item)
  } else {
    const record = recordValue(value)
    for (const [sourceType, ids] of Object.entries(record)) {
      for (const item of arrayValue(ids)) push(sourceType, item)
    }
  }

  if (Object.keys(byType).length === 0) {
    push("launch_plan", legacySourceBatchId)
  }
  return byType
}

function sourceBatchIdList(sourceBatchIds: Record<string, number[]>) {
  const ids = new Set<number>()
  for (const values of Object.values(sourceBatchIds)) {
    for (const value of values) {
      if (Number.isInteger(value) && value > 0) ids.add(value)
    }
  }
  return Array.from(ids)
}

function appendResolvedSourceBatchId(target: Record<string, number[]>, sourceType: unknown, sourceBatchId: unknown) {
  const type = stringValue(sourceType)
  const id = numberValue(sourceBatchId)
  if (!['launch_plan', 'copywriting', 'size_chart'].includes(type) || id === null || id <= 0) return
  target[type] = target[type] ?? []
  if (!target[type].includes(id)) target[type].push(id)
}

function sourceBatchesById(db: SyncPostgresDatabase, sourceBatchIds: number[]) {
  const ids = Array.from(new Set(sourceBatchIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return [] as JsonRecord[]
  return db.prepare(`
    select id, source_type
    from product_archive_source_batch
    where id in (${ids.map(() => '?').join(', ')})
      and import_status = 'committed'
  `).all(...ids) as JsonRecord[]
}

function latestSourceBatchesForSpu(db: SyncPostgresDatabase, spuCode: string, sourceTypes: string[]) {
  const types = Array.from(new Set(sourceTypes.filter((type) => ['copywriting', 'launch_plan', 'size_chart'].includes(type))))
  if (!spuCode || types.length === 0) return [] as JsonRecord[]
  return db.prepare(`
    select distinct on (source.source_type)
      source.source_type,
      source.source_batch_id
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      and source.source_type in (${types.map(() => '?').join(', ')})
    order by source.source_type, source.source_batch_id desc
  `).all(spuCode, ...types) as JsonRecord[]
}

export function resolveDraftSourceBatchIdsForSpu(
  db: SyncPostgresDatabase,
  spuCode: string,
  sourceBatchIds?: Record<string, number[]> | number[] | null,
  legacySourceBatchId?: unknown,
) {
  const requested = normalizeSourceBatchIds(sourceBatchIds, legacySourceBatchId)
  const resolved: Record<string, number[]> = {}
  for (const batch of sourceBatchesById(db, sourceBatchIdList(requested))) {
    appendResolvedSourceBatchId(resolved, batch.source_type, batch.id)
  }

  const latestTypes = ["launch_plan"]
  if ((resolved.copywriting?.length ?? 0) === 0) latestTypes.push("copywriting")
  if ((resolved.size_chart?.length ?? 0) === 0) latestTypes.push("size_chart")
  for (const batch of latestSourceBatchesForSpu(db, spuCode, latestTypes)) {
    appendResolvedSourceBatchId(resolved, batch.source_type, batch.source_batch_id)
  }

  if ((resolved.copywriting?.length ?? 0) > 0) {
    for (const batch of latestSourceBatchesForSpu(db, spuCode, ['launch_plan', 'size_chart'])) {
      appendResolvedSourceBatchId(resolved, batch.source_type, batch.source_batch_id)
    }
  } else if ((resolved.launch_plan?.length ?? 0) > 0 && (resolved.size_chart?.length ?? 0) === 0) {
    for (const batch of latestSourceBatchesForSpu(db, spuCode, ['size_chart'])) {
      appendResolvedSourceBatchId(resolved, batch.source_type, batch.source_batch_id)
    }
  } else if (sourceBatchIdList(resolved).length === 0) {
    for (const batch of latestSourceBatchesForSpu(db, spuCode, ['launch_plan', 'size_chart'])) {
      appendResolvedSourceBatchId(resolved, batch.source_type, batch.source_batch_id)
    }
  }
  return resolved
}

function copywritingBatchWasDeclaredAsLaunchPlan(snapshot: JsonRecord, batches: JsonRecord[]) {
  const declared = normalizeSourceBatchIds(snapshot.sourceBatchIds, snapshot.sourceBatchId)
  const declaredLaunchPlanIds = new Set(declared.launch_plan ?? [])
  const legacySourceBatchId = numberValue(snapshot.sourceBatchId)
  return batches.some((batch) => (
    stringValue(batch.source_type) === "copywriting"
    && (declaredLaunchPlanIds.has(numberValue(batch.id) ?? 0) || legacySourceBatchId === numberValue(batch.id))
  ))
}

function sourceSnapshotWithResolvedBatchIds(snapshot: JsonRecord, sourceBatchIds: Record<string, number[]>) {
  return {
    ...snapshot,
    sourceBatchId: sourceBatchIds.launch_plan?.[0] ?? null,
    sourceBatchIds,
  }
}

export function backfillCopywritingTriggeredDraftSourceBatches(
  db: SyncPostgresDatabase,
  options: { apply?: boolean; onlyMissingTrade?: boolean } = {},
) {
  const apply = options.apply === true
  const missingTradeFilter = options.onlyMissingTrade === true
    ? "and (trade_id is null or nullif(trim(coalesce(trade_path, '')), '') is null)"
    : ""
  const drafts = db.prepare(`
    select *
    from product_archive_draft
    where status in ('draft', 'missing_fields', 'manual_review', 'ready')
      ${missingTradeFilter}
    order by updated_at desc, id desc
  `).all() as JsonRecord[]
  const items: Array<{
    draftId: number
    draftNo: string
    spuCode: string
    action: "preview" | "applied" | "human_preserved" | "manual_selection_required" | "skipped_changed" | "failed"
    sourceBatchIds: Record<string, number[]>
    message: string
  }> = []

  for (const draft of drafts) {
    const draftId = numberValue(draft.id)
    if (draftId === null) continue
    const snapshot = recordValue(draft.source_snapshot_json)
    const batches = sourceBatchesById(db, sourceBatchIdsFromSnapshot(snapshot))
    if (!copywritingBatchWasDeclaredAsLaunchPlan(snapshot, batches)) continue

    const sourceBatchIds = resolveDraftSourceBatchIdsForSpu(
      db,
      stringValue(draft.spu_code),
      recordValue(snapshot.sourceBatchIds),
      snapshot.sourceBatchId,
    )
    const base = {
      draftId,
      draftNo: stringValue(draft.draft_no),
      spuCode: stringValue(draft.spu_code),
      sourceBatchIds,
    }
    if (!apply) {
      items.push({
        ...base,
        action: "preview",
        message: "预览：将纠正文案表来源，并回溯该款的上市计划和尺码表来源。",
      })
      continue
    }

    try {
      const item = db.transaction((): (typeof items)[number] => {
        const currentDraft = db.prepare(`
          select *
          from product_archive_draft
          where id = ?
          for update
        `).get(draftId) as JsonRecord | undefined
        if (!currentDraft) {
          return {
            ...base,
            action: "skipped_changed",
            message: "草稿已不存在，未执行来源回填。",
          }
        }
        const currentSnapshot = recordValue(currentDraft.source_snapshot_json)
        const currentBatches = sourceBatchesById(db, sourceBatchIdsFromSnapshot(currentSnapshot))
        if (!copywritingBatchWasDeclaredAsLaunchPlan(currentSnapshot, currentBatches)) {
          return {
            ...base,
            action: "skipped_changed",
            message: "草稿来源已被其他操作更新，未覆盖。",
          }
        }
        const currentSourceBatchIds = resolveDraftSourceBatchIdsForSpu(
          db,
          stringValue(currentDraft.spu_code),
          recordValue(currentSnapshot.sourceBatchIds),
          currentSnapshot.sourceBatchId,
        )
        const nextSnapshot = sourceSnapshotWithResolvedBatchIds(currentSnapshot, currentSourceBatchIds)
        db.prepare(`
          update product_archive_draft
          set source_snapshot_json = ?::jsonb,
            updated_at = ?::timestamptz
          where id = ?
        `).run(jsonText(nextSnapshot), nowIso(), draftId)

        const refreshedTrade = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
        if (hasHumanTradeSelection(currentSnapshot)) {
          return {
            ...base,
            sourceBatchIds: currentSourceBatchIds,
            action: "human_preserved",
            message: "已修正来源；人工选择的类目保持不变。",
          }
        }
        if (refreshedTrade.noMatch) {
          return {
            ...base,
            sourceBatchIds: currentSourceBatchIds,
            action: "manual_selection_required",
            message: "已修正来源，但当前上市计划无法自动匹配深绘类目。",
          }
        }
        return {
          ...base,
          sourceBatchIds: currentSourceBatchIds,
          action: "applied",
          message: "已修正来源并重新计算深绘类目。",
        }
      })()
      items.push(item)
    } catch (error) {
      items.push({
        ...base,
        action: "failed",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    mode: apply ? "apply" : "preview",
    scannedDraftCount: drafts.length,
    matchedDraftCount: items.length,
    appliedDraftCount: items.filter((item) => item.action === "applied" || item.action === "human_preserved" || item.action === "manual_selection_required").length,
    previewCount: items.filter((item) => item.action === "preview").length,
    autoMatchedTradeCount: items.filter((item) => item.action === "applied").length,
    humanPreservedCount: items.filter((item) => item.action === "human_preserved").length,
    manualSelectionCount: items.filter((item) => item.action === "manual_selection_required").length,
    skippedChangedCount: items.filter((item) => item.action === "skipped_changed").length,
    failedCount: items.filter((item) => item.action === "failed").length,
    items,
  }
}

function appendSourceBatchId(snapshot: JsonRecord, sourceType: string, sourceBatchId: number) {
  const next = { ...snapshot }
  const byType = { ...recordValue(next.sourceBatchIds) }
  const current = arrayValue(byType[sourceType])
    .map((value) => numberValue(value))
    .filter((value): value is number => value !== null && value > 0)
  byType[sourceType] = sourceType === "launch_plan"
    ? [sourceBatchId]
    : current.includes(sourceBatchId) ? current : [...current, sourceBatchId]
  next.sourceBatchIds = byType
  if (sourceType === "launch_plan") {
    next.sourceBatchId = sourceBatchId
  }
  return next
}

function appendSourceBatchIdToDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  sourceType: string,
  sourceBatchId: number,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const draft = draftById(db, draftId)
    const currentSnapshot = recordValue(draft.source_snapshot_json)
    const nextSnapshot = appendSourceBatchId(currentSnapshot, sourceType, sourceBatchId)
    const result = db.prepare(`
      update product_archive_draft
      set source_snapshot_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
        and trade_id is not distinct from ?
        and source_snapshot_json is not distinct from ?::jsonb
    `).run(
      jsonText(nextSnapshot),
      nowIso(),
      draftId,
      draft.trade_id ?? null,
      jsonText(currentSnapshot),
    )
    if (Number(result.changes ?? 0) > 0) return
  }
  throw new Error("草稿数据持续更新，来源批次刷新未完成，请稍后重试")
}

function sourceRowsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  const snapshot = recordValue(draft.source_snapshot_json)
  const requestedSourceBatchIds = Array.isArray(snapshot.sourceBatchIds)
    ? snapshot.sourceBatchIds
    : recordValue(snapshot.sourceBatchIds)
  const resolvedSourceBatchIds = resolveDraftSourceBatchIdsForSpu(
    db,
    stringValue(draft.spu_code),
    requestedSourceBatchIds,
    snapshot.sourceBatchId,
  )
  const batchIds = sourceBatchIdList(resolvedSourceBatchIds)
  const rows = batchIds.length > 0
    ? sourceRowsForSpuBatchIds(db, stringValue(draft.spu_code), batchIds)
    : sourceRowsForSpu(
        db,
        stringValue(draft.spu_code),
        numberValue(snapshot.sourceBatchId),
      )
  let spu: JsonRecord = recordValue(recordValue(draft.source_snapshot_json).spu)
  try {
    spu = resolveProductArchiveDraftSpu(db, draft)
  } catch {
    // Legacy backfill previews may only carry the snapshot source rows. They
    // should retain the pre-existing source scope when no live MDM row exists.
  }
  return sourceRowsWithShoeStaticEvidenceFallback(db, stringValue(draft.spu_code), spu, rows)
}

function referenceSourceRowsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  const rows = sourceRowsForDraft(db, draft)
  if (rows.some((row) => stringValue(row.source_type) === "launch_plan")) return rows
  const snapshotRows = arrayValue(recordValue(draft.source_snapshot_json).sourceRows)
    .map((row) => recordValue(row))
  return [...rows, ...snapshotRows]
}

export function missingMdmSpuCodes(db: SyncPostgresDatabase, sourceBatchId: number) {
  if (!Number.isInteger(sourceBatchId) || sourceBatchId <= 0) return []
  const rows = db.prepare(`
    select distinct source.spu_code
    from product_archive_source_row source
    left join product_spu spu on spu.spu_code = source.spu_code
    where source.source_batch_id = ?
      and source.spu_code is not null
      and source.spu_code <> ''
      and spu.id is null
    order by source.spu_code
  `).all(sourceBatchId) as Array<{ spu_code: unknown }>
  return rows.map((row) => stringValue(row.spu_code)).filter(Boolean)
}

export function missingDraftSpuCodes(db: SyncPostgresDatabase, sourceBatchId: number, input: {
  tenantName?: string | null
  merchantId?: string | null
} = {}) {
  if (!Number.isInteger(sourceBatchId) || sourceBatchId <= 0) return []
  const tenantName = stringValue(input.tenantName)
  const merchantId = stringValue(input.merchantId)
  if (!tenantName || !merchantId) return []
  const rows = db.prepare(`
    select distinct source.spu_code
    from product_archive_source_row source
    left join product_archive_draft draft
      on draft.spu_code = source.spu_code
     and draft.tenant_name = ?
     and draft.merchant_id = ?
    where source.source_batch_id = ?
      and source.spu_code is not null
      and source.spu_code <> ''
      and draft.id is null
    order by source.spu_code
  `).all(tenantName, merchantId, sourceBatchId) as Array<{ spu_code: unknown }>
  return rows.map((row) => stringValue(row.spu_code)).filter(Boolean)
}

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
]

function launchPlanSourceRows(sourceRows: JsonRecord[]) {
  return sourceRows.filter((row) => stringValue(row.source_type) === "launch_plan")
}

function launchPlanSourceBatchId(row: JsonRecord) {
  return numberValue(row.source_batch_id ?? row.sourceBatchId)
}

function latestNonEmptyLaunchPlanValues(sourceRows: JsonRecord[], aliases: string[]) {
  const launchPlanRows = launchPlanSourceRows(sourceRows)
  const batchIds = uniqueTextValues(launchPlanRows
    .map((row) => launchPlanSourceBatchId(row))
    .filter((value): value is number => value !== null && value > 0)
    .map(String))
    .map(Number)
    .sort((left, right) => right - left)
  const groups = batchIds.map((batchId) => launchPlanRows.filter((row) => launchPlanSourceBatchId(row) === batchId))
  const unbatchedRows = launchPlanRows.filter((row) => launchPlanSourceBatchId(row) === null)
  if (unbatchedRows.length > 0) groups.push(unbatchedRows)
  if (groups.length === 0) groups.push(launchPlanRows)
  for (const rows of groups) {
    const values = uniqueTextValues(rows.flatMap((row) => {
      const rowJson = recordValue(row.row_json)
      return aliases.map((alias) => rowJson[alias])
    }).filter(isMeaningfulLaunchPlanValue))
    if (values.length > 0) return values
  }
  return []
}

function isMeaningfulLaunchPlanValue(value: unknown) {
  const text = stringValue(value)
  const normalized = text.replace(/\s+/g, "")
  return Boolean(text) && !["/", "-", "--", "—", "0", "无", "暂无", "null", "NULL"].includes(normalized)
}

function normalizeTradeText(value: unknown) {
  return stringValue(value)
    .replace(/[＞〉》]/g, ">")
    .replace(/》/g, ">")
    .replace(/\/+/g, ">")
    .replace(/>+/g, ">")
    .replace(/\s+/g, "")
    .replace(/^>+|>+$/g, "")
}

function tradeLeaf(value: string) {
  const normalized = normalizeTradeText(value)
  const parts = normalized.split(">").filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

function officialCategoryLeaf(value: string) {
  const text = stringValue(value)
    .replace(/[＞〉》]/g, ">")
    .replace(/>+/g, ">")
  const parts = text.split(">").map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? text.trim()
}

function normalizeOfficialTradeSearchText(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").toLowerCase()
}

function officialCategoryLeafTerms(value: string) {
  return uniqueTextValues(
    value
      .split(/[/／,，;；、]/)
      .map((part) => normalizeOfficialTradeSearchText(part))
      .filter((part) => part.length >= 2),
  )
}

const LAUNCH_PLAN_CATEGORY_MATCH_ALIASES: Array<{ patterns: string[]; aliases: string[] }> = [
  { patterns: ["毛衫"], aliases: ["毛衣", "针织衫"] },
  { patterns: ["便服"], aliases: ["T恤"] },
  { patterns: ["长袖T恤", "短袖T恤"], aliases: ["T恤"] },
  { patterns: ["长袖衬衫", "短袖衬衫"], aliases: ["衬衫"] },
  { patterns: ["大衣"], aliases: ["呢大衣"] },
  { patterns: ["长袖套装"], aliases: ["套装"] },
  { patterns: ["针织长裤"], aliases: ["长裤"] },
  { patterns: ["运动裤卫裤", "休闲裤"], aliases: ["长裤"] },
  { patterns: ["休闲鞋", "运动休闲鞋", "时尚生活鞋"], aliases: ["板鞋", "运动鞋"] },
  { patterns: ["跑步鞋", "运动生活鞋"], aliases: ["运动鞋"] },
  { patterns: ["鞋配饰"], aliases: ["鞋配件"] },
  { patterns: ["杯子"], aliases: ["水杯"] },
  { patterns: ["宝宝鞋"], aliases: ["学步鞋", "婴儿鞋"] },
  { patterns: ["外出连体衣", "内着连体衣"], aliases: ["连身衣", "爬服", "哈衣"] },
  { patterns: ["内着上衣"], aliases: ["婴儿内衣"] },
  { patterns: ["内衣"], aliases: ["内衣套装"] },
  { patterns: ["短裙"], aliases: ["半身裙"] },
  { patterns: ["婴童寝具"], aliases: ["婴幼儿寝具", "家居床品"] },
  { patterns: ["婴童礼盒"], aliases: ["婴儿礼盒"] },
  { patterns: ["文胸"], aliases: ["运动文胸"] },
  { patterns: ["包"], aliases: ["儿童包包", "包包"] },
  { patterns: ["饰品"], aliases: ["女童发饰", "发饰"] },
]

function launchPlanCategorySearchValues(value: unknown) {
  const text = stringValue(value)
  const normalized = normalizeOfficialTradeSearchText(text)
  const aliases: string[] = []
  for (const rule of LAUNCH_PLAN_CATEGORY_MATCH_ALIASES) {
    if (rule.patterns.some((pattern) => normalized.includes(normalizeOfficialTradeSearchText(pattern)))) {
      aliases.push(...rule.aliases)
    }
  }
  return uniqueTextValues([text, ...aliases])
}

interface WeightedTradeContextTerm {
  value: string
  weight: number
}

function categoryPathContextTerms(value: unknown) {
  const text = stringValue(value)
    .replace(/[＞〉》]/g, ">")
    .replace(/\/+/g, ">")
    .replace(/>+/g, ">")
  const parts = text.split(">").map((part) => part.trim()).filter(Boolean)
  return parts.slice(0, -1)
}

function addWeightedTradeContextTerm(
  terms: WeightedTradeContextTerm[],
  seen: Set<string>,
  value: unknown,
  weight: number,
) {
  const normalized = normalizeOfficialTradeSearchText(value)
  if (normalized.length < 2 || seen.has(normalized)) return
  seen.add(normalized)
  terms.push({ value: normalized, weight })
}

function sourceGenderContextTerms(value: unknown) {
  const text = normalizeOfficialTradeSearchText(value)
  if (!text) return []
  if (text.includes("女") && text.includes("男")) return []
  if (text.includes("女")) return ["女童", "女"]
  if (text.includes("男")) return ["男童", "男"]
  if (text === "中" || text.includes("中性")) return ["中性"]
  return [text]
}

function sourceGenderContextTermsForValues(values: unknown[]) {
  const genderKeys = new Set<"female" | "male" | "neutral">()
  const fallbackValues: unknown[] = []
  for (const value of values) {
    const text = normalizeOfficialTradeSearchText(value)
    if (!text) continue
    const hasFemale = text.includes("女")
    const hasMale = text.includes("男")
    if (hasFemale && hasMale) {
      genderKeys.add("neutral")
    } else if (hasFemale) {
      genderKeys.add("female")
    } else if (hasMale) {
      genderKeys.add("male")
    } else if (text === "中" || text.includes("中性")) {
      genderKeys.add("neutral")
    } else {
      fallbackValues.push(value)
    }
  }
  if (genderKeys.size > 1) return []
  if (genderKeys.has("female")) return ["女童", "女"]
  if (genderKeys.has("male")) return ["男童", "男"]
  if (genderKeys.has("neutral")) return ["中性"]
  return fallbackValues.flatMap(sourceGenderContextTerms)
}

function sourceAgeContextTerms(value: unknown) {
  const text = normalizeOfficialTradeSearchText(value)
  if (!text) return []
  if (text.includes("婴") || text.includes("幼")) return [text, "婴幼儿"]
  if (text.includes("中童")) return [text, "中大童", "儿童"]
  if (text.includes("大童")) return [text, "中大童", "儿童"]
  return [text]
}

function launchPlanTradeContextTerms(
  sourceRows: JsonRecord[],
  categories: Array<{ field: string; value: string }>,
  input: { allowShoeGender?: boolean } = {},
) {
  const terms: WeightedTradeContextTerm[] = []
  const seen = new Set<string>()
  const genderValues: unknown[] = []
  const shoeCategory = categories.some((category) => normalizeOfficialTradeSearchText(category.value).includes("鞋"))
  const suppressShoeGender = shoeCategory && input.allowShoeGender !== true
  for (const category of categories) {
    const weight = category.field.includes("官方") ? 90 : category.field.includes("唯品四级") ? 70 : 55
    for (const term of categoryPathContextTerms(category.value)) {
      if (suppressShoeGender && /^(?:男童鞋|女童鞋)$/.test(normalizeOfficialTradeSearchText(term))) continue
      addWeightedTradeContextTerm(terms, seen, term, weight)
    }
  }
  for (const value of latestNonEmptyLaunchPlanValues(
    sourceRows,
    ["小类", "子类", "细分类目", "主款式 （唯品四级品类）", "主款式（唯品四级品类）"],
  )) {
    addWeightedTradeContextTerm(terms, seen, value, 65)
  }
  for (const value of latestNonEmptyLaunchPlanValues(sourceRows, ["品类", "类目", "分类"])) {
    addWeightedTradeContextTerm(terms, seen, value, 35)
  }
  genderValues.push(...latestNonEmptyLaunchPlanValues(sourceRows, ["性别", "适用性别"]))
  for (const value of latestNonEmptyLaunchPlanValues(sourceRows, ["年龄段", "适用年龄", "年龄"])) {
    for (const term of sourceAgeContextTerms(value)) {
      addWeightedTradeContextTerm(terms, seen, term, 30)
    }
  }
  if (!suppressShoeGender) {
    for (const term of sourceGenderContextTermsForValues(genderValues)) {
      addWeightedTradeContextTerm(terms, seen, term, 35)
    }
  }
  return terms
}

function isGenderSegmentedShoeTrade(trade: JsonRecord) {
  const path = normalizeOfficialTradeSearchText(stringValue(trade.trade_path) || stringValue(trade.trade_name))
  return path.includes("男童鞋") || path.includes("女童鞋")
}

function tradeContextMatchScore(trade: JsonRecord, terms: WeightedTradeContextTerm[]) {
  if (terms.length === 0) return 0
  const candidatePathText = normalizeOfficialTradeSearchText(stringValue(trade.trade_path))
  const candidateNameText = normalizeOfficialTradeSearchText(stringValue(trade.trade_name))
  const candidateText = `${candidatePathText}${candidateNameText}`
  if (!candidateText) return 0
  return terms.reduce((score, term) => (
    term.value && candidateText.includes(term.value) ? score + term.weight : score
  ), 0)
}

function launchPlanCategoryValues(sourceRows: JsonRecord[]) {
  const values: Array<{ field: string; value: string }> = []
  const seen = new Set<string>()
  for (const referenceField of LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS) {
    for (const value of latestNonEmptyLaunchPlanValues(sourceRows, referenceField.aliases)) {
      const field = referenceField.label
      const key = `${field}:${value}`
      if (!value || seen.has(key)) continue
      seen.add(key)
      values.push({ field, value })
    }
  }
  return values
}

export function buildLaunchPlanCategoryReference(sourceRows: JsonRecord[]) {
  const fields: Array<{ key: string; label: string; value: string }> = []
  for (const field of LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS) {
    const uniqueValues = latestNonEmptyLaunchPlanValues(sourceRows, field.aliases)
    if (uniqueValues.length > 0) {
      fields.push({
        key: field.key,
        label: field.label,
        value: uniqueValues.join("；"),
      })
    }
  }
  return {
    matched: fields.length > 0,
    fields,
  }
}

function scoreTradeMatchValue(
  trade: JsonRecord,
  category: { field: string; value: string },
  searchValue: string,
  aliasPenalty: number,
) {
  const candidatePath = stringValue(trade.trade_path) || stringValue(trade.trade_name)
  const candidateName = stringValue(trade.trade_name)
  const categoryText = normalizeTradeText(searchValue)
  const candidatePathText = normalizeTradeText(candidatePath)
  const candidateNameText = normalizeTradeText(candidateName)
  const categoryLeaf = tradeLeaf(searchValue)
  const candidateLeaf = tradeLeaf(candidatePath)
  if (!categoryText || (!candidatePathText && !candidateNameText)) return 0
  const fieldBoost = category.field.includes("官方") ? 400 : category.field.includes("唯品四级") ? 20 : 10
  const pathBoost = candidatePathText.includes("童装服饰") ? 40 : 0
  const categoryContext = categoryText.split(">").slice(0, -1)
  const contextBoost = uniqueTextValues(categoryContext)
    .filter((segment) => segment.length >= 2 && candidatePathText.includes(segment))
    .length * 30
  const boost = fieldBoost + pathBoost + contextBoost - aliasPenalty
  if (candidatePathText === categoryText) return 1000 + boost
  if (candidateNameText === categoryText) return 850 + boost
  if (candidateNameText && candidateNameText === categoryLeaf) return 760 + boost
  if (candidatePathText.endsWith(`>${categoryLeaf}`) || candidatePathText === categoryLeaf) return 720 + boost
  if (categoryLeaf && candidatePathText.includes(categoryLeaf)) return 520 + boost
  if (categoryLeaf && candidateLeaf && categoryLeaf.includes(candidateLeaf)) return 500 + boost
  if (categoryLeaf && candidateNameText && categoryLeaf.includes(candidateNameText)) return 480 + boost
  return 0
}

function scoreTradeMatch(trade: JsonRecord, category: { field: string; value: string }) {
  return launchPlanCategorySearchValues(category.value)
    .map((searchValue, index) => scoreTradeMatchValue(trade, category, searchValue, index === 0 ? 0 : 90))
    .reduce((best, score) => Math.max(best, score), 0)
}

function isBrandPrivateDeepdrawTrade(trade: JsonRecord) {
  const candidatePath = normalizeTradeText(stringValue(trade.trade_path) || stringValue(trade.trade_name)).toLowerCase()
  return candidatePath === "blbl&mini" || candidatePath.startsWith("blbl&mini>")
}

const BALA_DEEPDRAW_TENANT = "电商巴拉巴拉"

interface DeepdrawTradePriorityRule {
  key: "first" | "second" | "fallback"
  label: string
  roots: ReadonlyMap<string, string>
  branches: ReadonlyMap<string, string>
}

const BALA_DEEPDRAW_TRADE_PRIORITY: DeepdrawTradePriorityRule[] = [
  {
    key: "first",
    label: "第一优先级",
    roots: new Map([
      ["7", "童装婴幼儿服装"],
      ["531", "童鞋/亲子鞋"],
      ["9483", "寝具服饰"],
    ]),
    branches: new Map([
      ["6741", "运动/瑜伽/健身/球迷用品 / 游泳 / 亲子家庭装"],
      ["6744", "运动/瑜伽/健身/球迷用品 / 游泳 / 儿童泳衣/裤"],
      ["905", "运动中性鞋 / 女童鞋"],
      ["10087", "运动中性鞋 / 男童鞋"],
    ]),
  },
  {
    key: "second",
    label: "第二优先级",
    roots: new Map([
      ["3245", "尿片/洗护/喂哺/推车床"],
      ["3525", "婴幼儿寝具"],
      ["893", "玩具/模型/动漫/早教/益智"],
    ]),
    branches: new Map(),
  },
  {
    key: "fallback",
    label: "兜底优先级",
    roots: new Map([["9631", "blbl&mini"]]),
    branches: new Map(),
  },
]

interface PrioritizedDeepdrawTrade {
  trade: JsonRecord
  policyRootName: string | null
}

interface DeepdrawTradePriorityTier {
  key: DeepdrawTradePriorityRule["key"] | "default"
  label: string | null
  candidates: PrioritizedDeepdrawTrade[]
}

function deepdrawTradeAncestorIds(trade: JsonRecord, tradesById: Map<string, JsonRecord>) {
  const ids: string[] = []
  const visited = new Set<string>()
  let current: JsonRecord | undefined = trade
  while (current) {
    const tradeId = stringValue(current.trade_id)
    if (!tradeId || visited.has(tradeId)) break
    ids.push(tradeId)
    visited.add(tradeId)
    const parentId = stringValue(current.parent_trade_id)
    current = parentId ? tradesById.get(parentId) : undefined
  }
  return ids
}

function deepdrawTradePriorityTiers(tenantName: string, trades: JsonRecord[]): DeepdrawTradePriorityTier[] {
  if (tenantName !== BALA_DEEPDRAW_TENANT) {
    return [{
      key: "default",
      label: null,
      candidates: trades
        .filter((trade) => !isBrandPrivateDeepdrawTrade(trade))
        .map((trade) => ({ trade, policyRootName: null })),
    }]
  }
  const tradesById = new Map(
    trades
      .map((trade) => [stringValue(trade.trade_id), trade] as const)
      .filter(([tradeId]) => Boolean(tradeId)),
  )
  return BALA_DEEPDRAW_TRADE_PRIORITY.map((rule) => {
    const candidates: PrioritizedDeepdrawTrade[] = []
    for (const trade of trades) {
      const ancestorIds = deepdrawTradeAncestorIds(trade, tradesById)
      let policyRootName: string | null = null
      for (const ancestorId of ancestorIds) {
        policyRootName = rule.branches.get(ancestorId) ?? rule.roots.get(ancestorId) ?? null
        if (policyRootName) break
      }
      if (policyRootName) candidates.push({ trade, policyRootName })
    }
    return {
      key: rule.key,
      label: rule.label,
      candidates,
    }
  })
}

function tradePlatformValues(trade: JsonRecord) {
  const rawValue = trade.third_platforms ?? trade.thirdPlatforms
  const values = Array.isArray(rawValue) ? rawValue : stringValue(rawValue).split(/[,，;；]/)
  return new Set(values.map((value) => stringValue(value).toUpperCase()).filter(Boolean))
}

function hasTradePlatformMetadata(trade: JsonRecord) {
  return Object.prototype.hasOwnProperty.call(trade, "third_platforms")
    || Object.prototype.hasOwnProperty.call(trade, "thirdPlatforms")
}

function requiredLaunchPlanPlatformGroups(categories: Array<{ field: string; value: string }>) {
  const groups: string[][] = []
  if (categories.some((category) => category.field.includes("官方"))) {
    groups.push(["ALIBABA"], ["PDD"], ["TAOBAO"], ["KUAISHOU"])
  }
  if (categories.some((category) => category.field.includes("唯品发布"))) groups.push(["VIP"])
  if (categories.some((category) => category.field.includes("抖音"))) groups.push(["DOUYIN", "DOUYINXSG"])
  return groups
}

function tradeCoversPlatformGroups(trade: JsonRecord, groups: string[][]) {
  const platforms = tradePlatformValues(trade)
  return groups.every((group) => group.some((platform) => platforms.has(platform)))
}

function tradePathDepth(trade: JsonRecord) {
  return normalizeTradeText(stringValue(trade.trade_path) || stringValue(trade.trade_name)).split(">").filter(Boolean).length
}

function shouldPreferTradeMatch(
  current: { score: number; tieBreakScore: number; pathDepth: number },
  best: { score: number; tieBreakScore: number; pathDepth: number },
) {
  if (current.score !== best.score) return current.score > best.score
  if (current.tieBreakScore !== best.tieBreakScore) return current.tieBreakScore > best.tieBreakScore
  return current.tieBreakScore > 0 && current.pathDepth < best.pathDepth
}

function isTradeMatchTie(
  current: { score: number; tieBreakScore: number; pathDepth: number },
  best: { score: number; tieBreakScore: number; pathDepth: number },
) {
  if (current.score !== best.score || current.tieBreakScore !== best.tieBreakScore) return false
  return current.tieBreakScore <= 0 || current.pathDepth === best.pathDepth
}

function sourceContextHasTerm(contextTerms: WeightedTradeContextTerm[], pattern: string) {
  const normalized = normalizeOfficialTradeSearchText(pattern)
  return contextTerms.some((term) => term.value.includes(normalized))
}

function categorySearchTextIncludes(categories: Array<{ field: string; value: string }>, pattern: string) {
  const normalized = normalizeOfficialTradeSearchText(pattern)
  return categories.some((category) => (
    launchPlanCategorySearchValues(category.value)
      .some((value) => normalizeOfficialTradeSearchText(value).includes(normalized))
  ))
}

function tradeTieBreakScore(
  trade: JsonRecord,
  categories: Array<{ field: string; value: string }>,
  contextTerms: WeightedTradeContextTerm[],
) {
  const pathText = normalizeOfficialTradeSearchText(stringValue(trade.trade_path) || stringValue(trade.trade_name))
  const maleSource = sourceContextHasTerm(contextTerms, "男童") || sourceContextHasTerm(contextTerms, "男")
  const femaleSource = sourceContextHasTerm(contextTerms, "女童") || sourceContextHasTerm(contextTerms, "女")
  const neutralSource = sourceContextHasTerm(contextTerms, "中性")
  const infantSource = sourceContextHasTerm(contextTerms, "婴幼儿") || sourceContextHasTerm(contextTerms, "婴童") || sourceContextHasTerm(contextTerms, "幼童")
  let score = 0
  const pathIncludes = (pattern: string) => pathText.includes(normalizeOfficialTradeSearchText(pattern))
  const hasCategory = (pattern: string) => categorySearchTextIncludes(categories, pattern)
  const addChildApparelLeafScore = (patterns: string[], leaf: string) => {
    if (!patterns.some(hasCategory)) return
    if (maleSource && pathIncludes(`童装婴幼儿服装 / 男童 / ${leaf}`)) score += 200
    if (femaleSource && pathIncludes(`童装婴幼儿服装 / 中大童 / ${leaf}`)) score += 170
    if (neutralSource && pathIncludes(`童装婴幼儿服装 / 中性童装 / ${leaf}`)) score += 190
    if ((neutralSource || infantSource) && pathIncludes(`童装婴幼儿服装 / ${leaf}`)) score += 160
    if (pathIncludes(`童装婴幼儿服装 / ${leaf}`)) score += 130
    if (pathIncludes(`童装婴幼儿服装 / 中大童 / ${leaf}`)) score += 80
  }
  if (maleSource && pathText.includes("男童")) score += 140
  if (femaleSource && pathText.includes("女童")) score += 140
  if (neutralSource && pathText.includes("中性")) score += 140

  addChildApparelLeafScore(["羽绒服"], "羽绒服")
  addChildApparelLeafScore(["马甲"], "马甲")
  addChildApparelLeafScore(["羽绒马甲"], "羽绒马甲")
  addChildApparelLeafScore(["卫衣"], "卫衣")
  addChildApparelLeafScore(["T恤", "长袖T恤", "便服"], "T恤")
  addChildApparelLeafScore(["衬衫", "长袖衬衫"], "衬衫")
  addChildApparelLeafScore(["连衣裙"], "连衣裙")
  addChildApparelLeafScore(["套装", "长袖套装"], "套装")
  addChildApparelLeafScore(["大衣", "呢大衣"], "呢大衣")
  addChildApparelLeafScore(["背心"], "背心")
  addChildApparelLeafScore(["中裤"], "中裤")

  if (hasCategory("家居服")) {
    if (hasCategory("家居服套装") && pathIncludes("童装婴幼儿服装 / 儿童家居服 / 家居服套装")) score += 220
    if (maleSource && pathIncludes("童装婴幼儿服装 / 男童 / 家居服套装")) score += 170
    if (pathIncludes("童装婴幼儿服装 / 儿童家居服")) score += 180
  }
  if ((hasCategory("休闲鞋") || hasCategory("运动休闲鞋") || hasCategory("时尚生活鞋")) && pathIncludes("童鞋/亲子鞋 / 板鞋")) score += 190
  if ((hasCategory("运动鞋") || hasCategory("跑步鞋") || hasCategory("运动生活鞋")) && pathIncludes("童鞋/亲子鞋 / 运动鞋")) score += 180
  if (hasCategory("户外鞋") && pathIncludes("童鞋/亲子鞋 / 户外鞋")) score += 180
  if (hasCategory("雪地靴") && pathIncludes("童鞋/亲子鞋 / 雪地靴")) score += 190
  if (hasCategory("靴子") && pathIncludes("童鞋/亲子鞋 / 靴子")) score += 170
  if (hasCategory("稳步鞋") && pathIncludes("童鞋/亲子鞋 / 稳步鞋")) score += 220
  if ((hasCategory("鞋配饰") || hasCategory("鞋配件")) && pathIncludes("童鞋/亲子鞋 / 鞋配件")) score += 200
  if ((hasCategory("杯子") || hasCategory("水杯")) && pathIncludes("尿片/洗护/喂哺/推车床 / 水杯/餐具/研磨 / 水杯")) score += 220
  if ((hasCategory("婴童礼盒") || hasCategory("婴儿礼盒")) && pathIncludes("寝具服饰 / 婴儿礼盒")) score += 180
  if (hasCategory("灯笼裤") && pathIncludes("童装婴幼儿服装 / 中大童 / 灯笼裤")) score += 220
  if (categorySearchTextIncludes(categories, "内裤") && pathText.includes("儿童内衣裤/内裤")) score += 220
  if (categorySearchTextIncludes(categories, "内衣") && pathText.includes("儿童内衣裤/内衣套装")) score += 220
  if (categorySearchTextIncludes(categories, "长裤")) {
    if (neutralSource && pathText.includes("中性童装/长裤")) score += 180
    if (maleSource && pathText.includes("男童/长裤")) score += 180
    if (femaleSource && pathText.includes("中大童/长裤")) score += 100
    if (!neutralSource && pathText.includes("中大童/长裤")) score += 80
    if (pathText.includes("童装婴幼儿服装/裤子")) score += 60
  }
  if (categorySearchTextIncludes(categories, "棉服")) {
    if (maleSource && pathText.includes("男童/棉服")) score += 180
    if (!maleSource && pathText.includes("中大童/棉服")) score += 100
  }
  if (categorySearchTextIncludes(categories, "毛衫") || categorySearchTextIncludes(categories, "毛衣")) {
    if (maleSource && pathText.includes("男童/毛衣")) score += 180
    if (!maleSource && pathText.includes("中大童/毛衣")) score += 100
    if (pathText.includes("童装婴幼儿服装/毛衣")) score += 80
    if (pathText.includes("童装婴幼儿服装/针织衫")) score += 70
  }
  if (categorySearchTextIncludes(categories, "外套") && pathText.includes("童装婴幼儿服装/外套")) score += 80
  if (categorySearchTextIncludes(categories, "学步鞋") && !maleSource && !femaleSource && pathText.includes("童鞋/亲子鞋/学步鞋")) {
    score += 160
  }
  if (categorySearchTextIncludes(categories, "宝宝鞋") && pathText.includes("童鞋/亲子鞋/学步鞋")) score += 180
  if (
    (categorySearchTextIncludes(categories, "外出连体衣") || categorySearchTextIncludes(categories, "内着连体衣"))
    && pathText.includes("寝具服饰/连身衣")
  ) {
    score += 180
  }
  if (categorySearchTextIncludes(categories, "内着上衣") && pathText.includes("寝具服饰/婴儿内衣")) score += 180
  if (categorySearchTextIncludes(categories, "短裙") && pathText.includes("童装婴幼儿服装/半身裙")) score += 160
  if (categorySearchTextIncludes(categories, "包") && pathText.includes("童装婴幼儿服装/儿童配件/儿童包包")) score += 160
  if (categorySearchTextIncludes(categories, "饰品") && pathText.includes("童装婴幼儿服装/儿童配饰")) score += 180
  if (categorySearchTextIncludes(categories, "饰品") && pathText.includes("童装婴幼儿服装/儿童配件/女童发饰")) score += 240
  if (categorySearchTextIncludes(categories, "围巾") && pathText.includes("童装婴幼儿服装/儿童配件/儿童围巾")) score += 160
  if (categorySearchTextIncludes(categories, "手套") && pathText.includes("童装婴幼儿服装/儿童配件/儿童手套")) score += 160
  if (categorySearchTextIncludes(categories, "帽子") && pathText.includes("童装婴幼儿服装/儿童配件")) score += 120
  return score
}

function sizeMatchKeys(value: unknown) {
  const text = stringValue(value)
  if (!text) return []
  const normalized = deepdrawSizeValue(text)
  const numberText = normalized.match(/^(\d+)cm$/i)?.[1] ?? ""
  const shoeCodeText = text.match(/^0*(\d+(?:\.5)?)\s*码$/)?.[1] ?? ""
  return uniqueTextValues([
    text,
    normalized,
    numberText,
    numberText ? numberText.padStart(3, "0") : "",
    shoeCodeText,
    shoeCodeText ? shoeCodeText.padStart(3, "0") : "",
  ].map((item) => item.replace(/\s+/g, "").toLowerCase()))
}

function skuSizeRequirements(skus: JsonRecord[] = []) {
  const sizes: string[] = []
  const seen = new Set<string>()
  for (const sku of skus) {
    const size = deepdrawSizeValue(sku.size_name) || deepdrawSizeValue(sku.size_code)
    const key = sizeMatchKeys(size)[0]
    if (!size || !key || seen.has(key)) continue
    seen.add(key)
    sizes.push(size)
  }
  return sizes
}

function tradeSizeTemplateOptions(trade: JsonRecord) {
  return productArchiveSkuSizeTemplateOptionTexts([
    ...arrayValue(trade.size_options_json),
    ...arrayValue(trade.size_options),
    ...arrayValue(trade.sizeOptions),
  ])
}

function tradeSizeTemplateCompatibility(trade: JsonRecord, requiredSizes: string[]) {
  if (requiredSizes.length === 0) return { checked: false, compatible: true, missingSizes: [] as string[] }
  const options = tradeSizeTemplateOptions(trade)
  if (options.length === 0) return { checked: false, compatible: true, missingSizes: [] as string[] }
  const allowedKeys = new Set(options.flatMap(sizeMatchKeys))
  const missingSizes = requiredSizes.filter((size) => !sizeMatchKeys(size).some((key) => allowedKeys.has(key)))
  return {
    checked: true,
    compatible: missingSizes.length === 0,
    missingSizes,
  }
}

function tradeMatchesRequiredSizes(trade: JsonRecord, requiredSizes: string[]) {
  return tradeSizeTemplateCompatibility(trade, requiredSizes).compatible
}

function scoreOfficialCategoryLeafSearch(trade: JsonRecord, category: { field: string; value: string }) {
  if (!category.field.includes("官方")) return 0
  const leaf = officialCategoryLeaf(category.value)
  const leafText = normalizeOfficialTradeSearchText(leaf)
  const candidatePathText = normalizeOfficialTradeSearchText(stringValue(trade.trade_path))
  const candidateNameText = normalizeOfficialTradeSearchText(stringValue(trade.trade_name))
  const candidateText = `${candidatePathText}${candidateNameText}`
  if (!leafText || !candidateText) return 0
  if (candidateNameText === leafText) return 1400
  if (candidatePathText.includes(leafText)) return 1360
  if (candidateNameText.length >= 3 && leafText.includes(candidateNameText)) {
    return 1260 + Math.min(candidateNameText.length * 10, 80)
  }
  const leafTerms = officialCategoryLeafTerms(leaf)
  if (leafTerms.length > 0 && leafTerms.every((term) => candidateText.includes(term))) {
    return 1320 + leafTerms.length
  }
  return 0
}

function isGenericOfficialCategoryLeaf(category: { field: string; value: string }) {
  if (!category.field.includes("官方")) return false
  const leafText = normalizeOfficialTradeSearchText(officialCategoryLeaf(category.value))
  return [
    "裤子",
    "套装",
    "其他",
    "其他童装",
    "运动鞋",
    "t恤",
    "羽绒服",
    "马甲",
    "卫衣",
    "衬衫",
    "连衣裙",
    "大衣",
    "羽绒马甲",
    "运动裤卫裤",
    "学步鞋",
    "雪地靴",
    "靴子",
    "鞋",
  ].includes(leafText)
}

function bestOfficialCategoryLeafTradeMatch(
  tier: DeepdrawTradePriorityTier,
  categories: Array<{ field: string; value: string }>,
  contextTerms: WeightedTradeContextTerm[] = [],
  requiredSizes: string[] = [],
) {
  if (tier.key === "default" || tier.key === "fallback") return { best: null, tied: false, sizeIncompatible: false }
  const officialCategories = categories.filter((category) => category.field.includes("官方"))
  if (officialCategories.length === 0) return { best: null, tied: false, sizeIncompatible: false }
  let best: NonNullable<ReturnType<typeof bestDeepdrawTradeMatch>["best"]> | null = null
  let tied = false
  let sizeIncompatible = false
  for (const candidate of tier.candidates) {
    if (isBrandPrivateDeepdrawTrade(candidate.trade)) continue
    let score = 0
    let matchedCategory: { field: string; value: string } | null = null
    for (const category of officialCategories) {
      const categoryScore = scoreOfficialCategoryLeafSearch(candidate.trade, category)
      if (categoryScore <= 0) continue
      const contextualScore = categoryScore + tradeContextMatchScore(candidate.trade, contextTerms)
      if (contextualScore > score) {
        score = contextualScore
        matchedCategory = category
      }
    }
    if (!matchedCategory) continue
    if (!tradeMatchesRequiredSizes(candidate.trade, requiredSizes)) {
      sizeIncompatible = true
      continue
    }
    const pathDepth = tradePathDepth(candidate.trade)
    const tieBreakScore = tradeTieBreakScore(candidate.trade, categories, contextTerms)
    const current = { score, tieBreakScore, pathDepth }
    if (
      !best
      || shouldPreferTradeMatch(current, best)
    ) {
      best = { candidate, category: matchedCategory, score, matchScore: score, pathDepth, tieBreakScore }
      tied = false
    } else if (best && isTradeMatchTie(current, best)) {
      tied = true
    }
  }
  return { best, tied, sizeIncompatible }
}

function bestDeepdrawTradeMatch(
  candidates: PrioritizedDeepdrawTrade[],
  categories: Array<{ field: string; value: string }>,
  contextTerms: WeightedTradeContextTerm[] = [],
) {
  let best: {
    candidate: PrioritizedDeepdrawTrade
    category: { field: string; value: string }
    score: number
    matchScore: number
    pathDepth: number
    tieBreakScore: number
  } | null = null
  let tied = false
  for (const candidate of candidates) {
    let score = 0
    let matchScore = 0
    let matchedCategory: { field: string; value: string } | null = null
    for (const category of categories) {
      const categoryScore = scoreTradeMatch(candidate.trade, category)
      if (categoryScore <= 0) continue
      const contextualScore = categoryScore + tradeContextMatchScore(candidate.trade, contextTerms)
      score += contextualScore
      if (contextualScore > matchScore) {
        matchScore = contextualScore
        matchedCategory = category
      }
    }
    if (!matchedCategory) continue
    const pathDepth = tradePathDepth(candidate.trade)
    const tieBreakScore = tradeTieBreakScore(candidate.trade, categories, contextTerms)
    const current = { score, tieBreakScore, pathDepth }
    if (
      !best
      || shouldPreferTradeMatch(current, best)
    ) {
      best = { candidate, category: matchedCategory, score, matchScore, pathDepth, tieBreakScore }
      tied = false
    } else if (best && isTradeMatchTie(current, best)) {
      tied = true
    }
  }
  return { best, tied }
}

function launchPlanCategorySourceConflict(sourceRows: JsonRecord[]) {
  return LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS.some((field) => {
    return latestNonEmptyLaunchPlanValues(sourceRows, field.aliases).length > 1
  })
}

function manualTradeSelectionDecision(input: {
  reasonCode: Extract<TradeSelectionReasonCode,
    | "missing_source_category"
    | "missing_platform_coverage"
    | "missing_size_template_coverage"
    | "missing_semantic_match"
    | "ambiguous_match">
  reason: string
  appliedTrade: TradeSelectionDecision["appliedTrade"]
  requiredPlatforms: string[]
  sourceConflict: boolean
  evaluatedAt: string
}): TradeSelectionDecision {
  return {
    status: "manual_selection_required",
    confidence: "none",
    reasonCode: input.reasonCode,
    recommendedTrade: null,
    appliedTrade: input.appliedTrade,
    matchedField: null,
    matchedValue: null,
    requiredPlatforms: input.requiredPlatforms,
    coveredPlatforms: [],
    sourceConflict: input.sourceConflict,
    reason: input.reason,
    evaluatedAt: input.evaluatedAt,
    confirmedAt: null,
  }
}

export function evaluateDeepdrawTradeSelectionFromLaunchPlanRows(
  sourceRows: JsonRecord[],
  trades: JsonRecord[],
  input: {
    tenantName?: string | null
    appliedTrade?: TradeSelectionDecision["appliedTrade"]
    evaluatedAt?: string
    allowUnspecifiedPlatformMetadata?: boolean
    skus?: JsonRecord[]
  } = {},
): TradeSelectionDecision {
  const categories = launchPlanCategoryValues(sourceRows)
  const evaluatedAt = input.evaluatedAt ?? nowIso()
  const appliedTrade = input.appliedTrade ?? null
  const sourceConflict = launchPlanCategorySourceConflict(sourceRows)
  const platformGroups = requiredLaunchPlanPlatformGroups(categories)
  const requiredPlatforms = platformGroups.map((group) => group.join("|"))
  if (categories.length === 0) {
    return manualTradeSelectionDecision({
      reasonCode: "missing_source_category",
      reason: "上市计划表未提供官方、唯品或抖音类目，需要人工选择深绘类目。",
      appliedTrade,
      requiredPlatforms,
      sourceConflict,
      evaluatedAt,
    })
  }
  const shoeCategory = categories.some((category) => normalizeOfficialTradeSearchText(category.value).includes("鞋"))
  const rawCandidateTiers = deepdrawTradePriorityTiers(stringValue(input.tenantName), trades)
  const rawSelectableCandidates = rawCandidateTiers.flatMap((tier) => tier.candidates)
  const hasPlatformMetadata = rawSelectableCandidates.some((candidate) => hasTradePlatformMetadata(candidate.trade))
  const allowUnspecifiedPlatformMetadata = input.allowUnspecifiedPlatformMetadata === true && !hasPlatformMetadata
  const requiredSizes = skuSizeRequirements(input.skus ?? [])
  const directShoeLeafAvailable = shoeCategory && rawSelectableCandidates.some((candidate) => {
    if (isGenderSegmentedShoeTrade(candidate.trade) || tradePathDepth(candidate.trade) < 2) return false
    const semanticMatch = categories.some((category) => (
      scoreTradeMatch(candidate.trade, category) >= 700
      || scoreOfficialCategoryLeafSearch(candidate.trade, category) > 0
    ))
    if (!semanticMatch || !tradeMatchesRequiredSizes(candidate.trade, requiredSizes)) return false
    if (allowUnspecifiedPlatformMetadata) return true
    return hasPlatformMetadata
      && hasTradePlatformMetadata(candidate.trade)
      && tradeCoversPlatformGroups(candidate.trade, platformGroups)
  })
  const contextTerms = launchPlanTradeContextTerms(sourceRows, categories, {
    allowShoeGender: shoeCategory && !directShoeLeafAvailable,
  })
  const candidateTiers = rawCandidateTiers.map((tier) => ({
    ...tier,
    candidates: shoeCategory && directShoeLeafAvailable
      ? tier.candidates.filter((candidate) => !isGenderSegmentedShoeTrade(candidate.trade))
      : tier.candidates,
  }))
  let selected: {
    tier: DeepdrawTradePriorityTier
    best: NonNullable<ReturnType<typeof bestDeepdrawTradeMatch>["best"]>
  } | null = null
  let foundPlatformEligibleTrade = false
  let foundSizeIncompatibleTrade = false
  for (const tier of candidateTiers) {
    const officialLeafMatch = bestOfficialCategoryLeafTradeMatch(tier, categories, contextTerms, requiredSizes)
    if (officialLeafMatch.sizeIncompatible) foundSizeIncompatibleTrade = true

    const platformEligibleCandidates = allowUnspecifiedPlatformMetadata
      ? tier.candidates
      : hasPlatformMetadata
        ? tier.candidates.filter((candidate) => (
            hasTradePlatformMetadata(candidate.trade)
            && tradeCoversPlatformGroups(candidate.trade, platformGroups)
          ))
        : []
    const eligibleCandidates = platformEligibleCandidates.filter((candidate) => {
      const compatible = tradeMatchesRequiredSizes(candidate.trade, requiredSizes)
      if (!compatible) foundSizeIncompatibleTrade = true
      return compatible
    })
    if (eligibleCandidates.length === 0) {
      if (officialLeafMatch.tied) {
        return manualTradeSelectionDecision({
          reasonCode: "ambiguous_match",
          reason: tier.label
            ? `${tier.label}存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。`
            : "存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。",
          appliedTrade,
          requiredPlatforms,
          sourceConflict,
          evaluatedAt,
        })
      }
      if (officialLeafMatch.best) {
        selected = { tier, best: officialLeafMatch.best }
        break
      }
      continue
    }
    foundPlatformEligibleTrade = true
    const match = bestDeepdrawTradeMatch(eligibleCandidates, categories, contextTerms)
    const specificContextCategories = officialLeafMatch.best && isGenericOfficialCategoryLeaf(officialLeafMatch.best.category)
      ? categories.filter((category) => !isGenericOfficialCategoryLeaf(category))
      : []
    const specificContextMatch = specificContextCategories.length > 0
      ? bestDeepdrawTradeMatch(eligibleCandidates, specificContextCategories, contextTerms)
      : { best: null, tied: false }
    const preferredMatch = specificContextMatch.best && !specificContextMatch.tied ? specificContextMatch : match
    const preferSpecificContextMatch = Boolean(
      officialLeafMatch.best
      && specificContextMatch.best
      && !specificContextMatch.tied
      && isGenericOfficialCategoryLeaf(officialLeafMatch.best.category)
      && specificContextMatch.best.score >= 700,
    )
    if (officialLeafMatch.tied && !preferSpecificContextMatch) {
      return manualTradeSelectionDecision({
        reasonCode: "ambiguous_match",
        reason: tier.label
          ? `${tier.label}存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。`
          : "存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。",
        appliedTrade,
        requiredPlatforms,
        sourceConflict,
        evaluatedAt,
      })
    }
    if (officialLeafMatch.best && !preferSpecificContextMatch) {
      selected = { tier, best: officialLeafMatch.best }
      break
    }
    if (!preferredMatch.best) {
      if (officialLeafMatch.tied) {
        return manualTradeSelectionDecision({
          reasonCode: "ambiguous_match",
          reason: tier.label
            ? `${tier.label}存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。`
            : "存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。",
          appliedTrade,
          requiredPlatforms,
          sourceConflict,
          evaluatedAt,
        })
      }
      continue
    }
    if (preferredMatch.tied) {
      if (officialLeafMatch.tied) {
        return manualTradeSelectionDecision({
          reasonCode: "ambiguous_match",
          reason: tier.label
            ? `${tier.label}存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。`
            : "存在多个官方最末级类目搜索结果，无法自动确定，需要人工选择。",
          appliedTrade,
          requiredPlatforms,
          sourceConflict,
          evaluatedAt,
        })
      }
      if (officialLeafMatch.best) {
        selected = { tier, best: officialLeafMatch.best }
        break
      }
      return manualTradeSelectionDecision({
        reasonCode: "ambiguous_match",
        reason: tier.label
          ? `${tier.label}存在多个同分且同层级的深绘类目，无法自动确定，需要人工选择。`
          : "存在多个同分且同层级的深绘类目，无法自动确定，需要人工选择。",
        appliedTrade,
        requiredPlatforms,
        sourceConflict,
        evaluatedAt,
      })
    }
    selected = { tier, best: preferredMatch.best }
    break
  }
  if (!selected) {
    return manualTradeSelectionDecision({
      reasonCode: foundSizeIncompatibleTrade
        ? "missing_size_template_coverage"
        : foundPlatformEligibleTrade
          ? "missing_semantic_match"
          : "missing_platform_coverage",
      reason: foundSizeIncompatibleTrade
        ? "匹配到的深绘类目尺码模板不能覆盖草稿 SKU 尺码，需要同步或选择覆盖尺码的深绘类目。"
        : foundPlatformEligibleTrade
        ? "覆盖所需平台的深绘类目中没有找到语义匹配，需要人工选择深绘类目。"
        : "没有深绘类目同时覆盖上市计划表涉及的平台，需要人工选择深绘类目。",
      appliedTrade,
      requiredPlatforms,
      sourceConflict,
      evaluatedAt,
    })
  }
  const { best, tier } = selected
  const confidence = best.matchScore >= 1200 ? "high" : "medium"
  const recommendedTrade = {
    tradeId: stringValue(best.candidate.trade.trade_id),
    tradePath: stringValue(best.candidate.trade.trade_path) || stringValue(best.candidate.trade.trade_name),
  }
  const appliedTradeMismatch = Boolean(
    appliedTrade?.tradeId && appliedTrade.tradeId !== recommendedTrade.tradeId,
  )
  const status = appliedTradeMismatch ? "pending_confirmation" : "auto_applied"
  const reasonCode = appliedTradeMismatch
    ? "applied_trade_mismatch"
    : sourceConflict
      ? "source_category_conflict"
    : confidence === "high"
      ? "unique_high_confidence"
      : "medium_confidence"
  const baseReason = appliedTradeMismatch
    ? "当前已应用类目与系统推荐类目不一致，需要应用推荐类目并由人工确认。"
    : sourceConflict
      ? "同一平台来源类目存在多个不同值，已按最优推荐自动选中深绘类目，并保留来源冲突提示。"
    : confidence === "high"
      ? `已根据${best.category.field}唯一匹配并自动应用深绘类目，置信度高。`
      : "已根据当前上市计划类目证据自动选中深绘类目，置信度中，保留人工确认提示。"
  const reason = tier.label && best.candidate.policyRootName
    ? `${tier.label}「${best.candidate.policyRootName}」命中。${baseReason}`
    : baseReason
  return {
    status,
    confidence,
    reasonCode,
    recommendedTrade,
    appliedTrade,
    matchedField: best.category.field,
    matchedValue: best.category.value,
    requiredPlatforms,
    coveredPlatforms: Array.from(tradePlatformValues(best.candidate.trade)).sort(),
    sourceConflict,
    reason,
    evaluatedAt,
    confirmedAt: null,
  }
}

export function chooseDeepdrawTradeFromLaunchPlanRows(sourceRows: JsonRecord[], trades: JsonRecord[]) {
  const decision = evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, trades, {
    allowUnspecifiedPlatformMetadata: true,
  })
  if (!decision.recommendedTrade) return null
  return {
    ...decision.recommendedTrade,
    confidence: decision.confidence,
    matchedField: decision.matchedField,
    matchedValue: decision.matchedValue,
  }
}

export function applyHumanTradeSelectionDecision(
  decision: TradeSelectionDecision,
  appliedTrade: NonNullable<TradeSelectionDecision["appliedTrade"]>,
  confirmedAt = nowIso(),
): TradeSelectionDecision {
  const confirmed = decision.recommendedTrade?.tradeId === appliedTrade.tradeId
  return {
    ...decision,
    status: confirmed ? "human_confirmed" : "human_adjusted",
    reasonCode: confirmed ? "human_confirmed" : "human_adjusted",
    appliedTrade,
    reason: confirmed
      ? "人工已确认系统推荐的深绘类目。"
      : decision.recommendedTrade
        ? "人工已选择不同于系统推荐的深绘类目，后续来源刷新不会覆盖当前人工类目。"
        : "系统未生成唯一推荐，当前深绘类目由人工选择。",
    confirmedAt,
  }
}

const LEGACY_TRADE_BACKFILL_CONFIRMATION_REASON = "旧草稿已按最新规则应用推荐类目，等待人工确认。"

function legacyTradeBackfillReason(decision: TradeSelectionDecision) {
  if (decision.reason.includes(LEGACY_TRADE_BACKFILL_CONFIRMATION_REASON)) return decision.reason
  return `${decision.reason}${LEGACY_TRADE_BACKFILL_CONFIRMATION_REASON}`
}

function isCompletedLegacyTradeBackfill(decision: TradeSelectionDecision) {
  return decision.reasonCode === "legacy_backfill_confirmation_required"
    && Boolean(decision.recommendedTrade?.tradeId)
    && decision.recommendedTrade?.tradeId === decision.appliedTrade?.tradeId
}

export function mergeTradeSelectionHumanState(
  evaluated: TradeSelectionDecision,
  persistedValue: unknown,
): TradeSelectionDecision {
  const persisted = recordValue(persistedValue)
  const persistedStatus = stringValue(persisted.status)
  const persistedReasonCode = stringValue(persisted.reasonCode)
  const confirmedAt = stringValue(persisted.confirmedAt) || null
  if (persistedStatus === "human_adjusted") {
    return {
      ...evaluated,
      status: "human_adjusted",
      reasonCode: "human_adjusted",
      reason: evaluated.recommendedTrade
        ? "人工已选择不同于系统推荐的深绘类目，后续来源刷新不会覆盖当前人工类目。"
        : "系统未生成唯一推荐，当前深绘类目由人工选择。",
      confirmedAt,
    }
  }
  if (
    persistedStatus === "pending_confirmation"
    && persistedReasonCode === "legacy_backfill_confirmation_required"
  ) {
    const persistedRecommendedId = stringValue(recordValue(persisted.recommendedTrade).tradeId)
    const currentRecommendedId = evaluated.recommendedTrade?.tradeId ?? ""
    const currentAppliedId = evaluated.appliedTrade?.tradeId ?? ""
    if (
      persistedRecommendedId
      && persistedRecommendedId === currentRecommendedId
      && currentAppliedId === currentRecommendedId
    ) {
      return {
        ...evaluated,
        status: "pending_confirmation",
        reasonCode: "legacy_backfill_confirmation_required",
        reason: legacyTradeBackfillReason(evaluated),
        confirmedAt: null,
      }
    }
  }
  if (persistedStatus !== "human_confirmed") return evaluated
  const persistedRecommended = recordValue(persisted.recommendedTrade)
  const persistedRecommendedId = stringValue(persistedRecommended.tradeId)
  const currentRecommendedId = evaluated.recommendedTrade?.tradeId ?? ""
  const currentAppliedId = evaluated.appliedTrade?.tradeId ?? ""
  if (!persistedRecommendedId || persistedRecommendedId !== currentRecommendedId || currentAppliedId !== currentRecommendedId) {
    return evaluated
  }
  return {
    ...evaluated,
    status: "human_confirmed",
    reasonCode: "human_confirmed",
    reason: "人工已确认系统推荐的深绘类目。",
    confirmedAt,
  }
}

export function listDeepdrawTradeSelectionCandidates(
  db: SyncPostgresDatabase,
  tenantName: string,
  merchantId: string,
) {
  return db.prepare(`
    select
      trade.trade_id,
      trade.parent_trade_id,
      trade.trade_name,
      trade.trade_path,
      coalesce((
        select string_agg(distinct field.raw_payload_json #>> '{attributes,thirdPlatform}', ',')
        from deepdraw_trade_field_cache field
        where field.tenant_name = trade.tenant_name
          and field.merchant_id = trade.merchant_id
          and field.trade_id = trade.trade_id
          and coalesce(field.raw_payload_json #>> '{attributes,thirdPlatform}', '') <> ''
      ), '') as third_platforms
    from deepdraw_trade_cache trade
    where trade.tenant_name = ?
      and trade.merchant_id = ?
  `).all(tenantName, merchantId) as JsonRecord[]
}

function deepdrawTradeSizeOptionsById(
  db: SyncPostgresDatabase,
  tenantName: string,
  merchantId: string,
  tradeIds: string[],
) {
  const candidateTradeIds = uniqueTextValues(tradeIds)
  if (candidateTradeIds.length === 0) return new Map<string, string[]>()
  const byTradeId = new Map<string, string[]>()
  const fieldNamePatterns = ["%尺码%", "%尺寸%", "%规格%", "%size%"]
  for (let index = 0; index < candidateTradeIds.length; index += 100) {
    const chunk = candidateTradeIds.slice(index, index + 100)
    const placeholders = chunk.map(() => "?").join(", ")
    const rows = db.prepare(`
      select trade_id, field_name, options_json
      from deepdraw_trade_field_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id in (${placeholders})
        and (
          field_name ilike ?
          or field_name ilike ?
          or field_name ilike ?
          or field_name ilike ?
        )
      order by trade_id, required desc, sale_prop desc, field_id
    `).all(tenantName, merchantId, ...chunk, ...fieldNamePatterns) as JsonRecord[]
    for (const row of rows) {
      if (!isProductArchiveSkuSizeTemplateFieldName(row.field_name)) continue
      const tradeId = stringValue(row.trade_id)
      if (!tradeId) continue
      const current = byTradeId.get(tradeId) ?? []
      current.push(...productArchiveSkuSizeTemplateOptionTexts(arrayValue(row.options_json)))
      byTradeId.set(tradeId, uniqueTextValues(current))
    }
  }
  return byTradeId
}

function enrichDeepdrawTradeCandidatesWithSizeOptions(
  trades: JsonRecord[],
  sizeOptionsByTradeId: Map<string, string[]>,
) {
  return trades.map((trade) => {
    if (tradeSizeTemplateOptions(trade).length > 0) return trade
    const sizeOptions = sizeOptionsByTradeId.get(stringValue(trade.trade_id)) ?? []
    return sizeOptions.length > 0 ? { ...trade, size_options: sizeOptions } : trade
  })
}

function inferDeepdrawTradeSelectionFromLaunchPlan(db: SyncPostgresDatabase, input: {
  tenantName: string
  merchantId: string
  sourceRows: JsonRecord[]
  skus?: JsonRecord[]
  appliedTrade?: TradeSelectionDecision["appliedTrade"]
  evaluatedAt?: string
  tradeCandidates?: JsonRecord[]
}) {
  const rawTrades = input.tradeCandidates
    ?? listDeepdrawTradeSelectionCandidates(
      db,
      input.tenantName,
      input.merchantId,
    )
  const trades = input.tradeCandidates
    ? rawTrades
    : (() => {
        const sizeCandidateTradeIds = relevantDeepdrawTradeIdsForSizeOptions({
          tenantName: input.tenantName,
          sourceRows: input.sourceRows,
          trades: rawTrades,
          appliedTrade: input.appliedTrade,
        })
        return enrichDeepdrawTradeCandidatesWithSizeOptions(
          rawTrades,
          deepdrawTradeSizeOptionsById(db, input.tenantName, input.merchantId, sizeCandidateTradeIds),
        )
      })()
  return evaluateDeepdrawTradeSelectionFromLaunchPlanRows(input.sourceRows, trades, {
    tenantName: input.tenantName,
    appliedTrade: input.appliedTrade,
    evaluatedAt: input.evaluatedAt,
    skus: input.skus,
  })
}

function appliedTradeForDraft(draft: JsonRecord): TradeSelectionDecision["appliedTrade"] {
  const tradeId = stringValue(draft.trade_id)
  if (!tradeId) return null
  return {
    tradeId,
    tradePath: stringValue(draft.trade_path) || tradeId,
  }
}

function draftSkusForDraft(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select *
    from product_archive_draft_sku
    where draft_id = ?
    order by skc_code, size_code, sku_code
  `).all(draftId) as JsonRecord[]
}

function relevantDeepdrawTradeIdsForSizeOptions(input: {
  tenantName: string
  sourceRows: JsonRecord[]
  trades: JsonRecord[]
  appliedTrade?: TradeSelectionDecision["appliedTrade"]
}) {
  const categories = launchPlanCategoryValues(input.sourceRows)
  if (categories.length === 0) return []
  const candidateTiers = deepdrawTradePriorityTiers(stringValue(input.tenantName), input.trades)
  const selectableCandidates = candidateTiers.flatMap((tier) => tier.candidates)
  const hasPlatformMetadata = selectableCandidates.some((candidate) => hasTradePlatformMetadata(candidate.trade))
  const platformGroups = requiredLaunchPlanPlatformGroups(categories)
  const officialCategories = categories.filter((category) => category.field.includes("官方"))
  const tradeIds = new Set<string>()

  const addTrade = (trade: JsonRecord) => {
    if (tradeSizeTemplateOptions(trade).length > 0) return
    const tradeId = stringValue(trade.trade_id)
    if (tradeId) tradeIds.add(tradeId)
  }

  for (const tier of candidateTiers) {
    for (const candidate of tier.candidates) {
      const trade = candidate.trade
      const officialLeafRelevant = tier.key !== "default"
        && tier.key !== "fallback"
        && !isBrandPrivateDeepdrawTrade(trade)
        && officialCategories.some((category) => scoreOfficialCategoryLeafSearch(trade, category) > 0)
      if (officialLeafRelevant) {
        addTrade(trade)
        continue
      }

      const semanticRelevant = categories.some((category) => scoreTradeMatch(trade, category) > 0)
      if (!semanticRelevant) continue
      const platformEligible = platformGroups.length === 0
        || !hasPlatformMetadata
        || (hasTradePlatformMetadata(trade) && tradeCoversPlatformGroups(trade, platformGroups))
      if (platformEligible) addTrade(trade)
    }
  }

  const appliedTradeId = stringValue(input.appliedTrade?.tradeId)
  if (appliedTradeId) tradeIds.add(appliedTradeId)
  return Array.from(tradeIds)
}

function currentTradeSelectionDecision(db: SyncPostgresDatabase, draft: JsonRecord) {
  const tenantName = stringValue(draft.tenant_name)
  const merchantId = stringValue(draft.merchant_id)
  const evaluated = inferDeepdrawTradeSelectionFromLaunchPlan(db, {
    tenantName,
    merchantId,
    sourceRows: referenceSourceRowsForDraft(db, draft),
    skus: draftSkusForDraft(db, numberValue(draft.id) ?? 0),
    appliedTrade: appliedTradeForDraft(draft),
  })
  return mergeTradeSelectionHumanState(
    evaluated,
    recordValue(draft.source_snapshot_json).tradeSelection,
  )
}

function persistTradeSelectionDecision(
  db: SyncPostgresDatabase,
  draftId: number,
  snapshotValue: unknown,
  decision: TradeSelectionDecision,
  updatedAt = nowIso(),
  expected?: { tradeId: unknown; snapshotValue: unknown },
) {
  const snapshot = {
    ...recordValue(snapshotValue),
    tradeSelection: decision,
  }
  const result = expected
    ? db.prepare(`
        update product_archive_draft
        set source_snapshot_json = ?::jsonb,
          updated_at = ?::timestamptz
        where id = ?
          and trade_id is not distinct from ?
          and source_snapshot_json is not distinct from ?::jsonb
      `).run(
        jsonText(snapshot),
        updatedAt,
        draftId,
        expected.tradeId ?? null,
        jsonText(recordValue(expected.snapshotValue)),
      )
    : db.prepare(`
    update product_archive_draft
    set source_snapshot_json = ?::jsonb,
      updated_at = ?::timestamptz
    where id = ?
  `).run(jsonText(snapshot), updatedAt, draftId)
  return { snapshot, changes: Number(result.changes ?? 0) }
}

function hasHumanTradeSelection(snapshotValue: unknown) {
  const status = stringValue(recordValue(recordValue(snapshotValue).tradeSelection).status)
  return status === "human_adjusted" || status === "human_confirmed"
}

function chooseTitle(spu: JsonRecord, sourceRows: JsonRecord[] = []) {
  return sourceFieldValue(sourceRows, "copywriting", "搜索标题")
    || sourceFieldValue(sourceRows, "copywriting", "商品标题")
    || sourceFieldValue(sourceRows, "copywriting", "标题")
    || stringValue(spu.listing_title_cn)
    || stringValue(spu.spu_name)
    || stringValue(spu.listing_title_en)
    || stringValue(spu.spu_name_en)
}

function reusableProductArchiveDraftForSpu(
  db: SyncPostgresDatabase,
  input: { spuCode: string; tenantName: string; merchantId: string },
) {
  const placeholders = PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES.map(() => "?").join(", ")
  return db.prepare(`
    select *
    from product_archive_draft
    where spu_code = ?
      and tenant_name = ?
      and merchant_id = ?
      and status in (${placeholders})
    order by updated_at desc, id desc
    limit 1
    for update
  `).get(
    input.spuCode,
    input.tenantName,
    input.merchantId,
    ...PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES,
  ) as JsonRecord | undefined
}

function nonReusableProductArchiveDraftForSpu(
  db: SyncPostgresDatabase,
  input: { spuCode: string; tenantName: string; merchantId: string },
) {
  const placeholders = PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES.map(() => "?").join(", ")
  return db.prepare(`
    select *
    from product_archive_draft
    where spu_code = ?
      and tenant_name = ?
      and merchant_id = ?
      and status not in (${placeholders})
    order by updated_at desc, id desc
    limit 1
    for update
  `).get(
    input.spuCode,
    input.tenantName,
    input.merchantId,
    ...PRODUCT_ARCHIVE_DRAFT_REUSE_STATUSES,
  ) as JsonRecord | undefined
}

function replaceProductArchiveDraftSkuRows(
  db: SyncPostgresDatabase,
  draftId: number,
  spuCode: string,
  skuRows: JsonRecord[],
  now: string,
) {
  db.prepare("delete from product_archive_draft_sku where draft_id = ?").run(draftId)
  const insertSku = db.prepare(`
    insert into product_archive_draft_sku (
      draft_id,
      spu_code,
      skc_code,
      sku_code,
      barcode,
      color_name,
      color_code,
      size_name,
      size_code,
      price,
      seller_code,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
  `)
  for (const sku of skuRows) {
    insertSku.run(
      draftId,
      spuCode,
      sku.skc_code,
      sku.sku_code,
      sku.ean_code,
      sku.color_name,
      sku.color_code,
      sku.size_name,
      sku.size_code,
      numberValue(sku.price_tag),
      stringValue(sku.inner_code) || stringValue(sku.ean_code) || stringValue(sku.sku_code),
      jsonText(recordValue(sku.raw_payload_json)),
      now,
    )
  }
}

function readMdmField(spu: JsonRecord, sourceField: string) {
  return stringValue(spu[sourceField])
}

function readSourceValue(spu: JsonRecord, rule: JsonRecord, sourceRows: JsonRecord[] = [], fieldName = "") {
  const sourceType = stringValue(rule.source_type)
  const defaultValue = stringValue(rule.default_value)
  const sourceField = stringValue(rule.source_field)
  if (isProductArchiveBusinessBlankField(fieldName, spu, sourceRows)) return ""
  const derived = buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
    sourceField: sourceField || defaultValue,
  })
  const shoeKey = compactFieldKey(fieldName)
  if (
    (isApparelProduct(spu, sourceRows) || isShoeProduct(spu, sourceRows))
    && PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS.has(shoeKey)
  ) return derived
  if (
    isApparelProduct(spu, sourceRows)
    && derived
    && ["里料", "里料成分", "里料材质", "内里材质", "商品展示标题"].includes(shoeKey)
  ) return derived
  if (
    isShoeProduct(spu, sourceRows)
    && derived
    && (
      isProductArchiveOriginCountryField(fieldName)
      || [
        "抖音参考价格类型",
        "产地",
        "是否商场同款",
        "帮面材质多选",
        "材质1688",
        "材质功能",
        "鞋垫材质",
        "适用年龄",
        "商品展示标题",
      ].includes(shoeKey)
    )
  ) return derived
  if (sourceType === "fixed") {
    if (isProductArchiveListPriceReference(defaultValue) || productArchiveSourceReference(defaultValue)) return derived
    return defaultValue || derived
  }
  if (sourceType === "mdm") return readMdmField(spu, sourceField)
  if (sourceType === "launch_plan") return derived || launchValue(sourceRows, sourceField) || defaultValue
  if (sourceType === "copywriting") return derived || copywritingValue(sourceRows, sourceField) || defaultValue
  if (sourceType === "manual") {
    if (isProductArchiveListPriceReference(defaultValue) || productArchiveSourceReference(defaultValue)) return derived
    return defaultValue || derived
  }
  if (sourceType === "skip") return ""
  return defaultValue || derived
}

export function resolveProductArchiveSourceRuleValue(fieldName: string, input: {
  spu: JsonRecord
  sourceRows?: JsonRecord[]
  rule?: JsonRecord
}) {
  return readSourceValue(input.spu, input.rule ?? {}, input.sourceRows ?? [], fieldName)
}

function sanitizeDeepdrawLogPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDeepdrawLogPayload)
  if (!value || typeof value !== "object") return value
  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (/secret|dopKey|appKey|signature|authorization|header/i.test(key)) {
      output[key] = "[redacted]"
      continue
    }
    output[key] = sanitizeDeepdrawLogPayload(child)
  }
  return output
}

function fieldOptionText(option: unknown, keys: string[]) {
  if (!option || typeof option !== "object") return stringValue(option)
  const record = option as JsonRecord
  for (const key of keys) {
    const value = stringValue(record[key])
    if (value) return value
  }
  return stringValue(record.value) || stringValue(record.label) || stringValue(record.name)
}

function fieldOptionsFromTemplate(optionsJson: unknown) {
  const rawOptions = arrayValue(optionsJson)
  return rawOptions
    .map((option, index) => {
      const value = visibleOptionText(option, rawOptions, index)
      const label = value
      if (!value) return null
      return { value, label }
    })
    .filter((option): option is { value: string; label: string } => Boolean(option))
}

export function productArchiveFieldValueMatchesOptions(value: unknown, options: unknown[], fieldName?: unknown) {
  if (!options.length || !hasValue(value)) return true
  if (value && typeof value === "object" && !Array.isArray(value)) return true
  const allowed = new Set(optionValues(options))
  if (!allowed.size) return true
  const text = stringValue(value)
  const groups = text.split(/[;；]/).map((part) => part.trim()).filter(Boolean)
  const values = groups.length ? groups : [text].filter(Boolean)
  const matched = values.every((item) => {
    if (allowed.has(item)) return true
    const aliases = item.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
    return (aliases.length ? aliases : [item]).some((alias) => allowed.has(alias))
  })
  if (matched) return true
  if (isProductArchiveSkuSizeFieldName(fieldName)) {
    const optionKeys = new Set(optionValues(options).flatMap(sizeMatchKeys))
    return values.every((item) => {
      const aliases = item.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
      return (aliases.length ? aliases : [item]).some((alias) => (
        sizeMatchKeys(alias).some((key) => optionKeys.has(key))
      ))
    })
  }
  if (!isProductArchiveGenderFieldName(fieldName)) return false
  const normalized = normalizeProductArchiveGenderOptionValue(value, options)
  if (!normalized || normalized === text) return false
  return productArchiveFieldValueMatchesOptions(normalized, options)
}

function productArchiveFieldOptionValidationMessage(value: unknown, options: unknown[]) {
  const current = stringValue(value) || "空"
  const optionSamples = optionValues(options).slice(0, 8).join("、")
  return optionSamples
    ? `字段值不在深绘模板选项中：当前值「${current}」，可选项示例「${optionSamples}」`
    : `字段值不在深绘模板选项中：当前值「${current}」`
}

function optionValues(options: unknown[]) {
  return uniqueTextValues(options.map((option, index) => visibleOptionText(option, options, index)))
}

function skuSizeTokenHasDisplayUnit(value: unknown) {
  return /(?:cm|厘米|公分|码)\s*$/i.test(stringValue(value))
}

function pickOption(options: unknown[], predicates: Array<(value: string) => boolean>) {
  const values = optionValues(options)
  for (const predicate of predicates) {
    const match = values.find(predicate)
    if (match) return match
  }
  return ""
}

function pickOtherOption(options: unknown[]) {
  return pickOption(options, [(option) => /^(?:其他|其它)$/.test(option)])
}

function productArchiveSizeNumberValue(value: unknown) {
  const text = stringValue(value)
  const normalized = deepdrawSizeValue(text)
  const numberText = normalized.match(/^(\d{2,3})cm$/i)?.[1]
    ?? text.match(/^0*(\d{2,3})(?:\s*(?:cm|厘米|码))?$/i)?.[1]
  const size = Number(numberText)
  return Number.isFinite(size) ? size : null
}

function productArchiveApparelSizeRangeOption(value: unknown) {
  const option = stringValue(value).replace(/[－—–~～至到]/g, "-").replace(/\s+/g, "")
  if (!option) return null
  const below = option.match(/^(\d{2,3})(?:cm|厘米)?(?:以下|及以下|以内)$/i)
  if (below) return { option: stringValue(value), min: Number.NEGATIVE_INFINITY, max: Number(below[1]) }
  const above = option.match(/^(\d{2,3})(?:cm|厘米)?(?:以上|及以上|起)$/i)
  if (above) return { option: stringValue(value), min: Number(above[1]), max: Number.POSITIVE_INFINITY }
  const range = option.match(/^(\d{2,3})(?:cm|厘米)?-(\d{2,3})(?:cm|厘米)?$/i)
  if (range) {
    const left = Number(range[1])
    const right = Number(range[2])
    return { option: stringValue(value), min: Math.min(left, right), max: Math.max(left, right) }
  }
  return null
}

function productArchiveApparelSizeSegmentOption(value: unknown, options: unknown[]) {
  const size = productArchiveSizeNumberValue(value)
  if (size === null) return ""
  const ranges = optionValues(options)
    .map(productArchiveApparelSizeRangeOption)
    .filter((range): range is { option: string; min: number; max: number } => Boolean(range))
  for (const range of ranges) {
    if (range.min === Number.NEGATIVE_INFINITY && size <= range.max) return range.option
    if (range.max === Number.POSITIVE_INFINITY && size > range.min) return range.option
    if (Number.isFinite(range.min) && Number.isFinite(range.max) && size > range.min && size <= range.max) {
      return range.option
    }
  }
  for (const range of ranges) {
    if (size >= range.min && size <= range.max) return range.option
  }
  return ""
}

function productArchiveApparelSizeSegmentValue(value: unknown, options: unknown[]) {
  const values = stringValue(value).split(/[;；,，]/).map((part) => part.trim()).filter(Boolean)
  const normalized = values
    .map((item) => productArchiveApparelSizeSegmentOption(item, options))
    .filter(Boolean)
  return normalized.length ? uniqueTextValues(normalized).join(";") : ""
}

function isProductArchiveProductCategoryFieldKey(key: string) {
  return key === "产品类别" || key === "商品类别"
}

function comparableProductCategoryText(value: unknown) {
  return normalizeTradeText(value)
    .replace(/[（(][^）)]*[）)]/g, "")
    .replaceAll("【", "")
    .replaceAll("】", "")
    .replaceAll("[", "")
    .replaceAll("]", "")
}

function productCategoryOptionValue(value: unknown, options: unknown[]) {
  const candidates = uniqueTextValues([
    value,
    officialCategoryLeaf(stringValue(value)),
    tradeLeaf(stringValue(value)),
  ])
  const comparableCandidates = candidates
    .map(comparableProductCategoryText)
    .filter((candidate) => candidate.length >= 2)
  return pickOption(options, [
    (option) => candidates.some((candidate) => option === candidate),
    (option) => comparableCandidates.some((candidate) => comparableProductCategoryText(option) === candidate),
    (option) => {
      const normalizedOption = comparableProductCategoryText(option)
      return normalizedOption.length >= 2
        && comparableCandidates.some((candidate) => normalizedOption.includes(candidate) || candidate.includes(normalizedOption))
    },
  ])
}

function productArchiveCategoryFieldValue(input: {
  draft?: JsonRecord
  spu?: JsonRecord
  sourceRows?: JsonRecord[]
  fieldName: string
  options: unknown[]
}) {
  for (const value of productArchiveCategoryEvidenceCandidates(input)) {
    const normalized = normalizeProductArchiveDeepdrawFieldValue(input.fieldName, value, input.options)
    if (normalized && productArchiveFieldValueMatchesOptions(normalized, input.options, input.fieldName)) return normalized
  }
  return ""
}

function seasonFromMonth(month: number) {
  if (month >= 3 && month <= 5) return "春"
  if (month >= 6 && month <= 8) return "夏"
  if (month >= 9 && month <= 11) return "秋"
  return "冬"
}

function seasonOptionValue(value: string, options: unknown[]) {
  const dateText = dateFromText(value)
  const match = dateText.match(/^(\d{4})-(\d{2})-\d{2}/)
  if (!match) return ""
  const year = match[1]
  const season = seasonFromMonth(Number(match[2]))
  const candidates = [
    `${year}年${season}季`,
    `${year}年${season}`,
    `${year}${season}季`,
    `${year}${season}`,
    year,
  ]
  return pickOption(options, candidates.map((candidate) => (option) => option === candidate))
}

function ageYearRange(value: string) {
  const match = value.match(/(\d{1,2})\s*岁?\s*[-~～至—－]\s*(\d{1,2})\s*岁/)
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return start <= end ? { start, end } : { start: end, end: start }
}

function singleAgeOptionValue(text: string, options: unknown[]) {
  const range = ageYearRange(text)
  if (!range) return ""
  const exactRangeText = `${range.start}-${range.end}岁`
  const exactChineseRangeText = `${range.start}岁-${range.end}岁`
  const exact = pickOption(options, [
    (option) => option === exactRangeText,
    (option) => option === exactChineseRangeText,
  ])
  if (exact) return exact
  if (range.end <= 3) {
    return pickOption(options, [
      (option) => option.includes("婴幼童"),
      (option) => option.includes("0—3") || option.includes("0~3"),
    ])
  }
  if (range.end <= 8) {
    return pickOption(options, [
      (option) => option.includes("中小童"),
      (option) => option.includes("3岁（含）") && option.includes("8岁"),
      (option) => option.includes("3周岁") && option.includes("6周岁"),
    ])
  }
  return pickOption(options, [
    (option) => option.includes("中大童"),
    (option) => option.includes("8岁") && (option.includes("14岁") || option.includes("以上")),
    (option) => option.includes("8周岁以上"),
  ])
}

function multiAgeOptionValue(text: string, options: unknown[]) {
  const range = ageYearRange(text)
  if (!range) return ""
  const values: string[] = []
  for (let age = range.start; age <= range.end; age += 1) {
    const value = pickOption(options, [(option) => option === `${age}岁`])
    if (value) values.push(value)
  }
  return values.length ? values.join(";") : singleAgeOptionValue(text, options)
}

function multiPopulationOptionValue(text: string, options: unknown[]) {
  const range = ageYearRange(text)
  if (!range) return ""
  const values = optionValues(options)
  if (!values.some((option) => ["儿童", "小学生", "中学生"].includes(option))) return ""
  const populationRanges = new Map<string, { start: number; end: number }>([
    ["婴童", { start: 0, end: 3 }],
    ["幼童", { start: 1, end: 6 }],
    ["小童", { start: 3, end: 8 }],
    ["儿童", { start: 3, end: 14 }],
    ["小学生", { start: 6, end: 12 }],
    ["中童", { start: 6, end: 12 }],
    ["中大童", { start: 8, end: 14 }],
    ["中学生", { start: 12, end: 18 }],
    ["青少年", { start: 12, end: 18 }],
  ])
  return values.filter((option) => {
    const optionRange = populationRanges.get(option)
    return optionRange && range.start <= optionRange.end && range.end >= optionRange.start
  }).join(";")
}

function singlePopulationOptionValue(text: string, options: unknown[]) {
  const range = ageYearRange(text)
  if (!range) return ""
  const ageBandOption = singleAgeOptionValue(text, options)
  if (ageBandOption) return ageBandOption
  const candidates = range.end <= 3
    ? ["婴幼儿", "婴童", "幼童", "儿童", "通用"]
    : range.end <= 8
      ? ["幼童", "小童", "儿童", "学生", "通用"]
      : range.start >= 12
        ? ["青少年", "少年", "中学生", "学生", "儿童", "通用"]
        : ["中大童", "中童", "儿童", "少年", "青少年", "学生", "通用"]
  return pickOption(options, candidates.map((candidate) => (option) => option === candidate))
}

function normalizeMaterialOptionValue(value: unknown, options: unknown[]) {
  const text = normalizeMaterialName(stringValue(value).replace(/^\d+(?:\.\d+)?\s*%/, ""))
  if (!text) return ""
  if (!options.length) return text
  const other = pickOption(options, [(option) => /^(?:其他|其它)$/.test(option)])
  if (text === "聚酯纤维") {
    return pickOption(options, [
      (option) => option === "聚酯纤维",
      (option) => option === "聚酯纤维（涤纶）",
      (option) => option === "涤纶(聚酯纤维)",
      (option) => option.includes("聚酯纤维") || option.includes("涤纶"),
    ]) || other || text
  }
  if (text === "棉") {
    return pickOption(options, [
      (option) => option === "棉",
      (option) => option === "纯棉",
      (option) => option === "纯棉(棉含量100%)",
      (option) => option === "棉布",
      (option) => option === "棉混纺",
      (option) => option.includes("棉"),
    ]) || other || text
  }
  if (text === "聚酰胺纤维") {
    return pickOption(options, [
      (option) => option === "聚酰胺纤维",
      (option) => option === "锦纶",
      (option) => option.includes("聚酰胺纤维") || option.includes("锦纶") || option.includes("尼龙"),
    ]) || other || text
  }
  if (text === "粘胶纤维") {
    return pickOption(options, [
      (option) => option === "粘胶纤维",
      (option) => option === "黏胶纤维",
      (option) => option.includes("粘胶") || option.includes("黏胶") || option.includes("粘纤") || option.includes("黏纤"),
    ]) || other || text
  }
  return pickOption(options, [
    (option) => option === text,
    (option) => option.includes(text) || text.includes(option),
    (option) => /^(?:其他|其它)$/.test(option),
  ]) || text
}

function isProductArchiveGenderFieldName(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key.includes("适用性别") || key === "性别" || key === "性别多选"
}

function isNeutralGenderValue(value: unknown) {
  const text = stringValue(value).replace(/\s+/g, "")
  if (!text) return false
  return text === "中"
    || text.includes("中性")
    || text.includes("男女")
    || (text.includes("男") && text.includes("女"))
}

function normalizeProductArchiveGenderOptionValue(value: unknown, options: unknown[]) {
  const text = stringValue(value)
  if (!text) return ""
  const exact = pickOption(options, [(option) => option === text])
  if (exact) return exact

  const values = semicolonTextValues(text)
  if (values.length > 1) {
    const normalizedValues = values.flatMap((item) => semicolonTextValues(normalizeProductArchiveGenderOptionValue(item, options)))
    if (normalizedValues.length === values.length) return uniqueTextValues(normalizedValues).join(";")
  }

  if (isNeutralGenderValue(text)) {
    const neutral = pickOption(options, [
      (option) => option === "中性/男女均可",
      (option) => option === "男女通用",
      (option) => option === "中性",
      (option) => option === "通用",
      (option) => option.includes("中性") || option.includes("男女"),
    ])
    if (neutral) return neutral
    const male = pickOption(options, [
      (option) => option === "男童",
      (option) => option === "男",
      (option) => option.includes("男") && !option.includes("女"),
    ])
    const female = pickOption(options, [
      (option) => option === "女童",
      (option) => option === "女",
      (option) => option.includes("女") && !option.includes("男"),
    ])
    if (male && female) return uniqueTextValues([male, female]).join(";")
    return text
  }

  if (text.includes("男") && !text.includes("女")) {
    return pickOption(options, [
      (option) => option === "男童",
      (option) => option === "男",
      (option) => option.includes("男") && !option.includes("女"),
    ]) || text
  }
  if (text.includes("女") && !text.includes("男")) {
    return pickOption(options, [
      (option) => option === "女童",
      (option) => option === "女",
      (option) => option.includes("女") && !option.includes("男"),
    ]) || text
  }
  return text
}

function normalizeMaterialCompositionValue(value: unknown, options: unknown[]) {
  const parsedComponents = materialComponentsFromText(value)
  if (parsedComponents.length > 0) {
    const values = parsedComponents
      .map((component) => {
        const name = normalizeMaterialOptionValue(component.name, options)
        return name && component.percent ? `${name},${component.percent}` : ""
      })
      .filter(Boolean)
    if (values.length > 0) return values.join(";")
  }
  const values = semicolonTextValues(value).map((item) => {
    const [rawName, ...rawPercent] = item.split(/[,，]/).map((part) => part.trim())
    const name = normalizeMaterialOptionValue(rawName, options)
    const percent = rawPercent.join(",").replace(/%$/, "").trim()
    return name && percent ? `${name},${percent}` : ""
  }).filter(Boolean)
  return values.length ? values.join(";") : stringValue(value)
}

function normalizeMaterialMultiChoiceValue(value: unknown, options: unknown[]) {
  const parsedComponents = materialComponentsFromText(value)
  const sourceValues = parsedComponents.length > 0
    ? parsedComponents.map((component) => component.name)
    : semicolonTextValues(value).map((item) => item.split(/[,，]/)[0])
  const values = sourceValues
    .map((item) => normalizeMaterialOptionValue(item, options))
    .filter(Boolean)
  return values.length ? uniqueTextValues(values).join(";") : stringValue(value)
}

function normalizeMaterialSummaryOptionValue(value: unknown, options: unknown[]) {
  const components = materialComponentsFromText(value)
  if (components.length === 1) return normalizeMaterialOptionValue(components[0].name, options)
  if (components.length > 1) {
    const dominant = [...components].sort((left, right) => Number(right.percent) - Number(left.percent))[0]
    const dominantName = normalizeMaterialName(dominant.name)
    const exactComposition = components
      .map((component) => `${normalizeMaterialName(component.name)}${component.percent}%`)
      .join("+")
    const reverseComposition = components
      .map((component) => `${component.percent}%${normalizeMaterialName(component.name)}`)
      .join("+")
    return pickOption(options, [
      (option) => option === exactComposition || option === reverseComposition,
      (option) => components.every((component) => option.includes(normalizeMaterialName(component.name)))
        && components.every((component) => option.includes(`${component.percent}%`) || option.includes(`${Number(component.percent)}%`)),
      (option) => option === `${dominantName}混纺`,
      (option) => option.includes(`${dominantName}混纺`),
      (option) => option === "混纺",
      (option) => option.includes("混纺") && option.includes(dominantName),
    ]) || normalizeMaterialOptionValue(dominantName, options)
  }
  return normalizeMaterialOptionValue(value, options)
}

function isProductArchiveOriginCountryField(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "原产国"
    || key.startsWith("原产国")
}

function productArchiveChinaOriginOption(options: unknown[]) {
  return pickOption(options, [
    (option) => option === "中国",
    (option) => option === "中国大陆",
    (option) => option === "中国（大陆）",
    (option) => option === "中华人民共和国",
    (option) => /^中国(?:[（(]|大陆|$)/.test(option),
  ])
}

function downContentTemplateOption(value: unknown, options: unknown[]) {
  const text = stringValue(value)
  if (hasExplicitNoFiller(text)) {
    return pickOption(options, [
      (option) => /^(?:无|无填充|不填充)$/.test(option),
      (option) => option === "其他" || /其他|无填充|不填充/.test(option),
    ])
  }
  const percentText = downContentPercentFromText(text)
  if (!percentText) return ""
  const percent = Number(percentText.replace(/%$/, ""))
  if (!Number.isFinite(percent)) return ""
  const exact = pickOption(options, [
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      if (/(?:以上|及以上|起|以下|及以下)/.test(normalized)) return false
      const values = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)%/g)).map((match) => Number(match[1]))
      return values.length === 1 && values[0] === percent
    },
  ])
  if (exact) return exact
  return pickOption(options, [
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      const threshold = normalized.match(/(\d+(?:\.\d+)?)%(?:以上|及以上|起)/)
      return Boolean(threshold) && percent >= Number(threshold[1])
    },
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      const threshold = normalized.match(/(\d+(?:\.\d+)?)%(?:以下|及以下)/)
      return Boolean(threshold) && percent <= Number(threshold[1])
    },
    (option) => {
      const values = Array.from(option.replace(/％/g, "%").matchAll(/(\d+(?:\.\d+)?)%/g)).map((match) => Number(match[1]))
      if (values.length === 1) return percent === values[0]
      if (values.length >= 2) return percent >= Math.min(...values) && percent <= Math.max(...values)
      return false
    },
  ])
}

function percentRangeTemplateOption(value: unknown, options: unknown[]) {
  const percentText = stringValue(value).replace(/％/g, "%").match(/(\d+(?:\.\d+)?)\s*%/)?.[1]
  if (!percentText) return ""
  const percent = Number(percentText)
  if (!Number.isFinite(percent)) return ""
  const exact = pickOption(options, [
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      if (/(?:以上|及以上|起|以下|及以下)/.test(normalized)) return false
      const values = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)%/g)).map((match) => Number(match[1]))
      return values.length === 1 && values[0] === percent
    },
  ])
  if (exact) return exact
  return pickOption(options, [
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      const threshold = normalized.match(/(\d+(?:\.\d+)?)%(?:以上|及以上|起)/)
      return Boolean(threshold) && percent >= Number(threshold[1])
    },
    (option) => {
      const normalized = option.replace(/％/g, "%").replace(/\s+/g, "")
      const threshold = normalized.match(/(\d+(?:\.\d+)?)%(?:以下|及以下)/)
      return Boolean(threshold) && percent <= Number(threshold[1])
    },
    (option) => {
      const values = Array.from(option.replace(/％/g, "%").matchAll(/(\d+(?:\.\d+)?)%/g)).map((match) => Number(match[1]))
      if (values.length === 1) return percent === values[0]
      if (values.length >= 2) return percent >= Math.min(...values) && percent <= Math.max(...values)
      return false
    },
  ])
}

function copywritingPopularElementValue(sourceRows: JsonRecord[]) {
  const sourceText = sourceRowJsonByType(sourceRows, "copywriting")
    .flatMap((row) => Object.values(row).map(stringValue))
    .join("\n")
  if (/费尔岛|提花图案|印花图案/.test(sourceText)) return "图案"
  if (/简约(?:设计|风格)?|无(?:工艺|装饰)|光版/.test(sourceText)) return "光版"
  return ""
}

export function normalizeProductArchiveDeepdrawFieldValue(fieldName: string, value: unknown, options: unknown[]) {
  const text = stringValue(value)
  const key = compactFieldKey(fieldName)
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return text
  if (!text || !options.length) return text
  if (key === "主图4样式") {
    return pickOption(options, [(option) => /225/.test(option)]) || text
  }
  if (isProductArchiveGenderFieldName(fieldName) && text.includes("男") && !text.includes("女")) {
    return pickOption(options, [
      (option) => option === "男",
      (option) => option === "男童",
      (option) => option.includes("男") && !option.includes("女"),
    ]) || text
  }
  if (key === "适用季节" || key === "适用季节多选") {
    const season = productArchiveSeasonText(text).match(/[春夏秋冬]/)?.[0] ?? ""
    const shortSeason = pickOption(options, [(option) => Boolean(season) && option === season])
    if (shortSeason) return shortSeason
  }
  if (key === "功能" || key === "功能多选") {
    const normalized = semicolonTextValues(text)
      .map((item) => pickOption(options, [
        (option) => option === item,
        (option) => option.includes(item) || item.includes(option),
      ]))
      .filter(Boolean)
    if (normalized.length > 0) {
      const values = uniqueTextValues(normalized)
      return key === "功能" ? values[0] : values.join(";")
    }
  }
  if (key === "适用人群多选") {
    const normalized = semicolonTextValues(text)
      .map((item) => pickOption(options, [(option) => option === item]))
      .filter(Boolean)
    if (normalized.length > 1) return uniqueTextValues(normalized).join(";")
  }
  if (key === "适用年龄多选") {
    const values = semicolonTextValues(text)
    if (values.length > 1 && productArchiveFieldValueMatchesOptions(values.join(";"), options, fieldName)) {
      return uniqueTextValues(values).join(";")
    }
    const ageOption = normalizeAgeFieldOptionValue(text, options, true)
    if (ageOption) return ageOption
  }
  const exact = pickOption(options, [(option) => option === text])
  if (exact) return exact
  if (isProductArchiveProductCategoryFieldKey(key)) {
    return productCategoryOptionValue(text, options) || text
  }
  if (isProductArchiveSkuSizeFieldName(fieldName)) {
    const optionByKey = new Map<string, string>()
    for (const option of optionValues(options)) {
      for (const key of sizeMatchKeys(option)) {
        if (!optionByKey.has(key)) optionByKey.set(key, option)
      }
    }
    const values = text.split(/[;；,，]/).map((part) => part.trim()).filter(Boolean)
    const normalized = values.map((value) => {
      for (const key of sizeMatchKeys(value)) {
        const option = optionByKey.get(key)
        if (option) return skuSizeTokenHasDisplayUnit(value) ? value : option
      }
      return ""
    }).filter(Boolean)
    if (normalized.length) return uniqueTextValues(normalized).join(";")
  }
  if (isProductArchiveSizeSegmentFieldName(fieldName)) {
    const apparelSizeSegment = productArchiveApparelSizeSegmentValue(text, options)
    if (apparelSizeSegment) return apparelSizeSegment
    const values = text.split(/[;；,，]/).map((part) => part.trim()).filter(Boolean)
    const normalized = values.map((value) => {
      const size = Number(deepdrawSizeValue(value).match(/^(\d+)cm$/i)?.[1] ?? stringValue(value).match(/^0*(\d{2,3})$/)?.[1])
      if (!Number.isFinite(size)) return ""
      if (size <= 110) return pickOption(options, [(option) => /18\s*cm?以下|18以下/i.test(option)])
      if (size <= 130) return pickOption(options, [(option) => /18\s*-\s*20\s*cm?/i.test(option)])
      if (size <= 150) return pickOption(options, [(option) => /20\s*-\s*22\s*cm?/i.test(option)])
      if (size <= 165) return pickOption(options, [(option) => /22\s*-\s*24\s*cm?/i.test(option)])
      if (size <= 180) return pickOption(options, [(option) => /24\s*-\s*26\s*cm?/i.test(option)])
      return pickOption(options, [(option) => /26\s*cm?以上|26以上/i.test(option)])
    }).filter(Boolean)
    if (normalized.length) return uniqueTextValues(normalized).join(";")
  }
  if (isProductArchiveDownContentFieldKey(key)) {
    return downContentTemplateOption(text, options) || text
  }
  if (key === "里料成分含量多选" || key === "里料材质成分含量多选") {
    const percentOptions = optionValues(options).some((option) => option.includes("%") || option.includes("％"))
    if (percentOptions) {
      const values = semicolonTextValues(text)
        .map((value) => percentRangeTemplateOption(value, options))
        .filter(Boolean)
      if (values.length) return uniqueTextValues(values).join(";")
    }
    return normalizeMaterialMultiChoiceValue(text, options)
  }
  if (key === "成分含量" || key === "主面料成分含量") {
    const percentOption = percentRangeTemplateOption(text, options)
    if (percentOption) return percentOption
  }
  if (key === "单位" || key === "计量单位") {
    return pickOption(options, [(option) => option === "件"]) || text
  }
  if (/^主图\d+$/.test(key)) {
    if (/两条装|2条装/.test(text)) {
      return pickOption(options, [
        (option) => option === "内裤2条装225",
        (option) => option === "内裤2条装",
        (option) => /2条装/.test(option),
      ]) || text
    }
    if (/两双装|2双装/.test(text)) {
      return pickOption(options, [
        (option) => option === "袜子2双装225",
        (option) => option === "袜子2双装",
        (option) => /2双装/.test(option),
      ]) || text
    }
    if (/两件装|2件装/.test(text)) {
      return pickOption(options, [
        (option) => option === "两件套225",
        (option) => option === "两件套",
        (option) => /2件装|两件/.test(option),
      ]) || text
    }
  }
  if (key.includes("参考价格类型")) {
    return pickOption(options, [(option) => option === "吊牌价", (option) => option.includes("吊牌")]) || text
  }
  if (key === "模特实拍") {
    if (/有模拍|有模特|真人|模特/.test(text)) {
      return pickOption(options, [(option) => option === "实拍有模特", (option) => option.includes("有模特")]) || text
    }
    if (/无模拍|无模特|没有模特/.test(text)) {
      return pickOption(options, [(option) => option === "实拍无模特", (option) => option.includes("无模特")]) || text
    }
  }
  if (key === "是否可开档" || key === "是否开裆" || key === "是否可开裆") {
    if (/^(?:否|不|无)|不开|闭档/.test(text)) {
      return pickOption(options, [
        (option) => option === "不开裆",
        (option) => option === "闭档",
        (option) => option.includes("不开"),
        (option) => option.includes("闭档"),
      ]) || text
    }
    if (/^(?:是|有)|开[档裆]/.test(text)) {
      return pickOption(options, [
        (option) => option === "开裆",
        (option) => option === "开档",
        (option) => option.includes("可开"),
        (option) => option.includes("开裆") || option.includes("开档"),
      ]) || text
    }
  }
  if (key === "服装版型" || key === "版型" || key.endsWith("版型")) {
    if (/宽松/.test(text)) return pickOption(options, [(option) => option === "宽松型", (option) => option === "宽松", (option) => option.includes("宽松")]) || text
    if (/标准|常规/.test(text)) return pickOption(options, [(option) => option === "标准型", (option) => option === "标准", (option) => option === "常规"]) || text
    if (/紧身/.test(text)) return pickOption(options, [(option) => option === "紧身型", (option) => option === "紧身", (option) => option.includes("紧身")]) || text
    if (/直筒/.test(text)) return pickOption(options, [(option) => option === "直筒型", (option) => option === "直筒", (option) => option.includes("直筒")]) || text
    if (/收腰/.test(text)) return pickOption(options, [(option) => option === "收腰型", (option) => option.includes("收腰")]) || text
  }
  if (key === "厚薄" || key === "厚度" || key.endsWith("厚薄指数")) {
    if (/偏厚|厚实|厚款|加厚/.test(text)) {
      return pickOption(options, [(option) => option === "超厚", (option) => option === "厚", (option) => option.includes("厚") && !option.includes("薄")]) || text
    }
    if (/适中|普通|常规/.test(text)) return pickOption(options, [(option) => option === "适中", (option) => option === "普通", (option) => option === "常规"]) || text
    if (/超薄/.test(text)) return pickOption(options, [(option) => option === "超薄"]) || text
    if (/轻薄|薄款|偏薄|薄/.test(text)) return pickOption(options, [(option) => option === "轻薄", (option) => option === "薄", (option) => option.includes("薄")]) || text
  }
  if (key === "弹力" || key === "弹性" || key.endsWith("弹力指数") || key.endsWith("弹性指数")) {
    if (/无弹/.test(text)) return pickOption(options, [(option) => option === "无弹", (option) => option.includes("无弹")]) || text
    if (/微弹/.test(text)) return pickOption(options, [(option) => option === "微弹", (option) => option.includes("微弹")]) || text
    if (/高弹/.test(text)) return pickOption(options, [(option) => option === "高弹", (option) => option.includes("高弹")]) || text
    if (/弹力|弹性/.test(text)) return pickOption(options, [(option) => option === "常规", (option) => option === "微弹", (option) => option.includes("弹")]) || text
  }
  if (key === "腰型" && /不适用|无|其他/.test(text)) {
    return pickOption(options, [(option) => option === "自然腰", (option) => option === "松紧腰", (option) => option.includes("腰")]) || text
  }
  if (key === "裤门襟" && /不适用|无|其他/.test(text)) {
    return pickOption(options, [(option) => option === "松紧", (option) => option === "松紧带", (option) => option === "其他"]) || text
  }
  if (isProductArchiveFillerFieldKey(key)) {
    if (hasExplicitNoFiller(text)) {
      return pickOption(options, [
        (option) => /^(?:无|无填充|不填充)$/.test(option),
        (option) => option === "其他" || /其他|无填充|不填充/.test(option),
      ]) || text
    }
    const filler = downFillerNameFromText(text)
    if (filler) {
      return pickOption(options, [
        (option) => option === filler,
        (option) => option.includes(filler) || filler.includes(option),
        (option) => filler === "鸭绒" && option.includes("鸭绒"),
        (option) => filler === "鹅绒" && option.includes("鹅绒"),
      ]) || pickOption(options, [(option) => option === "其他"]) || text
    }
  }
  if (isProductArchiveOriginCountryField(fieldName) && /中国|china/i.test(text)) {
    return productArchiveChinaOriginOption(options) || text
  }
  if (["帮面材质", "帮面材质多选", "鞋面材质", "鞋面材质多选", "配皮材质", "配皮材质多选"].includes(key)) {
    if (/kpu|超纤|微纤/i.test(text)) {
      return pickOption(options, [
        (option) => /微纤维革|超纤/.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/合成材料|合成革|pu\b|羊巴革|油蜡/i.test(text)) {
      return pickOption(options, [
        (option) => /合成革|人造革|PU/i.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/织物|布料|纺织/.test(text)) {
      return pickOption(options, [
        (option) => /棉布|绸缎|灯芯绒|织物|纺织/.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
  }
  if (["内里材质", "内里材质多选", "里料材质", "里料材质多选"].includes(key)) {
    if (/短毛绒|天鹅绒|羊羔绒|绒/.test(text)) {
      return pickOption(options, [
        (option) => /人造毛|绒|纺织/.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/织物|布料|纺织/.test(text)) {
      return pickOption(options, [
        (option) => /纺织|织物/.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
  }
  if (["鞋底材质", "鞋底材质多选"].includes(key)) {
    if (/md|eva/i.test(text)) {
      return pickOption(options, [
        (option) => /EVA/i.test(option),
        (option) => /复合底/.test(option),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/rb|橡胶/i.test(text)) return pickOption(options, [(option) => /橡胶/.test(option)]) || text
    if (/tpr/i.test(text)) return pickOption(options, [(option) => /TPR|橡胶|复合底/i.test(option)]) || text
  }
  if (["闭合方式", "闭合方式多选"].includes(key)) {
    if (/粘扣|魔术贴|搭带/.test(text)) return pickOption(options, [(option) => /魔术贴|粘扣/.test(option)]) || text
    if (/旋钮|随芯/.test(text)) return pickOption(options, [(option) => /旋钮|旋扣/.test(option)]) || text
    if (/松紧带|套脚/.test(text)) return pickOption(options, [(option) => /松紧/.test(option)]) || text
    if (/系带|鞋带/.test(text)) return pickOption(options, [(option) => /系带|鞋带/.test(option)]) || text
  }
  if (["鞋帮高度", "鞋帮高度多选", "靴筒高度"].includes(key)) {
    if (/高帮/.test(text)) return pickOption(options, [(option) => /高帮|高筒/.test(option)]) || text
    if (/中帮/.test(text)) return pickOption(options, [(option) => /中帮|中筒/.test(option)]) || text
    if (/低帮|浅口/.test(text)) return pickOption(options, [(option) => /低帮|低筒|浅口/.test(option)]) || text
  }
  if (["流行元素", "流行元素多选"].includes(key)) {
    const normalized = semicolonTextValues(text)
      .map((item) => pickOption(options, [
        (option) => option === item,
        (option) => item === "反光" && /反光/.test(option),
        (option) => item === "魔术贴" && /魔术贴|粘扣/.test(option),
        (option) => item === "旋钮扣" && /旋钮|旋扣/.test(option),
        (option) => item === "旋钮扣" && option === "搭扣",
        (option) => option.includes(item) || item.includes(option),
      ]))
      .filter(Boolean)
    if (normalized.length > 0) return uniqueTextValues(normalized).join(";")
  }
  if (["款式单选", "款式", "类型", "类型多选"].includes(key) && /鞋/.test(text)) {
    return pickOption(options, [
      (option) => option === text,
      (option) => /运动板鞋/.test(text) && option === "板鞋",
      (option) => /爬爬鞋|学步鞋/.test(text) && option === "学步鞋",
      (option) => /拖鞋/.test(text) && option === "拖鞋",
      (option) => /户外|运动/.test(text) && /户外|运动|运动鞋/.test(option),
      (option) => /板鞋/.test(text) && /板鞋/.test(option),
      (option) => option.includes(text) || text.includes(option),
    ]) || text
  }
  if (key === "材质功能") {
    if (/防渗水|防水/.test(text)) {
      return pickOption(options, [(option) => option === "防水", (option) => option === "防泼水"]) || text
    }
    if (/防泼水/.test(text)) return pickOption(options, [(option) => option === "防泼水", (option) => option === "防水"]) || text
    if (/保温|保暖|抗寒/.test(text)) return pickOption(options, [(option) => option === "抗寒", (option) => option === "常规"]) || text
  }
  if (key === "鞋垫材质") {
    if (/长毛绒/.test(text)) {
      return pickOption(options, [
        (option) => option === "人造长毛绒",
        (option) => option.includes("人造") && option.includes("长毛绒"),
        (option) => option === "人造毛",
        (option) => option === "纺织品类" || option === "纺织布料",
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/短毛绒|羊羔绒|人造毛|天鹅绒/.test(text)) {
      return pickOption(options, [
        (option) => option === "人造短毛绒",
        (option) => option.includes("人造") && option.includes("短毛绒"),
        (option) => option === "人造毛",
        (option) => option === "纺织品类" || option === "纺织布料",
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
    if (/织物|布料|纺织/.test(text)) {
      return pickOption(options, [
        (option) => option === "纺织布料",
        (option) => option === "纺织品类",
        (option) => option.includes("纺织"),
        (option) => /^(?:其他|其它)$/.test(option),
      ]) || text
    }
  }
  if (key === "材质成分" || key === "京东材质成分") return normalizeMaterialCompositionValue(text, options)
  if (key === "面料多选" || key === "材质多选" || key === "材质成分多选") {
    return normalizeMaterialMultiChoiceValue(text, options)
  }
  if (key.includes("门襟") && /系扣/.test(text)) {
    return pickOption(options, [
      (option) => option === "纽扣",
      (option) => option === "系扣",
      (option) => option.includes("扣"),
    ]) || text
  }
  if (key.includes("颜色")) {
    const values = text.split(/[;；]/).map((part) => part.trim()).filter(Boolean)
    const normalized = values.map((item) => {
      const parts = item.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
      const rawBase = parts[0] || item
      const rawAlias = parts[1] || ""
      const base = baseColorName(rawBase)
      const aliasOption = rawAlias
        ? pickOption(options, [
            (option) => option === rawAlias,
            (option) => rawAlias.includes(option) || option.includes(rawAlias),
          ])
        : ""
      const option = aliasOption || pickOption(options, [
        (option) => option === rawBase,
        (option) => option === item,
        (option) => item.includes(option) || option.includes(item),
        (option) => option === base,
      ]) || nearestProductArchiveColorOption(rawBase, options)
      if (!option) return ""
      const alias = rawAlias || (item !== option ? item : "")
      return { option, alias: alias && alias !== option ? alias : "" }
    }).filter((entry): entry is ProductArchiveColorEntry => Boolean(entry))
    if (normalized.length) return uniqueProductArchiveColorEntries(normalized).join(";")
  }
  if (key === "品牌单选" || key === "品牌") {
    if (/巴拉巴拉|balabala/i.test(text)) {
      return pickOption(options, [(option) => /巴拉巴拉|balabala/i.test(option)]) || text
    }
  }
  if (key === "分类" || key === "类型") {
    if (text.includes("外套")) {
      return pickOption(options, [
        (option) => option === "普通外套",
        (option) => option === "外套",
        (option) => option.includes("外套"),
      ]) || text
    }
  }
  if (key === "款式单选" || key === "款式") {
    return pickOption(options, [
      (option) => option === text,
      (option) => text.includes(option) || option.includes(text),
      (option) => /三合一|一衣三穿/.test(text) && /三合一|一衣三穿/.test(option),
      (option) => /棉服|棉衣/.test(text) && option === "短款棉服",
      (option) => /棉服|棉衣/.test(text) && /棉服/.test(option),
      (option) => option === "连帽外套",
      (option) => option.includes("外套"),
    ]) || text
  }
  if (key === "功能多选" && /防风|防泼水|透气|静电|升温|保暖/.test(text)) {
    const normalized = [
      { pattern: /防风/, values: ["防风"] },
      { pattern: /防泼水/, values: ["防泼水", "防水"] },
      { pattern: /透气/, values: ["透气"] },
      { pattern: /抗静电|防静电/, values: ["防静电", "抗静电"] },
      { pattern: /升温|保暖/, values: ["保暖", "保温"] },
    ].map(({ pattern, values }) => (
      pattern.test(text) ? pickOption(options, values.map((value) => (option) => option === value)) : ""
    )).filter(Boolean)
    if (normalized.length) return normalized.join(";")
  }
  if (key === "安全等级" || key === "安全等级多选") {
    const level = text.match(/[ABC]\s*类/i)?.[0]?.toUpperCase().replace(/\s+/g, "") ?? ""
    if (level) return pickOption(options, [(option) => option === level, (option) => option.startsWith(level)]) || text
  }
  if (key === "尺码表" && text.includes(";")) {
    const normalized = text.split(/[;；]/).map((item) => pickOption(options, [(option) => option === item])).filter(Boolean)
    if (normalized.length) return normalized.join(";")
  }
  if (key === "性别多选") {
    return normalizeProductArchiveGenderOptionValue(text, options) || text
  }
  if (key === "成分含量" && text.includes("100%")) {
    return pickOption(options, [(option) => option === "100%", (option) => option.includes("95%")]) || text
  }
  if (key === "是否带帽" && text.includes("帽")) {
    return pickOption(options, [
      (option) => option === "有帽可拆",
      (option) => option === "有帽不可拆",
      (option) => option === "连帽",
      (option) => option.includes("有帽"),
    ]) || text
  }
  if (key === "是否库存" && text === "否") {
    return pickOption(options, [(option) => option === "否"]) || text
  }
  if ((key === "衣长" || key === "袖长" || key === "领型" || key === "退款规则" || key === "面料工艺") && text) {
    return pickOption(options, [(option) => option === text, (option) => option.includes(text) || text.includes(option)]) || text
  }
  if ((key === "适用人群" || key === "适用人群多选") && /男|女|中性|男女/.test(text)) {
    return normalizeProductArchiveGenderOptionValue(text, options) || text
  }
  if (key === "适用人群多选" && /幼童|婴幼童/.test(text)) {
    return pickOption(options, [(option) => option === "幼童", (option) => option === "婴童"]) || text
  }
  if (key === "适用人群多选" && ageYearRange(text)) {
    return multiPopulationOptionValue(text, options) || singleAgeOptionValue(text, options) || text
  }
  if (key === "适用人群" && ageYearRange(text)) {
    return singlePopulationOptionValue(text, options) || text
  }
  if (key === "适用季节" || key === "适用季节多选") {
    const seasonText = productArchiveSeasonText(text)
    const season = seasonText.match(/[春夏秋冬]/)?.[0] ?? ""
    return pickOption(options, [
      (option) => option === seasonText,
      (option) => Boolean(season) && option === `${season}季`,
      (option) => Boolean(season) && option === season,
      (option) => option === "秋季",
      (option) => option === "秋",
    ]) || text
  }
  if (key === "适用年龄多选") {
    const values = semicolonTextValues(text)
    if (values.length > 1 && productArchiveFieldValueMatchesOptions(values.join(";"), options, fieldName)) {
      return uniqueTextValues(values).join(";")
    }
    return normalizeAgeFieldOptionValue(text, options, true)
      || multiAgeOptionValue(text, options)
      || pickOption(options, [(option) => option === "1-3岁", (option) => option.includes("3岁（含）")])
      || text
  }
  if (key === "适用年龄文本") {
    return pickOption(options, [(option) => option === "3周岁以上", (option) => option === "3周岁以下", (option) => option === "通用"]) || text
  }
  if (key === "风格" || key === "风格多选") {
    return pickOption(options, [(option) => option === "休闲", (option) => option === "休闲风", (option) => option === "简约"]) || text
  }

  if (key.includes("柔软") && text.includes("偏硬")) {
    return pickOption(options, [(option) => option === "微硬", (option) => option === "硬"]) || text
  }
  if (key.includes("发货方式") && /快递/.test(text)) {
    return pickOption(options, [(option) => option === "快递发货", (option) => option.includes("快递")]) || text
  }
  if (key === "上市时间") {
    return seasonOptionValue(text, options) || text
  }
  if (isProductArchiveGenderFieldName(fieldName)) {
    return normalizeProductArchiveGenderOptionValue(text, options) || text
  }
  if (key.includes("适用年龄") || key.includes("年龄")) {
    const ageOption = normalizeAgeFieldOptionValue(text, options, false) || singleAgeOptionValue(text, options)
    if (ageOption) return ageOption
    if (/婴|幼童/.test(text)) {
      return pickOption(options, [
        (option) => option.includes("婴幼童"),
        (option) => option.includes("0—3") || option.includes("0~3"),
      ]) || text
    }
    if (/中小童|100|110|120|130/.test(text)) {
      return pickOption(options, [(option) => option.includes("中小童")]) || text
    }
  }
  if (/材质|面料|里料/.test(fieldName)) {
    const materialOption = normalizeMaterialSummaryOptionValue(text, options)
    if (materialOption && productArchiveFieldValueMatchesOptions(materialOption, options)) return materialOption
    if (/棉/.test(text)) {
      return pickOption(options, [
        (option) => option === "纯棉(棉含量100%)",
        (option) => option === "棉100%",
        (option) => option === "纯棉",
        (option) => option === "棉",
        (option) => option.includes("棉100%"),
        (option) => option.includes("纯棉"),
        (option) => option.includes("棉"),
      ]) || text
    }
    if (/聚酯纤维|涤纶/.test(text)) {
      return pickOption(options, [
        (option) => option === "聚酯纤维（涤纶）",
        (option) => option === "聚酯纤维",
        (option) => option.includes("聚酯纤维"),
        (option) => option.includes("涤纶"),
      ]) || text
    }
  }
  if (productArchiveFieldValueMatchesOptions(text, options)) return text
  return text
}

export function normalizeProductArchiveTemplateFieldValue(
  fieldName: string,
  value: unknown,
  options: unknown[],
  input: { preserveInvalid?: boolean } = {},
) {
  const normalized = normalizeProductArchiveDeepdrawFieldValue(fieldName, value, options)
  if (!hasValue(normalized) || !options.length || input.preserveInvalid) return normalized
  return productArchiveFieldValueMatchesOptions(normalized, options, fieldName) ? normalized : ""
}

function semicolonTextValues(value: unknown) {
  return stringValue(value).split(/[;；]/).map((part) => part.trim()).filter(Boolean)
}

type ProductArchiveColorEntry = {
  option: string
  alias: string
}

function productArchiveColorEntryValue(entry: ProductArchiveColorEntry) {
  return entry.alias && entry.alias !== entry.option ? `${entry.option},${entry.alias}` : entry.option
}

function compactProductArchiveColorAlias(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").replace(/[，,;；]/g, "")
}

function productArchiveColorEntriesOverlap(left: ProductArchiveColorEntry, right: ProductArchiveColorEntry) {
  if (left.option !== right.option) return false
  const leftAlias = compactProductArchiveColorAlias(left.alias)
  const rightAlias = compactProductArchiveColorAlias(right.alias)
  if (!leftAlias || !rightAlias) return true
  return leftAlias === rightAlias || leftAlias.includes(rightAlias) || rightAlias.includes(leftAlias)
}

function productArchiveColorEntrySpecificity(entry: ProductArchiveColorEntry) {
  return compactProductArchiveColorAlias(entry.alias).length
}

function uniqueProductArchiveColorEntries(entries: ProductArchiveColorEntry[]) {
  const selected: ProductArchiveColorEntry[] = []
  for (const entry of entries) {
    const existingIndex = selected.findIndex((item) => productArchiveColorEntriesOverlap(item, entry))
    if (existingIndex < 0) {
      selected.push(entry)
      continue
    }
    const existing = selected[existingIndex]
    if (productArchiveColorEntrySpecificity(entry) > productArchiveColorEntrySpecificity(existing)) {
      selected[existingIndex] = entry
    }
  }
  return uniqueTextValues(selected.map(productArchiveColorEntryValue))
}

export function mergeProductArchiveColorFieldValues(values: unknown[]) {
  return uniqueTextValues(values.flatMap((value) => semicolonTextValues(value))).join(";")
}

function optionValueForAiChoice(options: Array<{ value: string; label: string }>, value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  const option = options.find((item) => item.value === text || item.label === text)
  return option?.value ?? ""
}

function normalizeProductArchiveAiColorFillValue(
  currentValue: unknown,
  aiValue: unknown,
  options: Array<{ value: string; label: string }>,
) {
  const currentColors = semicolonTextValues(currentValue)
  const aiColors = semicolonTextValues(aiValue)
  if (!currentColors.length || !aiColors.length || currentColors.length !== aiColors.length) return ""
  const values: string[] = []
  for (let index = 0; index < currentColors.length; index += 1) {
    const currentParts = currentColors[index].split(/[,，]/).map((part) => part.trim()).filter(Boolean)
    const aiParts = aiColors[index].split(/[,，]/).map((part) => part.trim()).filter(Boolean)
    const standardColor = optionValueForAiChoice(options, aiParts[0])
    if (!standardColor) return ""
    const alias = aiParts[1] || currentParts[1] || currentParts[0] || ""
    values.push(alias && alias !== standardColor ? `${standardColor},${alias}` : standardColor)
  }
  return uniqueTextValues(values).join(";")
}

export function normalizeProductArchiveAiFillValue(
  fieldName: string,
  currentValue: unknown,
  aiValue: unknown,
  options: Array<{ value: string; label: string }>,
) {
  if (compactFieldKey(fieldName).includes("颜色")) {
    return normalizeProductArchiveAiColorFillValue(currentValue, aiValue, options)
  }
  const exact = optionValueForAiChoice(options, aiValue)
  if (exact) return exact
  const normalized = normalizeProductArchiveDeepdrawFieldValue(fieldName, aiValue, options)
  return productArchiveFieldValueMatchesOptions(normalized, options, fieldName) ? normalized : ""
}

export function productArchiveSkuColorMatchesOptions(
  sku: JsonRecord,
  allowedColorValues: Iterable<string>,
  fields: JsonRecord[] = [],
) {
  const allowedColors = new Set(Array.from(allowedColorValues).map(stringValue).filter(Boolean))
  if (!allowedColors.size) return true
  const colorCandidates = uniqueTextValues([
    sku.color_name,
    sku.color_code,
    ...deepdrawColorValue(sku.color_name).split(/[,，]/).map((part) => part.trim()).filter(Boolean),
  ])
  if (colorCandidates.some((color) => allowedColors.has(color))) return true

  for (const field of fields) {
    const fieldName = stringValue(field.field_name)
    if (!/颜色|色$|color/i.test(fieldName)) continue
    for (const value of semicolonTextValues(field.value_text)) {
      const parts = value.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
      const standardColor = parts[0] ?? ""
      const alias = parts[1] ?? ""
      if (!standardColor || !alias || !allowedColors.has(standardColor)) continue
      if (colorCandidates.some((color) => color === alias || alias.includes(color) || color.includes(alias))) {
        return true
      }
    }
  }
  return false
}

export type ProductArchiveAiFillCandidate = {
  id: number
  fieldName: string
  currentValue: string
  validationStatus: string
  validationMessage: string
  required: boolean
  strategy: ProductArchiveAiFieldStrategy | null
  options: Array<{ value: string; label: string }>
}

const AI_FILL_MIN_CONFIDENCE = 0.7
const AI_FILL_REFERENCE_IMAGE_LIMIT = 4
const AI_FILL_REFERENCE_IMAGE_MAX_BYTES = 4 * 1024 * 1024
const AI_FILL_OCR_DEFAULT_FILE_LIMIT = 6
const AI_FILL_OCR_MAX_FILE_LIMIT = 12

function aiFillOcrFileLimit() {
  const value = Number(process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_OCR_FILE_LIMIT ?? AI_FILL_OCR_DEFAULT_FILE_LIMIT)
  if (!Number.isFinite(value)) return AI_FILL_OCR_DEFAULT_FILE_LIMIT
  return Math.max(1, Math.min(Math.floor(value), AI_FILL_OCR_MAX_FILE_LIMIT))
}

function productArchiveAiFillOcrTargetField(field: JsonRecord) {
  const sourceType = stringValue(field.source_type)
  const aiGenerated = sourceType === "ai" || sourceType === "ai_rule_fallback"
  if (Boolean(field.manual_override) && !aiGenerated) return false
  const needsFill = sourceType === "ai_rule_fallback"
    || stringValue(field.validation_status) === "invalid"
    || (!hasValue(field.value_text) && !hasValue(recordValue(field.value_json)))
  if (!needsFill) return false
  const name = compactFieldKey(field.field_name)
  if (name.includes("执行标准") || name.includes("执行规范")) return true
  if (name === "安全等级" || name === "安全等级多选" || name.includes("安全技术类别") || name.includes("安全类别") || name.includes("安全技术要求")) return true
  if (name.includes("产品等级") || name.includes("质量等级")) return true
  if (["产品名称", "商品名称", "品名", "产品货号", "商品货号", "货号", "款号"].includes(name)) return true
  if (name.includes("材质成分") || name.includes("面料成分") || name.includes("成分含量文本")) return true
  if ((name.includes("材质") || name.includes("面料")) && arrayValue(field.options_json).length > 0) return true
  if (name.includes("充绒量") && arrayValue(field.options_json).length === 0) return true
  return name.includes("洗涤说明") || name.includes("洗护说明") || name.includes("洗涤方法")
}

function productArchiveAiFillOcrFile(image: JsonRecord, fileExists: (filePath: string) => boolean) {
  const listKind = stringValue(image.kind) || productArchiveDraftListImageKind(image)
  const payloadKind = stringValue(recordValue(image.raw_payload_json).asset_kind || image.asset_kind).toLowerCase()
  const sourceKind = listKind === "hangtag" || listKind === "washlabel"
    ? listKind
    : listKind === "flat_image" || payloadKind === "flat_image"
      ? "flat_image"
      : ""
  if (!sourceKind) return null
  const filePath = stringValue(image.local_path)
  if (!filePath || !fileExists(filePath)) return null
  const fileName = stringValue(image.original_file_name)
    || stringValue(image.source_ref)
    || stringValue(image.file_name)
    || `draft-image-${image.id}`
  const mimeType = stringValue(image.mime_type).toLowerCase()
  return {
    filePath,
    fileName,
    fileType: mimeType === "application/pdf" || uploadExtension(fileName) === ".pdf" ? "pdf" : "image",
    sourceKind,
  }
}

export async function buildProductArchiveAiFillOcrFallback(input: {
  draftId: number
  spuCode: string
  fields?: JsonRecord[]
  images?: JsonRecord[]
}, options: AiFillOptions = {}) {
  const warnings: ProductArchiveAiFillWarning[] = []
  const fields = input.fields ?? []
  if (!fields.some(productArchiveAiFillOcrTargetField)) return { fills: [], documents: [], warnings }

  const fileExists = options.fileExists ?? fs.existsSync
  const availableFiles = (input.images ?? [])
    .map((image) => productArchiveAiFillOcrFile(image, fileExists))
    .filter((file): file is NonNullable<ReturnType<typeof productArchiveAiFillOcrFile>> => Boolean(file))
  const labelFiles = availableFiles.filter((file) => file.sourceKind === "hangtag" || file.sourceKind === "washlabel")
  const flatImageFiles = availableFiles.filter((file) => file.sourceKind === "flat_image")
  const fileLimit = aiFillOcrFileLimit()
  const primaryFiles = (labelFiles.length > 0 ? labelFiles : flatImageFiles).slice(0, fileLimit)
  const fallbackFlatImageFiles = labelFiles.length > 0
    ? flatImageFiles.slice(0, Math.max(0, fileLimit - primaryFiles.length))
    : []
  if (primaryFiles.length === 0) return { fills: [], documents: [], warnings }

  try {
    const recognizer = options.ocrRecognizer ?? recognizeProductArchiveOcrFiles
    const recognizeFiles = async (files: typeof primaryFiles) => {
      const documents = await recognizer(files, {
        fetchImpl: options.fetchImpl,
        aiRouter: options.router,
        ...(options.ocrOptions ?? {}),
        signal: options.signal,
      }) as JsonRecord[]
      throwIfAborted(options.signal)
      return documents
    }
    const { buildProductArchiveAiFillOcrEvidenceFills } = await import("./product-archive-hangtag-ocr")
    let documents = await recognizeFiles(primaryFiles)
    let fills = buildProductArchiveAiFillOcrEvidenceFills({
      draftId: input.draftId,
      spuCode: input.spuCode,
      fields,
      documents,
    })
    const targetFieldIds = new Set(
      fields.filter(productArchiveAiFillOcrTargetField).map((field) => Number(field.id)),
    )
    const filledFieldIds = new Set(fills.map((fill) => Number(fill.field_id)))
    const needsFlatImageFallback = fallbackFlatImageFiles.length > 0
      && Array.from(targetFieldIds).some((fieldId) => !filledFieldIds.has(fieldId))
    if (needsFlatImageFallback) {
      try {
        const flatImageDocuments = await recognizeFiles(fallbackFlatImageFiles)
        documents = [...documents, ...flatImageDocuments]
        fills = buildProductArchiveAiFillOcrEvidenceFills({
          draftId: input.draftId,
          spuCode: input.spuCode,
          fields,
          documents,
        })
      } catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error
        const message = error instanceof Error ? error.message : String(error)
        warnings.push({
          code: "ocr_fallback_unavailable",
          message: `AI 填充的平铺图 OCR 二次兜底暂不可用：${message}`,
        })
      }
    }
    const failedDocuments = documents.filter((document) => stringValue(document.status) === "ocr_failed")
    if (failedDocuments.length > 0) {
      warnings.push({
        code: "ocr_fallback_unavailable",
        message: `AI 填充的吊牌/洗唛/平铺图 OCR 兜底有 ${failedDocuments.length} 个文件识别失败，已继续其余字段填充`,
      })
    }
    const mismatchedDocuments = documents.filter((document) => {
      const detectedSpuCode = stringValue(document.detectedSpuCode)
      return detectedSpuCode && detectedSpuCode !== stringValue(input.spuCode)
    })
    if (mismatchedDocuments.length > 0) {
      warnings.push({
        code: "ocr_fallback_spu_mismatch",
        message: `AI 填充已跳过 ${mismatchedDocuments.length} 个款号不一致的吊牌/洗唛/平铺图 OCR 结果`,
      })
    }
    return { fills, documents, warnings }
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error
    const message = error instanceof Error ? error.message : String(error)
    warnings.push({
      code: "ocr_fallback_unavailable",
      message: `AI 填充的吊牌/洗唛/平铺图 OCR 兜底暂不可用：${message}`,
    })
    return { fills: [], documents: [], warnings }
  }
}

function compactAiText(value: unknown, maxLength = 240) {
  const text = typeof value === "object" && value !== null
    ? JSON.stringify(value)
    : stringValue(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function pickAiContextFields(record: JsonRecord, patterns: RegExp[], maxFields = 40) {
  const output: JsonRecord = {}
  for (const [key, value] of Object.entries(record)) {
    if (Object.keys(output).length >= maxFields) break
    if (!patterns.some((pattern) => pattern.test(key))) continue
    const text = compactAiText(value)
    if (text) output[key] = text
  }
  return output
}

function buildMdmMasterAiContext(draft: JsonRecord, mdmSpu: JsonRecord = {}) {
  const snapshotSpu = recordValue(recordValue(draft.source_snapshot_json).spu)
  const merged = { ...snapshotSpu, ...mdmSpu }
  return pickAiContextFields(merged, [
    /spu|款号|货号|商品|名称|标题|brand|品牌/i,
    /category|class|类目|品类|产品线|季|season|year|年份/i,
    /gender|性别|年龄|age|尺码段|size/i,
    /price|吊牌|零售价|filler|填充|材质|面料|成分/i,
  ])
}

function isAiRuleFallbackField(field: JsonRecord) {
  if (stringValue(field.source_type) !== "ai_rule_fallback") return false
  const metadata = recordValue(field.value_json)
  return stringValue(metadata.source) === "AI_RULE_FALLBACK" || recordValue(metadata.ai_fill).fallback === true
}

function buildFilledFieldAiContext(fields: JsonRecord[], candidates: ProductArchiveAiFillCandidate[]) {
  const candidateIds = new Set(candidates.map((field) => field.id))
  return fields
    .filter((field) => !candidateIds.has(Number(field.id)))
    .filter((field) => !isAiRuleFallbackField(field))
    .filter((field) => hasValue(stringValue(field.value_text)) || hasValue(recordValue(field.value_json)))
    .slice(0, 120)
    .map((field) => ({
      field_name: stringValue(field.field_name),
      value: stringValue(field.value_text) || compactAiText(recordValue(field.value_json), 240),
      source_type: stringValue(field.source_type),
      validation_status: stringValue(field.validation_status),
    }))
}

function buildSourceRowsAiContext(sourceRows: JsonRecord[]) {
  return sourceRows.slice(0, 12).map((row) => ({
    source_type: stringValue(row.source_type),
    skc_code: stringValue(row.skc_code) || undefined,
    row: pickAiContextFields(recordValue(row.row_json), [
      /款号|货号|名称|标题|类目|品类|季|性别|年龄|尺码段|颜色|属性/,
      /材质|面料|成分|填充|绒|厚薄|弹性|功能|风格|元素|工艺/,
      /推荐|FAB|卖点|文案|吊牌|洗唛|执行|安全|等级/,
    ], 35),
  })).filter((row) => Object.keys(row.row).length > 0)
}

export function productArchiveAiFillReferenceImageRole(image: JsonRecord) {
  const payload = recordValue(image.raw_payload_json)
  const assetKind = stringValue(payload.asset_kind || image.asset_kind).toLowerCase()
  if (assetKind === "flat_image") return "flat_image"
  if (assetKind === "model_image") return "model_image"
  if (assetKind === "main_image" || assetKind === "main" || assetKind === "primary_image") return "main_image"

  const text = [
    image.original_file_name,
    image.source_ref,
    image.file_name,
    payload.original_file_name,
    payload.source_ref,
  ].map(stringValue).join(" ")
  if (/主图|main[_ -]?image|primary[_ -]?image/i.test(text)) return "main_image"
  if (/平铺|平铺图|flat[_ -]?image/i.test(text)) return "flat_image"

  const explicitKind = stringValue(image.kind)
  if (explicitKind === "hangtag" || explicitKind === "washlabel") return explicitKind

  const listKind = productArchiveDraftListImageKind(image)
  if (listKind === "hangtag" || listKind === "washlabel") return listKind
  return "reference_image"
}

function productArchiveAiFillReferenceImageRoleLabel(role: string) {
  switch (role) {
    case "flat_image": return "平铺图"
    case "main_image": return "主图"
    case "model_image": return "模特图"
    case "hangtag": return "吊牌图"
    case "washlabel": return "洗唛图"
    default: return "商品参考图"
  }
}

function productArchiveAiFillReferenceImageRank(image: JsonRecord) {
  const role = productArchiveAiFillReferenceImageRole(image)
  const ranks: Record<string, number> = {
    flat_image: 0,
    main_image: 1,
    model_image: 2,
    reference_image: 3,
    hangtag: 4,
    washlabel: 5,
  }
  return ranks[role] ?? 6
}

export function sortProductArchiveAiFillReferenceImages(referenceImages: JsonRecord[]) {
  return [...referenceImages].sort((left, right) => (
    productArchiveAiFillReferenceImageRank(left) - productArchiveAiFillReferenceImageRank(right)
    || Number(left.sort_no ?? 0) - Number(right.sort_no ?? 0)
    || Number(left.id ?? 0) - Number(right.id ?? 0)
  ))
}

function buildReferenceImageAiContext(referenceImages: JsonRecord[]) {
  return sortProductArchiveAiFillReferenceImages(referenceImages).slice(0, 12).map((image) => ({
    id: Number(image.id),
    file_name: stringValue(image.original_file_name) || stringValue(image.file_name),
    role: productArchiveAiFillReferenceImageRole(image),
    asset_kind: stringValue(recordValue(image.raw_payload_json).asset_kind || image.asset_kind) || undefined,
    source_type: stringValue(image.source_type),
    source_ref: stringValue(image.source_ref) || undefined,
    width: numberValue(image.width) || undefined,
    height: numberValue(image.height) || undefined,
    file_size: numberValue(image.file_size) || undefined,
  }))
}

function productArchiveDraftImageDataUrl(image: JsonRecord) {
  const localPath = stringValue(image.local_path)
  if (!localPath || !fs.existsSync(localPath)) return null
  const stat = fs.statSync(localPath)
  if (!stat.isFile() || stat.size <= 0 || stat.size > AI_FILL_REFERENCE_IMAGE_MAX_BYTES) return null
  const mimeType = stringValue(image.mime_type) || "image/jpeg"
  if (!/^image\/(?:jpeg|png|webp)$/i.test(mimeType)) return null
  const data = fs.readFileSync(localPath).toString("base64")
  return `data:${mimeType};base64,${data}`
}

function buildDeepdrawAiFillMessages(prompt: string, referenceImages: JsonRecord[] = []) {
  const imageParts: JsonRecord[] = []
  for (const image of sortProductArchiveAiFillReferenceImages(referenceImages).slice(0, AI_FILL_REFERENCE_IMAGE_LIMIT)) {
    const dataUrl = productArchiveDraftImageDataUrl(image)
    if (!dataUrl) continue
    const imageName = stringValue(image.original_file_name) || stringValue(image.file_name) || `参考图${image.id}`
    const roleLabel = productArchiveAiFillReferenceImageRoleLabel(productArchiveAiFillReferenceImageRole(image))
    imageParts.push({
      type: "text",
      text: `SPU 参考图（${roleLabel}）：${imageName}。用于判断款式、版型、面料观感、颜色和细节元素；仍然只能在有明确视觉证据时填写。`,
    })
    imageParts.push({
      type: "image_url",
      image_url: { url: dataUrl },
    })
  }
  const systemMessage = { role: "system", content: "你是深绘商品建档字段专家，负责在给定枚举值里做保守选择。" }
  if (imageParts.length === 0) {
    return [
      systemMessage,
      { role: "user", content: prompt },
    ]
  }
  return [
    systemMessage,
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...imageParts,
      ],
    },
  ]
}

function skuColorIssueValues(issues: JsonRecord[], skus: JsonRecord[]) {
  const issueSkuCodes = new Set(
    issues
      .filter((issue) => stringValue(issue.issue_type) === "sku_color_not_in_template")
      .map((issue) => stringValue(issue.sku_code))
      .filter(Boolean),
  )
  if (!issueSkuCodes.size) return []
  return uniqueTextValues(
    skus
      .filter((sku) => issueSkuCodes.has(stringValue(sku.sku_code)))
      .map((sku) => sku.color_name),
  )
}

export function buildProductArchiveAiFillCandidateFields(
  fields: JsonRecord[],
  issues: JsonRecord[] = [],
  skus: JsonRecord[] = [],
): ProductArchiveAiFillCandidate[] {
  const colorIssueValues = skuColorIssueValues(issues, skus)
  return fields
    .filter((field) => !isUnsupportedAiFillField(field.field_name))
    .map((field) => {
      const valueText = stringValue(field.value_text)
      const valueJson = recordValue(field.value_json)
      const sourceType = stringValue(field.source_type)
      const aiRuleFallback = isAiRuleFallbackField(field)
      const emptyValue = !hasValue(valueText) && (!hasValue(valueJson) || aiRuleFallback)
      const validationStatus = stringValue(field.validation_status)
      const invalidValue = validationStatus === "invalid"
      const colorNeedsAiFill = compactFieldKey(field.field_name).includes("颜色") && colorIssueValues.length > 0
      const shoeEnumNeedsAiReview = isProductArchiveShoeAiEnumField(field.field_name)
        && ["shoe_size_chart", "ai", "ai_rule_fallback"].includes(sourceType)
      const strategy = productArchiveAiFieldStrategyForField(field.field_name)
      const required = Boolean(field.required)
        || Boolean(field.blocking)
        || /必填字段缺失/.test(stringValue(field.validation_message))
      const currentValue = colorNeedsAiFill
        ? colorIssueValues.join(";")
        : aiRuleFallback
          ? valueText
          : valueText || (hasValue(valueJson) ? JSON.stringify(valueJson) : "")
      return {
        id: Number(field.id),
        fieldName: stringValue(field.field_name),
        currentValue,
        validationStatus,
        validationMessage: stringValue(field.validation_message),
        required,
        sourceType,
        strategy,
        needsAiFill: emptyValue || invalidValue || colorNeedsAiFill || shoeEnumNeedsAiReview,
        options: fieldOptionsFromTemplate(field.options_json),
      }
    })
    .filter((field) => (
      Number.isInteger(field.id)
      && field.fieldName
      && field.options.length > 0
      && field.needsAiFill
      && (field.sourceType !== "skip" || Boolean(field.strategy?.includeWhenSourceSkipped))
    ))
    .sort((left, right) => {
      const priorityRank: Record<ProductArchiveAiFieldPriority, number> = { P0: 0, P1: 1, P2: 2 }
      const leftRank = left.strategy ? priorityRank[left.strategy.priority] : 3
      const rightRank = right.strategy ? priorityRank[right.strategy.priority] : 3
      return leftRank - rightRank || left.fieldName.localeCompare(right.fieldName)
    })
    .map((field) => ({
      id: field.id,
      fieldName: field.fieldName,
      currentValue: field.currentValue,
      validationStatus: field.validationStatus,
      validationMessage: field.validationMessage,
      required: field.required,
      strategy: field.strategy,
      options: field.options,
    }))
}

function trustedMaterialEvidenceText(field: JsonRecord, candidateIds: Set<number>) {
  const fieldId = Number(field.id)
  if (candidateIds.has(fieldId)) return ""
  if (isAiRuleFallbackField(field)) return ""
  const fieldName = stringValue(field.field_name)
  const key = compactFieldKey(fieldName)
  if (!/(材质|面料|成分)/.test(fieldName)) return ""
  if (!key.includes("文本") && !key.includes("成分") && !key.includes("面料") && !key.includes("材质")) return ""
  const valueText = stringValue(field.value_text)
  if (!valueText) return ""
  if (materialComponentsFromText(valueText).length > 0) return valueText
  if (semicolonTextValues(valueText).some((item) => normalizeMaterialName(item.split(/[,，]/)[0]))) return valueText
  return ""
}

function materialEvidenceTextsForAiFill(
  fields: JsonRecord[],
  candidates: ProductArchiveAiFillCandidate[],
  sourceRows: JsonRecord[] = [],
) {
  const candidateIds = new Set(candidates.map((field) => field.id))
  return uniqueTextValues([
    ...fields.map((field) => trustedMaterialEvidenceText(field, candidateIds)),
    materialCompositionSourceText(sourceRows),
  ].filter(Boolean))
}

export function buildProductArchiveMaterialEvidenceFills(
  fields: JsonRecord[],
  candidates: ProductArchiveAiFillCandidate[],
  sourceRows: JsonRecord[] = [],
) {
  const evidenceTexts = materialEvidenceTextsForAiFill(fields, candidates, sourceRows)
  if (evidenceTexts.length === 0) return []
  const fills: Array<{
    field_id: number
    field_name: string
    field_value: string
    confidence: number
    reason: string
  }> = []
  for (const field of candidates) {
    if (!/材质|面料/.test(field.fieldName)) continue
    if (compactFieldKey(field.fieldName) === "鞋垫材质") continue
    for (const evidenceText of evidenceTexts) {
      const fieldValue = normalizeProductArchiveDeepdrawFieldValue(field.fieldName, evidenceText, field.options)
      if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, field.options, field.fieldName)) continue
      fills.push({
        field_id: field.id,
        field_name: field.fieldName,
        field_value: fieldValue,
        confidence: 0.92,
        reason: "根据已识别的成分含量按深绘模板选项归一化",
      })
      break
    }
  }
  return fills
}

function fieldNeedsEvidenceRuleFill(field: JsonRecord) {
  const valueText = stringValue(field.value_text)
  const valueJson = recordValue(field.value_json)
  if (isAiRuleFallbackField(field)) return true
  if (!hasValue(valueText) && !hasValue(valueJson)) return true
  return stringValue(field.validation_status) === "invalid"
}

function packageReferenceImages(referenceImages: JsonRecord[]) {
  return referenceImages.filter((image) => {
    const payload = recordValue(image.raw_payload_json)
    return stringValue(image.source_type) === "crawshrimp_asset_package" || payload.asset_package === true
  })
}

function modelShotValueFromReferenceImages(referenceImages: JsonRecord[]) {
  const packageImages = packageReferenceImages(referenceImages)
  if (packageImages.length === 0) return ""
  const hasModelShot = packageImages.some((image) => {
    const payload = recordValue(image.raw_payload_json)
    return payload.has_model_shot === true
      || productArchiveImageHasModelShot(image.original_file_name)
      || productArchiveImageHasModelShot(image.source_ref)
      || productArchiveImageHasModelShot(image.file_name)
  })
  return hasModelShot ? "实拍有模特" : "实拍无模特"
}

function ruleContextSpu(draft: JsonRecord, spu: JsonRecord = {}) {
  return {
    ...recordValue(recordValue(draft.source_snapshot_json).spu),
    ...spu,
  }
}

function shoeInsoleMaterialEvidenceRule(input: {
  fieldName: string
  options: unknown[]
  sourceRows: JsonRecord[]
}) {
  const sourceValue = shoeInsoleMaterialText(input.sourceRows)
  const other = pickOtherOption(input.options)
  if (sourceValue) {
    const normalized = normalizeProductArchiveDeepdrawFieldValue(input.fieldName, sourceValue, input.options)
    if (normalized && productArchiveFieldValueMatchesOptions(normalized, input.options, input.fieldName)) {
      return {
        value: normalized,
        sourceType: "source_rule",
        sourceRef: "文案表/上市计划:鞋垫材质",
        reason: "根据文案表或上市计划中明确的鞋垫材质归一到深绘模板选项",
      }
    }
    if (other) {
      return {
        value: other,
        sourceType: "source_rule",
        sourceRef: "文案表/上市计划:鞋垫材质",
        reason: "来源明确提到鞋垫材质但未命中当前模板具体枚举，按模板其他选项兜底",
      }
    }
    return null
  }
  if (!other) return null
  return {
    value: other,
    sourceType: "ai_rule_fallback",
    sourceRef: "鞋垫材质兜底",
    confidence: 0.86,
    reason: "当前字段未被 OCR 证据补齐，且文案表/上市计划没有明确鞋垫材质，按模板其他选项兜底",
  }
}

function evidenceRuleValueForField(input: {
  draft: JsonRecord
  field: JsonRecord
  fields: JsonRecord[]
  spu?: JsonRecord
  sourceRows: JsonRecord[]
  referenceImages: JsonRecord[]
}) {
  const fieldName = stringValue(input.field.field_name)
  const key = compactFieldKey(fieldName)
  const currentValue = stringValue(input.field.value_text)
  const contextSpu = ruleContextSpu(input.draft, input.spu)
  const options = arrayValue(input.field.options_json)
  if (isProductArchiveAgeFieldName(fieldName)) {
    const sourceValue = applicableAgeText(contextSpu, input.sourceRows)
      || launchValue(input.sourceRows, "年龄段")
      || launchValue(input.sourceRows, "适用年龄")
      || currentValue
      || stringValue(contextSpu.age_group_name)
    const normalized = normalizeProductArchiveDeepdrawFieldValue(fieldName, sourceValue, options)
    if (normalized && productArchiveFieldValueMatchesOptions(normalized, options, fieldName)) {
      return {
        value: normalized,
        sourceType: "source_rule",
        sourceRef: "尺码段/年龄段",
        reason: "根据尺码段、上市计划年龄段或当前来源值归一到深绘模板年龄枚举",
      }
    }
  }
  if (isProductArchiveProductCategoryFieldKey(key)) {
    const value = productArchiveCategoryFieldValue({
      draft: input.draft,
      spu: contextSpu,
      sourceRows: input.sourceRows,
      fieldName,
      options,
    })
    if (value) {
      return {
        value,
        sourceType: "source_rule",
        sourceRef: "深绘类目/来源类目",
        reason: "根据深绘类目路径、上市计划或 MDM 类目信息归一产品类别",
      }
    }
  }
  if (key === "款式" || key === "款式多选" || key === "款式单选" || key === "类型" || key === "类型多选" || key === "分类") {
    const sourceValue = launchValue(input.sourceRows, "主款式 （唯品四级品类）")
      || launchValue(input.sourceRows, "主款式（唯品四级品类）")
      || launchValue(input.sourceRows, "品类")
      || currentValue
      || stringValue(contextSpu.subclass_name)
      || stringValue(contextSpu.spu_name)
    const normalized = normalizeProductArchiveDeepdrawFieldValue(fieldName, sourceValue, options)
    if (normalized && productArchiveFieldValueMatchesOptions(normalized, options, fieldName)) {
      return {
        value: normalized,
        sourceType: "source_rule",
        sourceRef: "上市计划/MDM款式",
        reason: "根据上市计划、MDM 子类或当前来源值归一到深绘模板款式枚举",
      }
    }
  }
  if (key === "鞋垫材质" && isShoeDraftContext({ draft: input.draft, spu: contextSpu, sourceRows: input.sourceRows })) {
    const rule = shoeInsoleMaterialEvidenceRule({ fieldName, options, sourceRows: input.sourceRows })
    if (rule) return rule
  }
  if (isProductArchiveDownContentFieldKey(key)) {
    const sourceValue = copywritingDownContentEvidenceValue(input.sourceRows)
    if (sourceValue) {
      return {
        value: sourceValue,
        sourceType: "source_rule",
        sourceRef: "标准文案表:面料成分",
        reason: "填充物含量、含绒量和绒子含量按标准文案的绒子含量填写；充绒克数另取洗唛尺码表",
      }
    }
    const peer = input.fields.find((field) => (
      compactFieldKey(field.field_name) !== key
      && isProductArchiveDownContentFieldKey(compactFieldKey(field.field_name))
      && Boolean(downContentPercentFromText(field.value_text) || hasExplicitNoFiller(field.value_text))
    ))
    const value = stringValue(peer?.value_text)
    if (value) {
      return {
        value,
        sourceType: "field_backup_rule",
        sourceRef: `字段互备:${stringValue(peer?.field_name)}`,
        reason: "填充物含量、含绒量和绒子含量复用同一绒子含量值；充绒克数不参与互备",
      }
    }
  }
  if (isProductArchiveFillerFieldKey(key)) {
    const peer = input.fields.find((field) => (
      compactFieldKey(field.field_name) !== key
      && isProductArchiveFillerFieldKey(compactFieldKey(field.field_name))
      && stringValue(field.value_text)
    ))
    const sourceText = materialCompositionSourceText(input.sourceRows)
    const sourceValue = hasExplicitNoFiller(sourceText) ? "无" : copywritingFillerMaterialValue(input.sourceRows)
    const value = sourceValue || stringValue(peer?.value_text)
    if (value) {
      return {
        value,
        sourceType: peer && !sourceValue ? "field_backup_rule" : "source_rule",
        sourceRef: peer && !sourceValue
          ? `字段互备:${stringValue(peer.field_name)}`
          : "标准文案表:面料成分",
        reason: "填充物字段复用标准文案中已识别的填充物材质或无填充结论",
      }
    }
  }
  if (key === "流行元素" || key === "流行元素多选") {
    const value = copywritingPopularElementValue(input.sourceRows)
    if (value) {
      return {
        value,
        sourceType: "source_rule",
        sourceRef: "标准文案表:设计文案",
        reason: "根据标准文案中的费尔岛图案或简约无装饰描述归一流行元素",
      }
    }
  }
  if (key.includes("颜色") && currentValue) {
    return {
      value: currentValue,
      sourceType: "color_template_rule",
      sourceRef: "字段当前值+SKU颜色",
      reason: "将 SKU 颜色归一到深绘模板近似颜色并保留原颜色别名",
    }
  }
  if (key === "单位" || key === "计量单位") {
    return { value: "件", sourceType: "fixed_rule", sourceRef: "单位固定=件", reason: "单位统一固定为件" }
  }
  if (key === "型号") {
    return { value: stringValue(input.draft.spu_code), sourceType: "source_rule", sourceRef: "款号", reason: "型号按款号填充" }
  }
  if (key === "模特实拍") {
    const value = modelShotValueFromReferenceImages(input.referenceImages)
    return value
      ? { value, sourceType: "image_package_rule", sourceRef: "抓虾图包文件名", reason: "根据图包文件名是否包含有模拍判断" }
      : null
  }
  if (key === "服装版型" || key === "版型") {
    const value = copywritingValue(input.sourceRows, "版型")
    return value ? { value, sourceType: "source_rule", sourceRef: "标准文案表:版型", reason: "根据标准文案表版型归一化" } : null
  }
  if (key === "厚薄" || key === "厚度" || key.endsWith("厚薄指数")) {
    const value = copywritingValue(input.sourceRows, "厚薄")
    return value ? { value, sourceType: "source_rule", sourceRef: "标准文案表:厚薄", reason: "根据标准文案表厚薄归一化" } : null
  }
  if (key === "弹力" || key === "弹性" || key.endsWith("弹力指数") || key.endsWith("弹性指数")) {
    const value = copywritingValue(input.sourceRows, "弹性")
    return value ? { value, sourceType: "source_rule", sourceRef: "标准文案表:弹性", reason: "根据标准文案表弹性归一化" } : null
  }
  if ((key === "是否可开档" || key === "是否开裆" || key === "是否可开裆") && currentValue) {
    return { value: currentValue, sourceType: "source_rule", sourceRef: "字段当前值", reason: "将是否可开档当前值归一到深绘枚举" }
  }
  return null
}

function skippedFieldAllowsProductArchiveEvidenceRule(input: {
  draft: JsonRecord
  field: JsonRecord
  spu?: JsonRecord
  sourceRows: JsonRecord[]
}) {
  const fieldName = stringValue(input.field.field_name)
  const key = compactFieldKey(fieldName)
  const strategy = productArchiveAiFieldStrategyForField(fieldName)
  if (!strategy?.includeWhenSourceSkipped) return false
  if (isProductArchiveProductCategoryFieldKey(key)) return true
  if (key !== "鞋垫材质") return false
  return isShoeDraftContext({
    draft: input.draft,
    spu: ruleContextSpu(input.draft, input.spu),
    sourceRows: input.sourceRows,
  })
}

export function buildProductArchiveEvidenceRuleFills(input: {
  draft: JsonRecord
  fields: JsonRecord[]
  spu?: JsonRecord
  sourceRows?: JsonRecord[]
  referenceImages?: JsonRecord[]
}) {
  const fills: Array<{
    field_id: number
    field_name: string
    field_value: string
    source_type: string
    source_ref: string
    confidence: number
    reason: string
  }> = []
  for (const field of input.fields) {
    if (!fieldNeedsEvidenceRuleFill(field)) continue
    const sourceRows = input.sourceRows ?? []
    if (
      stringValue(field.source_type) === "skip"
      && !skippedFieldAllowsProductArchiveEvidenceRule({
        draft: input.draft,
        field,
        spu: input.spu,
        sourceRows,
      })
    ) continue
    const fieldId = Number(field.id)
    const fieldName = stringValue(field.field_name)
    if (!Number.isInteger(fieldId) || fieldId <= 0 || !fieldName) continue
    const rule = evidenceRuleValueForField({
      draft: input.draft,
      field,
      fields: input.fields,
      spu: input.spu,
      sourceRows,
      referenceImages: input.referenceImages ?? [],
    })
    if (!rule?.value) continue
    const options = fieldOptionsFromTemplate(field.options_json)
    const fieldValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, rule.value, options)
    if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, options, fieldName)) continue
    fills.push({
      field_id: fieldId,
      field_name: fieldName,
      field_value: fieldValue,
      source_type: rule.sourceType,
      source_ref: rule.sourceRef,
      confidence: rule.confidence ?? 0.96,
      reason: rule.reason,
    })
  }
  return fills
}

function buildDeepdrawAiFillPrompt(input: {
  draft: JsonRecord
  fields: ProductArchiveAiFillCandidate[]
  skus: JsonRecord[]
  allFields?: JsonRecord[]
  sourceRows?: JsonRecord[]
  mdmSpu?: JsonRecord
  referenceImages?: JsonRecord[]
}) {
  return JSON.stringify({
    task: "为深绘商品建档草稿中需要人工判断的枚举字段选择最合适的字段值",
    output_schema: {
      fills: [
        {
          field_id: "必须等于输入 fields[].field_id",
          field_name: "字段名",
          field_value: "必须从该字段 options[].value 中选择一个原文值",
          confidence: "0 到 1",
          reason: "一句短理由",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "不能编造选项，只能从对应字段 options[].value 中选择。",
      "只有在 MDM 主数据、来源表、SKU、商品标题或已填草稿字段中有明确证据时才填写。",
      "可结合 SPU 参考图判断款式、版型、面料观感、颜色和细节元素；图片证据不明确时不要填写。",
      "证据不足、仅凭字段名无法判断、或只能猜测时，直接省略该字段，不要返回该字段。",
      "不要因为 options 的顺序选择第一个选项；不要选择看起来冷门但无证据的材质、版型、元素或工艺。",
      "忽略 source_type 为 ai_rule_fallback 的历史值，它们不是可信证据。",
      "是否类字段没有明确证据时也不要填写。",
      "required 为 true 的字段是当前阻断项。若 P0 必填字段有清晰参考图和上下文证据，优先返回；证据不清时仍然省略，不能为了补必填而猜测。",
      "field_strategy.priority 为 P0 的字段优先处理；P1 字段必须优先使用主数据、尺码段、成分或文案证据；P2 字段只在图片/上下文足够明确时补充。",
      "每个字段的 field_strategy.guardrail 是硬约束；违反该边界时省略字段。",
      `confidence 低于 ${AI_FILL_MIN_CONFIDENCE} 的字段不要返回。`,
      "颜色字段如果 current_value 有多个用分号分隔的原颜色名，field_value 返回同数量标准色，按顺序用分号分隔；每个标准色都必须来自 options[].value，系统会自动保留原颜色别名。",
      ...(input.fields.some((field) => compactFieldKey(field.fieldName) === compactFieldKey("图案"))
        ? [isShoeDraftContext({ draft: input.draft, spu: input.mdmSpu, sourceRows: input.sourceRows })
          ? "鞋品图案字段在参考图清晰时必须选择最接近的现有枚举：有明显条带结构选条纹，没有印花或图形且整体无图案选纯色；只有图片确实无法辨认时才省略。"
          : "服饰图案字段必须依据参考图：主体与袖片、帽片、口袋等存在清晰不同材质或色块拼接时，优先匹配拼色或色块，不能因为主色占比高就选纯色；只有图片确实无法辨认时才省略。"]
        : []),
      ...(input.fields.some((field) => isProductArchiveShoeAiEnumField(field.fieldName))
        ? [shoeEnumClassificationPrompt()]
        : []),
      ...(input.fields.some((field) => compactFieldKey(field.fieldName) === compactFieldKey("25鞋子尺码表"))
        ? [shoeSandalVisualClassificationPrompt(), "凉鞋结构必须优先依据参考图；识别结果只能映射为 25鞋子尺码表 的现有枚举值。"]
        : []),
    ],
    product: {
      spu_code: input.draft.spu_code,
      title: input.draft.title,
      trade_path: input.draft.trade_path,
      retail_price: input.draft.retail_price,
      mdm_master: buildMdmMasterAiContext(input.draft, input.mdmSpu),
      skus: input.skus.map((sku) => ({
        sku_code: sku.sku_code,
        skc_code: sku.skc_code,
        color_name: sku.color_name,
        size_name: sku.size_name,
      })),
      reference_images: buildReferenceImageAiContext(input.referenceImages ?? []),
    },
    evidence: {
      source_rows: buildSourceRowsAiContext(input.sourceRows ?? []),
      filled_fields: buildFilledFieldAiContext(input.allFields ?? [], input.fields),
    },
    fields: input.fields.map((field) => ({
      field_id: field.id,
      field_name: field.fieldName,
      current_value: field.currentValue,
      validation_status: field.validationStatus,
      validation_message: field.validationMessage,
      required: field.required,
      field_strategy: field.strategy,
      options: compactFieldKey(field.fieldName).includes("颜色") ? field.options : field.options.slice(0, 120),
    })),
  }, null, 2)
}

async function callDeepdrawAiFill(
  db: SyncPostgresDatabase,
  prompt: string,
  fields: ProductArchiveAiFillCandidate[],
  referenceImages: JsonRecord[] = [],
  options: AiFillOptions = {},
) {
  const allowedFields = new Map(fields.map((field) => [field.id, field]))
  const messages = buildDeepdrawAiFillMessages(prompt, referenceImages)
  const router = options.router ?? getDefaultAiScenarioRouter({
    db,
    fetchImpl: options.fetchImpl ?? fetch,
  })
  const response = await router.callJson(withAiRoutingHashes({
    scenario: "deepdraw_field_fill",
    promptVersion: "deepdraw-field-fill-v1",
    messages,
    validate: (json: { fills?: unknown }) => (
      Array.isArray(json?.fills)
      && json.fills.some((fill) => {
        if (!fill || typeof fill !== "object") return false
        const row = fill as JsonRecord
        const field = allowedFields.get(Number(row.field_id))
        if (!field) return false
        const normalized = normalizeProductArchiveAiFillValue(
          field.fieldName,
          field.currentValue,
          row.field_value,
          field.options,
        )
        return Boolean(
          normalized
          && productArchiveFieldValueMatchesOptions(normalized, field.options, field.fieldName),
        )
      })
    ),
    auditValue: (json: { fills?: unknown }) => ({
      fills: Array.isArray(json?.fills)
        ? json.fills.map((fill) => {
          const row = fill && typeof fill === "object"
            ? fill as JsonRecord
            : {}
          return {
            field_id: Number(row.field_id),
            field_value: stringValue(row.field_value),
            confidence: Number(row.confidence),
          }
        })
        : [],
    }),
  }, {
    input: JSON.parse(prompt),
    candidates: fields.map((field) => ({
      field_id: field.id,
      field_name: field.fieldName,
      options: field.options,
    })),
  }))
  return Array.isArray(response.json.fills)
    ? response.json.fills as JsonRecord[]
    : []
}

function draftById(db: SyncPostgresDatabase, draftId: number) {
  const draft = db.prepare("select * from product_archive_draft where id = ?").get(draftId) as JsonRecord | undefined
  if (!draft) throw new Error(`建档草稿不存在：${draftId}`)
  return draft
}

export function assertProductArchiveDraftMutable(
  db: SyncPostgresDatabase,
  draftId: number,
  options: { claimToken?: string | null } = {},
) {
  const draft = db.prepare(`
    select id, status, submit_claim_token, updated_at
    from product_archive_draft
    where id = ?
    for update
  `).get(draftId) as JsonRecord | undefined
  if (!draft) throw new Error(`建档草稿不存在：${draftId}`)
  if (options.claimToken != null) {
    if (stringValue(draft.submit_claim_token) !== stringValue(options.claimToken)) {
      throw new Error("PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS: 草稿提交权已失效，不能继续修改")
    }
  } else if (draft.submit_claim_token) {
    throw new Error("PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS: 草稿正在提交，不能继续修改")
  }
  return draft
}

function fieldOptionsLookup(db: SyncPostgresDatabase, draft: JsonRecord) {
  const rows = db.prepare(`
    select field_name, field_id, field_type, options_json, required, sale_prop, raw_payload_json
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_id
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id) as JsonRecord[]
  const lookup = new Map<string, { options: unknown[]; required: boolean; rawPayload: JsonRecord; fieldType: string }>()
  for (const row of rows) {
    const fieldName = stringValue(row.field_name)
    if (!fieldName || lookup.has(fieldName)) continue
    lookup.set(fieldName, {
      options: arrayValue(row.options_json),
      required: Boolean(row.required),
      rawPayload: recordValue(row.raw_payload_json),
      fieldType: stringValue(row.field_type),
    })
  }
  return lookup
}

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

function deepdrawPlatformDisplayNames(value: unknown) {
  const text = stringValue(value)
  if (!text) return []
  const parts = text.split(/[,，;；、\s]+/).map((part) => part.trim()).filter(Boolean)
  const values = parts.length ? parts : [text]
  return uniqueTextValues(values.map((part) => {
    const key = part.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    return DEEPDRAW_PLATFORM_LABELS[key] ?? part
  }))
}

function deepdrawPlatformDisplayName(value: unknown) {
  const labels = deepdrawPlatformDisplayNames(value)
  if (labels.length <= 1) return labels[0] ?? ""
  return "多平台"
}

function deepdrawTradePlatformsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  const tradeId = stringValue(draft.trade_id)
  if (!tradeId) return []
  try {
    const rows = db.prepare(`
      select distinct nullif(trim(raw_payload_json #>> '{attributes,thirdPlatform}'), '') as platform
      from deepdraw_trade_field_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
        and nullif(trim(raw_payload_json #>> '{attributes,thirdPlatform}'), '') is not null
      order by platform
    `).all(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord[]
    return uniqueTextValues(rows.flatMap((row) => deepdrawPlatformDisplayNames(row.platform)))
  } catch (error) {
    if (/deepdraw_trade_field_cache|unexpected sql|does not exist|no such table/i.test(error instanceof Error ? error.message : String(error))) {
      return []
    }
    throw error
  }
}

function primaryTemplateFieldsByName(tradeFields: JsonRecord[]) {
  const ordered = [...tradeFields].sort((left, right) => {
    const requiredDelta = Number(Boolean(right.required)) - Number(Boolean(left.required))
    if (requiredDelta) return requiredDelta
    const saleDelta = Number(Boolean(right.sale_prop)) - Number(Boolean(left.sale_prop))
    if (saleDelta) return saleDelta
    return stringValue(left.field_id).localeCompare(stringValue(right.field_id))
  })
  const lookup = new Map<string, JsonRecord>()
  for (const field of ordered) {
    const fieldName = stringValue(field.field_name)
    if (fieldName && !lookup.has(fieldName)) lookup.set(fieldName, field)
  }
  return lookup
}

const DEEPDRAW_TEMPLATE_FIELD_FALLBACK_THRESHOLD = 30

function tradeFieldTemplateFromExtractedRow(row: JsonRecord, draft: JsonRecord, tradeId: string) {
  const fieldId = stringValue(row.fieldId ?? row.field_id)
  const fieldName = stringValue(row.fieldName ?? row.field_name)
  if (!fieldName) return null
  return {
    tenant_name: draft.tenant_name,
    merchant_id: draft.merchant_id,
    trade_id: tradeId,
    field_id: fieldId || fieldName,
    field_name: fieldName,
    field_type: stringValue(row.fieldType ?? row.field_type) || null,
    required: Boolean(row.required),
    sale_prop: Boolean(row.saleProp ?? row.sale_prop),
    options_json: arrayValue(row.options),
    raw_payload_json: recordValue(row.raw),
  }
}

function fallbackTradeFieldsFromRawPayload(db: SyncPostgresDatabase, draft: JsonRecord, tradeId: string) {
  try {
    const trade = db.prepare(`
      select raw_payload_json
      from deepdraw_trade_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
      limit 1
    `).get(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord | undefined
    return extractDeepdrawTradeFieldRows(trade?.raw_payload_json)
      .map((row) => tradeFieldTemplateFromExtractedRow(row, draft, tradeId))
      .filter((row): row is JsonRecord => Boolean(row))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/deepdraw_trade_cache|unexpected sql|does not exist|no such table/i.test(message)) return []
    throw error
  }
}

function mergeDeepdrawTemplateFields(rows: JsonRecord[], fallbackRows: JsonRecord[]) {
  const seenFieldIds = new Set(rows.map((row) => stringValue(row.field_id)).filter(Boolean))
  const seenFieldNames = new Set(rows.map((row) => stringValue(row.field_name)).filter(Boolean))
  const merged = [...rows]
  for (const row of fallbackRows) {
    const fieldId = stringValue(row.field_id)
    const fieldName = stringValue(row.field_name)
    if (!fieldName) continue
    if (fieldId && seenFieldIds.has(fieldId)) continue
    if (seenFieldNames.has(fieldName)) continue
    merged.push(row)
    if (fieldId) seenFieldIds.add(fieldId)
    seenFieldNames.add(fieldName)
  }
  return merged
}

function childFieldRequirement(input: { rawPayload?: unknown }) {
  const attributes = recordValue(recordValue(input.rawPayload).attributes)
  const isChildAttr = attributes.isChildAttr === true || stringValue(attributes.isChildAttr).toLowerCase() === "true"
  const parentValue = stringValue(attributes.parentAttrValue)
  const parentAttrs = uniqueTextValues(arrayValue(attributes.parentAttr).flatMap((value) => stringValue(value).split(/[;；,，]/)))
  if (!isChildAttr || !parentValue || parentAttrs.length === 0) return null
  return { parentAttrs, parentValue }
}

export function templateChildRequirementActive(template: JsonRecord, fields: JsonRecord[]) {
  const requirement = childFieldRequirement({ rawPayload: template.raw_payload_json ?? template.rawPayload })
  if (!requirement) return true
  for (const parentName of requirement.parentAttrs) {
    const parent = fields.find((field) => stringValue(field.field_name ?? field.fieldName) === parentName)
    const value = stringValue(parent?.value_text ?? parent?.valueText)
    if (value === requirement.parentValue) return true
  }
  return false
}

function tradeFieldsForDraft(db: SyncPostgresDatabase, draft: JsonRecord, tradeId = stringValue(draft.trade_id)) {
  if (!tradeId) return []
  const rows = db.prepare(`
    select *
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_name
  `).all(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord[]
  if (rows.length >= DEEPDRAW_TEMPLATE_FIELD_FALLBACK_THRESHOLD) return rows
  return mergeDeepdrawTemplateFields(rows, fallbackTradeFieldsFromRawPayload(db, draft, tradeId))
}

function productLineDomainTarget(value: unknown) {
  const domain = stringValue(value).replace(/\s+/g, "")
  if (!domain) return ""
  const productLine = domain.match(/^产品线[:：]?(.+)$/)?.[1] ?? ""
  const target = productLine || (/鞋品/.test(domain) ? "鞋品" : /中童/.test(domain) ? "中童" : "")
  return target.replace(/字段$/g, "")
}

export function fieldMappingDomainApplies(rule: JsonRecord, spu: JsonRecord = {}) {
  const domain = stringValue(rule.field_domain_type ?? rule.fieldDomainType)
  if (!domain || /通用/.test(domain)) return true
  const target = productLineDomainTarget(domain)
  if (!target) return true
  const mdmText = [
    spu.product_line_name,
    spu.product_type_name,
    spu.middle_class_name,
    spu.subclass_name,
    spu.age_group_name,
    spu.spu_name,
  ].map(stringValue).filter(Boolean).join(" ")
  if (!mdmText) return false
  if (/鞋/.test(target)) return /鞋/.test(mdmText)
  if (/中童/.test(target)) return /中童/.test(mdmText)
  return mdmText.includes(target)
}

export function resolveProductArchiveDraftSpu(db: SyncPostgresDatabase, draft: JsonRecord) {
  const liveSpu = db.prepare("select * from product_spu where spu_code = ?").get(draft.spu_code) as JsonRecord | undefined
  if (liveSpu) return liveSpu
  const snapshotSpu = recordValue(recordValue(draft.source_snapshot_json).spu)
  if (Object.keys(snapshotSpu).length > 0) return snapshotSpu
  throw new Error(`MDM 款号不存在：${draft.spu_code}`)
}

export function fieldMappingRulesForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  try {
    const spu = resolveProductArchiveDraftSpu(db, draft)
    const tenantRules = db.prepare(`
      select
        id,
        field_domain_type,
        deepdraw_field,
        field_source,
        mapped_field,
        source_type,
        source_table,
        source_field,
        default_value,
        blocking,
        notes
      from deepdraw_field_mapping_rule
      where tenant_name = ?
        and merchant_id = ?
        and enabled = true
      order by id
    `).all(draft.tenant_name, draft.merchant_id) as JsonRecord[]
    if (tenantRules.length > 0) return tenantRules.filter((rule) => fieldMappingDomainApplies(rule, spu ?? {}))
  } catch (error) {
    if (!/deepdraw_field_mapping_rule/i.test(error instanceof Error ? error.message : String(error))) {
      throw error
    }
  }
  return db.prepare(`
    select *
    from product_archive_field_rule
    order by id
  `).all() as JsonRecord[]
}

function fieldInsertData(db: SyncPostgresDatabase, draft: JsonRecord, tradeFields: JsonRecord[], existingFields: JsonRecord[] = []) {
  const spu = resolveProductArchiveDraftSpu(db, draft)
  const rules = fieldMappingRulesForDraft(db, draft)
  const sourceRows = sourceRowsForDraft(db, draft)
  const shoeProduct = isShoeProduct(spu, sourceRows)
  const apparelProduct = isApparelProduct(spu, sourceRows)
  const sizeChartMappings = sizeChartMappingsForDraft(db, draft)
  const mdmSkus = mdmSkuRowsForSpu(db, stringValue(draft.spu_code))
  const sizeChartAllowedSizes = productArchiveSizeChartAllowedSizes(sourceRows, mdmSkus)
  const dateText = launchDateValue(sourceRows)
  const fieldNames = new Set<string>()
  for (const field of tradeFields) fieldNames.add(stringValue(field.field_name))
  for (const rule of rules) fieldNames.add(stringValue(rule.deepdraw_field))

  const fieldTemplateByName = primaryTemplateFieldsByName(tradeFields)
  const ruleByName = new Map(rules.map((rule) => [stringValue(rule.deepdraw_field), rule]))
  const existingByName = new Map(existingFields.map((field) => [stringValue(field.field_name), field]))
  const persistedSandalClassification = stringValue(existingByName.get("25鞋子尺码表")?.value_text)
    || stringValue(recordValue(draft.source_snapshot_json).shoeSandalClassification)
  const shoeMatch = resolveShoeSizeChartMatch({
    tradeId: draft.trade_id,
    tradePath: draft.trade_path,
    productLineName: spu.product_line_name,
    subclassName: spu.subclass_name,
    sandalClassification: persistedSandalClassification,
  })
  const shoeRows = shoeProduct && shoeMatch.status === "matched"
    ? loadShoeSizeChartRows(db, shoeMatch.chartCode)
    : []
  const shoeFieldValues = shoeProduct
    ? buildShoeSizeChartFieldValues({
        rows: shoeRows,
        skuSizes: mdmSkus.flatMap((sku) => [sku.size_name, sku.size_code]),
        fieldTemplates: tradeFields.map((field) => ({
          fieldName: stringValue(field.field_name),
          fieldType: stringValue(field.field_type),
          options: arrayValue(field.options_json),
        })),
        match: shoeMatch,
      })
    : {}

  const rows = Array.from(fieldNames).filter(Boolean).map((fieldName) => {
    const rule = ruleByName.get(fieldName) ?? {}
    const template = fieldTemplateByName.get(fieldName) ?? {}
    const templateOptions = arrayValue(template.options_json)
    const existing = existingByName.get(fieldName) ?? {}
    const templatePlatform = template.third_platform
      ?? recordValue(recordValue(template.raw_payload_json).attributes).thirdPlatform
    const businessBlank = isProductArchiveBusinessBlankField(fieldName, spu, sourceRows, templatePlatform)
    const originCountryField = isProductArchiveOriginCountryField(fieldName)
    const shoe1688OriginField = shoeProduct && compactFieldKey(fieldName) === "产地"
    const skuSizeField = isProductArchiveSkuSizeFieldName(fieldName)
    const sizeSegmentField = isProductArchiveSizeSegmentFieldName(fieldName)
    const colorField = compactFieldKey(fieldName).includes("颜色")
    const categoryPlatformListPriceField = (shoeProduct || apparelProduct)
      && PRODUCT_ARCHIVE_PLATFORM_LIST_PRICE_KEYS.has(compactFieldKey(fieldName))
    const ruleSourceType = categoryPlatformListPriceField
      ? "fixed"
      : stringValue(rule.source_type) || (originCountryField || shoe1688OriginField ? "fixed" : "manual")
    const sourceValueText = readSourceValue(spu, rule, sourceRows, fieldName)
    const apparelLiningSource = apparelProduct
      && Boolean(sourceValueText)
      && ["里料", "里料成分", "里料材质", "内里材质"].includes(compactFieldKey(fieldName))
    const shoeDerivedCandidate = shoeFieldValues[fieldName]
    const existingManual = !businessBlank && Boolean(existing.manual_override)
      && !isStaleUnsupportedAiFillField(fieldName, existing)
      && !isStaleMaterialAiRuleFallbackField(fieldName, existing)
      && !isStaleSizeChartScalarOverride(fieldName, existing)
      && !isStaleSourceDerivedAgeAiFillField(fieldName, existing, sourceValueText, templateOptions)
      && !isStaleSourceDerivedShoeAgeManualField(fieldName, existing, sourceValueText, stringValue(shoeDerivedCandidate?.valueText), templateOptions)
      && !isStaleNonSandalAi25ShoeSizeTable({
        fieldName,
        sourceType: existing.source_type,
        tradeId: draft.trade_id,
        tradePath: draft.trade_path,
    })
    const shoeDerived = !existingManual ? shoeDerivedCandidate : undefined
    const hasShoeDerivedValue = Boolean(shoeDerived)
    const sizeChartDerived = !existingManual && !hasShoeDerivedValue && isProductArchiveStructuredSizeFieldName(fieldName) && isStructuredProductPayloadField({
      field_name: fieldName,
      field_type: template.field_type,
    })
      ? buildProductArchiveSizeChartFieldValue({
          fieldName,
          spuCode: stringValue(draft.spu_code),
          sourceRows,
          templateOptions: sizeChartTemplateOptionsForField(template.options_json, existing.value_json, fieldName),
          mappings: sizeChartMappings.filter((mapping) => stringValue(mapping.field_name ?? mapping.fieldName) === fieldName),
          allowedSizes: sizeChartAllowedSizes,
          spu,
        })
      : { valueText: "", valueJson: {}, sourceType: "" }
    const hasSizeChartValue = hasValue(recordValue(sizeChartDerived.valueJson))
    const colorMdmValue = colorField
      ? buildProductArchiveMdmDerivedFieldValue(fieldName, {
          spu,
          skus: mdmSkus,
          dateText,
          sourceRows,
          templateOptions,
        }).valueText
      : ""
    const mdmDerived = existingManual
      ? { valueText: "", valueJson: {} }
      : hasShoeDerivedValue
        ? shoeDerived
        : hasSizeChartValue
        ? { valueText: sizeChartDerived.valueText, valueJson: sizeChartDerived.valueJson }
        : buildProductArchiveMdmDerivedFieldValue(fieldName, {
            spu,
            skus: mdmSkus,
            dateText,
            sourceRows,
            templateOptions,
          })
    const rawValueText = businessBlank
      ? ""
      : existingManual
      ? colorMdmValue
        ? mergeProductArchiveColorFieldValues([existing.value_text, colorMdmValue])
        : stringValue(existing.value_text)
      : hasShoeDerivedValue
        ? stringValue(shoeDerived?.valueText)
      : hasSizeChartValue
        ? stringValue(sizeChartDerived.valueText)
      : skuSizeField
        ? mdmDerived.valueText || sourceValueText
      : colorField
        ? mdmDerived.valueText || sourceValueText
        : sourceValueText || mdmDerived.valueText
    const valueText = normalizeProductArchiveTemplateFieldValue(fieldName, rawValueText, templateOptions, {
      preserveInvalid: existingManual,
    })
    const valueJson = businessBlank ? {} : existingManual ? recordValue(existing.value_json) : mdmDerived.valueJson
    const fieldSourceType = existingManual
      ? (stringValue(existing.source_type) || "manual")
      : hasShoeDerivedValue
        ? "shoe_size_chart"
        : hasSizeChartValue
        ? "size_chart"
        : (skuSizeField || sizeSegmentField) && mdmDerived.valueText
          ? "mdm"
          : apparelLiningSource
            ? "source_rule"
            : ruleSourceType
    const required = isProductArchiveFieldLocallyRequired(fieldName, {
      templateRequired: template.required,
      templatePresent: hasValue(template.field_name) || hasValue(template.field_id),
      ruleBlocking: rule.blocking,
      sourceType: fieldSourceType,
      shoeProduct,
      apparelProduct,
    })
    const blocking = required
    const missing = blocking && !hasValue(valueText) && !hasValue(valueJson)
    const ruleSourceRef = stringValue(rule.mapped_field || rule.source_field || rule.field_source || rule.source_table) || null
    return {
      fieldName,
      fieldId: stringValue(template.field_id) || null,
      sourceType: fieldSourceType,
      sourceRef: hasSizeChartValue
        ? "PLM尺码表"
        : hasShoeDerivedValue
          ? `${shoeMatch.chartCode}:2025-2026`
          : ruleSourceRef || (shoe1688OriginField ? shoe1688OriginValue() : originCountryField ? "中国" : null),
      valueText: valueText || null,
      valueJson,
      required,
      blocking,
      manualOverride: existingManual,
      validationStatus: fieldSourceType === "skip" && !required ? "skipped" : missing ? "missing" : "valid",
      validationMessage: missing ? "必填字段缺失" : null,
    }
  })
  return rows.map((row) => {
    const template = fieldTemplateByName.get(row.fieldName) ?? {}
    if (templateChildRequirementActive(template, rows)) return row
    return {
      ...row,
      sourceType: "skip",
      sourceRef: null,
      valueText: null,
      valueJson: {},
      required: false,
      blocking: false,
      manualOverride: false,
      validationStatus: "skipped",
      validationMessage: null,
    }
  })
}

function rebuildProductArchiveDraftFields(
  db: SyncPostgresDatabase,
  draftId: number,
  tradeFields: JsonRecord[] = tradeFieldsForDraft(db, draftById(db, draftId)),
) {
  const draft = draftById(db, draftId)
  const now = nowIso()
  const existingFields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const insertRows = fieldInsertData(db, draft, tradeFields, existingFields)
  const insertField = db.prepare(`
    insert into product_archive_draft_field (
      draft_id,
      field_name,
      field_id,
      source_type,
      source_ref,
      value_text,
      value_json,
      required,
      blocking,
      manual_override,
      validation_status,
      validation_message,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?::timestamptz)
  `)
  db.transaction(() => {
    db.prepare("delete from product_archive_draft_field where draft_id = ?").run(draftId)
    for (const row of insertRows) {
      insertField.run(
        draftId,
        row.fieldName,
        row.fieldId,
        row.sourceType,
        row.sourceRef,
        row.valueText,
        jsonText(row.valueJson),
        row.required,
        row.blocking,
        row.manualOverride,
        row.validationStatus,
        row.validationMessage,
        now,
      )
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()
}

export function extractProductArchiveImageSpuCode(value: unknown) {
  const text = stringValue(value).replace(/\\/g, "/")
  const exact = Array.from(text.matchAll(/(?:^|[^0-9])([0-9]{12})(?=[^0-9]|$)/g)).map((match) => match[1])
  if (exact.length > 0) return exact.at(-1) ?? ""
  const fallback = Array.from(text.matchAll(/(?:^|[^0-9])([0-9]{9,15})(?=[^0-9]|$)/g)).map((match) => match[1])
  return fallback.at(-1) ?? ""
}

function draftImagePreviewUrl(imageId: unknown, options: { thumbnail?: boolean; preview?: boolean } = {}) {
  const id = Number(imageId)
  if (!Number.isInteger(id) || id <= 0) return null
  const variant = options.thumbnail ? "?variant=thumbnail" : options.preview ? "?variant=preview" : ""
  return `/api/product-archive-drafts/images/${id}/file${variant}`
}

function serializeProductArchiveDraftImage(image: JsonRecord) {
  const isPdf = isProductArchiveDraftPdfAsset(image)
  return {
    ...image,
    kind: productArchiveDraftListImageKind(image),
    label: stringValue(image.original_file_name)
      || stringValue(image.source_ref)
      || stringValue(image.file_name)
      || `图片 ${image.id}`,
    preview_url: isPdf ? draftImagePreviewUrl(image.id) : draftImagePreviewUrl(image.id, { preview: true }),
    full_url: draftImagePreviewUrl(image.id),
    thumbnail_url: isPdf ? null : draftImagePreviewUrl(image.id, { thumbnail: true }),
  }
}

type ProductArchiveDraftListImageKind = "reference" | "hangtag" | "washlabel"
type ProductArchiveDraftListImagePreview = ReturnType<typeof serializeProductArchiveDraftListImagePreview>
type ProductArchiveDraftListImagePreviewGroups = Record<ProductArchiveDraftListImageKind, ProductArchiveDraftListImagePreview[]>
type ProductArchiveDraftListImageCounts = Record<ProductArchiveDraftListImageKind, number>

function emptyProductArchiveDraftListImageGroups(): ProductArchiveDraftListImagePreviewGroups {
  return { reference: [], hangtag: [], washlabel: [] }
}

function emptyProductArchiveDraftListImageCounts(): ProductArchiveDraftListImageCounts {
  return { reference: 0, hangtag: 0, washlabel: 0 }
}

function isProductArchiveDraftPdfAsset(image: JsonRecord) {
  const mimeType = stringValue(image.mime_type).toLowerCase()
  return mimeType === "application/pdf"
    || uploadExtension(image.file_name) === ".pdf"
    || uploadExtension(image.original_file_name) === ".pdf"
    || uploadExtension(image.source_ref) === ".pdf"
}

function productArchiveDraftListImageKind(image: JsonRecord): ProductArchiveDraftListImageKind {
  const payload = recordValue(image.raw_payload_json)
  const payloadKind = stringValue(payload.asset_kind).toLowerCase()
  if (payloadKind === "hangtag" || payloadKind === "washlabel") return payloadKind

  const candidates = [
    image.original_file_name,
    image.source_ref,
    image.file_name,
    payload.original_file_name,
    payload.source_ref,
  ]
  for (const candidate of candidates) {
    const kind = classifyProductArchiveAssetPackageFileName(candidate)
    if (kind === "hangtag" || kind === "washlabel") return kind
  }
  return "reference"
}

function serializeProductArchiveDraftListImagePreview(image: JsonRecord) {
  const label = stringValue(image.original_file_name)
    || stringValue(image.source_ref)
    || stringValue(image.file_name)
    || `图片 ${image.id}`
  const isPdf = isProductArchiveDraftPdfAsset(image)
  const payload = recordValue(image.raw_payload_json)
  return {
    id: image.id,
    draft_id: image.draft_id,
    kind: productArchiveDraftListImageKind(image),
    asset_kind: stringValue(payload.asset_kind) || null,
    label,
    file_name: image.file_name,
    original_file_name: image.original_file_name,
    mime_type: image.mime_type,
    width: image.width,
    height: image.height,
    preview_url: isPdf ? draftImagePreviewUrl(image.id) : draftImagePreviewUrl(image.id, { preview: true }),
    full_url: draftImagePreviewUrl(image.id),
    thumbnail_url: isPdf ? null : draftImagePreviewUrl(image.id, { thumbnail: true }),
  }
}

function listProductArchiveDraftImagePreviews(db: SyncPostgresDatabase, draftIds: number[]) {
  const ids = Array.from(new Set(draftIds.filter((id) => Number.isInteger(id) && id > 0)))
  const previewMap = new Map<number, {
    groups: ProductArchiveDraftListImagePreviewGroups
    counts: ProductArchiveDraftListImageCounts
  }>()
  for (const id of ids) {
    previewMap.set(id, {
      groups: emptyProductArchiveDraftListImageGroups(),
      counts: emptyProductArchiveDraftListImageCounts(),
    })
  }
  if (ids.length === 0) return previewMap

  const rows = db.prepare(`
    select id, draft_id, source_type, source_ref, file_name, original_file_name, mime_type, width, height, raw_payload_json, sort_no
    from product_archive_draft_image
    where draft_id in (${ids.map(() => "?").join(",")})
    order by draft_id,
      case
        when raw_payload_json #>> '{asset_kind}' = 'flat_image' then 0
        when raw_payload_json #>> '{asset_kind}' = 'model_image' then 1
        else 2
      end,
      sort_no,
      id
  `).all(...ids) as JsonRecord[]
  for (const row of rows) {
    const draftId = Number(row.draft_id)
    const state = previewMap.get(draftId)
    if (!state) continue
    const preview = serializeProductArchiveDraftListImagePreview(row)
    state.counts[preview.kind] += 1
    if (state.groups[preview.kind].length >= 4) continue
    state.groups[preview.kind].push(preview)
  }
  return previewMap
}

export function latestProductArchiveDraftForSpuCode(db: SyncPostgresDatabase, spuCode: string) {
  return db.prepare(`
    select id, spu_code, title, status, tenant_name, merchant_id, trade_path, updated_at
    from product_archive_draft
    where spu_code = ?
    order by updated_at desc, id desc
    limit 1
  `).get(spuCode) as JsonRecord | undefined
}

export function listProductArchiveDraftImages(db: SyncPostgresDatabase, draftId: number) {
  return (db.prepare(`
    select *
    from product_archive_draft_image
    where draft_id = ?
    order by sort_no, id
  `).all(draftId) as JsonRecord[]).map(serializeProductArchiveDraftImage)
}

export function getProductArchiveDraftImageFile(db: SyncPostgresDatabase, imageId: number) {
  return db.prepare(`
    select *
    from product_archive_draft_image
    where id = ?
  `).get(imageId) as JsonRecord | undefined
}

export function createProductArchiveDraftImage(db: SyncPostgresDatabase, input: ProductArchiveDraftImageInput) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, input.draftId)
    const draft = draftById(db, input.draftId)
    const now = nowIso()
    const sortRow = db.prepare(`
      select coalesce(max(sort_no), 0) + 1 as next_sort
      from product_archive_draft_image
      where draft_id = ?
    `).get(input.draftId) as { next_sort?: unknown } | undefined
    const result = db.prepare(`
      insert into product_archive_draft_image (
        draft_id,
        spu_code,
        source_type,
        source_ref,
        local_path,
        file_name,
        original_file_name,
        mime_type,
        file_size,
        width,
        height,
        sort_no,
        uploaded_by,
        raw_payload_json,
        created_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz, ?::timestamptz)
    `).run(
      input.draftId,
      stringValue(input.spuCode) || stringValue(draft.spu_code),
      input.sourceType,
      input.sourceRef || null,
      input.localPath,
      input.fileName,
      input.originalFileName || null,
      input.mimeType || null,
      input.fileSize ?? null,
      input.width ?? null,
      input.height ?? null,
      Number(sortRow?.next_sort ?? 1),
      input.uploadedBy ?? null,
      jsonText(input.rawPayload ?? {}),
      now,
      now,
    )
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, input.draftId)
    const image = getProductArchiveDraftImageFile(db, Number(result.lastInsertRowid))
    return image ? serializeProductArchiveDraftImage(image) : null
  })()
}

export function deleteProductArchiveDraftImage(db: SyncPostgresDatabase, draftId: number, imageId: number) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    const image = db.prepare(`
      select *
      from product_archive_draft_image
      where id = ?
        and draft_id = ?
    `).get(imageId, draftId) as JsonRecord | undefined
    if (!image) return null
    db.prepare("delete from product_archive_draft_image where id = ? and draft_id = ?").run(imageId, draftId)
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(nowIso(), draftId)
    return image
  })()
}

export function deleteProductArchiveDraft(db: SyncPostgresDatabase, draftId: number) {
  return db.transaction(() => {
    const current = db.prepare(`
      select id, status, submit_claim_token
      from product_archive_draft
      where id = ?
      for update
    `).get(draftId) as JsonRecord | undefined
    if (!current) return null
    if (current.submit_claim_token) throw new Error("正在提交的草稿不能删除")
    const images = db.prepare(`
      select id, local_path, file_name, original_file_name
      from product_archive_draft_image
      where draft_id = ?
    `).all(draftId) as JsonRecord[]
    const deleted = db.prepare(`
      delete from product_archive_draft
      where id = ?
        and submit_claim_token is null
      returning *
    `).get(draftId) as JsonRecord | undefined
    if (!deleted) return null
    return { draft: deleted, images }
  })()
}

function serializeDraftDetail(db: SyncPostgresDatabase, draftId: number) {
  const draft = draftById(db, draftId)
  const sourceRows = referenceSourceRowsForDraft(db, draft)
  const sizeChartMappings = sizeChartMappingsForDraft(db, draft).map(serializeSizeChartMapping)
  const sizeChartSourceRows = sizeChartSourceRowJson(sourceRowsForDraft(db, draft)).map((row) => ({
    spuCode: stringValue(row.款号 ?? row.spuCode ?? row.spu_code),
    measurementPoint: stringValue(row.测量点 ?? row.measurementPoint ?? row.measurement_point),
    size: normalizeDeepdrawSize(row.size ?? row.尺码),
    sizeValue: stringValue(row.尺码值 ?? row.sizeValue ?? row.size_value),
    sheetName: stringValue(row.sheetName),
    rowNumber: numberValue(row.rowNumber),
    rowJson: row,
  }))
  const fields = (db.prepare(`
    select field.*,
      template.field_id as template_field_id,
      template.field_name as template_field_name,
      template.options_json,
      template.field_type,
      template.third_platform as template_third_platform
    from product_archive_draft_field field
    left join lateral (
      select
        field_id,
        field_name,
        options_json,
        field_type,
        raw_payload_json #>> '{attributes,thirdPlatform}' as third_platform
      from deepdraw_trade_field_cache template
      where template.tenant_name = ?
        and template.merchant_id = ?
        and template.trade_id = ?
        and (template.field_id = field.field_id or template.field_name = field.field_name)
      order by case when template.field_id = field.field_id then 0 else 1 end, template.field_id
      limit 1
    ) template on true
    where field.draft_id = ?
    order by field.required desc, field.blocking desc, field.field_name
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id, draftId) as JsonRecord[]).map((field) => {
    const platform = deepdrawPlatformDisplayName(field.template_third_platform)
    return {
      ...field,
      template_third_platform: stringValue(field.template_third_platform) || null,
      template_platform_name: platform || null,
    }
  })
  return {
    draft,
    tradeSelectionDecision: currentTradeSelectionDecision(db, draft),
    tradePlatforms: deepdrawTradePlatformsForDraft(db, draft),
    launchPlanReference: buildLaunchPlanCategoryReference(sourceRows),
    sizeChartMappings,
    sizeChartSourceRows,
    fields,
    skus: db.prepare(`
      select *
      from product_archive_draft_sku
      where draft_id = ?
      order by skc_code, size_code, sku_code
    `).all(draftId),
    issues: db.prepare(`
      select *
      from product_archive_validation_issue
      where draft_id = ?
      order by resolved_at nulls first,
        case severity when 'blocker' then 0 when 'warning' then 1 else 2 end,
        id
    `).all(draftId),
    images: listProductArchiveDraftImages(db, draftId),
    logs: listProductArchiveSubmitLogs(db, draftId),
  }
}

export function listProductArchiveDrafts(db: SyncPostgresDatabase, input: ListDraftsInput = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const params: unknown[] = []
  const where: string[] = []
  const spuCodes = parseDraftSpuCodes(input.spuCodes)
  if (input.q?.trim()) {
    const like = likeQuery(input.q)
    where.push("(draft.spu_code ilike ? or draft.title ilike ? or draft.trade_path ilike ? or draft.created_product_id ilike ?)")
    params.push(like, like, like, like)
  }
  if (spuCodes.length > 0) {
    where.push(`draft.spu_code in (${spuCodes.map(() => "?").join(", ")})`)
    params.push(...spuCodes)
  }
  if (input.status && input.status !== "all") {
    where.push("draft.status = ?")
    params.push(input.status)
  }
  if (input.tenant && input.tenant !== "all") {
    where.push("draft.tenant_name = ?")
    params.push(input.tenant)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const rows = db.prepare(`
    select
      draft.id,
      draft.draft_no,
      draft.spu_code,
      draft.title,
      draft.tenant_name,
      draft.merchant_id,
      draft.trade_id,
      draft.trade_path,
      draft.status,
      draft.created_product_id,
      draft.updated_at,
      coalesce((draft.validation_summary_json::jsonb #>> '{blocker_count}')::integer, 0) as blocker_count,
      coalesce((draft.validation_summary_json::jsonb #>> '{warning_count}')::integer, 0) as warning_count,
      (select count(*) from product_archive_draft_sku sku where sku.draft_id = draft.id) as sku_count,
      (select count(*) from product_archive_draft_image image where image.draft_id = draft.id) as image_count,
      (
        select image.id
        from product_archive_draft_image image
        where image.draft_id = draft.id
        order by case
            when image.source_type = 'crawshrimp_asset_package' and image.raw_payload_json #>> '{asset_kind}' = 'flat_image' then 0
            when image.source_type = 'crawshrimp_asset_package' and image.raw_payload_json #>> '{asset_kind}' = 'model_image' then 1
            when image.source_type = 'crawshrimp_asset_package' then 2
            else 3
          end,
          image.sort_no,
          image.id
        limit 1
      ) as thumbnail_image_id,
      (
        select coalesce(image.original_file_name, image.file_name)
        from product_archive_draft_image image
        where image.draft_id = draft.id
        order by case
            when image.source_type = 'crawshrimp_asset_package' and image.raw_payload_json #>> '{asset_kind}' = 'flat_image' then 0
            when image.source_type = 'crawshrimp_asset_package' and image.raw_payload_json #>> '{asset_kind}' = 'model_image' then 1
            when image.source_type = 'crawshrimp_asset_package' then 2
            else 3
          end,
          image.sort_no,
          image.id
        limit 1
      ) as thumbnail_file_name,
      (
        select count(*)
        from product_archive_draft_image image
        where image.draft_id = draft.id
          and image.source_type = 'crawshrimp_asset_package'
      ) as asset_package_image_count,
      (
        select count(*)
        from product_archive_draft_field field
        where field.draft_id = draft.id
          and field.source_type = 'hangtag_ocr'
      ) as hangtag_upload_count,
      (
        select count(*)
        from product_archive_draft_field field
        where field.draft_id = draft.id
          and field.source_type = 'washlabel_ocr'
      ) as washlabel_upload_count
    from product_archive_draft draft
    ${clause}
    order by draft.updated_at desc, draft.id desc
    limit ? offset ?
  `).all(...params, limit, offset)
  const total = db.prepare(`
    select count(*) as count
    from product_archive_draft draft
    ${clause}
  `).get(...params) as { count: number }
  const previewMap = listProductArchiveDraftImagePreviews(
    db,
    (rows as JsonRecord[]).map((row) => Number(row.id)),
  )
  const items = (rows as JsonRecord[]).map((row) => {
    const imageState = previewMap.get(Number(row.id))
    const imagePreviews = imageState?.groups ?? emptyProductArchiveDraftListImageGroups()
    const imageCounts = imageState?.counts ?? emptyProductArchiveDraftListImageCounts()
    const displayImage = imagePreviews.reference.find((image) => image.asset_kind === "flat_image")
      ?? imagePreviews.reference[0]
      ?? null
    return {
      ...row,
      thumbnail_image_url: displayImage?.thumbnail_url ?? null,
      thumbnail_preview_url: displayImage?.preview_url ?? null,
      thumbnail_full_url: displayImage?.full_url ?? null,
      thumbnail_file_name: displayImage?.label ?? null,
      asset_package_image_count: imageCounts.reference,
      hangtag_upload_count: Math.max(Number(row.hangtag_upload_count ?? 0), imageCounts.hangtag),
      washlabel_upload_count: Math.max(Number(row.washlabel_upload_count ?? 0), imageCounts.washlabel),
      image_previews: imagePreviews,
    }
  })
  return { items, pagination: { total: Number(total.count ?? 0), limit, offset } }
}

export function getProductArchiveDraftDetail(db: SyncPostgresDatabase, draftId: number) {
  return serializeDraftDetail(db, draftId)
}

export function importProductArchiveSourceRows(db: SyncPostgresDatabase, input: SourceImportInput) {
  const sourceType = sourceImportType(input.sourceType)
  const rows = Array.isArray(input.rows) ? input.rows : []
  const normalizedRows = sourceType === "field_mapping"
    ? parseProductArchiveFieldRuleRows(rows)
    : sourceType === "size_chart"
      ? normalizePlmSizeChartRows(rows, { sheetName: input.sheetName ?? undefined })
      : normalizeProductArchiveSourceRows(sourceType, rows)
  const now = nowIso()

  const batchId = db.transaction(() => {
    const batch = db.prepare(`
      insert into product_archive_source_batch (
        batch_no,
        source_type,
        file_name,
        sheet_name,
        row_count,
        raw_manifest_json,
        import_status,
        committed_at,
        created_at
      )
      values (?, ?, ?, ?, ?, ?::jsonb, 'committed', ?::timestamptz, ?::timestamptz)
    `).run(
      sourceBatchNo(sourceType),
      sourceType,
      stringValue(input.fileName) || null,
      stringValue(input.sheetName) || null,
      normalizedRows.length,
      jsonText({
        input_row_count: rows.length,
        inserted_row_count: normalizedRows.length,
        source_type: sourceType,
      }),
      now,
      now,
    )
    const sourceBatchId = Number(batch.lastInsertRowid)

    if (sourceType === "field_mapping") {
      const insertRule = db.prepare(`
        insert into product_archive_field_rule (
          source_batch_id,
          deepdraw_field,
          source_type,
          source_table,
          source_field,
          default_value,
          transform_rule_json,
          blocking,
          notes,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::timestamptz)
      `)
      for (const row of normalizedRows) {
        insertRule.run(
          sourceBatchId,
          row.deepdrawField,
          row.sourceType,
          row.sourceTable,
          row.sourceField,
          row.defaultValue,
          jsonText(row.transformRule),
          row.blocking,
          row.notes,
          now,
        )
      }
    } else {
      const insertSourceRow = db.prepare(`
        insert into product_archive_source_row (
          source_batch_id,
          source_type,
          spu_code,
          skc_code,
          row_json,
          created_at
        )
        values (?, ?, ?, ?, ?::jsonb, ?::timestamptz)
      `)
      for (const row of normalizedRows) {
        insertSourceRow.run(
          sourceBatchId,
          row.sourceType,
          row.spuCode,
          row.skcCode,
          jsonText(row.rowJson),
          now,
        )
      }
    }
    return sourceBatchId
  })()

  return {
    batch: db.prepare("select * from product_archive_source_batch where id = ?").get(batchId),
    sourceType,
    inputRowCount: rows.length,
    insertedRowCount: normalizedRows.length,
  }
}

export async function importProductArchiveSourceRowsInChunks(
  db: SyncPostgresDatabase,
  input: SourceImportInput,
  options: SourceImportChunkOptions = {},
) {
  const sourceType = sourceImportType(input.sourceType)
  if (sourceType === "field_mapping") {
    const result = importProductArchiveSourceRows(db, input)
    await options.onProgress?.({
      sourceBatchId: Number((result.batch as JsonRecord)?.id),
      insertedRowCount: result.insertedRowCount,
      totalRowCount: result.insertedRowCount,
    })
    return result
  }
  const rows = Array.isArray(input.rows) ? input.rows : []
  const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? 1000)))
  const normalizedRows = sourceType === "size_chart"
    ? normalizePlmSizeChartRows(rows, { sheetName: input.sheetName ?? undefined })
    : await normalizeProductArchiveSourceRowsInChunks(sourceType, rows, {
        chunkSize,
        signal: options.signal,
      })
  throwIfAborted(options.signal)
  const now = nowIso()

  const batchId = Number(db.prepare(`
    insert into product_archive_source_batch (
      batch_no,
      source_type,
      file_name,
      sheet_name,
      row_count,
      raw_manifest_json,
      import_status,
      created_at
    )
    values (?, ?, ?, ?, ?, ?::jsonb, 'importing', ?::timestamptz)
  `).run(
    sourceBatchNo(sourceType),
    sourceType,
    stringValue(input.fileName) || null,
    stringValue(input.sheetName) || null,
    normalizedRows.length,
    jsonText({
      input_row_count: rows.length,
      inserted_row_count: normalizedRows.length,
      source_type: sourceType,
      chunk_size: chunkSize,
    }),
    now,
  ).lastInsertRowid)

  try {
    const insertSourceRow = db.prepare(`
      insert into product_archive_source_row (
        source_batch_id,
        source_type,
        spu_code,
        skc_code,
        row_json,
        created_at
      )
      values (?, ?, ?, ?, ?::jsonb, ?::timestamptz)
    `)
    for (let start = 0; start < normalizedRows.length; start += chunkSize) {
      throwIfAborted(options.signal)
      const end = Math.min(start + chunkSize, normalizedRows.length)
      db.transaction(() => {
        for (let index = start; index < end; index += 1) {
          const row = normalizedRows[index]
          insertSourceRow.run(
            batchId,
            row.sourceType,
            row.spuCode,
            row.skcCode,
            jsonText(row.rowJson),
            now,
          )
        }
      })()
      await options.onProgress?.({
        sourceBatchId: batchId,
        insertedRowCount: end,
        totalRowCount: normalizedRows.length,
      })
      throwIfAborted(options.signal)
      await wait()
    }
    throwIfAborted(options.signal)
    const committedBatch = db.prepare(`
      update product_archive_source_batch
      set import_status = 'committed',
        committed_at = clock_timestamp()
      where id = ?
        and import_status = 'importing'
      returning *
    `).get(batchId)
    if (!committedBatch) throw new Error("来源表批次提交失败，未完成数据不会对草稿可见")
    return {
      batch: committedBatch,
      sourceType,
      inputRowCount: rows.length,
      insertedRowCount: normalizedRows.length,
    }
  } catch (error) {
    db.prepare("delete from product_archive_source_batch where id = ?").run(batchId)
    throw error
  }
}

export function refreshDraftTradeSelectionFromLaunchPlan(
  db: SyncPostgresDatabase,
  draftId: number,
  options: { attempt?: number; tradeCandidates?: JsonRecord[]; claimToken?: string | null } = {},
) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId, { claimToken: options.claimToken })
    const attempt = options.attempt ?? 0
    const draft = draftById(db, draftId)
    const tenantName = stringValue(draft.tenant_name)
    const merchantId = stringValue(draft.merchant_id)
    const evaluated = inferDeepdrawTradeSelectionFromLaunchPlan(db, {
      tenantName,
      merchantId,
      sourceRows: referenceSourceRowsForDraft(db, draft),
      skus: draftSkusForDraft(db, draftId),
      appliedTrade: appliedTradeForDraft(draft),
      tradeCandidates: options.tradeCandidates,
    })
    const merged = mergeTradeSelectionHumanState(
      evaluated,
      recordValue(draft.source_snapshot_json).tradeSelection,
    )
    if (merged.status === "human_adjusted" || merged.status === "human_confirmed") {
      const persisted = persistTradeSelectionDecision(
        db,
        draftId,
        draft.source_snapshot_json,
        merged,
        nowIso(),
        { tradeId: draft.trade_id, snapshotValue: draft.source_snapshot_json },
      )
      if (persisted.changes === 0) {
        if (attempt >= 2) throw new Error("草稿数据持续更新，类目推荐刷新未完成，请稍后重试")
        return refreshDraftTradeSelectionFromLaunchPlan(db, draftId, { ...options, attempt: attempt + 1 })
      }
      if (stringValue(draft.trade_id)) rebuildProductArchiveDraftFields(db, draftId)
      validateProductArchiveDraft(db, draftId, { claimToken: options.claimToken })
      return {
        autoApplied: false,
        noMatch: !evaluated.recommendedTrade,
        refreshed: Boolean(stringValue(draft.trade_id)),
      }
    }
    if (evaluated.recommendedTrade) {
      const result = applyProductArchiveDraftTrade(db, draftId, {
        tradeId: evaluated.recommendedTrade.tradeId,
        tradePath: evaluated.recommendedTrade.tradePath,
      }, { automaticDecision: evaluated, claimToken: options.claimToken })
      return {
        autoApplied: result.tradeSelectionAutoApplied !== false,
        noMatch: false,
        refreshed: true,
      }
    }
    const persisted = persistTradeSelectionDecision(
      db,
      draftId,
      draft.source_snapshot_json,
      evaluated,
      nowIso(),
      { tradeId: draft.trade_id, snapshotValue: draft.source_snapshot_json },
    )
    if (persisted.changes === 0) {
      if (attempt >= 2) throw new Error("草稿数据持续更新，类目推荐刷新未完成，请稍后重试")
      return refreshDraftTradeSelectionFromLaunchPlan(db, draftId, { ...options, attempt: attempt + 1 })
    }
    if (stringValue(draft.trade_id)) rebuildProductArchiveDraftFields(db, draftId)
    validateProductArchiveDraft(db, draftId, { claimToken: options.claimToken })
    return {
      autoApplied: false,
      noMatch: true,
      refreshed: Boolean(stringValue(draft.trade_id)),
    }
  })()
}

export function refreshProductArchiveDraftsFromSourceBatch(db: SyncPostgresDatabase, input: RefreshSourceBatchInput) {
  const sourceType = sourceImportType(input.sourceType)
  if (!["launch_plan", "copywriting", "size_chart"].includes(sourceType)) {
    return { scannedDraftCount: 0, refreshedDraftCount: 0, autoAppliedTradeCount: 0, skippedNoTradeMatchCount: 0, failedDrafts: [] }
  }
  const sourceBatchId = numberValue(input.sourceBatchId)
  if (sourceBatchId === null || sourceBatchId <= 0) {
    return { scannedDraftCount: 0, refreshedDraftCount: 0, autoAppliedTradeCount: 0, skippedNoTradeMatchCount: 0, failedDrafts: [] }
  }

  const drafts = db.prepare(`
    select distinct draft.*
    from product_archive_draft draft
    join product_archive_source_row source on source.spu_code = draft.spu_code
    where source.source_batch_id = ?
      and source.source_type = ?
      and draft.status in ('draft', 'missing_fields', 'manual_review', 'ready')
    order by draft.updated_at desc, draft.id desc
  `).all(sourceBatchId, sourceType) as JsonRecord[]
  let refreshedDraftCount = 0
  let autoAppliedTradeCount = 0
  let skippedNoTradeMatchCount = 0
  const failedDrafts: Array<{ draftId: number; spuCode: string; message: string }> = []

  for (const draft of drafts) {
    const draftId = numberValue(draft.id)
    if (draftId === null) continue
    try {
      db.transaction(() => {
        assertProductArchiveDraftMutable(db, draftId)
        appendSourceBatchIdToDraft(db, draftId, sourceType, sourceBatchId)
        const currentDraft = draftById(db, draftId)

        if (sourceType === "launch_plan") {
          const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
          if (tradeRefresh.autoApplied) autoAppliedTradeCount += 1
          if (tradeRefresh.noMatch) skippedNoTradeMatchCount += 1
          if (tradeRefresh.refreshed) refreshedDraftCount += 1
        } else if (stringValue(currentDraft.trade_id)) {
          rebuildProductArchiveDraftFields(db, draftId)
          validateProductArchiveDraft(db, draftId)
          refreshedDraftCount += 1
        } else {
          validateProductArchiveDraft(db, draftId)
        }
      })()
    } catch (error) {
      failedDrafts.push({
        draftId,
        spuCode: stringValue(draft.spu_code),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    scannedDraftCount: drafts.length,
    refreshedDraftCount,
    autoAppliedTradeCount,
    skippedNoTradeMatchCount,
    failedDrafts,
  }
}

export async function refreshProductArchiveDraftsFromSourceBatchInChunks(
  db: SyncPostgresDatabase,
  input: RefreshSourceBatchInput,
  options: RefreshSourceBatchChunkOptions = {},
) {
  const sourceType = sourceImportType(input.sourceType)
  if (!["launch_plan", "copywriting", "size_chart"].includes(sourceType)) {
    return { scannedDraftCount: 0, refreshedDraftCount: 0, autoAppliedTradeCount: 0, skippedNoTradeMatchCount: 0, failedDrafts: [] }
  }
  const sourceBatchId = numberValue(input.sourceBatchId)
  if (sourceBatchId === null || sourceBatchId <= 0) {
    return { scannedDraftCount: 0, refreshedDraftCount: 0, autoAppliedTradeCount: 0, skippedNoTradeMatchCount: 0, failedDrafts: [] }
  }

  const drafts = db.prepare(`
    select distinct draft.*
    from product_archive_draft draft
    join product_archive_source_row source on source.spu_code = draft.spu_code
    where source.source_batch_id = ?
      and source.source_type = ?
      and draft.status in ('draft', 'missing_fields', 'manual_review', 'ready')
    order by draft.updated_at desc, draft.id desc
  `).all(sourceBatchId, sourceType) as JsonRecord[]
  let refreshedDraftCount = 0
  let autoAppliedTradeCount = 0
  let skippedNoTradeMatchCount = 0
  const failedDrafts: Array<{ draftId: number; spuCode: string; message: string }> = []
  const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? 10)))

  for (let start = 0; start < drafts.length; start += chunkSize) {
    throwIfAborted(options.signal)
    const end = Math.min(start + chunkSize, drafts.length)
    for (let index = start; index < end; index += 1) {
      throwIfAborted(options.signal)
      const draft = drafts[index]
      const draftId = numberValue(draft.id)
      if (draftId === null) continue
      try {
        db.transaction(() => {
          assertProductArchiveDraftMutable(db, draftId)
          appendSourceBatchIdToDraft(db, draftId, sourceType, sourceBatchId)
          const currentDraft = draftById(db, draftId)

          if (sourceType === "launch_plan") {
            const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
            if (tradeRefresh.autoApplied) autoAppliedTradeCount += 1
            if (tradeRefresh.noMatch) skippedNoTradeMatchCount += 1
            if (tradeRefresh.refreshed) refreshedDraftCount += 1
          } else if (stringValue(currentDraft.trade_id)) {
            rebuildProductArchiveDraftFields(db, draftId)
            validateProductArchiveDraft(db, draftId)
            refreshedDraftCount += 1
          } else {
            validateProductArchiveDraft(db, draftId)
          }
        })()
      } catch (error) {
        failedDrafts.push({
          draftId,
          spuCode: stringValue(draft.spu_code),
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    await options.onProgress?.({
      sourceBatchId,
      scannedDraftCount: drafts.length,
      processedDraftCount: end,
      refreshedDraftCount,
      autoAppliedTradeCount,
      skippedNoTradeMatchCount,
      failedDraftCount: failedDrafts.length,
    })
    throwIfAborted(options.signal)
    await wait()
  }

  return {
    scannedDraftCount: drafts.length,
    refreshedDraftCount,
    autoAppliedTradeCount,
    skippedNoTradeMatchCount,
    failedDrafts,
  }
}

export function backfillLegacyProductArchiveDraftTrades(
  db: SyncPostgresDatabase,
  options: { apply?: boolean } = {},
) {
  const apply = options.apply === true
  const drafts = db.prepare(`
    select *
    from product_archive_draft
    where tenant_name = ?
      and lower(coalesce(trade_path, '')) like 'blbl&mini%'
    order by updated_at desc, id desc
  `).all(BALA_DEEPDRAW_TENANT) as JsonRecord[]
  const items: Array<{
    draftId: number
    draftNo: string
    spuCode: string
    status: string
    currentTrade: TradeSelectionDecision["appliedTrade"]
    recommendedTrade: TradeSelectionDecision["recommendedTrade"]
    decisionStatus: TradeSelectionStatus | null
    action: "preview_apply" | "applied" | "manual_selection_required" | "review_only" | "skipped_changed" | "failed"
    message: string
  }> = []

  for (const draft of drafts) {
    const draftId = numberValue(draft.id)
    if (draftId === null) continue
    const fallbackBase = {
      draftId,
      draftNo: stringValue(draft.draft_no),
      spuCode: stringValue(draft.spu_code),
      status: stringValue(draft.status),
      currentTrade: appliedTradeForDraft(draft),
      recommendedTrade: null,
      decisionStatus: null,
    }
    let failureBase: Omit<(typeof items)[number], "action" | "message"> = fallbackBase
    try {
      const decision = currentTradeSelectionDecision(db, draft)
      const base = {
        ...fallbackBase,
        recommendedTrade: decision.recommendedTrade,
        decisionStatus: decision.status,
      }
      failureBase = base
      if (!isProductArchiveTradeBackfillStatus(draft.status)) {
        items.push({
          ...base,
          action: "review_only",
          message: "终态或非回填状态，仅列入人工审核清单。",
        })
        continue
      }
      if (hasHumanTradeSelection(draft.source_snapshot_json)) {
        items.push({
          ...base,
          action: "skipped_changed",
          message: "草稿已有人工选择，未执行自动回填。",
        })
        continue
      }
      if (isCompletedLegacyTradeBackfill(decision)) {
        items.push({
          ...base,
          action: "skipped_changed",
          message: "草稿已完成安全回填，正在等待人工确认，未重复执行。",
        })
        continue
      }
      if (!decision.recommendedTrade) {
        items.push({
          ...base,
          action: "manual_selection_required",
          message: decision.reason,
        })
        continue
      }
      if (!apply) {
        items.push({
          ...base,
          action: "preview_apply",
          message: "预览：将自动应用推荐类目并保留待人工确认状态。",
        })
        continue
      }
      const appliedItem = db.transaction((): (typeof items)[number] => {
        const currentDraft = db.prepare(`
          select *
          from product_archive_draft
          where id = ?
          for update
        `).get(draftId) as JsonRecord | undefined
        if (!currentDraft) {
          return {
            ...base,
            action: "skipped_changed",
            message: "草稿已不存在，未执行自动回填。",
          }
        }
        const currentDecision = currentTradeSelectionDecision(db, currentDraft)
        const currentBase = {
          ...base,
          status: stringValue(currentDraft.status),
          currentTrade: appliedTradeForDraft(currentDraft),
          recommendedTrade: currentDecision.recommendedTrade,
          decisionStatus: currentDecision.status,
        }
        if (!isProductArchiveTradeBackfillStatus(currentDraft.status)) {
          return {
            ...currentBase,
            action: "review_only",
            message: "草稿已进入终态或非回填状态，仅列入人工审核清单。",
          }
        }
        if (hasHumanTradeSelection(currentDraft.source_snapshot_json)) {
          return {
            ...currentBase,
            action: "skipped_changed",
            message: "草稿已有人工选择，未执行自动回填。",
          }
        }
        if (isCompletedLegacyTradeBackfill(currentDecision)) {
          return {
            ...currentBase,
            action: "skipped_changed",
            message: "草稿已完成安全回填，正在等待人工确认，未重复执行。",
          }
        }
        if (!currentDecision.recommendedTrade) {
          return {
            ...currentBase,
            action: "manual_selection_required",
            message: currentDecision.reason,
          }
        }
        const pendingDecision: TradeSelectionDecision = {
          ...currentDecision,
          status: "pending_confirmation",
          reasonCode: "legacy_backfill_confirmation_required",
          appliedTrade: currentDecision.recommendedTrade,
          reason: legacyTradeBackfillReason(currentDecision),
          confirmedAt: null,
        }
        applyProductArchiveDraftTrade(db, draftId, currentDecision.recommendedTrade, {
          automaticDecision: pendingDecision,
        })
        const refreshed = draftById(db, draftId)
        const refreshedDecision = currentTradeSelectionDecision(db, refreshed)
        return {
          ...currentBase,
          status: stringValue(refreshed.status),
          currentTrade: appliedTradeForDraft(refreshed),
          recommendedTrade: refreshedDecision.recommendedTrade,
          decisionStatus: refreshedDecision.status,
          action: "applied",
          message: "已自动应用推荐类目，等待人工确认。",
        }
      })()
      items.push(appliedItem)
    } catch (error) {
      items.push({
        ...failureBase,
        action: "failed",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    mode: apply ? "apply" : "preview",
    scannedDraftCount: drafts.length,
    appliedDraftCount: items.filter((item) => item.action === "applied").length,
    previewApplyCount: items.filter((item) => item.action === "preview_apply").length,
    manualSelectionCount: items.filter((item) => item.action === "manual_selection_required").length,
    reviewOnlyCount: items.filter((item) => item.action === "review_only").length,
    skippedChangedCount: items.filter((item) => item.action === "skipped_changed").length,
    failedCount: items.filter((item) => item.action === "failed").length,
    items,
  }
}

export function createProductArchiveDraftFromSpu(db: SyncPostgresDatabase, input: CreateDraftInput) {
  const spu = db.prepare("select * from product_spu where spu_code = ?").get(input.spuCode) as JsonRecord | undefined
  if (!spu) throw new Error(`MDM 款号不存在：${input.spuCode}`)

  const deepdrawConfig = resolveDeepdrawConfig({
    projectRoot: input.projectRoot,
    tenantName: input.deepdrawTenantName ?? undefined,
  })
  const tenantName = deepdrawConfig.tenantName
  const merchantId = String(deepdrawConfig.merchantId)
  const skuRows = db.prepare(`
    select
      spu.spu_code,
      skc.skc_code,
      skc.color_code,
      skc.color_name,
      sku.sku_code,
      sku.ean_code,
      sku.inner_code,
      sku.size_code,
      sku.size_name,
      sku.price_tag,
      sku.raw_payload_json
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    join product_spu spu on spu.id = skc.spu_id
    where spu.spu_code = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(input.spuCode) as JsonRecord[]

  const sourceBatchIds = resolveDraftSourceBatchIdsForSpu(
    db,
    input.spuCode,
    input.sourceBatchIds,
    input.sourceBatchId,
  )
  const sourceBatchIdValues = sourceBatchIdList(sourceBatchIds)
  const sourceRows = sourceBatchIdValues.length > 0
    ? sourceRowsForSpuBatchIds(db, input.spuCode, sourceBatchIdValues)
    : sourceRowsForSpu(db, input.spuCode, null)
  const now = nowIso()
  const evaluateTradeSelection = (appliedTrade?: TradeSelectionDecision["appliedTrade"]) => inferDeepdrawTradeSelectionFromLaunchPlan(db, {
    tenantName,
    merchantId,
    sourceRows,
    skus: skuRows,
    appliedTrade,
    evaluatedAt: now,
  })
  const evaluatedTradeSelection = evaluateTradeSelection()
  const selectedTrade = input.tradeId
    ? {
        tradeId: input.tradeId,
        tradePath: input.tradePath ?? input.tradeId,
      }
    : evaluatedTradeSelection.recommendedTrade
  const tradeSelection = selectedTrade
    ? input.tradeId
      ? applyHumanTradeSelectionDecision(evaluatedTradeSelection, selectedTrade, now)
      : { ...evaluatedTradeSelection, appliedTrade: selectedTrade }
    : evaluatedTradeSelection
  const draftTradeId = selectedTrade?.tradeId ?? null
  const draftTradePath = selectedTrade?.tradePath ?? null

  const sourceBatchId = sourceBatchIds.launch_plan?.[0] ?? null
  const sourceSnapshot = {
    spu,
    sourceRows,
    sourceBatchId: sourceBatchId ?? null,
    sourceBatchIds,
    autoMatchedTrade: evaluatedTradeSelection.recommendedTrade
      ? {
          ...evaluatedTradeSelection.recommendedTrade,
          confidence: evaluatedTradeSelection.confidence,
          matchedField: evaluatedTradeSelection.matchedField,
          matchedValue: evaluatedTradeSelection.matchedValue,
        }
      : null,
    tradeSelection,
  }
  const result = db.transaction(() => {
    const blockedDraft = nonReusableProductArchiveDraftForSpu(db, {
      spuCode: input.spuCode,
      tenantName,
      merchantId,
    })
    if (blockedDraft) {
      throw new Error(`款号 ${input.spuCode} 已有不可覆盖状态草稿 ${blockedDraft.id}（${stringValue(blockedDraft.status)}），未创建重复草稿`)
    }

    const existingDraft = reusableProductArchiveDraftForSpu(db, {
      spuCode: input.spuCode,
      tenantName,
      merchantId,
    })
    if (existingDraft) {
      const draftId = numberValue(existingDraft.id) ?? 0
      const existingSnapshot = recordValue(existingDraft.source_snapshot_json)
      const existingAppliedTrade = appliedTradeForDraft(existingDraft)
      const existingEvaluatedTradeSelection = evaluateTradeSelection(existingAppliedTrade)
      const nextTradeSelection = input.tradeId && selectedTrade
        ? applyHumanTradeSelectionDecision(existingEvaluatedTradeSelection, selectedTrade, now)
        : mergeTradeSelectionHumanState(existingEvaluatedTradeSelection, existingSnapshot.tradeSelection)
      const shouldPreserveHumanTrade = !input.tradeId && hasHumanTradeSelection(existingSnapshot) && existingAppliedTrade
      const nextSelectedTrade = shouldPreserveHumanTrade
        ? existingAppliedTrade
        : input.tradeId
          ? selectedTrade
          : nextTradeSelection.recommendedTrade
      const nextSourceSnapshot = {
        ...sourceSnapshot,
        autoMatchedTrade: existingEvaluatedTradeSelection.recommendedTrade
          ? {
              ...existingEvaluatedTradeSelection.recommendedTrade,
              confidence: existingEvaluatedTradeSelection.confidence,
              matchedField: existingEvaluatedTradeSelection.matchedField,
              matchedValue: existingEvaluatedTradeSelection.matchedValue,
            }
          : null,
        tradeSelection: nextSelectedTrade
          ? { ...nextTradeSelection, appliedTrade: nextSelectedTrade }
          : nextTradeSelection,
      }
      db.prepare(`
        update product_archive_draft
        set trade_id = ?,
          trade_path = ?,
          title = ?,
          retail_price = ?,
          source_snapshot_json = ?::jsonb,
          duplicate_result_json = '{}'::jsonb,
          updated_at = ?::timestamptz
        where id = ?
      `).run(
        nextSelectedTrade?.tradeId ?? null,
        nextSelectedTrade?.tradePath ?? null,
        chooseTitle(spu, sourceRows),
        numberValue(spu.price_tag),
        jsonText(nextSourceSnapshot),
        now,
        draftId,
      )
      replaceProductArchiveDraftSkuRows(db, draftId, input.spuCode, skuRows, now)
      rebuildProductArchiveDraftFields(db, draftId, nextSelectedTrade?.tradeId
        ? tradeFieldsForDraft(db, { tenant_name: tenantName, merchant_id: merchantId, trade_id: nextSelectedTrade.tradeId }, nextSelectedTrade.tradeId)
        : [])
      return draftId
    }

    const inserted = db.prepare(`
      insert into product_archive_draft (
        draft_no,
        spu_code,
        tenant_name,
        merchant_id,
        trade_id,
        trade_path,
        title,
        retail_price,
        source_snapshot_json,
        created_by,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::timestamptz)
    `).run(
      draftNo(input.spuCode),
      input.spuCode,
      tenantName,
      merchantId,
      draftTradeId,
      draftTradePath,
      chooseTitle(spu, sourceRows),
      numberValue(spu.price_tag),
      jsonText(sourceSnapshot),
      input.createdBy ?? null,
      now,
    )
    const draftId = Number(inserted.lastInsertRowid)
    replaceProductArchiveDraftSkuRows(db, draftId, input.spuCode, skuRows, now)
    rebuildProductArchiveDraftFields(db, draftId, draftTradeId
      ? tradeFieldsForDraft(db, { tenant_name: tenantName, merchant_id: merchantId, trade_id: draftTradeId }, draftTradeId)
      : [])
    return draftId
  })()

  validateProductArchiveDraft(db, result)
  return serializeDraftDetail(db, result)
}

export function applyProductArchiveDraftTrade(
  db: SyncPostgresDatabase,
  draftId: number,
  input: ApplyTradeInput,
  options: { automaticDecision?: TradeSelectionDecision; claimToken?: string | null } = {},
) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId, { claimToken: options.claimToken })
    const draft = draftById(db, draftId)
    const tradeId = stringValue(input.tradeId)
    if (!tradeId) throw new Error("请选择深绘类目")
    if (options.automaticDecision && hasHumanTradeSelection(draft.source_snapshot_json)) {
      return {
        ...validateProductArchiveDraft(db, draftId, { claimToken: options.claimToken }),
        tradeSelectionAutoApplied: false,
      }
    }
    const trade = db.prepare(`
      select *
      from deepdraw_trade_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
      limit 1
    `).get(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord | undefined
    if (!trade) throw new Error("本地未找到该深绘类目，请先同步类目主数据")

    const now = nowIso()
    const tradePath = stringValue(input.tradePath) || stringValue(trade.trade_path) || stringValue(trade.trade_name) || tradeId
    const appliedTrade = { tradeId, tradePath }
    const decision = options.automaticDecision
      ? { ...options.automaticDecision, appliedTrade }
      : applyHumanTradeSelectionDecision(
          currentTradeSelectionDecision(db, { ...draft, trade_id: tradeId, trade_path: tradePath }),
          appliedTrade,
          now,
        )
    const snapshot = {
      ...recordValue(draft.source_snapshot_json),
      tradeSelection: decision,
    }
    const updateResult = db.prepare(`
      update product_archive_draft
      set trade_id = ?,
        trade_path = ?,
        source_snapshot_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
        and trade_id is not distinct from ?
        and source_snapshot_json is not distinct from ?::jsonb
    `).run(
      tradeId,
      tradePath,
      jsonText(snapshot),
      now,
      draftId,
      draft.trade_id ?? null,
      jsonText(recordValue(draft.source_snapshot_json)),
    )
    if (Number(updateResult.changes ?? 0) === 0) {
      const currentDraft = draftById(db, draftId)
      if (options.automaticDecision && hasHumanTradeSelection(currentDraft.source_snapshot_json)) {
        return {
          ...validateProductArchiveDraft(db, draftId, { claimToken: options.claimToken }),
          tradeSelectionAutoApplied: false,
        }
      }
      throw new Error("草稿数据已更新，请刷新后重试")
    }
    rebuildProductArchiveDraftFields(db, draftId)
    const result = validateProductArchiveDraft(db, draftId, { claimToken: options.claimToken })
    return options.automaticDecision
      ? { ...result, tradeSelectionAutoApplied: true }
      : result
  })()
}

export function confirmProductArchiveDraftRecommendedTrade(
  db: SyncPostgresDatabase,
  draftId: number,
  input: ConfirmTradeInput = {},
) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    const draft = draftById(db, draftId)
    const decision = currentTradeSelectionDecision(db, draft)
    const recommendedTradeId = decision.recommendedTrade?.tradeId ?? ""
    const expectedTradeId = stringValue(input.recommendedTradeId)
    if (
      !recommendedTradeId
      || !expectedTradeId
      || expectedTradeId !== recommendedTradeId
      || decision.status === "human_adjusted"
    ) {
      throw new Error("推荐结果已更新，请刷新后重新确认")
    }
    const trade = db.prepare(`
      select *
      from deepdraw_trade_cache
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
      limit 1
    `).get(draft.tenant_name, draft.merchant_id, recommendedTradeId) as JsonRecord | undefined
    if (!trade) throw new Error("本地未找到该深绘类目，请先同步类目主数据")

    const appliedTrade = {
      tradeId: recommendedTradeId,
      tradePath: stringValue(trade.trade_path)
        || stringValue(trade.trade_name)
        || decision.recommendedTrade?.tradePath
        || recommendedTradeId,
    }
    const appliedAt = nowIso()
    const appliedDecision: TradeSelectionDecision = {
      ...decision,
      appliedTrade,
      confirmedAt: null,
    }
    const appliedSnapshot = {
      ...recordValue(draft.source_snapshot_json),
      tradeSelection: appliedDecision,
    }
    const updateResult = db.prepare(`
      update product_archive_draft
      set trade_id = ?,
        trade_path = ?,
        source_snapshot_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
        and trade_id is not distinct from ?
        and source_snapshot_json is not distinct from ?::jsonb
    `).run(
      appliedTrade.tradeId,
      appliedTrade.tradePath,
      jsonText(appliedSnapshot),
      appliedAt,
      draftId,
      draft.trade_id ?? null,
      jsonText(recordValue(draft.source_snapshot_json)),
    )
    if (Number(updateResult.changes ?? 0) === 0) {
      throw new Error("推荐结果已更新，请刷新后重新确认")
    }
    rebuildProductArchiveDraftFields(db, draftId)
    validateProductArchiveDraft(db, draftId)

    const validatedDraft = draftById(db, draftId)
    const recheckedDecision = currentTradeSelectionDecision(db, validatedDraft)
    if (recheckedDecision.recommendedTrade?.tradeId !== recommendedTradeId) {
      throw new Error("推荐结果已更新，请刷新后重新确认")
    }
    const confirmedAt = nowIso()
    const confirmed = applyHumanTradeSelectionDecision(recheckedDecision, appliedTrade, confirmedAt)
    const persisted = persistTradeSelectionDecision(
      db,
      draftId,
      validatedDraft.source_snapshot_json,
      confirmed,
      confirmedAt,
      { tradeId: validatedDraft.trade_id, snapshotValue: validatedDraft.source_snapshot_json },
    )
    if (persisted.changes === 0) {
      throw new Error("推荐结果已更新，请刷新后重新确认")
    }
    return serializeDraftDetail(db, draftId)
  })()
}

export function patchProductArchiveDraftFields(db: SyncPostgresDatabase, draftId: number, input: PatchFieldInput) {
  const expectedDraftUpdatedAt = timestampIsoValue(input.expectedDraftUpdatedAt ?? input.expected_draft_updated_at)
  const now = nextTimestampIso([
    expectedDraftUpdatedAt,
    ...(input.fields ?? []).map((field) => field.expectedUpdatedAt ?? field.expected_updated_at),
  ])
  const shouldSyncDownFillWeightSizeCharts = (input.fields ?? []).some((field) => (
    ["充绒量", "充绒量文本"].includes(compactFieldKey(field.fieldName ?? field.field_name))
  ))
  return db.transaction(() => {
    const draft = assertProductArchiveDraftMutable(db, draftId)
    if (!expectedDraftUpdatedAt || timestampIsoValue(draft.updated_at) !== expectedDraftUpdatedAt) {
      throw new Error("草稿数据已更新，请刷新后重试")
    }
    for (const field of input.fields ?? []) {
      const fieldId = Number(field.id)
      const fieldName = stringValue(field.fieldName ?? field.field_name)
      const expectedUpdatedAt = timestampIsoValue(field.expectedUpdatedAt ?? field.expected_updated_at)
      const valueText = field.valueText ?? field.value_text ?? null
      const valueJson = field.valueJson ?? field.value_json ?? {}
      if (!Number.isInteger(fieldId) || fieldId <= 0 || !fieldName || !expectedUpdatedAt) {
        throw new Error("草稿数据已更新，请刷新后重试")
      }
      const update = db.prepare(`
        update product_archive_draft_field
        set value_text = ?,
          value_json = ?::jsonb,
          manual_override = true,
          updated_at = ?::timestamptz
        where draft_id = ?
          and id = ?
          and field_name is not distinct from ?
          and updated_at is not distinct from ?::timestamptz
      `).run(valueText, jsonText(valueJson), now, draftId, fieldId, fieldName, expectedUpdatedAt)
      if (Number(update?.changes ?? 0) !== 1) {
        throw new Error("草稿数据已更新，请刷新后重试")
      }
    }
    if (shouldSyncDownFillWeightSizeCharts) syncProductArchiveDownFillWeightSizeCharts(db, draftId)
    const draftUpdate = db.prepare(`
      update product_archive_draft
      set updated_at = ?::timestamptz
      where id = ?
        and updated_at is not distinct from ?::timestamptz
    `).run(now, draftId, expectedDraftUpdatedAt)
    if (Number(draftUpdate?.changes ?? 0) !== 1) {
      throw new Error("草稿数据已更新，请刷新后重试")
    }
    return validateProductArchiveDraft(db, draftId, { updatedAt: now })
  })()
}

export async function fillProductArchiveDraftFieldsWithAi(db: SyncPostgresDatabase, draftId: number, options: AiFillOptions = {}) {
  const prepared = db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
    rebuildProductArchiveDraftFields(db, draftId)
    syncProductArchiveDownFillWeightSizeCharts(db, draftId)
    const detail = validateProductArchiveDraft(db, draftId).detail
    const draft = detail.draft as JsonRecord
    const fields = detail.fields as JsonRecord[]
    const skus = detail.skus as JsonRecord[]
    const issues = detail.issues as JsonRecord[]
    const referenceImages = detail.images as JsonRecord[] ?? []
    const sourceRows = referenceSourceRowsForDraft(db, draft)
    const mdmSpu = resolveProductArchiveDraftSpu(db, draft)
    const shoeDraftContext = isShoeDraftContext({ draft, spu: mdmSpu, sourceRows })
    const candidates = buildProductArchiveAiFillCandidateFields(fields, issues, skus).filter((field) => {
      if (!isProductArchiveShoeAiEnumField(field.fieldName)) return true
      if (!shoeDraftContext) return false
      if (compactFieldKey(field.fieldName) === compactFieldKey("25鞋子尺码表")) {
        return shouldProductArchiveAiFill25ShoeSizeTable({
          tradeId: draft.trade_id,
          tradePath: draft.trade_path,
        })
      }
      return true
    })
    const evidenceRuleFills = buildProductArchiveEvidenceRuleFills({
      draft,
      fields,
      spu: mdmSpu,
      sourceRows,
      referenceImages,
    })
    const fieldSnapshots = new Map(
      fields
        .map((field) => [Number(field.id), aiFillFieldSnapshot(field)] as const)
        .filter(([fieldId]) => Number.isInteger(fieldId) && fieldId > 0),
    )
    return {
      detail,
      referenceImages,
      fieldSnapshots,
      candidates,
      draft,
      fields,
      skus,
      sourceRows,
      mdmSpu,
      evidenceRuleFills,
      warnings: [] as ProductArchiveAiFillWarning[],
    }
  })()
  const {
    detail,
    referenceImages,
    fieldSnapshots,
    candidates,
    draft,
    fields,
    skus,
    sourceRows,
    mdmSpu,
    evidenceRuleFills: preparedEvidenceRuleFills,
    warnings,
  } = prepared

  throwIfAborted(options.signal)
  const ocrFallback = await buildProductArchiveAiFillOcrFallback({
    draftId,
    spuCode: stringValue(draft.spu_code),
    fields,
    images: referenceImages,
  }, options)
  throwIfAborted(options.signal)
  warnings.push(...ocrFallback.warnings)
  const ocrFills = ocrFallback.fills as JsonRecord[]
  const ocrFillById = new Map(ocrFills.map((fill) => [Number(fill.field_id), fill]))
  const evidenceRuleFills = preparedEvidenceRuleFills.filter((fill) => !ocrFillById.has(Number(fill.field_id)))
  const evidenceRuleFillById = new Map(evidenceRuleFills.map((fill) => [Number(fill.field_id), fill]))
  const aiFillCandidates = candidates.filter((field) => (
    !ocrFillById.has(field.id) && !evidenceRuleFillById.has(field.id)
  ))
  const materialEvidenceFills = buildProductArchiveMaterialEvidenceFills(fields, aiFillCandidates, sourceRows)
  const materialEvidenceById = new Map(materialEvidenceFills.map((fill) => [Number(fill.field_id), fill]))
  const aiCandidates = aiFillCandidates.filter((field) => !materialEvidenceById.has(field.id))
  const prompt = aiCandidates.length > 0
    ? buildDeepdrawAiFillPrompt({
        draft,
        fields: aiCandidates,
        skus,
        allFields: fields,
        sourceRows,
        mdmSpu,
        referenceImages,
      })
    : ""

  if (ocrFills.length === 0 && candidates.length === 0 && evidenceRuleFills.length === 0) {
    return { saved: [], detail, warnings }
  }
  let aiFills: JsonRecord[] = []
  if (aiCandidates.length > 0) {
    try {
      aiFills = await callDeepdrawAiFill(db, prompt, aiCandidates, referenceImages, options)
      throwIfAborted(options.signal)
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error
      const attempts = Array.isArray((error as { attempts?: unknown }).attempts)
        ? (error as { attempts: JsonRecord[] }).attempts
        : []
      const attemptedModels = attempts
        .map((attempt) => `${stringValue(attempt.providerKey)}:${stringValue(attempt.model)}`)
        .filter(Boolean)
      warnings.push({
        code: "ai_provider_unavailable",
        message: attemptedModels.length > 0
          ? `AI 字段推荐暂未生成：${attemptedModels.join("、")} 均未返回可用结果`
          : "AI 字段推荐暂未生成：当前 AI 服务未返回可用结果",
      })
    }
  }
  throwIfAborted(options.signal)
  const aiById = new Map(aiFills.map((fill) => [Number(fill.field_id), fill]))
  const now = nowIso()
  const saved: Array<{ field_id: number; field_name: string; field_value: string; source: string; confidence: number | null }> = []
  const templateOptionsByFieldId = new Map(
    fields
      .map((field) => [Number(field.id), fieldOptionsFromTemplate(field.options_json)] as const)
      .filter(([fieldId]) => Number.isInteger(fieldId) && fieldId > 0),
  )
  const markDraftChanged = () => {
    if (warnings.some((warning) => warning.code === "draft_changed")) return
    warnings.push({
      code: "draft_changed",
      message: "草稿字段在 AI 等待期间已更新，已跳过冲突字段",
    })
  }
  const updateField = db.prepare(`
    update product_archive_draft_field field
    set value_text = ?,
      value_json = ?::jsonb,
      source_type = ?,
      source_ref = ?,
      manual_override = true,
      validation_status = 'valid',
      validation_message = null,
      updated_at = ?::timestamptz
    where field.draft_id = ?
      and field.id = ?
      and field.field_name is not distinct from ?
      and field.field_id is not distinct from ?
      and field.source_type is not distinct from ?
      and field.source_ref is not distinct from ?
      and field.value_text is not distinct from ?
      and field.value_json is not distinct from ?::jsonb
      and field.required is not distinct from ?
      and field.blocking is not distinct from ?
      and field.manual_override is not distinct from ?
      and field.validation_status is not distinct from ?
      and field.validation_message is not distinct from ?
      and field.updated_at is not distinct from ?::timestamptz
  `)

  const validated = db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    const applyFieldFill = (input: {
      fieldId: number
      fieldName: string
      fieldValue: string
      valueJson: unknown
      sourceType: string
      sourceRef: string | null
      source: string
      confidence: number | null
    }) => {
      const snapshot = fieldSnapshots.get(input.fieldId)
      if (!snapshot) {
        markDraftChanged()
        return
      }
      const templateOptions = templateOptionsByFieldId.get(input.fieldId) ?? []
      const fieldValue = normalizeProductArchiveTemplateFieldValue(input.fieldName, input.fieldValue, templateOptions)
      if (!fieldValue && templateOptions.length > 0) return
      const update = updateField.run(
        fieldValue || input.fieldValue,
        jsonText(input.valueJson),
        input.sourceType,
        input.sourceRef,
        now,
        draftId,
        input.fieldId,
        snapshot.fieldName,
        snapshot.fieldId,
        snapshot.sourceType,
        snapshot.sourceRef,
        snapshot.valueText,
        jsonText(snapshot.valueJson),
        snapshot.required,
        snapshot.blocking,
        snapshot.manualOverride,
        snapshot.validationStatus,
        snapshot.validationMessage,
        snapshot.updatedAt,
      )
      if (Number(update?.changes ?? 0) !== 1) {
        markDraftChanged()
        return
      }
      saved.push({
        field_id: input.fieldId,
        field_name: input.fieldName,
        field_value: fieldValue || input.fieldValue,
        source: input.source,
        confidence: input.confidence,
      })
    }
    for (const fill of ocrFills) {
      const confidence = Number(fill.confidence)
      applyFieldFill({
        fieldId: Number(fill.field_id),
        fieldName: stringValue(fill.field_name),
        fieldValue: stringValue(fill.field_value),
        valueJson: {
          ocr_evidence: {
            file_name: stringValue(fill.file_name),
            field_key: stringValue(fill.field_key),
            field_label: stringValue(fill.field_label),
            source_kind: stringValue(fill.source_kind),
            source_ref: stringValue(fill.source_ref) || null,
            confidence: Number.isFinite(confidence) ? confidence : null,
            confidence_label: stringValue(fill.confidence_label),
            evidence_text: stringValue(fill.evidence_text),
            page_number: Number(fill.page_number) || null,
            applied_at: now,
          },
          source: "OCR_EVIDENCE",
        },
        sourceType: stringValue(fill.source_type),
        sourceRef: stringValue(fill.source_ref) || null,
        source: "OCR_EVIDENCE",
        confidence: Number.isFinite(confidence) ? confidence : null,
      })
    }
    for (const fill of evidenceRuleFills) {
      const fallbackSource = fill.source_type === "ai_rule_fallback"
      const fillSource = fallbackSource ? "AI_RULE_FALLBACK" : "EVIDENCE_RULE"
      applyFieldFill({
        fieldId: fill.field_id,
        fieldName: fill.field_name,
        fieldValue: fill.field_value,
        valueJson: fallbackSource
          ? {
              ai_fill: {
                fallback: true,
                field_name: fill.field_name,
                confidence: fill.confidence,
                reason: fill.reason,
                applied_at: now,
              },
              source: "AI_RULE_FALLBACK",
            }
          : {
              evidence_rule: {
                field_name: fill.field_name,
                confidence: fill.confidence,
                reason: fill.reason,
                applied_at: now,
              },
              source: "EVIDENCE_RULE",
            },
        sourceType: fill.source_type,
        sourceRef: fill.source_ref,
        source: fillSource,
        confidence: fill.confidence,
      })
    }
    for (const field of candidates) {
      if (ocrFillById.has(field.id) || evidenceRuleFillById.has(field.id)) continue
      const materialFill = materialEvidenceById.get(field.id)
      const aiFill = materialFill ?? aiById.get(field.id)
      if (!aiFill) continue
      const confidence = Number(aiFill.confidence)
      if (!Number.isFinite(confidence) || confidence < AI_FILL_MIN_CONFIDENCE) continue
      const aiValue = stringValue(aiFill.field_value)
      const fieldValue = materialFill
        ? aiValue
        : normalizeProductArchiveAiFillValue(field.fieldName, field.currentValue, aiValue, field.options)
      if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, field.options, field.fieldName)) continue
      applyFieldFill({
        fieldId: field.id,
        fieldName: field.fieldName,
        fieldValue,
        valueJson: materialFill
          ? {
              material_composition_rule: materialFill,
              source: "MATERIAL_COMPOSITION_RULE",
            }
          : {
              ai_fill: aiFill,
              field_strategy: field.strategy,
              source: "AI_SUGGESTED",
            },
        sourceType: materialFill ? "source_rule" : "ai",
        sourceRef: null,
        source: materialFill ? "MATERIAL_COMPOSITION_RULE" : "AI_SUGGESTED",
        confidence,
      })
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
    rebuildProductArchiveDraftFields(db, draftId)
    return validateProductArchiveDraft(db, draftId)
  })()
  return { saved, detail: validated.detail, warnings }
}

function sizeChartTemplateFieldsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  return tradeFieldsForDraft(db, draft)
    .filter((field) => compactFieldKey(field.field_name).includes("尺码表"))
    .map((field) => ({
      fieldName: stringValue(field.field_name),
      options: arrayValue(field.options_json),
    }))
    .filter((field) => field.fieldName)
}

function buildSizeChartPreviewsForMappings(
  db: SyncPostgresDatabase,
  draft: JsonRecord,
  sourceRows: JsonRecord[],
  mappings: JsonRecord[],
) {
  const allowedSizes = productArchiveSizeChartAllowedSizes(sourceRows, mdmSkuRowsForSpu(db, stringValue(draft.spu_code)))
  return sizeChartTemplateFieldsForDraft(db, draft).map((template) => buildProductArchiveSizeChartFieldValue({
    fieldName: template.fieldName,
    spuCode: stringValue(draft.spu_code),
    sourceRows,
    templateOptions: template.options,
    mappings: mappings.filter((mapping) => stringValue(mapping.fieldName ?? mapping.field_name) === template.fieldName),
    allowedSizes,
  }))
}

function ruleBasedSizeChartRecommendation(db: SyncPostgresDatabase, draft: JsonRecord) {
  const sourceRows = sourceRowsForDraft(db, draft)
  const savedMappings = sizeChartMappingsForDraft(db, draft)
  const previews = buildSizeChartPreviewsForMappings(db, draft, sourceRows, savedMappings)
  return {
    previews,
    mappings: previews.flatMap((preview) => preview.mappings),
  }
}

function buildSizeChartAiRecommendationPrompt(input: {
  draft: JsonRecord
  ruleMappings: JsonRecord[]
  previews: JsonRecord[]
  sourceRows: JsonRecord[]
}) {
  return JSON.stringify({
    task: "为深绘尺码表字段推荐 PLM 测量点映射。高置信规则可以保留，中低置信或未命中字段需要给出保守建议，供人工审核。",
    output_schema: {
      mappings: [
        {
          fieldName: "深绘尺码表字段名，例如 尺码表/上衣尺码表/裤子尺码表",
          targetField: "深绘尺码表内字段，例如 袖口",
          sourcePoint: "PLM 测量点名称",
          confidence: "high/medium/low/manual/unmatched",
          reason: "一句中文理由",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "不能编造 PLM 测量点，只能从输入 measurement_points 中选择。",
      "领口/领围类字段证据不足时不要自动高置信匹配。",
      "低置信结果只作为人工审核建议。",
    ],
    product: {
      spu_code: input.draft.spu_code,
      trade_id: input.draft.trade_id,
      trade_path: input.draft.trade_path,
    },
    measurement_points: uniqueTextValues(input.sourceRows
      .filter((row) => stringValue(row.source_type) === "size_chart")
      .map((row) => recordValue(row.row_json).测量点)),
    rule_mappings: input.ruleMappings,
    generated_previews: input.previews.map((preview) => ({
      fieldName: preview.fieldName,
      valueJson: preview.valueJson,
      unmatchedTargets: preview.unmatchedTargets,
    })),
  }, null, 2)
}

async function callDeepdrawSizeChartAiRecommendation(
  db: SyncPostgresDatabase,
  prompt: string,
  options: AiFillOptions = {},
) {
  const input = JSON.parse(prompt) as JsonRecord
  const measurementPoints = new Set(arrayValue(input.measurement_points).map(stringValue).filter(Boolean))
  const fieldNames = new Set(
    arrayValue(input.generated_previews)
      .map((preview) => stringValue(recordValue(preview).fieldName))
      .filter(Boolean),
  )
  const messages = [
    {
      role: "system",
      content: "你是深绘商品尺码表字段映射专家，负责保守推荐 PLM 测量点到深绘尺码表字段的关系。",
    },
    { role: "user", content: prompt },
  ]
  const router = options.router ?? getDefaultAiScenarioRouter({
    db,
    fetchImpl: options.fetchImpl ?? fetch,
  })
  const response = await router.callJson(withAiRoutingHashes({
    scenario: "size_mapping",
    promptVersion: "deepdraw-size-mapping-v1",
    messages,
    validate: (json: { mappings?: unknown }) => (
      Array.isArray(json?.mappings)
      && json.mappings.every((mapping) => {
        if (!mapping || typeof mapping !== "object") return false
        const row = mapping as JsonRecord
        const fieldName = stringValue(row.fieldName ?? row.field_name)
        const sourcePoint = stringValue(row.sourcePoint ?? row.source_point)
        return Boolean(
          fieldName
          && (fieldNames.size === 0 || fieldNames.has(fieldName))
          && (!sourcePoint || measurementPoints.has(sourcePoint)),
        )
      })
    ),
    auditValue: (json: { mappings?: unknown }) => ({
      mappings: Array.isArray(json?.mappings)
        ? json.mappings.map((mapping) => {
          const row = mapping && typeof mapping === "object"
            ? mapping as JsonRecord
            : {}
          return {
            fieldName: stringValue(row.fieldName ?? row.field_name),
            targetField: stringValue(row.targetField ?? row.target_field),
            sourcePoint: stringValue(row.sourcePoint ?? row.source_point),
            confidence: stringValue(row.confidence),
          }
        })
        : [],
    }),
  }, {
    input: {
      product: input.product,
      rule_mappings: input.rule_mappings,
      generated_previews: input.generated_previews,
    },
    candidates: {
      measurement_points: input.measurement_points,
    },
  }))
  return Array.isArray(response.json.mappings)
    ? response.json.mappings as JsonRecord[]
    : []
}

function normalizeSizeChartMappingSuggestion(mapping: JsonRecord, fallbackSource = "rule_fallback") {
  const confidence = stringValue(mapping.confidence) || "manual"
  const source = stringValue(mapping.source) || fallbackSource
  return {
    fieldName: stringValue(mapping.fieldName ?? mapping.field_name),
    targetField: stringValue(mapping.targetField ?? mapping.target_field),
    sourcePoint: stringValue(mapping.sourcePoint ?? mapping.source_point) || null,
    confidence: ["high", "medium", "low", "manual", "unmatched"].includes(confidence) ? confidence : "manual",
    source: ["rule", "ai", "rule_fallback", "manual"].includes(source) ? source : fallbackSource,
    reason: stringValue(mapping.reason),
  }
}

export async function recommendProductArchiveSizeChartMappings(
  db: SyncPostgresDatabase,
  draftId: number,
  options: AiFillOptions = {},
) {
  const draft = draftById(db, draftId)
  const sourceRows = sourceRowsForDraft(db, draft)
  const ruleRecommendation = ruleBasedSizeChartRecommendation(db, draft)
  const ruleMappings = ruleRecommendation.mappings.map((mapping) => normalizeSizeChartMappingSuggestion(mapping, "rule"))
  const prompt = buildSizeChartAiRecommendationPrompt({
    draft,
    ruleMappings,
    previews: ruleRecommendation.previews,
    sourceRows,
  })
  const aiMappings = await callDeepdrawSizeChartAiRecommendation(db, prompt, options)
    .catch(() => [] as JsonRecord[])
  const mappings = aiMappings.length > 0
    ? aiMappings.map((mapping) => normalizeSizeChartMappingSuggestion({ ...mapping, source: "ai" }, "ai"))
    : ruleMappings.map((mapping) => ({ ...mapping, source: mapping.source === "rule" ? "rule_fallback" : mapping.source }))
  const previews = buildSizeChartPreviewsForMappings(db, draft, sourceRows, mappings)
  return {
    draftId,
    source: aiMappings.length > 0 ? "ai" : "rule_fallback",
    mappings,
    previews,
  }
}

export function saveProductArchiveSizeChartMappings(db: SyncPostgresDatabase, draftId: number, input: {
  mappings?: JsonRecord[]
  applyToDraft?: boolean
}) {
  const mappings = Array.isArray(input.mappings) ? input.mappings : []
  const now = nowIso()
  const saved: JsonRecord[] = []
  const validated = db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    const draft = draftById(db, draftId)
    const saveMapping = db.prepare(`
      insert into product_archive_size_chart_mapping (
        tenant_name,
        merchant_id,
        trade_id,
        field_name,
        target_field,
        source_point,
        confidence,
        source,
        review_status,
        evidence_json,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
      on conflict (tenant_name, merchant_id, trade_id, field_name, target_field)
      do update set
        source_point = excluded.source_point,
        confidence = excluded.confidence,
        source = excluded.source,
        review_status = excluded.review_status,
        evidence_json = excluded.evidence_json,
        updated_at = excluded.updated_at
    `)
    for (const rawMapping of mappings) {
      const mapping = normalizeSizeChartMappingSuggestion(rawMapping, "manual")
      if (!mapping.fieldName || !mapping.targetField) continue
      const reviewStatus = ["pending", "approved", "rejected"].includes(stringValue(rawMapping.reviewStatus ?? rawMapping.review_status))
        ? stringValue(rawMapping.reviewStatus ?? rawMapping.review_status)
        : "approved"
      saveMapping.run(
        draft.tenant_name,
        draft.merchant_id,
        draft.trade_id,
        mapping.fieldName,
        mapping.targetField,
        mapping.sourcePoint,
        mapping.confidence,
        mapping.source,
        reviewStatus,
        jsonText({
          reason: mapping.reason,
          saved_at: now,
        }),
        now,
      )
      saved.push({ ...mapping, reviewStatus })
    }
    if (!input.applyToDraft) return null
    rebuildProductArchiveDraftFields(db, draftId)
    return validateProductArchiveDraft(db, draftId)
  })()
  if (validated) return { draftId, saved, detail: validated.detail }
  return { draftId, saved }
}

function sizeChartAllowedSizes(_fields: JsonRecord[], skus: JsonRecord[]) {
  return draftSkuSizeValues(skus)
}

export function validateProductArchiveDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  options: { claimToken?: string | null; updatedAt?: string | null; allowExistingProduct?: boolean } = {},
) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId, { claimToken: options.claimToken })
    const draft = draftById(db, draftId)
    const draftSnapshot = recordValue(draft.source_snapshot_json)
    const snapshotSourceRows = arrayValue(draftSnapshot.sourceRows).map((row) => recordValue(row))
    const snapshotSpu = recordValue(draftSnapshot.spu)
    const validationShoeProduct = isShoeDraftContext({
      draft,
      spu: snapshotSpu,
      sourceRows: snapshotSourceRows,
    })
    const validationApparelProduct = !validationShoeProduct && isApparelProduct(snapshotSpu, snapshotSourceRows)
  const fields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const skus = db.prepare("select * from product_archive_draft_sku where draft_id = ?").all(draftId) as JsonRecord[]
  const templateLookup = fieldOptionsLookup(db, draft)
  const issues: Array<{ severity: string; issueType: string; fieldName?: string | null; skuCode?: string | null; message: string }> = []
  const now = timestampIsoValue(options.updatedAt) || nowIso()

  if (!stringValue(draft.spu_code)) issues.push({ severity: "blocker", issueType: "missing_spu_code", message: "缺少款号" })
  if (!stringValue(draft.title)) issues.push({ severity: "blocker", issueType: "missing_title", message: "缺少商品标题" })
  if (!stringValue(draft.trade_id)) issues.push({ severity: "blocker", issueType: "missing_trade_id", message: "缺少深绘类目" })
  if (stringValue(draft.trade_id) && templateLookup.size === 0) {
    issues.push({ severity: "blocker", issueType: "deepdraw_template_missing", message: "缺少深绘类目字段模板，请先同步字段" })
  }
  if (recordValue(draft.duplicate_result_json).duplicateFound === true && !options.allowExistingProduct) {
    issues.push({ severity: "blocker", issueType: "duplicate_product_found", message: "深绘已存在同货号商品，请使用更新已有商品" })
  }

  const updateField = db.prepare(`
    update product_archive_draft_field
    set validation_status = ?,
      validation_message = ?,
      updated_at = ?::timestamptz
    where id = ?
  `)
  for (const field of fields) {
    const fieldName = stringValue(field.field_name)
    const value = stringValue(field.value_text) || recordValue(field.value_json)
    const template = templateLookup.get(fieldName)
    const childRequirementActive = template
      ? templateChildRequirementActive({ rawPayload: template.rawPayload }, fields)
      : true
    const required = childRequirementActive && isProductArchiveFieldLocallyRequired(fieldName, {
      templateRequired: template?.required,
      templatePresent: Boolean(template),
      ruleBlocking: Boolean(field.blocking) || Boolean(field.required),
      sourceType: field.source_type,
      shoeProduct: validationShoeProduct,
      apparelProduct: validationApparelProduct,
    })
    const blocking = required
    const options = template?.options ?? []
    let status: string
    let message = ""
    if (stringValue(field.source_type) === "skip" && !blocking) {
      status = "skipped"
    } else if (blocking && !hasValue(value)) {
      status = "missing"
      message = "必填字段缺失"
      issues.push({ severity: "blocker", issueType: "required_field_missing", fieldName, message })
    } else if (options.length && hasValue(value)) {
      if (!productArchiveFieldValueMatchesOptions(value, options, fieldName)) {
        status = "invalid"
        message = productArchiveFieldOptionValidationMessage(value, options)
        issues.push({ severity: blocking ? "blocker" : "warning", issueType: "field_option_invalid", fieldName, message })
      } else {
        status = "valid"
      }
    } else {
      status = "valid"
    }
    updateField.run(status, message || null, now, field.id)
  }

  const colorOptions = Array.from(templateLookup.entries())
    .filter(([name]) => /颜色|色$|color/i.test(name))
    .flatMap(([, template]) => template.options.map(optionText).filter(Boolean))
  const sizeOptions = Array.from(templateLookup.entries())
    .filter(([name]) => isProductArchiveSkuSizeTemplateFieldName(name))
    .flatMap(([, template]) => productArchiveSkuSizeTemplateOptionTexts(template.options))
  const allowedColors = new Set(colorOptions)
  const allowedSizeKeys = sizeValueKeySet(sizeOptions)
  const allowedSizeChartSizes = sizeChartAllowedSizes(fields, skus)

  for (const field of fields) {
    const fieldName = stringValue(field.field_name)
    if (!isProductArchiveSkuSizeFieldName(fieldName)) continue
    if (!hasValue(field.value_text)) continue
    issues.push(...validateProductArchiveSkuSizeFieldValue({
      fieldName,
      valueText: field.value_text,
      skus,
    }))
  }

  for (const field of fields) {
    const fieldName = stringValue(field.field_name)
    if (!compactFieldKey(fieldName).includes("尺码表")) continue
    const template = templateLookup.get(fieldName)
    if (!isStructuredProductPayloadField({
      ...field,
      field_type: template?.fieldType,
    })) continue
    const childRequirementActive = template
      ? templateChildRequirementActive({ rawPayload: template.rawPayload }, fields)
      : true
    const blocking = childRequirementActive && isProductArchiveFieldLocallyRequired(fieldName, {
      templateRequired: template?.required,
      templatePresent: Boolean(template),
      ruleBlocking: Boolean(field.blocking) || Boolean(field.required),
      sourceType: field.source_type,
      shoeProduct: validationShoeProduct,
      apparelProduct: validationApparelProduct,
    })
    issues.push(...validateProductArchiveSizeChartValue({
      fieldName,
      valueJson: field.value_json,
      allowedSizes: allowedSizeChartSizes,
      blocking,
    }))
  }

  for (const sku of skus) {
    if (!stringValue(sku.color_name)) {
      issues.push({ severity: "blocker", issueType: "sku_color_missing", skuCode: stringValue(sku.sku_code), message: "SKU 缺少颜色" })
    } else if (allowedColors.size) {
      if (!productArchiveSkuColorMatchesOptions(sku, allowedColors, fields)) {
        issues.push({ severity: "blocker", issueType: "sku_color_not_in_template", skuCode: stringValue(sku.sku_code), message: "SKU 颜色不在深绘字段模板选项中" })
      }
    }
    if (!stringValue(sku.size_name)) {
      issues.push({ severity: "blocker", issueType: "sku_size_missing", skuCode: stringValue(sku.sku_code), message: "SKU 缺少尺码" })
    } else if (allowedSizeKeys.size) {
      const sizeCandidates = [
        stringValue(sku.size_name),
        stringValue(sku.size_code),
        deepdrawSizeValue(sku.size_name),
        deepdrawSizeValue(sku.size_code),
      ].filter(Boolean)
      if (!sizeCandidates.some((size) => sizeMatchKeys(size).some((key) => allowedSizeKeys.has(key)))) {
        issues.push({ severity: "blocker", issueType: "sku_size_not_in_template", skuCode: stringValue(sku.sku_code), message: "SKU 尺码不在深绘字段模板选项中" })
      }
    }
    const draftPrice = numberValue(draft.retail_price)
    const skuPrice = numberValue(sku.price)
    if (draftPrice !== null && skuPrice !== null && draftPrice !== skuPrice) {
      issues.push({ severity: "warning", issueType: "sku_price_mismatch", skuCode: stringValue(sku.sku_code), message: "SKU 价格与 SPU 吊牌价不一致" })
    }
  }

  const summary = {
    blocker_count: issues.filter((issue) => issue.severity === "blocker").length,
    warning_count: issues.filter((issue) => issue.severity === "warning").length,
    info_count: issues.filter((issue) => issue.severity === "info").length,
    validated_at: now,
  }
  const status = productArchiveDraftStatusFromValidationIssues(issues, fields)

  db.prepare("delete from product_archive_validation_issue where draft_id = ?").run(draftId)
  const insertIssue = db.prepare(`
    insert into product_archive_validation_issue(draft_id, severity, issue_type, field_name, sku_code, message)
    values (?, ?, ?, ?, ?, ?)
  `)
  for (const issue of issues) {
    insertIssue.run(draftId, issue.severity, issue.issueType, issue.fieldName ?? null, issue.skuCode ?? null, issue.message)
  }
  const draftUpdate = options.claimToken != null
    ? db.prepare(`
        update product_archive_draft
        set status = case when submit_claim_token is null then ? else status end,
          validation_summary_json = ?::jsonb,
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token = ?
      `).run(status, jsonText(summary), now, draftId, options.claimToken)
    : db.prepare(`
        update product_archive_draft
        set status = case when submit_claim_token is null then ? else status end,
          validation_summary_json = ?::jsonb,
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token is null
      `).run(status, jsonText(summary), now, draftId)
  if (Number(draftUpdate?.changes ?? 0) === 0) {
    throw new Error("草稿提交权已失效，请刷新后重试")
  }

  return { status, summary, issues, detail: serializeDraftDetail(db, draftId) }
  })()
}

export function isStructuredProductPayloadField(field: JsonRecord) {
  const key = compactFieldKey(field.field_name)
  const fieldType = stringValue(field.field_type).toUpperCase()
  if (key === "多平台尺码") return !fieldType || fieldType === "MULTI_TEXT"
  return fieldType === "MULTI_TEXT" && key.includes("尺码表")
}

function isUnsupportedAiFillField(fieldName: unknown) {
  if (/^尺码\s*[.。]$/.test(stringValue(fieldName))) return true
  const key = compactFieldKey(fieldName)
  if (isProductArchiveShoeAiEnumField(fieldName)) return false
  return key === "充绒量文本"
    || key === "多平台尺码"
    || key.includes("尺码表")
    || isProductArchiveSkuSizeFieldName(fieldName)
}

function isStaleUnsupportedAiFillField(fieldName: unknown, field: JsonRecord) {
  const sourceType = stringValue(field.source_type)
  return (isUnsupportedAiFillField(fieldName) || isProductArchiveOriginCountryField(fieldName))
    && (sourceType === "ai" || sourceType === "ai_rule_fallback")
}

function isStaleMaterialAiRuleFallbackField(fieldName: unknown, field: JsonRecord) {
  if (!/材质|面料/.test(stringValue(fieldName))) return false
  if (stringValue(field.source_type) !== "ai_rule_fallback") return false
  const metadata = recordValue(field.value_json)
  return stringValue(metadata.source) === "AI_RULE_FALLBACK" || recordValue(metadata.ai_fill).fallback === true
}

function isStaleSizeChartScalarOverride(fieldName: unknown, field: JsonRecord) {
  const key = compactFieldKey(fieldName)
  return key.includes("尺码表")
    && !hasValue(recordValue(field.value_json))
    && hasValue(stringValue(field.value_text))
}

function isProductArchiveAgeFieldName(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "年龄"
    || key === "年龄段"
    || key.includes("适用年龄")
    || key.includes("适合年龄段")
}

function isStaleSourceDerivedAgeAiFillField(
  fieldName: unknown,
  field: JsonRecord,
  sourceValueText: string,
  options: unknown[],
) {
  if (!isProductArchiveAgeFieldName(fieldName)) return false
  const sourceType = stringValue(field.source_type)
  if (sourceType !== "ai" && sourceType !== "ai_rule_fallback") return false
  const sourceValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, sourceValueText, options)
  if (!sourceValue) return false
  const existingValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, stringValue(field.value_text), options)
  return sourceValue !== existingValue
}

function isStaleSourceDerivedShoeAgeManualField(
  fieldName: unknown,
  field: JsonRecord,
  legacySourceValueText: string,
  shoeSourceValueText: string,
  options: unknown[],
) {
  if (!isProductArchiveAgeFieldName(fieldName)) return false
  if (!shoeSourceValueText) return false
  if (stringValue(field.source_type) !== "manual") return false
  const shoeValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, shoeSourceValueText, options)
  if (!shoeValue) return false
  const existingValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, stringValue(field.value_text), options)
  if (!existingValue || existingValue === shoeValue) return false
  const legacyValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, legacySourceValueText, options)
  return Boolean(legacyValue) && existingValue === legacyValue
}

function aiFillFieldSnapshot(field: JsonRecord) {
  const updatedAt = field.updated_at == null
    ? null
    : field.updated_at instanceof Date
      ? field.updated_at.toISOString()
      : String(field.updated_at)
  return {
    fieldName: stringValue(field.field_name),
    fieldId: field.field_id == null ? null : stringValue(field.field_id) || null,
    sourceType: field.source_type == null ? null : stringValue(field.source_type) || null,
    sourceRef: field.source_ref == null ? null : stringValue(field.source_ref) || null,
    valueText: field.value_text == null ? null : String(field.value_text),
    valueJson: recordValue(field.value_json),
    required: Boolean(field.required),
    blocking: Boolean(field.blocking),
    manualOverride: Boolean(field.manual_override),
    validationStatus: field.validation_status == null ? null : stringValue(field.validation_status) || null,
    validationMessage: field.validation_message == null ? null : stringValue(field.validation_message) || null,
    updatedAt,
  }
}

export function productArchivePayloadFieldValue(field: JsonRecord, options: {
  includeOptionalStructuredSizeFields?: boolean
} = {}) {
  const jsonValue = recordValue(field.value_json)
  if (isProductArchiveStructuredSizeFieldName(field.field_name)) {
    const fieldType = stringValue(field.field_type).toUpperCase()
    if (
      fieldType === "MULTI_TEXT"
      && !field.required
      && !field.blocking
      && !options.includeOptionalStructuredSizeFields
    ) return null
    if (hasProductArchiveSizeChartTableValue(jsonValue)) {
      if (!isStructuredProductPayloadField(field)) return null
      const cleanedValue = cleanProductArchiveSizeChartTableValue(jsonValue)
      return hasProductArchiveSizeChartTableValue(cleanedValue) ? cleanedValue : null
    }
    if (!fieldType || fieldType === "MULTI_TEXT") return null
  }
  const text = stringValue(field.value_text)
  if (text) {
    const optionsJson = arrayValue(field.options_json)
    const normalized = normalizeProductArchiveTemplateFieldValue(
      stringValue(field.template_field_name) || stringValue(field.field_name),
      text,
      optionsJson,
    )
    return normalized || (optionsJson.length ? null : text)
  }
  return hasValue(jsonValue) ? jsonValue : null
}

export function shouldIncludeProductArchivePayloadField(field: JsonRecord) {
  const required = Boolean(field.required)
  const blocking = Boolean(field.blocking)
  if (stringValue(field.source_type) === "skip" && !required && !blocking) return false
  if (stringValue(field.validation_status) === "invalid" && !required && !blocking) return false
  return true
}

export function productArchivePayloadTemplateFieldId(field: JsonRecord) {
  return stringValue(field.template_field_id)
}

export type ProductArchiveSubmitDiagnostics = {
  omittedTemplateFieldCount: number
  omittedTemplateFieldNames: string[]
  issues: string[]
}

const PRODUCT_ARCHIVE_SUBMIT_DIAGNOSTICS_KEY = "__productArchiveSubmitDiagnostics"

function uniqueLimitedText(values: unknown[], limit: number) {
  return uniqueTextValues(values).slice(0, limit)
}

function attachProductArchiveSubmitDiagnostics(payload: JsonRecord, diagnostics: ProductArchiveSubmitDiagnostics) {
  Object.defineProperty(payload, PRODUCT_ARCHIVE_SUBMIT_DIAGNOSTICS_KEY, {
    configurable: true,
    enumerable: false,
    value: diagnostics,
  })
  return payload
}

function productArchiveSubmitDiagnostics(payload: unknown): ProductArchiveSubmitDiagnostics {
  const record = recordValue(payload)
  return recordValue(record[PRODUCT_ARCHIVE_SUBMIT_DIAGNOSTICS_KEY]) as ProductArchiveSubmitDiagnostics
}

function dateLooksLikeDeepdrawPayloadDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(stringValue(value))
}

export function productArchivePayloadValidationIssues(payload: JsonRecord) {
  const issues: string[] = []
  const date = stringValue(payload.date)
  if (!dateLooksLikeDeepdrawPayloadDate(date)) {
    issues.push(`上市日期格式异常：${date || "空"}，请检查上市计划的内容上市时间/搜索上市时间`)
  }
  const fields = arrayValue(
    Array.isArray((payload as JsonRecord).legacyUpdateFields)
      ? (payload as JsonRecord).legacyUpdateFields
      : payload.fields,
  ).map((field) => recordValue(field))
  const saleSizeValue = stringValue(fields.find((field) => isProductArchiveSkuSizeFieldName(field.name) && typeof field.value === "string")?.value)
  const saleSizes = new Set(saleSizeValue.split(/[;；]/).map((size) => size.trim()).filter(Boolean))
  if (saleSizes.size > 0) {
    const saleSizeKeys = sizeValueKeySet([...saleSizes])
    for (const field of fields) {
      const fieldName = stringValue(field.name)
      if (!isProductArchiveStructuredSizeFieldName(fieldName) && compactFieldKey(fieldName) !== compactFieldKey("商家SKU")) continue
      const value = recordValue(field.value)
      const keys = compactFieldKey(fieldName) === compactFieldKey("商家SKU")
        ? Object.values(value).flatMap((sizeRows) => Object.keys(recordValue(sizeRows)))
        : Object.keys(value).filter((key) => key !== "title")
      const unexpected = keys.filter((key) => !sizeMatchKeys(key).some((matchKey) => saleSizeKeys.has(matchKey))).slice(0, 5)
      if (unexpected.length > 0) {
        issues.push(`${fieldName} 尺码键与销售尺码不一致：${unexpected.join("、")}`)
      }
    }
  }
  return issues
}

export function productArchiveFailureReasonWithDiagnostics(reason: string, diagnostics: ProductArchiveSubmitDiagnostics) {
  const omittedNames = diagnostics.omittedTemplateFieldNames.join("、")
  const omittedSuffix = diagnostics.omittedTemplateFieldCount > diagnostics.omittedTemplateFieldNames.length ? " 等" : ""
  const details = [
    ...diagnostics.issues,
    diagnostics.omittedTemplateFieldCount > 0
      ? `已在提交前忽略 ${diagnostics.omittedTemplateFieldCount} 个不属于当前深绘类目的字段：${omittedNames}${omittedSuffix}`
      : "",
  ].filter(Boolean)
  if (details.length === 0) return reason
  return `${reason || "深绘返回失败"}；${details.join("；")}`
}

function productPayload(db: SyncPostgresDatabase, draftId: number) {
  const detail = serializeDraftDetail(db, draftId)
  const draft = detail.draft as JsonRecord
  const spu = resolveProductArchiveDraftSpu(db, draft)
  const sourceRows = sourceRowsForDraft(db, draft)
  const shoeProduct = isShoeProduct(spu, sourceRows)
  const omittedTemplateFieldNames: string[] = []
  const detailFields = detail.fields as JsonRecord[]
  const payloadFieldsFromDetail = (includeOptionalStructuredSizeFields = false) => detailFields
    .filter(shouldIncludeProductArchivePayloadField)
    .flatMap((field) => {
      if (isProductArchiveMultiPlatformSizeFieldName(field.field_name)) return []
      const value = productArchivePayloadFieldValue(field, { includeOptionalStructuredSizeFields })
      if (!hasValue(value)) return []
      const templateFieldId = productArchivePayloadTemplateFieldId(field)
      if (!templateFieldId) {
        if (!includeOptionalStructuredSizeFields) omittedTemplateFieldNames.push(stringValue(field.field_name))
        return []
      }
      return [{
        id: templateFieldId,
        name: stringValue(field.template_field_name) || stringValue(field.field_name),
        fieldType: stringValue(field.field_type) || undefined,
        options: arrayValue(field.options_json),
        templatePlatform: stringValue(field.template_third_platform) || undefined,
        value,
      }]
    })
    .filter((field) => hasValue(field.value))
  const fields = payloadFieldsFromDetail(false)
  const allFields = shoeProduct ? payloadFieldsFromDetail(true) : fields
  const saleSizeValueText = stringValue(fields.find((field) => (
    isProductArchiveSkuSizeFieldName(field.name)
    && typeof field.value === "string"
  ))?.value)
  const alignedFields = saleSizeValueText
    ? fields.map((field) => ({
        ...field,
        value: alignProductArchivePayloadSizeFieldValue(field.name, field.value, saleSizeValueText),
      }))
    : fields
  const alignedAllFields = saleSizeValueText
    ? allFields.map((field) => ({
        ...field,
        value: alignProductArchivePayloadSizeFieldValue(field.name, field.value, saleSizeValueText),
      }))
    : allFields
  const legacyUpdateFields = shoeProduct
    ? selectDeepdrawLegacyShoeUpdateFields(alignedAllFields)
    : alignedFields
  const createFields = shoeProduct
    ? selectDeepdrawLegacyShoeCreateFields(alignedAllFields)
    : alignedFields
  const compatiblePlatforms = stringValue(detailFields.find((field) => (
    stringValue(field.field_name) === "兼容平台"
  ))?.value_text)
  const persistedSandalClassification = stringValue(detailFields.find((field) => (
    stringValue(field.field_name) === "25鞋子尺码表"
  ))?.value_text) || stringValue(recordValue(draft.source_snapshot_json).shoeSandalClassification)
  const shoeMatch = shoeProduct ? resolveShoeSizeChartMatch({
    tradeId: draft.trade_id,
    tradePath: draft.trade_path,
    productLineName: spu.product_line_name,
    subclassName: spu.subclass_name,
    sandalClassification: persistedSandalClassification,
  }) : null
  const sizeRemarks = shoeProduct && shoeMatch?.status === "matched"
    ? buildShoeSizeRemarks({
        rows: loadShoeSizeChartRows(db, shoeMatch.chartCode),
        skuSizes: (detail.skus as JsonRecord[]).map((sku) => sku.size_name),
      })
    : {}
  const payload = {
    code: stringValue(draft.spu_code),
    title: stringValue(draft.title),
    tradeId: stringValue(draft.trade_id),
    retailPrice: numberValue(draft.retail_price),
    date: buildProductArchivePayloadDate(sourceRows, detailFields),
    ...(compatiblePlatforms ? { places: compatiblePlatforms } : {}),
    ...(shoeProduct ? {
      shoeSizes: true,
      sizeRemarks,
      legacyUpdateFields,
      postCreateUpdateRequired: deepdrawLegacyShoePostCreateUpdateRequired(createFields, legacyUpdateFields),
    } : {}),
    fields: createFields,
    skus: (detail.skus as JsonRecord[]).map((sku) => ({
      skuCode: stringValue(sku.sku_code),
      skcCode: stringValue(sku.skc_code),
      color: stringValue(sku.color_name),
      size: stringValue(sku.size_name),
      barcode: stringValue(sku.barcode),
      sellerCode: stringValue(sku.seller_code),
      price: numberValue(sku.price),
    })),
  }
  return attachProductArchiveSubmitDiagnostics(payload, {
    omittedTemplateFieldCount: omittedTemplateFieldNames.length,
    omittedTemplateFieldNames: uniqueLimitedText(omittedTemplateFieldNames, 12),
    issues: productArchivePayloadValidationIssues(payload),
  })
}

function deepdrawBusinessResult(payload: unknown) {
  const top = recordValue(payload)
  const nested = top.response && typeof top.response === "object" && !Array.isArray(top.response)
    ? recordValue(top.response)
    : {}
  const nestedBody = recordValue(nested.body)
  const topBody = recordValue(top.body)
  return {
    status: numberValue(top.status),
    code: numberValue(nested.code ?? top.code ?? top.responseCode),
    state: stringValue(nested.response ?? top.response).toLowerCase(),
    reason: stringValue(nested.reason ?? nested.message ?? top.reason ?? top.message),
    requestId: stringValue(nested.requestId ?? top.requestId),
    body: hasValue(nestedBody) ? nestedBody : topBody,
  }
}

function writeSubmitLog(
  db: SyncPostgresDatabase,
  draftId: number,
  operation: "search" | "create" | "update" | "resource" | "dry_run",
  result: Partial<DeepdrawResult> & {
    requestSummary?: unknown
    productId?: string | null
    responseReason?: string | null
    submitDiagnostics?: ProductArchiveSubmitDiagnostics
  } = {},
) {
  const payload = recordValue(result.payload)
  const business = deepdrawBusinessResult(payload)
  const baseReason = (result.responseReason ?? business.reason) || null
  const responseReason = result.submitDiagnostics
    ? productArchiveFailureReasonWithDiagnostics(baseReason, result.submitDiagnostics)
    : baseReason
  db.prepare(`
    insert into product_archive_submit_log (
      draft_id,
      operation,
      request_summary_json,
      http_status,
      response_code,
      response_reason,
      request_id,
      product_id,
      raw_response_json
    )
    values (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?::jsonb)
  `).run(
    draftId,
    operation,
    jsonText(result.requestSummary ?? {}),
    result.status ?? null,
    stringValue(business.code) || null,
    responseReason,
    (result.requestId ?? business.requestId) || null,
    result.productId ?? (stringValue(business.body.productId) || null),
    jsonText(sanitizeDeepdrawLogPayload(payload)),
  )
}

export function recordProductArchiveSubmitTransportUnknown(
  db: SyncPostgresDatabase,
  input: {
    draftId: number
    claimToken: string
    requestSummary: unknown
    message: string
    operation?: "create" | "update"
  },
) {
  db.transaction(() => {
    writeSubmitLog(db, input.draftId, input.operation ?? "create", {
      requestSummary: input.requestSummary,
      responseReason: input.message,
    })
    db.prepare(`
      update product_archive_draft
      set duplicate_result_json = jsonb_set(coalesce(duplicate_result_json, '{}'::jsonb), '{submit_transport_unknown}', to_jsonb(?::text), true),
        updated_at = ?::timestamptz
      where id = ?
        and submit_claim_token = ?
    `).run(input.message, nowIso(), input.draftId, input.claimToken)
  })()
}

function assertDeepdrawProductArchiveSuccess(
  result: DeepdrawResult,
  type: string,
  submitDiagnostics?: ProductArchiveSubmitDiagnostics,
) {
  const payload = recordValue(result.payload)
  const business = deepdrawBusinessResult(payload)
  const outerStatus = business.status ?? numberValue(result.status)
  const responseCode = business.code
  const responseState = business.state
  if (
    !result.ok
    || (outerStatus !== null && outerStatus !== 200)
    || (responseCode !== null && responseCode !== 10200)
    || (responseState && responseState !== "success")
  ) {
    const reason = productArchiveFailureReasonWithDiagnostics(
      business.reason || stringValue(result.status),
      submitDiagnostics ?? { omittedTemplateFieldCount: 0, omittedTemplateFieldNames: [], issues: [] },
    )
    throw new Error(`DeepDraw ${type} failed: ${reason}`)
  }
}

function isDeepdrawProductNotFound(payload: unknown) {
  const business = deepdrawBusinessResult(payload)
  if (business.code === 10404) return true
  const reason = business.reason.trim()
  const productReference = /商品|产品|product(?:\s*code)?|spu(?:\s*code)?/i.test(reason)
  const nonProductReference = /商户|租户|字段|merchant|tenant|field/i.test(reason)
  return productReference
    && !nonProductReference
    && /未在服务器上发现|不存在|未找到|not\s*found/i.test(reason)
}

function duplicateRecords(payload: unknown) {
  const body = deepdrawBusinessResult(payload).body
  const candidates = [
    body.records,
    body.list,
    body.items,
    body.products,
    recordValue(body.page).records,
  ]
  for (const candidate of candidates) {
    const array = arrayValue(candidate)
    if (array.length) return array
  }
  if (hasValue(body) && (
    stringValue(body.productId)
    || stringValue(body.id)
    || stringValue(body.productCode)
    || stringValue(body.code)
    || stringValue(body.title)
  )) {
    return [body]
  }
  return []
}

export const DEEPDRAW_DUPLICATE_RATE_LIMIT_CACHE_MAX_AGE_MS = 45 * 60 * 1000

function isDeepdrawDuplicateSearchRateLimited(payload: unknown) {
  const business = deepdrawBusinessResult(payload)
  return business.code === 10494
    && /访问频率过高|too\s+many\s+requests|rate\s*limit/i.test(business.reason)
}

export function resolveDeepdrawDuplicateRateLimitCache(
  draft: JsonRecord,
  rateLimitedPayload: unknown,
  nowMs = Date.now(),
) {
  if (!isDeepdrawDuplicateSearchRateLimited(rateLimitedPayload)) return null

  const cached = recordValue(draft.duplicate_result_json)
  if (typeof cached.duplicateFound !== "boolean") return null
  const checkedAt = stringValue(cached.checkedAt)
  const checkedAtMs = Date.parse(checkedAt)
  const ageMs = nowMs - checkedAtMs
  if (!Number.isFinite(checkedAtMs) || ageMs < 0 || ageMs > DEEPDRAW_DUPLICATE_RATE_LIMIT_CACHE_MAX_AGE_MS) {
    return null
  }

  const spuCode = stringValue(draft.spu_code)
  const records = arrayValue(cached.records).map(recordValue)
  if (cached.duplicateFound) {
    const exactRecords = records.filter((record) => (
      stringValue(record.code ?? record.productCode ?? record.product_code ?? record.spuCode ?? record.spu_code) === spuCode
    ))
    if (exactRecords.length !== 1) return null
  } else if (records.length > 0) {
    return null
  }

  const business = deepdrawBusinessResult(rateLimitedPayload)
  return {
    duplicateFound: cached.duplicateFound,
    records,
    checkedAt,
    requestId: stringValue(cached.requestId) || null,
    cacheFallback: {
      usedAt: new Date(nowMs).toISOString(),
      ageMs,
      responseCode: business.code,
      responseReason: business.reason,
    },
  }
}

export function resolveDeepdrawDuplicateProductForUpdate(summary: unknown, spuCode: unknown) {
  const targetCode = stringValue(spuCode)
  const records = arrayValue(recordValue(summary).records).map(recordValue)
  const exactRecords = records.filter((record) => (
    stringValue(record.code ?? record.productCode ?? record.product_code ?? record.spuCode ?? record.spu_code) === targetCode
  ))
  if (exactRecords.length !== 1) {
    throw new Error(`深绘查重结果无法唯一定位款号 ${targetCode}，已停止更新`)
  }
  const record = exactRecords[0]
  const displayProductId = stringValue(record.productId ?? record.product_id)
  if (!/^\d+$/.test(displayProductId)) {
    throw new Error(`深绘查重结果缺少款号 ${targetCode} 的数值产品 ID，已停止更新`)
  }
  return {
    record,
    updateProductId: displayProductId,
    internalProductId: stringValue(record.id) || null,
    displayProductId,
  }
}

export async function checkDuplicateProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const draft = draftById(db, draftId)
  const runSearch = options.search ?? (async () => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await getDeepdrawProduct({
      config,
      productCode: stringValue(draft.spu_code),
      resource: "form",
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  const result = await runSearch()
  const productNotFound = isDeepdrawProductNotFound(result.payload)
  const cachedSummary = !productNotFound && options.claimToken
    ? resolveDeepdrawDuplicateRateLimitCache(draft, result.payload)
    : null
  if (!productNotFound && !cachedSummary) assertDeepdrawProductArchiveSuccess(result, "search")
  const records = cachedSummary?.records ?? (productNotFound ? [] : duplicateRecords(result.payload))
  const duplicateFound = cachedSummary?.duplicateFound ?? records.length > 0
  const summary = cachedSummary ?? {
    duplicateFound,
    records,
    checkedAt: nowIso(),
    requestId: result.requestId ?? null,
  }
  db.transaction(() => {
    const update = options.claimToken && duplicateFound && options.updateExisting
      ? db.prepare(`
          update product_archive_draft
          set duplicate_result_json = ?::jsonb,
            updated_at = ?::timestamptz
          where id = ?
            and submit_claim_token = ?
          returning id
        `).get(
          jsonText(sanitizeDeepdrawLogPayload(summary)),
          nowIso(),
          draftId,
          options.claimToken,
        )
      : options.claimToken
      ? db.prepare(`
          update product_archive_draft
          set status = case when ? then 'duplicate_found' else status end,
            submit_claim_token = case when ? then null else submit_claim_token end,
            duplicate_result_json = ?::jsonb,
            updated_at = ?::timestamptz
          where id = ?
            and submit_claim_token = ?
          returning id
        `).get(
          duplicateFound,
          duplicateFound,
          jsonText(sanitizeDeepdrawLogPayload(summary)),
          nowIso(),
          draftId,
          options.claimToken,
        )
      : db.prepare(`
          update product_archive_draft
          set status = case when ? then 'duplicate_found' else status end,
            duplicate_result_json = ?::jsonb,
            updated_at = ?::timestamptz
          where id = ?
            and submit_claim_token is null
          returning id
        `).get(duplicateFound, jsonText(sanitizeDeepdrawLogPayload(summary)), nowIso(), draftId)
    if (!update) throw new Error("草稿提交权已失效，请刷新后重试")
    writeSubmitLog(db, draftId, "search", {
      ...result,
      requestSummary: {
        spuCode: draft.spu_code,
        tenantName: draft.tenant_name,
        ...(cachedSummary ? {
          duplicateCacheFallback: true,
          duplicateCacheCheckedAt: cachedSummary.checkedAt,
          duplicateCacheAgeMs: cachedSummary.cacheFallback.ageMs,
        } : {}),
      },
    })
  })()
  return summary
}

/** Atomically reserves a draft for the remote create call.
 *
 * A transport timeout leaves the row in `submitting`, which is intentionally
 * outside the claimable statuses so a retry cannot blindly create a duplicate.
 */
export function claimProductArchiveDraftForSubmit(
  db: SyncPostgresDatabase,
  draftId: number,
  now = nowIso(),
  claimToken = randomUUID(),
  options: { updateExisting?: boolean } = {},
) {
  const claimableStatuses = options.updateExisting
    ? "('draft', 'missing_fields', 'manual_review', 'ready', 'update_pending', 'duplicate_found')"
    : "('draft', 'missing_fields', 'manual_review', 'ready', 'update_pending')"
  return db.prepare(`
    with previous as (
      select id, status as submit_claim_previous_status
      from product_archive_draft
      where id = $3
        and submit_claim_token is null
        and status in ${claimableStatuses}
      for update
    )
    update product_archive_draft
    set status = 'submitting',
      submit_claim_token = ?,
      updated_at = ?::timestamptz
    from previous
    where product_archive_draft.id = previous.id
      and product_archive_draft.submit_claim_token is null
      and product_archive_draft.status in ${claimableStatuses}
    returning product_archive_draft.*, previous.submit_claim_previous_status
  `).get(claimToken, now, draftId) as JsonRecord | undefined
}

const PRODUCT_ARCHIVE_SUBMIT_CLAIMABLE_STATUSES = new Set([
  "draft",
  "missing_fields",
  "manual_review",
  "ready",
  "update_pending",
  "duplicate_found",
])

function restoreProductArchiveDraftAfterSubmitPreparationFailure(
  db: SyncPostgresDatabase,
  draftId: number,
  claimToken: string,
  previousStatusValue: unknown,
) {
  const previousStatus = stringValue(previousStatusValue)
  // A missing or unexpected previous status must not silently turn a claimed
  // row into a claimable `ready` draft. The claim remains fenced for manual
  // reconciliation in that impossible/malformed adapter case.
  if (!PRODUCT_ARCHIVE_SUBMIT_CLAIMABLE_STATUSES.has(previousStatus)) return false
  const result = db.prepare(`
    update product_archive_draft
    set status = ?,
      submit_claim_token = null,
      updated_at = ?::timestamptz
    where id = ?
      and submit_claim_token = ?
  `).run(previousStatus, nowIso(), draftId, claimToken)
  return Number(result?.changes ?? 0) > 0
}

function prepareProductArchiveDraftDryRun(db: SyncPostgresDatabase, draftId: number) {
  return db.transaction(() => {
    assertProductArchiveDraftMutable(db, draftId)
    refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
    rebuildProductArchiveDraftFields(db, draftId)
    validateProductArchiveDraft(db, draftId)
    return productPayload(db, draftId)
  })()
}

export async function submitProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  if (options.dryRun) {
    const currentDraft = draftById(db, draftId)
    if (currentDraft.submit_claim_token) throw new Error("草稿正在提交，暂不能生成新预览")
    const payload = prepareProductArchiveDraftDryRun(db, draftId)
    const submitDiagnostics = productArchiveSubmitDiagnostics(payload)
    const summary = {
      fieldCount: payload.fields.length,
      legacyUpdateFieldCount: arrayValue((payload as JsonRecord).legacyUpdateFields).length,
      skuCount: payload.skus.length,
      omittedTemplateFieldCount: submitDiagnostics.omittedTemplateFieldCount,
      omittedTemplateFields: submitDiagnostics.omittedTemplateFieldNames,
      payloadIssues: submitDiagnostics.issues,
    }
    writeSubmitLog(db, draftId, "dry_run", { requestSummary: summary, status: 200, payload: { dryRun: true } })
    return { dryRun: true, payload, summary }
  }

  const claimedDraft = claimProductArchiveDraftForSubmit(
    db,
    draftId,
    undefined,
    undefined,
    { updateExisting: Boolean(options.updateExisting) },
  )
  if (!claimedDraft) {
    const currentDraft = draftById(db, draftId)
    const currentClaimToken = stringValue(currentDraft?.submit_claim_token)
    if (currentClaimToken && stringValue(currentDraft?.status) === "created") {
      return await readbackProductArchiveDraft(db, draftId, { ...options, claimToken: currentClaimToken })
    }
    return {
      alreadySubmitting: Boolean(currentClaimToken) || stringValue(currentDraft?.status) === "submitting",
      status: stringValue(currentDraft?.status),
      draftId,
    }
  }
  const claimToken = stringValue(claimedDraft.submit_claim_token)
  let validation: ReturnType<typeof validateProductArchiveDraft>
  let payload: ReturnType<typeof productPayload>
  try {
    const prepared = db.transaction(() => {
      assertProductArchiveDraftMutable(db, draftId, { claimToken })
      refreshDraftTradeSelectionFromLaunchPlan(db, draftId, { claimToken })
      rebuildProductArchiveDraftFields(db, draftId)
      const nextValidation = validateProductArchiveDraft(db, draftId, {
        claimToken,
        allowExistingProduct: Boolean(options.updateExisting),
      })
      const nextPayload = productPayload(db, draftId)
      return { validation: nextValidation, payload: nextPayload }
    })()
    validation = prepared.validation
    payload = prepared.payload
  } catch (error) {
    restoreProductArchiveDraftAfterSubmitPreparationFailure(
      db,
      draftId,
      claimToken,
      claimedDraft.submit_claim_previous_status,
    )
    throw error
  }
  const submitDiagnostics = productArchiveSubmitDiagnostics(payload)
  const summary = {
    fieldCount: payload.fields.length,
    legacyUpdateFieldCount: arrayValue((payload as JsonRecord).legacyUpdateFields).length,
    skuCount: payload.skus.length,
    omittedTemplateFieldCount: submitDiagnostics.omittedTemplateFieldCount,
    omittedTemplateFields: submitDiagnostics.omittedTemplateFieldNames,
    payloadIssues: submitDiagnostics.issues,
  }
  if (validation.summary.blocker_count > 0) {
    db.prepare(`
      update product_archive_draft
      set status = ?,
        submit_claim_token = null,
        updated_at = ?::timestamptz
      where id = ?
        and submit_claim_token = ?
    `).run(validation.status, nowIso(), draftId, claimToken)
    throw new Error("草稿存在阻断问题，不能提交")
  }
  let duplicate
  try {
    duplicate = await checkDuplicateProductArchiveDraft(db, draftId, { ...options, claimToken })
  } catch (error) {
    restoreProductArchiveDraftAfterSubmitPreparationFailure(
      db,
      draftId,
      claimToken,
      claimedDraft.submit_claim_previous_status,
    )
    throw error
  }
  if (duplicate.duplicateFound && !options.updateExisting) return { duplicateFound: true, duplicate }
  if (options.updateExisting && !duplicate.duplicateFound) {
    db.prepare(`
      update product_archive_draft
      set status = 'ready',
        submit_claim_token = null,
        updated_at = ?::timestamptz
      where id = ?
        and submit_claim_token = ?
    `).run(nowIso(), draftId, claimToken)
    throw new Error("深绘已有商品已不存在，请刷新查重结果后按新建流程发布")
  }

  const draft = draftById(db, draftId)
  const runUpdate = options.update ?? (async (requestPayload: JsonRecord, productId: string) => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await updateDeepdrawProduct({
      config,
      payload: requestPayload,
      productId,
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  const runAndRecordLegacyUpdate = async (productId: string, updateMode: "existing" | "post_create") => {
    if (!/^\d+$/.test(productId)) {
      const updateError = new Error("DeepDraw update failed: 创建结果缺少数值产品 ID，无法补写平台尺码表")
      db.transaction(() => {
        writeSubmitLog(db, draftId, "update", {
          requestSummary: { ...summary, updateMode },
          responseReason: updateError.message,
          productId: productId || null,
        })
        db.prepare(`
          update product_archive_draft
          set status = 'failed',
            submit_claim_token = null,
            updated_at = ?::timestamptz
          where id = ?
            and submit_claim_token = ?
        `).run(nowIso(), draftId, claimToken)
      })()
      throw updateError
    }

    let result: DeepdrawResult
    try {
      result = await runUpdate(payload, productId)
    } catch (error) {
      const updateError = error instanceof Error ? error : new Error(String(error))
      recordProductArchiveSubmitTransportUnknown(db, {
        draftId,
        claimToken,
        requestSummary: { ...summary, updateMode },
        message: updateError.message,
        operation: "update",
      })
      throw updateError
    }
    const body = deepdrawBusinessResult(result.payload).body
    let updateError: Error | null = null
    try {
      assertDeepdrawProductArchiveSuccess(result, "update", submitDiagnostics)
    } catch (error) {
      updateError = error instanceof Error ? error : new Error(String(error))
    }
    db.transaction(() => {
      writeSubmitLog(db, draftId, "update", {
        ...result,
        requestSummary: { ...summary, updateMode },
        productId,
        submitDiagnostics,
      })
      db.prepare(`
        update product_archive_draft
        set status = ?,
          created_product_id = ?,
          created_product_code = ?,
          submit_claim_token = case when ? then null else submit_claim_token end,
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token = ?
      `).run(
        updateError ? "failed" : "created",
        productId || stringValue(body.id) || null,
        stringValue(draft.spu_code),
        Boolean(updateError),
        nowIso(),
        draftId,
        claimToken,
      )
    })()
    if (updateError) throw updateError
    return result
  }

  if (options.updateExisting) {
    let existing: ReturnType<typeof resolveDeepdrawDuplicateProductForUpdate>
    try {
      existing = resolveDeepdrawDuplicateProductForUpdate(duplicate, draft.spu_code)
    } catch (error) {
      restoreProductArchiveDraftAfterSubmitPreparationFailure(
        db,
        draftId,
        claimToken,
        claimedDraft.submit_claim_previous_status,
      )
      throw error
    }
    await runAndRecordLegacyUpdate(existing.updateProductId, "existing")
    return await readbackProductArchiveDraft(db, draftId, { ...options, claimToken })
  }

  const runCreate = options.create ?? (async (requestPayload: JsonRecord) => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await createDeepdrawProduct({
      config,
      payload: requestPayload,
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  let result: DeepdrawResult
  try {
    result = await runCreate(payload)
  } catch (error) {
    const createError = error instanceof Error ? error : new Error(String(error))
    recordProductArchiveSubmitTransportUnknown(db, {
      draftId,
      claimToken,
      requestSummary: summary,
      message: createError.message,
    })
    throw createError
  }
  const body = deepdrawBusinessResult(result.payload).body
  const productId = stringValue(body.productId ?? body.id)
  let createError: Error | null = null
  try {
    assertDeepdrawProductArchiveSuccess(result, "create", submitDiagnostics)
  } catch (error) {
    createError = error instanceof Error ? error : new Error(String(error))
  }
  db.transaction(() => {
    writeSubmitLog(db, draftId, "create", { ...result, requestSummary: summary, productId, submitDiagnostics })
    db.prepare(`
      update product_archive_draft
      set status = ?,
        created_product_id = ?,
        created_product_code = ?,
        submit_claim_token = case when ? then null else submit_claim_token end,
        updated_at = ?::timestamptz
      where id = ?
        and submit_claim_token = ?
    `).run(
      createError ? "failed" : "created",
      productId || null,
      stringValue(body.code) || stringValue(payload.code),
      Boolean(createError),
      nowIso(),
      draftId,
      claimToken,
    )
  })()
  if (createError) throw createError
  if ((payload as JsonRecord).shoeSizes && (payload as JsonRecord).postCreateUpdateRequired) {
    await runAndRecordLegacyUpdate(productId, "post_create")
  }
  return await readbackProductArchiveDraft(db, draftId, { ...options, claimToken })
}

export async function readbackProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const draft = draftById(db, draftId)
  const claimToken = options.claimToken ?? stringValue(draft.submit_claim_token)
  const runReadback = options.readback ?? (async () => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await getDeepdrawProduct({
      config,
      productCode: stringValue(draft.spu_code),
      resource: "form",
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  let result: DeepdrawResult
  try {
    result = await runReadback()
  } catch (error) {
    if (claimToken) {
      db.prepare(`
        update product_archive_draft
        set duplicate_result_json = jsonb_set(coalesce(duplicate_result_json, '{}'::jsonb), '{submit_readback_unknown}', to_jsonb(?::text), true),
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token = ?
      `).run(error instanceof Error ? error.message : String(error), nowIso(), draftId, claimToken)
    }
    throw error
  }
  try {
    assertDeepdrawProductArchiveSuccess(result, "resource")
  } catch (error) {
    const readbackError = error instanceof Error ? error : new Error(String(error))
    db.transaction(() => {
      writeSubmitLog(db, draftId, "resource", {
        ...result,
        requestSummary: {
          spuCode: draft.spu_code,
          businessReadbackFailed: true,
        },
        productId: stringValue(draft.created_product_id) || null,
      })
      if (claimToken) {
        db.prepare(`
          update product_archive_draft
          set duplicate_result_json = jsonb_set(coalesce(duplicate_result_json, '{}'::jsonb), '{submit_readback_unknown}', to_jsonb(?::text), true),
            updated_at = ?::timestamptz
          where id = ?
            and submit_claim_token = ?
        `).run(readbackError.message, nowIso(), draftId, claimToken)
      }
    })()
    throw readbackError
  }
  const body = deepdrawBusinessResult(result.payload).body
  const titleMatches = !stringValue(draft.title) || !stringValue(body.title) || stringValue(draft.title) === stringValue(body.title)
  let legacyShoeComparison: ReturnType<typeof compareDeepdrawLegacyShoePayloadToResource> | {
    ok: false
    sections: Array<{ name: string; ok: false }>
    error: string
  } | null = null
  const shouldCompareLegacyShoePayload = isShoeProductContext({
    tradeId: draft.trade_id,
    tradePath: draft.trade_path,
  })
  if (shouldCompareLegacyShoePayload) {
    try {
      legacyShoeComparison = compareDeepdrawLegacyShoePayloadToResource({
        payload: productPayload(db, draftId),
        resourceBody: result.payload,
      })
    } catch (error) {
      legacyShoeComparison = {
        ok: false,
        sections: [{ name: "v1_shoe_payload", ok: false }],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  const payloadMatches = legacyShoeComparison?.ok ?? true
  const status = result.ok && titleMatches && payloadMatches ? "readback_verified" : "readback_mismatch"
  db.transaction(() => {
    writeSubmitLog(db, draftId, "resource", {
      ...result,
      requestSummary: {
        spuCode: draft.spu_code,
        titleMatches,
        legacyShoeComparison: legacyShoeComparison
          ? {
              ok: legacyShoeComparison.ok,
              sections: legacyShoeComparison.sections,
              ...(legacyShoeComparison && "error" in legacyShoeComparison ? { error: legacyShoeComparison.error } : {}),
            }
          : null,
      },
      productId: stringValue(body.productId ?? body.id) || stringValue(draft.created_product_id) || null,
    })
    if (claimToken) {
      const updated = db.prepare(`
        update product_archive_draft
        set status = ?,
          submit_claim_token = null,
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token = ?
        returning id
      `).get(status, nowIso(), draftId, claimToken)
      if (!updated) throw new Error("草稿提交权已失效，回读结果未写入")
    } else {
      const updated = db.prepare(`
        update product_archive_draft
        set status = ?,
          updated_at = ?::timestamptz
        where id = ?
          and submit_claim_token is null
        returning id
      `).get(status, nowIso(), draftId)
      if (!updated) throw new Error("草稿正在由其他请求提交，回读结果未写入")
    }
  })()
  return { ok: result.ok, status, result, titleMatches, legacyShoeComparison }
}

export function listProductArchiveSubmitLogs(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select *
    from product_archive_submit_log
    where draft_id = ?
    order by created_at desc, id desc
  `).all(draftId)
}
