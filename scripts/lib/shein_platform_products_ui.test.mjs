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
  assert.match(page, /DialogContent className="max-h-\[90dvh\] max-w-5xl overflow-y-auto"/);
  assert.match(page, /DialogContent className="max-h-\[90dvh\] overflow-hidden sm:max-w-4xl"/);
  assert.match(page, /Table className="w-full table-fixed"/);
  assert.doesNotMatch(page, /min-w-\[820px\]/);
});

test("SHEIN platform products page exposes sale sites, filters, and export", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /interface SaleSiteDetail/);
  assert.match(page, /saleSites: SaleSiteDetail\[\]/);
  assert.match(page, /saleSiteSummary/);
  assert.match(page, /saleSiteCount/);
  assert.match(page, /siteOptions/);
  assert.match(page, /siteFilter/);
  assert.match(page, /search\.set\("site", params\.siteFilter\.trim\(\)\)/);
  assert.match(page, /全部销售站点/);
  assert.match(page, /销售站点/);
  assert.match(page, /setSaleSitesDialogProduct/);
  assert.match(page, /saleSitesDialogProduct/);
  assert.match(page, /exportPlatformProducts/);
  assert.match(page, /fetchAllPlatformProductsForExport/);
  assert.match(page, /SHEIN平台商品列表/);
  assert.match(page, /销售站点明细/);
  assert.match(page, /exportWorkbook/);
  assert.match(page, /saleSiteDetailRows/);
  assert.match(page, /上架状态/);
  assert.match(page, /首次上架时间/);
  assert.match(page, /最近上架时间/);
  assert.match(page, /上架站点数/);
  assert.match(page, /exportSpreadsheet/);
  assert.doesNotMatch(page, /销售站点明细:\s*row\.saleSites\.map/);
});
