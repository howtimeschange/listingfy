import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/029_deepdraw_field_mapping_rules.sql"),
  migrationV2: path.join(PROJECT_ROOT, "db/migrations/030_deepdraw_field_mapping_rules_v2.sql"),
  migrationV3: path.join(PROJECT_ROOT, "db/migrations/031_deepdraw_field_mapping_rule_domain_unique.sql"),
  server: path.join(PROJECT_ROOT, "web/server/index.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/deepdraw-field-mappings.ts"),
  service: path.join(PROJECT_ROOT, "web/server/services/deepdraw-field-mappings.ts"),
  draftService: path.join(PROJECT_ROOT, "web/server/services/product-archive-drafts.ts"),
  router: path.join(PROJECT_ROOT, "web/src/router.tsx"),
  sidebar: path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx"),
  page: path.join(PROJECT_ROOT, "web/src/pages/deepdraw-field-mappings/page.tsx"),
};

test("deepdraw field mapping schema is tenant-scoped and import-updatable", async () => {
  const [migration, migrationV2, migrationV3] = await Promise.all([
    readFile(files.migration, "utf8"),
    readFile(files.migrationV2, "utf8"),
    readFile(files.migrationV3, "utf8"),
  ]);

  assert.match(migration, /postgres-only/);
  assert.match(migration, /create table if not exists deepdraw_field_mapping_rule/);
  assert.match(migration, /tenant_name text not null/);
  assert.match(migration, /merchant_id text not null/);
  assert.match(migration, /field_domain_type text/);
  assert.match(migration, /deepdraw_field text not null/);
  assert.match(migration, /field_source text/);
  assert.match(migration, /mapped_field text/);
  assert.match(migration, /source_type text not null/);
  assert.match(migration, /raw_row_json jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /unique\(tenant_name, merchant_id, field_domain_type, deepdraw_field\)/);
  assert.match(migration, /PRODUCT_ARCHIVE_RULE_MANAGE/);
  assert.match(migrationV2, /alter table deepdraw_field_mapping_rule/);
  assert.match(migrationV2, /add column if not exists field_domain_type text/);
  assert.match(migrationV2, /add column if not exists field_source text/);
  assert.match(migrationV2, /add column if not exists mapped_field text/);
  assert.match(migrationV2, /drop constraint if exists deepdraw_field_mapping_rule_tenant_name_merchant_id_deepdraw_field_key/);
  assert.match(migrationV2, /unique.*tenant_name.*merchant_id.*field_domain_type.*deepdraw_field/is);
  assert.match(migrationV3, /drop constraint if exists deepdraw_field_mapping_rule_tenant_name_merchant_id_deepdra_key/);
  assert.match(migrationV3, /unique.*tenant_name.*merchant_id.*field_domain_type.*deepdraw_field/is);
  assert.doesNotMatch(migration, /sqlite|autoincrement|strftime/i);
});

test("deepdraw field mapping API and page support import and CRUD", async () => {
  const [server, route, service, draftService, router, sidebar, page] = await Promise.all([
    readFile(files.server, "utf8"),
    readFile(files.route, "utf8"),
    readFile(files.service, "utf8"),
    readFile(files.draftService, "utf8"),
    readFile(files.router, "utf8"),
    readFile(files.sidebar, "utf8"),
    readFile(files.page, "utf8"),
  ]);

  assert.match(server, /import deepdrawFieldMappings from "\.\/routes\/deepdraw-field-mappings"/);
  assert.match(server, /app\.route\("\/api\/deepdraw-field-mappings", deepdrawFieldMappings\)/);
  for (const pattern of [
    /deepdrawFieldMappings\.get\("\/"/,
    /deepdrawFieldMappings\.post\("\/imports"/,
    /deepdrawFieldMappings\.post\("\/"/,
    /deepdrawFieldMappings\.patch\("\/:ruleId"/,
    /deepdrawFieldMappings\.delete\("\/:ruleId"/,
  ]) {
    assert.match(route, pattern);
  }
  assert.match(route, /readSpreadsheetSheetsFromFile/);
  assert.match(route, /parseDeepdrawFieldMappingRows/);
  assert.match(service, /export function importDeepdrawFieldMappingRows/);
  assert.match(service, /on conflict \(tenant_name, merchant_id, field_domain_type, deepdraw_field\) do update/);
  assert.match(service, /field_domain_type/);
  assert.match(service, /field_source/);
  assert.match(service, /mapped_field/);
  assert.match(service, /export function createDeepdrawFieldMappingRule/);
  assert.match(service, /export function updateDeepdrawFieldMappingRule/);
  assert.match(service, /export function deleteDeepdrawFieldMappingRule/);
  assert.match(draftService, /deepdraw_field_mapping_rule/);
  assert.match(draftService, /fieldMappingRulesForDraft/);

  assert.match(router, /DeepdrawFieldMappingsPage/);
  assert.match(router, /path: "deepdraw-field-mappings"/);
  assert.match(sidebar, /深绘字段对应关系/);
  assert.match(sidebar, /\/deepdraw-field-mappings/);
  assert.match(page, /深绘字段对应关系/);
  for (const label of ["深绘账号", "深绘字段", "字段来源", "对应字段", "字段类型", "是否能MDM导入", "备注", "启用", "更新时间", "操作"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /导入更新/);
  assert.match(page, /新增规则/);
  assert.match(page, /编辑规则/);
  assert.match(page, /删除/);
  assert.match(page, /tenantName/);
  assert.match(page, /merchantId/);
  assert.match(page, /\/deepdraw-field-mappings\/imports/);
});
