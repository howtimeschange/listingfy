import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_JAVA_HOME = "/Users/xingyicheng/.local/toolchains/jdk8u492-b09/Contents/Home";
const SDK_CREATE_SOURCE = path.resolve(import.meta.dirname, "../java/DeepdrawProductCreateCli.java");
const SDK_CREATE_CLASS_NAME = "DeepdrawProductCreateCli";
const SDK_RESOURCE_SOURCE = path.resolve(import.meta.dirname, "../java/DeepdrawProductResourceCli.java");
const SDK_RESOURCE_CLASS_NAME = "DeepdrawProductResourceCli";
const SKU_TITLE = "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码";

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
  if (/cm$/i.test(text)) return text;
  const match = text.match(/^0*(\d{2,3})$/);
  return match ? `${Number(match[1])}cm` : text;
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

function normalizeMerchantSkuField(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const output = {};
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
      output[color][sdkSizeValue(size)] = rowValue;
    }
  }
  return output;
}

function normalizeSizeTableField(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const output = {};
  for (const [size, rowValue] of Object.entries(value)) {
    output[size === "title" ? size : sdkSizeValue(size)] = rowValue;
  }
  return output;
}

function fieldKey(fields, names) {
  const wanted = new Set(names.map(compactKey));
  return Object.keys(fields).find((key) => wanted.has(compactKey(key)));
}

function buildMerchantSkuField(payload, skus, dateText) {
  const productCode = stringValue(payload.code);
  const retailPrice = asMoneyText(payload.retailPrice);
  const output = { title: SKU_TITLE };
  for (const sku of skus) {
    const color = stringValue(sku.color ?? sku.colorName ?? sku.color_name);
    const size = sdkSizeValue(sku.size ?? sku.sizeName ?? sku.size_name);
    if (!color || !size) continue;
    const price = asMoneyText(sku.price, retailPrice);
    const sellerCode = stringValue(sku.sellerCode ?? sku.seller_code ?? sku.skuCode ?? sku.sku_code);
    const barcode = stringValue(sku.barcode ?? sku.eanCode ?? sku.ean_code);
    const skuCode = stringValue(sku.skuCode ?? sku.sku_code) || sellerCode;
    output[color] ??= {};
    output[color][size] = [
      price,
      productCode,
      dateText,
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

function hostValue(baseUrl) {
  return stringValue(baseUrl) || "http://open.deepdraw.cn";
}

export function buildDeepdrawSdkProductInput({ config, payload = {} }) {
  const fields = {};
  const payloadFields = Array.isArray(payload.fields) ? payload.fields : [];
  for (const field of payloadFields) {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    if (!name || !hasValue(value)) continue;
    const key = compactKey(name);
    fields[name] = key === "商家sku"
      ? normalizeMerchantSkuField(value)
      : key.includes("尺码表")
        ? normalizeSizeTableField(value)
        : value;
  }

  const skus = Array.isArray(payload.skus) ? payload.skus : [];
  const dateText = normalizeSdkDateText(
    stringValue(payload.date)
      || stringValue(findPayloadFieldValue(payloadFields, ["内容上市时间", "搜索上市时间", "上市时间"])),
  );
  if (skus.length > 0) {
    if (!fieldKey(fields, ["颜色"])) {
      fields["颜色"] = uniqueValues(skus.map((sku) => sdkColorValue(sku.color ?? sku.colorName ?? sku.color_name))).join(";");
    }
    if (!fieldKey(fields, ["尺码", "尺寸"])) {
      fields["尺码"] = uniqueValues(skus.map((sku) => sdkSizeValue(sku.size ?? sku.sizeName ?? sku.size_name))).join(";");
    }
    if (!fieldKey(fields, ["商家 SKU", "商家SKU"])) {
      fields["商家SKU"] = buildMerchantSkuField(payload, skus, dateText);
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
      fields,
    },
  };
}

export function buildDeepdrawSdkResourceInput({ config, productCode, productId, resource = "form" }) {
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
      resource: stringValue(resource) || "form",
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
  buildDir = path.join(projectRoot, "tmp/deepdraw-sdk-adapter/classes"),
} = {}) {
  const entries = [
    buildDir,
    path.join(projectRoot, "vendor/deepdraw-sdk/dop-sdk-1.6.0.jar"),
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
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = stringValue(result.stderr);
    const stdout = stringValue(result.stdout);
    throw new Error(`${path.basename(command)} failed: ${stderr || stdout || result.status}`);
  }
  return result.stdout ?? "";
}

export function compileDeepdrawSdkCli({
  projectRoot = path.resolve(import.meta.dirname, "../.."),
  sourceFile = SDK_CREATE_SOURCE,
  className = SDK_CREATE_CLASS_NAME,
} = {}) {
  const classpath = buildDeepdrawSdkClasspath({ projectRoot });
  const classFile = path.join(classpath.buildDir, `${className}.class`);
  const sourceMtime = fs.statSync(sourceFile).mtimeMs;
  const classMtime = fs.existsSync(classFile) ? fs.statSync(classFile).mtimeMs : 0;
  if (classMtime >= sourceMtime) return { ...classpath, classFile };

  fs.mkdirSync(classpath.buildDir, { recursive: true });
  const javac = javaTool("javac");
  const compileClasspath = classpath.entries.filter((entry) => entry !== classpath.buildDir).join(path.delimiter);
  runTool(javac, ["-encoding", "UTF-8", "-classpath", compileClasspath, "-d", classpath.buildDir, sourceFile]);
  return { ...classpath, classFile };
}

export async function runDeepdrawSdkCli(input, {
  projectRoot = path.resolve(import.meta.dirname, "../.."),
  timeoutMs = 30000,
  sourceFile = SDK_CREATE_SOURCE,
  className = SDK_CREATE_CLASS_NAME,
} = {}) {
  const classpath = compileDeepdrawSdkCli({ projectRoot, sourceFile, className });
  const java = javaTool("java");
  return runTool(java, ["-classpath", classpath.value, className], {
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

export async function getDeepdrawProductWithSdk({
  config,
  productCode,
  productId,
  resource = "form",
  timeoutMs = 30000,
  projectRoot,
  runner = runDeepdrawSdkResourceCli,
} = {}) {
  const input = buildDeepdrawSdkResourceInput({ config, productCode, productId, resource });
  const output = await runner(input, { timeoutMs, projectRoot });
  return parseDeepdrawSdkOutput(output);
}
