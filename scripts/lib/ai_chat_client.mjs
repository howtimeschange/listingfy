export const DEFAULT_AI_BASE_URL = "https://api.1xm.ai/v1";
export const DEFAULT_AI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_AI_TIMEOUT_MS = 120000;

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
  temperature = 0.1,
  responseFormat = { type: "json_object" },
  errorLabel = "AI request",
}) {
  if (!config.apiKey) throw new Error("Missing required env: AI_API_KEY");

  const requestBody = JSON.stringify({
    model: config.model,
    temperature,
    response_format: responseFormat,
    messages,
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
