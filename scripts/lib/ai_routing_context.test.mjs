import assert from "node:assert/strict";
import test from "node:test";

const contextModule = await import("./ai_routing_context.mjs").catch(() => ({}));

test("AI routing hashes are stable, content-free SHA-256 fingerprints", () => {
  assert.equal(typeof contextModule.hashAiRoutingValue, "function");

  const first = contextModule.hashAiRoutingValue({
    title: "private product title",
    nested: { b: 2, a: 1 },
  });
  const second = contextModule.hashAiRoutingValue({
    nested: { a: 1, b: 2 },
    title: "private product title",
  });

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /private product title/);
});

test("AI scenario call builder hashes business input and candidate set separately", () => {
  assert.equal(typeof contextModule.withAiRoutingHashes, "function");

  const call = contextModule.withAiRoutingHashes({
    scenario: "shein_attribute",
    promptVersion: "shein-attribute-v1",
    messages: [{ role: "user", content: "private prompt" }],
    validate: () => true,
  }, {
    input: { spuCode: "SPU-1", attributes: ["style"] },
    candidates: ["Casual", "Formal"],
  });

  assert.match(call.inputHash, /^[a-f0-9]{64}$/);
  assert.match(call.candidateHash, /^[a-f0-9]{64}$/);
  assert.notEqual(call.inputHash, call.candidateHash);
  assert.equal(call.messages[0].content, "private prompt");
});

test("default AI scenario router is lazy and shared for one database handle", () => {
  assert.equal(typeof contextModule.getDefaultAiScenarioRouter, "function");

  const db = {
    prepare() {
      return {
        get() {
          return undefined;
        },
        run() {
          return { changes: 1 };
        },
      };
    },
  };
  const options = {
    db,
    env: { AI_ROUTING_ENABLED: "false" },
    fetchImpl: async () => {
      throw new Error("not called");
    },
  };

  const first = contextModule.getDefaultAiScenarioRouter(options);
  const second = contextModule.getDefaultAiScenarioRouter(options);
  assert.equal(first, second);
  assert.equal(typeof first.callJson, "function");
});
