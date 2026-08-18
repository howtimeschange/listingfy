import fs from "node:fs"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
} from "../../../scripts/lib/product_archive_source_importer.mjs"
import {
  buildSizeChartForTemplate,
  normalizeDeepdrawSize,
  normalizePlmSizeChartRows,
} from "../../../scripts/lib/product_archive_size_chart.mjs"
import {
  createDeepdrawProduct,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
} from "../../../scripts/lib/deepdraw_client.mjs"
import {
  getDefaultAiScenarioRouter,
  withAiRoutingHashes,
} from "../../../scripts/lib/ai_routing_context.mjs"

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
  fields: Array<{
    id?: number
    fieldName?: string
    field_name?: string
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

export function isProductArchiveTradeBackfillStatus(status: unknown) {
  return PRODUCT_ARCHIVE_TRADE_BACKFILL_EDITABLE_STATUSES.has(stringValue(status))
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
  search?: () => Promise<DeepdrawResult>
  create?: (payload: JsonRecord) => Promise<DeepdrawResult>
  readback?: () => Promise<DeepdrawResult>
  projectRoot?: string
}

interface AiFillOptions {
  fetchImpl?: typeof fetch
  router?: {
    callJson: (input: Record<string, unknown>) => Promise<{
      json: Record<string, unknown>
    }>
  }
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

interface RefreshSourceBatchInput {
  sourceBatchId: number
  sourceType: string
}

interface RefreshSourceBatchChunkOptions {
  chunkSize?: number
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

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  return stringValue(
    record.value
      ?? record.optionValue
      ?? record.option_value
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

function optionTextCandidates(value: unknown) {
  if (value == null) return []
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [stringValue(value)].filter(Boolean)
  const record = recordValue(value)
  return uniqueTextValues([
    record.value,
    record.optionValue,
    record.option_value,
    record.code,
    record.key,
    record.name,
    record.label,
    record.text,
    record.optionName,
    record.option_name,
    record.title,
    record.id,
  ])
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

function compactFieldKey(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase()
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
    if (/(吊牌|合格证|hangtag|tag)/i.test(base)) return "hangtag"
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
  "市场价",
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
  "对应日期",
  "官方发布类目",
])

const COPYWRITING_REFERENCE_FIELDS = new Set([
  "搜索标题",
  "商品标题",
  "标题",
  "唯品标题",
  "内容平台标题",
  "内容标题",
  "导购标题",
  "推荐理由",
  "FAB",
  "面料成分",
  "材质成分",
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
  return LIST_PRICE_REFERENCE_KEYS.has(key)
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

function merchantSkuFieldValue(spu: JsonRecord, skus: JsonRecord[], dateText = "") {
  const productCode = stringValue(spu.spu_code)
  const retailPrice = moneyText(spu.price_tag)
  const skuDate = dateFromText(dateText) || stringValue(dateText)
  const output: JsonRecord = {
    title: "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码",
  }
  for (const sku of skus) {
    const color = stringValue(sku.color_name)
    const size = deepdrawSizeValue(sku.size_name)
    if (!color || !size) continue
    const price = moneyText(sku.price_tag) || retailPrice
    const sellerCode = stringValue(sku.inner_code) || stringValue(sku.ean_code) || stringValue(sku.sku_code)
    const barcode = stringValue(sku.ean_code)
    const skuCode = stringValue(sku.sku_code) || sellerCode
    const colorBucket = recordValue(output[color])
    colorBucket[size] = [
      price,
      productCode,
      skuDate,
      "0",
      sellerCode,
      barcode,
      retailPrice || price,
      price,
      skuCode,
      barcode,
    ].join(",")
    output[color] = colorBucket
  }
  return output
}

const SIZE_TABLE_TITLE = "身高,衣长,胸围,袖长"

function sizeTableValue(skus: JsonRecord[]) {
  const sizes = uniqueTextValues(skus.flatMap((sku) => [
    deepdrawSizeValue(sku.size_name),
    deepdrawSizeValue(sku.size_code),
  ]))
  if (!sizes.length) return {}
  const output: JsonRecord = { title: SIZE_TABLE_TITLE }
  for (const size of sizes) {
    const height = size.match(/^(\d+)/)?.[1] ?? "0"
    output[size] = [height, "0", "0", "0"].join(",")
  }
  return output
}

function isProductArchiveStructuredSizeFieldName(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "多平台尺码" || key.includes("尺码表")
}

function isProductArchiveSkuSizeTemplateFieldName(fieldName: unknown) {
  const text = stringValue(fieldName)
  return /尺码|尺寸|规格|size/i.test(text) && !isProductArchiveStructuredSizeFieldName(text)
}

function isProductArchiveSkuSizeFieldName(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "尺码" || key === "尺寸" || key === "规格" || key === "size"
}

function baseColorName(value: unknown) {
  const text = stringValue(value)
  if (/卡其|贝壳卡|卡色/.test(text)) return "卡其"
  if (text.includes("粉")) return "粉红"
  const colors = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "灰色", "棕色", "橙色"]
  for (const color of colors) {
    if (text.includes(color.slice(0, 1))) return color
  }
  return text
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

function sourceAliases(sourceField: string) {
  const field = stringValue(sourceField)
  const aliases: Record<string, string[]> = {
    款号: ["款号", "大货款号", "货号", "商品品种编号"],
    吊牌价格: ["吊牌价格", "吊牌价", "核算吊牌价", "挂牌单价"],
    吊牌价: ["吊牌价", "吊牌价格", "核算吊牌价", "挂牌单价"],
    颜色: ["颜色", "颜色名称"],
    尺码段: ["尺码段", "尺码范围", "尺码区间", "尺码"],
    上市时间: ["上市时间", "内容上市时间", "搜索上市时间"],
    对应日期: ["内容上市时间", "搜索上市时间", "上市时间"],
    搜索标题: ["搜索标题", "商品标题", "标题", "内容平台标题", "内容标题", "天猫标题"],
    内容平台标题: ["内容平台标题", "内容标题"],
    细节文案: ["细节文案", "细节文案（不限定8个字，细节数量3-4个）"],
    材质成分: ["材质成分", "面料成分"],
    面料成分: ["面料成分", "材质成分"],
    版型: ["版型", "服装版型"],
    服装版型: ["服装版型", "版型"],
    填充物: ["填充物", "填充物种类"],
    填充物种类: ["填充物种类", "填充物"],
    文案表: ["搜索标题", "唯品标题", "内容平台标题", "内容标题", "导购标题"],
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
      "件数(单选)",
    ],
    fieldKeyPatterns: [
      /^(?:模板)?版型$/,
      /^是否(?:带帽|有腰带|有毛领|多件套)$/,
      /^(?:衣|裤)门襟(?:多选)?$/,
      /^流行元素(?:多选)?$/,
      /^图案(?:多选)?$/,
      /^袖长(?:多选)?$/,
      /^款式(?:多选|单选)?$/,
    ],
    evidence: ["reference_images", "product_title", "trade_path", "source_rows", "filled_fields"],
    decision: "优先根据商品图判断款式、结构、图案、门襟、领型、帽子、腰带、毛领和套件数量；标题和类目只作为辅助。",
    guardrail: "图片看不清、只有字段名、或无法从标题/类目交叉验证时不要填写。",
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
    ],
    fieldKeyPatterns: [
      /^(?:抖音)?面料(?:多选|俗称|工艺|材质)?$/,
      /^材质(?:成分)?(?:多选|文本)?$/,
      /^主面料成分(?:含量)?$/,
      /^里料材质(?:成分含量)?(?:多选)?$/,
      /^填充物(?:含量|多选)?$/,
      /^含绒量(?:多选)?$/,
      /^绒子含量$/,
      /^(?:25)?厚(?:薄|度)指数?$/,
      /^(?:25|中幼童)?弹(?:力|性)指数?$/,
      /^(?:25|中幼童)?柔软(?:度|指数)$/,
      /^功能(?:多选)?$/,
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
      "主图4样式",
      "详情页AI标注",
      "模特实拍",
    ],
    fieldKeyPatterns: [
      /^主图4样式$/,
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

export function listProductArchiveAiFieldStrategies() {
  return PRODUCT_ARCHIVE_AI_FIELD_STRATEGIES.map(serializeAiFieldStrategy)
}

const PRODUCT_ARCHIVE_ALWAYS_BLANK_FIELDS = new Set([
  "商品描述",
  "商品短标题",
  "微信视频小店副标题",
  "快手商品卖点",
  "成分含量",
  "主面料成分含量",
  "图案",
  "图案多选",
])

const PRODUCT_ARCHIVE_SHOE_CONTEXT_FIELDS = new Set([
  "22q4童鞋卖点",
  "22q4童鞋卖点解析",
  "22q4童鞋品名",
  "22q4童鞋尺码表",
  "童鞋核心卖点",
  "品名童鞋",
  "尺码童鞋",
  "25鞋子尺码表",
  "25鞋子模板类型",
  "鞋子尺码表",
  "鞋子模板类型",
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
  return productTextIncludesAny(productCategoryText(spu, sourceRows), ["鞋"])
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

export function isProductArchiveBusinessBlankField(fieldName: string, spu: JsonRecord = {}, sourceRows: JsonRecord[] = []) {
  const key = businessRuleFieldKey(fieldName)
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
} = {}) {
  if (stringValue(input.sourceType) === "skip") return false
  if (isProductArchiveDocumentOptionalField(fieldName)) return false
  if (Object.prototype.hasOwnProperty.call(input, "templatePresent") && !input.templatePresent) return false
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
  return launchValue(sourceRows, "内容上市时间")
    || launchValue(sourceRows, "搜索上市时间")
    || launchValue(sourceRows, "上市时间")
}

export function buildProductArchivePayloadDate(sourceRows: JsonRecord[]) {
  return dateFromText(launchDateValue(sourceRows))
}

function copyTextBlock(sourceRows: JsonRecord[]) {
  return [
    copywritingValue(sourceRows, "FAB") || launchValue(sourceRows, "FAB"),
    copywritingValue(sourceRows, "推荐理由"),
    copywritingValue(sourceRows, "面料文案"),
    copywritingValue(sourceRows, "细节文案"),
  ].filter(Boolean).join("\n")
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

const SECONDARY_MATERIAL_SECTION = "里料|衬里|花边|填充物|配料|辅料|罗纹|帽里|胆料|内胆|装饰物|鞋面|鞋底"

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
  const text = stringValue(value)
    .replace(/\u00a0/g, " ")
    .replace(/％/g, "%")
    .replace(/\r/g, "")
    .replace(/^\s*成分\s*[:：]?\s*/i, "")
  if (!text) return ""
  const primaryLabel = /(?:^|\n|\s)(?:主面料|大身面料|面料)\s*[:：]\s*/g
  const labelMatch = primaryLabel.exec(text)
  const afterLabel = labelMatch ? text.slice(labelMatch.index + labelMatch[0].length) : text
  const secondaryLabel = new RegExp(`(?:^|\\n|\\s)(?:${SECONDARY_MATERIAL_SECTION})\\s*[:：]`)
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

function materialComponentsFromText(value: unknown): MaterialComponent[] {
  const section = primaryMaterialSection(value)
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

function materialCompositionSourceText(sourceRows: JsonRecord[]) {
  return copywritingValue(sourceRows, "面料成分")
    || copywritingValue(sourceRows, "材质成分")
}

function sectionTextFromMaterialSource(sourceRows: JsonRecord[], labels: string[]) {
  const sourceText = materialCompositionSourceText(sourceRows)
    .replace(/\u00a0/g, " ")
    .replace(/％/g, "%")
    .replace(/\r/g, "")
  if (!sourceText) return ""
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const labelMatch = new RegExp(`(?:^|\\n|\\s)(?:${labelPattern})\\s*[:：]\\s*`).exec(sourceText)
  if (!labelMatch) return ""
  const afterLabel = sourceText.slice(labelMatch.index + labelMatch[0].length)
  const nextLabel = new RegExp(`(?:^|\\n|\\s)(?:${SECONDARY_MATERIAL_SECTION}|主面料|大身面料|面料)\\s*(?:[:：]|\\n|$)`)
  const nextIndex = afterLabel.search(nextLabel)
  return (nextIndex >= 0 ? afterLabel.slice(0, nextIndex) : afterLabel)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("；")
}

function liningCompositionText(sourceRows: JsonRecord[]) {
  return sectionTextFromMaterialSource(sourceRows, ["里料", "衬里"])
}

function downMaterialText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return stringValue(spu.filler) || sectionTextFromMaterialSource(sourceRows, ["填充物", "填充料"])
}

function downFillWeightText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  const text = downMaterialText(spu, sourceRows)
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:g|克)\b/i)
  return match ? `${formatMaterialPercent(match[1])}g` : ""
}

function downContentPercentText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  const sourceText = `${downMaterialText(spu, sourceRows)}\n${materialCompositionSourceText(sourceRows)}`
    .replace(/％/g, "%")
  const labeled = sourceText.match(/(?:绒子含量|含绒量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%?/)
  if (labeled) return `${formatMaterialPercent(labeled[1])}%`
  const filler = sourceText.match(/(\d+(?:\.\d+)?)\s*#\s*绒子/)
  if (filler) return `${formatMaterialPercent(filler[1])}%`
  return ""
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
  return primaryMaterialComponents(sourceRows).map((component) => component.name).join(";")
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
    if (text.includes(name)) return name
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
    ["130-175", "7-16岁"],
    ["140-175", "8-16岁"],
  ])
  const exactShoe = new Map<string, string>([
    ["19-24", "4-24个月"],
    ["25-33", "3-7岁"],
    ["34-39", "8-14岁"],
  ])
  const exactMap = shoeProduct ? exactShoe : exactClothing
  for (const [start, end] of ranges) {
    const exact = exactMap.get(`${start}-${end}`)
    if (exact) return exact
  }
  const [start, end] = ranges[0]
  if (shoeProduct) {
    if (end <= 24) return "4-24个月"
    if (end <= 33) return "3-7岁"
    if (end <= 39) return "8-14岁"
    return ""
  }
  if (end <= 66) return "新生儿, 3个月"
  if (end <= 90) return "3-18个月"
  if (end <= 100) return "6个月-2岁"
  if (end <= 130) return "2-7岁"
  if (end <= 140) return "2-8岁"
  if (end <= 175) return start >= 140 ? "8-16岁" : "7-16岁"
  return ""
}

function applicableAgeText(spu: JsonRecord, sourceRows: JsonRecord[]) {
  return ageTextForSizeSegment(launchValue(sourceRows, "尺码段"), isShoeProduct(spu, sourceRows))
}

export function buildProductArchiveSourceDerivedFieldValue(fieldName: string, input: {
  spu: JsonRecord
  sourceRows: JsonRecord[]
  sourceField?: string | null
}) {
  const key = compactFieldKey(fieldName)
  const sourceField = stringValue(input.sourceField)
  const sourceRows = activeProductArchiveSourceRows(input.sourceRows ?? [])
  if (isProductArchiveBusinessBlankField(fieldName, input.spu, sourceRows)) return ""
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return materialCompositionText(sourceRows)
  if (key === "材质成分") return materialCompositionValue(sourceRows)
  if (key === "京东材质成分") return materialCompositionValue(sourceRows, true)
  if (key === "面料多选" || key === "材质多选" || key === "材质成分多选") return materialChoiceValue(sourceRows)
  if (key === "面料" || key === "材质" || key === "面料俗称" || key === "详情页面料" || key === "抖音面料材质") {
    return materialSummaryValue(sourceRows, fieldName)
  }
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

  if (key === "上市时间" || key === "上市时间文本") return dateFromText(launchDateValue(sourceRows))
  if (key === "单位" || key === "计量单位") return "件"
  if (key === "型号") return stringValue(input.spu.spu_code) || launchValue(sourceRows, "款号")
  if (key === "选择期数") return launchValue(sourceRows, "产品季") || stringValue(input.spu.season_name) || stringValue(input.spu.year)
  if (key === "厚薄") return copywritingValue(sourceRows, "厚薄")
  if (key === "服装版型" || key === "版型") return copywritingValue(sourceRows, "版型")
  if (key === "分类" || key === "类型") return "外套"
  if (key === "品牌单选") return stringValue(input.spu.brand_name) || "巴拉巴拉"
  if (key === "品牌" || key === "品牌文本") return stringValue(input.spu.brand_name) || copywritingValue(sourceRows, "品牌") || "巴拉巴拉"
  if (key === "生产企业名称" || key === "生产经销厂家" || key === "生产经销企业") return productionEnterpriseName(input.spu)
  if (key === "充绒量文本") return downFillWeightText(input.spu, sourceRows)
  if (key === "含绒量文本" || key === "绒子含量文本") return downContentPercentText(input.spu, sourceRows)
  if (key === "里料成分含量") return liningCompositionText(sourceRows)
  if (key === "里料材质成分含量多选") return normalizeMaterialName(liningCompositionText(sourceRows).replace(/^\d+(?:\.\d+)?\s*%/, ""))
  if (key === "功能多选") return copywritingValue(sourceRows, "面料三个关键词") || copywritingValue(sourceRows, "推荐理由")
  if (key === "安全等级" || key === "安全等级多选") return "A类"
  if (key === "尺码表") return ""
  if (key === "性别多选") return launchValue(sourceRows, "性别") || stringValue(input.spu.gender_name)
  if (key === "成分含量") return materialPercentText(sourceRows)
  if (key === "是否带帽") return "连帽"
  if (key === "是否库存") return "否"
  if (key === "主面料成分含量") return materialPercentText(sourceRows)
  if (key === "唯品会副标题") return copywritingValue(sourceRows, "唯品标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "弹力") return copywritingValue(sourceRows, "弹性")
  if (key === "商品短标题") return copywritingValue(sourceRows, "导购标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "商品详情") return copywritingValue(sourceRows, "推荐理由")
  if (key === "商品描述") return ""
  if (key === "微信视频小店副标题" || key === "快手商品卖点") return copywritingValue(sourceRows, "推荐理由") || copyTextBlock(sourceRows)
  if (key === "微信视频小店标题" || key === "抖音标题") return copywritingValue(sourceRows, "内容平台标题") || copywritingValue(sourceRows, "搜索标题")
  if (key === "快手标题" || key === "拼多多标题") return copywritingTitleValue(input.spu, sourceRows)
  if (key === "计量单位") return stringValue(input.spu.unit_name) || "件"
  if (key === "是否跨境出口专供货源" || key === "是否加绒" || key === "是否可开档" || key === "是否开裆") return "否"
  if (key === "是否可定制") return "不可定制"
  if (key === "售后服务承诺") return "不设置"
  if (key === "balaone仅专供新品") return launchValue(sourceRows, "属性").includes("专供新品") ? "是" : ""
  if (key === "填充物种类") return copywritingFillerMaterialValue(sourceRows) || stringValue(input.spu.filler) || launchValue(sourceRows, "填充物") || "无"
  if (key === "款式" || key === "款式多选" || key === "款式单选") return launchValue(sourceRows, "主款式 （唯品四级品类）") || stringValue(input.spu.spu_name)
  if (key === "袖长多选") return "长袖"
  if (key === "袖长") return "长袖"
  if (key === "衣长") return "常规"
  if (key === "腰型" || key === "裤长" || key === "裤门襟") return "不适用"
  if (isProductArchiveOriginCountryField(fieldName)) return "中国"
  if (key === "童装产地多选") return "中国大陆"
  if (key === "适用场合") return "日常"
  if (key === "退款规则") return "支持7天无理由退货"
  if (key === "适用人群" || key === "适用人群多选") return launchValue(sourceRows, "年龄段") || stringValue(input.spu.age_group_name)
  if (key === "适用季节" || key === "适用季节多选") return "秋季"
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
  if (key === "京东自营子属性") return buildProductArchiveMdmDerivedFieldValue("尺码", { spu: input.spu, skus: [] }).valueText
  if (key === "京东规格子属性") return aggregateSourceValues(sourceRows, "launch_plan", ["颜色名称", "颜色"]).join(";")
  return ""
}

export function buildProductArchiveMdmDerivedFieldValue(fieldName: string, input: {
  spu: JsonRecord
  skus: JsonRecord[]
  dateText?: string
}) {
  const key = compactFieldKey(fieldName)
  if (isProductArchiveOriginCountryField(fieldName)) {
    return { valueText: "中国", valueJson: {} }
  }
  if (key === "货号" || key === "款号") {
    return { valueText: stringValue(input.spu.spu_code), valueJson: {} }
  }
  if (key === "价格" || key === "吊牌价格" || key === "吊牌价") {
    return { valueText: moneyText(input.spu.price_tag), valueJson: {} }
  }
  if (key === "上市时间") {
    return { valueText: stringValue(input.dateText), valueJson: {} }
  }
  if (key === "颜色" || key === "颜色文本" || key === "颜色名称文本") {
    return { valueText: uniqueTextValues(input.skus.map((sku) => deepdrawColorValue(sku.color_name))).join(";"), valueJson: {} }
  }
  if (key === "尺码" || key === "尺寸") {
    return { valueText: uniqueTextValues(input.skus.map((sku) => deepdrawSizeValue(sku.size_name))).join(";"), valueJson: {} }
  }
  if (key === "尺码表") {
    return { valueText: "", valueJson: sizeTableValue(input.skus) }
  }
  if (key === "商家sku") {
    return {
      valueText: "",
      valueJson: merchantSkuFieldValue(input.spu, input.skus, stringValue(input.dateText)),
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

function sizeChartTemplateOptionsForField(templateOptions: unknown, existingValueJson: unknown, fieldName: string) {
  const options = arrayValue(templateOptions)
  if (options.length > 0) return options
  const existingTitles = sizeChartTitleOptions(existingValueJson)
  if (existingTitles.length > 0) return existingTitles
  return compactFieldKey(fieldName) === compactFieldKey("尺码表") ? ["身高", "衣长", "胸围", "袖长"] : []
}

export function buildProductArchiveSizeChartFieldValue(input: {
  fieldName: string
  spuCode: string
  sourceRows: JsonRecord[]
  templateOptions: unknown[]
  mappings?: JsonRecord[]
}) {
  const result = buildSizeChartForTemplate({
    rows: sizeChartSourceRowJson(input.sourceRows),
    spuCode: input.spuCode,
    template: {
      fieldName: input.fieldName,
      options: input.templateOptions,
    },
    mappings: input.mappings ?? [],
  })
  return {
    valueText: "",
    valueJson: recordValue(result.valueJson),
    sourceType: hasValue(recordValue(result.valueJson)) ? "size_chart" : "",
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
  const allowedSizes = new Set(uniqueTextValues(input.allowedSizes.map((size) => deepdrawSizeValue(size))))
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
    if (allowedSizes.size > 0 && !allowedSizes.has(size)) {
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

function issueValueList(values: string[]) {
  const visible = values.slice(0, 8).join("、")
  return values.length > 8 ? `${visible} 等 ${values.length} 个` : visible
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
    where source.spu_code = ?
      and source.source_batch_id in (${batchIds.map(() => "?").join(", ")})
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(spuCode, ...batchIds) as JsonRecord[]
  return activeProductArchiveSourceRows(rows)
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
  const batchIds = sourceBatchIdsFromSnapshot(snapshot)
  if (batchIds.length > 0) {
    return sourceRowsForSpuBatchIds(db, stringValue(draft.spu_code), batchIds)
  }
  return sourceRowsForSpu(
    db,
    stringValue(draft.spu_code),
    numberValue(snapshot.sourceBatchId),
  )
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
]

const LAUNCH_PLAN_CATEGORY_FIELDS = LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS.flatMap((field) => field.aliases)

function latestLaunchPlanCategoryRows(sourceRows: JsonRecord[]) {
  const launchPlanRows = sourceRows.filter((row) => stringValue(row.source_type) === "launch_plan")
  const batchIds = launchPlanRows
    .map((row) => numberValue(row.source_batch_id ?? row.sourceBatchId))
    .filter((value): value is number => value !== null && value > 0)
  if (batchIds.length === 0) return launchPlanRows
  const latestBatchId = Math.max(...batchIds)
  return launchPlanRows.filter((row) => numberValue(row.source_batch_id ?? row.sourceBatchId) === latestBatchId)
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

function launchPlanCategoryValues(sourceRows: JsonRecord[]) {
  const values: Array<{ field: string; value: string }> = []
  const seen = new Set<string>()
  for (const row of latestLaunchPlanCategoryRows(sourceRows)) {
    const rowJson = recordValue(row.row_json)
    for (const field of LAUNCH_PLAN_CATEGORY_FIELDS) {
      const value = stringValue(rowJson[field])
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
  const launchPlanRows = latestLaunchPlanCategoryRows(sourceRows)
  for (const field of LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS) {
    const values: string[] = []
    for (const row of launchPlanRows) {
      const rowJson = recordValue(row.row_json)
      for (const alias of field.aliases) {
        const value = stringValue(rowJson[alias])
        if (value) values.push(value)
      }
    }
    const uniqueValues = uniqueTextValues(values)
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

function scoreTradeMatch(trade: JsonRecord, category: { field: string; value: string }) {
  const candidatePath = stringValue(trade.trade_path) || stringValue(trade.trade_name)
  const candidateName = stringValue(trade.trade_name)
  const categoryText = normalizeTradeText(category.value)
  const candidatePathText = normalizeTradeText(candidatePath)
  const candidateNameText = normalizeTradeText(candidateName)
  const categoryLeaf = tradeLeaf(category.value)
  const candidateLeaf = tradeLeaf(candidatePath)
  if (!categoryText || (!candidatePathText && !candidateNameText)) return 0
  const fieldBoost = category.field.includes("官方") ? 400 : category.field.includes("唯品四级") ? 20 : 10
  const pathBoost = candidatePathText.includes("童装服饰") ? 40 : 0
  const categoryContext = categoryText.split(">").slice(0, -1)
  const contextBoost = uniqueTextValues(categoryContext)
    .filter((segment) => segment.length >= 2 && candidatePathText.includes(segment))
    .length * 30
  const boost = fieldBoost + pathBoost + contextBoost
  if (candidatePathText === categoryText) return 1000 + boost
  if (candidateNameText === categoryText) return 850 + boost
  if (candidateNameText && candidateNameText === categoryLeaf) return 760 + boost
  if (candidatePathText.endsWith(`>${categoryLeaf}`) || candidatePathText === categoryLeaf) return 720 + boost
  if (categoryLeaf && candidatePathText.includes(categoryLeaf)) return 520 + boost
  if (categoryLeaf && candidateLeaf && categoryLeaf.includes(candidateLeaf)) return 500 + boost
  if (categoryLeaf && candidateNameText && categoryLeaf.includes(candidateNameText)) return 480 + boost
  return 0
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
  if (categories.some((category) => category.field.includes("唯品"))) groups.push(["VIP"])
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

function sizeMatchKeys(value: unknown) {
  const text = stringValue(value)
  if (!text) return []
  const normalized = deepdrawSizeValue(text)
  const numberText = normalized.match(/^(\d+)cm$/i)?.[1] ?? ""
  return uniqueTextValues([
    text,
    normalized,
    numberText,
    numberText ? numberText.padStart(3, "0") : "",
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
  return uniqueTextValues([
    ...arrayValue(trade.size_options_json),
    ...arrayValue(trade.size_options),
    ...arrayValue(trade.sizeOptions),
  ].flatMap(optionTextCandidates))
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
  const leafTerms = officialCategoryLeafTerms(leaf)
  if (leafTerms.length > 0 && leafTerms.every((term) => candidateText.includes(term))) {
    return 1320 + leafTerms.length
  }
  return 0
}

function bestOfficialCategoryLeafTradeMatch(
  tier: DeepdrawTradePriorityTier,
  categories: Array<{ field: string; value: string }>,
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
      if (categoryScore > score) {
        score = categoryScore
        matchedCategory = category
      }
    }
    if (!matchedCategory) continue
    if (!tradeMatchesRequiredSizes(candidate.trade, requiredSizes)) {
      sizeIncompatible = true
      continue
    }
    const pathDepth = tradePathDepth(candidate.trade)
    if (!best || score > best.score || (score === best.score && pathDepth < best.pathDepth)) {
      best = { candidate, category: matchedCategory, score, matchScore: score, pathDepth }
      tied = false
    } else if (score === best.score && pathDepth === best.pathDepth) {
      tied = true
    }
  }
  return { best, tied, sizeIncompatible }
}

function bestDeepdrawTradeMatch(
  candidates: PrioritizedDeepdrawTrade[],
  categories: Array<{ field: string; value: string }>,
) {
  let best: {
    candidate: PrioritizedDeepdrawTrade
    category: { field: string; value: string }
    score: number
    matchScore: number
    pathDepth: number
  } | null = null
  let tied = false
  for (const candidate of candidates) {
    let score = 0
    let matchScore = 0
    let matchedCategory: { field: string; value: string } | null = null
    for (const category of categories) {
      const categoryScore = scoreTradeMatch(candidate.trade, category)
      if (categoryScore <= 0) continue
      score += categoryScore
      if (categoryScore > matchScore) {
        matchScore = categoryScore
        matchedCategory = category
      }
    }
    if (!matchedCategory) continue
    const pathDepth = tradePathDepth(candidate.trade)
    if (!best || score > best.score || (score === best.score && pathDepth < best.pathDepth)) {
      best = { candidate, category: matchedCategory, score, matchScore, pathDepth }
      tied = false
    } else if (score === best.score && pathDepth === best.pathDepth) {
      tied = true
    }
  }
  return { best, tied }
}

function launchPlanCategorySourceConflict(sourceRows: JsonRecord[]) {
  const launchPlanRows = latestLaunchPlanCategoryRows(sourceRows)
  return LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS.some((field) => {
    const values: string[] = []
    for (const row of launchPlanRows) {
      const rowJson = recordValue(row.row_json)
      for (const alias of field.aliases) {
        const value = stringValue(rowJson[alias])
        if (value) values.push(value)
      }
    }
    return uniqueTextValues(values).length > 1
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
  const candidateTiers = deepdrawTradePriorityTiers(stringValue(input.tenantName), trades)
  const selectableCandidates = candidateTiers.flatMap((tier) => tier.candidates)
  const hasPlatformMetadata = selectableCandidates.some((candidate) => hasTradePlatformMetadata(candidate.trade))
  const allowUnspecifiedPlatformMetadata = input.allowUnspecifiedPlatformMetadata === true && !hasPlatformMetadata
  const requiredSizes = skuSizeRequirements(input.skus ?? [])
  let selected: {
    tier: DeepdrawTradePriorityTier
    best: NonNullable<ReturnType<typeof bestDeepdrawTradeMatch>["best"]>
  } | null = null
  let foundPlatformEligibleTrade = false
  let foundSizeIncompatibleTrade = false
  for (const tier of candidateTiers) {
    const officialLeafMatch = bestOfficialCategoryLeafTradeMatch(tier, categories, requiredSizes)
    if (officialLeafMatch.sizeIncompatible) foundSizeIncompatibleTrade = true
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
    if (eligibleCandidates.length === 0) continue
    foundPlatformEligibleTrade = true
    const match = bestDeepdrawTradeMatch(eligibleCandidates, categories)
    if (!match.best) continue
    if (match.tied) {
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
    selected = { tier, best: match.best }
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
  const status = confidence === "high" && !sourceConflict && !appliedTradeMismatch
    ? "auto_applied"
    : "pending_confirmation"
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
      ? "同一平台来源类目存在多个不同值，已自动应用最优推荐，需要人工确认。"
    : confidence === "high"
      ? `已根据${best.category.field}唯一匹配并自动应用深绘类目，置信度高。`
      : "已自动应用推荐类目，但当前为中置信度，需要人工确认。"
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
      current.push(...arrayValue(row.options_json).flatMap(optionTextCandidates))
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
    .map((option) => {
      const value = fieldOptionText(option, ["value", "code", "id", "optionValue", "option_value", "key", "name", "label"])
      const label = fieldOptionText(option, ["label", "name", "text", "optionName", "option_name", "title", "value", "code"])
      if (!value && !label) return null
      return { value: value || label, label: label || value }
    })
    .filter((option): option is { value: string; label: string } => Boolean(option))
}

export function productArchiveFieldValueMatchesOptions(value: unknown, options: unknown[]) {
  if (!options.length || !hasValue(value)) return true
  if (value && typeof value === "object" && !Array.isArray(value)) return true
  const allowed = new Set(options.flatMap(optionTextCandidates).filter(Boolean))
  if (!allowed.size) return true
  const text = stringValue(value)
  const groups = text.split(/[;；]/).map((part) => part.trim()).filter(Boolean)
  const values = groups.length ? groups : [text].filter(Boolean)
  return values.every((item) => {
    if (allowed.has(item)) return true
    const aliases = item.split(/[,，]/).map((part) => part.trim()).filter(Boolean)
    return (aliases.length ? aliases : [item]).some((alias) => allowed.has(alias))
  })
}

function optionValues(options: unknown[]) {
  return uniqueTextValues(options.flatMap(optionTextCandidates))
}

function pickOption(options: unknown[], predicates: Array<(value: string) => boolean>) {
  const values = optionValues(options)
  for (const predicate of predicates) {
    const match = values.find(predicate)
    if (match) return match
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
  const match = value.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*岁/)
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return start <= end ? { start, end } : { start: end, end: start }
}

function singleAgeOptionValue(text: string, options: unknown[]) {
  const range = ageYearRange(text)
  if (!range) return ""
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
    if (age >= 14 && age < range.end) {
      const tail = pickOption(options, [
        (option) => option === `${age}岁以上`,
        (option) => option === `${age}周岁及以上`,
        (option) => option.includes(String(age)) && option.includes("以上"),
      ])
      if (tail) {
        values.push(tail)
        return uniqueTextValues(values).join(";")
      }
    }
    const value = pickOption(options, [(option) => option === `${age}岁`])
    if (value) values.push(value)
    else return singleAgeOptionValue(text, options)
  }
  return values.length ? values.join(";") : singleAgeOptionValue(text, options)
}

function normalizeMaterialOptionValue(value: unknown, options: unknown[]) {
  const text = normalizeMaterialName(stringValue(value).replace(/^\d+(?:\.\d+)?\s*%/, ""))
  if (!text) return ""
  if (!options.length) return text
  if (text === "聚酯纤维") {
    return pickOption(options, [
      (option) => option === "聚酯纤维",
      (option) => option === "聚酯纤维（涤纶）",
      (option) => option === "涤纶(聚酯纤维)",
      (option) => option.includes("聚酯纤维") || option.includes("涤纶"),
    ]) || text
  }
  if (text === "棉") {
    return pickOption(options, [
      (option) => option === "棉",
      (option) => option === "纯棉",
      (option) => option === "纯棉(棉含量100%)",
      (option) => option.includes("棉"),
    ]) || text
  }
  if (text === "聚酰胺纤维") {
    return pickOption(options, [
      (option) => option === "聚酰胺纤维",
      (option) => option === "锦纶",
      (option) => option.includes("聚酰胺纤维") || option.includes("锦纶") || option.includes("尼龙"),
    ]) || text
  }
  if (text === "粘胶纤维") {
    return pickOption(options, [
      (option) => option === "粘胶纤维",
      (option) => option === "黏胶纤维",
      (option) => option.includes("粘胶") || option.includes("黏胶") || option.includes("粘纤") || option.includes("黏纤"),
    ]) || text
  }
  return pickOption(options, [
    (option) => option === text,
    (option) => option.includes(text) || text.includes(option),
  ]) || text
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
    || key === "产地"
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

export function normalizeProductArchiveDeepdrawFieldValue(fieldName: string, value: unknown, options: unknown[]) {
  const text = stringValue(value)
  const key = compactFieldKey(fieldName)
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return text
  if (!text || !options.length) return text
  const exact = pickOption(options, [(option) => option === text])
  if (exact) return exact
  if (key === "单位" || key === "计量单位") {
    return pickOption(options, [(option) => option === "件"]) || text
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
  if (key === "填充物种类" || key === "填充物") {
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
  if (key === "材质成分" || key === "京东材质成分") return normalizeMaterialCompositionValue(text, options)
  if (key === "面料多选" || key === "材质多选" || key === "材质成分多选" || key === "里料材质成分含量多选") {
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
      const option = pickOption(options, [
        (option) => option === base,
        (option) => option === rawBase,
        (option) => option === item,
        (option) => item.includes(option) || option.includes(item),
      ])
      if (!option) return ""
      const alias = rawAlias || (item !== option ? item : "")
      return alias && alias !== option ? `${option},${alias}` : option
    }).filter(Boolean)
    if (normalized.length) return uniqueTextValues(normalized).join(";")
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
      (option) => option === "连帽外套",
      (option) => option.includes("外套"),
    ]) || text
  }
  if (key === "功能多选" && /防风|防泼水|透气/.test(text)) {
    const normalized = ["防风", "防泼水", "透气"].map((needle) => (
      text.includes(needle) ? pickOption(options, [(option) => option === needle]) : ""
    )).filter(Boolean)
    if (normalized.length) return normalized.join(";")
  }
  if (key === "安全等级" || key === "安全等级多选") {
    const level = text.match(/[ABC]类?/i)?.[0]?.toUpperCase().replace(/([ABC])$/, "$1类") ?? ""
    if (level) return pickOption(options, [(option) => option === level, (option) => option.startsWith(level)]) || text
  }
  if (key === "尺码表" && text.includes(";")) {
    const normalized = text.split(/[;；]/).map((item) => pickOption(options, [(option) => option === item])).filter(Boolean)
    if (normalized.length) return normalized.join(";")
  }
  if (key === "性别多选") {
    if (["中", "中性", "男女"].some((needle) => text.includes(needle))) return pickOption(options, [(option) => option === "中性", (option) => option === "通用"]) || text
  }
  if (key === "成分含量" && text.includes("100%")) {
    return pickOption(options, [(option) => option === "100%", (option) => option.includes("95%")]) || text
  }
  if (key === "是否带帽" && text.includes("帽")) {
    return pickOption(options, [(option) => option === "连帽", (option) => option.includes("有帽")]) || text
  }
  if (key === "是否库存" && text === "否") {
    return pickOption(options, [(option) => option === "否"]) || text
  }
  if ((key === "衣长" || key === "袖长" || key === "领型" || key === "退款规则" || key === "面料工艺") && text) {
    return pickOption(options, [(option) => option === text, (option) => option.includes(text) || text.includes(option)]) || text
  }
  if (key === "适用人群多选" && /幼童|婴幼童/.test(text)) {
    return pickOption(options, [(option) => option === "幼童", (option) => option === "婴童"]) || text
  }
  if (key === "适用季节" || key === "适用季节多选") {
    return pickOption(options, [(option) => option === "秋季", (option) => option === "秋"]) || text
  }
  if (key === "适用年龄多选") {
    return multiAgeOptionValue(text, options)
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
  if (key.includes("发货方式") && text === "快递") {
    return pickOption(options, [(option) => option === "快递发货", (option) => option.includes("快递")]) || text
  }
  if (key === "上市时间") {
    return seasonOptionValue(text, options) || text
  }
  if (key.includes("适用性别") || key === "性别") {
    if (["中", "中性", "男女"].some((needle) => text.includes(needle))) {
      return pickOption(options, [
        (option) => option === "中性/男女均可",
        (option) => option === "男女通用",
        (option) => option === "通用",
      ]) || text
    }
    if (text.includes("男")) return pickOption(options, [(option) => option.includes("男")]) || text
    if (text.includes("女")) return pickOption(options, [(option) => option.includes("女")]) || text
  }
  if (key.includes("适用年龄") || key.includes("年龄")) {
    const ageOption = singleAgeOptionValue(text, options)
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
  if (/材质|面料/.test(fieldName)) {
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

function semicolonTextValues(value: unknown) {
  return stringValue(value).split(/[;；]/).map((part) => part.trim()).filter(Boolean)
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
  return productArchiveFieldValueMatchesOptions(normalized, options) ? normalized : ""
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
  strategy: ProductArchiveAiFieldStrategy | null
  options: Array<{ value: string; label: string }>
}

const AI_FILL_MIN_CONFIDENCE = 0.7
const AI_FILL_REFERENCE_IMAGE_LIMIT = 4
const AI_FILL_REFERENCE_IMAGE_MAX_BYTES = 4 * 1024 * 1024

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

function buildReferenceImageAiContext(referenceImages: JsonRecord[]) {
  return referenceImages.slice(0, 12).map((image) => ({
    id: Number(image.id),
    file_name: stringValue(image.original_file_name) || stringValue(image.file_name),
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
  for (const image of referenceImages.slice(0, AI_FILL_REFERENCE_IMAGE_LIMIT)) {
    const dataUrl = productArchiveDraftImageDataUrl(image)
    if (!dataUrl) continue
    const imageName = stringValue(image.original_file_name) || stringValue(image.file_name) || `参考图${image.id}`
    imageParts.push({
      type: "text",
      text: `SPU 参考图：${imageName}。用于判断款式、版型、面料观感、颜色和细节元素；仍然只能在有明确视觉证据时填写。`,
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
      const aiRuleFallback = isAiRuleFallbackField(field)
      const emptyValue = !hasValue(valueText) && (!hasValue(valueJson) || aiRuleFallback)
      const validationStatus = stringValue(field.validation_status)
      const invalidValue = validationStatus === "invalid"
      const colorNeedsAiFill = compactFieldKey(field.field_name).includes("颜色") && colorIssueValues.length > 0
      const strategy = productArchiveAiFieldStrategyForField(field.field_name)
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
        sourceType: stringValue(field.source_type),
        strategy,
        needsAiFill: emptyValue || invalidValue || colorNeedsAiFill,
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
    for (const evidenceText of evidenceTexts) {
      const fieldValue = normalizeProductArchiveDeepdrawFieldValue(field.fieldName, evidenceText, field.options)
      if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, field.options)) continue
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

function evidenceRuleValueForField(input: {
  draft: JsonRecord
  field: JsonRecord
  sourceRows: JsonRecord[]
  referenceImages: JsonRecord[]
}) {
  const fieldName = stringValue(input.field.field_name)
  const key = compactFieldKey(fieldName)
  const currentValue = stringValue(input.field.value_text)
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
  if (key === "填充物种类" || key === "填充物") {
    const value = copywritingFillerMaterialValue(input.sourceRows)
    return value ? { value, sourceType: "source_rule", sourceRef: "标准文案表:面料成分", reason: "根据标准文案表面料成分中的填充物归一化" } : null
  }
  if ((key === "是否可开档" || key === "是否开裆" || key === "是否可开裆") && currentValue) {
    return { value: currentValue, sourceType: "source_rule", sourceRef: "字段当前值", reason: "将是否可开档当前值归一到深绘枚举" }
  }
  return null
}

export function buildProductArchiveEvidenceRuleFills(input: {
  draft: JsonRecord
  fields: JsonRecord[]
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
    if (stringValue(field.source_type) === "skip") continue
    const fieldId = Number(field.id)
    const fieldName = stringValue(field.field_name)
    if (!Number.isInteger(fieldId) || fieldId <= 0 || !fieldName) continue
    const rule = evidenceRuleValueForField({
      draft: input.draft,
      field,
      sourceRows: input.sourceRows ?? [],
      referenceImages: input.referenceImages ?? [],
    })
    if (!rule?.value) continue
    const options = fieldOptionsFromTemplate(field.options_json)
    const fieldValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, rule.value, options)
    if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, options)) continue
    fills.push({
      field_id: fieldId,
      field_name: fieldName,
      field_value: fieldValue,
      source_type: rule.sourceType,
      source_ref: rule.sourceRef,
      confidence: 0.96,
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
      "field_strategy.priority 为 P0 的字段优先处理；P1 字段必须优先使用主数据、尺码段、成分或文案证据；P2 字段只在图片/上下文足够明确时补充。",
      "每个字段的 field_strategy.guardrail 是硬约束；违反该边界时省略字段。",
      `confidence 低于 ${AI_FILL_MIN_CONFIDENCE} 的字段不要返回。`,
      "颜色字段如果 current_value 有多个用分号分隔的原颜色名，field_value 返回同数量标准色，按顺序用分号分隔；每个标准色都必须来自 options[].value，系统会自动保留原颜色别名。",
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
          && productArchiveFieldValueMatchesOptions(normalized, field.options),
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

function fieldOptionsLookup(db: SyncPostgresDatabase, draft: JsonRecord) {
  const rows = db.prepare(`
    select field_name, field_id, options_json, required, sale_prop, raw_payload_json
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_id
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id) as JsonRecord[]
  const lookup = new Map<string, { options: unknown[]; required: boolean; rawPayload: JsonRecord }>()
  for (const row of rows) {
    const fieldName = stringValue(row.field_name)
    if (!fieldName || lookup.has(fieldName)) continue
    lookup.set(fieldName, {
      options: arrayValue(row.options_json),
      required: Boolean(row.required),
      rawPayload: recordValue(row.raw_payload_json),
    })
  }
  return lookup
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

function childFieldRequirement(input: { rawPayload?: unknown }) {
  const attributes = recordValue(recordValue(input.rawPayload).attributes)
  const isChildAttr = attributes.isChildAttr === true || stringValue(attributes.isChildAttr).toLowerCase() === "true"
  const parentValue = stringValue(attributes.parentAttrValue)
  const parentAttrs = uniqueTextValues(arrayValue(attributes.parentAttr).flatMap((value) => stringValue(value).split(/[;；,，]/)))
  if (!isChildAttr || !parentValue || parentAttrs.length === 0) return null
  return { parentAttrs, parentValue }
}

function templateChildRequirementActive(template: JsonRecord, fields: JsonRecord[]) {
  const requirement = childFieldRequirement({ rawPayload: template.raw_payload_json ?? template.rawPayload })
  if (!requirement) return true
  for (const parentName of requirement.parentAttrs) {
    const parent = fields.find((field) => stringValue(field.field_name) === parentName)
    const value = stringValue(parent?.value_text)
    if (value === requirement.parentValue) return true
  }
  return false
}

function tradeFieldsForDraft(db: SyncPostgresDatabase, draft: JsonRecord, tradeId = stringValue(draft.trade_id)) {
  if (!tradeId) return []
  return db.prepare(`
    select *
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_name
  `).all(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord[]
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
  const sizeChartMappings = sizeChartMappingsForDraft(db, draft)
  const mdmSkus = mdmSkuRowsForSpu(db, stringValue(draft.spu_code))
  const dateText = sourceFieldValue(sourceRows, "launch_plan", "内容上市时间")
    || sourceFieldValue(sourceRows, "launch_plan", "搜索上市时间")
  const fieldNames = new Set<string>()
  for (const field of tradeFields) fieldNames.add(stringValue(field.field_name))
  for (const rule of rules) fieldNames.add(stringValue(rule.deepdraw_field))

  const fieldTemplateByName = primaryTemplateFieldsByName(tradeFields)
  const ruleByName = new Map(rules.map((rule) => [stringValue(rule.deepdraw_field), rule]))
  const existingByName = new Map(existingFields.map((field) => [stringValue(field.field_name), field]))

  return Array.from(fieldNames).filter(Boolean).map((fieldName) => {
    const rule = ruleByName.get(fieldName) ?? {}
    const template = fieldTemplateByName.get(fieldName) ?? {}
    const existing = existingByName.get(fieldName) ?? {}
    const originCountryField = isProductArchiveOriginCountryField(fieldName)
    const skuSizeField = isProductArchiveSkuSizeFieldName(fieldName)
    const ruleSourceType = stringValue(rule.source_type) || (originCountryField ? "fixed" : "manual")
    const existingManual = Boolean(existing.manual_override)
      && !isStaleUnsupportedAiFillField(fieldName, existing)
      && !isStaleMaterialAiRuleFallbackField(fieldName, existing)
      && !isStaleSizeChartScalarOverride(fieldName, existing)
    const sourceValueText = readSourceValue(spu, rule, sourceRows, fieldName)
    const sizeChartDerived = !existingManual && compactFieldKey(fieldName).includes("尺码表")
      ? buildProductArchiveSizeChartFieldValue({
          fieldName,
          spuCode: stringValue(draft.spu_code),
          sourceRows,
          templateOptions: sizeChartTemplateOptionsForField(template.options_json, existing.value_json, fieldName),
          mappings: sizeChartMappings.filter((mapping) => stringValue(mapping.field_name ?? mapping.fieldName) === fieldName),
        })
      : { valueText: "", valueJson: {}, sourceType: "" }
    const hasSizeChartValue = hasValue(recordValue(sizeChartDerived.valueJson))
    const mdmDerived = existingManual
      ? { valueText: "", valueJson: {} }
      : hasSizeChartValue
        ? { valueText: "", valueJson: sizeChartDerived.valueJson }
        : buildProductArchiveMdmDerivedFieldValue(fieldName, { spu, skus: mdmSkus, dateText })
    const rawValueText = existingManual
      ? stringValue(existing.value_text)
      : skuSizeField
        ? mdmDerived.valueText || sourceValueText
        : sourceValueText || mdmDerived.valueText
    const valueText = normalizeProductArchiveDeepdrawFieldValue(fieldName, rawValueText, arrayValue(template.options_json))
    const valueJson = existingManual ? recordValue(existing.value_json) : mdmDerived.valueJson
    const fieldSourceType = existingManual
      ? (stringValue(existing.source_type) || "manual")
      : hasSizeChartValue
        ? "size_chart"
        : skuSizeField && mdmDerived.valueText
          ? "mdm"
          : ruleSourceType
    const childRequirementActive = templateChildRequirementActive(template, existingFields)
    const required = childRequirementActive && isProductArchiveFieldLocallyRequired(fieldName, {
      templateRequired: template.required,
      templatePresent: hasValue(template.field_name) || hasValue(template.field_id),
      ruleBlocking: rule.blocking,
      sourceType: fieldSourceType,
    })
    const blocking = required
    const missing = blocking && fieldSourceType !== "skip" && !hasValue(valueText) && !hasValue(valueJson)
    const ruleSourceRef = stringValue(rule.mapped_field || rule.source_field || rule.field_source || rule.source_table) || null
    return {
      fieldName,
      fieldId: stringValue(template.field_id) || null,
      sourceType: fieldSourceType,
      sourceRef: hasSizeChartValue
        ? "PLM尺码表"
        : ruleSourceRef || (originCountryField ? "中国" : null),
      valueText: valueText || null,
      valueJson,
      required,
      blocking,
      manualOverride: existingManual,
      validationStatus: fieldSourceType === "skip" ? "skipped" : missing ? "missing" : "valid",
      validationMessage: missing ? "必填字段缺失" : null,
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

function draftImagePreviewUrl(imageId: unknown, options: { thumbnail?: boolean } = {}) {
  const id = Number(imageId)
  if (!Number.isInteger(id) || id <= 0) return null
  const variant = options.thumbnail ? "?variant=thumbnail" : ""
  return `/api/product-archive-drafts/images/${id}/file${variant}`
}

function serializeProductArchiveDraftImage(image: JsonRecord) {
  return {
    ...image,
    preview_url: draftImagePreviewUrl(image.id),
  }
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
}

export function deleteProductArchiveDraftImage(db: SyncPostgresDatabase, draftId: number, imageId: number) {
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
  return {
    draft,
    tradeSelectionDecision: currentTradeSelectionDecision(db, draft),
    launchPlanReference: buildLaunchPlanCategoryReference(sourceRows),
    sizeChartMappings,
    sizeChartSourceRows,
    fields: db.prepare(`
      select field.*, template.options_json, template.field_type
      from product_archive_draft_field field
      left join lateral (
        select options_json, field_type
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
    `).all(draft.tenant_name, draft.merchant_id, draft.trade_id, draftId),
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
        order by case when image.source_type = 'crawshrimp_asset_package' then 0 else 1 end,
          image.sort_no,
          image.id
        limit 1
      ) as thumbnail_image_id,
      (
        select coalesce(image.original_file_name, image.file_name)
        from product_archive_draft_image image
        where image.draft_id = draft.id
        order by case when image.source_type = 'crawshrimp_asset_package' then 0 else 1 end,
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
  const items = (rows as JsonRecord[]).map((row) => ({
    ...row,
    thumbnail_image_url: draftImagePreviewUrl(row.thumbnail_image_id, { thumbnail: true }),
  }))
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
        created_at
      )
      values (?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
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

export function refreshDraftTradeSelectionFromLaunchPlan(
  db: SyncPostgresDatabase,
  draftId: number,
  options: { attempt?: number; tradeCandidates?: JsonRecord[] } = {},
) {
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
    validateProductArchiveDraft(db, draftId)
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
    }, { automaticDecision: evaluated })
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
  validateProductArchiveDraft(db, draftId)
  return {
    autoApplied: false,
    noMatch: true,
    refreshed: Boolean(stringValue(draft.trade_id)),
  }
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
      appendSourceBatchIdToDraft(db, draftId, sourceType, sourceBatchId)

      if (sourceType === "launch_plan") {
        const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
        if (tradeRefresh.autoApplied) autoAppliedTradeCount += 1
        if (tradeRefresh.noMatch) skippedNoTradeMatchCount += 1
        if (tradeRefresh.refreshed) refreshedDraftCount += 1
      } else if (stringValue(draft.trade_id)) {
        rebuildProductArchiveDraftFields(db, draftId)
        validateProductArchiveDraft(db, draftId)
        refreshedDraftCount += 1
      } else {
        validateProductArchiveDraft(db, draftId)
      }
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
    const end = Math.min(start + chunkSize, drafts.length)
    for (let index = start; index < end; index += 1) {
      const draft = drafts[index]
      const draftId = numberValue(draft.id)
      if (draftId === null) continue
      try {
        appendSourceBatchIdToDraft(db, draftId, sourceType, sourceBatchId)

        if (sourceType === "launch_plan") {
          const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
          if (tradeRefresh.autoApplied) autoAppliedTradeCount += 1
          if (tradeRefresh.noMatch) skippedNoTradeMatchCount += 1
          if (tradeRefresh.refreshed) refreshedDraftCount += 1
        } else if (stringValue(draft.trade_id)) {
          rebuildProductArchiveDraftFields(db, draftId)
          validateProductArchiveDraft(db, draftId)
          refreshedDraftCount += 1
        } else {
          validateProductArchiveDraft(db, draftId)
        }
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

  const sourceBatchIds = normalizeSourceBatchIds(input.sourceBatchIds, input.sourceBatchId)
  const sourceBatchIdValues = sourceBatchIdList(sourceBatchIds)
  const sourceRows = sourceBatchIdValues.length > 0
    ? sourceRowsForSpuBatchIds(db, input.spuCode, sourceBatchIdValues)
    : sourceRowsForSpu(db, input.spuCode, input.sourceBatchId)
  const now = nowIso()
  const evaluatedTradeSelection = inferDeepdrawTradeSelectionFromLaunchPlan(db, {
    tenantName,
    merchantId,
    sourceRows,
    skus: skuRows,
    evaluatedAt: now,
  })
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
  const tradeFields = draftTradeId
    ? tradeFieldsForDraft(db, { tenant_name: tenantName, merchant_id: merchantId, trade_id: draftTradeId }, draftTradeId)
    : []

  const sourceBatchId = numberValue(input.sourceBatchId) ?? sourceBatchIds.launch_plan?.[0] ?? null
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
    const fieldRows = fieldInsertData(db, {
      id: draftId,
      spu_code: input.spuCode,
      tenant_name: tenantName,
      merchant_id: merchantId,
      trade_id: draftTradeId,
      source_snapshot_json: jsonText(sourceSnapshot),
    }, tradeFields)
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
      values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, false, ?, ?, ?::timestamptz)
    `)
    for (const field of fieldRows) {
      insertField.run(
        draftId,
        field.fieldName,
        field.fieldId,
        field.sourceType,
        field.sourceRef,
        field.valueText,
        jsonText(field.valueJson),
        field.required,
        field.blocking,
        field.validationStatus,
        field.validationMessage,
        now,
      )
    }

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
        input.spuCode,
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
    return draftId
  })()

  validateProductArchiveDraft(db, result)
  return serializeDraftDetail(db, result)
}

export function applyProductArchiveDraftTrade(
  db: SyncPostgresDatabase,
  draftId: number,
  input: ApplyTradeInput,
  options: { automaticDecision?: TradeSelectionDecision } = {},
) {
  const draft = draftById(db, draftId)
  const tradeId = stringValue(input.tradeId)
  if (!tradeId) throw new Error("请选择深绘类目")
  if (options.automaticDecision && hasHumanTradeSelection(draft.source_snapshot_json)) {
    return {
      ...validateProductArchiveDraft(db, draftId),
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
  return db.transaction(() => {
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
          ...validateProductArchiveDraft(db, draftId),
          tradeSelectionAutoApplied: false,
        }
      }
      throw new Error("草稿数据已更新，请刷新后重试")
    }
    rebuildProductArchiveDraftFields(db, draftId)
    const result = validateProductArchiveDraft(db, draftId)
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
  const now = nowIso()
  db.transaction(() => {
    for (const field of input.fields ?? []) {
      const fieldName = stringValue(field.fieldName ?? field.field_name)
      const valueText = field.valueText ?? field.value_text ?? null
      const valueJson = field.valueJson ?? field.value_json ?? {}
      if (field.id) {
        db.prepare(`
          update product_archive_draft_field
          set value_text = ?,
            value_json = ?::jsonb,
            manual_override = true,
            updated_at = ?::timestamptz
          where draft_id = ? and id = ?
        `).run(valueText, jsonText(valueJson), now, draftId, field.id)
      } else if (fieldName) {
        db.prepare(`
          update product_archive_draft_field
          set value_text = ?,
            value_json = ?::jsonb,
            manual_override = true,
            updated_at = ?::timestamptz
          where draft_id = ? and field_name = ?
        `).run(valueText, jsonText(valueJson), now, draftId, fieldName)
      }
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()
  return validateProductArchiveDraft(db, draftId)
}

export async function fillProductArchiveDraftFieldsWithAi(db: SyncPostgresDatabase, draftId: number, options: AiFillOptions = {}) {
  rebuildProductArchiveDraftFields(db, draftId)
  const detail = validateProductArchiveDraft(db, draftId).detail
  const draft = detail.draft as JsonRecord
  const fields = detail.fields as JsonRecord[]
  const skus = detail.skus as JsonRecord[]
  const issues = detail.issues as JsonRecord[]
  const referenceImages = detail.images as JsonRecord[] ?? []
  const sourceRows = referenceSourceRowsForDraft(db, draft)
  const mdmSpu = resolveProductArchiveDraftSpu(db, draft)
  const candidates = buildProductArchiveAiFillCandidateFields(fields, issues, skus)
  const evidenceRuleFills = buildProductArchiveEvidenceRuleFills({
    draft,
    fields,
    sourceRows,
    referenceImages,
  })
  const evidenceRuleFillById = new Map(evidenceRuleFills.map((fill) => [Number(fill.field_id), fill]))
  const aiFillCandidates = candidates.filter((field) => !evidenceRuleFillById.has(field.id))
  const warnings: ProductArchiveAiFillWarning[] = []

  if (candidates.length === 0 && evidenceRuleFills.length === 0) {
    return { saved: [], detail, warnings }
  }
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
  let aiFills: JsonRecord[] = []
  if (aiCandidates.length > 0) {
    try {
      aiFills = await callDeepdrawAiFill(db, prompt, aiCandidates, referenceImages, options)
    } catch (error) {
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
  const aiById = new Map(aiFills.map((fill) => [Number(fill.field_id), fill]))
  const now = nowIso()
  const saved: Array<{ field_id: number; field_name: string; field_value: string; source: string; confidence: number | null }> = []
  const updateField = db.prepare(`
    update product_archive_draft_field
    set value_text = ?,
      value_json = ?::jsonb,
      source_type = ?,
      source_ref = ?,
      manual_override = true,
      validation_status = 'valid',
      validation_message = null,
      updated_at = ?::timestamptz
    where draft_id = ? and id = ?
  `)

  db.transaction(() => {
    for (const fill of evidenceRuleFills) {
      updateField.run(
        fill.field_value,
        jsonText({
          evidence_rule: {
            field_name: fill.field_name,
            confidence: fill.confidence,
            reason: fill.reason,
            applied_at: now,
          },
          source: "EVIDENCE_RULE",
        }),
        fill.source_type,
        fill.source_ref,
        now,
        draftId,
        fill.field_id,
      )
      saved.push({
        field_id: fill.field_id,
        field_name: fill.field_name,
        field_value: fill.field_value,
        source: "EVIDENCE_RULE",
        confidence: fill.confidence,
      })
    }
    for (const field of candidates) {
      if (evidenceRuleFillById.has(field.id)) continue
      const materialFill = materialEvidenceById.get(field.id)
      const aiFill = materialFill ?? aiById.get(field.id)
      if (!aiFill) continue
      const confidence = Number(aiFill.confidence)
      if (!Number.isFinite(confidence) || confidence < AI_FILL_MIN_CONFIDENCE) continue
      const aiValue = stringValue(aiFill.field_value)
      const fieldValue = materialFill
        ? aiValue
        : normalizeProductArchiveAiFillValue(field.fieldName, field.currentValue, aiValue, field.options)
      if (!fieldValue || !productArchiveFieldValueMatchesOptions(fieldValue, field.options)) continue
      updateField.run(
        fieldValue,
        jsonText(materialFill
          ? {
              material_composition_rule: materialFill,
              source: "MATERIAL_COMPOSITION_RULE",
            }
          : {
              ai_fill: aiFill,
              field_strategy: field.strategy,
              source: "AI_SUGGESTED",
            }),
        materialFill ? "source_rule" : "ai",
        null,
        now,
        draftId,
        field.id,
      )
      saved.push({
        field_id: field.id,
        field_name: field.fieldName,
        field_value: fieldValue,
        source: materialFill ? "MATERIAL_COMPOSITION_RULE" : "AI_SUGGESTED",
        confidence,
      })
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()

  const validated = validateProductArchiveDraft(db, draftId)
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
  return sizeChartTemplateFieldsForDraft(db, draft).map((template) => buildProductArchiveSizeChartFieldValue({
    fieldName: template.fieldName,
    spuCode: stringValue(draft.spu_code),
    sourceRows,
    templateOptions: template.options,
    mappings: mappings.filter((mapping) => stringValue(mapping.fieldName ?? mapping.field_name) === template.fieldName),
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
  const draft = draftById(db, draftId)
  const mappings = Array.isArray(input.mappings) ? input.mappings : []
  const now = nowIso()
  const saved: JsonRecord[] = []
  db.transaction(() => {
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
  })()
  if (input.applyToDraft) {
    rebuildProductArchiveDraftFields(db, draftId)
    const validated = validateProductArchiveDraft(db, draftId)
    return { draftId, saved, detail: validated.detail }
  }
  return { draftId, saved }
}

function sizeChartAllowedSizes(_fields: JsonRecord[], skus: JsonRecord[]) {
  return draftSkuSizeValues(skus)
}

export function validateProductArchiveDraft(db: SyncPostgresDatabase, draftId: number) {
  const draft = draftById(db, draftId)
  const fields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const skus = db.prepare("select * from product_archive_draft_sku where draft_id = ?").all(draftId) as JsonRecord[]
  const templateLookup = fieldOptionsLookup(db, draft)
  const issues: Array<{ severity: string; issueType: string; fieldName?: string | null; skuCode?: string | null; message: string }> = []
  const now = nowIso()

  if (!stringValue(draft.spu_code)) issues.push({ severity: "blocker", issueType: "missing_spu_code", message: "缺少款号" })
  if (!stringValue(draft.title)) issues.push({ severity: "blocker", issueType: "missing_title", message: "缺少商品标题" })
  if (!stringValue(draft.trade_id)) issues.push({ severity: "blocker", issueType: "missing_trade_id", message: "缺少深绘类目" })
  if (stringValue(draft.trade_id) && templateLookup.size === 0) {
    issues.push({ severity: "blocker", issueType: "deepdraw_template_missing", message: "缺少深绘类目字段模板，请先同步字段" })
  }
  if (recordValue(draft.duplicate_result_json).duplicateFound === true) {
    issues.push({ severity: "blocker", issueType: "duplicate_product_found", message: "深绘已存在同货号商品，当前版本不覆盖更新" })
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
    })
    const blocking = required
    const options = template?.options ?? []
    let status: string
    let message = ""
    if (stringValue(field.source_type) === "skip") {
      status = "skipped"
    } else if (blocking && !hasValue(value)) {
      status = "missing"
      message = "必填字段缺失"
      issues.push({ severity: "blocker", issueType: "required_field_missing", fieldName, message })
    } else if (options.length && hasValue(value)) {
      if (!productArchiveFieldValueMatchesOptions(value, options)) {
        status = "invalid"
        message = "字段值不在深绘模板选项中"
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
    .flatMap(([, template]) => template.options.map(optionText).filter(Boolean))
  const allowedColors = new Set(colorOptions)
  const allowedSizes = new Set(sizeOptions)
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
    if (!isStructuredProductPayloadField(field)) continue
    issues.push(...validateProductArchiveSizeChartValue({
      fieldName,
      valueJson: field.value_json,
      allowedSizes: allowedSizeChartSizes,
      blocking: Boolean(field.blocking) || Boolean(field.required),
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
    } else if (allowedSizes.size) {
      const sizeCandidates = [
        stringValue(sku.size_name),
        stringValue(sku.size_code),
        deepdrawSizeValue(sku.size_name),
        deepdrawSizeValue(sku.size_code),
      ].filter(Boolean)
      if (!sizeCandidates.some((size) => allowedSizes.has(size))) {
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

  db.transaction(() => {
    db.prepare("delete from product_archive_validation_issue where draft_id = ?").run(draftId)
    const insertIssue = db.prepare(`
      insert into product_archive_validation_issue(draft_id, severity, issue_type, field_name, sku_code, message)
      values (?, ?, ?, ?, ?, ?)
    `)
    for (const issue of issues) {
      insertIssue.run(draftId, issue.severity, issue.issueType, issue.fieldName ?? null, issue.skuCode ?? null, issue.message)
    }
    db.prepare(`
      update product_archive_draft
      set status = ?,
        validation_summary_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
    `).run(status, jsonText(summary), now, draftId)
  })()

  return { status, summary, issues, detail: serializeDraftDetail(db, draftId) }
}

function isStructuredProductPayloadField(field: JsonRecord) {
  const key = compactFieldKey(field.field_name)
  const fieldType = stringValue(field.field_type).toUpperCase()
  const isStructuredType = fieldType === "MULTI_TEXT" || (!fieldType && Boolean(stringValue(field.field_id)))
  return isStructuredType && (key === "多平台尺码" || key.includes("尺码表"))
}

function isUnsupportedAiFillField(fieldName: unknown) {
  const key = compactFieldKey(fieldName)
  return key === "多平台尺码" || key.includes("尺码表") || isProductArchiveSkuSizeFieldName(fieldName)
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

export function productArchivePayloadFieldValue(field: JsonRecord) {
  const jsonValue = recordValue(field.value_json)
  if (isProductArchiveStructuredSizeFieldName(field.field_name)) {
    const fieldType = stringValue(field.field_type).toUpperCase()
    if (hasProductArchiveSizeChartTableValue(jsonValue)) return isStructuredProductPayloadField(field) ? jsonValue : null
    if (!fieldType || fieldType === "MULTI_TEXT") return null
  }
  const text = stringValue(field.value_text)
  if (text) return text
  return hasValue(jsonValue) ? jsonValue : null
}

function productPayload(db: SyncPostgresDatabase, draftId: number) {
  const detail = serializeDraftDetail(db, draftId)
  const draft = detail.draft as JsonRecord
  const sourceRows = sourceRowsForDraft(db, draft)
  const fields = (detail.fields as JsonRecord[])
    .filter((field) => stringValue(field.source_type) !== "skip")
    .map((field) => ({
      id: stringValue(field.field_id) || undefined,
      name: stringValue(field.field_name),
      fieldType: stringValue(field.field_type) || undefined,
      value: productArchivePayloadFieldValue(field),
    }))
    .filter((field) => hasValue(field.value))
  return {
    code: stringValue(draft.spu_code),
    title: stringValue(draft.title),
    tradeId: stringValue(draft.trade_id),
    retailPrice: numberValue(draft.retail_price),
    date: buildProductArchivePayloadDate(sourceRows),
    fields,
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
  operation: "search" | "create" | "resource" | "dry_run",
  result: Partial<DeepdrawResult> & { requestSummary?: unknown; productId?: string | null; responseReason?: string | null } = {},
) {
  const payload = recordValue(result.payload)
  const business = deepdrawBusinessResult(payload)
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
    (result.responseReason ?? business.reason) || null,
    (result.requestId ?? business.requestId) || null,
    result.productId ?? (stringValue(business.body.productId) || null),
    jsonText(sanitizeDeepdrawLogPayload(payload)),
  )
}

function assertDeepdrawProductArchiveSuccess(result: DeepdrawResult, type: string) {
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
    throw new Error(`DeepDraw ${type} failed: ${business.reason || result.status}`)
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
  if (!productNotFound) assertDeepdrawProductArchiveSuccess(result, "search")
  const records = productNotFound ? [] : duplicateRecords(result.payload)
  const duplicateFound = records.length > 0
  const summary = {
    duplicateFound,
    records,
    checkedAt: nowIso(),
    requestId: result.requestId ?? null,
  }
  db.transaction(() => {
    writeSubmitLog(db, draftId, "search", {
      ...result,
      requestSummary: { spuCode: draft.spu_code, tenantName: draft.tenant_name },
    })
    db.prepare(`
      update product_archive_draft
      set status = case when ? then 'duplicate_found' else status end,
        duplicate_result_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
    `).run(duplicateFound, jsonText(sanitizeDeepdrawLogPayload(summary)), nowIso(), draftId)
  })()
  return summary
}

/** Atomically reserves a draft for the remote create call.
 *
 * A transport timeout leaves the row in `submitting`, which is intentionally
 * outside the claimable statuses so a retry cannot blindly create a duplicate.
 */
export function claimProductArchiveDraftForSubmit(db: SyncPostgresDatabase, draftId: number, now = nowIso()) {
  return db.prepare(`
    update product_archive_draft
    set status = 'submitting',
      updated_at = ?::timestamptz
    where id = ?
      and status in ('draft', 'missing_fields', 'manual_review', 'ready', 'update_pending')
    returning *
  `).get(now, draftId) as JsonRecord | undefined
}

export async function submitProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
  rebuildProductArchiveDraftFields(db, draftId)
  const validation = validateProductArchiveDraft(db, draftId)
  const payload = productPayload(db, draftId)
  const summary = { fieldCount: payload.fields.length, skuCount: payload.skus.length }
  if (options.dryRun) {
    writeSubmitLog(db, draftId, "dry_run", { requestSummary: summary, status: 200, payload: { dryRun: true } })
    return { dryRun: true, payload, summary }
  }
  if (validation.summary.blocker_count > 0) {
    throw new Error("草稿存在阻断问题，不能提交")
  }
  const duplicate = await checkDuplicateProductArchiveDraft(db, draftId, options)
  if (duplicate.duplicateFound) return { duplicateFound: true, duplicate }

  const draft = draftById(db, draftId)
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
  const claimedDraft = claimProductArchiveDraftForSubmit(db, draftId)
  if (!claimedDraft) {
    const currentDraft = draftById(db, draftId)
    return {
      alreadySubmitting: stringValue(currentDraft?.status) === "submitting",
      status: stringValue(currentDraft?.status),
      draftId,
    }
  }
  let result: DeepdrawResult
  try {
    result = await runCreate(payload)
  } catch (error) {
    const createError = error instanceof Error ? error : new Error(String(error))
    db.transaction(() => {
      writeSubmitLog(db, draftId, "create", {
        requestSummary: summary,
        responseReason: createError.message,
      })
      // Transport uncertainty intentionally does not set status = 'failed':
      // the submitting claim blocks blind duplicate creates until reconciliation.
      db.prepare(`
        update product_archive_draft
        set duplicate_result_json = jsonb_set(coalesce(duplicate_result_json, '{}'::jsonb), '{submit_transport_unknown}', to_jsonb(?::text), true),
          updated_at = ?::timestamptz
        where id = ?
          and status = 'submitting'
      `).run(createError.message, nowIso(), draftId)
    })()
    throw createError
  }
  const body = deepdrawBusinessResult(result.payload).body
  const productId = stringValue(body.productId ?? body.id)
  let createError: Error | null = null
  try {
    assertDeepdrawProductArchiveSuccess(result, "create")
  } catch (error) {
    createError = error instanceof Error ? error : new Error(String(error))
  }
  db.transaction(() => {
    writeSubmitLog(db, draftId, "create", { ...result, requestSummary: summary, productId })
    db.prepare(`
      update product_archive_draft
      set status = ?,
        created_product_id = ?,
        created_product_code = ?,
        updated_at = ?::timestamptz
      where id = ?
    `).run(createError ? "failed" : "created", productId || null, stringValue(body.code) || stringValue(payload.code), nowIso(), draftId)
  })()
  if (createError) throw createError
  return await readbackProductArchiveDraft(db, draftId, options)
}

export async function readbackProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const draft = draftById(db, draftId)
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
  const result = await runReadback()
  const body = deepdrawBusinessResult(result.payload).body
  const titleMatches = !stringValue(draft.title) || !stringValue(body.title) || stringValue(draft.title) === stringValue(body.title)
  const status = result.ok && titleMatches ? "readback_verified" : "readback_mismatch"
  db.transaction(() => {
    writeSubmitLog(db, draftId, "resource", {
      ...result,
      requestSummary: { spuCode: draft.spu_code },
      productId: stringValue(body.productId ?? body.id) || stringValue(draft.created_product_id) || null,
    })
    db.prepare(`
      update product_archive_draft
      set status = ?,
        updated_at = ?::timestamptz
      where id = ?
    `).run(status, nowIso(), draftId)
  })()
  return { ok: result.ok, status, result }
}

export function listProductArchiveSubmitLogs(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select *
    from product_archive_submit_log
    where draft_id = ?
    order by created_at desc, id desc
  `).all(draftId)
}
