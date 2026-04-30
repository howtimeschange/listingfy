import * as XLSX from "xlsx"

export type SpreadsheetRow = Record<string, string | number | boolean | null>

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

export function exportSpreadsheet(filename: string, rows: SpreadsheetRow[]) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
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
