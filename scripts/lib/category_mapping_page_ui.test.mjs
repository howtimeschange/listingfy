import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/category-mapping/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/category-mapping.ts");
const AI_SUGGESTION_MIGRATION_FILE = path.join(
  PROJECT_ROOT,
  "db/migrations/006_category_ai_suggestions.sql",
);

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

test("category mapping AI route limits candidate payload sent to the model", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /AI_CATEGORY_CANDIDATE_LIMIT = 20/);
  assert.match(route, /candidates\.slice\(0, AI_CATEGORY_CANDIDATE_LIMIT\)/);
});

test("category mapping AI grouping keeps one suggestion per match key", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /group_concat\(distinct pkg\.title\)/);
  assert.match(route, /skc_examples/);
  assert.match(route, /tmall_color_image_url/);
  assert.match(route, /asset\.place = 'TMALL'/);
  assert.match(route, /asset\.asset_type = 'COLOR_BLOCK'/);
  assert.match(route, /asset\.picture_type = 'COLOR'/);
  assert.doesNotMatch(route, /group by[\s\S]*pkg\.title,/);
  assert.doesNotMatch(route, /group by[\s\S]*spu\.model_name,/);
  assert.doesNotMatch(route, /group by[\s\S]*spu\.spec_range,/);
});

test("category mapping page shows SKC examples and TMALL color images in AI review", async () => {
  const page = await readFile(PAGE_FILE, "utf8");

  assert.match(page, /skc_examples/);
  assert.match(page, /tmall_color_image_url/);
  assert.match(page, /SKC 款色判断/);
  assert.match(page, /同款不同色/);
  assert.match(page, /split_by_skc/);
  assert.match(page, /<SkcImageStrip/);
});

test("category mapping AI suggestions are persisted and loaded after navigation", async () => {
  const [page, route, migration] = await Promise.all([
    readFile(PAGE_FILE, "utf8"),
    readFile(ROUTE_FILE, "utf8"),
    readFile(AI_SUGGESTION_MIGRATION_FILE, "utf8"),
  ]);

  assert.match(migration, /create table if not exists mdm_shein_category_ai_suggestion/);
  assert.match(route, /mdm_shein_category_ai_suggestion/);
  assert.match(route, /persistAiSuggestions/);
  assert.match(route, /listPersistedAiSuggestions/);
  assert.match(route, /categoryMapping\.get\("\/ai-suggestions"/);
  assert.match(page, /usePersistedAiSuggestions/);
  assert.match(page, /suggestionsQuery/);
  assert.match(page, /\["category-mapping", "ai-suggestions"\]/);
});
