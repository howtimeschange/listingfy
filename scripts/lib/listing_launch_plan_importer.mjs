import fs from "node:fs";
import readline from "node:readline";
import { createRequire } from "node:module";
import {
  normalizeSpreadsheetRows,
  normalizeSpreadsheetRowsInChunks,
} from "./product_archive_source_importer.mjs";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
let excelJsModule = null;

function getExcelJS() {
  if (!excelJsModule) {
    excelJsModule = requireFromWeb("exceljs");
  }
  return excelJsModule;
}

const SUPPORTED_EXTENSIONS = new Set([".xlsx", ".csv"]);

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return dateText(value);
  return "";
}

function dateText(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeName(value) {
  return stringValue(value).toLowerCase();
}

function extensionFor(fileName = "") {
  const lower = normalizeName(fileName);
  const match = lower.match(/\.[a-z0-9]+$/);
  return match?.[0] ?? "";
}

function assertSupportedFile(fileName = "") {
  const extension = extensionFor(fileName);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("仅支持 .xlsx 和 .csv 文件，请先另存为新版 Excel 或 CSV");
  }
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error("上市计划表标准化已取消");
  error.name = "AbortError";
  throw error;
}

function coerceCellValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return dateText(value);
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean).join(",");
  if (typeof value === "object") {
    if (value.result != null) return coerceCellValue(value.result);
    if (value.text != null) return stringValue(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((part) => stringValue(part.text)).join("");
    if (value.hyperlink != null && value.text != null) return stringValue(value.text);
    if (value.formula != null) return stringValue(value.formula);
  }
  return stringValue(value);
}

function rowValuesToObject(values = []) {
  const row = {};
  for (let index = 1; index < values.length; index += 1) {
    const value = coerceCellValue(values[index]);
    if (value === "" || value == null) continue;
    row[`Column ${index}`] = value;
  }
  return row;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

async function readCsvRows(filePath) {
  const rows = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line.replace(/^\uFEFF/, ""));
    const row = {};
    values.forEach((value, index) => {
      if (value.trim()) row[`Column ${index + 1}`] = value.trim();
    });
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return [{ name: "Sheet1", rows }];
}

function hasUnresolvedSharedString(values = []) {
  return values.some((value) => value
    && typeof value === "object"
    && Number.isInteger(value.sharedString));
}

export class SpreadsheetResourceLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpreadsheetResourceLimitError";
    this.code = "SPREADSHEET_RESOURCE_LIMIT";
  }
}

const DEFAULT_SPREADSHEET_LIMITS = Object.freeze({
  chunkRows: 500,
  maxSheets: 50,
  maxRows: 200_000,
  maxCells: 4_000_000,
  maxCellChars: 100_000,
  maxTotalChars: 64 * 1024 * 1024,
});

function boundedResourceLimit(value, fallback, cap) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(cap, Math.floor(parsed)));
}

export function spreadsheetResourceLimits(options = {}) {
  return {
    chunkRows: boundedResourceLimit(options.chunkRows, DEFAULT_SPREADSHEET_LIMITS.chunkRows, 5_000),
    maxSheets: boundedResourceLimit(options.maxSheets, DEFAULT_SPREADSHEET_LIMITS.maxSheets, 200),
    maxRows: boundedResourceLimit(options.maxRows, DEFAULT_SPREADSHEET_LIMITS.maxRows, 1_000_000),
    maxCells: boundedResourceLimit(options.maxCells, DEFAULT_SPREADSHEET_LIMITS.maxCells, 20_000_000),
    maxCellChars: boundedResourceLimit(options.maxCellChars, DEFAULT_SPREADSHEET_LIMITS.maxCellChars, 1_000_000),
    maxTotalChars: boundedResourceLimit(options.maxTotalChars, DEFAULT_SPREADSHEET_LIMITS.maxTotalChars, 256 * 1024 * 1024),
  };
}

function createSpreadsheetResourceTracker(limits) {
  let rowCount = 0;
  let cellCount = 0;
  let totalChars = 0;
  const sheetIndexes = new Set();
  return {
    addSheet(sheetIndex) {
      sheetIndexes.add(sheetIndex);
      if (sheetIndexes.size > limits.maxSheets) {
        throw new SpreadsheetResourceLimitError(`表格工作表数量超过限制（最多 ${limits.maxSheets} 个）`);
      }
    },
    addRow(row) {
      rowCount += 1;
      if (rowCount > limits.maxRows) {
        throw new SpreadsheetResourceLimitError(`表格数据行数超过限制（最多 ${limits.maxRows} 行）`);
      }
      for (const value of Object.values(row)) {
        cellCount += 1;
        if (cellCount > limits.maxCells) {
          throw new SpreadsheetResourceLimitError(`表格非空单元格数量超过限制（最多 ${limits.maxCells} 个）`);
        }
        const chars = String(value ?? "").length;
        if (chars > limits.maxCellChars) {
          throw new SpreadsheetResourceLimitError(`表格单元格内容超过限制（最多 ${limits.maxCellChars} 个字符）`);
        }
        totalChars += chars;
        if (totalChars > limits.maxTotalChars) {
          throw new SpreadsheetResourceLimitError(`表格文本总量超过限制（最多 ${limits.maxTotalChars} 个字符）`);
        }
      }
    },
  };
}

async function emitSpreadsheetChunk(options, payload) {
  if (typeof options.onChunk !== "function") return;
  await options.onChunk(payload);
}

async function streamCsvSheet(filePath, options, limits) {
  const tracker = createSpreadsheetResourceTracker(limits);
  const rows = [];
  tracker.addSheet(0);
  const flush = async () => {
    if (rows.length === 0) return;
    const chunk = rows.splice(0, rows.length);
    await emitSpreadsheetChunk(options, { sheetIndex: 0, name: "Sheet1", rows: chunk });
  };
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line.replace(/^\uFEFF/, ""));
    const row = {};
    values.forEach((value, index) => {
      if (value.trim()) row[`Column ${index + 1}`] = value.trim();
    });
    if (Object.keys(row).length === 0) continue;
    tracker.addRow(row);
    rows.push(row);
    if (rows.length >= limits.chunkRows) await flush();
  }
  await flush();
}

class UnresolvedSharedStringError extends Error {}

async function streamXlsxSheets(filePath, options, limits) {
  const tracker = createSpreadsheetResourceTracker(limits);
  const workbookReader = new (getExcelJS().stream.xlsx.WorkbookReader)(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });
  let sheetIndex = 0;
  for await (const worksheetReader of workbookReader) {
    const currentSheetIndex = sheetIndex;
    const sheetName = worksheetReader.name || `Sheet${sheetIndex + 1}`;
    const rows = [];
    let hasRows = false;
    const flush = async () => {
      if (rows.length === 0) return;
      const chunk = rows.splice(0, rows.length);
      await emitSpreadsheetChunk(options, { sheetIndex: currentSheetIndex, name: sheetName, rows: chunk });
    };
    for await (const row of worksheetReader) {
      if (hasUnresolvedSharedString(row.values)) throw new UnresolvedSharedStringError();
      const item = rowValuesToObject(row.values);
      if (Object.keys(item).length === 0) continue;
      if (!hasRows) {
        tracker.addSheet(currentSheetIndex);
        hasRows = true;
      }
      tracker.addRow(item);
      rows.push(item);
      if (rows.length >= limits.chunkRows) await flush();
    }
    await flush();
    sheetIndex += 1;
  }
}

async function streamXlsxSheetsInMemory(filePath, options, limits) {
  const tracker = createSpreadsheetResourceTracker(limits);
  const workbook = new (getExcelJS().Workbook)();
  await workbook.xlsx.readFile(filePath);
  let sheetIndex = 0;
  for (const worksheet of workbook.worksheets) {
    const currentSheetIndex = sheetIndex;
    const sheetName = worksheet.name || `Sheet${sheetIndex + 1}`;
    const rows = [];
    let hasRows = false;
    const flush = async () => {
      if (rows.length === 0) return;
      const chunk = rows.splice(0, rows.length);
      await emitSpreadsheetChunk(options, { sheetIndex: currentSheetIndex, name: sheetName, rows: chunk });
    };
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const item = rowValuesToObject(worksheet.getRow(rowNumber).values);
      if (Object.keys(item).length === 0) continue;
      if (!hasRows) {
        tracker.addSheet(currentSheetIndex);
        hasRows = true;
      }
      tracker.addRow(item);
      rows.push(item);
      if (rows.length >= limits.chunkRows) await flush();
    }
    await flush();
    sheetIndex += 1;
  }
}

/**
 * Streams bounded row chunks to the caller. When ExcelJS exposes worksheet
 * entries before workbook metadata, a stable reader is used only inside the
 * memory-capped worker fallback; the caller discards chunks from the failed
 * streaming attempt first.
 */
export async function streamSpreadsheetSheetsFromFile(filePath, options = {}) {
  const fileName = options.fileName || filePath;
  assertSupportedFile(fileName);
  const limits = spreadsheetResourceLimits(options);
  if (extensionFor(fileName) === ".csv") {
    await streamCsvSheet(filePath, options, limits);
    return;
  }
  try {
    await streamXlsxSheets(filePath, options, limits);
  } catch (error) {
    if (error instanceof SpreadsheetResourceLimitError) throw error;
    await options.onReset?.();
    await streamXlsxSheetsInMemory(filePath, options, limits);
  }
}

async function readXlsxSheetsInMemory(filePath) {
  const workbook = new (getExcelJS().Workbook)();
  await workbook.xlsx.readFile(filePath);
  const sheets = [];
  for (const worksheet of workbook.worksheets) {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const item = rowValuesToObject(row.values);
      if (Object.keys(item).length > 0) rows.push(item);
    });
    if (rows.length > 0) {
      sheets.push({ name: worksheet.name || `Sheet${sheets.length + 1}`, rows });
    }
  }
  return sheets;
}

async function readXlsxSheetsStreaming(filePath) {
  const workbookReader = new (getExcelJS().stream.xlsx.WorkbookReader)(filePath, {
    entries: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });
  const sheets = [];
  let unresolvedSharedStrings = false;
  for await (const worksheetReader of workbookReader) {
    const rows = [];
    for await (const row of worksheetReader) {
      unresolvedSharedStrings ||= hasUnresolvedSharedString(row.values);
      const item = rowValuesToObject(row.values);
      if (Object.keys(item).length > 0) rows.push(item);
    }
    if (rows.length > 0) {
      sheets.push({ name: worksheetReader.name || `Sheet${sheets.length + 1}`, rows });
    }
  }
  return unresolvedSharedStrings ? null : sheets;
}

export async function readSpreadsheetSheetsFromFile(filePath, options = {}) {
  const fileName = options.fileName || filePath;
  assertSupportedFile(fileName);
  if (extensionFor(fileName) === ".csv") return readCsvRows(filePath);
  try {
    const streamed = await readXlsxSheetsStreaming(filePath);
    if (streamed) return streamed;
  } catch {
    // ExcelJS streaming can race workbook/shared-string ZIP entries; retry with the stable reader.
  }
  return readXlsxSheetsInMemory(filePath);
}

const HEADER_HINTS = new Set([
  "产品季",
  "大货款号",
  "款色号",
  "产品线",
  "上市时间",
  "内容上市时间",
  "搜索上市时间",
  "发布类目 (官方)",
  "官方发布类目",
  "发布类目 (唯品)",
  "发布类目 (抖音)",
]);

function compactKey(value) {
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

function headerScore(row) {
  let score = 0;
  for (const value of Object.values(row ?? {})) {
    const text = stringValue(value);
    const compact = compactKey(text);
    if (HEADER_HINTS.has(text)) score += 2;
    if ([...HEADER_HINTS].some((hint) => compactKey(hint) === compact || compact.includes(compactKey(hint)))) score += 1;
  }
  return score;
}

function detectHeaderIndex(rows = []) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, 12).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestScore >= 3 ? bestIndex : -1;
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) return value;
  }
  return "";
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = stringValue(value).replace(/[,，]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanRawRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    const text = stringValue(value);
    if (text) output[key] = text;
  }
  return output;
}

export function normalizeListingLaunchPlanRows(rows = [], options = {}) {
  const headerIndex = detectHeaderIndex(rows);
  const normalizedRows = normalizeSpreadsheetRows(rows);
  return normalizedRows
    .map((row, index) => {
      const spuCode = firstValue(row, ["大货款号", "款号", "货号", "商品品种编号"]);
      if (!spuCode) return null;
      const launchDateText = firstValue(row, ["上市时间", "内容上市时间", "测试上市时间"]);
      return {
        sheetName: stringValue(options.sheetName),
        rowNumber: headerIndex >= 0 ? headerIndex + index + 2 : index + 2,
        spuCode,
        skcCode: firstValue(row, ["款色号", "款色", "款色编码"]) || null,
        productSeason: firstValue(row, ["产品季"]) || null,
        productLine: firstValue(row, ["产品线"]) || null,
        scene: firstValue(row, ["场景"]) || null,
        attribute: firstValue(row, ["属性", "属性-销"]) || null,
        ageGroup: firstValue(row, ["年龄段"]) || null,
        sizeRange: firstValue(row, ["尺码段"]) || null,
        gender: firstValue(row, ["性别"]) || null,
        categoryName: firstValue(row, ["品类"]) || null,
        subcategoryName: firstValue(row, ["小类"]) || null,
        colorName: firstValue(row, ["颜色名称", "颜色"]) || null,
        colorCode: firstValue(row, ["颜色代码"]) || null,
        tagPrice: numberValue(firstValue(row, ["吊牌价", "吊牌价格"])),
        calculatedTagPrice: numberValue(firstValue(row, ["核算吊牌价"])),
        fabric: firstValue(row, ["大身面料", "面料", "面种"]) || null,
        fab: firstValue(row, ["FAB"]) || null,
        launchBatch: firstValue(row, ["上市批次"]) || null,
        launchDateText,
        searchLaunchDateText: firstValue(row, ["搜索上市时间"]) || "",
        contentLaunchDateText: firstValue(row, ["内容上市时间"]) || "",
        listingChannel: firstValue(row, ["上市渠道", "测款上市渠道"]) || null,
        officialCategory: firstValue(row, ["官方发布类目", "发布类目 (官方)", "发布类目(官方)", "发布类目（官方）"]) || null,
        vipCategory: firstValue(row, ["发布类目 (唯品)", "发布类目(唯品)", "发布类目（唯品）"]) || null,
        vipStyleCategory: firstValue(row, ["主款式 （唯品四级品类）", "主款式（唯品四级品类）", "主款式 (唯品四级品类)"]) || null,
        douyinCategory: firstValue(row, ["发布类目 (抖音)", "发布类目(抖音)", "发布类目（抖音）"]) || null,
        rawRowJson: cleanRawRow(row),
      };
    })
    .filter(Boolean);
}

export async function normalizeListingLaunchPlanRowsInChunks(rows = [], options = {}) {
  const headerIndex = detectHeaderIndex(rows);
  const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? 1000)));
  const normalizedRows = await normalizeSpreadsheetRowsInChunks(rows, { chunkSize, signal: options.signal });
  const output = [];
  for (let start = 0; start < normalizedRows.length; start += chunkSize) {
    throwIfAborted(options.signal);
    const end = Math.min(start + chunkSize, normalizedRows.length);
    for (let index = start; index < end; index += 1) {
      const row = normalizedRows[index];
      const spuCode = firstValue(row, ["大货款号", "款号", "货号", "商品品种编号"]);
      if (!spuCode) continue;
      const launchDateText = firstValue(row, ["上市时间", "内容上市时间", "测试上市时间"]);
      output.push({
        sheetName: stringValue(options.sheetName),
        rowNumber: headerIndex >= 0 ? headerIndex + index + 2 : index + 2,
        spuCode,
        skcCode: firstValue(row, ["款色号", "款色", "款色编码"]) || null,
        productSeason: firstValue(row, ["产品季"]) || null,
        productLine: firstValue(row, ["产品线"]) || null,
        scene: firstValue(row, ["场景"]) || null,
        attribute: firstValue(row, ["属性", "属性-销"]) || null,
        ageGroup: firstValue(row, ["年龄段"]) || null,
        sizeRange: firstValue(row, ["尺码段"]) || null,
        gender: firstValue(row, ["性别"]) || null,
        categoryName: firstValue(row, ["品类"]) || null,
        subcategoryName: firstValue(row, ["小类"]) || null,
        colorName: firstValue(row, ["颜色名称", "颜色"]) || null,
        colorCode: firstValue(row, ["颜色代码"]) || null,
        tagPrice: numberValue(firstValue(row, ["吊牌价", "吊牌价格"])),
        calculatedTagPrice: numberValue(firstValue(row, ["核算吊牌价"])),
        fabric: firstValue(row, ["大身面料", "面料", "面种"]) || null,
        fab: firstValue(row, ["FAB"]) || null,
        launchBatch: firstValue(row, ["上市批次"]) || null,
        launchDateText,
        searchLaunchDateText: firstValue(row, ["搜索上市时间"]) || "",
        contentLaunchDateText: firstValue(row, ["内容上市时间"]) || "",
        listingChannel: firstValue(row, ["上市渠道", "测款上市渠道"]) || null,
        officialCategory: firstValue(row, ["官方发布类目", "发布类目 (官方)", "发布类目(官方)", "发布类目（官方）"]) || null,
        vipCategory: firstValue(row, ["发布类目 (唯品)", "发布类目(唯品)", "发布类目（唯品）"]) || null,
        vipStyleCategory: firstValue(row, ["主款式 （唯品四级品类）", "主款式（唯品四级品类）", "主款式 (唯品四级品类)"]) || null,
        douyinCategory: firstValue(row, ["发布类目 (抖音)", "发布类目(抖音)", "发布类目（抖音）"]) || null,
        rawRowJson: cleanRawRow(row),
      });
    }
    await options.onProgress?.({
      processedRowCount: end,
      totalRowCount: normalizedRows.length,
      normalizedRowCount: output.length,
    });
    throwIfAborted(options.signal);
    await wait();
  }
  return output;
}
