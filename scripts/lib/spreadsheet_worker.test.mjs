import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readSpreadsheetSheetsFromFileInWorker } from "../../web/server/services/spreadsheet-worker.ts";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));

test("spreadsheet worker transfers rows in acknowledged bounded chunks", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "listingify-sheet-worker-"));
  const filePath = path.join(directory, "rows.csv");
  try {
    await writeFile(filePath, "款号,颜色\nA001,红\nA002,蓝\nA003,绿\nA004,黑\n", "utf8");
    const chunks = [];
    const sheets = await readSpreadsheetSheetsFromFileInWorker(filePath, {
      fileName: "rows.csv",
      chunkRows: 2,
      onChunk: ({ rowCount }) => chunks.push(rowCount),
    });
    assert.deepEqual(chunks, [2, 2, 1]);
    assert.equal(sheets.length, 1);
    assert.equal(sheets[0].rows.length, 5);
    assert.equal(sheets[0].rows[1]["Column 1"], "A001");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spreadsheet worker rejects files that exceed configured resource limits", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "listingify-sheet-limit-"));
  const filePath = path.join(directory, "too-many.csv");
  try {
    await writeFile(filePath, "a,b\nc,d\ne,f\n", "utf8");
    await assert.rejects(
      readSpreadsheetSheetsFromFileInWorker(filePath, {
        fileName: "too-many.csv",
        chunkRows: 2,
        maxRows: 2,
      }),
      (error) => error?.name === "SpreadsheetResourceLimitError"
        && error?.code === "SPREADSHEET_RESOURCE_LIMIT",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("spreadsheet worker streams XLSX shared strings without whole-workbook transfer", async () => {
  const ExcelJS = requireFromWeb("exceljs");
  const directory = await mkdtemp(path.join(os.tmpdir(), "listingify-xlsx-worker-"));
  const filePath = path.join(directory, "rows.xlsx");
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("上市计划");
    sheet.addRow(["大货款号", "颜色"]);
    sheet.addRow(["A001", "红"]);
    sheet.addRow(["A002", "红"]);
    sheet.addRow(["A003", "蓝"]);
    await workbook.xlsx.writeFile(filePath);

    const chunks = [];
    const sheets = await readSpreadsheetSheetsFromFileInWorker(filePath, {
      fileName: "rows.xlsx",
      chunkRows: 2,
      onChunk: ({ rowCount }) => chunks.push(rowCount),
    });
    assert.deepEqual(chunks, [2, 2]);
    assert.equal(sheets[0].name, "上市计划");
    assert.equal(sheets[0].rows[3]["Column 1"], "A003");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
