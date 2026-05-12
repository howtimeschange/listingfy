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
  assert.match(page, /真实数据回归/);
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
