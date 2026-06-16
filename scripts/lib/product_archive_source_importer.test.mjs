import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
  normalizeSpreadsheetRows,
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

test("parseProductArchiveFieldRuleRows accepts DeepDraw field mapping workbook headers", () => {
  const rawRows = normalizeSpreadsheetRows([
    {
      "Unnamed: 0": "",
      "深绘字段对应关系整理": "深绘字段",
      "Unnamed: 2": "对应表格",
      "Unnamed: 3": "对应字段",
      "Unnamed: 4": "字段类型",
      "Unnamed: 5": "是否能MDM导入",
      "Unnamed: 6": "备注",
    },
    {
      "Unnamed: 0": "通用字段",
      "深绘字段对应关系整理": "产品分类",
      "Unnamed: 2": "上市计划表",
      "Unnamed: 3": "官方发布类目",
      "Unnamed: 4": "可提取字段",
      "Unnamed: 5": "是",
      "Unnamed: 6": "MDM导入的有错，不准确，后续需要人工检查",
    },
    {
      "深绘字段对应关系整理": "兼容平台",
      "Unnamed: 2": "固定",
      "Unnamed: 4": "可提取字段",
      "Unnamed: 5": "固定",
      "Unnamed: 6": "1688、天猫、京东",
    },
  ]);
  const rules = parseProductArchiveFieldRuleRows(rawRows);

  assert.equal(rules[0].deepdrawField, "产品分类");
  assert.equal(rules[0].sourceType, "launch_plan");
  assert.equal(rules[0].sourceField, "官方发布类目");
  assert.equal(rules[1].deepdrawField, "兼容平台");
  assert.equal(rules[1].sourceType, "fixed");
  assert.equal(rules[1].defaultValue, "1688、天猫、京东");
});

test("normalizeProductArchiveSourceRows accepts launch plan workbook headers", () => {
  const rows = normalizeProductArchiveSourceRows("launch_plan", normalizeSpreadsheetRows([
    {
      "细节差异/产品规格差异/推荐岁段": "产品备注（含电子产品）",
      "Unnamed: 19": "大货款号",
      "Unnamed: 25": "款色号",
      "Unnamed: 70": "发布类目\n(官方)",
      "Unnamed: 60": "内容上市时间",
    },
    {
      "Unnamed: 19": "209326133201",
      "Unnamed: 25": "20932613320100311",
      "Unnamed: 70": "童装/婴儿装/亲子装>>连身衣/爬服/哈衣",
      "Unnamed: 60": "2025-12-26",
    },
  ]));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].spuCode, "209326133201");
  assert.equal(rows[0].skcCode, "20932613320100311");
  assert.equal(rows[0].rowJson["官方发布类目"], "童装/婴儿装/亲子装>>连身衣/爬服/哈衣");
  assert.equal(rows[0].rowJson["内容上市时间"], "2025-12-26");
});

test("normalizeProductArchiveSourceRows accepts standard copywriting workbook headers", () => {
  const rows = normalizeProductArchiveSourceRows("copywriting", [
    {
      "  款号     ": "208126108011",
      "款色": "20812610801100311",
      "FAB": "轻薄透气",
      "搜索标题": "儿童长裤春秋款",
      "唯品标题": "巴拉巴拉儿童长裤",
      "内容平台标题": "中大童日常长裤",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].spuCode, "208126108011");
  assert.equal(rows[0].skcCode, "20812610801100311");
  assert.equal(rows[0].rowJson["搜索标题"], "儿童长裤春秋款");
  assert.equal(rows[0].rowJson["FAB"], "轻薄透气");
});
