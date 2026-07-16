import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createDeepdrawProductWithSdk,
  getDeepdrawProductWithSdk,
} from "./deepdraw_sdk_adapter.mjs";

export const DEFAULT_DEEPDRAW_BASE_URL = "http://open.deepdraw.cn";
export const DEFAULT_DEEPDRAW_TENANT_NAME = "电商巴拉巴拉";
export const PRODUCT_RESOURCE_TYPE = "dp.product.resource";
export const PRODUCT_BASIC_SEARCH_TYPE = "dp.product.basic.search";
export const PRODUCT_CREATE_TYPE = "dp.product.create";
export const MERCHANT_TRADES_TYPE = "dp.merchant.trades";
export const TRADE_FIELDS_TYPE = "dp.trade.fields";
export const REST_PATH = "/rest";
export const REST_V2_PATH = "/rest/v2";

function stringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasRecordValue(value) {
  return Object.keys(recordValue(value)).length > 0;
}

export function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export function normalizeBaseUrl(baseUrl = DEFAULT_DEEPDRAW_BASE_URL) {
  return baseUrl.replace(/\/+$/, "");
}

export function parseTenantCredentialsFromText(text, tenantName) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const index = lines.findIndex((line) => line === tenantName);
  if (index < 4) {
    throw new Error(`DeepDraw tenant not found in credential document: ${tenantName}`);
  }
  const [merchantId, appKey, appSecret, dopKey] = lines.slice(index - 4, index);
  if (![merchantId, appKey, appSecret, dopKey].every(Boolean)) {
    throw new Error(`DeepDraw credential row is incomplete for tenant: ${tenantName}`);
  }
  return {
    merchantId,
    appKey,
    appSecret,
    dopKey,
    tenantName,
  };
}

export function readCredentialDocText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DeepDraw credential document does not exist: ${filePath}`);
  }
  if (filePath.toLowerCase().endsWith(".docx")) {
    return execFileSync("textutil", ["-convert", "txt", "-stdout", filePath], {
      encoding: "utf8",
    });
  }
  return fs.readFileSync(filePath, "utf8");
}

export function defaultCredentialDocPath(projectRoot) {
  return path.join(
    projectRoot,
    "docs",
    "reference",
    "integration-handoffs",
    "private",
    "MDM&深绘 (1).docx",
  );
}

function configFromEnv() {
  const tenantName = readEnv("DEEPDRAW_TENANT_NAME");
  return configFromEnvForTenant(tenantName);
}

function configFromEnvForTenant(tenantName) {
  const tenantCredentialsJson = readEnv("DEEPDRAW_TENANT_CREDENTIALS_JSON");
  if (tenantCredentialsJson && tenantName) {
    const credentials = JSON.parse(tenantCredentialsJson);
    const credential = credentials[tenantName];
    if (credential) {
      return {
        baseUrl: readEnv("DEEPDRAW_BASE_URL", DEFAULT_DEEPDRAW_BASE_URL),
        appKey: credential.appKey,
        appSecret: credential.appSecret,
        dopKey: credential.dopKey,
        merchantId: String(credential.merchantId),
        tenantName,
        credentialSource: "env:DEEPDRAW_TENANT_CREDENTIALS_JSON",
      };
    }
  }

  const config = {
    baseUrl: readEnv("DEEPDRAW_BASE_URL", DEFAULT_DEEPDRAW_BASE_URL),
    appKey: readEnv("DEEPDRAW_APP_KEY"),
    appSecret: readEnv("DEEPDRAW_APP_SECRET"),
    dopKey: readEnv("DEEPDRAW_DOP_KEY"),
    merchantId: readEnv("DEEPDRAW_MERCHANT_ID"),
    tenantName: readEnv("DEEPDRAW_TENANT_NAME"),
    credentialSource: "env",
  };
  return [config.appKey, config.appSecret, config.dopKey, config.merchantId].every(Boolean)
    ? config
    : null;
}

export function resolveDeepdrawConfig({
  projectRoot = process.cwd(),
  baseUrl = readEnv("DEEPDRAW_BASE_URL", DEFAULT_DEEPDRAW_BASE_URL),
  tenantName = readEnv("DEEPDRAW_TENANT_NAME", DEFAULT_DEEPDRAW_TENANT_NAME),
  credentialDoc = readEnv("DEEPDRAW_CREDENTIAL_DOC"),
} = {}) {
  const envConfig = configFromEnvForTenant(tenantName) ?? configFromEnv();
  if (envConfig) {
    return {
      ...envConfig,
      baseUrl: normalizeBaseUrl(baseUrl || envConfig.baseUrl),
      tenantName: envConfig.tenantName || tenantName,
    };
  }

  const effectiveCredentialDoc = credentialDoc || defaultCredentialDocPath(projectRoot);
  const text = readCredentialDocText(effectiveCredentialDoc);
  const credentials = parseTenantCredentialsFromText(text, tenantName);
  return {
    ...credentials,
    baseUrl: normalizeBaseUrl(baseUrl),
    credentialSource: path.relative(projectRoot, effectiveCredentialDoc),
  };
}

function sortedEntries(object) {
  return Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function sanitizeDeepdrawQuery(query = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (["dopKey", "merchantId", "type"].includes(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function encodeDeepdrawQuery(params) {
  return sortedEntries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`)
    .join("&");
}

function canonicalResource(requestPath, params) {
  const query = sortedEntries(params)
    .map(([key, value]) => (
      value === undefined || value === null || value === "" ? key : `${key}=${value}`
    ))
    .join("&");
  return query ? `${requestPath}?${query}` : requestPath;
}

export function deepdrawBusinessResult(payload) {
  const top = recordValue(payload);
  const nested = recordValue(top.response);
  const nestedBody = recordValue(nested.body);
  const topBody = recordValue(top.body);
  const responseText = stringValue(nested.response ?? top.response);
  return {
    status: numberValue(top.status),
    code: numberValue(nested.code ?? top.code ?? top.responseCode),
    response: responseText,
    state: responseText.toLowerCase(),
    reason: stringValue(nested.reason ?? nested.message ?? top.reason ?? top.message),
    requestId: stringValue(nested.requestId ?? top.requestId),
    body: hasRecordValue(nestedBody) ? nestedBody : topBody,
  };
}

export function normalizeDeepdrawBusinessPayload(payload) {
  const business = deepdrawBusinessResult(payload);
  return {
    code: business.code,
    response: business.response || null,
    reason: business.reason || null,
    requestId: business.requestId || null,
    body: hasRecordValue(business.body) ? business.body : null,
  };
}

export function hasDeepdrawBusinessBody(payload) {
  return hasRecordValue(deepdrawBusinessResult(payload).body);
}

export function isDeepdrawBusinessSuccess(result) {
  const business = deepdrawBusinessResult(result?.payload);
  const outerStatus = business.status ?? numberValue(result?.status);
  const responseCode = business.code;
  const responseState = business.state;
  return Boolean(result?.ok)
    && (outerStatus === null || outerStatus === 200)
    && (responseCode === null || responseCode === 10200)
    && (!responseState || responseState === "success");
}

export function deepdrawFailureMessage(result) {
  const business = deepdrawBusinessResult(result?.payload);
  const fallbackPayload = recordValue(result?.payload);
  const text = stringValue(result?.text);
  return business.reason
    || stringValue(fallbackPayload.reason ?? fallbackPayload.message ?? fallbackPayload.error)
    || (text.length > 500 ? `${text.slice(0, 500)}...` : text)
    || `DeepDraw request failed with HTTP ${result?.status ?? "unknown"}`;
}

export function buildDeepdrawGetRequest({
  config,
  type,
  query = {},
  now = new Date(),
  nonce = crypto.randomUUID(),
}) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = new URL(REST_V2_PATH, baseUrl);
  const host = url.host;
  const params = {
    dopKey: config.dopKey,
    merchantId: String(config.merchantId),
    ...sanitizeDeepdrawQuery(query),
    type,
  };
  url.search = encodeDeepdrawQuery(params);

  const date = now.toUTCString();
  const timestamp = String(now.getTime());
  const headersForSign = {
    "x-ca-key": config.appKey,
    "x-ca-nonce": nonce,
    "x-ca-signature-method": "HmacSHA256",
    "x-ca-timestamp": timestamp,
  };
  const canonicalHeaders = sortedEntries(headersForSign)
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const stringToSign = [
    "GET",
    "application/json; charset=utf-8",
    "",
    "application/x-www-form-urlencoded; charset=utf-8",
    date,
  ].join("\n") + "\n" + canonicalHeaders + canonicalResource(REST_V2_PATH, params);
  const signature = crypto
    .createHmac("sha256", config.appSecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  return {
    url: url.toString(),
    stringToSign,
    headers: {
      accept: "application/json; charset=utf-8",
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      date,
      host,
      "user-agent": "ALIYUN-ANDROID-DEMO",
      ...headersForSign,
      "x-ca-signature-headers": Object.keys(headersForSign).sort().join(","),
      "x-ca-signature": signature,
      CA_VERSION: "1",
    },
  };
}

export function buildDeepdrawPostRequest({
  config,
  type,
  query = {},
  now = new Date(),
  nonce = crypto.randomUUID(),
}) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = new URL(REST_PATH, baseUrl);
  const host = url.host;
  const params = {
    dopKey: config.dopKey,
    merchantId: String(config.merchantId),
    ...sanitizeDeepdrawQuery(query),
    type,
  };
  url.search = encodeDeepdrawQuery(params);

  const date = now.toUTCString();
  const timestamp = String(now.getTime());
  const headersForSign = {
    "x-ca-key": config.appKey,
    "x-ca-nonce": nonce,
    "x-ca-signature-method": "HmacSHA256",
    "x-ca-timestamp": timestamp,
  };
  const canonicalHeaders = sortedEntries(headersForSign)
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const stringToSign = [
    "POST",
    "application/json; charset=utf-8",
    "",
    "application/x-www-form-urlencoded; charset=utf-8",
    date,
  ].join("\n") + "\n" + canonicalHeaders + canonicalResource(REST_PATH, params);
  const signature = crypto
    .createHmac("sha256", config.appSecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  return {
    url: url.toString(),
    stringToSign,
    headers: {
      accept: "application/json; charset=utf-8",
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      date,
      host,
      "user-agent": "ALIYUN-ANDROID-DEMO",
      ...headersForSign,
      "x-ca-signature-headers": Object.keys(headersForSign).sort().join(","),
      "x-ca-signature": signature,
      CA_VERSION: "1",
    },
  };
}

export async function requestDeepdraw({ config, type, query, timeoutMs = 30000 }) {
  const request = buildDeepdrawGetRequest({ config, type, query });
  const response = await fetch(request.url, {
    method: "GET",
    headers: request.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return {
    status: response.status,
    ok: response.ok,
    requestId: response.headers.get("x-ca-request-id"),
    payload,
    text,
  };
}

export async function requestDeepdrawPost({ config, type, query, timeoutMs = 30000 }) {
  const request = buildDeepdrawPostRequest({ config, type, query });
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return {
    status: response.status,
    ok: response.ok,
    requestId: response.headers.get("x-ca-request-id"),
    payload,
    text,
  };
}

export async function getDeepdrawProduct({ config, productCode, productId, resource, timeoutMs = 30000, adapter } = {}) {
  const resourceAdapter = adapter ?? getDeepdrawProductWithSdk;
  if (typeof resourceAdapter !== "function") {
    throw new Error("DeepDraw product resource adapter must be a function.");
  }
  return resourceAdapter({ config, productCode, productId, resource, timeoutMs });
}

export async function searchDeepdrawProductBasic({ config, productCode, timeoutMs = 30000 }) {
  return requestDeepdraw({
    config,
    type: PRODUCT_BASIC_SEARCH_TYPE,
    query: { productCodes: productCode, pageNo: 1, pageSize: 20, excludeDraft: 0 },
    timeoutMs,
  });
}

export async function createDeepdrawProduct({ config, payload = {}, timeoutMs = 30000, adapter } = {}) {
  const createAdapter = adapter ?? createDeepdrawProductWithSdk;
  if (typeof createAdapter !== "function") {
    throw new Error("DeepDraw product create adapter must be a function.");
  }
  return createAdapter({ config, payload, timeoutMs });
}

export async function getDeepdrawTrades({ config, timeoutMs = 30000 }) {
  return requestDeepdrawPost({
    config,
    type: MERCHANT_TRADES_TYPE,
    query: {},
    timeoutMs,
  });
}

export async function getDeepdrawTradeFields({ config, tradeId, timeoutMs = 30000 }) {
  return requestDeepdrawPost({
    config,
    type: TRADE_FIELDS_TYPE,
    query: { tradeId },
    timeoutMs,
  });
}
