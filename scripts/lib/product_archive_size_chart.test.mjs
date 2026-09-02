import assert from "node:assert/strict";
import test from "node:test";

import {
  BALABALA_APPAREL_SIZE_REFERENCE,
  balabalaApparelAgeTextForSizeRange,
  balabalaApparelRecommendedSize,
  buildSizeChartForTemplate,
  normalizeDeepdrawSize,
  normalizePlmSizeChartRows,
  readPlmSizeChartWorkbook,
} from "./product_archive_size_chart.mjs";

test("internalizes Balabala age, weight and sex-by-garment size references", () => {
  assert.equal(BALABALA_APPAREL_SIZE_REFERENCE.length, 17);
  assert.equal(balabalaApparelAgeTextForSizeRange("130-170"), "6-16岁");
  assert.equal(balabalaApparelAgeTextForSizeRange("140cm-175cm"), "8-17岁");
  assert.equal(balabalaApparelRecommendedSize({ size: "130cm", gender: "男童", garmentType: "卫衣" }), "130/64");
  assert.equal(balabalaApparelRecommendedSize({ size: 130, gender: "男", garmentType: "下装" }), "130/59");
  assert.equal(balabalaApparelRecommendedSize({ size: 140, gender: "女童", garmentType: "上装" }), "140/64");
  assert.equal(balabalaApparelRecommendedSize({ size: 170, gender: "女", garmentType: "裤装" }), "170/72A");
  assert.equal(balabalaApparelRecommendedSize({ size: 170, gender: "中性", garmentType: "上衣" }), "170/88A");
  assert.equal(balabalaApparelRecommendedSize({ size: 170, gender: "男女", garmentType: "下装" }), "170/74A");
  assert.equal(balabalaApparelRecommendedSize({ size: 170, gender: "", garmentType: "下装" }), "");
});

test("uses the Balabala reference as a fallback for similar apparel size-table fields", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "208426121101", "测量点": "衣长", "尺码": "130", "尺码值": "50.5" },
      { "款号": "208426121101", "测量点": "衣长", "尺码": "170", "尺码值": "68" },
    ],
    spuCode: "208426121101",
    template: { fieldName: "平台尺码表", options: ["号型", "适合年龄", "体重(kg)", "体重(斤)"] },
    gender: "女童",
    garmentType: "下装",
  });

  assert.deepEqual(result.valueJson, {
    title: "号型,适合年龄,体重(kg),体重(斤)",
    "130cm": "130/53,6-8岁,25,50",
    "170cm": "170/72A,15-16岁,57.5,115",
  });
});

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
    title: "尺码,肩宽,袖长,胸围,衣长,下摆围",
    "80cm": "80,26.5,24.5,66,38,80",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.sourcePoint, "里：袖长");
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.confidence, "medium");
  assert.equal(result.mappings.find((item) => item.targetField === "衣长")?.confidence, "high");
  assert.equal(result.unmatchedTargets.includes("领口"), true);
});

test("omits unmapped DeepDraw size-chart fields instead of filling zero values", () => {
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
    title: "尺码,胸围,衣长",
    "80cm": "80,66,38",
  });
  assert.equal(result.unmatchedTargets.includes("领口"), true);
});

test("normalizes platform size-chart unit suffixes and pants aliases", () => {
  const rows = [
    { "款号": "208426108218", "测量点": "全腰围（平量）", "尺码": "080", "尺码值": "41" },
    { "款号": "208426108218", "测量点": "臀围", "尺码": "080", "尺码值": "74" },
    { "款号": "208426108218", "测量点": "裤长", "尺码": "080", "尺码值": "43" },
    { "款号": "208426108218", "测量点": "前浪（弯量）", "尺码": "080", "尺码值": "21.8" },
    { "款号": "208426108218", "测量点": "后浪（弯量）", "尺码": "080", "尺码值": "27.1" },
    { "款号": "208426108218", "测量点": "1/2脾围", "尺码": "080", "尺码值": "22" },
  ];

  const douyin = buildSizeChartForTemplate({
    rows,
    spuCode: "208426108218",
    template: { fieldName: "抖音尺码表", options: ["身高(cm)", "体重(斤)", "腰围(cm)", "臀围(cm)", "裤长(cm)", "备注"] },
  });
  const haoyiku = buildSizeChartForTemplate({
    rows,
    spuCode: "208426108218",
    template: { fieldName: "好衣库尺码表", options: ["身高(cm)", "体重(kg)", "腰围(cm)", "臀围(cm)", "裤长(cm)"] },
  });
  const vip = buildSizeChartForTemplate({
    rows,
    spuCode: "208426108218",
    template: { fieldName: "唯品会尺码表", options: ["号型", "适合年龄", "身高", "腰围", "臀围", "裤长", "前浪", "后浪", "大腿围"] },
  });

  assert.deepEqual(douyin.valueJson, {
    title: "身高(cm),体重(斤),腰围(cm),臀围(cm),裤长(cm)",
    "80cm": "80,19,41,74,43",
  });
  assert.deepEqual(haoyiku.valueJson, {
    title: "身高(cm),体重(kg),腰围(cm),臀围(cm),裤长(cm)",
    "80cm": "80,9.5,41,74,43",
  });
  assert.deepEqual(vip.valueJson, {
    title: "号型,适合年龄,身高,腰围,臀围,裤长,前浪,后浪,大腿围",
    "80cm": "80,12-18月,80,41,74,43,21.8,27.1,22",
  });
  assert.deepEqual(douyin.unmatchedTargets, ["备注"]);
  assert.deepEqual(haoyiku.unmatchedTargets, []);
  assert.deepEqual(vip.unmatchedTargets, []);
});

test("fills VIP apparel size-chart model column with bare size values", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "208426121101", "测量点": "衣长", "尺码": "130cm", "尺码值": "50.5" },
      { "款号": "208426121101", "测量点": "衣长", "尺码": "140", "尺码值": "54" },
    ],
    spuCode: "208426121101",
    template: { fieldName: "唯品会尺码表", options: ["号型", "衣长"] },
    gender: "女童",
    garmentType: "上衣",
  });

  assert.deepEqual(result.valueJson, {
    title: "号型,衣长",
    "130cm": "130,50.5",
    "140cm": "140,54",
  });
});

test("fills apparel multi-platform sizes with full platform columns and only bare JD values", () => {
  const rows = [
    { "款号": "208426121101", "测量点": "衣长", "尺码": "130", "尺码值": "50.5" },
    { "款号": "208426121101", "测量点": "衣长", "尺码": "140码", "尺码值": "54" },
  ];

  const result = buildSizeChartForTemplate({
    rows,
    spuCode: "208426121101",
    template: { fieldName: "多平台尺码", options: ["京东", "天猫", "快手", "微信视频小店", "拼多多"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "京东,天猫,快手,微信视频小店,拼多多",
    "130cm": "130,,,,",
    "140cm": "140,,,,",
  });
});

test("maps collar sleeve and weight when the PLM source provides them", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "208426121101", "测量点": "领围", "尺码": "130", "尺码值": "34" },
      { "款号": "208426121101", "测量点": "袖长肩点量", "尺码": "130", "尺码值": "45" },
      { "款号": "208426121101", "测量点": "建议体重", "尺码": "130", "尺码值": "50" },
    ],
    spuCode: "208426121101",
    template: { fieldName: "尺码表", options: ["领口", "袖长", "体重"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "尺码,领口,袖长,体重",
    "130cm": "130,34,45,50",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.sourcePoint, "袖长肩点量");
});

test("doubles half-width chest waist hip and leg-opening measurements and omits cuff", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "202426107205", "测量点": "1/2胸围（平量）", "尺码": "090", "尺码值": "30" },
      { "款号": "202426107205", "测量点": "1/2腰围（平量）", "尺码": "090", "尺码值": "21" },
      { "款号": "202426107205", "测量点": "1/2臀围（平量）", "尺码": "090", "尺码值": "37" },
      { "款号": "202426107205", "测量点": "1/2脚口（平量）", "尺码": "090", "尺码值": "8" },
      { "款号": "202426107205", "测量点": "1/2袖口（平量）", "尺码": "090", "尺码值": "7" },
    ],
    spuCode: "202426107205",
    template: { fieldName: "尺码表", options: ["胸围", "腰围", "臀围", "脚口", "袖口"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "尺码,胸围,腰围,臀围,脚口",
    "90cm": "90,60,42,74,16",
  });
});

test("maps skirt hem target alias 下摆 from PLM hem circumference points", () => {
  const result = buildSizeChartForTemplate({
    rows: [
      { "款号": "202426107205", "测量点": "裙长", "尺码": "090", "尺码值": "44" },
      { "款号": "202426107205", "测量点": "1/2腰围（平量）", "尺码": "090", "尺码值": "21" },
      { "款号": "202426107205", "测量点": "臀围", "尺码": "090", "尺码值": "70" },
      { "款号": "202426107205", "测量点": "裙摆围", "尺码": "090", "尺码值": "88" },
    ],
    spuCode: "202426107205",
    template: { fieldName: "尺码表", options: ["裙长", "腰围", "臀围", "下摆"] },
  });

  assert.deepEqual(result.valueJson, {
    title: "尺码,裙长,腰围,臀围,下摆",
    "90cm": "90,44,42,70,88",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "下摆")?.sourcePoint, "裙摆围");
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
    title: "尺码,身高,衣长,胸围,袖长",
    "80cm": "80,80,33,64,26",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "身高")?.sourcePoint, "尺码");
  assert.equal(result.unmatchedTargets.includes("身高"), false);
});

test("clips PLM size-chart rows to authoritative draft sizes", () => {
  const rows = [
    { "款号": "208426108204", "测量点": "身高", "尺码": "73/", "尺码值": "73" },
    { "款号": "208426108204", "测量点": "裤长", "尺码": "73/", "尺码值": "40" },
    { "款号": "208426108204", "测量点": "身高", "尺码": "80/", "尺码值": "80" },
    { "款号": "208426108204", "测量点": "裤长", "尺码": "80/", "尺码值": "44" },
  ];

  const result = buildSizeChartForTemplate({
    rows,
    spuCode: "208426108204",
    template: { fieldName: "尺码表", options: ["身高", "裤长"] },
    allowedSizes: ["080"],
  });

  assert.deepEqual(result.valueJson, {
    title: "尺码,身高,裤长",
    "80cm": "80,80,44",
  });
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

  assert.deepEqual(top.valueJson, { title: "尺码,衣长,胸围,腰围", "80cm": "80,36,72,42" });
  assert.deepEqual(pants.valueJson, { title: "尺码,裤长,腰围", "80cm": "80,49,42" });
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
    title: "尺码,领口,衣长",
    "80cm": "80,14,38",
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
    title: "尺码,衣长",
    "80cm": "80,40",
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
