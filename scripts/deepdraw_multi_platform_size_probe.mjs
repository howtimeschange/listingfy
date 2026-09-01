#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/local_env.mjs";
import {
  createDeepdrawProductWithSdk,
  updateDeepdrawFullProductWithSdk,
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

const SHOE_SIZES = Array.from({ length: 15 }, (_, index) => String(index + 26));
const FOOT_RANGES = [
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
const FOOT_BASELINES = [
  "16",
  "16.5",
  "17",
  "18",
  "18.5",
  "19",
  "20",
  "20.5",
  "21",
  "22",
  "22.5",
  "23",
  "24",
  "24.5",
  "25",
];
const INNER_LENGTHS = [
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
const APPAREL_SIZES = ["130cm", "140cm", "150cm", "160cm", "165cm", "170cm"];
const PROTECTED_TABLES = ["尺码表", "唯品会尺码表", "天猫尺码表", "抖音尺码表"];

function usage() {
  process.stdout.write(`DeepDraw multi-platform size probe

Default mode is dry-run. Dry-run builds the SDK request and does not call DeepDraw.
Live writes require both --execute and DEEPDRAW_LIVE_WRITE=1.

Options:
  --scenario <shoe|apparel>      Required business scenario. Default: shoe.
  --operation <create|update>    SDK operation. Default: update for shoe, create for apparel.
  --product-code <code>          Product code for request/readback. Required.
  --product-id <id>              Numeric DeepDraw product id. Required for update.
  --tenant <name>                DeepDraw tenant. Default: ${DEFAULT_DEEPDRAW_TENANT_NAME}
  --credential-doc <path>        Credential handoff doc for execute mode.
  --base-url <url>               DeepDraw base URL. Default: ${DEFAULT_DEEPDRAW_BASE_URL}
  --out <dir>                    Output directory. Default: .codex-tmp/deepdraw-multi-platform-size-probe/<timestamp>
  --delay-ms <n>                 Delayed readback wait in execute mode. Default: 3000.
  --timeout-ms <n>               Per SDK/API call timeout. Default: 30000.
  --shoe-multi-row-key <mode>    Shoe multi-platform row key. display=26码, bare=26. Default: display.
  --shoe-sale-size <mode>        Shoe sale size identity. display=26码, bare=26. Default: display.
  --shoe-multi-shape <shape>     Shoe multi-platform field body. platform=current platform table, size-table-body=PDF page-24 literal swapped body. Default: platform.
  --with-size-remarks            Put shoe size remarks into the sale-size field as 尺码*备注.
  --execute                      Perform the live create/update after safety checks.

Examples:
  node scripts/deepdraw_multi_platform_size_probe.mjs --scenario shoe --operation update --product-code 204426140121-test5 --product-id 6516955
  node scripts/deepdraw_multi_platform_size_probe.mjs --scenario shoe --operation update --shoe-sale-size bare --shoe-multi-row-key bare --product-code 204426140121-test5 --product-id 6516955
  DEEPDRAW_LIVE_WRITE=1 node scripts/deepdraw_multi_platform_size_probe.mjs --execute --scenario shoe --operation update --product-code 204426140121-test5 --product-id 6516955
  node scripts/deepdraw_multi_platform_size_probe.mjs --scenario apparel --operation create --product-code 202426107033-test6
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

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    scenario: "shoe",
    operation: "",
    productCode: "",
    productId: "",
    tenantName: process.env.DEEPDRAW_TENANT_NAME || DEFAULT_DEEPDRAW_TENANT_NAME,
    credentialDoc: process.env.DEEPDRAW_CREDENTIAL_DOC || "",
    baseUrl: process.env.DEEPDRAW_BASE_URL || DEFAULT_DEEPDRAW_BASE_URL,
    outDir: path.join(projectRoot, ".codex-tmp", "deepdraw-multi-platform-size-probe", timestampForPath()),
    delayMs: Number(process.env.DEEPDRAW_PROBE_DELAY_MS || 3000),
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS || 30000),
    shoeMultiRowKey: process.env.DEEPDRAW_SHOE_MULTI_ROW_KEY || "display",
    shoeSaleSize: process.env.DEEPDRAW_SHOE_SALE_SIZE || "display",
    shoeMultiShape: process.env.DEEPDRAW_SHOE_MULTI_SHAPE || "platform",
    withSizeRemarks: false,
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
    if (arg === "--scenario") args.scenario = next();
    else if (arg === "--operation") args.operation = next();
    else if (arg === "--product-code") args.productCode = next();
    else if (arg === "--product-id") args.productId = next();
    else if (arg === "--tenant") args.tenantName = next();
    else if (arg === "--credential-doc") args.credentialDoc = path.resolve(next());
    else if (arg === "--base-url") args.baseUrl = next();
    else if (arg === "--out") args.outDir = path.resolve(next());
    else if (arg === "--delay-ms") args.delayMs = Number(next());
    else if (arg === "--timeout-ms") args.timeoutMs = Number(next());
    else if (arg === "--shoe-multi-row-key") args.shoeMultiRowKey = next();
    else if (arg === "--shoe-sale-size") args.shoeSaleSize = next();
    else if (arg === "--shoe-multi-shape") args.shoeMultiShape = next();
    else if (arg === "--with-size-remarks") args.withSizeRemarks = true;
    else if (arg === "--execute") args.execute = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.operation) args.operation = args.scenario === "apparel" ? "create" : "update";
  if (args.help) return args;
  if (!["shoe", "apparel"].includes(args.scenario)) {
    throw new Error("--scenario must be shoe or apparel");
  }
  if (!["create", "update"].includes(args.operation)) {
    throw new Error("--operation must be create or update");
  }
  if (!args.productCode) {
    throw new Error("--product-code is required");
  }
  if (args.operation === "update" && !/^\d+$/.test(args.productId)) {
    throw new Error("--product-id must be a numeric DeepDraw id for update probes");
  }
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive number");
  }
  if (!["display", "bare"].includes(args.shoeMultiRowKey)) {
    throw new Error("--shoe-multi-row-key must be display or bare");
  }
  if (!["display", "bare"].includes(args.shoeSaleSize)) {
    throw new Error("--shoe-sale-size must be display or bare");
  }
  if (!["platform", "size-table-body"].includes(args.shoeMultiShape)) {
    throw new Error("--shoe-multi-shape must be platform or size-table-body");
  }
  if (args.execute && process.env.DEEPDRAW_LIVE_WRITE !== "1") {
    throw new Error("Refusing live write: set DEEPDRAW_LIVE_WRITE=1 together with --execute");
  }
  if (args.execute && !/-test\d*$/i.test(args.productCode)) {
    throw new Error("Refusing live write to a non-test product code");
  }
  return args;
}

function displayShoeSize(size) {
  return `${size}码`;
}

function shoeRemark(size, index) {
  return `脚长${FOOT_RANGES[index]}/内长${INNER_LENGTHS[index]}`;
}

function shoeMainSizeTable() {
  return Object.fromEntries([
    ["title", "尺码,适合脚长,鞋内长"],
    ...SHOE_SIZES.map((size, index) => [
      displayShoeSize(size),
      [size, FOOT_BASELINES[index], INNER_LENGTHS[index]].join(","),
    ]),
  ]);
}

function shoeMultiPlatformTable() {
  return Object.fromEntries([
    ["title", "京东,拼多多,微信视频小店"],
    ...SHOE_SIZES.map((size, index) => [
      displayShoeSize(size),
      [
        size,
        `${displayShoeSize(size)}(${shoeRemark(size, index)})`,
        `${displayShoeSize(size)}(${shoeRemark(size, index)})`,
      ].join(","),
    ]),
  ]);
}

function shoeDocLiteralMultiPlatformTable() {
  return Object.fromEntries([
    ["title", "尺码,适合脚长,鞋内长"],
    ...SHOE_SIZES.map((size, index) => [
      displayShoeSize(size),
      [size, FOOT_RANGES[index], INNER_LENGTHS[index]].join(","),
    ]),
  ]);
}

function apparelMainSizeTable() {
  return Object.fromEntries([
    ["title", "尺码,衣长"],
    ...APPAREL_SIZES.map((size, index) => [
      size,
      [size.replace(/cm$/i, ""), String(50 + index * 4)].join(","),
    ]),
  ]);
}

function apparelMultiPlatformTable() {
  return Object.fromEntries([
    ["title", "京东"],
    ...APPAREL_SIZES.map((size) => [
      size,
      size.replace(/cm$/i, ""),
    ]),
  ]);
}

function probePayload(args) {
  if (args.scenario === "shoe") {
    const sizeRemarks = Object.fromEntries(SHOE_SIZES.map((size, index) => [
      displayShoeSize(size),
      shoeRemark(size, index),
    ]));
    const fields = [
      { name: "尺码", value: SHOE_SIZES.map(displayShoeSize).join(";") },
      { name: "尺码表", fieldType: "MULTI_TEXT", value: shoeMainSizeTable() },
      {
        name: "多平台尺码",
        fieldType: "MULTI_TEXT",
        value: args.shoeMultiShape === "size-table-body"
          ? shoeDocLiteralMultiPlatformTable()
          : shoeMultiPlatformTable(),
      },
    ];
    return {
      code: args.productCode,
      title: "童鞋多平台尺码探针",
      tradeId: "546",
      retailPrice: 359,
      date: "2026-09-01",
      places: "京东、拼多多、微信视频小店",
      shoeSizes: true,
      shoeMultiPlatformRowKey: args.shoeMultiRowKey,
      shoeSaleSizeUnitMode: args.shoeSaleSize,
      includeMultiPlatformSizeField: true,
      ...(args.withSizeRemarks ? { sizeRemarks, inlineSizeRemarksForProbe: true } : {}),
      fields,
      legacyUpdateFields: fields.filter((field) => field.name !== "尺码表"),
    };
  }

  return {
    code: args.productCode,
    title: "服饰多平台尺码探针",
    tradeId: "12390",
    retailPrice: 199,
    date: "2026-09-01",
    places: "京东",
    fields: [
      { name: "尺码", value: APPAREL_SIZES.join(";") },
      { name: "尺码表", fieldType: "MULTI_TEXT", value: apparelMainSizeTable() },
      { name: "多平台尺码", fieldType: "MULTI_TEXT", value: apparelMultiPlatformTable() },
    ],
  };
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

function parseDumpFields(result) {
  const payload = record(result.payload);
  const body = JSON.parse(stringValue(payload.body) || "{}");
  return {
    method: payload.method ?? null,
    path: payload.path ?? null,
    query: sanitize(payload.query ?? {}),
    sdkChecks: {
      checkColor: payload.checkColor ?? null,
      checkSizes: payload.checkSizes ?? null,
      checkSizeTable: payload.checkSizeTable ?? null,
      checkSkus: payload.checkSkus ?? null,
      checkProduct: payload.checkProduct ?? null,
    },
    product: sanitize(body.product ?? {}),
    productFields: sanitize(record(record(body.product).productFields)),
  };
}

function resourceSnapshotBody(snapshot) {
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

function protectedFingerprint(body) {
  return stableJson({
    sizes: array(record(body.sizes).options ?? record(body.sizes).Options).map(stringValue).sort(),
    skus: array(record(body.skus).skuItems ?? record(body.skus).sku_items)
      .map((sku) => {
        const row = record(sku);
        return [stringValue(row.color), stringValue(row.size)].join("/");
      })
      .sort(),
    tables: Object.fromEntries(PROTECTED_TABLES.map((name) => [
      name,
      tableFingerprint(findTable(body, name)),
    ])),
  });
}

function resourceSummary(result) {
  const business = deepdrawBusinessResult(result.payload);
  const body = record(business.body);
  return {
    httpStatus: result.status,
    responseCode: business.code ?? null,
    reason: business.reason || null,
    returnedCode: body.code ?? null,
    productId: body.productId ?? body.product_id ?? body.id ?? null,
    sizeCount: array(record(body.sizes).options ?? record(body.sizes).Options).length,
    skuCount: array(record(body.skus).skuItems ?? record(body.skus).sku_items).length,
    tables: array(body.sizeTables ?? body.size_tables).map((table) => {
      const entry = record(table);
      const firstRow = tableItems(entry)[0] ?? null;
      return {
        name: tableName(entry),
        rowCount: tableItems(entry).length,
        firstRow: firstRow ? sanitize(firstRow) : null,
      };
    }),
    protectedFingerprint: protectedFingerprint(body),
  };
}

async function readResource(config, args, label) {
  const result = await getDeepdrawProduct({
    config,
    productCode: args.productCode,
    // The update API needs the numeric v1 productId, but dp.product.resource
    // treats that same query as productUid in this SDK path. Read back by code.
    resource: "form",
    timeoutMs: args.timeoutMs,
  });
  return { label, raw: result.payload, summary: resourceSummary(result) };
}

async function invokeSdk({ args, config, payload }) {
  if (args.operation === "create") {
    return createDeepdrawProductWithSdk({ config, payload, timeoutMs: args.timeoutMs, projectRoot });
  }
  return updateDeepdrawFullProductWithSdk({
    config,
    payload,
    productId: args.productId,
    timeoutMs: args.timeoutMs,
    projectRoot,
  });
}

async function dryRun(args, payload) {
  const previous = process.env.DEEPDRAW_SDK_DUMP_REQUEST;
  process.env.DEEPDRAW_SDK_DUMP_REQUEST = "1";
  try {
    const result = await invokeSdk({ args, config: dryRunConfig(args), payload });
    const dump = parseDumpFields(result);
    return {
      mode: "dry_run",
      scenario: args.scenario,
      operation: args.operation,
      productCode: args.productCode,
      productId: args.productId || null,
      shoeMultiRowKey: args.scenario === "shoe" ? args.shoeMultiRowKey : null,
      shoeSaleSize: args.scenario === "shoe" ? args.shoeSaleSize : null,
      shoeMultiShape: args.scenario === "shoe" ? args.shoeMultiShape : null,
      withSizeRemarks: args.scenario === "shoe" ? args.withSizeRemarks : false,
      fieldNames: Object.keys(dump.productFields),
      sizeField: dump.productFields["尺码"] ?? null,
      mainSizeTable: dump.productFields["尺码表"] ?? null,
      multiPlatformSize: dump.productFields["多平台尺码"] ?? null,
      request: dump,
    };
  } finally {
    if (previous == null) delete process.env.DEEPDRAW_SDK_DUMP_REQUEST;
    else process.env.DEEPDRAW_SDK_DUMP_REQUEST = previous;
  }
}

async function execute(args, payload) {
  const config = liveConfig(args);
  const before = args.operation === "update" ? await readResource(config, args, "before") : null;
  const result = await invokeSdk({ args, config, payload });
  const business = deepdrawBusinessResult(result.payload);
  const after = await readResource(config, args, "after");
  await wait(args.delayMs);
  const delayedAfter = await readResource(config, args, "delayed_after");
  const protectedUnchanged = before
    ? JSON.stringify(before.summary.protectedFingerprint) === JSON.stringify(delayedAfter.summary.protectedFingerprint)
    : null;
  return {
    mode: "execute",
    scenario: args.scenario,
    operation: args.operation,
    productCode: args.productCode,
    productId: args.productId || null,
    shoeMultiRowKey: args.scenario === "shoe" ? args.shoeMultiRowKey : null,
    shoeSaleSize: args.scenario === "shoe" ? args.shoeSaleSize : null,
    shoeMultiShape: args.scenario === "shoe" ? args.shoeMultiShape : null,
    withSizeRemarks: args.scenario === "shoe" ? args.withSizeRemarks : false,
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
      businessCode10200: business.code === 10200,
      protectedUnchanged,
      multiPlatformPresentAfterDelay: Boolean(findTable(resourceSnapshotBody(delayedAfter), "多平台尺码")),
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const payload = probePayload(args);
  const report = args.execute ? await execute(args, payload) : await dryRun(args, payload);
  writeJson(path.join(args.outDir, "report.json"), report);
  process.stdout.write(`${JSON.stringify({
    mode: report.mode,
    scenario: report.scenario,
    operation: report.operation,
    productCode: report.productCode,
    productId: report.productId,
    shoeMultiRowKey: report.shoeMultiRowKey,
    shoeSaleSize: report.shoeSaleSize,
    shoeMultiShape: report.shoeMultiShape,
    withSizeRemarks: report.withSizeRemarks,
    output: path.relative(projectRoot, path.join(args.outDir, "report.json")),
    sizeField: report.sizeField ?? report.update?.responseCode ?? null,
    multiPlatformSize: report.multiPlatformSize ?? null,
    checks: report.checks ?? report.request?.sdkChecks ?? null,
  }, null, 2)}\n`);

  if (args.execute) {
    const ok = report.checks.businessCode10200
      && report.checks.multiPlatformPresentAfterDelay
      && report.checks.protectedUnchanged !== false;
    if (!ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
