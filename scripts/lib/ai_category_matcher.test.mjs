import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryMatchMessages,
  buildCategoryMatchPrompt,
  callAiCategoryMatcher,
  parseAiCategoryMatchResponse,
  resolveAiConfig,
} from "./ai_category_matcher.mjs";

test("resolveAiConfig reads the configured OpenAI-compatible provider", () => {
  const previousBaseUrl = process.env.AI_BASE_URL;
  const previousModel = process.env.AI_MODEL;
  const previousApiKey = process.env.AI_API_KEY;

  process.env.AI_BASE_URL = "https://api.1xm.ai/v1";
  process.env.AI_MODEL = "gemini-3-flash-preview";
  process.env.AI_API_KEY = "test-key";

  try {
    assert.deepEqual(resolveAiConfig(), {
      baseUrl: "https://api.1xm.ai/v1",
      model: "gemini-3-flash-preview",
      apiKey: "test-key",
      timeoutMs: 120000,
    });
  } finally {
    if (previousBaseUrl === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = previousBaseUrl;
    if (previousModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = previousModel;
    if (previousApiKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousApiKey;
  }
});

test("buildCategoryMatchPrompt includes guardrails and compact candidate context", () => {
  const prompt = buildCategoryMatchPrompt({
    groups: [
      {
        match_key: "连衣裙|梭织连衣裙|女|幼童",
        mdm_middle_category_name: "连衣裙",
        mdm_small_category_name: "梭织连衣裙",
        gender_name: "女",
        age_group_name: "幼童",
        spec_range: "073-130",
        deepdraw_category_name: "连衣裙",
        deepdraw_title: "宝宝连衣裙婴儿公主裙",
        spus: ["208226111038"],
        spu_count: 1,
        skc_examples: [
          {
            spu_code: "208226111038",
            skc_code: "20822611103800388",
            color_name: "蓝色调00388",
            tmall_color_image_url: "https://example.test/color-blue.jpg",
          },
        ],
      },
    ],
    candidates: [
      {
        category_id: 2063,
        product_type_id: 5926,
        category_name: "女童（小）连衣裙",
        path: "儿童 > 女童（小）服装 > 女童（小）连衣裙",
        required_count: 11,
      },
      {
        category_id: 2133,
        product_type_id: 1703,
        category_name: "婴童（女）连衣裙",
        path: "婴儿 > 婴童（女）服装 > 婴童（女）连衣裙",
        required_count: 13,
      },
    ],
  });

  assert.match(prompt, /只返回 JSON/);
  assert.match(prompt, /不要因为标题包含“宝宝\/婴儿”就直接选择婴儿根类目/);
  assert.match(prompt, /同一个 SPU 下不同 SKC/);
  assert.match(prompt, /skc_suggestions/);
  assert.match(prompt, /20822611103800388/);
  assert.match(prompt, /https:\/\/example\.test\/color-blue\.jpg/);
  assert.match(prompt, /女童（小）连衣裙/);
  assert.match(prompt, /连衣裙\|梭织连衣裙\|女\|幼童/);
});

test("buildCategoryMatchMessages attaches TMALL model images for visual judgement", () => {
  const messages = buildCategoryMatchMessages({
    groups: [
      {
        match_key: "毛衫|开襟毛衫|中性|幼童",
        mdm_middle_category_name: "毛衫",
        mdm_small_category_name: "开襟毛衫",
        gender_name: "中性",
        age_group_name: "幼童",
        skc_examples: [
          {
            spu_code: "208226103201",
            skc_code: "20822610320100313",
            color_name: "白黄色调00313",
            tmall_color_image_url: "https://example.test/color-yellow.jpg",
          },
          {
            spu_code: "208226103201",
            skc_code: "20822610320100316",
            color_name: "白红色调00316",
            tmall_color_image_url: null,
          },
        ],
      },
    ],
    candidates: [],
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[0].content.length, 2);
  assert.equal(messages[0].content[1].type, "image_url");
  assert.equal(messages[0].content[1].image_url.url, "https://example.test/color-yellow.jpg");
});

test("parseAiCategoryMatchResponse extracts suggestions from fenced JSON", () => {
  const suggestions = parseAiCategoryMatchResponse(`
    \`\`\`json
    {
      "suggestions": [
        {
          "match_key": "长袖衬衫|梭织长袖衬衫|女|幼童",
          "status": "READY",
          "confidence": 0.91,
          "split_by_skc": true,
          "primary": {
            "category_id": 2062,
            "product_type_id": 7403,
            "category_name": "女童（小）衬衫",
            "path": "儿童 > 女童（小）服装 > 女童（小）上衣 > 女童（小）衬衫"
          },
          "skc_suggestions": [
            {
              "spu_code": "208226102001",
              "skc_code": "20822610200100311",
              "color_name": "白色调00311",
              "model_gender": "女童",
              "confidence": 0.88,
              "primary": {
                "category_id": 2062,
                "product_type_id": 7403,
                "category_name": "女童（小）衬衫",
                "path": "儿童 > 女童（小）服装 > 女童（小）上衣 > 女童（小）衬衫"
              },
              "reasons": ["TMALL 款色图为女童模特"]
            }
          ],
          "alternatives": [],
          "reasons": ["尺码范围 080-130 对应小童"],
          "risks": []
        }
      ]
    }
    \`\`\`
  `);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].match_key, "长袖衬衫|梭织长袖衬衫|女|幼童");
  assert.equal(suggestions[0].primary.category_id, 2062);
  assert.equal(suggestions[0].confidence, 0.91);
  assert.equal(suggestions[0].split_by_skc, true);
  assert.equal(suggestions[0].skc_suggestions[0].skc_code, "20822610200100311");
  assert.equal(suggestions[0].skc_suggestions[0].model_gender, "女童");
});

test("parseAiCategoryMatchResponse treats string false as false for split_by_skc", () => {
  const suggestions = parseAiCategoryMatchResponse(JSON.stringify({
    suggestions: [
      {
        match_key: "套装|针织套装|男|幼童",
        status: "READY",
        confidence: 0.85,
        split_by_skc: "false",
        primary: {
          category_id: 15254,
          product_type_id: 10935,
          category_name: "男童（小）卫衣套装",
          path: "儿童 > 男童（小）服装 > 男童（小）套装 > 男童（小）卫衣套装",
        },
      },
    ],
  }));

  assert.equal(suggestions[0].split_by_skc, false);
});

test("parseAiCategoryMatchResponse accepts a single suggestion object", () => {
  const suggestions = parseAiCategoryMatchResponse(JSON.stringify({
    match_key: "套装|针织套装|男|幼童",
    status: "READY",
    confidence: 0.85,
    primary: {
      category_id: 15254,
      product_type_id: 10935,
      category_name: "男童（小）卫衣套装",
      path: "儿童 > 男童（小）服装 > 男童（小）套装 > 男童（小）卫衣套装",
    },
  }));

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].match_key, "套装|针织套装|男|幼童");
});

test("parseAiCategoryMatchResponse accepts common wrapped suggestion arrays", () => {
  const suggestions = parseAiCategoryMatchResponse(JSON.stringify({
    results: [
      {
        match_key: "套装|针织套装|男|幼童",
        status: "READY",
        confidence: 0.85,
        primary: {
          category_id: 15254,
          product_type_id: 10935,
          category_name: "男童（小）卫衣套装",
          path: "儿童 > 男童（小）服装 > 男童（小）套装 > 男童（小）卫衣套装",
        },
      },
    ],
  }));

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].primary.product_type_id, 10935);
});

test("parseAiCategoryMatchResponse rejects malformed category suggestions", () => {
  assert.throws(
    () => parseAiCategoryMatchResponse(`{"suggestions":[{"match_key":"x","confidence":2}]}`),
    /Invalid AI category suggestion/,
  );
});

test("callAiCategoryMatcher reads JSON from provider reasoning fields when content is empty", async () => {
  const response = {
    suggestions: [
      {
        match_key: "衬衫|男|幼童",
        status: "READY",
        confidence: 0.9,
        primary: {
          category_id: 1001,
          product_type_id: 2001,
          category_name: "男童衬衫",
          path: "儿童 > 男童（小） > 衬衫",
        },
      },
    ],
  };

  const result = await callAiCategoryMatcher({
    groups: [{ match_key: "衬衫|男|幼童" }],
    candidates: [],
    config: {
      baseUrl: "https://ai.example.test/v1",
      model: "reasoning-json",
      apiKey: "test-key",
      timeoutMs: 1000,
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "",
              reasoning_content: JSON.stringify(response),
            },
          },
        ],
      }),
    }),
  });

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].match_key, "衬衫|男|幼童");
  assert.equal(result.suggestions[0].primary.category_id, 1001);
});

test("callAiCategoryMatcher retries transient fetch failures once", async () => {
  let calls = 0;
  const result = await callAiCategoryMatcher({
    groups: [{ match_key: "衬衫|男|幼童" }],
    candidates: [],
    config: {
      baseUrl: "https://ai.example.test/v1",
      model: "retry-json",
      apiKey: "test-key",
      timeoutMs: 1000,
    },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      match_key: "衬衫|男|幼童",
                      status: "READY",
                      confidence: 0.9,
                      primary: {
                        category_id: 1001,
                        product_type_id: 2001,
                        category_name: "男童衬衫",
                        path: "儿童 > 男童（小） > 衬衫",
                      },
                    },
                  ],
                }),
              },
            },
          ],
        }),
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.suggestions.length, 1);
});
