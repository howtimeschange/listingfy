import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeepdrawGetRequest,
  buildDeepdrawPostRequest,
  createDeepdrawProduct,
  deepdrawBusinessResult,
  deepdrawFailureMessage,
  getDeepdrawProduct,
  hasDeepdrawBusinessBody,
  isDeepdrawBusinessSuccess,
  normalizeDeepdrawBusinessPayload,
  parseTenantCredentialsFromText,
  resolveDeepdrawConfig,
} from "./deepdraw_client.mjs";

test("parseTenantCredentialsFromText reads the row before the tenant name", () => {
  const text = `
merchantId
appKey
appSecret
dopKey
品牌
1162
app-key-1
app-secret-1
dop-key-1
电商巴拉巴拉
1527
app-key-2
app-secret-2
dop-key-2
迷你巴拉
`;

  assert.deepEqual(parseTenantCredentialsFromText(text, "电商巴拉巴拉"), {
    merchantId: "1162",
    appKey: "app-key-1",
    appSecret: "app-secret-1",
    dopKey: "dop-key-1",
    tenantName: "电商巴拉巴拉",
  });
});

test("buildDeepdrawGetRequest matches the SDK canonical GET request shape", () => {
  const request = buildDeepdrawGetRequest({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    type: "dp.product.resource",
    query: {
      productCode: "208226102001",
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest/v2?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
  );
  assert.equal(
    request.stringToSign,
    [
      "GET",
      "application/json; charset=utf-8",
      "",
      "application/x-www-form-urlencoded; charset=utf-8",
      "Wed, 29 Apr 2026 00:00:00 GMT",
      "x-ca-key:app-key",
      "x-ca-nonce:nonce-1",
      "x-ca-signature-method:HmacSHA256",
      "x-ca-timestamp:1777420800000",
      "/rest/v2?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
    ].join("\n"),
  );
  assert.equal(
    request.headers["x-ca-signature-headers"],
    "x-ca-key,x-ca-nonce,x-ca-signature-method,x-ca-timestamp",
  );
  assert.match(request.headers["x-ca-signature"], /^[A-Za-z0-9+/]+=*$/);
});

test("buildDeepdrawPostRequest matches the SDK metadata POST request shape", () => {
  const request = buildDeepdrawPostRequest({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    type: "dp.trade.fields",
    query: {
      tradeId: "9009",
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest?dopKey=dop-key&merchantId=1162&tradeId=9009&type=dp.trade.fields",
  );
  assert.equal(
    request.stringToSign,
    [
      "POST",
      "application/json; charset=utf-8",
      "",
      "application/x-www-form-urlencoded; charset=utf-8",
      "Wed, 29 Apr 2026 00:00:00 GMT",
      "x-ca-key:app-key",
      "x-ca-nonce:nonce-1",
      "x-ca-signature-method:HmacSHA256",
      "x-ca-timestamp:1777420800000",
      "/rest?dopKey=dop-key&merchantId=1162&tradeId=9009&type=dp.trade.fields",
    ].join("\n"),
  );
  assert.match(request.headers["x-ca-signature"], /^[A-Za-z0-9+/]+=*$/);
});

test("buildDeepdrawGetRequest does not let payload fields override signed credential parameters", () => {
  const request = buildDeepdrawGetRequest({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "credential-dop-key",
      merchantId: "1162",
    },
    type: "dp.product.resource",
    query: {
      merchantId: "",
      dopKey: "payload-dop-key",
      type: "dp.product.create",
      productCode: "208226102001",
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest/v2?dopKey=credential-dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
  );
  assert.match(request.stringToSign, /dopKey=credential-dop-key&merchantId=1162/);
  assert.doesNotMatch(request.stringToSign, /payload-dop-key|dp\.product\.create/);
});

test("DeepDraw business parser unwraps SDK response envelopes", () => {
  const result = {
    status: 200,
    ok: true,
    payload: {
      status: 200,
      response: {
        code: 10200,
        response: "success",
        reason: "访问成功！",
        requestId: 1066,
        body: {
          code: "208326105104",
          productId: 6420658,
        },
      },
    },
  };

  assert.equal(isDeepdrawBusinessSuccess(result), true);
  assert.equal(hasDeepdrawBusinessBody(result.payload), true);
  assert.deepEqual(deepdrawBusinessResult(result.payload), {
    status: 200,
    code: 10200,
    response: "success",
    state: "success",
    reason: "访问成功！",
    requestId: "1066",
    body: {
      code: "208326105104",
      productId: 6420658,
    },
  });
  assert.deepEqual(normalizeDeepdrawBusinessPayload(result.payload), {
    code: 10200,
    response: "success",
    reason: "访问成功！",
    requestId: "1066",
    body: {
      code: "208326105104",
      productId: 6420658,
    },
  });
});

test("DeepDraw business parser surfaces HTTP 200 business failure reasons", () => {
  const result = {
    status: 200,
    ok: false,
    payload: {
      status: 200,
      response: {
        code: 10404,
        response: "failure",
        reason: "未在服务器上发现商品",
        requestId: "request-3",
      },
    },
  };

  assert.equal(isDeepdrawBusinessSuccess(result), false);
  assert.equal(hasDeepdrawBusinessBody(result.payload), false);
  assert.equal(deepdrawFailureMessage(result), "未在服务器上发现商品");
});

test("createDeepdrawProduct delegates creation to the SDK adapter contract", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called for SDK product create");
  };

  try {
    const calls = [];
    const result = await createDeepdrawProduct({
      config: {
        baseUrl: "http://open.deepdraw.cn",
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        merchantId: "1162",
      },
      payload: { code: "208226102001", merchantId: "" },
      adapter: async (input) => {
        calls.push(input);
        return {
          status: 200,
          ok: true,
          requestId: "request-1",
          payload: { response: { code: 10200, response: "success" } },
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload.code, "208226102001");
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("getDeepdrawProduct delegates product resource reads to the SDK adapter contract", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch should not be called for SDK product resource reads");
  };

  try {
    const calls = [];
    const result = await getDeepdrawProduct({
      config: {
        baseUrl: "http://open.deepdraw.cn",
        appKey: "app-key",
        appSecret: "app-secret",
        dopKey: "dop-key",
        merchantId: "1162",
      },
      productCode: "208326105214",
      adapter: async (input) => {
        calls.push(input);
        return {
          status: 200,
          ok: true,
          requestId: "request-2",
          payload: { response: { code: 10200, response: "success", body: { productId: 7788 } } },
        };
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].productCode, "208326105214");
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("getDeepdrawProduct omits resource by default so product archive sync gets all resources", async () => {
  const calls = [];
  await getDeepdrawProduct({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productCode: "208326120201",
    adapter: async (input) => {
      calls.push(input);
      return {
        status: 200,
        ok: true,
        requestId: "request-3",
        payload: { response: { code: 10200, response: "success", body: { productId: 7788 } } },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].resource, undefined);
});

test("getDeepdrawProduct can pass an explicit resource filter to the SDK adapter", async () => {
  const calls = [];
  await getDeepdrawProduct({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productCode: "208326120201",
    resource: "form",
    adapter: async (input) => {
      calls.push(input);
      return {
        status: 200,
        ok: true,
        requestId: "request-4",
        payload: { response: { code: 10200, response: "success", body: { productId: 7788 } } },
      };
    },
  });

  assert.equal(calls[0].resource, "form");
});

test("resolveDeepdrawConfig can select credentials from env JSON by tenant name", () => {
  const previousJson = process.env.DEEPDRAW_TENANT_CREDENTIALS_JSON;
  const previousTenant = process.env.DEEPDRAW_TENANT_NAME;
  const previousBaseUrl = process.env.DEEPDRAW_BASE_URL;
  const previousAppKey = process.env.DEEPDRAW_APP_KEY;
  const previousAppSecret = process.env.DEEPDRAW_APP_SECRET;
  const previousDopKey = process.env.DEEPDRAW_DOP_KEY;
  const previousMerchantId = process.env.DEEPDRAW_MERCHANT_ID;

  process.env.DEEPDRAW_TENANT_NAME = "电商巴拉巴拉";
  process.env.DEEPDRAW_TENANT_CREDENTIALS_JSON = JSON.stringify({
    电商巴拉巴拉: {
      merchantId: "1162",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
    },
    迷你巴拉: {
      merchantId: "1527",
      appKey: "mini-app-key",
      appSecret: "mini-app-secret",
      dopKey: "mini-dop-key",
    },
  });
  delete process.env.DEEPDRAW_APP_KEY;
  delete process.env.DEEPDRAW_APP_SECRET;
  delete process.env.DEEPDRAW_DOP_KEY;
  delete process.env.DEEPDRAW_MERCHANT_ID;

  try {
    assert.deepEqual(resolveDeepdrawConfig({ projectRoot: process.cwd() }), {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
      tenantName: "电商巴拉巴拉",
      credentialSource: "env:DEEPDRAW_TENANT_CREDENTIALS_JSON",
    });
    assert.equal(
      resolveDeepdrawConfig({
        projectRoot: process.cwd(),
        tenantName: "迷你巴拉",
      }).merchantId,
      "1527",
    );
  } finally {
    if (previousJson === undefined) delete process.env.DEEPDRAW_TENANT_CREDENTIALS_JSON;
    else process.env.DEEPDRAW_TENANT_CREDENTIALS_JSON = previousJson;
    if (previousTenant === undefined) delete process.env.DEEPDRAW_TENANT_NAME;
    else process.env.DEEPDRAW_TENANT_NAME = previousTenant;
    if (previousBaseUrl === undefined) delete process.env.DEEPDRAW_BASE_URL;
    else process.env.DEEPDRAW_BASE_URL = previousBaseUrl;
    if (previousAppKey === undefined) delete process.env.DEEPDRAW_APP_KEY;
    else process.env.DEEPDRAW_APP_KEY = previousAppKey;
    if (previousAppSecret === undefined) delete process.env.DEEPDRAW_APP_SECRET;
    else process.env.DEEPDRAW_APP_SECRET = previousAppSecret;
    if (previousDopKey === undefined) delete process.env.DEEPDRAW_DOP_KEY;
    else process.env.DEEPDRAW_DOP_KEY = previousDopKey;
    if (previousMerchantId === undefined) delete process.env.DEEPDRAW_MERCHANT_ID;
    else process.env.DEEPDRAW_MERCHANT_ID = previousMerchantId;
  }
});
