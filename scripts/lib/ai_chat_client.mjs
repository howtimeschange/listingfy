import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export const DEFAULT_AI_BASE_URL = "https://api.1xm.ai/v1";
export const DEFAULT_AI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_AI_TIMEOUT_MS = 120000;
export const DEFAULT_AI_IMAGE_INLINE_MAX_BYTES = 4 * 1024 * 1024;
export const DEFAULT_AI_IMAGE_INLINE_LIMIT = 8;

function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

export function resolveAiConfig({
  baseUrl = readEnv("AI_BASE_URL", DEFAULT_AI_BASE_URL),
  model = readEnv("AI_MODEL", DEFAULT_AI_MODEL),
  apiKey = readEnv("AI_API_KEY"),
  timeoutMs = Number(readEnv("AI_TIMEOUT_MS", DEFAULT_AI_TIMEOUT_MS)),
} = {}) {
  return {
    baseUrl: String(baseUrl || DEFAULT_AI_BASE_URL).replace(/\/+$/, ""),
    model,
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_AI_TIMEOUT_MS,
  };
}

export function extractAiJsonText(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function isGeminiModel(model) {
  return /\bgemini(?:[-_.]|$)/i.test(String(model ?? ""));
}

function inlineRemoteImagesEnabled(value) {
  return !/^(0|false|no|off)$/i.test(String(value ?? "").trim());
}

function messageImageUrl(part) {
  const url = part?.image_url?.url ?? part?.image_url;
  return typeof url === "string" ? url.trim() : "";
}

function isRemoteImageUrl(url) {
  return /^https?:\/\//i.test(String(url ?? ""));
}

function isDataImageUrl(url) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url ?? ""));
}

function contentTypeMimeType(value) {
  return String(value ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function imageMimeTypeFromUrl(url) {
  const cleanPath = String(url ?? "").split("?")[0]?.split("#")[0] ?? "";
  const extension = cleanPath.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function privateOrReservedIpv4Address(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [first, second, third] = parts;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 2)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

function proxyFakeIpv4Address(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 198 && (second === 18 || second === 19);
}

function privateOrReservedIpv6Address(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) !== 4 || privateOrReservedIpv4Address(mapped);
  }
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fe80:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("fec")
    || normalized.startsWith("fed")
    || normalized.startsWith("fee")
    || normalized.startsWith("fef")
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8");
}

function privateOrReservedIpAddress(address) {
  const normalized = String(address ?? "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return privateOrReservedIpv4Address(normalized);
  if (ipVersion === 6) return privateOrReservedIpv6Address(normalized);
  return true;
}

function allowedResolvedRemoteImageAddress(address) {
  const normalized = String(address ?? "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  return proxyFakeIpv4Address(normalized) || !privateOrReservedIpAddress(normalized);
}

async function allowedRemoteImageUrl(url, lookupImpl = dnsLookup) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (
    !hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".lan")
  ) {
    return false;
  }
  if (isIP(hostname)) return !privateOrReservedIpAddress(hostname);
  let addresses;
  try {
    addresses = await lookupImpl(hostname, { all: true, verbatim: true });
  } catch {
    return false;
  }
  return Array.isArray(addresses)
    && addresses.length > 0
    && addresses.every((item) => allowedResolvedRemoteImageAddress(item.address));
}

async function readResponseBufferCapped(response, maxBytes) {
  if (!response.body?.getReader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > maxBytes) return null;
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) return null;
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes <= 0) return null;
  return Buffer.concat(chunks, totalBytes);
}

async function fetchImageDataUrl({
  url,
  fetchImpl,
  timeoutMs,
  maxBytes,
  lookupImpl,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (!await allowedRemoteImageUrl(url, lookupImpl)) return null;
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
    const buffer = await readResponseBufferCapped(response, maxBytes);
    if (!buffer) return null;
    const contentType = contentTypeMimeType(response.headers?.get?.("content-type"));
    const mimeType = /^image\/(?:jpeg|png|webp)$/i.test(contentType)
      ? contentType
      : imageMimeTypeFromUrl(url);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function inlineGeminiContentImages({
  content,
  fetchImpl,
  timeoutMs,
  maxBytes,
  lookupImpl,
  state,
}) {
  if (!Array.isArray(content)) return content;
  const output = [];
  for (const part of content) {
    const url = messageImageUrl(part);
    if (
      !url
      || isDataImageUrl(url)
      || !isRemoteImageUrl(url)
      || state.inlined >= state.limit
    ) {
      output.push(part);
      continue;
    }

    const dataUrl = await fetchImageDataUrl({
      url,
      fetchImpl,
      timeoutMs,
      maxBytes,
      lookupImpl,
    });
    if (!dataUrl) {
      output.push(part);
      continue;
    }
    state.inlined += 1;
    output.push({
      ...part,
      image_url: {
        ...(typeof part.image_url === "object" && part.image_url != null ? part.image_url : {}),
        url: dataUrl,
      },
    });
  }
  return output;
}

export async function normalizeAiMessagesForModel({
  messages,
  model,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AI_TIMEOUT_MS,
  inlineRemoteImages = readEnv("AI_GEMINI_INLINE_REMOTE_IMAGES", "true"),
  maxImageBytes = readEnv("AI_GEMINI_INLINE_IMAGE_MAX_BYTES", DEFAULT_AI_IMAGE_INLINE_MAX_BYTES),
  maxImages = readEnv("AI_GEMINI_INLINE_IMAGE_LIMIT", DEFAULT_AI_IMAGE_INLINE_LIMIT),
  lookupImpl = dnsLookup,
} = {}) {
  if (!isGeminiModel(model) || !inlineRemoteImagesEnabled(inlineRemoteImages)) {
    return messages;
  }
  const state = {
    inlined: 0,
    limit: positiveInteger(maxImages, DEFAULT_AI_IMAGE_INLINE_LIMIT),
  };
  const maxBytes = positiveInteger(maxImageBytes, DEFAULT_AI_IMAGE_INLINE_MAX_BYTES);
  const imageFetchTimeoutMs = Math.min(Number(timeoutMs) || DEFAULT_AI_TIMEOUT_MS, 15000);
  const normalized = [];
  for (const message of messages ?? []) {
    normalized.push({
      ...message,
      content: await inlineGeminiContentImages({
        content: message?.content,
        fetchImpl,
        timeoutMs: imageFetchTimeoutMs,
        maxBytes,
        lookupImpl,
        state,
      }),
    });
  }
  return normalized;
}

function responseMessageContent(body) {
  const message = body?.choices?.[0]?.message;
  const values = [
    message?.content,
    message?.reasoning_content,
    message?.reasoning,
  ];
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string" ? part : part?.text ?? part?.content ?? "")
        .join("\n")
        .trim();
      if (text) return text;
    } else if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableAiError(error) {
  const message = String(error?.message ?? "");
  const code = error?.cause?.code ?? error?.code;
  return error?.name === "AbortError"
    || message === "fetch failed"
    || code === "UND_ERR_SOCKET"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT";
}

export async function callAiChatCompletion({
  messages,
  config = resolveAiConfig(),
  fetchImpl = globalThis.fetch,
  lookupImpl,
  temperature = 0.1,
  responseFormat = { type: "json_object" },
  errorLabel = "AI request",
}) {
  if (!config.apiKey) throw new Error("Missing required env: AI_API_KEY");
  const normalizedMessages = await normalizeAiMessagesForModel({
    messages,
    model: config.model,
    fetchImpl,
    timeoutMs: config.timeoutMs,
    lookupImpl,
  });

  const requestBody = JSON.stringify({
    model: config.model,
    temperature,
    response_format: responseFormat,
    messages: normalizedMessages,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body?.error?.message ?? body?.message ?? `${errorLabel} failed: HTTP ${response.status}`;
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await sleep(800);
          continue;
        }
        throw new Error(message);
      }

      const content = responseMessageContent(body);
      if (!content) throw new Error(`${errorLabel} did not include message content`);
      return {
        content,
        raw: body,
        provider: { baseUrl: config.baseUrl, model: config.model },
      };
    } catch (error) {
      if (attempt === 0 && retryableAiError(error)) {
        await sleep(800);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${errorLabel} failed after retry`);
}

export async function callAiChatJson(options) {
  const response = await callAiChatCompletion(options);
  return {
    ...response,
    json: JSON.parse(extractAiJsonText(response.content)),
  };
}
