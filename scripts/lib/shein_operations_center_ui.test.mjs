import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PLAN_FILE = path.join(PROJECT_ROOT, "docs/shein-product-lifecycle-api-plan-2026-05-11.md");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");
const SIDEBAR_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx");
const HEADER_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-header.tsx");
const SHARED_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-operations/_components/operation-capability-page.tsx");
const PAGES = [
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/barcode-size/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/platform-identities/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/audit-status/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/compliance/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/procurement/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/inventory/page.tsx"),
  path.join(PROJECT_ROOT, "web/src/pages/shein-operations/finance/page.tsx"),
];

async function read(file) {
  return readFile(file, "utf8");
}

test("SHEIN operations center organizes P1 and P2 lifecycle capabilities into second-level pages", async () => {
  const [plan, router, sidebar, header, sharedPage, ...pages] = await Promise.all([
    read(PLAN_FILE),
    read(ROUTER_FILE),
    read(SIDEBAR_FILE),
    read(HEADER_FILE),
    read(SHARED_PAGE_FILE),
    ...PAGES.map(read),
  ]);
  const combinedPages = [sharedPage, ...pages].join("\n");

  assert.match(plan, /P1：运营必需支撑能力/);
  assert.match(plan, /P2：合规、采购、库存、财务扩展/);

  assert.match(sidebar, /SHEIN运营中心/);
  for (const [label, route] of [
    ["条码尺码", "shein-operations/barcode-size"],
    ["平台标识对账", "shein-operations/platform-identities"],
    ["审核状态", "shein-operations/audit-status"],
    ["合规证书", "shein-operations/compliance"],
    ["采购备货", "shein-operations/procurement"],
    ["库存运营", "shein-operations/inventory"],
    ["财务经营", "shein-operations/finance"],
  ]) {
    assert.match(sidebar, new RegExp(label));
    assert.match(sidebar, new RegExp(`/${route}`));
    assert.match(router, new RegExp(`path: "${route}"`));
  }

  assert.match(header, /"shein-operations": "SHEIN运营中心"/);

  for (const text of [
    "/shein-operations/barcodes/batch-skc-size",
    "/shein-operations/barcodes/print",
    "/shein-operations/platform-identities/number-list",
    "/shein-operations/platform-identities/supplier-sku/check",
    "/shein-operations/audit-status",
    "batch-skc-size",
    "print-barcode",
    "number-list",
    "check-supplierSku-repeated",
    "审核状态中心",
    "失败原因分组",
    "证书池",
    "GPSR",
    "采购单",
    "手工备货单",
    "/open-api/goods/stock-update",
    "/open-api/stock/stock-query",
    "报账单",
    "销售款",
    "补扣款",
  ]) {
    assert.match(combinedPages, new RegExp(text.replaceAll("/", "\\/")));
  }

  assert.doesNotMatch(combinedPages, /ComingSoonPage/);
  assert.match(combinedPages, /接口能力/);
  assert.match(combinedPages, /功能设计/);
  assert.match(combinedPages, /接入状态/);
});
