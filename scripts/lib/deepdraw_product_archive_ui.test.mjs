import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/024_deepdraw_product_archive_creation.sql"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  sidebar: path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx"),
  appLayout: path.join(PROJECT_ROOT, "web/src/components/layout/app-layout.tsx"),
  appHeader: path.join(PROJECT_ROOT, "web/src/components/layout/app-header.tsx"),
  asyncTaskCenter: path.join(PROJECT_ROOT, "web/src/components/async-task-center.tsx"),
  draftRoute: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  metadataRoute: path.join(PROJECT_ROOT, "web/server/routes/deepdraw-metadata.ts"),
  metadataService: path.join(PROJECT_ROOT, "web/server/services/deepdraw-metadata.ts"),
  draftListPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx"),
  draftDetailPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/[draftId]/page.tsx"),
  metadataPage: path.join(PROJECT_ROOT, "web/src/pages/deepdraw-metadata/page.tsx"),
  productArchiveDetailPage: path.join(PROJECT_ROOT, "web/src/pages/product-archives/[spuCode]/page.tsx"),
};

test("deepdraw product archive schema defines draft metadata rules validation and submit log tables", async () => {
  const migration = await readFile(files.migration, "utf8");

  for (const table of [
    "deepdraw_trade_cache",
    "deepdraw_trade_field_cache",
    "deepdraw_trade_field_sync_marker",
    "deepdraw_metadata_sync_job",
    "product_archive_source_batch",
    "product_archive_field_rule",
    "product_archive_draft",
    "product_archive_draft_field",
    "product_archive_draft_sku",
    "product_archive_validation_issue",
    "product_archive_submit_log",
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`));
  }

  assert.match(migration, /postgres-only/);
  assert.match(migration, /bigserial primary key/i);
  assert.match(migration, /jsonb/);
  assert.match(migration, /timestamptz/);
  assert.match(migration, /unique\(tenant_name, merchant_id, trade_id\)/);
  assert.match(migration, /unique\(tenant_name, merchant_id, trade_id, sync_type\)/);
  assert.match(migration, /check\(sync_status in \('success', 'zero_fields', 'failed'\)\)/);
  assert.match(migration, /check\(status in \('queued', 'running', 'completed', 'failed'\)\)/);
  assert.match(migration, /PRODUCT_ARCHIVE_DRAFT_SUBMIT/);
  assert.match(migration, /DEEPDRAW_METADATA_MANAGE/);
  assert.match(migration, /PRODUCT_ARCHIVE_RULE_MANAGE/);
  assert.doesNotMatch(migration, /appSecret|dopKey|secret_key|autoincrement|strftime/i);
});

test("backend registers product archive draft and deepdraw metadata APIs", async () => {
  const [server, draftRoute, draftService, metadataRoute, metadataService] = await Promise.all([
    readFile(files.server, "utf8"),
    readFile(files.draftRoute, "utf8"),
    readFile(files.draftService, "utf8"),
    readFile(files.metadataRoute, "utf8"),
    readFile(files.metadataService, "utf8"),
  ]);

  assert.match(server, /import productArchiveDrafts from "\.\/routes\/product-archive-drafts"/);
  assert.match(server, /import deepdrawMetadata from "\.\/routes\/deepdraw-metadata"/);
  assert.match(server, /app\.route\("\/api\/product-archive-drafts", productArchiveDrafts\)/);
  assert.match(server, /app\.route\("\/api\/deepdraw-metadata", deepdrawMetadata\)/);

  for (const routePattern of [
    /productArchiveDrafts\.get\("\/"/,
    /productArchiveDrafts\.post\("\/from-spu\/:spuCode"/,
    /productArchiveDrafts\.post\("\/batch"/,
    /productArchiveDrafts\.post\("\/mdm-batch"/,
    /productArchiveDrafts\.post\("\/source-imports"/,
    /productArchiveDrafts\.get\("\/:draftId"/,
    /productArchiveDrafts\.patch\("\/:draftId\/trade"/,
    /productArchiveDrafts\.patch\("\/:draftId\/fields"/,
    /productArchiveDrafts\.post\("\/:draftId\/validate"/,
    /productArchiveDrafts\.post\("\/:draftId\/check-duplicate"/,
    /productArchiveDrafts\.post\("\/:draftId\/ai-fill"/,
    /productArchiveDrafts\.post\("\/:draftId\/submit"/,
    /productArchiveDrafts\.post\("\/:draftId\/readback"/,
    /productArchiveDrafts\.get\("\/:draftId\/logs"/,
    /productArchiveDrafts\.get\("\/batch-jobs\/:jobId"/,
  ]) {
    assert.match(draftRoute, routePattern);
  }
  assert.match(draftRoute, /syncMdmProduct/);
  assert.match(draftRoute, /mdm_draft/);
  assert.match(draftRoute, /autoSyncMissingMdm/);
  assert.match(draftRoute, /missingMdmSpuCodes/);
  assert.match(draftRoute, /missingDraftSpuCodes/);
  assert.match(draftRoute, /sourceBatchId:\s*Number\(result\.batch\.id\)/);
  assert.match(draftRoute, /applyProductArchiveDraftTrade/);
  assert.match(draftService, /export function applyProductArchiveDraftTrade/);
  assert.match(draftService, /export async function fillProductArchiveDraftFieldsWithAi/);
  assert.match(draftService, /rebuildProductArchiveDraftFields/);
  assert.match(draftService, /deepdraw_trade_cache/);

  assert.match(metadataRoute, /deepdrawMetadata\.get\("\/trades"/);
  assert.match(metadataRoute, /deepdrawMetadata\.get\("\/trades\/:tradeId\/fields"/);
  assert.match(metadataRoute, /deepdrawMetadata\.post\("\/sync-jobs"/);
  assert.match(metadataRoute, /deepdrawMetadata\.get\("\/sync-jobs\/:jobId"/);
  assert.match(metadataRoute, /syncDeepdrawTrades/);
  assert.match(metadataRoute, /syncDeepdrawTradeFields/);
  assert.match(metadataRoute, /syncDeepdrawTenantMetadata/);
  assert.match(metadataRoute, /createMetadataSyncJob/);
  assert.match(metadataRoute, /getMetadataSyncJob/);
  assert.match(metadataRoute, /updateMetadataSyncJobProgress/);
  assert.doesNotMatch(metadataRoute, /new Map<string, DeepdrawMetadataSyncJob>/);
  assert.match(metadataService, /export async function syncDeepdrawTenantMetadata/);
  assert.match(metadataService, /deepdraw_trade_field_sync_marker/);
  assert.match(metadataService, /recordDeepdrawFieldSyncMarker/);
  assert.match(metadataService, /zeroFieldCount/);
  assert.match(metadataService, /topLevelCount/);
  assert.match(metadataService, /flattenedCount/);
  assert.match(metadataService, /fieldTradeCount/);
  assert.match(metadataService, /fieldConcurrency/);
  assert.match(metadataService, /fieldRetryCount/);
  assert.match(metadataService, /attemptFieldSync/);
  assert.match(metadataService, /assertDeepdrawMetadataSuccess/);
  assert.match(metadataService, /10200/);
  assert.match(metadataService, /runFieldWorker/);
});

test("product archive draft service compiles for the API server", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  assert.equal(typeof service.getProductArchiveDraftDetail, "function");
  assert.equal(typeof service.fillProductArchiveDraftFieldsWithAi, "function");
  assert.equal(typeof service.missingMdmSpuCodes, "function");
  assert.equal(typeof service.missingDraftSpuCodes, "function");
  assert.equal(typeof service.chooseDeepdrawTradeFromLaunchPlanRows, "function");
  const queries = [];
  const fakeDb = {
    prepare(sql) {
      queries.push(sql);
      return {
        all(batchId) {
          assert.equal(batchId, 42);
          return [{ spu_code: "SPU-MISSING" }, { spu_code: "" }];
        },
      };
    },
  };
  assert.deepEqual(service.missingMdmSpuCodes(fakeDb, 42), ["SPU-MISSING"]);
  assert.match(queries[0], /left join product_spu/);
});

test("launch plan category fields can auto-select a unique DeepDraw trade", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts");
  const match = service.chooseDeepdrawTradeFromLaunchPlanRows(
    [
      {
        source_type: "launch_plan",
        row_json: {
          "官方发布类目": "童装/婴儿装/亲子装>>儿童袜子",
          "发布类目 (唯品)": "儿童袜子",
          "主款式 （唯品四级品类）": "短筒袜",
          "发布类目 (抖音)": "服饰内衣>服饰配件>袜子>儿童袜子",
        },
      },
    ],
    [
      { trade_id: "100", trade_name: "儿童裤子", trade_path: "童装/婴儿装/亲子装>>儿童裤子" },
      { trade_id: "101", trade_name: "儿童袜子", trade_path: "童装/婴儿装/亲子装>>儿童袜子" },
    ],
  );

  assert.deepEqual(match, {
    tradeId: "101",
    tradePath: "童装/婴儿装/亲子装>>儿童袜子",
    confidence: "high",
    matchedField: "官方发布类目",
    matchedValue: "童装/婴儿装/亲子装>>儿童袜子",
  });
});

test("frontend routes and navigation expose deepdraw archive draft workbench", async () => {
  const [router, sidebar, appLayout, appHeader, asyncTaskCenter, draftListPage, draftDetailPage, metadataPage, productArchiveDetailPage] = await Promise.all([
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.appLayout, "utf8"),
    readFile(files.appHeader, "utf8"),
    readFile(files.asyncTaskCenter, "utf8"),
    readFile(files.draftListPage, "utf8"),
    readFile(files.draftDetailPage, "utf8"),
    readFile(files.metadataPage, "utf8"),
    readFile(files.productArchiveDetailPage, "utf8"),
  ]);

  assert.match(router, /ProductArchiveDraftsPage/);
  assert.match(router, /ProductArchiveDraftDetailPage/);
  assert.match(router, /DeepdrawMetadataPage/);
  assert.match(router, /path: "product-archive-drafts"/);
  assert.match(router, /path: "product-archive-drafts\/:draftId"/);
  assert.match(router, /path: "deepdraw-metadata"/);

  assert.match(sidebar, /深绘建档草稿/);
  assert.match(sidebar, /\/product-archive-drafts/);
  assert.match(sidebar, /深绘建档草稿", to: "\/product-archive-drafts", icon: PenLine, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);
  assert.match(sidebar, /深绘类目字段/);
  assert.match(sidebar, /\/deepdraw-metadata/);
  assert.match(sidebar, /深绘类目字段", to: "\/deepdraw-metadata", icon: Database, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);

  assert.match(appLayout, /AsyncTaskProvider/);
  assert.match(appHeader, /AsyncTaskTrigger/);
  assert.match(asyncTaskCenter, /异步任务/);
  assert.match(asyncTaskCenter, /SheetContent[^\\n]+side="right"/s);
  assert.match(asyncTaskCenter, /localStorage/);
  assert.match(asyncTaskCenter, /product-archive-drafts\/batch-jobs/);
  assert.match(asyncTaskCenter, /失败明细/);
  assert.match(asyncTaskCenter, /Progress/);

  assert.doesNotMatch(draftListPage, /ComingSoonPage/);
  assert.match(draftListPage, /CompactListPage/);
  assert.match(draftListPage, /api\.get<.*>\(`\/product-archive-drafts\?/s);
  assert.match(draftListPage, /ServerPagination/);
  assert.match(draftListPage, /limit=/);
  assert.match(draftListPage, /offset=/);
  assert.match(draftListPage, /api\.post<.*>\("\/product-archive-drafts\/mdm-batch"/s);
  assert.doesNotMatch(draftListPage, /api\.post<.*>\("\/product-archive-drafts\/batch"/s);
  assert.match(draftListPage, /api\.get<.*>\(`\/product-archive-drafts\/batch-jobs\/\$\{batchJobId\}`\)/s);
  assert.match(draftListPage, /同步 MDM 并生成草稿/);
  assert.match(draftListPage, /batchCodes/);
  assert.match(draftListPage, /Textarea/);
  assert.match(draftListPage, /selectedDraftIds/);
  assert.match(draftListPage, /toggleAllVisible/);
  assert.match(draftListPage, /aria-label="选择全部草稿"/);
  assert.match(draftListPage, /aria-label=\{`选择草稿 \$\{item\.spu_code\}`\}/);
  assert.match(draftListPage, /进入/);
  assert.match(draftListPage, /selectedDrafts\.length/);
  assert.match(draftListPage, /批量校验/);
  assert.match(draftListPage, /批量查重/);
  assert.match(draftListPage, /批量提交预览/);
  assert.match(draftListPage, /批量发布到深绘/);
  assert.match(draftListPage, /submit_publish/);
  assert.match(draftListPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/submit`, \{ dryRun: false \}\)/s);
  assert.match(draftListPage, /ImportDialog/);
  assert.doesNotMatch(draftListPage, /导入字段对应关系/);
  assert.match(draftListPage, /先同步 MDM 款号，再导入上市计划表和标准文案表/);
  assert.match(draftListPage, /autoSyncMissingMdm:\s*sourceType === "launch_plan"/);
  assert.match(draftListPage, /syncJobs:\s*DraftBatchJob\[\]/);
  assert.match(draftListPage, /syncJobs\.push\(result\.syncJob\)/);
  assert.match(draftListPage, /for \(const syncJob of result\.syncJobs\)/);
  assert.match(draftListPage, /useAsyncTasks/);
  assert.match(draftListPage, /addTask/);
  assert.match(draftListPage, /openTaskCenter/);
  assert.match(draftListPage, /mdmSyncDialogOpen/);
  assert.match(draftListPage, /MDM 同步进度/);
  assert.match(draftListPage, /Progress/);
  assert.match(draftListPage, /失败原因/);
  assert.match(draftListPage, /最小化到任务中心/);
  assert.match(draftListPage, /自动同步/);
  assert.match(draftListPage, /导入上市计划表/);
  assert.match(draftListPage, /导入标准文案表/);

  assert.match(draftDetailPage, /TabsTrigger/);
  for (const label of ["概览", "字段填充", "SKU/颜色尺码", "校验问题", "提交记录", "来源快照"]) {
    assert.match(draftDetailPage, new RegExp(label));
  }
  assert.match(draftDetailPage, /api\.patch<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/fields`/s);
  assert.match(draftDetailPage, /api\.patch<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/trade`/s);
  assert.match(draftDetailPage, /api\.get<.*>\(`\/deepdraw-metadata\/trades\?/s);
  assert.match(draftDetailPage, /fieldOptions/);
  assert.match(draftDetailPage, /SelectTrigger/);
  assert.match(draftDetailPage, /SelectItem/);
  assert.match(draftDetailPage, /选择深绘类目/);
  assert.match(draftDetailPage, /应用类目并生成字段/);
  assert.match(draftDetailPage, /待确认类目/);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/validate`/s);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/ai-fill`/s);
  assert.match(draftDetailPage, /AI 推荐补齐空字段/);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/submit`/s);
  assert.match(draftDetailPage, /确认发布到深绘/);
  assert.match(draftDetailPage, /publishSubmit/);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/submit`, \{ dryRun: false \}\)/s);

  assert.match(metadataPage, /深绘类目字段/);
  assert.match(metadataPage, /api\.get<.*>\(`\/deepdraw-metadata\/trades\?/s);
  assert.match(metadataPage, /api\.get<.*>\(`\/deepdraw-metadata\/trades\/\$\{selectedTradeId\}\/fields\?/s);
  assert.match(metadataPage, /api\.post<.*>\("\/deepdraw-metadata\/sync-jobs"/s);
  assert.match(metadataPage, /fieldRetryCount: 2/);
  assert.match(metadataPage, /api\.get<.*>\(`\/deepdraw-metadata\/sync-jobs\/\$\{syncJobId\}`\)/s);
  assert.match(metadataPage, /zeroFieldCount/);
  assert.match(metadataPage, /0 字段/);
  assert.match(metadataPage, /overflow-auto/);
  assert.match(metadataPage, /selectedOptionField/);
  assert.match(metadataPage, /选项明细/);
  assert.match(metadataPage, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(metadataPage, /optionDisplayName/);
  assert.match(metadataPage, /查看选项/);
  assert.match(metadataPage, /刷新类目/);
  assert.match(metadataPage, /批量拉取类目字段/);
  assert.match(metadataPage, /电商巴拉巴拉/);
  assert.match(metadataPage, /字段模板/);

  assert.match(productArchiveDetailPage, /生成建档草稿/);
  assert.match(productArchiveDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/from-spu\/\$\{spuCode\}`/s);
  assert.match(productArchiveDetailPage, /navigate\(`\/product-archive-drafts\/\$\{result\.draft\.id\}`\)/);
});
