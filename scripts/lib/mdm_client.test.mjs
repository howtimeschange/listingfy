import assert from "node:assert/strict";
import test from "node:test";
import {
  clearMdmTokenCache,
  getMdmToken,
  queryMdmProduct,
} from "./mdm_client.mjs";

test("getMdmToken reuses a cached token for the same MDM credential", async () => {
  clearMdmTokenCache();
  const urls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({
      code: "ok",
      token: `token-${urls.length}`,
      expires_in: 3600000,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const config = {
      baseUrl: "https://mdm.semirapp.com",
      appId: "app-id",
      appKey: "app-key",
    };
    const first = await getMdmToken({ config });
    const second = await getMdmToken({ config });

    assert.equal(first.token, "token-1");
    assert.equal(second.token, "token-1");
    assert.equal(urls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearMdmTokenCache();
  }
});

test("queryMdmProduct rejects a response that exceeds the configured page ceiling", async () => {
  clearMdmTokenCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/getToken")) {
      return new Response(JSON.stringify({ RESULT: "S", token: "page-limit-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      RESULT: "S",
      PAGE: body.PAGE,
      LAST_PAGE: 3,
      DATA: [{ MDM_CODE: "208226102001", PAGE: body.PAGE }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(
      queryMdmProduct({
        config: {
          baseUrl: "https://mdm.example.test",
          appId: "app-id",
          appKey: "app-key",
        },
        spuCode: "208226102001",
        maxPages: 2,
      }),
      /page limit.*2|超过.*2.*页/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearMdmTokenCache();
  }
});
