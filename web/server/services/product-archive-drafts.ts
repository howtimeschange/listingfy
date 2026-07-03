import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
} from "../../../scripts/lib/product_archive_source_importer.mjs"
import {
  createDeepdrawProduct,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
} from "../../../scripts/lib/deepdraw_client.mjs"
import { resolveAiConfig } from "../../../scripts/lib/ai_category_matcher.mjs"

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
}

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
  if (["field_mapping", "launch_plan", "copywriting"].includes(sourceType)) return sourceType
  throw new Error("sourceType must be field_mapping, launch_plan, or copywriting")
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
  const sizes = uniqueTextValues(skus.map((sku) => deepdrawSizeValue(sku.size_name)))
  if (!sizes.length) return {}
  const output: JsonRecord = { title: SIZE_TABLE_TITLE }
  for (const size of sizes) {
    const height = size.match(/^(\d+)/)?.[1] ?? "0"
    output[size] = [height, "0", "0", "0"].join(",")
  }
  return output
}

function baseColorName(value: unknown) {
  const text = stringValue(value)
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
    搜索标题: ["搜索标题", "商品标题", "标题"],
    内容平台标题: ["内容平台标题", "内容标题"],
    细节文案: ["细节文案", "细节文案（不限定8个字，细节数量3-4个）"],
    材质成分: ["材质成分", "面料成分"],
    面料成分: ["面料成分", "材质成分"],
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
  return PRODUCT_ARCHIVE_ALWAYS_BLANK_FIELDS.has(key)
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
  const composition = copywritingValue(sourceRows, "面料成分") || copywritingValue(sourceRows, "材质成分")
  const match = composition.match(/面料[:：]\s*([0-9.]+%)/)
  return match?.[1] ?? (composition.match(/([0-9.]+%)/)?.[1] ?? "")
}

function materialCompositionInputText(value: unknown) {
  const text = stringValue(value).replace(/\u00a0/g, " ")
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return text
  const cleaned = lines
    .filter((line) => !/^成分[:：]?$/.test(line))
    .map((line) => line.replace(/^(面料|主面料|材质|成分)\s*[:：]\s*/, "").trim())
    .filter(Boolean)
  if (!cleaned.length) return ""
  const [primary, ...rest] = cleaned
  if (rest.length > 0 && rest.every((line) => /^[（(].*除外.*[）)]$/.test(line))) {
    return `${primary}${rest.join("")}`
  }
  return cleaned.join("；")
}

function materialCompositionText(sourceRows: JsonRecord[]) {
  return materialCompositionInputText(
    copywritingValue(sourceRows, "面料成分")
      || copywritingValue(sourceRows, "材质成分")
      || launchValue(sourceRows, "面料成分")
      || launchValue(sourceRows, "材质成分"),
  )
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
  const sourceRows = input.sourceRows ?? []
  if (isProductArchiveBusinessBlankField(fieldName, input.spu, sourceRows)) return ""
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return materialCompositionText(sourceRows)
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
  if (key === "选择期数") return launchValue(sourceRows, "产品季") || stringValue(input.spu.season_name) || stringValue(input.spu.year)
  if (key === "京东材质成分" || key === "材质多选" || key === "材质成分多选" || key === "面料俗称") return copywritingValue(sourceRows, "面料成分")
  if (key === "厚薄") return copywritingValue(sourceRows, "厚薄")
  if (key === "分类" || key === "类型") return "外套"
  if (key === "品牌单选") return stringValue(input.spu.brand_name) || "巴拉巴拉"
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
  if (key === "快手标题" || key === "拼多多标题") return copywritingValue(sourceRows, "搜索标题")
  if (key === "计量单位") return stringValue(input.spu.unit_name) || "件"
  if (key === "是否跨境出口专供货源" || key === "是否加绒" || key === "是否可开档" || key === "是否开裆") return "否"
  if (key === "是否可定制") return "不可定制"
  if (key === "售后服务承诺") return "不设置"
  if (key === "balaone仅专供新品") return launchValue(sourceRows, "属性").includes("专供新品") ? "是" : ""
  if (key === "填充物种类") return stringValue(input.spu.filler) || launchValue(sourceRows, "填充物") || "无"
  if (key === "款式" || key === "款式多选" || key === "款式单选") return launchValue(sourceRows, "主款式 （唯品四级品类）") || stringValue(input.spu.spu_name)
  if (key === "袖长多选") return "长袖"
  if (key === "袖长") return "长袖"
  if (key === "衣长") return "常规"
  if (key === "腰型" || key === "裤长" || key === "裤门襟") return "不适用"
  if (key === "童装产地多选") return "中国大陆"
  if (key === "适用场合") return "日常"
  if (key === "退款规则") return "支持7天无理由退货"
  if (key === "适用人群多选") return launchValue(sourceRows, "年龄段") || stringValue(input.spu.age_group_name)
  if (key === "适用季节" || key === "适用季节多选") return "秋季"
  if (key === "适用年龄" || key === "适用年龄多选") return applicableAgeText(input.spu, sourceRows) || launchValue(sourceRows, "年龄段") || stringValue(input.spu.age_group_name)
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
  if (key === "货号" || key === "款号") {
    return { valueText: stringValue(input.spu.spu_code), valueJson: {} }
  }
  if (key === "价格" || key === "吊牌价格" || key === "吊牌价") {
    return { valueText: moneyText(input.spu.price_tag), valueJson: {} }
  }
  if (key === "上市时间") {
    return { valueText: stringValue(input.dateText), valueJson: {} }
  }
  if (key === "颜色") {
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
  return db.prepare(`
    select source.*
    from product_archive_source_row source
    where ${where.join(" and ")}
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(...params) as JsonRecord[]
}

function sourceRowsForSpuBatchIds(db: SyncPostgresDatabase, spuCode: string, sourceBatchIds: number[]) {
  const batchIds = Array.from(new Set(sourceBatchIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (batchIds.length === 0) return sourceRowsForSpu(db, spuCode, null)
  return db.prepare(`
    select source.*
    from product_archive_source_row source
    where source.spu_code = ?
      and source.source_batch_id in (${batchIds.map(() => "?").join(", ")})
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(spuCode, ...batchIds) as JsonRecord[]
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
  if (!current.includes(sourceBatchId)) current.push(sourceBatchId)
  byType[sourceType] = current
  next.sourceBatchIds = byType
  if (!numberValue(next.sourceBatchId) && sourceType === "launch_plan") {
    next.sourceBatchId = sourceBatchId
  }
  return next
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

function launchPlanCategoryValues(sourceRows: JsonRecord[]) {
  const values: Array<{ field: string; value: string }> = []
  const seen = new Set<string>()
  for (const row of sourceRows) {
    if (stringValue(row.source_type) !== "launch_plan") continue
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
  for (const field of LAUNCH_PLAN_CATEGORY_REFERENCE_FIELDS) {
    const values: string[] = []
    for (const row of sourceRows) {
      if (stringValue(row.source_type) !== "launch_plan") continue
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
  const pathBoost = /blbl&mini/i.test(candidatePath) ? 80 : candidatePathText.includes("童装服饰") ? 40 : 0
  const boost = fieldBoost + pathBoost
  if (candidatePathText === categoryText) return 1000 + boost
  if (candidateNameText === categoryText) return 850 + boost
  if (candidateNameText && candidateNameText === categoryLeaf) return 760 + boost
  if (candidatePathText.endsWith(`>${categoryLeaf}`) || candidatePathText === categoryLeaf) return 720 + boost
  if (categoryLeaf && candidatePathText.includes(categoryLeaf)) return 520 + boost
  if (categoryLeaf && candidateLeaf && categoryLeaf.includes(candidateLeaf)) return 500 + boost
  if (categoryLeaf && candidateNameText && categoryLeaf.includes(candidateNameText)) return 480 + boost
  return 0
}

export function chooseDeepdrawTradeFromLaunchPlanRows(sourceRows: JsonRecord[], trades: JsonRecord[]) {
  const categories = launchPlanCategoryValues(sourceRows)
  if (categories.length === 0 || trades.length === 0) return null
  let best: {
    trade: JsonRecord
    category: { field: string; value: string }
    score: number
  } | null = null
  let tied = false
  for (const trade of trades) {
    for (const category of categories) {
      const score = scoreTradeMatch(trade, category)
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = { trade, category, score }
        tied = false
      } else if (score === best.score) {
        tied = true
      }
    }
  }
  if (!best || tied) return null
  return {
    tradeId: stringValue(best.trade.trade_id),
    tradePath: stringValue(best.trade.trade_path) || stringValue(best.trade.trade_name),
    confidence: best.score >= 1000 ? "high" : "medium",
    matchedField: best.category.field,
    matchedValue: best.category.value,
  }
}

function inferDeepdrawTradeFromLaunchPlan(db: SyncPostgresDatabase, input: {
  tenantName: string
  merchantId: string
  sourceRows: JsonRecord[]
}) {
  const trades = db.prepare(`
    select trade_id, trade_name, trade_path
    from deepdraw_trade_cache
    where tenant_name = ?
      and merchant_id = ?
  `).all(input.tenantName, input.merchantId) as JsonRecord[]
  return chooseDeepdrawTradeFromLaunchPlanRows(input.sourceRows, trades)
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

function extractJsonText(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1)
  return trimmed
}

function responseMessageContent(body: unknown) {
  const message = (body as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message
  const values = [message?.content, message?.reasoning_content, message?.reasoning]
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string" ? part : stringValue((part as JsonRecord)?.text ?? (part as JsonRecord)?.content))
        .join("\n")
        .trim()
      if (text) return text
    } else if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
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

export function normalizeProductArchiveDeepdrawFieldValue(fieldName: string, value: unknown, options: unknown[]) {
  const text = stringValue(value)
  const key = compactFieldKey(fieldName)
  if (key === "材质成分文本" || key === "面料成分文本" || key === "成分含量文本") return text
  if (!text || !options.length) return text
  const exact = pickOption(options, [(option) => option === text])
  if (exact) return exact
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

export function chooseProductArchiveAiFallbackOption(
  fieldName: string,
  currentValue: unknown,
  options: Array<{ value: string; label: string }>,
  contextText = "",
) {
  const evidenceText = `${stringValue(currentValue)} ${contextText}`
  const pick = (needles: string[]) => {
    for (const needle of needles) {
      const option = options.find((item) => item.value.includes(needle) || item.label.includes(needle))
      if (option) return option.value
    }
    return ""
  }
  if (/材质|面料/.test(fieldName)) {
    if (/棉/.test(evidenceText)) return pick(["纯棉(棉含量100%)", "棉100%", "纯棉", "棉"])
    if (/聚酯纤维|涤纶/.test(evidenceText)) return pick(["聚酯纤维", "涤纶"])
  }
  if (/功能/.test(fieldName)) {
    const functionNeedles: Array<[RegExp, string[]]> = [
      [/防风/, ["防风"]],
      [/防水|防泼水/, ["防水", "防泼水"]],
      [/透气|透湿/, ["透气"]],
      [/抗皱/, ["抗皱"]],
      [/抗起球/, ["抗起球"]],
      [/凉感/, ["凉感"]],
      [/保暖/, ["保暖"]],
      [/速干/, ["速干"]],
      [/吸汗/, ["吸汗"]],
      [/抗菌/, ["抗菌"]],
      [/防晒|防紫外线/, ["防晒", "防紫外线"]],
    ]
    for (const [pattern, needles] of functionNeedles) {
      if (pattern.test(evidenceText)) return pick(needles)
    }
    return pick(["其他"])
  }
  if (/是否|有无|支持|加绒|撞色|透明|防水|防晒/.test(fieldName)) return pick(["否", "不支持", "无"]) || options[0]?.value || ""
  if (/风格|企划/.test(fieldName)) return pick(["休闲", "日常", "基础"]) || options[0]?.value || ""
  if (/年龄|适用人群|人群/.test(fieldName)) return pick(["儿童", "中大童", "婴幼儿", "幼童"]) || options[0]?.value || ""
  if (/季节/.test(fieldName)) {
    if (/羽绒|棉服|毛衣|加绒/.test(evidenceText)) return pick(["冬", "秋冬"])
    if (/短袖|凉感|夏/.test(evidenceText)) return pick(["夏", "春夏"])
    return pick(["春秋", "四季"]) || options[0]?.value || ""
  }
  if (/单位/.test(fieldName)) return pick(["件", "条", "双", "套"]) || options[0]?.value || ""
  return options[0]?.value || ""
}

type ProductArchiveAiFillCandidate = {
  id: number
  fieldName: string
  currentValue: string
  validationStatus: string
  validationMessage: string
  options: Array<{ value: string; label: string }>
}

export function buildProductArchiveAiFillCandidateFields(fields: JsonRecord[]): ProductArchiveAiFillCandidate[] {
  return fields
    .map((field) => {
      const valueText = stringValue(field.value_text)
      const valueJson = recordValue(field.value_json)
      const emptyValue = !hasValue(valueText) && !hasValue(recordValue(field.value_json))
      const validationStatus = stringValue(field.validation_status)
      const invalidValue = validationStatus === "invalid"
      const currentValue = valueText || (hasValue(valueJson) ? JSON.stringify(valueJson) : "")
      return {
        id: Number(field.id),
        fieldName: stringValue(field.field_name),
        currentValue,
        validationStatus,
        validationMessage: stringValue(field.validation_message),
        sourceType: stringValue(field.source_type),
        needsAiFill: emptyValue || invalidValue,
        options: fieldOptionsFromTemplate(field.options_json),
      }
    })
    .filter((field) => (
      Number.isInteger(field.id)
      && field.fieldName
      && field.options.length > 0
      && field.needsAiFill
      && field.sourceType !== "skip"
    ))
    .map((field) => ({
      id: field.id,
      fieldName: field.fieldName,
      currentValue: field.currentValue,
      validationStatus: field.validationStatus,
      validationMessage: field.validationMessage,
      options: field.options,
    }))
}

function buildDeepdrawAiFillPrompt(input: {
  draft: JsonRecord
  fields: ProductArchiveAiFillCandidate[]
  skus: JsonRecord[]
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
      "证据不足时选择保守通用值，并降低 confidence。",
      "是否类字段没有明确证据时优先选择否/无。",
    ],
    product: {
      spu_code: input.draft.spu_code,
      title: input.draft.title,
      trade_path: input.draft.trade_path,
      retail_price: input.draft.retail_price,
      source_snapshot: input.draft.source_snapshot_json,
      skus: input.skus.map((sku) => ({
        sku_code: sku.sku_code,
        skc_code: sku.skc_code,
        color_name: sku.color_name,
        size_name: sku.size_name,
      })),
    },
    fields: input.fields.map((field) => ({
      field_id: field.id,
      field_name: field.fieldName,
      current_value: field.currentValue,
      validation_status: field.validationStatus,
      validation_message: field.validationMessage,
      options: field.options.slice(0, 120),
    })),
  }, null, 2)
}

async function callDeepdrawAiFill(prompt: string, options: AiFillOptions = {}) {
  const config = resolveAiConfig()
  if (!config.apiKey) return []
  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是深绘商品建档字段专家，负责在给定枚举值里做保守选择。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`DeepDraw AI fill failed: HTTP ${response.status}`)
    const text = responseMessageContent(payload)
    const json = JSON.parse(extractJsonText(text))
    return Array.isArray(json.fills) ? json.fills as JsonRecord[] : []
  } finally {
    clearTimeout(timeout)
  }
}

function draftById(db: SyncPostgresDatabase, draftId: number) {
  const draft = db.prepare("select * from product_archive_draft where id = ?").get(draftId) as JsonRecord | undefined
  if (!draft) throw new Error(`建档草稿不存在：${draftId}`)
  return draft
}

function fieldOptionsLookup(db: SyncPostgresDatabase, draft: JsonRecord) {
  const rows = db.prepare(`
    select field_name, options_json, required
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id) as JsonRecord[]
  const lookup = new Map<string, { options: unknown[]; required: boolean }>()
  for (const row of rows) {
    lookup.set(stringValue(row.field_name), {
      options: arrayValue(row.options_json),
      required: Boolean(row.required),
    })
  }
  return lookup
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

export function fieldMappingRulesForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  try {
    const spu = db.prepare(`
      select product_line_name, product_type_name, middle_class_name, subclass_name, age_group_name, spu_name
      from product_spu
      where spu_code = ?
    `).get(draft.spu_code) as JsonRecord | undefined
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
  const spu = db.prepare("select * from product_spu where spu_code = ?").get(draft.spu_code) as JsonRecord | undefined
  if (!spu) throw new Error(`MDM 款号不存在：${draft.spu_code}`)
  const rules = fieldMappingRulesForDraft(db, draft)
  const sourceRows = sourceRowsForDraft(db, draft)
  const mdmSkus = mdmSkuRowsForSpu(db, stringValue(draft.spu_code))
  const dateText = sourceFieldValue(sourceRows, "launch_plan", "内容上市时间")
    || sourceFieldValue(sourceRows, "launch_plan", "搜索上市时间")
  const fieldNames = new Set<string>()
  for (const field of tradeFields) fieldNames.add(stringValue(field.field_name))
  for (const rule of rules) fieldNames.add(stringValue(rule.deepdraw_field))

  const fieldTemplateByName = new Map(tradeFields.map((field) => [stringValue(field.field_name), field]))
  const ruleByName = new Map(rules.map((rule) => [stringValue(rule.deepdraw_field), rule]))
  const existingByName = new Map(existingFields.map((field) => [stringValue(field.field_name), field]))

  return Array.from(fieldNames).filter(Boolean).map((fieldName) => {
    const rule = ruleByName.get(fieldName) ?? {}
    const template = fieldTemplateByName.get(fieldName) ?? {}
    const existing = existingByName.get(fieldName) ?? {}
    const sourceType = stringValue(rule.source_type) || "manual"
    const existingManual = Boolean(existing.manual_override)
    const sourceValueText = readSourceValue(spu, rule, sourceRows, fieldName)
    const mdmDerived = existingManual
      ? { valueText: "", valueJson: {} }
      : buildProductArchiveMdmDerivedFieldValue(fieldName, { spu, skus: mdmSkus, dateText })
    const rawValueText = existingManual
      ? stringValue(existing.value_text)
      : sourceValueText || mdmDerived.valueText
    const valueText = normalizeProductArchiveDeepdrawFieldValue(fieldName, rawValueText, arrayValue(template.options_json))
    const valueJson = existingManual ? recordValue(existing.value_json) : mdmDerived.valueJson
    const required = isProductArchiveFieldLocallyRequired(fieldName, {
      templateRequired: template.required,
      templatePresent: hasValue(template.field_name) || hasValue(template.field_id),
      ruleBlocking: rule.blocking,
      sourceType,
    })
    const blocking = required
    const missing = blocking && sourceType !== "skip" && !hasValue(valueText) && !hasValue(valueJson)
    return {
      fieldName,
      fieldId: stringValue(template.field_id) || null,
      sourceType: existingManual ? (stringValue(existing.source_type) || "manual") : sourceType,
      sourceRef: stringValue(rule.mapped_field || rule.source_field || rule.field_source || rule.source_table) || null,
      valueText: valueText || null,
      valueJson,
      required,
      blocking,
      manualOverride: existingManual,
      validationStatus: sourceType === "skip" ? "skipped" : missing ? "missing" : "valid",
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

function serializeDraftDetail(db: SyncPostgresDatabase, draftId: number) {
  const draft = draftById(db, draftId)
  const sourceRows = referenceSourceRowsForDraft(db, draft)
  return {
    draft,
    launchPlanReference: buildLaunchPlanCategoryReference(sourceRows),
    fields: db.prepare(`
      select field.*, template.options_json
      from product_archive_draft_field field
      left join lateral (
        select options_json
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
  const items = db.prepare(`
    select
      draft.*,
      coalesce((draft.validation_summary_json::jsonb #>> '{blocker_count}')::integer, 0) as blocker_count,
      coalesce((draft.validation_summary_json::jsonb #>> '{warning_count}')::integer, 0) as warning_count,
      (select count(*) from product_archive_draft_sku sku where sku.draft_id = draft.id) as sku_count
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

export function refreshProductArchiveDraftsFromSourceBatch(db: SyncPostgresDatabase, input: RefreshSourceBatchInput) {
  const sourceType = sourceImportType(input.sourceType)
  if (!["launch_plan", "copywriting"].includes(sourceType)) {
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
      const snapshot = appendSourceBatchId(recordValue(draft.source_snapshot_json), sourceType, sourceBatchId)
      db.prepare(`
        update product_archive_draft
        set source_snapshot_json = ?::jsonb,
          updated_at = ?::timestamptz
        where id = ?
      `).run(jsonText(snapshot), nowIso(), draftId)

      if (sourceType === "launch_plan" && !stringValue(draft.trade_id)) {
        const sourceRows = sourceRowsForSpu(db, stringValue(draft.spu_code), sourceBatchId)
        const draftMerchantId = stringValue(draft.merchant_id)
        const autoMatchedTrade = inferDeepdrawTradeFromLaunchPlan(db, {
          tenantName: stringValue(draft.tenant_name),
          merchantId: draftMerchantId,
          sourceRows,
        })
        if (autoMatchedTrade?.tradeId) {
          applyProductArchiveDraftTrade(db, draftId, {
            tradeId: autoMatchedTrade.tradeId,
            tradePath: autoMatchedTrade.tradePath,
          })
          autoAppliedTradeCount += 1
          refreshedDraftCount += 1
        } else {
          validateProductArchiveDraft(db, draftId)
          skippedNoTradeMatchCount += 1
        }
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
  if (!["launch_plan", "copywriting"].includes(sourceType)) {
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
        const snapshot = appendSourceBatchId(recordValue(draft.source_snapshot_json), sourceType, sourceBatchId)
        db.prepare(`
          update product_archive_draft
          set source_snapshot_json = ?::jsonb,
            updated_at = ?::timestamptz
          where id = ?
        `).run(jsonText(snapshot), nowIso(), draftId)

        if (sourceType === "launch_plan" && !stringValue(draft.trade_id)) {
          const sourceRows = sourceRowsForSpu(db, stringValue(draft.spu_code), sourceBatchId)
          const draftMerchantId = stringValue(draft.merchant_id)
          const autoMatchedTrade = inferDeepdrawTradeFromLaunchPlan(db, {
            tenantName: stringValue(draft.tenant_name),
            merchantId: draftMerchantId,
            sourceRows,
          })
          if (autoMatchedTrade?.tradeId) {
            applyProductArchiveDraftTrade(db, draftId, {
              tradeId: autoMatchedTrade.tradeId,
              tradePath: autoMatchedTrade.tradePath,
            })
            autoAppliedTradeCount += 1
            refreshedDraftCount += 1
          } else {
            validateProductArchiveDraft(db, draftId)
            skippedNoTradeMatchCount += 1
          }
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
  const autoMatchedTrade = input.tradeId
    ? null
    : inferDeepdrawTradeFromLaunchPlan(db, { tenantName, merchantId, sourceRows })
  const draftTradeId = input.tradeId ?? autoMatchedTrade?.tradeId ?? null
  const draftTradePath = input.tradePath ?? autoMatchedTrade?.tradePath ?? null
  const tradeFields = draftTradeId
    ? tradeFieldsForDraft(db, { tenant_name: tenantName, merchant_id: merchantId, trade_id: draftTradeId }, draftTradeId)
    : []

  const now = nowIso()
  const sourceBatchId = numberValue(input.sourceBatchId) ?? sourceBatchIds.launch_plan?.[0] ?? null
  const sourceSnapshot = {
    spu,
    sourceRows,
    sourceBatchId: sourceBatchId ?? null,
    sourceBatchIds,
    autoMatchedTrade,
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

export function applyProductArchiveDraftTrade(db: SyncPostgresDatabase, draftId: number, input: ApplyTradeInput) {
  const draft = draftById(db, draftId)
  const tradeId = stringValue(input.tradeId)
  if (!tradeId) throw new Error("请选择深绘类目")
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
  db.prepare(`
    update product_archive_draft
    set trade_id = ?,
      trade_path = ?,
      updated_at = ?::timestamptz
    where id = ?
  `).run(
    tradeId,
    stringValue(input.tradePath) || stringValue(trade.trade_path) || stringValue(trade.trade_name) || tradeId,
    now,
    draftId,
  )
  rebuildProductArchiveDraftFields(db, draftId)
  return validateProductArchiveDraft(db, draftId)
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
  const contextText = [
    draft.title,
    draft.trade_path,
    draft.source_snapshot_json,
    ...skus.map((sku) => `${stringValue(sku.color_name)} ${stringValue(sku.size_name)}`),
  ].map(stringValue).join(" ")
  const candidates = buildProductArchiveAiFillCandidateFields(fields)

  if (candidates.length === 0) {
    return { saved: [], detail }
  }

  const prompt = buildDeepdrawAiFillPrompt({ draft, fields: candidates, skus })
  const aiFills = await callDeepdrawAiFill(prompt, options).catch(() => [] as JsonRecord[])
  const aiById = new Map(aiFills.map((fill) => [Number(fill.field_id), fill]))
  const now = nowIso()
  const saved: Array<{ field_id: number; field_name: string; field_value: string; source: string; confidence: number | null }> = []
  const updateField = db.prepare(`
    update product_archive_draft_field
    set value_text = ?,
      value_json = ?::jsonb,
      source_type = ?,
      manual_override = true,
      validation_status = 'valid',
      validation_message = null,
      updated_at = ?::timestamptz
    where draft_id = ? and id = ?
  `)

  db.transaction(() => {
    for (const field of candidates) {
      const aiFill = aiById.get(field.id)
      const aiValue = stringValue(aiFill?.field_value)
      const allowed = new Set(field.options.map((option) => option.value))
      const fieldValue = aiValue && allowed.has(aiValue)
        ? aiValue
        : chooseProductArchiveAiFallbackOption(field.fieldName, field.currentValue, field.options, contextText)
      if (!fieldValue || !allowed.has(fieldValue)) continue
      const confidence = Number(aiFill?.confidence)
      updateField.run(
        fieldValue,
        jsonText({
          ai_fill: aiFill ?? { fallback: true },
          source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        }),
        aiFill ? "ai" : "ai_rule_fallback",
        now,
        draftId,
        field.id,
      )
      saved.push({
        field_id: field.id,
        field_name: field.fieldName,
        field_value: fieldValue,
        source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        confidence: Number.isFinite(confidence) ? confidence : null,
      })
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()

  const validated = validateProductArchiveDraft(db, draftId)
  return { saved, detail: validated.detail }
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
    const required = isProductArchiveFieldLocallyRequired(fieldName, {
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
    .filter(([name]) => /尺码|尺寸|规格|size/i.test(name))
    .flatMap(([, template]) => template.options.map(optionText).filter(Boolean))
  const allowedColors = new Set(colorOptions)
  const allowedSizes = new Set(sizeOptions)

  for (const sku of skus) {
    if (!stringValue(sku.color_name)) {
      issues.push({ severity: "blocker", issueType: "sku_color_missing", skuCode: stringValue(sku.sku_code), message: "SKU 缺少颜色" })
    } else if (allowedColors.size) {
      const colorCandidates = [
        stringValue(sku.color_name),
        stringValue(sku.color_code),
        ...deepdrawColorValue(sku.color_name).split(/[,，]/).map((part) => part.trim()).filter(Boolean),
      ]
      if (!colorCandidates.some((color) => allowedColors.has(color))) {
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
  const status = summary.blocker_count > 0
    ? fields.some((field) => stringValue(field.source_type) === "manual" && stringValue(field.validation_status) === "missing")
      ? "manual_review"
      : "missing_fields"
    : "ready"

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

function productPayloadFieldValue(field: JsonRecord) {
  const text = stringValue(field.value_text)
  if (text) return text
  const jsonValue = recordValue(field.value_json)
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
      value: productPayloadFieldValue(field),
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
  return business.code === 10404 || /未在服务器上发现|不存在|未找到|not\s*found/i.test(business.reason)
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

export async function submitProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
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
  db.prepare("update product_archive_draft set status = 'submitting', updated_at = ?::timestamptz where id = ?").run(nowIso(), draftId)
  const result = await runCreate(payload)
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
