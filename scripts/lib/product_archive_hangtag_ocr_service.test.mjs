import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../../web/server/services/product-archive-hangtag-ocr.ts", import.meta.url);

test("AI fill OCR evidence maps apparel compliance fields without overwriting confirmed values", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const fills = service.buildProductArchiveAiFillOcrEvidenceFills({
    draftId: 917,
    spuCode: "202426103105",
    fields: [
      { id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
      { id: 2, field_name: "安全等级", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [{ label: "B类", value: "B类" }] },
      { id: 3, field_name: "安全等级（多选）", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [{ label: "B类", value: "B类" }] },
      { id: 4, field_name: "产品等级", value_text: "一等品", value_json: {}, source_type: "manual", manual_override: true, validation_status: "valid", options_json: [] },
      { id: 5, field_name: "吊牌截取", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
    ],
    documents: [
      {
        fileName: "202426103105吊牌.jpg",
        sourceKind: "hangtag",
        detectedSpuCode: "202426103105",
        rawText: "执行标准：FZ/T 73018-2021\n安全技术级别：符合 GB 31701 B类\n产品等级：合格品",
        fields: [
          { key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "hangtag" },
          { key: "safetyCategory", label: "安全技术级别", value: "符合 GB 31701 B类", confidence: "high", sourceKind: "hangtag" },
          { key: "productGrade", label: "产品等级", value: "合格品", confidence: "high", sourceKind: "hangtag" },
        ],
      },
      {
        fileName: "wrong-style吊牌.jpg",
        sourceKind: "hangtag",
        detectedSpuCode: "202426103106",
        fields: [{ key: "executionStandard", label: "执行标准", value: "QB/T 0000-2020", confidence: "high", sourceKind: "hangtag" }],
      },
    ],
  });

  assert.deepEqual(fills.map((fill) => [fill.field_id, fill.field_name, fill.field_value, fill.source_type]), [
    [1, "执行标准", "FZ/T 73018-2021", "hangtag_ocr"],
    [2, "安全等级", "B类", "hangtag_ocr"],
    [3, "安全等级（多选）", "B类", "hangtag_ocr"],
    [5, "吊牌截取", "执行标准：FZ/T 73018-2021\n安全技术级别：符合 GB 31701 B类\n产品等级：合格品", "hangtag_ocr"],
  ]);
  assert.equal(fills.some((fill) => fill.field_id === 4), false);
  assert.deepEqual(fills.map((fill) => fill.source_ref), [
    "202426103105吊牌.jpg",
    "202426103105吊牌.jpg",
    "202426103105吊牌.jpg",
    "202426103105吊牌.jpg#p1",
  ]);
});

test("AI fill OCR evidence keeps the strongest duplicate document result", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const fills = service.buildProductArchiveAiFillOcrEvidenceFills({
    draftId: 917,
    spuCode: "202426103105",
    fields: [
      { id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
    ],
    documents: [
      {
        fileName: "低清吊牌.jpg",
        sourceKind: "hangtag",
        detectedSpuCode: "202426103105",
        fields: [{ key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2012", confidence: "low", sourceKind: "hangtag" }],
      },
      {
        fileName: "高清吊牌.jpg",
        sourceKind: "hangtag",
        detectedSpuCode: "202426103105",
        fields: [{ key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "hangtag" }],
      },
    ],
  });

  assert.deepEqual(fills.map((fill) => [fill.field_value, fill.file_name, fill.confidence_label]), [
    ["FZ/T 73018-2021", "高清吊牌.jpg", "high"],
  ]);
});

test("product archive hangtag OCR preview maps recognized compliance fields onto current draft fields", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const queries = [];
  const db = {
    prepare(sql) {
      queries.push(sql);
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426103215"]);
            return [{
              id: 7,
              spu_code: "208426103215",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            assert.deepEqual(params, ["电商巴拉巴拉", "739", "190101", 7]);
            return [
              { id: 101, field_name: "执行标准", value_text: null, value_json: {}, source_type: "manual", required: true, blocking: true },
              { id: 102, field_name: "安全技术类别", value_text: "", value_json: {}, source_type: "manual", required: true, blocking: true },
              { id: 103, field_name: "产品等级", value_text: "合格品", value_json: {}, source_type: "manual", required: true, blocking: true },
              { id: 104, field_name: "吊牌价", value_text: "", value_json: {}, source_type: "launch_plan", required: false, blocking: false },
              { id: 105, field_name: "吊牌截取", value_text: "", value_json: {}, source_type: "manual", required: false, blocking: false },
              { id: 106, field_name: "洗唛截取", value_text: "", value_json: {}, source_type: "manual", required: false, blocking: false },
            ];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [{
      fileName: "PRC-208426103215吊牌.pdf",
      fileType: "pdf",
      sourceKind: "hangtag",
      detectedSpuCode: "208426103215",
      status: "recognized",
      pageCount: 1,
      rawText: "吊牌 OCR 原文",
      fields: [
        { key: "executionStandard", label: "执行标准", value: "Q/BALABALA 104-2022", confidence: "high", evidenceText: "执行标准：Q/BALABALA 104-2022", pageNumber: 1, sourceKind: "hangtag" },
        { key: "safetyCategory", label: "安全技术类别", value: "符合GB 31701 A类", confidence: "high", evidenceText: "安全技术类别：符合GB 31701 A类", pageNumber: 1, sourceKind: "hangtag" },
        { key: "productGrade", label: "产品等级", value: "合格品", confidence: "high", evidenceText: "产品等级：合格品", pageNumber: 1, sourceKind: "hangtag" },
      ],
    }],
  });

  assert.equal(preview.summary.fileCount, 1);
  assert.equal(preview.summary.matchedCount, 1);
  assert.equal(preview.summary.writableFieldCount, 3);
  assert.equal(preview.summary.skippedFieldCount, 1);
  assert.equal(preview.items[0].status, "ready");
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.willApply, field.sourceType]), [
    ["执行标准", "Q/BALABALA 104-2022", true, "hangtag_ocr"],
    ["安全技术类别", "符合GB 31701 A类", true, "hangtag_ocr"],
    ["产品等级", "合格品", false, "hangtag_ocr"],
    ["吊牌截取", "吊牌 OCR 原文", true, "hangtag_ocr"],
  ]);
  assert.equal(preview.items[0].targetFields.some((field) => field.fieldName === "洗唛截取"), false);
  assert.ok(queries.some((sql) => /product_archive_draft_field/.test(sql)));
});

test("shoe-box OCR execution standard overrides lower-priority source values without the global overwrite option", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all() {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            return [{
              id: 17,
              spu_code: "208426140204",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "16608",
              title: "儿童户外鞋",
              status: "manual_review",
              updated_at: "2026-08-28T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [{
              id: 301,
              field_name: "执行标准",
              value_text: "GB/T 15107",
              value_json: {},
              source_type: "copywriting",
              required: true,
              blocking: true,
            }];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [{
      fileName: "208426140204_鞋盒.jpg",
      fileType: "image",
      sourceKind: "hangtag",
      detectedSpuCode: "208426140204",
      status: "recognized",
      pageCount: 1,
      fields: [{
        key: "executionStandard",
        label: "执行标准",
        value: "QB/T 4331-2021",
        confidence: "high",
        sourceKind: "hangtag",
      }],
    }],
  });

  assert.equal(preview.summary.writableFieldCount, 1);
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.currentValueText, field.valueText, field.willApply]), [
    ["执行标准", "GB/T 15107", "QB/T 4331-2021", true],
  ]);
});

test("SCM list composition is previewed as a supplement without writing raw text captures", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426103215"]);
            return [{
              id: 9,
              spu_code: "208426103215",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [
              { id: 201, field_name: "面料成分", value_text: "", value_json: {}, source_type: "manual", required: true, blocking: true },
              { id: 202, field_name: "洗唛截取", value_text: "", value_json: {}, source_type: "manual", required: false, blocking: false },
            ];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [
      {
        fileName: "208426103215洗唛.jpg",
        fileType: "image",
        sourceKind: "washlabel",
        detectedSpuCode: "208426103215",
        status: "recognized",
        pageCount: 1,
        rawText: "洗唛 OCR 原文",
        fields: [
          { key: "materialComposition", label: "面料成分", value: "OCR 面料成分", confidence: "high", sourceKind: "washlabel" },
        ],
      },
      {
        fileName: "SCM洗唛吊牌下载结果.xlsx",
        fileType: "spreadsheet",
        sourceKind: "scm_list",
        detectedSpuCode: "208426103215",
        status: "recognized",
        pageCount: 1,
        fields: [
          { key: "materialComposition", label: "中文成分", value: "SCM 明文面料成分", confidence: "high", sourceKind: "scm_list", pageNumber: 2 },
        ],
        sourceRef: "SCM洗唛吊牌下载结果.xlsx#成分汇总!R2",
      },
    ],
  });

  assert.deepEqual(preview.items.map((item) => item.sourceKind), ["washlabel", "scm_list"]);
  assert.equal(preview.summary.writableFieldCount, 3);
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.sourceType]), [
    ["面料成分", "OCR 面料成分", "washlabel_ocr"],
    ["洗唛截取", "洗唛 OCR 原文", "washlabel_ocr"],
  ]);
  assert.deepEqual(preview.items[1].targetFields.map((field) => [field.fieldName, field.valueText, field.sourceType, field.sourceRef]), [
    ["面料成分", "SCM 明文面料成分", "scm_list", "SCM洗唛吊牌下载结果.xlsx#成分汇总!R2"],
  ]);
  assert.equal(preview.items[1].targetFields.some((field) => field.fieldName === "洗唛截取"), false);
});

test("washlabel OCR down fill weight maps onto down fill text field", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426107229"]);
            return [{
              id: 12,
              spu_code: "208426107229",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "羽绒服",
              status: "manual_review",
              updated_at: "2026-08-17T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [
              { id: 2200, field_name: "充绒量", value_text: "", value_json: {}, source_type: "manual", required: true, blocking: true, options_json: [{ value: "绒子含量90%" }], field_type: "SINGLE_SELECT" },
              { id: 2201, field_name: "充绒量(文本)", value_text: "", value_json: {}, source_type: "manual", required: true, blocking: true },
              { id: 2202, field_name: "洗唛截取", value_text: "", value_json: {}, source_type: "manual", required: false, blocking: false },
            ];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [{
      fileName: "208426107229洗唛.jpg",
      fileType: "image",
      sourceKind: "washlabel",
      detectedSpuCode: "208426107229",
      status: "recognized",
      pageCount: 1,
      rawText: "充绒量 OCR 原文",
      fields: [
        { key: "downFillWeight", label: "充绒量", value: "80 | 90 | 100 | 110 | 120 | 130\n60 | 67 | 78 | 90 | 103 | 118", confidence: "high", sourceKind: "washlabel" },
      ],
    }],
  });

  assert.equal(preview.summary.writableFieldCount, 2);
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.sourceType]), [
    ["充绒量(文本)", "80码60克；90码67克；100码78克；110码90克；120码103克；130码118克", "washlabel_ocr"],
    ["洗唛截取", "充绒量 OCR 原文", "washlabel_ocr"],
  ]);
});

test("202426107205 OCR maps C-class safety and takes the lower fill weight across colors", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["202426107205"]);
            return [{
              id: 960,
              spu_code: "202426107205",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "629",
              title: "羽绒服",
              status: "manual_review",
              updated_at: "2026-08-28T01:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [
              {
                id: 9601,
                field_name: "安全等级",
                field_type: "SINGLE_SELECT",
                value_text: "",
                value_json: {},
                source_type: "manual",
                required: true,
                blocking: true,
                options_json: [{ value: "A类" }, { value: "B类" }, { value: "C类" }],
              },
              {
                id: 9602,
                field_name: "充绒量(文本)",
                field_type: "TEXT",
                value_text: "",
                value_json: {},
                source_type: "manual",
                required: true,
                blocking: true,
                options_json: [],
              },
            ];
          }
          return [];
        },
      };
    },
  };
  const baseWeights = "90 | 100 | 110 | 120 | 130 | 140 | 150 | 160 | 165 | 170 | 175 | 180\n13 | 15 | 17 | 19 | 21 | 24 | 27 | 30 | 33 | 35 | 37 | 39";
  const largerWeights = "90 | 100 | 110 | 120 | 130 | 140 | 150 | 160 | 165 | 170 | 175 | 180\n14 | 16 | 18 | 20 | 22 | 25 | 28 | 31 | 34 | 36 | 38 | 40";
  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [
      {
        fileName: "202426107205吊牌.pdf",
        fileType: "pdf",
        sourceKind: "hangtag",
        detectedSpuCode: "202426107205",
        status: "recognized",
        pageCount: 4,
        fields: [{ key: "safetyCategory", label: "安全等级", value: "符合GB 31701 C类", confidence: "high", sourceKind: "hangtag" }],
      },
      {
        fileName: "202426107205-80821-洗唛.jpg",
        fileType: "image",
        sourceKind: "washlabel",
        detectedSpuCode: "202426107205",
        status: "recognized",
        pageCount: 1,
        fields: [{ key: "downFillWeight", label: "充绒量", value: largerWeights, confidence: "high", sourceKind: "washlabel" }],
      },
      {
        fileName: "202426107205-90001-洗唛.jpg",
        fileType: "image",
        sourceKind: "washlabel",
        detectedSpuCode: "202426107205",
        status: "recognized",
        pageCount: 1,
        fields: [{ key: "downFillWeight", label: "充绒量", value: baseWeights, confidence: "high", sourceKind: "washlabel" }],
      },
    ],
  });

  assert.equal(preview.summary.writableFieldCount, 2);
  assert.deepEqual(
    preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.willApply]),
    [["安全等级", "C类", true]],
  );
  const fillWeightTargets = preview.items
    .flatMap((item) => item.targetFields)
    .filter((field) => field.fieldName === "充绒量(文本)");
  assert.equal(fillWeightTargets.filter((field) => field.willApply).length, 1);
  assert.equal(
    fillWeightTargets.find((field) => field.willApply)?.valueText,
    "90码13克；100码15克；110码17克；120码19克；130码21克；140码24克；150码27克；160码30克；165码33克；170码35克；175码37克；180码39克",
  );
  assert.match(
    fillWeightTargets.find((field) => !field.willApply)?.skippedReason ?? "",
    /同款多色充绒量已合并/,
  );
});

test("SCM composition normalizes into DeepDraw enum fields instead of writing free text", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426103215"]);
            return [{
              id: 17,
              spu_code: "208426103215",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            assert.deepEqual(params, ["电商巴拉巴拉", "739", "190101", 17]);
            return [
              {
                id: 301,
                field_name: "材质成分",
                field_type: "MULTI_TEXT",
                value_text: "石棉(石绵)",
                value_json: { source: "AI_RULE_FALLBACK", ai_fill: { fallback: true } },
                source_type: "ai_rule_fallback",
                required: true,
                blocking: true,
                options_json: [
                  { value: "棉" },
                  { value: "聚酯纤维" },
                  { value: "粘胶纤维(粘纤)" },
                  { value: "聚氨酯弹性纤维(氨纶)" },
                ],
              },
              {
                id: 302,
                field_name: "抖音面料材质",
                field_type: "TEXT",
                value_text: "龙骨纹绒",
                value_json: { source: "AI_RULE_FALLBACK", ai_fill: { fallback: true } },
                source_type: "ai_rule_fallback",
                required: true,
                blocking: true,
                options_json: [
                  { value: "棉混纺" },
                  { value: "棉" },
                  { value: "聚酯纤维" },
                ],
              },
              {
                id: 303,
                field_name: "材质(多选)",
                field_type: "MULTI_CHOICE",
                value_text: "",
                value_json: {},
                source_type: "manual",
                required: true,
                blocking: true,
                options_json: [
                  { value: "棉" },
                  { value: "聚酯纤维" },
                  { value: "粘胶纤维(粘纤)" },
                  { value: "氨纶" },
                ],
              },
            ];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [{
      fileName: "SCM洗唛吊牌下载结果.xlsx",
      fileType: "spreadsheet",
      sourceKind: "scm_list",
      detectedSpuCode: "208426103215",
      status: "recognized",
      pageCount: 1,
      fields: [
        {
          key: "materialComposition",
          label: "中文成分",
          value: "面料: 65.1%棉\n25.0%聚酯纤维\n9.2%粘纤\n0.7%氨纶（配料除外）",
          confidence: "high",
          sourceKind: "scm_list",
          pageNumber: 2,
        },
      ],
    }],
  });

  assert.equal(preview.summary.writableFieldCount, 3);
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.willApply]), [
    ["材质成分", "棉,65.1;聚酯纤维,25;粘胶纤维(粘纤),9.2;聚氨酯弹性纤维(氨纶),0.7", true],
    ["抖音面料材质", "棉混纺", true],
    ["材质(多选)", "棉;聚酯纤维;粘胶纤维(粘纤);氨纶", true],
  ]);
  assert.equal(preview.items[0].targetFields.some((field) => String(field.valueText).startsWith("面料:")), false);
});

test("SCM composition skips enum fields when the recognized value has no template match", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  const db = {
    prepare(sql) {
      return {
        all() {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            return [{
              id: 18,
              spu_code: "208426103215",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [{
              id: 401,
              field_name: "材质成分",
              field_type: "MULTI_TEXT",
              value_text: "",
              value_json: {},
              source_type: "manual",
              required: true,
              blocking: true,
              options_json: [{ value: "棉" }, { value: "聚酯纤维" }],
            }];
          }
          return [];
        },
      };
    },
  };

  const preview = service.previewProductArchiveHangtagWashlabelOcr(db, {
    documents: [{
      fileName: "SCM洗唛吊牌下载结果.xlsx",
      fileType: "spreadsheet",
      sourceKind: "scm_list",
      detectedSpuCode: "208426103215",
      status: "recognized",
      pageCount: 1,
      fields: [
        { key: "materialComposition", label: "中文成分", value: "面料: 100%羊毛", confidence: "high", sourceKind: "scm_list" },
      ],
    }],
  });

  assert.equal(preview.summary.writableFieldCount, 0);
  assert.equal(preview.summary.skippedFieldCount, 1);
  assert.deepEqual(preview.items[0].targetFields.map((field) => [field.fieldName, field.valueText, field.willApply, field.skippedReason]), [
    ["材质成分", "羊毛,100", false, "识别值未匹配深绘模板选项"],
  ]);
});

test("product archive hangtag OCR apply body preserves preview source refs", async () => {
  const route = await import("../../web/server/routes/product-archive-drafts.ts");
  const documents = route.applyDocumentsFromBody({
    items: [{
      fileName: "SCM洗唛吊牌下载结果.xlsx",
      fileType: "spreadsheet",
      sourceKind: "scm_list",
      sourceRef: "SCM洗唛吊牌下载结果.xlsx#成分汇总!R2",
      detectedSpuCode: "208426103215",
      pageCount: 1,
      extractedFields: [
        { key: "materialComposition", label: "中文成分", value: "SCM 明文面料成分", pageNumber: 2 },
      ],
      warnings: [],
    }],
  });

  assert.equal(documents.length, 1);
  assert.equal(documents[0].sourceRef, "SCM洗唛吊牌下载结果.xlsx#成分汇总!R2");
  assert.equal(documents[0].fields[0].value, "SCM 明文面料成分");
});

test("hangtag OCR apply fences active submit claims before any field update", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  let fieldUpdateAttempts = 0;
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426103215"]);
            return [{
              id: 7,
              spu_code: "208426103215",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "739",
              trade_id: "190101",
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [{
              id: 101,
              field_name: "执行标准",
              value_text: "",
              value_json: {},
              source_type: "manual",
              required: true,
              blocking: true,
            }];
          }
          return [];
        },
        get() {
          if (/for update/i.test(sql)) {
            return { id: 7, status: "manual_review", submit_claim_token: "active-claim" };
          }
          return null;
        },
        run() {
          if (/update product_archive_draft_field/i.test(sql)) {
            fieldUpdateAttempts += 1;
            throw new Error("unexpected field update while claim is active");
          }
          return { changes: 1 };
        },
      };
    },
    transaction(fn) {
      return () => fn();
    },
  };

  assert.throws(
    () => service.applyProductArchiveHangtagWashlabelOcr(db, {
      documents: [{
        fileName: "208426103215吊牌.pdf",
        fileType: "pdf",
        sourceKind: "hangtag",
        detectedSpuCode: "208426103215",
        status: "recognized",
        fields: [{
          key: "executionStandard",
          label: "执行标准",
          value: "Q/BALABALA 104-2022",
          confidence: "high",
          sourceKind: "hangtag",
        }],
      }],
    }),
    /PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS/,
  );
  assert.equal(fieldUpdateAttempts, 0);
});

test("hangtag OCR apply keeps locking, down-fill sync, and validation inside one transaction", async () => {
  const source = await readFile(SERVICE_FILE, "utf8");
  const applyStart = source.indexOf("export function applyProductArchiveHangtagWashlabelOcr");
  assert.ok(applyStart >= 0, "apply implementation should be present");
  const applySource = source.slice(applyStart);
  const transactionBody = applySource.match(/return db\.transaction\(\(\) => \{[\s\S]*?\}\)\(\)/)?.[0];

  assert.ok(transactionBody, "apply should return one outer transaction");
  assert.match(transactionBody, /productArchiveDraftIdsForOcrApply\([\s\S]*assertProductArchiveDraftMutable\(db, draftId[\s\S]*buildPreviewItem/);
  assert.match(transactionBody, /update product_archive_draft set updated_at[\s\S]*syncProductArchiveDownFillWeightSizeCharts/);
  assert.match(transactionBody, /syncProductArchiveDownFillWeightSizeCharts\(db, draftId[\s\S]*validateProductArchiveDraft\(db, draftId/);
});

test("hangtag OCR apply fails closed when a new latest draft appears after candidate locking", async () => {
  const service = await import("../../web/server/services/product-archive-hangtag-ocr.ts");
  let candidateQueryCount = 0;
  let fieldUpdateAttempts = 0;
  const oldDraft = {
    id: 7,
    spu_code: "208426103215",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "739",
    trade_id: "190101",
    title: "旧草稿",
    status: "manual_review",
    updated_at: "2026-08-05T10:00:00Z",
  };
  const newDraft = {
    ...oldDraft,
    id: 8,
    title: "新草稿",
    updated_at: "2026-08-19T10:00:00Z",
  };
  const db = {
    prepare(sql) {
      return {
        all(...params) {
          if (/from product_archive_draft\s+where spu_code in/i.test(sql)) {
            assert.deepEqual(params, ["208426103215"]);
            candidateQueryCount += 1;
            return [candidateQueryCount === 1 ? oldDraft : newDraft];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            return [{
              id: 801,
              field_name: "执行标准",
              value_text: "",
              value_json: {},
              source_type: "manual",
              required: true,
              blocking: true,
            }];
          }
          return [];
        },
        get() {
          if (/for update/i.test(sql)) {
            return { id: 7, status: "manual_review", submit_claim_token: null };
          }
          return null;
        },
        run() {
          if (/update product_archive_draft_field/i.test(sql)) {
            fieldUpdateAttempts += 1;
          }
          return { changes: 1 };
        },
      };
    },
    transaction(fn) {
      return () => fn();
    },
  };

  assert.throws(
    () => service.applyProductArchiveHangtagWashlabelOcr(db, {
      documents: [{
        fileName: "208426103215吊牌.pdf",
        fileType: "pdf",
        sourceKind: "hangtag",
        detectedSpuCode: "208426103215",
        status: "recognized",
        fields: [{
          key: "executionStandard",
          label: "执行标准",
          value: "Q/BALABALA 104-2022",
          confidence: "high",
          sourceKind: "hangtag",
        }],
      }],
    }),
    /草稿数据已更新，请刷新后重试/,
  );
  assert.equal(candidateQueryCount, 2);
  assert.equal(fieldUpdateAttempts, 0);
});
