import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildDeepdrawSdkClasspath,
  buildDeepdrawProductFullUpdateInput,
  buildDeepdrawSdkProductInput,
  compareDeepdrawProductPayloadToResource,
  compareDeepdrawLegacyShoePayloadToResource,
  createDeepdrawProductWithSdk,
  deepdrawLegacyShoePostCreateUpdateRequired,
  getDeepdrawProductWithSdk,
  parseDeepdrawSdkOutput,
  runDeepdrawSdkCli,
  selectDeepdrawLegacyShoeCreateFields,
  selectDeepdrawLegacyShoeUpdateFields,
  updateDeepdrawFullProductWithSdk,
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
    "199,208326105214,2026-03,0,208326105214110,690001,199,199,208326105214110,690001",
  );
  assert.equal(Object.hasOwn(input.product.fields, "商家 SKU"), false);
});

test("buildDeepdrawSdkProductInput encodes documented location and after-sales commitment values", () => {
  const build = (commitment) => buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "204426140121-test4",
      title: "童鞋字段编码探针",
      tradeId: "546",
      fields: [
        { name: "所在地", value: "浙江杭州" },
        { name: "售后服务承诺", value: commitment },
      ],
    },
  }).product.fields;

  assert.equal(build("延保90天")["所在地"], "浙江,杭州");
  assert.equal(build("延保90天")["售后服务承诺"], "2_90");
  assert.equal(build("不设置")["售后服务承诺"], "0");
  assert.equal(build("寄修;五年")["售后服务承诺"], "1_1825");
  assert.equal(build("2_180")["售后服务承诺"], "2_180");
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

test("buildDeepdrawSdkProductInput normalizes existing merchant SKU launch dates to month text", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208426140203",
      title: "儿童户外鞋",
      tradeId: "16608",
      retailPrice: 359,
      shoeSizes: true,
      fields: [
        { name: "尺码", value: "26码" },
        {
          name: "商家SKU",
          value: {
            title: "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价",
            黑色调00399: {
              "26码": "359,208426140203,2026-09-02,0,6914678080209,6914678080209,359,359",
            },
          },
        },
      ],
      skus: [
        {
          skuCode: "2084261402030039926",
          color: "黑色调00399",
          size: "26",
          barcode: "6914678080209",
          sellerCode: "6914678080209",
          price: 359,
        },
      ],
    },
  });

  assert.equal(
    input.product.fields["商家SKU"]["黑色调00399"]["26"],
    "359,208426140203,2026-09,0,6914678080209,6914678080209,359,359",
  );
});

test("buildDeepdrawSdkProductInput aligns structured size rows to selected unit-bearing size values", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "206426172201",
      title: "儿童袜子",
      tradeId: "336",
      retailPrice: 39.9,
      fields: [
        { name: "尺码", value: "100;120;140;160;170" },
        { name: "商家SKU", value: { title: "价格,货号", 蓝色调00388: { "100cm": "39.9,code", "120码": "39.9,code" } } },
        { name: "尺码表", fieldType: "MULTI_TEXT", value: { title: "身高", "100cm": "100", "120码": "120" } },
      ],
      skus: [
        {
          skuCode: "20642617220100388100",
          color: "蓝色调00388",
          size: "100",
          barcode: "6914678733341",
          sellerCode: "6914678733341",
          price: 39.9,
        },
      ],
    },
  });

  assert.equal(input.product.fields["尺码"], "100cm;120cm;140cm;160cm;170cm");
  assert.deepEqual(input.product.fields["商家SKU"], {
    title: "价格,货号",
    蓝色调00388: {
      "100cm": "39.9,code",
      "120cm": "39.9,code",
    },
  });
  assert.deepEqual(input.product.fields["尺码表"], {
    title: "身高",
    "100cm": "100",
    "120cm": "120",
  });
});

test("buildDeepdrawSdkProductInput generated merchant SKUs follow selected size values", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "206426172201",
      title: "儿童袜子",
      tradeId: "336",
      retailPrice: 39.9,
      fields: [
        { name: "尺码", value: "100;120" },
      ],
      skus: [
        {
          skuCode: "20642617220100388100",
          color: "蓝色调00388",
          size: "100",
          barcode: "6914678733341",
          sellerCode: "6914678733341",
          price: 39.9,
        },
      ],
    },
  });

  assert.equal(
    input.product.fields["商家SKU"]["蓝色调00388"]["100cm"],
    "39.9,206426172201,,0,6914678733341,6914678733341,39.9,39.9,20642617220100388100,6914678733341",
  );
  assert.equal(Object.hasOwn(input.product.fields["商家SKU"]["蓝色调00388"], "100"), false);
});

test("buildDeepdrawSdkProductInput adds missing units without duplicating existing sale-size units", () => {
  const config = {
    baseUrl: "http://open.deepdraw.cn",
    appKey: "app-key",
    appSecret: "app-secret",
    dopKey: "dop-key",
    merchantId: "1162",
  };
  const shoeInput = buildDeepdrawSdkProductInput({
    config,
    payload: {
      code: "204426140121-unit-compat",
      title: "童鞋单位兼容",
      tradeId: "546",
      shoeSizes: true,
      fields: [{ name: "尺码", value: "26码;27" }],
      skus: [{ color: "黑色", size: "26码" }, { color: "黑色", size: "27" }],
    },
  });
  const apparelInput = buildDeepdrawSdkProductInput({
    config,
    payload: {
      code: "208326105214-unit-compat",
      title: "童装单位兼容",
      tradeId: "12390",
      fields: [{ name: "尺码", value: "80cm;90" }],
      skus: [{ color: "藏青", size: "80cm" }, { color: "藏青", size: "90" }],
    },
  });

  assert.equal(shoeInput.product.fields["尺码"], "26;27");
  assert.deepEqual(Object.keys(shoeInput.product.fields["商家SKU"]["黑色"]).sort(), ["26", "27"]);
  assert.equal(apparelInput.product.fields["尺码"], "80cm;90cm");
  assert.deepEqual(Object.keys(apparelInput.product.fields["商家SKU"]["藏青"]).sort(), ["80cm", "90cm"]);
});

test("buildDeepdrawSdkProductInput maps khaki business color names to DeepDraw standard color aliases", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105206",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 299,
      date: "2026-07-15",
      fields: [],
      skus: [
        {
          skuCode: "20832610520650230080",
          color: "贝壳卡50230",
          size: "080",
          barcode: "6942749195392",
          sellerCode: "6942749195392",
          price: 299,
        },
      ],
    },
  });

  assert.equal(input.product.fields["颜色"], "卡其,贝壳卡50230");
  assert.equal(input.product.fields["商家SKU"]["贝壳卡50230"]["80cm"], "299,208326105206,2026-07,0,6942749195392,6942749195392,299,299,20832610520650230080,6942749195392");
});

test("buildDeepdrawSdkProductInput merges SKU color aliases into existing draft color fields", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105206",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 299,
      date: "2026-07-15",
      fields: [
        { name: "颜色", value: "粉红,梦幻粉60335" },
      ],
      skus: [
        {
          skuCode: "20832610520650230080",
          color: "贝壳卡50230",
          size: "080",
          barcode: "6942749195392",
          sellerCode: "6942749195392",
          price: 299,
        },
      ],
    },
  });

  assert.equal(input.product.fields["颜色"], "粉红,梦幻粉60335;卡其,贝壳卡50230");
});

test("buildDeepdrawSdkProductInput keeps template color aliases instead of appending an unmapped SKU color", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "201426108002",
      title: "儿童裤子",
      tradeId: "72",
      fields: [
        { name: "颜色", value: "扩展选项,浅驼50002;扩展选项,胡桃棕51006" },
      ],
      skus: [
        { skuCode: "20142610800250002080", color: "浅驼50002", size: "080" },
        { skuCode: "20142610800251006080", color: "胡桃棕51006", size: "080" },
      ],
    },
  });

  assert.equal(input.product.fields["颜色"], "扩展选项,浅驼50002;扩展选项,胡桃棕51006");
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

test("buildDeepdrawSdkProductInput omits empty optional fields for blank-value upload probes", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "PROBE-EMPTY-FIELDS",
      title: "空字段探测",
      tradeId: "12390",
      retailPrice: 199,
      fields: [
        { name: "商品描述", value: "" },
        { name: "图案(多选)", value: {} },
        { name: "商品详情", value: "推荐理由" },
      ],
      skus: [],
    },
  });

  assert.equal(Object.hasOwn(input.product.fields, "商品描述"), false);
  assert.equal(Object.hasOwn(input.product.fields, "图案(多选)"), false);
  assert.equal(input.product.fields["商品详情"], "推荐理由");
});

test("buildDeepdrawSdkProductInput omits unsupported scalar size payload fields", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "208326105206",
      title: "儿童外套",
      tradeId: "12390",
      retailPrice: 299,
      fields: [
        { name: "多平台尺码", value: "得物" },
        { name: "抖音尺码表", value: "只需要填身高体重" },
        { name: "22Q4-童鞋尺码表", fieldType: "SINGLE_CHOICE", value: "篮球鞋" },
        { name: "适用季节", value: "春秋" },
      ],
      skus: [],
    },
  });

  assert.equal(Object.hasOwn(input.product.fields, "多平台尺码"), false);
  assert.equal(Object.hasOwn(input.product.fields, "抖音尺码表"), false);
  assert.equal(input.product.fields["22Q4-童鞋尺码表"], "篮球鞋");
  assert.equal(input.product.fields["适用季节"], "春秋");
});

test("buildDeepdrawSdkClasspath includes vendored SDK jars and Maven runtime jars", () => {
  const classpath = buildDeepdrawSdkClasspath({ projectRoot: PROJECT_ROOT });

  assert.ok(classpath.entries.some((entry) => entry.endsWith("vendor/deepdraw-sdk/dop-sdk-1.6.24.jar")));
  assert.ok(classpath.entries.some((entry) => entry.endsWith("vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar")));
  assert.ok(classpath.entries.some((entry) => entry.includes("fastjson")));
  assert.ok(classpath.entries.some((entry) => entry.includes("httpclient")));
  assert.ok(classpath.entries.some((entry) => entry.includes("commons-collections/commons-collections")));
  assert.ok(classpath.value.includes(path.delimiter));
});

test("buildDeepdrawSdkClasspath honors DEEPDRAW_M2_REPOSITORY for Maven runtime jars", async () => {
  const previous = process.env.DEEPDRAW_M2_REPOSITORY;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "listingify-deepdraw-m2-"));
  const jarDir = path.join(tempDir, "com/alibaba/fastjson/1.2.76");
  const jarPath = path.join(jarDir, "fastjson-1.2.76.jar");
  await mkdir(jarDir, { recursive: true });
  await writeFile(jarPath, "");

  try {
    process.env.DEEPDRAW_M2_REPOSITORY = tempDir;
    const classpath = buildDeepdrawSdkClasspath({
      projectRoot: PROJECT_ROOT,
      buildDir: path.join(tempDir, "classes"),
    });

    assert.ok(classpath.entries.includes(jarPath));
    assert.ok(classpath.missing.includes("commons-logging/commons-logging/1.2/commons-logging-1.2.jar"));
  } finally {
    if (previous === undefined) delete process.env.DEEPDRAW_M2_REPOSITORY;
    else process.env.DEEPDRAW_M2_REPOSITORY = previous;
    await rm(tempDir, { recursive: true, force: true });
  }
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

test("runDeepdrawSdkCli forces UTF-8 Java stdout so DeepDraw Chinese reasons stay readable", async () => {
  const previousJava = process.env.DEEPDRAW_JAVA_BIN;
  const previousArgsFile = process.env.DEEPDRAW_FAKE_JAVA_ARGS;
  const previousStdinFile = process.env.DEEPDRAW_FAKE_JAVA_STDIN;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "listingify-deepdraw-java-"));
  const sourceFile = path.join(tempDir, "FakeDeepdrawCli.java");
  const classDir = path.join(tempDir, "tmp/deepdraw-sdk-adapter/classes");
  const classFile = path.join(classDir, "FakeDeepdrawCli.class");
  const fakeJava = path.join(tempDir, "java");
  const argsFile = path.join(tempDir, "args.txt");
  const stdinFile = path.join(tempDir, "stdin.json");

  try {
    await mkdir(classDir, { recursive: true });
    await writeFile(sourceFile, "public class FakeDeepdrawCli {}\n");
    await writeFile(classFile, "");
    await writeFile(fakeJava, [
      "#!/usr/bin/env bash",
      "printf '%s\\n' \"$@\" > \"$DEEPDRAW_FAKE_JAVA_ARGS\"",
      "cat > \"$DEEPDRAW_FAKE_JAVA_STDIN\"",
      "printf '%s\\n' '{\"status\":200,\"response\":{\"code\":10200,\"reason\":\"访问成功！\",\"response\":\"success\"}}'",
      "",
    ].join("\n"));
    await chmod(fakeJava, 0o755);

    process.env.DEEPDRAW_JAVA_BIN = fakeJava;
    process.env.DEEPDRAW_FAKE_JAVA_ARGS = argsFile;
    process.env.DEEPDRAW_FAKE_JAVA_STDIN = stdinFile;

    const output = await runDeepdrawSdkCli({ hello: "世界" }, {
      projectRoot: tempDir,
      sourceFile,
      className: "FakeDeepdrawCli",
    });
    const args = await readFile(argsFile, "utf8");
    const stdin = await readFile(stdinFile, "utf8");

    assert.match(output, /访问成功/);
    assert.match(args, /-Dfile\.encoding=UTF-8/);
    assert.match(args, /-Dsun\.stdout\.encoding=UTF-8/);
    assert.match(args, /-Dsun\.stderr\.encoding=UTF-8/);
    assert.match(stdin, /"hello":"世界"/);
  } finally {
    if (previousJava === undefined) delete process.env.DEEPDRAW_JAVA_BIN;
    else process.env.DEEPDRAW_JAVA_BIN = previousJava;
    if (previousArgsFile === undefined) delete process.env.DEEPDRAW_FAKE_JAVA_ARGS;
    else process.env.DEEPDRAW_FAKE_JAVA_ARGS = previousArgsFile;
    if (previousStdinFile === undefined) delete process.env.DEEPDRAW_FAKE_JAVA_STDIN;
    else process.env.DEEPDRAW_FAKE_JAVA_STDIN = previousStdinFile;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runDeepdrawSdkCli returns control without blocking the Node event loop", async () => {
  const previousJava = process.env.DEEPDRAW_JAVA_BIN;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "listingify-deepdraw-async-"));
  const sourceFile = path.join(tempDir, "FakeAsyncCli.java");
  const classDir = path.join(tempDir, "tmp/deepdraw-sdk-adapter/classes");
  const classFile = path.join(classDir, "FakeAsyncCli.class");
  const fakeJava = path.join(tempDir, "java");

  try {
    await mkdir(classDir, { recursive: true });
    await writeFile(sourceFile, "public class FakeAsyncCli {}\n");
    await writeFile(classFile, "");
    await writeFile(fakeJava, [
      "#!/usr/bin/env bash",
      "sleep 0.2",
      "printf '%s\\n' '{\"status\":200,\"response\":{\"code\":10200,\"response\":\"success\"}}'",
      "",
    ].join("\n"));
    await chmod(fakeJava, 0o755);
    process.env.DEEPDRAW_JAVA_BIN = fakeJava;

    const startedAt = Date.now();
    const operation = runDeepdrawSdkCli({ hello: "async" }, {
      projectRoot: tempDir,
      sourceFile,
      className: "FakeAsyncCli",
      timeoutMs: 1000,
    });
    assert.ok(Date.now() - startedAt < 80, "Java process launch must not block the calling thread");
    assert.match(await operation, /\"status\":200/);
  } finally {
    if (previousJava === undefined) delete process.env.DEEPDRAW_JAVA_BIN;
    else process.env.DEEPDRAW_JAVA_BIN = previousJava;
    await rm(tempDir, { recursive: true, force: true });
  }
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

test("buildDeepdrawProductFullUpdateInput keeps shoe size enum values and includes supported multi-platform tables", () => {
  const input = buildDeepdrawProductFullUpdateInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productId: "6509967",
    payload: {
      code: "208426140203",
      title: "儿童户外鞋",
      retailPrice: 359,
      date: "2026-09-02",
      shoeSizes: true,
      sizeRemarks: { "26": "脚长15.8-16.2/内长17" },
      places: "1688、天猫、京东、唯品会、有赞、拼多多、小红书、抖音、快手、微信视频小店",
      fields: [{ name: "尺码", value: "26码" }],
      legacyUpdateFields: [
        { name: "尺码", value: "26码" },
        { name: "尺码表", fieldType: "MULTI_TEXT", value: { title: "适合脚长,鞋内长", "26码": "16,17" } },
        { name: "唯品会尺码表", fieldType: "MULTI_TEXT", value: { title: "欧洲码,脚长,鞋内长", "26码": "26码,160,170.32" } },
        { name: "天猫尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长,鞋内长", "26码": "16,17" } },
        { name: "抖音尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长(cm),备注", "26码": "16,脚长15.8-16.2/内长17" } },
        {
          name: "多平台尺码",
          fieldType: "MULTI_TEXT",
          value: {
            title: "京东,拼多多,小红书,快手,微信视频小店",
            "26码": "26,26码(脚长15.8-16.2/内长17),26码,26码,26码(脚长15.8-16.2/内长17)",
          },
        },
        { name: "淘宝尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长", "26码": "15.8-16.2" } },
      ],
    },
  });

  assert.equal(input.productId, "6509967");
  assert.equal(input.product.code, "208426140203");
  assert.equal(input.product.date, "2026-09-02");
  assert.equal(input.product.fields["尺码"], "26");
  assert.deepEqual(input.product.fields["尺码表"], { title: "适合脚长,鞋内长", "26": "16,17" });
  assert.deepEqual(input.product.fields["唯品会尺码表"], { title: "欧洲码,脚长,鞋内长", "26": "26码,160,170.32" });
  assert.deepEqual(input.product.fields["天猫尺码表"], { title: "脚长,鞋内长", "26": "16,17" });
  assert.deepEqual(input.product.fields["抖音尺码表"], { title: "脚长(cm),备注", "26": "16,脚长15.8-16.2/内长17" });
  assert.deepEqual(input.product.fields["多平台尺码"], {
    title: "JD,PDD,WEIXINXIAODIAN",
    "26码": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
  });
  assert.equal(Object.hasOwn(input.product.fields, "淘宝尺码表"), false);
  assert.deepEqual(input.product.places, ["ALIBABA", "TMALL", "JD", "VIP", "YOUZAN", "PDD", "XIAOHONGSHU", "DOUYIN", "KUAISHOU", "WEIXINXIAODIAN"]);
});

test("buildDeepdrawSdkProductInput does not let unsupported shoe remarks change sale-size identity", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "204426140121-test4",
      title: "童鞋尺码备注创建探针",
      tradeId: "546",
      shoeSizes: true,
      sizeRemarks: {
        "26码": "(脚长15.8-16.2/内长17)",
        "27": "脚长16.3-16.7/内长17.7",
      },
      fields: [{ name: "尺码", value: "26;27" }],
    },
  });

  assert.equal(input.product.fields["尺码"], "26;27");
});

test("buildDeepdrawProductFullUpdateInput includes isolated supported multi-platform size updates", () => {
  const input = buildDeepdrawProductFullUpdateInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productId: "6509967",
    payload: {
      code: "208426140203",
      title: "儿童户外鞋",
      retailPrice: 359,
      date: "2026-09-02",
      shoeSizes: true,
      legacyUpdateFields: [
        { name: "尺码", value: "26码" },
        {
          name: "多平台尺码",
          fieldType: "MULTI_TEXT",
          value: {
            title: "京东,拼多多,小红书,微信视频小店",
            "26码": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
          },
        },
      ],
    },
  });

  assert.equal(input.product.fields["尺码"], "26");
  assert.deepEqual(input.product.fields["多平台尺码"], {
    title: "JD,PDD,WEIXINXIAODIAN",
    "26码": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
  });
});

test("buildDeepdrawSdkProductInput normalizes optional JD-only apparel multi-platform sizes", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      fields: [{
        name: "多平台尺码",
        fieldType: "MULTI_TEXT",
        value: {
          title: "京东,拼多多,小红书,微信视频小店",
          "130cm": "130cm,130cm,130cm,130cm",
          "140码": "140码,140码,140码,140码",
        },
      }],
    },
  });

  assert.deepEqual(input.product.fields["多平台尺码"], {
    title: "JD",
    "130cm": "130",
    "140cm": "140",
  });
});

test("buildDeepdrawSdkProductInput keeps shoe multi-platform rows display-sized with platform remarks", () => {
  const input = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      shoeSizes: true,
      fields: [
        { name: "尺码", value: "26码;27码" },
        {
          name: "多平台尺码",
          fieldType: "MULTI_TEXT",
          value: {
            title: "天猫,京东,拼多多,微信视频小店,小红书,快手",
            "26码": "26码,26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),26码,26码",
            "27码": "27码,27,27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7),27码,27码",
          },
        },
      ],
    },
  });

  assert.deepEqual(input.product.fields["多平台尺码"], {
    title: "JD,PDD,WEIXINXIAODIAN",
    "26码": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
    "27码": "27,27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7)",
  });
});

test("legacy v1 shoe publish creates with the main table then updates the remaining supported platform tables", () => {
  const fields = [
    { name: "尺码", value: "26码;27码" },
    { name: "尺码表", fieldType: "MULTI_TEXT", value: { title: "尺码,适合脚长,鞋内长", "26码": "26,16,17", "27码": "27,16.5,17.7" } },
    { name: "唯品会尺码表", fieldType: "MULTI_TEXT", value: { title: "中国码,脚长", "26码": "26码,16", "27码": "27码,16.5" } },
    { name: "天猫尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长", "26码": "16", "27码": "16.5" } },
    { name: "抖音尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长(cm),备注", "26码": "15.8-16.2,脚长15.8-16.2/内长17", "27码": "16.3-16.7,脚长16.3-16.7/内长17.7" } },
    {
      name: "多平台尺码",
      fieldType: "MULTI_TEXT",
      value: {
        title: "京东,拼多多,小红书,微信视频小店",
        "26码": "26,26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17),26码(脚长15.8-16.2/内长17)",
        "27码": "27,27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7),27码(脚长16.3-16.7/内长17.7)",
      },
    },
    { name: "淘宝尺码表", fieldType: "MULTI_TEXT", value: { title: "脚长", "26码": "16", "27码": "16.5" } },
  ];
  const legacyUpdateFields = selectDeepdrawLegacyShoeUpdateFields(fields);
  const createFields = selectDeepdrawLegacyShoeCreateFields(fields);
  assert.deepEqual(
    createFields.filter((field) => /尺码表|多平台尺码/.test(field.name)).map((field) => field.name),
    ["尺码表"],
  );
  assert.deepEqual(
    legacyUpdateFields.filter((field) => /尺码表|多平台尺码/.test(field.name)).map((field) => field.name),
    ["尺码表", "唯品会尺码表", "天猫尺码表", "抖音尺码表", "多平台尺码"],
  );
  assert.equal(deepdrawLegacyShoePostCreateUpdateRequired(createFields, legacyUpdateFields), true);

  const createInput = buildDeepdrawSdkProductInput({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    payload: {
      code: "204426140121-create-probe",
      title: "童鞋创建探针",
      tradeId: "546",
      shoeSizes: true,
      fields: createFields,
    },
  });
  assert.equal(createInput.product.fields["尺码"], "26;27");
  assert.deepEqual(createInput.product.fields["尺码表"], {
    title: "尺码,适合脚长,鞋内长",
    "26": "26,16,17",
    "27": "27,16.5,17.7",
  });
  assert.equal(Object.hasOwn(createInput.product.fields, "多平台尺码"), false);

  const payload = {
    shoeSizes: true,
    fields: fields.slice(0, 2),
    legacyUpdateFields,
    skus: [
      { color: "黑紫色调00397", size: "26码" },
      { color: "黑紫色调00397", size: "27码" },
    ],
  };
  const resourceBody = {
    colors: { optionAliases: { 紫色: "黑紫色调00397" } },
    sizes: { options: ["26", "27"] },
    skus: { skuItems: [{ color: "紫色", size: "26" }, { color: "紫色", size: "27" }] },
    sizeTables: legacyUpdateFields
      .filter((field) => /尺码表|多平台尺码/.test(field.name))
      .map((field) => ({
        field: { name: field.name },
        sizeTableItems: Object.entries(field.value)
          .filter(([size]) => size !== "title")
          .map(([size, value]) => ({
            size,
            values: Object.fromEntries((field.name === "多平台尺码"
              ? "JD,PDD,XIAOHONGSHU,WEIXINXIAODIAN"
              : field.value.title
            ).split(",").map((column, index) => [
              field.name === "尺码表" && column === "尺码" ? "鞋长" : column,
              value.split(",")[index],
            ])),
          })),
      })),
  };

  const match = compareDeepdrawLegacyShoePayloadToResource({ payload, resourceBody });
  assert.equal(match.ok, true);
  assert.deepEqual(match.sections.map((section) => [section.name, section.ok, section.actualCount]), [
    ["尺码", true, 2],
    ["商家SKU", true, 2],
    ["尺码表", true, 2],
    ["唯品会尺码表", true, 2],
    ["天猫尺码表", true, 2],
    ["抖音尺码表", true, 2],
    ["多平台尺码", true, 2],
  ]);

  resourceBody.sizeTables.find((table) => table.field.name === "天猫尺码表").sizeTableItems.pop();
  const mismatch = compareDeepdrawLegacyShoePayloadToResource({ payload, resourceBody });
  assert.equal(mismatch.ok, false);
  assert.deepEqual(mismatch.sections.find((section) => section.name === "天猫尺码表").missingSizes, ["27"]);

  resourceBody.skus.skuItems.pop();
  const skuMismatch = compareDeepdrawLegacyShoePayloadToResource({ payload, resourceBody });
  assert.deepEqual(
    skuMismatch.sections.find((section) => section.name === "商家SKU").missingSkus,
    ['["紫色","27"]'],
  );
  assert.doesNotMatch(JSON.stringify(skuMismatch), /\\u0000/);
});

test("compareDeepdrawProductPayloadToResource checks apparel sale sizes skus and sent size tables", () => {
  const payload = {
    fields: [
      { name: "尺码", value: "130cm;140cm" },
      {
        name: "尺码表",
        fieldType: "MULTI_TEXT",
        value: {
          title: "尺码,身高,胸围",
          "130cm": "130,130,70",
          "140cm": "140,140,74",
        },
      },
      {
        name: "唯品会尺码表",
        fieldType: "MULTI_TEXT",
        value: {
          title: "号型,身高,胸围",
          "130cm": "130/64,130,70",
          "140cm": "140/68,140,74",
        },
      },
    ],
    skus: [
      { color: "红色", size: "130", skuCode: "sku-130" },
      { color: "红色", size: "140cm", skuCode: "sku-140" },
    ],
  };
  const resourceBody = {
    sizes: { options: ["130cm", "140cm"] },
    colors: { optionAliases: { "红色": "红色" } },
    skus: {
      skuItems: [
        { color: "红色", size: "130cm" },
        { color: "红色", size: "140cm" },
      ],
    },
    sizeTables: [
      {
        field: { name: "尺码表" },
        sizeTableItems: [
          { size: "130cm", values: { "尺码": "130", "身高": "130", "胸围": "70" } },
          { size: "140cm", values: { "尺码": "140", "身高": "140", "胸围": "74" } },
        ],
      },
      {
        field: { name: "唯品会尺码表" },
        sizeTableItems: [
          { size: "130cm", values: { "号型": "130/64", "身高": "130", "胸围": "70" } },
          { size: "140cm", values: { "号型": "140/68", "身高": "140", "胸围": "74" } },
        ],
      },
    ],
  };

  const match = compareDeepdrawProductPayloadToResource({ payload, resourceBody });
  assert.equal(match.ok, true);
  assert.deepEqual(match.sections.map((section) => [section.name, section.ok, section.actualCount]), [
    ["尺码", true, 2],
    ["商家SKU", true, 2],
    ["尺码表", true, 2],
    ["唯品会尺码表", true, 2],
  ]);

  resourceBody.sizeTables[0].sizeTableItems[1].values["胸围"] = "0";
  const mismatch = compareDeepdrawProductPayloadToResource({ payload, resourceBody });
  assert.equal(mismatch.ok, false);
  assert.deepEqual(mismatch.sections.find((section) => section.name === "尺码表").mismatchedCells, [
    { size: "140cm", column: "胸围", expected: "74", actual: "0" },
  ]);
});

test("updateDeepdrawFullProductWithSdk delegates the numeric product id to the v1 adapter", async () => {
  const seen = [];
  const result = await updateDeepdrawFullProductWithSdk({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productId: "6509967",
    payload: {
      code: "208426140203",
      title: "儿童户外鞋",
      retailPrice: 359,
      shoeSizes: true,
      legacyUpdateFields: [{ name: "尺码", value: "26" }],
    },
    runner: async (input) => {
      seen.push(input);
      return JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          requestId: 9904,
          body: { productId: 6509967 },
        },
      });
    },
  });

  assert.equal(seen[0].productId, "6509967");
  assert.equal(seen[0].product.fields["尺码"], "26");
  assert.equal(result.ok, true);
  await assert.rejects(
    updateDeepdrawFullProductWithSdk({ productId: "internal-id", runner: async () => "" }),
    /numeric productId/,
  );
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
    },
  }]);
  assert.equal(result.ok, true);
  assert.equal(result.requestId, "9901");
});

test("getDeepdrawProductWithSdk preserves an explicit resource filter", async () => {
  const seen = [];
  await getDeepdrawProductWithSdk({
    config: {
      baseUrl: "http://open.deepdraw.cn",
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      merchantId: "1162",
    },
    productCode: "208326105214",
    resource: "form",
    runner: async (input) => {
      seen.push(input);
      return JSON.stringify({
        status: 200,
        response: {
          code: 10200,
          response: "success",
          body: { productId: 7788 },
        },
      });
    },
  });

  assert.equal(seen[0].query.resource, "form");
});
