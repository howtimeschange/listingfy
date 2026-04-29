import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/category-mapping/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/category-mapping.ts");

test("category mapping page exposes an AI batch review workspace", async () => {
  const page = await readFile(PAGE_FILE, "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /AI 匹配未映射商品/);
  assert.match(page, /useCategoryMatchSuggestions/);
  assert.match(page, /confidence/);
  assert.match(page, /SheetContent/);
  assert.match(page, /确认首选/);
  assert.match(page, /选择备选/);
});

test("category mapping route provides AI suggestion and confirmation endpoints", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /\/ai-suggestions/);
  assert.match(route, /\/ai-suggestions\/confirm/);
  assert.match(route, /buildCategoryMatchPrompt/);
  assert.match(route, /callAiCategoryMatcher/);
  assert.match(route, /AI_SUGGESTED/);
  assert.match(route, /dimension_payload_json/);
});

test("category mapping AI grouping keeps one suggestion per match key", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /group_concat\(distinct pkg\.title\)/);
  assert.match(route, /skc_examples/);
  assert.match(route, /tmall_model_image_url/);
  assert.match(route, /asset\.place = 'TMALL'/);
  assert.match(route, /asset\.asset_type = 'MAIN'/);
  assert.match(route, /asset\.picture_type = 'HOME'/);
  assert.doesNotMatch(route, /group by[\s\S]*pkg\.title,/);
  assert.doesNotMatch(route, /group by[\s\S]*spu\.model_name,/);
  assert.doesNotMatch(route, /group by[\s\S]*spu\.spec_range,/);
});

test("category mapping page shows SKC examples and TMALL color images in AI review", async () => {
  const page = await readFile(PAGE_FILE, "utf8");

  assert.match(page, /skc_examples/);
  assert.match(page, /tmall_model_image_url/);
  assert.match(page, /SKC 款色判断/);
  assert.match(page, /同款不同色/);
  assert.match(page, /split_by_skc/);
  assert.match(page, /<SkcImageStrip/);
});
