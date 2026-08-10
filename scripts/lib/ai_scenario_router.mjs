import {
  callAiChatCompletion,
  extractAiJsonText,
  resolveAiConfig,
} from "./ai_chat_client.mjs";

const SCENARIO_ROUTES = {
  title_translation: {
    defaultMode: "shadow",
    guardedRoute: [
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-terra" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
    ],
    shadowRoute: [
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-terra" },
    ],
  },
  size_mapping: {
    defaultMode: "shadow",
    guardedRoute: [
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
    shadowRoute: [
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
    ],
  },
  shein_attribute: {
    defaultMode: "shadow",
    guardedRoute: [
      { providerKey: "semir_overseas_openai", model: "gemini-3-flash-preview" },
      { providerKey: "semir_domestic_openai", model: "deepseek-v4-pro" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
    shadowRoute: [
      { providerKey: "semir_overseas_openai", model: "gemini-3-flash-preview" },
    ],
  },
  shein_description: {
    defaultMode: "shadow",
    guardedRoute: [
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
      { providerKey: "semir_domestic_openai", model: "deepseek-v4-pro" },
    ],
    shadowRoute: [
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
    ],
  },
  deepdraw_field_fill: {
    defaultMode: "shadow",
    guardedRoute: [
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
    ],
    shadowRoute: [
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
    ],
  },
  shein_category: {
    defaultMode: "shadow",
    maxMode: "shadow",
    guardedRoute: [],
    shadowRoute: [
      {
        providerKey: "semir_domestic_openai",
        model: "deepseek-v4-pro",
        textOnly: true,
      },
    ],
  },
  neutral_skc: {
    defaultMode: "disabled",
    maxMode: "disabled",
    guardedRoute: [],
    shadowRoute: [],
  },
  deepdraw_trade: {
    defaultMode: "disabled",
    maxMode: "disabled",
    guardedRoute: [],
    shadowRoute: [],
  },
};

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function scenarioEnvKey(scenario) {
  return `AI_SCENARIO_${scenario.toUpperCase()}_MODE`;
}

function providerConfig({
  key,
  protocol,
  defaultBaseUrl,
  baseUrl,
  apiKey,
}) {
  if (!apiKey) return null;
  return {
    key,
    protocol,
    baseUrl: String(baseUrl || defaultBaseUrl).replace(/\/+$/, ""),
    apiKey,
  };
}

export function resolveAiProviderRegistry(env = process.env) {
  const providers = [
    providerConfig({
      key: "semir_overseas_openai",
      protocol: "openai",
      defaultBaseUrl: "https://ai-aigw.semir.com/overseas-openai-vip/v1",
      baseUrl: env.AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_BASE_URL,
      apiKey: env.AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY,
    }),
    providerConfig({
      key: "semir_overseas_anthropic",
      protocol: "anthropic",
      defaultBaseUrl: "https://ai-aigw.semir.com/overseas-anthropic-vip",
      baseUrl: env.AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_BASE_URL,
      apiKey: env.AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_API_KEY,
    }),
    providerConfig({
      key: "semir_domestic_openai",
      protocol: "openai",
      defaultBaseUrl: "https://ai-aigw.semir.com/bailian-codingplan/v1",
      baseUrl: env.AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_BASE_URL,
      apiKey: env.AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY,
    }),
    providerConfig({
      key: "current_1xm",
      protocol: "openai",
      defaultBaseUrl: "https://api.1xm.ai/v1",
      baseUrl: env.AI_PROVIDER_1XM_BASE_URL,
      apiKey: env.AI_PROVIDER_1XM_API_KEY || env.AI_API_KEY,
    }),
  ].filter(Boolean);

  return Object.fromEntries(providers.map((provider) => [provider.key, provider]));
}

function requestedMode(route, scenario, env) {
  if (!enabled(env.AI_ROUTING_ENABLED)) return "legacy";
  const requested = String(env[scenarioEnvKey(scenario)] ?? route.defaultMode)
    .trim()
    .toLowerCase();
  const normalized = ["legacy", "shadow", "guarded", "disabled"].includes(requested)
    ? requested
    : route.defaultMode;
  if (route.maxMode === "disabled") return "disabled";
  if (route.maxMode === "shadow" && normalized === "guarded") return "shadow";
  return normalized;
}

export function resolveAiScenarioPolicy(scenario, env = process.env) {
  const route = SCENARIO_ROUTES[scenario];
  if (!route) throw new Error(`Unknown AI scenario: ${scenario}`);

  return {
    scenario,
    mode: requestedMode(route, scenario, env),
    guardedRoute: route.guardedRoute.map((item) => ({ ...item })),
    shadowRoute: route.shadowRoute.map((item) => ({ ...item })),
  };
}

function timestampMs(now) {
  const value = now();
  return value instanceof Date ? value.getTime() : Number(value);
}

function dateKey(now) {
  return new Date(timestampMs(now)).toISOString().slice(0, 10);
}

function budgetLimit(value, fallback = Number.POSITIVE_INFINITY) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function nextUtcDateBoundaryMs(now) {
  const value = new Date(timestampMs(now));
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate() + 1,
  );
}

function dailyQuotaError(error) {
  return /daily|quota.{0,30}(?:exhaust|limit)|(?:exhaust|limit).{0,30}quota|日额度|当日额度|配额.*(?:耗尽|上限)/i
    .test(String(error?.message ?? ""));
}

function responseContent(body) {
  const message = body?.choices?.[0]?.message;
  for (const value of [
    message?.content,
    message?.reasoning_content,
    message?.reasoning,
  ]) {
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string"
          ? part
          : part?.text ?? part?.content ?? "")
        .join("\n")
        .trim();
      if (text) return text;
    }
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function usageFromBody(body) {
  return {
    inputTokens: Number.isFinite(Number(body?.usage?.prompt_tokens))
      ? Number(body.usage.prompt_tokens)
      : Number.isFinite(Number(body?.usage?.input_tokens))
        ? Number(body.usage.input_tokens)
        : null,
    outputTokens: Number.isFinite(Number(body?.usage?.completion_tokens))
      ? Number(body.usage.completion_tokens)
      : Number.isFinite(Number(body?.usage?.output_tokens))
        ? Number(body.usage.output_tokens)
        : null,
    totalTokens: Number.isFinite(Number(body?.usage?.total_tokens))
      ? Number(body.usage.total_tokens)
      : null,
  };
}

function retryAfterMs(response) {
  const value = response.headers.get("retry-after");
  if (!value) return 120000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(1000, timestamp - Date.now()) : 120000;
}

function attemptStatus(httpStatus) {
  if (httpStatus === 429) return "RATE_LIMITED";
  if (httpStatus === 401 || httpStatus === 403) return "MISCONFIGURED";
  return "FAILED";
}

function safeAudit(audit, event) {
  try {
    Promise.resolve(audit?.(event)).catch(() => {});
  } catch {
    // Audit transport must never change the business fallback path.
  }
}

function auditResult(project, json) {
  if (typeof project !== "function") return null;
  try {
    return project(json);
  } catch {
    return null;
  }
}

function textOnlyMessages(messages) {
  return messages.map((message) => {
    if (typeof message?.content === "string") {
      return {
        ...message,
        content: scrubTextOnlyReferences(message.content),
      };
    }
    if (!Array.isArray(message?.content)) return message;
    return {
      ...message,
      content: message.content
        .filter((part) =>
          typeof part === "string"
          || part?.type === "text",
        )
        .map((part) => typeof part === "string"
          ? scrubTextOnlyReferences(part)
          : {
            ...part,
            text: scrubTextOnlyReferences(part.text),
          }),
    };
  });
}

function scrubTextOnlyReferences(value) {
  return String(value ?? "")
    .replace(
      /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi,
      "[image omitted]",
    )
    .replace(
      /https?:\/\/[^\s"'<>)}\]]+/gi,
      "[url omitted]",
    );
}

async function callOpenAi({
  provider,
  model,
  messages,
  fetchImpl,
  timeoutMs,
  temperature,
  responseFormat,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: responseFormat,
        messages,
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(
        body?.error?.message
        ?? body?.message
        ?? `AI request failed: HTTP ${response.status}`,
      );
      error.httpStatus = response.status;
      error.retryAfterMs = retryAfterMs(response);
      throw error;
    }
    const content = responseContent(body);
    if (!content) throw new Error("AI response did not include message content");
    return {
      content,
      raw: body,
      httpStatus: response.status,
      usage: usageFromBody(body),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function messageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content
    .filter((part) => typeof part === "string" || part?.type === "text")
    .map((part) => typeof part === "string" ? part : part.text)
    .join("\n");
}

async function callAnthropic({
  provider,
  model,
  messages,
  fetchImpl,
  timeoutMs,
  temperature,
  maxTokens = 2048,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => messageText(message.content))
      .filter(Boolean)
      .join("\n\n");
    const anthropicMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: messageText(message.content),
      }));
    const response = await fetchImpl(`${provider.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: anthropicMessages,
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(
        body?.error?.message
        ?? body?.message
        ?? `AI request failed: HTTP ${response.status}`,
      );
      error.httpStatus = response.status;
      error.retryAfterMs = retryAfterMs(response);
      throw error;
    }
    const content = Array.isArray(body?.content)
      ? body.content
        .filter((part) => part?.type === "text")
        .map((part) => part.text ?? "")
        .join("\n")
        .trim()
      : "";
    if (!content) throw new Error("AI response did not include message content");
    const inputTokens = Number.isFinite(Number(body?.usage?.input_tokens))
      ? Number(body.usage.input_tokens)
      : null;
    const outputTokens = Number.isFinite(Number(body?.usage?.output_tokens))
      ? Number(body.usage.output_tokens)
      : null;
    return {
      content,
      raw: body,
      httpStatus: response.status,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens != null && outputTokens != null
          ? inputTokens + outputTokens
          : null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeAiProvider(input) {
  if (input.provider.protocol === "openai") return callOpenAi(input);
  if (input.provider.protocol === "anthropic") return callAnthropic(input);
  throw new Error(`Unsupported AI protocol: ${input.provider.protocol}`);
}

function transientError(error) {
  const status = Number(error?.httpStatus);
  const code = error?.cause?.code ?? error?.code;
  return status >= 500
    || error?.name === "AbortError"
    || String(error?.message ?? "") === "fetch failed"
    || ["UND_ERR_SOCKET", "ECONNRESET", "ETIMEDOUT"].includes(code);
}

async function invokeProviderWithRetry(input) {
  for (let transportAttempts = 1; transportAttempts <= 2; transportAttempts += 1) {
    try {
      return {
        response: await invokeAiProvider(input),
        transportAttempts,
      };
    } catch (error) {
      if (transportAttempts === 1 && transientError(error)) {
        await input.sleep(200);
        continue;
      }
      error.transportAttempts = transportAttempts;
      throw error;
    }
  }
  throw new Error("AI request failed after retry");
}

export function createAiScenarioRouter({
  env = process.env,
  fetchImpl = globalThis.fetch,
  audit = null,
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  modelStateStore = null,
  usageStore = null,
} = {}) {
  const registry = resolveAiProviderRegistry(env);
  const localModelState = new Map();
  const stateStore = modelStateStore ?? {
    get: (key) => localModelState.get(key) ?? null,
    set: (key, value) => localModelState.set(key, value),
  };
  const pendingTasks = new Set();
  const localPaidUsage = new Map();
  const paidStore = usageStore ?? {
    get(date, providerKey) {
      return localPaidUsage.get(`${date}:${providerKey}`) ?? { requests: 0, tokens: 0 };
    },
    incrementRequest(date, providerKey) {
      const key = `${date}:${providerKey}`;
      const usage = this.get(date, providerKey);
      localPaidUsage.set(key, { ...usage, requests: usage.requests + 1 });
    },
    addTokens(date, providerKey, tokens) {
      const key = `${date}:${providerKey}`;
      const usage = this.get(date, providerKey);
      localPaidUsage.set(key, { ...usage, tokens: usage.tokens + tokens });
    },
  };
  const responseCache = new Map();

  function cacheKey(input) {
    if (!input.inputHash) return null;
    return [
      input.scenario,
      input.inputHash,
      input.candidateHash ?? "",
      input.promptVersion ?? "unversioned",
    ].join("\u0000");
  }

  function cachedResult(input) {
    const key = cacheKey(input);
    if (!key) return null;
    const entry = responseCache.get(key);
    if (!entry) return null;
    const ttlMs = Number(env.AI_ROUTING_CACHE_TTL_MS) || 600000;
    if (timestampMs(now) - entry.savedAt > ttlMs) {
      responseCache.delete(key);
      return null;
    }
    return {
      ...entry.result,
      routing: {
        ...entry.result.routing,
        cacheHit: true,
      },
    };
  }

  function saveCachedResult(input, result) {
    const key = cacheKey(input);
    if (!key) return;
    responseCache.set(key, {
      savedAt: timestampMs(now),
      result,
    });
  }

  async function callGuardedJson({
    scenario,
    messages,
    promptVersion = "unversioned",
    inputHash = null,
    candidateHash = null,
    validate = () => true,
    auditValue = null,
    temperature = 0.1,
    responseFormat = { type: "json_object" },
  }, {
    routeList = null,
    role = "production",
  } = {}) {
    const policy = resolveAiScenarioPolicy(scenario, env);
    const attempts = [];
    let fallbackReason = null;

    for (const route of routeList ?? policy.guardedRoute) {
      const provider = registry[route.providerKey];
      if (!provider) {
        fallbackReason = "PROVIDER_UNAVAILABLE";
        continue;
      }
      const stateKey = `${route.providerKey}:${route.model}`;
      const currentState = stateStore.get(stateKey);
      const blockedUntil = Number(currentState?.blockedUntil ?? 0);
      if (blockedUntil > timestampMs(now)) {
        fallbackReason = "MODEL_COOLDOWN";
        continue;
      }
      if (route.providerKey === "current_1xm") {
        const usageKey = dateKey(now);
        const requestBudget = budgetLimit(
          env.AI_1XM_DAILY_REQUEST_BUDGET,
          0,
        );
        const tokenBudget = budgetLimit(env.AI_1XM_DAILY_TOKEN_BUDGET);
        const reserved = typeof paidStore.tryReserveRequest === "function"
          ? paidStore.tryReserveRequest(
            usageKey,
            route.providerKey,
            requestBudget,
            tokenBudget,
          )
          : (() => {
            const usage = paidStore.get(usageKey, route.providerKey);
            if (
              usage.requests >= requestBudget
              || usage.tokens >= tokenBudget
            ) {
              return false;
            }
            paidStore.incrementRequest(usageKey, route.providerKey);
            return true;
          })();
        if (!reserved) {
          fallbackReason = "USER_PAID_BUDGET_EXHAUSTED";
          safeAudit(audit, {
            scenario,
            mode: policy.mode,
            role,
            promptVersion,
            inputHash,
            candidateHash,
            providerKey: route.providerKey,
            model: route.model,
            status: "BUDGET_EXHAUSTED",
            httpStatus: null,
            latencyMs: 0,
          });
          continue;
        }
      }

      const startedAt = timestampMs(now);
      try {
        const { response, transportAttempts } = await invokeProviderWithRetry({
          provider,
          model: route.model,
          messages: route.textOnly ? textOnlyMessages(messages) : messages,
          fetchImpl,
          timeoutMs: Number(env.AI_TIMEOUT_MS) || 120000,
          temperature,
          responseFormat,
          sleep,
        });
        const json = JSON.parse(extractAiJsonText(response.content));
        if (!validate(json)) {
          const error = new Error("AI response failed scenario validation");
          error.code = "SCHEMA_INVALID";
          throw error;
        }
        const attempt = {
          providerKey: route.providerKey,
          model: route.model,
          status: "SUCCEEDED",
          httpStatus: response.httpStatus,
          latencyMs: Math.max(0, timestampMs(now) - startedAt),
          transportAttempts,
          usage: response.usage,
          result: auditResult(auditValue, json),
        };
        attempts.push(attempt);
        if (route.providerKey === "current_1xm") {
          const usageKey = dateKey(now);
          paidStore.addTokens(
            usageKey,
            route.providerKey,
            Number(response.usage?.totalTokens ?? 0),
          );
        }
        if (
          currentState
          && (
            currentState.status !== "HEALTHY"
            || Number(currentState.failureCount ?? 0) > 0
          )
        ) {
          stateStore.set(stateKey, {
            status: "HEALTHY",
            blockedUntil: 0,
            failureCount: 0,
          });
        }
        safeAudit(audit, {
          scenario,
          mode: policy.mode,
          role,
          promptVersion,
          inputHash,
          candidateHash,
          ...attempt,
        });
        return {
          content: response.content,
          json,
          raw: response.raw,
          provider: {
            key: route.providerKey,
            protocol: provider.protocol,
            baseUrl: provider.baseUrl,
            model: route.model,
          },
          routing: {
            scenario,
            mode: policy.mode,
            fallbackReason,
            attempts,
          },
        };
      } catch (error) {
        const httpStatus = Number(error?.httpStatus) || null;
        let status = attemptStatus(httpStatus);
        const failureCount = Number(currentState?.failureCount ?? 0) + 1;
        if (httpStatus === 429) {
          const quotaExhausted = dailyQuotaError(error)
            || (
              currentState?.status === "RATE_LIMITED"
              && Number(currentState?.failureCount ?? 0) >= 1
            );
          status = quotaExhausted ? "QUOTA_EXHAUSTED" : "RATE_LIMITED";
          stateStore.set(stateKey, {
            status,
            blockedUntil: quotaExhausted
              ? nextUtcDateBoundaryMs(now)
              : timestampMs(now) + Number(error.retryAfterMs || 120000),
            failureCount,
          });
        } else if (httpStatus === 401 || httpStatus === 403) {
          stateStore.set(stateKey, {
            status: "MISCONFIGURED",
            blockedUntil: timestampMs(now)
              + (Number(env.AI_ROUTING_MISCONFIGURED_COOLDOWN_MS) || 300000),
            failureCount,
          });
        } else if (transientError(error)) {
          const failureThreshold = Math.max(
            1,
            Number(env.AI_ROUTING_CIRCUIT_FAILURE_THRESHOLD) || 3,
          );
          const circuitOpen = failureCount >= failureThreshold;
          stateStore.set(stateKey, {
            status: circuitOpen ? "CIRCUIT_OPEN" : "FAILED",
            blockedUntil: circuitOpen
              ? timestampMs(now)
                + (Number(env.AI_ROUTING_CIRCUIT_COOLDOWN_MS) || 60000)
              : 0,
            failureCount,
          });
        }
        const attempt = {
          providerKey: route.providerKey,
          model: route.model,
          status,
          httpStatus,
          latencyMs: Math.max(0, timestampMs(now) - startedAt),
          errorCode: error?.code ?? null,
          transportAttempts: Number(error?.transportAttempts) || 1,
        };
        attempts.push(attempt);
        fallbackReason = httpStatus === 429 ? status : error?.code ?? "MODEL_FAILED";
        safeAudit(audit, {
          scenario,
          mode: policy.mode,
          role,
          promptVersion,
          inputHash,
          candidateHash,
          ...attempt,
        });
      }
    }

    const error = new Error(`No admitted AI model succeeded for scenario: ${scenario}`);
    error.attempts = attempts;
    error.fallbackReason = fallbackReason;
    throw error;
  }

  async function callLegacyJson({
    scenario,
    messages,
    promptVersion = "unversioned",
    inputHash = null,
    candidateHash = null,
    validate = () => true,
    auditValue = null,
    temperature = 0.1,
    responseFormat = { type: "json_object" },
  }, mode) {
    const config = resolveAiConfig({
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
      apiKey: env.AI_API_KEY,
      timeoutMs: Number(env.AI_TIMEOUT_MS) || undefined,
    });
    const startedAt = timestampMs(now);
    try {
      const response = await callAiChatCompletion({
        messages,
        config,
        fetchImpl,
        temperature,
        responseFormat,
        errorLabel: `AI ${scenario}`,
      });
      const json = JSON.parse(extractAiJsonText(response.content));
      if (!validate(json)) {
        const error = new Error("Legacy AI response failed scenario validation");
        error.code = "SCHEMA_INVALID";
        throw error;
      }
      const attempt = {
        role: "production",
        providerKey: "legacy",
        model: config.model,
        status: "SUCCEEDED",
        httpStatus: 200,
        latencyMs: Math.max(0, timestampMs(now) - startedAt),
        result: auditResult(auditValue, json),
      };
      safeAudit(audit, {
        scenario,
        mode,
        promptVersion,
        inputHash,
        candidateHash,
        ...attempt,
      });
      return {
        ...response,
        json,
        provider: {
          key: "legacy",
          protocol: "openai",
          baseUrl: config.baseUrl,
          model: config.model,
        },
        routing: {
          scenario,
          mode,
          fallbackReason: null,
          attempts: [attempt],
        },
      };
    } catch (error) {
      safeAudit(audit, {
        scenario,
        mode,
        role: "production",
        promptVersion,
        inputHash,
        candidateHash,
        providerKey: "legacy",
        model: config.model,
        status: "FAILED",
        httpStatus: Number(error?.httpStatus) || null,
        latencyMs: Math.max(0, timestampMs(now) - startedAt),
        errorCode: error?.code ?? null,
      });
      throw error;
    }
  }

  function scheduleShadow(input, policy) {
    if (policy.shadowRoute.length === 0) return false;
    let task;
    task = callGuardedJson(input, {
      routeList: policy.shadowRoute,
      role: "shadow",
    })
      .catch(() => null)
      .finally(() => pendingTasks.delete(task));
    pendingTasks.add(task);
    return true;
  }

  return {
    async callJson(input) {
      const policy = resolveAiScenarioPolicy(input.scenario, env);
      if (policy.mode === "guarded") {
        const cached = cachedResult(input);
        if (cached) return cached;
        const result = await callGuardedJson(input);
        saveCachedResult(input, result);
        return result;
      }
      if (policy.mode === "legacy") {
        return callLegacyJson(input, policy.mode);
      }
      if (policy.mode === "shadow") {
        const shadowScheduled = scheduleShadow(input, policy);
        const result = await callLegacyJson(input, policy.mode);
        result.routing.shadowScheduled = shadowScheduled;
        return result;
      }
      throw new Error(`AI scenario is disabled: ${input.scenario}`);
    },
    async flush() {
      await Promise.allSettled([...pendingTasks]);
    },
  };
}
