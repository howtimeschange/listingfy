import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

const types = await import("../../web/server/platform-adapters/types.ts");
const registry = await import("../../web/server/platform-adapters/index.ts");
const shein = await import("../../web/server/platform-adapters/shein.ts");

test("platform adapter registry resolves the SHEIN adapter by platform key", () => {
  const adapter = registry.platformAdapterFor("shein");
  assert.equal(adapter.platform, "SHEIN");
  assert.equal(adapter, shein.sheinAdapter);
});

test("SHEIN adapter exposes platform publish and image operations behind one interface", () => {
  const adapter = shein.sheinAdapter;
  assert.equal(adapter.platform, "SHEIN");
  assert.equal(typeof adapter.uploadAsset, "function");
  assert.equal(typeof adapter.transformAsset, "function");
  assert.equal(typeof adapter.publishListing, "function");
  assert.equal(typeof adapter.addVariantsToListing, "function");
  assert.equal(typeof adapter.checkEditPermission, "function");
  assert.equal(typeof adapter.partialEditListing, "function");
  assert.equal(typeof adapter.updateCost, "function");
  assert.equal(typeof adapter.queryStoreSites, "function");
  assert.equal(typeof adapter.queryProductList, "function");
  assert.equal(typeof adapter.queryProductDetail, "function");
  assert.equal(typeof adapter.queryDocumentState, "function");
  assert.equal(typeof adapter.searchProducts, "function");
  assert.equal(typeof adapter.revokeProduct, "function");
  assert.equal(typeof adapter.queryNumberList, "function");
  assert.equal(typeof adapter.checkSupplierSkuRepeated, "function");
  assert.equal(typeof adapter.batchSkcSize, "function");
  assert.equal(typeof adapter.printBarcode, "function");
  assert.equal(typeof adapter.queryChangePriceReason, "function");
  assert.equal(typeof adapter.syncPublishStatus, "function");
  assert.deepEqual(Object.keys(types.PLATFORM_ADAPTER_CAPABILITIES).sort(), [
    "addVariantsToListing",
    "batchSkcSize",
    "buildPublishPayload",
    "checkEditPermission",
    "checkSupplierSkuRepeated",
    "fetchAttributeTemplate",
    "fetchCategoryTree",
    "partialEditListing",
    "printBarcode",
    "publishListing",
    "queryChangePriceReason",
    "queryProductDetail",
    "queryProductList",
    "queryDocumentState",
    "queryNumberList",
    "queryStoreSites",
    "revokeProduct",
    "searchProducts",
    "syncPublishStatus",
    "transformAsset",
    "updateCost",
    "uploadAsset",
  ].sort());
});

test("pre-publish route delegates platform publish calls to PlatformAdapter", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /platformAdapterFor/);
  assert.doesNotMatch(source, /requestSheinWithCredentialsAndRetry\("\/open-api\/goods\/product\/publishOrEdit"/);
});

test("SHEIN lifecycle routes expose prioritized product management operations", async () => {
  const [server, route] = await Promise.all([
    readFile(path.join(PROJECT_ROOT, "web/server/index.ts"), "utf8"),
    readFile(path.join(PROJECT_ROOT, "web/server/routes/shein-lifecycle.ts"), "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/shein-lifecycle",\s*sheinLifecycle\)/);
  assert.match(route, /queryStoreSites/);
  assert.match(route, /queryProductDetail/);
  assert.match(route, /partialEditListing/);
  assert.match(route, /addVariantsToListing/);
  assert.match(route, /updateCost/);
  assert.match(route, /requirePermission\(c,\s*"LISTING_READ"\)/);
  assert.match(route, /requirePermission\(c,\s*"PUBLISH_RUN"\)/);
});

test("SHEIN lifecycle adapter methods call the documented OpenAPI paths with credentials", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ code: "0", msg: "OK", info: { success: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const credentials = {
      source: "environment",
      platformIntegrationId: null,
      baseUrl: "https://openapi.example.test",
      language: "zh-cn",
      openKeyId: "open-key",
      secretKey: "secret-key",
    };
    await shein.sheinAdapter.queryStoreSites({ credentials });
    await shein.sheinAdapter.queryProductList({ credentials, payload: { pageNum: 1, pageSize: 50 } });
    await shein.sheinAdapter.queryProductDetail({ credentials, payload: { spuName: "s250805261495" } });
    await shein.sheinAdapter.queryDocumentState({ credentials, payload: { spuList: [{ spuName: "s250805261495" }] } });
    await shein.sheinAdapter.searchProducts({ credentials, payload: { keyword: "dress" } });
    await shein.sheinAdapter.checkEditPermission({ credentials, payload: { spuName: "s250805261495" } });
    await shein.sheinAdapter.partialEditListing({ credentials, payload: { spuName: "s250805261495" } });
    await shein.sheinAdapter.updateCost({
      credentials,
      payload: {
        spu_name: "s250805261495",
        skc_info_list: [
          {
            skc_name: "ss25080526149593844",
            sku_info_list: [{ sku_code: "I0synkixnved", cost: "10.55", currency: "CNY" }],
          },
        ],
      },
    });
    await shein.sheinAdapter.addVariantsToListing({ credentials, payload: { spu_name: "s250805261495", skc_list: [] } });
    await shein.sheinAdapter.revokeProduct({ credentials, payload: { spuName: "s250805261495" } });
    await shein.sheinAdapter.queryNumberList({ credentials, payload: { page: 1, per_page: 100, type: 1 } });
    await shein.sheinAdapter.checkSupplierSkuRepeated({ credentials, payload: { supplierSkuList: ["SUP-1"] } });
    await shein.sheinAdapter.batchSkcSize({ credentials, payload: { data: ["BARCODE-1"] } });
    await shein.sheinAdapter.printBarcode({
      credentials,
      payload: { data: [{ orderNo: "PO-1", supplierSku: null, printNumber: 1, sheinSku: "I0synkixnved" }] },
    });
    await shein.sheinAdapter.queryChangePriceReason({ credentials });

    assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
      "/open-api/goods/query-site-list",
      "/open-api/openapi-business-backend/product/query",
      "/open-api/goods/spu-info",
      "/open-api/goods/query-document-state",
      "/open-api/goods/searchProduct",
      "/open-api/goods/product/check-edit-permission",
      "/open-api/goods/product/partialEdit",
      "/open-api/goods/update-cost",
      "/open-api/goods/product/publishOrEdit",
      "/open-api/goods/revoke-product",
      "/open-api/goods/number-list",
      "/open-api/goods/product/check-supplierSku-repeated",
      "/open-api/goods/batch-skc-size",
      "/open-api/goods/print-barcode",
      "/open-api/goods/query-change-price-reason",
    ]);
    assert.equal(new URL(calls[10].url).searchParams.get("page"), "1");
    assert.equal(new URL(calls[10].url).searchParams.get("per_page"), "100");
    assert.equal(new URL(calls[10].url).searchParams.get("type"), "1");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["x-lt-openKeyId"], "open-key");
    assert.equal(calls[0].options.headers.language, "zh-cn");
    assert.equal(calls[0].options.body, "{}");
    assert.deepEqual(JSON.parse(calls[7].options.body), {
      spu_name: "s250805261495",
      skc_info_list: [
        {
          skc_name: "ss25080526149593844",
          sku_info_list: [{ sku_code: "I0synkixnved", cost: "10.55", currency: "CNY" }],
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
