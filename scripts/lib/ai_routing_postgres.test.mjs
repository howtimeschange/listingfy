import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../db/migrations/043_ai_provider_routing.sql", import.meta.url),
  "utf8",
).catch(() => "");
const persistence = await import("./ai_routing_postgres.mjs").catch(() => ({}));

test("AI routing migration persists safe audit, per-model state, and daily paid usage", () => {
  assert.match(migration, /create table if not exists ai_invocation_audit/i);
  assert.match(migration, /create table if not exists ai_model_runtime_state/i);
  assert.match(migration, /primary key \(provider_key, model\)/i);
  assert.match(migration, /create table if not exists ai_provider_daily_usage/i);
  assert.match(migration, /primary key \(usage_date, provider_key\)/i);
  assert.match(migration, /result_json jsonb/i);
  assert.doesNotMatch(migration, /authorization|api_key|prompt_text|image_base64/i);
});

test("PostgreSQL audit sink only writes whitelisted routing metadata", () => {
  assert.equal(typeof persistence.createPostgresAiRoutingRuntime, "function");

  const writes = [];
  const db = {
    prepare(sql) {
      return {
        run(...args) {
          writes.push({ sql, args });
          return { changes: 1 };
        },
        get() {
          return undefined;
        },
      };
    },
  };
  const runtime = persistence.createPostgresAiRoutingRuntime(db);
  runtime.audit({
    scenario: "title_translation",
    mode: "shadow",
    role: "shadow",
    providerKey: "semir_overseas_openai",
    model: "gpt-5.6-terra",
    status: "SUCCEEDED",
    httpStatus: 200,
    latencyMs: 123,
    promptVersion: "title-v1",
    inputHash: "input-hash",
    candidateHash: null,
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    result: {
      title_en: "Safe projected title",
      apiKey: "must-not-be-written",
      nested: {
        prompt: "must-not-be-written",
        confidence: 0.95,
      },
    },
    apiKey: "must-not-be-written",
    messages: [{ role: "user", content: "must-not-be-written" }],
  });

  assert.equal(writes.length, 1);
  const serializedWrite = JSON.stringify(writes[0]);
  assert.match(serializedWrite, /ai_invocation_audit/);
  assert.doesNotMatch(serializedWrite, /must-not-be-written/);
  assert.match(serializedWrite, /Safe projected title/);
  assert.match(serializedWrite, /confidence/);
  assert.match(serializedWrite, /title_translation/);
  assert.match(serializedWrite, /gpt-5\.6-terra/);
});

test("PostgreSQL runtime persists and restores provider-model cooldown state", () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        run(...args) {
          writes.push({ sql, args });
          return { changes: 1 };
        },
        get(...args) {
          if (/from ai_model_runtime_state/i.test(sql)) {
            assert.deepEqual(args, [
              "semir_overseas_openai",
              "gpt-5.6-terra",
            ]);
            return {
              status: "RATE_LIMITED",
              blocked_until: "2026-07-29T12:05:00.000Z",
              failure_count: 2,
            };
          }
          return undefined;
        },
      };
    },
  };
  const runtime = persistence.createPostgresAiRoutingRuntime(db);

  assert.deepEqual(
    runtime.modelStateStore.get(
      "semir_overseas_openai:gpt-5.6-terra",
    ),
    {
      status: "RATE_LIMITED",
      blockedUntil: Date.parse("2026-07-29T12:05:00.000Z"),
      failureCount: 2,
    },
  );

  runtime.modelStateStore.set(
    "semir_overseas_openai:gpt-5.6-terra",
    {
      status: "HEALTHY",
      blockedUntil: 0,
      failureCount: 0,
    },
  );
  const stateWrite = writes.find((write) =>
    /insert into ai_model_runtime_state/i.test(write.sql),
  );
  assert.ok(stateWrite);
  assert.deepEqual(stateWrite.args, [
    "semir_overseas_openai",
    "gpt-5.6-terra",
    "HEALTHY",
    null,
    0,
  ]);
});

test("PostgreSQL paid-usage store reserves requests atomically within both budgets", () => {
  const reservations = [];
  let admitted = true;
  const db = {
    prepare(sql) {
      return {
        run() {
          return { changes: 1 };
        },
        get(...args) {
          if (/returning request_count, total_tokens/i.test(sql)) {
            reservations.push({ sql, args });
            return admitted
              ? { request_count: 1, total_tokens: 0 }
              : undefined;
          }
          return undefined;
        },
      };
    },
  };
  const runtime = persistence.createPostgresAiRoutingRuntime(db);

  assert.equal(
    runtime.usageStore.tryReserveRequest(
      "2026-07-29",
      "current_1xm",
      10,
      5000,
    ),
    true,
  );
  admitted = false;
  assert.equal(
    runtime.usageStore.tryReserveRequest(
      "2026-07-29",
      "current_1xm",
      10,
      5000,
    ),
    false,
  );
  assert.equal(
    runtime.usageStore.tryReserveRequest(
      "2026-07-29",
      "current_1xm",
      0,
      5000,
    ),
    false,
  );

  assert.equal(reservations.length, 2);
  assert.match(reservations[0].sql, /on conflict \(usage_date, provider_key\)/i);
  assert.match(reservations[0].sql, /request_count\s*</i);
  assert.match(reservations[0].sql, /total_tokens\s*</i);
  assert.deepEqual(reservations[0].args, [
    "2026-07-29",
    "current_1xm",
    10,
    5000,
  ]);
});
