import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const SIDEBAR_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx");
const DASHBOARD_FILE = path.join(PROJECT_ROOT, "web/src/pages/dashboard/page.tsx");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");

test("primary navigation shows the active SHEIN workflow and hides deprecated planning pages", async () => {
  const [sidebar, dashboard, router] = await Promise.all([
    readFile(SIDEBAR_FILE, "utf8"),
    readFile(DASHBOARD_FILE, "utf8"),
    readFile(ROUTER_FILE, "utf8"),
  ]);

  assert.doesNotMatch(sidebar, /图片管理/);
  assert.doesNotMatch(sidebar, /\/image-management/);

  assert.match(sidebar, /上新批次/);
  assert.match(sidebar, /\/listing-batches/);
  assert.match(sidebar, /SHEIN 商品分桶/);
  assert.match(sidebar, /SHEIN 发布草稿箱/);
  assert.match(sidebar, /SHEIN 类目映射/);
  assert.match(sidebar, /SHEIN 包装规则/);
  assert.match(sidebar, /SHEIN 价格规则/);
  assert.match(sidebar, /发布任务/);
  assert.match(sidebar, /图片素材库/);
  assert.doesNotMatch(dashboard, /图片管理/);
  assert.doesNotMatch(dashboard, /\/image-management/);

  assert.match(router, /path: "listing-batches"/);
  assert.match(router, /path: "image-management"/);
});
