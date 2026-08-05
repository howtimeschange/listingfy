import assert from "node:assert/strict";
import test from "node:test";

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
              title: "针织衫",
              status: "manual_review",
              updated_at: "2026-08-05T10:00:00Z",
            }];
          }
          if (/from product_archive_draft_field/i.test(sql)) {
            assert.equal(params[0], 7);
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
