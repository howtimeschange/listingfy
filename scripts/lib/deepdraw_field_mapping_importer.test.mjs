import assert from "node:assert/strict";
import test from "node:test";
import { parseDeepdrawFieldMappingRows } from "./deepdraw_field_mapping_importer.mjs";

test("parseDeepdrawFieldMappingRows maps the DeepDraw field relation workbook shape", () => {
  const rows = parseDeepdrawFieldMappingRows([
    {
      "Column 2": "深绘字段对应关系整理",
    },
    {
      "Column 2": "深绘字段",
      "Column 3": "对应表格",
      "Column 4": "对应字段",
      "Column 5": "字段类型",
      "Column 6": "是否能MDM导入",
      "Column 7": "备注",
    },
    {
      "Column 1": "通用字段",
      "Column 2": "产品分类",
      "Column 3": "上市计划表",
      "Column 4": "官方发布类目",
      "Column 5": "可提取字段",
      "Column 6": "是",
      "Column 7": "MDM导入的有错，不准确",
    },
    {
      "Column 2": "兼容平台",
      "Column 3": "固定",
      "Column 5": "可提取字段",
      "Column 6": "固定",
      "Column 7": "1688、天猫、京东、唯品会",
    },
    {
      "Column 2": "产品标题",
      "Column 3": "文案表",
      "Column 4": "搜索标题",
      "Column 5": "可提取字段",
      "Column 6": "本地表格",
    },
    {
      "Column 2": "模特实拍",
      "Column 5": "需判断字段",
      "Column 6": "人为判断",
      "Column 7": "机器人做不了的",
    },
  ]);

  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => [row.deepdrawField, row.sourceType, row.sourceField, row.defaultValue]), [
    ["产品分类", "launch_plan", "官方发布类目", null],
    ["兼容平台", "fixed", null, "1688、天猫、京东、唯品会"],
    ["产品标题", "copywriting", "搜索标题", null],
    ["模特实拍", "manual", null, null],
  ]);
  assert.equal(rows[3].blocking, true);
  assert.equal(rows[3].fieldType, "需判断字段");
  assert.equal(rows[3].importability, "人为判断");
});

test("parseDeepdrawFieldMappingRows keeps v2 field source, mapped field, and domain semantics separate", () => {
  const rows = parseDeepdrawFieldMappingRows([
    {
      "Column 2": "深绘字段对应关系整理",
    },
    {
      "Column 2": "深绘字段",
      "Column 3": "字段来源",
      "Column 4": "对应字段",
      "Column 5": "字段类型",
      "Column 6": "是否能MDM导入",
      "Column 7": "备注",
    },
    {
      "Column 1": "通用字段",
      "Column 2": "产品分类",
      "Column 3": "上市计划表",
      "Column 4": "官方发布类目",
      "Column 5": "可提取字段",
      "Column 6": "是",
      "Column 7": "MDM导入的有错，不准确",
    },
    {
      "Column 2": "兼容平台",
      "Column 3": "固定",
      "Column 4": "1688、天猫、京东",
      "Column 5": "可提取字段",
      "Column 6": "固定",
    },
    {
      "Column 2": "产品标题",
      "Column 3": "文案表",
      "Column 4": "搜索标题",
      "Column 5": "可提取字段",
      "Column 6": "本地表格",
    },
    {
      "Column 2": "选择期数",
      "Column 3": "对应日期",
      "Column 5": "可提取字段",
      "Column 6": "是",
    },
    {
      "Column 2": "尺码表",
      "Column 3": "制单",
      "Column 4": "尺码",
      "Column 5": "可提取字段",
      "Column 6": "是，开发中",
    },
    {
      "Column 2": "模特实拍",
      "Column 5": "需判断字段",
      "Column 6": "人为判断",
    },
    {
      "Column 1": "鞋品字段",
      "Column 2": "鞋子模板类型",
      "Column 3": "固定",
      "Column 4": "通用鞋品尺码表",
      "Column 5": "可提取字段",
      "Column 6": "固定",
    },
  ]);

  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((row) => [row.fieldDomainType, row.deepdrawField, row.fieldSource, row.mappedField, row.sourceType, row.sourceField, row.defaultValue]), [
    ["通用字段", "产品分类", "上市计划表", "官方发布类目", "launch_plan", "官方发布类目", null],
    ["通用字段", "兼容平台", "固定", "1688、天猫、京东", "fixed", null, "1688、天猫、京东"],
    ["通用字段", "产品标题", "文案表", "搜索标题", "copywriting", "搜索标题", null],
    ["通用字段", "选择期数", "对应日期", null, "mdm", "对应日期", null],
    ["通用字段", "尺码表", "制单", "尺码", "manual", null, null],
    ["通用字段", "模特实拍", null, null, "manual", null, null],
    ["鞋品字段", "鞋子模板类型", "固定", "通用鞋品尺码表", "fixed", null, "通用鞋品尺码表"],
  ]);
  assert.equal(rows[4].blocking, false);
  assert.equal(rows[5].blocking, true);
});

test("parseDeepdrawFieldMappingRows treats fixed source field names as source references", () => {
  const rows = parseDeepdrawFieldMappingRows([
    {
      "Column 2": "深绘字段",
      "Column 3": "字段来源",
      "Column 4": "对应字段",
      "Column 5": "字段类型",
      "Column 6": "是否能MDM导入",
    },
    {
      "Column 2": "京东市场价",
      "Column 3": "固定",
      "Column 4": "固定吊牌价",
      "Column 5": "可提取字段",
      "Column 6": "固定",
    },
    {
      "Column 2": "微信视频小店标题",
      "Column 3": "固定",
      "Column 4": "内容平台标题",
      "Column 5": "可提取字段",
      "Column 6": "固定",
    },
    {
      "Column 2": "适用平台",
      "Column 3": "固定",
      "Column 4": "天猫",
      "Column 5": "可提取字段",
      "Column 6": "固定",
    },
  ]);

  assert.deepEqual(rows.map((row) => [row.deepdrawField, row.sourceType, row.sourceField, row.defaultValue]), [
    ["京东市场价", "launch_plan", "吊牌价", null],
    ["微信视频小店标题", "copywriting", "内容平台标题", null],
    ["适用平台", "fixed", null, "天猫"],
  ]);
});
