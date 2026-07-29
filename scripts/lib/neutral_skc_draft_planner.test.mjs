import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const plannerPath = path.resolve(
  import.meta.dirname,
  "../../web/server/services/pre-publish/neutral-skc-draft-planner.ts",
);
const plannerExists = fs.existsSync(plannerPath);
const planner = plannerExists ? await import(plannerPath) : {};

test("neutral SKC draft planner is implemented as a reusable service", () => {
  assert.equal(plannerExists, true);
});

const MALE_CATEGORY = {
  categoryId: 2713,
  productTypeId: 575,
  categoryName: "男童（小）卫裤",
  path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）卫裤",
};
const FEMALE_CATEGORY = {
  categoryId: 2712,
  productTypeId: 574,
  categoryName: "女童（小）卫裤",
  path: "儿童 > 女童（小）服装 > 女童（小）下装 > 女童（小）卫裤",
};
const GENERIC_MALE_PANTS = {
  categoryId: 2101,
  productTypeId: 9603,
  categoryName: "男童（小）裤子",
  path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）裤子",
};
const GENERIC_FEMALE_PANTS = {
  categoryId: 2119,
  productTypeId: 9602,
  categoryName: "女童（小）长裤",
  path: "儿童 > 女童（小）服装 > 女童（小）下装 > 女童（小）长裤",
};
const MALE_DENIM_PANTS = {
  categoryId: 8001,
  productTypeId: 8002,
  categoryName: "男童（小）牛仔裤",
  path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）牛仔裤",
};

function resolveCategory(categoryId, productTypeId) {
  return [MALE_CATEGORY, FEMALE_CATEGORY].find((category) =>
    category.categoryId === categoryId && category.productTypeId === productTypeId,
  ) ?? null;
}

function suggestion({
  skcCode,
  modelPresent,
  modelGender = "未知",
  colorGender = "未知",
  confidence = 0.96,
  category,
}) {
  return {
    skc_code: skcCode,
    model_present: modelPresent,
    model_gender: modelGender,
    color_gender: colorGender,
    resolved_gender: modelPresent ? modelGender : colorGender,
    gender_basis: modelPresent ? "MODEL" : "COLOR",
    confidence,
    primary: {
      category_id: category.categoryId,
      product_type_id: category.productTypeId,
      category_name: category.categoryName,
      path: category.path,
    },
    reasons: [],
  };
}

function plan(overrides = {}) {
  assert.equal(typeof planner.planNeutralSkcDrafts, "function");
  return planner.planNeutralSkcDrafts({
    genderName: "中性",
    skcs: [
      { skcCode: "IRON_GRAY", colorName: "铁灰" },
      { skcCode: "KHAKI", colorName: "浅卡其" },
      { skcCode: "PURPLE", colorName: "风信紫" },
    ],
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "KHAKI",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "PURPLE",
          modelPresent: false,
          colorGender: "女童",
          category: FEMALE_CATEGORY,
        }),
      ],
    },
    resolveCategory,
    ...overrides,
  });
}

test("non-neutral products keep the existing single-draft flow", { skip: !plannerExists }, () => {
  const result = plan({ genderName: "男童" });

  assert.equal(result.status, "NOT_APPLICABLE");
  assert.equal(result.groups.length, 0);
});

test("recognizable model gender overrides a conflicting color tendency", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [{ skcCode: "GRAY_WITH_GIRL", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "GRAY_WITH_GIRL",
          modelPresent: true,
          modelGender: "女童",
          colorGender: "男童",
          category: FEMALE_CATEGORY,
        }),
      ],
    },
  });

  assert.equal(result.status, "READY");
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].gender, "FEMALE");
  assert.equal(result.groups[0].evidenceBasis, "MODEL");
});

test("color tendency is used only when the style image has no model", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [{ skcCode: "GRAY_NO_MODEL", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "GRAY_NO_MODEL",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
      ],
    },
  });

  assert.equal(result.status, "READY");
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].gender, "MALE");
  assert.equal(result.groups[0].evidenceBasis, "COLOR");
});

test("missing images and images with indeterminate model presence may both use color fallback", { skip: !plannerExists }, () => {
  const noImage = plan({
    skcs: [{ skcCode: "KHAKI_NO_IMAGE", colorName: "浅卡其A", imageUrl: null }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "KHAKI_NO_IMAGE",
          modelPresent: null,
          colorGender: "男童",
          confidence: 0.8,
          category: MALE_CATEGORY,
        }),
        gender_basis: "COLOR",
      }],
    },
  });
  assert.equal(noImage.status, "READY");
  assert.equal(noImage.groups[0].evidenceBasis, "COLOR");

  const existingImage = plan({
    skcs: [{
      skcCode: "KHAKI_WITH_IMAGE",
      colorName: "浅卡其",
      imageUrl: "https://example.test/khaki.jpg",
    }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "KHAKI_WITH_IMAGE",
          modelPresent: null,
          colorGender: "男童",
          confidence: 0.85,
          category: MALE_CATEGORY,
        }),
        gender_basis: "COLOR",
      }],
    },
  });
  assert.equal(existingImage.status, "READY");
  assert.equal(existingImage.groups[0].gender, "MALE");
  assert.equal(existingImage.groups[0].evidenceBasis, "COLOR");
});

test("known color rules recover uncertain khaki evidence and promote specific sweatpants categories", { skip: !plannerExists }, () => {
  const categoryPayload = (category) => ({
    category_id: category.categoryId,
    product_type_id: category.productTypeId,
    category_name: category.categoryName,
    path: category.path,
  });
  const result = plan({
    productText: "长裤 针织长裤",
    skcs: [
      { skcCode: "IRON_GRAY", colorName: "铁灰20603" },
      { skcCode: "KHAKI", colorName: "浅卡其50311" },
      { skcCode: "KHAKI_A", colorName: "浅卡其A51606", imageUrl: null },
      { skcCode: "PURPLE", colorName: "风信紫70641" },
    ],
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: ["中性款需要拆分，部分SKC使用颜色兜底"],
      blockingRisks: ["存在浅卡其等中性色SKC，且无模特或缺图，无法明确性别，需人工确认"],
      skcSuggestions: [
        {
          skc_code: "IRON_GRAY",
          model_present: false,
          model_gender: "未知",
          color_gender: "男童",
          resolved_gender: "男童",
          gender_basis: "COLOR",
          confidence: 0.8,
          primary: categoryPayload(GENERIC_MALE_PANTS),
          alternatives: [categoryPayload(MALE_CATEGORY)],
        },
        {
          skc_code: "KHAKI",
          model_present: false,
          model_gender: "未知",
          color_gender: "中性",
          resolved_gender: "未知",
          gender_basis: "UNKNOWN",
          confidence: 0.5,
          primary: categoryPayload(GENERIC_MALE_PANTS),
          alternatives: [
            categoryPayload(GENERIC_FEMALE_PANTS),
            categoryPayload(MALE_CATEGORY),
            categoryPayload(FEMALE_CATEGORY),
          ],
        },
        {
          skc_code: "KHAKI_A",
          model_present: null,
          model_gender: "未知",
          color_gender: "中性",
          resolved_gender: "未知",
          gender_basis: "UNKNOWN",
          confidence: 0.4,
          primary: categoryPayload(GENERIC_MALE_PANTS),
          alternatives: [
            categoryPayload(GENERIC_FEMALE_PANTS),
            categoryPayload(MALE_CATEGORY),
            categoryPayload(FEMALE_CATEGORY),
          ],
        },
        {
          skc_code: "PURPLE",
          model_present: false,
          model_gender: "未知",
          color_gender: "女童",
          resolved_gender: "女童",
          gender_basis: "COLOR",
          confidence: 0.8,
          primary: categoryPayload(GENERIC_FEMALE_PANTS),
          alternatives: [categoryPayload(FEMALE_CATEGORY)],
        },
      ],
    },
    resolveCategory: (categoryId, productTypeId) =>
      [MALE_CATEGORY, FEMALE_CATEGORY, GENERIC_MALE_PANTS, GENERIC_FEMALE_PANTS]
        .find((category) =>
          category.categoryId === categoryId && category.productTypeId === productTypeId,
        ) ?? null,
  });

  assert.equal(result.status, "READY");
  assert.deepEqual(
    result.groups.map((group) => ({
      gender: group.gender,
      skcCodes: group.skcCodes,
      category: [group.category.categoryId, group.category.productTypeId],
      confidence: group.confidence,
      evidence: group.skcEvidence.map((item) => ({
        skcCode: item.skc_code,
        resolvedGender: item.resolved_gender,
        basis: item.gender_basis,
        category: [item.primary.category_id, item.primary.product_type_id],
      })),
    })),
    [
      {
        gender: "MALE",
        skcCodes: ["IRON_GRAY", "KHAKI", "KHAKI_A"],
        category: [2713, 575],
        confidence: 0.8,
        evidence: [
          { skcCode: "IRON_GRAY", resolvedGender: "男童", basis: "COLOR", category: [2713, 575] },
          { skcCode: "KHAKI", resolvedGender: "男童", basis: "COLOR", category: [2713, 575] },
          { skcCode: "KHAKI_A", resolvedGender: "男童", basis: "COLOR", category: [2713, 575] },
        ],
      },
      {
        gender: "FEMALE",
        skcCodes: ["PURPLE"],
        category: [2712, 574],
        confidence: 0.8,
        evidence: [
          { skcCode: "PURPLE", resolvedGender: "女童", basis: "COLOR", category: [2712, 574] },
        ],
      },
    ],
  );
});

test("generic color uncertainty remains blocking without a known local color rule", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [{ skcCode: "BLUE", colorName: "蓝色" }],
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: false,
      risks: [],
      blockingRisks: ["颜色无法确认性别，需人工确认"],
      skcSuggestions: [
        suggestion({
          skcCode: "BLUE",
          modelPresent: false,
          colorGender: "男童",
          confidence: 0.8,
          category: MALE_CATEGORY,
        }),
      ],
    },
  });

  assert.equal(result.status, "NEEDS_REVIEW");
  assert.equal(result.reason, "AI_RESULT_RISKY");
});

test("specific sweatpants alternatives do not override generic pants without product semantics", { skip: !plannerExists }, () => {
  const result = plan({
    productText: "梭织长裤",
    skcs: [{ skcCode: "IRON_GRAY", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: GENERIC_MALE_PANTS,
        }),
        alternatives: [{
          category_id: MALE_CATEGORY.categoryId,
          product_type_id: MALE_CATEGORY.productTypeId,
          category_name: MALE_CATEGORY.categoryName,
          path: MALE_CATEGORY.path,
        }],
      }],
    },
    resolveCategory: (categoryId, productTypeId) =>
      [MALE_CATEGORY, GENERIC_MALE_PANTS].find((category) =>
        category.categoryId === categoryId && category.productTypeId === productTypeId,
      ) ?? null,
  });

  assert.equal(result.status, "READY");
  assert.deepEqual(
    [result.groups[0].category.categoryId, result.groups[0].category.productTypeId],
    [GENERIC_MALE_PANTS.categoryId, GENERIC_MALE_PANTS.productTypeId],
  );
});

test("sweatpants semantics never override an already specific primary category", { skip: !plannerExists }, () => {
  const result = plan({
    productText: "针织长裤",
    skcs: [{ skcCode: "IRON_GRAY", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_DENIM_PANTS,
        }),
        alternatives: [{
          category_id: MALE_CATEGORY.categoryId,
          product_type_id: MALE_CATEGORY.productTypeId,
          category_name: MALE_CATEGORY.categoryName,
          path: MALE_CATEGORY.path,
        }],
      }],
    },
    resolveCategory: (categoryId, productTypeId) =>
      [MALE_CATEGORY, MALE_DENIM_PANTS].find((category) =>
        category.categoryId === categoryId && category.productTypeId === productTypeId,
      ) ?? null,
  });

  assert.equal(result.status, "READY");
  assert.deepEqual(
    [result.groups[0].category.categoryId, result.groups[0].category.productTypeId],
    [MALE_DENIM_PANTS.categoryId, MALE_DENIM_PANTS.productTypeId],
  );
});

test("an explicitly present model with unknown gender cannot be overridden by color", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [{
      skcCode: "MODEL_UNKNOWN",
      colorName: "风信紫",
      imageUrl: "https://example.test/model-unknown.jpg",
    }],
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "MODEL_UNKNOWN",
          modelPresent: true,
          modelGender: "未知",
          colorGender: "女童",
          confidence: 0.9,
          category: FEMALE_CATEGORY,
        }),
        gender_basis: "COLOR",
      }],
    },
  });

  assert.equal(result.status, "NEEDS_REVIEW");
  assert.deepEqual(result.unresolvedSkcCodes, ["MODEL_UNKNOWN"]);
});

test("male and female SKCs become two deterministic publish groups", { skip: !plannerExists }, () => {
  const result = plan();

  assert.equal(result.status, "READY");
  assert.equal(result.splitByGender, true);
  assert.deepEqual(
    result.groups.map((group) => ({
      gender: group.gender,
      skcCodes: group.skcCodes,
      categoryId: group.category.categoryId,
    })),
    [
      {
        gender: "MALE",
        skcCodes: ["IRON_GRAY", "KHAKI"],
        categoryId: MALE_CATEGORY.categoryId,
      },
      {
        gender: "FEMALE",
        skcCodes: ["PURPLE"],
        categoryId: FEMALE_CATEGORY.categoryId,
      },
    ],
  );
});

test("a neutral product with only one resolved gender creates one publish group", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [
      { skcCode: "IRON_GRAY", colorName: "铁灰" },
      { skcCode: "KHAKI", colorName: "浅卡其" },
    ],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "KHAKI",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
      ],
    },
  });

  assert.equal(result.status, "READY");
  assert.equal(result.splitByGender, false);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].skcCodes, ["IRON_GRAY", "KHAKI"]);
});

test("expected split explanations do not block complete SKC evidence, but explicit blocking risks do", { skip: !plannerExists }, () => {
  const informational = plan({
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: ["中性商品有男童和女童款色，需要拆分发布。"],
      blockingRisks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "KHAKI",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "PURPLE",
          modelPresent: false,
          colorGender: "女童",
          category: FEMALE_CATEGORY,
        }),
      ],
    },
  });
  assert.equal(informational.status, "READY");

  const blocked = plan({
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: [],
      blockingRisks: ["风信紫图片与颜色名冲突，无法可靠识别。"],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "KHAKI",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "PURPLE",
          modelPresent: false,
          colorGender: "女童",
          category: FEMALE_CATEGORY,
        }),
      ],
    },
  });
  assert.equal(blocked.status, "NEEDS_REVIEW");
  assert.equal(blocked.reason, "AI_RESULT_RISKY");
});

test("neutral SKC evidence at the explicit 0.80 automation threshold is accepted", { skip: !plannerExists }, () => {
  const result = plan({
    skcs: [{ skcCode: "IRON_GRAY", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      blockingRisks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          confidence: 0.8,
          category: MALE_CATEGORY,
        }),
      ],
    },
  });

  assert.equal(result.status, "READY");
  assert.equal(result.groups[0].confidence, 0.8);
});

test("missing, unknown, or low-confidence SKC evidence keeps the whole neutral product for review", { skip: !plannerExists }, () => {
  const missing = plan({
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
      ],
    },
  });
  assert.equal(missing.status, "NEEDS_REVIEW");
  assert.deepEqual(missing.groups, []);
  assert.deepEqual(missing.unresolvedSkcCodes, ["KHAKI", "PURPLE"]);

  const unknown = plan({
    skcs: [{ skcCode: "UNKNOWN", colorName: "拼色" }],
    liveAi: {
      status: "AMBIGUOUS",
      splitBySkc: true,
      risks: [],
      skcSuggestions: [{
        ...suggestion({
          skcCode: "UNKNOWN",
          modelPresent: false,
          colorGender: "未知",
          category: MALE_CATEGORY,
        }),
        gender_basis: "UNKNOWN",
      }],
    },
  });
  assert.equal(unknown.status, "NEEDS_REVIEW");
  assert.deepEqual(unknown.unresolvedSkcCodes, ["UNKNOWN"]);

  const lowConfidence = plan({
    skcs: [{ skcCode: "LOW", colorName: "蓝色" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "LOW",
          modelPresent: false,
          colorGender: "男童",
          confidence: 0.799,
          category: MALE_CATEGORY,
        }),
      ],
    },
  });
  assert.equal(lowConfidence.status, "NEEDS_REVIEW");
  assert.deepEqual(lowConfidence.unresolvedSkcCodes, ["LOW"]);
});

test("invalid or gender-mismatched category pairs never create split drafts", { skip: !plannerExists }, () => {
  const invalid = plan({ resolveCategory: () => null });
  assert.equal(invalid.status, "NEEDS_REVIEW");
  assert.deepEqual(invalid.groups, []);

  const mismatched = plan({
    skcs: [{ skcCode: "BOY", colorName: "铁灰" }],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "BOY",
          modelPresent: false,
          colorGender: "男童",
          category: FEMALE_CATEGORY,
        }),
      ],
    },
  });
  assert.equal(mismatched.status, "NEEDS_REVIEW");
  assert.deepEqual(mismatched.unresolvedSkcCodes, ["BOY"]);
});

test("conflicting categories inside one gender group require review", { skip: !plannerExists }, () => {
  const otherMale = {
    categoryId: 8001,
    productTypeId: 8002,
    categoryName: "男童（小）长裤",
    path: "儿童 > 男童（小）服装 > 男童（小）下装 > 男童（小）长裤",
  };
  const result = plan({
    skcs: [
      { skcCode: "IRON_GRAY", colorName: "铁灰" },
      { skcCode: "KHAKI", colorName: "浅卡其" },
    ],
    liveAi: {
      status: "READY",
      splitBySkc: false,
      risks: [],
      skcSuggestions: [
        suggestion({
          skcCode: "IRON_GRAY",
          modelPresent: false,
          colorGender: "男童",
          category: MALE_CATEGORY,
        }),
        suggestion({
          skcCode: "KHAKI",
          modelPresent: false,
          colorGender: "男童",
          category: otherMale,
        }),
      ],
    },
    resolveCategory: (categoryId, productTypeId) =>
      [MALE_CATEGORY, otherMale].find((category) =>
        category.categoryId === categoryId && category.productTypeId === productTypeId,
      ) ?? null,
  });

  assert.equal(result.status, "NEEDS_REVIEW");
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.unresolvedSkcCodes, ["IRON_GRAY", "KHAKI"]);
});
