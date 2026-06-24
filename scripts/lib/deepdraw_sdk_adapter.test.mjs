import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildDeepdrawSdkClasspath,
  buildDeepdrawSdkProductInput,
  createDeepdrawProductWithSdk,
  getDeepdrawProductWithSdk,
  parseDeepdrawSdkOutput,
} from "./deepdraw_sdk_adapter.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

test("buildDeepdrawSdkProductInput maps Listingify payload into SDK product and SKU field shape", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105214",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 199,
      fields: [
        { name: "年份/季节", value: "2026年春季" },
        { name: "上市时间", value: "2026-03" },
      ],
      skus: [
        {
          skuCode: "208326105214110",
          color: "藏青",
          size: "110",
          barcode: "690001",
          sellerCode: "208326105214110",
          price: 199,
        },
        {
          skuCode: "208326105214120",
          color: "藏青",
          size: "120",
          barcode: "690002",
          sellerCode: "208326105214120",
          price: 199,
        },
      ],
    },
  });

  assert.equal(input.config.host, "http://open.deepdraw.cn");
  assert.equal(input.config.merchantId, "1162");
  assert.equal(input.config.tradeId, "12390");
  assert.equal(input.product.code, "208326105214");
  assert.equal(input.product.title, "儿童外套");
  assert.equal(input.product.retailPrice, "199");
  assert.equal(input.product.date, "2026-03-01");
  assert.equal(input.product.fields["颜色"], "藏青");
  assert.equal(input.product.fields["尺码"], "110cm;120cm");
  assert.equal(
    input.product.fields["商家SKU"].title,
    "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码",
  );
  assert.equal(
    input.product.fields["商家SKU"]["藏青"]["110cm"],
    "199,208326105214,2026-03-01,0,208326105214110,690001,199,199,208326105214110,690001",
  );
  assert.equal(Object.hasOwn(input.product.fields, "商家 SKU"), false);
});

test("buildDeepdrawSdkProductInput keeps color aliases and SKU bucket keys aligned with SDK checks", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105214",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 359,
      date: "2026-07-08",
      fields: [
        { name: "商家SKU", value: { title: "价格,货号", 蓝色调00388: { "080": "359,code" } } },
      ],
      skus: [
        {
          skuCode: "20832610521400388080",
          color: "蓝色调00388",
          size: "080",
          barcode: "6942749195637",
          sellerCode: "6942749195637",
          price: 359,
        },
      ],
    },
  });

  assert.equal(input.product.fields["颜色"], "蓝色,蓝色调00388");
  assert.equal(input.product.fields["尺码"], "80cm");
  assert.deepEqual(input.product.fields["商家SKU"], {
    title: "价格,货号",
    蓝色调00388: {
      "80cm": "359,code",
    },
  });
});

test("buildDeepdrawSdkProductInput normalizes size table keys to SDK size values", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105214",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 359,
      fields: [
        { name: "尺码表", value: { title: "身高,衣长,胸围,袖长", "080": "80,0,0,0" } },
      ],
      skus: [
        {
          skuCode: "20832610521400388080",
          color: "蓝色调00388",
          size: "080",
          barcode: "6942749195637",
          sellerCode: "6942749195637",
          price: 359,
        },
      ],
    },
  });

  assert.deepEqual(input.product.fields["尺码表"], {
    title: "身高,衣长,胸围,袖长",
    "80cm": "80,0,0,0",
  });
});

test("buildDeepdrawSdkClasspath includes vendored SDK jars and Maven runtime jars", () => {
  const classpath = buildDeepdrawSdkClasspath({ projectRoot: PROJECT_ROOT });

  assert.ok(classpath.entries.some((entry) => entry.endsWith("vendor/deepdraw-sdk/dop-sdk-1.6.0.jar")));
  assert.ok(classpath.entries.some((entry) => entry.endsWith("vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar")));
  assert.ok(classpath.entries.some((entry) => entry.includes("fastjson")));
  assert.ok(classpath.entries.some((entry) => entry.includes("httpclient")));
  assert.ok(classpath.entries.some((entry) => entry.includes("commons-collections/commons-collections")));
  assert.ok(classpath.value.includes(path.delimiter));
});

test("parseDeepdrawSdkOutput normalizes Java CLI JSON into DeepDraw result shape", () => {
  const result = parseDeepdrawSdkOutput(`
sdk log line
{"status":200,"response":{"code":10200,"reason":"访问成功！","response":"success","requestId":1066,"body":{"productId":7788}}}
`);

  assert.equal(result.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.requestId, "1066");
  assert.deepEqual(result.payload, {
    status: 200,
    response: {
      code: 10200,
      reason: "访问成功！",
      response: "success",
      requestId: 1066,
      body: { productId: 7788 },
    },
  });
});

test("createDeepdrawProductWithSdk delegates mapped SDK input to runner", async () => {
  const seen = [];
  const result = await createDeepdrawProductWithSdk({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105214",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 199,
      fields: [],
      skus: [],
    },
    runner: async (input) => {
      seen.push(input);
      return JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          requestId: 8899,
          body: { productId: 7788 },
        },
      });
    },
  });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].product.code, "208326105214");
  assert.equal(result.ok, true);
  assert.equal(result.requestId, "8899");
});

test("getDeepdrawProductWithSdk delegates product resource reads to the Java SDK runner", async () => {
  const seen = [];
  const result = await getDeepdrawProductWithSdk({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productCode: "208326105214",
    runner: async (input) => {
      seen.push(input);
      return JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          requestId: 9901,
          body: { productId: 7788, code: "208326105214" },
        },
      });
    },
  });

  assert.deepEqual(seen, [{
    config: {
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      host: "http://open.deepdraw.cn",
      merchantId: "1162",
    },
    query: {
      productCode: "208326105214",
      resource: "form",
    },
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.requestId, "9901");
});
