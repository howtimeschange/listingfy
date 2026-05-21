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

test("SHEIN platform product export expands SKC/SKU rows with matching SKC images and supplier codes", async () => {
  const { platformProductWorkbookSheets } = await import("../../web/src/lib/shein-platform-product-export.ts");

  const sheets = platformProductWorkbookSheets([
    {
      spuName: "SPU001",
      supplierCode: "SPU-SUP",
      productName: "Test Product",
      brandName: "Brand",
      categoryName: "Category",
      imageUrl: "https://example.invalid/product.jpg",
      costSummary: "mixed",
      saleSiteCount: 1,
      saleSiteSummary: "上架 1 站：shein-us",
      skcCount: 2,
      skuCount: 3,
      lastDetailSyncedAt: "2026-05-21T01:00:00.000Z",
      lastListSyncedAt: "2026-05-21T00:00:00.000Z",
      saleSites: [
        {
          siteAbbr: "shein-us",
          siteName: "US",
          shelfStatus: 1,
          shelfStatusText: "已上架",
          firstShelfTime: "2026-05-20 10:00:00",
          lastShelfTime: "2026-05-21 10:00:00",
          link: "https://example.invalid/us",
          source: "SKC-A",
        },
      ],
      skcs: [
        {
          skcName: "SKC-A",
          supplierCode: "SKC-SUP-A",
          imageUrl: "https://example.invalid/skc-a.jpg",
          shelfStatusText: "已上架",
          skuCount: 1,
          skus: [
            {
              skuCode: "SKU-A1",
              supplierSku: "SKU-SUP-A1",
              saleText: "Size: 110",
              costs: "10 CNY",
              prices: "US 20 USD",
            },
          ],
        },
        {
          skcName: "SKC-B",
          supplierCode: "SKC-SUP-B",
          imageUrl: "https://example.invalid/skc-b.jpg",
          shelfStatusText: "未上架",
          skuCount: 2,
          skus: [
            {
              skuCode: "SKU-B1",
              supplierSku: "SKU-SUP-B1",
              saleText: "Size: 120",
              costs: "11 CNY",
              prices: "US 21 USD",
            },
            {
              skuCode: "SKU-B2",
              supplierSku: "SKU-SUP-B2",
              saleText: "Size: 130",
              costs: "12 CNY",
              prices: "US 22 USD",
            },
          ],
        },
      ],
      skuCodeList: ["SKU-A1", "SKU-B1", "SKU-B2"],
    },
  ]);

  assert.deepEqual(sheets.map((sheet) => sheet.name), ["平台商品列表", "SKC/SKU明细", "销售站点明细"]);

  const detailRows = sheets.find((sheet) => sheet.name === "SKC/SKU明细")?.rows ?? [];
  assert.equal(detailRows.length, 3);
  assert.deepEqual(detailRows.map((row) => row.SKC), ["SKC-A", "SKC-B", "SKC-B"]);
  assert.deepEqual(detailRows.map((row) => row.SKC供应商货号), ["SKC-SUP-A", "SKC-SUP-B", "SKC-SUP-B"]);
  assert.deepEqual(detailRows.map((row) => row.SKC图片), [
    "https://example.invalid/skc-a.jpg",
    "https://example.invalid/skc-b.jpg",
    "https://example.invalid/skc-b.jpg",
  ]);
  assert.equal(detailRows[0].SPU供应商货号, "SPU-SUP");
  assert.equal(detailRows[0].SKU, "SKU-A1");
  assert.equal(detailRows[0].SKU供应商货号, "SKU-SUP-A1");
});
