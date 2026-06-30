const FIELD_ALIASES = {
  deepdrawField: ["deepdrawField", "deepdraw_field", "深绘字段", "目标字段", "字段名"],
  sourceType: ["sourceType", "source_type", "来源类型", "来源", "对应表格"],
  sourceTable: ["sourceTable", "source_table", "来源表", "来源文件", "对应表格"],
  sourceField: ["sourceField", "source_field", "来源字段", "字段来源", "源字段", "对应字段"],
  defaultValue: ["defaultValue", "default_value", "固定值", "默认值"],
  blocking: ["blocking", "required", "必填", "是否必填", "阻断"],
  notes: ["notes", "备注", "说明"],
  importability: ["是否能MDM导入", "是否能 MDM 导入", "MDM导入", "来源说明"],
};

const SPU_KEYS = ["spuCode", "spu_code", "款号", "大货款号", "货号", "商品编码", "Product.code"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色号", "款色编码", "颜色编码"];
const ALLOWED_SOURCE_TYPES = new Set(["mdm", "launch_plan", "copywriting", "fixed", "manual", "skip"]);
const FIXED_LITERAL_VALUES = new Set(["不设置", "不可定制"]);
const LAUNCH_PLAN_FIELD_HINTS = new Set(["款号", "大货款号", "货号", "吊牌价", "吊牌价格", "核算吊牌价", "挂牌单价", "颜色", "颜色名称", "上市时间", "内容上市时间", "搜索上市时间", "产品季", "对应日期", "官方发布类目"]);
const COPYWRITING_FIELD_HINTS = new Set(["搜索标题", "商品标题", "标题", "唯品标题", "内容平台标题", "内容标题", "导购标题", "推荐理由", "面料成分", "材质成分", "面料名称", "面料文案", "面料三个关键词", "细节文案", "主图4第1句", "主图4第2-3句", "面料名称-面料文案*面料三个关键词", "柔软度", "厚薄", "弹性", "去掉巴拉巴拉"]);
const HEADER_HINTS = new Set([
  "深绘字段",
  "来源类型",
  "来源字段",
  "必填",
  "固定值",
  "默认值",
  "备注",
  "对应表格",
  "对应字段",
  "字段类型",
  "款号",
  "大货款号",
  "款色",
  "款色号",
  "发布类目",
  "官方发布类目",
  "搜索标题",
  "唯品标题",
  "内容平台标题",
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

function dateFieldKey(value) {
  return /日期|时间|货期|上市/.test(stringValue(value));
}

function excelSerialDateText(value) {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{5}(?:\.\d+)?$/.test(value.trim())
      ? Number(value)
      : NaN;
  if (!Number.isFinite(number) || number < 20_000 || number > 80_000) return "";
  const utc = Date.UTC(1899, 11, 30) + Math.round(number) * 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function fieldStringValue(key, value) {
  if (dateFieldKey(key)) return excelSerialDateText(value) || stringValue(value);
  return stringValue(value);
}

function compactKey(value) {
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase();
}

function normalizeHeaderName(value) {
  const text = stringValue(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const compact = compactKey(text);
  const aliases = {
    "款号": "款号",
    "大货款号": "大货款号",
    "款色": "款色",
    "款色号": "款色号",
    "发布类目官方": "官方发布类目",
    "官方发布类目": "官方发布类目",
    "内容上市时间": "内容上市时间",
    "搜索上市时间": "搜索上市时间",
    "搜索标题": "搜索标题",
    "唯品标题": "唯品标题",
    "内容平台标题": "内容平台标题",
    "导购标题品牌+品类+性别+款式+风格+季节": "导购标题",
  };
  return aliases[compact] ?? text;
}

function sourceReferenceField(value) {
  const text = stringValue(value)
    .replace(/^(固定|默认|取|读取|来自)\s*/i, "")
    .replace(/^mdm\s*/i, "")
    .trim();
  return normalizeHeaderName(text);
}

function sourceReference(value) {
  const sourceField = sourceReferenceField(value);
  if (!sourceField) return null;
  if (LAUNCH_PLAN_FIELD_HINTS.has(sourceField)) return { sourceType: "launch_plan", sourceField };
  if (COPYWRITING_FIELD_HINTS.has(sourceField)) return { sourceType: "copywriting", sourceField };
  return null;
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

function sourceTypeValue(value) {
  const text = stringValue(value).toLowerCase();
  const compact = compactKey(value);
  const normalized = {
    mdm: "mdm",
    "主数据": "mdm",
    launch_plan: "launch_plan",
    launch: "launch_plan",
    "上市计划": "launch_plan",
    "上市计划表": "launch_plan",
    copywriting: "copywriting",
    copy: "copywriting",
    "标准文案": "copywriting",
    "标准文案表": "copywriting",
    "文案": "copywriting",
    "文案表": "copywriting",
    fixed: "fixed",
    "固定": "fixed",
    manual: "manual",
    "人工": "manual",
    "人工判断": "manual",
    "人为判断": "manual",
    "判断": "manual",
    skip: "skip",
    "跳过": "skip",
    "不填": "skip",
    "可不填": "skip",
    "无需填写": "skip",
    "无": "skip",
  }[text] ?? {
    "主数据": "mdm",
    "上市计划": "launch_plan",
    "上市计划表": "launch_plan",
    "标准文案": "copywriting",
    "标准文案表": "copywriting",
    "文案": "copywriting",
    "文案表": "copywriting",
    "固定": "fixed",
    "人工": "manual",
    "人工判断": "manual",
    "人为判断": "manual",
    "判断": "manual",
    "不填": "skip",
    "可不填": "skip",
    "无需填写": "skip",
  }[compact] ?? text;
  return ALLOWED_SOURCE_TYPES.has(normalized) ? normalized : "manual";
}

function inferredSourceType(rawSourceType, rawSourceField, importability) {
  const sourceType = sourceTypeValue(rawSourceType);
  const sourceField = normalizeHeaderName(rawSourceField);
  const mdmFlag = stringValue(importability);
  const reference = sourceReference(rawSourceField);
  if (sourceType === "fixed" && reference) return reference.sourceType;
  if (sourceType !== "manual") return sourceType;
  if (FIXED_LITERAL_VALUES.has(stringValue(rawSourceType)) || mdmFlag.includes("固定")) return "fixed";
  if (mdmFlag.includes("本地表格") || mdmFlag.includes("云盘")) {
    if (LAUNCH_PLAN_FIELD_HINTS.has(sourceField)) return "launch_plan";
    if (COPYWRITING_FIELD_HINTS.has(sourceField)) return "copywriting";
    if (sourceField) return "copywriting";
  }
  return sourceType;
}

function cleanRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    const normalizedKey = normalizeHeaderName(key);
    if (!normalizedKey) continue;
    const text = fieldStringValue(normalizedKey, value);
    if (text) output[normalizedKey] = text;
  }
  return output;
}

function headerScore(row) {
  let score = 0;
  for (const value of Object.values(row ?? {})) {
    const normalized = normalizeHeaderName(value);
    if (!normalized) continue;
    if (HEADER_HINTS.has(normalized)) score += 2;
    if ([...HEADER_HINTS].some((hint) => normalized.includes(hint))) score += 1;
  }
  return score;
}

function keyHeaderScore(row) {
  let score = 0;
  for (const key of Object.keys(row ?? {})) {
    const normalized = normalizeHeaderName(key);
    if (!normalized) continue;
    if (HEADER_HINTS.has(normalized)) score += 2;
  }
  return score;
}

export function normalizeSpreadsheetRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (keyHeaderScore(rows[0]) >= 2) {
    return rows.map(cleanRow).filter((row) => Object.keys(row).length > 0);
  }
  let headerIndex = -1;
  let bestScore = 0;
  rows.slice(0, 12).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });
  if (headerIndex < 0 || bestScore < 2) return rows.map(cleanRow).filter((row) => Object.keys(row).length > 0);

  const headerRow = rows[headerIndex] ?? {};
  const headers = Object.entries(headerRow).map(([key, value]) => [
    key,
    normalizeHeaderName(value) || normalizeHeaderName(key),
  ]);
  return rows.slice(headerIndex + 1)
    .map((row) => {
      const output = {};
      for (const [originalKey, header] of headers) {
        if (!header) continue;
        const value = stringValue(row?.[originalKey]);
        if (value) output[header] = value;
      }
      return cleanRow(output);
    })
    .filter((row) => Object.keys(row).length > 0);
}

export function parseProductArchiveFieldRuleRows(rows = []) {
  return normalizeSpreadsheetRows(rows)
    .map((row) => {
      const deepdrawField = firstValue(row, FIELD_ALIASES.deepdrawField);
      if (!deepdrawField) return null;
      const sourceType = sourceTypeValue(firstValue(row, FIELD_ALIASES.sourceType));
      const rawImportability = firstValue(row, FIELD_ALIASES.importability);
      const notes = firstValue(row, FIELD_ALIASES.notes) || null;
      const rawSourceField = firstValue(row, FIELD_ALIASES.sourceField);
      const rawDefaultValue = firstValue(row, FIELD_ALIASES.defaultValue);
      const reference = sourceReference(rawSourceField) ?? sourceReference(rawDefaultValue);
      const resolvedSourceType = inferredSourceType(firstValue(row, FIELD_ALIASES.sourceType), rawSourceField || rawDefaultValue, rawImportability);
      const sourceField = ["fixed", "manual", "skip"].includes(resolvedSourceType)
        ? null
        : (reference?.sourceField ?? rawSourceField) || null;
      const defaultValue = resolvedSourceType === "fixed"
        ? rawDefaultValue || rawSourceField || notes || (FIXED_LITERAL_VALUES.has(firstValue(row, FIELD_ALIASES.sourceType)) ? firstValue(row, FIELD_ALIASES.sourceType) : null)
        : rawDefaultValue || null;
      return {
        deepdrawField,
        sourceType: resolvedSourceType,
        sourceTable: firstValue(row, FIELD_ALIASES.sourceTable) || null,
        sourceField,
        defaultValue,
        transformRule: {},
        blocking: resolvedSourceType === "skip" ? false : booleanValue(firstValue(row, FIELD_ALIASES.blocking), false),
        notes,
      };
    })
    .filter(Boolean);
}

export function normalizeProductArchiveSourceRows(sourceType, rows = []) {
  const normalizedSourceType = sourceTypeValue(sourceType);
  return normalizeSpreadsheetRows(rows)
    .map((row) => {
      const rowJson = cleanRow(row);
      const spuCode = firstValue(rowJson, SPU_KEYS);
      if (!spuCode) return null;
      return {
        sourceType: normalizedSourceType,
        spuCode,
        skcCode: firstValue(rowJson, SKC_KEYS) || null,
        rowJson,
      };
    })
    .filter(Boolean);
}
