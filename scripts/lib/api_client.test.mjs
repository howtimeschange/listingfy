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

test("form upload distinguishes transferred bytes from the server result", async (t) => {
  const { api } = await import("../../web/src/lib/api-client.ts");
  const previous = globalThis.XMLHttpRequest;
  let xhr;
  globalThis.XMLHttpRequest = class {
    upload = {};
    status = 200;
    responseText = '{"imported_count":2}';
    constructor() { xhr = this; }
    open(method, url) { this.method = method; this.url = url; }
    send(body) { this.body = body; }
  };
  t.after(() => { globalThis.XMLHttpRequest = previous; });
  const progress = [];
  let settled = false;
  const form = new FormData();
  const request = api.postFormWithProgress("/upload", form, (value) => progress.push(value));
  request.then(() => { settled = true; });
  assert.equal(xhr.method, "POST");
  assert.equal(xhr.url, "/api/upload");
  assert.equal(xhr.withCredentials, true);
  assert.equal(xhr.body, form);
  xhr.upload.onprogress({ lengthComputable: false, loaded: 1, total: 0 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 4, total: 10 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 995, total: 1000 });
  xhr.upload.onprogress({ lengthComputable: true, loaded: 1000, total: 1000 });
  assert.deepEqual(progress, [40, 99, 99], "progress events must not switch the UI into server processing");
  xhr.upload.onload();
  await Promise.resolve();
  assert.deepEqual(progress, [40, 99, 99, 100]);
  assert.equal(settled, false, "uploaded bytes must not imply parsing succeeded");
  xhr.onload();
  assert.deepEqual(await request, { imported_count: 2 });
});

test("form upload preserves API failures and never resubmits a disconnected request", async (t) => {
  const { api } = await import("../../web/src/lib/api-client.ts");
  const previous = globalThis.XMLHttpRequest;
  let xhr, sends = 0;
  globalThis.XMLHttpRequest = class {
    upload = {};
    constructor() { xhr = this; }
    open() {}
    send() { sends++; }
  };
  t.after(() => { globalThis.XMLHttpRequest = previous; });
  const request = api.postFormWithProgress("/upload", new FormData(), () => {});
  xhr.status = 413;
  xhr.responseText = '{"message":"文件过大"}';
  xhr.onload();
  await assert.rejects(request, (error) => error instanceof ApiError && error.status === 413 && error.message === "文件过大");
  const disconnected = api.postFormWithProgress("/upload", new FormData(), () => {});
  xhr.onerror();
  await assert.rejects(disconnected, /提交结果尚未确认/);
  assert.equal(sends, 2);
  const malformed = api.postFormWithProgress("/upload", new FormData(), () => {});
  xhr.status = 200;
  xhr.responseText = "<html>proxy error</html>";
  xhr.onload();
  await assert.rejects(malformed, /响应格式异常/);
});
