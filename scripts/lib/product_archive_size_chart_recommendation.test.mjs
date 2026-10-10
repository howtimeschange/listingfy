import assert from "node:assert/strict";
import test from "node:test";

const archiveService = await import("../../web/server/services/product-archive-drafts.ts");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRecommendationDb() {
  const state = {
    draft: {
      id: 1,
      spu_code: "202426108049-test2",
      tenant_name: "balabala",
      merchant_id: "deepdraw",
      trade_id: "pants-main",
      trade_path: "童装婴幼儿服装/裤子",
      title: "女童长裤测试款",
      source_snapshot_json: {
        sourceBatchIds: { size_chart: [10] },
        spu: {
          spu_code: "202426108049",
          spu_name: "女童长裤",
          product_line_name: "童装",
          subclass_name: "裤子",
          gender_name: "女童",
        },
      },
    },
    templateFields: [
      {
        field_name: "尺码表",
        field_id: "size-table",
        field_type: "MULTI_TEXT",
        options_json: ["安全等级", "腰围", "臀围", "尺码", "前档", "脚口", "裤口围", "裤长", "身高", "体重"],
        required: true,
        sale_prop: false,
        raw_payload_json: {},
      },
    ],
    sourceBatches: [{ id: 10, source_type: "size_chart" }],
    sourceRows: ["140/", "150/"].flatMap((size, offset) => ([
      { id: 100 + offset * 10 + 1, source_batch_id: 10, source_type: "size_chart", spu_code: "202426108049-test2", row_json: { "款号": "202426108049-test2", "测量点": "1/2腰围（平量）", "尺码": size, "尺码值": offset === 0 ? "29" : "31" } },
      { id: 100 + offset * 10 + 2, source_batch_id: 10, source_type: "size_chart", spu_code: "202426108049-test2", row_json: { "款号": "202426108049-test2", "测量点": "1/2臀围（平量）", "尺码": size, "尺码值": offset === 0 ? "44" : "46" } },
      { id: 100 + offset * 10 + 3, source_batch_id: 10, source_type: "size_chart", spu_code: "202426108049-test2", row_json: { "款号": "202426108049-test2", "测量点": "1/2脚口（平量）", "尺码": size, "尺码值": offset === 0 ? "12" : "13" } },
      { id: 100 + offset * 10 + 4, source_batch_id: 10, source_type: "size_chart", spu_code: "202426108049-test2", row_json: { "款号": "202426108049-test2", "测量点": "裤长", "尺码": size, "尺码值": offset === 0 ? "82.5" : "87" } },
      { id: 100 + offset * 10 + 5, source_batch_id: 10, source_type: "size_chart", spu_code: "202426108049-test2", row_json: { "款号": "202426108049-test2", "测量点": "前浪（弯量）", "尺码": size, "尺码值": offset === 0 ? "28" : "29" } },
    ])),
    draftSkus: [
      { sku_code: "SKU-140", skc_code: "SKC-1", size_name: "140cm", size_code: "140", barcode: "690000000140", seller_code: "SKU-140" },
    ],
  };
  return {
    state,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get(...params) {
          if (/from product_archive_draft\b/i.test(normalized)) return clone(state.draft);
          if (/from product_spu\b/i.test(normalized)) return undefined;
          if (/from deepdraw_trade_cache\b/i.test(normalized)) return undefined;
          return undefined;
        },
        all(...params) {
          if (/from product_archive_source_batch\b/i.test(normalized)) return clone(state.sourceBatches);
          if (/select distinct on \(source\.source_type\)/i.test(normalized)) return [];
          if (/from product_archive_source_row\b/i.test(normalized)) return clone(state.sourceRows);
          if (/from product_sku\b/i.test(normalized)) return [];
          if (/from product_archive_draft_sku\b/i.test(normalized)) return clone(state.draftSkus);
          if (/from product_archive_size_chart_mapping\b/i.test(normalized)) return [];
          if (/from deepdraw_trade_field_cache\b/i.test(normalized)) return clone(state.templateFields);
          return [];
        },
        run() {
          return { changes: 1 };
        },
      };
    },
  };
}

test("size-chart recommendations use draft snapshot context and draft SKU fallback", async () => {
  const db = createRecommendationDb();

  const result = await archiveService.recommendProductArchiveSizeChartMappings(db, 1, {
    router: { callJson: async () => ({ json: { mappings: [] } }) },
  });

  assert.equal(result.previews.length, 1);
  const preview = result.previews[0];
  assert.deepEqual(preview.valueJson, {
    title: "尺码,腰围,臀围,脚围,裤长,身高,体重",
    "140cm": "140,58,88,24,82.5,140,31",
  });
  assert.equal(Object.hasOwn(preview.valueJson, "150cm"), false, "draft SKU fallback should restrict allowed sizes when live MDM SKU rows are absent");
  assert.equal(preview.unmatchedTargets.includes("脚口"), false);
  assert.equal(preview.unmatchedTargets.includes("裤口围"), false);
  assert.equal(preview.unmatchedTargets.includes("前档"), false);
});
