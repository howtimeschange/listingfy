import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const policyPath = path.resolve(
  import.meta.dirname,
  "../../web/server/services/pre-publish/category-selection.ts",
);

test("category auto-selection policy is implemented as a reusable service", () => {
  assert.equal(fs.existsSync(policyPath), true);
});

const policy = fs.existsSync(policyPath) ? await import(policyPath) : {};

function category(overrides = {}) {
  return {
    categoryId: 2116,
    productTypeId: 9739,
    categoryName: "女童（小）T恤",
    path: "儿童 > 女童（小）服装 > 女童（小）上衣 > 女童（小）T恤",
    source: "CATEGORY_RULE",
    status: "READY",
    ...overrides,
  };
}

function decide(overrides = {}) {
  assert.equal(typeof policy.categoryAutoSelectionDecision, "function");
  return policy.categoryAutoSelectionDecision({
    category: category(),
    metadataValid: true,
    allowRuleFallback: true,
    ...overrides,
  });
}

function aiCandidate(overrides = {}) {
  return {
    category_id: 2713,
    product_type_id: 575,
    category_name: "男童（小）卫裤",
    path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）卫裤",
    ...overrides,
  };
}

test("AI category pair corrects a product type mismatch when the category has one candidate", () => {
  assert.equal(typeof policy.normalizeAiCategoryCandidate, "function");
  const candidate = aiCandidate();

  assert.deepEqual(
    policy.normalizeAiCategoryCandidate(
      aiCandidate({ product_type_id: 573 }),
      [candidate],
    ),
    candidate,
  );
});

test("AI category pair preserves an exact candidate match", () => {
  const candidate = aiCandidate();

  assert.deepEqual(
    policy.normalizeAiCategoryCandidate(candidate, [candidate]),
    candidate,
  );
});

test("AI category pair does not guess when one category has multiple product types", () => {
  assert.equal(
    policy.normalizeAiCategoryCandidate(
      aiCandidate({ product_type_id: 573 }),
      [
        aiCandidate({ product_type_id: 575 }),
        aiCandidate({ product_type_id: 576, category_name: "男童（小）休闲裤" }),
      ],
    ),
    null,
  );
});

test("AI category pair rejects categories outside the candidate set", () => {
  assert.equal(
    policy.normalizeAiCategoryCandidate(
      aiCandidate({ category_id: 9999, product_type_id: 573 }),
      [aiCandidate()],
    ),
    null,
  );
});

test("SKC AI suggestions normalize their primary and discard invalid alternatives", () => {
  assert.equal(typeof policy.normalizeLiveAiSkcCategorySuggestions, "function");
  const male = aiCandidate();
  const female = aiCandidate({
    category_id: 2712,
    product_type_id: 574,
    category_name: "女童（小）卫裤",
    path: "儿童 > 女童（小）服装 > 女童（小）下装 > 女童（小）卫裤",
  });

  assert.deepEqual(
    policy.normalizeLiveAiSkcCategorySuggestions(
      [{
        skc_code: "23032610820270641",
        evidence_basis: "COLOR",
        primary: {
          category_id: 2712,
          product_type_id: 573,
          confidence: 0.82,
        },
        alternatives: [
          { category_id: 2713, product_type_id: 573 },
          { category_id: 9999, product_type_id: 1 },
        ],
      }],
      [male, female],
    ),
    [{
      skc_code: "23032610820270641",
      evidence_basis: "COLOR",
      primary: {
        category_id: 2712,
        product_type_id: 574,
        category_name: "女童（小）卫裤",
        path: "儿童 > 女童（小）服装 > 女童（小）下装 > 女童（小）卫裤",
        confidence: 0.82,
      },
      alternatives: [{
        category_id: 2713,
        product_type_id: 575,
        category_name: "男童（小）卫裤",
        path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）卫裤",
      }],
    }],
  );
});

test("SKC AI suggestions never retain a primary outside the supplied candidates", () => {
  assert.deepEqual(
    policy.normalizeLiveAiSkcCategorySuggestions(
      [{
        skc_code: "OUTSIDE",
        primary: { category_id: 9999, product_type_id: 1 },
        alternatives: [],
      }],
      [aiCandidate()],
    ),
    [{
      skc_code: "OUTSIDE",
      primary: null,
      alternatives: [],
    }],
  );
});

test("confirmed category rules and deterministic fallbacks auto-select valid SHEIN pairs", () => {
  const ruleDecision = decide();
  assert.equal(ruleDecision.apply, true);
  assert.equal(ruleDecision.reason, "RULE_READY");

  const fallbackDecision = decide({
    category: category({ source: "RULE_FALLBACK" }),
  });
  assert.equal(fallbackDecision.apply, true);
  assert.equal(fallbackDecision.reason, "RULE_FALLBACK_READY");
});

test("invalid metadata pairs and unreviewed stored AI suggestions never auto-select", () => {
  assert.equal(decide({ metadataValid: false }).apply, false);
  assert.equal(decide({
    category: category({ source: "AI_CATEGORY", status: "NEEDS_REVIEW" }),
  }).apply, false);
});

test("live AI auto-selects only READY, high-confidence, unsplit, risk-free candidates", () => {
  const decision = decide({
    category: category({
      categoryId: null,
      productTypeId: null,
      categoryName: null,
      path: null,
      source: "MISSING",
      status: "MISSING",
    }),
    liveAi: {
      ...category({ source: "AI_CATEGORY_LIVE" }),
      status: "READY",
      confidence: 0.92,
      splitBySkc: false,
      risks: [],
    },
    liveAiMetadataValid: true,
  });

  assert.equal(decision.apply, true);
  assert.equal(decision.reason, "AI_READY");
  assert.equal(decision.source, "AI_CATEGORY_LIVE");
  assert.equal(decision.confidence, 0.92);
});

test("ambiguous, low-confidence, risky, or split live AI candidates require review", () => {
  const missing = category({
    categoryId: null,
    productTypeId: null,
    categoryName: null,
    path: null,
    source: "MISSING",
    status: "MISSING",
  });
  const baseAi = {
    ...category({ source: "AI_CATEGORY_LIVE" }),
    status: "READY",
    confidence: 0.92,
    splitBySkc: false,
    risks: [],
  };

  assert.equal(decide({
    category: missing,
    liveAi: { ...baseAi, status: "AMBIGUOUS" },
    liveAiMetadataValid: true,
  }).apply, false);
  assert.equal(decide({
    category: missing,
    liveAi: { ...baseAi, confidence: 0.919 },
    liveAiMetadataValid: true,
  }).apply, false);
  assert.equal(decide({
    category: missing,
    liveAi: { ...baseAi, risks: ["图文性别冲突"] },
    liveAiMetadataValid: true,
  }).apply, false);
  assert.equal(decide({
    category: missing,
    liveAi: { ...baseAi, splitBySkc: true },
    liveAiMetadataValid: true,
  }).apply, false);
  assert.equal(decide({
    category: missing,
    liveAi: {
      ...baseAi,
      categoryName: "女童（小）泳装",
      path: "儿童 > 女童（小）服装 > 女童（小）泳装",
    },
    liveAiMetadataValid: true,
  }).apply, false);
});
