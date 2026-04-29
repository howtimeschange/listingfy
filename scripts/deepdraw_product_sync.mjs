#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local_env.mjs";
import {
  DEFAULT_DEEPDRAW_BASE_URL,
  DEFAULT_DEEPDRAW_TENANT_NAME,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
} from "./lib/deepdraw_client.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
loadLocalEnv({ cwd: projectRoot });

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCodes(value) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.DEEPDRAW_BASE_URL || DEFAULT_DEEPDRAW_BASE_URL,
    tenantName: process.env.DEEPDRAW_TENANT_NAME || DEFAULT_DEEPDRAW_TENANT_NAME,
    credentialDoc: process.env.DEEPDRAW_CREDENTIAL_DOC,
    outDir: path.join(projectRoot, "data", "deepdraw-content", timestampForPath()),
    delayMs: Number(process.env.DEEPDRAW_SYNC_DELAY_MS || 800),
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS || 30000),
    codes: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--base-url") args.baseUrl = next();
    else if (arg === "--tenant") args.tenantName = next();
    else if (arg === "--credential-doc") args.credentialDoc = path.resolve(next());
    else if (arg === "--out") args.outDir = path.resolve(next());
    else if (arg === "--delay-ms") args.delayMs = Number(next());
    else if (arg === "--timeout-ms") args.timeoutMs = Number(next());
    else if (arg === "--codes") args.codes.push(...parseCodes(next()));
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else args.codes.push(arg);
  }

  args.codes = [...new Set(args.codes)];
  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive number");
  }
  return args;
}

function usage() {
  process.stdout.write(`DeepDraw product content sync

Credentials:
  Preferred env:
    DEEPDRAW_BASE_URL       default ${DEFAULT_DEEPDRAW_BASE_URL}
    DEEPDRAW_APP_KEY
    DEEPDRAW_APP_SECRET
    DEEPDRAW_DOP_KEY
    DEEPDRAW_MERCHANT_ID

  Local handoff fallback:
    DEEPDRAW_CREDENTIAL_DOC defaults to docs/reference/integration-handoffs/private/MDM&深绘 (1).docx
    DEEPDRAW_TENANT_NAME    default ${DEFAULT_DEEPDRAW_TENANT_NAME}

Options:
  --tenant <name>           Tenant row name in the handoff doc.
  --credential-doc <path>   Local .docx or text credential handoff.
  --out <dir>               Output directory.
  --codes <list>            Comma or whitespace separated product codes.
  --delay-ms <n>            Delay between product requests. Default 800.
  --timeout-ms <n>          Per-request timeout. Default 30000.

Examples:
  node scripts/deepdraw_product_sync.mjs --tenant 电商巴拉巴拉 208226102001 208226103201
`);
}

function summarizePayload(productCode, result) {
  const body = result.payload?.body;
  const skuItems = body?.skus?.skuItems || [];
  const detailPages = body?.detalPages || body?.detailPages || [];
  const colorOptions = body?.colors?.options || [];
  return {
    productCode,
    httpStatus: result.status,
    requestId: result.requestId,
    responseCode: result.payload?.code ?? null,
    hasBody: body != null,
    brandName: body?.brandName ?? null,
    returnedCode: body?.code ?? null,
    skuCount: skuItems.length,
    detailPageCount: detailPages.length,
    colorCount: colorOptions.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.codes.length) {
    throw new Error("At least one product code is required");
  }

  ensureDir(args.outDir);
  const productsDir = path.join(args.outDir, "products");
  ensureDir(productsDir);

  const files = {
    manifest: path.join(args.outDir, "manifest.json"),
    productsJsonl: path.join(args.outDir, "products.raw.jsonl"),
    summariesJsonl: path.join(args.outDir, "products.summary.jsonl"),
    failuresJsonl: path.join(args.outDir, "sync-failures.jsonl"),
  };
  for (const filePath of [files.productsJsonl, files.summariesJsonl, files.failuresJsonl]) {
    fs.writeFileSync(filePath, "");
  }

  const config = resolveDeepdrawConfig({
    projectRoot,
    baseUrl: args.baseUrl,
    tenantName: args.tenantName,
    credentialDoc: args.credentialDoc,
  });

  const manifest = {
    started_at: new Date().toISOString(),
    finished_at: null,
    base_url: config.baseUrl,
    tenant_name: config.tenantName,
    credential_source: config.credentialSource,
    requested_codes: args.codes,
    delay_ms: args.delayMs,
    timeout_ms: args.timeoutMs,
    counts: {
      requested: args.codes.length,
      success: 0,
      failed: 0,
    },
    files: Object.fromEntries(Object.entries(files).map(([key, filePath]) => [key, path.relative(projectRoot, filePath)])),
    products_dir: path.relative(projectRoot, productsDir),
    products: [],
  };

  process.stderr.write(`DeepDraw sync output: ${args.outDir}\n`);
  process.stderr.write(`Tenant: ${config.tenantName}\n`);

  for (let index = 0; index < args.codes.length; index += 1) {
    const productCode = args.codes[index];
    process.stderr.write(`Fetching ${productCode} (${index + 1}/${args.codes.length})...\n`);
    try {
      const result = await getDeepdrawProduct({
        config,
        productCode,
        timeoutMs: args.timeoutMs,
      });
      const summary = summarizePayload(productCode, result);
      writeJsonl(files.productsJsonl, {
        productCode,
        httpStatus: result.status,
        requestId: result.requestId,
        payload: result.payload,
      });
      writeJsonl(files.summariesJsonl, summary);
      if (!result.ok || !summary.hasBody) {
        manifest.counts.failed += 1;
        writeJsonl(files.failuresJsonl, {
          productCode,
          httpStatus: result.status,
          requestId: result.requestId,
          responseCode: result.payload?.code ?? null,
          reason: result.payload?.reason ?? result.payload?.message ?? null,
          rawPrefix: typeof result.payload === "string" ? result.payload.slice(0, 500) : undefined,
        });
      } else {
        manifest.counts.success += 1;
        writeJson(path.join(productsDir, `${productCode}.json`), result.payload);
      }
      manifest.products.push(summary);
    } catch (error) {
      manifest.counts.failed += 1;
      const failure = {
        productCode,
        error: error.message,
      };
      writeJsonl(files.failuresJsonl, failure);
      manifest.products.push({
        productCode,
        hasBody: false,
        error: error.message,
      });
    }
    if (index < args.codes.length - 1 && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  manifest.finished_at = new Date().toISOString();
  writeJson(files.manifest, manifest);
  writeJson(path.join(projectRoot, "data", "deepdraw-content", "latest-manifest.json"), manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

  if (manifest.counts.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
