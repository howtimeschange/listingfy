import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGINATION_COMPONENT = path.join(PROJECT_ROOT, "web/src/components/server-pagination.tsx");

const listPages = [
  "web/src/pages/product-archives/page.tsx",
  "web/src/pages/mdm-products/page.tsx",
  "web/src/pages/deepdraw-content/page.tsx",
  "web/src/pages/image-library/page.tsx",
  "web/src/pages/category-mapping/page.tsx",
  "web/src/pages/shein-products/page.tsx",
  "web/src/pages/pre-publish-validation/page.tsx",
  "web/src/pages/size-conversion/page.tsx",
  "web/src/pages/price-rules/page.tsx",
  "web/src/pages/package-rules/page.tsx",
];

test("active list pages use shared server pagination with editable page size", async () => {
  const pagination = await readFile(PAGINATION_COMPONENT, "utf8");

  assert.match(pagination, /interface ServerPaginationProps/);
  assert.match(pagination, /每页数量/);
  assert.match(pagination, /上一页/);
  assert.match(pagination, /下一页/);
  assert.match(pagination, /onLimitChange/);
  assert.match(pagination, /onOffsetChange/);

  for (const file of listPages) {
    const source = await readFile(path.join(PROJECT_ROOT, file), "utf8");
    assert.match(source, /ServerPagination/, `${file} must render shared pagination controls`);
    assert.match(source, /pagination/, `${file} must consume API pagination metadata`);
    assert.match(source, /limit=/, `${file} must request the selected page size`);
    assert.match(source, /offset=/, `${file} must request the selected page offset`);
  }
});
