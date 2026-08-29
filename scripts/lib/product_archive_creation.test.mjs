import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/024_deepdraw_product_archive_creation.sql"),
  sizeChartMigration: path.join(PROJECT_ROOT, "db/migrations/036_product_archive_size_chart_source.sql"),
  draftImageMigration: path.join(PROJECT_ROOT, "db/migrations/044_product_archive_draft_images.sql"),
  draftImageAssetPackageMigration: path.join(PROJECT_ROOT, "db/migrations/045_product_archive_draft_image_asset_package_source.sql"),
  submitLogUpdateMigration: path.join(PROJECT_ROOT, "db/migrations/053_product_archive_submit_log_update.sql"),
  sqliteDb: path.join(PROJECT_ROOT, "scripts/lib/sqlite_db.mjs"),
  metadataService: path.join(PROJECT_ROOT, "web/server/services/deepdraw-metadata.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  draftDetailPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/[draftId]/page.tsx"),
  metadataRoute: path.join(PROJECT_ROOT, "web/server/routes/deepdraw-metadata.ts"),
  deepdrawClient: path.join(PROJECT_ROOT, "scripts/lib/deepdraw_client.mjs"),
  tradeBackfillScript: path.join(PROJECT_ROOT, "scripts/product_archive_trade_backfill.mjs"),
  sourceBatchBackfillScript: path.join(PROJECT_ROOT, "scripts/product_archive_source_batch_backfill.mjs"),
};

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("new deepdraw archive schema is a PostgreSQL-only schema revision, not a SQLite compatibility layer", async () => {
  const [migration, draftImageMigration, draftImageAssetPackageMigration, submitLogUpdateMigration, sqliteDb] = await Promise.all([
    readFile(files.migration, "utf8"),
    readFile(files.draftImageMigration, "utf8"),
    readFile(files.draftImageAssetPackageMigration, "utf8"),
    readFile(files.submitLogUpdateMigration, "utf8"),
    readFile(files.sqliteDb, "utf8"),
  ]);

  assert.match(migration, /postgres-only/);
  assert.match(draftImageMigration, /postgres-only/);
  assert.match(draftImageMigration, /create table if not exists product_archive_draft_image/);
  assert.match(draftImageMigration, /references product_archive_draft\(id\) on delete cascade/);
  assert.match(draftImageMigration, /local_path text not null/);
  assert.match(draftImageMigration, /uploaded_by integer references app_user\(id\) on delete set null/);
  assert.match(draftImageMigration, /idx_product_archive_draft_image_draft/);
  assert.match(draftImageAssetPackageMigration, /crawshrimp_asset_package/);
  assert.match(draftImageAssetPackageMigration, /product_archive_draft_image_source_type_check/);
  assert.match(submitLogUpdateMigration, /product_archive_submit_log_operation_check/);
  assert.match(submitLogUpdateMigration, /'search', 'create', 'update', 'resource', 'dry_run'/);
  assert.match(migration, /bigserial primary key/i);
  assert.match(migration, /timestamptz not null default now\(\)/i);
  assert.match(migration, /jsonb not null default '\{\}'::jsonb/i);
  assert.match(migration, /jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /on conflict \(permission_key\) do nothing/i);
  assert.match(sqliteDb, /postgres-only/);
  assert.doesNotMatch(migration, /autoincrement|strftime|insert or ignore/i);
});

test("deepdraw metadata service uses SyncPostgresDatabase and reuses the shared DeepDraw client", async () => {
  const [service, client] = await Promise.all([
    readFile(files.metadataService, "utf8"),
    readFile(files.deepdrawClient, "utf8"),
  ]);

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /from ".{0,20}\.\.\/\.\.\/\.\.\/scripts\/lib\/deepdraw_client\.mjs"/);
  assert.match(service, /requestDeepdrawPost/);
  assert.match(client, /buildDeepdrawGetRequest/);
  assert.match(client, /buildDeepdrawPostRequest/);
  assert.match(client, /REST_PATH = "\/rest"/);
  assert.match(service, /MERCHANT_TRADES_TYPE|dp\.merchant\.trades/);
  assert.match(service, /TRADE_FIELDS_TYPE|dp\.trade\.fields/);
  assert.match(service, /flattenTrades/);
  assert.match(service, /attributes\.isRequired/);
  assert.match(service, /insert into deepdraw_trade_cache/i);
  assert.match(service, /insert into deepdraw_trade_field_cache/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id\) do update/i);
  assert.match(service, /on conflict \(tenant_name, merchant_id, trade_id, field_id\) do update/i);
  assert.match(service, /raw_payload_json/);
});

test("deepdraw metadata parser accepts category leaf attribute payloads", async () => {
  const metadata = await import("../../web/server/services/deepdraw-metadata.ts");

  const rows = metadata.extractDeepdrawTradeFieldRows({
    response: {
      code: 10200,
      response: "success",
      body: {
        leafAttrs: [
          {
            id: 25,
            attrName: "产品标题",
            valueType: "input_text",
            isRequired: true,
          },
          {
            attrId: 10076,
            attrName: "色系",
            valueType: "checkbox",
            attrValues: [
              { attrValueId: 40601, attrValueName: "军绿" },
              { attrValueId: 60001, attrValueName: "粉红" },
            ],
          },
        ],
      },
    },
  });

  assert.deepEqual(rows.map((row) => [row.fieldId, row.fieldName, row.fieldType, row.required]), [
    ["25", "产品标题", "input_text", true],
    ["10076", "色系", "checkbox", false],
  ]);
  assert.deepEqual(rows[1].options, [
    { attrValueId: 40601, attrValueName: "军绿" },
    { attrValueId: 60001, attrValueName: "粉红" },
  ]);
});

test("product archive draft service is PG-first and covers build validate patch duplicate dry-run submit contracts", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /SyncPostgresDatabase/);
  assert.match(service, /export function listProductArchiveDrafts/);
  assert.match(service, /export function deleteProductArchiveDraft/);
  assert.match(service, /正在提交的草稿不能删除/);
  assert.match(service, /delete from product_archive_draft[\s\S]*where id = \?[\s\S]*and submit_claim_token is null[\s\S]*returning/i);
  assert.match(service, /thumbnail_image_url/);
  assert.match(service, /asset_kind/);
  assert.match(service, /raw_payload_json #>> '\{asset_kind\}' = 'flat_image'/);
  assert.match(service, /raw_payload_json #>> '\{asset_kind\}' = 'model_image'/);
  assert.match(service, /asset_package_image_count/);
  assert.match(service, /hangtag_upload_count/);
  assert.match(service, /washlabel_upload_count/);
  assert.match(service, /export function importProductArchiveSourceRows/);
  assert.match(service, /export function createProductArchiveDraftFromSpu/);
  assert.match(service, /export function getProductArchiveDraftDetail/);
  assert.match(service, /export function patchProductArchiveDraftFields/);
  assert.match(service, /export function validateProductArchiveDraft/);
  assert.match(service, /export async function checkDuplicateProductArchiveDraft/);
  assert.match(service, /export async function submitProductArchiveDraft/);
  assert.match(service, /export async function readbackProductArchiveDraft/);
  assert.match(service, /db\.transaction/);
  assert.match(service, /product_spu/);
  assert.match(service, /product_skc/);
  assert.match(service, /product_sku/);
  assert.match(service, /product_archive_draft/);
  assert.match(service, /product_archive_draft_field/);
  assert.match(service, /product_archive_draft_sku/);
  assert.match(service, /product_archive_validation_issue/);
  assert.match(service, /product_archive_submit_log/);
  assert.match(service, /parseProductArchiveFieldRuleRows/);
  assert.match(service, /normalizeProductArchiveSourceRows/);
  assert.match(service, /dryRun/);
  assert.match(service, /duplicate_found/);
  assert.match(service, /readback_mismatch/);
  assert.match(service, /sanitizeDeepdrawLogPayload/);
  assert.doesNotMatch(service, /openDatabase|applyMigrations|better-sqlite3|node:sqlite/);
});

test("product archive duplicate and readback calls keep DeepDraw resource reads form-only", async () => {
  const service = await readFile(files.draftService, "utf8");
  const duplicateStart = service.indexOf("export async function checkDuplicateProductArchiveDraft");
  const duplicateEnd = service.indexOf("export async function submitProductArchiveDraft", duplicateStart);
  const duplicateImplementation = service.slice(duplicateStart, duplicateEnd);
  const readbackStart = service.indexOf("export async function readbackProductArchiveDraft");
  const readbackEnd = service.indexOf("export function listProductArchiveSubmitLogs", readbackStart);
  const readbackImplementation = service.slice(readbackStart, readbackEnd);

  assert.match(duplicateImplementation, /getDeepdrawProduct\(\{[\s\S]*resource: "form"[\s\S]*\}\)/);
  assert.match(readbackImplementation, /getDeepdrawProduct\(\{[\s\S]*resource: "form"[\s\S]*\}\)/);
});

test("product archive draft creation refreshes only unpublished reusable drafts", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const serviceSource = await readFile(files.draftService, "utf8");
  const createStart = serviceSource.indexOf("export function createProductArchiveDraftFromSpu");
  const createEnd = serviceSource.indexOf("export function getProductArchiveDraftDetail", createStart);
  const createImplementation = serviceSource.slice(createStart, createEnd);

  assert.equal(typeof service.isReusableProductArchiveDraftStatus, "function");
  for (const status of ["draft", "missing_fields", "manual_review", "ready"]) {
    assert.equal(service.isReusableProductArchiveDraftStatus(status), true, status);
  }
  for (const status of [
    "submitting",
    "created",
    "readback_verified",
    "readback_mismatch",
    "duplicate_found",
    "failed",
    "update_pending",
  ]) {
    assert.equal(service.isReusableProductArchiveDraftStatus(status), false, status);
  }

  assert.match(serviceSource, /function nonReusableProductArchiveDraftForSpu/);
  assert.match(serviceSource, /function reusableProductArchiveDraftForSpu/);
  assert.ok(
    createImplementation.indexOf("const blockedDraft = nonReusableProductArchiveDraftForSpu") <
      createImplementation.indexOf("const existingDraft = reusableProductArchiveDraftForSpu"),
    "non-reusable draft states must block before any old reusable draft is refreshed",
  );
  assert.match(createImplementation, /已有不可覆盖状态草稿/);
  assert.match(createImplementation, /duplicate_result_json = '\{\}'::jsonb/);
  assert.match(createImplementation, /replaceProductArchiveDraftSkuRows\(db, draftId, input\.spuCode, skuRows, now\)/);
});

test("product archive draft source rows stay scoped to the import batch when present", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /function sourceRowsForSpu\(db: SyncPostgresDatabase, spuCode: string, sourceBatchId\?: number \| null\)/);
  assert.match(service, /source\.source_batch_id = \?/);
  assert.match(service, /activeProductArchiveSourceRows/);
  assert.match(service, /export function resolveDraftSourceBatchIdsForSpu/);
  assert.match(service, /const resolvedSourceBatchIds = resolveDraftSourceBatchIdsForSpu\(/);
  assert.match(service, /sourceRowsForSpuBatchIds\(db, input\.spuCode, sourceBatchIdValues\)/);
  assert.match(service, /sourceRowsForSpu\(db, input\.spuCode, null\)/);
  assert.match(service, /sourceRowsForDraft\(db, draft\)/);
});

test("copywriting-triggered drafts recover the matching launch plan and size-chart batches by SPU", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const fakeDb = {
    prepare(sql) {
      calls.push(sql);
      return {
        all() {
          if (sql.includes("from product_archive_source_batch")) {
            return [{ id: 25, source_type: "copywriting" }];
          }
          if (sql.includes("from product_archive_source_row source")) {
            return [
              { source_type: "launch_plan", source_batch_id: 15 },
              { source_type: "size_chart", source_batch_id: 23 },
            ];
          }
          return [];
        },
      };
    },
  };

  assert.deepEqual(
    service.resolveDraftSourceBatchIdsForSpu(fakeDb, "204426140012", {
      launch_plan: [25],
    }),
    {
      copywriting: [25],
      launch_plan: [15],
      size_chart: [23],
    },
  );
  assert.ok(calls.some((sql) => sql.includes("from product_archive_source_batch")));
  assert.ok(calls.some((sql) => sql.includes("from product_archive_source_row source")));
});

test("MDM-created drafts recover latest launch plan and size-chart batches by SPU", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const fakeDb = {
    prepare(sql) {
      calls.push(sql);
      return {
        all() {
          if (sql.includes("from product_archive_source_row source")) {
            return [
              { source_type: "launch_plan", source_batch_id: 15 },
              { source_type: "size_chart", source_batch_id: 23 },
            ];
          }
          return [];
        },
      };
    },
  };

  assert.deepEqual(
    service.resolveDraftSourceBatchIdsForSpu(fakeDb, "204426140012"),
    {
      launch_plan: [15],
      size_chart: [23],
    },
  );
  assert.ok(calls.some((sql) => sql.includes("from product_archive_source_row source")));
});

test("launch-plan-created drafts recover the matching size-chart batch by SPU", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const fakeDb = {
    prepare(sql) {
      calls.push(sql);
      return {
        all() {
          if (sql.includes("from product_archive_source_batch")) {
            return [{ id: 15, source_type: "launch_plan" }];
          }
          if (sql.includes("from product_archive_source_row source")) {
            return [{ source_type: "size_chart", source_batch_id: 23 }];
          }
          return [];
        },
      };
    },
  };

  assert.deepEqual(
    service.resolveDraftSourceBatchIdsForSpu(fakeDb, "204426140012", {
      launch_plan: [15],
    }),
    {
      launch_plan: [15],
      size_chart: [23],
    },
  );
  assert.ok(calls.some((sql) => sql.includes("from product_archive_source_batch")));
  assert.ok(calls.some((sql) => sql.includes("from product_archive_source_row source")));
});

test("copywriting source backfill previews only drafts whose copywriting batch was recorded as a launch plan", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const draft = {
    id: 427,
    draft_no: "PAD-204426140012",
    spu_code: "204426140012",
    status: "manual_review",
    source_snapshot_json: {
      sourceBatchId: 25,
      sourceBatchIds: { launch_plan: [25] },
    },
  };
  const fakeDb = {
    prepare(sql) {
      return {
        all() {
          if (sql.includes("from product_archive_draft")) return [draft];
          if (sql.includes("from product_archive_source_batch")) {
            return [{ id: 25, source_type: "copywriting" }];
          }
          if (sql.includes("from product_archive_source_row source")) {
            return [
              { source_type: "launch_plan", source_batch_id: 15 },
              { source_type: "size_chart", source_batch_id: 23 },
            ];
          }
          return [];
        },
      };
    },
  };

  const result = service.backfillCopywritingTriggeredDraftSourceBatches(fakeDb);

  assert.equal(result.mode, "preview");
  assert.equal(result.matchedDraftCount, 1);
  assert.equal(result.previewCount, 1);
  assert.deepEqual(result.items[0]?.sourceBatchIds, {
    copywriting: [25],
    launch_plan: [15],
    size_chart: [23],
  });

  const script = await readText(files.sourceBatchBackfillScript);
  assert.match(script, /--apply/);
  assert.match(script, /backfillCopywritingTriggeredDraftSourceBatches/);
  assert.match(script, /Human-adjusted categories are retained/);
});

test("copywriting source backfill can scope repairs to drafts whose category is still empty", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  let draftQuery = "";
  const fakeDb = {
    prepare(sql) {
      if (sql.includes("from product_archive_draft")) draftQuery = sql;
      return { all: () => [] };
    },
  };

  const result = service.backfillCopywritingTriggeredDraftSourceBatches(fakeDb, {
    onlyMissingTrade: true,
  });

  assert.equal(result.matchedDraftCount, 0);
  assert.match(draftQuery, /trade_id is null/);
  assert.match(draftQuery, /nullif\(trim\(coalesce\(trade_path, ''\)\), ''\) is null/);

  const script = await readText(files.sourceBatchBackfillScript);
  assert.match(script, /--only-missing-trade/);
  assert.match(script, /onlyMissingTrade: args\.has\("--only-missing-trade"\)/);
});

test("source-import draft jobs retain the imported source type instead of sending a bare legacy batch id", async () => {
  const route = await readFile(files.draftRoute, "utf8");

  assert.match(route, /sourceBatchId: result\.sourceType === "launch_plan" \? sourceBatchId : null/);
  assert.match(route, /sourceBatchIds: \{ \[result\.sourceType\]: \[sourceBatchId\] \}/);
});

test("product archive field rebuild falls back to the draft MDM snapshot for cloned test SPUs", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const snapshotSpu = {
    spu_code: "208326105206",
    spu_name: "儿童外套",
    product_line_name: "幼童服装",
  };
  const fakeDb = {
    prepare() {
      return { get: () => undefined };
    },
  };

  assert.deepEqual(service.resolveProductArchiveDraftSpu(fakeDb, {
    spu_code: "208326105206-TEST",
    source_snapshot_json: { spu: snapshotSpu },
  }), snapshotSpu);
});

test("product archive source imports support PLM size-chart batches", async () => {
  const [migration, service, route] = await Promise.all([
    readText(files.sizeChartMigration),
    readFile(files.draftService, "utf8"),
    readFile(files.draftRoute, "utf8"),
  ]);

  assert.match(migration, /source_type in \('field_mapping', 'launch_plan', 'copywriting', 'size_chart'\)/);
  assert.match(migration, /source_type in \('launch_plan', 'copywriting', 'size_chart'\)/);
  assert.match(migration, /create table if not exists product_archive_size_chart_mapping/);
  assert.match(service, /sourceImportType\(input\.sourceType\)/);
  assert.match(service, /normalizePlmSizeChartRows/);
  assert.match(service, /sourceType === "size_chart"/);
  assert.match(service, /function sizeChartTemplateOptionsForField/);
  assert.match(service, /sizeChartTitleOptions\(existingValueJson\)/);
  assert.match(service, /templateOptions: sizeChartTemplateOptionsForField\(template\.options_json, existing\.value_json, fieldName\)/);
  assert.match(route, /sourceType:\s*"size_chart"/);
});

test("product archive trade matching accepts duplicate source rows that point to the same DeepDraw trade", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "12390", trade_name: "普通外套", trade_path: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
  ];

  assert.deepEqual(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades), {
    tradeId: "12390",
    tradePath: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
    confidence: "high",
    matchedField: "官方发布类目",
    matchedValue: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
  });
});

test("product archive trade matching does not auto-recommend brand-private DeepDraw paths", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "12390", trade_name: "外套", trade_path: "blbl&mini / 童装服饰 / 外套" },
  ];

  assert.equal(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades), null);
});

test("product archive trade matching prefers a public path over a brand-private path", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ];
  const trades = [
    { trade_id: "68", trade_name: "外套", trade_path: "童装婴幼儿服装 / 外套" },
    { trade_id: "12390", trade_name: "外套", trade_path: "blbl&mini / 童装服饰 / 外套" },
  ];

  assert.equal(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades)?.tradeId, "68");
});

const BALA_TRADE_TEST_PLATFORMS = "ALIBABA,PDD,TAOBAO,KUAISHOU";

function deepdrawRoot(tradeId, tradeName) {
  return {
    trade_id: tradeId,
    parent_trade_id: null,
    trade_name: tradeName,
    trade_path: tradeName,
  };
}

function deepdrawChild(tradeId, parentTradeId, tradeName, tradePath) {
  return {
    trade_id: tradeId,
    parent_trade_id: parentTradeId,
    trade_name: tradeName,
    trade_path: tradePath,
    third_platforms: BALA_TRADE_TEST_PLATFORMS,
  };
}

function evaluateBalaTrade(service, category, trades, options = {}) {
  return service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": category },
    },
  ], trades, {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-07-16T00:00:00.000Z",
    ...options,
  });
}

test("Bala DeepDraw priority keeps a first-tier semantic match above exact lower-tier matches", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 普通外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("7001", "7", "外套", "童装婴幼儿服装 / 外套"),
    deepdrawRoot("3245", "尿片/洗护/喂哺/推车床"),
    deepdrawChild("3245001", "3245", "普通外套", "尿片/洗护/喂哺/推车床 / 普通外套"),
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("9631001", "9631", "普通外套", "blbl&mini / 普通外套"),
  ]);

  assert.equal(decision.recommendedTrade?.tradeId, "7001");
  assert.match(decision.reason, /第一优先级.*童装婴幼儿服装/);
});

test("Bala DeepDraw priority falls through to the second tier through parent IDs", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "母婴 > 奶瓶", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("7001", "7", "凉鞋", "童装婴幼儿服装 / 凉鞋"),
    deepdrawRoot("3245", "尿片/洗护/喂哺/推车床"),
    deepdrawChild("3245001", "3245", "奶瓶", "尿片/洗护/喂哺/推车床 / 奶瓶"),
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("9631001", "9631", "奶瓶", "blbl&mini / 奶瓶"),
  ]);

  assert.equal(decision.recommendedTrade?.tradeId, "3245001");
  assert.match(decision.reason, /第二优先级.*尿片\/洗护\/喂哺\/推车床/);
});

test("Bala DeepDraw priority uses blbl&mini only as the final fallback", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 普通外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("7001", "7", "凉鞋", "童装婴幼儿服装 / 凉鞋"),
    deepdrawRoot("3245", "尿片/洗护/喂哺/推车床"),
    deepdrawChild("3245001", "3245", "奶瓶", "尿片/洗护/喂哺/推车床 / 奶瓶"),
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("9631001", "9631", "普通外套", "blbl&mini / 普通外套"),
  ]);

  assert.equal(decision.recommendedTrade?.tradeId, "9631001");
  assert.match(decision.reason, /兜底优先级.*blbl&mini/);
});

test("Bala DeepDraw priority searches the official leaf before falling back to blbl&mini", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装>>连身衣/爬服/哈衣",
        "发布类目 (唯品)": "哈衣/爬服/连体服",
        "主款式 （唯品四级品类）": "长袖连体衣",
        "发布类目 (抖音)": "服饰内衣>服饰>童装 >婴儿连身衣/爬服/哈衣",
      },
    },
  ];
  const trades = [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("10114", "7", "儿童家居服", "童装婴幼儿服装 / 儿童家居服"),
    deepdrawChild("9596", "10114", "家居服连体衣", "童装婴幼儿服装 / 儿童家居服 / 家居服连体衣"),
    deepdrawRoot("9483", "寝具服饰"),
    deepdrawChild("9490", "9483", "连身衣/爬服/哈衣", "寝具服饰 / 连身衣/爬服/哈衣"),
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("16949", "9631", "睡袋/防踢被(VIP连体服)", "blbl&mini / 睡袋/防踢被(VIP连体服)"),
  ].map((trade) => ({
    ...trade,
    third_platforms: trade.trade_id === "9490"
      ? "ALIBABA,TAOBAO,VIP"
      : "ALIBABA,PDD,TAOBAO,KUAISHOU,VIP,DOUYINXSG",
  }));

  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, trades, {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-07-30T00:00:00.000Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "9490");
  assert.equal(decision.matchedField, "官方发布类目");
  assert.equal(decision.matchedValue, "童装/婴儿装/亲子装>>连身衣/爬服/哈衣");
  assert.match(decision.reason, /第一优先级.*寝具服饰/);
});

test("Bala DeepDraw priority skips category candidates whose size template cannot cover SKU sizes", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 普通外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    {
      ...deepdrawChild("7001", "7", "普通外套", "童装婴幼儿服装 / 普通外套"),
      size_options: ["70cm", "75cm"],
    },
    {
      ...deepdrawChild("7002", "7", "外套", "童装婴幼儿服装 / 外套"),
      size_options: ["66cm", "73cm"],
    },
    deepdrawRoot("9631", "blbl&mini"),
    {
      ...deepdrawChild("9631001", "9631", "普通外套", "blbl&mini / 普通外套"),
      size_options: ["70cm", "75cm"],
    },
  ], {
    skus: [{ size_name: "066", size_code: "066" }, { size_name: "073", size_code: "073" }],
  });

  assert.equal(decision.recommendedTrade?.tradeId, "7002");
  assert.equal(decision.status, "auto_applied");
  assert.match(decision.reason, /第一优先级.*童装婴幼儿服装/);
});

test("trade selection explains when every matching category has an incompatible size template", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 普通外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    {
      ...deepdrawChild("7001", "7", "普通外套", "童装婴幼儿服装 / 普通外套"),
      size_options: ["70cm", "75cm"],
    },
  ], {
    skus: [{ size_name: "066", size_code: "066" }],
  });

  assert.equal(decision.status, "manual_selection_required");
  assert.equal(decision.reasonCode, "missing_size_template_coverage");
  assert.match(decision.reason, /尺码模板不能覆盖/);
});

test("trade selection ignores non-SKU size recommendation options when checking coverage", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 普通外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    {
      ...deepdrawChild("7001", "7", "普通外套", "童装婴幼儿服装 / 普通外套"),
      size_options: ["婴童", "文胸"],
    },
  ], {
    skus: [{ size_name: "066", size_code: "066" }],
  });

  assert.equal(decision.recommendedTrade?.tradeId, "7001");
  assert.equal(decision.status, "auto_applied");
});

test("trade selection loads size template options only for relevant candidate trades", async () => {
  const service = await readText(files.draftService);
  const sizeLookupStart = service.indexOf("function deepdrawTradeSizeOptionsById");
  const sizeLookupEnd = service.indexOf("function enrichDeepdrawTradeCandidatesWithSizeOptions", sizeLookupStart);
  const sizeLookup = service.slice(sizeLookupStart, sizeLookupEnd);
  const inferStart = service.indexOf("function inferDeepdrawTradeSelectionFromLaunchPlan");
  const inferEnd = service.indexOf("function appliedTradeForDraft", inferStart);
  const infer = service.slice(inferStart, inferEnd);

  assert.match(service, /function relevantDeepdrawTradeIdsForSizeOptions/);
  assert.match(sizeLookup, /tradeIds:\s*string\[\]/);
  assert.match(sizeLookup, /trade_id in \(\$\{placeholders\}\)/);
  assert.doesNotMatch(
    sizeLookup,
    /where tenant_name = \?\s+and merchant_id = \?\s+order by trade_id, required desc, sale_prop desc, field_id/,
  );
  assert.match(infer, /const sizeCandidateTradeIds = relevantDeepdrawTradeIdsForSizeOptions/);
  assert.match(infer, /deepdrawTradeSizeOptionsById\(db, input\.tenantName, input\.merchantId, sizeCandidateTradeIds\)/);
});

test("Bala DeepDraw priority does not bypass a first-tier ambiguity", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "童装 > 外套", [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("7001", "7", "外套", "童装婴幼儿服装 / A类 / 外套"),
    deepdrawChild("7002", "7", "外套", "童装婴幼儿服装 / B类 / 外套"),
    deepdrawRoot("3245", "尿片/洗护/喂哺/推车床"),
    deepdrawChild("3245001", "3245", "外套", "童装 > 外套"),
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("9631001", "9631", "外套", "童装 > 外套"),
  ]);

  assert.equal(decision.status, "manual_selection_required");
  assert.equal(decision.reasonCode, "ambiguous_match");
  assert.equal(decision.recommendedTrade, null);
  assert.match(decision.reason, /第一优先级/);
});

test("Bala DeepDraw priority uses official category context to break generic leaf ties", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装>儿童内衣裤>内裤",
        "品类": "内裤",
        "小类": "平角裤",
        "性别": "男",
        "年龄段": "中童",
      },
    },
  ], [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("331", "7", "内裤", "童装婴幼儿服装 / 儿童内衣裤 / 内裤"),
    deepdrawChild("9664", "7", "内裤", "童装婴幼儿服装 / 中大童 / 内裤"),
    deepdrawChild("9689", "7", "内裤", "童装婴幼儿服装 / 男童 / 内裤"),
  ], {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-19T09:47:40.900Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "331");
  assert.equal(decision.reasonCode, "unique_high_confidence");
  assert.equal(decision.matchedField, "官方发布类目");
});

test("Bala DeepDraw priority uses source context when same leaf candidates remain otherwise tied", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童鞋/亲子鞋>运动鞋",
        "品类": "鞋",
        "性别": "女",
        "年龄段": "中童",
      },
    },
  ], [
    deepdrawRoot("531", "童鞋/亲子鞋"),
    deepdrawChild("53101", "531", "运动鞋", "童鞋/亲子鞋 / 男童鞋 / 运动鞋"),
    deepdrawChild("53102", "531", "运动鞋", "童鞋/亲子鞋 / 女童鞋 / 运动鞋"),
  ], {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-19T09:47:40.900Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "53102");
  assert.notEqual(decision.reasonCode, "ambiguous_match");
});

test("Bala DeepDraw priority prefers the more specific leaf contained by an official category", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童鞋/婴儿鞋/亲子鞋>>拖鞋>>儿童棉拖鞋",
        "发布类目 (抖音)": "鞋靴箱包>鞋靴>童鞋>棉鞋",
        "主款式 （唯品四级品类）": "一脚蹬",
      },
    },
  ], [
    deepdrawRoot("531", "童鞋/亲子鞋"),
    deepdrawChild("536", "531", "拖鞋", "童鞋/亲子鞋 / 拖鞋"),
    deepdrawChild("16719", "531", "棉拖鞋", "童鞋/亲子鞋 / 棉拖鞋"),
    deepdrawChild("535", "531", "棉鞋", "童鞋/亲子鞋 / 棉鞋"),
  ].map((trade) => ({
    ...trade,
    third_platforms: BALA_TRADE_TEST_PLATFORMS,
  })), {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T10:36:49.153Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "16719");
  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.reasonCode, "unique_high_confidence");
  assert.equal(decision.matchedField, "官方发布类目");
});

test("Bala DeepDraw priority falls back to the neutral shoe leaf when launch rows mix genders", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = ["男", "女"].map((gender) => ({
    source_type: "launch_plan",
    source_batch_id: 14,
    row_json: {
      "官方发布类目": "童鞋/婴儿鞋/亲子鞋>>婴幼童鞋>>学步鞋",
      "发布类目 (唯品)": "学步鞋",
      "主款式 （唯品四级品类）": "板鞋",
      "发布类目 (抖音)": "鞋靴箱包>鞋靴>童鞋>儿童学步鞋",
      "小类": "学步鞋",
      "性别": gender,
      "年龄段": "婴童",
    },
  }));
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, [
    deepdrawRoot("531", "童鞋/亲子鞋"),
    deepdrawChild("538", "531", "学步鞋", "童鞋/亲子鞋 / 学步鞋"),
    deepdrawChild("10167", "10159", "学步鞋", "童鞋/亲子鞋 / 男童鞋 / 学步鞋"),
    deepdrawChild("10183", "10160", "学步鞋", "童鞋/亲子鞋 / 女童鞋 / 学步鞋"),
  ].map((trade) => ({
    ...trade,
    third_platforms: BALA_TRADE_TEST_PLATFORMS,
  })), {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T10:37:11.971Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "538");
  assert.equal(decision.status, "auto_applied");
  assert.notEqual(decision.reasonCode, "ambiguous_match");
});

test("Bala DeepDraw priority excludes exact matches outside the approved scopes", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = evaluateBalaTrade(service, "女装 > 连衣裙", [
    deepdrawRoot("999", "女装"),
    deepdrawChild("999001", "999", "连衣裙", "女装 / 连衣裙"),
  ]);

  assert.equal(decision.status, "manual_selection_required");
  assert.equal(decision.recommendedTrade, null);
});

test("Bala DeepDraw priority allows only the approved children under sports root 888", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const approved = evaluateBalaTrade(service, "儿童泳衣/裤 > 连体泳衣", [
    deepdrawRoot("888", "运动/瑜伽/健身/球迷用品"),
    deepdrawChild("461", "888", "游泳", "运动/瑜伽/健身/球迷用品 / 游泳"),
    deepdrawChild("6744", "461", "儿童泳衣/裤", "运动/瑜伽/健身/球迷用品 / 游泳 / 儿童泳衣/裤"),
    deepdrawChild("6744001", "6744", "连体泳衣", "运动/瑜伽/健身/球迷用品 / 游泳 / 儿童泳衣/裤 / 连体泳衣"),
  ]);
  const excluded = evaluateBalaTrade(service, "成人泳衣 > 连体泳衣", [
    deepdrawRoot("888", "运动/瑜伽/健身/球迷用品"),
    deepdrawChild("461", "888", "游泳", "运动/瑜伽/健身/球迷用品 / 游泳"),
    deepdrawChild("6750", "461", "成人泳衣", "运动/瑜伽/健身/球迷用品 / 游泳 / 成人泳衣"),
    deepdrawChild("6750001", "6750", "连体泳衣", "运动/瑜伽/健身/球迷用品 / 游泳 / 成人泳衣 / 连体泳衣"),
  ]);

  assert.equal(approved.recommendedTrade?.tradeId, "6744001");
  assert.match(approved.reason, /第一优先级.*儿童泳衣\/裤/);
  assert.equal(excluded.recommendedTrade, null);
});

test("Bala DeepDraw priority allows only male and female kids shoes under root 891", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const approved = evaluateBalaTrade(service, "男童鞋 > 运动鞋", [
    deepdrawRoot("891", "运动中性鞋"),
    deepdrawChild("10087", "891", "男童鞋", "运动中性鞋 / 男童鞋"),
    deepdrawChild("1008701", "10087", "运动鞋", "运动中性鞋 / 男童鞋 / 运动鞋"),
  ]);
  const excluded = evaluateBalaTrade(service, "男鞋 > 运动鞋", [
    deepdrawRoot("891", "运动中性鞋"),
    deepdrawChild("900", "891", "男鞋", "运动中性鞋 / 男鞋"),
    deepdrawChild("900001", "900", "运动鞋", "运动中性鞋 / 男鞋 / 运动鞋"),
  ]);

  assert.equal(approved.recommendedTrade?.tradeId, "1008701");
  assert.match(approved.reason, /第一优先级.*男童鞋/);
  assert.equal(excluded.recommendedTrade, null);
});

test("Bala DeepDraw priority includes every remaining approved root and narrow branch", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const cases = [
    {
      expectedTradeId: "531001",
      expectedPriority: "第一优先级",
      category: "童鞋",
      trades: [
        deepdrawRoot("531", "童鞋/亲子鞋"),
        deepdrawChild("531001", "531", "童鞋", "童鞋/亲子鞋 / 童鞋"),
      ],
    },
    {
      expectedTradeId: "9483001",
      expectedPriority: "第一优先级",
      category: "儿童睡衣",
      trades: [
        deepdrawRoot("9483", "寝具服饰"),
        deepdrawChild("9483001", "9483", "儿童睡衣", "寝具服饰 / 儿童睡衣"),
      ],
    },
    {
      expectedTradeId: "3525001",
      expectedPriority: "第二优先级",
      category: "婴儿床品",
      trades: [
        deepdrawRoot("3525", "婴幼儿寝具"),
        deepdrawChild("3525001", "3525", "婴儿床品", "婴幼儿寝具 / 婴儿床品"),
      ],
    },
    {
      expectedTradeId: "893001",
      expectedPriority: "第二优先级",
      category: "益智玩具",
      trades: [
        deepdrawRoot("893", "玩具/模型/动漫/早教/益智"),
        deepdrawChild("893001", "893", "益智玩具", "玩具/模型/动漫/早教/益智 / 益智玩具"),
      ],
    },
    {
      expectedTradeId: "6741",
      expectedPriority: "第一优先级",
      category: "亲子家庭装",
      trades: [
        deepdrawRoot("888", "运动/瑜伽/健身/球迷用品"),
        deepdrawChild("461", "888", "游泳", "运动/瑜伽/健身/球迷用品 / 游泳"),
        deepdrawChild("6741", "461", "亲子家庭装", "运动/瑜伽/健身/球迷用品 / 游泳 / 亲子家庭装"),
      ],
    },
    {
      expectedTradeId: "905",
      expectedPriority: "第一优先级",
      category: "女童鞋",
      trades: [
        deepdrawRoot("891", "运动中性鞋"),
        deepdrawChild("905", "891", "女童鞋", "运动中性鞋 / 女童鞋"),
      ],
    },
  ];

  for (const item of cases) {
    const decision = evaluateBalaTrade(service, item.category, item.trades);
    assert.equal(decision.recommendedTrade?.tradeId, item.expectedTradeId, item.category);
    assert.match(decision.reason, new RegExp(item.expectedPriority), item.category);
  }
});

test("Bala DeepDraw candidate ancestry and tenant context flow through the shared inference boundary", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const serviceSource = await readFile(files.draftService, "utf8");
  let candidateSql = "";
  const fakeDb = {
    prepare(sql) {
      candidateSql = sql;
      return { all: () => [] };
    },
  };

  service.listDeepdrawTradeSelectionCandidates(fakeDb, "电商巴拉巴拉", "1162");

  assert.match(candidateSql, /trade\.parent_trade_id/);
  assert.match(serviceSource, /tenantName:\s*input\.tenantName,[\s\S]{0,160}appliedTrade:\s*input\.appliedTrade/);
});

test("product archive trade matching requires every launch-plan platform to map before preferring a trade", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208326105206",
        "年龄段": "幼童",
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (唯品)": "婴幼外套/风衣",
        "主款式 （唯品四级品类）": "夹棉外套",
        "发布类目 (抖音)": "服饰内衣>服饰>童装 > 其他外套",
      },
    },
  ];
  const everyPlatform = "ALIBABA,PDD,TAOBAO,KUAISHOU,DOUYIN,VIP";
  const trades = [
    {
      trade_id: "12390",
      trade_name: "外套",
      trade_path: "blbl&mini / 童装服饰 / 外套",
      third_platforms: "",
    },
    {
      trade_id: "9647",
      trade_name: "外套",
      trade_path: "童装婴幼儿服装 / 中大童 / 外套",
      third_platforms: everyPlatform,
    },
    {
      trade_id: "68",
      trade_name: "外套",
      trade_path: "童装婴幼儿服装 / 外套",
      third_platforms: everyPlatform,
    },
    {
      trade_id: "89",
      trade_name: "外套",
      trade_path: "运动女装 / 外套",
      third_platforms: everyPlatform,
    },
  ];

  assert.deepEqual(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades), {
    tradeId: "68",
    tradePath: "童装婴幼儿服装 / 外套",
    confidence: "medium",
    matchedField: "官方发布类目",
    matchedValue: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
  });
});

test("trade selection decision auto-applies a unique high-confidence category", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const evaluatedAt = "2026-07-15T00:00:00.000Z";
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" },
    },
  ], [
    {
      trade_id: "12390",
      trade_name: "普通外套",
      trade_path: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
      third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
    },
  ], { evaluatedAt });

  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.confidence, "high");
  assert.equal(decision.reasonCode, "unique_high_confidence");
  assert.deepEqual(decision.recommendedTrade, {
    tradeId: "12390",
    tradePath: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
  });
  assert.equal(decision.appliedTrade, null);
  assert.deepEqual(decision.requiredPlatforms, ["ALIBABA", "PDD", "TAOBAO", "KUAISHOU"]);
  assert.deepEqual(decision.coveredPlatforms, ["ALIBABA", "KUAISHOU", "PDD", "TAOBAO"]);
  assert.equal(decision.sourceConflict, false);
  assert.equal(decision.evaluatedAt, evaluatedAt);
  assert.equal(decision.confirmedAt, null);
});

test("trade selection decision requires confirmation when the applied category differs from a high-confidence recommendation", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装 > 外套" },
    },
  ], [
    {
      trade_id: "68",
      trade_name: "外套",
      trade_path: "童装 > 外套",
      third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
    },
  ], {
    appliedTrade: { tradeId: "12390", tradePath: "blbl&mini > 童装服饰 > 外套" },
    evaluatedAt: "2026-07-15T00:00:00.000Z",
  });

  assert.equal(decision.confidence, "high");
  assert.equal(decision.recommendedTrade?.tradeId, "68");
  assert.equal(decision.appliedTrade?.tradeId, "12390");
  assert.equal(decision.status, "pending_confirmation");
  assert.equal(decision.reasonCode, "applied_trade_mismatch");
  assert.match(decision.reason, /当前已应用类目.*推荐类目.*人工确认/);
});

test("trade selection decision auto-applies a medium-confidence category", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (唯品)": "婴幼外套/风衣",
        "主款式 （唯品四级品类）": "夹棉外套",
        "发布类目 (抖音)": "服饰内衣>服饰>童装 > 其他外套",
      },
    },
  ], [
    {
      trade_id: "68",
      trade_name: "外套",
      trade_path: "童装婴幼儿服装 / 外套",
      third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU,DOUYIN,VIP",
    },
  ], { evaluatedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.confidence, "medium");
  assert.equal(decision.reasonCode, "medium_confidence");
  assert.equal(decision.recommendedTrade?.tradeId, "68");
  assert.deepEqual(decision.requiredPlatforms, [
    "ALIBABA",
    "PDD",
    "TAOBAO",
    "KUAISHOU",
    "VIP",
    "DOUYIN|DOUYINXSG",
  ]);
  assert.match(decision.reason, /置信度中|人工确认|自动选中/);
});

test("trade selection decision auto-applies conflicting source categories with traceable reason", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装 > 外套 > 普通外套" },
    },
    {
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装 > 外套 > 夹棉外套" },
    },
  ], [
    {
      trade_id: "12390",
      trade_name: "普通外套",
      trade_path: "童装 > 外套 > 普通外套",
      third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
    },
  ], { evaluatedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.reasonCode, "source_category_conflict");
  assert.equal(decision.sourceConflict, true);
  assert.equal(decision.recommendedTrade?.tradeId, "12390");
  assert.match(decision.reason, /多个不同值|冲突提示|自动选中/);
});

test("trade selection decision ignores older launch-plan batches for the same SPU", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = "ALIBABA,PDD,TAOBAO,KUAISHOU";
  const sourceRows = [
    {
      source_batch_id: 10,
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装 > 外套" },
    },
    {
      source_batch_id: 11,
      source_type: "launch_plan",
      row_json: { "官方发布类目": "童装 > 裤子" },
    },
  ];
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, [
    { trade_id: "1", trade_name: "外套", trade_path: "童装 > 外套", third_platforms: platforms },
    { trade_id: "2", trade_name: "裤子", trade_path: "童装 > 裤子", third_platforms: platforms },
  ], { evaluatedAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(decision.sourceConflict, false);
  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.recommendedTrade?.tradeId, "2");
  assert.deepEqual(service.buildLaunchPlanCategoryReference(sourceRows).fields, [
    { key: "officialCategory", label: "官方发布类目", value: "童装 > 裤子" },
  ]);
});

test("trade selection falls back to older non-empty platform categories when the latest launch batch is partial", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = "ALIBABA,PDD,TAOBAO,KUAISHOU";
  const sourceRows = [
    {
      source_batch_id: 10,
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装 > 外套",
        "品类": "外套",
      },
    },
    {
      source_batch_id: 11,
      source_type: "launch_plan",
      row_json: {
        "品类": "羽绒服",
        "性别": "女",
      },
    },
  ];
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, [
    { trade_id: "68", trade_name: "外套", trade_path: "童装 > 外套", third_platforms: platforms },
    { trade_id: "88", trade_name: "裤子", trade_path: "童装 > 裤子", third_platforms: platforms },
  ], { evaluatedAt: "2026-08-21T00:00:00.000Z" });

  assert.equal(decision.status, "auto_applied");
  assert.equal(decision.recommendedTrade?.tradeId, "68");
  assert.equal(decision.matchedField, "官方发布类目");
  assert.deepEqual(service.buildLaunchPlanCategoryReference(sourceRows).fields, [
    { key: "officialCategory", label: "官方发布类目", value: "童装 > 外套" },
    { key: "planCategory", label: "上市计划品类", value: "羽绒服" },
  ]);
});

test("trade selection can recommend from generic launch-plan category and gender context", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_batch_id: 16,
      source_type: "launch_plan",
      row_json: {
        "品类": "运动鞋",
        "性别": "女",
      },
    },
  ];
  const trades = [
    deepdrawRoot("531", "童鞋/亲子鞋"),
    deepdrawChild("10167", "531", "运动鞋", "童鞋/亲子鞋 / 男童鞋 / 运动鞋"),
    deepdrawChild("10183", "531", "运动鞋", "童鞋/亲子鞋 / 女童鞋 / 运动鞋"),
  ].map((trade) => ({
    ...trade,
    third_platforms: BALA_TRADE_TEST_PLATFORMS,
  }));
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, trades, {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T00:00:00.000Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "10183");
  assert.equal(decision.reasonCode, "medium_confidence");
  assert.equal(decision.matchedField, "上市计划品类");
  assert.equal(decision.matchedValue, "运动鞋");
});

test("trade selection expands launch-plan category aliases used by production batches", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = BALA_TRADE_TEST_PLATFORMS;
  const cases = [
    {
      category: "毛衫",
      gender: "男",
      expectedTradeId: "9673",
      trades: [
        deepdrawRoot("7", "童装婴幼儿服装"),
        deepdrawChild("9669", "7", "男童", "童装婴幼儿服装 / 男童"),
        deepdrawChild("58", "7", "毛衣", "童装婴幼儿服装 / 毛衣"),
        deepdrawChild("9673", "9669", "毛衣", "童装婴幼儿服装 / 男童 / 毛衣"),
      ],
    },
    {
      category: "宝宝鞋",
      gender: "中性",
      expectedTradeId: "538",
      trades: [
        deepdrawRoot("531", "童鞋/亲子鞋"),
        deepdrawChild("538", "531", "学步鞋", "童鞋/亲子鞋 / 学步鞋"),
        deepdrawRoot("9483", "寝具服饰"),
        deepdrawChild("9486", "9483", "婴儿鞋帽袜", "寝具服饰 / 婴儿鞋帽袜"),
      ],
    },
    {
      category: "外出连体衣",
      gender: "中性",
      expectedTradeId: "9490",
      trades: [
        deepdrawRoot("9483", "寝具服饰"),
        deepdrawChild("9490", "9483", "连身衣/爬服/哈衣", "寝具服饰 / 连身衣/爬服/哈衣"),
      ],
    },
  ];

  for (const item of cases) {
    const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
      {
        source_batch_id: 16,
        source_type: "launch_plan",
        row_json: { "品类": item.category, "性别": item.gender },
      },
    ], item.trades.map((trade) => ({ ...trade, third_platforms: platforms })), {
      tenantName: "电商巴拉巴拉",
      evaluatedAt: "2026-08-21T00:00:00.000Z",
    });
    assert.equal(decision.recommendedTrade?.tradeId, item.expectedTradeId, item.category);
    assert.equal(decision.matchedField, "上市计划品类", item.category);
  }
});

test("trade selection breaks generic launch-plan ties with child-apparel context", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = BALA_TRADE_TEST_PLATFORMS;
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_batch_id: 16,
      source_type: "launch_plan",
      row_json: { "品类": "内裤", "性别": "女" },
    },
  ], [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("9641", "7", "中大童", "童装婴幼儿服装 / 中大童"),
    deepdrawChild("10113", "7", "儿童内衣裤", "童装婴幼儿服装 / 儿童内衣裤"),
    deepdrawChild("9669", "7", "男童", "童装婴幼儿服装 / 男童"),
    deepdrawChild("9664", "9641", "内裤", "童装婴幼儿服装 / 中大童 / 内裤"),
    deepdrawChild("331", "10113", "内裤", "童装婴幼儿服装 / 儿童内衣裤 / 内裤"),
    deepdrawChild("9689", "9669", "内裤", "童装婴幼儿服装 / 男童 / 内裤"),
  ].map((trade) => ({ ...trade, third_platforms: platforms })), {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T00:00:00.000Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "331");
  assert.notEqual(decision.reasonCode, "ambiguous_match");
});

test("trade selection uses non-official category context to resolve a generic official leaf", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = BALA_TRADE_TEST_PLATFORMS;
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_batch_id: 14,
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装>>裤子",
        "品类": "长裤",
        "小类": "牛仔长裤",
        "主款式 （唯品四级品类）": "牛仔裤",
        "性别": "女",
      },
    },
  ], [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("9641", "7", "中大童", "童装婴幼儿服装 / 中大童"),
    deepdrawChild("72", "7", "裤子", "童装婴幼儿服装 / 裤子"),
    deepdrawChild("11740", "9641", "牛仔裤", "童装婴幼儿服装 / 中大童 / 牛仔裤"),
  ].map((trade) => ({ ...trade, third_platforms: platforms })), {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T00:00:00.000Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "11740");
  assert.notEqual(decision.reasonCode, "ambiguous_match");
});

test("trade selection resolves long-pants ties from full production launch-plan context", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const platforms = `${BALA_TRADE_TEST_PLATFORMS},VIP,DOUYINXSG`;
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    {
      source_batch_id: 14,
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装>裤子（新）>运动裤卫裤",
        "发布类目 (唯品)": "婴幼裤子",
        "主款式 （唯品四级品类）": "灯笼裤",
        "发布类目 (抖音)": "服饰内衣>服饰>童装 >休闲裤",
        "品类": "长裤",
        "小类": "针织长裤",
        "性别": "男",
        "年龄段": "幼童",
      },
    },
  ], [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("9641", "7", "中大童", "童装婴幼儿服装 / 中大童"),
    deepdrawChild("9778", "7", "中性童装", "童装婴幼儿服装 / 中性童装"),
    deepdrawChild("9659", "9641", "长裤", "童装婴幼儿服装 / 中大童 / 长裤"),
    deepdrawChild("10962", "9778", "长裤", "童装婴幼儿服装 / 中性童装 / 长裤"),
    deepdrawChild("11728", "9641", "灯笼裤", "童装婴幼儿服装 / 中大童 / 灯笼裤"),
    deepdrawChild("11739", "9641", "休闲裤", "童装婴幼儿服装 / 中大童 / 休闲裤"),
  ].map((trade) => ({ ...trade, third_platforms: platforms })), {
    tenantName: "电商巴拉巴拉",
    evaluatedAt: "2026-08-21T00:00:00.000Z",
  });

  assert.equal(decision.recommendedTrade?.tradeId, "9659");
  assert.notEqual(decision.reasonCode, "ambiguous_match");
});

test("source-derived fields use the latest launch-plan batch for repeated SPU uploads", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_batch_id: 10,
      source_type: "launch_plan",
      row_json: { "颜色名称": "旧蓝色" },
    },
    {
      source_batch_id: 11,
      source_type: "launch_plan",
      row_json: { "颜色名称": "新粉色" },
    },
  ];

  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("颜色", {
    spu: { spu_code: "208426100001" },
    sourceRows,
    sourceField: "颜色",
  }), "新粉色");
});

test("trade selection decision explains every manual-selection outcome", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const evaluatedAt = "2026-07-15T00:00:00.000Z";
  const sourceRows = [{
    source_type: "launch_plan",
    row_json: { "官方发布类目": "童装 > 袜子" },
  }];
  const platforms = "ALIBABA,PDD,TAOBAO,KUAISHOU";
  const cases = [
    {
      expected: "missing_source_category",
      sourceRows: [],
      trades: [{ trade_id: "1", trade_name: "外套", trade_path: "童装 > 外套", third_platforms: platforms }],
    },
    {
      expected: "missing_platform_coverage",
      sourceRows,
      trades: [{ trade_id: "1", trade_name: "袜子", trade_path: "童装 > 袜子", third_platforms: "ALIBABA" }],
    },
    {
      expected: "missing_semantic_match",
      sourceRows,
      trades: [{ trade_id: "1", trade_name: "外套", trade_path: "成人 > 外套", third_platforms: platforms }],
    },
    {
      expected: "ambiguous_match",
      sourceRows: [{ source_type: "launch_plan", row_json: { "官方发布类目": "童装 > 外套" } }],
      trades: [
        { trade_id: "1", trade_name: "外套", trade_path: "A类 > 外套", third_platforms: platforms },
        { trade_id: "2", trade_name: "外套", trade_path: "B类 > 外套", third_platforms: platforms },
      ],
    },
  ];

  for (const item of cases) {
    const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(item.sourceRows, item.trades, { evaluatedAt });
    assert.equal(decision.status, "manual_selection_required", item.expected);
    assert.equal(decision.confidence, "none", item.expected);
    assert.equal(decision.reasonCode, item.expected, item.expected);
    assert.equal(decision.recommendedTrade, null, item.expected);
    assert.equal(decision.evaluatedAt, evaluatedAt, item.expected);
    assert.ok(decision.reason, item.expected);
  }
});

test("trade selection decision records human confirmation or adjustment from the applied category", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const evaluatedAt = "2026-07-15T00:00:00.000Z";
  const confirmedAt = "2026-07-15T01:00:00.000Z";
  const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows([
    { source_type: "launch_plan", row_json: { "官方发布类目": "童装 > 外套" } },
  ], [
    {
      trade_id: "68",
      trade_name: "外套",
      trade_path: "童装 > 外套",
      third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
    },
  ], { evaluatedAt });

  const confirmed = service.applyHumanTradeSelectionDecision(decision, {
    tradeId: "68",
    tradePath: "童装 > 外套",
  }, confirmedAt);
  assert.equal(confirmed.status, "human_confirmed");
  assert.equal(confirmed.reasonCode, "human_confirmed");
  assert.equal(confirmed.confirmedAt, confirmedAt);
  assert.equal(confirmed.appliedTrade?.tradeId, "68");

  const adjusted = service.applyHumanTradeSelectionDecision(decision, {
    tradeId: "99",
    tradePath: "童装 > 其他外套",
  }, confirmedAt);
  assert.equal(adjusted.status, "human_adjusted");
  assert.equal(adjusted.reasonCode, "human_adjusted");
  assert.equal(adjusted.confirmedAt, confirmedAt);
  assert.equal(adjusted.appliedTrade?.tradeId, "99");
  assert.equal(adjusted.recommendedTrade?.tradeId, "68");
});

test("trade selection decision preserves human adjustment but resets stale confirmation", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const evaluated = {
    status: "auto_applied",
    confidence: "medium",
    reasonCode: "medium_confidence",
    recommendedTrade: { tradeId: "2", tradePath: "童装 > 新推荐" },
    appliedTrade: { tradeId: "9", tradePath: "童装 > 人工类目" },
    matchedField: "官方发布类目",
    matchedValue: "童装 > 新推荐",
    requiredPlatforms: ["ALIBABA"],
    coveredPlatforms: ["ALIBABA"],
    sourceConflict: false,
    reason: "已根据当前上市计划类目证据自动选中深绘类目，置信度中，保留人工确认提示。",
    evaluatedAt: "2026-07-15T02:00:00.000Z",
    confirmedAt: null,
  };
  const persisted = {
    ...evaluated,
    status: "human_adjusted",
    reasonCode: "human_adjusted",
    recommendedTrade: { tradeId: "1", tradePath: "童装 > 旧推荐" },
    confirmedAt: "2026-07-15T01:00:00.000Z",
  };

  const adjusted = service.mergeTradeSelectionHumanState(evaluated, persisted);
  assert.equal(adjusted.status, "human_adjusted");
  assert.equal(adjusted.recommendedTrade?.tradeId, "2");
  assert.equal(adjusted.appliedTrade?.tradeId, "9");

  const staleConfirmation = service.mergeTradeSelectionHumanState(evaluated, {
    ...persisted,
    status: "human_confirmed",
    reasonCode: "human_confirmed",
    appliedTrade: { tradeId: "1", tradePath: "童装 > 旧推荐" },
  });
  assert.equal(staleConfirmation.status, "auto_applied");
  assert.equal(staleConfirmation.reasonCode, "medium_confidence");
  assert.equal(staleConfirmation.confirmedAt, null);
});

test("trade selection decision preserves the manual-confirmation gate for legacy backfills", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const evaluated = {
    status: "auto_applied",
    confidence: "high",
    reasonCode: "unique_high_confidence",
    recommendedTrade: { tradeId: "68", tradePath: "童装 > 外套" },
    appliedTrade: { tradeId: "68", tradePath: "童装 > 外套" },
    matchedField: "官方发布类目",
    matchedValue: "童装 > 外套",
    requiredPlatforms: ["ALIBABA"],
    coveredPlatforms: ["ALIBABA"],
    sourceConflict: false,
    reason: "第一优先级「童装婴幼儿服装」命中。已根据官方发布类目唯一匹配并自动应用深绘类目，置信度高。",
    evaluatedAt: "2026-07-15T02:00:00.000Z",
    confirmedAt: null,
  };
  const persisted = {
    ...evaluated,
    status: "pending_confirmation",
    reasonCode: "legacy_backfill_confirmation_required",
    reason: "旧草稿已按最新规则应用推荐类目，等待人工确认。",
  };

  const merged = service.mergeTradeSelectionHumanState(evaluated, persisted);
  assert.equal(merged.status, "pending_confirmation");
  assert.equal(merged.reasonCode, "legacy_backfill_confirmation_required");
  assert.match(merged.reason, /第一优先级.*童装婴幼儿服装/);
  assert.match(merged.reason, /旧草稿/);
});

test("automatic trade refresh does not overwrite a human-adjusted draft", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{ source_type: "launch_plan", row_json: { "官方发布类目": "童装 > 外套" } }];
  const recommendedTrade = { tradeId: "68", tradePath: "童装 > 外套" };
  const automaticDecision = {
    status: "pending_confirmation",
    confidence: "medium",
    reasonCode: "medium_confidence",
    recommendedTrade,
    appliedTrade: null,
    matchedField: "官方发布类目",
    matchedValue: "童装 > 外套",
    requiredPlatforms: ["ALIBABA", "PDD", "TAOBAO", "KUAISHOU"],
    coveredPlatforms: ["ALIBABA", "KUAISHOU", "PDD", "TAOBAO"],
    sourceConflict: false,
    reason: "已自动应用推荐类目，但当前为中置信度，需要人工确认。",
    evaluatedAt: "2026-07-15T00:00:00.000Z",
    confirmedAt: null,
  };
  const draft = {
    id: 101,
    spu_code: "SPU001",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    trade_id: "99",
    trade_path: "童装 > 人工类目",
    source_snapshot_json: {
      sourceRows,
      tradeSelection: {
        ...automaticDecision,
        status: "human_adjusted",
        reasonCode: "human_adjusted",
        appliedTrade: { tradeId: "99", tradePath: "童装 > 人工类目" },
        confirmedAt: "2026-07-15T01:00:00.000Z",
      },
    },
    validation_summary_json: {},
  };
  const trade = {
    trade_id: "68",
    trade_name: "外套",
    trade_path: "童装 > 外套",
    third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
  };
  const tradeUpdateSql = [];
  const fakeDb = {
    prepare(sql) {
      return {
        get() {
          return /from deepdraw_trade_cache/i.test(sql) ? trade : draft;
        },
        all() {
          if (/from deepdraw_trade_cache trade/i.test(sql)) return [trade];
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
        run() {
          if (/set\s+trade_id\s*=/i.test(sql)) tradeUpdateSql.push(sql);
          return { changes: 1, lastInsertRowid: null };
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  const result = service.applyProductArchiveDraftTrade(fakeDb, 101, {
    tradeId: recommendedTrade.tradeId,
    tradePath: recommendedTrade.tradePath,
  }, { automaticDecision });

  assert.equal(result.tradeSelectionAutoApplied, false);
  assert.equal(tradeUpdateSql.length, 0);
});

test("source-batch refresh preserves a concurrent human trade adjustment", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{
    source_batch_id: 11,
    source_type: "launch_plan",
    row_json: { "官方发布类目": "童装 > 外套" },
  }];
  const trade = {
    trade_id: "68",
    trade_name: "外套",
    trade_path: "童装 > 外套",
    third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
  };
  const staleDraft = {
    id: 101,
    spu_code: "SPU001",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    trade_id: null,
    trade_path: null,
    status: "draft",
    source_snapshot_json: {
      sourceBatchIds: { launch_plan: [10] },
      tradeSelection: { status: "manual_selection_required" },
    },
    validation_summary_json: {},
  };
  let currentDraft = {
    ...staleDraft,
    trade_id: "99",
    trade_path: "童装 > 人工类目",
    source_snapshot_json: {
      sourceBatchIds: { launch_plan: [10] },
      tradeSelection: {
        status: "human_adjusted",
        reasonCode: "human_adjusted",
        recommendedTrade: null,
        appliedTrade: { tradeId: "99", tradePath: "童装 > 人工类目" },
        confirmedAt: "2026-07-15T01:00:00.000Z",
      },
    },
  };
  const fakeDb = {
    prepare(sql) {
      return {
        get() {
          if (/from deepdraw_trade_cache(?!\s+trade)/i.test(sql)) return trade;
          return currentDraft;
        },
        all() {
          if (/select distinct draft\.\*/i.test(sql)) return [staleDraft];
          if (/from deepdraw_trade_cache trade/i.test(sql)) return [trade];
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
        run(...params) {
          if (/set\s+trade_id\s*=/i.test(sql)) {
            currentDraft = {
              ...currentDraft,
              trade_id: params[0],
              trade_path: params[1],
              source_snapshot_json: JSON.parse(params[2]),
            };
            return { changes: 1, lastInsertRowid: null };
          }
          if (/set\s+source_snapshot_json\s*=/i.test(sql)) {
            const nextSnapshot = JSON.parse(params[0]);
            const expectedSnapshot = params.length >= 5 ? JSON.parse(params[4]) : null;
            if (expectedSnapshot && JSON.stringify(expectedSnapshot) !== JSON.stringify(currentDraft.source_snapshot_json)) {
              return { changes: 0, lastInsertRowid: null };
            }
            currentDraft = { ...currentDraft, source_snapshot_json: nextSnapshot };
          }
          return { changes: 1, lastInsertRowid: null };
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  const result = service.refreshProductArchiveDraftsFromSourceBatch(fakeDb, {
    sourceBatchId: 11,
    sourceType: "launch_plan",
  });

  assert.equal(currentDraft.trade_id, "99");
  assert.equal(currentDraft.source_snapshot_json.tradeSelection.status, "human_adjusted");
  assert.deepEqual(currentDraft.source_snapshot_json.sourceBatchIds.launch_plan, [11]);
  assert.equal(currentDraft.source_snapshot_json.sourceBatchId, 11);
  assert.equal(result.autoAppliedTradeCount, 0);
  assert.equal(result.failedDrafts.length, 0);
});

test("confirming a recommendation rejects a concurrent snapshot change", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{ source_type: "launch_plan", row_json: { "官方发布类目": "童装 > 外套" } }];
  const trade = {
    trade_id: "68",
    trade_name: "外套",
    trade_path: "童装 > 外套",
    third_platforms: "ALIBABA,PDD,TAOBAO,KUAISHOU",
  };
  const draft = {
    id: 101,
    spu_code: "SPU001",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    trade_id: "68",
    trade_path: "童装 > 外套",
    source_snapshot_json: { sourceRows },
    validation_summary_json: {},
  };
  const fakeDb = {
    prepare(sql) {
      return {
        get() {
          return draft;
        },
        all() {
          if (/from deepdraw_trade_cache trade/i.test(sql)) return [trade];
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
        run() {
          if (/set\s+source_snapshot_json\s*=/i.test(sql)) return { changes: 0, lastInsertRowid: null };
          return { changes: 1, lastInsertRowid: null };
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  assert.throws(() => service.confirmProductArchiveDraftRecommendedTrade(fakeDb, 101, {
    recommendedTradeId: "68",
  }), /推荐结果已更新/);
});

test("confirming a legacy recommendation applies the trade and confirms it in one transaction", async () => {
  const service = await readFile(files.draftService, "utf8");
  const start = service.indexOf("export function confirmProductArchiveDraftRecommendedTrade");
  const end = service.indexOf("export function patchProductArchiveDraftFields", start);
  const implementation = service.slice(start, end);

  assert.match(implementation, /return db\.transaction\(\(\) => \{/);
  assert.match(implementation, /update product_archive_draft[\s\S]*set trade_id = \?/);
  assert.match(implementation, /rebuildProductArchiveDraftFields\(db, draftId\)/);
  assert.match(implementation, /validateProductArchiveDraft\(db, draftId\)/);
  assert.match(implementation, /applyHumanTradeSelectionDecision/);
  const applyTradeIndex = implementation.indexOf("update product_archive_draft");
  const rebuildFieldsIndex = implementation.indexOf("rebuildProductArchiveDraftFields(db, draftId)");
  const validateIndex = implementation.indexOf("validateProductArchiveDraft(db, draftId)");
  const recheckRecommendationIndex = implementation.lastIndexOf("currentTradeSelectionDecision(db");
  const confirmIndex = implementation.indexOf("applyHumanTradeSelectionDecision");
  assert.ok(applyTradeIndex < rebuildFieldsIndex, "the recommended trade must be applied before fields are rebuilt");
  assert.ok(rebuildFieldsIndex < validateIndex, "fields must be rebuilt before validation");
  assert.ok(validateIndex < recheckRecommendationIndex, "the recommendation must be rechecked after validation");
  assert.ok(recheckRecommendationIndex < confirmIndex, "the final recommendation check must precede confirmation");
  assert.ok(validateIndex < confirmIndex, "human confirmation must only be persisted after validation");
  assert.doesNotMatch(
    implementation,
    /appliedTrade\.tradeId !== recommendedTradeId\)[\s\S]*throw new Error\("推荐结果已更新/,
  );
});

test("legacy trade backfill only mutates editable drafts and defaults to preview", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  assert.equal(typeof service.isProductArchiveTradeBackfillStatus, "function");
  for (const status of ["draft", "manual_review", "ready"]) {
    assert.equal(service.isProductArchiveTradeBackfillStatus(status), true, status);
  }
  for (const status of ["readback_verified", "duplicate_found", "created", "failed", "missing_fields"]) {
    assert.equal(service.isProductArchiveTradeBackfillStatus(status), false, status);
  }

  const script = await readText(files.tradeBackfillScript);
  const serviceSource = await readText(files.draftService);
  const start = serviceSource.indexOf("export function backfillLegacyProductArchiveDraftTrades");
  const end = serviceSource.indexOf("export function createProductArchiveDraftFromSpu", start);
  const implementation = serviceSource.slice(start, end);
  assert.match(script, /--apply/);
  assert.match(script, /preview/i);
  assert.match(script, /backfillLegacyProductArchiveDraftTrades/);
  assert.match(script, /apply:\s*args\.has\("--apply"\)/);
  assert.match(script, /closeDb/);
  assert.match(script, /finally/);
  assert.match(script, /failedCount[\s\S]*process\.exitCode = 1/);
  assert.match(implementation, /for update/i);
  assert.match(implementation, /status:\s*"pending_confirmation"/);
  assert.match(implementation, /hasHumanTradeSelection/);
  assert.match(implementation, /catch \(error\)/);
  assert.match(implementation, /failedCount/);
});

test("legacy trade backfill includes stale automatic decisions in the Bala preview", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{
    source_type: "launch_plan",
    row_json: { "官方发布类目": "童装 > 外套" },
  }];
  const draft = {
    id: 101,
    draft_no: "PAD-SPU001",
    spu_code: "SPU001",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    status: "manual_review",
    trade_id: "12390",
    trade_path: "blbl&mini / 童装服饰 / 外套",
    source_snapshot_json: {
      sourceRows,
      tradeSelection: {
        status: "manual_selection_required",
        reasonCode: "missing_semantic_match",
      },
    },
  };
  const trades = [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("68", "7", "外套", "童装婴幼儿服装 / 外套"),
  ];
  const fakeDb = {
    prepare(sql) {
      return {
        all() {
          if (/from product_archive_draft/i.test(sql)) {
            return /source_snapshot_json\s*->\s*'tradeSelection'/i.test(sql) ? [] : [draft];
          }
          if (/from deepdraw_trade_cache trade/i.test(sql)) return trades;
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
      };
    },
  };

  const result = service.backfillLegacyProductArchiveDraftTrades(fakeDb);

  assert.equal(result.mode, "preview");
  assert.equal(result.scannedDraftCount, 1);
  assert.equal(result.previewApplyCount, 1);
  assert.equal(result.items[0]?.action, "preview_apply");
  assert.equal(result.items[0]?.recommendedTrade?.tradeId, "68");
});

test("legacy trade backfill preview skips drafts with a human category decision", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{
    source_type: "launch_plan",
    row_json: { "官方发布类目": "童装 > 外套" },
  }];
  const draft = {
    id: 102,
    draft_no: "PAD-SPU002",
    spu_code: "SPU002",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    status: "manual_review",
    trade_id: "12390",
    trade_path: "blbl&mini / 童装服饰 / 外套",
    source_snapshot_json: {
      sourceRows,
      tradeSelection: {
        status: "human_adjusted",
        reasonCode: "human_adjusted",
        appliedTrade: {
          tradeId: "12390",
          tradePath: "blbl&mini / 童装服饰 / 外套",
        },
      },
    },
  };
  const trades = [
    deepdrawRoot("7", "童装婴幼儿服装"),
    deepdrawChild("68", "7", "外套", "童装婴幼儿服装 / 外套"),
  ];
  const fakeDb = {
    prepare(sql) {
      return {
        all() {
          if (/from product_archive_draft/i.test(sql)) return [draft];
          if (/from deepdraw_trade_cache trade/i.test(sql)) return trades;
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
      };
    },
  };

  const result = service.backfillLegacyProductArchiveDraftTrades(fakeDb);

  assert.equal(result.scannedDraftCount, 1);
  assert.equal(result.previewApplyCount, 0);
  assert.equal(result.skippedChangedCount, 1);
  assert.equal(result.items[0]?.action, "skipped_changed");
  assert.match(result.items[0]?.message ?? "", /已有人工选择/);
});

test("legacy trade backfill is idempotent when blbl&mini remains the confirmed fallback", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{
    source_type: "launch_plan",
    row_json: { "官方发布类目": "童装 > 普通外套" },
  }];
  const fallbackTrade = {
    tradeId: "9631001",
    tradePath: "blbl&mini / 普通外套",
  };
  const draft = {
    id: 103,
    draft_no: "PAD-SPU003",
    spu_code: "SPU003",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    status: "manual_review",
    trade_id: fallbackTrade.tradeId,
    trade_path: fallbackTrade.tradePath,
    source_snapshot_json: {
      sourceRows,
      tradeSelection: {
        status: "pending_confirmation",
        reasonCode: "legacy_backfill_confirmation_required",
        recommendedTrade: fallbackTrade,
        appliedTrade: fallbackTrade,
        reason: "兜底优先级「blbl&mini」命中。旧草稿已按最新规则应用推荐类目，等待人工确认。",
      },
    },
  };
  const trades = [
    deepdrawRoot("9631", "blbl&mini"),
    deepdrawChild("9631001", "9631", "普通外套", "blbl&mini / 普通外套"),
  ];
  const fakeDb = {
    prepare(sql) {
      return {
        all() {
          if (/from product_archive_draft/i.test(sql)) return [draft];
          if (/from deepdraw_trade_cache trade/i.test(sql)) return trades;
          if (/from product_archive_source_row/i.test(sql)) return sourceRows;
          return [];
        },
      };
    },
  };

  const result = service.backfillLegacyProductArchiveDraftTrades(fakeDb);

  assert.equal(result.previewApplyCount, 0);
  assert.equal(result.skippedChangedCount, 1);
  assert.equal(result.items[0]?.action, "skipped_changed");
  assert.match(result.items[0]?.message ?? "", /已完成安全回填/);
});

test("product archive trade matching gives official launch category priority over VIP or Douyin category leaves", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (唯品)": "婴幼外套/风衣",
      },
    },
  ];
  const trades = [
    { trade_id: "68", trade_name: "外套", trade_path: "童装婴幼儿服装 / 外套" },
    { trade_id: "12394", trade_name: "风衣", trade_path: "童装婴幼儿服装 / 风衣" },
  ];

  assert.equal(service.chooseDeepdrawTradeFromLaunchPlanRows(sourceRows, trades)?.tradeId, "68");
});

test("product archive service exposes launch-plan category reference fields for manual trade selection", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const reference = service.buildLaunchPlanCategoryReference([
    {
      source_type: "copywriting",
      row_json: { "官方发布类目": "不应展示" },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (唯品)": "婴幼外套/风衣",
        "主款式 （唯品四级品类）": "普通外套",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
        "发布类目 (抖音)": "童装童鞋>童装>外套",
      },
    },
  ]);

  assert.deepEqual(reference, {
    matched: true,
    fields: [
      {
        key: "officialCategory",
        label: "官方发布类目",
        value: "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
      },
      {
        key: "vipCategory",
        label: "唯品发布类目",
        value: "婴幼外套/风衣",
      },
      {
        key: "vipStyleCategory",
        label: "唯品四级品类",
        value: "普通外套",
      },
      {
        key: "douyinCategory",
        label: "抖音发布类目",
        value: "童装童鞋>童装>外套",
      },
    ],
  });
  assert.deepEqual(service.buildLaunchPlanCategoryReference([]), { matched: false, fields: [] });
});

test("product archive draft service resolves merchant identity from DeepDraw credentials and keeps it out of create payload overrides", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /resolveDeepdrawConfig/);
  assert.match(service, /const deepdrawConfig = resolveDeepdrawConfig/);
  assert.match(service, /merchantId = String\(deepdrawConfig\.merchantId\)/);
  assert.doesNotMatch(service, /const merchantId = input\.merchantId \|\| process\.env\.DEEPDRAW_MERCHANT_ID \|\| ""/);
  assert.doesNotMatch(service, /merchantId:\s*stringValue\(draft\.merchant_id\)/);
});

test("product archive draft service blocks ready status when required template and duplicate checks fail", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /deepdraw_template_missing/);
  assert.match(service, /duplicate_product_found/);
  assert.match(service, /sku_color_not_in_template/);
  assert.match(service, /sku_size_not_in_template/);
});

test("product archive validation keeps duplicate hits out of missing-fields status", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(
    service.productArchiveDraftStatusFromValidationIssues([
      { severity: "blocker", issueType: "duplicate_product_found" },
    ]),
    "duplicate_found",
  );
  assert.equal(
    service.productArchiveDraftStatusFromValidationIssues([
      { severity: "blocker", issueType: "required_field_missing" },
    ], [
      { source_type: "manual", validation_status: "missing" },
    ]),
    "manual_review",
  );
  assert.equal(
    service.productArchiveDraftStatusFromValidationIssues([
      { severity: "blocker", issueType: "required_field_missing" },
    ]),
    "missing_fields",
  );
  assert.equal(
    service.productArchiveDraftStatusFromValidationIssues([
      { severity: "warning", issueType: "sku_price_mismatch" },
    ]),
    "ready",
  );
});

test("applying a DeepDraw trade updates the draft fields and validation in one transaction", async () => {
  const source = await readFile(files.draftService, "utf8");
  const start = source.indexOf("export function applyProductArchiveDraftTrade");
  const end = source.indexOf("export function confirmProductArchiveDraftRecommendedTrade", start);
  const implementation = source.slice(start, end);

  assert.match(implementation, /return db\.transaction\(\(\) => \{/);
  assert.match(implementation, /update product_archive_draft[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId(?:, [^)]*)?\)/);
});

test("mutable draft writes keep the row lock and mutation in one transaction", async () => {
  const source = await readFile(files.draftService, "utf8");
  const section = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0, `missing ${startMarker}`);
    assert.ok(end > start, `missing ${endMarker}`);
    return source.slice(start, end);
  };

  const createImage = section(
    "export function createProductArchiveDraftImage",
    "export function deleteProductArchiveDraftImage",
  );
  assert.match(createImage, /return db\.transaction\(\(\) => \{/);
  assert.match(createImage, /assertProductArchiveDraftMutable\(db, input\.draftId\)[\s\S]*insert into product_archive_draft_image[\s\S]*update product_archive_draft set updated_at/);
  assert.doesNotMatch(createImage, /db\.transaction\(\(\) => assertProductArchiveDraftMutable\(db, input\.draftId\)\)\(\)[\s\S]*const draft/);

  const deleteImage = section(
    "export function deleteProductArchiveDraftImage",
    "export function deleteProductArchiveDraft(db",
  );
  assert.match(deleteImage, /return db\.transaction\(\(\) => \{/);
  assert.match(deleteImage, /assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*delete from product_archive_draft_image[\s\S]*update product_archive_draft set updated_at/);
  assert.doesNotMatch(deleteImage, /db\.transaction\(\(\) => assertProductArchiveDraftMutable\(db, draftId\)\)\(\)[\s\S]*const image/);

  const applyTrade = section(
    "export function applyProductArchiveDraftTrade",
    "export function confirmProductArchiveDraftRecommendedTrade",
  );
  assert.match(applyTrade, /return db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId/);
  assert.match(applyTrade, /assertProductArchiveDraftMutable\(db, draftId[\s\S]*update product_archive_draft[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId(?:, [^)]*)?\)/);
  assert.doesNotMatch(applyTrade, /db\.transaction\(\(\) => assertProductArchiveDraftMutable\(db, draftId\)\)\(\)[\s\S]*const draft/);

  const aiFill = section(
    "export async function fillProductArchiveDraftFieldsWithAi",
    "function sizeChartTemplateFieldsForDraft",
  );
  const aiPreparation = aiFill.slice(0, aiFill.indexOf("let aiFills"));
  assert.match(aiPreparation, /const prepared = db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*refreshDraftTradeSelectionFromLaunchPlan\(db, draftId\)[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*syncProductArchiveDownFillWeightSizeCharts\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId\)/);
  assert.ok(
    aiPreparation.indexOf("refreshDraftTradeSelectionFromLaunchPlan(db, draftId)")
      < aiPreparation.indexOf("rebuildProductArchiveDraftFields(db, draftId)"),
    "AI fill must resolve the current launch-plan trade before rebuilding candidate fields",
  );
  assert.doesNotMatch(aiPreparation, /db\.transaction\(\(\) => assertProductArchiveDraftMutable\(db, draftId\)\)\(\)[\s\S]*rebuildProductArchiveDraftFields/);
  assert.match(aiFill, /await callDeepdrawAiFill/);
  assert.match(aiFill, /const validated = db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId\)/);

  const dryRun = section(
    "function prepareProductArchiveDraftDryRun",
    "export async function submitProductArchiveDraft",
  );
  assert.match(dryRun, /return db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*refreshDraftTradeSelectionFromLaunchPlan\(db, draftId\)[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId\)[\s\S]*productPayload\(db, draftId\)/);

  const patchFields = section(
    "export function patchProductArchiveDraftFields",
    "export async function fillProductArchiveDraftFieldsWithAi",
  );
  assert.match(patchFields, /return db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*return validateProductArchiveDraft\(db, draftId(?:, [^)]*)?\)/);
  assert.doesNotMatch(patchFields, /\}\)\(\)\s*return validateProductArchiveDraft\(db, draftId\)/);

  const sizeMappings = section(
    "export function saveProductArchiveSizeChartMappings",
    "function sizeChartAllowedSizes",
  );
  assert.match(sizeMappings, /const validated = db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*return validateProductArchiveDraft\(db, draftId\)/);

  const sourceRefresh = section(
    "export function refreshProductArchiveDraftsFromSourceBatch",
    "export function backfillLegacyProductArchiveDraftTrades",
  );
  assert.match(sourceRefresh, /db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*appendSourceBatchIdToDraft\(db, draftId[\s\S]*(?:refreshDraftTradeSelectionFromLaunchPlan|rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId\))/);

  const submit = section(
    "export async function submitProductArchiveDraft",
    "export async function readbackProductArchiveDraft",
  );
  assert.match(submit, /refreshDraftTradeSelectionFromLaunchPlan\(db, draftId, \{ claimToken \}\)/);
});

test("claimed drafts reject image mutation before any image insert", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  let insertCount = 0;
  const fakeDb = {
    transaction(fn) {
      return fn;
    },
    prepare(sql) {
      return {
        get() {
          if (/select id, status, submit_claim_token/i.test(sql)) {
            return { id: 101, status: "submitting", submit_claim_token: "claim-101" };
          }
          throw new Error(`unexpected read: ${sql}`);
        },
        run() {
          if (/insert into product_archive_draft_image/i.test(sql)) insertCount += 1;
          return { changes: 1, lastInsertRowid: 1 };
        },
      };
    },
  };

  assert.throws(
    () => service.createProductArchiveDraftImage(fakeDb, {
      draftId: 101,
      spuCode: "SPU001",
      sourceType: "manual_upload",
      localPath: "/tmp/image.jpg",
      fileName: "image.jpg",
    }),
    /PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS/,
  );
  assert.equal(insertCount, 0);
});

test("trade refresh and submit preparation keep validation behind the submit fence", async () => {
  const source = await readFile(files.draftService, "utf8");
  const section = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0, `missing ${startMarker}`);
    assert.ok(end > start, `missing ${endMarker}`);
    return source.slice(start, end);
  };

  const refresh = section(
    "export function refreshDraftTradeSelectionFromLaunchPlan",
    "export function refreshProductArchiveDraftsFromSourceBatch",
  );
  assert.match(refresh, /return db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId, \{ claimToken: options\.claimToken \}\)[\s\S]*const draft = draftById\(db, draftId\)/);
  const humanBranch = refresh.slice(
    refresh.indexOf('if (merged.status === "human_adjusted"'),
    refresh.indexOf("if (evaluated.recommendedTrade)"),
  );
  const noMatchBranch = refresh.slice(
    refresh.indexOf("if (evaluated.recommendedTrade)"),
  );
  assert.match(humanBranch, /persistTradeSelectionDecision[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId, \{ claimToken: options\.claimToken \}\)/);
  assert.match(noMatchBranch, /persistTradeSelectionDecision[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId, \{ claimToken: options\.claimToken \}\)/);

  const validation = section(
    "export function validateProductArchiveDraft",
    "export function isStructuredProductPayloadField",
  );
  assert.match(validation, /return db\.transaction\(\(\) => \{\s*assertProductArchiveDraftMutable\(db, draftId, \{ claimToken: options\.claimToken \}\)/);
  assert.match(validation, /updateField\.run[\s\S]*delete from product_archive_validation_issue[\s\S]*insertIssue\.run[\s\S]*const draftUpdate/);
  assert.match(validation, /submit_claim_token = \?[\s\S]*submit_claim_token is null/);
  assert.doesNotMatch(validation, /db\.transaction\(\(\) => \{\s*db\.prepare\("delete from product_archive_validation_issue/);

  const submit = section(
    "export async function submitProductArchiveDraft",
    "export async function readbackProductArchiveDraft",
  );
  assert.match(submit, /const prepared = db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId, \{ claimToken \}\)[\s\S]*refreshDraftTradeSelectionFromLaunchPlan\(db, draftId, \{ claimToken \}\)[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId, \{[\s\S]*claimToken,[\s\S]*allowExistingProduct:[\s\S]*\}\)[\s\S]*productPayload\(db, draftId\)/);
});

test("ordinary validation and trade refresh reject an active submit claim before writes", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fakeDb = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      return {
        get() {
          if (/select id, status, submit_claim_token/i.test(sql)) {
            return { id: 109, status: "submitting", submit_claim_token: "claim-109" };
          }
          throw new Error(`unexpected read after claim assertion: ${sql}`);
        },
      };
    },
  };

  assert.throws(
    () => service.validateProductArchiveDraft(fakeDb, 109),
    /PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS/,
  );
  assert.throws(
    () => service.refreshDraftTradeSelectionFromLaunchPlan(fakeDb, 109),
    /PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS/,
  );
  assert.doesNotThrow(() => service.assertProductArchiveDraftMutable(fakeDb, 109, { claimToken: "claim-109" }));
});

test("product archive draft detail picks one matching template per field", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /left join lateral/);
  assert.match(service, /raw_payload_json #>> '\{attributes,thirdPlatform\}' as third_platform/);
  assert.match(service, /template_third_platform/);
  assert.match(service, /deepdrawPlatformDisplayName/);
  assert.match(service, /tradePlatforms:\s*deepdrawTradePlatformsForDraft/);
  assert.match(service, /template\.field_id = field\.field_id or template\.field_name = field\.field_name/);
  assert.match(service, /order by case when template\.field_id = field\.field_id then 0 else 1 end/);
  assert.match(service, /limit 1/);
});

test("product archive template fields fall back to cached DeepDraw leaf attributes", async () => {
  const [serviceSource, service] = await Promise.all([
    readFile(files.draftService, "utf8"),
    import("../../web/server/services/product-archive-drafts.ts"),
  ]);

  assert.match(serviceSource, /extractDeepdrawTradeFieldRows/);
  assert.match(serviceSource, /fallbackTradeFieldsFromRawPayload/);
  assert.match(serviceSource, /DEEPDRAW_TEMPLATE_FIELD_FALLBACK_THRESHOLD/);
  assert.match(serviceSource, /mergeDeepdrawTemplateFields\(rows,\s*fallbackTradeFieldsFromRawPayload/);
  assert.equal(
    service.productArchiveFieldValueMatchesOptions(
      "粉红",
      [{ attrValueId: 60001, attrValueName: "粉红" }],
      "颜色",
    ),
    true,
  );
});

test("product archive AI fill skips fields that already have JSON values", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /!hasValue\(recordValue\(field\.value_json\)\)/);
  assert.match(service, /rebuildProductArchiveDraftFields\(db, draftId\)/);
  assert.match(service, /fillProductArchiveDraftFieldsWithAi/);
  assert.match(service, /isStaleUnsupportedAiFillField/);
  assert.match(service, /Boolean\(existing\.manual_override\)[\s\S]*!isStaleUnsupportedAiFillField\(fieldName, existing\)[\s\S]*!isStaleMaterialAiRuleFallbackField\(fieldName, existing\)[\s\S]*!isStaleSizeChartScalarOverride\(fieldName, existing\)/);
  assert.match(service, /hasSizeChartValue\s*\?\s*""[\s\S]*skuSizeField/);
});

test("AI fill skips a field changed during provider wait but saves an unchanged field", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const draft = {
    id: 901,
    spu_code: "SPU-AI-901",
    tenant_name: "tenant",
    merchant_id: "merchant",
    trade_id: "trade-901",
    trade_path: "类目 / 901",
    title: "测试商品",
    retail_price: 100,
    status: "ready",
    submit_claim_token: null,
    source_snapshot_json: {
      spu: {
        spu_code: "SPU-AI-901",
        spu_name: "测试商品",
      },
    },
  };
  const fields = [1, 2].map((id) => ({
    id,
    draft_id: draft.id,
    field_name: `风格${id}`,
    field_id: `style-${id}`,
    source_type: "manual",
    source_ref: null,
    value_text: null,
    value_json: {},
    required: true,
    blocking: true,
    manual_override: false,
    validation_status: "missing",
    validation_message: "必填字段缺失",
    updated_at: `2026-08-19T00:00:0${id}.000Z`,
    options_json: [{ value: "休闲" }],
    field_type: "SINGLE_CHOICE",
  }));
  const fieldUpdates = [];
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get() {
          if (/from product_archive_draft/i.test(normalized)) return draft;
          return undefined;
        },
        all() {
          if (/from product_archive_draft_field/i.test(normalized)) return fields;
          return [];
        },
        run(...args) {
          if (/update product_archive_draft_field field/i.test(normalized)) {
            const fieldId = Number(args[6]);
            fieldUpdates.push({ fieldId, args });
            return { changes: fieldId === 1 ? 0 : 1 };
          }
          return { changes: 1 };
        },
      };
    },
  };

  const result = await service.fillProductArchiveDraftFieldsWithAi(db, draft.id, {
    router: {
      callJson: async () => ({
        json: {
          fills: [
            { field_id: 1, field_value: "休闲", confidence: 0.95 },
            { field_id: 2, field_value: "休闲", confidence: 0.95 },
          ],
        },
      }),
    },
  });

  assert.deepEqual(fieldUpdates.map((update) => update.fieldId), [1, 2]);
  assert.deepEqual(result.saved.map((field) => field.field_id), [2]);
  assert.equal(result.warnings.filter((warning) => warning.code === "draft_changed").length, 1);
});

test("product archive AI fill prompt uses trusted draft MDM and source context only", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /const AI_FILL_MIN_CONFIDENCE = 0\.7/);
  assert.match(service, /function buildMdmMasterAiContext\(draft: JsonRecord, mdmSpu: JsonRecord = \{\}\)/);
  assert.match(service, /const snapshotSpu = recordValue\(recordValue\(draft\.source_snapshot_json\)\.spu\)/);
  assert.match(service, /mdm_master: buildMdmMasterAiContext\(input\.draft, input\.mdmSpu\)/);
  assert.match(service, /source_rows: buildSourceRowsAiContext\(input\.sourceRows \?\? \[\]\)/);
  assert.match(service, /filled_fields: buildFilledFieldAiContext\(input\.allFields \?\? \[\], input\.fields\)/);
  assert.match(service, /reference_images: buildReferenceImageAiContext\(input\.referenceImages \?\? \[\]\)/);
  assert.match(service, /buildDeepdrawAiFillMessages\(prompt, referenceImages\)/);
  assert.match(service, /type: "image_url"/);
  assert.match(service, /data:\$\{mimeType\};base64/);
  assert.match(service, /忽略 source_type 为 ai_rule_fallback 的历史值/);
  assert.match(service, /不要因为 options 的顺序选择第一个选项/);
  assert.match(service, /鞋品图案字段在参考图清晰时必须选择最接近的现有枚举/);
  assert.match(service, /服饰图案字段必须依据参考图/);
  assert.match(service, /confidence 低于 \$\{AI_FILL_MIN_CONFIDENCE\} 的字段不要返回/);
  assert.match(service, /if \(!aiFill\) continue/);
  assert.match(service, /if \(!Number\.isFinite\(confidence\) \|\| confidence < AI_FILL_MIN_CONFIDENCE\) continue/);
  assert.match(service, /if \(!fieldValue \|\| !productArchiveFieldValueMatchesOptions\(fieldValue, field\.options, field\.fieldName\)\) continue/);
  assert.match(service, /Array\.isArray\(json\?\.fills\)[\s\S]*json\.fills\.some/);
  assert.doesNotMatch(service, /Array\.isArray\(json\?\.fills\)[\s\S]*json\.fills\.every/);
  assert.match(service, /scenario:\s*"deepdraw_field_fill"/);
  assert.match(service, /source: "AI_SUGGESTED"/);
  assert.match(service, /source_type = \?/);
  assert.match(service, /warnings\.push\(\{[\s\S]*code: "ai_provider_unavailable"/);
  assert.doesNotMatch(service, /options\[0\]/);
});

test("product archive AI fill OCR fallback prefers stored label assets over flat images", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const result = await service.buildProductArchiveAiFillOcrFallback({
    draftId: 917,
    spuCode: "202426103105",
    fields: [
      { id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
      { id: 2, field_name: "安全等级", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [{ label: "B类", value: "B类" }] },
    ],
    images: [
      { id: 11, kind: "reference", local_path: "/tmp/202426103105-flat.jpg", original_file_name: "202426103105-00355.jpg", mime_type: "image/jpeg", raw_payload_json: { asset_kind: "flat_image" } },
      { id: 12, kind: "hangtag", local_path: "/tmp/202426103105-tag.jpg", original_file_name: "202426103105吊牌.jpg", mime_type: "image/jpeg" },
      { id: 13, kind: "washlabel", local_path: "/tmp/202426103105-wash.jpg", original_file_name: "202426103105洗唛.jpg", mime_type: "image/jpeg" },
    ],
  }, {
    fileExists: () => true,
    ocrRecognizer: async (files, options) => {
      calls.push({ files, options });
      return [{
        fileName: "202426103105吊牌.jpg",
        sourceKind: "hangtag",
        detectedSpuCode: "202426103105",
        fields: [
          { key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "hangtag" },
          { key: "safetyCategory", label: "安全技术级别", value: "符合 GB 31701 B类", confidence: "high", sourceKind: "hangtag" },
        ],
      }];
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].files.map((file) => [file.fileName, file.sourceKind]), [
    ["202426103105吊牌.jpg", "hangtag"],
    ["202426103105洗唛.jpg", "washlabel"],
  ]);
  assert.deepEqual(result.fills.map((fill) => [fill.field_name, fill.field_value]), [
    ["执行标准", "FZ/T 73018-2021"],
    ["安全等级", "B类"],
  ]);
  assert.deepEqual(result.warnings, []);
});

test("product archive AI fill OCR fallback scans a stored flat image when label assets are absent", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const result = await service.buildProductArchiveAiFillOcrFallback({
    draftId: 917,
    spuCode: "202426103105",
    fields: [
      { id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
    ],
    images: [
      { id: 11, kind: "reference", local_path: "/tmp/202426103105-flat.jpg", original_file_name: "202426103105-00355.jpg", mime_type: "image/jpeg", raw_payload_json: { asset_kind: "flat_image" } },
      { id: 12, kind: "reference", local_path: "/tmp/202426103105-model.jpg", original_file_name: "202426103105-模特图.jpg", mime_type: "image/jpeg", raw_payload_json: { asset_kind: "model_image" } },
    ],
  }, {
    fileExists: () => true,
    ocrRecognizer: async (files) => {
      calls.push(files);
      return [{
        fileName: "202426103105-00355.jpg",
        sourceKind: "flat_image",
        detectedSpuCode: "202426103105",
        fields: [
          { key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "flat_image" },
        ],
      }];
    },
  });

  assert.deepEqual(calls.flat().map((file) => [file.fileName, file.sourceKind]), [
    ["202426103105-00355.jpg", "flat_image"],
  ]);
  assert.deepEqual(result.fills.map((fill) => [fill.field_name, fill.field_value, fill.source_type]), [
    ["执行标准", "FZ/T 73018-2021", "flat_image_ocr"],
  ]);
});

test("product archive AI fill OCR fallback tries a flat image when label OCR cannot fill the target", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const calls = [];
  const result = await service.buildProductArchiveAiFillOcrFallback({
    draftId: 917,
    spuCode: "202426103105",
    fields: [
      { id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] },
    ],
    images: [
      { id: 11, kind: "hangtag", local_path: "/tmp/202426103105-tag.jpg", original_file_name: "202426103105吊牌.jpg", mime_type: "image/jpeg" },
      { id: 12, kind: "reference", local_path: "/tmp/202426103105-flat.jpg", original_file_name: "202426103105-00355.jpg", mime_type: "image/jpeg", raw_payload_json: { asset_kind: "flat_image" } },
    ],
  }, {
    fileExists: () => true,
    ocrRecognizer: async (files) => {
      calls.push(files.map((file) => file.sourceKind));
      if (files[0].sourceKind === "hangtag") {
        return [{
          fileName: "202426103105吊牌.jpg",
          sourceKind: "hangtag",
          detectedSpuCode: "202426103105",
          status: "ocr_failed",
          fields: [],
        }];
      }
      return [{
        fileName: "202426103105-00355.jpg",
        sourceKind: "flat_image",
        detectedSpuCode: "202426103105",
        status: "recognized",
        fields: [{ key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "flat_image" }],
      }];
    },
  });

  assert.deepEqual(calls, [["hangtag"], ["flat_image"]]);
  assert.deepEqual(result.fills.map((fill) => [fill.field_value, fill.source_type]), [
    ["FZ/T 73018-2021", "flat_image_ocr"],
  ]);
  assert.equal(result.warnings.some((warning) => warning.code === "ocr_fallback_unavailable"), true);
});

test("product archive AI fill OCR fallback degrades to a warning when recognition fails", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const result = await service.buildProductArchiveAiFillOcrFallback({
    draftId: 917,
    spuCode: "202426103105",
    fields: [{ id: 1, field_name: "执行标准", value_text: "", value_json: {}, source_type: "manual", manual_override: false, validation_status: "missing", options_json: [] }],
    images: [{ id: 12, kind: "hangtag", local_path: "/tmp/202426103105-tag.jpg", original_file_name: "202426103105吊牌.jpg", mime_type: "image/jpeg" }],
  }, {
    fileExists: () => true,
    ocrRecognizer: async () => {
      throw new Error("tesseract unavailable");
    },
  });

  assert.deepEqual(result.fills, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "ocr_fallback_unavailable");
  assert.match(result.warnings[0].message, /tesseract unavailable/);
});

test("product archive AI fill persists OCR text and enum evidence before the general model fallback", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const draft = {
    id: 917,
    spu_code: "202426103105",
    tenant_name: "tenant",
    merchant_id: "merchant",
    trade_id: "trade-917",
    trade_path: "童装婴幼儿服装 / 针织衫",
    title: "儿童针织衫",
    status: "manual_review",
    submit_claim_token: null,
    source_snapshot_json: { spu: { spu_code: "202426103105", spu_name: "儿童针织衫" } },
  };
  const fields = [
    {
      id: 1, draft_id: 917, field_name: "执行标准", field_id: "standard", source_type: "manual", source_ref: null,
      value_text: null, value_json: {}, required: true, blocking: true, manual_override: false,
      validation_status: "missing", validation_message: "必填字段缺失", updated_at: "2026-08-29T00:00:01.000Z", options_json: [], field_type: "TEXT",
    },
    {
      id: 2, draft_id: 917, field_name: "安全等级", field_id: "safety", source_type: "manual", source_ref: null,
      value_text: null, value_json: {}, required: true, blocking: true, manual_override: false,
      validation_status: "missing", validation_message: "必填字段缺失", updated_at: "2026-08-29T00:00:02.000Z",
      options_json: [{ label: "B类", value: "B类" }], field_type: "SINGLE_CHOICE",
    },
  ];
  const images = [{
    id: 12,
    draft_id: 917,
    spu_code: "202426103105",
    source_type: "crawshrimp_asset_package",
    source_ref: "202426103105吊牌.jpg",
    local_path: "/tmp/202426103105-tag.jpg",
    file_name: "202426103105-tag.jpg",
    original_file_name: "202426103105吊牌.jpg",
    mime_type: "image/jpeg",
    raw_payload_json: { asset_kind: "hangtag" },
    sort_no: 1,
  }];
  const fieldUpdates = [];
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get() {
          if (/from product_archive_draft/i.test(normalized)) return draft;
          return undefined;
        },
        all() {
          if (/from product_archive_draft_field/i.test(normalized)) return fields;
          if (/from product_archive_draft_image/i.test(normalized)) return images;
          return [];
        },
        run(...args) {
          if (/update product_archive_draft_field field/i.test(normalized)) {
            fieldUpdates.push({ fieldId: Number(args[6]), value: args[0], sourceType: args[2] });
          }
          return { changes: 1 };
        },
      };
    },
  };

  const result = await service.fillProductArchiveDraftFieldsWithAi(db, draft.id, {
    fileExists: () => true,
    ocrRecognizer: async () => [{
      fileName: "202426103105吊牌.jpg",
      sourceKind: "hangtag",
      detectedSpuCode: "202426103105",
      fields: [
        { key: "executionStandard", label: "执行标准", value: "FZ/T 73018-2021", confidence: "high", sourceKind: "hangtag" },
        { key: "safetyCategory", label: "安全技术级别", value: "符合 GB 31701 B类", confidence: "high", sourceKind: "hangtag" },
      ],
    }],
    router: {
      callJson: async () => {
        throw new Error("general AI should not run for OCR-filled fields");
      },
    },
  });

  assert.deepEqual(fieldUpdates, [
    { fieldId: 1, value: "FZ/T 73018-2021", sourceType: "hangtag_ocr" },
    { fieldId: 2, value: "B类", sourceType: "hangtag_ocr" },
  ]);
  assert.deepEqual(result.saved.map((field) => [field.field_id, field.source]), [
    [1, "OCR_EVIDENCE"],
    [2, "OCR_EVIDENCE"],
  ]);
  assert.equal(result.warnings.some((warning) => warning.code === "ai_provider_unavailable"), false);
});

test("single and batch AI fill both propagate the bounded task cancellation signal", async () => {
  const [route, service] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftService, "utf8"),
  ]);
  const routeSection = (startMarker, endMarker) => {
    const start = route.indexOf(startMarker);
    const end = route.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing route section: ${startMarker}`);
    return route.slice(start, end);
  };
  const queueSection = routeSection("function createProductArchiveAiFillQueue", "function createProductArchivePrecheckQueue");
  const singleRoute = routeSection(
    'productArchiveDrafts.post("/:draftId/ai-fill"',
    'productArchiveDrafts.post("/:draftId/size-chart/ai-recommend"',
  );

  assert.match(queueSection, /withBackgroundTaskSlot\("product_archive_ai_fill", async \(signal\) =>[\s\S]*fillProductArchiveDraftFieldsWithAi\(db, item\.draft_id, \{ signal \}\)/);
  assert.match(singleRoute, /withBackgroundTaskSlot\("product_archive_ai_fill", \(signal\) =>[\s\S]*fillProductArchiveDraftFieldsWithAi\(db, draftId, \{ signal \}\)/);
  assert.match(service, /ocr_fallback_unavailable/);
});

test("product archive AI fill derives material enum fields from trusted composition text before model fallback", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fields = [
    {
      id: 201,
      field_name: "成分含量(文本)",
      source_type: "scm_list",
      value_text: "面料: 65.1%棉25.0%聚酯纤维9.2%粘纤0.7%氨纶（配料除外）",
      value_json: {},
      validation_status: "valid",
      options_json: [],
    },
    {
      id: 202,
      field_name: "京东材质成分",
      source_type: "ai_rule_fallback",
      value_text: "",
      value_json: { source: "AI_RULE_FALLBACK", ai_fill: { fallback: true } },
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [
        { value: "棉" },
        { value: "涤纶(聚酯纤维)" },
        { value: "粘胶纤维(粘纤)" },
        { value: "聚氨酯弹性纤维(氨纶)" },
      ],
    },
    {
      id: 203,
      field_name: "材质",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [
        { value: "棉混纺" },
        { value: "棉" },
        { value: "聚酯纤维" },
      ],
    },
    {
      id: 204,
      field_name: "材质(多选)",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [
        { value: "棉" },
        { value: "聚酯纤维" },
        { value: "粘胶纤维(粘纤)" },
        { value: "氨纶" },
      ],
    },
    {
      id: 205,
      field_name: "面料(多选)",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [
        { value: "棉" },
        { value: "聚酯纤维" },
        { value: "粘胶纤维(粘纤)" },
        { value: "氨纶" },
      ],
    },
  ];
  const candidates = service.buildProductArchiveAiFillCandidateFields(fields, [], []);

  assert.deepEqual(
    service.buildProductArchiveMaterialEvidenceFills(fields, candidates, []).map((field) => [
      field.field_name,
      field.field_value,
    ]),
    [
      ["京东材质成分", "棉,65.1;涤纶(聚酯纤维),25;粘胶纤维(粘纤),9.2;聚氨酯弹性纤维(氨纶),0.7"],
      ["材质", "棉混纺"],
      ["材质(多选)", "棉;聚酯纤维;粘胶纤维(粘纤);氨纶"],
      ["面料(多选)", "棉;聚酯纤维;粘胶纤维(粘纤);氨纶"],
    ],
  );
});

test("product archive size-chart mapping AI routes and review services are wired", async () => {
  const [service, route] = await Promise.all([
    readFile(files.draftService, "utf8"),
    readFile(files.draftRoute, "utf8"),
  ]);

  assert.match(service, /export async function recommendProductArchiveSizeChartMappings/);
  assert.match(service, /export function saveProductArchiveSizeChartMappings/);
  assert.match(service, /getDefaultAiScenarioRouter/);
  assert.match(service, /scenario:\s*"size_mapping"/);
  assert.match(service, /promptVersion:\s*"deepdraw-size-mapping-v1"/);
  assert.match(service, /rule_fallback/);
  assert.match(service, /sizeChartMappings = sizeChartMappingsForDraft\(db, draft\)\.map\(serializeSizeChartMapping\)/);
  assert.match(service, /sizeChartMappings,/);
  assert.match(service, /function buildSizeChartPreviewsForMappings/);
  assert.match(service, /const previews = buildSizeChartPreviewsForMappings\(db, draft, sourceRows, mappings\)/);
  assert.match(service, /export function saveProductArchiveSizeChartMappings[\s\S]*applyToDraft[\s\S]*rebuildProductArchiveDraftFields\(db, draftId\)[\s\S]*detail: validated\.detail/);
  assert.match(service, /function sizeChartMappingsForDraft/);
  assert.match(service, /mappings: sizeChartMappings\.filter/);
  assert.match(route, /productArchiveDrafts\.post\("\/:draftId\/size-chart\/ai-recommend"/);
  assert.match(route, /productArchiveDrafts\.post\("\/:draftId\/size-chart\/mappings"/);
});

test("product archive duplicate check rejects DeepDraw business failures", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const statements = [];
  const fakeDb = {
    prepare(sql) {
      statements.push(sql);
      return {
        get(id) {
          assert.equal(id, 101);
          return {
            id: 101,
            spu_code: "SPU001",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run() {
          throw new Error("duplicate check should reject before mutating draft state");
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  await assert.rejects(
    () => service.checkDuplicateProductArchiveDraft(fakeDb, 101, {
      search: async () => ({
        status: 200,
        ok: true,
        requestId: "request-1",
        payload: {
          response: {
            code: 50001,
            reason: "signature invalid",
            response: "fail",
          },
        },
      }),
    }),
    /DeepDraw .*failed/i,
  );
});

test("product archive duplicate check rejects top-level DeepDraw business failures", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fakeDb = {
    prepare() {
      return {
        get() {
          return {
            id: 102,
            spu_code: "SPU002",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run() {
          throw new Error("duplicate check should reject top-level business failures before mutating draft state");
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  await assert.rejects(
    () => service.checkDuplicateProductArchiveDraft(fakeDb, 102, {
      search: async () => ({
        status: 200,
        ok: true,
        requestId: "request-2",
        payload: {
          code: 10494,
          reason: "访问频率过高，请稍后重试",
          response: "fail",
        },
      }),
    }),
    /访问频率过高/,
  );
});

test("product archive duplicate check reuses a recent exact cache only for a claimed rate-limited submit", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const writes = [];
  const draft = {
    id: 104,
    spu_code: "SPU004",
    tenant_name: "电商巴拉巴拉",
    merchant_id: "1162",
    trade_id: "100",
    submit_claim_token: "claim-104",
    duplicate_result_json: {
      duplicateFound: false,
      records: [],
      checkedAt: new Date(Date.now() - (10 * 60 * 1000)).toISOString(),
      requestId: "cached-request",
    },
  };
  const fakeDb = {
    prepare(sql) {
      return {
        get(...args) {
          if (/update product_archive_draft/i.test(sql)) {
            writes.push({ kind: "update", args });
            return { id: draft.id };
          }
          return draft;
        },
        run(...args) {
          writes.push({ kind: "log", args });
          return { changes: 1 };
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  const result = await service.checkDuplicateProductArchiveDraft(fakeDb, draft.id, {
    claimToken: draft.submit_claim_token,
    search: async () => ({
      status: 200,
      ok: true,
      requestId: "rate-limited-request",
      payload: {
        code: 10494,
        reason: "访问频率过高，请稍后重试",
        response: "fail",
      },
    }),
  });

  assert.equal(result.duplicateFound, false);
  assert.equal(result.checkedAt, draft.duplicate_result_json.checkedAt);
  assert.equal(result.cacheFallback.responseCode, 10494);
  assert.equal(writes.filter((write) => write.kind === "update").length, 1);
  assert.equal(writes.filter((write) => write.kind === "log").length, 1);
});

test("DeepDraw duplicate rate-limit cache rejects stale and non-exact evidence", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const now = Date.now();
  const rateLimitedPayload = {
    code: 10494,
    reason: "访问频率过高，请稍后重试",
    response: "fail",
  };
  const baseDraft = {
    spu_code: "SPU005",
    duplicate_result_json: {
      duplicateFound: true,
      records: [{ code: "SPU005", id: "internal-5" }],
      checkedAt: new Date(now - 1000).toISOString(),
    },
  };

  assert.equal(
    service.resolveDeepdrawDuplicateRateLimitCache({
      ...baseDraft,
      duplicate_result_json: {
        ...baseDraft.duplicate_result_json,
        checkedAt: new Date(now - service.DEEPDRAW_DUPLICATE_RATE_LIMIT_CACHE_MAX_AGE_MS - 1).toISOString(),
      },
    }, rateLimitedPayload, now),
    null,
  );
  assert.equal(
    service.resolveDeepdrawDuplicateRateLimitCache({
      ...baseDraft,
      duplicate_result_json: {
        ...baseDraft.duplicate_result_json,
        records: [{ code: "OTHER", id: "internal-other" }],
      },
    }, rateLimitedPayload, now),
    null,
  );
  assert.equal(
    service.resolveDeepdrawDuplicateRateLimitCache(baseDraft, {
      code: 50001,
      reason: "signature invalid",
      response: "fail",
    }, now),
    null,
  );
});

test("product archive duplicate check treats DeepDraw product-not-found as no duplicate", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const writes = [];
  const fakeDb = {
    prepare(sql) {
      return {
        get(...args) {
          if (/update product_archive_draft/i.test(sql)) {
            writes.push({ kind: "update", args });
            return { id: 103 };
          }
          return {
            id: 103,
            spu_code: "SPU003",
            tenant_name: "电商巴拉巴拉",
            merchant_id: "1162",
            trade_id: "100",
          };
        },
        run(...args) {
          writes.push({ kind: "log", args });
          return {};
        },
      };
    },
    transaction(fn) {
      return fn;
    },
  };

  const result = await service.checkDuplicateProductArchiveDraft(fakeDb, 103, {
    search: async () => ({
      status: 200,
      ok: false,
      requestId: "request-3",
      payload: {
        status: 200,
        response: {
          code: 10404,
          reason: "请求失败，请求的资源未在服务器上发现。productCode-SPU003",
          response: "fail",
          requestId: -1,
        },
      },
    }),
  });

  assert.equal(result.duplicateFound, false);
  assert.deepEqual(result.records, []);
  assert.equal(writes.filter((write) => write.kind === "update").length, 1);
  assert.equal(writes.filter((write) => write.kind === "log").length, 1);
});

test("product archive service derives core sales fields from MDM master data", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208326105214",
    price_tag: 359,
  };
  const skus = [
    {
      sku_code: "20832610521400388080",
      ean_code: "6942749195637",
      inner_code: "6942749195637",
      color_name: "蓝色调00388",
      size_name: "080",
      price_tag: 359,
    },
    {
      sku_code: "20832610521401315090",
      ean_code: "6942749195705",
      inner_code: "6942749195705",
      color_name: "粉色调01315",
      size_name: "090",
      price_tag: 359,
    },
  ];

  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("货号", { spu, skus }), {
    valueText: "208326105214",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("价格", { spu, skus }), {
    valueText: "359",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("颜色", { spu, skus }), {
    valueText: "蓝色,蓝色调00388;粉红,粉色调01315",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("颜色(文本)", { spu, skus }), {
    valueText: "蓝色,蓝色调00388;粉红,粉色调01315",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("尺码", { spu, skus }), {
    valueText: "80cm;90cm",
    valueJson: {},
  });
  const sizeTable = service.buildProductArchiveMdmDerivedFieldValue("尺码表", { spu, skus });
  assert.equal(sizeTable.valueText, "");
  assert.deepEqual(sizeTable.valueJson, {});
  const codeOnlySizeTable = service.buildProductArchiveMdmDerivedFieldValue("尺码表", {
    spu,
    skus: [{ size_name: "", size_code: "066" }],
  });
  assert.deepEqual(codeOnlySizeTable.valueJson, {});
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("上市时间", { spu, skus, dateText: "2026-07-08" }), {
    valueText: "2026-07-08",
    valueJson: {},
  });
  const merchantSku = service.buildProductArchiveMdmDerivedFieldValue("商家SKU", {
    spu,
    skus,
    dateText: "2026-07-08",
  });
  assert.equal(merchantSku.valueText, "");
  assert.equal(
    merchantSku.valueJson["蓝色调00388"]["80cm"],
    "359,208326105214,2026-07,0,6942749195637,6942749195637,359,359,208326105214,6942749195637",
  );
});

test("product archive service derives DeepDraw size-chart fields from PLM source rows", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const value = service.buildProductArchiveSizeChartFieldValue({
    fieldName: "尺码表",
    spuCode: "208326100020",
    sourceRows: [
      { source_type: "launch_plan", row_json: { 款号: "208326100020", 测量点: "衣长", 尺码: "80", 尺码值: "0" } },
      { source_type: "size_chart", row_json: { 款号: "208326100020", 测量点: "衣长", 尺码: "80/", 尺码值: "38.0" } },
      { source_type: "size_chart", row_json: { 款号: "208326100020", 测量点: "肩宽", 尺码: "80/", 尺码值: "26.5" } },
      { source_type: "size_chart", row_json: { 款号: "208326100020", 测量点: "胸围", 尺码: "80/", 尺码值: "66.0" } },
      { source_type: "size_chart", row_json: { 款号: "208326100020", 测量点: "里：袖长", 尺码: "80/", 尺码值: "24.5" } },
    ],
    templateOptions: ["领口", "肩宽", "袖长", "胸围", "衣长"],
  });

  assert.deepEqual(value.valueJson, {
    title: "肩宽,袖长,胸围,衣长",
    "80cm": "26.5,24.5,66,38",
  });
  assert.equal(value.sourceType, "size_chart");
  assert.equal(value.mappings.find((item) => item.targetField === "袖长")?.confidence, "medium");
  assert.equal(value.unmatchedTargets.includes("领口"), true);

  const genericValue = service.buildProductArchiveSizeChartFieldValue({
    fieldName: "尺码表",
    spuCode: "208326104204",
    sourceRows: [
      { source_type: "size_chart", row_json: { 款号: "208326104204", 测量点: "衣长", 尺码: "80/", 尺码值: "33.0" } },
      { source_type: "size_chart", row_json: { 款号: "208326104204", 测量点: "胸围", 尺码: "80/", 尺码值: "64.0" } },
      { source_type: "size_chart", row_json: { 款号: "208326104204", 测量点: "里：袖长", 尺码: "80/", 尺码值: "26.0" } },
    ],
    templateOptions: ["身高", "衣长", "胸围", "袖长"],
  });

  assert.deepEqual(genericValue.valueJson, {
    title: "身高,衣长,胸围,袖长",
    "80cm": "80,33,64,26",
  });
  assert.equal(genericValue.sourceType, "size_chart");

  const multiPlatform = service.buildProductArchiveSizeChartFieldValue({
    fieldName: "多平台尺码",
    spuCode: "208426121101",
    sourceRows: [
      { source_type: "size_chart", row_json: { 款号: "208426121101", 测量点: "衣长", 尺码: "130", 尺码值: "50.5" } },
      { source_type: "size_chart", row_json: { 款号: "208426121101", 测量点: "衣长", 尺码: "170", 尺码值: "68" } },
    ],
    templateOptions: [],
  });
  assert.deepEqual(multiPlatform.valueJson, {
    title: "京东,拼多多,小红书,微信视频小店",
    "130cm": "130,130cm,130cm,130cm",
    "170cm": "170,170cm,170cm,170cm",
  });
  assert.equal(service.isStructuredProductPayloadField({ field_name: "多平台尺码", field_type: "" }), true);
});

test("product archive derives JD size subattributes from actual SKU sizes", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const input = {
    spu: { spu_code: "208426121101", product_line_name: "童装服饰" },
    skus: [
      { size_name: "130cm", size_code: "130" },
      { size_name: "140cm", size_code: "140" },
      { size_name: "130cm", size_code: "130" },
    ],
  };

  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("京东规格子属性", input), {
    valueText: "130;140",
    valueJson: {},
  });
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("京东自营子属性", input), {
    valueText: "130;140",
    valueJson: {},
  });
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("京东规格子属性", {
    spu: input.spu,
    sourceRows: [{ source_type: "launch_plan", row_json: { "颜色名称": "黑色90001" } }],
  }), "");
});

test("product archive size-chart validation checks size keys and column counts", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const issues = service.validateProductArchiveSizeChartValue({
    fieldName: "尺码表",
    valueJson: {
      title: "衣长,胸围",
      "80cm": "38",
      "90cm": "39,70",
    },
    allowedSizes: ["80cm"],
  });

  assert.deepEqual(issues.map((issue) => issue.issueType), [
    "size_chart_column_count_mismatch",
    "size_chart_size_not_in_sku",
  ]);
  assert.deepEqual(issues.map((issue) => issue.severity), ["blocker", "blocker"]);
});

test("product archive size-chart validation ignores AI metadata and downgrades optional malformed tables", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.deepEqual(service.validateProductArchiveSizeChartValue({
    fieldName: "唯品会尺码表",
    valueJson: {
      source: "AI_RULE_FALLBACK",
      ai_fill: { fallback: true },
    },
    allowedSizes: ["80cm"],
    blocking: false,
  }), []);

  const optionalIssues = service.validateProductArchiveSizeChartValue({
    fieldName: "唯品会尺码表",
    valueJson: { "80cm": "80,38" },
    allowedSizes: ["80cm"],
    blocking: false,
  });
  assert.deepEqual(optionalIssues.map((issue) => issue.issueType), ["size_chart_title_missing"]);
  assert.deepEqual(optionalIssues.map((issue) => issue.severity), ["warning"]);

  const blockingIssues = service.validateProductArchiveSizeChartValue({
    fieldName: "尺码表",
    valueJson: { "80cm": "80,38" },
    allowedSizes: ["80cm"],
    blocking: true,
  });
  assert.deepEqual(blockingIssues.map((issue) => issue.severity), ["blocker"]);
});

test("product archive SKU size field validation blocks values inconsistent with draft SKUs", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const issues = service.validateProductArchiveSkuSizeFieldValue({
    fieldName: "尺码",
    valueText: "48cm",
    skus: [
      { size_name: "066", size_code: "066" },
      { size_name: "073", size_code: "073" },
      { size_name: "080", size_code: "080" },
    ],
  });

  assert.deepEqual(issues.map((issue) => issue.issueType), [
    "sku_size_field_missing_sku",
    "sku_size_field_extra",
  ]);
  assert.deepEqual(issues.map((issue) => issue.severity), ["blocker", "blocker"]);
  assert.match(issues[0].message, /66cm/);
  assert.match(issues[1].message, /48cm/);
});

test("product archive create payload omits scalar size-chart fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const serviceSource = await readText(files.draftService);

  assert.match(serviceSource, /\.filter\(shouldIncludeProductArchivePayloadField\)/);
  assert.equal(service.shouldIncludeProductArchivePayloadField({
    source_type: "skip",
    required: false,
    blocking: false,
    validation_status: "skipped",
  }), false);
  assert.equal(service.shouldIncludeProductArchivePayloadField({
    source_type: "skip",
    required: true,
    blocking: true,
    validation_status: "missing",
  }), true);
  assert.equal(service.shouldIncludeProductArchivePayloadField({
    source_type: "fixed",
    required: false,
    blocking: false,
    validation_status: "invalid",
  }), false);
  assert.equal(service.shouldIncludeProductArchivePayloadField({
    source_type: "fixed",
    required: true,
    blocking: true,
    validation_status: "invalid",
  }), true);
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "抖音尺码表",
    field_type: "MULTI_TEXT",
    value_text: "只需要填身高体重",
    value_json: {},
  }), null);
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "尺码表",
    field_type: null,
    field_id: null,
    value_text: "",
    value_json: { title: "身高,衣长", "80cm": "80,38" },
  }), null);
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "唯品会尺码表",
    field_type: "MULTI_TEXT",
    value_text: "号型",
    value_json: {
      source: "AI_RULE_FALLBACK",
      ai_fill: { fallback: true },
    },
  }), null);
  assert.deepEqual(service.productArchivePayloadFieldValue({
    field_name: "尺码表",
    field_type: "MULTI_TEXT",
    required: true,
    blocking: true,
    value_text: "",
    value_json: { title: "腰围,直裆,裤长", "80cm": "41,0,43", "90cm": "42,0,48" },
  }), { title: "腰围,裤长", "80cm": "41,43", "90cm": "42,48" });
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "抖音尺码表",
    field_type: "MULTI_TEXT",
    value_text: "",
    value_json: { title: "身高(cm),体重(斤)", "80cm": "0,0", "90cm": "0,0" },
  }), null);
  assert.deepEqual(service.productArchivePayloadFieldValue({
    field_name: "尺码表",
    field_type: "MULTI_TEXT",
    required: true,
    blocking: true,
    value_text: "只需要填身高体重",
    value_json: { title: "身高,衣长", "80cm": "80,38" },
  }), { title: "身高,衣长", "80cm": "80,38" });
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "22Q4-童鞋尺码表",
    field_type: "SINGLE_CHOICE",
    value_text: "篮球鞋",
    value_json: {},
  }), "篮球鞋");
  assert.deepEqual(service.productArchivePayloadFieldValue({
    field_name: "多平台尺码",
    field_type: "MULTI_TEXT",
    value_text: "",
    value_json: { title: "京东,拼多多", "80cm": "80,80cm" },
    required: true,
    blocking: true,
  }), { title: "京东,拼多多", "80cm": "80,80cm" });
  assert.deepEqual(service.productArchivePayloadFieldValue({
    field_name: "多平台尺码",
    field_type: "MULTI_TEXT",
    value_text: "",
    value_json: { title: "拼多多,微信视频小店", "26": "26码脚长15.8-16.2/内长17,26码(脚长15.8-16.2/内长17)" },
  }, { includeOptionalStructuredSizeFields: true }), {
    title: "拼多多,微信视频小店",
    "26": "26码脚长15.8-16.2/内长17,26码(脚长15.8-16.2/内长17)",
  });
  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "颜色",
    value_text: "卡其,贝壳卡50230",
    value_json: {},
  }), "卡其,贝壳卡50230");
});

test("product archive child fields are skipped unless the parent value activates them", async () => {
  const [service, serviceSource] = await Promise.all([
    import("../../web/server/services/product-archive-drafts.ts"),
    readText(files.draftService),
  ]);
  const inventoryTemplate = {
    raw_payload_json: {
      attributes: {
        isChildAttr: true,
        parentAttr: ["货源类别"],
        parentAttrValue: "现货",
      },
    },
  };
  const xhsTemplate = {
    rawPayload: {
      attributes: {
        isChildAttr: true,
        parentAttr: ["小红书发货时间"],
        parentAttrValue: "相对发货时间",
      },
    },
  };

  assert.equal(
    service.templateChildRequirementActive(inventoryTemplate, [
      { field_name: "货源类别", value_text: "订货" },
      { field_name: "是否库存", value_text: "否" },
    ]),
    false,
  );
  assert.equal(
    service.templateChildRequirementActive(inventoryTemplate, [
      { field_name: "货源类别", value_text: "现货" },
    ]),
    true,
  );
  assert.equal(
    service.templateChildRequirementActive(xhsTemplate, [
      { fieldName: "小红书发货时间", valueText: "相对发货时间" },
    ]),
    true,
  );
  assert.match(serviceSource, /templateChildRequirementActive\(template, rows\)/);
});

test("product archive payload aligns structured size rows with selected size field values", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(
    service.normalizeProductArchiveDeepdrawFieldValue("尺码", "100cm;120cm", [
      { value: "100" },
      { value: "120" },
    ]),
    "100;120",
  );
  assert.equal(
    service.normalizeProductArchiveDeepdrawFieldValue("尺码", "080;090", [
      { value: "80cm" },
      { value: "90cm" },
    ]),
    "80cm;90cm",
  );
  assert.deepEqual(
    service.alignProductArchivePayloadSizeFieldValue(
      "尺码表",
      { title: "身高", "100cm": "100", "120cm": "120" },
      "100;120",
    ),
    { title: "身高", "100": "100", "120": "120" },
  );
  assert.deepEqual(
    service.alignProductArchivePayloadSizeFieldValue(
      "商家SKU",
      {
        title: "价格,货号",
        蓝色调00388: {
          "100cm": "39.9,206426172201",
          "120cm": "39.9,206426172201",
        },
      },
      "100;120",
    ),
    {
      title: "价格,货号",
      蓝色调00388: {
        "100": "39.9,206426172201",
        "120": "39.9,206426172201",
      },
    },
  );
  assert.deepEqual(
    service.alignProductArchivePayloadSizeFieldValue(
      "尺码表",
      { title: "身高", "080": "80" },
      "80cm",
    ),
    { title: "身高", "80cm": "80" },
  );
});

test("product archive field mapping applies product-line domains only to matching MDM goods", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.fieldMappingDomainApplies({ field_domain_type: "通用字段" }, {}), true);
  assert.equal(service.fieldMappingDomainApplies({ field_domain_type: "1688" }, {}), true);
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：鞋品" },
      { product_line_name: "童装服饰", subclass_name: "普通外套" },
    ),
    false,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：鞋品" },
      { product_line_name: "鞋品", subclass_name: "运动鞋" },
    ),
    true,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "产品线：中童" },
      { product_line_name: "童装服饰", age_group_name: "中童" },
    ),
    true,
  );
  assert.equal(
    service.fieldMappingDomainApplies(
      { field_domain_type: "鞋品字段" },
      { product_line_name: "鞋类商品" },
    ),
    true,
  );
});

test("product archive fixed counter-price defaults stay scoped outside shoe rules", async () => {
  const [serviceSource, service] = await Promise.all([
    readFile(files.draftService, "utf8"),
    import("../../web/server/services/product-archive-drafts.ts"),
  ]);

  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("专柜价", {
    spu: { product_line_name: "童装服饰", price_tag: 359 },
    sourceRows: [],
  }), "");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("天猫特卖专柜价", {
    spu: { product_line_name: "童装服饰", price_tag: 359 },
    sourceRows: [],
    sourceField: "10000",
  }), "359");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("专柜价", {
    spu: { product_line_name: "鞋品", price_tag: 359 },
    sourceRows: [
      { source_type: "launch_plan", row_json: { "官方发布类目": "童鞋/运动鞋" } },
    ],
  }), "10000");
  assert.doesNotMatch(
    serviceSource,
    /if \(sourceType === "fixed"\) \{[\s\S]*?if \(isProductArchiveListPriceReference\(fieldName\)\) return derived \|\| defaultValue[\s\S]*?return defaultValue \|\| derived/,
  );
});

test("product archive submit routes surface DeepDraw service failures instead of generic 500 errors", async () => {
  const [service, route, draftDetailPage] = await Promise.all([
    readFile(files.draftService, "utf8"),
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftDetailPage, "utf8"),
  ]);

  assert.match(service, /assertDeepdrawProductArchiveSuccess\(result,\s*"create",\s*submitDiagnostics\)/);
  assert.match(service, /if \(createError\) throw createError/);
  assert.doesNotMatch(service, /if \(!result\.ok\) return \{ ok: false, result \}/);
  assert.match(service, /productArchiveFailureReasonWithDiagnostics/);
  assert.match(service, /omittedTemplateFieldCount/);
  assert.match(service, /payloadIssues/);
  assert.match(service, /compareDeepdrawLegacyShoePayloadToResource/);
  assert.match(service, /runAndRecordLegacyUpdate/);
  assert.match(service, /"post_create"/);
  assert.doesNotMatch(service, /deepdrawLegacyShoePublishCapabilityBlockers/);
  assert.match(route, /function submitOperationException/);
  assert.match(route, /new HTTPException\(status,\s*\{ message: `\$\{prefix\}：/);
  assert.match(route, /发布到深绘失败/);
  assert.match(route, /深绘查重失败/);
  assert.match(route, /深绘回读失败/);
  assert.match(draftDetailPage, /<TableHead>原因<\/TableHead>/);
  assert.match(draftDetailPage, /log\.response_reason \|\| "-"/);
  assert.doesNotMatch(draftDetailPage, /深绘接口能力阻断.*真实发布已停用/);
});

test("product archive create payload keeps only current DeepDraw template fields and explains generic failures", async () => {
  const [service, serviceSource] = await Promise.all([
    import("../../web/server/services/product-archive-drafts.ts"),
    readFile(files.draftService, "utf8"),
  ]);
  const payloadStart = serviceSource.indexOf("function productPayload");
  const payloadEnd = serviceSource.indexOf("function deepdrawBusinessResult", payloadStart);
  const payloadImplementation = serviceSource.slice(payloadStart, payloadEnd);

  assert.equal(service.productArchivePayloadTemplateFieldId({ template_field_id: "2399" }), "2399");
  assert.equal(service.productArchivePayloadTemplateFieldId({ field_id: "old-field" }), "");
  assert.match(payloadImplementation, /productArchivePayloadTemplateFieldId\(field\)/);
  assert.match(payloadImplementation, /omittedTemplateFieldNames\.push/);
  assert.match(payloadImplementation, /id:\s*templateFieldId/);
  assert.match(payloadImplementation, /payloadFieldsFromDetail\(true\)/);
  assert.match(payloadImplementation, /selectDeepdrawLegacyShoeCreateFields\(alignedAllFields\)/);
  assert.match(payloadImplementation, /selectDeepdrawLegacyShoeUpdateFields\(alignedAllFields\)/);
  assert.match(payloadImplementation, /legacyUpdateFields/);
  assert.match(payloadImplementation, /fields:\s*createFields/);
  assert.doesNotMatch(payloadImplementation, /gpusProduct/);
  assert.match(payloadImplementation, /attachProductArchiveSubmitDiagnostics/);

  const issues = service.productArchivePayloadValidationIssues({
    date: "/",
    fields: [
      { name: "尺码", value: "21;22" },
      { name: "尺码表", value: { title: "适合脚长,鞋内长", "21": "12,13", "021": "12,13", "23码": "14,15" } },
      { name: "多平台尺码", value: { title: "拼多多", "23码": "23码脚长14-15" } },
      { name: "商家SKU", value: { title: "价格,货号", 红色: { "22": "99,SPU", "022": "99,SPU", "23码": "99,SPU" } } },
    ],
  });
  assert.ok(issues.some((issue) => issue.includes("上市日期格式异常：/")));
  assert.equal(issues.some((issue) => issue.includes("021")), false);
  assert.equal(issues.some((issue) => issue.includes("022")), false);
  assert.ok(issues.some((issue) => issue.includes("尺码表 尺码键与销售尺码不一致：23码")));
  assert.ok(issues.some((issue) => issue.includes("多平台尺码 尺码键与销售尺码不一致：23码")));
  assert.ok(issues.some((issue) => issue.includes("商家SKU 尺码键与销售尺码不一致：23码")));
  assert.deepEqual(service.alignProductArchivePayloadSizeFieldValue(
    "尺码表",
    { title: "适合脚长,鞋内长", "21码": "12,13", "22码": "13,14" },
    "21;22",
  ), { title: "适合脚长,鞋内长", "21": "12,13", "22": "13,14" });
  assert.deepEqual(service.alignProductArchivePayloadSizeFieldValue(
    "商家SKU",
    { title: "价格,货号", 红色: { "21码": "99,SPU" } },
    "21",
  ), { title: "价格,货号", 红色: { "21": "99,SPU" } });

  const reason = service.productArchiveFailureReasonWithDiagnostics("访问接口的时候发生未知异常：数据格式错误或校验失败", {
    omittedTemplateFieldCount: 3,
    omittedTemplateFieldNames: ["是否开裆", "腰型"],
    issues: ["上市日期格式异常：/，请检查上市计划的内容上市时间/搜索上市时间"],
  });
  assert.match(reason, /数据格式错误或校验失败/);
  assert.match(reason, /上市日期格式异常/);
  assert.match(reason, /已在提交前忽略 3 个不属于当前深绘类目的字段：是否开裆、腰型 等/);

  const fallbackReason = service.productArchiveFailureReasonWithDiagnostics("", {
    omittedTemplateFieldCount: 1,
    omittedTemplateFieldNames: ["裤长"],
    issues: [],
  });
  assert.match(fallbackReason, /深绘返回失败/);
  assert.match(fallbackReason, /不属于当前深绘类目的字段：裤长/);
});

test("product archive routes fence prechecks, owned image files, and mutation conflicts", async () => {
  const route = await readFile(files.draftRoute, "utf8");
  const section = (startMarker, endMarker) => {
    const start = route.indexOf(startMarker);
    const end = route.indexOf(endMarker, start);
    assert.ok(start >= 0, `missing ${startMarker}`);
    assert.ok(end > start, `missing ${endMarker}`);
    return route.slice(start, end);
  };

  const precheck = section("async function runPrecheckItemOnce", "function finishJob(job");
  assert.match(precheck, /const prepared = db\.transaction\(\(\) => \{[\s\S]*refreshDraftTradeSelectionFromLaunchPlan\(db, item\.draft_id\)[\s\S]*validateProductArchiveDraft\(db, item\.draft_id\)[\s\S]*return \{ tradeRefresh, validation \}/);

  const queueableRefresh = section("function queueableDraftRefreshCodesForCodes", "function numericIdValue");
  assert.match(queueableRefresh, /isReusableProductArchiveDraftStatus\(row\.status\)/);
  assert.match(queueableRefresh, /if \(current\.hasNonReusable\) return false/);
  assert.match(queueableRefresh, /return current\.hasReusable/);

  const batchRoute = section(
    'productArchiveDrafts.post("/batch"',
    'productArchiveDrafts.post("/mdm-batch"',
  );
  assert.match(batchRoute, /const rawCodes = parseSpuCodes\(body\.codes \?\? body\.rawCodes\)/);
  assert.match(batchRoute, /const queueCodes = queueableDraftRefreshCodesForCodes/);
  assert.match(batchRoute, /rawCodes: queueCodes/);

  const mdmBatchRoute = section(
    'productArchiveDrafts.post("/mdm-batch"',
    'productArchiveDrafts.post("/source-imports"',
  );
  assert.match(mdmBatchRoute, /const rawCodes = parseSpuCodes\(body\.codes \?\? body\.rawCodes\)/);
  assert.match(mdmBatchRoute, /const queueCodes = queueableDraftRefreshCodesForCodes/);
  assert.match(mdmBatchRoute, /rawCodes: queueCodes/);

  const validateRoute = section(
    'productArchiveDrafts.post("/:draftId/validate"',
    'productArchiveDrafts.post("/:draftId/check-duplicate"',
  );
  assert.match(validateRoute, /const prepared = db\.transaction\(\(\) => \{[\s\S]*refreshDraftTradeSelectionFromLaunchPlan\(db, draftId\)[\s\S]*validateProductArchiveDraft\(db, draftId\)/);
  assert.doesNotMatch(validateRoute, /db\.transaction\(\(\) => assertProductArchiveDraftMutable/);

  const imageSave = section("async function saveDraftImageUpload", "async function repairLegacyDraftImageLocalPath");
  assert.match(imageSave, /const localPath = path\.join\(imageDir, `\$\{randomUUID\(\)\}-\$\{fileName\}`\)/);
  assert.match(imageSave, /writeFile\(localPath, input\.file\.buffer, \{ flag: "wx" \}\)/);
  assert.match(imageSave, /catch \(error\)[\s\S]*rm\(localPath, \{ force: true \}\)[\s\S]*throw error/);

  const assetSave = section("async function saveDraftAssetUpload", "async function repairLegacyDraftImageLocalPath");
  assert.match(assetSave, /sourceType: "crawshrimp_asset_package"/);
  assert.match(assetSave, /asset_kind: input\.file\.assetKind/);
  assert.match(assetSave, /ocr_asset: true/);

  const ocrProcess = section("async function processFileItem", "async function applyRecognizedDocuments");
  assert.match(ocrProcess, /importOcrAssetJobFile/);
  assert.match(ocrProcess, /assetImport/);
  assert.match(ocrProcess, /importedImageCount: assetImport\?\.status === "imported" \? 1 : 0/);

  const legacyRepair = section("async function repairLegacyDraftImageLocalPath", "async function deleteDraftImageFiles");
  assert.match(legacyRepair, /writeFile\(localPath, buffer, \{ flag: "wx" \}\)/);
  assert.match(legacyRepair, /db\.transaction\(\(\) => \{[\s\S]*assertProductArchiveDraftMutable\(db, draftId\)[\s\S]*select id, draft_id, source_type, local_path[\s\S]*source_type = 'crawshrimp_asset_package'[\s\S]*for update[\s\S]*update product_archive_draft_image/);
  assert.match(legacyRepair, /catch \(error\)[\s\S]*rm\(localPath, \{ force: true \}\)[\s\S]*throw error/);

  const imageFileRead = section(
    'productArchiveDrafts.get("/images/:imageId/file"',
    'productArchiveDrafts.post("/:draftId/images"',
  );
  assert.match(imageFileRead, /requirePermission\(c, "PRODUCT_ARCHIVE_DRAFT_READ"\)/);
  assert.match(imageFileRead, /assertLocalProductArchiveAssetFile/);
  assert.match(imageFileRead, /PDF 文件不支持缩略图/);
  assert.match(
    imageFileRead,
    /if \(stringValue\(image\.source_type\) === "crawshrimp_asset_package"\) \{\s*requirePermission\(c, "PRODUCT_ARCHIVE_DRAFT_WRITE"\)[\s\S]*repairLegacyDraftImageLocalPath/,
  );
  assert.doesNotMatch(
    imageFileRead,
    /requirePermission\(c, "PRODUCT_ARCHIVE_DRAFT_WRITE"\)\s*const repaired/,
  );

  const sourceSpreadsheetUpload = section(
    'productArchiveDrafts.post("/source-imports/upload"',
    'productArchiveDrafts.post("/size-chart/import"',
  );
  assert.match(sourceSpreadsheetUpload, /productArchiveSpreadsheetBodyLimit/);

  const sizeChartSpreadsheetImport = section(
    'productArchiveDrafts.post("/size-chart/import"',
    'productArchiveDrafts.post("/workflow/start"',
  );
  assert.match(sizeChartSpreadsheetImport, /productArchiveSpreadsheetBodyLimit/);

  const workflowStart = section(
    'productArchiveDrafts.post("/workflow/start"',
    'productArchiveDrafts.post("/hangtag-washlabel-ocr/preview"',
  );
  assert.match(workflowStart, /productArchiveWorkflowSpreadsheetBodyLimit/);
  assert.doesNotMatch(workflowStart, /productArchiveOcrBodyLimit/);
  assert.match(route, /const SPREADSHEET_MULTIPART_OVERHEAD_BYTES = MB/);
  assert.match(route, /const MAX_PRODUCT_ARCHIVE_WORKFLOW_SPREADSHEET_BYTES = maxUploadBytes\("spreadsheet"\) \* 3/);
  assert.match(route, /const productArchiveSpreadsheetBodyLimit = bodyLimit\(\{[\s\S]*maxSize: maxUploadBytes\("spreadsheet"\) \+ SPREADSHEET_MULTIPART_OVERHEAD_BYTES[\s\S]*表格上传请求体总大小超过限制/);
  assert.match(route, /const productArchiveWorkflowSpreadsheetBodyLimit = bodyLimit\(\{[\s\S]*maxSize: maxUploadBytes\("spreadsheet"\) \* 3 \+ SPREADSHEET_MULTIPART_OVERHEAD_BYTES[\s\S]*工作流表格批次请求体总大小超过限制/);
  assert.match(
    sourceSpreadsheetUpload,
    /productArchiveSpreadsheetBodyLimit, async \(c\) => \{[\s\S]*saveUploadedSpreadsheet\(c\)/,
  );
  assert.match(
    sizeChartSpreadsheetImport,
    /productArchiveSpreadsheetBodyLimit, async \(c\) => \{[\s\S]*saveUploadedSpreadsheet\(c\)/,
  );
  assert.match(
    workflowStart,
    /productArchiveWorkflowSpreadsheetBodyLimit, async \(c\) => \{[\s\S]*const form = await c\.req\.formData\(\)[\s\S]*const spreadsheetFiles = \[copywritingFile, launchPlanFile, sizeChartFile\][\s\S]*file\.size > 0[\s\S]*assertAggregateUploadBytes\([\s\S]*MAX_PRODUCT_ARCHIVE_WORKFLOW_SPREADSHEET_BYTES[\s\S]*工作流表格批次总大小超过限制[\s\S]*importWorkflowSourceFile/,
  );

  assert.match(route, /function isProductArchiveDraftMutationConflictMessage/);
  assert.match(route, /function productArchiveDraftMutationException/);
  assert.match(route, /if \(isProductArchiveDraftMutationConflictMessage\(message\)\)[\s\S]*return new HTTPException\(409/);
  assert.match(route, /function productArchiveDraftMutationException[\s\S]*return error/);
  for (const marker of [
    'productArchiveDrafts.post("/images/import"',
    'productArchiveDrafts.post("/:draftId/images"',
    'productArchiveDrafts.delete("/:draftId/images/:imageId"',
    'productArchiveDrafts.delete("/:draftId"',
    'productArchiveDrafts.patch("/:draftId/trade"',
    'productArchiveDrafts.patch("/:draftId/trade/confirm"',
    'productArchiveDrafts.patch("/:draftId/fields"',
    'productArchiveDrafts.post("/:draftId/validate"',
    'productArchiveDrafts.post("/:draftId/ai-fill"',
    'productArchiveDrafts.post("/hangtag-washlabel-ocr/apply"',
    'productArchiveDrafts.post("/:draftId/size-chart/mappings"',
  ]) {
    const start = route.indexOf(marker);
    const end = route.indexOf("\nproductArchiveDrafts.", start + marker.length);
    assert.ok(start >= 0, `missing ${marker}`);
    assert.ok(end > start, `missing route end for ${marker}`);
    assert.match(route.slice(start, end), /productArchiveDraftMutationException/);
  }
});

test("product archive field option validation supports multi-value strings and object SKU payloads", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(
    service.productArchiveFieldValueMatchesOptions("080;090", [{ value: "080" }, { value: "090" }]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("蓝色,蓝色调00388;粉红,粉色调01315", [
      { label: "蓝色调00388" },
      { label: "粉色调01315" },
    ]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("蓝色,蓝色调00388;粉红,粉色调01315", [
      { value: "蓝色" },
      { value: "粉红" },
    ]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions({ title: "价格,货号", 蓝色调00388: { "080": "359,code" } }, []),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("080;100", [{ value: "080" }, { value: "090" }]),
    false,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("勾选展示细节模块，不勾选则展示卖点模块", [
      { optionValue: "detail-module", optionName: "勾选展示细节模块，不勾选则展示卖点模块" },
    ]),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("中性", [{ value: "男童" }, { value: "女童" }], "性别(多选)"),
    true,
  );
  assert.equal(
    service.productArchiveFieldValueMatchesOptions("中性", [{ value: "男童" }], "性别(多选)"),
    false,
  );
});

test("product archive payload expands neutral gender when template has only boy and girl options", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.productArchivePayloadFieldValue({
    field_name: "性别(多选)",
    template_field_name: "性别(多选)",
    value_text: "中性",
    value_json: {},
    options_json: [{ value: "男童" }, { value: "女童" }],
  }), "男童;女童");
});

test("product archive OCR queue bounds large previews and isolates lost leases", async () => {
  const route = await readText(files.draftRoute);

  assert.match(route, /const MAX_PRODUCT_ARCHIVE_OCR_BATCH_BYTES = positiveBatchMegabytes\(\s*"LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_BATCH_MB",\s*512,/);
  assert.match(route, /const MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_BYTES = positiveBatchMegabytes\(\s*"LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_MB",\s*128,/);
  assert.match(route, /const MAX_PRODUCT_ARCHIVE_OCR_FILES = positiveInteger\(\s*"LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_FILES",\s*160,\s*300,/);
  assert.match(route, /const MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES = positiveInteger\(\s*"LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES",\s*40,\s*100,/);
  assert.match(route, /const productArchiveOcrPreviewBodyLimit = uploadBodyLimit\(/);
  assert.match(route, /productArchiveDrafts\.post\("\/hangtag-washlabel-ocr\/preview", productArchiveOcrPreviewBodyLimit/);
  assert.match(route, /assertHangtagWashlabelPreviewSize\(files, supplementFiles, referenceImageFiles\)/);
  assert.match(route, /识别预览最多支持/);
  assert.match(route, /大图包请提交后台识别/);

  const leaseLostHandlers = route.match(/reportInternalError\(error, \{ phase: "lease_lost", jobId: job\.id \}\)/g) ?? [];
  assert.ok(leaseLostHandlers.length >= 4, "expected each product archive async queue to isolate lost leases per job");
  assert.match(route, /jobs\.delete\(job\.id\)[\s\S]*throw error/);
  assert.match(route, /if \(!yielded && !interrupted\)/);
});

test("product archive field patch rejects stale field revisions instead of reporting success", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const draftUpdatedAt = "2026-08-24T04:00:00.000Z";
  const fieldUpdatedAt = "2026-08-24T04:00:01.000Z";
  const draft = {
    id: 991,
    status: "ready",
    submit_claim_token: null,
    updated_at: draftUpdatedAt,
  };
  let validationReached = false;
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get() {
          if (/from product_archive_draft/i.test(normalized)) return draft;
          return undefined;
        },
        all() {
          validationReached = true;
          throw new Error("stale field update reached validation");
        },
        run() {
          if (/update product_archive_draft_field/i.test(normalized)) return { changes: 0 };
          return { changes: 1 };
        },
      };
    },
  };

  assert.throws(
    () => service.patchProductArchiveDraftFields(db, draft.id, {
      expectedDraftUpdatedAt: draftUpdatedAt,
      fields: [{
        id: 123456,
        fieldName: "吊牌价",
        expectedUpdatedAt: fieldUpdatedAt,
        valueText: "359",
      }],
    }),
    /草稿数据已更新，请刷新后重试/,
  );
  assert.equal(validationReached, false);
});

test("product archive service derives remaining field values from launch plan and copywriting rows before AI", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208326105214",
    price_tag: 359,
    unit_name: "件",
    age_group_name: "幼童",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208326105214",
        "搜索标题": "巴拉巴拉儿童外套男童女童衣服2026新款秋装卡通萌趣满印防护上衣",
        "唯品标题": "巴拉巴拉儿童外套男童女童衣服2026新秋卡通萌趣满印防护上衣",
        "内容标题": "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣",
        "导购标题": "巴拉巴拉balaOne外套防护连帽衣",
        "推荐理由": "潮流满印外套，防风防泼水透湿",
        "品类": "外套",
        "FAB": "精选高弹春亚纺贴膜面料，糯弹亲肤，抗皱性强。",
        "面料成分": "成分\n面料：100%聚酯纤维\n薄膜除外\n里料：100%聚酯纤维",
        "面料名称": "春亚纺贴膜",
        "面料文案": "防风防泼水透湿，多方面防护，户外出行无忧",
        "面料三个关键词": "防泼水 防风 透湿",
        "主图4": "春亚纺贴膜面料\n表层防风防泼水透湿\n内里柔软抗静电",
        "细节文案（不限定8个字，细节数量3-4个，字数尽量不超过12字）": "1.立体连帽，挡风护脖\n2.小动物痛包，萌趣可爱",
        "弹性": "无弹",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208326105214",
        "吊牌价": "299",
        "产品季": "326",
        "年龄段": "幼童",
        "性别": "中",
        "尺码段": "080-130",
        "内容上市时间": "2026-07-08T00:00:00.000Z",
        "颜色名称": "蓝色调00388",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208326105214",
        "颜色名称": "粉色调01315",
      },
    },
  ];

  const derive = (fieldName, sourceField = "") => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
    sourceField,
  });

  assert.equal(derive("商家编码", "款号"), "208326105214");
  assert.equal(derive("奥莱店折扣价", "吊牌价格"), "359");
  assert.equal(derive("专柜价"), "");
  assert.equal(derive("天猫特卖专柜价", "10000"), "359");
  assert.equal(derive("京东市场价"), "359");
  assert.equal(derive("京东市场价", "固定吊牌价"), "359");
  for (const fieldName of [
    "采购价",
    "京东自营市场价",
    "有赞标准价",
    "有赞价格",
    "原价",
    "小红书市场价",
    "抖音结算价格",
    "抖音价",
    "快手价",
    "爱库存供货价",
    "爱库存最低价",
    "好衣库结算价",
    "好衣库供货价",
    "好衣库价",
    "好衣库原价",
    "微信视频小店价格",
  ]) {
    assert.equal(derive(fieldName), "359", `${fieldName} should use the shared category list price`);
  }
  assert.equal(derive("成本价"), "");
  assert.equal(derive("特殊专柜价"), "");
  assert.equal(service.resolveProductArchiveSourceRuleValue("唯品会市场价", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows,
    rule: { source_type: "skip" },
  }), "359");
  assert.equal(service.resolveProductArchiveSourceRuleValue("成本价", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows,
    rule: { source_type: "skip" },
  }), "");
  assert.equal(derive("产品标题", "固定搜索标题"), "巴拉巴拉儿童外套男童女童衣服2026新款秋装卡通萌趣满印防护上衣");
  assert.equal(derive("微信视频小店标题", "固定内容平台标题"), "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣");
  assert.equal(derive("上市时间", "固定上市时间"), "2026年秋季");
  assert.equal(derive("颜色", "固定颜色"), "蓝色调00388;粉色调01315");
  assert.equal(derive("颜色(文本)", "颜色"), "蓝色调00388;粉色调01315");
  assert.equal(derive("上市时间(文本)"), "2026年秋季");
  assert.equal(derive("选择期数"), "326");
  assert.equal(derive("主图4文案1", "主图4第1句"), "春亚纺贴膜面料");
  assert.equal(derive("主图4文案2", "主图4第2-3句"), "表层防风防泼水透湿\n内里柔软抗静电");
  assert.equal(derive("小红书标题", "去掉巴拉巴拉"), "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣");
  assert.equal(derive("主面料成分含量"), "面料：100%聚酯纤维\n薄膜除外\n里料：100%聚酯纤维");
  const longComposition = `面料：${Array.from({ length: 30 }, (_, index) => `完整材质${index + 1}号1%`).join("、")}`;
  const trimmedComposition = service.buildProductArchiveSourceDerivedFieldValue("主面料成分含量", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows: [{ source_type: "copywriting", row_json: { "面料成分": longComposition } }],
  });
  assert.ok(trimmedComposition.length <= 200);
  assert.match(trimmedComposition, /1%$/);
  const groupedComposition = [
    "大身/领子：50%聚酯纤维、50%棉",
    "袖子/侧缝：10%完整材质一、10%完整材质二、10%完整材质三、10%完整材质四、10%完整材质五、10%完整材质六、10%完整材质七、10%完整材质八",
    "10%完整材质九、10%完整材质十、10%完整材质十一、10%完整材质十二、10%完整材质十三、10%完整材质十四、10%完整材质十五、10%完整材质十六、10%完整材质十七、10%完整材质十八、10%完整材质十九、10%完整材质二十、10%完整材质二十一、10%完整材质二十二、10%完整材质二十三、10%完整材质二十四",
  ].join("\n");
  const trimmedGroupedComposition = service.buildProductArchiveSourceDerivedFieldValue("主面料成分含量", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows: [{ source_type: "copywriting", row_json: { "面料成分": groupedComposition } }],
  });
  assert.equal(trimmedGroupedComposition, "大身/领子：50%聚酯纤维、50%棉");
  assert.doesNotMatch(trimmedGroupedComposition, /袖子\/侧缝/);
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("主面料成分含量", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows: [{ source_type: "copywriting", row_json: { "面料成分": `面料：${"不可拆分材质".repeat(40)}` } }],
  }), "");
  assert.equal(
    derive("25服装面料文案", "面料名称-面料文案*面料三个关键词"),
    "春亚纺贴膜-防风防泼水透湿，多方面防护，户外出行无忧*防泼水-防风-透湿",
  );
  assert.equal(
    derive("25服饰细节文案"),
    "立体连帽，挡风护脖*小动物痛包，萌趣可爱",
  );
  assert.equal(derive("25面料成分"), "成分\n面料：100%聚酯纤维\n薄膜除外\n里料：100%聚酯纤维");
  assert.equal(derive("25版型指数"), "");
  assert.equal(derive("主图4文案1"), "春亚纺贴膜面料");
  assert.equal(derive("主图4文案2"), "表层防风防泼水透湿\n内里柔软抗静电");
  assert.equal(derive("主图4样式"), "225");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("主图4样式", derive("主图4样式"), [
    { value: "服饰标准样式225" },
    { value: "服饰标准样式224" },
  ]), "服饰标准样式225");
  assert.equal(service.productArchiveAiFieldStrategyForField("主图4样式"), null);
  assert.equal(derive("快手标题"), "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣");
  assert.equal(derive("天猫导购标题"), "巴拉巴拉balaOne外套防护连帽衣");
  assert.equal(derive("天猫推荐理由"), "潮流满印外套");
  assert.equal(derive("商品展示标题"), "巴拉巴拉男女外套");
  assert.equal(derive("报价方式"), "按产品数量报价");
  assert.equal(derive("件重尺"), "按规格设置");
  assert.equal(derive("1688供货方式"), "现货");
  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("价格区间", {
    spu: { ...spu, product_line_name: "童装服饰" },
    sourceRows,
    skus: [],
  }), {
    valueText: "",
    valueJson: { title: "产品单价（元）", 1: "359" },
  });
  assert.equal(derive("微信视频小店标题", "内容平台标题"), "【balaOne】巴拉巴拉儿童外套男女2026新秋卡通萌趣满印防护上衣");
  assert.equal(derive("商品详情"), "潮流满印外套，防风防泼水透湿");
});

test("product archive service fills material composition text fields from copywriting", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "201326100101",
        "面料成分": "成分\n面料：100%棉\n（配料除外）",
      },
    },
  ];

  const materialValue = service.buildProductArchiveSourceDerivedFieldValue("材质成分(文本)", {
    spu: { spu_code: "201326100101" },
    sourceRows,
  });
  const compositionValue = service.buildProductArchiveSourceDerivedFieldValue("成分含量(文本)", {
    spu: { spu_code: "201326100101" },
    sourceRows,
    sourceField: "面料成分",
  });

  assert.equal(materialValue, "100%棉（配料除外）");
  assert.equal(compositionValue, "100%棉（配料除外）");
});

test("product archive service derives down and platform text fields before AI fill", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208426120216",
    spu_name: "婴儿外出连体衣",
    brand_code: "20",
    brand_name: "巴拉巴拉",
    filler: "160g/85#绒子",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208426120216",
        "名称": "婴童羽绒连体衣",
        "内容平台标题": "巴拉巴拉婴儿连体衣羽绒服宝宝衣服哈衣爬服2026新款儿童冬装保暖",
        "面料成分": "面料：100%锦纶\n里料：100%锦纶\n填充物\n大身/袖子：白鸭绒\n绒子含量：85%\n其余部位：100%聚酯纤维",
      },
    },
  ];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
  });

  assert.equal(derive("品牌"), "巴拉巴拉");
  assert.equal(derive("生产企业名称"), "浙江森马服饰股份有限公司");
  assert.equal(derive("充绒量(文本)"), "");
  assert.equal(derive("含绒量(文本)"), "85%");
  assert.equal(derive("绒子含量(文本)"), "85%");
  assert.equal(derive("里料成分含量"), "100%锦纶");
  assert.equal(derive("里料材质成分含量(多选)"), "100%聚酰胺纤维");
  assert.equal(derive("羽绒服洗涤说明"), "羽绒服洗涤说明");
  assert.equal(derive("快手标题"), "巴拉巴拉婴儿连体衣羽绒服宝宝衣服哈衣爬服2026新款儿童冬装保暖");
  assert.equal(derive("拼多多标题"), "");
});

test("apparel mapping rules cover the 202426107205 copywriting and Merchant SKU contract", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "202426107205",
    spu_name: "儿童羽绒服",
    brand_name: "巴拉巴拉",
    product_line_name: "童装服饰",
    subclass_name: "羽绒服",
    price_tag: 269.9,
    year: 2026,
    season_name: "Q4",
    filler: "90绒子 鸭绒 70",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "202426107205",
        "导购标题": "巴拉巴拉儿童羽绒服男女童外套潮",
        "面料成分": [
          "成分",
          "大身/领子：100%锦纶",
          "袖子/侧缝：61.3%聚酯纤维 38.7%棉",
          "里料：100%锦纶",
          "填充物",
          "灰鸭绒",
          "绒子含量：90%",
        ].join("\n"),
      },
    },
    {
      source_type: "launch_plan",
      row_json: { "尺码段": "090-180" },
    },
  ];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
  });

  assert.equal(derive("商品短标题"), "巴拉巴拉儿童羽绒服男女童外套潮");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("商品短标题", {
    spu,
    sourceRows,
    templatePlatform: "PDD",
  }), "");
  assert.equal(service.isProductArchiveBusinessBlankField("商品短标题", spu, sourceRows, "PDD"), true);
  assert.equal(service.isProductArchiveBusinessBlankField("商品短标题", spu, sourceRows, "TMALL"), false);
  assert.equal(derive("上市时间"), "2026年冬季");
  assert.equal(derive("适用季节"), "2026年冬季");
  assert.equal(derive("详情页面料"), [
    "大身/领子：100%锦纶",
    "袖子/侧缝：61.3%聚酯纤维 38.7%棉",
    "里料：100%锦纶",
  ].join("\n"));
  assert.equal(derive("里料"), "100%锦纶");
  assert.equal(derive("里料成分"), "100%锦纶");
  assert.equal(derive("适用年龄"), "1-18岁");
  assert.equal(derive("填充物(文本)"), "灰鸭绒");
  assert.equal(derive("填充物含量"), "90%");
  assert.equal(derive("充绒量(文本)"), "");
  assert.equal(derive("安全等级"), "");
  assert.equal(derive("库存计数"), "买家拍下减库存");
  assert.equal(derive("会员打折"), "不参与会员打折");
  assert.equal(derive("拼多多单买价"), "268.9");
  assert.equal(derive("拼多多团购价"), "267.9");
  assert.equal(derive("拼多多拼团价"), "267.9");
  assert.equal(
    derive("试穿报告表兼容平台"),
    "1688;天猫;京东;唯品会;有赞;拼多多;小红书;抖音;快手;微信视频小店",
  );

  const merchantSkuColumns = [
    "价格",
    "货号",
    "上市时间",
    "数量",
    "商家编码",
    "条形码",
    "零售价",
    "供货价",
    "唯品会货号",
    "唯品会条形码",
    "拼多多单买价",
    "拼多多团购价",
    "天猫特卖折扣价",
    "天猫特卖专柜价",
    "单品货号",
    "小红书商家编码",
    "天猫SKU搜索标题",
  ];
  const merchantSku = service.buildProductArchiveMdmDerivedFieldValue("商家SKU", {
    spu,
    sourceRows,
    dateText: "2026-08-28",
    templateOptions: merchantSkuColumns,
    skus: [{
      sku_code: "20242610720580821090",
      skc_code: "20242610720580821",
      inner_code: "INNER-80821-090",
      ean_code: "6900000000090",
      color_name: "黑色调80821",
      size_name: "090",
      price_tag: 269.9,
    }],
  });
  assert.equal(merchantSku.valueJson.title, merchantSkuColumns.join(","));
  assert.equal(
    merchantSku.valueJson["黑色调80821"]["90cm"],
    [
      "269.9",
      "202426107205",
      "2026-08",
      "0",
      "INNER-80821-090",
      "",
      "269.9",
      "269.9",
      "20242610720580821",
      "6900000000090",
      "268.9",
      "267.9",
      "269.9",
      "269.9",
      "6900000000090",
      "20242610720580821090",
      "巴拉巴拉儿童羽绒服男女童外套潮",
    ].join(","),
  );
});

test("shared platform list-price allowlist also fills Merchant SKU columns", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const listPriceColumns = [
    "采购价",
    "京东自营市场价",
    "有赞标准价",
    "有赞价格",
    "原价",
    "小红书市场价",
    "抖音结算价格",
    "抖音价",
    "快手价",
    "爱库存供货价",
    "爱库存最低价",
    "好衣库结算价",
    "好衣库供货价",
    "好衣库价",
    "好衣库原价",
    "微信视频小店价格",
  ];
  const templateOptions = [...listPriceColumns, "成本价", "特殊专柜价"];

  for (const productLineName of ["童装服饰", "鞋品"]) {
    const result = service.buildProductArchiveMdmDerivedFieldValue("商家SKU", {
      spu: { spu_code: "208426121101", product_line_name: productLineName, price_tag: 299 },
      sourceRows: [],
      dateText: "2026-08-28",
      templateOptions,
      skus: [{
        sku_code: "SKU-130",
        skc_code: "SKC-130",
        inner_code: "INNER-130",
        ean_code: "6900000000130",
        color_name: "黑色90001",
        size_name: "130",
        price_tag: 299,
      }],
    });
    assert.equal(result.valueJson.title, listPriceColumns.join(","));
    const values = result.valueJson["黑色90001"][productLineName === "鞋品" ? "130" : "130cm"].split(",");
    assert.deepEqual(values, listPriceColumns.map(() => "299"));
    assert.doesNotMatch(result.valueJson.title, /成本价|特殊专柜价/);
  }
});

test("product archive evidence rules backfill filler text and equivalent down-content fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fields = [
    {
      id: 1,
      field_name: "填充物(文本)",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [],
    },
    {
      id: 4,
      field_name: "填充物(多选)",
      value_text: "聚酯纤维",
      value_json: {},
      validation_status: "valid",
      options_json: [{ value: "聚酯纤维" }],
    },
    {
      id: 5,
      field_name: "充绒量(文本)",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [],
    },
    {
      id: 2,
      field_name: "充绒量",
      value_text: "80码14克；90码15克",
      value_json: {},
      validation_status: "invalid",
      options_json: [{ value: "绒子含量90%" }],
    },
    {
      id: 3,
      field_name: "填充物含量",
      value_text: "绒子含量90%",
      value_json: {},
      validation_status: "valid",
      options_json: [{ value: "绒子含量90%" }],
    },
  ];

  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426107202" },
    fields,
    sourceRows: [],
  });

  assert.deepEqual(fills.map((fill) => [fill.field_name, fill.field_value, fill.source_type]), [
    ["填充物(文本)", "聚酯纤维", "field_backup_rule"],
    ["充绒量", "绒子含量90%", "field_backup_rule"],
  ]);
});

test("product archive evidence rules do not treat size-specific fill weight text as down-content evidence", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426107202" },
    fields: [
      {
        id: 1,
        field_name: "充绒量(文本)",
        value_text: "绒子含量90%",
        value_json: {},
        validation_status: "valid",
        options_json: [{ value: "绒子含量90%" }],
      },
      {
        id: 2,
        field_name: "填充物含量",
        value_text: "",
        value_json: {},
        validation_status: "missing",
        options_json: [{ value: "绒子含量90%" }],
      },
    ],
  });

  assert.deepEqual(fills.map((fill) => [fill.field_name, fill.field_value, fill.source_type]), []);
});

test("product archive evidence rules use explicit no-filler source evidence for every related required field", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426105201" },
    sourceRows: [{
      source_type: "copywriting",
      row_json: { "面料成分": "面料：100%聚酯纤维\n填充物：无" },
    }],
    fields: [
      { id: 1, field_name: "填充物(文本)", value_text: "", value_json: {}, validation_status: "missing", options_json: [] },
      { id: 2, field_name: "填充物(多选)", value_text: "", value_json: {}, validation_status: "missing", options_json: [{ value: "羽绒" }, { value: "其他" }] },
      { id: 3, field_name: "绒子含量", value_text: "", value_json: {}, validation_status: "missing", options_json: [{ value: "90%以上" }, { value: "其他" }] },
      { id: 4, field_name: "绒子含量(文本)", value_text: "", value_json: {}, validation_status: "missing", options_json: [] },
      { id: 5, field_name: "含绒量(多选)", value_text: "", value_json: {}, validation_status: "missing", options_json: [{ value: "80%以上" }, { value: "其他" }] },
      { id: 6, field_name: "填充物含量", value_text: "", value_json: {}, validation_status: "missing", options_json: [{ value: "90%以上" }, { value: "其他" }] },
      { id: 7, field_name: "充绒量(文本)", value_text: "", value_json: {}, validation_status: "missing", options_json: [] },
    ],
  });

  assert.deepEqual(fills.map((fill) => [fill.field_name, fill.field_value]), [
    ["填充物(文本)", "无"],
    ["填充物(多选)", "其他"],
    ["绒子含量", "其他"],
    ["绒子含量(文本)", "无"],
    ["含绒量(多选)", "其他"],
    ["填充物含量", "其他"],
  ]);
});

test("product archive down-content normalizer maps a percentage to the template range without using size weights", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("充绒量", "90%", [
    { value: "80%-89%" },
    { value: "90%以上" },
  ]), "90%以上");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("填充物含量", "绒子含量90%", [
    { value: "绒子含量90%" },
  ]), "绒子含量90%");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("含绒量(多选)", "无", [
    { value: "80%以上" },
    { value: "其他" },
  ]), "其他");
});

test("product archive source rules map product-style and popular-element evidence to template options", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("款式", "儿童三合一外套", [
    { value: "儿童一衣三穿羽绒服" },
    { value: "连帽外套" },
  ]), "儿童一衣三穿羽绒服");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("款式", "儿童短款棉服上衣", [
    { value: "羽绒服" },
    { value: "短款棉服" },
  ]), "短款棉服");

  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426101203" },
    sourceRows: [{
      source_type: "copywriting",
      row_json: { "设计师说": "费尔岛图案针织设计" },
    }],
    fields: [{
      id: 1,
      field_name: "流行元素(多选)",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [{ value: "光版" }, { value: "图案" }],
    }],
  });
  assert.deepEqual(fills.map((fill) => [fill.field_name, fill.field_value]), [["流行元素(多选)", "图案"]]);

  const plainFills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426101201" },
    sourceRows: [{
      source_type: "copywriting",
      row_json: { FAB: "工艺：无；设计：简约休闲" },
    }],
    fields: [{
      id: 2,
      field_name: "流行元素(多选)",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [{ value: "图案" }, { value: "光版" }],
    }],
  });
  assert.deepEqual(plainFills.map((fill) => [fill.field_name, fill.field_value]), [["流行元素(多选)", "光版"]]);
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("流行元素(多选)", "旋钮扣", [
    { value: "搭扣" },
    { value: "拼色" },
  ]), "搭扣");
});

test("product archive filler text uses source material evidence when no peer field has been filled", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426106201" },
    sourceRows: [{
      source_type: "copywriting",
      row_json: { "面料成分": "面料：100%锦纶\n填充物：100%聚酯纤维" },
    }],
    fields: [{
      id: 1,
      field_name: "填充物(文本)",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [],
    }],
  });
  assert.deepEqual(fills.map((fill) => [fill.field_name, fill.field_value, fill.source_type]), [
    ["填充物(文本)", "聚酯纤维", "source_rule"],
  ]);
});

test("product archive down-fill text populates matching size-chart rows without changing scalar fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const updates = service.buildProductArchiveDownFillWeightSizeChartUpdates([
    {
      id: 1,
      field_name: "充绒量(文本)",
      value_text: "80码14克；90码15克；100码19克",
      source_type: "washlabel_ocr",
      source_ref: "201426101201洗唛.jpg",
    },
    {
      id: 2,
      field_name: "尺码表",
      value_json: {
        title: "衣长,充绒(g),胸围",
        "80cm": "34.5,0,69",
        "90cm": "36.5,0,72",
        "100cm": "39.5,0,76",
      },
      source_type: "size_chart",
      source_ref: "PLM尺码表",
    },
    {
      id: 3,
      field_name: "唯品会尺码表",
      value_json: {
        title: "号型,衣长,充绒量",
        "80cm": "80,34.5,0",
        "90cm": "90,36.5,0",
        "100cm": "100,39.5,0",
      },
      source_type: "size_chart",
      source_ref: "PLM尺码表",
    },
  ]);

  assert.deepEqual(updates, [
    {
      fieldId: 2,
      fieldName: "尺码表",
      valueJson: {
        title: "衣长,充绒(g),胸围",
        "80cm": "34.5,14,69",
        "90cm": "36.5,15,72",
        "100cm": "39.5,19,76",
      },
      sourceType: "washlabel_ocr",
      sourceRef: "201426101201洗唛.jpg",
    },
    {
      fieldId: 3,
      fieldName: "唯品会尺码表",
      valueJson: {
        title: "号型,衣长,充绒量",
        "80cm": "80,34.5,14",
        "90cm": "90,36.5,15",
        "100cm": "100,39.5,19",
      },
      sourceType: "washlabel_ocr",
      sourceRef: "201426101201洗唛.jpg",
    },
  ]);
});

test("product archive down-fill size-chart sync falls back to a plain down-fill field", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const updates = service.buildProductArchiveDownFillWeightSizeChartUpdates([
    {
      id: 1,
      field_name: "充绒量",
      value_text: "80码14克；90码15克",
      source_type: "washlabel_ocr",
    },
    {
      id: 2,
      field_name: "尺码表",
      value_json: {
        title: "衣长,充绒(g)",
        "80cm": "34.5,0",
        "90cm": "36.5,0",
      },
    },
  ]);

  assert.deepEqual(updates, [{
    fieldId: 2,
    fieldName: "尺码表",
    valueJson: {
      title: "衣长,充绒(g)",
      "80cm": "34.5,14",
      "90cm": "36.5,15",
    },
    sourceType: "washlabel_ocr",
    sourceRef: null,
  }]);
});

test("product archive asset package helpers classify reference images and model shots", async () => {
  const [service, serviceSource, route] = await Promise.all([
    import("../../web/server/services/product-archive-drafts.ts"),
    readText(files.draftService),
    readText(files.draftRoute),
  ]);

  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426108013/208426108013_洗唛_1.jpg"), "washlabel");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("202426107205/yq2.jpg"), "washlabel");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("202426107205/yq (3).png"), "washlabel");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426108013/208426108013_吊牌_yq1.jpg"), "hangtag");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426140204/208426140204_鞋盒.jpg"), "hangtag");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426140204/shoebox.png"), "hangtag");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426108013/208426108013_洗唛.pdf"), "washlabel");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426108013/208426108013_吊牌.pdf"), "hangtag");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("208426108013/208426108013-00455_有模拍.jpg"), "reference_image");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("幼童测试洗唛吊牌/208426108013/208426108013_吊牌_yq1.jpg"), "hangtag");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("幼童测试洗唛吊牌/208426108013/208426108013-00455_有模拍.jpg"), "reference_image");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("幼童测试洗唛吊牌/208426108013/208426108013-00455.jpg"), "reference_image");
  assert.equal(service.classifyProductArchiveAssetPackageFileName("深绘吊牌洗唛平铺图下载结果_20260817.xlsx"), "spreadsheet");
  assert.equal(service.productArchiveImageHasModelShot("208426108013/208426108013-00455_有模拍.jpg"), true);
  assert.equal(service.productArchiveImageHasModelShot("208426108013/208426108013-00455.jpg"), false);
  assert.match(route, /function repairLegacyDraftImageLocalPath/);
  assert.match(route, /imageFileVariant\(c\.req\.query\("variant"\)/);
  assert.match(route, /resize\(160, 160, \{ fit: "cover"/);
  assert.match(route, /source_type\) !== "crawshrimp_asset_package"/);
  assert.match(route, /assertLocalImageFile\(\{ rootDir: DRAFT_IMAGE_DIR, filePath: localPath \}\)/);
  assert.match(route, /assertLocalProductArchiveAssetFile\(\{ rootDir: DRAFT_IMAGE_DIR, filePath: localPath \}\)/);
  assert.match(serviceSource, /asset_kind: stringValue\(payload\.asset_kind\) \|\| null/);
  assert.match(serviceSource, /type ProductArchiveDraftListImageCounts = Record<ProductArchiveDraftListImageKind, number>/);
  assert.match(serviceSource, /state\.counts\[preview\.kind\] \+= 1/);
  assert.match(serviceSource, /asset_package_image_count: imageCounts\.reference/);
  assert.match(serviceSource, /hangtag_upload_count: Math\.max\(Number\(row\.hangtag_upload_count \?\? 0\), imageCounts\.hangtag\)/);
  assert.match(serviceSource, /washlabel_upload_count: Math\.max\(Number\(row\.washlabel_upload_count \?\? 0\), imageCounts\.washlabel\)/);
  assert.match(serviceSource, /const displayImage = imagePreviews\.reference\.find\(\(image\) => image\.asset_kind === "flat_image"\)/);
  assert.match(serviceSource, /thumbnail_image_url: displayImage\?\.thumbnail_url \?\? null/);
});

test("product archive source and evidence rules fill 208426 batch workbook fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208426107229",
        "版型": "宽松型",
        "厚薄": "偏厚",
        "弹性": "无弹",
        "面料成分": "成分\n面料：100%锦纶\n填充物\n大身/袖子：灰鸭绒\n绒子含量：80%",
      },
    },
  ];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu: { spu_code: "208426107229" },
    sourceRows,
  });

  assert.equal(derive("单位"), "件");
  assert.equal(derive("型号"), "208426107229");
  assert.equal(derive("服装版型"), "宽松型");
  assert.equal(derive("填充物种类"), "灰鸭绒");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("厚薄", "偏厚", [{ value: "常规" }, { value: "超厚" }]), "超厚");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("弹力", "弹力", [{ value: "无弹" }, { value: "微弹" }, { value: "常规" }]), "常规");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("是否可开档", "否", [{ value: "开裆" }, { value: "不开裆" }]), "不开裆");

  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { id: 7, spu_code: "208426107229" },
    sourceRows,
    referenceImages: [{
      source_type: "crawshrimp_asset_package",
      original_file_name: "208426107229/208426107229-00455_有模拍.jpg",
      raw_payload_json: { has_model_shot: true },
    }],
    fields: [
      { id: 1, field_name: "单位", value_text: "", value_json: {}, options_json: [{ value: "件" }] },
      { id: 2, field_name: "型号", value_text: "", value_json: {}, options_json: [] },
      { id: 3, field_name: "模特实拍", value_text: "", value_json: {}, options_json: [{ value: "实拍有模特" }, { value: "实拍无模特" }] },
      { id: 4, field_name: "服装版型", value_text: "", value_json: {}, options_json: [{ value: "标准型" }, { value: "宽松型" }] },
      { id: 5, field_name: "厚薄", value_text: "", value_json: {}, options_json: [{ value: "常规" }, { value: "超厚" }] },
      { id: 6, field_name: "弹力", value_text: "", value_json: {}, options_json: [{ value: "无弹" }, { value: "微弹" }, { value: "常规" }] },
      { id: 7, field_name: "填充物种类", value_text: "", value_json: {}, options_json: [{ value: "白鸭绒" }, { value: "灰鸭绒" }] },
    ],
  });
  const fillMap = new Map(fills.map((fill) => [fill.field_name, fill.field_value]));
  assert.equal(fillMap.get("单位"), "件");
  assert.equal(fillMap.get("型号"), "208426107229");
  assert.equal(fillMap.get("模特实拍"), "实拍有模特");
  assert.equal(fillMap.get("服装版型"), "宽松型");
  assert.equal(fillMap.get("厚薄"), "超厚");
  assert.equal(fillMap.get("弹力"), "无弹");
  assert.equal(fillMap.get("填充物种类"), "灰鸭绒");
});

test("product archive service maps every main-fabric component for 208326105206-TEST", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208326105206-TEST",
        "面料成分": "成分\n面料：68.4%棉\n31.6%聚酯纤维\n里料：100%聚酯纤维\n（装饰物除外）",
      },
    },
  ];
  const derive = (fieldName, sourceField = "面料成分") => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu: { spu_code: "208326105206-TEST" },
    sourceRows,
    sourceField,
  });

  assert.equal(derive("材质成分"), "棉,68.4;聚酯纤维,31.6");
  assert.equal(derive("面料(多选)"), "棉;聚酯纤维");
  assert.equal(derive("材质成分(多选)", ""), "棉;聚酯纤维");
  assert.equal(derive("面料"), "棉混纺");
  assert.equal(derive("材质"), "棉混纺");
  assert.equal(derive("面料俗称", "根据面料成分填主材质"), "棉混纺");
  assert.equal(derive("京东材质成分", "吊牌成分"), "棉,68.4;涤纶(聚酯纤维),31.6");
  assert.equal(derive("材质成分(文本)"), "68.4%棉；31.6%聚酯纤维");
  assert.equal(derive("袖长", ""), "长袖");

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("面料(多选)", "棉;聚酯纤维", [
    { value: "棉" },
    { value: "聚酯纤维" },
  ]), "棉;聚酯纤维");
});

test("product archive service separates flattened apparel composition sections", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const composition = "成分主面料复合面布:94.1%聚酯纤维5.9%氨纶复合底布:100%聚酯纤维梭织面料:100%锦纶帽里料:63.7%聚酯纤维36.3%棉填充物:100%聚酯纤维";
  const sourceRows = [{
    source_type: "copywriting",
    row_json: { "款号": "208426121101", "面料成分": composition },
  }];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu: { spu_code: "208426121101", product_line_name: "中童服装" },
    sourceRows,
  });

  assert.equal(derive("材质成分"), "聚酯纤维,94.1;氨纶,5.9");
  assert.equal(derive("面料(多选)"), "聚酯纤维;氨纶;聚酰胺纤维;棉");
  assert.equal(derive("里料材质成分含量(多选)"), "63.7%聚酯纤维;36.3%棉");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("里料材质成分含量(多选)", derive("里料材质成分含量(多选)"), [
    { value: "95%及以上" },
    { value: "51%(含)-70%(含)" },
    { value: "30%(含)-50%(含)" },
    { value: "29%及以下" },
  ]), "51%(含)-70%(含);30%(含)-50%(含)");
  assert.equal(service.resolveProductArchiveSourceRuleValue("里料材质成分含量(多选)", {
    spu: { spu_code: "208426121101", product_line_name: "中童服装" },
    sourceRows,
    rule: { source_type: "copywriting", source_field: "面料成分" },
  }), "63.7%聚酯纤维;36.3%棉");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("面料(多选)", derive("面料(多选)"), [
    { value: "锦纶" },
    { value: "聚酯纤维" },
    { value: "精梳棉" },
    { value: "棉布" },
    { value: "其他" },
  ]), "聚酯纤维;其他;锦纶;棉布");
  assert.equal(
    derive("主面料成分含量"),
    "主面料复合面布：94.1%聚酯纤维5.9%氨纶\n复合底布：100%聚酯纤维\n梭织面料：100%锦纶\n帽里料：63.7%聚酯纤维36.3%棉\n填充物：100%聚酯纤维",
  );
});

test("product archive material mapping does not fall back to launch-plan composition", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const sourceRows = [{
    source_type: "launch_plan",
    row_json: { "面料成分": "面料：100%聚酯纤维" },
  }];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu: { spu_code: "208326105206-TEST" },
    sourceRows,
    sourceField: "面料成分",
  });

  assert.equal(derive("材质成分"), "");
  assert.equal(derive("面料(多选)"), "");
  assert.equal(derive("材质成分(文本)"), "");
});

test("product archive service follows DeepDraw field adjustment doc for optional and default fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208326105214",
    price_tag: 359,
    unit_name: "件",
    age_group_name: "幼童",
    article_prop_name: "C类",
    product_line_name: "童装服饰",
    subclass_name: "普通外套",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "搜索标题": "巴拉巴拉儿童外套男童女童衣服2026新款秋装卡通萌趣满印防护上衣",
        "导购标题": "巴拉巴拉balaOne外套防护连帽衣",
        "推荐理由": "潮流满印外套，防风防泼水透湿",
        "FAB": "精选高弹春亚纺贴膜面料，糯弹亲肤，抗皱性强。",
        "面料成分": "面料：100%聚酯纤维",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "尺码段": "90-130",
        "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套",
      },
    },
  ];

  const derive = (fieldName, sourceField = "") => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows,
    sourceField,
  });

  assert.equal(derive("商品描述"), "");
  assert.equal(derive("商品短标题"), "巴拉巴拉balaOne外套防护连帽衣");
  assert.equal(derive("图案(多选)"), "");
  assert.equal(derive("微信视频小店副标题"), "");
  assert.equal(derive("快手商品卖点"), "");
  assert.equal(derive("成分含量"), "100%");
  assert.equal(derive("主面料成分含量"), "面料：100%聚酯纤维");
  assert.equal(derive("商品详情"), "潮流满印外套，防风防泼水透湿");
  assert.equal(derive("安全等级"), "");
  assert.equal(derive("适用年龄多选"), "1-8岁");
  assert.equal(derive("适用年龄文本"), "1-8岁");
  assert.equal(derive("22Q4-童鞋卖点", "公主鞋"), "");
  assert.equal(derive("25鞋子模板类型", "运动"), "");
  assert.equal(derive("文胸图标", "文胸二阶段"), "");
  assert.equal(derive("水杯说明", "冷水杯"), "");
  assert.equal(derive("配饰版默认文案", "帽子"), "");

  assert.equal(service.isProductArchiveBusinessBlankField(
    "配饰版默认文案",
    { product_line_name: "童装服饰", spu_name: "连帽外套" },
    [{ source_type: "launch_plan", row_json: { "官方发布类目": "童装/婴儿装/亲子装 > 外套/夹克/大衣 > 普通外套" } }],
  ), true);
  assert.equal(service.isProductArchiveBusinessBlankField(
    "配饰版默认文案",
    { product_line_name: "配饰", subclass_name: "帽子" },
    [],
  ), false);
  assert.equal(service.isProductArchiveBusinessBlankField(
    "水杯说明",
    { product_line_name: "内衣", subclass_name: "文胸罩杯" },
    [],
  ), true);
  assert.equal(service.isProductArchiveBusinessBlankField(
    "水杯说明",
    { product_line_name: "生活用品", subclass_name: "水杯" },
    [],
  ), false);
});

test("product archive shoe required fields derive from trusted launch and brand evidence", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208426140203",
    spu_name: "儿童户外鞋",
    price_tag: 359,
    brand_code: "20",
    brand_name: "巴拉巴拉",
    product_line_name: "鞋品",
    middle_class_name: "运动鞋",
    subclass_name: "户外鞋",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: {
        "款号": "208426140203",
        "内容平台标题": "巴拉巴拉儿童户外运动鞋防滑耐磨",
        "导购标题": "儿童户外鞋防滑耐磨",
        "唯品标题": "巴拉巴拉儿童户外鞋",
        "推荐理由": "防滑耐磨，校园日常都好穿",
        "FAB": "加厚鞋垫，舒适保暖",
        "面料成分": "帮面材料：合成革/织物",
        "帮面材料": "合成革/织物",
        "里料材质": "网布",
        "鞋底材质": "EVA+橡胶",
        "名称": "儿童户外鞋",
        "品类": "户外鞋",
        "细节文案": "1.鞋头防撞：行走更安心\n2.鞋底防滑：雨天稳抓地",
      },
    },
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208426140203",
        "属性": "专供新品",
        "尺码段": "26-40",
        "吊牌价": "359",
        "产品季类": "2026年秋季",
        "年龄段": "中童",
        "性别": "男 and 女",
        "主款式（唯品四级品类）": "运动鞋",
        "执行标准": "GB/T 15107",
        "鞋品企业名称": "杭州测试鞋业有限公司",
        "官方发布类目": "童鞋/婴儿鞋/亲子鞋>>运动鞋（新）>>儿童户外鞋",
      },
    },
  ];
  const derive = (fieldName, rows = sourceRows) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows: rows,
  });

  assert.equal(derive("商品市场价"), "359");
  assert.equal(derive("生产/经销厂家"), "浙江森马服饰股份有限公司");
  assert.equal(derive("厂家地址"), "温州市瓯海区娄桥工业园南汇路98号");
  assert.equal(derive("货源类别"), "现货");
  assert.equal(derive("单买价"), "358");
  assert.equal(derive("团购价"), "357");
  assert.equal(derive("拼团价"), "357");
  assert.equal(derive("抖音参考价"), "359");
  assert.equal(derive("奥莱店折扣价"), "359");
  assert.equal(derive("产品单价"), "359");
  assert.equal(derive("专柜价"), "10000");
  assert.equal(derive("是否商场同款"), "否");
  assert.equal(derive("是否商场同款", [
    { source_type: "launch_plan", row_json: { "属性": "全域", "官方发布类目": "童鞋/运动鞋" } },
  ]), "是");
  assert.equal(derive("是否新品"), "是");
  assert.equal(derive("是否库存"), "否");
  assert.equal(derive("是否外贸"), "否");
  assert.equal(derive("发货方式"), "快递发货");
  assert.equal(derive("最快出货时间"), "48小时");
  assert.equal(derive("最晚发货时间"), "2天");
  assert.equal(derive("单用户累计限购(件)"), "5");
  assert.equal(derive("每次限购(件)"), "5");
  assert.equal(derive("拼多多标题"), "");
  assert.equal(derive("微信视频小店标题"), "巴拉巴拉儿童户外运动鞋防滑耐磨");
  assert.equal(derive("快手标题"), "巴拉巴拉儿童户外运动鞋防滑耐磨");
  assert.equal(derive("小红书标题"), "巴拉巴拉儿童户外运动鞋防滑耐磨");
  assert.equal(derive("抖音标题"), "巴拉巴拉儿童户外运动鞋防滑耐磨");
  assert.equal(derive("微信视频小店副标题"), "儿童户外鞋防滑耐磨");
  assert.equal(derive("微信视频小店商品编码"), "208426140203");
  assert.equal(derive("唯品会款号"), "208426140203");
  assert.equal(derive("唯品会标题"), "巴拉巴拉儿童户外鞋");
  assert.equal(derive("唯品会副标题"), "防滑耐磨");
  assert.equal(derive("商品详情"), "防滑耐磨，校园日常都好穿");
  assert.equal(derive("天猫商品卖点"), "防滑耐磨，校园日常都好穿");
  assert.equal(derive("天猫导购标题"), "儿童户外鞋防滑耐磨");
  assert.equal(derive("天猫推荐理由"), "防滑耐磨，校园日常都好穿");
  assert.equal(derive("商品展示标题"), "巴拉巴拉男 and 女中童户外鞋");
  assert.equal(derive("25实拍文案"), "鞋头防撞-行走更安心*鞋底防滑-雨天稳抓地");
  assert.equal(derive("25产品名称"), "儿童户外鞋");
  assert.equal(derive("25鞋子模板类型"), "");
  assert.equal(derive("尺码类型"), "欧码（童鞋）");
  assert.equal(derive("帮面材质"), "合成革/织物");
  assert.equal(derive("配皮材质(多选)"), "合成革/织物");
  assert.equal(derive("鞋底材质(多选)"), "EVA+橡胶");
  assert.equal(derive("详情页面料"), "帮面材料：合成革/织物\n里料材质：网布\n鞋底材质：EVA+橡胶");
  assert.equal(derive("唯品会材质"), "帮面材料：合成革/织物\n里料材质：网布\n鞋底材质：EVA+橡胶");
  assert.equal(derive("25面料成分"), "帮面材料：合成革/织物\n里料材质：网布\n鞋底材质：EVA+橡胶");
  assert.equal(derive("材质(1688)"), "合成革/织物");
  assert.equal(derive("鞋垫材质"), "");
  assert.equal(derive("25柔软指数"), "");
  assert.equal(derive("25厚薄指数"), "");
  assert.equal(derive("25弹力指数"), "");
  assert.equal(derive("25版型指数"), "");
  assert.equal(derive("商品包装重量"), "");
  assert.equal(derive("商品包装长"), "");
  assert.equal(derive("商品包装宽"), "");
  assert.equal(derive("商品包装高"), "");
  assert.equal(derive("唯品重量"), "");
  assert.equal(derive("唯品【包装】长"), "");
  assert.equal(derive("唯品【包装】宽"), "");
  assert.equal(derive("唯品【包装】高"), "");
  assert.equal(service.isProductArchiveBusinessBlankField("商品重量", spu, sourceRows), false);
  assert.equal(service.isProductArchiveBusinessBlankField("京东商品包装重量", spu, sourceRows), false);
  assert.equal(derive("25服饰细节文案"), "");
  assert.equal(derive("25服饰品牌样式"), "");
  assert.equal(derive("羽绒服洗涤说明"), "");
  assert.equal(derive("详情页AI标注"), "");
  assert.equal(derive("单色平台AI标"), "");
  assert.equal(derive("多色平台AI"), "");
  assert.equal(derive("试穿报告表"), "");
  assert.equal(derive("质检报告"), "否");
  assert.equal(derive("质检报告表"), "否");
  assert.equal(service.isProductArchiveBusinessBlankField("试穿报告表", spu, sourceRows), true);
  assert.equal(service.isProductArchiveBusinessBlankField("质检报告", spu, sourceRows), false);
  assert.equal(derive("适用季节"), "2026年秋季");
  assert.equal(derive("上市时间(文本)"), "2026年秋季");
  assert.equal(
    derive("尺码推荐表兼容平台"),
    "1688;天猫;京东;唯品会;有赞;拼多多;小红书;抖音;快手;微信视频小店",
  );
  assert.equal(derive("适用人群(多选)"), "中童");
  assert.equal(derive("适用场合(多选)"), "日常;校园;公路");
  assert.equal(derive("适用场景"), "休闲");
  assert.equal(derive("功能(多选)"), "防滑;耐磨;保暖");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("功能", derive("功能"), [
    { value: "耐磨" },
    { value: "防滑" },
    { value: "保暖" },
  ]), "防滑");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("功能(多选)", derive("功能(多选)"), [
    { value: "耐磨" },
    { value: "防滑" },
    { value: "保暖" },
  ]), "防滑;耐磨;保暖");
  assert.equal(derive("执行标准"), "GB/T 15107");
  assert.equal(derive("京东[包装]宽"), "100");
  assert.equal(derive("京东[包装]长"), "100");
  assert.equal(derive("京东[包装]高"), "100");
  assert.equal(derive("京东发货地"), "杭州");
  assert.equal(derive("京东商品重量"), "1");
  assert.equal(derive("售后服务承诺"), "延保90天");
  assert.equal(derive("balaone仅专供新品勾选"), "");
  assert.equal(derive("产地"), "浙江杭州");
  assert.equal(derive("产地", [
    {
      source_type: "launch_plan",
      row_json: {
        "大货款号": "208426140203",
        "尺码段": "26-40",
        "官方发布类目": "童鞋/婴儿鞋/亲子鞋>>运动鞋（新）>>儿童户外鞋",
      },
    },
  ]), "浙江杭州");

  const merchantSku = service.buildProductArchiveMdmDerivedFieldValue("商家SKU", {
    spu,
    sourceRows,
    dateText: "2026-08-27",
    templateOptions: [
      "价格", "货号", "上市时间", "数量", "商家编码", "条形码", "零售价", "供货价",
      "唯品会货号", "唯品会条形码", "拼多多单买价", "拼多多团购价", "单品货号",
      "小红书商家编码", "天猫SKU搜索标题",
    ],
    skus: [{
      sku_code: "20842614020300136",
      skc_code: "208426140203001",
      inner_code: "INNER-SHOE-36",
      ean_code: "6900000000036",
      color_name: "黑色001",
      size_name: "036",
      price_tag: 359,
    }],
  });
  assert.equal(
    merchantSku.valueJson["黑色001"]["36"],
    [
      "359", "208426140203", "2026-08", "0", "INNER-SHOE-36", "", "359", "359",
      "208426140203001", "6900000000036", "358", "357", "6900000000036",
      "208426140203001", "儿童户外鞋防滑耐磨",
    ].join(","),
  );
});

test("shoe and apparel display titles ignore stale mapping placeholders", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = {
    spu_code: "208426140204",
    brand_name: "巴拉巴拉",
    product_line_name: "鞋品",
  };
  const sourceRows = [
    {
      source_type: "copywriting",
      row_json: { "性别": "男", "年龄段": "中幼童", "品类": "运动鞋" },
    },
    {
      source_type: "launch_plan",
      row_json: { "性别": "男", "年龄段": "中幼童", "品类": "运动鞋" },
    },
    {
      source_type: "launch_plan",
      row_json: { "性别": "女", "年龄段": "中幼童", "品类": "运动鞋" },
    },
  ];

  assert.equal(
    service.buildProductArchiveSourceDerivedFieldValue("商品展示标题", { spu, sourceRows }),
    "巴拉巴拉男 and 女中幼童运动鞋",
  );
  assert.equal(
    service.resolveProductArchiveSourceRuleValue("商品展示标题", {
      spu,
      sourceRows,
      rule: {
        source_type: "fixed",
        default_value: "巴拉巴拉+性别+品类",
      },
    }),
    "巴拉巴拉男 and 女中幼童运动鞋",
  );
  assert.equal(
    service.resolveProductArchiveSourceRuleValue("商品展示标题", {
      spu: {
        spu_code: "208426121101",
        brand_name: "巴拉巴拉",
        product_line_name: "中童服装",
        gender_name: "男",
        subclass_name: "连帽卫衣",
      },
      sourceRows: [{
        source_type: "copywriting",
        row_json: { "性别": "男", "品类": "卫衣", "尺码": "130-170" },
      }],
      rule: {
        source_type: "fixed",
        default_value: "品牌+性别+品类",
      },
    }),
    "巴拉巴拉男卫衣",
  );
});

test("product archive service maps launch-plan size segments to Balabala age ranges", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const deriveAge = (sizeSegment, spu = {}, fieldName = "适用年龄") => service.buildProductArchiveSourceDerivedFieldValue(fieldName, {
    spu,
    sourceRows: [
      {
        source_type: "launch_plan",
        row_json: { "尺码段": sizeSegment },
      },
    ],
  });

  assert.equal(deriveAge("52-66"), "新生儿, 3个月");
  assert.equal(deriveAge("66-90"), "3-18个月");
  assert.equal(deriveAge("73-100"), "6个月-2岁");
  assert.equal(deriveAge("90-130"), "1-8岁");
  assert.equal(deriveAge("90-140"), "1-11岁");
  assert.equal(deriveAge("90-180"), "1-18岁");
  assert.equal(deriveAge("130-170"), "6-16岁");
  assert.equal(deriveAge("130-175"), "6-17岁");
  assert.equal(deriveAge("140-175"), "8-17岁");
  assert.equal(deriveAge("19-24", { product_line_name: "鞋品" }), "4-24个月");
  assert.equal(deriveAge("25-33", { product_line_name: "鞋品" }), "3-7岁");
  assert.equal(deriveAge("34-39", { product_line_name: "鞋品" }), "8-14岁");
  assert.equal(deriveAge("26-40", { product_line_name: "鞋品" }), "7岁-14岁");
  assert.equal(deriveAge("90-130", {}, "淘宝天猫适用年龄"), "1-8岁");
  assert.equal(deriveAge("130-175", {}, "适合年龄段(多选)"), "6-17岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用人群(多选)", "6-16岁", [
    { value: "青少年" },
    { value: "幼童" },
    { value: "小童" },
    { value: "婴童" },
    { value: "亲子" },
    { value: "中大童" },
  ]), "中大童");
  assert.equal(service.buildProductArchiveSourceDerivedFieldValue("适用人群", {
    spu: { product_line_name: "童装服饰", gender_name: "男" },
    sourceRows: [{
      source_type: "launch_plan",
      row_json: { "尺码段": "130-170", "性别": "男" },
    }],
  }), "6-16岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用人群(多选)", "儿童;中大童;青少年", [
    { value: "儿童" },
    { value: "中大童" },
    { value: "青少年" },
    { value: "不限" },
  ]), "儿童;中大童;青少年");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用人群(多选)", "7岁-14岁", [
    { value: "不限" },
    { value: "中大童" },
    { value: "中学生" },
    { value: "亲子" },
    { value: "儿童" },
    { value: "婴童" },
    { value: "小学生" },
    { value: "小童" },
    { value: "幼童" },
    { value: "青少年" },
  ]), "中大童;中学生;儿童;小学生;小童;青少年");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用人群", "6-16岁", [
    { value: "青少年" },
    { value: "男童" },
    { value: "少年" },
    { value: "学生" },
    { value: "儿童" },
  ]), "儿童");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用人群", "6-16岁", [
    { value: "儿童" },
    { value: "中大童" },
    { value: "青少年" },
  ]), "中大童");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("性别", "男童", [
    { value: "男童" },
    { value: "男" },
  ]), "男");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用季节", "冬季", [
    { value: "冬季" },
    { value: "冬" },
  ]), "冬");
});

test("shoe platform subtitles preserve complete words at their field limits", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const spu = { spu_code: "208426140204", product_line_name: "鞋品" };
  const sourceRows = [{
    source_type: "copywriting",
    row_json: {
      "推荐理由": "轻盈缓震 舒适贴合 日常好穿，第二条推荐理由",
      "导购标题": "巴拉巴拉 儿童 户外运动鞋 防滑耐磨 舒适保暖 校园日常 通勤百搭",
      "官方发布类目": "童鞋/运动鞋",
    },
  }];
  const derive = (fieldName) => service.buildProductArchiveSourceDerivedFieldValue(fieldName, { spu, sourceRows });

  assert.equal(derive("唯品会副标题"), "轻盈缓震 舒适贴合");
  assert.equal(derive("导购短标题"), "巴拉巴拉 儿童 户外运动鞋 防滑耐磨 舒适保暖 校园日常");
  assert.ok(derive("导购短标题").length <= 30);
  assert.equal(derive("导购短标题").endsWith("校园日"), false);
});

test("product archive local requirement follows the DeepDraw template when present", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  for (const fieldName of ["商品描述", "商品短标题", "图案(多选)", "微信视频小店副标题", "快手商品卖点", "成分含量"]) {
    assert.equal(
      service.isProductArchiveFieldLocallyRequired(fieldName, { templatePresent: true, templateRequired: true, ruleBlocking: true }),
      true,
      `${fieldName} should follow the category template when present`,
    );
  }
  assert.equal(service.isProductArchiveFieldLocallyRequired("商品详情", { templateRequired: true }), true);
  assert.equal(service.isProductArchiveFieldLocallyRequired("安全等级", { templateRequired: true }), true);
  assert.equal(service.isProductArchiveFieldLocallyRequired("适用年龄", { templateRequired: true }), true);
  assert.equal(service.isProductArchiveFieldLocallyRequired("尺码表", { templatePresent: true, templateRequired: true, ruleBlocking: true }), true);
  assert.equal(service.isProductArchiveFieldLocallyRequired("多平台尺码", { templatePresent: true, templateRequired: true, ruleBlocking: true }), true);
  for (const fieldName of ["尺码表", "唯品会尺码表", "抖音尺码表", "多平台尺码"]) {
    assert.equal(
      service.isProductArchiveFieldLocallyRequired(fieldName, {
        templatePresent: true,
        templateRequired: false,
        ruleBlocking: false,
        apparelProduct: true,
      }),
      true,
      `${fieldName} must remain blocking for apparel even when the live template marks it optional`,
    );
    assert.deepEqual(service.productArchivePayloadFieldValue({
      field_name: fieldName,
      field_type: "MULTI_TEXT",
      required: true,
      blocking: true,
      value_text: "",
      value_json: { title: "身高,衣长", "130cm": "130,50.5" },
    }), { title: "身高,衣长", "130cm": "130,50.5" });
  }
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("是否有腰带", { templatePresent: false, templateRequired: false, ruleBlocking: true }),
    false,
  );
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("单色平台AI标", { templatePresent: true, templateRequired: false, ruleBlocking: true }),
    false,
  );
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("多色平台AI", { templatePresent: true, templateRequired: false, ruleBlocking: true }),
    false,
  );
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("是否有腰带", { templatePresent: true, templateRequired: true, ruleBlocking: false }),
    true,
  );
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("洗涤说明", { templatePresent: true, templateRequired: true, sourceType: "skip" }),
    true,
  );
  assert.equal(
    service.isProductArchiveFieldLocallyRequired("洗涤说明", { templatePresent: true, templateRequired: false, sourceType: "skip" }),
    false,
  );
});

test("product archive AI fill considers invalid enum fields and prioritizes strategy fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 101,
      field_name: "材质",
      source_type: "copywriting",
      value_text: "成分 面料：100%棉（配料除外）",
      value_json: {},
      validation_status: "invalid",
      validation_message: "字段值不在深绘模板选项中",
      options_json: [{ value: "聚酯纤维" }, { value: "棉" }],
    },
    {
      id: 102,
      field_name: "版型",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "宽松型" }],
    },
    {
      id: 103,
      field_name: "功能",
      source_type: "ai",
      value_text: "柔软舒适",
      value_json: {},
      validation_status: "valid",
      options_json: [{ value: "柔软舒适" }],
    },
    {
      id: 104,
      field_name: "跳过字段",
      source_type: "skip",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [{ value: "否" }],
    },
  ], [], []);

  assert.deepEqual(candidates.map((field) => ({
    id: field.id,
    fieldName: field.fieldName,
    currentValue: field.currentValue,
    validationStatus: field.validationStatus,
    strategy: field.strategy?.priority ?? null,
  })), [
    {
      id: 102,
      fieldName: "版型",
      currentValue: "",
      validationStatus: "missing",
      strategy: "P0",
    },
    {
      id: 101,
      fieldName: "材质",
      currentValue: "成分 面料：100%棉（配料除外）",
      validationStatus: "invalid",
      strategy: "P1",
    },
  ]);
});

test("product archive AI field strategies productize P0 P1 P2 field coverage", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const strategies = service.listProductArchiveAiFieldStrategies();

  assert.deepEqual(strategies.map((strategy) => strategy.priority), ["P0", "P1", "P1", "P2"]);
  assert.equal(service.productArchiveAiFieldStrategyForField("是否有腰带")?.priority, "P0");
  assert.equal(service.productArchiveAiFieldStrategyForField("淘宝天猫适用年龄")?.priority, "P1");
  assert.equal(service.productArchiveAiFieldStrategyForField("穿着方式")?.priority, "P0");
  assert.equal(service.productArchiveAiFieldStrategyForField("面料(多选)")?.priority, "P1");
  assert.equal(service.productArchiveAiFieldStrategyForField("里料成分")?.priority, "P1");
  assert.equal(service.productArchiveAiFieldStrategyForField("详情页AI标注")?.priority, "P2");
  assert.equal(service.productArchiveAiFieldStrategyForField("原产国(AKC)"), null);
  assert.equal(service.productArchiveAiFieldStrategyForField("尺码表"), null);
  assert.equal(service.productArchiveAiFieldStrategyForField("22Q4-童鞋尺码表")?.priority, "P0");
  assert.equal(service.productArchiveAiFieldStrategyForField("25鞋子模板类型")?.priority, "P0");
  assert.equal(service.productArchiveAiFieldStrategyForField("25鞋子尺码表")?.priority, "P0");
});

test("product archive AI field strategy route exposes the productized mapping policy", async () => {
  const route = await readText(files.draftRoute);

  assert.match(route, /listProductArchiveAiFieldStrategies/);
  assert.match(route, /productArchiveDrafts\.get\("\/ai-field-strategies"/);
  assert.match(route, /requirePermission\(c, "PRODUCT_ARCHIVE_DRAFT_READ"\)/);
  assert.match(route, /strategies: listProductArchiveAiFieldStrategies\(\)/);
});

test("product archive AI strategies allow selected skipped fields into conservative AI candidates", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 401,
      field_name: "图案(多选)",
      source_type: "skip",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "纯色" }, { value: "卡通动漫" }],
    },
    {
      id: 402,
      field_name: "面料(多选)",
      source_type: "skip",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "棉" }, { value: "聚酯纤维" }],
    },
    {
      id: 403,
      field_name: "详情页AI标注",
      source_type: "skip",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "有图文详情" }, { value: "无图文详情" }],
    },
    {
      id: 404,
      field_name: "原产国(AKC)",
      source_type: "skip",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "中国" }, { value: "越南" }],
    },
  ], [], []);

  assert.deepEqual(candidates.map((field) => ({
    fieldName: field.fieldName,
    strategy: field.strategy?.priority ?? null,
  })), [
    { fieldName: "图案(多选)", strategy: "P0" },
    { fieldName: "面料(多选)", strategy: "P1" },
    { fieldName: "详情页AI标注", strategy: "P2" },
  ]);
});

test("product archive AI candidates expose required visual blockers and exclude punctuated SKU-size fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 501,
      field_name: "内胆类型",
      source_type: "skip",
      value_text: "",
      value_json: {},
      required: true,
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "可拆卸内胆" }, { value: "固定内胆" }],
    },
    {
      id: 502,
      field_name: "是否有腰带",
      source_type: "skip",
      value_text: "",
      value_json: {},
      blocking: true,
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "是" }, { value: "否" }],
    },
    {
      id: 503,
      field_name: "尺码.",
      source_type: "manual",
      value_text: "",
      value_json: {},
      required: true,
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "80cm" }],
    },
  ]);

  assert.equal(candidates.length, 2);
  assert.equal(candidates.find((candidate) => candidate.fieldName === "内胆类型")?.strategy?.priority, "P0");
  assert.equal(candidates.find((candidate) => candidate.fieldName === "内胆类型")?.required, true);
  assert.equal(candidates.find((candidate) => candidate.fieldName === "是否有腰带")?.required, true);
  assert.equal(candidates.some((candidate) => candidate.fieldName === "尺码."), false);
});

test("product archive AI fill includes color fields when SKU colors need template matching", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 201,
      field_name: "颜色",
      source_type: "mdm",
      value_text: "粉红,梦幻粉60335",
      value_json: {},
      validation_status: "valid",
      validation_message: null,
      options_json: [{ value: "卡其" }, { value: "粉红" }],
    },
  ], [
    {
      issue_type: "sku_color_not_in_template",
      sku_code: "20832610520650230080",
    },
  ], [
    {
      sku_code: "20832610520650230080",
      color_name: "贝壳卡50230",
    },
    {
      sku_code: "20832610520660335080",
      color_name: "梦幻粉60335",
    },
  ]);

  assert.deepEqual(candidates.map((field) => ({
    id: field.id,
    fieldName: field.fieldName,
    currentValue: field.currentValue,
    validationStatus: field.validationStatus,
  })), [
    {
      id: 201,
      fieldName: "颜色",
      currentValue: "贝壳卡50230",
      validationStatus: "valid",
    },
  ]);
});

test("product archive AI fill skips structural multi-platform size fields", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 301,
      field_name: "多平台尺码",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "得物" }, { value: "京东" }],
    },
    {
      id: 303,
      field_name: "淘宝尺码表",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "身高" }, { value: "衣长" }],
    },
    {
      id: 302,
      field_name: "适用季节",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "春秋" }],
    },
    {
      id: 304,
      field_name: "尺码",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      validation_message: "必填字段缺失",
      options_json: [{ value: "48cm" }, { value: "66cm" }],
    },
  ], [], []);

  assert.deepEqual(candidates.map((field) => field.fieldName), ["适用季节"]);
  assert.equal(service.chooseProductArchiveAiFallbackOption, undefined);
});

test("product archive AI fill admits shoe enum fields without admitting structured size tables", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.isProductArchiveShoeAiEnumField("22Q4-童鞋尺码表"), true);
  assert.equal(service.isProductArchiveShoeAiEnumField("25鞋子模板类型"), true);
  assert.equal(service.isProductArchiveShoeAiEnumField("25鞋子尺码表"), true);
  assert.equal(service.isProductArchiveShoeAiEnumField("尺码表"), false);
  assert.equal(service.shouldProductArchiveAiFillShoeEnumField({
    fieldName: "22Q4-童鞋尺码表",
    tradePath: "童鞋/亲子鞋 / 运动鞋",
  }), true);
  assert.equal(service.shouldProductArchiveAiFillShoeEnumField({
    fieldName: "25鞋子模板类型",
    tradePath: "童鞋/亲子鞋 / 雪地靴",
  }), true);
  assert.equal(service.shouldProductArchiveAiFillShoeEnumField({
    fieldName: "25鞋子尺码表",
    tradePath: "童鞋/亲子鞋 / 雪地靴",
  }), false);
  assert.equal(service.shouldProductArchiveAiFillShoeEnumField({
    fieldName: "25鞋子尺码表",
    tradePath: "童鞋/亲子鞋 / 凉鞋",
  }), true);
  assert.equal(service.shouldProductArchiveAiFillShoeEnumField({
    fieldName: "22Q4-童鞋尺码表",
    tradePath: "童装婴幼儿服装 / 裤子",
  }), false);

  const candidates = service.buildProductArchiveAiFillCandidateFields([
    {
      id: 501,
      field_name: "22Q4-童鞋尺码表",
      source_type: "shoe_size_chart",
      value_text: "轻跑鞋",
      value_json: {},
      validation_status: "valid",
      options_json: [{ value: "轻跑鞋" }, { value: "篮球鞋" }],
    },
    {
      id: 502,
      field_name: "25鞋子模板类型",
      source_type: "shoe_size_chart",
      value_text: "运动",
      value_json: {},
      validation_status: "valid",
      options_json: [{ value: "运动" }, { value: "休闲" }],
    },
    {
      id: 503,
      field_name: "淘宝尺码表",
      source_type: "manual",
      value_text: "",
      value_json: {},
      validation_status: "missing",
      options_json: [{ value: "身高" }, { value: "衣长" }],
    },
  ], [], []);

  assert.deepEqual(candidates.map((field) => field.fieldName), [
    "22Q4-童鞋尺码表",
    "25鞋子模板类型",
  ]);
});

test("product archive AI fill normalizes color choices back to DeepDraw alias values", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.normalizeProductArchiveAiFillValue("颜色", "贝壳卡50230", "卡其", [
    { value: "卡其", label: "卡其" },
    { value: "粉红", label: "粉红" },
  ]), "卡其,贝壳卡50230");

  assert.equal(service.normalizeProductArchiveAiFillValue("颜色", "贝壳卡50230;梦幻粉60335", "卡其;粉红", [
    { value: "卡其", label: "卡其" },
    { value: "粉红", label: "粉红" },
  ]), "卡其,贝壳卡50230;粉红,梦幻粉60335");

  assert.equal(service.normalizeProductArchiveAiFillValue("颜色", "贝壳卡50230;梦幻粉60335", "卡其", [
    { value: "卡其", label: "卡其" },
    { value: "粉红", label: "粉红" },
  ]), "");
});

test("product archive color normalization selects a safe template fallback for unmapped SKU colors", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const value = service.normalizeProductArchiveDeepdrawFieldValue("颜色", "浅驼50002;胡桃棕51006", [
    { value: "黑色" },
    { value: "扩展选项" },
  ]);

  assert.equal(value, "扩展选项,浅驼50002;扩展选项,胡桃棕51006");
  assert.equal(service.productArchiveSkuColorMatchesOptions(
    { color_name: "浅驼50002", color_code: "50002" },
    ["黑色", "扩展选项"],
    [{ field_name: "颜色", value_text: value }],
  ), true);

  const fills = service.buildProductArchiveEvidenceRuleFills({
    draft: { spu_code: "201426108002" },
    fields: [{
      id: 1,
      field_name: "颜色",
      value_text: "浅驼50002;胡桃棕51006",
      value_json: {},
      validation_status: "invalid",
      options_json: [{ value: "黑色" }, { value: "扩展选项" }],
    }],
  });
  assert.deepEqual(fills.map((fill) => [fill.field_value, fill.source_type]), [
    ["扩展选项,浅驼50002;扩展选项,胡桃棕51006", "color_template_rule"],
  ]);
});

test("product archive color field rebuild prefers concrete MDM SKU colors over stale launch aliases", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  const merged = service.mergeProductArchiveColorFieldValues([
    "红咖色调00365",
    "红色,红咖色调00365;卡其,沙卡50403",
  ]);
  const value = service.normalizeProductArchiveDeepdrawFieldValue("颜色", merged, [
    { value: "红色" },
    { value: "卡其" },
  ]);

  assert.equal(value, "红色,红咖色调00365;卡其,沙卡50403");
  assert.equal(service.productArchiveSkuColorMatchesOptions(
    { color_name: "沙卡50403", color_code: "50403" },
    ["红色", "卡其"],
    [{ field_name: "颜色", value_text: value }],
  ), true);

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("颜色", "沙卡50403", [
    { value: "红色" },
    { value: "卡其" },
  ]), "卡其,沙卡50403");

  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("颜色", [
    "黑色调",
    "军绿",
    "粉红",
    "黑色,黑色调00399",
    "绿色,军绿40601",
    "粉红,粉红60001",
  ].join(";"), [
    { value: "黑色" },
    { value: "军绿" },
    { value: "绿色" },
    { value: "粉红" },
  ]), "黑色,黑色调00399;军绿,军绿40601;粉红,粉红60001");
});

test("product archive draft reference image upload extracts style codes from folder paths", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.extractProductArchiveImageSpuCode("208426103215/主图1.jpg"), "208426103215");
  assert.equal(service.extractProductArchiveImageSpuCode("SCM全链路冒烟_20260805/208426103215/front.png"), "208426103215");
  assert.equal(service.extractProductArchiveImageSpuCode("no-style-image.png"), "");
});

test("product archive SKU color validation accepts AI-filled DeepDraw color aliases", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.productArchiveSkuColorMatchesOptions(
    { color_name: "松石青70500", color_code: "70500" },
    ["青绿", "粉红"],
    [{ field_name: "颜色", value_text: "青绿,松石青70500" }],
  ), true);

  assert.equal(service.productArchiveSkuColorMatchesOptions(
    { color_name: "松石青70500", color_code: "70500" },
    ["青绿", "粉红"],
    [{ field_name: "颜色", value_text: "扩展选项,松石青70500" }],
  ), false);
});

test("product archive AI fill does not expose legacy semantic fallback option writer", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.chooseProductArchiveAiFallbackOption, undefined);
});

test("product archive service normalizes source values into DeepDraw enum options", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.deepEqual(service.buildProductArchiveMdmDerivedFieldValue("原产国(AKC)", {
    spu: {},
    skus: [],
  }), { valueText: "中国", valueJson: {} });
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("25柔软指数", "偏硬", [
    { value: "硬" },
    { value: "微硬" },
    { value: "适中" },
  ]), "微硬");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("原产国(AKC)", "中国", [
    { value: "黑山" },
    { value: "中国" },
  ]), "中国");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("原产国(AKC)", "China", [
    { value: "黑山" },
    { value: "中国大陆" },
  ]), "中国大陆");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("发货方式", "快递", [
    { value: "快递发货" },
    { value: "无需快递" },
  ]), "快递发货");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("上市时间", "2026-07-08T00:00:00.000Z", [
    { value: "2026年夏季" },
    { value: "2026年秋季" },
  ]), "2026年夏季");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("成分含量", "48.5%", [
    { value: "95%及以上" },
    { value: "70%（含）-95%" },
    { value: "50%(含)-70%" },
    { value: "30%（含）-50%" },
  ]), "30%（含）-50%");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("尺码", "100cm;120cm;140cm;160cm;170cm", [
    { value: "100" },
    { value: "120" },
    { value: "140" },
    { value: "160" },
    { value: "170" },
  ]), "100;120;140;160;170");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("尺码.", "100cm;120cm;140cm;160cm;170cm", [
    { value: "18cm以下" },
    { value: "18-20cm" },
    { value: "20-22cm" },
    { value: "22-24cm" },
    { value: "24-26cm" },
  ]), "18cm以下;18-20cm;20-22cm;22-24cm;24-26cm");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("抖音参考价格类型", "79.9", [
    { value: "厂商建议零售价" },
    { value: "吊牌价" },
  ]), "吊牌价");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("主图1", "两条装", [
    { value: "内裤2条装" },
    { value: "内裤2条装225" },
  ]), "内裤2条装225");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用性别", "中", [
    { value: "男女通用" },
    { value: "中性/男女均可" },
  ]), "中性/男女均可");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("性别(多选)", "中性", [
    { value: "男童" },
    { value: "女童" },
  ]), "男童;女童");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用性别(多选)", "男女", [
    { value: "男童" },
    { value: "女童" },
  ]), "男童;女童");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质", "面料：100%聚酯纤维", [
    { value: "聚酯纤维（涤纶）" },
    { value: "棉" },
  ]), "聚酯纤维（涤纶）");
  for (const material of ["聚酯纤维", "棉", "聚酰胺纤维", "粘胶纤维"]) {
    assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质", material, [
      { value: "羊毛" },
      { value: "其他" },
    ]), "其他", `${material} should use the legal fallback enum`);
  }
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("里料材质成分含量(多选)", "100%锦纶", [
    { value: "聚酰胺纤维" },
    { value: "聚酯纤维" },
  ]), "聚酰胺纤维");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("里料", "100%锦纶；(配料除外）", [
    { value: "锦纶/尼龙" },
    { value: "聚酯纤维（涤纶）" },
  ]), "锦纶/尼龙");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("衣门襟", "系扣", [
    { value: "魔术贴" },
    { value: "肩开扣" },
    { value: "纽扣" },
  ]), "纽扣");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("是否带帽", "连帽", [
    { value: "无帽" },
    { value: "有帽不可拆" },
    { value: "有帽可拆" },
  ]), "有帽可拆");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("面料(多选)", "面料：100%聚酯纤维", [
    { value: "聚酯纤维" },
    { value: "梭织布" },
  ]), "聚酯纤维");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质", "成分 面料：100%棉（配料除外）", [
    { value: "聚酯纤维" },
    { value: "棉" },
  ]), "棉");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质", "面料: 65.1%棉\n25.0%聚酯纤维\n9.2%粘纤\n0.7%氨纶（配料除外）", [
    { value: "棉混纺" },
    { value: "棉" },
    { value: "聚酯纤维" },
  ]), "棉混纺");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质成分", "面料: 65.1%棉\n25.0%聚酯纤维\n9.2%粘纤\n0.7%氨纶（配料除外）", [
    { value: "棉" },
    { value: "聚酯纤维" },
    { value: "粘胶纤维(粘纤)" },
    { value: "聚氨酯弹性纤维(氨纶)" },
  ]), "棉,65.1;聚酯纤维,25;粘胶纤维(粘纤),9.2;聚氨酯弹性纤维(氨纶),0.7");
  assert.equal(service.normalizeProductArchiveAiFillValue("材质成分", "", "面料: 65.1%棉\n25.0%聚酯纤维\n9.2%粘纤\n0.7%氨纶（配料除外）", [
    { value: "棉", label: "棉" },
    { value: "聚酯纤维", label: "聚酯纤维" },
    { value: "粘胶纤维(粘纤)", label: "粘胶纤维(粘纤)" },
    { value: "聚氨酯弹性纤维(氨纶)", label: "聚氨酯弹性纤维(氨纶)" },
  ]), "棉,65.1;聚酯纤维,25;粘胶纤维(粘纤),9.2;聚氨酯弹性纤维(氨纶),0.7");
  assert.equal(service.normalizeProductArchiveAiFillValue("面料(多选)", "", "面料: 65.1%棉\n25.0%聚酯纤维\n9.2%粘纤\n0.7%氨纶（配料除外）", [
    { value: "棉", label: "棉" },
    { value: "聚酯纤维", label: "聚酯纤维" },
    { value: "粘胶纤维(粘纤)", label: "粘胶纤维(粘纤)" },
    { value: "氨纶", label: "氨纶" },
  ]), "棉;聚酯纤维;粘胶纤维(粘纤);氨纶");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("材质成分(文本)", "100%棉（配料除外）", [
    { value: "聚酯纤维" },
    { value: "棉" },
  ]), "100%棉（配料除外）");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄", "幼童", [
    { value: "婴幼童(1~3岁，80~100cm)" },
    { value: "中小童(3~8岁，100~140cm)" },
  ]), "婴幼童(1~3岁，80~100cm)");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄多选", "2-7岁", [
    { value: "1-3岁" },
    { value: "2-7岁" },
  ]), "2-7岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄", "2-7岁", [
    { value: "新生儿(0~1岁，80cm及其以下)" },
    { value: "婴幼童(1~3岁，80~100cm)" },
    { value: "中小童(3~8岁，100~140cm)" },
  ]), "中小童(3~8岁，100~140cm)");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄", "7岁-14岁", [
    { value: "3-14岁" },
    { value: "7岁-14岁" },
    { value: "8岁（含）—14岁（不含）" },
  ]), "7岁-14岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄(多选)", "2-7岁", [
    { value: "1-3岁" },
    { value: "2岁" },
    { value: "3岁" },
    { value: "4岁" },
    { value: "5岁" },
    { value: "6岁" },
    { value: "7岁" },
    { value: "6-9岁" },
  ]), "2岁;3岁;4岁;5岁;6岁;7岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄(多选)", "7岁-14岁", [
    { value: "1-3岁" },
    { value: "7岁" },
    { value: "8岁" },
    { value: "9岁" },
    { value: "10岁" },
    { value: "11岁" },
    { value: "12岁" },
    { value: "13岁" },
    { value: "14岁" },
    { value: "14岁以上" },
  ]), "7岁;8岁;9岁;10岁;11岁;12岁;13岁;14岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄(多选)", "7岁;8岁;9岁;10岁;11岁;12岁;13岁;14岁", [
    { value: "1-3岁" },
    { value: "7岁" },
    { value: "8岁" },
    { value: "9岁" },
    { value: "10岁" },
    { value: "11岁" },
    { value: "12岁" },
    { value: "13岁" },
    { value: "14岁" },
    { value: "14岁以上" },
  ]), "7岁;8岁;9岁;10岁;11岁;12岁;13岁;14岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄(多选)", "7-16岁", [
    { value: "7岁" },
    { value: "8岁" },
    { value: "9岁" },
    { value: "10岁" },
    { value: "11岁" },
    { value: "12岁" },
    { value: "13岁" },
    { value: "14岁" },
    { value: "14岁以上" },
  ]), "7岁;8岁;9岁;10岁;11岁;12岁;13岁;14岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("适用年龄(多选)", "8-14岁", [
    { value: "8岁" },
    { value: "9岁" },
    { value: "10岁" },
    { value: "11岁" },
    { value: "12岁" },
    { value: "13岁" },
    { value: "14岁" },
    { value: "14岁以上" },
  ]), "8岁;9岁;10岁;11岁;12岁;13岁;14岁");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("颜色", "蓝色调00388;粉色调01315", [
    { value: "蓝色" },
    { value: "粉红" },
  ]), "蓝色,蓝色调00388;粉红,粉色调01315");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("颜色", "贝壳卡50230", [
    { value: "卡其" },
  ]), "卡其,贝壳卡50230");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("分类", "外套", [
    { value: "风衣" },
    { value: "普通外套" },
  ]), "普通外套");
  assert.equal(service.normalizeProductArchiveDeepdrawFieldValue("品牌(单选)", "巴拉巴拉", [
    { value: "balabala/巴拉巴拉" },
  ]), "balabala/巴拉巴拉");
});

test("product archive origin-country fields default to a fixed China source", async () => {
  const service = await readFile(files.draftService, "utf8");

  assert.match(service, /const originCountryField = isProductArchiveOriginCountryField\(fieldName\)/);
  assert.match(service, /const shoe1688OriginField = shoeProduct && compactFieldKey\(fieldName\) === "产地"/);
  assert.match(service, /stringValue\(rule\.source_type\) \|\| \(originCountryField \|\| shoe1688OriginField \? "fixed" : "manual"\)/);
  assert.match(service, /ruleSourceRef \|\| \(shoe1688OriginField \? shoe1688OriginValue\(\) : originCountryField \? "中国" : null\)/);
});

test("product archive payload date keeps the launch-plan source date for SDK product date", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");

  assert.equal(service.buildProductArchivePayloadDate([
    {
      source_type: "launch_plan",
      row_json: { "内容上市时间": "2026-07-08T00:00:00.000Z" },
    },
  ]), "2026-07-08");
  assert.equal(service.buildProductArchivePayloadDate([
    {
      source_type: "launch_plan",
      row_json: { "内容上市时间": "/", "搜索上市时间": "2026-08-28" },
    },
  ]), "2026-08-28");
  assert.equal(service.buildProductArchivePayloadDate([
    {
      source_type: "launch_plan",
      row_json: { "内容上市时间": "/", "搜索上市时间": "2026-08-28" },
    },
  ], [
    { field_name: "上市时间(文本)", value_text: "2026-08-26" },
  ]), "2026-08-26");
});

test("routes delegate to PG services and enforce the deepdraw archive permission boundary", async () => {
  const [draftRoute, metadataRoute] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.metadataRoute, "utf8"),
  ]);

  assert.match(draftRoute, /from "\.\.\/services\/product-archive-drafts"/);
  assert.match(metadataRoute, /from "\.\.\/services\/deepdraw-metadata"/);
  for (const permission of [
    "PRODUCT_ARCHIVE_DRAFT_READ",
    "PRODUCT_ARCHIVE_DRAFT_WRITE",
    "PRODUCT_ARCHIVE_DRAFT_SUBMIT",
    "DEEPDRAW_METADATA_MANAGE",
    "PRODUCT_ARCHIVE_RULE_MANAGE",
  ]) {
    assert.match(`${draftRoute}\n${metadataRoute}`, new RegExp(permission));
  }
  assert.match(draftRoute, /assertSafeProductArchiveCode/);
  assert.match(draftRoute, /deleteProductArchiveDraft/);
  assert.match(draftRoute, /deleteDraftImageFiles/);
  assert.match(draftRoute, /action: "draft\.deleted"/);
  assert.match(draftRoute, /productArchiveDrafts\.post\("\/source-imports"/);
  assert.match(draftRoute, /submitProductArchiveDraft/);
  assert.match(metadataRoute, /syncDeepdrawTrades/);
  assert.match(metadataRoute, /syncDeepdrawTradeFields/);
});

test("product archive submit route allows real DeepDraw creates through the SDK adapter", async () => {
  const [draftRoute, deepdrawClient] = await Promise.all([
    readFile(files.draftRoute, "utf8"),
    readFile(files.deepdrawClient, "utf8"),
  ]);

  assert.doesNotMatch(draftRoute, /HTTPException\(501/);
  assert.doesNotMatch(draftRoute, /真实创建需要 SDK Product entity\/body adapter/);
  assert.match(draftRoute, /submitProductArchiveDraft\(db, draftId, \{ dryRun, updateExisting \}\)/);
  assert.match(deepdrawClient, /deepdraw_sdk_adapter\.mjs/);
  assert.match(deepdrawClient, /createDeepdrawProductWithSdk/);
  assert.match(deepdrawClient, /updateDeepdrawFullProductWithSdk/);
  assert.doesNotMatch(deepdrawClient, /product create adapter is not configured/);
});

test("DeepDraw duplicate update resolves exactly one numeric product id for v1 full update", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const resolved = service.resolveDeepdrawDuplicateProductForUpdate({
    records: [{
      id: "db1abf79dbad4c5b854585712efe1448",
      productId: 6509967,
      code: "208426140203",
    }],
  }, "208426140203");

  assert.equal(resolved.updateProductId, "6509967");
  assert.equal(resolved.internalProductId, "db1abf79dbad4c5b854585712efe1448");
  assert.equal(resolved.displayProductId, "6509967");
  assert.throws(
    () => service.resolveDeepdrawDuplicateProductForUpdate({ records: [] }, "208426140203"),
    /无法唯一定位/,
  );
  const displayOnly = service.resolveDeepdrawDuplicateProductForUpdate({
    records: [{ productId: 6509967, code: "208426140203" }],
  }, "208426140203");
  assert.equal(displayOnly.updateProductId, "6509967");
  assert.equal(displayOnly.internalProductId, null);
  assert.throws(
    () => service.resolveDeepdrawDuplicateProductForUpdate({
      records: [{ id: "internal-only", code: "208426140203" }],
    }, "208426140203"),
    /缺少.*数值产品 ID/,
  );
});

test("DeepDraw create transport uncertainty keeps the submit claim and does not mark an ordinary failure", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const state = {
    id: 77,
    status: "submitting",
    submit_claim_token: "claim-77",
    transport_unknown: null,
  };
  const logs = [];
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      return {
        run(...args) {
          if (/insert into product_archive_submit_log/i.test(sql)) {
            logs.push(args);
            return { changes: 1 };
          }
          if (/update product_archive_draft/i.test(sql)) {
            const [message, _updatedAt, draftId, claimToken] = args;
            if (draftId === state.id && claimToken === state.submit_claim_token) {
              state.transport_unknown = message;
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      };
    },
  };

  service.recordProductArchiveSubmitTransportUnknown(db, {
    draftId: 77,
    claimToken: "claim-77",
    requestSummary: { spuCode: "208226102001" },
    message: "socket closed before response",
  });

  assert.equal(state.status, "submitting");
  assert.equal(state.submit_claim_token, "claim-77");
  assert.equal(state.transport_unknown, "socket closed before response");
  assert.equal(logs.length, 1);
});

test("DeepDraw submit resumes readback for a created draft that kept its claim", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const state = {
    id: 79,
    status: "created",
    submit_claim_token: "claim-79",
    duplicate_result_json: { submit_readback_unknown: "readback timeout" },
    title: "针织衫",
    spu_code: "208226102001",
    created_product_id: "product-79",
  };
  let readbackCalls = 0;
  let createCalls = 0;
  let claimCalls = 0;
  let submitLogs = 0;
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get(...args) {
          if (/set status = 'submitting'/i.test(normalized)) {
            claimCalls += 1;
            return undefined;
          }
          if (/select \* from product_archive_draft where id = \?/i.test(normalized)) {
            return { ...state };
          }
          if (/update product_archive_draft set status = \?, submit_claim_token = null/i.test(normalized)) {
            const [status, _updatedAt, draftId, claimToken] = args;
            assert.equal(draftId, state.id);
            assert.equal(claimToken, state.submit_claim_token);
            state.status = status;
            state.submit_claim_token = null;
            return { id: state.id };
          }
          throw new Error(`Unexpected SQL get: ${normalized}`);
        },
        run(...args) {
          if (/insert into product_archive_submit_log/i.test(normalized)) {
            submitLogs += 1;
            return { changes: 1 };
          }
          throw new Error(`Unexpected SQL run: ${normalized}`);
        },
      };
    },
  };

  const result = await service.submitProductArchiveDraft(db, state.id, {
    create: async () => {
      createCalls += 1;
      throw new Error("create must not be called while resuming readback");
    },
    readback: async () => {
      readbackCalls += 1;
      return {
        ok: true,
        status: 200,
        payload: {
          status: 200,
          response: {
            code: 10200,
            response: "success",
            body: {
              productId: "product-79",
              code: "208226102001",
              title: "针织衫",
            },
          },
        },
      };
    },
  });

  assert.equal(result.status, "readback_verified");
  assert.equal(state.status, "readback_verified");
  assert.equal(state.submit_claim_token, null);
  assert.equal(claimCalls, 1);
  assert.equal(createCalls, 0);
  assert.equal(readbackCalls, 1);
  assert.equal(submitLogs, 1);
});

test("DeepDraw business-level readback failure preserves the submit claim for reconciliation", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const state = {
    id: 80,
    status: "updated",
    submit_claim_token: "claim-80",
    duplicate_result_json: {},
    title: "儿童户外鞋",
    spu_code: "208426140203",
    created_product_id: "6509967",
    trade_id: "100",
    trade_path: "服饰/外套",
    readback_unknown: null,
  };
  let submitLogs = 0;
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get() {
          if (/select \* from product_archive_draft where id = \?/i.test(normalized)) return { ...state };
          throw new Error(`Unexpected SQL get: ${normalized}`);
        },
        run(...args) {
          if (/insert into product_archive_submit_log/i.test(normalized)) {
            submitLogs += 1;
            return { changes: 1 };
          }
          if (/submit_readback_unknown/i.test(normalized)) {
            const [message, _updatedAt, draftId, claimToken] = args;
            assert.equal(draftId, state.id);
            assert.equal(claimToken, state.submit_claim_token);
            state.readback_unknown = message;
            return { changes: 1 };
          }
          throw new Error(`Unexpected SQL run: ${normalized}`);
        },
      };
    },
  };

  await assert.rejects(
    () => service.readbackProductArchiveDraft(db, state.id, {
      readback: async () => ({
        status: 200,
        ok: false,
        requestId: "request-80",
        payload: {
          status: 200,
          response: {
            code: 10494,
            reason: "访问频率过高，请稍后重试",
            response: "fail",
          },
        },
      }),
    }),
    /访问频率过高/,
  );

  assert.equal(state.status, "updated");
  assert.equal(state.submit_claim_token, "claim-80");
  assert.match(state.readback_unknown, /访问频率过高/);
  assert.equal(submitLogs, 1);
});

test("DeepDraw submit restores the fenced pre-claim status when local preparation throws", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const state = {
    id: 78,
    status: "manual_review",
    submit_claim_token: null,
  };
  const cleanupWrites = [];
  let createCalls = 0;
  const db = {
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get(...args) {
          if (/set status = 'submitting'/i.test(normalized)) {
            const [claimToken, _updatedAt, draftId] = args;
            assert.equal(draftId, state.id);
            state.status = "submitting";
            state.submit_claim_token = claimToken;
            return {
              ...state,
              submit_claim_previous_status: "manual_review",
            };
          }
          throw new Error("local preparation failed before any remote call");
        },
        run(...args) {
          if (/set status = \?, submit_claim_token = null/i.test(normalized)) {
            cleanupWrites.push({ sql: normalized, args });
            const [status, _updatedAt, draftId, claimToken] = args;
            if (draftId === state.id && claimToken === state.submit_claim_token) {
              state.status = status;
              state.submit_claim_token = null;
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          throw new Error(`Unexpected SQL: ${normalized}`);
        },
      };
    },
  };

  await assert.rejects(
    () => service.submitProductArchiveDraft(db, state.id, {
      create: async () => {
        createCalls += 1;
        throw new Error("remote create must not run");
      },
    }),
    /local preparation failed before any remote call/,
  );

  assert.equal(state.status, "manual_review");
  assert.equal(state.submit_claim_token, null);
  assert.equal(createCalls, 0);
  assert.equal(cleanupWrites.length, 1);
});
