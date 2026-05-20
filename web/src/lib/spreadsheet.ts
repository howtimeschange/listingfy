import * as XLSX from "xlsx"

export type SpreadsheetRow = Record<string, string | number | boolean | null>
export interface SpreadsheetSheet {
  name: string
  rows: SpreadsheetRow[]
}

const SHEET_ROW_LIMIT = 1_000_000
const SHEET_WRITE_CHUNK = 50_000

export async function readSpreadsheetFile(file: File): Promise<SpreadsheetRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, {
    defval: "",
    raw: false,
  })
}

function downloadWorkbook(filename: string, workbook: XLSX.WorkBook) {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
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
  return `${baseName.slice(0, Math.max(1, maxBaseLength))}${suffix}`
}

function appendRowsToWorksheet(rows: SpreadsheetRow[]) {
  const firstChunk = rows.slice(0, SHEET_WRITE_CHUNK)
  const worksheet = XLSX.utils.json_to_sheet(firstChunk)
  for (let index = SHEET_WRITE_CHUNK; index < rows.length; index += SHEET_WRITE_CHUNK) {
    XLSX.utils.sheet_add_json(worksheet, rows.slice(index, index + SHEET_WRITE_CHUNK), {
      origin: -1,
      skipHeader: true,
    })
  }
  return worksheet
}

export function exportWorkbook(filename: string, sheets: SpreadsheetSheet[]) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const rows = sheet.rows
    if (!rows.length) continue
    const chunkCount = Math.max(1, Math.ceil(rows.length / SHEET_ROW_LIMIT))
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * SHEET_ROW_LIMIT
      const end = Math.min(start + SHEET_ROW_LIMIT, rows.length)
      const worksheet = appendRowsToWorksheet(rows.slice(start, end))
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetNameWithIndex(sheet.name, index, chunkCount))
    }
  }
  downloadWorkbook(filename, workbook)
}

export function exportSpreadsheet(filename: string, rows: SpreadsheetRow[]) {
  exportWorkbook(filename, [{ name: "Sheet1", rows }])
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
