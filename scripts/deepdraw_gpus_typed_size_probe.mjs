#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/local_env.mjs";
import {
  updateDeepdrawGpusProductIncrementallyWithSdk,
} from "./lib/deepdraw_sdk_adapter.mjs";
import {
  DEFAULT_DEEPDRAW_BASE_URL,
  DEFAULT_DEEPDRAW_TENANT_NAME,
  deepdrawBusinessResult,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
} from "./lib/deepdraw_client.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
loadLocalEnv({ cwd: projectRoot });

const SHOE_SIZES = [
  ["11623", "26"],
  ["11624", "27"],
  ["11625", "28"],
  ["11626", "29"],
  ["11627", "30"],
  ["11628", "31"],
  ["11629", "32"],
  ["11630", "33"],
  ["11631", "34"],
  ["11632", "35"],
  ["11633", "36"],
  ["11634", "37"],
  ["11635", "38"],
  ["11636", "39"],
  ["11637", "40"],
];
const SHOE_PLATFORM_IDS = new Map([
  ["京东", "188799"],
  ["拼多多", "201404"],
  ["微信视频小店", "202942"],
]);
const SHOE_FOOT_RANGES = [
  "15.8-16.2",
  "16.3-16.7",
  "16.8-17.2",
  "17.8-18.2",
  "18.3-18.7",
  "18.8-19.2",
  "19.8-20.2",
  "20.3-20.7",
  "20.8-21.2",
  "21.8-22.2",
  "22.3-22.7",
  "22.8-23.2",
  "23.8-24.2",
  "24.3-24.7",
  "24.8-25.2",
];
const SHOE_INNER_LENGTHS = [
  "17",
  "17.7",
  "18.4",
  "19",
  "19.7",
  "20.4",
  "21",
  "21.7",
  "22.4",
  "23",
  "23.7",
  "24.4",
  "25",
  "25.7",
  "26.4",
];

const APPAREL_SIZES = [
  ["7999", "130cm"],
  ["8001", "140cm"],
  ["8003", "150cm"],
  ["8005", "160cm"],
  ["28623", "165cm"],
  ["28624", "170cm"],
];
const APPAREL_PLATFORM_IDS = new Map([
  ["京东", "192894"],
]);

function usage() {
  process.stdout.write(`DeepDraw GPUS typed size probe

Default mode is dry-run. Dry-run dumps the SDK request and does not call DeepDraw.
Live writes require both --execute and DEEPDRAW_LIVE_WRITE=1.

Options:
  --mode <multi-platform|size-remark>   Required target variable. Default: multi-platform.
  --scenario <shoe|apparel>             Business scenario. Default: shoe.
  --product-code <code>                 Product code for readback. Required.
  --product-uid <uid>                   Internal DeepDraw product id for GPUS update. Optional in execute mode; read from resource by product code when omitted.
  --tenant <name>                       DeepDraw tenant. Default: ${DEFAULT_DEEPDRAW_TENANT_NAME}
  --credential-doc <path>               Credential handoff doc for execute mode.
  --base-url <url>                      DeepDraw base URL. Default: ${DEFAULT_DEEPDRAW_BASE_URL}
  --out <dir>                           Output directory. Default: .codex-tmp/deepdraw-gpus-typed-size-probe/<timestamp>
  --delay-ms <n>                        Delayed readback wait in execute mode. Default: 3000.
  --timeout-ms <n>                      Per SDK/API call timeout. Default: 30000.
  --execute                             Perform the live GPUS incremental update after safety checks.

Examples:
  node scripts/deepdraw_gpus_typed_size_probe.mjs --mode multi-platform --scenario shoe --product-code 204426140121-test5 --product-uid 3b6023ce4e844e138c25f92e9af1e227
  node scripts/deepdraw_gpus_typed_size_probe.mjs --mode size-remark --scenario shoe --product-code 204426140121-test5 --product-uid 3b6023ce4e844e138c25f92e9af1e227
`);
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    /(?:appSecret|dopKey|secret|token|password|authorization|signature)/i.test(key)
      ? "[redacted]"
      : sanitize(child),
  ]));
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    mode: "multi-platform",
    scenario: "shoe",
    productCode: "",
    productUid: "",
    tenantName: process.env.DEEPDRAW_TENANT_NAME || DEFAULT_DEEPDRAW_TENANT_NAME,
    credentialDoc: process.env.DEEPDRAW_CREDENTIAL_DOC || "",
    baseUrl: process.env.DEEPDRAW_BASE_URL || DEFAULT_DEEPDRAW_BASE_URL,
    outDir: path.join(projectRoot, ".codex-tmp", "deepdraw-gpus-typed-size-probe", timestampForPath()),
    delayMs: Number(process.env.DEEPDRAW_PROBE_DELAY_MS || 3000),
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS || 30000),
    execute: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--mode") args.mode = next();
    else if (arg === "--scenario") args.scenario = next();
    else if (arg === "--product-code") args.productCode = next();
    else if (arg === "--product-uid") args.productUid = next();
    else if (arg === "--tenant") args.tenantName = next();
    else if (arg === "--credential-doc") args.credentialDoc = path.resolve(next());
    else if (arg === "--base-url") args.baseUrl = next();
    else if (arg === "--out") args.outDir = path.resolve(next());
    else if (arg === "--delay-ms") args.delayMs = Number(next());
    else if (arg === "--timeout-ms") args.timeoutMs = Number(next());
    else if (arg === "--execute") args.execute = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.help) return args;
  if (!["multi-platform", "size-remark"].includes(args.mode)) {
    throw new Error("--mode must be multi-platform or size-remark");
  }
  if (!["shoe", "apparel"].includes(args.scenario)) {
    throw new Error("--scenario must be shoe or apparel");
  }
  if (args.mode === "size-remark" && args.scenario !== "shoe") {
    throw new Error("size-remark probe is currently defined only for shoe sizes");
  }
  if (!args.productCode) {
    throw new Error("--product-code is required");
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive number");
  }
  if (args.execute && process.env.DEEPDRAW_LIVE_WRITE !== "1") {
    throw new Error("Refusing live write: set DEEPDRAW_LIVE_WRITE=1 together with --execute");
  }
  if (args.execute && !/-test\d*$/i.test(args.productCode)) {
    throw new Error("Refusing live write to a non-test product code");
  }
  return args;
}

function dryRunConfig(args) {
  return {
    baseUrl: args.baseUrl,
    appKey: "dry-run-app-key",
    appSecret: "dry-run-app-secret",
    dopKey: "dry-run-dop-key",
    merchantId: "1162",
  };
}

function liveConfig(args) {
  return resolveDeepdrawConfig({
    projectRoot,
    baseUrl: args.baseUrl,
    tenantName: args.tenantName,
    credentialDoc: args.credentialDoc || undefined,
  });
}

function displayShoeSize(size) {
  return `${size}码`;
}

function shoeRemark(index) {
  return `脚长${SHOE_FOOT_RANGES[index]}/内长${SHOE_INNER_LENGTHS[index]}`;
}

function bareSizeText(size) {
  return stringValue(size).replace(/\s*(?:cm|厘米|公分|码)$/i, "");
}

function sizeMetadata(scenario) {
  const entries = scenario === "shoe" ? SHOE_SIZES : APPAREL_SIZES;
  return {
    fieldId: scenario === "shoe" ? "2398" : "1572",
    fieldName: "尺码",
    fieldType: "MULTI_CHOICE",
    fieldOptions: entries.map(([, value]) => value),
    options: entries.map(([, value]) => value),
    optionAliases: Object.fromEntries(entries.map(([, value]) => [
      value,
      scenario === "shoe" ? displayShoeSize(value) : value,
    ])),
    entryIdBySize: new Map(entries.map(([id, value]) => [value, id])),
  };
}

function shoeSizeRemarkField() {
  const metadata = sizeMetadata("shoe");
  return {
    fieldId: metadata.fieldId,
    fieldName: metadata.fieldName,
    fieldType: metadata.fieldType,
    fieldOptions: metadata.fieldOptions,
    options: metadata.options,
    optionAliases: metadata.optionAliases,
    texts: SHOE_SIZES.map(([id], index) => `${id},${shoeRemark(index)}`),
  };
}

function multiPlatformMetadata(scenario) {
  const platformIds = scenario === "shoe" ? SHOE_PLATFORM_IDS : APPAREL_PLATFORM_IDS;
  return {
    fieldId: scenario === "shoe" ? "88059" : "88964",
    fieldName: "多平台尺码",
    fieldType: "MULTI_TEXT",
    platforms: [...platformIds.keys()],
    platformIds,
  };
}

function shoeMultiPlatformField() {
  const sizeInfo = sizeMetadata("shoe");
  const multiInfo = multiPlatformMetadata("shoe");
  const texts = [];
  SHOE_SIZES.forEach(([sizeId, size], index) => {
    const display = displayShoeSize(size);
    const remark = shoeRemark(index);
    texts.push(`${sizeId},${multiInfo.platformIds.get("京东")},${size}`);
    texts.push(`${sizeId},${multiInfo.platformIds.get("拼多多")},${display}(${remark})`);
    texts.push(`${sizeId},${multiInfo.platformIds.get("微信视频小店")},${display}(${remark})`);
  });
  return {
    fieldId: multiInfo.fieldId,
    fieldName: multiInfo.fieldName,
    fieldType: multiInfo.fieldType,
    fieldOptions: multiInfo.platforms,
    options: sizeInfo.options.map(displayShoeSize),
    optionAliases: Object.fromEntries(multiInfo.platforms.map((platform) => [platform, platform])),
    texts,
  };
}

function apparelMultiPlatformField() {
  const sizeInfo = sizeMetadata("apparel");
  const multiInfo = multiPlatformMetadata("apparel");
  return {
    fieldId: multiInfo.fieldId,
    fieldName: multiInfo.fieldName,
    fieldType: multiInfo.fieldType,
    fieldOptions: multiInfo.platforms,
    options: sizeInfo.options,
    optionAliases: Object.fromEntries(multiInfo.platforms.map((platform) => [platform, platform])),
    texts: APPAREL_SIZES.map(([sizeId, size]) => `${sizeId},${multiInfo.platformIds.get("京东")},${bareSizeText(size)}`),
  };
}

function payloadFor(args) {
  const base = {
    code: args.productCode,
    title: args.mode === "size-remark" ? "童鞋typed尺码备注探针" : "typed多平台尺码探针",
    retailPrice: args.scenario === "shoe" ? "359" : "199",
    date: "2026-09-01",
    sites: args.scenario === "shoe" ? ["京东", "拼多多", "微信视频小店"] : ["京东"],
  };
  if (args.mode === "size-remark") {
    return {
      ...base,
      sizes: shoeSizeRemarkField(),
      gpusFields: [],
    };
  }
  return {
    ...base,
    gpusFields: [
      args.scenario === "shoe" ? shoeMultiPlatformField() : apparelMultiPlatformField(),
    ],
  };
}

function parseDump(result) {
  const payload = record(result.payload);
  const body = JSON.parse(stringValue(payload.body) || "{}");
  return {
    method: payload.method ?? null,
    path: payload.path ?? null,
    query: sanitize(payload.query ?? {}),
    sdkChecks: {
      productCheck: payload.productCheck ?? null,
      sizeCheck: payload.sizeCheck ?? null,
      fieldsCheck: payload.fieldsCheck ?? null,
      fieldCheckErrors: payload.fieldCheckErrors ?? null,
      fieldChecks: payload.fieldChecks ?? null,
    },
    product: sanitize(body.product ?? {}),
  };
}

function resourceBody(snapshot) {
  return record(deepdrawBusinessResult(snapshot.raw).body);
}

function tableName(table) {
  return stringValue(record(table.field).name ?? table.name);
}

function tableItems(table) {
  return array(table.sizeTableItems ?? table.size_table_items).map(record);
}

function findTable(body, name) {
  return array(body.sizeTables ?? body.size_tables)
    .map(record)
    .find((table) => tableName(table) === name) ?? null;
}

function tableFingerprint(table) {
  if (!table) return null;
  return stableJson(tableItems(table).map((row) => ({
    size: stringValue(row.size),
    values: stableJson(record(row.values)),
  })));
}

function coreFingerprint(body) {
  const sizes = record(body.sizes);
  const skus = record(body.skus);
  return stableJson({
    sizeOptions: array(sizes.options ?? sizes.Options).map(stringValue).sort(),
    sizeAliases: record(sizes.optionAliases ?? sizes.option_aliases),
    skus: array(skus.skuItems ?? skus.sku_items)
      .map((sku) => {
        const row = record(sku);
        return [stringValue(row.color), stringValue(row.size)].join("/");
      })
      .sort(),
    tables: Object.fromEntries(["尺码表", "唯品会尺码表", "天猫尺码表", "抖音尺码表"].map((name) => [
      name,
      tableFingerprint(findTable(body, name)),
    ])),
  });
}

function resourceSummary(result) {
  const business = deepdrawBusinessResult(result.payload);
  const body = record(business.body);
  const sizes = record(body.sizes);
  return {
    httpStatus: result.status,
    responseCode: business.code ?? null,
    reason: business.reason || null,
    id: body.id ?? null,
    productId: body.productId ?? body.product_id ?? null,
    productCode: body.code ?? body.productCode ?? null,
    sizeOptions: array(sizes.options ?? sizes.Options).map(stringValue),
    sizeOptionAliases: record(sizes.optionAliases ?? sizes.option_aliases),
    sizeTexts: array(sizes.texts),
    skuCount: array(record(body.skus).skuItems ?? record(body.skus).sku_items).length,
    tables: array(body.sizeTables ?? body.size_tables).map((table) => ({
      name: tableName(record(table)),
      rowCount: tableItems(record(table)).length,
      firstRow: sanitize(tableItems(record(table))[0] ?? null),
    })),
    coreFingerprint: coreFingerprint(body),
  };
}

async function readResource(config, args, label) {
  const result = await getDeepdrawProduct({
    config,
    productCode: args.productCode,
    resource: "form",
    timeoutMs: args.timeoutMs,
  });
  return { label, raw: result.payload, summary: resourceSummary(result) };
}

async function readResourceWithRetry(config, args, label) {
  const attempts = [];
  const maxAttempts = 4;
  let latest = null;
  for (let index = 0; index < maxAttempts; index += 1) {
    latest = await readResource(config, args, label);
    attempts.push({
      attempt: index + 1,
      httpStatus: latest.summary.httpStatus,
      responseCode: latest.summary.responseCode,
      reason: latest.summary.reason,
    });
    if (latest.summary.responseCode === 10200) {
      return { ...latest, attempts };
    }
    if (index < maxAttempts - 1) {
      await wait(1500 * (index + 1));
    }
  }
  return { ...latest, attempts };
}

function readbackSucceeded(snapshot) {
  return snapshot?.summary?.responseCode === 10200;
}

async function invokeTypedSdk({ args, config, payload, productUid }) {
  return updateDeepdrawGpusProductIncrementallyWithSdk({
    config,
    payload,
    productId: productUid,
    timeoutMs: args.timeoutMs,
    projectRoot,
  });
}

async function dryRun(args, payload) {
  const productUid = args.productUid || "dry-run-product-uid";
  const previous = process.env.DEEPDRAW_SDK_DUMP_REQUEST;
  process.env.DEEPDRAW_SDK_DUMP_REQUEST = "1";
  try {
    const result = await invokeTypedSdk({
      args,
      config: dryRunConfig(args),
      payload,
      productUid,
    });
    return {
      mode: "dry_run",
      target: args.mode,
      scenario: args.scenario,
      productCode: args.productCode,
      productUid,
      request: parseDump(result),
    };
  } finally {
    if (previous == null) delete process.env.DEEPDRAW_SDK_DUMP_REQUEST;
    else process.env.DEEPDRAW_SDK_DUMP_REQUEST = previous;
  }
}

async function execute(args, payload) {
  const config = liveConfig(args);
  const before = await readResourceWithRetry(config, args, "before");
  if (!readbackSucceeded(before)) {
    return {
      mode: "execute",
      target: args.mode,
      scenario: args.scenario,
      productCode: args.productCode,
      productUid: args.productUid || null,
      update: null,
      before,
      after: null,
      delayedAfter: null,
      checks: {
        skippedUpdate: true,
        beforeReadback10200: false,
        afterReadback10200: null,
        delayedReadback10200: null,
        businessCode10200: null,
        coreUnchanged: null,
        multiPlatformPresentAfterDelay: null,
        sizeRemarksPresentAfterDelay: null,
      },
    };
  }
  const beforeBody = resourceBody(before);
  const productUid = args.productUid || stringValue(beforeBody.id);
  if (!productUid) {
    throw new Error("DeepDraw resource readback did not include an internal product id");
  }
  const result = await invokeTypedSdk({ args, config, payload, productUid });
  const business = deepdrawBusinessResult(result.payload);
  const after = await readResourceWithRetry(config, args, "after");
  await wait(args.delayMs);
  const delayedAfter = await readResourceWithRetry(config, args, "delayed_after");
  const afterBody = resourceBody(delayedAfter);
  const afterReadback10200 = readbackSucceeded(after);
  const delayedReadback10200 = readbackSucceeded(delayedAfter);
  const coreUnchanged = delayedReadback10200
    ? JSON.stringify(before.summary.coreFingerprint) === JSON.stringify(delayedAfter.summary.coreFingerprint)
    : null;
  const multiTable = findTable(afterBody, "多平台尺码");
  const expectedSizeTexts = new Set(args.mode === "size-remark" ? payload.sizes.texts : []);
  const actualSizeTexts = new Set(array(record(afterBody.sizes).texts).map(stringValue));
  return {
    mode: "execute",
    target: args.mode,
    scenario: args.scenario,
    productCode: args.productCode,
    productUid,
    update: sanitize({
      httpStatus: result.status,
      responseCode: business.code ?? null,
      reason: business.reason || null,
      response: business.response || null,
      body: business.body,
    }),
    before,
    after,
    delayedAfter,
    checks: {
      skippedUpdate: false,
      beforeReadback10200: true,
      afterReadback10200,
      delayedReadback10200,
      businessCode10200: business.code === 10200,
      coreUnchanged,
      multiPlatformPresentAfterDelay: delayedReadback10200 ? Boolean(multiTable) : null,
      sizeRemarksPresentAfterDelay: expectedSizeTexts.size > 0 && delayedReadback10200
        ? [...expectedSizeTexts].every((text) => actualSizeTexts.has(text))
        : null,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const payload = payloadFor(args);
  const report = args.execute ? await execute(args, payload) : await dryRun(args, payload);
  writeJson(path.join(args.outDir, "report.json"), report);
  const product = report.request?.product ?? {};
  process.stdout.write(`${JSON.stringify({
    mode: report.mode,
    target: report.target,
    scenario: report.scenario,
    productCode: report.productCode,
    productUid: report.productUid,
    output: path.relative(projectRoot, path.join(args.outDir, "report.json")),
    requestPath: report.request?.path ?? null,
    requestQuery: report.request?.query ?? null,
    typedSizes: product.sizes ?? null,
    typedFields: product.fields ?? null,
    checks: report.checks ?? report.request?.sdkChecks ?? null,
    update: report.update ?? null,
  }, null, 2)}\n`);

  if (args.execute) {
    const ok = report.checks.businessCode10200
      && report.checks.beforeReadback10200
      && report.checks.delayedReadback10200
      && report.checks.coreUnchanged
      && (
        args.mode === "multi-platform"
          ? report.checks.multiPlatformPresentAfterDelay
          : report.checks.sizeRemarksPresentAfterDelay
      );
    if (!ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
