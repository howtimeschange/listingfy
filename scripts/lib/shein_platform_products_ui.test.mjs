import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-platform-products/page.tsx");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");
const SIDEBAR_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx");
const HEADER_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-header.tsx");
const PLAN_FILE = path.join(PROJECT_ROOT, "docs/shein-product-lifecycle-api-plan-2026-05-11.md");

async function fileText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

test("SHEIN platform products P0 page is planned, routed, and visible in navigation", async () => {
  const [plan, page, router, sidebar, header] = await Promise.all([
    fileText(PLAN_FILE),
    fileText(PAGE_FILE),
    fileText(ROUTER_FILE),
    fileText(SIDEBAR_FILE),
    fileText(HEADER_FILE),
  ]);

  assert.match(plan, /当前项目进度/);
  assert.match(plan, /平台商品列表/);
  assert.match(plan, /站点币种/);
  assert.match(plan, /SPU 商品详情/);
  assert.match(plan, /更新成本价\/供货价/);
  assert.match(plan, /常用字段编辑/);
  assert.match(plan, /拼款/);

  assert.match(router, /SheinPlatformProductsPage/);
  assert.match(router, /path: "shein-platform-products"/);
  assert.match(sidebar, /平台商品列表/);
  assert.match(sidebar, /\/shein-platform-products/);
  assert.match(sidebar, /站点币种/);
  assert.match(sidebar, /\/shein-platform-products\/sites/);
  assert.doesNotMatch(sidebar, /SPU 商品详情/);
  assert.match(header, /"shein-platform-products": "平台商品列表"/);

  assert.match(page, /平台商品列表/);
  assert.match(page, /平台已上架商品/);
});

test("SHEIN platform products separates list, sites, and detail routes without exposing detail as a menu", async () => {
  const [page, router, sidebar] = await Promise.all([
    fileText(PAGE_FILE),
    fileText(ROUTER_FILE),
    fileText(SIDEBAR_FILE),
  ]);

  assert.match(router, /path: "shein-platform-products\/sites"/);
  assert.match(router, /path: "shein-platform-products\/:spuName"/);
  assert.match(page, /type PlatformProductView = "list" \| "sites" \| "detail"/);
  assert.match(page, /view === "sites"/);
  assert.match(page, /view === "detail"/);
  assert.match(page, /navigate\(`\/shein-platform-products\/\$\{encodeURIComponent\(row\.spuName\)\}`\)/);
  assert.doesNotMatch(page, /navigate\("\/shein-platform-products\/sites"\)/);

  assert.match(sidebar, /平台商品列表/);
  assert.match(sidebar, /站点币种/);
  assert.doesNotMatch(sidebar, /SPU 商品详情/);
});

test("SHEIN platform products page wires durable P0 lifecycle operations", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /\/shein-platform-products\?/);
  assert.match(page, /\/shein-platform-products\/sync/);
  assert.match(page, /\/shein-platform-products\/sites/);
  assert.match(page, /\/shein-platform-products\/sites\/sync/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/detail/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/sync-detail/);
  assert.match(page, /\/check-edit-permission/);
  assert.match(page, /\/partial-edit/);
  assert.match(page, /\/edit-template/);
  assert.match(page, /\/field-edit/);
  assert.match(page, /\/variant-template/);
  assert.match(page, /\/add-variants/);
  assert.match(page, /\/shein-operations\/platform-identities\/supplier-sku\/check/);
  assert.match(page, /\/update-cost/);
  assert.match(page, /\/shein-operations\/price-reasons/);
  assert.match(page, /\/shein-operations\/p0-regression\/logs/);
  assert.match(page, /\/sync-status/);
  assert.match(page, /\/status\/sync/);
  assert.match(page, /\/operations\/\$\{.*operation.*id.*\}\/retry/);

  assert.match(page, /useStoreSites/);
  assert.match(page, /usePlatformProducts/);
  assert.match(page, /placeholderData:\s*keepPreviousData/);
  assert.match(page, /productsQuery\.isError/);
  assert.match(page, /平台商品列表读取失败/);
  assert.match(page, /productsQuery\.refetch/);
  assert.match(page, /useProductDetail/);
  assert.match(page, /useEditTemplate/);
  assert.match(page, /useVariantTemplate/);
  assert.match(page, /updateCostMutation/);
  assert.match(page, /useCostChangeReasons/);
  assert.match(page, /changeReasonCode/);
  assert.match(page, /regressionLogMutation/);
  assert.doesNotMatch(page, /openRegressionDialog/);
  assert.doesNotMatch(page, /<ClipboardCheck className="size-4" \/>\s*真实数据回归/);
  assert.match(page, /fieldEditMutation/);
  assert.match(page, /addVariantTemplateMutation/);
  assert.match(page, /sourceType: "ADD_VARIANTS"/);
  assert.match(page, /syncStatusMutation/);
  assert.match(page, /retryOperationMutation/);
  assert.match(page, /spuName/);
  assert.match(page, /skcName/);
  assert.match(page, /skuCode/);
  assert.match(page, /cost/);
  assert.match(page, /currency/);

  assert.match(page, /ServerPagination/);
  assert.match(page, /isLoading=\{productsQuery\.isFetching && !productsQuery\.isLoading\}/);
  assert.match(page, /JsonViewer/);
  assert.match(page, /更新成本价/);
  assert.match(page, /站点币种/);
  assert.match(page, /SPU 详情/);
  assert.match(page, /常用字段编辑/);
  assert.match(page, /商品标题/);
  assert.match(page, /商品描述/);
  assert.match(page, /品牌/);
  assert.match(page, /供应商货号/);
  assert.match(page, /包装重量/);
  assert.match(page, />长</);
  assert.match(page, />宽</);
  assert.match(page, />高</);
  assert.match(page, /拼款模板/);
  assert.match(page, /新增 SKC/);
  assert.match(page, /新增 SKU/);
  assert.match(page, /销售属性/);
  assert.match(page, /同步状态/);
  assert.match(page, /批量同步状态/);
  assert.match(page, /重试失败操作/);
  assert.match(page, /失败原因/);
  assert.match(page, /最近操作/);
  assert.match(page, /setOperationsDialogOpen/);
  assert.match(page, /查看最近操作/);

  assert.doesNotMatch(page, /\/shein-lifecycle/);
  assert.doesNotMatch(page, /ComingSoonPage/);
});

test("SHEIN platform products page opens a dedicated sync dialog for time range and SPU sync", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /syncDialogOpen/);
  assert.match(page, /setSyncDialogOpen\(true\)/);
  assert.match(page, /<DialogTitle>同步商品<\/DialogTitle>/);
  assert.match(page, /useState<SyncDialogMode>\("spu"\)/);
  assert.match(page, /按时间范围同步/);
  assert.match(page, /<TabsTrigger[\s\S]+value="spu"[\s\S]+按款号同步[\s\S]+<TabsTrigger[\s\S]+value="time"[\s\S]+按时间范围同步/);
  assert.match(page, /data-\[state=active\]:shadow-sm/);
  assert.match(page, /syncTimeField/);
  assert.match(page, /按更新时间/);
  assert.match(page, /按创建时间/);
  assert.match(page, /同步开始时间/);
  assert.match(page, /同步结束时间/);
  assert.match(page, /按款号同步/);
  assert.match(page, /spuNameSyncText/);
  assert.match(page, /MAX_SPU_NAME_SYNC_COUNT\s*=\s*20_000/);
  assert.match(page, /splitSpuNames\(spuNameSyncText,\s*MAX_SPU_NAME_SYNC_COUNT\)/);
  assert.match(page, /syncSpuProductsMutation/);
  assert.match(page, /productSyncDetailUrl\(spuName\)/);
  assert.match(page, /syncDetails/);
  assert.match(page, /maxPages/);
  assert.match(page, /detailLimit/);
  assert.match(page, /rangeMode: "custom"/);
  assert.match(page, /syncRangeOptions/);
  assert.match(page, /variant=\{syncFilters\.rangeMode === option\.value \? "default" : "outline"\}/);
  assert.doesNotMatch(page, /同步更新时间开始/);
  assert.doesNotMatch(page, /同步创建时间开始/);
  assert.doesNotMatch(page, /syncProductsMutation\.mutate\("incremental"\)/);
  assert.doesNotMatch(page, /syncProductsMutation\.mutate\("full"\)/);
  assert.doesNotMatch(page, /pageSize:\s*queryParams\.pagination\.limit/);
});

test("SHEIN platform products page exposes configurable scheduled sync", async () => {
  const [page, route] = await Promise.all([
    fileText(PAGE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/server/routes/shein-platform-products.ts")),
  ]);

  assert.match(route, /get\("\/sync-schedule"/);
  assert.match(route, /put\("\/sync-schedule"/);
  assert.match(route, /getPlatformProductSyncScheduleConfig/);
  assert.match(route, /savePlatformProductSyncScheduleConfig/);

  assert.match(page, /import \{ Switch \} from "@\/components\/ui\/switch"/);
  assert.match(page, /type SyncScheduleScope = "full" \| "spu"/);
  assert.match(page, /interface SyncScheduleConfig/);
  assert.match(page, /syncScheduleDialogOpen/);
  assert.match(page, /syncScheduleQuery/);
  assert.match(page, /\/shein-platform-products\/sync-schedule/);
  assert.match(page, /syncScheduleMutation/);
  assert.match(page, /setSyncScheduleDialogOpen\(true\)/);
  assert.match(page, /<DialogTitle>定时同步<\/DialogTitle>/);
  assert.match(page, /<Switch/);
  assert.match(page, /默认 23 点/);
  assert.match(page, /全量商品同步/);
  assert.match(page, /自定义 SPU 款号同步/);
  assert.match(page, /schedule_hour/);
  assert.match(page, /sync_scope/);
  assert.match(page, /spu_names/);
  assert.match(page, /alreadyRunningScheduledSync/);
  assert.match(page, /已有进行中的定时任务/);
  assert.match(page, /当前任务会继续执行/);
});

test("SHEIN platform products page supports brand/category filters and price import", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /商品图片/);
  assert.match(page, /供货价/);
  assert.match(page, /品牌名称/);
  assert.match(page, /类目名称/);
  assert.match(page, /brandOptions/);
  assert.match(page, /categoryOptions/);
  assert.match(page, /brandFilter/);
  assert.match(page, /categoryFilter/);
  assert.match(page, /brandName/);
  assert.match(page, /categoryName/);
  assert.doesNotMatch(page, /row\.brandName \|\| row\.brandCode/);
  assert.doesNotMatch(page, /row\.categoryName \|\| row\.categoryId/);
  assert.match(page, /批量更新供货价/);
  assert.match(page, /表格导入更新供货价/);
  assert.match(page, /costImportDialogOpen/);
  assert.match(page, /parseCostImportRows/);
  assert.match(page, /SPU/);
  assert.match(page, /SKC/);
  assert.match(page, /SKU/);
  assert.match(page, /供货价/);
  assert.match(page, /币种/);
  assert.match(page, /openBatchCostDialog/);
  assert.match(page, /costForm\.items/);
  assert.match(page, /selectedItems\s*=\s*costForm\.items\.filter/);
  assert.match(page, /sku_info_list:\s*items\.map/);
  assert.match(page, /productDetailUrl\(row\.spuName\)/);
  assert.match(page, /DialogContent className="flex max-h-\[90dvh\] w-\[min\(96vw,96rem\)\] flex-col overflow-hidden p-0 sm:max-w-none"/);
  assert.match(page, /DialogContent className="max-h-\[90dvh\] overflow-hidden sm:max-w-5xl lg:max-w-6xl"/);
  assert.match(page, /Table className="w-full table-fixed"/);
  assert.doesNotMatch(page, /min-w-\[820px\]/);
});

test("SHEIN platform products page exposes sale sites, filters, and export", async () => {
  const [page, exportSource] = await Promise.all([
    fileText(PAGE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/src/lib/shein-platform-product-export.ts")),
  ]);

  assert.match(page, /interface SaleSiteDetail/);
  assert.match(page, /saleSites: SaleSiteDetail\[\]/);
  assert.match(page, /saleSiteSummary/);
  assert.match(page, /saleSiteCount/);
  assert.match(page, /siteOptions/);
  assert.match(page, /siteFilter/);
  assert.match(page, /search\.set\("site", params\.siteFilter\.trim\(\)\)/);
  assert.match(page, /site\.count > 0/);
  assert.match(page, /全部销售站点/);
  assert.match(page, /销售站点/);
  assert.match(page, /setSaleSitesDialogProduct/);
  assert.match(page, /saleSitesDialogProduct/);
  assert.match(page, /exportPlatformProducts/);
  assert.match(page, /includeDetails:\s*true/);
  assert.match(page, /SHEIN平台商品列表/);
  assert.match(page, /销售站点明细/);
  assert.match(exportSource, /saleSiteDetailRows/);
  assert.match(exportSource, /上架状态/);
  assert.match(exportSource, /首次上架时间/);
  assert.match(exportSource, /最近上架时间/);
  assert.match(page, /上架站点数/);
  assert.match(page, /exportSpreadsheet/);
  assert.doesNotMatch(page, /销售站点明细:\s*row\.saleSites\.map/);
});

test("SHEIN platform products route and page use async jobs for product sync and export", async () => {
  const [page, route, taskContext, taskCenter, header] = await Promise.all([
    fileText(PAGE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/server/routes/shein-platform-products.ts")),
    fileText(path.join(PROJECT_ROOT, "web/src/lib/async-task-context.ts")),
    fileText(path.join(PROJECT_ROOT, "web/src/components/async-task-center.tsx")),
    fileText(path.join(PROJECT_ROOT, "web/src/components/layout/app-header.tsx")),
  ]);

  assert.match(route, /post\("\/sync-jobs"/);
  assert.match(route, /get\("\/sync-jobs\/:jobId"/);
  assert.match(route, /post\("\/export-jobs"/);
  assert.match(route, /get\("\/export-jobs\/:jobId"/);
  assert.match(route, /get\("\/export-jobs\/:jobId\/download"/);
  assert.match(route, /c\.json\(job, 202\)/);

  assert.match(page, /useAsyncTasks/);
  assert.match(page, /\/shein-platform-products\/sync-jobs/);
  assert.match(page, /\/shein-platform-products\/export-jobs/);
  assert.match(page, /type: "shein_platform_product_sync"/);
  assert.match(page, /type: "shein_platform_product_export"/);
  assert.match(page, /openTaskCenter/);
  assert.doesNotMatch(page, /fetchAllPlatformProductsForExport/);
  assert.doesNotMatch(page, /exportPlatformProductsWorkbook/);

  assert.match(taskContext, /"shein_platform_product_sync"/);
  assert.match(taskContext, /"shein_platform_product_export"/);
  assert.match(taskContext, /downloadUrl\?: string/);
  assert.match(taskContext, /unreadCompletedCount:\s*number/);
  assert.match(taskCenter, /downloadUrl/);
  assert.match(taskCenter, /下载文件/);
  assert.match(taskCenter, /TASK_RETENTION_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(taskCenter, /TASK_PAGE_SIZE\s*=\s*5/);
  assert.match(taskCenter, /unreadCompletedCount > 0/);
  assert.match(taskCenter, /bg-\[#d84f4f\]/);
  assert.match(taskCenter, /currentPageTasks/);
  assert.match(taskCenter, /setPageIndex/);
  assert.match(taskCenter, /上一页/);
  assert.match(taskCenter, /下一页/);
  assert.match(taskCenter, /window\.setInterval\(\(\) => \{/);

  assert.match(header, /<Breadcrumb[\s\S]+<\/Breadcrumb>[\s\S]+<div className="flex items-center gap-2">[\s\S]+<AsyncTaskTrigger \/>/);
});

test("SHEIN platform products detail page splits product and site views while widening dialogs", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /type DetailSection = "product" \| "sites"/);
  assert.match(page, /detailSectionTabs/);
  assert.match(page, /detailSection/);
  assert.match(page, /detailSaleSiteRows/);
  assert.match(page, /detailSaleSiteSummary/);
  assert.match(page, /displayName: site\.siteName \|\| site\.siteAbbr \|\| "—"/);
  assert.match(page, /siteCode: site\.siteAbbr \|\| "—"/);
  assert.match(page, /Tabs value=\{detailSection\}/);
  assert.match(page, /TabsContent value="product"/);
  assert.match(page, /TabsContent value="sites"/);
  assert.match(page, /sm:max-w-5xl lg:max-w-6xl/);
  assert.match(page, /sm:max-w-6xl/);
  assert.match(page, /detailSaleSiteSummary/);
  assert.doesNotMatch(page, /销售站点明细:\s*row\.saleSites\.map/);
});
