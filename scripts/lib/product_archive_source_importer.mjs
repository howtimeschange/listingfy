const FIELD_ALIASES = {
  deepdrawField: ["deepdrawField", "deepdraw_field", "深绘字段", "目标字段", "字段名"],
  sourceType: ["sourceType", "source_type", "来源类型", "来源"],
  sourceTable: ["sourceTable", "source_table", "来源表", "来源文件"],
  sourceField: ["sourceField", "source_field", "来源字段", "字段来源", "源字段"],
  defaultValue: ["defaultValue", "default_value", "固定值", "默认值"],
  blocking: ["blocking", "required", "必填", "是否必填", "阻断"],
  notes: ["notes", "备注", "说明"],
};

const SPU_KEYS = ["spuCode", "spu_code", "款号", "货号", "商品编码", "Product.code"];
const SKC_KEYS = ["skcCode", "skc_code", "款色", "款色编码", "颜色编码"];
const ALLOWED_SOURCE_TYPES = new Set(["mdm", "launch_plan", "copywriting", "fixed", "manual", "skip"]);

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
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
    copywriting: "copywriting",
    copy: "copywriting",
    "标准文案": "copywriting",
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
    const normalizedKey = stringValue(key);
    if (!normalizedKey) continue;
    const text = stringValue(value);
    if (text) output[normalizedKey] = text;
  }
  return output;
}

export function parseProductArchiveFieldRuleRows(rows = []) {
  return rows
    .map((row) => {
      const deepdrawField = firstValue(row, FIELD_ALIASES.deepdrawField);
      if (!deepdrawField) return null;
      const sourceType = sourceTypeValue(firstValue(row, FIELD_ALIASES.sourceType));
      const defaultValue = firstValue(row, FIELD_ALIASES.defaultValue) || null;
      return {
        deepdrawField,
        sourceType,
        sourceTable: firstValue(row, FIELD_ALIASES.sourceTable) || null,
        sourceField: firstValue(row, FIELD_ALIASES.sourceField) || null,
        defaultValue,
        transformRule: {},
        blocking: booleanValue(firstValue(row, FIELD_ALIASES.blocking), true),
        notes: firstValue(row, FIELD_ALIASES.notes) || null,
      };
    })
    .filter(Boolean);
}

export function normalizeProductArchiveSourceRows(sourceType, rows = []) {
  const normalizedSourceType = sourceTypeValue(sourceType);
  return rows
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
