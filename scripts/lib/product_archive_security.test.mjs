import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import {
  assertAllowedProductArchiveQuery,
  assertSafeProductArchiveCode,
} from "../../web/server/lib/product-archive-security.ts";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOGIN_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/login/page.tsx");
const ERROR_HANDLER_FILE = path.join(PROJECT_ROOT, "web/server/middleware/error-handler.ts");
const PRODUCT_ARCHIVES_ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/product-archives.ts");

test("product archive list rejects scanner-injected query parameter names", () => {
  for (const url of [
    "https://listingify.semirapp.com/api/product-archives/summary?filename=%3Ciframe%20src=javascript:alert(22311)%3E",
    "https://listingify.semirapp.com/api/product-archives?q=&brand=all&limit=50&offset=0&filepath=%3Ciframe%20src=javascript:alert(75536)%3E",
    "https://listingify.semirapp.com/api/product-archives/config?filename=%3Ciframe%20src=javascript:alert(20619)%3E",
  ]) {
    assert.throws(
      () => assertAllowedProductArchiveQuery(new URL(url), []),
      /Unsupported query parameter/,
    );
  }
});

test("product archive list accepts only documented list query parameters", () => {
  assert.doesNotThrow(() => {
    assertAllowedProductArchiveQuery(
      new URL("https://listingify.semirapp.com/api/product-archives?q=&brand=all&limit=50&offset=0"),
      ["q", "brand", "limit", "offset"],
    );
  });
});

test("product archive detail and sync routes reject script payloads as product codes", () => {
  for (const code of [
    "<iframe src=javascript:alert(53937)>",
    "202226117121<script>alert(1)</script>",
    "../config",
  ]) {
    assert.throws(() => assertSafeProductArchiveCode(code), /Invalid product code/);
  }
  assert.equal(assertSafeProductArchiveCode("202226117121"), "202226117121");
});

test("login page does not prefill the username with admin", async () => {
  const source = await readFile(LOGIN_PAGE_FILE, "utf8");

  assert.match(source, /useState\(""\)/);
  assert.doesNotMatch(source, /useState\("admin"\)/);
});

test("API error handler does not return internal exception messages for 500 responses", async () => {
  const source = await readFile(ERROR_HANDLER_FILE, "utf8");

  assert.match(source, /message:\s*"Internal server error"/);
  assert.doesNotMatch(source, /message:\s*err\.message\s*\|\|/);
});

test("Web DeepDraw sync forwards the resolved tenant to the importer", async () => {
  const source = await readFile(PRODUCT_ARCHIVES_ROUTE_FILE, "utf8");
  const syncBlock = source.match(
    /async function syncDeepdrawProduct\([\s\S]*?\n\}\n\nconst syncQueue/,
  )?.[0];

  assert.ok(syncBlock, "syncDeepdrawProduct implementation should be present");
  const importCall = syncBlock.match(
    /const summary = importDeepdrawPayloads\(db,\s*\{[\s\S]*?\n\s*\}\)/,
  )?.[0];

  assert.ok(importCall, "syncDeepdrawProduct should call importDeepdrawPayloads");
  assert.match(importCall, /tenantName:\s*config\.tenantName/);
});

test("product archive list queries use the latest package projection while detail keeps raw package lookup", async () => {
  const source = await readFile(PRODUCT_ARCHIVES_ROUTE_FILE, "utf8");
  const latestJoinCount = (source.match(
    /left join v_latest_product_content_package pkg on pkg\.spu_code = c\.spu_code/g,
  ) ?? []).length;
  const genericJoinCount = (source.match(
    /left join product_content_package pkg on pkg\.spu_code = c\.spu_code/g,
  ) ?? []).length;

  assert.equal(latestJoinCount, 3, "list, count, and summary should use the latest package view");
  assert.equal(genericJoinCount, 0, "generic package joins should not duplicate tenant packages");
  assert.match(
    source,
    /select \* from product_content_package\s+where spu_code = \?\s+order by updated_at desc, id desc\s+limit 1/,
  );
});
