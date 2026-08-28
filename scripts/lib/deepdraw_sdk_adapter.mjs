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
  if (/cm$/i.test(text)) return text;
  const match = text.match(/^0*(\d{2,3})$/);
  return match ? `${Number(match[1])}cm` : text;
}

function bareShoeSizeValue(value) {
  return stringValue(value).replace(/\s*码$/, "");
}

function sizeMatchKeys(value) {
  const text = stringValue(value);
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
  return stringValue(value).split(/[;；]/).map((part) => part.trim()).filter(Boolean);
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

const DEEPDRAW_MULTI_PLATFORM_SIZE_CODES = new Map([
  ["京东", "JD"],
  ["拼多多", "PDD"],
  ["小红书", "XIAOHONGSHU"],
  ["微信视频小店", "WEIXINXIAODIAN"],
]);

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

function isUnsupportedLegacyShoeSizeField(name) {
  const key = compactKey(name);
  return key === compactKey("多平台尺码") || key === compactKey("淘宝尺码表");
}

export function selectDeepdrawLegacyShoeCreateFields(fields = []) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    if (!isStructuredSizePayloadField(name, type)) return true;
    return compactKey(name) === compactKey("尺码表");
  });
}

export function selectDeepdrawLegacyShoeUpdateFields(fields = []) {
  return arrayValue(fields).filter((field) => {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) return false;
    return !isStructuredSizePayloadField(name, type) || !isUnsupportedLegacyShoeSizeField(name);
  });
}

function normalizeMultiPlatformSizeTitle(value) {
  return stringValue(value)
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => DEEPDRAW_MULTI_PLATFORM_SIZE_CODES.get(part) ?? part)
    .join(",");
}

function normalizeSizeTableField(value, sizeValues = [], name = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const output = {};
  for (const [size, rowValue] of Object.entries(value)) {
    if (size === "title") {
      output[size] = compactKey(name) === compactKey("多平台尺码")
        ? normalizeMultiPlatformSizeTitle(rowValue)
        : rowValue;
      continue;
    }
    output[sdkPayloadSizeValue(size, sizeValues)] = rowValue;
  }
  return output;
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
  return semicolonValues(value).flatMap((item) => item.split(/[,，]/).map((part) => part.trim()).filter(Boolean));
}

function hostValue(baseUrl) {
  return stringValue(baseUrl) || "http://open.deepdraw.cn";
}

function unwrapDeepdrawResourceBody(value) {
  const source = recordValue(value);
  const responseBody = recordValue(recordValue(source.response).body);
  if (hasValue(responseBody)) return responseBody;
  const body = recordValue(source.body);
  if (hasValue(body) && (source.code != null || source.response != null || source.requestId != null)) return body;
  return source;
}

export function buildDeepdrawProductFullUpdateInput({ config, productId, payload = {} } = {}) {
  const input = buildDeepdrawSdkProductInput({
    config,
    payload: {
      ...payload,
      fields: Array.isArray(payload.legacyUpdateFields)
        ? payload.legacyUpdateFields
        : payload.fields,
    },
  });
  return {
    config: input.config,
    productId: stringValue(productId),
    product: input.product,
  };
}

function legacyShoeSizeValues(payload) {
  const fields = arrayValue(payload.fields).map(recordValue);
  const declared = saleSizeValues(findPayloadFieldValue(fields, ["尺码", "尺寸", "规格", "size"]));
  const source = declared.length > 0
    ? declared
    : arrayValue(payload.skus).map((sku) => {
        const row = recordValue(sku);
        return row.size ?? row.sizeName ?? row.size_name;
      });
  return uniqueValues(source.map(bareShoeSizeValue).filter(Boolean));
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

function legacyShoeSkuIdentity(color, size, colorAliases = new Map()) {
  const colorParts = stringValue(color).split(/[,，]/).map((part) => part.trim()).filter(Boolean);
  const standardColor = colorParts
    .map((part) => colorAliases.get(compactKey(part)))
    .find(Boolean)
    ?? stringValue(sdkColorValue(color)).split(/[,，]/)[0];
  const standardSize = bareShoeSizeValue(size);
  return standardColor && standardSize ? JSON.stringify([standardColor, standardSize]) : "";
}

function legacyExpectedSizeTable(field, selectedSizes) {
  const name = normalizeSdkFieldName(fieldName(field));
  const normalized = recordValue(normalizeSizeTableField(fieldValue(field), selectedSizes, name));
  const columns = stringValue(normalized.title).split(",").map((column) => column.trim()).filter(Boolean);
  const rows = Object.fromEntries(Object.entries(normalized)
    .filter(([size]) => size !== "title")
    .map(([size, value]) => {
      const cells = stringValue(value).split(",");
      return [bareShoeSizeValue(size), Object.fromEntries(columns.flatMap((column, index) => {
        const cell = stringValue(cells[index]);
        return cell ? [[column, cell]] : [];
      }))];
    })
    .filter(([size, values]) => size && hasValue(values)));
  return { name, rows };
}

function legacyActualSizeTables(resource) {
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
    const rows = Object.fromEntries(arrayValue(table.sizeTableItems ?? table.size_table_items)
      .map(recordValue)
      .map((row) => [bareShoeSizeValue(row.size), recordValue(row.values)])
      .filter(([size, values]) => size && hasValue(values)));
    tables.set(compactKey(name), { name, rows });
  }
  return tables;
}

function compareLegacySizeTable(expected, actual) {
  const expectedSizes = sortedLegacyIdentityValues(Object.keys(expected.rows));
  const actualSizes = sortedLegacyIdentityValues(Object.keys(actual?.rows ?? {}));
  const missingSizes = expectedSizes.filter((size) => !Object.prototype.hasOwnProperty.call(actual?.rows ?? {}, size));
  const unexpectedSizes = actualSizes.filter((size) => !Object.prototype.hasOwnProperty.call(expected.rows, size));
  const mismatchedCells = [];
  for (const size of expectedSizes) {
    const expectedValues = recordValue(expected.rows[size]);
    const actualValues = recordValue(actual?.rows?.[size]);
    for (const [column, expectedValue] of Object.entries(expectedValues)) {
      if (stringValue(actualValues[column]) !== stringValue(expectedValue)) {
        mismatchedCells.push({
          size,
          column,
          expected: stringValue(expectedValue),
          actual: stringValue(actualValues[column]),
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

export function compareDeepdrawLegacyShoePayloadToResource({ payload = {}, resourceBody } = {}) {
  const source = unwrapDeepdrawResourceBody(resourceBody);
  const colorAliases = legacyColorAliases(source);
  const selectedSizes = legacyShoeSizeValues(payload);
  const expectedSizes = sortedLegacyIdentityValues(selectedSizes);
  const actualSizes = sortedLegacyIdentityValues(
    arrayValue(recordValue(source.sizes).options).map(bareShoeSizeValue),
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
    return legacyShoeSkuIdentity(
      row.color ?? row.colorName ?? row.color_name,
      row.size ?? row.sizeName ?? row.size_name,
      colorAliases,
    );
  }));
  const actualSkuIdentities = sortedLegacyIdentityValues(arrayValue(recordValue(source.skus).skuItems).map((sku) => {
    const row = recordValue(sku);
    return legacyShoeSkuIdentity(row.color, row.size, colorAliases);
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

  const updateFields = selectDeepdrawLegacyShoeUpdateFields(
    Array.isArray(payload.legacyUpdateFields) ? payload.legacyUpdateFields : payload.fields,
  );
  const expectedTables = updateFields
    .filter((field) => isStructuredSizePayloadField(fieldName(field), fieldType(field)))
    .map((field) => legacyExpectedSizeTable(field, selectedSizes))
    .filter((table) => table.name && hasValue(table.rows));
  const actualTables = legacyActualSizeTables(source);
  const tableSections = expectedTables.map((table) => (
    compareLegacySizeTable(table, actualTables.get(compactKey(table.name)))
  ));
  const sections = [sizeSection, skuSection, ...tableSections];
  return {
    ok: sections.length > 0 && sections.every((section) => section.ok),
    sections,
    supportedSizeTables: tableSections.map((section) => section.name),
    omittedUnsupportedSizeTables: ["多平台尺码", "淘宝尺码表"],
  };
}

export function buildDeepdrawSdkProductInput({ config, payload = {} }) {
  const fields = {};
  const payloadFields = Array.isArray(payload.fields) ? payload.fields : [];
  const skus = Array.isArray(payload.skus) ? payload.skus : [];
  const shoeSizes = Boolean(payload.shoeSizes);
  const declaredSizeValues = saleSizeValues(findPayloadFieldValue(payloadFields, ["尺码", "尺寸", "规格", "size"]));
  const selectedSizeValues = declaredSizeValues.length > 0
    ? declaredSizeValues.map((size) => shoeSizes ? bareShoeSizeValue(size) : size)
    : uniqueValues(skus.map((sku) => (
        shoeSizes
          ? bareShoeSizeValue(sku.size ?? sku.sizeName ?? sku.size_name)
          : sdkSizeValue(sku.size ?? sku.sizeName ?? sku.size_name)
      )).filter(Boolean));
  // The authorized v1 Product API treats aliases and remarks as new enum
  // values, so preserve the provider's bare size identity here.
  const publishedSizeValue = selectedSizeValues.join(";");
  for (const field of payloadFields) {
    const name = normalizeSdkFieldName(fieldName(field));
    const value = fieldValue(field);
    const type = fieldType(field);
    if (!name || !hasValue(value)) continue;
    if (shoeSizes && isUnsupportedLegacyShoeSizeField(name)) continue;
    if (isUnsupportedScalarSdkField(name, value, type)) continue;
    const key = compactKey(name);
    fields[name] = shoeSizes && ["尺码", "尺寸", "规格", "size"].includes(key)
      ? publishedSizeValue
      : key === "商家sku"
      ? normalizeMerchantSkuField(value, selectedSizeValues)
      : isStructuredSizePayloadField(name, type)
        ? normalizeSizeTableField(value, selectedSizeValues, name)
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
  const sourceMtime = fs.statSync(sourceFile).mtimeMs;
  const classMtime = fs.existsSync(classFile) ? fs.statSync(classFile).mtimeMs : 0;
  if (classMtime >= sourceMtime) return { ...classpath, classFile };

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
