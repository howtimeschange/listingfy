import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

interface ListRowsInput {
  chartCode?: string | null
  q?: string | null
  limit?: unknown
  offset?: unknown
}

interface ChartInput {
  chartName?: unknown
  chart_name?: unknown
  applicableCategories?: unknown
  applicable_categories?: unknown
  versionLabel?: unknown
  version_label?: unknown
  enabled?: unknown
}

interface RowInput {
  chartCode?: unknown
  chart_code?: unknown
  sizeValue?: unknown
  size_value?: unknown
  footLengthMm?: unknown
  foot_length_mm?: unknown
  footLengthToleranceMm?: unknown
  foot_length_tolerance_mm?: unknown
  innerLengthMm?: unknown
  inner_length_mm?: unknown
  ageSegment?: unknown
  age_segment?: unknown
  referenceAge?: unknown
  reference_age?: unknown
  referenceStage?: unknown
  reference_stage?: unknown
  generalMappingText?: unknown
  general_mapping_text?: unknown
  douyinMappingText?: unknown
  douyin_mapping_text?: unknown
  vipMappingText?: unknown
  vip_mapping_text?: unknown
  videoPddVipMappingText?: unknown
  video_pdd_vip_mapping_text?: unknown
  pinduoduoMappingText?: unknown
  pinduoduo_mapping_text?: unknown
  enabled?: unknown
  notes?: unknown
}

export interface ShoeSizeChartImportRow {
  chartCode: string
  sizeValue: number
  footLengthMm: number
  footLengthToleranceMm: number
  innerLengthMm: number
  ageSegment: string | null
  referenceAge: string | null
  referenceStage: string | null
  generalMappingText: string | null
  douyinMappingText: string | null
  vipMappingText: string | null
  videoPddVipMappingText: string | null
  pinduoduoMappingText: string | null
  enabled: boolean
  notes: string | null
  rowNumber?: number
}

export interface ShoeSizeChartImportError {
  rowNumber: number
  chartCode: string | null
  sizeValue: string | null
  reason: string
}

type SpreadsheetRow = Record<string, unknown>
type PreparedImportRow = { row: Record<string, unknown>; rowNumber: number }

const IMPORT_FIELD_ALIASES = {
  chartCode: ["模板代码", "尺码模板代码", "chart_code", "chartcode", "模板名称", "尺码模板", "鞋型", "品类"],
  sizeValue: ["号码", "尺码", "size_value", "sizevalue"],
  footLengthMm: ["脚长基准(mm)", "脚长基准（mm）", "脚长(mm)", "脚长（mm）", "脚长", "foot_length_mm", "footlengthmm"],
  footLengthToleranceMm: ["脚长公差(mm)", "脚长公差（mm）", "公差(mm)", "公差（mm）", "公差", "foot_length_tolerance_mm", "footlengthtolerancemm"],
  innerLengthMm: ["鞋内长(mm)", "鞋内长（mm）", "楦底样长(mm)", "楦底样长（mm）", "楦底样长(内长)(mm)", "楦底样长（内长）（mm）", "鞋内长", "inner_length_mm", "innerlengthmm"],
  ageSegment: ["岁段", "age_segment", "agesegment"],
  referenceAge: ["参考年龄段", "参考年龄", "reference_age", "referenceage"],
  referenceStage: ["参考阶段", "reference_stage", "referencestage"],
  generalMappingText: ["通用", "脚长内长上新", "general_mapping_text", "generalmappingtext"],
  douyinMappingText: ["抖音", "抖音尺码映射", "douyin_mapping_text", "douyinmappingtext"],
  vipMappingText: ["唯品", "唯品会", "唯品尺码映射", "vip_mapping_text", "vipmappingtext"],
  videoPddVipMappingText: ["视频号/拼多多/唯品会", "视频号拼多多唯品会", "video_pdd_vip_mapping_text", "videopddvipmappingtext"],
  pinduoduoMappingText: ["拼多多", "拼多多尺码映射", "pinduoduo_mapping_text", "pinduoduomappingtext"],
  enabled: ["启用", "状态", "enabled"],
  notes: ["备注", "说明", "notes"],
} as const

const CHART_CODE_ALIASES = new Map([
  ["opensandal", "open_sandal"],
  ["前后空凉鞋", "open_sandal"],
  ["closedsandal", "closed_sandal"],
  ["中空凉鞋", "closed_sandal"],
  ["中空凉鞋前后包鞋面", "closed_sandal"],
  ["前后包凉鞋", "closed_sandal"],
  ["sportleisure", "sport_leisure"],
  ["运动休闲婴童其他", "sport_leisure"],
  ["运动鞋休闲鞋婴童鞋其他", "sport_leisure"],
  ["运动鞋", "sport_leisure"],
  ["休闲鞋", "sport_leisure"],
  ["婴童鞋", "sport_leisure"],
])

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function compactHeader(value: unknown) {
  return stringValue(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function aliasSet(values: readonly string[]) {
  return new Set(values.map(compactHeader))
}

const IMPORT_ALIAS_SETS = Object.fromEntries(
  Object.entries(IMPORT_FIELD_ALIASES).map(([key, values]) => [key, aliasSet(values)]),
) as Record<keyof typeof IMPORT_FIELD_ALIASES, Set<string>>

function importFieldForHeader(value: unknown) {
  const header = compactHeader(value)
  if (!header) return null
  for (const [field, aliases] of Object.entries(IMPORT_ALIAS_SETS)) {
    if (aliases.has(header)) return field as keyof typeof IMPORT_FIELD_ALIASES
  }
  return null
}

function namedImportRow(row: SpreadsheetRow) {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row ?? {})) {
    const field = importFieldForHeader(key)
    if (field) output[field] = value
  }
  return output
}

function importRowsWithHeaders(rows: SpreadsheetRow[]) {
  if (rows.length === 0) return []
  const firstNamed = namedImportRow(rows[0])
  if (Object.keys(firstNamed).length >= 2) {
    return rows.map((row, index) => ({ row: namedImportRow(row), rowNumber: index + 2 }))
  }
  let headerIndex = -1
  let headerFields: Array<[string, keyof typeof IMPORT_FIELD_ALIASES]> = []
  rows.slice(0, 12).forEach((row, index) => {
    const fields = Object.entries(row)
      .map(([key, value]) => [key, importFieldForHeader(value)] as const)
      .filter((entry): entry is [string, keyof typeof IMPORT_FIELD_ALIASES] => Boolean(entry[1]))
    if (fields.length > headerFields.length) {
      headerIndex = index
      headerFields = fields
    }
  })
  if (headerIndex < 0 || headerFields.length < 2) {
    return rows.map((row, index) => ({ row: namedImportRow(row), rowNumber: index + 2 }))
  }
  return rows.slice(headerIndex + 1).map((source, index) => {
    const row: Record<string, unknown> = {}
    headerFields.forEach(([column, field]) => {
      row[field] = source[column]
    })
    return { row, rowNumber: headerIndex + index + 2 }
  })
}

function spreadsheetColumnPosition(column: string) {
  const match = column.match(/(\d+)$/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function sortedCells(row: SpreadsheetRow) {
  return Object.entries(row).sort(([left], [right]) => spreadsheetColumnPosition(left) - spreadsheetColumnPosition(right))
}

function matrixMetadataByColumn(
  row: SpreadsheetRow | undefined,
  sizeColumns: string[],
) {
  const values = new Map<string, unknown>()
  let carried: unknown = null
  for (const column of sizeColumns) {
    const current = row?.[column]
    if (stringValue(current)) carried = current
    values.set(column, carried)
  }
  return values
}

function expandBalabalaHorizontalRows(rows: SpreadsheetRow[]): PreparedImportRow[] | null {
  const sizeRowIndex = rows.findIndex((row) => sortedCells(row).some(([, value]) => compactHeader(value) === "号码"))
  if (sizeRowIndex < 0) return null

  const sizeRow = rows[sizeRowIndex]
  const sizeLabelCell = sortedCells(sizeRow).find(([, value]) => compactHeader(value) === "号码")
  if (!sizeLabelCell) return null
  const sizeLabelPosition = spreadsheetColumnPosition(sizeLabelCell[0])
  const sizeColumns = sortedCells(sizeRow)
    .filter(([column, value]) => {
      const size = importNumber(value)
      return spreadsheetColumnPosition(column) > sizeLabelPosition
        && size != null
        && Number.isInteger(size)
        && size > 0
    })
    .map(([column]) => column)
  if (sizeColumns.length < 2) return null

  const footRowIndex = rows.findIndex((row) => sortedCells(row).some(([, value]) => compactHeader(value).includes("脚长鞋号")))
  if (footRowIndex < 0) return null

  const findMetadataRow = (labels: string[]) => rows.find((row) => sortedCells(row).some(([, value]) => labels.includes(compactHeader(value))))
  const ageSegmentByColumn = matrixMetadataByColumn(findMetadataRow(["岁段"]), sizeColumns)
  const referenceAgeByColumn = matrixMetadataByColumn(findMetadataRow(["参考年龄段", "参考年龄"]), sizeColumns)
  const referenceStageByColumn = matrixMetadataByColumn(findMetadataRow(["参考阶段"]), sizeColumns)

  const chartRows = new Map<string, { row: SpreadsheetRow; rowNumber: number }>()
  rows.forEach((row, index) => {
    const chartCode = sortedCells(row)
      .map(([, value]) => normalizedChartCode(value))
      .find(Boolean)
    if (!chartCode || chartRows.has(chartCode)) return
    const hasInnerLengthLabel = sortedCells(row).some(([, value]) => compactHeader(value).includes("楦底样长内长"))
    if (hasInnerLengthLabel) chartRows.set(chartCode, { row, rowNumber: index + 1 })
  })
  if (chartRows.size === 0) return null

  const prepared: PreparedImportRow[] = []
  for (const [chartCode, chart] of chartRows) {
    for (const column of sizeColumns) {
      if (!stringValue(chart.row[column])) continue
      prepared.push({
        row: {
          chartCode,
          sizeValue: sizeRow[column],
          footLengthMm: rows[footRowIndex][column],
          footLengthToleranceMm: 2,
          innerLengthMm: chart.row[column],
          ageSegment: ageSegmentByColumn.get(column),
          referenceAge: referenceAgeByColumn.get(column),
          referenceStage: referenceStageByColumn.get(column),
          enabled: true,
        },
        rowNumber: chart.rowNumber,
      })
    }
  }
  return prepared
}

function expandBalabalaConversionRows(rows: SpreadsheetRow[]): PreparedImportRow[] | null {
  let categoryRowIndex = -1
  let categoryCells: Array<{ column: string; position: number; chartCode: string }> = []
  rows.forEach((row, index) => {
    const cells = sortedCells(row)
      .map(([column, value]) => ({ column, position: spreadsheetColumnPosition(column), chartCode: normalizedChartCode(value) }))
      .filter((cell) => Boolean(cell.chartCode))
    if (cells.length > categoryCells.length) {
      categoryRowIndex = index
      categoryCells = cells
    }
  })
  if (categoryRowIndex < 0 || new Set(categoryCells.map((cell) => cell.chartCode)).size < 3) return null

  const headerRowIndex = rows.findIndex((row, index) => index > categoryRowIndex && sortedCells(row).some(([, value]) => compactHeader(value) === "脚长内长上新"))
  if (headerRowIndex < 0) return null
  const headerRow = rows[headerRowIndex]
  const headerCells = sortedCells(headerRow)
  const headerColumn = (aliases: string[]) => headerCells.find(([, value]) => aliases.includes(compactHeader(value)))?.[0]
  const sizeColumn = headerColumn(["号码"])
  const footLengthColumn = headerColumn(["脚长鞋号2mm"])
  const ageSegmentColumn = headerColumn(["岁段"])
  const referenceAgeColumn = headerColumn(["参考年龄段", "参考年龄"])
  const referenceStageColumn = headerColumn(["参考阶段"])
  if (!sizeColumn || !footLengthColumn) return null

  const uniqueGroups = [...new Map(categoryCells.map((cell) => [cell.chartCode, cell])).values()]
    .sort((left, right) => left.position - right.position)
  const maxHeaderPosition = Math.max(...headerCells.map(([column]) => spreadsheetColumnPosition(column)))
  const prepared: PreparedImportRow[] = []

  uniqueGroups.forEach((group, groupIndex) => {
    const nextPosition = uniqueGroups[groupIndex + 1]?.position ?? maxHeaderPosition + 1
    const blockHeaders = headerCells.filter(([column]) => {
      const position = spreadsheetColumnPosition(column)
      return position >= group.position && position < nextPosition
    })
    const blockColumn = (label: string) => blockHeaders.find(([, value]) => compactHeader(value) === label)?.[0]
    const innerLengthColumn = blockColumn("楦底样长内长mm")
    const generalMappingColumn = blockColumn("脚长内长上新")
    const douyinMappingColumn = blockColumn("抖音")
    const vipMappingColumn = blockColumn("唯品")
    const videoPddVipMappingColumn = blockColumn("视频号拼多多唯品会")
    const pinduoduoMappingColumn = blockColumn("拼多多")
    if (!innerLengthColumn) return

    rows.slice(headerRowIndex + 1).forEach((row, offset) => {
      if (!stringValue(row[innerLengthColumn])) return
      prepared.push({
        row: {
          chartCode: group.chartCode,
          sizeValue: row[sizeColumn],
          footLengthMm: row[footLengthColumn],
          footLengthToleranceMm: 2,
          innerLengthMm: row[innerLengthColumn],
          ageSegment: ageSegmentColumn ? row[ageSegmentColumn] : null,
          referenceAge: referenceAgeColumn ? row[referenceAgeColumn] : null,
          referenceStage: referenceStageColumn ? row[referenceStageColumn] : null,
          generalMappingText: generalMappingColumn ? row[generalMappingColumn] : null,
          douyinMappingText: douyinMappingColumn ? row[douyinMappingColumn] : null,
          vipMappingText: vipMappingColumn ? row[vipMappingColumn] : null,
          videoPddVipMappingText: videoPddVipMappingColumn ? row[videoPddVipMappingColumn] : null,
          pinduoduoMappingText: pinduoduoMappingColumn ? row[pinduoduoMappingColumn] : null,
          enabled: true,
        },
        rowNumber: headerRowIndex + offset + 2,
      })
    })
  })
  return prepared.length > 0 ? prepared : null
}

function normalizedChartCode(value: unknown, fallback = "") {
  const text = stringValue(value) || fallback
  return CHART_CODE_ALIASES.get(compactHeader(text)) ?? ""
}

function importNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const text = stringValue(value).replace(/[,，]/g, "").replace(/(?:毫米|mm|码)$/i, "").trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

export function normalizeShoeSizeChartImportRows(
  sourceRows: SpreadsheetRow[],
  options: { defaultChartCode?: string | null } = {},
) {
  const rows: ShoeSizeChartImportRow[] = []
  const errors: ShoeSizeChartImportError[] = []
  const duplicateKeys = new Set<string>()
  const deduplicated = new Map<string, ShoeSizeChartImportRow>()
  const defaultChartCode = normalizedChartCode(options.defaultChartCode)
  const safeSourceRows = Array.isArray(sourceRows) ? sourceRows : []
  const horizontalRows = expandBalabalaHorizontalRows(safeSourceRows)
  const conversionRows = horizontalRows ? null : expandBalabalaConversionRows(safeSourceRows)
  const prepared = horizontalRows ?? conversionRows ?? importRowsWithHeaders(safeSourceRows)

  for (const { row, rowNumber } of prepared) {
    if (Object.values(row).every((value) => !stringValue(value))) continue
    const rawChartCode = stringValue(row.chartCode)
    const chartCode = normalizedChartCode(rawChartCode, defaultChartCode)
    const rawSize = stringValue(row.sizeValue)
    const sizeValue = importNumber(row.sizeValue)
    const footLengthMm = importNumber(row.footLengthMm)
    const innerLengthMm = importNumber(row.innerLengthMm)
    const footLengthToleranceMm = stringValue(row.footLengthToleranceMm)
      ? importNumber(row.footLengthToleranceMm)
      : 2
    let reason = ""
    if (!chartCode) reason = `无法识别模板：${rawChartCode || "未填写"}`
    else if (sizeValue == null || !Number.isInteger(sizeValue) || sizeValue <= 0) reason = "号码必须是正整数"
    else if (footLengthMm == null || footLengthMm <= 0) reason = "脚长基准必须是正数"
    else if (innerLengthMm == null || innerLengthMm <= 0) reason = "鞋内长必须是正数"
    else if (footLengthToleranceMm == null || footLengthToleranceMm < 0) reason = "脚长公差不能小于 0"
    if (reason) {
      errors.push({ rowNumber, chartCode: chartCode || rawChartCode || null, sizeValue: rawSize || null, reason })
      continue
    }
    const item: ShoeSizeChartImportRow = {
      chartCode,
      sizeValue,
      footLengthMm,
      footLengthToleranceMm,
      innerLengthMm,
      ageSegment: stringValue(row.ageSegment) || null,
      referenceAge: stringValue(row.referenceAge) || null,
      referenceStage: stringValue(row.referenceStage) || null,
      generalMappingText: stringValue(row.generalMappingText) || null,
      douyinMappingText: stringValue(row.douyinMappingText) || null,
      vipMappingText: stringValue(row.vipMappingText) || null,
      videoPddVipMappingText: stringValue(row.videoPddVipMappingText) || null,
      pinduoduoMappingText: stringValue(row.pinduoduoMappingText) || null,
      enabled: booleanValue(row.enabled, true),
      notes: stringValue(row.notes) || null,
      rowNumber,
    }
    const key = `${chartCode}:${sizeValue}`
    if (deduplicated.has(key)) duplicateKeys.add(key)
    deduplicated.set(key, item)
  }
  rows.push(...deduplicated.values())
  return {
    rows,
    errors,
    duplicateCount: duplicateKeys.size,
    sourceFormat: horizontalRows
      ? "balabala_horizontal" as const
      : conversionRows
        ? "balabala_conversion" as const
        : "tabular" as const,
  }
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  const text = stringValue(value).toLowerCase()
  if (["1", "true", "yes", "y", "是", "启用"].includes(text)) return true
  if (["0", "false", "no", "n", "否", "停用", "禁用"].includes(text)) return false
  return fallback
}

function numberValue(value: unknown, fieldName: string, options: { integer?: boolean; min?: number } = {}) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${fieldName}必须是数字`)
  if (options.integer && !Number.isInteger(number)) throw new Error(`${fieldName}必须是整数`)
  if (options.min != null && number < options.min) throw new Error(`${fieldName}不能小于 ${options.min}`)
  return number
}

function readLimit(value: unknown) {
  const number = Number(value ?? 50)
  if (!Number.isFinite(number)) return 50
  return Math.max(1, Math.min(200, Math.floor(number)))
}

function readOffset(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function nowIso() {
  return new Date().toISOString()
}

function getChart(db: SyncPostgresDatabase, chartCode: string) {
  const chart = db.prepare("select * from product_archive_shoe_size_chart where chart_code = ?").get(chartCode)
  if (!chart) throw new Error(`鞋品尺码模板不存在：${chartCode}`)
  return chart as Record<string, unknown>
}

export function listShoeSizeCharts(db: SyncPostgresDatabase) {
  return db.prepare(`
    select
      chart.*,
      count(row.id)::int as row_count,
      min(row.size_value)::int as min_size,
      max(row.size_value)::int as max_size
    from product_archive_shoe_size_chart chart
    left join product_archive_shoe_size_chart_row row
      on row.chart_id = chart.id
      and row.enabled = true
    group by chart.id
    order by chart.id
  `).all()
}

export function listShoeSizeChartRows(db: SyncPostgresDatabase, input: ListRowsInput = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const params: unknown[] = []
  const where: string[] = []
  if (input.chartCode && input.chartCode !== "all") {
    where.push("chart.chart_code = ?")
    params.push(input.chartCode)
  }
  if (input.q?.trim()) {
    const like = `%${input.q.trim()}%`
    where.push(`(
      chart.chart_name ilike ?
      or chart.applicable_categories ilike ?
      or cast(row.size_value as text) ilike ?
      or row.age_segment ilike ?
      or row.reference_age ilike ?
      or row.reference_stage ilike ?
      or row.general_mapping_text ilike ?
      or row.douyin_mapping_text ilike ?
      or row.vip_mapping_text ilike ?
      or row.video_pdd_vip_mapping_text ilike ?
      or row.pinduoduo_mapping_text ilike ?
      or row.notes ilike ?
    )`)
    params.push(like, like, like, like, like, like, like, like, like, like, like, like)
  }
  const clause = where.length > 0 ? `where ${where.join(" and ")}` : ""
  const items = db.prepare(`
    select
      row.*,
      chart.chart_code,
      chart.chart_name,
      chart.applicable_categories,
      chart.version_label
    from product_archive_shoe_size_chart_row row
    join product_archive_shoe_size_chart chart on chart.id = row.chart_id
    ${clause}
    order by chart.id, row.size_value
    limit ? offset ?
  `).all(...params, limit, offset)
  const total = db.prepare(`
    select count(*)::int as count
    from product_archive_shoe_size_chart_row row
    join product_archive_shoe_size_chart chart on chart.id = row.chart_id
    ${clause}
  `).get(...params) as { count?: number }
  return { items, pagination: { total: Number(total?.count ?? 0), limit, offset } }
}

export function updateShoeSizeChart(db: SyncPostgresDatabase, chartCode: string, input: ChartInput) {
  const current = getChart(db, chartCode)
  const chartName = stringValue(input.chartName ?? input.chart_name ?? current.chart_name)
  const applicableCategories = stringValue(
    input.applicableCategories ?? input.applicable_categories ?? current.applicable_categories,
  )
  const versionLabel = stringValue(input.versionLabel ?? input.version_label ?? current.version_label)
  if (!chartName) throw new Error("模板名称不能为空")
  if (!applicableCategories) throw new Error("适用品类不能为空")
  if (!versionLabel) throw new Error("版本不能为空")
  return db.prepare(`
    update product_archive_shoe_size_chart set
      chart_name = ?,
      applicable_categories = ?,
      version_label = ?,
      enabled = ?,
      updated_at = ?::timestamptz
    where chart_code = ?
    returning *
  `).get(
    chartName,
    applicableCategories,
    versionLabel,
    booleanValue(input.enabled, Boolean(current.enabled)),
    nowIso(),
    chartCode,
  )
}

function normalizedRowInput(input: RowInput, current: Record<string, unknown> | null = null) {
  const sizeValue = numberValue(input.sizeValue ?? input.size_value ?? current?.size_value, "号码", { integer: true, min: 1 })
  const footLengthMm = numberValue(input.footLengthMm ?? input.foot_length_mm ?? current?.foot_length_mm, "脚长", { min: 0.01 })
  const footLengthToleranceMm = numberValue(
    input.footLengthToleranceMm ?? input.foot_length_tolerance_mm ?? current?.foot_length_tolerance_mm ?? 2,
    "脚长公差",
    { min: 0 },
  )
  const innerLengthMm = numberValue(input.innerLengthMm ?? input.inner_length_mm ?? current?.inner_length_mm, "鞋内长", { min: 0.01 })
  return {
    sizeValue,
    footLengthMm,
    footLengthToleranceMm,
    innerLengthMm,
    ageSegment: stringValue(input.ageSegment ?? input.age_segment ?? current?.age_segment) || null,
    referenceAge: stringValue(input.referenceAge ?? input.reference_age ?? current?.reference_age) || null,
    referenceStage: stringValue(input.referenceStage ?? input.reference_stage ?? current?.reference_stage) || null,
    generalMappingText: stringValue(input.generalMappingText ?? input.general_mapping_text ?? current?.general_mapping_text) || null,
    douyinMappingText: stringValue(input.douyinMappingText ?? input.douyin_mapping_text ?? current?.douyin_mapping_text) || null,
    vipMappingText: stringValue(input.vipMappingText ?? input.vip_mapping_text ?? current?.vip_mapping_text) || null,
    videoPddVipMappingText: stringValue(input.videoPddVipMappingText ?? input.video_pdd_vip_mapping_text ?? current?.video_pdd_vip_mapping_text) || null,
    pinduoduoMappingText: stringValue(input.pinduoduoMappingText ?? input.pinduoduo_mapping_text ?? current?.pinduoduo_mapping_text) || null,
    enabled: booleanValue(input.enabled, current ? Boolean(current.enabled) : true),
    notes: stringValue(input.notes ?? current?.notes) || null,
  }
}

export function createShoeSizeChartRow(db: SyncPostgresDatabase, input: RowInput & { userId?: number | null }) {
  const chartCode = stringValue(input.chartCode ?? input.chart_code)
  if (!chartCode) throw new Error("chartCode is required")
  const chart = getChart(db, chartCode)
  const row = normalizedRowInput(input)
  return db.prepare(`
    insert into product_archive_shoe_size_chart_row (
      chart_id,
      size_value,
      foot_length_mm,
      foot_length_tolerance_mm,
      inner_length_mm,
      age_segment,
      reference_age,
      reference_stage,
      general_mapping_text,
      douyin_mapping_text,
      vip_mapping_text,
      video_pdd_vip_mapping_text,
      pinduoduo_mapping_text,
      enabled,
      notes,
      created_by,
      updated_by,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
    returning *
  `).get(
    chart.id,
    row.sizeValue,
    row.footLengthMm,
    row.footLengthToleranceMm,
    row.innerLengthMm,
    row.ageSegment,
    row.referenceAge,
    row.referenceStage,
    row.generalMappingText,
    row.douyinMappingText,
    row.vipMappingText,
    row.videoPddVipMappingText,
    row.pinduoduoMappingText,
    row.enabled,
    row.notes,
    input.userId ?? null,
    input.userId ?? null,
    nowIso(),
  )
}

export function updateShoeSizeChartRow(db: SyncPostgresDatabase, rowId: number, input: RowInput & { userId?: number | null }) {
  if (!Number.isInteger(rowId) || rowId <= 0) throw new Error("无效的尺码明细 ID")
  const current = db.prepare("select * from product_archive_shoe_size_chart_row where id = ?").get(rowId) as Record<string, unknown> | undefined
  if (!current) throw new Error(`鞋品尺码明细不存在：${rowId}`)
  const row = normalizedRowInput(input, current)
  return db.prepare(`
    update product_archive_shoe_size_chart_row set
      size_value = ?,
      foot_length_mm = ?,
      foot_length_tolerance_mm = ?,
      inner_length_mm = ?,
      age_segment = ?,
      reference_age = ?,
      reference_stage = ?,
      general_mapping_text = ?,
      douyin_mapping_text = ?,
      vip_mapping_text = ?,
      video_pdd_vip_mapping_text = ?,
      pinduoduo_mapping_text = ?,
      enabled = ?,
      notes = ?,
      updated_by = ?,
      updated_at = ?::timestamptz
    where id = ?
    returning *
  `).get(
    row.sizeValue,
    row.footLengthMm,
    row.footLengthToleranceMm,
    row.innerLengthMm,
    row.ageSegment,
    row.referenceAge,
    row.referenceStage,
    row.generalMappingText,
    row.douyinMappingText,
    row.vipMappingText,
    row.videoPddVipMappingText,
    row.pinduoduoMappingText,
    row.enabled,
    row.notes,
    input.userId ?? null,
    nowIso(),
    rowId,
  )
}

export function importShoeSizeChartRows(
  db: SyncPostgresDatabase,
  input: { rows?: ShoeSizeChartImportRow[]; userId?: number | null; sourceFileName?: string | null },
) {
  const rows = Array.isArray(input.rows) ? input.rows : []
  const userId = input.userId ?? null
  const sourceFileName = stringValue(input.sourceFileName) || null
  const now = nowIso()
  const existingRow = db.prepare(`
    select id from product_archive_shoe_size_chart_row
    where chart_id = ? and size_value = ?
  `)
  const upsertRow = db.prepare(`
    insert into product_archive_shoe_size_chart_row (
      chart_id,
      size_value,
      foot_length_mm,
      foot_length_tolerance_mm,
      inner_length_mm,
      age_segment,
      reference_age,
      reference_stage,
      general_mapping_text,
      douyin_mapping_text,
      vip_mapping_text,
      video_pdd_vip_mapping_text,
      pinduoduo_mapping_text,
      enabled,
      notes,
      created_by,
      updated_by,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::timestamptz)
    on conflict (chart_id, size_value) do update set
      foot_length_mm = excluded.foot_length_mm,
      foot_length_tolerance_mm = excluded.foot_length_tolerance_mm,
      inner_length_mm = excluded.inner_length_mm,
      age_segment = excluded.age_segment,
      reference_age = excluded.reference_age,
      reference_stage = excluded.reference_stage,
      general_mapping_text = coalesce(excluded.general_mapping_text, product_archive_shoe_size_chart_row.general_mapping_text),
      douyin_mapping_text = coalesce(excluded.douyin_mapping_text, product_archive_shoe_size_chart_row.douyin_mapping_text),
      vip_mapping_text = coalesce(excluded.vip_mapping_text, product_archive_shoe_size_chart_row.vip_mapping_text),
      video_pdd_vip_mapping_text = coalesce(excluded.video_pdd_vip_mapping_text, product_archive_shoe_size_chart_row.video_pdd_vip_mapping_text),
      pinduoduo_mapping_text = coalesce(excluded.pinduoduo_mapping_text, product_archive_shoe_size_chart_row.pinduoduo_mapping_text),
      enabled = excluded.enabled,
      notes = excluded.notes,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `)
  const updateChartSource = db.prepare(`
    update product_archive_shoe_size_chart set
      source_file_name = coalesce(?, source_file_name),
      updated_at = ?::timestamptz
    where id = ?
  `)
  const items: Array<{ rowNumber: number | null; chartCode: string; sizeValue: number; status: "inserted" | "updated" }> = []
  let insertedCount = 0
  let updatedCount = 0
  db.transaction(() => {
    const touchedCharts = new Set<number>()
    for (const row of rows) {
      const chart = getChart(db, row.chartCode)
      const chartId = Number(chart.id)
      const existed = Boolean(existingRow.get(chartId, row.sizeValue))
      upsertRow.run(
        chartId,
        row.sizeValue,
        row.footLengthMm,
        row.footLengthToleranceMm,
        row.innerLengthMm,
        row.ageSegment ?? null,
        row.referenceAge ?? null,
        row.referenceStage ?? null,
        row.generalMappingText ?? null,
        row.douyinMappingText ?? null,
        row.vipMappingText ?? null,
        row.videoPddVipMappingText ?? null,
        row.pinduoduoMappingText ?? null,
        row.enabled,
        row.notes ?? null,
        userId,
        userId,
        now,
      )
      if (existed) updatedCount += 1
      else insertedCount += 1
      items.push({
        rowNumber: row.rowNumber ?? null,
        chartCode: row.chartCode,
        sizeValue: row.sizeValue,
        status: existed ? "updated" : "inserted",
      })
      touchedCharts.add(chartId)
    }
    touchedCharts.forEach((chartId) => updateChartSource.run(sourceFileName, now, chartId))
  })()
  return { inputRowCount: rows.length, insertedCount, updatedCount, items }
}
