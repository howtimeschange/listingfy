import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategoryMatchMessages,
  buildCategoryMatchPrompt,
  callAiCategoryMatcher,
  parseAiCategoryMatchResponse,
  resolveAiCategoryScenario,
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
  assert.equal(messages[0].content.length, 4);
  assert.equal(messages[0].content[1].type, "text");
  assert.match(messages[0].content[1].text, /20822610320100313/);
  assert.equal(messages[0].content[2].type, "image_url");
  assert.equal(messages[0].content[2].image_url.url, "https://example.test/color-yellow.jpg");
  assert.equal(messages[0].content[3].type, "text");
  assert.match(messages[0].content[3].text, /没有可用款色图/);
});

test("category matching sends every SKC style-color image with an explicit SKC label", () => {
  const skcExamples = Array.from({ length: 15 }, (_, index) => ({
    spu_code: "230326108202",
    skc_code: `230326108202-${String(index + 1).padStart(2, "0")}`,
    color_name: `测试色${index + 1}`,
    tmall_color_image_url: `https://example.test/color-${index + 1}.jpg`,
  }));
  const input = {
    groups: [{
      match_key: "针织长裤|中性",
      gender_name: "中性",
      skc_examples: skcExamples,
    }],
    candidates: [],
  };

  const prompt = buildCategoryMatchPrompt(input);
  const messages = buildCategoryMatchMessages(input);
  const imageParts = messages[0].content.filter((part) => part.type === "image_url");
  const labelParts = messages[0].content.filter((part) => part.type === "text").slice(1);

  for (const example of skcExamples) {
    assert.match(prompt, new RegExp(example.skc_code));
    assert.ok(labelParts.some((part) => part.text.includes(example.skc_code)));
    assert.ok(imageParts.some((part) => part.image_url.url === example.tmall_color_image_url));
  }
  assert.equal(imageParts.length, skcExamples.length);
});

test("category prompt makes model evidence primary and color evidence a no-model fallback", () => {
  const prompt = buildCategoryMatchPrompt({
    groups: [{
      match_key: "针织长裤|中性",
      gender_name: "中性",
      skc_examples: [{
        spu_code: "230326108202",
        skc_code: "23032610820220603",
        color_name: "铁灰",
        tmall_color_image_url: "https://example.test/iron-gray.jpg",
      }],
    }],
    candidates: [],
  });

  assert.match(prompt, /模特性别.*优先/);
  assert.match(prompt, /只有.*没有.*模特.*颜色/);
  assert.match(prompt, /即使有图片.*无法确认是否有模特.*颜色.*兜底/);
  assert.match(prompt, /铁灰.*卡其.*男童/);
  assert.match(prompt, /风信紫.*女童/);
  assert.match(prompt, /model_present/);
  assert.match(prompt, /color_gender/);
  assert.match(prompt, /gender_basis/);
  assert.match(prompt, /每个.*SKC.*一条/);
  assert.match(prompt, /一般.*0\.92/);
  assert.match(prompt, /中性款.*0\.80/);
});

test("category prompt keeps shoe products in shoe category paths", () => {
  const prompt = buildCategoryMatchPrompt({
    groups: [{
      match_key: "儿童慢跑鞋|女",
      mdm_small_category_name: "慢跑鞋",
      gender_name: "女",
      deepdraw_title: "儿童慢跑鞋",
      skc_examples: [],
    }],
    candidates: [
      {
        category_id: 6488,
        product_type_id: 3431,
        category_name: "儿童跑步鞋",
        path: "儿童 > 儿童鞋子 > 儿童户外运动鞋 > 儿童跑步鞋",
      },
      {
        category_id: 4904,
        product_type_id: 2104,
        category_name: "女童（小）运动服",
        path: "儿童 > 女童（小）服装 > 女童（小）运动服",
      },
    ],
  });

  assert.match(prompt, /慢跑鞋、跑步鞋、运动鞋/);
  assert.match(prompt, /儿童鞋子或青少年鞋/);
  assert.match(prompt, /不能误选运动服或普通服装/);
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

test("parseAiCategoryMatchResponse preserves explicit model and color gender evidence", () => {
  const [result] = parseAiCategoryMatchResponse(JSON.stringify({
    suggestions: [{
      match_key: "针织长裤|中性",
      status: "AMBIGUOUS",
      confidence: 0.96,
      split_by_skc: true,
      blocking_risks: [],
      primary: {
        category_id: 2713,
        product_type_id: 575,
        category_name: "男童（小）卫裤",
        path: "儿童 > 男童（小）服装 > 男童（小）卫裤",
      },
      skc_suggestions: [{
        spu_code: "230326108202",
        skc_code: "23032610820270641",
        color_name: "风信紫",
        model_present: false,
        model_gender: "未知",
        color_gender: "女童",
        resolved_gender: "女童",
        gender_basis: "COLOR",
        confidence: 0.96,
        primary: {
          category_id: 9001,
          product_type_id: 9002,
          category_name: "女童（小）卫裤",
          path: "儿童 > 女童（小）服装 > 女童（小）卫裤",
        },
      }],
    }],
  }));

  assert.equal(result.skc_suggestions[0].model_present, false);
  assert.equal(result.skc_suggestions[0].model_gender, "未知");
  assert.equal(result.skc_suggestions[0].color_gender, "女童");
  assert.equal(result.skc_suggestions[0].resolved_gender, "女童");
  assert.equal(result.skc_suggestions[0].gender_basis, "COLOR");
  assert.deepEqual(result.blocking_risks, []);
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

test("callAiCategoryMatcher retries one malformed structured response", async () => {
  let calls = 0;
  const result = await callAiCategoryMatcher({
    groups: [{ match_key: "长裤|中性|幼童" }],
    candidates: [],
    config: {
      baseUrl: "https://ai.example.test/v1",
      model: "retry-malformed-json",
      apiKey: "test-key",
      timeoutMs: 1000,
    },
    fetchImpl: async () => {
      calls += 1;
      const content = calls === 1
        ? "{\"suggestions\":[{\"match_key\":\"长裤|中性|幼童\""
        : JSON.stringify({
          suggestions: [
            {
              match_key: "长裤|中性|幼童",
              status: "READY",
              confidence: 0.9,
              primary: {
                category_id: 2713,
                product_type_id: 575,
                category_name: "男童（小）卫裤",
                path: "儿童 > 男童（小） > 卫裤",
              },
            },
          ],
        });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content } }],
        }),
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.suggestions[0].primary.category_id, 2713);
});

test("category matcher routes neutral SKC vision separately from ordinary category review", () => {
  assert.equal(
    resolveAiCategoryScenario([{ gender_name: "中性" }]),
    "neutral_skc",
  );
  assert.equal(
    resolveAiCategoryScenario([{ gender_name: "UNISEX" }]),
    "neutral_skc",
  );
  assert.equal(
    resolveAiCategoryScenario([{ gender_name: "男" }]),
    "shein_category",
  );
});

test("category matcher sends versioned hashed input through the injected scenario router", async () => {
  const calls = [];
  const responseJson = {
    suggestions: [{
      match_key: "衬衫|男|幼童",
      status: "READY",
      confidence: 0.95,
      primary: {
        category_id: 1001,
        product_type_id: 2001,
        category_name: "男童衬衫",
        path: "儿童 > 男童（小） > 衬衫",
      },
    }],
  };
  const router = {
    async callJson(input) {
      calls.push(input);
      return {
        content: JSON.stringify(responseJson),
        json: responseJson,
        raw: { id: "routed-response" },
        provider: { key: "legacy", model: "legacy-model" },
      };
    },
  };
  const groups = [{ match_key: "衬衫|男|幼童", gender_name: "男" }];
  const candidates = [{
    category_id: 1001,
    product_type_id: 2001,
    category_name: "男童衬衫",
    path: "儿童 > 男童（小） > 衬衫",
  }];

  const result = await callAiCategoryMatcher({
    groups,
    candidates,
    router,
  });

  assert.equal(result.suggestions[0].primary.category_id, 1001);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].scenario, "shein_category");
  assert.equal(calls[0].promptVersion, "shein-category-match-v1");
  assert.match(calls[0].inputHash, /^[a-f0-9]{64}$/);
  assert.match(calls[0].candidateHash, /^[a-f0-9]{64}$/);
  assert.equal(calls[0].validate(responseJson), true);
});

test("neutral category matching is delegated to the disabled neutral_skc policy", async () => {
  const calls = [];
  const router = {
    async callJson(input) {
      calls.push(input);
      throw new Error(`AI scenario is disabled: ${input.scenario}`);
    },
  };

  await assert.rejects(
    () => callAiCategoryMatcher({
      groups: [{ match_key: "长裤|中性", gender_name: "中性" }],
      candidates: [],
      router,
    }),
    /AI scenario is disabled: neutral_skc/,
  );
  assert.equal(calls[0].scenario, "neutral_skc");
});

test("mixed category batches keep ordinary groups running when neutral AI is disabled", async () => {
  const calls = [];
  const responseJson = {
    suggestions: [{
      match_key: "衬衫|男|幼童",
      status: "READY",
      confidence: 0.95,
      primary: {
        category_id: 1001,
        product_type_id: 2001,
        category_name: "男童衬衫",
        path: "儿童 > 男童（小） > 衬衫",
      },
    }],
  };
  const router = {
    async callJson(input) {
      calls.push(input);
      if (input.scenario === "neutral_skc") {
        throw new Error("AI scenario is disabled: neutral_skc");
      }
      return {
        content: JSON.stringify(responseJson),
        json: responseJson,
        raw: { id: "ordinary-response" },
        provider: { key: "legacy", model: "legacy-model" },
        routing: { scenario: input.scenario },
      };
    },
  };
  const groups = [
    {
      match_key: "长裤|中性|幼童",
      gender_name: "中性",
      skc_examples: [{
        skc_code: "neutral-skc-1",
        tmall_color_image_url: "https://example.test/neutral-private.jpg",
      }],
    },
    {
      match_key: "衬衫|男|幼童",
      gender_name: "男",
    },
  ];

  const result = await callAiCategoryMatcher({
    groups,
    candidates: [{
      category_id: 1001,
      product_type_id: 2001,
      category_name: "男童衬衫",
      path: "儿童 > 男童（小） > 衬衫",
    }],
    router,
  });

  assert.deepEqual(calls.map((call) => call.scenario), [
    "shein_category",
    "neutral_skc",
  ]);
  assert.doesNotMatch(
    JSON.stringify(calls[0].messages),
    /长裤\|中性|neutral-private\.jpg/,
  );
  assert.deepEqual(
    result.suggestions.map((suggestion) => suggestion.match_key),
    ["衬衫|男|幼童"],
  );
  assert.deepEqual(result.skippedGroups, [{
    scenario: "neutral_skc",
    matchKeys: ["长裤|中性|幼童"],
    reason: "SCENARIO_DISABLED",
  }]);
});
