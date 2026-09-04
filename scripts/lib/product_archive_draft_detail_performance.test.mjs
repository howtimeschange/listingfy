import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const DETAIL_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/[draftId]/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts");
const service = await import("../../web/server/services/product-archive-draft-detail.ts");

const draft = {
  id: 1,
  draft_no: "PAD-SPU-1",
  spu_code: "SPU-1",
  title: "测试商品",
  tenant_name: "tenant",
  merchant_id: "merchant",
  trade_id: "trade-1",
  trade_path: "童装/服装",
  retail_price: 99,
  status: "ready",
  validation_summary_json: { blocker_count: 0, warning_count: 1, validated_at: "2026-09-04T00:00:00.000Z" },
  created_product_id: "product-1",
  created_product_code: "SPU-1",
  updated_at: "2026-09-04T00:00:00.000Z",
};

function fakeDatabase() {
  const calls = [];
  const fields = Array.from({ length: 2 }, (_, index) => ({
    id: index + 11,
    draft_id: 1,
    field_name: index === 0 ? "材质" : "性别",
    source_type: "manual",
    value_text: index === 0 ? "棉" : "男",
    value_json: {},
    required: index === 0,
    blocking: index === 0,
    manual_override: false,
    validation_status: "valid",
    validation_message: null,
    updated_at: "2026-09-04T00:00:00.000Z",
    options_json: [],
    field_type: "input_text",
    template_third_platform: null,
  }));
  const skus = [{
    id: 21,
    draft_id: 1,
    skc_code: "SKC-1",
    sku_code: "SKU-1",
    barcode: "6900000000001",
    color_name: "黑",
    size_name: "100",
    size_code: "100",
    price: 99,
    seller_code: "SELLER-1",
  }];
  const images = [{
    id: 31,
    draft_id: 1,
    spu_code: "SPU-1",
    source_type: "manual_upload",
    source_ref: "SPU-1.jpg",
    file_name: "SPU-1.jpg",
    original_file_name: "SPU-1.jpg",
    mime_type: "image/jpeg",
    file_size: 1024,
    width: 100,
    height: 100,
    sort_no: 1,
    asset_kind: null,
    created_at: "2026-09-04T00:00:00.000Z",
    updated_at: "2026-09-04T00:00:00.000Z",
  }];
  const issues = [{
    id: 41,
    draft_id: 1,
    severity: "warning",
    issue_type: "sku_price_mismatch",
    field_name: null,
    sku_code: "SKU-1",
    message: "价格存在差异",
    resolved_at: null,
    created_at: "2026-09-04T00:00:00.000Z",
  }];
  const logs = [{
    id: 51,
    draft_id: 1,
    operation: "resource",
    http_status: 200,
    response_code: "10200",
    response_reason: "ok",
    request_id: "req-1",
    product_id: "product-1",
    created_at: "2026-09-04T00:00:00.000Z",
  }];
  const rowForDraft = () => ({
    ...draft,
    validation_summary_json: JSON.stringify(draft.validation_summary_json),
    trade_selection_json: JSON.stringify({
      status: "auto_applied",
      confidence: "high",
      recommendedTrade: { tradeId: "trade-1", tradePath: "童装/服装" },
      appliedTrade: { tradeId: "trade-1", tradePath: "童装/服装" },
    }),
    submit_in_progress: false,
    field_count: 2,
    sku_count: 1,
    issue_count: 1,
    image_count: 1,
    reference_image_count: 1,
    hangtag_image_count: 0,
    washlabel_image_count: 0,
    thumbnail_id: 31,
    thumbnail_file_name: "SPU-1.jpg",
    thumbnail_mime_type: "image/jpeg",
  });

  return {
    calls,
    prepare(sql) {
      return {
        get(...params) {
          calls.push({ method: "get", sql, params });
          if (/from product_archive_draft\b/i.test(sql)) return rowForDraft();
          return undefined;
        },
        all(...params) {
          calls.push({ method: "all", sql, params });
          if (/from product_archive_draft_field/i.test(sql)) return fields;
          if (/from product_archive_draft_sku/i.test(sql)) return skus;
          if (/from product_archive_draft_image/i.test(sql)) return images;
          if (/from product_archive_validation_issue/i.test(sql)) return issues;
          if (/from product_archive_submit_log/i.test(sql)) return logs;
          if (/from deepdraw_trade_field_cache/i.test(sql)) return [];
          if (/from product_archive_source_row/i.test(sql)) return [];
          if (/from product_archive_size_chart_mapping/i.test(sql)) return [];
          return [];
        },
      };
    },
  };
}

test("summary excludes full fields, source rows, logs and SKU arrays", () => {
  const db = fakeDatabase();
  const response = service.getProductArchiveDraftSummary(db, 1);
  assert.ok(response?.draft);
  assert.ok(response?.counts);
  assert.equal("fields" in response, false);
  assert.equal("skus" in response, false);
  assert.equal("sizeChartSourceRows" in response, false);
  assert.equal("logs" in response, false);
  assert.equal(response.counts.fields, 2);
  assert.equal(response.counts.skus, 1);
  assert.equal(response.thumbnail?.id, 31);
  assert.doesNotMatch(JSON.stringify(response), /source_snapshot_json|row_json|raw_payload_json|local_path/);
  assert.ok(db.calls.some((call) => /validation_summary_json/.test(call.sql)));
});

test("draft resources use stable paging and cap oversized limits", () => {
  const db = fakeDatabase();
  const fields = service.getProductArchiveDraftFields(db, 1, { limit: 9999, offset: -20 });
  const skus = service.getProductArchiveDraftSkus(db, 1, { limit: 9999, offset: 0 });
  const issues = service.getProductArchiveDraftIssues(db, 1, { limit: 9999, offset: 0 });
  const activity = service.getProductArchiveDraftActivity(db, 1, { limit: 9999, offset: 0 });
  assert.equal(fields.pagination.limit, 500);
  assert.equal(fields.pagination.offset, 0);
  assert.equal(skus.pagination.limit, 500);
  assert.equal(issues.pagination.limit, 500);
  assert.equal(activity.pagination.limit, 500);
  for (const call of db.calls.filter((item) => item.method === "all")) {
    if (/from product_archive_draft_(field|sku|image)|from product_archive_validation_issue|from product_archive_submit_log/i.test(call.sql)) {
      assert.match(call.sql, /order by[\s\S]*(?:, id|id)/i);
      assert.match(call.sql, /limit \? offset \?/i);
    }
  }
});

test("detail page loads heavy resources only for the visible tab", async () => {
  const page = await readFile(DETAIL_PAGE_FILE, "utf8");
  assert.match(page, /product-archive-draft-summary/);
  assert.match(page, /useInfiniteQuery/);
  assert.match(page, /activeTab === ["']fields["']/);
  assert.match(page, /activeTab === ["']skus["']/);
  assert.match(page, /activeTab === ["']issues["']/);
  assert.match(page, /activeTab === ["']logs["']/);
  assert.match(page, /product-archive-drafts.*\/summary/);
  assert.match(page, /product-archive-drafts.*\/fields/);
  assert.match(page, /fetchNextPage/);
  assert.match(page, /staleTime:\s*15000/);
});

test("detail read aliases are registered before the compatibility dynamic route", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");
  const aliases = ["summary", "fields", "skus", "assets", "issues", "activity", "size-chart/source", "source"];
  const positions = aliases.map((alias) => route.indexOf(`productArchiveDrafts.get(\"/:draftId/${alias}\"`));
  assert.ok(positions.every((position) => position >= 0));
  const dynamicPosition = route.indexOf('productArchiveDrafts.get("/:draftId",');
  assert.ok(dynamicPosition > Math.max(...positions));
  assert.match(route, /productArchiveDrafts\.get\("\/:draftId\/logs"/);
});
