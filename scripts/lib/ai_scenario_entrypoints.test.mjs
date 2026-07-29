import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const [prePublish, productArchive, categoryMatcher] = await Promise.all([
  readFile(new URL("web/server/routes/pre-publish.ts", root), "utf8"),
  readFile(
    new URL("web/server/services/product-archive-drafts.ts", root),
    "utf8",
  ),
  readFile(new URL("scripts/lib/ai_category_matcher.mjs", root), "utf8"),
]);

test("SHEIN title and enum attributes use the persistent scenario router", () => {
  assert.match(prePublish, /getDefaultAiScenarioRouter/);
  assert.match(prePublish, /scenario:\s*"title_translation"/);
  assert.match(prePublish, /promptVersion:\s*"title-translation-v1"/);
  assert.match(prePublish, /scenario:\s*"shein_attribute"/);
  assert.match(prePublish, /promptVersion:\s*"shein-enum-attribute-v1"/);
});

test("legacy batch AI fill routes title generation through the title scenario", () => {
  const start = prePublish.indexOf('prePublish.post("/ai-fill"');
  const implementation = prePublish.slice(start);

  assert.match(
    implementation,
    /titleNeedsAi[\s\S]*safeAiTranslateTitle\(row\)/,
  );
  assert.doesNotMatch(
    implementation,
    /const fieldsToFill = \[\s*\.\.\.\(titleNeedsAi/,
  );
});

test("SHEIN category matcher uses ordinary and neutral scenario boundaries", () => {
  assert.match(categoryMatcher, /resolveAiCategoryScenario/);
  assert.match(categoryMatcher, /"shein_category"/);
  assert.match(categoryMatcher, /"neutral_skc"/);
  assert.match(categoryMatcher, /withAiRoutingHashes/);
  assert.match(prePublish, /router:\s*getDefaultAiScenarioRouter/);
});

test("DeepDraw field fill and size mapping use their own admitted routes", () => {
  assert.match(productArchive, /getDefaultAiScenarioRouter/);
  assert.match(productArchive, /scenario:\s*"deepdraw_field_fill"/);
  assert.match(productArchive, /promptVersion:\s*"deepdraw-field-fill-v1"/);
  assert.match(productArchive, /scenario:\s*"size_mapping"/);
  assert.match(productArchive, /promptVersion:\s*"deepdraw-size-mapping-v1"/);
});
