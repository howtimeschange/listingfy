import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../..");
const file = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8");

test("shoe-size charts render retryable query failures instead of empty tables", async () => {
  const page = await file("web/src/pages/shoe-size-charts/page.tsx");

  assert.match(page, /QueryErrorState/);
  assert.match(page, /charts\.isError/);
  assert.match(page, /charts\.refetch/);
  assert.match(page, /rows\.isError/);
  assert.match(page, /rows\.refetch/);
});

test("SHEIN draft detail distinguishes 404 from transport failure and empty data", async () => {
  const page = await file("web/src/pages/pre-publish-validation/[listingId]/page.tsx");

  assert.match(page, /ApiError/);
  assert.match(page, /error\.status === 404/);
  assert.match(page, /QueryErrorState/);
  assert.match(page, /isError/);
  assert.match(page, /refetch/);
  assert.match(page, /草稿详情加载失败/);
});
