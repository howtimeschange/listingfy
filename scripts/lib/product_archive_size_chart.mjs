import { readSpreadsheetSheetsFromFile } from "./listing_launch_plan_importer.mjs";
import { normalizeSpreadsheetRows } from "./product_archive_source_importer.mjs";

const SPU_KEYS = ["spuCode", "spu_code", "款号", "大货款号", "货号", "商品品种编号"];
const MEASUREMENT_KEYS = ["measurementPoint", "measurement_point", "测量点", "量点", "部位", "项目"];
const SIZE_KEYS = ["size", "size_name", "尺码", "规格", "码段"];
const SIZE_VALUE_KEYS = ["sizeValue", "size_value", "尺码值", "测量值", "数值", "值"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色号", "款色编码"];

// Source: 尺码数据模板.xlsx / balabala!A1:L18 (verified 2026-08-28).
// Keep this as one canonical reference so age, weight and GB/T 1335-style
// apparel size recommendations do not drift across individual DeepDraw fields.
export const BALABALA_APPAREL_SIZE_REFERENCE = Object.freeze([
  { size: 52, weightKg: 3, age: "0-1月", douyinWeightJin: 6, maleTop: "52/40", maleBottom: "52/41", femaleTop: "52/40", femaleBottom: "52/41", neutralTop: "52/40", neutralBottom: "52/41" },
  { size: 59, weightKg: 5, age: "1-3月", douyinWeightJin: 10, maleTop: "59/40", maleBottom: "59/41", femaleTop: "59/40", femaleBottom: "59/41", neutralTop: "59/40", neutralBottom: "59/41" },
  { size: 66, weightKg: 7.5, age: "3-6月", douyinWeightJin: 15, maleTop: "66/44", maleBottom: "66/44", femaleTop: "66/44", femaleBottom: "66/44", neutralTop: "66/44", neutralBottom: "66/44" },
  { size: 73, weightKg: 8, age: "6-12月", douyinWeightJin: 16, maleTop: "73/48", maleBottom: "73/47", femaleTop: "73/48", femaleBottom: "73/47", neutralTop: "73/48", neutralBottom: "73/47" },
  { size: 80, weightKg: 9.5, age: "12-18月", douyinWeightJin: 19, maleTop: "80/48", maleBottom: "80/47", femaleTop: "80/48", femaleBottom: "80/47", neutralTop: "80/48", neutralBottom: "80/47" },
  { size: 90, weightKg: 10.5, age: "1-2岁", douyinWeightJin: 21, maleTop: "90/52", maleBottom: "90/50", femaleTop: "90/52", femaleBottom: "90/50", neutralTop: "90/52", neutralBottom: "90/50" },
  { size: 100, weightKg: 13.5, age: "2-3岁", douyinWeightJin: 27, maleTop: "100/52", maleBottom: "100/50", femaleTop: "100/52", femaleBottom: "100/50", neutralTop: "100/52", neutralBottom: "100/50" },
  { size: 110, weightKg: 17, age: "3-5岁", douyinWeightJin: 34, maleTop: "110/56", maleBottom: "110/53", femaleTop: "110/56", femaleBottom: "110/53", neutralTop: "110/56", neutralBottom: "110/53" },
  { size: 120, weightKg: 20.5, age: "5-6岁", douyinWeightJin: 41, maleTop: "120/60", maleBottom: "120/56", femaleTop: "120/60", femaleBottom: "120/53", neutralTop: "120/60", neutralBottom: "120/56" },
  { size: 130, weightKg: 25, age: "6-8岁", douyinWeightJin: 50, maleTop: "130/64", maleBottom: "130/59", femaleTop: "130/64", femaleBottom: "130/53", neutralTop: "130/64", neutralBottom: "130/59" },
  { size: 140, weightKg: 31, age: "8-11岁", douyinWeightJin: 62, maleTop: "140/68", maleBottom: "140/60", femaleTop: "140/64", femaleBottom: "140/55", neutralTop: "140/68", neutralBottom: "140/60" },
  { size: 150, weightKg: 37, age: "11-13岁", douyinWeightJin: 74, maleTop: "150/72", maleBottom: "150/63", femaleTop: "150/72", femaleBottom: "150/61", neutralTop: "150/72", neutralBottom: "150/63" },
  { size: 160, weightKg: 45, age: "13-14岁", douyinWeightJin: 90, maleTop: "160/80", maleBottom: "160/69", femaleTop: "160/80A", femaleBottom: "160/64A", neutralTop: "160/80", neutralBottom: "160/69" },
  { size: 165, weightKg: 52.5, age: "14-15岁", douyinWeightJin: 105, maleTop: "165/84A", maleBottom: "165/70A", femaleTop: "165/84A", femaleBottom: "165/68A", neutralTop: "165/84A", neutralBottom: "165/70A" },
  { size: 170, weightKg: 57.5, age: "15-16岁", douyinWeightJin: 115, maleTop: "170/88A", maleBottom: "170/74A", femaleTop: "170/88A", femaleBottom: "170/72A", neutralTop: "170/88A", neutralBottom: "170/74A" },
  { size: 175, weightKg: 62.5, age: "16-17岁", douyinWeightJin: 125, maleTop: "175/92A", maleBottom: "175/78A", femaleTop: "175/92A", femaleBottom: "175/76A", neutralTop: "175/92A", neutralBottom: "175/78A" },
  { size: 180, weightKg: 67.5, age: "17-18岁", douyinWeightJin: 135, maleTop: "180/96A", maleBottom: "180/80A", femaleTop: "180/96A", femaleBottom: "180/78A", neutralTop: "180/96A", neutralBottom: "180/80A" },
]);

function numericSize(value) {
  const match = stringValue(value).match(/\d{2,3}/);
  return match ? Number(match[0]) : null;
}

function balabalaReferenceRow(value) {
  const size = numericSize(value);
  return size == null ? null : BALABALA_APPAREL_SIZE_REFERENCE.find((row) => row.size === size) ?? null;
}

function yearAgeBand(value) {
  const match = stringValue(value).match(/(\d{1,2})\s*[-~～至—－]\s*(\d{1,2})\s*岁/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

export function balabalaApparelAgeTextForSizeRange(value) {
  const values = Array.from(stringValue(value).matchAll(/\d{2,3}/g)).map((match) => Number(match[0]));
  if (values.length === 0) return "";
  const start = Math.min(...values);
  const end = Math.max(...values);
  const startBand = yearAgeBand(BALABALA_APPAREL_SIZE_REFERENCE.find((row) => row.size === start)?.age);
  const endBand = yearAgeBand(BALABALA_APPAREL_SIZE_REFERENCE.find((row) => row.size === end)?.age);
  if (!startBand || !endBand) return "";
  const rows = BALABALA_APPAREL_SIZE_REFERENCE.filter((row) => row.size >= start && row.size <= end);
  const bands = rows.map((row) => yearAgeBand(row.age)).filter(Boolean);
  return `${Math.min(...bands.map((band) => band.start))}-${Math.max(...bands.map((band) => band.end))}岁`;
}

function apparelGenderKey(value) {
  const text = stringValue(value).replace(/\s+/g, "");
  if (!text) return "";
  if (text.includes("中性") || text.includes("男女") || (text.includes("男") && text.includes("女"))) return "neutral";
  if (text.includes("女")) return "female";
  if (text.includes("男")) return "male";
  return "";
}

function apparelGarmentKey(value) {
  const text = stringValue(value).replace(/\s+/g, "");
  if (/下装|裤|裙/.test(text)) return "bottom";
  if (/上装|衣|衫|外套|卫衣|夹克|大衣|马甲|背心/.test(text)) return "top";
  return "";
}

export function balabalaApparelRecommendedSize({ size, gender, garmentType } = {}) {
  const row = balabalaReferenceRow(size);
  const genderKey = apparelGenderKey(gender);
  const garmentKey = apparelGarmentKey(garmentType);
  if (!row || !genderKey || !garmentKey) return "";
  const key = `${genderKey}${garmentKey === "top" ? "Top" : "Bottom"}`;
  return stringValue(row[key]);
}

function balabalaReferenceMapping(targetField, gender, garmentType) {
  const raw = stringValue(targetField).replace(/\s+/g, "");
  const key = compactKey(targetField);
  if (/适合年龄|推荐年龄/.test(key)) return "balabala:age";
  if (/斤|抖音重量/.test(raw)) return "balabala:douyin_weight";
  if (/kg|公斤/i.test(raw) || key === compactKey("体重")) return "balabala:weight";
  if (/号型|推荐尺码|标准尺码/.test(key) && apparelGenderKey(gender) && apparelGarmentKey(garmentType)) {
    return "balabala:recommended_size";
  }
  return "";
}

export const HIGH_CONFIDENCE_SIZE_CHART_RULES = [
  ["领口", ["领口", "领围", "领宽"]],
  ["衣长", ["衣长"]],
  ["裙长", ["裙长"]],
  ["肩宽", ["肩宽"]],
  ["胸围", ["胸围", "1/2胸围（平量）", "1/2胸围"]],
  ["裤长", ["裤长"]],
  ["腰围", ["全腰围（平量）", "腰围", "1/2腰围（平量）", "1/2腰围"]],
  ["臀围", ["臀围", "臀围（平量）", "1/2臀围（平量）", "1/2臀围"]],
  ["脚口", ["1/2脚口（平量）"]],
  ["裤口围", ["1/2脚口（平量）"]],
  ["下摆围", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]],
  ["下摆", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]],
  ["体重", ["体重", "建议体重", "适合体重", "体重(斤)"]],
];

export const MEDIUM_CONFIDENCE_SIZE_CHART_RULES = [
  ["袖长", ["袖长", "袖长肩点量", "内袖长", "里：袖长"]],
  ["前浪", ["前浪（弯量）"]],
  ["前档", ["前浪（弯量）"]],
  ["前裆", ["前浪（弯量）"]],
  ["后浪", ["后浪（弯量）"]],
  ["后裆", ["后浪（弯量）"]],
  ["大腿围", ["1/2脾围"]],
  ["袖笼围", ["1/2夹圈（弯量）", "1/2夹圈弯量", "1/2夹直（边至边量）背心"]],
];

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  return "";
}

function compactKey(value) {
  return stringValue(value)
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/[：:]/g, ":")
    .replace(/(?:cm|厘米|kg|公斤|斤|g|克)$/i, "")
    .toLowerCase();
}

function isMainSizeTableFieldName(value) {
  const key = compactKey(value);
  if (!key.includes("尺码表")) return false;
  if (key === compactKey("多平台尺码")) return false;
  if (/^(?:22q4|25)鞋子尺码表$/.test(key)) return false;
  return !/(?:唯品会|抖音|天猫|淘宝|京东|拼多多|小红书|快手|微信视频|好衣库|爱库存|1688|平台)/.test(key);
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = stringValue(row?.[key]);
    if (value) return value;
  }
  return "";
}

function numberText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Number(value.toFixed(3)));
  const text = stringValue(value).replace(/[,，]/g, "");
  if (!text) return "";
  const number = Number(text);
  if (!Number.isFinite(number)) return text;
  return String(Number(number.toFixed(3)));
}

function cleanRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    const text = stringValue(value);
    if (text) output[key] = text;
  }
  return output;
}

function normalizeRows(rows = []) {
  return normalizeSpreadsheetRows(rows).map(cleanRow).filter((row) => Object.keys(row).length > 0);
}

function isSizeColumnName(value) {
  const text = stringValue(value).replace(/\s+/g, "");
  if (!text) return false;
  return /^0?\d{2,3}(?:cm|\/)?$/i.test(text);
}

export function normalizeDeepdrawSize(value) {
  const text = stringValue(value).replace(/\/+$/, "");
  if (!text) return "";
  const match = text.match(/^0*(\d{2,3})(?:\s*(?:cm|厘米|公分|码))?$/i);
  return match ? `${Number(match[1])}cm` : text;
}

function normalizeMeasurementPoint(value) {
  return stringValue(value).replace(/\s+/g, "");
}

function normalizedSizeChartRow({
  row,
  sheetName,
  rowNumber,
  spuCode,
  skcCode,
  measurementPoint,
  size,
  sizeValue,
}) {
  const normalizedSize = normalizeDeepdrawSize(size);
  const normalizedPoint = normalizeMeasurementPoint(measurementPoint);
  const normalizedValue = numberText(sizeValue);
  if (!spuCode || !normalizedPoint || !normalizedSize || !normalizedValue) return null;
  const rowJson = {
    ...cleanRow(row),
    款号: spuCode,
    测量点: normalizedPoint,
    尺码: normalizedSize,
    尺码值: normalizedValue,
  };
  if (sheetName) rowJson.sheetName = sheetName;
  if (rowNumber) rowJson.rowNumber = rowNumber;
  return {
    sourceType: "size_chart",
    spuCode,
    skcCode: skcCode || null,
    measurementPoint: normalizedPoint,
    size: normalizedSize,
    sizeValue: normalizedValue,
    rowJson,
  };
}

export function normalizePlmSizeChartRows(rows = [], options = {}) {
  const normalized = normalizeRows(rows);
  const output = [];
  normalized.forEach((row, index) => {
    const spuCode = firstValue(row, SPU_KEYS);
    const skcCode = firstValue(row, SKC_KEYS);
    const measurementPoint = firstValue(row, MEASUREMENT_KEYS);
    if (!spuCode || !measurementPoint) return;

    const longSize = firstValue(row, SIZE_KEYS);
    const longValue = firstValue(row, SIZE_VALUE_KEYS);
    if (longSize && longValue) {
      const item = normalizedSizeChartRow({
        row,
        sheetName: options.sheetName,
        rowNumber: Number(options.rowOffset ?? 0) + index + 1,
        spuCode,
        skcCode,
        measurementPoint,
        size: longSize,
        sizeValue: longValue,
      });
      if (item) output.push(item);
      return;
    }

    for (const [key, value] of Object.entries(row)) {
      if (!isSizeColumnName(key)) continue;
      const item = normalizedSizeChartRow({
        row,
        sheetName: options.sheetName,
        rowNumber: Number(options.rowOffset ?? 0) + index + 1,
        spuCode,
        skcCode,
        measurementPoint,
        size: key,
        sizeValue: value,
      });
      if (item) output.push(item);
    }
  });
  return output;
}

function optionText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return stringValue(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    return stringValue(
      value.value
        ?? value.optionValue
        ?? value.option_value
        ?? value.code
        ?? value.key
        ?? value.name
        ?? value.label
        ?? value.text
        ?? value.optionName
        ?? value.option_name
        ?? value.title
        ?? value.id,
    );
  }
  return "";
}

function templateTargetFields(template = {}) {
  const options = Array.isArray(template.options) ? template.options : [];
  return Array.from(new Set(options.map(optionText).filter(Boolean)));
}

function ruleRows() {
  return [
    ...HIGH_CONFIDENCE_SIZE_CHART_RULES.map(([targetField, sourcePoints]) => ({
      targetField,
      sourcePoints,
      confidence: "high",
    })),
    ...MEDIUM_CONFIDENCE_SIZE_CHART_RULES.map(([targetField, sourcePoints]) => ({
      targetField,
      sourcePoints,
      confidence: "medium",
    })),
  ];
}

function pointLookup(rows) {
  const lookup = new Map();
  for (const row of rows) {
    const key = compactKey(row.measurementPoint);
    if (!lookup.has(key)) lookup.set(key, row.measurementPoint);
  }
  return lookup;
}

function resolveMapping(targetField, rows) {
  const targetKey = compactKey(targetField);
  const points = pointLookup(rows);
  if (targetKey === compactKey("尺码") || targetKey === compactKey("尺寸")) {
    return {
      targetField,
      sourcePoint: "尺码",
      confidence: "high",
      source: "rule",
      reason: "尺码表行尺码展示可带单位，表内尺码列填裸数字",
    };
  }
  if (targetKey === compactKey("身高")) {
    const matchedPoint = points.get(compactKey("身高"));
    if (matchedPoint) {
      return {
        targetField,
        sourcePoint: matchedPoint,
        confidence: "high",
        source: "rule",
        reason: "PLM 测量点与深绘尺码表字段直接匹配",
      };
    }
    return {
      targetField,
      sourcePoint: "尺码",
      confidence: "high",
      source: "rule",
      reason: "PLM 未提供身高测量点，按尺码标签自动填充",
    };
  }
  for (const rule of ruleRows()) {
    if (compactKey(rule.targetField) !== targetKey) continue;
    for (const sourcePoint of rule.sourcePoints) {
      const matchedPoint = points.get(compactKey(sourcePoint));
      if (matchedPoint) {
        return {
          targetField,
          sourcePoint: matchedPoint,
          confidence: rule.confidence,
          source: "rule",
          reason: rule.confidence === "high"
            ? "PLM 测量点与深绘尺码表字段直接匹配"
            : "PLM 测量点可推荐匹配，但建议人工审核",
        };
      }
    }
    return {
      targetField,
      sourcePoint: null,
      confidence: "unmatched",
      source: "rule",
      reason: "当前 PLM 测量点未命中固化规则",
    };
  }
  return {
    targetField,
    sourcePoint: null,
    confidence: "unmatched",
    source: "rule",
    reason: "当前目标字段需要 AI 推荐或人工判断",
  };
}

function normalizeExplicitMapping(mapping, rows) {
  const targetField = stringValue(mapping?.targetField ?? mapping?.target_field);
  const sourcePoint = stringValue(mapping?.sourcePoint ?? mapping?.source_point);
  if (!targetField || !sourcePoint) return null;
  const matchedPoint = pointLookup(rows).get(compactKey(sourcePoint));
  if (!matchedPoint) return null;
  const confidence = stringValue(mapping?.confidence) || "manual";
  const source = stringValue(mapping?.source) || "manual";
  return {
    targetField,
    sourcePoint: matchedPoint,
    confidence: ["high", "medium", "low", "manual", "unmatched"].includes(confidence) ? confidence : "manual",
    source: ["rule", "ai", "rule_fallback", "manual"].includes(source) ? source : "manual",
    reason: stringValue(mapping?.reason) || "人工审核后的尺码表映射",
  };
}

function explicitMappingLookup(mappings, rows) {
  const lookup = new Map();
  for (const mapping of Array.isArray(mappings) ? mappings : []) {
    const normalized = normalizeExplicitMapping(mapping, rows);
    if (!normalized) continue;
    lookup.set(compactKey(normalized.targetField), normalized);
  }
  return lookup;
}

function sortSizes(values) {
  return [...values].sort((left, right) => {
    const leftNumber = Number(stringValue(left).match(/\d+/)?.[0] ?? NaN);
    const rightNumber = Number(stringValue(right).match(/\d+/)?.[0] ?? NaN);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return stringValue(left).localeCompare(stringValue(right), "zh-Hans-CN");
  });
}

function sizeLabelNumber(value) {
  const match = stringValue(value).match(/\d{2,3}/);
  return match ? String(Number(match[0])) : "";
}

function sizeMatchKeys(value) {
  const text = stringValue(value);
  if (!text) return [];
  const normalized = normalizeDeepdrawSize(text);
  const numberText = normalized.match(/^(\d+)cm$/i)?.[1] ?? "";
  return Array.from(new Set([
    text,
    normalized,
    numberText,
    numberText ? numberText.padStart(3, "0") : "",
  ].map((item) => item.replace(/\s+/g, "").toLowerCase()).filter(Boolean)));
}

function derivedValueForMapping(mapping, size, context = {}) {
  const referenceRow = balabalaReferenceRow(size);
  const targetKey = compactKey(mapping?.targetField);
  const sourceKey = compactKey(mapping?.sourcePoint);
  if (mapping?.sourcePoint === "balabala:age") return referenceRow?.age ?? "";
  if (mapping?.sourcePoint === "balabala:weight") return referenceRow ? numberText(referenceRow.weightKg) : "";
  if (mapping?.sourcePoint === "balabala:douyin_weight") return referenceRow ? numberText(referenceRow.douyinWeightJin) : "";
  if (mapping?.sourcePoint === "balabala:recommended_size") {
    return balabalaApparelRecommendedSize({ size, gender: context.gender, garmentType: context.garmentType });
  }
  if (["尺码", "尺寸"].some((field) => targetKey === compactKey(field))) {
    return sizeLabelNumber(size) || "0";
  }
  if (targetKey === compactKey("身高") && sourceKey === compactKey("尺码")) {
    return sizeLabelNumber(size) || "0";
  }
  if (sourceKey === compactKey("尺码")) {
    const platform = targetKey;
    if (["京东", "jd"].includes(platform)) return sizeLabelNumber(size) || "0";
    if (["天猫", "快手", "微信视频", "微信视频小店", "拼多多", "小红书", "抖音", "唯品会", "有赞", "1688"].includes(platform)) {
      return normalizeDeepdrawSize(size);
    }
  }
  return null;
}

function mappedSizeChartValue(mapping, value) {
  const text = stringValue(value);
  if (!text) return text;
  const target = compactKey(mapping?.targetField);
  const source = stringValue(mapping?.sourcePoint).replace(/\s+/g, "");
  const doublesHalfWidth = ["胸围", "腰围", "臀围", "脚口", "裤口围"].some((field) => target === compactKey(field))
    && /1\/2/.test(source);
  if (!doublesHalfWidth) return text;
  const number = Number(text);
  return Number.isFinite(number) ? numberText(number * 2) : text;
}

function isBlankSizeChartValue(value) {
  const text = stringValue(value);
  if (!text) return true;
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric === 0;
}

export function buildSizeChartForTemplate({
  rows = [],
  spuCode,
  template = {},
  mappings: explicitMappings = [],
  allowedSizes = [],
  gender = "",
  garmentType = "",
} = {}) {
  const allowedSizeKeys = new Set(
    (Array.isArray(allowedSizes) ? allowedSizes : [])
      .flatMap(sizeMatchKeys),
  );
  const normalizedRows = normalizePlmSizeChartRows(rows)
    .filter((row) => !spuCode || row.spuCode === stringValue(spuCode))
    .filter((row) => allowedSizeKeys.size === 0 || sizeMatchKeys(row.size).some((key) => allowedSizeKeys.has(key)));
  const mappingOverrides = explicitMappingLookup(explicitMappings, normalizedRows);
  const mainSizeTableField = isMainSizeTableFieldName(template.fieldName);
  const multiPlatformSizeField = compactKey(template.fieldName) === compactKey("多平台尺码");
  const rawTargetFields = templateTargetFields(template);
  const targetFieldsWithSize = mainSizeTableField && !rawTargetFields.some((targetField) => compactKey(targetField) === compactKey("尺码"))
    ? ["尺码", ...rawTargetFields]
    : rawTargetFields;
  const targetFields = targetFieldsWithSize.filter((targetField) => (
    !multiPlatformSizeField || ["京东", "jd"].includes(compactKey(targetField))
  ));
  const mappings = targetFields.map((targetField) => {
    const explicit = mappingOverrides.get(compactKey(targetField));
    if (explicit) return explicit;
    if (multiPlatformSizeField) {
      return {
        targetField,
        sourcePoint: "尺码",
        confidence: "high",
        source: "rule",
        reason: "多平台尺码只发送京东，数值尺码去掉 cm/码",
      };
    }
    const resolved = resolveMapping(targetField, normalizedRows);
    if (resolved.sourcePoint) return resolved;
    const sourcePoint = balabalaReferenceMapping(targetField, gender, garmentType);
    return sourcePoint
      ? {
          targetField,
          sourcePoint,
          confidence: "high",
          source: "rule",
          reason: "尺码数据模板.xlsx / balabala 基准表",
        }
      : resolved;
  });
  const unmatchedTargets = mappings
    .filter((mapping) => !mapping.sourcePoint)
    .map((mapping) => mapping.targetField);
  const valueByPointAndSize = new Map();
  const sizes = new Set();
  for (const row of normalizedRows) {
    sizes.add(row.size);
    const key = `${compactKey(row.measurementPoint)}\u0000${row.size}`;
    if (!valueByPointAndSize.has(key)) valueByPointAndSize.set(key, row.sizeValue);
  }

  const valuesBySize = new Map();
  for (const size of sortSizes(sizes)) {
    const values = mappings.map((mapping) => {
      const derivedValue = derivedValueForMapping(mapping, size, { gender, garmentType });
      if (derivedValue != null) return derivedValue;
      return mapping.sourcePoint
        ? mappedSizeChartValue(mapping, valueByPointAndSize.get(`${compactKey(mapping.sourcePoint)}\u0000${size}`) ?? "0")
        : "0";
    });
    valuesBySize.set(size, values);
  }
  const activeMappingIndexes = new Set();
  for (let index = 0; index < mappings.length; index += 1) {
    const values = Array.from(valuesBySize.values()).map((rowValues) => rowValues[index]);
    if (values.length > 0 && values.every((value) => !isBlankSizeChartValue(value))) {
      activeMappingIndexes.add(index);
    }
  }

  const activeMappings = mappings.filter((_, index) => activeMappingIndexes.has(index));
  const activeNonSizeMappings = activeMappings.filter((mapping) => !["尺码", "尺寸"].some((field) => compactKey(mapping.targetField) === compactKey(field)));
  const valueJson = {};
  if (mappings.length > 0 && sizes.size > 0) {
    if (activeMappings.length > 0 && (!mainSizeTableField || activeNonSizeMappings.length > 0)) {
      valueJson.title = activeMappings.map((mapping) => mapping.targetField).join(",");
      for (const size of sortSizes(sizes)) {
        const values = valuesBySize.get(size) ?? [];
        valueJson[size] = values
          .filter((_, index) => activeMappingIndexes.has(index))
          .join(",");
      }
    }
  }

  return {
    fieldName: stringValue(template.fieldName),
    spuCode: stringValue(spuCode),
    valueJson,
    mappings,
    unmatchedTargets,
    sourceRowCount: normalizedRows.length,
  };
}

export function recommendSizeChartTrade({ spu = {}, plmPoints = [], trades = [] } = {}) {
  const points = new Set(plmPoints.map(compactKey).filter(Boolean));
  let best = null;
  for (const trade of trades) {
    const fields = Array.isArray(trade.fields) ? trade.fields : [];
    const score = fields.reduce((total, field) => (
      points.has(compactKey(field)) ? total + 2 : total
    ), 0) + (stringValue(spu.categoryName) && stringValue(trade.trade_path).includes(stringValue(spu.categoryName)) ? 1 : 0);
    if (!best || score > best.score) best = { trade, score };
  }
  if (!best || best.score <= 0) return null;
  return {
    tradeId: stringValue(best.trade.trade_id ?? best.trade.tradeId),
    tradePath: stringValue(best.trade.trade_path ?? best.trade.tradePath),
    confidence: best.score >= 4 ? "high" : "medium",
    score: best.score,
  };
}

function sheetLooksLikeLongPlmTable(sheet) {
  return normalizeRows(sheet.rows).some((row) => (
    firstValue(row, SPU_KEYS)
    && firstValue(row, MEASUREMENT_KEYS)
    && firstValue(row, SIZE_KEYS)
    && firstValue(row, SIZE_VALUE_KEYS)
  ));
}

function dedupeSizeChartRows(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = [
      row.spuCode,
      row.measurementPoint,
      row.size,
      row.sizeValue,
    ].join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

export async function readPlmSizeChartWorkbook(filePath, options = {}) {
  const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: options.fileName || filePath });
  const longSheets = sheets.filter((sheet) => stringValue(sheet.name).includes("长表"));
  const structuredLongSheets = longSheets.length > 0 ? longSheets : sheets.filter(sheetLooksLikeLongPlmTable);
  const selectedSheets = structuredLongSheets.length > 0 ? structuredLongSheets : sheets;
  return dedupeSizeChartRows(selectedSheets.flatMap((sheet) => normalizePlmSizeChartRows(sheet.rows, { sheetName: sheet.name })));
}
