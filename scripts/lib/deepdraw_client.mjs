import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_DEEPDRAW_BASE_URL = "http://open.deepdraw.cn";
export const DEFAULT_DEEPDRAW_TENANT_NAME = "电商巴拉巴拉";
export const PRODUCT_RESOURCE_TYPE = "dp.product.resource";
export const REST_V2_PATH = "/rest/v2";

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
    ...query,
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

export async function getDeepdrawProduct({ config, productCode, timeoutMs = 30000 }) {
  return requestDeepdraw({
    config,
    type: PRODUCT_RESOURCE_TYPE,
    query: { productCode },
    timeoutMs,
  });
}
