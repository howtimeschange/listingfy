import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");

test("pre publish route builds readiness rows from current product archive data", async () => {
  const [route, server] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/pre-publish", prePublish\)/);
  assert.match(route, /\/readiness/);
  assert.match(route, /\/ai-fill/);
  assert.match(route, /\/field-fills/);
  assert.match(route, /channel_required_attribute/);
  assert.match(route, /size_conversion_rule/);
  assert.match(route, /supply_discount_rule/);
  assert.match(route, /product_weight_import/);
  assert.match(route, /listing_field_fill/);
});

test("pre publish validation page shows field completion, AI fill, and editable manual fields", async () => {
  const page = await readFile(PAGE_FILE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /发布前字段补齐/);
  assert.match(page, /字段完整度/);
  assert.match(page, /AI 补齐人工判断字段/);
  assert.match(page, /批量搜索款号/);
  assert.match(page, /需要人工判断/);
  assert.match(page, /字段来源/);
  assert.match(page, /保存字段/);
  assert.match(page, /usePrePublishReadiness/);
});
