import { randomUUID } from "node:crypto";

export const DEFAULT_MDM_BASE_URL = "https://mdm.semirapp.com";
const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;
const tokenCache = new Map();

function trimBaseUrl(value) {
  return String(value || DEFAULT_MDM_BASE_URL).replace(/\/+$/, "");
}

function required(value, name) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function extractToken(payload) {
  return payload?.token
    ?? payload?.TOKEN
    ?? payload?.data?.token
    ?? payload?.data?.TOKEN
    ?? payload?.DATA?.token
    ?? payload?.DATA?.TOKEN
    ?? payload?.result?.token
    ?? payload?.result?.TOKEN;
}

function tokenCacheKey(config) {
  return [config.baseUrl, config.appId, config.appKey].join("\n");
}

export function clearMdmTokenCache() {
  tokenCache.clear();
}

export function resolveMdmConfig({
  baseUrl = process.env.MDM_BASE_URL,
  appId = process.env.MDM_APP_ID,
  appKey = process.env.MDM_APP_KEY,
} = {}) {
  return {
    baseUrl: trimBaseUrl(baseUrl),
    appId: required(appId, "MDM_APP_ID"),
    appKey: required(appKey, "MDM_APP_KEY"),
  };
}

export async function getMdmToken({ config, timeoutMs = 30000 }) {
  const cacheKey = tokenCacheKey(config);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL(`${config.baseUrl}/demdm-api/open/api/getToken`);
  url.searchParams.set("APP_ID", config.appId);
  url.searchParams.set("APP_KEY", config.appKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`MDM token request failed with HTTP ${res.status}`);
    }
    const token = extractToken(payload);
    if (!token) {
      throw new Error(`MDM token response does not contain a token: ${JSON.stringify(payload)}`);
    }
    const value = {
      token: String(token),
      payload,
    };
    tokenCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function queryMdmPage({
  config,
  token,
  endpoint,
  formCode,
  spuCode,
  page,
  pageSize,
  timeoutMs,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        demdmtoken: token,
      },
      body: JSON.stringify({
        UUID: randomUUID(),
        PAGE: String(page),
        PAGE_SIZE: String(pageSize),
        FORM_CODE: formCode,
        DATA: {
          MDM_CODE: spuCode,
        },
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`MDM ${formCode} query failed with HTTP ${res.status}`);
    }
    if (payload?.RESULT && payload.RESULT !== "S") {
      throw new Error(`MDM ${formCode} query failed: ${payload.ERROR_CODE || payload.MESSAGE || payload.RESULT}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function queryAllPages({
  config,
  token,
  endpoint,
  formCode,
  spuCode,
  pageSize = 50,
  timeoutMs = 30000,
}) {
  const rows = [];
  const pages = [];
  let page = 1;
  while (page <= 100) {
    const payload = await queryMdmPage({
      config,
      token,
      endpoint,
      formCode,
      spuCode,
      page,
      pageSize,
      timeoutMs,
    });
    pages.push(payload);
    rows.push(...(Array.isArray(payload?.DATA) ? payload.DATA : []));
    const lastPage = Number(payload?.LAST_PAGE ?? page);
    if (!Number.isFinite(lastPage) || page >= lastPage) break;
    page += 1;
  }
  return {
    rows,
    pages,
  };
}

export async function queryMdmProduct({
  config = resolveMdmConfig(),
  spuCode,
  pageSize = 50,
  timeoutMs = 30000,
} = {}) {
  const code = required(spuCode, "spuCode");
  const tokenResult = await getMdmToken({ config, timeoutMs });
  const [spu, sku] = await Promise.all([
    queryAllPages({
      config,
      token: tokenResult.token,
      endpoint: "/demdm-api/open/api/v2/selectApi/SAP_SPU",
      formCode: "PRODUCT_SPU",
      spuCode: code,
      pageSize,
      timeoutMs,
    }),
    queryAllPages({
      config,
      token: tokenResult.token,
      endpoint: "/demdm-api/open/api/v2/selectApi/SKU_LIST",
      formCode: "PRODUCT_SKU",
      spuCode: code,
      pageSize,
      timeoutMs,
    }),
  ]);

  return {
    spuCode: code,
    spuRows: spu.rows,
    skuRows: sku.rows,
    raw: {
      token: tokenResult.payload,
      spuPages: spu.pages,
      skuPages: sku.pages,
    },
  };
}
