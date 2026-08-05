import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "..", "..");
const WEB_PACKAGE_JSON = path.join(PROJECT_ROOT, "web", "package.json");
const requireFromWeb = createRequire(WEB_PACKAGE_JSON);
const BUNDLED_TESSERACT_LANG_PATH = path.join(PROJECT_ROOT, "vendor", "tesseract", "lang");

const STYLE_CODE_RE = /(?<!\d)20\d{10}(?!\d)/g;
const STANDARD_RE = /\b(?:Q\s*\/\s*[A-Z0-9\u4e00-\u9fa5._-]+|GB\s*\/\s*T|FZ\s*\/\s*T|QB\s*\/\s*T)\s*[A-Z0-9./ -]{2,}/i;
const SAFETY_RE = /(?:符合\s*)?GB\s*31701\s*[ABCＡＢＣ]\s*类/i;
const FIELD_LABELS = {
  productName: ["产品名称", "品名", "名称"],
  articleNo: ["产品货号", "货号", "款号", "产品款号"],
  executionStandard: ["执行标准", "执行标准号", "产品执行标准"],
  safetyCategory: ["安全技术类别", "安全类别", "安全技术要求"],
  productGrade: ["产品等级", "质量等级", "等级"],
  materialComposition: ["面料成分", "材质成分", "纤维含量", "成分"],
  washCare: ["洗涤说明", "洗护说明", "洗涤方法", "洗护方法"],
};
const FIELD_LABEL_TEXT = Object.values(FIELD_LABELS).flat();
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
    .replace(/\bGB\s*\/\s*T\b/ig, "GB/T")
    .replace(/\bFZ\s*\/\s*T\b/ig, "FZ/T")
    .replace(/\bQB\s*\/\s*T\b/ig, "QB/T")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\bGB\s*31701\s*([ABCＡＢＣ])\s*类/ig, (_match, category) => `GB 31701 ${String(category).toUpperCase()}类`)
    .replace(/[-–—]+$/g, "")
    .trim();
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
    const standard = text.match(STANDARD_RE)?.[0];
    if (standard) return normalizeStandardText(standard);
    text = normalizeStandardText(text);
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
  if (key === "articleNo") text = text.replace(/[-–—]+$/g, "");
  return text.replace(/[；;，,。]\s*$/g, "").trim();
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
    const match = normalizeOcrText(text).match(STANDARD_RE);
    if (match) return { value: normalizeStandardText(match[0]), evidenceText: match[0], confidence: "medium" };
  }
  if (key === "safetyCategory") {
    const match = normalizeOcrText(text).match(SAFETY_RE);
    if (match) return { value: normalizeStandardText(match[0]), evidenceText: match[0], confidence: "medium" };
  }
  if (key === "productGrade") {
    const match = normalizeOcrText(text).match(/优等品|一等品|合格品|二等品/);
    if (match) return { value: match[0], evidenceText: match[0], confidence: "medium" };
  }
  return null;
}

function fileExtension(fileName) {
  return path.extname(stringValue(fileName)).toLowerCase();
}

function decodedFileNameText(fileName) {
  const name = stringValue(fileName);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function classifyProductArchiveOcrFile(fileName) {
  const name = decodedFileNameText(fileName);
  const ext = fileExtension(name);
  if (/(洗唛|洗标|水洗|wash)/i.test(name)) return "washlabel";
  if (/(吊牌|合格证|hangtag|tag)/i.test(name)) return "hangtag";
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
  const filePath = stringValue(file.filePath);
  const fileName = stringValue(file.fileName) || path.basename(filePath);
  const fileType = stringValue(file.fileType) || productArchiveOcrFileType(fileName);
  const sourceKind = stringValue(file.sourceKind) || classifyProductArchiveOcrFile(fileName);
  const { kind: requestedProviderKind, provider, dispose } = resolveOcrProvider(options);
  let imageWorkDir = null;
  const providerOptions = { ...options };
  try {
    const prepared = await prepareImagePathsForOcr(filePath, fileType, sourceKind, options);
    imageWorkDir = prepared.workDir;
    const pageImagePaths = prepared.files;
    const pages = [];
    const providerKinds = [];
    for (let index = 0; index < pageImagePaths.length; index += 1) {
      const providerResult = normalizeProviderResult(await provider(pageImagePaths[index], providerOptions), requestedProviderKind);
      const text = providerResult.text;
      if (providerResult.providerKind) providerKinds.push(providerResult.providerKind);
      pages.push({ pageNumber: index + 1, text });
    }
    return {
      ...analyzeProductArchiveOcrDocument({ fileName, fileType, sourceKind, pages }),
      requestedProviderKind,
      providerKinds: uniqueTextValues(providerKinds),
      status: "recognized",
      error: null,
    };
  } catch (error) {
    return {
      ...analyzeProductArchiveOcrDocument({ fileName, fileType, sourceKind, pages: [] }),
      requestedProviderKind,
      providerKinds: [],
      status: "ocr_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (dispose) await dispose(providerOptions);
    if (imageWorkDir) await rm(imageWorkDir, { recursive: true, force: true });
  }
}

export async function recognizeProductArchiveOcrFiles(files = [], options = {}) {
  const output = [];
  for (const file of files) {
    output.push(await recognizeProductArchiveOcrFile(file, options));
  }
  return output;
}
