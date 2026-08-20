import assert from "node:assert/strict";
import test from "node:test";

const routerModule = await import("./ai_scenario_router.mjs").catch(() => ({}));

test("enabled routing defaults admitted title translation to shadow mode", () => {
  assert.equal(typeof routerModule.resolveAiScenarioPolicy, "function");

  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("title_translation", {
      AI_ROUTING_ENABLED: "true",
    }),
    {
      scenario: "title_translation",
      mode: "shadow",
      guardedRoute: [
        {
          providerKey: "semir_overseas_openai",
          model: "gemini-3.5-flash",
        },
        {
          providerKey: "semir_overseas_openai",
          model: "gpt-5.6-terra",
        },
        {
          providerKey: "semir_overseas_openai",
          model: "gpt-5.6-sol",
        },
      ],
      shadowRoute: [
        {
          providerKey: "semir_overseas_openai",
          model: "gemini-3.5-flash",
        },
      ],
    },
  );
});

test("scenario routes honor configured Gemini model aliases per provider", () => {
  const env = {
    AI_ROUTING_ENABLED: "true",
    AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gemini-3-flash-preview",
    AI_PROVIDER_1XM_GEMINI_MODEL: "gemini-3.5-flash",
  };

  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("title_translation", env).shadowRoute,
    [{ providerKey: "semir_overseas_openai", model: "gemini-3-flash-preview" }],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("shein_attribute", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3-flash-preview" },
      { providerKey: "semir_domestic_openai", model: "deepseek-v4-pro" },
      { providerKey: "current_1xm", model: "gemini-3.5-flash" },
    ],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("title_translation", {
      AI_ROUTING_ENABLED: "true",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
    }).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-terra" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
    ],
  );
});

test("scenario policy only exposes models admitted for that exact scene", () => {
  const env = {
    AI_ROUTING_ENABLED: "true",
    AI_SCENARIO_SHEIN_CATEGORY_MODE: "guarded",
    AI_SCENARIO_NEUTRAL_SKC_MODE: "guarded",
    AI_SCENARIO_DEEPDRAW_TRADE_MODE: "shadow",
  };

  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("size_mapping", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("shein_attribute", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
      { providerKey: "semir_domestic_openai", model: "deepseek-v4-pro" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("deepdraw_field_fill", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
      { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
      { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
    ],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("product_archive_ocr_vision", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
  );
  assert.deepEqual(
    routerModule.resolveAiScenarioPolicy("product_archive_ocr_quality", env).guardedRoute,
    [
      { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
      { providerKey: "current_1xm", model: "gemini-3-flash-preview" },
    ],
  );

  const category = routerModule.resolveAiScenarioPolicy("shein_category", env);
  assert.equal(category.mode, "shadow");
  assert.deepEqual(category.guardedRoute, []);
  assert.deepEqual(category.shadowRoute, [
    {
      providerKey: "semir_domestic_openai",
      model: "deepseek-v4-pro",
      textOnly: true,
    },
  ]);

  assert.equal(
    routerModule.resolveAiScenarioPolicy("neutral_skc", env).mode,
    "disabled",
  );
  assert.equal(
    routerModule.resolveAiScenarioPolicy("deepdraw_trade", env).mode,
    "disabled",
  );
});

test("DeepDraw field fill defaults to Semir Gemini guarded routing when routing is enabled", () => {
  const policy = routerModule.resolveAiScenarioPolicy("deepdraw_field_fill", {
    AI_ROUTING_ENABLED: "true",
  });

  assert.equal(policy.mode, "guarded");
  assert.deepEqual(policy.guardedRoute.slice(0, 3), [
    { providerKey: "semir_overseas_openai", model: "gemini-3.5-flash" },
    { providerKey: "semir_domestic_openai", model: "kimi-k2.7-code" },
    { providerKey: "semir_overseas_openai", model: "gpt-5.6-sol" },
  ]);
});

test("DeepDraw field fill guarded call returns a Semir Gemini enum fill", async () => {
  const requestBodies = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
      AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY: "domestic-test-key",
    },
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      requestBodies.push({ url: String(url), model: body.model });
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              fills: [{
                field_id: 101,
                field_name: "适用季节",
                field_value: "夏季",
                confidence: 0.93,
                reason: "标题和来源表均指向夏季短袖",
              }],
            }),
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await router.callJson({
    scenario: "deepdraw_field_fill",
    promptVersion: "deepdraw-field-fill-v1",
    messages: [
      { role: "system", content: "你是深绘商品建档字段专家。" },
      {
        role: "user",
        content: JSON.stringify({
          product: { title: "Balabala 儿童夏季短袖T恤" },
          fields: [{
            field_id: 101,
            field_name: "适用季节",
            options: [{ value: "春季" }, { value: "夏季" }, { value: "秋季" }],
          }],
        }),
      },
    ],
    validate: (json) => Array.isArray(json?.fills),
  });

  assert.equal(result.provider.key, "semir_overseas_openai");
  assert.equal(result.provider.model, "gemini-3.5-flash");
  assert.equal(result.json.fills[0].field_value, "夏季");
  assert.deepEqual(requestBodies.map((body) => body.model), ["gemini-3.5-flash"]);
  assert.match(requestBodies[0].url, /ai-aigw\.semir\.com\/overseas-openai-vip\/v1\/chat\/completions$/);
});

test("provider registry uses provider-scoped secrets and keeps legacy 1xm compatibility", () => {
  assert.equal(typeof routerModule.resolveAiProviderRegistry, "function");

  const registry = routerModule.resolveAiProviderRegistry({
    AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY: "domestic-test-key",
    AI_PROVIDER_1XM_API_KEY: "scoped-1xm-test-key",
    AI_API_KEY: "legacy-test-key",
  });

  assert.deepEqual(
    Object.fromEntries(Object.entries(registry).map(([key, provider]) => [
      key,
      {
        protocol: provider.protocol,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
      },
    ])),
    {
      semir_overseas_openai: {
        protocol: "openai",
        baseUrl: "https://ai-aigw.semir.com/overseas-openai-vip/v1",
        apiKey: "overseas-test-key",
      },
      semir_domestic_openai: {
        protocol: "openai",
        baseUrl: "https://ai-aigw.semir.com/bailian-codingplan/v1",
        apiKey: "domestic-test-key",
      },
      current_1xm: {
        protocol: "openai",
        baseUrl: "https://api.1xm.ai/v1",
        apiKey: "scoped-1xm-test-key",
      },
    },
  );

  assert.equal(
    routerModule.resolveAiProviderRegistry({
      AI_API_KEY: "legacy-test-key",
    }).current_1xm.apiKey,
    "legacy-test-key",
  );
});

test("1xm provider remains a direct text-chat endpoint unless explicitly overridden", () => {
  const registry = routerModule.resolveAiProviderRegistry({
    AI_PROVIDER_1XM_API_KEY: "paid-test-key",
  });

  assert.equal(registry.current_1xm.baseUrl, "https://api.1xm.ai/v1");
  assert.doesNotMatch(registry.current_1xm.baseUrl, /one-xm-proxy|crawshrimp/i);
});

test("guarded routing does not retry a 429 and falls back within the admitted scene route", async () => {
  assert.equal(typeof routerModule.createAiScenarioRouter, "function");

  const calls = [];
  const auditEvents = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, model: body.model });
    if (body.model === "gpt-5.6-terra") {
      return new Response(JSON.stringify({
        error: { message: "daily model quota exhausted" },
      }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
    }
    return new Response(JSON.stringify({
      id: "response-2",
      choices: [{
        message: { content: "{\"title_en\":\"Balabala Boys Jacket\"}" },
      }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 8,
        total_tokens: 28,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    fetchImpl,
    audit: (event) => auditEvents.push(event),
    now: () => new Date("2026-07-29T08:00:00.000Z"),
    sleep: async () => {},
  });

  const result = await router.callJson({
    scenario: "title_translation",
    promptVersion: "title-v1",
    inputHash: "title-case-1",
    messages: [
      { role: "system", content: "title system prompt" },
      { role: "user", content: "title private input" },
    ],
    validate: (json) => typeof json?.title_en === "string",
  });

  assert.equal(result.json.title_en, "Balabala Boys Jacket");
  assert.equal(result.provider.key, "semir_overseas_openai");
  assert.equal(result.provider.model, "gpt-5.6-sol");
  assert.deepEqual(calls.map((call) => call.model), [
    "gpt-5.6-terra",
    "gpt-5.6-sol",
  ]);
  assert.deepEqual(
    result.routing.attempts.map((attempt) => ({
      model: attempt.model,
      status: attempt.status,
      httpStatus: attempt.httpStatus,
    })),
    [
      {
        model: "gpt-5.6-terra",
        status: "QUOTA_EXHAUSTED",
        httpStatus: 429,
      },
      {
        model: "gpt-5.6-sol",
        status: "SUCCEEDED",
        httpStatus: 200,
      },
    ],
  );
  assert.equal(result.routing.fallbackReason, "QUOTA_EXHAUSTED");
  assert.equal(auditEvents.length, 2);
  const auditText = JSON.stringify(auditEvents);
  assert.doesNotMatch(auditText, /overseas-test-key/);
  assert.doesNotMatch(auditText, /title private input/);
});

test("daily model quota exhaustion cools only that provider-model until reset", async () => {
  const states = new Map();
  const calls = [];
  const modelStateStore = {
    get(key) {
      return states.get(key) ?? null;
    },
    set(key, value) {
      states.set(key, value);
    },
  };
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    modelStateStore,
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      calls.push(model);
      if (model === "gpt-5.6-terra") {
        return new Response(JSON.stringify({
          error: { message: "daily model quota exhausted" },
        }), {
          status: 429,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"title_en\":\"Fallback Title\"}" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T13:30:00.000Z"),
  });
  const input = {
    scenario: "title_translation",
    messages: [{ role: "user", content: "title" }],
    validate: (json) => typeof json?.title_en === "string",
  };

  await router.callJson({ ...input, inputHash: "quota-1" });
  await router.callJson({ ...input, inputHash: "quota-2" });

  assert.deepEqual(calls, [
    "gpt-5.6-terra",
    "gpt-5.6-sol",
    "gpt-5.6-sol",
  ]);
  assert.deepEqual(
    states.get("semir_overseas_openai:gpt-5.6-terra"),
    {
      status: "QUOTA_EXHAUSTED",
      blockedUntil: Date.parse("2026-07-30T00:00:00.000Z"),
      failureCount: 1,
    },
  );
});

test("authentication failures mark only the affected model as misconfigured", async () => {
  const states = new Map();
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    modelStateStore: {
      get(key) {
        return states.get(key) ?? null;
      },
      set(key, value) {
        states.set(key, value);
      },
    },
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      if (model === "gpt-5.6-terra") {
        return new Response(JSON.stringify({
          error: { message: "invalid gateway credential" },
        }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"title_en\":\"Fallback Title\"}" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T14:00:00.000Z"),
  });

  await router.callJson({
    scenario: "title_translation",
    messages: [{ role: "user", content: "title" }],
    validate: (json) => typeof json?.title_en === "string",
  });

  assert.deepEqual(
    states.get("semir_overseas_openai:gpt-5.6-terra"),
    {
      status: "MISCONFIGURED",
      blockedUntil: Date.parse("2026-07-29T14:05:00.000Z"),
      failureCount: 1,
    },
  );
  assert.equal(
    states.has("semir_overseas_openai:gpt-5.6-sol"),
    false,
  );
});

test("guarded routing retries one transient transport failure before cross-provider fallback", async () => {
  let attempts = 0;
  const models = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY: "domestic-test-key",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    fetchImpl: async (_url, init) => {
      attempts += 1;
      const body = JSON.parse(init.body);
      models.push(body.model);
      if (body.model === "gemini-3.5-flash") {
        return new Response(JSON.stringify({
          error: { message: "temporary gateway failure" },
        }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
      assert.equal(body.model, "kimi-k2.7-code");
      if (models.filter((model) => model === "kimi-k2.7-code").length === 1) {
        const error = new Error("fetch failed");
        error.code = "ECONNRESET";
        throw error;
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "{\"mappings\":[{\"target\":\"裤长\",\"source\":\"裤长\"}]}",
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    sleep: async () => {},
  });

  const result = await router.callJson({
    scenario: "size_mapping",
    inputHash: "size-case-1",
    messages: [{ role: "user", content: "size mapping input" }],
    validate: (json) => Array.isArray(json?.mappings),
  });

  assert.equal(attempts, 4);
  assert.deepEqual(models, [
    "gemini-3.5-flash",
    "gemini-3.5-flash",
    "kimi-k2.7-code",
    "kimi-k2.7-code",
  ]);
  assert.equal(result.provider.model, "kimi-k2.7-code");
  assert.equal(result.routing.attempts.length, 2);
  assert.equal(result.routing.attempts[0].model, "gemini-3.5-flash");
  assert.equal(result.routing.attempts[0].status, "FAILED");
  assert.equal(result.routing.attempts[1].transportAttempts, 2);
});

test("repeated transient model failures open a provider-model circuit", async () => {
  const states = new Map();
  const calls = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
      AI_ROUTING_CIRCUIT_FAILURE_THRESHOLD: "2",
      AI_ROUTING_CIRCUIT_COOLDOWN_MS: "60000",
    },
    modelStateStore: {
      get(key) {
        return states.get(key) ?? null;
      },
      set(key, value) {
        states.set(key, value);
      },
    },
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      calls.push(model);
      if (model === "gpt-5.6-terra") {
        return new Response(JSON.stringify({
          error: { message: "temporary gateway failure" },
        }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"title_en\":\"Fallback Title\"}" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    sleep: async () => {},
    now: () => new Date("2026-07-29T14:30:00.000Z"),
  });
  const input = {
    scenario: "title_translation",
    messages: [{ role: "user", content: "title" }],
    validate: (json) => typeof json?.title_en === "string",
  };

  await router.callJson({ ...input, inputHash: "circuit-1" });
  await router.callJson({ ...input, inputHash: "circuit-2" });
  await router.callJson({ ...input, inputHash: "circuit-3" });

  assert.deepEqual(calls, [
    "gpt-5.6-terra",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
    "gpt-5.6-sol",
  ]);
  assert.deepEqual(
    states.get("semir_overseas_openai:gpt-5.6-terra"),
    {
      status: "CIRCUIT_OPEN",
      blockedUntil: Date.parse("2026-07-29T14:31:00.000Z"),
      failureCount: 2,
    },
  );
});

test("shadow routing returns the legacy business result and only audits the new model", async () => {
  const auditEvents = [];
  const calls = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
      AI_API_KEY: "legacy-test-key",
      AI_BASE_URL: "https://legacy.example.test/v1",
      AI_MODEL: "legacy-gemini",
    },
    fetchImpl: async (url, init) => {
      const model = JSON.parse(init.body).model;
      calls.push({ url, model });
      const title = model === "legacy-gemini"
        ? "Legacy Production Title"
        : "Shadow Candidate Title";
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ title_en: title }) } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    audit: (event) => auditEvents.push(event),
  });

  const result = await router.callJson({
    scenario: "title_translation",
    inputHash: "shadow-title-case",
    promptVersion: "title-v1",
    messages: [{ role: "user", content: "private title input" }],
    validate: (json) => typeof json?.title_en === "string",
    auditValue: (json) => ({ title_en: json.title_en }),
  });
  await router.flush();

  assert.equal(result.json.title_en, "Legacy Production Title");
  assert.equal(result.provider.key, "legacy");
  assert.equal(result.routing.mode, "shadow");
  assert.equal(result.routing.shadowScheduled, true);
  assert.deepEqual(calls.map((call) => call.model).sort(), [
    "gpt-5.6-terra",
    "legacy-gemini",
  ]);
  assert.deepEqual(
    auditEvents.map((event) => ({
      role: event.role,
      model: event.model,
      status: event.status,
      result: event.result,
    })).sort((left, right) => left.role.localeCompare(right.role)),
    [
      {
        role: "production",
        model: "legacy-gemini",
        status: "SUCCEEDED",
        result: { title_en: "Legacy Production Title" },
      },
      {
        role: "shadow",
        model: "gpt-5.6-terra",
        status: "SUCCEEDED",
        result: { title_en: "Shadow Candidate Title" },
      },
    ],
  );
  assert.doesNotMatch(JSON.stringify(auditEvents), /private title input/);
});

test("SHEIN category shadow strips images from the admitted text-only model", async () => {
  const requestBodies = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SHEIN_CATEGORY_MODE: "guarded",
      AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY: "domestic-test-key",
      AI_API_KEY: "legacy-test-key",
      AI_MODEL: "legacy-vision-model",
    },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "{\"suggestions\":[]}",
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "shein_category",
    inputHash: "category-case-1",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: "SKC 001 款色图如下；tmall_color_image_url=https://example.test/private-product.jpg",
        },
        {
          type: "image_url",
          image_url: { url: "https://example.test/private-product.jpg" },
        },
      ],
    }],
    validate: (json) => Array.isArray(json?.suggestions),
  });
  await router.flush();

  const legacyBody = requestBodies.find((body) => body.model === "legacy-vision-model");
  const shadowBody = requestBodies.find((body) => body.model === "deepseek-v4-pro");
  assert.ok(legacyBody.messages[0].content.some((part) => part.type === "image_url"));
  assert.equal(
    shadowBody.messages[0].content.some((part) => part.type === "image_url"),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(shadowBody.messages),
    /private-product\.jpg|example\.test/,
  );
  assert.ok(shadowBody.messages[0].content.some((part) =>
    part.type === "text" && part.text.includes("SKC 001"),
  ));
});

test("OpenAI-compatible Gemini routes inline remote image URLs as base64 data URLs", async () => {
  const requestBodies = [];
  const imageBytes = Buffer.from("fake-image-bytes");
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    lookupImpl: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async (url, init = {}) => {
      if (String(url) === "https://images.example.test/color.png") {
        return new Response(imageBytes, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(imageBytes.length),
          },
        });
      }
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"title_en\":\"Image Title\"}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "title_translation",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "use visual evidence" },
        {
          type: "image_url",
          image_url: { url: "https://images.example.test/color.png" },
        },
      ],
    }],
    validate: (json) => typeof json?.title_en === "string",
  });

  const imageUrl = requestBodies[0].messages[0].content
    .find((part) => part.type === "image_url")
    .image_url.url;
  assert.equal(
    imageUrl,
    `data:image/png;base64,${imageBytes.toString("base64")}`,
  );
});

test("Gemini image inlining allows proxy fake-IP DNS answers for named hosts", async () => {
  const requestBodies = [];
  const imageBytes = Buffer.from("proxied-image-bytes");
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SHEIN_ATTRIBUTE_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    lookupImpl: async () => [{ address: "198.18.1.34" }],
    fetchImpl: async (url, init = {}) => {
      if (String(url) === "https://product.resources.deepdraw.biz/product.jpg") {
        return new Response(imageBytes, {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(imageBytes.length),
          },
        });
      }
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              fills: [{
                field_key: "attr:40",
                field_value: "常规",
                confidence: 0.82,
              }],
            }),
          },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "shein_attribute",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "use SKC visual evidence" },
        {
          type: "image_url",
          image_url: { url: "https://product.resources.deepdraw.biz/product.jpg" },
        },
      ],
    }],
    validate: (json) => Array.isArray(json?.fills),
  });

  const imageUrl = requestBodies[0].messages[0].content
    .find((part) => part.type === "image_url")
    .image_url.url;
  assert.equal(
    imageUrl,
    `data:image/jpeg;base64,${imageBytes.toString("base64")}`,
  );
});

test("Gemini image inlining still rejects literal proxy fake-IP image URLs", async () => {
  const requestBodies = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SHEIN_ATTRIBUTE_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    lookupImpl: async () => [{ address: "198.18.1.34" }],
    fetchImpl: async (url, init = {}) => {
      assert.notEqual(String(url), "https://198.18.1.34/product.jpg");
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"fills\":[]}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "shein_attribute",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "literal proxy fake IP should not be fetched" },
        {
          type: "image_url",
          image_url: { url: "https://198.18.1.34/product.jpg" },
        },
      ],
    }],
    validate: (json) => Array.isArray(json?.fills),
  });

  const imageUrl = requestBodies[0].messages[0].content
    .find((part) => part.type === "image_url")
    .image_url.url;
  assert.equal(imageUrl, "https://198.18.1.34/product.jpg");
});

test("non-Gemini OpenAI-compatible routes keep remote image URLs unchanged", async () => {
  const requestBodies = [];
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    lookupImpl: async () => [{ address: "93.184.216.34" }],
    fetchImpl: async (_url, init = {}) => {
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"title_en\":\"Image Title\"}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "title_translation",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "use visual evidence" },
        {
          type: "image_url",
          image_url: { url: "https://images.example.test/color.png" },
        },
      ],
    }],
    validate: (json) => typeof json?.title_en === "string",
  });

  const imageUrl = requestBodies[0].messages[0].content
    .find((part) => part.type === "image_url")
    .image_url.url;
  assert.equal(imageUrl, "https://images.example.test/color.png");
});

test("Gemini image inlining does not fetch private or localhost URLs", async () => {
  const requestBodies = [];
  let privateImageFetches = 0;
  const privateUrl = "http://127.0.0.1/private-product.jpg";
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    lookupImpl: async () => [{ address: "127.0.0.1" }],
    fetchImpl: async (url, init = {}) => {
      if (String(url) === privateUrl) {
        privateImageFetches += 1;
        return new Response("private", { status: 200 });
      }
      const body = JSON.parse(init.body);
      requestBodies.push(body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"title_en\":\"Private Image Title\"}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await router.callJson({
    scenario: "title_translation",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "use visual evidence" },
        { type: "image_url", image_url: { url: privateUrl } },
      ],
    }],
    validate: (json) => typeof json?.title_en === "string",
  });

  const imageUrl = requestBodies[0].messages[0].content
    .find((part) => part.type === "image_url")
    .image_url.url;
  assert.equal(privateImageFetches, 0);
  assert.equal(imageUrl, privateUrl);
});

test("1xm fallback stops at the configured daily request budget", async () => {
  let fetchCalls = 0;
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
      AI_1XM_DAILY_REQUEST_BUDGET: "1",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"mappings\":[]}" },
        }],
        usage: { total_tokens: 10 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T09:00:00.000Z"),
  });

  const input = {
    scenario: "size_mapping",
    messages: [{ role: "user", content: "mapping input" }],
    validate: (json) => Array.isArray(json?.mappings),
  };
  const first = await router.callJson({ ...input, inputHash: "paid-case-1" });
  assert.equal(first.provider.key, "current_1xm");

  await assert.rejects(
    () => router.callJson({ ...input, inputHash: "paid-case-2" }),
    (error) => {
      assert.equal(error.fallbackReason, "USER_PAID_BUDGET_EXHAUSTED");
      return true;
    },
  );
  assert.equal(fetchCalls, 1);
});

test("guarded routing reuses a successful result for the same versioned input", async () => {
  let fetchCalls = 0;
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"title_en\":\"Cached Title\"}" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T10:00:00.000Z"),
  });
  const input = {
    scenario: "title_translation",
    inputHash: "same-title-input",
    candidateHash: "same-candidates",
    promptVersion: "title-v2",
    messages: [{ role: "user", content: "title input" }],
    validate: (json) => typeof json?.title_en === "string",
  };

  const first = await router.callJson(input);
  const second = await router.callJson(input);

  assert.equal(first.json.title_en, "Cached Title");
  assert.equal(second.json.title_en, "Cached Title");
  assert.equal(second.routing.cacheHit, true);
  assert.equal(fetchCalls, 1);
});

test("Anthropic-compatible adapter separates system messages and normalizes content", async () => {
  assert.equal(typeof routerModule.invokeAiProvider, "function");
  let captured;

  const result = await routerModule.invokeAiProvider({
    provider: {
      key: "semir_overseas_anthropic",
      protocol: "anthropic",
      baseUrl: "https://anthropic.example.test",
      apiKey: "anthropic-test-key",
    },
    model: "claude-sonnet-test",
    messages: [
      { role: "system", content: "system guidance" },
      { role: "user", content: "user input" },
    ],
    fetchImpl: async (url, init) => {
      captured = {
        url,
        headers: init.headers,
        body: JSON.parse(init.body),
      };
      return new Response(JSON.stringify({
        id: "msg-test",
        type: "message",
        content: [{ type: "text", text: "{\"ok\":true}" }],
        usage: { input_tokens: 9, output_tokens: 4 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    timeoutMs: 1000,
    temperature: 0.1,
  });

  assert.equal(captured.url, "https://anthropic.example.test/v1/messages");
  assert.equal(captured.headers["x-api-key"], "anthropic-test-key");
  assert.equal(captured.headers.Authorization, undefined);
  assert.equal(captured.body.system, "system guidance");
  assert.deepEqual(captured.body.messages, [
    { role: "user", content: "user input" },
  ]);
  assert.equal(result.content, "{\"ok\":true}");
  assert.deepEqual(result.usage, {
    inputTokens: 9,
    outputTokens: 4,
    totalTokens: 13,
  });
});

test("router honors a shared model state store when a single model is cooling down", async () => {
  const calls = [];
  const modelStateStore = {
    get(key) {
      return key === "semir_overseas_openai:gpt-5.6-terra"
        ? {
          status: "RATE_LIMITED",
          blockedUntil: Date.parse("2026-07-29T11:05:00.000Z"),
        }
        : null;
    },
    set() {},
  };
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_TITLE_TRANSLATION_MODE: "guarded",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL: "gpt-5.6-terra",
      AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY: "overseas-test-key",
    },
    modelStateStore,
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      calls.push(model);
      return new Response(JSON.stringify({
        choices: [{
          message: { content: "{\"title_en\":\"Fallback Title\"}" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T11:00:00.000Z"),
  });

  const result = await router.callJson({
    scenario: "title_translation",
    messages: [{ role: "user", content: "input" }],
    validate: (json) => typeof json?.title_en === "string",
  });

  assert.deepEqual(calls, ["gpt-5.6-sol"]);
  assert.equal(result.provider.model, "gpt-5.6-sol");
  assert.equal(result.routing.fallbackReason, "MODEL_COOLDOWN");
});

test("1xm daily budget is shared across router instances through the usage store", async () => {
  const rows = new Map();
  const usageStore = {
    get(date, providerKey) {
      return rows.get(`${date}:${providerKey}`) ?? { requests: 0, tokens: 0 };
    },
    incrementRequest(date, providerKey) {
      const key = `${date}:${providerKey}`;
      const row = this.get(date, providerKey);
      rows.set(key, { ...row, requests: row.requests + 1 });
    },
    addTokens(date, providerKey, tokens) {
      const key = `${date}:${providerKey}`;
      const row = this.get(date, providerKey);
      rows.set(key, { ...row, tokens: row.tokens + tokens });
    },
  };
  let fetchCalls = 0;
  const routerOptions = {
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
      AI_1XM_DAILY_REQUEST_BUDGET: "1",
    },
    usageStore,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"mappings\":[]}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  };
  const input = {
    scenario: "size_mapping",
    messages: [{ role: "user", content: "mapping input" }],
    validate: (json) => Array.isArray(json?.mappings),
  };

  await routerModule.createAiScenarioRouter(routerOptions).callJson({
    ...input,
    inputHash: "shared-budget-1",
  });
  await assert.rejects(
    () => routerModule.createAiScenarioRouter(routerOptions).callJson({
      ...input,
      inputHash: "shared-budget-2",
    }),
    (error) => error.fallbackReason === "USER_PAID_BUDGET_EXHAUSTED",
  );
  assert.equal(fetchCalls, 1);
});

test("1xm request budget uses an atomic reservation when the store supports it", async () => {
  let fetchCalls = 0;
  const reservations = [];
  const usageStore = {
    get() {
      throw new Error("non-atomic budget path must not be used");
    },
    incrementRequest() {
      throw new Error("non-atomic budget path must not be used");
    },
    addTokens() {},
    tryReserveRequest(date, providerKey, requestBudget, tokenBudget) {
      reservations.push({ date, providerKey, requestBudget, tokenBudget });
      return false;
    },
  };
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
      AI_1XM_DAILY_REQUEST_BUDGET: "10",
      AI_1XM_DAILY_TOKEN_BUDGET: "5000",
    },
    usageStore,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("not reached");
    },
    now: () => new Date("2026-07-29T13:00:00.000Z"),
  });

  await assert.rejects(
    () => router.callJson({
      scenario: "size_mapping",
      messages: [{ role: "user", content: "mapping input" }],
      validate: (json) => Array.isArray(json?.mappings),
    }),
    (error) => error.fallbackReason === "USER_PAID_BUDGET_EXHAUSTED",
  );
  assert.equal(fetchCalls, 0);
  assert.deepEqual(reservations, [{
    date: "2026-07-29",
    providerKey: "current_1xm",
    requestBudget: 10,
    tokenBudget: 5000,
  }]);
});

test("1xm atomically reserves budget before every retry transport", async () => {
  let fetchCalls = 0;
  const reservations = [];
  const usageStore = {
    addTokens() {},
    tryReserveRequest(date, providerKey, requestBudget, tokenBudget) {
      reservations.push({ date, providerKey, requestBudget, tokenBudget });
      return reservations.length <= 2;
    },
  };
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
      AI_1XM_DAILY_REQUEST_BUDGET: "2",
    },
    usageStore,
    sleep: async () => {},
    fetchImpl: async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response(JSON.stringify({ error: { message: "temporary" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"mappings\":[]}" } }],
        usage: { total_tokens: 4 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    now: () => new Date("2026-08-19T08:00:00.000Z"),
  });

  const result = await router.callJson({
    scenario: "size_mapping",
    messages: [{ role: "user", content: "mapping" }],
    validate: (json) => Array.isArray(json?.mappings),
  });

  assert.equal(result.provider.key, "current_1xm");
  assert.equal(fetchCalls, 2);
  assert.equal(reservations.length, 2);
});

test("guarded paid fallback is disabled until an explicit daily request budget is set", async () => {
  let fetchCalls = 0;
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"mappings\":[]}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await assert.rejects(
    () => router.callJson({
      scenario: "size_mapping",
      messages: [{ role: "user", content: "mapping" }],
      validate: (json) => Array.isArray(json?.mappings),
    }),
    (error) => error.fallbackReason === "USER_PAID_BUDGET_EXHAUSTED",
  );
  assert.equal(fetchCalls, 0);
});

test("invalid 1xm daily request budget keeps paid fallback disabled", async () => {
  let fetchCalls = 0;
  const router = routerModule.createAiScenarioRouter({
    env: {
      AI_ROUTING_ENABLED: "true",
      AI_SCENARIO_SIZE_MAPPING_MODE: "guarded",
      AI_PROVIDER_1XM_API_KEY: "paid-test-key",
      AI_1XM_DAILY_REQUEST_BUDGET: "unlimited",
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"mappings\":[]}" } }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await assert.rejects(
    () => router.callJson({
      scenario: "size_mapping",
      messages: [{ role: "user", content: "mapping" }],
      validate: (json) => Array.isArray(json?.mappings),
    }),
    (error) => error.fallbackReason === "USER_PAID_BUDGET_EXHAUSTED",
  );
  assert.equal(fetchCalls, 0);
});
