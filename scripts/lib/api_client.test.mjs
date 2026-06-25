import assert from "node:assert/strict";
import { test } from "node:test";

const { ApiError } = await import("../../web/src/lib/api-client.ts");

test("ApiError surfaces top-level API error_message responses", () => {
  const error = new ApiError(502, {
    error_code: "SHEIN_PRE_VALIDATION",
    error_message: "商品信息：标题缺失",
  });

  assert.equal(error.message, "SHEIN_PRE_VALIDATION · 商品信息：标题缺失");
});

test("ApiError still supports nested and plain message responses", () => {
  assert.equal(
    new ApiError(400, { error: { code: "BAD_REQUEST", message: "参数错误" } }).message,
    "BAD_REQUEST · 参数错误",
  );
  assert.equal(new ApiError(500, { message: "Internal server error" }).message, "Internal server error");
  assert.equal(new ApiError(502, {}).message, "API Error 502");
});

test("ApiError normalizes nginx gateway timeout HTML", () => {
  const html = `<html>
    <head><title>504 Gateway Time-out</title></head>
    <body><center><h1>504 Gateway Time-out</h1></center></body>
  </html>`;

  assert.equal(new ApiError(504, html).message, "网关超时，请稍后重试");
});
