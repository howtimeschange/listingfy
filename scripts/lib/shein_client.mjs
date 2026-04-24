import crypto from "node:crypto";

export const TEST_BASE_URL = "https://openapi-test01.sheincorp.cn";
export const PROD_BASE_URL_CN = "https://openapi.sheincorp.cn";

export const APP_AUTH_PATH = "/open-api/auth/get-by-token";

export function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export function requireEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function normalizeBody(body) {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

function randomKey() {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

export function createSignature(openKeyOrAppId, secretKey, requestPath, timestamp = Date.now().toString()) {
  const prefix = randomKey();
  const signString = `${openKeyOrAppId}&${timestamp}&${requestPath}`;
  const hmacKey = `${secretKey}${prefix}`;
  const hex = crypto.createHmac("sha256", hmacKey).update(signString).digest("hex");
  const encoded = Buffer.from(hex, "utf8").toString("base64");
  return {
    timestamp,
    signature: `${prefix}${encoded}`,
  };
}

export function decryptSecretKey(encryptedSecretKey, appSecretKey) {
  const key = Buffer.alloc(16);
  Buffer.from(appSecretKey, "utf8").copy(key, 0, 0, 16);
  const iv = Buffer.from("space-station-de", "utf8");
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedSecretKey, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function headersForOpenApi(path, method = "POST") {
  const openKeyId = requireEnv("SHEIN_OPEN_KEY_ID");
  const secretKey = requireEnv("SHEIN_SECRET_KEY");
  const { timestamp, signature } = createSignature(openKeyId, secretKey, path);
  const headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "x-lt-openKeyId": openKeyId,
    "x-lt-timestamp": timestamp,
    "x-lt-signature": signature,
    language: readEnv("SHEIN_LANGUAGE", "zh-cn"),
  };
  if (method === "GET") {
    delete headers["Content-Type"];
  }
  return headers;
}

export function headersForAppAuth(path) {
  const appId = requireEnv("SHEIN_APP_ID");
  const appSecretKey = requireEnv("SHEIN_APP_SECRET_KEY");
  const { timestamp, signature } = createSignature(appId, appSecretKey, path);
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "x-lt-appid": appId,
    "x-lt-timestamp": timestamp,
    "x-lt-signature": signature,
    language: readEnv("SHEIN_LANGUAGE", "zh-cn"),
  };
}

export async function requestShein(path, { method = "POST", body, appAuth = false, baseUrl } = {}) {
  const effectiveBaseUrl = baseUrl || readEnv("SHEIN_BASE_URL", TEST_BASE_URL);
  const url = new URL(path, effectiveBaseUrl);
  const headers = appAuth ? headersForAppAuth(path) : headersForOpenApi(path, method);
  const normalizedBody = normalizeBody(body);
  const response = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : normalizedBody,
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
    payload,
  };
}

export function isRetryableSheinResult(result) {
  const code = result?.payload?.code;
  return result?.status >= 500 || code === "openapi00006";
}

export async function requestSheinWithRetry(path, options = {}) {
  const {
    retries = 3,
    retryDelayMs = 1000,
    ...requestOptions
  } = options;
  let lastResult;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    lastResult = await requestShein(path, requestOptions);
    if (!isRetryableSheinResult(lastResult) || attempt === retries) {
      return lastResult;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
  }
  return lastResult;
}

export function assertSheinSuccess(result, context) {
  if (result?.payload?.code !== "0") {
    const code = result?.payload?.code ?? result?.status;
    const msg = result?.payload?.msg ?? "Unknown error";
    throw new Error(`${context} failed: ${code} ${msg}`);
  }
}
