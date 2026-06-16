const FIELD_ALIASES = {
  deepdrawField: ["deepdrawField", "deepdraw_field", "深绘字段", "目标字段", "字段名"],
  sourceType: ["sourceType", "source_type", "来源类型", "来源", "对应表格"],
  sourceTable: ["sourceTable", "source_table", "来源表", "来源文件", "对应表格"],
  sourceField: ["sourceField", "source_field", "来源字段", "字段来源", "源字段", "对应字段"],
  defaultValue: ["defaultValue", "default_value", "固定值", "默认值"],
  blocking: ["blocking", "required", "必填", "是否必填", "阻断"],
  notes: ["notes", "备注", "说明"],
};

const SPU_KEYS = ["spuCode", "spu_code", "款号", "大货款号", "货号", "商品编码", "Product.code"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色号", "款色编码", "颜色编码"];
const ALLOWED_SOURCE_TYPES = new Set(["mdm", "launch_plan", "copywriting", "fixed", "manual", "skip"]);
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
  return "";
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
    fixed: "fixed",
    "固定": "fixed",
    manual: "manual",
    "人工": "manual",
    skip: "skip",
    "跳过": "skip",
  }[text] ?? text;
  return ALLOWED_SOURCE_TYPES.has(normalized) ? normalized : "manual";
}

function cleanRow(row) {
  const output = {};
  for (const [key, value] of Object.entries(row ?? {})) {
    const normalizedKey = normalizeHeaderName(key);
    if (!normalizedKey) continue;
    const text = stringValue(value);
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
    if ([...HEADER_HINTS].some((hint) => normalized.includes(hint))) score += 1;
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
      const notes = firstValue(row, FIELD_ALIASES.notes) || null;
      const defaultValue = firstValue(row, FIELD_ALIASES.defaultValue) || (sourceType === "fixed" ? notes : null);
      return {
        deepdrawField,
        sourceType,
        sourceTable: firstValue(row, FIELD_ALIASES.sourceTable) || null,
        sourceField: firstValue(row, FIELD_ALIASES.sourceField) || null,
        defaultValue,
        transformRule: {},
        blocking: booleanValue(firstValue(row, FIELD_ALIASES.blocking), true),
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
