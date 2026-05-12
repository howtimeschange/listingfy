import * as XLSX from "xlsx"

export type SpreadsheetRow = Record<string, string | number | boolean | null>
export interface SpreadsheetSheet {
  name: string
  rows: SpreadsheetRow[]
}

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

export function exportWorkbook(filename: string, sheets: SpreadsheetSheet[]) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
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
