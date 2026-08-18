import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

function file(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
}

async function migrationSql() {
  const migrationDir = path.join(PROJECT_ROOT, "db/migrations");
  const filenames = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(filenames.map((name) => readFile(path.join(migrationDir, name), "utf8")))
    .then((parts) => parts.join("\n"));
}

function rolePermissionBlock(migration, roleKey) {
  const marker = `where r.role_key = '${roleKey}'`;
  const start = migration.indexOf(marker);
  assert.notEqual(start, -1, `missing role permission block for ${roleKey}`);
  const next = migration.indexOf("insert into rbac_role_permission", start + marker.length);
  return next === -1 ? migration.slice(start) : migration.slice(start, next);
}

test("role presets split DeepDraw archive work from SHEIN operations", async () => {
  const migration = await file("db/migrations/032_role_workstream_permissions.sql");
  const migrations = await migrationSql();
  const deepdrawPermissions = rolePermissionBlock(migration, "DEEPDRAW_OPERATOR");
  const sheinPermissions = rolePermissionBlock(migration, "SHEIN_OPERATOR");

  assert.match(migration, /DEEPDRAW_OPERATOR/);
  assert.match(migration, /SHEIN_OPERATOR/);
  assert.match(migration, /深绘建档运营/);
  assert.match(migration, /SHEIN 运营/);

  assert.match(deepdrawPermissions, /PRODUCT_ARCHIVE_DRAFT_READ/);
  assert.match(deepdrawPermissions, /PRODUCT_ARCHIVE_DRAFT_SUBMIT/);
  assert.match(deepdrawPermissions, /PRODUCT_ARCHIVE_RULE_MANAGE/);
  assert.match(deepdrawPermissions, /DEEPDRAW_METADATA_MANAGE/);
  assert.match(migrations, /where r\.role_key = 'DEEPDRAW_OPERATOR'\s+and p\.permission_key = 'DATA_READ'/);
  assert.doesNotMatch(deepdrawPermissions, /LISTING_READ/);
  assert.doesNotMatch(deepdrawPermissions, /PUBLISH_RUN/);
  assert.doesNotMatch(deepdrawPermissions, /PLATFORM_CONFIG/);

  assert.match(sheinPermissions, /LISTING_READ/);
  assert.match(sheinPermissions, /LISTING_WRITE/);
  assert.match(sheinPermissions, /PUBLISH_RUN/);
  assert.match(sheinPermissions, /RULE_WRITE/);
  assert.doesNotMatch(sheinPermissions, /PRODUCT_ARCHIVE_DRAFT_WRITE/);
  assert.doesNotMatch(sheinPermissions, /PRODUCT_ARCHIVE_RULE_MANAGE/);
  assert.doesNotMatch(sheinPermissions, /DEEPDRAW_METADATA_MANAGE/);
});

test("sidebar groups operational menus by workstream permissions", async () => {
  const sidebar = await file("web/src/components/layout/app-sidebar.tsx");

  assert.match(sidebar, /label:\s*"运营总览"/);
  assert.match(sidebar, /label:\s*"深绘建档"/);
  assert.match(sidebar, /label:\s*"SHEIN 上新运营"/);
  assert.match(sidebar, /label:\s*"商品数据"/);
  assert.match(sidebar, /label:\s*"规则配置"/);
  assert.doesNotMatch(sidebar, /label:\s*"上新工作"/);
  assert.doesNotMatch(sidebar, /label:\s*"SHEIN运营中心"/);
  assert.match(sidebar, /aria-label="AI 驱动"/);
  assert.match(sidebar, /Listing Platform/);

  assert.match(sidebar, /深绘建档草稿", to: "\/product-archive-drafts", icon: PenLine, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);
  assert.match(sidebar, /上市计划表", to: "\/listing-launch-plans", icon: FileSpreadsheet, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);
  assert.match(sidebar, /鞋品尺码表", to: "\/shoe-size-charts", icon: Ruler, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);
  assert.match(sidebar, /深绘字段对应关系", to: "\/deepdraw-field-mappings", icon: ClipboardList, permission: "PRODUCT_ARCHIVE_RULE_MANAGE"/);
  assert.match(sidebar, /深绘类目字段", to: "\/deepdraw-metadata", icon: Database, permission: "PRODUCT_ARCHIVE_DRAFT_READ"/);

  assert.match(sidebar, /SHEIN 商品分桶", to: "\/shein-products", icon: ShoppingBag, permission: "LISTING_READ"/);
  assert.match(sidebar, /SHEIN 发布草稿箱", to: "\/pre-publish-validation", icon: ShieldCheck, permission: "LISTING_READ"/);
  assert.match(sidebar, /平台商品列表", to: "\/shein-platform-products", icon: PackageSearch, permission: "LISTING_READ"/);
  assert.match(sidebar, /审核状态中心", to: "\/shein-operations\/audit-status", icon: ClipboardList, permission: "LISTING_READ"/);
});

test("dashboard becomes a permission-aware cross-workstream cockpit", async () => {
  const dashboard = await file("web/src/pages/dashboard/page.tsx");

  assert.match(dashboard, /useAuth/);
  assert.match(dashboard, /canUseDeepdraw/);
  assert.match(dashboard, /canUseShein/);
  assert.match(dashboard, /enabled:\s*canUseDeepdraw/);
  assert.match(dashboard, /enabled:\s*canUseShein/);
  assert.match(dashboard, /AI 商品运营平台/);
  assert.match(dashboard, /商品运营中台/);
  assert.match(dashboard, /AI 商品运营能力/);
  assert.match(dashboard, /OCR\/AI 补齐/);
  assert.match(dashboard, /从商品资料到平台回执的统一运营台/);
  assert.match(dashboard, /深绘建档/);
  assert.match(dashboard, /SHEIN 上新运营/);
  assert.match(dashboard, /\/product-archive-drafts/);
  assert.match(dashboard, /\/shein-platform-products/);
});

test("user management exposes the simplified role vocabulary", async () => {
  const usersPage = await file("web/src/pages/users/page.tsx");

  assert.match(usersPage, /DEEPDRAW_OPERATOR:\s*"深绘建档运营"/);
  assert.match(usersPage, /SHEIN_OPERATOR:\s*"SHEIN 运营"/);
  assert.match(usersPage, /ADMIN:\s*"管理员"/);
  assert.match(usersPage, /VIEWER:\s*"只读"/);
  assert.doesNotMatch(usersPage, /OPERATOR:\s*"运营"/);
});
