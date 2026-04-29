import assert from "node:assert/strict";
import test from "node:test";
import {
  clearMdmTokenCache,
  getMdmToken,
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
