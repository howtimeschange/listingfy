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

test("parseProductArchiveFieldRuleRows normalizes manual, skip, fixed, launch plan, and copywriting rules", () => {
  const rules = parseProductArchiveFieldRuleRows([
    {
      "深绘字段": "产品标题",
      "对应表格": "文案表",
      "对应字段": "搜索标题",
      "是否能MDM导入": "否",
    },
    {
      "深绘字段": "货号",
      "对应表格": "上市计划表",
      "对应字段": "款号",
      "是否能MDM导入": "是",
    },
    {
      "深绘字段": "适用平台",
      "对应表格": "固定",
      "对应字段": "天猫",
      "字段类型": "可提取字段",
    },
    {
      "深绘字段": "兼容平台",
      "对应表格": "固定",
      "对应字段": "",
      "备注": "1688、天猫、京东",
    },
    {
      "深绘字段": "模特信息",
      "对应表格": "人为判断",
      "对应字段": "判断",
    },
    {
      "深绘字段": "无需填写字段",
      "对应表格": "不填",
      "对应字段": "不填",
    },
    {
      "深绘字段": "可选字段",
      "对应表格": "可不填",
    },
  ]);

  assert.deepEqual(rules.map((rule) => ({
    deepdrawField: rule.deepdrawField,
    sourceType: rule.sourceType,
    sourceField: rule.sourceField,
    defaultValue: rule.defaultValue,
    blocking: rule.blocking,
  })), [
    {
      deepdrawField: "产品标题",
      sourceType: "copywriting",
      sourceField: "搜索标题",
      defaultValue: null,
      blocking: false,
    },
    {
      deepdrawField: "货号",
      sourceType: "launch_plan",
      sourceField: "款号",
      defaultValue: null,
      blocking: false,
    },
    {
      deepdrawField: "适用平台",
      sourceType: "fixed",
      sourceField: null,
      defaultValue: "天猫",
      blocking: false,
    },
    {
      deepdrawField: "兼容平台",
      sourceType: "fixed",
      sourceField: null,
      defaultValue: "1688、天猫、京东",
      blocking: false,
    },
    {
      deepdrawField: "模特信息",
      sourceType: "manual",
      sourceField: null,
      defaultValue: null,
      blocking: false,
    },
    {
      deepdrawField: "无需填写字段",
      sourceType: "skip",
      sourceField: null,
      defaultValue: null,
      blocking: false,
    },
    {
      deepdrawField: "可选字段",
      sourceType: "skip",
      sourceField: null,
      defaultValue: null,
      blocking: false,
    },
  ]);
});

test("parseProductArchiveFieldRuleRows treats fixed source field names as source references", () => {
  const rules = parseProductArchiveFieldRuleRows([
    {
      "深绘字段": "京东市场价",
      "对应表格": "固定",
      "对应字段": "吊牌价格",
      "字段类型": "可提取字段",
    },
    {
      "深绘字段": "微信视频小店标题",
      "对应表格": "固定",
      "对应字段": "内容平台标题",
      "字段类型": "可提取字段",
    },
    {
      "深绘字段": "适用平台",
      "对应表格": "固定",
      "对应字段": "天猫",
      "字段类型": "可提取字段",
    },
  ]);

  assert.deepEqual(rules.map((rule) => ({
    deepdrawField: rule.deepdrawField,
    sourceType: rule.sourceType,
    sourceField: rule.sourceField,
    defaultValue: rule.defaultValue,
  })), [
    {
      deepdrawField: "京东市场价",
      sourceType: "launch_plan",
      sourceField: "吊牌价格",
      defaultValue: null,
    },
    {
      deepdrawField: "微信视频小店标题",
      sourceType: "copywriting",
      sourceField: "内容平台标题",
      defaultValue: null,
    },
    {
      deepdrawField: "适用平台",
      sourceType: "fixed",
      sourceField: null,
      defaultValue: "天猫",
    },
  ]);
});

test("parseProductArchiveFieldRuleRows infers local workbook and fixed-value rows when table cells are sparse", () => {
  const rules = parseProductArchiveFieldRuleRows([
    {
      "深绘字段": "微信视频小店标题",
      "对应表格": "",
      "对应字段": "内容平台标题",
      "是否能MDM导入": "本地表格",
    },
    {
      "深绘字段": "是否可定制",
      "对应表格": "不可定制",
      "是否能MDM导入": "固定",
    },
    {
      "深绘字段": "售后服务承诺",
      "对应表格": "不设置",
      "是否能MDM导入": "不填",
    },
  ]);

  assert.deepEqual(rules.map((rule) => ({
    deepdrawField: rule.deepdrawField,
    sourceType: rule.sourceType,
    sourceField: rule.sourceField,
    defaultValue: rule.defaultValue,
    blocking: rule.blocking,
  })), [
    {
      deepdrawField: "微信视频小店标题",
      sourceType: "copywriting",
      sourceField: "内容平台标题",
      defaultValue: null,
      blocking: false,
    },
    {
      deepdrawField: "是否可定制",
      sourceType: "fixed",
      sourceField: null,
      defaultValue: "不可定制",
      blocking: false,
    },
    {
      deepdrawField: "售后服务承诺",
      sourceType: "fixed",
      sourceField: null,
      defaultValue: "不设置",
      blocking: false,
    },
  ]);
});

test("parseProductArchiveFieldRuleRows detects real headers below duplicate workbook title columns", () => {
  const rules = parseProductArchiveFieldRuleRows([
    {
      "Column 1": "",
      "深绘字段对应关系整理": "深绘字段",
      "深绘字段对应关系整理 2": "对应表格",
      "深绘字段对应关系整理 3": "对应字段",
      "深绘字段对应关系整理 4": "字段类型",
      "深绘字段对应关系整理 5": "是否能MDM导入",
      "深绘字段对应关系整理 6": "备注",
    },
    {
      "Column 1": "通用字段",
      "深绘字段对应关系整理": "产品标题",
      "深绘字段对应关系整理 2": "文案表",
      "深绘字段对应关系整理 3": "搜索标题",
      "深绘字段对应关系整理 4": "可提取字段",
      "深绘字段对应关系整理 5": "本地表格",
      "深绘字段对应关系整理 6": "上市计划表也在云盘",
    },
  ]);

  assert.equal(rules.length, 1);
  assert.equal(rules[0].deepdrawField, "产品标题");
  assert.equal(rules[0].sourceType, "copywriting");
  assert.equal(rules[0].sourceField, "搜索标题");
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

test("normalizeProductArchiveSourceRows accepts 326 launch plan template headers beyond visible columns", () => {
  const rows = normalizeProductArchiveSourceRows("launch_plan", normalizeSpreadsheetRows([
    {
      "Column 1": "细节差异/产品规格差异/推荐岁段",
      "Column 33": "买手",
    },
    {
      "Column 1": "上新模块",
      "Column 20": "商品基础信息",
      "Column 57": "上市规划",
      "Column 70": "运营模块",
    },
    {
      "Column 20": "产品季",
      "Column 21": "大货款号",
      "Column 27": "款色号",
      "Column 41": "性别",
      "Column 42": "品类",
      "Column 43": "小类",
      "Column 44": "颜色名称",
      "Column 62": "内容上市时间",
      "Column 63": "搜索上市时间",
      "Column 72": "发布类目 (官方)",
      "Column 73": "发布类目 (唯品)",
      "Column 74": "主款式 （唯品四级品类）",
      "Column 75": "发布类目 (抖音)",
    },
    {
      "Column 20": "326",
      "Column 21": "200326105103",
      "Column 27": "20032610510300334",
      "Column 41": "男",
      "Column 42": "便服",
      "Column 43": "梭织便服",
      "Column 44": "黄绿色调00334",
      "Column 62": "2026/7/3",
      "Column 63": "2026/7/3",
      "Column 72": "童装/婴儿装/亲子装>>外套/夹克/大衣>>普通外套",
      "Column 73": "婴幼外套",
      "Column 74": "外套",
      "Column 75": "服饰内衣>童装>外套",
    },
  ]));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].spuCode, "200326105103");
  assert.equal(rows[0].skcCode, "20032610510300334");
  assert.equal(rows[0].rowJson["官方发布类目"], "童装/婴儿装/亲子装>>外套/夹克/大衣>>普通外套");
  assert.equal(rows[0].rowJson["发布类目 (唯品)"], "婴幼外套");
  assert.equal(rows[0].rowJson["主款式 （唯品四级品类）"], "外套");
  assert.equal(rows[0].rowJson["发布类目 (抖音)"], "服饰内衣>童装>外套");
});

test("normalizeProductArchiveSourceRows converts Excel serial numbers for launch date fields", () => {
  const rows = normalizeProductArchiveSourceRows("launch_plan", normalizeSpreadsheetRows([
    {
      "Column 21": "大货款号",
      "Column 27": "款色号",
      "Column 58": "上市时间",
      "Column 62": "内容上市时间",
      "Column 63": "搜索上市时间",
    },
    {
      "Column 21": "200326105103",
      "Column 27": "20032610510300334",
      "Column 58": 46206,
      "Column 62": 46206,
      "Column 63": 46206,
    },
  ]));

  assert.equal(rows[0].rowJson["上市时间"], "2026-07-03");
  assert.equal(rows[0].rowJson["内容上市时间"], "2026-07-03");
  assert.equal(rows[0].rowJson["搜索上市时间"], "2026-07-03");
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
