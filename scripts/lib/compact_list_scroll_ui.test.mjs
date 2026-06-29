import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  globals: path.join(PROJECT_ROOT, "web/src/globals.css"),
  compactListLayout: path.join(PROJECT_ROOT, "web/src/components/layout/compact-list-layout.tsx"),
  draftListPage: path.join(PROJECT_ROOT, "web/src/pages/product-archive-drafts/page.tsx"),
  listingLaunchPlansPage: path.join(PROJECT_ROOT, "web/src/pages/listing-launch-plans/page.tsx"),
  fieldMappingsPage: path.join(PROJECT_ROOT, "web/src/pages/deepdraw-field-mappings/page.tsx"),
};

test("compact list pages expose vertical scrolling for tall filters and tables", async () => {
  const [globals, compactListLayout, draftListPage, listingLaunchPlansPage, fieldMappingsPage] = await Promise.all([
    readFile(files.globals, "utf8"),
    readFile(files.compactListLayout, "utf8"),
    readFile(files.draftListPage, "utf8"),
    readFile(files.listingLaunchPlansPage, "utf8"),
    readFile(files.fieldMappingsPage, "utf8"),
  ]);

  const compactListPageRule = globals.match(/\.compact-list-page\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
  assert.match(compactListPageRule, /overflow-y:\s*auto/);
  assert.match(compactListPageRule, /overflow-x:\s*hidden/);
  assert.doesNotMatch(compactListPageRule, /overflow:\s*hidden/);
  assert.match(compactListLayout, /CompactListTableFrame[\s\S]*overflow-auto/);
  assert.doesNotMatch(compactListLayout, /CompactListTableFrame[\s\S]*overflow-hidden/);

  for (const page of [draftListPage, listingLaunchPlansPage, fieldMappingsPage]) {
    assert.match(page, /<CompactListPage>/);
    assert.match(page, /<CompactListTableFrame>/);
  }
});
