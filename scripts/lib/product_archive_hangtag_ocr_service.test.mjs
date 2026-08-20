import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_FILE = new URL("../../web/server/services/product-archive-hangtag-ocr.ts", import.meta.url);

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
