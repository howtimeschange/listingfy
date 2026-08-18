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

function optionText(option: unknown) {
  if (typeof option === "string" || typeof option === "number") return stringValue(option)
  if (!option || typeof option !== "object" || Array.isArray(option)) return ""
  const row = option as JsonRecord
  return stringValue(row.value ?? row.label ?? row.name)
}

function templateOptions(template: ShoeFieldTemplate) {
  return new Set((template.options ?? []).map(optionText).filter(Boolean))
}

function supportedColumns(template: ShoeFieldTemplate, desired: string[], fallbacks: Record<string, string[]> = {}) {
  const supported = templateOptions(template)
  return desired.map((column) => {
    if (supported.has(column)) return column
    return (fallbacks[column] ?? []).find((candidate) => supported.has(candidate)) ?? ""
  }).filter(Boolean)
}

function tableValue(rows: ShoeSizeChartRow[], columns: string[], valueForColumn: (row: ShoeSizeChartRow, column: string) => string): ShoeFieldValue | null {
  if (columns.length === 0 || rows.length === 0) return null
  const valueJson: JsonRecord = {}
  for (const row of rows) {
    const size = normalizeShoeSkuSize(row.size_value)
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
  if (!value || !template || !templateOptions(template).has(value)) return null
  return { valueText: value, valueJson: {} }
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

  const sizes = rows.map((row) => normalizeShoeSkuSize(row.size_value)).filter(Boolean)
  const sizeTemplate = templates.get("尺码")
  if (sizeTemplate && sizes.length > 0) {
    const supported = templateOptions(sizeTemplate)
    const values = sizes.filter((size) => supported.has(size))
    if (values.length === sizes.length) output["尺码"] = { valueText: values.join(";"), valueJson: {} }
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
  const sizeType = scalarValue("中国码", templates.get("尺码类型"))
  if (sizeType) output["尺码类型"] = sizeType

  const generic = templates.get("尺码表")
  if (generic) {
    const columns = supportedColumns(generic, ["适合脚长", "鞋内长"], { 鞋内长: ["内长", "鞋长"] })
    const value = tableValue(rows, columns, (row, column) => column === "适合脚长" ? footRange(row) : innerLength(row))
    if (value && columns.length === 2) output["尺码表"] = value
  }

  const vip = templates.get("唯品会尺码表")
  if (vip) {
    const columns = supportedColumns(vip, ["中国码", "脚长", "鞋内长"], { 鞋内长: ["鞋长"] })
    const value = tableValue(rows, columns, (row, column) => column === "中国码" ? normalizeShoeSkuSize(row.size_value) : column === "脚长" ? baselineFoot(row) : innerLength(row))
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
    const value = tableValue(rows, columns, (row, column) => column === "脚长(cm)" ? footRange(row) : stringValue(row.douyin_mapping_text) || `脚长${footRange(row)}/内长${innerLength(row)}`)
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
    const columns = supportedColumns(multi, ["拼多多", "微信视频小店"])
    const value = tableValue(rows, columns, (row, column) => column === "拼多多"
      ? stringValue(row.pinduoduo_mapping_text) || stringValue(row.video_pdd_vip_mapping_text)
      : stringValue(row.video_pdd_vip_mapping_text) || stringValue(row.vip_mapping_text))
    if (value && columns.length === 2) output["多平台尺码"] = value
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
