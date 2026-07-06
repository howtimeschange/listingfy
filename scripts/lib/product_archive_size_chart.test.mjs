import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSizeChartForTemplate,
  normalizeDeepdrawSize,
  normalizePlmSizeChartRows,
  readPlmSizeChartWorkbook,
} from "./product_archive_size_chart.mjs";

test("normalizes PLM long-table rows and builds a high-confidence top size chart", () => {
  const rows = [
    { "款号": "208326100020", "测量点": "衣长", "尺码": "80/", "尺码值": "38.0" },
    { "款号": "208326100020", "测量点": "肩宽", "尺码": "80/", "尺码值": "26.5" },
    { "款号": "208326100020", "测量点": "胸围", "尺码": "80/", "尺码值": "66.0" },
    { "款号": "208326100020", "测量点": "下摆围（弧量）", "尺码": "80/", "尺码值": "80.0" },
    { "款号": "208326100020", "测量点": "里：袖长", "尺码": "80/", "尺码值": "24.5" },
    { "款号": "208326100020", "测量点": "里：1/2袖口（平量）", "尺码": "80/", "尺码值": "8.4" },
  ];
  const template = {
    fieldName: "尺码表",
    options: ["领口", "肩宽", "袖长", "袖口", "胸围", "腰围", "衣长", "下摆围"],
  };

  const result = buildSizeChartForTemplate({ rows, spuCode: "208326100020", template });

  assert.deepEqual(result.valueJson, {
    title: "领口,肩宽,袖长,袖口,胸围,腰围,衣长,下摆围",
    "80cm": "0,26.5,24.5,8.4,66,0,38,80",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.sourcePoint, "里：袖长");
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.confidence, "medium");
  assert.equal(result.mappings.find((item) => item.targetField === "衣长")?.confidence, "high");
  assert.equal(result.unmatchedTargets.includes("领口"), true);
});

test("keeps every DeepDraw size-chart field and fills unmapped values with zero", () => {
  const rows = [
    { "款号": "208326100020", "测量点": "衣长", "尺码": "080", "尺码值": "38" },
    { "款号": "208326100020", "测量点": "胸围", "尺码": "080", "尺码值": "66" },
  ];

  const result = buildSizeChartForTemplate({
    rows,
    spuCode: "208326100020",
    template: { fieldName: "尺码表", options: ["领口", "胸围", "衣长"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "领口,胸围,衣长",
    "80cm": "0,66,38",
  });
  assert.equal(result.unmatchedTargets.includes("领口"), true);
});

test("derives height from the size label while filling PLM mapped size-chart values", () => {
  const rows = [
    { "款号": "208326104204", "测量点": "衣长", "尺码": "80/", "尺码值": "33" },
    { "款号": "208326104204", "测量点": "胸围", "尺码": "80/", "尺码值": "64" },
    { "款号": "208326104204", "测量点": "里：袖长", "尺码": "80/", "尺码值": "26" },
  ];

  const result = buildSizeChartForTemplate({
    rows,
    spuCode: "208326104204",
    template: { fieldName: "尺码表", options: ["身高", "衣长", "胸围", "袖长"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "身高,衣长,胸围,袖长",
    "80cm": "80,33,64,26",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "身高")?.sourcePoint, "尺码");
  assert.equal(result.unmatchedTargets.includes("身高"), false);
});

test("normalizes PLM wide-table rows into one measurement record per size value", () => {
  const rows = normalizePlmSizeChartRows([
    {
      "款号": "208326108101",
      "测量点": "裤长",
      "080": "46.0",
      "090": "51.5",
      "100": "",
    },
  ]);

  assert.deepEqual(rows.map((row) => ({
    spuCode: row.spuCode,
    measurementPoint: row.measurementPoint,
    size: row.size,
    sizeValue: row.sizeValue,
  })), [
    { spuCode: "208326108101", measurementPoint: "裤长", size: "80cm", sizeValue: "46" },
    { spuCode: "208326108101", measurementPoint: "裤长", size: "90cm", sizeValue: "51.5" },
  ]);
});

test("keeps normalized PLM size labels in row json for display grouping", () => {
  const rows = normalizePlmSizeChartRows([
    { "款号": "208326100020", "测量点": "衣长", "尺码": "80/", "尺码值": "38.0" },
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].size, "80cm");
  assert.equal(rows[0].sizeValue, "38");
  assert.equal(rows[0].rowJson.尺码, "80cm");
  assert.equal(rows[0].rowJson.尺码值, "38");
});

test("builds separate size charts for set templates using field-specific source points", () => {
  const rows = [
    { "款号": "208326104204", "测量点": "衣长", "尺码": "080", "尺码值": "36" },
    { "款号": "208326104204", "测量点": "胸围", "尺码": "080", "尺码值": "72" },
    { "款号": "208326104204", "测量点": "裤长", "尺码": "080", "尺码值": "49" },
    { "款号": "208326104204", "测量点": "全腰围（平量）", "尺码": "080", "尺码值": "42" },
  ];

  const top = buildSizeChartForTemplate({
    rows,
    spuCode: "208326104204",
    template: { fieldName: "上衣尺码表", options: ["衣长", "胸围", "腰围"] },
  });
  const pants = buildSizeChartForTemplate({
    rows,
    spuCode: "208326104204",
    template: { fieldName: "裤子尺码表", options: ["裤长", "腰围", "臀围"] },
  });

  assert.deepEqual(top.valueJson, { title: "衣长,胸围,腰围", "80cm": "36,72,42" });
  assert.deepEqual(pants.valueJson, { title: "裤长,腰围,臀围", "80cm": "49,42,0" });
  assert.equal(pants.unmatchedTargets.includes("臀围"), true);
});

test("uses reviewed AI mappings to fill unmatched size-chart target fields", () => {
  const rows = [
    { "款号": "208326100020", "测量点": "领宽", "尺码": "080", "尺码值": "14" },
    { "款号": "208326100020", "测量点": "衣长", "尺码": "080", "尺码值": "38" },
  ];

  const result = buildSizeChartForTemplate({
    rows,
    spuCode: "208326100020",
    template: { fieldName: "尺码表", options: ["领口", "衣长"] },
    mappings: [
      {
        targetField: "领口",
        sourcePoint: "领宽",
        confidence: "low",
        source: "ai",
        reason: "AI 推荐后人工审核",
      },
    ],
  });

  assert.deepEqual(result.valueJson, {
    title: "领口,衣长",
    "80cm": "14,38",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "领口")?.source, "ai");
  assert.equal(result.unmatchedTargets.includes("领口"), false);
});

test("keeps the first duplicate PLM value so newer source rows win", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "208326100020", "测量点": "衣长", "尺码": "080", "尺码值": "40" },
      { "款号": "208326100020", "测量点": "衣长", "尺码": "080", "尺码值": "38" },
    ],
    spuCode: "208326100020",
    template: { fieldName: "尺码表", options: ["衣长"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "衣长",
    "80cm": "40",
  });
});

test("normalizes DeepDraw size labels consistently with SKU values", () => {
  assert.equal(normalizeDeepdrawSize("80/"), "80cm");
  assert.equal(normalizeDeepdrawSize("090"), "90cm");
  assert.equal(normalizeDeepdrawSize("110cm"), "110cm");
});

test("reads the real PLM workbook fixture when PLM_SIZE_CHART_FIXTURE is provided", async (t) => {
  const fixturePath = process.env.PLM_SIZE_CHART_FIXTURE;
  if (!fixturePath) {
    t.skip("PLM_SIZE_CHART_FIXTURE not provided");
    return;
  }

  const rows = await readPlmSizeChartWorkbook(fixturePath);
  const spuCodes = new Set(rows.map((row) => row.spuCode));

  assert.equal(rows.length, 604);
  assert.deepEqual([...spuCodes].sort(), [
    "208326100020",
    "208326104204",
    "208326108101",
    "208326111001",
    "208326169101",
  ]);
});
