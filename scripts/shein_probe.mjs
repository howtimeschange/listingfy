#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/local_env.mjs";
import {
  APP_AUTH_PATH,
  PROD_BASE_URL_CN,
  TEST_BASE_URL,
  decryptSecretKey,
  readEnv,
  requireEnv,
  requestShein,
} from "./lib/shein_client.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv({ cwd: PROJECT_ROOT });

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  process.stdout.write(`SHEIN API probe

Environment:
  SHEIN_BASE_URL          default ${TEST_BASE_URL}
  SHEIN_OPEN_KEY_ID       test-store or authorized shop openKeyId
  SHEIN_SECRET_KEY        test-store or authorized shop secretKey
  SHEIN_APP_ID            app id, only for auth:get-by-token
  SHEIN_APP_SECRET_KEY    app secret, only for auth:get-by-token
  SHEIN_LANGUAGE          default zh-cn
  SHEIN_SHOW_SECRET       set to 1 to print decrypted auth secret

Commands:
  auth:get-by-token <tempToken>
  category-tree
  publish-standard [category_id]
  attribute-template <product_type_id[,product_type_id...]>
  site-list
  store-info
  call <GET|POST> <path> [json-body-or-@file]

Examples:
  SHEIN_OPEN_KEY_ID=... SHEIN_SECRET_KEY=... node scripts/shein_probe.mjs category-tree
  SHEIN_OPEN_KEY_ID=... SHEIN_SECRET_KEY=... node scripts/shein_probe.mjs publish-standard 12345
  SHEIN_OPEN_KEY_ID=... SHEIN_SECRET_KEY=... node scripts/shein_probe.mjs attribute-template 2147503175

Production full-managed base URL is usually ${PROD_BASE_URL_CN}; keep test and production credentials separate.
`);
}

function parseJsonArg(arg) {
  if (!arg) return {};
  if (arg.startsWith("@")) {
    return JSON.parse(fs.readFileSync(arg.slice(1), "utf8"));
  }
  return JSON.parse(arg);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "auth:get-by-token") {
    const tempToken = args[0] || requireEnv("SHEIN_TEMP_TOKEN");
    const result = await requestShein(APP_AUTH_PATH, {
      appAuth: true,
      body: { tempToken },
    });
    if (result.payload?.info?.secretKey) {
      const decryptedSecretKey = decryptSecretKey(
        result.payload.info.secretKey,
        requireEnv("SHEIN_APP_SECRET_KEY"),
      );
      result.payload.info.secretKey = readEnv("SHEIN_SHOW_SECRET") === "1"
        ? decryptedSecretKey
        : "[redacted decrypted secret; set SHEIN_SHOW_SECRET=1 to print]";
    }
    printJson(result);
    return;
  }

  if (command === "category-tree") {
    printJson(await requestShein("/open-api/goods/query-category-tree", { body: "" }));
    return;
  }

  if (command === "publish-standard") {
    const categoryId = args[0];
    const body = categoryId ? { category_id: Number(categoryId) } : "";
    printJson(await requestShein("/open-api/goods/query-publish-fill-in-standard", { body }));
    return;
  }

  if (command === "attribute-template") {
    const ids = (args[0] || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(Number);
    if (!ids.length) {
      throw new Error("attribute-template requires at least one product_type_id");
    }
    printJson(await requestShein("/open-api/goods/query-attribute-template", {
      body: { product_type_id_list: ids },
    }));
    return;
  }

  if (command === "site-list") {
    printJson(await requestShein("/open-api/goods/query-site-list", { body: {} }));
    return;
  }

  if (command === "store-info") {
    printJson(await requestShein("/open-api/openapi-business-backend/query-store-info", { body: {} }));
    return;
  }

  if (command === "call") {
    const method = (args[0] || "").toUpperCase();
    const path = args[1];
    if (!["GET", "POST"].includes(method) || !path?.startsWith("/")) {
      throw new Error("call usage: call <GET|POST> <path> [json-body-or-@file]");
    }
    const body = method === "GET" ? undefined : parseJsonArg(args[2]);
    printJson(await requestShein(path, { method, body }));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
