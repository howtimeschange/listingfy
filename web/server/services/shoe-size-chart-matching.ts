import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

type JsonRecord = Record<string, unknown>

export type ShoeSizeChartMatchStatus = "matched" | "needs_visual_classification" | "not_shoe"

export interface ShoeSizeChartMatch {
  status: ShoeSizeChartMatchStatus
  chartCode: string
  templateType: string
  shoeSizeTableType: string
  legacyShoeType: string
  reason: string
}

interface ShoeSizeChartRow extends JsonRecord {
  size_value: unknown
  foot_length_mm: unknown
  foot_length_tolerance_mm: unknown
  inner_length_mm: unknown
  age_segment?: unknown
  reference_age?: unknown
  reference_stage?: unknown
}

interface ShoeFieldTemplate {
  fieldName: string
  fieldType?: string | null
  options?: unknown[]
}

interface ShoeFieldValue {
  valueText: string
  valueJson: JsonRecord
}

const TRADE_MATCHES = new Map<string, Omit<ShoeSizeChartMatch, "status" | "reason">>([
  ["16608", { chartCode: "sport_leisure", templateType: "运动", shoeSizeTableType: "", legacyShoeType: "轻跑鞋" }],
  ["546", { chartCode: "sport_leisure", templateType: "运动", shoeSizeTableType: "", legacyShoeType: "轻跑鞋" }],
  ["533", { chartCode: "sport_leisure", templateType: "休闲", shoeSizeTableType: "", legacyShoeType: "" }],
  ["534", { chartCode: "sport_leisure", templateType: "雪地靴", shoeSizeTableType: "", legacyShoeType: "雪地靴" }],
  ["538", { chartCode: "sport_leisure", templateType: "婴童", shoeSizeTableType: "", legacyShoeType: "学步鞋" }],
])

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compact(value: unknown) {
  return stringValue(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

function decimalText(value: number) {
  return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "")
}

export function normalizeShoeSkuSize(value: unknown) {
  const text = stringValue(value).replace(/(?:厘米|公分|cm|码)$/i, "").trim()
  const match = text.match(/\d+(?:\.5)?/)
  if (!match) return ""
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? String(parsed) : ""
}

function shoeSizeDisplayLabel(value: unknown) {
  const size = normalizeShoeSkuSize(value)
  return size ? `${size}码` : ""
}

function shoeSizeTemplateSupportsValue(options: Set<string>, value: unknown) {
  const size = normalizeShoeSkuSize(value)
  if (!size) return false
  return options.has(size) || options.has(`${size}码`) || options.has(`${size}cm`)
}

function parenthesizedShoeSizeRemark(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  if (/^[（(].*[）)]$/.test(text)) return `(${text.slice(1, -1)})`
  return `(${text})`
}

function shoeSizeRemarkSuffix(row: ShoeSizeChartRow) {
  return stringValue(row.general_mapping_text)
    || stringValue(row.douyin_mapping_text)
    || `脚长${footRange(row)}/内长${innerLength(row)}`
}

function shoePlatformSizeRemark(row: ShoeSizeChartRow) {
  const displaySize = shoeSizeDisplayLabel(row.size_value)
  const existing = [
    row.video_pdd_vip_mapping_text,
    row.vip_mapping_text,
    row.pinduoduo_mapping_text,
  ].map(stringValue).find((value) => /\(.+\)|（.+）/.test(value))
  return existing || `${displaySize}${parenthesizedShoeSizeRemark(shoeSizeRemarkSuffix(row))}`
}

export function buildShoeSizeRemarks(input: {
  rows: ShoeSizeChartRow[]
  skuSizes: unknown[]
}) {
  const allowed = new Set(input.skuSizes.map(normalizeShoeSkuSize).filter(Boolean))
  return Object.fromEntries(input.rows
    .map((row) => [
      normalizeShoeSkuSize(row.size_value),
      parenthesizedShoeSizeRemark(row.general_mapping_text),
    ])
    .filter(([size, remark]) => allowed.has(size) && Boolean(remark)))
}

function sandalMatch(classification: unknown): ShoeSizeChartMatch | null {
  const text = compact(classification)
  if (!text) return null
  if (text.includes("运动公主鞋")) {
    return {
      status: "matched",
      chartCode: "sport_leisure",
      templateType: "休闲",
      shoeSizeTableType: "运动公主鞋",
      legacyShoeType: "公主鞋",
      reason: "sandal_visual:运动公主鞋",
    }
  }
  if (text.includes("中空凉鞋") || text.includes("前后包鞋面") || text.includes("镂空凉鞋") || text.includes("包头凉鞋")) {
    return {
      status: "matched",
      chartCode: "closed_sandal",
      templateType: "休闲",
      shoeSizeTableType: text.includes("包头凉鞋") ? "包头凉鞋" : "镂空凉鞋",
      legacyShoeType: "凉鞋",
      reason: "sandal_visual:中空凉鞋（前后包鞋面）",
    }
  }
  if (text.includes("前后空凉鞋") || text === "凉鞋") {
    return {
      status: "matched",
      chartCode: "open_sandal",
      templateType: "休闲",
      shoeSizeTableType: "凉鞋",
      legacyShoeType: "凉鞋",
      reason: "sandal_visual:前后空凉鞋",
    }
  }
  return null
}

export function isShoeProductContext(input: { tradeId?: unknown; tradePath?: unknown; productLineName?: unknown }) {
  if (TRADE_MATCHES.has(stringValue(input.tradeId))) return true
  return /鞋|靴/.test(`${stringValue(input.tradePath)} ${stringValue(input.productLineName)}`)
}

export function resolveShoeSizeChartMatch(input: {
  tradeId?: unknown
  tradePath?: unknown
  productLineName?: unknown
  subclassName?: unknown
  sandalClassification?: unknown
}): ShoeSizeChartMatch {
  const tradeId = stringValue(input.tradeId)
  const exact = TRADE_MATCHES.get(tradeId)
  if (exact) return { status: "matched", ...exact, reason: `trade_id:${tradeId}` }

  const context = `${stringValue(input.tradePath)} ${stringValue(input.productLineName)} ${stringValue(input.subclassName)}`
  if (!/鞋|靴/.test(context)) {
    return { status: "not_shoe", chartCode: "", templateType: "", shoeSizeTableType: "", legacyShoeType: "", reason: "not_shoe_context" }
  }
  if (/凉鞋/.test(context)) {
    const classified = sandalMatch(input.sandalClassification)
    if (classified) return classified
    return {
      status: "needs_visual_classification",
      chartCode: "",
      templateType: "休闲",
      shoeSizeTableType: "",
      legacyShoeType: "凉鞋",
      reason: "sandal_visual_classification_required",
    }
  }
  if (/雪地靴/.test(context)) {
    return { status: "matched", chartCode: "sport_leisure", templateType: "雪地靴", shoeSizeTableType: "", legacyShoeType: "雪地靴", reason: "category:雪地靴" }
  }
  if (/学步鞋|步前鞋|婴童|宝宝鞋/.test(context)) {
    return { status: "matched", chartCode: "sport_leisure", templateType: "婴童", shoeSizeTableType: "", legacyShoeType: /步前鞋/.test(context) ? "婴儿步前鞋" : "学步鞋", reason: "category:婴童鞋" }
  }
  if (/运动鞋|户外鞋|跑鞋|足球鞋|篮球鞋/.test(context)) {
    return { status: "matched", chartCode: "sport_leisure", templateType: "运动", shoeSizeTableType: "", legacyShoeType: /足球/.test(context) ? "足球鞋" : /篮球/.test(context) ? "篮球鞋" : "轻跑鞋", reason: "category:运动鞋" }
  }
  return { status: "matched", chartCode: "sport_leisure", templateType: "休闲", shoeSizeTableType: "", legacyShoeType: "", reason: "category:其他鞋品" }
}

export function shoeSandalVisualClassificationPrompt() {
  return [
    "仅根据商品参考图判断凉鞋结构：",
    "1. 鞋头和后跟都露空，返回 前后空凉鞋；",
    "2. 鞋头和后跟均有鞋面包覆、中部镂空，返回 中空凉鞋（前后包鞋面）；",
    "3. 图像证据不足时不要猜测，返回 无法判断。",
  ].join("\n")
}

export function shoeEnumClassificationPrompt() {
  return [
    "鞋品枚举字段判断规则：",
    "1. 25鞋子模板类型 用于鞋品主模板，必须在 运动 / 休闲 / 雪地靴 / 婴童 中按类目、标题、SKU尺码段和参考图选择；非鞋品不要返回。",
    "2. 22Q4-童鞋尺码表 用于童鞋细分类，必须在字段现有枚举里选择最具体鞋型；证据只能支持泛运动鞋时可选轻跑鞋，证据不足则省略。",
    "3. 25鞋子尺码表 只用于凉鞋结构分类，会影响凉鞋尺码模板选择；只能在凉鞋款且参考图足够判断时选择包头凉鞋、镂空凉鞋、运动公主鞋或凉鞋。",
    "4. 不要把鞋品枚举字段当作 MULTI_TEXT 尺码表，不要为这些字段返回尺码行、表头或数值。",
  ].join("\n")
}

function optionText(option: unknown) {
  if (typeof option === "string" || typeof option === "number") return stringValue(option)
  if (!option || typeof option !== "object" || Array.isArray(option)) return ""
  const row = option as JsonRecord
  return stringValue(
    row.attrValueName
      ?? row.attr_value_name
      ?? row.label
      ?? row.name
      ?? row.text
      ?? row.optionName
      ?? row.option_name
      ?? row.title
      ?? row.value
      ?? row.optionValue
      ?? row.option_value
      ?? row.code
      ?? row.key
      ?? row.id
      ?? row.attrValueId
      ?? row.attr_value_id,
  )
}

function isPrimitiveOptionToken(option: unknown) {
  return option == null || typeof option !== "object"
}

function looksLikeDeepdrawOptionIdToken(option: unknown) {
  return /^\d{4,}$/.test(stringValue(option))
}

function hasReadableOptionText(option: unknown) {
  const text = stringValue(option)
  return Boolean(text && !looksLikeDeepdrawOptionIdToken(text) && /[A-Za-z\u4e00-\u9fff]/.test(text))
}

function primitiveOptionTokenIsPairedId(options: unknown[], index: number) {
  const option = options[index]
  if (!isPrimitiveOptionToken(option) || !looksLikeDeepdrawOptionIdToken(option)) return false
  const readablePeerCount = options.filter((candidate) => isPrimitiveOptionToken(candidate) && hasReadableOptionText(candidate)).length
  if (readablePeerCount < 2 && !(options.length === 2 && readablePeerCount === 1)) return false
  return [
    options[index - 1],
    options[index + 1],
  ].some((candidate) => isPrimitiveOptionToken(candidate) && hasReadableOptionText(candidate))
}

function optionValues(options: unknown[] = []) {
  return uniqueTextValues(options.map((option, index) => {
    if (primitiveOptionTokenIsPairedId(options, index)) return ""
    return optionText(option).replace(/\s*[（(]\s*\d{4,}\s*[）)]\s*$/g, "").trim()
  }))
}

function templateOptions(template: ShoeFieldTemplate) {
  return new Set(optionValues(template.options ?? []))
}

function supportedColumns(template: ShoeFieldTemplate, desired: string[], fallbacks: Record<string, string[]> = {}) {
  const supported = templateOptions(template)
  return desired.map((column) => {
    if (supported.has(column)) return column
    return (fallbacks[column] ?? []).find((candidate) => supported.has(candidate)) ?? ""
  }).filter(Boolean)
}

function tableValue(
  rows: ShoeSizeChartRow[],
  columns: string[],
  valueForColumn: (row: ShoeSizeChartRow, column: string) => string,
  sizeForRow: (row: ShoeSizeChartRow) => string = (row) => normalizeShoeSkuSize(row.size_value),
): ShoeFieldValue | null {
  if (columns.length === 0 || rows.length === 0) return null
  const valueJson: JsonRecord = {}
  for (const row of rows) {
    const size = sizeForRow(row)
    if (!size) continue
    valueJson[size] = columns.map((column) => valueForColumn(row, column)).join(",")
  }
  if (Object.keys(valueJson).length === 0) return null
  valueJson.title = columns.join(",")
  return { valueText: "", valueJson }
}

function footRange(row: ShoeSizeChartRow) {
  const foot = numberValue(row.foot_length_mm)
  const tolerance = numberValue(row.foot_length_tolerance_mm)
  return `${decimalText((foot - tolerance) / 10)}-${decimalText((foot + tolerance) / 10)}`
}

function baselineFoot(row: ShoeSizeChartRow) {
  return decimalText(numberValue(row.foot_length_mm) / 10)
}

function innerLength(row: ShoeSizeChartRow) {
  return decimalText(numberValue(row.inner_length_mm) / 10)
}

function templateMap(templates: ShoeFieldTemplate[]) {
  const output = new Map<string, ShoeFieldTemplate>()
  for (const template of templates) if (template.fieldName && !output.has(template.fieldName)) output.set(template.fieldName, template)
  return output
}

function scalarValue(value: string, template: ShoeFieldTemplate | undefined) {
  if (!value || !template) return null
  const supported = templateOptions(template)
  if (supported.has(value)) return { valueText: value, valueJson: {} }
  const normalizedValue = compact(value)
  const matched = [...supported].find((option) => compact(option) === normalizedValue)
  return matched ? { valueText: matched, valueJson: {} } : null
}

type AgeRangeMonths = { startMonths: number; endMonths: number }

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

function ageUnitMonths(value: number, unit: string) {
  if (unit === "岁半") return Math.round((value + 0.5) * 12)
  if (unit === "岁" || unit === "周岁") return Math.round(value * 12)
  return Math.round(value)
}

function closedAgeRangeText(value: unknown) {
  const text = stringValue(value)
  if (!text) return ""
  return /(?:周岁|岁|个月|月)\s*(?:以上|及以上|以后|起|以下|及以下|以内)/.test(text) ? "" : text
}

function parseClosedAgeRange(value: unknown): AgeRangeMonths | null {
  const text = closedAgeRangeText(value)
  if (!text) return null
  const range = text.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)?\s*(?:[（(][^）)]*[）)])?\s*[-~～至—－]\s*(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)(?:\s*[（(][^）)]*[）)])?/)
  if (range) {
    const endUnit = range[4]
    const startUnit = range[2] || endUnit
    const start = ageUnitMonths(Number(range[1]), startUnit)
    const end = ageUnitMonths(Number(range[3]), endUnit)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return start <= end ? { startMonths: start, endMonths: end } : { startMonths: end, endMonths: start }
    }
  }
  const single = text.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)/)
  if (!single) return null
  const months = ageUnitMonths(Number(single[1]), single[2])
  return Number.isFinite(months) ? { startMonths: months, endMonths: months } : null
}

function parseOpenAgeRange(value: unknown): AgeRangeMonths | null {
  const text = stringValue(value)
  const match = text.match(/(\d{1,2}(?:\.\d+)?)\s*(周岁|岁半|岁|个月|月)\s*(以上|及以上|以后|起|以下|及以下|以内)/)
  if (!match) return null
  const months = ageUnitMonths(Number(match[1]), match[2])
  if (!Number.isFinite(months)) return null
  return /以下|以内/.test(match[3])
    ? { startMonths: 0, endMonths: months }
    : { startMonths: months, endMonths: Number.POSITIVE_INFINITY }
}

function ageRangesFromText(value: unknown) {
  return uniqueTextValues(stringValue(value).split(/[;；]/))
    .map(parseClosedAgeRange)
    .filter((range): range is AgeRangeMonths => Boolean(range))
}

function aggregateAgeRange(ranges: AgeRangeMonths[]): AgeRangeMonths | null {
  if (!ranges.length) return null
  return {
    startMonths: Math.min(...ranges.map((range) => range.startMonths)),
    endMonths: Math.max(...ranges.map((range) => range.endMonths)),
  }
}

function ageRangesOverlap(left: AgeRangeMonths, right: AgeRangeMonths) {
  return left.startMonths <= right.endMonths && left.endMonths >= right.startMonths
}

function ageRangeWidth(range: AgeRangeMonths) {
  return range.endMonths - range.startMonths
}

function agePointText(months: number) {
  if (months < 12) return `${months}个月`
  if (months % 12 === 0) return `${months / 12}岁`
  if (months % 6 === 0) return `${Math.floor(months / 12)}岁半`
  return `${months}个月`
}

function ageRangeText(range: AgeRangeMonths) {
  if (range.startMonths === range.endMonths) return agePointText(range.startMonths)
  return `${agePointText(range.startMonths)}-${agePointText(range.endMonths)}`
}

export function shoeSizeChartRecommendedAgeText(rows: JsonRecord[]) {
  const range = aggregateAgeRange(rows.flatMap((row) => ageRangesFromText(row.reference_age)))
  return range ? ageRangeText(range) : ""
}

export function normalizeAgeFieldOptionValue(value: unknown, options: unknown[], multi: boolean) {
  const sourceRange = aggregateAgeRange(ageRangesFromText(value)) ?? parseOpenAgeRange(value)
  if (!sourceRange) return ""
  const values = optionValues(options)
  const candidates = values.map((option, index) => ({
    option,
    index,
    range: parseClosedAgeRange(option) ?? parseOpenAgeRange(option),
  })).filter((candidate): candidate is { option: string; index: number; range: AgeRangeMonths } => Boolean(candidate.range))
  const allStage = values.find((option) => /^(?:全阶段|全年龄|全龄段|全龄|通用|不限)$/.test(option))
  if (multi) {
    const values = uniqueTextValues(
      candidates
        .filter((candidate) => Number.isFinite(candidate.range.endMonths))
        .filter((candidate) => ageRangesOverlap(sourceRange, candidate.range))
        .map((candidate) => candidate.option),
    )
    return values.length ? values.join(";") : (allStage ?? "")
  }
  const covering = candidates
    .filter((candidate) => candidate.range.startMonths <= sourceRange.startMonths && candidate.range.endMonths >= sourceRange.endMonths)
    .sort((left, right) => ageRangeWidth(left.range) - ageRangeWidth(right.range) || left.index - right.index)[0]
  if (covering) return covering.option
  if (allStage) return allStage
  const overlapping = candidates
    .filter((candidate) => ageRangesOverlap(sourceRange, candidate.range))
    .sort((left, right) => {
      const leftOverlap = Math.min(left.range.endMonths, sourceRange.endMonths) - Math.max(left.range.startMonths, sourceRange.startMonths)
      const rightOverlap = Math.min(right.range.endMonths, sourceRange.endMonths) - Math.max(right.range.startMonths, sourceRange.startMonths)
      return rightOverlap - leftOverlap || ageRangeWidth(left.range) - ageRangeWidth(right.range) || left.index - right.index
    })[0]
  return overlapping?.option ?? ""
}

function isShoeAgeFieldName(value: unknown) {
  const key = compact(value)
  return key.includes("适用年龄") || key.includes("适合年龄段") || key === "年龄" || key === "年龄段"
}

function isMultiAgeFieldName(value: unknown) {
  return compact(value).includes("多选")
}

export function buildShoeSizeChartFieldValues(input: {
  rows: ShoeSizeChartRow[]
  skuSizes: unknown[]
  fieldTemplates: ShoeFieldTemplate[]
  match: ShoeSizeChartMatch
}) {
  if (input.match.status !== "matched") return {} as Record<string, ShoeFieldValue>
  const allowed = new Set(input.skuSizes.map(normalizeShoeSkuSize).filter(Boolean))
  const rows = input.rows
    .filter((row) => allowed.has(normalizeShoeSkuSize(row.size_value)))
    .sort((left, right) => numberValue(left.size_value) - numberValue(right.size_value))
  const templates = templateMap(input.fieldTemplates)
  const output: Record<string, ShoeFieldValue> = {}

  const recommendedAge = shoeSizeChartRecommendedAgeText(rows)
  if (recommendedAge) {
    for (const template of input.fieldTemplates) {
      if (!isShoeAgeFieldName(template.fieldName)) continue
      const options = template.options ?? []
      const valueText = options.length > 0
        ? normalizeAgeFieldOptionValue(recommendedAge, options, isMultiAgeFieldName(template.fieldName))
        : recommendedAge
      if (valueText) output[template.fieldName] = { valueText, valueJson: {} }
    }
  }

  const sizes = rows.map((row) => normalizeShoeSkuSize(row.size_value)).filter(Boolean)
  const sizeTemplate = templates.get("尺码")
  if (sizeTemplate && sizes.length > 0) {
    const supported = templateOptions(sizeTemplate)
    const values = sizes.filter((size) => shoeSizeTemplateSupportsValue(supported, size))
    if (values.length === sizes.length) {
      output["尺码"] = { valueText: values.map((size) => `${size}码`).join(";"), valueJson: {} }
    }
  }
  const videoSizeTemplate = templates.get("尺码.")
  if (videoSizeTemplate && sizes.length > 0) {
    const available = templateOptions(videoSizeTemplate)
    const usesFootLengthRanges = available.has("14-16cm") || available.has("17-19cm") || available.has("20-22cm")
    const maximum = usesFootLengthRanges
      ? Math.max(...rows.map((row) => numberValue(row.foot_length_mm) / 10).filter(Number.isFinite))
      : Math.max(...sizes.map(Number).filter(Number.isFinite))
    const range = usesFootLengthRanges
      ? maximum <= 14
        ? "14cm以下"
        : maximum <= 16
          ? "14-16cm"
          : maximum <= 19
            ? "17-19cm"
            : maximum <= 22
              ? "20-22cm"
              : "22cm以上"
      : maximum <= 26
        ? "26码以下"
        : maximum <= 28
          ? "26-28码"
          : maximum <= 30
            ? "29-30码"
            : maximum <= 32
              ? "31-32码"
              : maximum <= 34
                ? "33-34码"
                : "34码以上"
    const value = scalarValue(range, videoSizeTemplate)
    if (value) output["尺码."] = value
  }
  const sizeType = scalarValue("欧码（童鞋）", templates.get("尺码类型"))
  if (sizeType) output["尺码类型"] = sizeType

  const generic = templates.get("尺码表")
  if (generic) {
    const measurementColumns = supportedColumns(generic, ["脚长", "鞋内长"], { 鞋内长: ["内长", "鞋长"] })
    const columns = measurementColumns.length > 0 ? measurementColumns : []
    const value = tableValue(
      rows,
      columns,
      (row, column) => {
        return column === "脚长" ? baselineFoot(row) : innerLength(row)
      },
      (row) => `${normalizeShoeSkuSize(row.size_value)}码`,
    )
    if (value && measurementColumns.length === 2) output["尺码表"] = value
  }

  const vip = templates.get("唯品会尺码表")
  if (vip) {
    const columns = supportedColumns(vip, ["欧洲码", "脚长", "鞋内长"], { 鞋内长: ["鞋长"] })
    const value = tableValue(rows, columns, (row, column) => {
      if (column === "欧洲码") return normalizeShoeSkuSize(row.size_value)
      if (column === "脚长") return stringValue(row.foot_length_mm)
      return stringValue(row.inner_length_mm)
    }, (row) => shoeSizeDisplayLabel(row.size_value))
    if (value && columns.includes("脚长")) output["唯品会尺码表"] = value
  }

  const tmall = templates.get("天猫尺码表")
  if (tmall) {
    const columns = supportedColumns(tmall, ["脚长", "鞋内长"])
    const value = tableValue(rows, columns, (row, column) => column === "脚长" ? baselineFoot(row) : innerLength(row))
    if (value && columns.length === 2) output["天猫尺码表"] = value
  }

  const douyin = templates.get("抖音尺码表")
  if (douyin) {
    const columns = supportedColumns(douyin, ["脚长(cm)", "备注"])
    const value = tableValue(rows, columns, (row, column) => column === "脚长(cm)" ? baselineFoot(row) : stringValue(row.douyin_mapping_text) || `脚长${footRange(row)}/内长${innerLength(row)}`)
    if (value && columns.length === 2) output["抖音尺码表"] = value
  }

  const taobao = templates.get("淘宝尺码表")
  if (taobao) {
    const columns = supportedColumns(taobao, ["脚长"])
    const value = tableValue(rows, columns, (row) => footRange(row))
    if (value && columns.length === 1) output["淘宝尺码表"] = value
  }

  const multi = templates.get("多平台尺码")
  if (multi) {
    const columns = supportedColumns(multi, ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"], { 微信视频小店: ["微信视频", "微信视频号"] })
    const value = tableValue(rows, columns, (row, column) => {
      if (column === "京东") return normalizeShoeSkuSize(row.size_value)
      if (column === "拼多多" || column === "微信视频小店" || column === "微信视频" || column === "微信视频号" || column === "小红书") {
        return shoePlatformSizeRemark(row)
      }
      return ""
    }, (row) => shoeSizeDisplayLabel(row.size_value))
    if (value && columns.length > 0) {
      output["多平台尺码"] = {
        ...value,
        valueText: columns.join(";"),
      }
    }
  }

  const templateType = scalarValue(input.match.templateType, templates.get("25鞋子模板类型"))
  if (templateType) output["25鞋子模板类型"] = templateType
  const shoeSizeTableType = scalarValue(input.match.shoeSizeTableType, templates.get("25鞋子尺码表"))
  if (shoeSizeTableType) output["25鞋子尺码表"] = shoeSizeTableType
  const legacyType = scalarValue(input.match.legacyShoeType, templates.get("22Q4-童鞋尺码表"))
  if (legacyType) output["22Q4-童鞋尺码表"] = legacyType
  return output
}

export function loadShoeSizeChartRows(
  db: SyncPostgresDatabase,
  chartCode: string,
) {
  if (!chartCode) return []
  return db.prepare(`
    select row.*
    from product_archive_shoe_size_chart_row row
    join product_archive_shoe_size_chart chart on chart.id = row.chart_id
    where chart.chart_code = ?
      and chart.enabled = true
      and row.enabled = true
    order by row.size_value
  `).all(chartCode) as ShoeSizeChartRow[]
}
