import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  normalizeListingLaunchPlanRows,
  readSpreadsheetSheetsFromFile,
} from "./listing_launch_plan_importer.mjs";

const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));

test("normalizeListingLaunchPlanRows extracts key fields from the 326 launch plan template", () => {
  const rows = normalizeListingLaunchPlanRows([
    {
      "Column 1": "细节差异/产品规格差异/推荐岁段",
      "Column 32": "买手",
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
      "Column 29": "产品线",
      "Column 30": "场景",
      "Column 31": "属性",
      "Column 38": "年龄段",
      "Column 39": "尺码段",
      "Column 40": "性别",
      "Column 41": "品类",
      "Column 42": "小类",
      "Column 43": "颜色名称",
      "Column 44": "颜色代码",
      "Column 48": "吊牌价",
      "Column 53": "大身面料",
      "Column 56": "FAB",
      "Column 57": "上市批次",
      "Column 58": "上市时间",
      "Column 69": "上市渠道",
      "Column 81": "发布类目 (官方)",
      "Column 82": "发布类目 (唯品)",
      "Column 83": "主款式 （唯品四级品类）",
      "Column 84": "发布类目 (抖音)",
    },
    {
      "Column 20": "326",
      "Column 21": "200326105103",
      "Column 27": "20032610510300334",
      "Column 29": "婴幼童",
      "Column 30": "婴童外出服",
      "Column 31": "全域款",
      "Column 38": "婴童",
      "Column 39": "066-100",
      "Column 40": "男",
      "Column 41": "便服",
      "Column 42": "梭织便服",
      "Column 43": "黄绿色调00334",
      "Column 44": "00334",
      "Column 48": "239",
      "Column 53": "涤纶四面弹印手绘植物彩格",
      "Column 56": "1. 面料：四面弹",
      "Column 57": "3",
      "Column 58": "2026/7/3",
      "Column 69": "渠道共享",
      "Column 81": "童装/婴儿装/亲子装>>外套/夹克/大衣>>普通外套",
      "Column 82": "婴幼外套",
      "Column 83": "外套",
      "Column 84": "服饰内衣>童装>外套",
    },
  ], { sheetName: "2026-全域" });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    sheetName: "2026-全域",
    rowNumber: 4,
    spuCode: "200326105103",
    skcCode: "20032610510300334",
    productSeason: "326",
    productLine: "婴幼童",
    scene: "婴童外出服",
    attribute: "全域款",
    ageGroup: "婴童",
    sizeRange: "066-100",
    gender: "男",
    categoryName: "便服",
    subcategoryName: "梭织便服",
    colorName: "黄绿色调00334",
    colorCode: "00334",
    tagPrice: 239,
    calculatedTagPrice: null,
    fabric: "涤纶四面弹印手绘植物彩格",
    fab: "1. 面料：四面弹",
    launchBatch: "3",
    launchDateText: "2026/7/3",
    searchLaunchDateText: "",
    contentLaunchDateText: "",
    listingChannel: "渠道共享",
    officialCategory: "童装/婴儿装/亲子装>>外套/夹克/大衣>>普通外套",
    vipCategory: "婴幼外套",
    vipStyleCategory: "外套",
    douyinCategory: "服饰内衣>童装>外套",
    rawRowJson: {
      "产品季": "326",
      "大货款号": "200326105103",
      "款色号": "20032610510300334",
      "产品线": "婴幼童",
      "场景": "婴童外出服",
      "属性": "全域款",
      "年龄段": "婴童",
      "尺码段": "066-100",
      "性别": "男",
      "品类": "便服",
      "小类": "梭织便服",
      "颜色名称": "黄绿色调00334",
      "颜色代码": "00334",
      "吊牌价": "239",
      "大身面料": "涤纶四面弹印手绘植物彩格",
      "FAB": "1. 面料：四面弹",
      "上市批次": "3",
      "上市时间": "2026/7/3",
      "上市渠道": "渠道共享",
      "官方发布类目": "童装/婴儿装/亲子装>>外套/夹克/大衣>>普通外套",
      "发布类目 (唯品)": "婴幼外套",
      "主款式 （唯品四级品类）": "外套",
      "发布类目 (抖音)": "服饰内衣>童装>外套",
    },
  });
});

test("readSpreadsheetSheetsFromFile never drops XLSX shared strings when streaming ZIP entries race", async () => {
  const ExcelJS = requireFromWeb("exceljs");
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-xlsx-shared-strings-"));
  try {
    const filePath = path.join(workDir, "copywriting.xlsx");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.addRow(["款号", "导购标题"]);
    worksheet.addRow(["202426107205", "巴拉巴拉儿童羽绒服男女童外套潮"]);
    await workbook.xlsx.writeFile(filePath);

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: "copywriting.xlsx" });
      assert.equal(sheets.length, 1);
      assert.equal(sheets[0].rows.length, 2);
      assert.equal(sheets[0].rows[0]["Column 1"], "款号");
      assert.equal(sheets[0].rows[1]["Column 1"], "202426107205");
      assert.equal(sheets[0].rows[1]["Column 2"], "巴拉巴拉儿童羽绒服男女童外套潮");
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});
