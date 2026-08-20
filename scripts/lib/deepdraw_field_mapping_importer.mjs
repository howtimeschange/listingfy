import { normalizeSpreadsheetRows } from "./product_archive_source_importer.mjs";

const FIELD_ALIASES = {
  fieldDomainType: ["fieldDomainType", "field_domain_type", "字段域类型", "字段域", "字段分组", "字段范围", "Column 1"],
  deepdrawField: ["deepdrawField", "deepdraw_field", "深绘字段", "目标字段", "字段名"],
  fieldSource: ["fieldSource", "field_source", "字段来源", "对应表格", "来源表", "来源文件", "sourceTable", "source_table"],
  mappedField: ["mappedField", "mapped_field", "对应字段", "来源字段", "源字段", "sourceField", "source_field"],
  defaultValue: ["defaultValue", "default_value", "固定值", "默认值"],
  fieldType: ["fieldType", "field_type", "字段类型"],
  importability: ["importability", "是否能MDM导入", "是否能 MDM 导入", "MDM导入", "来源说明"],
  notes: ["notes", "备注", "说明"],
  blocking: ["blocking", "required", "必填", "是否必填", "阻断"],
};

const LAUNCH_PLAN_FIELD_HINTS = new Set([
  "款号",
  "大货款号",
  "货号",
  "官方发布类目",
  "发布类目",
  "发布类目 (官方)",
  "发布类目(官方)",
  "上市时间",
  "内容上市时间",
  "搜索上市时间",
  "产品季",
  "吊牌价格",
  "吊牌价",
  "核算吊牌价",
  "挂牌单价",
  "颜色",
  "颜色名称",
  "对应日期",
]);

const COPYWRITING_FIELD_HINTS = new Set([
  "搜索标题",
  "商品标题",
  "标题",
  "唯品标题",
  "内容平台标题",
  "导购标题",
  "推荐理由",
  "面料成分",
  "材质成分",
  "面料文案",
  "面料名称",
  "面料三个关键词",
  "主图4第1句",
  "主图4第2-3句",
  "面料名称-面料文案*面料三个关键词",
  "去掉巴拉巴拉",
  "厚薄",
  "弹性",
]);

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
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

function normalizeDeepdrawHeader(value) {
  const text = stringValue(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const compact = compactKey(text);
  const aliases = {
    "字段域类型": "字段域类型",
    "字段域": "字段域类型",
    "字段分组": "字段域类型",
    "深绘字段": "深绘字段",
    "字段来源": "字段来源",
    "对应表格": "字段来源",
    "来源表": "字段来源",
    "对应字段": "对应字段",
    "来源字段": "对应字段",
    "字段类型": "字段类型",
    "是否能mdm导入": "是否能MDM导入",
    "mdm导入": "是否能MDM导入",
    "备注": "备注",
  };
  return aliases[compact] ?? text;
}

function sourceReferenceField(value) {
  const text = stringValue(value)
    .replace(/^(固定|默认|取|读取|来自)\s*/i, "")
    .replace(/^mdm\s*/i, "")
    .trim();
  return normalizeDeepdrawHeader(text);
}

function sourceReference(value) {
  const sourceField = sourceReferenceField(value);
  if (!sourceField) return null;
  if (LAUNCH_PLAN_FIELD_HINTS.has(sourceField)) return { sourceType: "launch_plan", sourceField };
  if (COPYWRITING_FIELD_HINTS.has(sourceField)) return { sourceType: "copywriting", sourceField };
  return null;
}

function rowHeaderScore(row) {
  let score = 0;
  for (const value of Object.values(row ?? {})) {
    const header = normalizeDeepdrawHeader(value);
    if (["深绘字段", "字段来源", "对应字段", "字段类型", "是否能MDM导入", "备注"].includes(header)) {
      score += 1;
    }
  }
  return score;
}

function normalizeDeepdrawRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  let headerIndex = -1;
  let bestScore = 0;
  rows.slice(0, 12).forEach((row, index) => {
    const score = rowHeaderScore(row);
    if (score > bestScore) {
      headerIndex = index;
      bestScore = score;
    }
  });
  if (headerIndex < 0 || bestScore < 2) return normalizeSpreadsheetRows(rows);

  const headerRow = rows[headerIndex] ?? {};
  const headers = Object.entries(headerRow)
    .map(([key, value]) => [key, normalizeDeepdrawHeader(value) || normalizeDeepdrawHeader(key)])
    .filter(([, header]) => header);
  const hasDomainHeader = headers.some(([, header]) => header === "字段域类型");

  return rows.slice(headerIndex + 1)
    .map((row) => {
      const output = {};
      if (!hasDomainHeader) {
        const domainType = stringValue(row?.["Column 1"] ?? row?.["Unnamed: 0"]);
        if (domainType) output["字段域类型"] = domainType;
      }
      for (const [originalKey, header] of headers) {
        const value = stringValue(row?.[originalKey]);
        if (value) output[header] = value;
      }
      return output;
    })
    .filter((row) => Object.keys(row).length > 0);
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) return value;
  }
  return "";
}

function booleanValue(value, fallback = false) {
  const text = stringValue(value).toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "y", "是", "必填", "阻断"].includes(text)) return true;
  if (["0", "false", "no", "n", "否", "非必填", "不阻断"].includes(text)) return false;
  return fallback;
}

function sourceTypeFromText(value) {
  const text = stringValue(value);
  const compact = compactKey(text);
  if (!text) return "";
  if (compact.includes("上市计划")) return "launch_plan";
  if (compact.includes("标准文案") || compact.includes("文案表") || compact === "文案") return "copywriting";
  if (compact.includes("固定")) return "fixed";
  if (compact.includes("人为判断") || compact.includes("人工判断") || compact === "判断" || compact === "manual") return "manual";
  if (compact.includes("不填") || compact.includes("可不填") || compact.includes("无需填写") || compact === "skip") return "skip";
  if (compact === "mdm" || compact.includes("主数据")) return "mdm";
  return "";
}

function inferSourceType({ fieldSource, mappedField, defaultValue, fieldType, importability }) {
  const sourceType = sourceTypeFromText(fieldSource);
  const reference = sourceReference(mappedField) ?? sourceReference(defaultValue);
  if (sourceType === "fixed" && reference) return reference.sourceType;
  if (sourceType) return sourceType;

  if (/需判断|人为判断|人工判断/.test(fieldType)) return "manual";
  if (/人为判断|人工判断/.test(importability)) return "manual";
  if (/^是/.test(importability) && !/开发中/.test(importability)) return "mdm";
  if (/本地表格|云盘/.test(importability)) {
    if (LAUNCH_PLAN_FIELD_HINTS.has(mappedField)) return "launch_plan";
    if (COPYWRITING_FIELD_HINTS.has(mappedField)) return "copywriting";
    return mappedField ? "copywriting" : "manual";
  }
  return "manual";
}

function fixedDefaultValue({ mappedField, notes }) {
  return stringValue(mappedField) || stringValue(notes) || null;
}

export function parseDeepdrawFieldMappingRows(rows = []) {
  const normalizedRows = normalizeDeepdrawRows(rows);
  let currentFieldDomainType = "";
  return normalizedRows
    .map((row) => {
      const fieldDomainType = firstValue(row, FIELD_ALIASES.fieldDomainType);
      if (fieldDomainType) currentFieldDomainType = fieldDomainType;
      const deepdrawField = firstValue(row, FIELD_ALIASES.deepdrawField);
      if (!deepdrawField || deepdrawField === "深绘字段") return null;

      const fieldSource = firstValue(row, FIELD_ALIASES.fieldSource) || null;
      const mappedField = firstValue(row, FIELD_ALIASES.mappedField) || null;
      const defaultValue = firstValue(row, FIELD_ALIASES.defaultValue);
      const fieldType = firstValue(row, FIELD_ALIASES.fieldType) || null;
      const importability = firstValue(row, FIELD_ALIASES.importability) || null;
      const notes = firstValue(row, FIELD_ALIASES.notes) || null;
      const reference = sourceReference(mappedField) ?? sourceReference(defaultValue);
      const sourceType = inferSourceType({
        fieldSource: fieldSource ?? "",
        mappedField: mappedField ?? "",
        defaultValue,
        fieldType: fieldType ?? "",
        importability: importability ?? "",
      });
      const sourceField = sourceType === "launch_plan" || sourceType === "copywriting"
        ? reference?.sourceField ?? mappedField
        : sourceType === "mdm"
          ? mappedField || fieldSource
          : null;
      const resolvedDefaultValue = sourceType === "fixed"
        ? defaultValue || fixedDefaultValue({ mappedField, notes })
        : defaultValue || null;
      const blocking = sourceType === "skip"
        ? false
        : booleanValue(firstValue(row, FIELD_ALIASES.blocking), false);

      return {
        fieldDomainType: currentFieldDomainType || "通用字段",
        deepdrawField,
        fieldSource,
        mappedField,
        sourceType,
        sourceTable: fieldSource,
        sourceField,
        defaultValue: resolvedDefaultValue,
        fieldType,
        importability,
        blocking,
        enabled: true,
        notes,
        rawRowJson: row,
      };
    })
    .filter(Boolean);
}
