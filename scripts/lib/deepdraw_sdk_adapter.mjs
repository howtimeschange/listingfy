import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_JAVA_HOME = "/Users/xingyicheng/.local/toolchains/jdk8u492-b09/Contents/Home";
const SDK_CREATE_SOURCE = path.resolve(import.meta.dirname, "../java/DeepdrawProductCreateCli.java");
const SDK_CREATE_CLASS_NAME = "DeepdrawProductCreateCli";
const SDK_UPDATE_SOURCE = path.resolve(import.meta.dirname, "../java/DeepdrawProductUpdateCli.java");
const SDK_UPDATE_CLASS_NAME = "DeepdrawProductUpdateCli";
const SDK_RESOURCE_SOURCE = path.resolve(import.meta.dirname, "../java/DeepdrawProductResourceCli.java");
const SDK_RESOURCE_CLASS_NAME = "DeepdrawProductResourceCli";
const SKU_TITLE = "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码";
const JAVA_UTF8_ARGS = [
  "-Dfile.encoding=UTF-8",
  "-Dsun.stdout.encoding=UTF-8",
  "-Dsun.stderr.encoding=UTF-8",
];

const MAVEN_JAR_CANDIDATES = [
  ["com/alibaba/fastjson/1.2.76/fastjson-1.2.76.jar", "com/alibaba/fastjson/1.2.5/fastjson-1.2.5.jar"],
  ["commons-logging/commons-logging/1.2/commons-logging-1.2.jar", "commons-logging/commons-logging/1.1.1/commons-logging-1.1.1.jar"],
  ["org/apache/httpcomponents/httpclient/4.5.13/httpclient-4.5.13.jar", "org/apache/httpcomponents/httpclient/4.5.2/httpclient-4.5.2.jar"],
  ["org/apache/httpcomponents/httpcore/4.4.14/httpcore-4.4.14.jar", "org/apache/httpcomponents/httpcore/4.4.5/httpcore-4.4.5.jar"],
  ["commons-codec/commons-codec/1.15/commons-codec-1.15.jar", "commons-codec/commons-codec/1.10/commons-codec-1.10.jar"],
  ["org/apache/commons/commons-lang3/3.11/commons-lang3-3.11.jar", "org/apache/commons/commons-lang3/3.5/commons-lang3-3.5.jar"],
  ["commons-collections/commons-collections/3.2.2/commons-collections-3.2.2.jar", "commons-collections/commons-collections/3.2.1/commons-collections-3.2.1.jar"],
  ["commons-io/commons-io/2.4/commons-io-2.4.jar"],
  ["org/apache/commons/commons-collections4/4.1/commons-collections4-4.1.jar"],
  ["com/google/guava/guava/20.0/guava-20.0.jar"],
  ["org/slf4j/slf4j-api/1.7.25/slf4j-api-1.7.25.jar"],
  ["com/squareup/okhttp3/okhttp/3.8.1/okhttp-3.8.1.jar"],
  ["com/squareup/okio/okio/1.13.0/okio-1.13.0.jar"],
];

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function compactKey(value) {
  return stringValue(value).replace(/\s+/g, "").toLowerCase();
}

function hasValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueValues(values) {
  const seen = new Set();
  const output = [];
  for (const value of values.map(stringValue).filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function asMoneyText(value, fallback = "") {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = stringValue(value);
  return text || fallback;
}

function normalizeSdkFieldName(name) {
  return compactKey(name) === "商家sku" ? "商家SKU" : stringValue(name);
}

function fieldType(field) {
  if (!field || typeof field !== "object") return "";
  return stringValue(field.fieldType ?? field.field_type ?? field.type).toUpperCase();
}

function isStructuredSizePayloadField(name, type) {
  const key = compactKey(name);
  const structuredType = !type || type === "MULTI_TEXT";
  return structuredType && (key === "多平台尺码" || key.includes("尺码表"));
}

function isUnsupportedScalarSdkField(name, value, type = "") {
  return isStructuredSizePayloadField(name, type) && (!value || typeof value !== "object" || Array.isArray(value));
}

function fieldValue(field) {
  if (!field || typeof field !== "object") return field;
  return field.value ?? field.valueText ?? field.value_text ?? field.valueJson ?? field.value_json;
}

function fieldName(field) {
  if (!field || typeof field !== "object") return "";
  return stringValue(field.name ?? field.fieldName ?? field.field_name);
}

function findPayloadFieldValue(fields, names) {
  const wanted = new Set(names.map(compactKey));
  for (const field of fields) {
    if (wanted.has(compactKey(fieldName(field)))) {
      const value = fieldValue(field);
      if (hasValue(value)) return value;
    }
  }
  return "";
}

function baseColorName(value) {
  const text = stringValue(value);
  if (/卡其|贝壳卡|卡色/.test(text)) return "卡其";
  if (text.includes("粉")) return "粉红";
  const colors = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "紫色", "灰色", "棕色", "橙色"];
  for (const color of colors) {
    if (text.includes(color.slice(0, 1))) return color;
  }
  return text;
}

function sdkColorValue(value) {
  const text = stringValue(value);
  if (!text) return "";
  if (text.includes(",") || text.includes("，")) return text.replace(/，/g, ",");
  const base = baseColorName(text);
  return base && base !== text ? `${base},${text}` : text;
}

function sdkSizeValue(value) {
  const text = stringValue(value);
  if (!text) return "";
  const match = text.match(/^0*(\d{2,3})(?:\s*(?:cm|厘米|公分|码))?$/i);
  return match ? `${Number(match[1])}cm` : text;
}

function bareShoeSizeValue(value) {
  return stringValue(value).replace(/\s*(?:cm|厘米|公分|码)$/i, "");
}

function shoeSaleSizeValue(value, options = {}) {
  const size = bareShoeSizeValue(value);
  if (!size) return "";
  if (options.shoeSaleSizeUnitMode === "bare") return size;
  return /^0*\d+(?:\.\d+)?$/.test(size) ? `${Number(size)}码` : size;
}

function sizeMatchKeys(value) {
  const text = stringValue(value)
    .split("*")[0]
    .replace(/[（(]\s*充绒量[^）)]*[）)]/g, "")
    .trim();
  if (!text) return [];
  const normalized = sdkSizeValue(text);
  const numberText = normalized.match(/^(\d+)cm$/i)?.[1] ?? "";
  const shoeCodeText = text.match(/^0*(\d+(?:\.5)?)\s*码$/)?.[1] ?? "";
  return uniqueValues([
    text,
    normalized,
    numberText,
    numberText ? numberText.padStart(3, "0") : "",
    shoeCodeText,
    shoeCodeText ? shoeCodeText.padStart(3, "0") : "",
  ].map((item) => item.replace(/\s+/g, "").toLowerCase()));
}

function saleSizeValues(value) {
  return saleSizeEntries(value).map((entry) => entry.size);
}

function saleSizeEntries(value) {
  return stringValue(value).split(/[;；]/)
    .map((part) => {
      const [size, ...remarkParts] = part.split("*");
      return {
        size: stringValue(size),
        remark: normalizeSizeRemarkText(remarkParts.join("*")),
      };
    })
    .filter((entry) => entry.size);
}

function saleSizeInlineRemarks(value) {
  return Object.fromEntries(saleSizeEntries(value)
    .filter((entry) => entry.remark)
    .map((entry) => [entry.size, entry.remark]));
}

function normalizeSizeRemarkText(value) {
  const text = stringValue(value);
  if (!text) return "";
  const bracketed = text.match(/^[（(]\s*(.*?)\s*[）)]$/);
  return stringValue(bracketed ? bracketed[1] : text)
    .replace(/[;；]+/g, "/")
    .replace(/\*/g, "");
}

function saleSizeLookup(sizeValues = []) {
  const lookup = new Map();
  for (const size of sizeValues) {
    for (const key of sizeMatchKeys(size)) {
      if (!lookup.has(key)) lookup.set(key, size);
    }
  }
  return lookup;
}

function sdkPayloadSizeValue(value, sizeValues = []) {
  const lookup = saleSizeLookup(sizeValues);
  for (const key of sizeMatchKeys(value)) {
    const matched = lookup.get(key);
    if (matched) return matched;
  }
  return sdkSizeValue(value);
}

function sizeRemarkForPayload(size, sizeRemarks = {}) {
  const sizeKeys = new Set(sizeMatchKeys(size));
  for (const [remarkSize, remarkValue] of Object.entries(recordValue(sizeRemarks))) {
    if (sizeMatchKeys(remarkSize).some((key) => sizeKeys.has(key))) {
      return normalizeSizeRemarkText(remarkValue);
    }
  }
  return "";
}

function saleSizePayloadValue(sizeValues = [], sizeRemarks = {}) {
  return uniqueValues(sizeValues).map((size) => {
    const remark = sizeRemarkForPayload(size, sizeRemarks);
    return remark ? `${size}*${remark}` : size;
  }).join(";");
}

function shouldInlineSizeRemarks(payload = {}) {
  return payload.inlineSizeRemarksForProbe === true || payload.withSizeRemarks === true;
}

function normalizeSdkDateText(value) {
  const text = stringValue(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const dateMatch = text.match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?/);
  if (dateMatch) {
    return [
      dateMatch[1],
      dateMatch[2].padStart(2, "0"),
      (dateMatch[3] ?? "01").padStart(2, "0"),
    ].join("-");
  }
  const seasonMatch = text.match(/^(\d{4})年?([春夏秋冬])季?$/);
  if (seasonMatch) {
    const monthBySeason = { 春: "03", 夏: "06", 秋: "09", 冬: "12" };
    return `${seasonMatch[1]}-${monthBySeason[seasonMatch[2]]}-01`;
  }
  return text;
}

function skuLaunchMonthText(value) {
  const text = stringValue(value);
  const match = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  return match ? `${match[1]}-${match[2]}` : text;
}

function normalizeMerchantSkuRowValue(value, title) {
  const text = stringValue(value);
  const titles = stringValue(title).split(",").map((part) => part.trim());
  const launchDateIndex = titles.findIndex((item) => compactKey(item) === "上市时间");
  if (!text || launchDateIndex < 0) return value;
  const parts = text.split(",");
  if (launchDateIndex >= parts.length) return value;
  parts[launchDateIndex] = skuLaunchMonthText(parts[launchDateIndex]);
  return parts.join(",");
}

function normalizeMerchantSkuField(value, sizeValues = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const output = {};
  const title = stringValue(value.title);
  for (const [color, sizeRows] of Object.entries(value)) {
    if (color === "title") {
      output[color] = sizeRows;
      continue;
    }
    if (!sizeRows || typeof sizeRows !== "object" || Array.isArray(sizeRows)) {
      output[color] = sizeRows;
      continue;
    }
    output[color] = {};
    for (const [size, rowValue] of Object.entries(sizeRows)) {
      output[color][sdkPayloadSizeValue(size, sizeValues)] = normalizeMerchantSkuRowValue(rowValue, title);
    }
  }
  return output;
}

function normalizeDouyinMaterialFieldValue(value) {
  const text = stringValue(value);
  if (!text) return value;

  // This field is exposed as TEXT by the resource API, but the DeepDraw
  // editor decodes its content as a JSON array of material-percentage rows.
  // A bare "聚酯纤维,100" is retained by the API yet renders as empty in the UI.
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return JSON.stringify(parsed.map((item) => item.trim()).filter(Boolean));
    }
  } catch {
    // Local construction uses semicolon-delimited rows; encode them below.
  }
  return JSON.stringify(semicolonValues(text));
}

const DEEPDRAW_MULTI_PLATFORM_SIZE_NAMES = new Map([
  ["京东", "京东"],
  ["jd", "京东"],
  ["拼多多", "拼多多"],
  ["pdd", "拼多多"],
  ["微信视频小店", "微信视频小店"],
  ["微信视频", "微信视频小店"],
  ["微信视频号", "微信视频小店"],
  ["weixinxiaodian", "微信视频小店"],
  ["小红书", "小红书"],
  ["xiaohongshu", "小红书"],
  ["快手", "快手"],
  ["kuaishou", "快手"],
  ["天猫", "天猫"],
  ["tmall", "天猫"],
  ["淘宝", "淘宝"],
  ["taobao", "淘宝"],
  ["得物", "得物"],
  ["dewu", "得物"],
  ["喵街", "喵街"],
  ["miaojie", "喵街"],
]);
const DEEPDRAW_SHOE_MULTI_PLATFORM_SIZE_NAME_ORDER = ["天猫", "京东", "拼多多", "微信视频小店", "小红书", "快手"];
const DEEPDRAW_SHOE_MULTI_PLATFORM_SIZE_VALUE_NAMES = new Set(["京东", "拼多多", "微信视频小店", "小红书"]);

const DEEPDRAW_SITE_CODES = new Map([
  ["1688", "ALIBABA"],
  ["天猫", "TMALL"],
  ["京东", "JD"],
  ["唯品会", "VIP"],
  ["有赞", "YOUZAN"],
  ["拼多多", "PDD"],
  ["小红书", "XIAOHONGSHU"],
  ["抖音", "DOUYIN"],
  ["快手", "KUAISHOU"],
  ["微信视频小店", "WEIXINXIAODIAN"],
]);

function normalizeDeepdrawSites(value) {
  const values = Array.isArray(value)
    ? value
    : stringValue(value).split(/[;,，；、]/);
  return uniqueValues(values
    .map((site) => stringValue(site))
    .filter(Boolean)
    .map((site) => DEEPDRAW_SITE_CODES.get(site) ?? site.toUpperCase()));
}

function normalizeAfterSalesServiceCommitment(value) {
  const text = stringValue(value).replace(/\s+/g, "");
  if (!text) return text;
  if (/^(?:0|[12]_\d+)$/.test(text)) return text;
  if (text === "不设置") return "0";

  const kind = text.startsWith("寄修") ? "1" : text.startsWith("延保") ? "2" : "";
  if (!kind) return text;
  const duration = text.slice(2).replace(/^[;；,_-]+/, "");
  const dayMatch = duration.match(/^(\d+)天$/);
  if (dayMatch) return `${kind}_${dayMatch[1]}`;
  const yearMatch = duration.match(/^(\d+)年$/);
  if (yearMatch) return `${kind}_${Number(yearMatch[1]) * 365}`;
  const chineseYears = new Map([
    ["一年", 1], ["二年", 2], ["两年", 2], ["三年", 3], ["四年", 4],
    ["五年", 5], ["六年", 6], ["七年", 7], ["八年", 8], ["九年", 9], ["十年", 10],
  ]);
  const years = chineseYears.get(duration);
  return years ? `${kind}_${years * 365}` : text;
}

function normalizeDeepdrawLocation(value) {
  const text = stringValue(value);
  if (!text) return text;
  const parts = text.split(/[;,，；]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) return parts.join(",");
  if (text === "浙江杭州") return "浙江,杭州";
  return text;
}

function isUnsupportedLegacyShoeUpdateSizeField(name, options = {}) {
  const key = compactKey(name);
  return key === compactKey("淘宝尺码表")
    || (key === compactKey("多平台尺码") && !options.includeMultiPlatformSizeField);
}

function isUnsupportedLegacyShoeSdkField(name) {
  return compactKey(name) === compactKey("淘宝尺码表");
}

const DEEPDRAW_STABLE_POST_CREATE_SIZE_TABLE_KEYS = new Set([
  compactKey("尺码表"),
  compactKey("唯品会尺码表"),
  compactKey("天猫尺码表"),
  compactKey("抖音尺码表"),
]);

function isStablePostCreateSizeTable(name) {
  return DEEPDRAW_STABLE_POST_CREATE_SIZE_TABLE_KEYS.has(compactKey(name));
}

export function selectDeepdrawStableSizeCreateFields(fields = []) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    if (!isStructuredSizePayloadField(name, type)) return true;
    return compactKey(name) === compactKey("尺码表")
      || compactKey(name) === compactKey("多平台尺码");
  });
}

export function selectDeepdrawStableSizeUpdateFields(fields = [], options = {}) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    return !isStructuredSizePayloadField(name, type)
      || isStablePostCreateSizeTable(name)
      || (options.includeMultiPlatformSizeField === true && compactKey(name) === compactKey("多平台尺码"));
  });
}

export function selectDeepdrawLegacyShoeCreateFields(fields = []) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    if (!isStructuredSizePayloadField(name, type)) return true;
    const key = compactKey(name);
    return key === compactKey("尺码表")
      || key === compactKey("多平台尺码");
  });
}

export function selectDeepdrawLegacyShoeUpdateFields(fields = [], options = {}) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    return !isStructuredSizePayloadField(name, type) || !isUnsupportedLegacyShoeUpdateSizeField(name, options);
  });
}

export function deepdrawLegacyShoePostCreateUpdateRequired(createFields = [], updateFields = []) {
  const createNames = new Set(arrayValue(createFields)
    .map((field) => compactKey(normalizeSdkFieldName(fieldName(field))))
    .filter(Boolean));
  return arrayValue(updateFields).some((field) => {
    const name = compactKey(normalizeSdkFieldName(fieldName(field)));
    return Boolean(name) && !createNames.has(name);
  });
}

function bareMultiPlatformSizeValue(value) {
  const text = stringValue(value).replace(/\s+/g, "");
  const stripped = text.replace(/(?:cm|厘米|公分|码)$/i, "");
  return /^0*\d+(?:\.\d+)?$/.test(stripped)
    ? String(Number(stripped))
    : stripped;
}

function apparelMultiPlatformJdColumnIndex(title) {
  return stringValue(title).split(/[,，]/)
    .findIndex((column) => deepdrawMultiPlatformSizeName(column) === "京东");
}

function apparelMultiPlatformCellValue(cell, normalizedSize) {
  const text = stringValue(cell);
  if (!text) return "";
  const compact = text.replace(/\s+/g, "");
  if (/^0*\d+(?:\.\d+)?(?:cm|厘米|公分|码)?$/i.test(compact)) return normalizedSize || text;
  return text;
}

function normalizeMultiPlatformSizeField(value, sizeValues = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const sourceColumns = stringValue(value.title).split(/[,，]/)
    .map((part, index) => ({ name: deepdrawMultiPlatformSizeName(part), index }))
    .filter((column) => column.name);
  const columns = sourceColumns.length > 0 ? sourceColumns : [{ name: "京东", index: 0 }];
  const output = { title: columns.map((column) => column.name).join(",") };
  const jdColumnIndex = sourceColumns.find((column) => column.name === "京东")?.index ?? apparelMultiPlatformJdColumnIndex(value.title);
  for (const [size, rowValue] of Object.entries(value)) {
    if (size === "title") continue;
    const normalizedSize = sdkPayloadSizeValue(size, sizeValues);
    const cells = stringValue(rowValue).split(/[,，]/);
    const jdCandidate = jdColumnIndex >= 0 ? cells[jdColumnIndex] : "";
    const jdSize = bareMultiPlatformSizeValue(jdCandidate || size);
    const normalizedRow = columns.map((column) => (
      column.name === "京东"
        ? jdSize
        : apparelMultiPlatformCellValue(cells[column.index], normalizedSize)
    )).join(",");
    if (normalizedSize && normalizedRow.split(",").some((cell) => hasValue(cell))) output[normalizedSize] = normalizedRow;
  }
  return output;
}

function deepdrawMultiPlatformSizeName(value) {
  const text = stringValue(value);
  if (!text) return "";
  return DEEPDRAW_MULTI_PLATFORM_SIZE_NAMES.get(compactKey(text)) || "";
}

function shoeMultiPlatformColumns(title) {
  const sourceColumns = stringValue(title).split(/[,，]/)
    .map((part, index) => ({ name: deepdrawMultiPlatformSizeName(part), index }))
    .filter((column) => column.name);
  return DEEPDRAW_SHOE_MULTI_PLATFORM_SIZE_NAME_ORDER
    .map((name) => sourceColumns.find((column) => column.name === name))
    .filter(Boolean);
}

function shoeMultiPlatformRowSizeValue(value, sizeValues = [], options = {}) {
  const matched = sdkPayloadSizeValue(value, sizeValues);
  const bare = bareMultiPlatformSizeValue(matched || value);
  if (!bare) return stringValue(value);
  return options.shoeMultiPlatformRowKey === "bare" ? bare : `${bare}码`;
}

function shoeMultiPlatformSizeText(value) {
  const bare = bareMultiPlatformSizeValue(value);
  return bare ? `${bare}码` : stringValue(value);
}

function shoeMultiPlatformCellValue({ column, cell, size, options = {} }) {
  if (!DEEPDRAW_SHOE_MULTI_PLATFORM_SIZE_VALUE_NAMES.has(column.name)) return "";
  if (column.name === "京东") return bareMultiPlatformSizeValue(cell || size);
  const text = stringValue(cell);
  const displaySize = shoeMultiPlatformSizeText(size);
  const remark = sizeRemarkForPayload(displaySize, options.sizeRemarks);
  if (text && (!remark || /(?:脚长|内长)/.test(text))) return text;
  return remark ? `${displaySize}(${remark})` : "";
}

function normalizeShoeMultiPlatformSizeField(value, sizeValues = [], options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const columns = shoeMultiPlatformColumns(value.title);
  if (columns.length === 0) return value;
  const output = { title: columns.map((column) => column.name).join(",") };
  for (const [size, rowValue] of Object.entries(value)) {
    if (size === "title") continue;
    const normalizedSize = shoeMultiPlatformRowSizeValue(size, sizeValues, options);
    const cells = stringValue(rowValue).split(",");
    const normalizedRow = columns.map((column) => shoeMultiPlatformCellValue({
      column,
      cell: cells[column.index],
      size: normalizedSize,
      options,
    })).join(",");
    if (normalizedSize && normalizedRow) output[normalizedSize] = normalizedRow;
  }
  return output;
}

function normalizeSizeTableField(value, sizeValues = [], name = "", options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if (Object.keys(value).length === 0) return {};
  const key = compactKey(name);
  if (key === compactKey("多平台尺码")) {
    return options.shoeSizes
      ? normalizeShoeMultiPlatformSizeField(value, sizeValues, options)
      : normalizeMultiPlatformSizeField(value, sizeValues);
  }
  const output = {};
  const sourceTitle = value.title;
  const title = normalizeSizeTableTitleForPayload(sourceTitle, name, options);
  for (const [size, rowValue] of Object.entries(value)) {
    if (size === "title") {
      output[size] = title;
      continue;
    }
    const normalizedSize = options.preserveStructuredSizeRowKeysForProbe === true
      ? stringValue(size)
      : sdkPayloadSizeValue(size, sizeValues);
    const normalizedRowValue = normalizeSizeTableRowForPayload(rowValue, sourceTitle, name, options);
    if (normalizedSize) output[normalizedSize] = normalizedRowValue;
  }
  return output;
}

function normalizeShoeMainSizeTableColumn(column) {
  const key = compactKey(column);
  if (key === compactKey("尺码") || key === compactKey("尺寸")) return "";
  if (key === compactKey("适合脚长")) return "脚长";
  if (key === compactKey("内长") || key === compactKey("鞋长")) return "鞋内长";
  return stringValue(column);
}

function normalizeSizeTableTitleForPayload(title, name = "", options = {}) {
  if (!options.shoeSizes || compactKey(name) !== compactKey("尺码表")) return title;
  return stringValue(title).split(",")
    .map(normalizeShoeMainSizeTableColumn)
    .filter(Boolean)
    .join(",");
}

function normalizeSizeTableRowForPayload(rowValue, title, name = "", options = {}) {
  const fieldKey = compactKey(name);
  if (options.shoeSizes && fieldKey === compactKey("尺码表")) {
    const columns = stringValue(title).split(",").map((column) => column.trim());
    const cells = stringValue(rowValue).split(",");
    return columns
      .map((column, index) => ({ column: normalizeShoeMainSizeTableColumn(column), value: cells[index] ?? "" }))
      .filter((entry) => entry.column)
      .map((entry) => stringValue(entry.value))
      .join(",");
  }
  if (!options.shoeSizes || fieldKey !== compactKey("唯品会尺码表")) return rowValue;
  const columns = stringValue(title).split(",").map((column) => column.trim());
  const europeanCodeIndex = columns.findIndex((column) => compactKey(column) === compactKey("欧洲码"));
  if (europeanCodeIndex < 0) return rowValue;
  const cells = stringValue(rowValue).split(",");
  const value = stringValue(cells[europeanCodeIndex]);
  const match = value.match(/^(\d+(?:\.\d+)?)\s*码$/);
  if (match) cells[europeanCodeIndex] = match[1];
  return cells.join(",");
}

function fieldKey(fields, names) {
  const wanted = new Set(names.map(compactKey));
  return Object.keys(fields).find((key) => wanted.has(compactKey(key)));
}

function buildMerchantSkuField(payload, skus, dateText, sizeValues = []) {
  const productCode = stringValue(payload.code);
  const retailPrice = asMoneyText(payload.retailPrice);
  const skuDateText = skuLaunchMonthText(dateText);
  const output = { title: SKU_TITLE };
  for (const sku of skus) {
    const color = stringValue(sku.color ?? sku.colorName ?? sku.color_name);
    const size = sdkPayloadSizeValue(sku.size ?? sku.sizeName ?? sku.size_name, sizeValues);
    if (!color || !size) continue;
    const price = asMoneyText(sku.price, retailPrice);
    const sellerCode = stringValue(sku.sellerCode ?? sku.seller_code ?? sku.skuCode ?? sku.sku_code);
    const barcode = stringValue(sku.barcode ?? sku.eanCode ?? sku.ean_code);
    const skuCode = stringValue(sku.skuCode ?? sku.sku_code) || sellerCode;
    output[color] ??= {};
    output[color][size] = [
      price,
      productCode,
      skuDateText,
      "0",
      sellerCode || skuCode,
      barcode,
      retailPrice || price,
      price,
      skuCode,
      barcode,
    ].join(",");
  }
  return output;
}

function semicolonValues(value) {
  return stringValue(value).split(/[;；]/).map((part) => part.trim()).filter(Boolean);
}

function colorAliases(value) {
  return semicolonValues(value).flatMap((item) => item
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => colorAliasVariants(part)));
}

function colorAliasVariants(value) {
  const alias = stringValue(value);
  if (!alias) return [];

  // Down garments deliberately add the filling to a color display value (for
  // example, "浅灰20047-白鸭绒").  SKU source colors retain the original
  // color code, so use the undecorated code only for duplicate detection.
  // Keep the decorated value itself in the request sent to DeepDraw.
  const undecorated = alias.replace(/[\-－—]\s*(?:白|灰)?(?:鸭|鹅)绒\s*$/u, "").trim();
  return uniqueValues([alias, undecorated]);
}

function hostValue(baseUrl) {
  return stringValue(baseUrl) || "http://open.deepdraw.cn";
}

function unwrapDeepdrawResourceBody(value) {
  const source = recordValue(value);
  const responseBody = recordValue(recordValue(source.response).body);
  if (hasValue(responseBody)) return responseBody;
  const body = recordValue(source.body);
  if (hasValue(body) && (
    source.code != null
    || source.response != null
    || source.requestId != null
    || Array.isArray(body.fields)
    || hasValue(body.sizes)
    || hasValue(body.skus)
  )) return body;
  return source;
}

function deepdrawResourceFieldName(entry) {
  const field = recordValue(entry.field);
  return normalizeSdkFieldName(field.name ?? entry.name ?? entry.fieldName ?? entry.field_name);
}

function deepdrawResourceFieldId(entry) {
  const field = recordValue(entry.field);
  return stringValue(field.id ?? entry.id ?? entry.fieldId ?? entry.field_id);
}

function deepdrawResourceFieldType(entry) {
  const field = recordValue(entry.field);
  return stringValue(field.type ?? entry.type ?? entry.fieldType ?? entry.field_type).toUpperCase();
}

function deepdrawResourceFieldSelectedValue(entry) {
  const options = arrayValue(entry.options).map(stringValue).filter(Boolean);
  if (options.length > 0) return options.join(";");
  const texts = arrayValue(entry.texts).map(stringValue).filter(Boolean);
  if (texts.length === 1) return texts[0];
  if (texts.length > 1) return texts.join(";");
  return stringValue(entry.value ?? entry.valueText ?? entry.value_text);
}

function isDeepdrawResourcePreservedScalarFieldName(name, type = "") {
  const key = compactKey(name);
  if (!key) return false;
  if (isStructuredSizePayloadField(name, type)) return false;
  if (["尺码", "尺寸", "规格", "size", "商家sku"].includes(key)) return false;
  if (/sku|skc|颜色|色系|色号|商家编码|商品编码|条形码|货号|价格|价$|库存|数量/.test(key)) return false;
  return true;
}

export function extractDeepdrawResourceScalarFields(resourceBody) {
  const source = unwrapDeepdrawResourceBody(resourceBody);
  const output = [];
  const seen = new Set();
  for (const entry of arrayValue(source.fields).map(recordValue)) {
    const name = deepdrawResourceFieldName(entry);
    const type = deepdrawResourceFieldType(entry);
    const value = deepdrawResourceFieldSelectedValue(entry);
    if (!name || !hasValue(value)) continue;
    if (!isDeepdrawResourcePreservedScalarFieldName(name, type)) continue;
    const id = deepdrawResourceFieldId(entry);
    const identity = id ? `id:${id}` : `name:${compactKey(name)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    output.push({
      id,
      name,
      fieldType: type || undefined,
      value,
    });
  }
  return output;
}

function payloadFieldIdentity(field) {
  const id = stringValue(field.id ?? field.fieldId ?? field.field_id);
  if (id) return `id:${id}`;
  const name = fieldName(field);
  return name ? `name:${compactKey(name)}` : "";
}

function mergeDeepdrawScalarFieldsIntoFieldArray(fields, resourceFields, options = {}) {
  const appendMissingFields = options.appendMissingFields !== false;
  const byId = new Map();
  const byName = new Map();
  for (const field of resourceFields) {
    if (field.id) byId.set(field.id, field);
    byName.set(compactKey(field.name), field);
  }
  const used = new Set();
  const present = new Set();
  const merged = arrayValue(fields).map((field) => {
    const row = recordValue(field);
    const id = stringValue(row.id ?? row.fieldId ?? row.field_id);
    const name = fieldName(row);
    const identity = payloadFieldIdentity(row);
    if (identity) present.add(identity);
    if (hasValue(fieldValue(row))) return row;
    const resourceField = (id ? byId.get(id) : null) ?? (name ? byName.get(compactKey(name)) : null);
    if (!resourceField) return row;
    used.add(resourceField.id ? `id:${resourceField.id}` : `name:${compactKey(resourceField.name)}`);
    return {
      ...row,
      id: stringValue(row.id) || resourceField.id || undefined,
      name: name || resourceField.name,
      fieldType: stringValue(row.fieldType ?? row.field_type) || resourceField.fieldType || undefined,
      value: resourceField.value,
    };
  });
  if (appendMissingFields) {
    for (const resourceField of resourceFields) {
      const identities = [
        resourceField.id ? `id:${resourceField.id}` : "",
        `name:${compactKey(resourceField.name)}`,
      ].filter(Boolean);
      if (identities.some((identity) => used.has(identity) || present.has(identity))) continue;
      merged.push({
        ...(resourceField.id ? { id: resourceField.id } : {}),
        name: resourceField.name,
        ...(resourceField.fieldType ? { fieldType: resourceField.fieldType } : {}),
        value: resourceField.value,
      });
      used.add(resourceField.id ? `id:${resourceField.id}` : `name:${compactKey(resourceField.name)}`);
    }
  }
  return { fields: merged, mergedKeys: used };
}

export function mergeDeepdrawExistingScalarFieldsIntoPayload(payload = {}, resourceBody, options = {}) {
  const resourceFields = extractDeepdrawResourceScalarFields(resourceBody);
  const mergedFields = mergeDeepdrawScalarFieldsIntoFieldArray(payload.fields, resourceFields, options);
  const output = {
    ...payload,
    fields: mergedFields.fields,
  };
  const mergedKeys = new Set(mergedFields.mergedKeys);
  if (Array.isArray(payload.legacyUpdateFields)) {
    const mergedLegacyUpdateFields = mergeDeepdrawScalarFieldsIntoFieldArray(payload.legacyUpdateFields, resourceFields, options);
    output.legacyUpdateFields = mergedLegacyUpdateFields.fields;
    for (const key of mergedLegacyUpdateFields.mergedKeys) mergedKeys.add(key);
  }
  return {
    payload: output,
    preservedFields: resourceFields.filter((field) => (
      mergedKeys.has(field.id ? `id:${field.id}` : `name:${compactKey(field.name)}`)
    )),
    preservedFieldCount: mergedKeys.size,
  };
}

export function buildDeepdrawProductFullUpdateInput({ config, productId, payload = {} } = {}) {
  const candidateFields = Array.isArray(payload.legacyUpdateFields)
    ? payload.legacyUpdateFields
    : payload.fields;
  const input = buildDeepdrawSdkProductInput({
    config,
    payload: {
      ...payload,
      fields: payload.shoeSizes
        ? selectDeepdrawLegacyShoeUpdateFields(candidateFields, {
            includeMultiPlatformSizeField: payload.includeMultiPlatformSizeField === true,
          })
        : candidateFields,
    },
  });
  return {
    config: input.config,
    productId: stringValue(productId),
    product: input.product,
  };
}

function payloadSizeIdentityValue(value, { shoeSizes = false } = {}) {
  return shoeSizes ? bareShoeSizeValue(value) : sdkSizeValue(value);
}

function payloadSizeValues(payload, { shoeSizes = false } = {}) {
  const fields = arrayValue(payload.fields).map(recordValue);
  const declared = saleSizeValues(findPayloadFieldValue(fields, ["尺码", "尺寸", "规格", "size"]));
  const source = declared.length > 0
    ? declared
    : arrayValue(payload.skus).map((sku) => {
        const row = recordValue(sku);
        return row.size ?? row.sizeName ?? row.size_name;
      });
  return uniqueValues(source.map((value) => payloadSizeIdentityValue(value, { shoeSizes })).filter(Boolean));
}

function sortedLegacyIdentityValues(values) {
  return uniqueValues(values.map(stringValue).filter(Boolean)).sort((left, right) => (
    left.localeCompare(right, "zh-Hans-CN", { numeric: true })
  ));
}

function legacyColorAliases(resource) {
  const aliases = recordValue(recordValue(resource.colors).optionAliases ?? recordValue(resource.colors).option_aliases);
  const lookup = new Map();
  for (const [standard, alias] of Object.entries(aliases)) {
    const standardText = stringValue(standard);
    const aliasText = stringValue(alias);
    if (standardText) lookup.set(compactKey(standardText), standardText);
    if (standardText && aliasText) lookup.set(compactKey(aliasText), standardText);
  }
  return lookup;
}

function legacySizeAliases(resource) {
  const aliases = recordValue(recordValue(resource.sizes).optionAliases ?? recordValue(resource.sizes).option_aliases);
  const lookup = new Map();
  for (const [standard, alias] of Object.entries(aliases)) {
    const standardText = stringValue(standard);
    const aliasText = stringValue(alias);
    if (standardText && aliasText) lookup.set(compactKey(standardText), aliasText);
  }
  return lookup;
}

function resourceSizeIdentityValue(value, sizeAliases = new Map(), { shoeSizes = false } = {}) {
  const text = stringValue(value);
  const aliased = shoeSizes ? sizeAliases.get(compactKey(text)) : "";
  return payloadSizeIdentityValue(aliased || text, { shoeSizes });
}

function payloadSkuIdentity(color, size, colorAliases = new Map(), { shoeSizes = false } = {}) {
  const colorParts = stringValue(color).split(/[,，]/).map((part) => part.trim()).filter(Boolean);
  const standardColor = colorParts
    .map((part) => colorAliases.get(compactKey(part)))
    .find(Boolean)
    ?? stringValue(sdkColorValue(color)).split(/[,，]/)[0];
  const standardSize = payloadSizeIdentityValue(size, { shoeSizes });
  return standardColor && standardSize ? JSON.stringify([standardColor, standardSize]) : "";
}

function resourceSkuIdentity(color, size, colorAliases = new Map(), sizeAliases = new Map(), { shoeSizes = false } = {}) {
  const colorParts = stringValue(color).split(/[,，]/).map((part) => part.trim()).filter(Boolean);
  const standardColor = colorParts
    .map((part) => colorAliases.get(compactKey(part)))
    .find(Boolean)
    ?? stringValue(sdkColorValue(color)).split(/[,，]/)[0];
  const standardSize = resourceSizeIdentityValue(size, sizeAliases, { shoeSizes });
  return standardColor && standardSize ? JSON.stringify([standardColor, standardSize]) : "";
}

function legacyExpectedSizeTable(field, selectedSizes, { shoeSizes = false } = {}) {
  const name = normalizeSdkFieldName(fieldName(field));
  const normalized = recordValue(normalizeSizeTableField(fieldValue(field), selectedSizes, name, { shoeSizes }));
  const columns = stringValue(normalized.title).split(",").map((column) => column.trim()).filter(Boolean);
  const rowEntries = {};
  const rows = Object.fromEntries(Object.entries(normalized)
    .filter(([size]) => size !== "title")
    .map(([size, value]) => {
      const cells = stringValue(value).split(",");
      const sizeKey = payloadSizeIdentityValue(size, { shoeSizes });
      const entries = columns.flatMap((column, index) => {
        const cell = stringValue(cells[index]);
        return cell ? [{ column, value: cell }] : [];
      });
      if (sizeKey && entries.length > 0) rowEntries[sizeKey] = entries;
      return [sizeKey, Object.fromEntries(entries.map((entry) => [entry.column, entry.value]))];
    })
    .filter(([size, values]) => size && hasValue(values)));
  return { name, rows, rowEntries };
}

function legacyActualSizeTableOptionAliases(table) {
  const aliases = recordValue(table.optionAliases ?? table.option_aliases);
  return Object.fromEntries(Object.entries(aliases)
    .map(([column, alias]) => [stringValue(column), normalizeSdkFieldName(alias)])
    .filter(([column, alias]) => column && alias));
}

function legacyActualSizeTableRows(table, { shoeSizes = false, sizeAliases = new Map() } = {}) {
  const aliases = legacyActualSizeTableOptionAliases(table);
  return Object.fromEntries(arrayValue(table.sizeTableItems ?? table.size_table_items)
    .map(recordValue)
    .map((row) => [
      resourceSizeIdentityValue(row.size, sizeAliases, { shoeSizes }),
      { values: recordValue(row.values), aliases },
    ])
    .filter(([size, row]) => size && hasValue(row.values)));
}

function legacyActualMultiPlatformRowsFromSizeTexts(resource, { shoeSizes = false, sizeAliases = new Map() } = {}) {
  const sizes = recordValue(resource.sizes);
  const labelsById = new Map();
  const rowsById = new Map();
  for (const raw of arrayValue(sizes.texts ?? sizes.Texts)) {
    const parts = stringValue(raw).split(",").map((part) => part.trim());
    const rowId = parts[0];
    const value = parts[1] ?? "";
    const platform = parts[2] ?? "";
    if (!rowId) continue;
    if (!platform) {
      if (stringValue(value)) labelsById.set(rowId, stringValue(value));
      continue;
    }
    const row = rowsById.get(rowId) ?? {};
    row[platform] = stringValue(value);
    rowsById.set(rowId, row);
  }
  const rows = {};
  for (const [rowId, values] of rowsById.entries()) {
    const label = labelsById.get(rowId);
    const size = resourceSizeIdentityValue(label, sizeAliases, { shoeSizes });
    if (size && hasValue(values)) rows[size] = { values, aliases: {} };
  }
  return rows;
}

function legacyActualSizeTables(resource, { shoeSizes = false, sizeAliases = new Map() } = {}) {
  const source = unwrapDeepdrawResourceBody(resource);
  const candidates = [
    source.sizeTable,
    source.size_table,
    source.vipSizeTable,
    source.vip_size_table,
    ...arrayValue(source.sizeTables ?? source.size_tables),
  ].map(recordValue).filter(hasValue);
  const tables = new Map();
  for (const table of candidates) {
    const name = normalizeSdkFieldName(recordValue(table.field).name ?? table.name);
    if (!name || tables.has(compactKey(name))) continue;
    const rows = legacyActualSizeTableRows(table, { shoeSizes, sizeAliases });
    tables.set(compactKey(name), { name, rows });
  }
  const multiPlatformRows = legacyActualMultiPlatformRowsFromSizeTexts(source, { shoeSizes, sizeAliases });
  if (hasValue(multiPlatformRows) && !tables.has(compactKey("多平台尺码"))) {
    tables.set(compactKey("多平台尺码"), { name: "多平台尺码", rows: multiPlatformRows });
  }
  return tables;
}

function expectedSizeTableRowEntries(expected, size) {
  const rowEntries = recordValue(expected.rowEntries);
  const entries = arrayValue(rowEntries[size]).map(recordValue).filter((entry) => stringValue(entry.column));
  if (entries.length > 0) return entries;
  return Object.entries(recordValue(expected.rows?.[size])).map(([column, value]) => ({ column, value }));
}

function actualSizeTableRowData(actualRow) {
  const row = recordValue(actualRow);
  if (hasValue(row.values) || hasValue(row.aliases)) {
    return {
      values: recordValue(row.values),
      aliases: recordValue(row.aliases),
    };
  }
  return { values: row, aliases: {} };
}

function actualSizeTableCellCandidates(actualRow, column, expectedName, { shoeSizes = false } = {}) {
  const row = actualSizeTableRowData(actualRow);
  let candidates = [column];
  if (compactKey(expectedName) === compactKey("尺码表") && shoeSizes) {
    const columnKey = compactKey(column);
    if (columnKey === compactKey("尺码")) candidates = [column, "鞋长"];
    if (columnKey === compactKey("脚长")) candidates = [column, "适合脚长"];
  }
  const candidateKeys = new Set(candidates.map(compactKey).filter(Boolean));
  const output = [];
  for (const [actualColumn, actualValue] of Object.entries(row.values)) {
    const actualColumnKey = compactKey(actualColumn);
    const aliasKey = compactKey(row.aliases[actualColumn]);
    if (candidateKeys.has(actualColumnKey) || candidateKeys.has(aliasKey)) {
      output.push({ column: actualColumn, value: stringValue(actualValue) });
    }
  }
  return output;
}

function compareLegacySizeTable(expected, actual, { shoeSizes = false } = {}) {
  const expectedSizes = sortedLegacyIdentityValues(Object.keys(expected.rows));
  const actualSizes = sortedLegacyIdentityValues(Object.keys(actual?.rows ?? {}));
  const missingSizes = expectedSizes.filter((size) => !Object.prototype.hasOwnProperty.call(actual?.rows ?? {}, size));
  const unexpectedSizes = actualSizes.filter((size) => !Object.prototype.hasOwnProperty.call(expected.rows, size));
  const mismatchedCells = [];
  for (const size of expectedSizes) {
    const expectedEntriesByColumn = new Map();
    for (const entry of expectedSizeTableRowEntries(expected, size)) {
      const column = stringValue(entry.column);
      const key = compactKey(column);
      if (!key) continue;
      expectedEntriesByColumn.set(key, [
        ...(expectedEntriesByColumn.get(key) ?? []),
        { column, value: stringValue(entry.value) },
      ]);
    }
    for (const entries of expectedEntriesByColumn.values()) {
      const column = entries[0]?.column ?? "";
      const actualCandidates = actualSizeTableCellCandidates(actual?.rows?.[size], column, expected.name, { shoeSizes });
      const remainingActualValues = actualCandidates.map((candidate) => candidate.value);
      for (const entry of entries) {
        const actualIndex = remainingActualValues.findIndex((value) => value === entry.value);
        if (actualIndex >= 0) {
          remainingActualValues.splice(actualIndex, 1);
          continue;
        }
        mismatchedCells.push({
          size,
          column: entry.column,
          expected: entry.value,
          actual: actualCandidates.map((candidate) => candidate.value).filter(Boolean).join(" | "),
        });
      }
    }
  }
  return {
    name: expected.name,
    ok: Boolean(actual)
      && missingSizes.length === 0
      && unexpectedSizes.length === 0
      && mismatchedCells.length === 0,
    expectedCount: expectedSizes.length,
    actualCount: actualSizes.length,
    missingSizes,
    unexpectedSizes,
    mismatchedCells: mismatchedCells.slice(0, 20),
  };
}

function comparisonSectionNeedsUiVerification(section) {
  return compactKey(section.name) === compactKey("多平台尺码") && !section.ok && section.actualCount === 0;
}

function sizeRemarkComparisonSection(payload = {}) {
  const hasInlineRemarks = shouldInlineSizeRemarks(payload)
    && hasValue({
      ...saleSizeInlineRemarks(findPayloadFieldValue(arrayValue(payload.fields).map(recordValue), ["尺码", "尺寸", "规格", "size"])),
      ...recordValue(payload.sizeRemarks),
    });
  return hasInlineRemarks
    ? {
        name: "尺码备注",
        ok: true,
        needsUiVerification: true,
        reason: "DeepDraw resource API may omit inline size remarks; verify in UI when needed.",
      }
    : null;
}

export function compareDeepdrawProductPayloadToResource({ payload = {}, resourceBody, shoeSizes = Boolean(payload.shoeSizes) } = {}) {
  const source = unwrapDeepdrawResourceBody(resourceBody);
  const colorAliases = legacyColorAliases(source);
  const sizeAliases = legacySizeAliases(source);
  const selectedSizes = payloadSizeValues(payload, { shoeSizes });
  const expectedSizes = sortedLegacyIdentityValues(selectedSizes);
  const resourceSizes = recordValue(source.sizes);
  const actualSizes = sortedLegacyIdentityValues(
    arrayValue(resourceSizes.options ?? resourceSizes.Options).map((size) => resourceSizeIdentityValue(size, sizeAliases, { shoeSizes })),
  );
  const missingSizes = expectedSizes.filter((size) => !actualSizes.includes(size));
  const unexpectedSizes = actualSizes.filter((size) => !expectedSizes.includes(size));
  const sizeSection = {
    name: "尺码",
    ok: missingSizes.length === 0 && unexpectedSizes.length === 0,
    expectedCount: expectedSizes.length,
    actualCount: actualSizes.length,
    missingSizes,
    unexpectedSizes,
  };

  const expectedSkuIdentities = sortedLegacyIdentityValues(arrayValue(payload.skus).map((sku) => {
    const row = recordValue(sku);
    return payloadSkuIdentity(
      row.color ?? row.colorName ?? row.color_name,
      row.size ?? row.sizeName ?? row.size_name,
      colorAliases,
      { shoeSizes },
    );
  }));
  const resourceSkus = recordValue(source.skus);
  const actualSkuIdentities = sortedLegacyIdentityValues(arrayValue(resourceSkus.skuItems ?? resourceSkus.sku_items).map((sku) => {
    const row = recordValue(sku);
    return resourceSkuIdentity(row.color, row.size, colorAliases, sizeAliases, { shoeSizes });
  }));
  const missingSkus = expectedSkuIdentities.filter((identity) => !actualSkuIdentities.includes(identity));
  const unexpectedSkus = actualSkuIdentities.filter((identity) => !expectedSkuIdentities.includes(identity));
  const skuSection = {
    name: "商家SKU",
    ok: missingSkus.length === 0 && unexpectedSkus.length === 0,
    expectedCount: expectedSkuIdentities.length,
    actualCount: actualSkuIdentities.length,
    missingSkus,
    unexpectedSkus,
  };

  const payloadFields = Array.isArray(payload.legacyUpdateFields) ? payload.legacyUpdateFields : payload.fields;
  const updateFields = shoeSizes
    ? selectDeepdrawLegacyShoeUpdateFields(payloadFields, {
        includeMultiPlatformSizeField: payload.includeMultiPlatformSizeField === true,
      })
    : arrayValue(payloadFields);
  const expectedTables = updateFields
    .filter((field) => isStructuredSizePayloadField(fieldName(field), fieldType(field)))
    .map((field) => legacyExpectedSizeTable(field, selectedSizes, { shoeSizes }))
    .filter((table) => table.name && hasValue(table.rows));
  const actualTables = legacyActualSizeTables(source, { shoeSizes, sizeAliases });
  const tableSections = expectedTables.map((table) => {
    const section = compareLegacySizeTable(table, actualTables.get(compactKey(table.name)), { shoeSizes });
    return comparisonSectionNeedsUiVerification(section)
      ? {
          ...section,
          needsUiVerification: true,
          reason: "DeepDraw resource API may omit multi-platform size rows while UI still shows them.",
        }
      : section;
  });
  const remarkSection = sizeRemarkComparisonSection(payload);
  const sections = [sizeSection, skuSection, ...tableSections, ...(remarkSection ? [remarkSection] : [])];
  const strictSections = sections.filter((section) => !section.needsUiVerification);
  const uiVerificationSections = sections.filter((section) => section.needsUiVerification);
  return {
    ok: strictSections.length > 0 && strictSections.every((section) => section.ok),
    sections,
    needsUiVerification: uiVerificationSections.length > 0,
    uiVerificationSections: uiVerificationSections.map((section) => section.name),
    supportedSizeTables: tableSections.map((section) => section.name),
    omittedUnsupportedSizeTables: shoeSizes
      ? [
          "淘宝尺码表",
          ...(payload.includeMultiPlatformSizeField === true ? [] : ["多平台尺码"]),
        ]
      : [],
  };
}

export function compareDeepdrawLegacyShoePayloadToResource({ payload = {}, resourceBody } = {}) {
  return compareDeepdrawProductPayloadToResource({
    payload: { ...payload, shoeSizes: true },
    resourceBody,
    shoeSizes: true,
  });
}

export function buildDeepdrawSdkProductInput({ config, payload = {} }) {
  const fields = {};
  const payloadFields = Array.isArray(payload.fields) ? payload.fields : [];
  const skus = Array.isArray(payload.skus) ? payload.skus : [];
  const shoeSizes = Boolean(payload.shoeSizes);
  const declaredSizeFieldValue = findPayloadFieldValue(payloadFields, ["尺码", "尺寸", "规格", "size"]);
  const declaredSizeValues = saleSizeValues(declaredSizeFieldValue);
  const shoeSaleSizeOptions = {
    shoeSaleSizeUnitMode: payload.shoeSaleSizeUnitMode === "bare" ? "bare" : "display",
  };
  const selectedSizeValues = declaredSizeValues.length > 0
    ? declaredSizeValues.map((size) => shoeSizes ? shoeSaleSizeValue(size, shoeSaleSizeOptions) : sdkSizeValue(size))
    : uniqueValues(skus.map((sku) => (
        shoeSizes
          ? shoeSaleSizeValue(sku.size ?? sku.sizeName ?? sku.size_name, shoeSaleSizeOptions)
          : sdkSizeValue(sku.size ?? sku.sizeName ?? sku.size_name)
      )).filter(Boolean));
  const inlineSizeRemarks = saleSizeInlineRemarks(declaredSizeFieldValue);
  const sizeRemarks = {
    ...inlineSizeRemarks,
    ...recordValue(payload.sizeRemarks),
  };
  const publishedSizeValue = shouldInlineSizeRemarks(payload)
    ? saleSizePayloadValue(selectedSizeValues, sizeRemarks)
    : uniqueValues(selectedSizeValues).join(";");
  for (const field of payloadFields) {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    const key = compactKey(name);
    const explicitMultiPlatformDisable = key === compactKey("多平台尺码")
      && payload.includeMultiPlatformSizeField === true
      && value
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value).length === 0;
    if (!name || (!hasValue(value) && !explicitMultiPlatformDisable)) continue;
    if (shoeSizes && isUnsupportedLegacyShoeSdkField(name)) continue;
    if (isUnsupportedScalarSdkField(name, value, type) && !explicitMultiPlatformDisable) continue;
    fields[name] = ["尺码", "尺寸", "规格", "size"].includes(key)
      ? publishedSizeValue
      : key === "商家sku"
      ? normalizeMerchantSkuField(value, selectedSizeValues)
      : isStructuredSizePayloadField(name, type)
        ? normalizeSizeTableField(value, selectedSizeValues, name, {
            shoeSizes,
            shoeMultiPlatformRowKey: payload.shoeMultiPlatformRowKey,
            preserveStructuredSizeRowKeysForProbe: payload.preserveStructuredSizeRowKeysForProbe,
            sizeRemarks,
          })
        : key === compactKey("抖音面料材质")
          ? normalizeDouyinMaterialFieldValue(value)
        : key === compactKey("所在地")
          ? normalizeDeepdrawLocation(value)
        : key === compactKey("售后服务承诺")
          ? normalizeAfterSalesServiceCommitment(value)
          : value;
  }

  const dateText = normalizeSdkDateText(
    stringValue(payload.date)
      || stringValue(findPayloadFieldValue(payloadFields, ["内容上市时间", "搜索上市时间", "上市时间"])),
  );
  if (skus.length > 0) {
    const skuColorValues = uniqueValues(skus.map((sku) => sdkColorValue(sku.color ?? sku.colorName ?? sku.color_name)).filter(Boolean));
    const colorFieldKey = fieldKey(fields, ["颜色"]);
    if (colorFieldKey) {
      const existingAliases = new Set(colorAliases(fields[colorFieldKey]));
      fields[colorFieldKey] = uniqueValues([
        ...semicolonValues(fields[colorFieldKey]),
        ...skuColorValues.filter((value) => !colorAliases(value).some((alias) => existingAliases.has(alias))),
      ]).join(";");
    } else if (skuColorValues.length > 0) {
      fields["颜色"] = skuColorValues.join(";");
    }
    if (!fieldKey(fields, ["尺码", "尺寸"])) {
      fields["尺码"] = publishedSizeValue;
    }
    if (!fieldKey(fields, ["商家 SKU", "商家SKU"])) {
      fields["商家SKU"] = buildMerchantSkuField(payload, skus, dateText, selectedSizeValues);
    }
  }

  return {
    config: {
      appKey: stringValue(config?.appKey),
      appSecret: stringValue(config?.appSecret),
      dopKey: stringValue(config?.dopKey),
      host: hostValue(config?.baseUrl ?? config?.host),
      merchantId: stringValue(config?.merchantId),
      tradeId: stringValue(payload.tradeId ?? payload.trade_id),
    },
    product: {
      code: stringValue(payload.code),
      title: stringValue(payload.title),
      retailPrice: asMoneyText(payload.retailPrice),
      date: dateText,
      places: normalizeDeepdrawSites(payload.places ?? payload.sites ?? payload.compatiblePlatforms),
      fields,
    },
  };
}

export function buildDeepdrawSdkResourceInput({ config, productCode, productId, resource }) {
  const normalizedResource = stringValue(resource);
  return {
    config: {
      appKey: stringValue(config?.appKey),
      appSecret: stringValue(config?.appSecret),
      dopKey: stringValue(config?.dopKey),
      host: hostValue(config?.baseUrl ?? config?.host),
      merchantId: stringValue(config?.merchantId),
    },
    query: {
      productCode: stringValue(productCode),
      ...(stringValue(productId) ? { productId: stringValue(productId) } : {}),
      ...(normalizedResource ? { resource: normalizedResource } : {}),
    },
  };
}

function existingJar(m2Repository, candidates) {
  for (const candidate of candidates) {
    const fullPath = path.join(m2Repository, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function buildDeepdrawSdkClasspath({
  projectRoot = path.resolve(import.meta.dirname, "../.."),
  m2Repository = process.env.DEEPDRAW_M2_REPOSITORY || path.join(os.homedir(), ".m2/repository"),
  buildDir = process.env.DEEPDRAW_SDK_BUILD_DIR || path.join(projectRoot, "tmp/deepdraw-sdk-adapter/classes"),
  dopSdkJar = process.env.DEEPDRAW_DOP_SDK_JAR || path.join(projectRoot, "vendor/deepdraw-sdk/dop-sdk-1.6.25.jar"),
} = {}) {
  const entries = [
    buildDir,
    dopSdkJar,
    path.join(projectRoot, "vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar"),
  ];
  const missing = [];
  for (const candidates of MAVEN_JAR_CANDIDATES) {
    const jar = existingJar(m2Repository, candidates);
    if (jar) entries.push(jar);
    else missing.push(candidates[0]);
  }
  return {
    entries,
    missing,
    value: entries.join(path.delimiter),
    buildDir,
  };
}

function javaTool(tool) {
  const override = process.env[`DEEPDRAW_${tool.toUpperCase()}_BIN`];
  if (override && fs.existsSync(override)) return override;
  const homes = [process.env.DEEPDRAW_JAVA_HOME, process.env.JAVA_HOME, DEFAULT_JAVA_HOME].filter(Boolean);
  for (const home of homes) {
    const candidate = path.join(home, "bin", tool);
    if (fs.existsSync(candidate)) return candidate;
  }
  return tool;
}

function runTool(command, args, options = {}) {
  const {
    input = "",
    timeout = 30000,
    maxBuffer = 10 * 1024 * 1024,
    ...spawnOptions
  } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...spawnOptions,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const enforceOutputLimit = () => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) <= maxBuffer) return;
      outputExceeded = true;
      child.kill("SIGKILL");
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      enforceOutputLimit();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      enforceOutputLimit();
    });
    child.once("error", (error) => finish(error));
    child.once("close", (status) => {
      if (outputExceeded) {
        const error = new Error(`${path.basename(command)} exceeded ${maxBuffer} bytes of output`);
        error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
        finish(error);
        return;
      }
      if (timedOut) {
        const error = new Error(`${path.basename(command)} timed out after ${timeout}ms`);
        error.code = "ETIMEDOUT";
        finish(error);
        return;
      }
      if (status !== 0) {
        finish(new Error(`${path.basename(command)} failed: ${stringValue(stderr) || stringValue(stdout) || status}`));
        return;
      }
      finish(null, stdout);
    });
    child.stdin.on("error", () => {
      // Process startup/exit errors are reported through the child error/close events.
    });
    child.stdin.end(input == null ? "" : String(input));

    const timer = Number.isFinite(timeout) && timeout > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeout)
      : null;
  });
}

export async function compileDeepdrawSdkCli({
  projectRoot = path.resolve(import.meta.dirname, "../.."),
  sourceFile = SDK_CREATE_SOURCE,
  className = SDK_CREATE_CLASS_NAME,
  timeoutMs = Number(process.env.DEEPDRAW_COMPILE_TIMEOUT_MS ?? 30000),
} = {}) {
  const classpath = buildDeepdrawSdkClasspath({ projectRoot });
  const classFile = path.join(classpath.buildDir, `${className}.class`);
  const compileInputMtime = [sourceFile, ...classpath.entries]
    .filter((entry) => entry !== classpath.buildDir && fs.existsSync(entry))
    .reduce((latest, entry) => Math.max(latest, fs.statSync(entry).mtimeMs), 0);
  const classMtime = fs.existsSync(classFile) ? fs.statSync(classFile).mtimeMs : 0;
  if (classMtime >= compileInputMtime) return { ...classpath, classFile };

  fs.mkdirSync(classpath.buildDir, { recursive: true });
  const javac = javaTool("javac");
  const compileClasspath = classpath.entries.filter((entry) => entry !== classpath.buildDir).join(path.delimiter);
  await runTool(javac, ["-encoding", "UTF-8", "-classpath", compileClasspath, "-d", classpath.buildDir, sourceFile], {
    timeout: timeoutMs,
  });
  return { ...classpath, classFile };
}

export async function runDeepdrawSdkCli(input, {
  projectRoot = path.resolve(import.meta.dirname, "../.."),
  timeoutMs = 30000,
  sourceFile = SDK_CREATE_SOURCE,
  className = SDK_CREATE_CLASS_NAME,
} = {}) {
  const classpath = await compileDeepdrawSdkCli({ projectRoot, sourceFile, className, timeoutMs });
  const java = javaTool("java");
  return runTool(java, [...JAVA_UTF8_ARGS, "-classpath", classpath.value, className], {
    input: JSON.stringify(input),
    timeout: timeoutMs,
  });
}

export async function runDeepdrawSdkResourceCli(input, options = {}) {
  return runDeepdrawSdkCli(input, {
    ...options,
    sourceFile: SDK_RESOURCE_SOURCE,
    className: SDK_RESOURCE_CLASS_NAME,
  });
}

export async function runDeepdrawProductUpdateCli(input, options = {}) {
  return runDeepdrawSdkCli(input, {
    ...options,
    sourceFile: SDK_UPDATE_SOURCE,
    className: SDK_UPDATE_CLASS_NAME,
  });
}

function extractJsonObject(text) {
  const lines = stringValue(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("{") && line.endsWith("}")) return JSON.parse(line);
  }
  return JSON.parse(stringValue(text));
}

export function parseDeepdrawSdkOutput(text) {
  const payload = extractJsonObject(text);
  const response = payload?.response && typeof payload.response === "object" ? payload.response : {};
  const responseCode = Number(response.code);
  const responseState = stringValue(response.response).toLowerCase();
  const status = Number(payload.status ?? 0);
  return {
    status,
    ok: status === 200 && responseCode === 10200 && (!responseState || responseState === "success"),
    requestId: response.requestId == null ? null : String(response.requestId),
    payload,
    text: stringValue(text),
  };
}

export async function createDeepdrawProductWithSdk({
  config,
  payload = {},
  timeoutMs = 30000,
  projectRoot,
  runner = runDeepdrawSdkCli,
} = {}) {
  const input = buildDeepdrawSdkProductInput({ config, payload });
  const output = await runner(input, { timeoutMs, projectRoot });
  return parseDeepdrawSdkOutput(output);
}

export async function updateDeepdrawFullProductWithSdk({
  config,
  payload = {},
  productId,
  timeoutMs = 30000,
  projectRoot,
  runner = runDeepdrawProductUpdateCli,
} = {}) {
  if (!/^\d+$/.test(stringValue(productId))) {
    throw new Error("DeepDraw numeric productId is required for full product update.");
  }
  const input = buildDeepdrawProductFullUpdateInput({ config, productId, payload });
  const output = await runner(input, { timeoutMs, projectRoot });
  return parseDeepdrawSdkOutput(output);
}

export async function getDeepdrawProductWithSdk({
  config,
  productCode,
  productId,
  resource,
  timeoutMs = 30000,
  projectRoot,
  runner = runDeepdrawSdkResourceCli,
} = {}) {
  const input = buildDeepdrawSdkResourceInput({ config, productCode, productId, resource });
  const output = await runner(input, { timeoutMs, projectRoot });
  return parseDeepdrawSdkOutput(output);
}
