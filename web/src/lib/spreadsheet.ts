import ExcelJS from "exceljs"

export type SpreadsheetRow = Record<string, string | number | boolean | null>
export interface SpreadsheetSheet {
  name: string
  rows: SpreadsheetRow[]
}

const SHEET_ROW_LIMIT = 1_000_000
const SHEET_WRITE_CHUNK = 50_000
const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024

type CellPrimitive = string | number | boolean | null

function normalizeFileName(file: File) {
  return file.name.toLowerCase()
}

function assertSupportedImportFile(file: File) {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("表格文件过大，请拆分后再导入")
  }
  const name = normalizeFileName(file)
  if (name.endsWith(".xlsx") || name.endsWith(".csv")) return
  throw new Error("仅支持 .xlsx 和 .csv 文件，请先另存为新版 Excel 或 CSV")
}

function coerceCellValue(value: ExcelJS.CellValue | unknown): CellPrimitive {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(",")
  if (typeof value === "object") {
    const record = value as {
      text?: unknown
      result?: unknown
      formula?: unknown
      richText?: Array<{ text?: unknown }>
      hyperlink?: unknown
    }
    if (record.result != null) return coerceCellValue(record.result)
    if (record.text != null) return String(record.text)
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => String(part.text ?? "")).join("")
    }
    if (record.hyperlink != null && record.text != null) return String(record.text)
    return String(record.formula ?? "")
  }
  return String(value)
}

function cellText(value: ExcelJS.CellValue | unknown) {
  const coerced = coerceCellValue(value)
  return coerced == null ? "" : String(coerced).trim()
}

function uniqueHeaderName(rawHeader: string, colNumber: number, seen: Map<string, number>) {
  const base = rawHeader || `Column ${colNumber}`
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base} ${count + 1}`
}

function worksheetToRows(worksheet: ExcelJS.Worksheet): SpreadsheetRow[] {
  const headerRow = worksheet.getRow(1)
  const headers: string[] = []
  const seenHeaders = new Map<string, number>()
  for (let colNumber = 1; colNumber <= worksheet.columnCount; colNumber += 1) {
    const header = cellText(headerRow.getCell(colNumber).value)
    headers[colNumber - 1] = uniqueHeaderName(header, colNumber, seenHeaders)
  }
  if (headers.length === 0) return []

  const rows: SpreadsheetRow[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const item: SpreadsheetRow = {}
    let hasValue = false
    for (let index = 0; index < headers.length; index += 1) {
      const key = headers[index]
      if (!key) continue
      const value = coerceCellValue(row.getCell(index + 1).value)
      item[key] = value
      if (value !== "" && value != null) hasValue = true
    }
    if (hasValue) rows.push(item)
  })
  return rows
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ""
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\""
      index += 1
      continue
    }
    if (char === "\"") {
      inQuotes = !inQuotes
      continue
    }
    if (char === "," && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }
  values.push(current)
  return values
}

function parseCsv(text: string): SpreadsheetRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0]).map((header, index) => header.trim() || `Column ${index + 1}`)
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: SpreadsheetRow = {}
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? ""
    }
    return row
  }).filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
}

export async function readSpreadsheetFile(file: File): Promise<SpreadsheetRow[]> {
  const sheets = await readSpreadsheetWorkbook(file)
  return sheets[0]?.rows ?? []
}

export async function readSpreadsheetWorkbook(file: File): Promise<SpreadsheetSheet[]> {
  assertSupportedImportFile(file)
  const name = normalizeFileName(file)
  if (name.endsWith(".csv")) {
    return [{ name: "Sheet1", rows: parseCsv(await file.text()) }].filter((sheet) => sheet.rows.length > 0)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  return workbook.worksheets
    .map((worksheet) => ({
      name: worksheet.name,
      rows: worksheetToRows(worksheet),
    }))
    .filter((sheet) => sheet.rows.length > 0)
}

function downloadWorkbook(filename: string, buffer: ArrayBuffer) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function sheetNameWithIndex(baseName: string, index: number, total: number) {
  const suffix = total > 1 ? `-${index + 1}` : ""
  const maxBaseLength = 31 - suffix.length
  const safeBase = baseName.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet"
  return `${safeBase.slice(0, Math.max(1, maxBaseLength))}${suffix}`
}

function rowColumns(rows: SpreadsheetRow[]) {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  return columns
}

function appendRowsToWorksheet(
  worksheet: ExcelJS.Worksheet,
  columns: string[],
  rows: SpreadsheetRow[],
  start = 0,
  end = rows.length,
) {
  worksheet.addRow(columns)
  for (let index = start; index < end; index += SHEET_WRITE_CHUNK) {
    const chunkEnd = Math.min(index + SHEET_WRITE_CHUNK, end)
    for (let rowIndex = index; rowIndex < chunkEnd; rowIndex += 1) {
      const row = rows[rowIndex]
      worksheet.addRow(columns.map((column) => row[column] ?? ""))
    }
  }
}

export async function exportWorkbook(filename: string, sheets: SpreadsheetSheet[]) {
  const workbook = new ExcelJS.Workbook()
  for (const sheet of sheets) {
    const rows = sheet.rows
    if (!rows.length) continue
    const columns = rowColumns(rows)
    const chunkCount = Math.max(1, Math.ceil(rows.length / SHEET_ROW_LIMIT))
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * SHEET_ROW_LIMIT
      const end = Math.min(start + SHEET_ROW_LIMIT, rows.length)
      const worksheet = workbook.addWorksheet(sheetNameWithIndex(sheet.name, index, chunkCount))
      appendRowsToWorksheet(worksheet, columns, rows, start, end)
    }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  downloadWorkbook(filename, buffer as ArrayBuffer)
}

export async function exportSpreadsheet(filename: string, rows: SpreadsheetRow[]) {
  await exportWorkbook(filename, [{ name: "Sheet1", rows }])
}

export function parseBatchSearch(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}
