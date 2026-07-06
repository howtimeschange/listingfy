import { readSpreadsheetSheetsFromFile } from "./listing_launch_plan_importer.mjs";
import { normalizeSpreadsheetRows } from "./product_archive_source_importer.mjs";

const SPU_KEYS = ["spuCode", "spu_code", "款号", "大货款号", "货号", "商品品种编号"];
const MEASUREMENT_KEYS = ["measurementPoint", "measurement_point", "测量点", "量点", "部位", "项目"];
const SIZE_KEYS = ["size", "size_name", "尺码", "规格", "码段"];
const SIZE_VALUE_KEYS = ["sizeValue", "size_value", "尺码值", "测量值", "数值", "值"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色号", "款色编码"];

export const HIGH_CONFIDENCE_SIZE_CHART_RULES = [
  ["衣长", ["衣长"]],
  ["裙长", ["裙长"]],
  ["肩宽", ["肩宽"]],
  ["胸围", ["胸围", "1/2胸围"]],
  ["裤长", ["裤长"]],
  ["腰围", ["全腰围（平量）", "腰围"]],
  ["臀围", ["臀围", "臀围（平量）"]],
  ["脚口", ["1/2脚口（平量）"]],
  ["裤口围", ["1/2脚口（平量）"]],
  ["下摆围", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]],
];

export const MEDIUM_CONFIDENCE_SIZE_CHART_RULES = [
  ["袖长", ["袖长", "内袖长", "里：袖长"]],
  ["袖口", ["1/2袖口（平量）", "里：1/2袖口（平量）", "1/2袖口"]],
  ["袖口围", ["1/2袖口（平量）", "里：1/2袖口（平量）", "1/2袖口"]],
  ["前档", ["前浪（弯量）"]],
  ["前裆", ["前浪（弯量）"]],
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
    .toLowerCase();
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
  const match = text.match(/^0*(\d{2,3})(?:cm)?$/i);
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

function derivedValueForMapping(mapping, size) {
  if (compactKey(mapping?.targetField) === compactKey("身高") && compactKey(mapping?.sourcePoint) === compactKey("尺码")) {
    return sizeLabelNumber(size) || "0";
  }
  return null;
}

export function buildSizeChartForTemplate({ rows = [], spuCode, template = {}, mappings: explicitMappings = [] } = {}) {
  const normalizedRows = normalizePlmSizeChartRows(rows)
    .filter((row) => !spuCode || row.spuCode === stringValue(spuCode));
  const targetFields = templateTargetFields(template);
  const mappingOverrides = explicitMappingLookup(explicitMappings, normalizedRows);
  const mappings = targetFields.map((targetField) => (
    mappingOverrides.get(compactKey(targetField)) ?? resolveMapping(targetField, normalizedRows)
  ));
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

  const valueJson = {};
  if (mappings.length > 0 && sizes.size > 0) {
    valueJson.title = mappings.map((mapping) => mapping.targetField).join(",");
    for (const size of sortSizes(sizes)) {
      const values = mappings.map((mapping) => {
        const derivedValue = derivedValueForMapping(mapping, size);
        if (derivedValue != null) return derivedValue;
        return mapping.sourcePoint
          ? valueByPointAndSize.get(`${compactKey(mapping.sourcePoint)}\u0000${size}`) ?? "0"
          : "0";
      });
      valueJson[size] = values.join(",");
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
