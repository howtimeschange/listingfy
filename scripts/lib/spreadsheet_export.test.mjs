import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SPREADSHEET_FILE = path.join(PROJECT_ROOT, "web/src/lib/spreadsheet.ts");

async function fileText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

test("spreadsheet export uses an explicit browser download link", async () => {
  const spreadsheet = await fileText(SPREADSHEET_FILE);

  assert.match(spreadsheet, /XLSX\.write\(workbook/);
  assert.match(spreadsheet, /new Blob/);
  assert.match(spreadsheet, /URL\.createObjectURL/);
  assert.match(spreadsheet, /document\.createElement\("a"\)/);
  assert.match(spreadsheet, /link\.download = filename/);
  assert.match(spreadsheet, /link\.click\(\)/);
  assert.match(spreadsheet, /URL\.revokeObjectURL/);
  assert.doesNotMatch(spreadsheet, /XLSX\.writeFile\(workbook, filename\)/);
});

test("spreadsheet export can write multiple named sheets", async () => {
  const spreadsheet = await fileText(SPREADSHEET_FILE);

  assert.match(spreadsheet, /exportWorkbook/);
  assert.match(spreadsheet, /SpreadsheetSheet/);
  assert.match(spreadsheet, /sheet\.name/);
  assert.match(spreadsheet, /sheetNameWithIndex/);
  assert.match(spreadsheet, /SHEET_ROW_LIMIT/);
  assert.match(spreadsheet, /XLSX\.utils\.book_append_sheet\(workbook, worksheet, sheetNameWithIndex\(sheet\.name, index, chunkCount\)\)/);
});
