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
  gitignore: path.join(PROJECT_ROOT, ".gitignore"),
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

  assert.match(server, /import productArchiveDrafts(?:, \{[^}]+\})? from "\.\/routes\/product-archive-drafts"/);
  assert.match(server, /import deepdrawMetadata(?:, \{[^}]+\})? from "\.\/routes\/deepdraw-metadata"/);
  assert.match(server, /app\.route\("\/api\/product-archive-drafts", productArchiveDrafts\)/);
  assert.match(server, /app\.route\("\/api\/deepdraw-metadata", deepdrawMetadata\)/);

  for (const routePattern of [
    /productArchiveDrafts\.get\("\/"/,
    /productArchiveDrafts\.post\("\/from-spu\/:spuCode"/,
    /productArchiveDrafts\.post\("\/batch"/,
    /productArchiveDrafts\.post\("\/mdm-batch"/,
    /productArchiveDrafts\.post\("\/workflow\/start"/,
    /productArchiveDrafts\.post\("\/hangtag-washlabel-ocr\/preview"/,
    /productArchiveDrafts\.post\("\/hangtag-washlabel-ocr\/apply"/,
    /productArchiveDrafts\.post\("\/hangtag-washlabel-ocr\/jobs"/,
    /productArchiveDrafts\.get\("\/hangtag-washlabel-ocr\/jobs\/:jobId"/,
    /productArchiveDrafts\.post\("\/ai-fill-jobs"/,
    /productArchiveDrafts\.get\("\/ai-fill-jobs\/:jobId"/,
    /productArchiveDrafts\.post\("\/precheck-jobs"/,
    /productArchiveDrafts\.get\("\/precheck-jobs\/:jobId"/,
    /productArchiveDrafts\.post\("\/publish-jobs"/,
    /productArchiveDrafts\.get\("\/publish-jobs\/:jobId"/,
    /productArchiveDrafts\.post\("\/images\/import"/,
    /productArchiveDrafts\.get\("\/images\/:imageId\/file"/,
    /productArchiveDrafts\.get\("\/templates\/:templateType"/,
    /productArchiveDrafts\.post\("\/source-imports"/,
    /productArchiveDrafts\.get\("\/:draftId"/,
    /productArchiveDrafts\.post\("\/:draftId\/images"/,
    /productArchiveDrafts\.delete\("\/:draftId\/images\/:imageId"/,
    /productArchiveDrafts\.patch\("\/:draftId\/trade"/,
    /productArchiveDrafts\.patch\("\/:draftId\/trade\/confirm"/,
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
  assert.match(draftRoute, /recognizeProductArchiveOcrFiles/);
  assert.match(draftRoute, /readScmHangtagWashlabelSupplementWorkbook/);
  assert.match(draftRoute, /previewProductArchiveHangtagWashlabelOcr/);
  assert.match(draftRoute, /applyProductArchiveHangtagWashlabelOcr/);
  assert.match(draftRoute, /createHangtagWashlabelOcrQueue/);
  assert.match(draftRoute, /queueName: "product_archive_hangtag_washlabel_ocr"/);
  assert.match(draftRoute, /createProductArchiveAiFillQueue/);
  assert.match(draftRoute, /queueName: "product_archive_ai_fill"/);
  assert.match(draftRoute, /draft\.ai_fill\.background_queued/);
  assert.match(draftRoute, /draft\.ai_fill\.background_applied/);
  assert.match(draftRoute, /productArchiveAiFillTargetsByIds/);
  assert.match(draftRoute, /createProductArchivePrecheckQueue/);
  assert.match(draftRoute, /queueName: "product_archive_publish_precheck"/);
  assert.match(draftRoute, /draft\.publish_precheck\.background_queued/);
  assert.match(draftRoute, /draft\.publish_precheck\.background_completed/);
  assert.match(draftRoute, /productArchivePrecheckTargetsByIds/);
  assert.match(draftRoute, /precheckErrorIsRetryable/);
  assert.match(draftRoute, /LISTINGIFY_PRODUCT_ARCHIVE_PRECHECK_RETRY_DELAY_MS/);
  assert.match(draftRoute, /createProductArchivePublishQueue/);
  assert.match(draftRoute, /queueName: "product_archive_publish"/);
  assert.match(draftRoute, /draft\.publish\.background_queued/);
  assert.match(draftRoute, /draft\.publish\.background_completed/);
  assert.match(draftRoute, /isRetryableProductArchiveSyncError/);
  assert.match(draftRoute, /submit_transport_unknown/);
  assert.match(draftRoute, /background_queued/);
  assert.match(draftRoute, /background_applied/);
  assert.match(draftRoute, /readDraftImageUploadFiles/);
  assert.match(draftRoute, /extractProductArchiveImageSpuCode/);
  assert.match(draftRoute, /DRAFT_IMAGE_DIR/);
  assert.match(draftRoute, /assertLocalImageFile/);
  assert.match(draftRoute, /readValidatedUploadBuffer\(file,\s*"product_archive_ocr"\)/);
  assert.match(draftRoute, /detectProductArchiveOcrUploadType\(buffer\)/);
  assert.match(draftRoute, /writeValidatedUploadFile\(file,\s*"spreadsheet"/);
  assert.match(draftRoute, /filePaths/);
  assert.match(draftRoute, /copywriting/);
  assert.match(draftRoute, /launch-plan/);
  assert.doesNotMatch(draftRoute, /const mdmCodes = parseSpuCodes\(form\.get\("mdmCodes"\)/);
  assert.match(draftRoute, /sourceBatchId:\s*result\.sourceType === "launch_plan" \? sourceBatchId : null/);
  assert.match(draftRoute, /sourceBatchIds:\s*\{ \[result\.sourceType\]: \[sourceBatchId\] \}/);
  assert.match(draftRoute, /applyProductArchiveDraftTrade/);
  assert.match(draftRoute, /confirmProductArchiveDraftRecommendedTrade/);
  assert.match(draftRoute, /new HTTPException\(409, \{ message \}\)/);
  assert.match(
    draftRoute,
    /message === "草稿数据已更新，请刷新后重试"[\s\S]{0,120}new HTTPException\(409, \{ message \}\)/,
  );
  assert.match(draftService, /export function applyProductArchiveDraftTrade/);
  assert.match(draftService, /export function confirmProductArchiveDraftRecommendedTrade/);
  assert.match(draftService, /tradeSelectionDecision: currentTradeSelectionDecision\(db, draft\)/);
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

test("draft detail trade picker shows launch-plan category reference above search", async () => {
  const [draftService, draftDetailPage] = await Promise.all([
    readFile(files.draftService, "utf8"),
    readFile(files.draftDetailPage, "utf8"),
  ]);

  assert.match(draftService, /buildLaunchPlanCategoryReference/);
  assert.match(draftService, /launchPlanReference:\s*buildLaunchPlanCategoryReference/);
  assert.match(draftDetailPage, /launchPlanReference/);
  assert.match(draftDetailPage, /上市计划表类目参考/);
  assert.match(draftDetailPage, /未匹配上市计划表/);
  assert.match(draftDetailPage, /launchPlanReference\.fields\.map/);
  assert.match(draftDetailPage, /\{field\.label\}/);
  assert.match(draftDetailPage, /\{field\.value\}/);
});

test("draft detail renders backend trade selection conclusion and human confirmation action", async () => {
  const draftDetailPage = await readFile(files.draftDetailPage, "utf8");

  for (const status of [
    "auto_applied",
    "pending_confirmation",
    "manual_selection_required",
    "human_confirmed",
    "human_adjusted",
  ]) {
    assert.match(draftDetailPage, new RegExp(status));
  }
  assert.match(draftDetailPage, /tradeSelectionDecision/);
  assert.match(draftDetailPage, /深绘类目选择结论/);
  assert.match(draftDetailPage, /已自动应用推荐类目/);
  assert.match(draftDetailPage, /已自动应用，待人工确认/);
  assert.match(draftDetailPage, /需要人工选择/);
  assert.match(draftDetailPage, /人工已确认/);
  assert.match(draftDetailPage, /人工已调整/);
  assert.match(draftDetailPage, /高置信度/);
  assert.match(draftDetailPage, /中置信度/);
  assert.match(draftDetailPage, /确认推荐类目/);
  assert.match(draftDetailPage, /应用并确认推荐类目/);
  assert.match(draftDetailPage, /recommendationNeedsApply/);
  assert.match(draftDetailPage, /重新选择/);
  assert.match(
    draftDetailPage,
    /api\.patch<DraftDetail>\(`\/product-archive-drafts\/\$\{draftId\}\/trade\/confirm`,[\s\S]*recommendedTradeId/,
  );
  assert.match(draftDetailPage, /tradeSelectionDecision\.reason/);
  assert.match(draftDetailPage, /tradeSelectionDecision\.recommendedTrade/);
  assert.match(draftDetailPage, /tradeSelectionDecision\.appliedTrade/);
});

test("draft detail distinguishes backend load failures from missing drafts", async () => {
  const draftDetailPage = await readFile(files.draftDetailPage, "utf8");

  assert.match(draftDetailPage, /import \{ api, ApiError \} from "@\/lib\/api-client"/);
  assert.match(draftDetailPage, /function draftDetailFallbackDescription/);
  assert.match(draftDetailPage, /detail\.error instanceof ApiError && detail\.error\.status === 404/);
  assert.match(draftDetailPage, /草稿详情加载失败/);
  assert.match(draftDetailPage, /description=\{draftDetailFallbackDescription\(detail\)\}/);
  assert.doesNotMatch(
    draftDetailPage,
    /description=\{detail\.isLoading \? "正在加载草稿详情" : "草稿不存在"\}/,
  );
});

test("draft detail field fill tab highlights validation issues and can jump between problem fields", async () => {
  const draftDetailPage = await readFile(files.draftDetailPage, "utf8");

  assert.doesNotMatch(draftDetailPage, /StatCard/);
  assert.match(draftDetailPage, /data-draft-summary-table="true"/);
  assert.match(draftDetailPage, /草稿摘要/);
  for (const label of ["状态", "阻断问题", "警告", "深绘 productId", "草稿编号", "商户 ID", "吊牌价", "字段数", "最近校验", "更新时间", "深绘类目", "款号"]) {
    assert.match(draftDetailPage, new RegExp(label));
  }
  assert.match(draftDetailPage, /const \[activeTab, setActiveTab\] = useState\("fields"\)/);
  assert.match(draftDetailPage, /Tabs value=\{activeTab\} onValueChange=\{setActiveTab\}/);
  assert.doesNotMatch(draftDetailPage, /Tabs defaultValue="overview"/);
  assert.doesNotMatch(draftDetailPage, /TabsTrigger value="overview"/);
  assert.doesNotMatch(draftDetailPage, /TabsContent value="overview"/);

  const fieldFillHeaderMatch = draftDetailPage.match(/<CardTitle>字段填充<\/CardTitle>[\s\S]*?<\/CardHeader>/);
  assert.ok(fieldFillHeaderMatch, "expected field fill card header to exist");
  const fieldFillHeader = fieldFillHeaderMatch[0];
  assert.doesNotMatch(fieldFillHeader, /选择深绘类目/);
  assert.doesNotMatch(fieldFillHeader, /AI 推荐补齐空字段/);
  assert.doesNotMatch(fieldFillHeader, /保存字段/);
  assert.doesNotMatch(fieldFillHeader, /<Button/);

  assert.match(draftDetailPage, /fieldIssueMap/);
  assert.match(draftDetailPage, /fieldRowRefs/);
  assert.match(draftDetailPage, /pageScrollRef/);
  assert.match(draftDetailPage, /isProductArchiveSizeChartField/);
  assert.match(draftDetailPage, /setActiveTab\("size-chart"\)/);
  assert.match(draftDetailPage, /配置尺码表/);
  assert.match(draftDetailPage, /isChoiceFieldType/);
  assert.match(draftDetailPage, /isMultiChoiceFieldType/);
  assert.match(draftDetailPage, /isLongTextFieldType/);
  assert.match(draftDetailPage, /deepdrawFieldType/);
  assert.match(draftDetailPage, /MultiChoiceFieldEditor/);
  assert.match(draftDetailPage, /CommandInput/);
  assert.match(draftDetailPage, /添加选项/);
  assert.match(draftDetailPage, /当前已选/);
  assert.match(draftDetailPage, /不在模板/);
  assert.match(draftDetailPage, /border-\[#5bdca8\] bg-\[#dff8ed\]/);
  assert.match(draftDetailPage, /removeMultiFieldValue/);
  assert.doesNotMatch(draftDetailPage, /toggleMultiFieldValue/);
  assert.match(draftDetailPage, /<Textarea/);
  assert.match(draftDetailPage, /validationLocatorRef/);
  assert.match(draftDetailPage, /activeIssueIndex/);
  assert.match(draftDetailPage, /scrollToFieldIssue/);
  assert.match(draftDetailPage, /scrollContainer\.scrollTo/);
  assert.match(draftDetailPage, /rowOffset = locatorHeight \+ 12/);
  assert.match(draftDetailPage, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.doesNotMatch(draftDetailPage, /block: "center"/);
  assert.match(draftDetailPage, /字段校验定位/);
  assert.match(draftDetailPage, /问题字段/);
  assert.match(draftDetailPage, /aria-label=\{`问题字段 \$\{formatNumber\(fieldIssueNames\.length\)\}`\}/);
  assert.match(draftDetailPage, /\{formatNumber\(fieldIssueNames\.length\)\}/);
  assert.match(draftDetailPage, /bg-\[#d45656\]/);
  assert.match(draftDetailPage, /data-validation-locator-bar/);
  assert.match(
    draftDetailPage,
    /<TabsContent value="fields" className="min-w-0">\s*<Card className="min-w-0 overflow-visible">/,
  );
  const validationLocatorIndex = draftDetailPage.indexOf('data-validation-locator-bar="true"');
  assert.notEqual(validationLocatorIndex, -1, "expected validation locator bar markup");
  const validationLocatorMarkup = draftDetailPage.slice(validationLocatorIndex, validationLocatorIndex + 320);
  assert.match(validationLocatorMarkup, /className="sticky top-\[-1\.5rem\] z-30/);
  assert.match(validationLocatorMarkup, /md:top-\[-2rem\]/);
  assert.match(draftDetailPage, /hasValidationIssues/);
  assert.match(draftDetailPage, /所有字段校验通过/);
  assert.doesNotMatch(draftDetailPage, /当前字段填充没有未解决字段问题/);
  assert.match(draftDetailPage, /hasValidationIssues \? \([\s\S]*阻断[\s\S]*警告[\s\S]*问题字段[\s\S]*\) : \([\s\S]*所有字段校验通过/);
  assert.match(draftDetailPage, /data-validation-locator-bar[\s\S]*保存字段[\s\S]*重新校验/);
  assert.match(draftDetailPage, /changedFields\.length > 0[\s\S]*saveFields\.mutateAsync\(\)[\s\S]*api\.post<unknown>\(`\/product-archive-drafts\/\$\{draftId\}\/validate`/);
  assert.match(draftDetailPage, /disabled=\{!canWrite \|\| validate\.isPending \|\| saveFields\.isPending\}/);
  assert.match(draftDetailPage, /重新校验/);
  assert.match(draftDetailPage, /AI 推荐补齐空字段/);
  assert.match(draftDetailPage, /查找上一个/);
  assert.match(draftDetailPage, /查找下一个/);
  assert.match(draftDetailPage, /data-active-field-issue/);
  assert.match(draftDetailPage, /data-field-issue/);
  assert.match(draftDetailPage, /data-field-issue-reason/);
  assert.match(draftDetailPage, /colSpan=\{6\}/);
  assert.match(draftDetailPage, /overflow-x-auto whitespace-nowrap/);
  assert.match(draftDetailPage, /ring-\[#18e299\]\/80/);
  assert.match(draftDetailPage, /问题原因/);
});

test("frontend routes and navigation expose deepdraw archive draft workbench", async () => {
  const [router, sidebar, appLayout, appHeader, asyncTaskCenter, draftRoute, draftListPage, draftDetailPage, metadataPage, productArchiveDetailPage] = await Promise.all([
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.appLayout, "utf8"),
    readFile(files.appHeader, "utf8"),
    readFile(files.asyncTaskCenter, "utf8"),
    readFile(files.draftRoute, "utf8"),
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
  assert.match(asyncTaskCenter, /hangtagWashlabelOcrTaskSummary/);
  assert.match(asyncTaskCenter, /aiFillTaskSummary/);
  assert.match(asyncTaskCenter, /product_archive_ai_fill/);
  assert.match(asyncTaskCenter, /precheckTaskSummary/);
  assert.match(asyncTaskCenter, /product_archive_publish_precheck/);
  assert.match(asyncTaskCenter, /precheckTaskItems/);
  assert.match(asyncTaskCenter, /precheckItemReason/);
  assert.match(asyncTaskCenter, /预检明细/);
  assert.match(asyncTaskCenter, /等待重试/);
  assert.match(asyncTaskCenter, /publishTaskSummary/);
  assert.match(asyncTaskCenter, /product_archive_publish/);
  assert.match(asyncTaskCenter, /自动重试/);
  assert.match(asyncTaskCenter, /publishTaskItems/);
  assert.match(asyncTaskCenter, /publishItemReason/);
  assert.match(asyncTaskCenter, /发布明细/);
  assert.match(asyncTaskCenter, /已自动/);
  assert.match(asyncTaskCenter, /填充空字段/);
  assert.match(asyncTaskCenter, /importedImageCount/);

  assert.doesNotMatch(draftListPage, /ComingSoonPage/);
  assert.match(draftListPage, /CompactListPage/);
  assert.match(draftListPage, /ProductArchiveDraftGuideDialog/);
  assert.match(draftListPage, /PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY/);
  assert.match(draftListPage, /hasSeenProductArchiveDraftGuide/);
  assert.match(draftListPage, /markProductArchiveDraftGuideSeen/);
  assert.match(draftListPage, /window\.localStorage\.getItem\(PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY\)/);
  assert.match(draftListPage, /window\.localStorage\.setItem\(PRODUCT_ARCHIVE_DRAFT_GUIDE_STORAGE_KEY, "seen"\)/);
  assert.match(draftListPage, /setGuideDialogOpen\(true\)/);
  assert.match(draftListPage, /使用指南/);
  assert.match(draftListPage, /refreshDraftList/);
  assert.match(draftListPage, /drafts\.refetch\(\)/);
  assert.match(draftListPage, /刷新列表/);
  assert.match(draftListPage, /ConfirmDialog/);
  assert.match(draftListPage, /删除深绘建档草稿/);
  assert.match(draftListPage, /不会删除深绘后台已经存在或已生成的商品/);
  assert.match(draftListPage, /api\.delete<\{ ok: boolean \}>\(`\/product-archive-drafts\/\$\{draftId\}`\)/);
  assert.match(draftListPage, /disabled=\{!canWrite \|\| item\.status === "submitting" \|\| deleteDraft\.isPending\}/);
  assert.match(draftListPage, /深绘建档草稿使用指南/);
  assert.match(draftListPage, /推荐路径：标准文案表建草稿/);
  assert.match(draftListPage, /尺码表、吊牌\/洗唛\/平铺图可以通过抓虾自动化抓取/);
  assert.match(draftListPage, /https:\/\/crawshrimp\.com\/download/);
  assert.match(draftListPage, /补充识别资料/);
  assert.match(draftListPage, /批量发布预检和发布/);
  assert.match(draftListPage, /api\.get<.*>\(`\/product-archive-drafts\?/s);
  assert.match(draftListPage, /ServerPagination/);
  assert.match(draftListPage, /limit=/);
  assert.match(draftListPage, /offset=/);
  assert.match(draftListPage, /api\.post<.*>\("\/product-archive-drafts\/mdm-batch"/s);
  assert.doesNotMatch(draftListPage, /api\.post<.*>\("\/product-archive-drafts\/batch"/s);
  assert.match(draftListPage, /导入吊牌\/洗唛\/平铺图/);
  assert.match(draftListPage, /hangtag-washlabel-ocr\/preview/);
  assert.match(draftListPage, /hangtag-washlabel-ocr\/apply/);
  assert.match(draftListPage, /hangtag-washlabel-ocr\/jobs/);
  assert.match(draftListPage, /选择图包目录/);
  assert.doesNotMatch(draftListPage, /选择抓虾图包目录/);
  assert.doesNotMatch(draftListPage, /选择 PDF 吊牌 \+ JPG\/PNG 洗唛文件/);
  assert.doesNotMatch(draftListPage, /SCM洗唛吊牌下载结果/);
  assert.match(draftListPage, /webkitdirectory/);
  assert.match(draftListPage, /form\.append\("filePaths", uploadDisplayName\(file\)\)/);
  assert.match(draftListPage, /form\.append\("referenceImages", file\)/);
  assert.match(draftListPage, /form\.append\("assetPackage", "true"\)/);
  assert.match(draftListPage, /function uploadBaseName\(file: File\)/);
  assert.match(draftListPage, /const name = uploadBaseName\(file\)/);
  assert.match(draftListPage, /crawshrimp_asset_package/);
  assert.match(draftRoute, /const shouldImportReferenceImage = field === "referenceImages" \|\| packageKind === "reference_image"/);
  assert.match(draftListPage, /form\.append\("scmSupplementFile"/);
  assert.match(draftListPage, /overwriteExisting/);
  assert.match(draftListPage, /product_archive_hangtag_washlabel_ocr/);
  assert.match(draftListPage, /product_archive_ai_fill/);
  assert.match(draftListPage, /\/product-archive-drafts\/ai-fill-jobs/);
  assert.match(draftListPage, /批量 AI 填充字段/);
  assert.match(draftListPage, /batchAiFillFields/);
  assert.match(draftListPage, /refreshedAiFillJobIds/);
  assert.match(draftListPage, /product_archive_publish_precheck/);
  assert.match(draftListPage, /\/product-archive-drafts\/precheck-jobs/);
  assert.match(draftListPage, /batchPublishPrecheck/);
  assert.match(draftListPage, /refreshedPrecheckJobIds/);
  assert.match(draftListPage, /批量发布预检/);
  assert.match(draftListPage, /product_archive_publish/);
  assert.match(draftListPage, /\/product-archive-drafts\/publish-jobs/);
  assert.match(draftListPage, /batchPublishToDeepdraw/);
  assert.match(draftListPage, /refreshedPublishJobIds/);
  assert.match(draftListPage, /提交后台发布任务/);
  assert.match(draftListPage, /提交后台识别/);
  assert.match(draftListPage, /table-fixed/);
  assert.match(draftListPage, /line-clamp-2/);
  assert.match(draftListPage, /OcrExtractedFieldLine/);
  assert.match(draftListPage, /后台识别任务/);
  assert.match(draftListPage, /hangtagWashlabelOcrJobSummary/);
  assert.match(draftListPage, /已自动/);
  assert.match(draftListPage, /填充空字段/);
  assert.doesNotMatch(draftListPage, /SpuImageImportDialog/);
  assert.doesNotMatch(draftListPage, /导入 SPU 图片/);
  assert.match(draftListPage, /\/product-archive-drafts\/images\/import/);
  assert.match(draftListPage, /isSpuReferenceImageUploadFile/);
  assert.match(draftListPage, /参考图/);
  assert.match(draftListPage, /item\.image_count/);
  assert.match(draftListPage, /thumbnail_image_url/);
  assert.match(draftListPage, /thumbnail_file_name/);
  assert.match(draftListPage, /function DraftThumbnail/);
  assert.match(draftListPage, /loading="eager"/);
  assert.match(draftListPage, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(draftListPage, /asset_package_image_count/);
  assert.match(draftListPage, /hangtag_upload_count/);
  assert.match(draftListPage, /washlabel_upload_count/);
  assert.match(draftListPage, /图包资料/);
  assert.match(draftListPage, /吊牌\{item\.hangtag_upload_count > 0 \? "已传" : "未传"\}/);
  assert.match(draftListPage, /洗唛\{item\.washlabel_upload_count > 0 \? "已传" : "未传"\}/);
  assert.match(draftListPage, /平铺图\{item\.asset_package_image_count > 0 \? "已传" : "未传"\}/);
  assert.match(draftListPage, /确认写入草稿/);
  assert.match(draftListPage, /api\.get<.*>\(`\/product-archive-drafts\/batch-jobs\/\$\{batchJobId\}`\)/s);
  assert.match(draftListPage, /开始商品建档/);
  assert.match(draftListPage, /MDM 同步建档/);
  assert.match(draftListPage, /导入标准文案表/);
  assert.match(draftListPage, /多行款号搜索/);
  assert.match(draftListPage, /multiLineSearchOpen/);
  assert.match(draftListPage, /multiLineSpuCodes/);
  assert.match(draftListPage, /api\.post<.*>\("\/product-archive-drafts\/mdm-batch"/s);
  assert.match(draftListPage, /api\.postForm<.*>\("\/product-archive-drafts\/source-imports\/upload"/s);
  assert.match(draftListPage, /sourceType", "copywriting"/);
  assert.doesNotMatch(draftListPage, /workflowMdmCodes/);
  assert.match(draftListPage, /下载标准文案模板/);
  assert.match(draftListPage, /下载上市计划模板/);
  assert.match(draftListPage, /\/api\/product-archive-drafts\/templates\/copywriting/);
  assert.match(draftListPage, /\/api\/product-archive-drafts\/templates\/launch-plan/);
  assert.match(draftListPage, /Textarea/);
  assert.match(draftListPage, /selectedDraftIds/);
  assert.match(draftListPage, /toggleAllVisible/);
  assert.match(draftListPage, /aria-label="选择全部草稿"/);
  assert.match(draftListPage, /aria-label=\{`选择草稿 \$\{item\.spu_code\}`\}/);
  assert.match(draftListPage, /进入/);
  assert.match(draftListPage, /selectedDrafts\.length/);
  assert.match(draftListPage, /批量发布预检/);
  assert.doesNotMatch(draftListPage, /批量校验/);
  assert.doesNotMatch(draftListPage, /批量查重/);
  assert.doesNotMatch(draftListPage, /批量提交预览/);
  assert.match(draftListPage, /批量 AI 填充字段/);
  assert.match(draftListPage, /批量发布到深绘/);
  assert.match(draftListPage, /api\.post<AsyncTaskJob>\("\/product-archive-drafts\/publish-jobs"/);
  assert.doesNotMatch(draftListPage, /submit_publish/);
  assert.doesNotMatch(draftListPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/submit`, \{ dryRun: false \}\)/s);
  assert.match(draftListPage, /StartProductArchiveDialog/);
  assert.doesNotMatch(draftListPage, /导入字段对应关系/);
  assert.match(draftListPage, /按标准文案表和上市计划表里的款号生成草稿/);
  assert.match(draftListPage, /开始商品建档/);
  assert.doesNotMatch(draftListPage, /1\.\s*同步 MDM/);
  assert.match(draftListPage, /1\.\s*导入标准文案表/);
  assert.match(draftListPage, /2\.\s*匹配\/导入上市计划/);
  assert.match(draftListPage, /3\.\s*导入尺码表模板/);
  assert.match(draftListPage, /api\.postForm<.*>\("\/product-archive-drafts\/workflow\/start"/s);
  assert.doesNotMatch(draftListPage, /form\.append\("mdmCodes"/);
  assert.match(draftListPage, /copywritingFile/);
  assert.match(draftListPage, /launchPlanFile/);
  assert.match(draftListPage, /sizeChartFile/);
  assert.match(draftListPage, /sourceType.*size_chart/s);
  assert.match(draftListPage, /导入尺码表/);
  assert.match(draftListPage, /result\.syncJob/);
  assert.match(draftListPage, /useAsyncTasks/);
  assert.match(draftListPage, /addTask/);
  assert.match(draftListPage, /openTaskCenter/);
  assert.match(draftListPage, /workflowProgressDialogOpen/);
  assert.match(draftListPage, /MDM 同步进度/);
  assert.match(draftListPage, /Progress/);
  assert.match(draftListPage, /失败原因/);
  assert.match(draftListPage, /最小化到任务中心/);
  assert.match(draftListPage, /自动同步/);
  assert.doesNotMatch(draftListPage, /title="导入上市计划表"/);
  assert.doesNotMatch(draftListPage, /trigger=\{<Button type="button" variant="outline" size="sm" disabled=\{importSource\.isPending\}>导入上市计划表<\/Button>\}/);

  assert.match(draftDetailPage, /TabsTrigger/);
  assert.doesNotMatch(draftDetailPage, /概览/);
  for (const label of ["字段填充", "SKU/颜色尺码", "校验问题", "提交记录", "来源快照"]) {
    assert.match(draftDetailPage, new RegExp(label));
  }
  assert.match(draftDetailPage, /api\.patch<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/fields`/s);
  assert.match(draftDetailPage, /api\.patch<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/trade`/s);
  assert.match(draftDetailPage, /api\.get<.*>\(`\/deepdraw-metadata\/trades\?/s);
  assert.match(draftDetailPage, /fieldOptions/);
  assert.match(draftDetailPage, /fieldOptions\(field\)\.length > 0\) return true/);
  assert.match(draftDetailPage, /MULTI_CHOICE_FIELD_TYPES/);
  assert.match(draftDetailPage, /type === "MULTI_TEXT"/);
  assert.doesNotMatch(draftDetailPage, /当前值/);
  assert.match(draftDetailPage, /SelectTrigger/);
  assert.match(draftDetailPage, /SelectItem/);
  assert.match(draftDetailPage, /选择深绘类目/);
  assert.match(draftDetailPage, /应用类目并生成字段/);
  assert.match(draftDetailPage, /待确认类目/);
  assert.match(draftDetailPage, /DraftReferenceImagesSection/);
  assert.match(draftDetailPage, /DraftEvidenceAssetsSection/);
  assert.match(draftDetailPage, /DraftAssetPreviewDialog/);
  assert.match(draftDetailPage, /function DraftAssetThumbnail/);
  assert.match(draftDetailPage, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(draftDetailPage, /SPU 参考图/);
  assert.match(draftDetailPage, /吊牌\/洗唛图/);
  assert.match(draftDetailPage, /isDraftPdfAsset/);
  assert.match(draftDetailPage, /iframe/);
  assert.match(draftDetailPage, /Maximize2/);
  assert.match(draftDetailPage, /上传 SPU 图/);
  assert.match(draftDetailPage, /grid-cols-\[repeat\(auto-fill,minmax\(132px,156px\)\)\]/);
  assert.match(draftDetailPage, /api\.postForm<[\s\S]*?>\(\s*`\/product-archive-drafts\/\$\{draftId\}\/images`/);
  assert.match(draftDetailPage, /api\.delete<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/images\/\$\{imageId\}`/s);
  assert.match(draftDetailPage, /prefix=\{\(/);
  assert.match(draftDetailPage, /返回草稿列表/);
  assert.match(draftDetailPage, /compact/);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/validate`/s);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/ai-fill`/s);
  assert.match(draftDetailPage, /尺码表配置/);
  assert.match(draftDetailPage, /AI 推荐尺码映射/);
  assert.match(draftDetailPage, /mapping\.confidence/);
  assert.match(draftDetailPage, /sizeChartPreview/);
  assert.match(draftDetailPage, /sizeChartCellValues/);
  assert.match(draftDetailPage, /保存尺码表数值/);
  assert.match(draftDetailPage, /mappingForSizeChartColumn/);
  assert.match(draftDetailPage, /字段映射审核弹窗/);
  assert.match(draftDetailPage, /查看全部映射/);
  assert.match(draftDetailPage, /PLM 导入字段对照/);
  assert.match(draftDetailPage, /sizeChartSourceMatrix/);
  assert.match(draftDetailPage, /const \[sizeChartSourceOpen, setSizeChartSourceOpen\] = useState\(false\)/);
  assert.match(draftDetailPage, /const \[sizeChartSourcePinned, setSizeChartSourcePinned\] = useState\(false\)/);
  assert.match(draftDetailPage, /固定在顶部/);
  assert.match(draftDetailPage, /setSizeChartSourceOpen\(true\)/);
  assert.match(draftDetailPage, /sticky top-\[-1\.5rem\] z-20 md:top-\[-2rem\]/);
  assert.match(draftDetailPage, /CollapsibleTrigger/);
  assert.match(draftDetailPage, /TabsContent value="size-chart" className="min-w-0"/);
  assert.match(draftDetailPage, /<TabsContent value="size-chart" className="min-w-0">[\s\S]*?<Card className="min-w-0 overflow-visible">/);
  assert.match(draftDetailPage, /CardContent className="grid min-w-0 gap-5 overflow-visible"/);
  assert.match(draftDetailPage, /Table className="w-max min-w-full"/);
  assert.match(draftDetailPage, /min-w-0 overflow-hidden rounded-md border/);
  assert.ok(
    draftDetailPage.indexOf("PLM 导入字段对照") < draftDetailPage.indexOf("sizeChartPreview.length > 0 ?"),
    "expected PLM import field comparison to render before generated DeepDraw size charts",
  );
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/size-chart\/ai-recommend`/s);
  assert.match(draftDetailPage, /api\.post<.*>\(`\/product-archive-drafts\/\$\{draftId\}\/size-chart\/mappings`/s);
  assert.match(draftDetailPage, /const applySizeChartMappings = useMutation/);
  assert.match(draftDetailPage, /applyToDraft:\s*true/);
  assert.match(draftDetailPage, /applySizeChartMappings\.mutate[\s\S]*应用到草稿/);
  assert.match(draftDetailPage, /queryClient\.setQueryData\(\["product-archive-drafts", draftId\], result\.detail\)/);
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

test("product archive workflow templates are repository assets", async () => {
  const gitignore = await readFile(files.gitignore, "utf8");

  assert.doesNotMatch(gitignore, /data\/product-archive-templates\//);
});
