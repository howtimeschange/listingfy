import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
} from "./product_archive_source_importer.mjs";

test("parseProductArchiveFieldRuleRows maps field mapping rows into blocking source rules", () => {
  const rules = parseProductArchiveFieldRuleRows([
    {
      "深绘字段": "Product.title",
      "来源类型": "copywriting",
      "来源字段": "搜索标题",
      "必填": "是",
      "备注": "标准文案标题",
    },
    {
      "深绘字段": "材质",
      "来源类型": "fixed",
      "固定值": "棉",
      "必填": "否",
    },
  ]);

  assert.deepEqual(rules, [
    {
      deepdrawField: "Product.title",
      sourceType: "copywriting",
      sourceTable: null,
      sourceField: "搜索标题",
      defaultValue: null,
      transformRule: {},
      blocking: true,
      notes: "标准文案标题",
    },
    {
      deepdrawField: "材质",
      sourceType: "fixed",
      sourceTable: null,
      sourceField: null,
      defaultValue: "棉",
      transformRule: {},
      blocking: false,
      notes: null,
    },
  ]);
});

test("normalizeProductArchiveSourceRows keeps launch plan and copywriting rows keyed by SPU/SKC", () => {
  const rows = normalizeProductArchiveSourceRows("copywriting", [
    {
      "款号": "208226102001",
      "款色": "20822610200100311",
      "搜索标题": "夏季儿童短袖",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceType, "copywriting");
  assert.equal(rows[0].spuCode, "208226102001");
  assert.equal(rows[0].skcCode, "20822610200100311");
  assert.deepEqual(rows[0].rowJson, {
    "款号": "208226102001",
    "款色": "20822610200100311",
    "搜索标题": "夏季儿童短袖",
  });
});
