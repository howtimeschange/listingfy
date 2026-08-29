import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAiScenarioRouter } from "./ai_scenario_router.mjs";
import { withAiRoutingHashes } from "./ai_routing_context.mjs";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "..", "..");
const WEB_PACKAGE_JSON = path.join(PROJECT_ROOT, "web", "package.json");
const requireFromWeb = createRequire(WEB_PACKAGE_JSON);
const BUNDLED_TESSERACT_LANG_PATH = path.join(PROJECT_ROOT, "vendor", "tesseract", "lang");

const STYLE_CODE_RE = /(?<!\d)20\d{10}(?!\d)/g;
const STANDARD_RE = /\b(?:Q\s*\/\s*[A-Z0-9\u4e00-\u9fa5._-]+(?:\s+\d{2,4})?-\d{2,4}|(?:GB|FZ|QB)\s*\/\s*T\s*\d+(?:[./ -]\d+)*)/i;
const SAFETY_RE = /(?:符合\s*)?GB\s*31701\s*[ABCＡＢＣ]\s*类/i;
const FIELD_LABELS = {
  productName: ["产品名称", "品名", "名称"],
  articleNo: ["产品货号", "货号", "款号", "产品款号"],
  executionStandard: ["执行标准", "执行标准号", "产品执行标准"],
  safetyCategory: ["安全技术类别", "安全技术级别", "安全类别", "安全技术要求"],
  productGrade: ["产品等级", "质量等级", "等级"],
  materialComposition: ["面料成分", "材质成分", "纤维含量", "成分"],
  downFillWeight: ["充绒量", "充绒量（单位：克）", "充绒量(单位：克)", "充绒量(单位:克)"],
  washCare: ["洗涤说明", "洗护说明", "洗涤方法", "洗护方法"],
};
const FIELD_LABEL_TEXT = Object.values(FIELD_LABELS).flat();
const OCR_FILE_CACHE_MAX_ENTRIES = 500;
const ocrFileResultCache = new Map();
const SCM_COMPOSITION_COMPONENT_LABELS = [
  "主面料",
  "下摆罗纹",
  "袖口罗纹",
  "领口罗纹",
  "罗纹",
  "面料",
  "里料",
  "配料",
  "填充物",
  "大身",
  "帽里",
  "袋布",
  "绳带",
];

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function recordValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  const error = new Error(stringValue(signal.reason) || "吊牌/洗唛 OCR 任务已取消");
  error.name = "AbortError";
  throw error;
}

function uniqueTextValues(values) {
  const seen = new Set();
  const output = [];
  for (const value of values.map(stringValue).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function escapeRegExp(value) {
  return stringValue(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStandardText(value) {
  return stringValue(value)
    .replace(/[；;，,。].*$/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\bQ\/BALABALA\s*(?=\d{2,4}-\d{2,4}\b)/ig, "Q/BALABALA ")
    .replace(/\bGB\s*\/\s*T\b/ig, "GB/T")
    .replace(/\bFZ\s*\/\s*T\b/ig, "FZ/T")
    .replace(/\bQB\s*\/\s*T\b/ig, "QB/T")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\bGB\s*31701\s*([ABCＡＢＣ])\s*类/ig, (_match, category) => `GB 31701 ${String(category).toUpperCase()}类`)
    .replace(/[-–—]+$/g, "")
    .trim();
}

function cleanExecutionStandardValue(value) {
  const match = normalizeStandardText(value).match(STANDARD_RE);
  return match ? normalizeStandardText(match[0]) : "";
}

function normalizeOcrText(value) {
  return stringValue(value)
    .replace(/\r/g, "\n")
    .replace(/[：﹕]/g, ":")
    .replace(/[ＡＢＣ]/g, (text) => ({ "Ａ": "A", "Ｂ": "B", "Ｃ": "C" }[text] ?? text))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function linesFromText(text) {
  return normalizeOcrText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function compactLine(value) {
  return stringValue(value).replace(/\s+/g, "");
}

function looksLikeAnotherLabel(value) {
  const compact = compactLine(value);
  return FIELD_LABEL_TEXT.some((label) => compact.startsWith(label.replace(/\s+/g, "")));
}

function shouldStopRichContinuation(value, key) {
  const text = stringValue(value);
  if (!text) return true;
  if (looksLikeAnotherLabel(text)) return true;
  if (STYLE_CODE_RE.test(text)) {
    STYLE_CODE_RE.lastIndex = 0;
    return true;
  }
  STYLE_CODE_RE.lastIndex = 0;
  if (/^(?:中国制造|made in china|CAEAOHO B KnTae)/i.test(text)) return true;
  if (key === "materialComposition" && /^(?:洗涤说明|洗护说明|washing instructions)\b/i.test(text)) return true;
  return false;
}

function enrichSimpleLabelValue(lines, index, value, key) {
  const text = stringValue(value);
  if (key === "safetyCategory" && /GB\s*31701/i.test(text) && !/[ABCＡＢＣ]\s*类/i.test(text)) {
    const next = lines.slice(index + 1, index + 5).map(stringValue).find((line) => (
      /[ABCＡＢＣ]\s*(?:类|弥|粪)/i.test(line)
      || (/[ABCＡＢＣ]/i.test(line) && /(?:婴幼儿|用品|安全技术类别)/.test(line))
    ));
    if (next) {
      return `${text} ${next}`;
    }
  }
  return text;
}

function collectRichLabelValue(lines, index, initialValue, key) {
  const collected = [];
  const first = stringValue(initialValue);
  if (first && !shouldStopRichContinuation(first, key)) collected.push(first);
  for (let cursor = index + 1; cursor < lines.length && collected.length < 12; cursor += 1) {
    const line = lines[cursor];
    if (shouldStopRichContinuation(line, key)) break;
    collected.push(line);
  }
  return collected.join("\n");
}

function normalizeMaterialCompositionText(value) {
  return stringValue(value)
    .split(/\n+/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^(?:laba|ps\)|balabala)$/i.test(line))
    .map((line) => line
      .replace(/^t\s*(装饰部分除外)\s*[)）]?$/i, "($1)")
      .replace(/100[?2]?6(?=\s*聚酯)/g, "100%")
      .replace(/96\.4%?6(?=\s*聚酯)/g, "96.4%")
      .replace(/3\.20%?6(?=\s*(?:锦纶|锣纶))/g, "3.2%")
      .replace(/0\.4(?:2|26|%?6)(?=\s*氨纶)/g, "0.4%")
      .replace(/锣纶/g, "锦纶"))
    .join("\n")
    .replace(/[；;，,。]\s*$/g, "")
    .trim();
}

export function normalizeScmChineseCompositionText(value) {
  const labelPattern = SCM_COMPOSITION_COMPONENT_LABELS
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const text = stringValue(value)
    .replace(/\r/g, "\n")
    .replace(/\s+/g, "")
    .replace(/^成分[:：]?/g, "")
    .replace(new RegExp(`(${labelPattern})[:：]`, "g"), "\n$1: ")
    .replace(/(\([^)]*装饰部分除外[^)]*\)|（[^）]*装饰部分除外[^）]*）)/g, "\n$1\n")
    .replace(/(?<=[\u4e00-\u9fa5)）])(?=\d+(?:\.\d+)?%)/g, "\n")
    .replace(/\n{2,}/g, "\n");
  return normalizeMaterialCompositionText(text);
}

function normalizeWashCareText(value) {
  const output = [];
  for (const rawLine of stringValue(value).split(/\n+/)) {
    const line = rawLine.replace(/\s{2,}/g, " ").trim();
    if (!line || /^\d+$/.test(line)) continue;
    if (/^(?:中国制|made in china|CAEAOHO B KnTae)/i.test(line)) break;
    output.push(line
      .replace(/不可干活/g, "不可干洗")
      .replace(/如有绍/g, "如有轻")
      .replace(/做褪色/g, "微褪色")
      .replace(/环象/g, "现象")
      .replace(/衣服不宥/g, "衣服不宜")
      .replace(/表服不宥/g, "衣服不宜"));
  }
  return output.join("\n").replace(/[；;，,。.]\s*$/g, "").trim();
}

function cleanLabelValue(value, key) {
  let text = stringValue(value)
    .replace(/^[:：\s]+/g, "")
    .trim();
  if (!text) return "";
  if (key === "materialComposition") {
    return normalizeMaterialCompositionText(text);
  }
  if (key === "washCare") {
    return normalizeWashCareText(text);
  }
  text = text.replace(/\s{2,}/g, " ");
  if (key === "productName") {
    const name = text
      .replace(/^[^0-9A-Za-z\u4e00-\u9fa5]+/g, "")
      .replace(/^[A-Za-z]\s+(?=[\u4e00-\u9fa5])/g, "")
      .split(/[|｜]/)[0]
      .replace(/\s*(?:产品名称|商品名称|品名).*$/g, "")
      .trim();
    if (name) return name;
  }
  if (key === "articleNo") {
    const styleCode = extractStyleCodesFromText(text)[0];
    if (styleCode) return styleCode;
  }
  if (key === "executionStandard") {
    return cleanExecutionStandardValue(text);
  }
  if (key === "safetyCategory") {
    const normalizedSafety = normalizeStandardText(text.replace(/([ABCＡＢＣ])\s*[弥粪]\s*/g, "$1类"));
    const safety = normalizedSafety.match(/(?:符合\s*)?GB\s*31701\s*[ABC]\s*类/i)?.[0]
      ?? normalizedSafety.match(/(?:符合\s*)?GB\s*31701/i)?.[0];
    const safetyClass = normalizedSafety.match(/[ABC]\s*类/i)?.[0];
    if (/GB\s*31701/i.test(normalizedSafety) && safetyClass && (!safety || !/[ABC]\s*类/i.test(safety))) {
      return normalizeStandardText(`${/^符合/i.test(normalizedSafety) ? "符合" : ""}GB 31701 ${safetyClass}`);
    }
    if (safety) return normalizeStandardText(safety);
    text = normalizedSafety;
  }
  if (key === "productGrade") {
    const grade = text.match(/优等品|一等品|合格品|二等品/)?.[0];
    if (grade) return grade;
  }
  if (key === "downFillWeight") {
    const weightText = text
      .replace(/^充绒量(?:（单位[:：]?克）|\(单位[:：]?克\))?\s*[:：]?/i, "")
      .split(/\n{2,}/)[0]
      .trim();
    if (!downFillWeightLooksReliable(weightText)) return "";
    return weightText.slice(0, 500);
  }
  if (key === "articleNo") text = text.replace(/[-–—]+$/g, "");
  return text.replace(/[；;，,。]\s*$/g, "").trim();
}

function downFillWeightLooksReliable(value) {
  const text = stringValue(value).trim();
  if (!text) return false;
  if (/[A-Za-z\u0400-\u04ff]/.test(text)) return false;
  const numericTokens = text.match(/\d{1,3}/g) ?? [];
  if (numericTokens.length < 4) return false;
  const linesWithNumbers = text
    .split(/\n+/)
    .filter((line) => (line.match(/\d{1,3}/g) ?? []).length >= 2);
  if (linesWithNumbers.length >= 2) return true;
  return /(?:\d{1,3}\s*[:：]\s*\d{1,3})(?:[;；,，\s]+(?:\d{1,3}\s*[:：]\s*\d{1,3})){1,}/.test(text);
}

function extractLabelValue(lines, labels, key) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const inlineRe = new RegExp(`(?:^|\\s)(?:${labelPattern})\\s*[:：]?\\s*(.+)$`, "i");
  const labelOnlyRe = new RegExp(`^(?:${labelPattern})\\s*[:：]?\\s*$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inline = inlineRe.exec(line);
    if (inline) {
      const rawValue = key === "materialComposition" || key === "washCare"
        ? collectRichLabelValue(lines, index, inline[1], key)
        : enrichSimpleLabelValue(lines, index, inline[1], key);
      const value = cleanLabelValue(rawValue, key);
      if (value && !looksLikeAnotherLabel(value)) {
        return { value, evidenceText: `${line} ${rawValue}`.trim() };
      }
    }
    if (labelOnlyRe.test(line)) {
      const rawValue = key === "materialComposition" || key === "washCare"
        ? collectRichLabelValue(lines, index, "", key)
        : lines.slice(index + 1).find((item) => item && !looksLikeAnotherLabel(item));
      const value = cleanLabelValue(rawValue, key);
      if (value) return { value, evidenceText: `${line} ${rawValue}`.trim() };
    }
  }
  return null;
}

function extractFallbackField(text, key) {
  if (key === "executionStandard") {
    const value = cleanExecutionStandardValue(text);
    if (value) return { value, evidenceText: value, confidence: "medium" };
  }
  if (key === "safetyCategory") {
    const match = normalizeOcrText(text).match(SAFETY_RE);
    if (match) return { value: normalizeStandardText(match[0]), evidenceText: match[0], confidence: "medium" };
  }
  if (key === "productGrade") {
    const match = normalizeOcrText(text).match(/优等品|一等品|合格品|二等品/);
    if (match) return { value: match[0], evidenceText: match[0], confidence: "medium" };
  }
  if (key === "downFillWeight") {
    const match = normalizeOcrText(text).match(/充绒量(?:（单位[:：]?克）|\(单位[:：]?克\))?\s*[:：]?\s*([^\n]{1,80}(?:\n[^\n]{1,80}){0,8})/i);
    const value = cleanLabelValue(match?.[1] ?? "", key);
    if (value) return { value, evidenceText: match?.[0] ?? value, confidence: "medium" };
  }
  return null;
}

function fileExtension(fileName) {
  return path.extname(ocrFileBaseName(fileName)).toLowerCase();
}

function decodedFileNameText(fileName) {
  const name = stringValue(fileName);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function ocrFileBaseName(fileName) {
  return path.basename(decodedFileNameText(fileName).replace(/\\/g, "/"));
}

export function classifyProductArchiveOcrFile(fileName) {
  const name = ocrFileBaseName(fileName);
  const ext = fileExtension(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  if (/(洗唛|洗标|水洗|wash)/i.test(name)) return "washlabel";
  if (/(吊牌|合格证|鞋盒|hangtag|tag|shoe[-_ ]?box)/i.test(name)) return "hangtag";
  if (/^yq(?:[-_ ]?\d+|\s*\(\d+\))?$/i.test(stem)) return "washlabel";
  if (ext === ".pdf") return "hangtag";
  return "unknown";
}

export function productArchiveOcrFileType(fileName) {
  const ext = fileExtension(fileName);
  if (ext === ".pdf") return "pdf";
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "image";
  return "unknown";
}

export function extractStyleCodesFromText(text) {
  return uniqueTextValues([...stringValue(text).matchAll(STYLE_CODE_RE)].map((match) => match[0]));
}

export function extractHangtagWashlabelFieldsFromOcrText(text, options = {}) {
  const normalizedText = normalizeOcrText(text);
  const lines = linesFromText(normalizedText);
  const pageNumber = Number(options.pageNumber ?? 1);
  const sourceKind = stringValue(options.sourceKind) || "unknown";
  const fields = [];

  for (const [key, labels] of Object.entries(FIELD_LABELS)) {
    const labeled = extractLabelValue(lines, labels, key);
    const fallback = labeled ? null : extractFallbackField(normalizedText, key);
    const extracted = labeled ?? fallback;
    if (!extracted?.value) continue;
    fields.push({
      key,
      label: labels[0],
      value: extracted.value,
      confidence: extracted.confidence ?? "high",
      evidenceText: extracted.evidenceText,
      pageNumber,
      sourceKind,
    });
  }

  return {
    text: normalizedText,
    styleCodes: extractStyleCodesFromText(normalizedText),
    fields,
  };
}

function fieldConfidenceRank(value) {
  return { high: 3, medium: 2, low: 1 }[stringValue(value)] ?? 0;
}

function betterField(left, right) {
  const rankDelta = fieldConfidenceRank(left.confidence) - fieldConfidenceRank(right.confidence);
  if (rankDelta !== 0) return rankDelta > 0 ? left : right;
  const sourceRank = { hangtag: 3, washlabel: 2, unknown: 1 };
  const sourceDelta = (sourceRank[left.sourceKind] ?? 0) - (sourceRank[right.sourceKind] ?? 0);
  if (sourceDelta !== 0) return sourceDelta > 0 ? left : right;
  return stringValue(left.value).length >= stringValue(right.value).length ? left : right;
}

export function analyzeProductArchiveOcrDocument(input = {}) {
  const fileName = stringValue(input.fileName) || "未命名文件";
  const sourceKind = stringValue(input.sourceKind) || classifyProductArchiveOcrFile(fileName);
  const fileType = stringValue(input.fileType) || productArchiveOcrFileType(fileName);
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const filenameStyleCodes = extractStyleCodesFromText(fileName);
  const pageResults = pages.map((page, index) => extractHangtagWashlabelFieldsFromOcrText(
    page.text ?? page,
    { pageNumber: page.pageNumber ?? index + 1, sourceKind },
  ));
  const pageStyleCodes = uniqueTextValues(pageResults.flatMap((result) => result.styleCodes));
  const styleCodes = uniqueTextValues([...filenameStyleCodes, ...pageStyleCodes]);
  const fieldsByKey = new Map();
  for (const field of pageResults.flatMap((result) => result.fields)) {
    const existing = fieldsByKey.get(field.key);
    fieldsByKey.set(field.key, existing ? betterField(existing, field) : field);
  }

  const warnings = [];
  if (filenameStyleCodes.length > 0 && pageStyleCodes.length > 0 && !pageStyleCodes.includes(filenameStyleCodes[0])) {
    warnings.push(`文件名款号 ${filenameStyleCodes[0]} 与 OCR 款号 ${pageStyleCodes[0]} 不一致`);
  }
  if (styleCodes.length > 1) warnings.push(`识别到多个款号：${styleCodes.join(", ")}`);
  if (fieldsByKey.size === 0) warnings.push("未识别到可写入的吊牌/洗唛字段");

  return {
    fileName,
    fileType,
    sourceKind,
    detectedSpuCode: styleCodes[0] ?? null,
    styleCodes,
    pageCount: pageResults.length,
    fields: Array.from(fieldsByKey.values()),
    warnings,
    rawText: pageResults.map((result) => result.text).filter(Boolean).join("\n\n").slice(0, 10_000),
    pages: pageResults.map((result, index) => ({
      pageNumber: index + 1,
      text: result.text,
    })),
  };
}

function pdfPageLimit(options = {}) {
  return Math.max(1, Math.min(Number(options.maxPdfPages ?? process.env.LISTINGIFY_HANGTAG_OCR_MAX_PDF_PAGES ?? 3) || 3, 12));
}

function pdfDpi(options = {}) {
  return Math.max(120, Math.min(Number(options.pdfDpi ?? process.env.LISTINGIFY_HANGTAG_OCR_PDF_DPI ?? 320) || 320, 360));
}

async function renderPdfToImagesWithPdfjs(filePath, options = {}) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-hangtag-pdf-"));
  try {
    const canvas = requireFromWeb("@napi-rs/canvas");
    globalThis.DOMMatrix ??= canvas.DOMMatrix;
    globalThis.DOMPoint ??= canvas.DOMPoint;
    globalThis.DOMRect ??= canvas.DOMRect;
    globalThis.ImageData ??= canvas.ImageData;
    const pdfjsPath = requireFromWeb.resolve("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfjs = await import(pathToFileURL(pdfjsPath).href);
    const data = new Uint8Array(await readFile(filePath));
    const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    const maxPages = Math.min(document.numPages, pdfPageLimit(options));
    const scale = pdfDpi(options) / 72;
    const files = [];
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const pageCanvas = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = pageCanvas.getContext("2d");
      await page.render({ canvasContext, viewport }).promise;
      const outputPath = path.join(workDir, `page-${String(pageNumber).padStart(3, "0")}.png`);
      await writeFile(outputPath, pageCanvas.toBuffer("image/png"));
      files.push(outputPath);
      page.cleanup?.();
    }
    await document.destroy?.();
    if (files.length === 0) throw new Error("PDF 未渲染出可识别图片");
    return { workDir, files };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

async function renderPdfToImages(filePath, options = {}) {
  const renderer = stringValue(options.pdfRenderer ?? process.env.LISTINGIFY_HANGTAG_OCR_PDF_RENDERER) || "pdfjs";
  if (renderer === "pdfjs" || renderer === "pdfjs-dist" || renderer === "bundled") {
    return renderPdfToImagesWithPdfjs(filePath, options);
  }
  throw new Error(`不支持的吊牌 PDF 渲染器: ${renderer}`);
}

async function renderWashlabelImageForOcr(filePath) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-washlabel-ocr-"));
  const outputPath = path.join(workDir, "washlabel-chinese-panel.png");
  try {
    const sharp = requireFromWeb("sharp");
    const metadata = await sharp(filePath).metadata();
    const width = Number(metadata.width);
    const height = Number(metadata.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 400 || height < 400) {
      await rm(workDir, { recursive: true, force: true });
      return { workDir: null, files: [filePath] };
    }
    const crop = {
      left: Math.max(0, Math.round(width * 0.18)),
      top: Math.max(0, Math.round(height * 0.26)),
      width: Math.max(1, Math.min(width, Math.round(width * 0.40))),
      height: Math.max(1, Math.min(height, Math.round(height * 0.70))),
    };
    if (crop.left + crop.width > width) crop.width = width - crop.left;
    if (crop.top + crop.height > height) crop.height = height - crop.top;
    await sharp(filePath)
      .extract(crop)
      .resize({ width: 1800, withoutEnlargement: false })
      .grayscale()
      .sharpen()
      .toFile(outputPath);
    return { workDir, files: [outputPath] };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

async function prepareImagePathsForOcr(filePath, fileType, sourceKind, options = {}) {
  if (fileType === "pdf") return renderPdfToImages(filePath, options);
  if (sourceKind === "washlabel" && options.preprocessWashlabel !== false) {
    return renderWashlabelImageForOcr(filePath);
  }
  return { workDir: null, files: [filePath] };
}

function normalizeTesseractJsLang(value) {
  const lang = stringValue(value ?? process.env.LISTINGIFY_HANGTAG_OCR_LANG) || "chi_sim+eng";
  return uniqueTextValues(lang.split(/[+,]/).map((item) => item.trim())).join("+") || "chi_sim+eng";
}

function tesseractJsCachePath() {
  return process.env.LISTINGIFY_TESSERACT_CACHE_PATH || path.join(os.tmpdir(), "listingify-tesseract-cache");
}

async function createTesseractJsProvider(options = {}) {
  const tesseract = requireFromWeb("tesseract.js");
  const lang = normalizeTesseractJsLang(options.lang);
  const psm = stringValue(options.psm ?? process.env.LISTINGIFY_HANGTAG_OCR_PSM) || "6";
  const workerOptions = {
    langPath: stringValue(options.langPath ?? process.env.LISTINGIFY_TESSERACT_LANG_PATH) || BUNDLED_TESSERACT_LANG_PATH,
    cachePath: tesseractJsCachePath(),
    cacheMethod: "readOnly",
  };
  if (typeof options.logger === "function") workerOptions.logger = options.logger;
  const worker = await tesseract.createWorker(lang, 1, workerOptions);
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
  });
  return {
    kind: "tesseract_js",
    async recognize(imagePath) {
      const result = await worker.recognize(imagePath);
      return result?.data?.text ?? "";
    },
    async dispose() {
      await worker.terminate();
    },
  };
}

function normalizeProviderResult(result, fallbackKind) {
  if (typeof result === "string") return { text: result, providerKind: fallbackKind };
  if (result && typeof result === "object") {
    return {
      text: stringValue(result.text),
      providerKind: stringValue(result.providerKind) || fallbackKind,
    };
  }
  return { text: "", providerKind: fallbackKind };
}

function resolveOcrProvider(options = {}) {
  if (options.provider) return { kind: "injected", provider: options.provider, dispose: null };
  const requested = stringValue(options.ocrProvider ?? process.env.LISTINGIFY_HANGTAG_OCR_PROVIDER) || "tesseract_js";
  if (requested === "tesseract_js" || requested === "bundled" || requested === "auto") {
    return {
      kind: "tesseract_js",
      provider: async (imagePath, providerOptions) => {
        const runtime = providerOptions.__tesseractJsRuntime ?? await createTesseractJsProvider(providerOptions);
        providerOptions.__tesseractJsRuntime = runtime;
        return { text: await runtime.recognize(imagePath), providerKind: "tesseract_js" };
      },
      dispose: async (providerOptions) => {
        await providerOptions.__tesseractJsRuntime?.dispose?.();
        providerOptions.__tesseractJsRuntime = null;
      },
    };
  }
  throw new Error(`不支持的吊牌/洗唛 OCR provider: ${requested}`);
}

export function getProductArchiveOcrRuntimeInfo(documents = [], options = {}) {
  const requestedKind = stringValue(options.ocrProvider ?? process.env.LISTINGIFY_HANGTAG_OCR_PROVIDER) || "tesseract_js";
  const providerKinds = uniqueTextValues(
    (Array.isArray(documents) ? documents : []).flatMap((document) => Array.isArray(document.providerKinds) ? document.providerKinds : []),
  );
  return {
    kind: requestedKind,
    usedKinds: providerKinds,
    lang: process.env.LISTINGIFY_HANGTAG_OCR_LANG || "chi_sim+eng",
    langPath: process.env.LISTINGIFY_TESSERACT_LANG_PATH || BUNDLED_TESSERACT_LANG_PATH,
    pdfRenderer: process.env.LISTINGIFY_HANGTAG_OCR_PDF_RENDERER || "pdfjs-dist",
  };
}

function enabledFlag(value, fallback = true) {
  const text = stringValue(value).toLowerCase();
  if (!text) return fallback;
  if (["0", "false", "no", "off", "disabled"].includes(text)) return false;
  if (["1", "true", "yes", "on", "enabled"].includes(text)) return true;
  return fallback;
}

function hasConfiguredVisionAiProvider(env = process.env) {
  return Boolean(
    env.AI_API_KEY
    || env.AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY
    || env.AI_PROVIDER_1XM_API_KEY,
  );
}

function visionFallbackEnabled(options = {}) {
  if (options.visionFallback === false) return false;
  if (options.visionProvider || options.aiRouter || options.aiRouterFactory) return true;
  const env = options.env ?? process.env;
  if (!enabledFlag(env.LISTINGIFY_HANGTAG_OCR_VISION_FALLBACK, true)) return false;
  return hasConfiguredVisionAiProvider(env);
}

function ocrQualityGateEnabled(options = {}) {
  if (options.ocrQualityGate === false) return false;
  if (options.ocrQualityProvider || options.aiRouter || options.aiRouterFactory) return true;
  const env = options.env ?? process.env;
  if (!enabledFlag(env.LISTINGIFY_HANGTAG_OCR_AI_QUALITY_GATE, true)) return false;
  return hasConfiguredVisionAiProvider(env);
}

function ocrTextLooksUnusable(text) {
  const compact = stringValue(text).replace(/\s+/g, "");
  if (!compact) return true;
  if (compact.length < 12) return true;
  const usefulMatches = compact.match(/[0-9A-Za-z\u4e00-\u9fa5]/g) ?? [];
  const usefulRatio = usefulMatches.length / Math.max(compact.length, 1);
  if (compact.length >= 80 && usefulRatio < 0.45) return true;
  return false;
}

function visionFallbackReason(document = {}) {
  if (stringValue(document.status) === "ocr_failed") return "OCR 识别失败";
  if (!Array.isArray(document.fields) || document.fields.length === 0) return "OCR 未提取到结构化字段";
  const rawText = normalizeOcrText(document.rawText);
  const safetyCategory = document.fields.find((field) => stringValue(field?.key) === "safetyCategory");
  if (/GB\s*31701/i.test(rawText) && !/[ABCＡＢＣ]\s*类/i.test(stringValue(safetyCategory?.value))) {
    return "吊牌/洗唛包含 GB 31701 安全标准，但 OCR 未提取 A/B/C 类";
  }
  if (stringValue(document.sourceKind) === "washlabel") {
    const fieldKeys = new Set(document.fields.map((field) => stringValue(field?.key)));
    if (/充绒量/.test(rawText) && !fieldKeys.has("downFillWeight")) {
      return "洗唛包含充绒量证据，但 OCR 未提取尺码克重表";
    }
    if (/(?:绒子含量|填充物)/.test(rawText) && !fieldKeys.has("materialComposition")) {
      return "洗唛包含填充物成分证据，但 OCR 未提取面料成分";
    }
  }
  if (ocrTextLooksUnusable(document.rawText)) return "OCR 文本质量较差";
  return "";
}

function positiveInteger(value, fallback, { min = 1, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function ocrFileConcurrency(options = {}) {
  return positiveInteger(
    options.fileConcurrency ?? process.env.LISTINGIFY_HANGTAG_OCR_FILE_CONCURRENCY,
    2,
    { min: 1, max: 4 },
  );
}

function ocrCacheTtlMs(options = {}) {
  return positiveInteger(
    options.ocrCacheTtlMs ?? process.env.LISTINGIFY_HANGTAG_OCR_CACHE_TTL_MS,
    10 * 60 * 1000,
    { min: 1000, max: 60 * 60 * 1000 },
  );
}

function cloneOcrDocument(document) {
  if (typeof structuredClone === "function") return structuredClone(document);
  return JSON.parse(JSON.stringify(document));
}

function pruneOcrFileResultCache(now = Date.now()) {
  const ttlMs = ocrCacheTtlMs();
  for (const [key, entry] of ocrFileResultCache.entries()) {
    if (now - entry.savedAt > ttlMs) ocrFileResultCache.delete(key);
  }
  while (ocrFileResultCache.size > OCR_FILE_CACHE_MAX_ENTRIES) {
    const oldest = ocrFileResultCache.keys().next().value;
    if (!oldest) break;
    ocrFileResultCache.delete(oldest);
  }
}

export function clearProductArchiveOcrRuntimeCache() {
  ocrFileResultCache.clear();
}

function shouldUseOcrFileCache(options = {}) {
  if (options.ocrCache === false) return false;
  return (!options.provider || options.ocrCacheWithInjectedProvider === true)
    && !options.visionProvider
    && !options.ocrQualityProvider;
}

async function ocrFileResultCacheKey(file, options = {}) {
  if (!shouldUseOcrFileCache(options)) return null;
  const rawFilePath = stringValue(file.filePath);
  if (!rawFilePath) return null;
  const filePath = path.resolve(rawFilePath);
  const fileName = stringValue(file.fileName) || path.basename(filePath);
  const fileType = stringValue(file.fileType) || productArchiveOcrFileType(fileName);
  const sourceKind = stringValue(file.sourceKind) || classifyProductArchiveOcrFile(fileName);
  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile?.()) return null;
  return [
    filePath,
    stats.size,
    Math.floor(stats.mtimeMs),
    fileType,
    sourceKind,
    stringValue(options.ocrProvider ?? process.env.LISTINGIFY_HANGTAG_OCR_PROVIDER) || "tesseract_js",
    normalizeTesseractJsLang(options.lang),
    stringValue(options.psm ?? process.env.LISTINGIFY_HANGTAG_OCR_PSM) || "6",
    enabledFlag((options.env ?? process.env).LISTINGIFY_HANGTAG_OCR_AI_QUALITY_GATE, true) ? "quality:on" : "quality:off",
    enabledFlag((options.env ?? process.env).LISTINGIFY_HANGTAG_OCR_VISION_FALLBACK, true) ? "vision:on" : "vision:off",
    visionImageWidth(options),
    visionImageMaxBytes(options),
    visionMaxImages(options),
    ocrQualityTextLimit(options),
  ].join("\u0000");
}

function visionImageMaxBytes(options = {}) {
  return positiveInteger(
    options.visionImageMaxBytes ?? process.env.LISTINGIFY_HANGTAG_OCR_VISION_IMAGE_MAX_BYTES,
    4 * 1024 * 1024,
    { min: 128 * 1024, max: 10 * 1024 * 1024 },
  );
}

function visionImageWidth(options = {}) {
  return positiveInteger(
    options.visionImageWidth ?? process.env.LISTINGIFY_HANGTAG_OCR_VISION_IMAGE_WIDTH,
    2200,
    { min: 900, max: 3200 },
  );
}

function visionMaxImages(options = {}) {
  return positiveInteger(
    options.visionMaxImages ?? process.env.LISTINGIFY_HANGTAG_OCR_VISION_MAX_IMAGES,
    4,
    { min: 1, max: 8 },
  );
}

function ocrQualityTextLimit(options = {}) {
  return positiveInteger(
    options.ocrQualityTextLimit ?? process.env.LISTINGIFY_HANGTAG_OCR_QUALITY_TEXT_LIMIT,
    5000,
    { min: 1000, max: 12000 },
  );
}

function uniqueFilePaths(paths) {
  const seen = new Set();
  const output = [];
  for (const item of paths.map(stringValue).filter(Boolean)) {
    const key = path.resolve(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function visionImagePathCandidates({ filePath, fileType, pageImagePaths = [] }, options = {}) {
  const paths = fileType === "image"
    ? [filePath, ...pageImagePaths]
    : pageImagePaths;
  return uniqueFilePaths(paths).slice(0, visionMaxImages(options));
}

async function renderVisionImageBuffer(filePath, options = {}) {
  const sharp = requireFromWeb("sharp");
  const maxBytes = visionImageMaxBytes(options);
  const metadata = await sharp(filePath).metadata();
  const sourceWidth = Number(metadata.width) || visionImageWidth(options);
  const widths = uniqueTextValues([
    Math.min(sourceWidth, visionImageWidth(options)),
    2200,
    1800,
    1500,
    1200,
    960,
    720,
    540,
    420,
  ].map((value) => String(Math.round(value)))).map((value) => Number(value));
  const qualities = [86, 78, 70, 62, 54, 46];
  let smallest = null;
  for (const width of widths) {
    for (const quality of qualities) {
      const buffer = await sharp(filePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (!smallest || buffer.length < smallest.length) smallest = buffer;
      if (buffer.length <= maxBytes) return buffer;
    }
  }
  return smallest && smallest.length <= maxBytes ? smallest : null;
}

async function visionImagePayloads(imagePaths, options = {}) {
  const output = [];
  const warnings = [];
  for (const imagePath of imagePaths) {
    let buffer = null;
    try {
      buffer = await renderVisionImageBuffer(imagePath, options);
    } catch (error) {
      warnings.push(`多模态兜底图片准备失败：${path.basename(imagePath)}：${errorText(error)}`);
      continue;
    }
    if (!buffer) {
      warnings.push(`多模态兜底图片超过大小限制：${path.basename(imagePath)}`);
      continue;
    }
    output.push({
      filePath: imagePath,
      mimeType: "image/jpeg",
      byteLength: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    });
  }
  return { payloads: output, warnings };
}

async function pdfVisionImagePayloads(filePath, options = {}) {
  let prepared = null;
  try {
    prepared = await renderPdfToImages(filePath, options);
    return await visionImagePayloads(prepared.files, options);
  } finally {
    if (prepared?.workDir) await rm(prepared.workDir, { recursive: true, force: true });
  }
}

function buildOcrQualityPrompt({ fileName, sourceKind, rawText, fields }) {
  return JSON.stringify({
    task: "质检商品吊牌、洗唛或平铺图标签文字的普通 OCR 结构化抽取结果，判断字段是否可信，是否需要改走多模态看原图兜底。",
    file_name: fileName,
    source_kind: sourceKind,
    raw_text: rawText,
    extracted_fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
      confidence: field.confidence,
      evidence_text: field.evidenceText,
    })),
    output_schema: {
      verdict: "accept 或 reject",
      fallback_required: "boolean；只要整体乱码、字段值像噪声、字段与证据不一致、或关键字段不完整就为 true",
      reason: "简短中文原因",
      field_reviews: [
        {
          key: "字段 key",
          verdict: "accept 或 reject",
          reason: "为什么可信或不可信",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "你只能基于 raw_text、extracted_fields 和 evidence_text 判断，不要凭款号、类目、常识或商品图片内容补全字段。",
      "如果 OCR 原文大段乱码、夹杂无意义拉丁/俄文/符号，且字段证据不可读，判 reject。",
      "充绒量必须是可读的尺码与克数对应表，不能接受 NZ: 0 = :、零散数字、英文/俄文噪声或只有标题没有数值。",
      "执行标准必须是清晰标准号，例如 Q/BALABALA 103-2021、Q/BALABALA 104-2022、GB/T、FZ/T、QB/T 开头的标准；重复标签或后缀乱码判 reject。",
      "安全类别必须能看到 GB 31701 与 A/B/C 类；仅有安全字样但无类别判 reject。",
      "成分必须能看到纤维名称和百分比；如果只是乱码或百分比无法归属纤维，相关字段判 reject。",
      "如果任一已抽取字段判 reject，fallback_required 设为 true。",
    ],
    allowed_field_keys: Object.keys(FIELD_LABELS),
  }, null, 2);
}

function buildOcrQualityMessages(document, options = {}) {
  const rawText = stringValue(document.rawText).slice(0, ocrQualityTextLimit(options));
  const fields = Array.isArray(document.fields) ? document.fields : [];
  return [
    {
      role: "system",
      content: "你是商品吊牌、洗唛和平铺图标签文字的 OCR 质量审核智能体，只判断普通 OCR 结果是否可信。",
    },
    {
      role: "user",
      content: buildOcrQualityPrompt({
        fileName: document.fileName,
        sourceKind: document.sourceKind,
        rawText,
        fields,
      }),
    },
  ];
}

function qualityVerdictRejected(value) {
  const text = stringValue(value).toLowerCase();
  return ["reject", "rejected", "invalid", "noise", "wrong", "unreliable", "fail", "failed"].includes(text);
}

function normalizeOcrQualityReview(json) {
  const record = recordValue(json);
  const fieldReviews = arrayValue(record.field_reviews ?? record.fieldReviews).map((row) => {
    const item = recordValue(row);
    const key = fieldKeyFromVision(item.key ?? item.field_key ?? item.name, item.label ?? item.field_label);
    return {
      key,
      verdict: stringValue(item.verdict ?? item.status),
      reason: stringValue(item.reason ?? item.message).slice(0, 500),
    };
  }).filter((row) => row.key);
  const rejectedKeys = uniqueTextValues(
    fieldReviews.filter((row) => qualityVerdictRejected(row.verdict)).map((row) => row.key),
  );
  const fallbackRequired = Boolean(record.fallback_required ?? record.fallbackRequired)
    || qualityVerdictRejected(record.verdict)
    || rejectedKeys.length > 0;
  return {
    verdict: fallbackRequired ? "reject" : "accept",
    fallbackRequired,
    reason: stringValue(record.reason ?? record.message).slice(0, 500),
    rejectedKeys,
    fieldReviews,
  };
}

function normalizeOcrQualityProviderResult(result) {
  if (typeof result === "string") return { json: recordValue(result), providerKind: "ai_quality" };
  if (result && typeof result === "object") {
    return {
      json: recordValue(result.json ?? result),
      providerKind: stringValue(result.providerKind) || "ai_quality",
    };
  }
  return { json: {}, providerKind: "ai_quality" };
}

async function callOcrQualityProvider(document, options = {}) {
  const messages = buildOcrQualityMessages(document, options);
  if (typeof options.ocrQualityProvider === "function") {
    const result = await options.ocrQualityProvider({ document, messages });
    return normalizeOcrQualityProviderResult(result);
  }

  const router = defaultVisionRouter(options);
  const response = await router.callJson(withAiRoutingHashes({
    scenario: "product_archive_ocr_quality",
    promptVersion: "product-archive-ocr-quality-v1",
    messages,
    validate: (json) => {
      const record = recordValue(json);
      const verdict = stringValue(record.verdict);
      return ["accept", "reject", "rejected", "invalid", "noise", "wrong", "unreliable", "fail", "failed"].includes(verdict.toLowerCase())
        || typeof record.fallback_required === "boolean"
        || typeof record.fallbackRequired === "boolean";
    },
    auditValue: (json) => {
      const review = normalizeOcrQualityReview(json);
      return {
        verdict: review.verdict,
        fallbackRequired: review.fallbackRequired,
        rejectedKeys: review.rejectedKeys,
      };
    },
  }, {
    input: {
      fileName: document.fileName,
      sourceKind: document.sourceKind,
      rawTextSha256: createHash("sha256").update(stringValue(document.rawText)).digest("hex"),
      fieldCount: Array.isArray(document.fields) ? document.fields.length : 0,
    },
    candidates: Object.keys(FIELD_LABELS),
  }));
  return {
    json: response.json,
    providerKind: "ai_quality",
    provider: response.provider,
    routing: response.routing,
  };
}

async function applyOcrQualityGate(document, options = {}) {
  if (!ocrQualityGateEnabled(options)) return { document, fallbackReason: "" };
  if (!Array.isArray(document.fields) || document.fields.length === 0) return { document, fallbackReason: "" };
  try {
    const quality = await callOcrQualityProvider(document, options);
    const review = normalizeOcrQualityReview(quality.json);
    const providerKinds = uniqueTextValues([
      ...arrayValue(document.providerKinds),
      quality.providerKind,
    ]);
    if (!review.fallbackRequired) {
      return {
        document: {
          ...document,
          providerKinds,
          ocrQualityReview: review,
          ocrQualityProvider: quality.provider ?? null,
          ocrQualityRouting: quality.routing ?? null,
        },
        fallbackReason: "",
      };
    }
    const rejectedKeys = new Set(review.rejectedKeys);
    const fields = rejectedKeys.size > 0
      ? document.fields.filter((field) => !rejectedKeys.has(field.key))
      : [];
    const reason = review.reason || "OCR 质检判定字段不可信";
    return {
      document: {
        ...document,
        fields,
        providerKinds,
        warnings: uniqueTextValues([
          ...arrayValue(document.warnings),
          `AI OCR质检判定不可信：${reason}`,
        ]),
        ocrQualityReview: review,
        ocrQualityProvider: quality.provider ?? null,
        ocrQualityRouting: quality.routing ?? null,
      },
      fallbackReason: `AI OCR质检判定识别不可靠：${reason}`,
    };
  } catch (error) {
    return {
      document: {
        ...document,
        warnings: uniqueTextValues([...arrayValue(document.warnings), `AI OCR质检失败：${errorText(error)}`]),
      },
      fallbackReason: "",
    };
  }
}

function fieldKeyFromVision(value, label = "") {
  const compact = stringValue(value).replace(/[_\-\s()（）]/g, "").toLowerCase();
  const direct = {
    productname: "productName",
    name: "productName",
    articleno: "articleNo",
    artno: "articleNo",
    spucode: "articleNo",
    stylecode: "articleNo",
    executionstandard: "executionStandard",
    standard: "executionStandard",
    safetycategory: "safetyCategory",
    safety: "safetyCategory",
    productgrade: "productGrade",
    grade: "productGrade",
    materialcomposition: "materialComposition",
    composition: "materialComposition",
    downfillweight: "downFillWeight",
    fillweight: "downFillWeight",
    washcare: "washCare",
    washing: "washCare",
  };
  if (direct[compact]) return direct[compact];
  const compactLabel = compactLine(label || value);
  for (const [key, labels] of Object.entries(FIELD_LABELS)) {
    if (labels.some((item) => compactLabel.includes(compactLine(item)))) return key;
  }
  return "";
}

function confidenceFromVision(value) {
  const text = stringValue(value).toLowerCase();
  if (["high", "medium", "low"].includes(text)) return text;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "medium";
  if (numeric >= 0.85) return "high";
  if (numeric >= 0.55) return "medium";
  return "low";
}

function visionFieldRows(json) {
  const rows = [];
  const fields = json.fields ?? json.extracted_fields ?? json.extractedFields;
  if (Array.isArray(fields)) {
    rows.push(...fields.filter((field) => field && typeof field === "object"));
  } else {
    const fieldMap = recordValue(fields);
    for (const [key, value] of Object.entries(fieldMap)) rows.push({ key, value });
  }
  for (const key of Object.keys(FIELD_LABELS)) {
    if (json[key] != null) rows.push({ key, value: json[key] });
  }
  for (const [key, alias] of Object.entries({
    product_name: "productName",
    article_no: "articleNo",
    style_code: "articleNo",
    execution_standard: "executionStandard",
    safety_category: "safetyCategory",
    product_grade: "productGrade",
    material_composition: "materialComposition",
    down_fill_weight: "downFillWeight",
    wash_care: "washCare",
  })) {
    if (json[key] != null) rows.push({ key: alias, value: json[key] });
  }
  return rows;
}

function normalizeVisionField(row, pageNumber, sourceKind) {
  const key = fieldKeyFromVision(row.key ?? row.field_key ?? row.name, row.label ?? row.field_label);
  if (!key || !FIELD_LABELS[key]) return null;
  const rawValue = stringValue(row.value ?? row.field_value ?? row.text);
  const value = cleanLabelValue(rawValue, key);
  if (!value) return null;
  return {
    key,
    label: stringValue(row.label ?? row.field_label) || FIELD_LABELS[key][0],
    value,
    confidence: confidenceFromVision(row.confidence),
    evidenceText: stringValue(row.evidence_text ?? row.evidenceText ?? rawValue).slice(0, 500),
    pageNumber,
    sourceKind,
  };
}

function visionRawText(json, fields = []) {
  const raw = stringValue(json.raw_text ?? json.rawText ?? json.text ?? json.full_text ?? json.fullText);
  if (raw) return normalizeOcrText(raw);
  const lines = [];
  const styleCode = stringValue(json.style_code ?? json.styleCode ?? json.spu_code ?? json.spuCode);
  if (styleCode) lines.push(styleCode);
  for (const field of fields) lines.push(`${field.label}: ${field.value}`);
  return normalizeOcrText(lines.join("\n"));
}

function hasOwnRecordKey(record, keys = []) {
  return keys.some((key) => Object.hasOwn(record, key));
}

function isValidVisionOcrJson(json) {
  const record = recordValue(json);
  const fields = record.fields ?? record.extracted_fields ?? record.extractedFields;
  const hasExtractedValue = Boolean(
    stringValue(record.raw_text ?? record.rawText ?? record.text)
    || stringValue(record.style_code ?? record.styleCode ?? record.spu_code ?? record.spuCode)
    || visionFieldRows(record).some((row) => stringValue(row.value ?? row.field_value ?? row.text)),
  );
  if (hasExtractedValue) return true;

  return Boolean(
    hasOwnRecordKey(record, ["raw_text", "rawText", "text", "style_code", "styleCode", "spu_code", "spuCode"])
    || Array.isArray(fields)
    || (fields && typeof fields === "object" && !Array.isArray(fields))
  );
}

function analyzeVisionOcrDocument({
  fileName,
  fileType,
  sourceKind,
  json,
}) {
  const parsed = recordValue(json);
  const fields = visionFieldRows(parsed)
    .map((row) => normalizeVisionField(row, 1, sourceKind))
    .filter(Boolean);
  const rawText = visionRawText(parsed, fields);
  const analyzed = analyzeProductArchiveOcrDocument({
    fileName,
    fileType,
    sourceKind,
    pages: rawText ? [{ pageNumber: 1, text: rawText }] : [],
  });
  const fieldsByKey = new Map();
  for (const field of [...analyzed.fields, ...fields]) {
    const existing = fieldsByKey.get(field.key);
    fieldsByKey.set(field.key, existing ? betterField(existing, field) : field);
  }
  const explicitStyleCodes = extractStyleCodesFromText([
    parsed.style_code,
    parsed.styleCode,
    parsed.spu_code,
    parsed.spuCode,
  ].map(stringValue).join("\n"));
  const styleCodes = uniqueTextValues([
    ...analyzed.styleCodes,
    ...explicitStyleCodes,
  ]);
  const warnings = analyzed.warnings.filter((warning) => !/未识别到可写入/.test(warning));
  const finalFields = Array.from(fieldsByKey.values());
  if (finalFields.length === 0) warnings.push("多模态兜底未提取到可写入的吊牌/洗唛/平铺图字段");
  return {
    ...analyzed,
    detectedSpuCode: styleCodes[0] ?? analyzed.detectedSpuCode,
    styleCodes,
    fields: finalFields,
    warnings,
    rawText: rawText.slice(0, 10_000),
    pages: rawText ? [{ pageNumber: 1, text: rawText }] : [],
  };
}

function buildVisionOcrPrompt({ fileName, sourceKind, fallbackReason }) {
  return JSON.stringify({
    task: "从商品吊牌、洗唛或带标签文字的平铺图中做多模态文字识别，并提取可写入深绘建档草稿的结构化字段。",
    file_name: fileName,
    source_kind: sourceKind,
    fallback_reason: fallbackReason,
    output_schema: {
      style_code: "图片中可见的 12 位 20 开头款号；没有则为 null",
      raw_text: "按原图从上到下转写出的主要中文文字；看不清则为空字符串",
      fields: [
        {
          key: "只能是 productName/articleNo/executionStandard/safetyCategory/productGrade/materialComposition/downFillWeight/washCare",
          label: "中文字段名",
          value: "字段值；表格字段保留尺码行和克数行",
          confidence: "high/medium/low",
          evidence_text: "图片中支持该字段的短证据",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "图片已经以 base64 data URL 随消息发送；不要返回图片路径。",
      "只能提取图片中清晰可见的文字，不要根据款号、类目或常识补全。",
      "看不清、被遮挡、没有出现的字段直接省略，不要猜测。",
      "充绒量表格要保留尺码和克数的对应关系，例如第一行尺码、第二行克数；不要只写一个总克数。",
      "成分和洗涤说明保留换行，便于后续字段映射。",
    ],
    allowed_field_keys: Object.keys(FIELD_LABELS),
  }, null, 2);
}

function buildVisionOcrMessages({ fileName, sourceKind, fallbackReason, imagePayloads }) {
  const content = [
    { type: "text", text: buildVisionOcrPrompt({ fileName, sourceKind, fallbackReason }) },
  ];
  imagePayloads.forEach((image, index) => {
    content.push({
      type: "text",
      text: `图片${index + 1}: ${path.basename(image.filePath)}，已压缩为 base64，字节数 ${image.byteLength}。`,
    });
    content.push({
      type: "image_url",
      image_url: { url: image.dataUrl },
    });
  });
  return [
    {
      role: "system",
      content: "你是商品吊牌、洗唛和平铺图标签文字的 OCR 兜底识别器，只做忠实转写和字段抽取。",
    },
    {
      role: "user",
      content,
    },
  ];
}

function normalizeVisionProviderResult(result) {
  if (typeof result === "string") return { json: recordValue(result), providerKind: "ai_vision" };
  if (result && typeof result === "object") {
    return {
      json: recordValue(result.json ?? result),
      providerKind: stringValue(result.providerKind) || "ai_vision",
    };
  }
  return { json: {}, providerKind: "ai_vision" };
}

function defaultVisionRouter(options = {}) {
  if (typeof options.aiRouterFactory === "function") return options.aiRouterFactory();
  if (options.aiRouter) return options.aiRouter;
  return createAiScenarioRouter({
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
  });
}

async function callVisionOcrProvider({
  fileName,
  fileType,
  sourceKind,
  fallbackReason,
  imagePayloads,
}, options = {}) {
  const messages = buildVisionOcrMessages({
    fileName,
    sourceKind,
    fallbackReason,
    imagePayloads,
  });
  if (typeof options.visionProvider === "function") {
    const result = await options.visionProvider({
      fileName,
      fileType,
      sourceKind,
      fallbackReason,
      imagePayloads,
      messages,
    });
    return normalizeVisionProviderResult(result);
  }

  const router = defaultVisionRouter(options);
  const response = await router.callJson(withAiRoutingHashes({
    scenario: "product_archive_ocr_vision",
    promptVersion: "product-archive-ocr-vision-v1",
    messages,
    validate: isValidVisionOcrJson,
    auditValue: (json) => {
      const record = recordValue(json);
      return {
        fieldCount: visionFieldRows(record).length,
        hasRawText: Boolean(stringValue(record.raw_text ?? record.rawText ?? record.text)),
        styleCode: stringValue(record.style_code ?? record.styleCode ?? record.spu_code ?? record.spuCode),
      };
    },
  }, {
    input: {
      fileName,
      fileType,
      sourceKind,
      fallbackReason,
      images: imagePayloads.map((image) => ({
        sha256: image.sha256,
        byteLength: image.byteLength,
      })),
    },
    candidates: Object.keys(FIELD_LABELS),
  }));
  return {
    json: response.json,
    providerKind: "ai_vision",
    provider: response.provider,
    routing: response.routing,
  };
}

function mergeDocumentFields(leftFields = [], rightFields = []) {
  const fieldsByKey = new Map();
  for (const field of leftFields) {
    if (!field?.key || !stringValue(field.value)) continue;
    const existing = fieldsByKey.get(field.key);
    fieldsByKey.set(field.key, existing ? betterField(existing, field) : field);
  }
  for (const field of rightFields) {
    if (!field?.key || !stringValue(field.value)) continue;
    fieldsByKey.set(field.key, field);
  }
  return Array.from(fieldsByKey.values());
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function applyVisionFallback(document, {
  filePath,
  fileName,
  fileType,
  sourceKind,
  pageImagePaths,
  options,
  fallbackReason,
}) {
  throwIfAborted(options.signal);
  const warnings = Array.isArray(document.warnings) ? [...document.warnings] : [];
  if (!visionFallbackEnabled(options)) return document;
  const imagePaths = visionImagePathCandidates({ filePath, fileType, pageImagePaths }, options);
  if (imagePaths.length === 0) {
    return {
      ...document,
      warnings: uniqueTextValues([...warnings, "多模态兜底未执行：没有可发送的图片"]),
    };
  }
  try {
    let { payloads, warnings: payloadWarnings } = await visionImagePayloads(imagePaths, options);
    throwIfAborted(options.signal);
    if (payloads.length === 0 && fileType === "pdf") {
      try {
        const rerendered = await pdfVisionImagePayloads(filePath, options);
        if (rerendered.payloads.length > 0) {
          payloads = rerendered.payloads;
          payloadWarnings = ["多模态兜底已重新渲染PDF图片"];
        } else {
          payloadWarnings = uniqueTextValues([...payloadWarnings, ...rerendered.warnings]);
        }
      } catch (error) {
        payloadWarnings = uniqueTextValues([...payloadWarnings, `多模态兜底PDF重新渲染失败：${errorText(error)}`]);
      }
    }
    const shouldShowPayloadWarnings = payloads.length === 0
      || payloadWarnings.some((warning) => /已重新渲染PDF/.test(warning));
    const warningsWithPayloads = uniqueTextValues([
      ...warnings,
      ...(shouldShowPayloadWarnings ? payloadWarnings : []),
    ]);
    if (payloads.length === 0) {
      return {
        ...document,
        warnings: uniqueTextValues([...warningsWithPayloads, "多模态兜底未执行：没有可用的图片payload"]),
      };
    }
    const vision = await callVisionOcrProvider({
      fileName,
      fileType,
      sourceKind,
      fallbackReason,
      imagePayloads: payloads,
    }, options);
    throwIfAborted(options.signal);
    const visionDocument = analyzeVisionOcrDocument({
      fileName,
      fileType,
      sourceKind,
      json: vision.json,
    });
    const fields = mergeDocumentFields(document.fields, visionDocument.fields);
    const styleCodes = uniqueTextValues([
      ...arrayValue(document.styleCodes),
      ...arrayValue(visionDocument.styleCodes),
    ]);
    const detectedSpuCode = stringValue(document.detectedSpuCode) || stringValue(visionDocument.detectedSpuCode) || styleCodes[0] || null;
    const rawText = stringValue(visionDocument.rawText) || stringValue(document.rawText);
    const status = fields.length > 0 || rawText || detectedSpuCode ? "recognized" : stringValue(document.status) || "recognized";
    return {
      ...document,
      status,
      error: status === "recognized" ? null : document.error,
      detectedSpuCode,
      styleCodes,
      fields,
      warnings: uniqueTextValues([
        ...warningsWithPayloads,
        ...visionDocument.warnings,
        `${fallbackReason}，已使用多模态模型兜底识别`,
      ]),
      rawText: rawText.slice(0, 10_000),
      pages: visionDocument.pages?.length ? visionDocument.pages : document.pages,
      providerKinds: uniqueTextValues([
        ...arrayValue(document.providerKinds),
        vision.providerKind,
      ]),
      visionProvider: vision.provider ?? null,
      visionRouting: vision.routing ?? null,
    };
  } catch (error) {
    if (options.signal?.aborted || error?.name === "AbortError") throw error;
    return {
      ...document,
      warnings: uniqueTextValues([...warnings, `多模态兜底失败：${errorText(error)}`]),
    };
  }
}

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return stringValue(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value.richText)) return value.richText.map((item) => stringValue(item.text)).join("").trim();
  if (value.text != null) return stringValue(value.text);
  if (value.result != null) return stringValue(value.result);
  return stringValue(value);
}

function worksheetHeaderMap(worksheet) {
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 10); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const header = new Map();
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const name = cellText(cell).replace(/\s+/g, "");
      if (name) header.set(name, columnNumber);
    });
    if (header.has("款号") && header.has("中文成分")) return { rowNumber, header };
  }
  return null;
}

function worksheetCellByHeader(row, header, names) {
  for (const name of names) {
    const columnNumber = header.get(name);
    if (columnNumber) {
      const value = cellText(row.getCell(columnNumber));
      if (value) return value;
    }
  }
  return "";
}

function sourceRefForScmWorkbook(fileName, sheetName, rowNumber) {
  return `${stringValue(fileName) || "SCM洗唛吊牌下载结果.xlsx"}#${sheetName}!R${rowNumber}`;
}

export async function readScmHangtagWashlabelSupplementWorkbook(filePath, options = {}) {
  const ExcelJS = requireFromWeb("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const fileName = stringValue(options.fileName) || path.basename(filePath);
  const documents = [];
  const seen = new Set();

  for (const worksheet of workbook.worksheets) {
    const headerInfo = worksheetHeaderMap(worksheet);
    if (!headerInfo) continue;
    const { header, rowNumber: headerRowNumber } = headerInfo;
    for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const spuCode = extractStyleCodesFromText(worksheetCellByHeader(row, header, ["款号", "SPU", "商品款号"]))[0];
      const rawComposition = worksheetCellByHeader(row, header, ["中文成分", "成分", "材质成分", "面料成分"]);
      const composition = normalizeScmChineseCompositionText(rawComposition);
      if (!spuCode || !composition) continue;
      const dedupeKey = `${spuCode}\n${composition}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const statusText = worksheetCellByHeader(row, header, ["查询结果", "下载结果"]);
      const fileKind = worksheetCellByHeader(row, header, ["文件类型"]);
      documents.push({
        fileName,
        fileType: "spreadsheet",
        sourceKind: "scm_list",
        detectedSpuCode: spuCode,
        styleCodes: [spuCode],
        pageCount: 1,
        fields: [{
          key: "materialComposition",
          label: "中文成分",
          value: composition,
          confidence: "high",
          evidenceText: rawComposition,
          pageNumber: rowNumber,
          sourceKind: "scm_list",
        }],
        warnings: statusText && !["成功", "已下载"].includes(statusText)
          ? [`SCM ${worksheet.name} 第 ${rowNumber} 行状态：${statusText}`]
          : [],
        status: "recognized",
        error: null,
        rawText: "",
        pages: [{
          pageNumber: rowNumber,
          text: `SCM ${worksheet.name} ${fileKind ? `${fileKind} ` : ""}中文成分: ${rawComposition}`,
        }],
        sourceRef: sourceRefForScmWorkbook(fileName, worksheet.name, rowNumber),
      });
    }
  }

  return {
    fileName,
    sheetCount: workbook.worksheets.length,
    documentCount: documents.length,
    documents,
  };
}

export async function recognizeProductArchiveOcrFile(file, options = {}) {
  throwIfAborted(options.signal);
  const filePath = stringValue(file.filePath);
  const fileName = stringValue(file.fileName) || path.basename(filePath);
  const fileType = stringValue(file.fileType) || productArchiveOcrFileType(fileName);
  const sourceKind = stringValue(file.sourceKind) || classifyProductArchiveOcrFile(fileName);
  const { kind: requestedProviderKind, provider, dispose } = resolveOcrProvider(options);
  let imageWorkDir = null;
  const providerOptions = { ...options };
  try {
    let pageImagePaths = [];
    let providerKinds = [];
    let document;
    try {
      const prepared = await prepareImagePathsForOcr(filePath, fileType, sourceKind, options);
      imageWorkDir = prepared.workDir;
      pageImagePaths = prepared.files;
      const pages = [];
      for (let index = 0; index < pageImagePaths.length; index += 1) {
        throwIfAborted(options.signal);
        const providerResult = normalizeProviderResult(await provider(pageImagePaths[index], providerOptions), requestedProviderKind);
        throwIfAborted(options.signal);
        const text = providerResult.text;
        if (providerResult.providerKind) providerKinds.push(providerResult.providerKind);
        pages.push({ pageNumber: index + 1, text });
      }
      document = {
        ...analyzeProductArchiveOcrDocument({ fileName, fileType, sourceKind, pages }),
        requestedProviderKind,
        providerKinds: uniqueTextValues(providerKinds),
        status: "recognized",
        error: null,
      };
    } catch (error) {
      document = {
        ...analyzeProductArchiveOcrDocument({ fileName, fileType, sourceKind, pages: [] }),
        requestedProviderKind,
        providerKinds: uniqueTextValues(providerKinds),
        status: "ocr_failed",
        error: errorText(error),
      };
    }

    const localFallbackReason = visionFallbackReason(document);
    throwIfAborted(options.signal);
    const quality = localFallbackReason
      ? { document, fallbackReason: localFallbackReason }
      : await applyOcrQualityGate(document, options);
    throwIfAborted(options.signal);
    if (!quality.fallbackReason) return quality.document;
    const visionDocument = await applyVisionFallback(quality.document, {
      filePath,
      fileName,
      fileType,
      sourceKind,
      pageImagePaths,
      options,
      fallbackReason: quality.fallbackReason,
    });
    throwIfAborted(options.signal);
    return visionDocument;
  } finally {
    if (dispose) await dispose(providerOptions);
    if (imageWorkDir) await rm(imageWorkDir, { recursive: true, force: true });
  }
}

async function recognizeProductArchiveOcrFileCached(file, options = {}) {
  const cacheKey = await ocrFileResultCacheKey(file, options);
  if (!cacheKey) return recognizeProductArchiveOcrFile(file, options);

  pruneOcrFileResultCache();
  const existing = ocrFileResultCache.get(cacheKey);
  if (existing && Date.now() - existing.savedAt <= ocrCacheTtlMs(options)) {
    return cloneOcrDocument(await existing.promise);
  }

  const promise = recognizeProductArchiveOcrFile(file, options)
    .catch((error) => {
      ocrFileResultCache.delete(cacheKey);
      throw error;
    });
  ocrFileResultCache.set(cacheKey, { savedAt: Date.now(), promise });
  return cloneOcrDocument(await promise);
}

export async function recognizeProductArchiveOcrFiles(files = [], options = {}) {
  const inputFiles = Array.isArray(files) ? files : [];
  const output = new Array(inputFiles.length);
  let nextIndex = 0;
  const workerCount = Math.min(inputFiles.length, ocrFileConcurrency(options));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < inputFiles.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = inputFiles[index];
      throwIfAborted(options.signal);
      output[index] = await recognizeProductArchiveOcrFileCached(file, options);
    }
  });
  await Promise.all(workers);
  for (const document of output) {
    throwIfAborted(options.signal);
    if (!document) throw new Error("OCR 文件识别未返回结果");
  }
  throwIfAborted(options.signal);
  return output;
}
