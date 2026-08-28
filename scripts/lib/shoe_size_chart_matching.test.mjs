import assert from "node:assert/strict";
import test from "node:test";

const shoeRows = [
  {
    size_value: 21,
    foot_length_mm: 130,
    foot_length_tolerance_mm: 2,
    inner_length_mm: 142,
    general_mapping_text: "(脚长12.8-13.2/内长14.2)",
    douyin_mapping_text: "脚长12.8-13.2/内长14.2",
    vip_mapping_text: "21码(脚长13/内长14.2)",
    video_pdd_vip_mapping_text: "21码(脚长12.8-13.2/内长14.2)",
    pinduoduo_mapping_text: "21码脚长12.8-13.2/内长14.2",
  },
  {
    size_value: 26,
    foot_length_mm: 160,
    foot_length_tolerance_mm: 2,
    inner_length_mm: 170.32,
    general_mapping_text: "(脚长15.8-16.2/内长17)",
    douyin_mapping_text: "脚长15.8-16.2/内长17",
    vip_mapping_text: "26码(脚长16/内长17)",
    video_pdd_vip_mapping_text: "26码(脚长15.8-16.2/内长17)",
    pinduoduo_mapping_text: "26码脚长15.8-16.2/内长17",
  },
  {
    size_value: 27,
    foot_length_mm: 165,
    foot_length_tolerance_mm: 2,
    inner_length_mm: 176.98,
    general_mapping_text: "(脚长16.3-16.7/内长17.7)",
    douyin_mapping_text: "脚长16.3-16.7/内长17.7",
    vip_mapping_text: "27码(脚长16.5/内长17.7)",
    video_pdd_vip_mapping_text: "27码(脚长16.3-16.7/内长17.7)",
    pinduoduo_mapping_text: "27码脚长16.3-16.7/内长17.7",
  },
  {
    size_value: 38,
    foot_length_mm: 240,
    foot_length_tolerance_mm: 2,
    inner_length_mm: 250.24,
    general_mapping_text: "(脚长23.8-24.2/内长25)",
    douyin_mapping_text: "脚长23.8-24.2/内长25",
    vip_mapping_text: "38码(脚长24/内长25)",
    video_pdd_vip_mapping_text: "38码(脚长23.8-24.2/内长25)",
    pinduoduo_mapping_text: "38码脚长23.8-24.2/内长25",
  },
];

test("shoe categories resolve the Balabala number chart and DeepDraw enums independently", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");
  const cases = [
    ["16608", "童鞋/亲子鞋 / 户外鞋", "sport_leisure", "运动", "轻跑鞋"],
    ["546", "童鞋/亲子鞋 / 运动鞋", "sport_leisure", "运动", "轻跑鞋"],
    ["533", "童鞋/亲子鞋 / 靴子", "sport_leisure", "休闲", ""],
    ["534", "童鞋/亲子鞋 / 雪地靴", "sport_leisure", "雪地靴", "雪地靴"],
    ["538", "童鞋/亲子鞋 / 学步鞋", "sport_leisure", "婴童", "学步鞋"],
  ];

  for (const [tradeId, tradePath, chartCode, templateType, legacyType] of cases) {
    assert.deepEqual(service.resolveShoeSizeChartMatch({ tradeId, tradePath }), {
      status: "matched",
      chartCode,
      templateType,
      shoeSizeTableType: "",
      legacyShoeType: legacyType,
      reason: `trade_id:${tradeId}`,
    });
  }
});

test("sandal category waits for multimodal evidence and maps visible construction to the right chart", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");

  assert.deepEqual(service.resolveShoeSizeChartMatch({
    tradeId: "537",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
  }), {
    status: "needs_visual_classification",
    chartCode: "",
    templateType: "休闲",
    shoeSizeTableType: "",
    legacyShoeType: "凉鞋",
    reason: "sandal_visual_classification_required",
  });
  assert.equal(service.resolveShoeSizeChartMatch({
    tradeId: "537",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
    sandalClassification: "前后空凉鞋",
  }).chartCode, "open_sandal");
  assert.equal(service.resolveShoeSizeChartMatch({
    tradeId: "537",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
    sandalClassification: "中空凉鞋（前后包鞋面）",
  }).chartCode, "closed_sandal");
  assert.match(service.shoeSandalVisualClassificationPrompt(), /前后空凉鞋/);
  assert.match(service.shoeSandalVisualClassificationPrompt(), /中空凉鞋/);
  assert.match(service.shoeSandalVisualClassificationPrompt(), /鞋头和后跟/);
  assert.match(service.shoeEnumClassificationPrompt(), /25鞋子模板类型/);
  assert.match(service.shoeEnumClassificationPrompt(), /22Q4-童鞋尺码表/);
  assert.match(service.shoeEnumClassificationPrompt(), /不要把鞋品枚举字段当作 MULTI_TEXT 尺码表/);
});

test("shoe chart fields are cropped to actual SKU sizes and use live DeepDraw columns", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");
  const result = service.buildShoeSizeChartFieldValues({
    rows: shoeRows,
    skuSizes: ["26cm", "27", "38cm"],
    fieldTemplates: [
      { fieldName: "尺码", fieldType: "MULTI_CHOICE", options: ["21", "26", "27", "38"] },
      { fieldName: "尺码.", fieldType: "TEXT", options: ["26码以下", "26-28码", "29-30码", "31-32码", "33-34码", "34码以上"] },
      { fieldName: "尺码类型", fieldType: "SINGLE_CHOICE", options: ["通用", "欧码(童鞋)", "中国码"] },
      { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["适合脚长", "鞋内长", "脚长"] },
      { fieldName: "唯品会尺码表", fieldType: "MULTI_TEXT", options: ["中国码", "脚长", "鞋内长"] },
      { fieldName: "天猫尺码表", fieldType: "MULTI_TEXT", options: ["脚长", "鞋内长"] },
      { fieldName: "抖音尺码表", fieldType: "MULTI_TEXT", options: ["脚长(cm)", "备注"] },
      { fieldName: "淘宝尺码表", fieldType: "MULTI_TEXT", options: ["脚长"] },
      { fieldName: "多平台尺码", fieldType: "MULTI_TEXT", options: ["京东", "拼多多", "小红书", "微信视频小店"] },
      { fieldName: "25鞋子模板类型", fieldType: "SINGLE_CHOICE", options: ["运动", "休闲", "雪地靴", "婴童"] },
      { fieldName: "25鞋子尺码表", fieldType: "SINGLE_CHOICE", options: ["包头凉鞋", "镂空凉鞋", "运动公主鞋", "凉鞋"] },
      { fieldName: "22Q4-童鞋尺码表", fieldType: "SINGLE_CHOICE", options: ["轻跑鞋", "雪地靴", "学步鞋"] },
    ],
    match: {
      status: "matched",
      chartCode: "sport_leisure",
      templateType: "运动",
      shoeSizeTableType: "",
      legacyShoeType: "轻跑鞋",
      reason: "trade_id:546",
    },
  });

  assert.deepEqual(result["尺码"], { valueText: "26;27;38", valueJson: {} });
  assert.deepEqual(result["尺码."], { valueText: "34码以上", valueJson: {} });
  assert.deepEqual(result["尺码类型"], { valueText: "欧码(童鞋)", valueJson: {} });
  assert.deepEqual(result["尺码表"].valueJson, {
    title: "适合脚长,鞋内长",
    "26": "16,17",
    "27": "16.5,17.7",
    "38": "24,25",
  });
  assert.deepEqual(result["唯品会尺码表"].valueJson, {
    title: "中国码,脚长,鞋内长",
    "26": "26,16,17",
    "27": "27,16.5,17.7",
    "38": "38,24,25",
  });
  assert.deepEqual(result["抖音尺码表"].valueJson, {
    title: "脚长(cm),备注",
    "26": "15.8-16.2,脚长15.8-16.2/内长17",
    "27": "16.3-16.7,脚长16.3-16.7/内长17.7",
    "38": "23.8-24.2,脚长23.8-24.2/内长25",
  });
  assert.deepEqual(result["多平台尺码"].valueJson, {
    title: "京东,拼多多,小红书,微信视频小店",
    "26": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
    "27": "27,27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7)",
    "38": "38,38码(脚长23.8-24.2/内长25),38码(脚长23.8-24.2/内长25),38码(脚长23.8-24.2/内长25)",
  });
  assert.deepEqual(result["25鞋子模板类型"], { valueText: "运动", valueJson: {} });
  assert.deepEqual(result["22Q4-童鞋尺码表"], { valueText: "轻跑鞋", valueJson: {} });
  assert.equal(result["25鞋子尺码表"], undefined);
  assert.deepEqual(Object.keys(result["尺码表"].valueJson), ["26", "27", "38", "title"].sort((a, b) => a === "title" ? 1 : b === "title" ? -1 : Number(a) - Number(b)));
});

test("shoe chart builder refuses clothing placeholders and unsupported live columns", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");
  const result = service.buildShoeSizeChartFieldValues({
    rows: shoeRows,
    skuSizes: ["26"],
    fieldTemplates: [
      { fieldName: "尺码表", fieldType: "MULTI_TEXT", options: ["鞋长", "鞋宽", "适合脚长", "鞋内长"] },
    ],
    match: { status: "matched", chartCode: "sport_leisure", templateType: "运动", shoeSizeTableType: "", legacyShoeType: "", reason: "test" },
  });

  assert.equal(result["尺码表"].valueJson.title, "适合脚长,鞋内长");
  assert.equal(result["尺码表"].valueJson["26"], "16,17");
  assert.doesNotMatch(JSON.stringify(result), /身高|衣长|胸围|袖长/);
});

test("shoe video-channel size range uses the maximum actual shoe size", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");
  const result = service.buildShoeSizeChartFieldValues({
    rows: shoeRows,
    skuSizes: ["21", "26"],
    fieldTemplates: [
      { fieldName: "尺码.", fieldType: "TEXT", options: ["14cm以下", "14-16cm", "17-19cm", "20-22cm", "22cm以上", "34码以上"] },
    ],
    match: { status: "matched", chartCode: "sport_leisure", templateType: "婴童", shoeSizeTableType: "", legacyShoeType: "学步鞋", reason: "trade_id:538" },
  });
  assert.deepEqual(result["尺码."], { valueText: "14-16cm", valueJson: {} });
});

test("shoe multi-platform charts fall back to the Vipshop mapping when compatible channel columns are absent", async () => {
  const service = await import("../../web/server/services/shoe-size-chart-matching.ts");
  const result = service.buildShoeSizeChartFieldValues({
    rows: [{
      size_value: 26,
      foot_length_mm: 160,
      foot_length_tolerance_mm: 2,
      inner_length_mm: 170,
      vip_mapping_text: "26码(脚长16/内长17)",
      video_pdd_vip_mapping_text: "",
      pinduoduo_mapping_text: "",
    }],
    skuSizes: ["26"],
    fieldTemplates: [{
      fieldName: "多平台尺码",
      fieldType: "MULTI_TEXT",
      options: ["拼多多", "微信视频小店"],
    }],
    match: {
      status: "matched",
      chartCode: "open_sandal",
      templateType: "休闲",
      shoeSizeTableType: "凉鞋",
      legacyShoeType: "凉鞋",
      reason: "test",
    },
  });

  assert.deepEqual(result["多平台尺码"].valueJson, {
    title: "拼多多,微信视频小店",
    "26": "26码(脚长16/内长17),26码(脚长16/内长17)",
  });
});

test("shoe structured chart is emitted in the create payload", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const value = service.productArchivePayloadFieldValue({
    field_name: "尺码表",
    field_type: "MULTI_TEXT",
    required: true,
    blocking: true,
    value_text: "",
    value_json: { title: "适合脚长,鞋内长", "26码": "16,17" },
  });
  assert.deepEqual(value, { title: "适合脚长,鞋内长", "26码": "16,17" });
});

test("shoe MDM derivation never creates clothing size placeholders or cm enum values", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const input = {
    spu: { product_line_name: "鞋品", subclass_name: "运动鞋" },
    skus: [
      { size_name: "26", size_code: "26" },
      { size_name: "27", size_code: "27" },
    ],
  };

  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("尺码", input), {
    valueText: "26;27",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("尺码表", input), {
    valueText: "",
    valueJson: {},
  });
  assert.equal(service.isProductArchiveFieldLocallyRequired("尺码表", {
    templateRequired: true,
    templatePresent: true,
    ruleBlocking: false,
    shoeProduct: true,
  }), true);
  assert.equal(service.isProductArchiveFieldLocallyRequired("尺码表", {
    templateRequired: true,
    templatePresent: true,
    ruleBlocking: false,
    shoeProduct: false,
  }), true);
  assert.deepEqual(service.validateProductArchiveSkuSizeFieldValue({
    fieldName: "尺码.",
    valueText: "34码以上",
    skus: [{ size_name: "26" }, { size_name: "38" }],
  }), []);
});

test("shoe launch-plan evidence fills required free-text and platform marker fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const input = {
    spu: { product_line_name: "鞋品", subclass_name: "户外鞋" },
    sourceRows: [{
      source_type: "launch_plan",
      row_json: {
        FAB: "轻弹止滑大底，鞋面防泼水，旋钮扣易穿脱。",
        大身面料: "织物",
        首批sap到货时间: "20260819",
        上市时间: "2026-08-21",
      },
    }],
  };

  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("商品详情", input), "轻弹止滑大底，鞋面防泼水，旋钮扣易穿脱。");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("最快出货时间", input), "48小时");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("材质(AKC)", input), "织物");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("单色平台AI标", input), "坑位1");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("多色平台AI", input), "坑位1");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("详情页AI标注", input), "展示");
});

test("shoe launch-plan evidence deterministically fills required material, age, origin and channel enums", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const input = {
    spu: {
      product_line_name: "鞋品",
      subclass_name: "雪地靴",
      spu_name: "儿童时尚生活鞋",
    },
    sourceRows: [{
      source_type: "launch_plan",
      row_json: {
        FAB: "防渗水羊巴革料，内里短毛绒，保温更安心。",
        大身面料: "织物",
        里料材质: "短毛绒",
        尺码段: "26-40",
        年龄段: "中童",
        鞋品生产企业名称: "中山市盛邦鞋业有限责任公司",
      },
    }],
  };

  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("抖音参考价格类型", input), "吊牌价");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("是否商场同款", input), "");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("帮面材质(多选)", input), "织物");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("材质(1688)", input), "织物");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("材质功能", input), "防渗水");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("鞋垫材质", input), "防渗水羊巴革料，内里短毛绒，保温更安心。");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("产地", input), "浙江杭州");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("原产国(AKC)", input), "中国");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("适用年龄", input), "7岁-14岁");

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("帮面材质(多选)", "织物", ["合成革", "其他"]), "其他");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质功能", "防渗水", ["防泼水", "防水", "常规"]), "防水");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("鞋垫材质", "短毛绒", ["纺织品类", "人造毛", "其它"]), "人造毛");
});

test("shoe static facts fall back to older launch-plan rows without reviving dynamic fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const rows = service.mergeProductArchiveShoeStaticEvidenceRows([
    {
      id: 200,
      source_type: "launch_plan",
      source_batch_id: 20,
      row_json: { 上市时间: "2026-08-30", FAB: "最新面料" },
    },
  ], [
    {
      id: 100,
      source_type: "launch_plan",
      source_batch_id: 10,
      row_json: {
        鞋品生产企业名称: "中山市盛邦鞋业有限责任公司",
        里料材质: "15mm长毛绒",
        上市时间: "2026-07-30",
        吊牌价格: "199",
      },
    },
  ]);

  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("产地", {
    spu: { product_line_name: "鞋品", subclass_name: "雪地靴" },
    sourceRows: rows,
  }), "浙江杭州");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("鞋垫材质", {
    spu: { product_line_name: "鞋品", subclass_name: "雪地靴" },
    sourceRows: rows,
  }), "最新面料");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("鞋垫材质", "15mm长毛绒", [
    "纺织品类", "人造长毛绒", "其他",
  ]), "人造长毛绒");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("鞋垫材质", "织物", [
    "纺织布料", "人造长毛绒", "其他",
  ]), "纺织布料");
  assert.equal(rows[1].row_json.上市时间, undefined);
  assert.equal(rows[1].row_json.吊牌价格, undefined);
});

test("shoe visual blockers are admitted to the multimodal AI strategy", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  for (const fieldName of ["帮面材质(多选)", "材质(1688)", "材质功能", "鞋垫材质", "靴筒高度", "22Q4-童鞋尺码表", "25鞋子模板类型"]) {
    assert.ok(service.productArchiveAiFieldStrategyForField(fieldName), `${fieldName} should have an AI field strategy`);
  }
});

test("25 shoe size-table enum stays scalar while real multi-text size charts stay structured", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.isStructuredProductPayloadField({
    field_name: "25鞋子尺码表",
    field_id: "89217",
    field_type: "SINGLE_CHOICE",
  }), false);
  assert.equal(service.isStructuredProductPayloadField({
    field_name: "尺码表",
    field_id: "123",
    field_type: "MULTI_TEXT",
  }), true);
});

test("25 shoe size-table AI is limited to sandals that still need visual classification", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.shouldProductArchiveAiFill25ShoeSizeTable({
    tradeId: "534",
    tradePath: "童鞋/亲子鞋 / 雪地靴",
  }), false);
  assert.equal(service.shouldProductArchiveAiFill25ShoeSizeTable({
    tradeId: "537",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
  }), true);
  assert.equal(service.isStaleNonSandalAi25ShoeSizeTable({
    fieldName: "25鞋子尺码表",
    sourceType: "ai",
    tradeId: "534",
    tradePath: "童鞋/亲子鞋 / 雪地靴",
  }), true);
  assert.equal(service.isStaleNonSandalAi25ShoeSizeTable({
    fieldName: "25鞋子尺码表",
    sourceType: "ai",
    tradeId: "537",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
  }), false);
});
