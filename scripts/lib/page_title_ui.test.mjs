import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

test("web document title uses the commodity operations platform positioning", async () => {
  const index = await readFile(path.join(PROJECT_ROOT, "web/index.html"), "utf8");

  assert.match(index, /<title>Listingify-商品运营平台<\/title>/);
  assert.doesNotMatch(index, /Listingify-跨境运营平台/);
});
