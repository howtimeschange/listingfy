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
