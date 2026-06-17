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
const AI_SUGGESTION_JOB_MIGRATION_FILE = path.join(
  PROJECT_ROOT,
  "db/migrations/026_category_ai_suggestion_jobs.sql",
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
  assert.match(route, /\/ai-suggestions\/jobs/);
  assert.match(route, /\/ai-suggestions\/jobs\/:jobId/);
  assert.match(route, /\/ai-suggestions\/confirm/);
  assert.match(route, /buildCategoryMatchPrompt/);
  assert.match(route, /callAiCategoryMatcher/);
  assert.match(route, /AI_SUGGESTED/);
  assert.match(route, /dimension_payload_json/);
});

test("category mapping AI generation runs as an async job to avoid gateway timeouts", async () => {
  const [route, page] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(PAGE_FILE, "utf8"),
  ]);

  assert.match(route, /categoryMapping\.post\("\/ai-suggestions\/jobs"/);
  assert.match(route, /categoryMapping\.get\("\/ai-suggestions\/jobs\/:jobId"/);
  assert.match(route, /queueMicrotask/);
  assert.match(route, /runCategoryAiSuggestionJob/);
  assert.match(route, /refreshBucketProduct/);
  assert.match(route, /status:\s*"queued"/);
  assert.match(route, /status:\s*"completed"/);

  assert.match(page, /useAsyncTasks/);
  assert.match(page, /addTask/);
  assert.match(page, /openTaskCenter/);
  assert.match(page, /\/category-mapping\/ai-suggestions\/jobs/);
  assert.match(page, /category_mapping_ai_suggestions/);
});

test("category mapping AI job state is persisted so polling survives process restarts", async () => {
  const [route, migration] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(AI_SUGGESTION_JOB_MIGRATION_FILE, "utf8"),
  ]);

  assert.match(migration, /create table if not exists category_ai_suggestion_job/);
  assert.match(migration, /groups_json jsonb not null default '\[\]'::jsonb/);
  assert.match(migration, /items_json jsonb not null default '\[\]'::jsonb/);
  assert.match(route, /persistCategoryAiJob/);
  assert.match(route, /readCategoryAiSuggestionJob/);
  assert.match(route, /recoverCategoryAiSuggestionJobs/);
  assert.match(route, /scheduleCategoryAiSuggestionJob\(job\.id\)/);
  assert.match(route, /where status in \('queued', 'running'\)/);
  assert.match(route, /categoryMapping\.get\("\/ai-suggestions\/jobs\/:jobId"[\s\S]+readCategoryAiSuggestionJob/);
  assert.doesNotMatch(route, /new Map<string,\s*CategoryAiSuggestionJob>/);
});

test("legacy category AI suggestion endpoint returns an async job instead of blocking on model output", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");
  const routeBlock = route.slice(
    route.indexOf('categoryMapping.post("/ai-suggestions",'),
    route.indexOf("// POST /api/category-mapping/ai-suggestions/confirm"),
  );

  assert.match(routeBlock, /dryRun/);
  assert.match(routeBlock, /generateCategoryAiSuggestions/);
  assert.match(routeBlock, /enqueueCategoryAiSuggestionJob/);
  assert.match(routeBlock, /return c\.json\(job,\s*202\)/);
  assert.doesNotMatch(routeBlock, /await generateCategoryAiSuggestions[\s\S]*refreshBuckets:\s*true/);
});

test("category mapping AI route limits candidate payload sent to the model", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /AI_CATEGORY_CANDIDATE_LIMIT = 20/);
  assert.match(route, /candidates\.slice\(0, AI_CATEGORY_CANDIDATE_LIMIT\)/);
});

test("category mapping AI route can target selected SPU codes", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /spu_codes\?:\s*unknown/);
  assert.match(route, /spuCodes:\s*uniqueStrings/);
  assert.match(route, /listUnmappedGroups\(db,\s*limit,\s*spuCodes\)/);
  assert.match(route, /spu\.spu_code in/);
  assert.match(route, /requested_spu_codes:\s*spuCodes/);
  assert.match(route, /buildCategoryAiJobItems\(groups,\s*job\.requested_spu_codes\)/);
  assert.match(route, /requestedSpuCodes\.length > 0/);
  assert.match(route, /requestedSpuCodes\.map\(\(spuCode\)/);
});

test("category mapping AI skips groups already covered by active fallback rules", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /resolveSheinKidsCategoryFallback/);
  assert.match(route, /categoryFallbackInputForGroup/);
  assert.match(route, /filterGroupsWithoutCodeFallback/);
  assert.match(route, /middle_class_name:\s*group\.mdm_middle_category_name/);
  assert.match(route, /subclass_name:\s*group\.mdm_small_category_name/);
  assert.match(route, /deepdraw_trade_path:\s*group\.trade_path/);
  assert.match(route, /const queryLimit = Math\.max\(limit,\s*Math\.min\(500,\s*limit \* 5\)\)/);
  assert.match(route, /filterGroupsWithoutCodeFallback\(rows\.map\(toUnmappedGroup\)\)\.slice\(0,\s*limit\)/);
  assert.match(route, /rule\.match_mode = 'FALLBACK'/);
  assert.match(route, /rule\.mdm_small_category_name = grouped\.mdm_small_category_name/);
});

test("category mapping AI candidates include common kidswear categories", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /text\.includes\("T恤"\)/);
  assert.match(route, /keywords\.add\("T恤"\)/);
  assert.match(route, /text\.includes\("卫衣"\)/);
  assert.match(route, /keywords\.add\("卫衣"\)/);
  assert.match(route, /text\.includes\("外套"\)/);
  assert.match(route, /keywords\.add\("外套"\)/);
  assert.match(route, /text\.includes\("裤"\)/);
  assert.match(route, /keywords\.add\("裤"\)/);
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
