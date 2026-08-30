import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const requireFromWeb = createRequire(new URL("../../web/package.json", import.meta.url));
const sharp = requireFromWeb("sharp");

const shared = await import("../../web/server/services/pre-publish/shared.ts");
const drafts = await import("../../web/server/services/pre-publish/drafts.ts");
const fieldFills = await import("../../web/server/services/pre-publish/field-fills.ts");
const images = await import("../../web/server/services/pre-publish/images.ts");
const imagePackage = await import("../../web/server/services/pre-publish/image-package.ts");
const payload = await import("../../web/server/services/pre-publish/payload.ts");
const sheinApi = await import("../../web/server/services/pre-publish/shein-api.ts");
const versions = await import("../../web/server/services/pre-publish/versions.ts");
const uploadGuard = await import("../../web/server/lib/upload-guard.ts");
const prePublishRoute = await import("../../web/server/routes/pre-publish.ts");

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function rgbPng(width, height, colorForRow) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const pixels = Buffer.concat(Array.from({ length: height }, (_, y) => {
    const row = Buffer.alloc(1 + width * 3);
    const color = colorForRow(y);
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 3] = color[0];
      row[2 + x * 3] = color[1];
      row[3 + x * 3] = color[2];
    }
    return row;
  }));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(pixels)),
    pngChunk("IEND"),
  ]);
}

function solidPng(width, height) {
  return rgbPng(width, height, () => [255, 255, 255]);
}

test("SHEIN image packages parse exact SPU/SKC paths and assign image fields in business order", () => {
  const parsed = [
    imagePackage.parseSheinImagePackageEntry("SHEIN图包/208326102001/20832610200100366/20832610200100366_2.jpg", 200),
    imagePackage.parseSheinImagePackageEntry("SHEIN图包/208326102001/20832610200100366/20832610200100366_1.jpg", 100),
  ].filter(Boolean);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].spu_code, "208326102001");
  assert.equal(parsed[0].skc_code, "20832610200100366");
  assert.equal(imagePackage.parseSheinImagePackageEntry("../208326102001/20832610200100366/20832610200100366_1.jpg"), null);
  assert.equal(imagePackage.parseSheinImagePackageEntry("SHEIN图包/208326102001/other/other_1.jpg"), null);

  const [group] = imagePackage.groupSheinImagePackageEntries(parsed);
  assert.deepEqual(group.entries.map((entry) => entry.image_index), [1, 2]);
  assert.deepEqual(
    imagePackage.packageImageAssignments(group).map((assignment) => [
      assignment.requirement_key,
      assignment.asset_type,
      assignment.image_sort,
      assignment.entry.image_index,
      assignment.derivative,
    ]),
    [
      ["SKC_DETAIL", "MAIN", 1, 1, null],
      ["SKC_DETAIL", "DETAIL", 2, 2, null],
      ["SKC_SQUARE", "SQUARE", 1, 1, "square-center-crop"],
      ["SKC_COLOR_BLOCK", "COLOR_BLOCK", 1, 1, "color-square-80"],
    ],
  );
});

test("pre-publish shared helpers normalize input and build stable scoped keys", () => {
  assert.equal(shared.normalizeText("  A \n B  "), "A \n B");
  assert.equal(shared.compactText("  A \n   B  ", 3), "A B");
  assert.deepEqual(shared.parseJsonArray("[1,2]"), [1, 2]);
  assert.deepEqual(shared.parseJsonArray("{\"a\":1}"), []);
  assert.deepEqual(shared.parseJsonObject("{\"a\":1}"), { a: 1 });
  assert.deepEqual(shared.parseJsonList("红色、蓝色|绿色"), ["红色", "蓝色", "绿色"]);
  assert.deepEqual(shared.batchTerms(" A A, B；C "), ["A", "B", "C"]);
  assert.equal(shared.asNumber("12.5"), 12.5);
  assert.equal(shared.asNumber("bad"), null);
  assert.equal(shared.asPositiveNumber("0"), null);
  assert.equal(shared.readLimit("999", 50, 200), 200);
  assert.equal(shared.readOffset("-1"), 0);
  assert.deepEqual(shared.uniqueStrings(["A", " A ", "", null, "B"]), ["A", "B"]);
  assert.equal(
    shared.buildScopeKey({ spuCode: "SPU1", skcCode: "SKC1", skuCode: "SKU1", fieldKey: "title" }),
    "spu:SPU1|skc:SKC1|sku:SKU1|field:title",
  );
  assert.equal(
    shared.buildScopeKey({ spuCode: "SPU1", fieldKey: "title" }),
    "spu:SPU1|skc:*|sku:*|field:title",
  );
});

test("draft SKC selection rejects empty and unknown selections instead of expanding to all SKCs", () => {
  const available = ["SKC-1", "SKC-2"];

  assert.equal(shared.validateRequestedDraftSkcCodes(undefined, available), undefined);
  assert.deepEqual(
    shared.validateRequestedDraftSkcCodes([" SKC-2 ", "SKC-2"], available),
    ["SKC-2"],
  );
  assert.throws(
    () => shared.validateRequestedDraftSkcCodes([], available),
    /至少选择一个款色/,
  );
  assert.throws(
    () => shared.validateRequestedDraftSkcCodes(["MISSING"], available),
    /不属于当前商品/,
  );
  assert.throws(
    () => shared.validateRequestedDraftSkcCodes("SKC-1", available),
    /格式无效/,
  );
});

test("draft status transitions block active publish states and permit ordinary draft repair flows", () => {
  assert.equal(drafts.canTransitionDraftStatus("PUBLISHING", "DRAFT"), false);
  assert.equal(drafts.canTransitionDraftStatus("PUBLISH_SUBMITTED", "PAUSED"), false);
  assert.equal(drafts.canTransitionDraftStatus("READY_TO_PUBLISH", "PAUSED"), true);
  assert.equal(drafts.canTransitionDraftStatus("PAUSED", "READY_TO_PUBLISH"), false);
  assert.equal(drafts.canTransitionDraftStatus("ARCHIVED", "DRAFT"), true);
});

test("SHEIN publish claim fences unknown results and closes local preparation failures", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /PUBLISH_MUTATION_FENCED_STATUSES[\s\S]*PUBLISH_RESULT_UNKNOWN/);
  assert.match(source, /function markClaimedPublishPreparationFailed[\s\S]*status = 'PUBLISH_FAILED'[\s\S]*status = 'PUBLISHING'/);
  assert.match(source, /update listing_publish_version[\s\S]*status = 'FAILED'[\s\S]*status not in \('SUBMITTED', 'RESULT_UNKNOWN'\)/);
  const publishRoute = source.slice(source.indexOf('prePublish.post("/drafts/:id/publish"'));
  assert.match(publishRoute, /claimListingForPublish[\s\S]*try \{[\s\S]*createPublishVersion[\s\S]*ensurePublishTask/);
  assert.match(publishRoute, /catch \(error\)[\s\S]*markClaimedPublishPreparationFailed/);
});

test("duplicate re-locks the SPU and source listing before deriving a new draft", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const duplicateRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/duplicate"'),
    source.indexOf('prePublish.patch("/drafts/:id/status"'),
  );

  assert.match(duplicateRoute, /const result = db\.transaction\(\(\) => \{[\s\S]*lockProductSpuForPublishScope/);
  assert.match(duplicateRoute, /lockListingForMutation\(db, listingId\)[\s\S]*getSourceProductRow\(db, lockedListing\.spu_code\)/);
  assert.match(duplicateRoute, /getReadinessForListing\(db, lockedListing\)/);
  assert.doesNotMatch(duplicateRoute, /const listing = db\.prepare\("select \* from listing where id = \?"\)[\s\S]*const sourceRow = getSourceProductRow/);
});

test("SHEIN publish claim serializes the platform/account/SPU scope and releases it before network work", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const publishRouteStart = source.indexOf('prePublish.post("/drafts/:id/publish"');
  const publishRoute = source.slice(publishRouteStart);
  const claimSection = publishRoute.slice(0, publishRoute.indexOf("let version"));

  assert.match(source, /PUBLISH_SCOPE_FENCED_STATUSES[\s\S]*UNDER_REVIEW[\s\S]*PARTIALLY_APPROVED[\s\S]*APPROVED/);
  assert.match(source, /from listing[\s\S]*platform = \?[\s\S]*channel_account_id = \?[\s\S]*product_spu_id = \?[\s\S]*for update/);
  assert.match(claimSection, /db\.transaction\(\(\) => \{[\s\S]*lockPublishScope/);
  assert.match(source, /function assertPublishScopeAvailable[\s\S]*findUnresolvedPublishTask\(db, listingId\)/);
  assert.doesNotMatch(claimSection, /prepareListingImagesForPublish|publishListing\(/);
  assert.match(publishRoute, /const claimResult = db\.transaction\(\(\) =>/);
});

test("SHEIN publish scope fences task-only review and approved status drift", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const activeTaskStatuses = source.slice(
    source.indexOf("const PUBLISH_SCOPE_ACTIVE_TASK_STATUSES"),
    source.indexOf("function lockListingForMutation"),
  );
  const scopeAssertion = source.slice(
    source.indexOf("function assertPublishScopeAvailable"),
    source.indexOf("function claimListingForPublish"),
  );

  for (const status of [
    "PUBLISHING",
    "PUBLISH_SUBMITTED",
    "PUBLISH_RESULT_UNKNOWN",
    "UNDER_REVIEW",
    "PARTIALLY_APPROVED",
    "APPROVED",
  ]) {
    assert.match(activeTaskStatuses, new RegExp(`\\"${status}\\"`));
  }
  for (const terminalStatus of ["REJECTED", "REVOKED", "PUBLISH_FAILED", "FAILED"]) {
    assert.doesNotMatch(activeTaskStatuses, new RegExp(`\\"${terminalStatus}\\"`));
  }

  assert.match(scopeAssertion, /const busyTask = scope\.activeTasks\.find\(\(task\) => Number\(task\.listing_id\) !== listingId\)/);
  assert.match(scopeAssertion, /throw new HTTPException\(409, \{[\s\S]*SHEIN 发布范围已有未解决的发布任务/);
  assert.match(scopeAssertion, /findUnresolvedPublishTask\(db, listingId\)/);
});

test("SHEIN publish success and business failure finalization each use one local transaction", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const networkCall = source.indexOf("result = await platformAdapter.publishListing");
  const successStart = source.indexOf('if (code === "0" && info.success !== false && businessValidationErrors.length === 0)');
  const failureStart = source.indexOf("const failureCode =", successStart);
  const routeEnd = source.indexOf('prePublish.post("/field-fills"', failureStart);
  const successBlock = source.slice(successStart, failureStart);
  const failureBlock = source.slice(failureStart, routeEnd);
  assert.ok(networkCall >= 0 && networkCall < successStart);
  assert.match(successBlock, /db\.transaction\(\(\) => \{/);
  assert.match(failureBlock, /db\.transaction\(\(\) => \{/);
  for (const block of [successBlock, failureBlock]) {
    assert.doesNotMatch(block, /publishListing/);
    assert.match(block, /listing_publish_version/);
    assert.match(block, /update listing[\s\S]*shein_product_bucket/);
  }
  assert.match(successBlock, /listing_publish_task/);
  assert.match(failureBlock, /markPublishTaskFailed/);
  assert.match(successBlock, /listing_validation_result/);
  assert.match(successBlock, /persistPlatformIdentity/);
  assert.match(failureBlock, /listing_validation_result/);
  assert.ok(successBlock.lastIndexOf("})()") > successBlock.indexOf("persistPlatformIdentity"));
  assert.ok(failureBlock.lastIndexOf("})()") > failureBlock.indexOf("listing_validation_result"));
  const assertInsideFinalize = (block, token) => {
    const open = block.indexOf("db.transaction(() => {");
    const close = block.indexOf("})()", open);
    const position = block.indexOf(token);
    assert.ok(open >= 0 && close > open && position > open && position < close, `${token} escaped finalize transaction`);
  };
  for (const token of [
    "listing_publish_task",
    "listing_publish_version",
    "update listing",
    "shein_product_bucket",
    "listing_validation_result",
    "persistPlatformIdentity",
  ]) {
    assertInsideFinalize(successBlock, token);
  }
  for (const token of [
    "markPublishTaskFailed",
    "listing_publish_version",
    "update listing",
    "shein_product_bucket",
    "listing_validation_result",
  ]) {
    assertInsideFinalize(failureBlock, token);
  }
});

test("AI draft mutations keep the publish-state lock in the same write transaction", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const enrichRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/ai-enrich"'),
    source.indexOf('prePublish.post("/drafts/:id/ai-field"'),
  );
  const fieldRoute = source.slice(source.indexOf('prePublish.post("/drafts/:id/ai-field"'));

  assert.doesNotMatch(source, /db\.transaction\(\(\) => lockListingForMutation\(db, listingId\)\)\(\)/);
  assert.match(enrichRoute, /db\.transaction\(\(\) => \{[\s\S]*lockListingForMutation\(db, listingId\)[\s\S]*applyDraftCategoryDecision/);
  assert.match(enrichRoute, /db\.transaction\(\(\) => \{[\s\S]*lockListingForMutation\(db, listingId\)[\s\S]*persistFill/);
  assert.match(enrichRoute, /const refreshed = db\.transaction\(\(\) => \{[\s\S]*lockListingForMutation\(db, listingId\)[\s\S]*refreshListingAfterFill/);
  assert.match(fieldRoute, /const refreshed = db\.transaction\(\(\) => \{[\s\S]*lockListingForMutation\(db, listingId\)[\s\S]*persistFill[\s\S]*refreshListingAfterFill/);
  assert.match(source, /persistDraftFields\(\{ db, listing, listingId, fields, savedFrom: "draft_detail" \}\)[\s\S]*return refreshListingAfterFill/);
  assert.match(source, /if \(hasManualSizeChartRows\) persistManualSizeChart[\s\S]*return refreshListingAfterFill/);
  assert.match(source, /for \(const listingId of changedListingIds\) \{[\s\S]*refreshListingAfterFill\(db, listingId, "批量快速调整发布阻断项"\)/);
});

test("generic SPU workbench queries use the latest tenant package projection", async () => {
  const [migration, prePublish, sheinProducts, categoryMapping] = await Promise.all([
    readFile(path.join(PROJECT_ROOT, "db/migrations/052_latest_product_content_package.sql"), "utf8"),
    readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8"),
    readFile(path.join(PROJECT_ROOT, "web/server/routes/shein-products.ts"), "utf8"),
    readFile(path.join(PROJECT_ROOT, "web/server/routes/category-mapping.ts"), "utf8"),
  ]);

  assert.match(migration, /create view if not exists v_latest_product_content_package/i);
  assert.match(migration, /row_number\(\) over\s*\([\s\S]*partition by spu_code[\s\S]*order by coalesce\(updated_at, synced_at\) desc nulls last, id desc/i);
  for (const route of [prePublish, sheinProducts, categoryMapping]) {
    assert.match(route, /v_latest_product_content_package/);
    assert.doesNotMatch(route, /left join product_content_package pkg on pkg\.spu_code/i);
  }
  assert.match(sheinProducts, /join product_content_package pkg on pkg\.id = cskc\.content_package_id/i);
  assert.match(prePublish, /left join product_content_package pkg on pkg\.id = asset\.content_package_id/i);
});

test("field-fill helpers coerce enum values without losing manual text values", () => {
  const multiEnumField = { render_kind: "multi_enum" };
  const textField = { render_kind: "text" };
  assert.deepEqual(fieldFills.coerceFieldValues(multiEnumField, "[\"红色\",\"蓝色\"]"), ["红色", "蓝色"]);
  assert.deepEqual(fieldFills.coerceFieldValues(multiEnumField, "红色、蓝色"), ["红色", "蓝色"]);
  assert.deepEqual(fieldFills.coerceFieldValues(textField, "  手填值  "), ["手填值"]);
  assert.deepEqual(fieldFills.coerceFieldValues(textField, "   "), []);
});

test("field-fill helpers normalize cotton blend material to platform fabric", () => {
  assert.equal(fieldFills.normalizeMaterialValue("棉混纺"), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("  棉 混 纺  "), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("Cotton Blend"), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("聚酯纤维"), "聚酯纤维");
});

test("conditional customs attributes expose lining when fabric clothing rules require it", () => {
  assert.deepEqual(
    fieldFills.contextualAttributeState?.({
      attributeId: 58,
      value: "",
      tariffValue: "无腰带环长裤",
      materialValue: "织物",
    }),
    { required: true, status: "MISSING" },
  );
  assert.deepEqual(
    fieldFills.contextualAttributeState?.({
      attributeId: 58,
      value: "无内衬",
      tariffValue: "连衫裤",
      materialValue: "织物",
    }),
    { required: true, status: "READY" },
  );
  assert.deepEqual(
    fieldFills.contextualAttributeState?.({
      attributeId: 58,
      value: "",
      tariffValue: "常规T恤",
      materialValue: "织物",
    }),
    { required: false, status: "WARNING" },
  );
  assert.equal(
    fieldFills.contextualAttributeState?.({
      attributeId: 999,
      value: "",
      tariffValue: "无腰带环长裤",
      materialValue: "织物",
    }),
    null,
  );
});

test("pre-publish attribute blockers reject missing template fields before calling SHEIN", () => {
  assert.deepEqual(
    fieldFills.blockingAttributeMessages?.([
      { label: "长度", status: "MISSING" },
      { label: "是否带里衬", status: "WARNING" },
      { label: "是否有口袋", status: "NEEDS_AI", is_required: 0 },
      { label: "材质", status: "READY" },
      { label: "护理说明/注意事项", status: "NEEDS_AI" },
    ]),
    [
      "商品属性「长度」未填写",
      "商品属性「护理说明/注意事项」未填写",
    ],
  );
});

test("SHEIN category metadata rejects mismatched category and product-type pairs", () => {
  assert.deepEqual(
    fieldFills.categoryPairState?.({
      categoryId: 2009,
      productTypeId: 7402,
      metadataMatch: false,
    }),
    {
      valid: false,
      status: "MISSING",
      error: "SHEIN 类目与 Product Type 不匹配：2009/7402，请重新选择叶子类目",
    },
  );
  assert.deepEqual(
    fieldFills.categoryPairState?.({
      categoryId: 2557,
      productTypeId: 7402,
      metadataMatch: true,
    }),
    {
      valid: true,
      status: "READY",
      error: null,
    },
  );
  assert.deepEqual(
    fieldFills.categoryPairState?.({
      categoryId: 9999,
      productTypeId: 8888,
      metadataMatch: false,
      metadataKnown: false,
    }),
    {
      valid: true,
      status: "WARNING",
      error: null,
    },
  );
});

test("composition percentages are renormalized after unsupported fibers are removed", () => {
  assert.deepEqual(
    fieldFills.normalizePercentageParts?.([
      { name: "棉", value: 95 },
    ]),
    [{ name: "棉", value: 100 }],
  );
  const normalized = fieldFills.normalizePercentageParts?.([
    { name: "棉", value: 95 },
    { name: "聚酯纤维", value: 10 },
  ]);
  assert.deepEqual(normalized, [
    { name: "棉", value: 90 },
    { name: "聚酯纤维", value: 10 },
  ]);
  assert.equal(normalized?.reduce((sum, part) => sum + part.value, 0), 100);
});

test("SHEIN composition payload renormalizes only matched enum items to 100", () => {
  const payloadItems = fieldFills.buildCompositionAttributeItems?.({
    attributeId: 100,
    compositionSource: "68.4%棉；31.5%聚酯纤维；0.1%不支持纤维",
    options: [
      { attribute_value_id: 1, attribute_value: "棉" },
      { attribute_value_id: 2, attribute_value: "聚酯纤维" },
    ],
  });
  assert.deepEqual(payloadItems, [
    { attribute_id: 100, attribute_value_id: 1, attribute_extra_value: "68" },
    { attribute_id: 100, attribute_value_id: 2, attribute_extra_value: "32" },
  ]);
  assert.equal(
    payloadItems?.reduce((sum, item) => sum + Number(item.attribute_extra_value), 0),
    100,
  );

  assert.deepEqual(
    fieldFills.buildCompositionAttributeItems?.({
      attributeId: 100,
      compositionSource: "95%棉；5%不支持纤维",
      options: [{ attribute_value_id: 1, attribute_value: "棉" }],
    }),
    [{ attribute_id: 100, attribute_value_id: 1, attribute_extra_value: "100" }],
  );
});

test("field-fill helpers avoid unspecified tariff values for T-shirt contexts", () => {
  assert.equal(typeof fieldFills.tariffValueCandidatesForContext, "function");
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("女童（小）T恤 T-Shirt"),
    ["常规T恤", "非常规T恤", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 儿童鞋子 > 儿童靴", ["休闲鞋", "凉鞋", "单鞋", "靴子", "未列明关税种类"]),
    ["靴子", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 儿童箱包 > 儿童背包", ["单肩包", "双肩包", "托特包", "未列明关税种类"]),
    ["双肩包", "单肩包", "托特包", "未列明关税种类"],
  );
});

test("field-fill helpers infer related tariff values for child and baby category synonyms", () => {
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 女童（大）服装 > 女童（大）下装 > 女童（大）卫裤", [
      "无腰带环短裤",
      "无腰带环长裤",
      "有腰带环长裤",
      "未列明关税种类",
    ]),
    ["无腰带环长裤", "有腰带环长裤", "无腰带环短裤", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 儿童鞋子 > 儿童洞洞鞋", [
      "休闲鞋",
      "凉鞋",
      "家居鞋",
      "拖鞋",
      "未列明关税种类",
    ]),
    ["休闲鞋", "凉鞋", "家居鞋", "拖鞋", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 儿童校园用品 > 儿童手工与美术工具 > 儿童绘画用品", [
      "DIY绘画套装",
      "学生绘图套装",
      "画笔",
      "画纸",
      "绘画颜料套装",
      "未列明关税种类",
    ]),
    ["DIY绘画套装", "绘画颜料套装", "学生绘图套装", "画笔", "画纸", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("儿童 > 儿童配饰 > 儿童眼镜和眼镜配件 > 儿童平光镜", [
      "变色眼镜",
      "普通眼镜",
      "眼镜架",
      "装饰眼镜(日常用)",
      "未列明关税种类",
    ]),
    ["普通眼镜", "眼镜架", "变色眼镜", "装饰眼镜(日常用)", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("婴儿 > 婴儿用品 > 婴儿出行装备 > 妈咪包", [
      "单肩包",
      "双肩包",
      "妈妈包",
      "手提包",
      "托特包",
      "收纳包",
      "收纳袋",
      "斜挎包",
      "未列明关税种类",
    ]),
    ["妈妈包", "双肩包", "单肩包", "斜挎包", "手提包", "托特包", "收纳包", "收纳袋", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("婴儿 > 婴儿用品 > 婴儿出行装备 > 婴儿背巾", ["婴儿背带", "未列明关税种类"]),
    ["婴儿背带", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("婴儿 > 婴儿玩具 > 婴儿手抓球", ["玩具球", "未列明关税种类"]),
    ["玩具球", "未列明关税种类"],
  );
  assert.deepEqual(
    fieldFills.tariffValueCandidatesForContext("婴儿 > 孕产用品 > 孕产监护设备", ["胎心仪", "未列明关税种类"]),
    ["胎心仪", "未列明关税种类"],
  );
});

test("pre-publish route applies tariff candidates before SHEIN payload submission", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /tariffValueCandidatesForContext\(context,\s*attr\.values\)/);
  assert.match(source, /tariffValueCandidatesForContext\(text,\s*field\.options/);
  assert.match(source, /function tariffFieldValuesForListing/);
  assert.match(source, /field\.label\.includes\("关税"\)[\s\S]+tariffFieldValuesForListing\(field,\s*listing\)/);
});

test("pre-publish route exposes the deprecated tariff/material customs field when tariff is unspecified", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const detailPage = await readFile(path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/[listingId]/page.tsx"), "utf8");
  assert.match(source, /DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID\s*=\s*1000714/);
  assert.match(source, /废弃关税种类或废弃材质/);
  assert.match(source, /conditional_on/);
  assert.match(source, /shouldIncludeDependentCustomsField/);
  assert.match(detailPage, /isConditionalFieldVisible/);
  assert.match(detailPage, /manualValues\[field\.conditional_on\.field_key\]/);
});

test("pre-publish includes contextual lining metadata and blocks it only when the customs rule is active", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const requiredAttributes = source.slice(
    source.indexOf("function getRequiredAttributes"),
    source.indexOf("function getAttributeById"),
  );
  assert.match(requiredAttributes, /attr\.attribute_id in \(58\$\{supplementalPlaceholders/);
  assert.match(source, /contextualAttributeState\(/);
  assert.match(source, /if \(contextual\.required\) field\.is_required = 1/);
  assert.match(source, /SHEIN 关务条件属性/);
  assert.match(source, /blockingAttributeMessages\(/);

  const buildRow = source.slice(
    source.indexOf("function buildRow"),
    source.indexOf("function buildReadiness"),
  );
  assert.ok(
    buildRow.indexOf("getStoredFill(fills, spuCode, field.key)") < buildRow.indexOf("contextualAttributeState("),
    "stored tariff/material values must be applied before contextual attribute rules",
  );
  assert.match(buildRow, /if \(field\.key === "category"\) continue/);
});

test("pre-publish detects invalid category pairs and still resolves template fields by product type", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /function getCategoryPairMetadata/);
  assert.match(source, /function requiredAttributeCategoryId/);
  assert.match(source, /categoryPairState\(/);
  assert.match(source, /categoryPair\.error/);
});

test("image service builds SHEIN picture requirements and validates common image constraints", () => {
  const requirements = images.buildPictureRequirements([
    { field_key: "skc_image_square_show", is_true: 1 },
    { field_key: "skc_image_square_required", is_true: 1 },
    { field_key: "skc_image_detail_single", is_true: 0 },
  ]);
  const squareRequirement = requirements.find((item) => item.requirement_key === "SKC_SQUARE");
  assert.equal(squareRequirement.required, 1);
  assert.equal(squareRequirement.max_count, 1);
  assert.deepEqual(squareRequirement.asset_types, ["SQUARE"]);
  assert.equal(
    squareRequirement.dimension_rule,
    "1:1，900-2200 px；或 3:4，宽 900-2200 px（发布时自动居中裁切为方图）",
  );

  const detailRequirement = requirements.find((item) => item.requirement_key === "SKC_DETAIL");
  assert.equal(detailRequirement.max_count, 11);
  assert.deepEqual(images.pictureCapacityRules(detailRequirement), [
    { label: "SKC 主图/细节图", asset_types: ["MAIN", "DETAIL", "DETAIL_BACK"], max_count: 11 },
    { label: "主图", asset_types: ["MAIN"], max_count: 1 },
    { label: "细节图", asset_types: ["DETAIL", "DETAIL_BACK"], max_count: 10 },
  ]);
  assert.deepEqual(images.pictureCapacityRules(squareRequirement), [
    { label: "SKC 方形图", asset_types: ["SQUARE"], max_count: 1 },
  ]);
  assert.equal(images.canAddImagesToRequirement(0, 1, squareRequirement), true);
  assert.equal(images.canAddImagesToRequirement(1, 1, squareRequirement), false);
  assert.equal(images.canAddImagesToRequirement(10, 1, detailRequirement), true);
  assert.equal(images.canAddImagesToRequirement(11, 1, detailRequirement), false);

  assert.equal(
    images.imageCompliance({ width: 1200, height: 1200, file_size: 1024 * 1024 }, squareRequirement).status,
    "PASS",
  );
  assert.equal(
    images.imageCompliance({ width: 1340, height: 1785, file_size: 1024 * 1024 }, squareRequirement).status,
    "PASS",
  );
  assert.equal(
    images.imageCompliance({ width: 1200, height: 1600, file_size: 1024 * 1024 }, squareRequirement).status,
    "PASS",
  );
  assert.deepEqual(
    images.imageCompliance({ width: 800, height: 1067, file_size: 1024 * 1024 }, squareRequirement).reasons,
    ["SKC 方块图 3:4 图片宽度需在 900-2200 px"],
  );
  assert.deepEqual(
    images.imageCompliance({ width: 2300, height: 3067, file_size: 1024 * 1024 }, squareRequirement).reasons,
    ["SKC 方块图 3:4 图片宽度需在 900-2200 px"],
  );
  assert.deepEqual(
    images.imageCompliance({ width: 1200, height: 1800, file_size: 1024 * 1024 }, squareRequirement).reasons,
    ["SKC 方块图需为 1:1 或 3:4"],
  );

  const spuSquareRequirement = requirements.find((item) => item.requirement_key === "SPU_SQUARE");
  assert.deepEqual(
    images.imageCompliance({ width: 1200, height: 1600, file_size: 1024 * 1024 }, spuSquareRequirement).reasons,
    ["方形图需为 1:1"],
  );

  const switchOnly = images.buildPictureRequirements([{ field_key: "switch_spu_picture", is_true: 1 }]);
  assert.equal(switchOnly.every((item) => item.key.startsWith("skc-")), true);
});

test("SHEIN image payload guarantees one main image and stable type ordering per SKC", () => {
  const fallback = images.buildSheinImageInfo?.({
    skcCode: "SKC-1",
    skcImageUrl: "https://example.test/fallback-main.jpg",
    allowSourceImages: true,
    assets: [
      {
        id: 2,
        skc_code: "SKC-1",
        asset_type: "SQUARE",
        image_sort: 1,
        source_url: "https://example.test/square.jpg",
      },
      {
        id: 3,
        skc_code: "SKC-1",
        asset_type: "COLOR_BLOCK",
        image_sort: 1,
        source_url: "https://example.test/color.jpg",
      },
    ],
  });
  assert.deepEqual(fallback?.image_info_list.map((image) => image.image_type), [1, 5, 6]);
  assert.equal(
    fallback?.image_info_list.filter((image) => image.image_type === 1).length,
    1,
  );
  assert.equal(fallback?.image_info_list[0]?.image_url, "https://example.test/fallback-main.jpg");

  const fallbackWithoutColorAsset = images.buildSheinImageInfo?.({
    skcCode: "SKC-1",
    skcImageUrl: "https://example.test/fallback-main.jpg",
    allowSourceImages: true,
    assets: [],
  });
  assert.deepEqual(fallbackWithoutColorAsset?.image_info_list.map((image) => image.image_type), [1]);

  const preparedColorFromSource = images.buildSheinImageInfo?.({
    skcCode: "SKC-1",
    skcImageUrl: "",
    allowSourceImages: false,
    assets: [{
      id: 7,
      skc_code: "SKC-1",
      asset_type: "COLOR_BLOCK",
      image_sort: 1,
      platform_url: "https://img.shein.test/color-block.jpg",
      raw_payload_json: JSON.stringify({ source: "listing_skc.image_url", shein_image_type: 6 }),
    }],
  });
  assert.deepEqual(preparedColorFromSource?.image_info_list.map((image) => image.image_type), [6]);
  assert.equal(
    images.assetPreparedForImageType?.({ raw_payload_json: JSON.stringify({ shein_image_type: 6 }) }, 6),
    true,
  );

  const packageColorOverridesAutoSource = images.buildSheinImageInfo?.({
    skcCode: "SKC-1",
    skcImageUrl: "",
    allowSourceImages: false,
    assets: [
      {
        id: 8,
        skc_code: "SKC-1",
        source_type: "SKC_SOURCE_IMAGE",
        asset_type: "COLOR_BLOCK",
        image_sort: 1,
        platform_url: "https://img.shein.test/auto-color-block.jpg",
        raw_payload_json: JSON.stringify({ source: "listing_skc.image_url", shein_image_type: 6 }),
      },
      {
        id: 9,
        skc_code: "SKC-1",
        source_type: "SHEIN_IMAGE_PACKAGE",
        asset_type: "COLOR_BLOCK",
        image_sort: 1,
        platform_url: "https://img.shein.test/package-color-block.jpg",
      },
    ],
  });
  assert.deepEqual(
    packageColorOverridesAutoSource?.image_info_list.map((image) => image.image_url),
    ["https://img.shein.test/package-color-block.jpg"],
  );

  const localOnly = images.buildSheinImageInfo?.({
    skcCode: "SKC-LOCAL",
    skcImageUrl: "",
    allowLocalImages: true,
    assets: [
      { id: 11, skc_code: "SKC-LOCAL", asset_type: "MAIN", image_sort: 1, local_path: "/tmp/local-main.jpg" },
    ],
  });
  assert.deepEqual(localOnly?.image_info_list, []);

  const duplicateMains = images.buildSheinImageInfo?.({
    skcCode: "SKC-2",
    skcImageUrl: "",
    allowSourceImages: true,
    assets: [
      { id: 9, skc_code: "SKC-2", asset_type: "MAIN", image_sort: 1, source_url: "https://example.test/main-b.jpg" },
      { id: 8, skc_code: "SKC-2", asset_type: "MAIN", image_sort: 1, source_url: "https://example.test/main-a.jpg" },
    ],
  });
  assert.deepEqual(duplicateMains?.image_info_list.map((image) => image.image_type), [1, 2]);
  assert.equal(images.sheinMainImageError?.("SKC-2", duplicateMains), null);
  assert.equal(
    images.sheinMainImageError?.("SKC-3", { image_info_list: [{ image_sort: 1, image_type: 5, image_url: "square" }] }),
    "SKC-3 有且只能有 1 张主图(type=1)，当前为 0 张",
  );
});

test("payload service extracts SHEIN business validation messages", () => {
  assert.equal(payload.responseCode({ code: "0" }), "0");
  assert.equal(payload.responseMessage({ message: "ok" }), "ok");
  assert.deepEqual(payload.publishInfo({ info: { version: "v1" } }), { version: "v1" });

  const errors = payload.publishBusinessValidationErrors({
    info: {
      pre_valid_result: [
        { form_name: "商品信息", messages: ["标题缺失", "类目错误"] },
      ],
      mcc_valid_result: JSON.stringify([
        { form: "价格", messages: ["价格未确认"] },
      ]),
    },
  });
  assert.deepEqual(errors, ["商品信息：标题缺失", "商品信息：类目错误", "价格：价格未确认"]);
});

test("payload service falls back to 99-code supplier SKUs when 69-code barcodes repeat in one publish", () => {
  const rows = [
    {
      sku_code: "SKU-73-A",
      supplier_sku: "6904383443062",
      supplier_barcode: "6904383443062",
      source_inner_code: "9950013154034",
    },
    {
      sku_code: "SKU-80-A",
      supplier_sku: "6904383443062",
      supplier_barcode: "6904383443062",
      source_inner_code: "9950013154041",
    },
  ];

  assert.equal(payload.publishSupplierSku(rows[0]), "6904383443062");
  assert.deepEqual(Object.fromEntries(payload.buildPublishSupplierSkuMap(rows)), {
    "SKU-73-A": "9950013154034",
    "SKU-80-A": "9950013154041",
  });
});

test("payload service supplies default SHEIN package weight when SKU gross weight is missing", () => {
  assert.equal(payload.publishPackageWeight(null), null);
  assert.equal(payload.publishPackageWeight("", 500), 500);
  assert.equal(payload.publishPackageWeight(320), 320);
});

test("SKU weight lookup matches imported barcode rows before refreshing an existing draft", () => {
  const rows = new Map([
    ["sku:6900137936439", { sku_code: "6900137936439", package_weight_g: 187 }],
    ["sku:20832610200100366120", { sku_code: "20832610200100366120", package_weight_g: 255 }],
  ]);

  assert.equal(
    payload.resolveSkuWeightRecord(rows, {
      sku_code: "20832610200100366110",
      ean_code: "6900137936439",
    }).package_weight_g,
    187,
  );
  assert.equal(
    payload.resolveSkuWeightRecord(rows, {
      sku_code: "20832610200100366120",
      ean_code: "6900137939999",
    }).package_weight_g,
    255,
  );
  assert.equal(
    payload.resolveSkuWeightRecord(rows, {
      sku_code: "unmatched",
      supplier_barcode: "6900-1379 36439",
    }).package_weight_g,
    187,
  );
  assert.equal(payload.resolveSkuWeightRecord(rows, { sku_code: "missing" }), null);
  assert.deepEqual(
    payload.resolveMissingSkuWeightUpdates(rows, [
      { id: 1, sku_code: "unmatched", supplier_barcode: "6900-1379 36439", package_weight_g: null },
      { id: 2, sku_code: "20832610200100366120", package_weight_g: 333 },
      { id: 3, sku_code: "missing", package_weight_g: null },
    ]),
    [{ id: 1, package_weight_g: 187 }],
  );
});

test("pre-publish image upload validates dimensions locally and synchronizes group confirmations", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /readImageDimensions\(bytes\)/);
  assert.match(source, /imageCompliance\([\s\S]*width[\s\S]*height[\s\S]*file_size/);
  assert.match(source, /图片不符合[\s\S]*requirement\.name/);
  assert.match(source, /assertListingImageCapacity/);
  assert.match(source, /setListingSkcImageConfirmation/);
  assert.match(source, /expectedAssetIds/);
  assert.match(source, /resetListingSkcImageConfirmation/);
  assert.match(source, /function lockListingForMutation[\s\S]*select \* from listing where id = \? for update/);
  assert.match(source, /SPU 图片不能指定 SKC 款色/);
  assert.match(source, /图片类型不属于当前类目规则/);

  const uploadRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/images/upload"'),
    source.indexOf('prePublish.patch("/drafts/:id/images/:assetId"'),
  );
  assert.ok(uploadRoute.indexOf("readValidatedUploadBuffer") < uploadRoute.indexOf("assertListingImageCapacity"));
  assert.ok(uploadRoute.indexOf("lockListingImageMutation") < uploadRoute.indexOf("assertListingImageCapacity"));
});

test("pre-publish image staging owns unique files and respects the DB commit boundary", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "listingify-pre-publish-image-stage-"));
  const oldPath = path.join(root, "old.jpg");
  const bytes = Buffer.from("new-image");
  await fs.promises.writeFile(oldPath, Buffer.from("old-image"));
  try {
    assert.equal(typeof prePublishRoute.uniqueAssetFilePath, "function");
    assert.equal(typeof prePublishRoute.writeExclusiveAssetFile, "function");
    assert.equal(typeof prePublishRoute.cleanupNewAssetFiles, "function");
    assert.equal(typeof prePublishRoute.cleanupReplacedAssetFiles, "function");

    const newPath = prePublishRoute.uniqueAssetFilePath({
      rootDir: root,
      listingId: 7,
      skcCode: "SKC-1",
      fileName: "same-name.jpg",
      extension: ".jpg",
    });
    assert.notEqual(newPath, oldPath);
    prePublishRoute.writeExclusiveAssetFile(newPath, bytes);
    assert.throws(() => prePublishRoute.writeExclusiveAssetFile(newPath, Buffer.from("overwrite")), /EEXIST/);

    prePublishRoute.cleanupReplacedAssetFiles([{ local_path: newPath }], [newPath], root);
    assert.equal((await fs.promises.readFile(newPath)).toString(), bytes.toString());
    await fs.promises.stat(oldPath);

    prePublishRoute.cleanupNewAssetFiles([newPath], root);
    await assert.rejects(fs.promises.stat(newPath), { code: "ENOENT" });
    await fs.promises.stat(oldPath);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("pre-publish image candidate savepoints restore deleted automatic rows on capacity or DB failure", () => {
  assert.equal(typeof prePublishRoute.runImageCandidateSavepoint, "function");
  const automaticRows = [{ id: 7, source_type: "SKC_SOURCE_IMAGE", asset_type: "MAIN" }];
  const db = {
    transaction(fn) {
      return () => {
        const snapshot = automaticRows.map((row) => ({ ...row }));
        try {
          return fn();
        } catch (error) {
          automaticRows.splice(0, automaticRows.length, ...snapshot);
          throw error;
        }
      };
    },
  };

  const capacityError = Object.assign(new Error("主图最多 1 张，请先删除或调整已有图片"), { status: 409 });
  assert.throws(() => prePublishRoute.runImageCandidateSavepoint(db, () => {
    automaticRows.splice(0);
    throw capacityError;
  }), /最多 1 张/);
  assert.deepEqual(automaticRows, [{ id: 7, source_type: "SKC_SOURCE_IMAGE", asset_type: "MAIN" }]);

  assert.throws(() => prePublishRoute.runImageCandidateSavepoint(db, () => {
    automaticRows.splice(0);
    throw new Error("insert failed");
  }), /insert failed/);
  assert.deepEqual(automaticRows, [{ id: 7, source_type: "SKC_SOURCE_IMAGE", asset_type: "MAIN" }]);
});

test("all-failed package replacement is an explicit 4xx and never commits an empty replacement", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /runImageCandidateSavepoint\(input\.db[\s\S]*deleteAutoSourceImagesForUserAsset/);
  assert.match(source, /if \(saved\.length === 0\)[\s\S]*throw new HTTPException\(409/);
  assert.match(source, /cleanupReplacedAssetFiles\([\s\S]*catch \(error\)/);
  assert.match(source, /imagePackageReplacementFailure[\s\S]*importedCount > 0/);
});

test("deleted local assets clean only unreferenced controlled files and surface cleanup warnings", async () => {
  assert.equal(typeof prePublishRoute.cleanupUnreferencedAssetFiles, "function");
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const singleDelete = source.slice(
    source.indexOf('prePublish.delete("/drafts/:id/images/:assetId"'),
    source.indexOf('prePublish.get("/assets/:id/file"'),
  );
  const draftDelete = source.slice(
    source.indexOf('prePublish.delete("/drafts/:id"'),
    source.indexOf('prePublish.patch("/drafts/:id/category"'),
  );
  assert.match(singleDelete, /lockListingImageMutation[\s\S]*delete from listing_asset[\s\S]*local_path/);
  assert.match(singleDelete, /cleanupUnreferencedAssetFiles[\s\S]*cleanup_warnings/);
  assert.match(draftDelete, /lockListingImageMutation[\s\S]*local_path[\s\S]*delete from listing/);
  assert.match(draftDelete, /cleanupUnreferencedAssetFiles[\s\S]*cleanup_warnings/);
  assert.ok(singleDelete.indexOf("const result = transaction()") < singleDelete.indexOf("cleanupUnreferencedAssetFiles"));
  assert.ok(draftDelete.indexOf("select local_path") < draftDelete.indexOf("delete from listing"));

  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "listingify-delete-assets-"));
  const cleanPath = path.join(root, "clean.jpg");
  const sharedPath = path.join(root, "shared.jpg");
  await fs.promises.writeFile(cleanPath, Buffer.from("clean"));
  await fs.promises.writeFile(sharedPath, Buffer.from("shared"));
  try {
    const db = {
      prepare() {
        return { all: () => [] };
      },
    };
    const cleaned = prePublishRoute.cleanupUnreferencedAssetFiles(db, [cleanPath], root);
    assert.deepEqual(cleaned.warnings, []);
    await assert.rejects(fs.promises.stat(cleanPath), { code: "ENOENT" });

    const sharedDb = {
      prepare() {
        return { all: () => [{ local_path: sharedPath }] };
      },
    };
    const retained = prePublishRoute.cleanupUnreferencedAssetFiles(sharedDb, [sharedPath], root);
    assert.deepEqual(retained.cleaned_paths, []);
    await fs.promises.stat(sharedPath);

    const warning = prePublishRoute.cleanupUnreferencedAssetFiles(
      db,
      [sharedPath],
      root,
      () => { throw new Error("permission denied"); },
    );
    assert.equal(warning.cleaned_paths.length, 0);
    assert.match(warning.warnings[0]?.reason ?? "", /permission denied/);
    await fs.promises.stat(sharedPath);

    const queryWarning = prePublishRoute.cleanupUnreferencedAssetFiles(
      { prepare() { throw new Error("reference query failed"); } },
      [sharedPath],
      root,
    );
    assert.match(queryWarning.warnings[0]?.reason ?? "", /reference query failed/);
    await fs.promises.stat(sharedPath);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("pre-publish image writes fail closed on stale category or SKC snapshots", () => {
  assert.equal(typeof prePublishRoute.assertListingImageSnapshotUnchanged, "function");
  assert.equal(typeof prePublishRoute.assertListingSkcSnapshotUnchanged, "function");
  const listing = { id: 7, spu_code: "SPU-1", platform_category_id: 100, product_type_id: 200 };
  assert.doesNotThrow(() => prePublishRoute.assertListingImageSnapshotUnchanged(listing, { ...listing }));
  assert.throws(
    () => prePublishRoute.assertListingImageSnapshotUnchanged(listing, { ...listing, platform_category_id: 101 }),
    /类目或商品已变化/,
  );
  const skc = { id: 11, skc_code: "SKC-1" };
  assert.doesNotThrow(() => prePublishRoute.assertListingSkcSnapshotUnchanged(skc, { ...skc }));
  assert.throws(
    () => prePublishRoute.assertListingSkcSnapshotUnchanged(skc, { id: 12, skc_code: "SKC-1" }),
    /款色已变化/,
  );
});

test("from-library image writes re-check ownership after the listing lock", () => {
  assert.equal(typeof prePublishRoute.assertProductAssetBelongsToListing, "function");
  const db = {
    prepare() {
      return {
        get() {
          return { id: 42, spu_code: "SPU-A", owner_code: "SPU-A" };
        },
      };
    },
  };
  assert.equal(prePublishRoute.assertProductAssetBelongsToListing(db, 42, "SPU-A").id, 42);
  assert.throws(
    () => prePublishRoute.assertProductAssetBelongsToListing(db, 42, "SPU-B"),
    /不属于当前商品/,
  );
});

test("pre-publish image routes cap raw multipart bodies before formData and re-read locked write state", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /import\s*\{[^}]*bodyLimit[^}]*\}\s*from\s+["']hono\/body-limit["']/s);
  assert.match(source, /maxSize:\s*maxImagePackageBytes\(\)\s*\+\s*IMAGE_MULTIPART_OVERHEAD_BYTES/);
  assert.match(source, /maxSize:\s*maxUploadBytes\("image"\)\s*\+\s*IMAGE_MULTIPART_OVERHEAD_BYTES/);
  assert.match(source, /imagePackageBodyLimit[\s\S]*onError:\s*\(c\)\s*=>\s*c\.json\(\{\s*error:/);
  assert.match(source, /imageUploadBodyLimit[\s\S]*onError:\s*\(c\)\s*=>\s*c\.json\(\{\s*error:/);
  assert.match(source, /function uniqueAssetFilePath[\s\S]*randomUUID\(\)/);
  assert.match(source, /fs\.writeFileSync\(localPath, bytes, \{ flag: "wx" \}\)/);
  assert.match(source, /cleanupReplacedAssetFiles\([\s\S]*cleanupNewAssetFiles/);

  const packageRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/batch-upload-image-package"'),
    source.indexOf('prePublish.post("/drafts/:id/images/import-folder"'),
  );
  const uploadRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/images/upload"'),
    source.indexOf('prePublish.patch("/drafts/:id/images/:assetId"'),
  );
  assert.match(packageRoute, /batch-upload-image-package",\s*imagePackageBodyLimit,\s*async \(c\) => \{[\s\S]*(?:const form =|form =) await c\.req\.formData\(\)/);
  assert.match(uploadRoute, /images\/upload",\s*imageUploadBodyLimit,\s*async \(c\) => \{[\s\S]*const form = await c\.req\.formData\(\)/);
  assert.ok(uploadRoute.indexOf("writeExclusiveAssetFile") < uploadRoute.indexOf("db.transaction"));
  assert.ok(packageRoute.indexOf("preparePackageAssetsForListing") < packageRoute.indexOf("savePreparedPackageAssets"));

  const folderFunction = source.slice(
    source.indexOf("function importListingImagesFromFolder"),
    source.indexOf('prePublish.post("/drafts/batch-import-folders"'),
  );
  assert.ok(folderFunction.indexOf("copyImportedImageToAssetRoot") < folderFunction.indexOf("db.transaction"));
  assert.match(folderFunction, /lockListingImageMutation[\s\S]*currentRequirements/);
  assert.doesNotMatch(folderFunction.slice(folderFunction.indexOf("db.transaction")), /fs\.readFileSync|fs\.writeFileSync|fs\.readdirSync/);

  const libraryRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/images/from-library"'),
    source.indexOf('prePublish.post("/drafts/:id/images/upload"'),
  );
  assert.match(libraryRoute, /lockListingImageMutation\(db, listingId\)[\s\S]*assertProductAssetBelongsToListing\(db, productAssetId, lockedListing\.spu_code\)/);
  assert.match(libraryRoute, /lockListingImageMutation\(db, listingId\)[\s\S]*getImageRequirements\(db, lockedListing\)/);
});

test("weight refresh only fills missing weights without re-running the full draft upsert", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const weightRows = source.slice(
    source.indexOf("function listingSkuWeightRows"),
    source.indexOf("function applyMissingListingSkuWeights"),
  );
  const refreshRoute = source.slice(
    source.indexOf('prePublish.post("/drafts/:id/refresh-weights"'),
    source.indexOf('prePublish.patch("/drafts/:id/image-confirmation"'),
  );
  assert.match(weightRows, /left join product_sku source_sku on source_sku\.id = sku\.product_sku_id/);
  assert.match(weightRows, /source_sku\.ean_code as source_ean_code/);
  assert.match(weightRows, /source_sku\.inner_code as source_supplier_barcode/);
  assert.match(refreshRoute, /applyMissingListingSkuWeights/);
  assert.match(refreshRoute, /persistListingValidation/);
  assert.doesNotMatch(refreshRoute, /refreshListingAfterFill/);
  assert.doesNotMatch(refreshRoute, /price_confirmed/);
});

test("SHEIN API service exposes upload and transform helpers for platform-bound image calls", () => {
  assert.equal(typeof sheinApi.uploadLocalImageToShein, "function");
  assert.equal(typeof sheinApi.transformOnlineImageToShein, "function");
});

test("SHEIN type-5 upload center-crops a 3:4 local image to a disposable square copy", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listingify-square-upload-"));
  const sourcePath = path.join(tmpDir, "portrait.png");
  fs.writeFileSync(sourcePath, rgbPng(900, 1200, (y) => {
    if (y < 150) return [255, 0, 0];
    if (y >= 1050) return [0, 0, 255];
    return [0, 255, 0];
  }));

  try {
    const prepared = await sheinApi.prepareLocalImageForSheinUpload(sourcePath, 5);
    assert.equal(prepared.generated, true);
    assert.notEqual(prepared.uploadPath, sourcePath);
    assert.deepEqual(uploadGuard.readImageDimensions(fs.readFileSync(prepared.uploadPath)), {
      width: 900,
      height: 900,
    });
    const firstPixel = await sharp(prepared.uploadPath).raw().toBuffer();
    assert.ok(firstPixel[1] > 200, "center crop should start in the green middle band");
    assert.ok(firstPixel[0] < 30 && firstPixel[2] < 30);
    prepared.cleanup();
    assert.equal(fs.existsSync(prepared.uploadPath), false);
    assert.equal(fs.existsSync(sourcePath), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("SHEIN type-5 upload reuses an already-square local image", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listingify-square-upload-"));
  const sourcePath = path.join(tmpDir, "square.png");
  fs.writeFileSync(sourcePath, solidPng(1200, 1200));

  try {
    const prepared = await sheinApi.prepareLocalImageForSheinUpload(sourcePath, 5);
    assert.equal(prepared.generated, false);
    assert.equal(prepared.uploadPath, sourcePath);
    prepared.cleanup();
    assert.equal(fs.existsSync(sourcePath), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("SHEIN image package square derivative center-crops a 3:4 buffer", async () => {
  assert.equal(typeof sheinApi.centerCropSquareImageBuffer, "function");
  if (typeof sheinApi.centerCropSquareImageBuffer !== "function") return;
  const source = rgbPng(900, 1200, (y) => {
    if (y < 150) return [255, 0, 0];
    if (y >= 1050) return [0, 0, 255];
    return [0, 255, 0];
  });
  const cropped = await sheinApi.centerCropSquareImageBuffer(source);
  assert.deepEqual(uploadGuard.readImageDimensions(cropped), {
    width: 900,
    height: 900,
  });
  const firstPixel = await sharp(cropped).raw().toBuffer();
  assert.ok(firstPixel[1] > 200, "center crop should start in the green middle band");
  assert.ok(firstPixel[0] < 30 && firstPixel[2] < 30);
});

test("remote SHEIN square images are downloaded and center-cropped before upload", async () => {
  assert.equal(typeof sheinApi.downloadAndCenterCropSquareImage, "function");
  if (typeof sheinApi.downloadAndCenterCropSquareImage !== "function") return;
  const source = rgbPng(900, 1200, (y) => {
    if (y < 150) return [255, 0, 0];
    if (y >= 1050) return [0, 0, 255];
    return [0, 255, 0];
  });
  const cropped = await sheinApi.downloadAndCenterCropSquareImage(
    "https://example.test/source.png",
    async () => new Response(source, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(source.length),
      },
    }),
    async () => [{ address: "8.8.8.8" }],
    new Set(["example.test"]),
  );
  assert.deepEqual(uploadGuard.readImageDimensions(cropped), {
    width: 900,
    height: 900,
  });

  const route = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(
    route,
    /imageType === 5[\s\S]+uploadRemoteSquareImageToShein\(sourceUrl, credentials\)/,
  );
});

test("remote SHEIN square image downloads reject private hosts and private redirects", async () => {
  await assert.rejects(
    sheinApi.downloadAndCenterCropSquareImage?.(
      "http://127.0.0.1/private.png",
      async () => {
        throw new Error("fetch must not run");
      },
    ),
    /不允许访问本机或内网地址/,
  );
  await assert.rejects(
    sheinApi.downloadAndCenterCropSquareImage?.(
      "https://public.example/source.png",
      async () => new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
      async () => [{ address: "8.8.8.8" }],
      new Set(["public.example"]),
    ),
    /不允许访问本机或内网地址/,
  );
  await assert.rejects(
    sheinApi.downloadAndCenterCropSquareImage?.(
      "https://untrusted.example/source.png",
      async () => {
        throw new Error("fetch must not run");
      },
      async () => [{ address: "8.8.8.8" }],
      new Set(["product.resources.deepdraw.biz"]),
    ),
    /域名不在允许列表/,
  );
});

test("pre-publish draft list batches per-row summaries into one database query", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const listRoute = source.slice(
    source.indexOf('prePublish.get("/drafts"'),
    source.indexOf('prePublish.post("/drafts"'),
  );

  assert.match(listRoute, /summarizeListings\(db, rows, \{ onlySelected: true \}\)/);
  assert.doesNotMatch(listRoute, /rows\.map\(\(row\) => summarizeListing/);
  assert.match(source, /function summarizeListings[\s\S]+with target_listing as[\s\S]+jsonb_agg/);
});

test("pre-publish draft list excludes heavyweight listing snapshots", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const listRoute = source.slice(
    source.indexOf('prePublish.get("/drafts"'),
    source.indexOf('prePublish.post("/drafts"'),
  );

  assert.doesNotMatch(listRoute, /listing\.\*/);
  assert.doesNotMatch(listRoute, /source_snapshot_json/);
  assert.match(listRoute, /listing\.id/);
  assert.match(listRoute, /listing\.completeness/);
});

test("publish version service exposes snapshot and version helpers", () => {
  assert.equal(typeof versions.nextPublishVersionNo, "function");
  assert.equal(typeof versions.buildListingSnapshot, "function");
  assert.equal(typeof versions.createPublishVersion, "function");
});

test("pre-publish route delegates extracted pure helpers to service modules", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /services\/pre-publish\/shared/);
  assert.match(source, /services\/pre-publish\/drafts/);
  assert.match(source, /services\/pre-publish\/field-fills/);
  assert.match(source, /services\/pre-publish\/images/);
  assert.match(source, /services\/pre-publish\/payload/);
  assert.match(source, /services\/pre-publish\/shein-api/);
  assert.match(source, /services\/pre-publish\/versions/);
  assert.doesNotMatch(source, /function normalizeText\(/);
  assert.doesNotMatch(source, /function canTransitionDraftStatus\(/);
  assert.doesNotMatch(source, /function nextVersionNo\(/);
  assert.doesNotMatch(source, /function buildListingSnapshot\(/);
  assert.doesNotMatch(source, /function createPublishVersion\(/);
  assert.doesNotMatch(source, /function buildPictureRequirements\(/);
  assert.doesNotMatch(source, /function imageCompliance\(/);
  assert.doesNotMatch(source, /function publishBusinessValidationErrors\(/);
  assert.doesNotMatch(source, /async function uploadLocalImageToShein\(/);
  assert.doesNotMatch(source, /async function transformOnlineImageToShein\(/);
});

test("SHEIN publish payload includes optional size chart attributes from mapped DeepDraw tables", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /attribute_status[^\n]+in\s*\(2,\s*3\)/i);
  assert.doesNotMatch(source, /and\s+attribute_status\s*=\s*3/i);
  assert.match(source, /getMappedSizeCharts\(\{\s*db,\s*listing,\s*sizeTables:/s);
  assert.doesNotMatch(source, /table_index\s+in\s*\(1,\s*2\)/i);
});

test("SHEIN metadata sync and import can stay scoped to active category roots", async () => {
  const syncSource = await readFile(path.join(PROJECT_ROOT, "scripts/shein_metadata_sync.mjs"), "utf8");
  const importSource = await readFile(path.join(PROJECT_ROOT, "scripts/shein_metadata_import.mjs"), "utf8");
  assert.match(syncSource, /const DEFAULT_ROOTS = \["儿童", "婴儿"\]/);
  assert.match(syncSource, /roots: \[\.\.\.DEFAULT_ROOTS\]/);
  assert.match(syncSource, /--all-roots/);
  assert.match(syncSource, /function selectCategories\(/);
  assert.match(syncSource, /const selectedCategories = selectCategories\(all, selectedLeaves\)/);
  assert.match(syncSource, /for \(const category of selectedCategories\)/);
  assert.match(importSource, /--prune-to-source/);
  assert.match(importSource, /function analyzeMetadataTables\(/);
  assert.match(importSource, /delete from channel_required_attribute[\s\S]+and category_id = \?[\s\S]+and product_type_id = \?/);
  assert.doesNotMatch(importSource, /delete from channel_required_attribute\s+where platform = \?\s*`/);
});

test("SHEIN publish payload maps business feedback fields from existing source data", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /publishSupplierSku,/);
  assert.match(source, /source_sku\.inner_code as source_inner_code/);
  assert.match(source, /buildPublishSupplierSkuMap\(skus\)/);
  assert.match(source, /supplier_sku:\s*supplierSku/);
  assert.doesNotMatch(source, /supplier_sku:\s*normalizeText\(sku\.sku_code\)/);
  assert.match(source, /weight:\s*String\(publishPackageWeight\(sku\.package_weight_g,\s*options\?\.allowDefaultSkuWeight\s*\?\s*500\s*:\s*undefined\)\s*\?\?\s*""\)/);
  assert.match(source, /const message = `\$\{sku\.sku_code\} 缺 SKU 毛重`/);
  assert.match(source, /errors\.push\(message\)/);
  assert.match(source, /warnings\.push\([^)]*本次临时按 500g 发布/);
  assert.match(source, /function resolveSheinBrandCode\(/);
  assert.match(source, /from shein_brand_rule/);
  assert.match(source, /resolveSheinBrandCode\(db,\s*listing\)/);
  assert.match(source, /brand_code:\s*brandCode/);
  assert.doesNotMatch(source, /brand_code:\s*normalizeText\(listing\.brand_code\)/);
  assert.match(source, /package_type:\s*resolvePackageRule\(db,\s*listing\)\.type/);
  assert.match(source, /language:\s*"en"[\s\S]+name:\s*titleEn/);
  assert.match(source, /language:\s*defaultLanguage[\s\S]+name:\s*titleEn/);
  assert.doesNotMatch(source, /language:\s*defaultLanguage[\s\S]+name:\s*titleCn/);
  assert.match(source, /function englishBrandName\(/);
  assert.match(source, /function englishColorName\(/);
  assert.match(source, /englishBrandName\(row\.brand_name\)/);
  assert.match(source, /englishColorName\(skc\.color_name\)/);
  assert.doesNotMatch(source, /language:\s*defaultLanguage,[\s\S]+defaultLanguage\.toLowerCase\(\) === "zh-cn"[\s\S]+titleCn/);
});

test("pre-publish AI and batch fixes keep critical fields rule-owned", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const dialog = await readFile(path.join(PROJECT_ROOT, "web/src/components/pre-publish/batch-publish-dialog.tsx"), "utf8");
  const draftList = await readFile(path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/page.tsx"), "utf8");

  assert.match(source, /normalizeMaterialValue/);
  assert.match(source, /normalizeFillFieldValue/);
  assert.match(source, /categoryDecisionForReadiness/);
  assert.match(source, /AI_CATEGORY_LIVE/);
  assert.doesNotMatch(source, /if \(mode === "all" \|\| mode === "category"\) \{\s*persistCategoryFill\(db, readiness\)\s*if \(readiness\.category\.category_id/s);
  assert.match(source, /quick_fixes:\s*\{\s*fields/);
  assert.match(source, /sku_commercials/);
  assert.match(source, /batch-import-folders/);
  assert.match(source, /batch-upload-image-package/);
  assert.match(source, /spu_skc_directory_and_image_index/);
  assert.match(source, /assignment\.derivative === "square-center-crop"[\s\S]+centerCropSquareImageBuffer/);

  assert.match(dialog, /commonPackageEdits/);
  assert.match(dialog, /批量标题/);
  assert.match(dialog, /批量包装/);
  assert.match(dialog, /批量类目/);
  assert.match(dialog, /sku_commercial_values/);

  assert.match(draftList, /批量导入图片目录/);
  assert.match(draftList, /batch-import-folders/);
  assert.match(draftList, /批量上传图包/);
  assert.match(draftList, /batch-upload-image-package/);
});

test("pre-publish route resolves SHEIN size sale attribute by metadata and conversion rule before direct category enum", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const detailPage = await readFile(path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/[listingId]/page.tsx"), "utf8");

  assert.match(source, /function isSizeSaleAttribute/);
  assert.match(source, /is_size_attribute/);
  assert.match(source, /function findSizeSaleAttribute/);
  assert.match(source, /function findEnumOptionByValue/);
  assert.match(source, /function resolveSkuSizeSelection/);
  assert.match(source, /findEnumOptionByValue\(sizeAttr\.values,\s*convertedCandidates\)/);
  assert.match(source, /convertedOption\s*\?\?\s*directOption/);
  assert.match(source, /manual_override:\s*true/);
  assert.match(source, /Boolean\(existingSizePayload\.manual_override\)/);
  assert.match(source, /findSizeSaleAttribute\(attrs\)/);
  assert.doesNotMatch(source, /attr\.attribute_name === "尺寸"/);
  assert.match(detailPage, /function isSizeSaleAttribute/);
  assert.match(detailPage, /is_size_attribute/);
  assert.match(detailPage, /data\?\.sale_attributes\.find\(isSizeSaleAttribute\)/);
  assert.doesNotMatch(detailPage, /attribute\.attribute_name\.includes\("尺寸"\)/);
});

test("pre-publish category enrichment covers kids pants fallback categories", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const fallbackSource = await readFile(path.join(PROJECT_ROOT, "web/server/services/pre-publish/category-fallback.ts"), "utf8");

  assert.match(source, /resolveSheinKidsCategoryFallback/);
  assert.match(fallbackSource, /function kidsPantsFallbackCategory/);
  assert.match(fallbackSource, /女童（大）长裤/);
  assert.match(fallbackSource, /product_type_id:\s*9601/);
  assert.match(fallbackSource, /Straight Pants|straight pants/i);
  assert.match(fallbackSource, /女童（小）长裤/);
  assert.match(fallbackSource, /男童（大）裤子/);
  assert.match(fallbackSource, /男童（小）裤子/);
  assert.match(fallbackSource, /男女童|男童女童/);
});

test("pre-publish sale attributes require enum ids when SHEIN metadata provides values", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function existingSalePayloadIsValid/);
  assert.match(source, /if \(attr\.values\.length > 0\) return false/);
  assert.match(source, /return Boolean\(normalizeText\(payload\.custom_attribute_value\)\)/);
});

test("draft AI category enrichment calls AI live and applies valid selections to the draft", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /callAiCategoryMatcher/);
  assert.match(source, /function shouldAskLiveAiCategory/);
  assert.match(source, /async function resolveLiveAiDraftCategory/);
  assert.match(source, /async function safeResolveLiveAiDraftCategory/);
  assert.match(source, /safeResolveLiveAiDraftCategory\(db,\s*categoryReadiness\)/);
  assert.match(source, /const liveDecision = categoryDecisionForReadiness/);
  assert.match(source, /function applyDraftCategoryDecision/);
  assert.match(source, /categoryApplicationFromDecision\(decision\)/);
  assert.match(source, /review_required: application\.reviewRequired/);
  assert.match(source, /applyDraftCategorySelection/);
  assert.match(source, /AI_CATEGORY_LIVE_REVIEW/);
  assert.match(source, /fieldLabel:\s*"SHEIN 类目"/);
  assert.doesNotMatch(source, /fieldLabel:\s*"SHEIN 类目候选"/);
});

test("draft creation auto-selects category only when deterministic or high-confidence AI safe", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const fallbackSource = await readFile(path.join(PROJECT_ROOT, "web/server/services/pre-publish/category-fallback.ts"), "utf8");
  const policySource = await readFile(path.join(PROJECT_ROOT, "web/server/services/pre-publish/category-selection.ts"), "utf8");

  assert.match(policySource, /DEFAULT_AUTO_APPLY_AI_CATEGORY_MIN_CONFIDENCE = 0\.92/);
  assert.match(source, /async function readinessForDraftCreation/);
  assert.match(source, /const initialDecision = categoryDecisionForReadiness\(db,\s*readiness\.category/);
  assert.match(source, /await safeResolveLiveAiDraftCategory\(db,\s*readiness,\s*options\.skcCodes\)/);
  assert.match(source, /buildReadinessWithCategoryOverride\(db,\s*sourceRow,\s*categoryOverride\)/);
  assert.match(source, /draftInputs:\s*Array/);
  assert.match(source, /categoryAiConcurrency = 2/);
  assert.match(source, /await Promise\.all/);
  assert.match(source, /preparedCategoryDecision\?: CategoryAutoSelectionDecision/);
  assert.match(source, /const selectedCategory = categoryDecision\.apply \? categoryDecision\.category : null/);
  assert.match(source, /const suggestionStatus = normalizeText\(suggestion\?\.status\)\.toUpperCase\(\)/);
  assert.match(source, /splitBySkc:\s*suggestion\.split_by_skc === true/);
  assert.match(policySource, /aiStatus !== "READY"/);
  assert.match(policySource, /input\.liveAi\?\.splitBySkc === true/);
  assert.match(policySource, /confidence < minConfidence/);
  assert.match(policySource, /risks\.length > 0/);
  assert.match(source, /and product_type_id = \?[\s\S]+and coalesce\(last_category,\s*0\) = 1/);
  assert.doesNotMatch(fallbackSource, /inferKidsGender\(row,\s*text\) \?\? "female"/);
  assert.match(fallbackSource, /const gender = inferKidsGender\(row,\s*text\)[\s\S]+if \(!gender\) return null[\s\S]+衬衫/);
  assert.match(fallbackSource, /const gender = inferKidsGender\(row,\s*text\)[\s\S]+if \(!gender\) return null[\s\S]+开襟衫/);
  assert.match(fallbackSource, /function inferKidsAgeBucket/);
});

test("draft color quick fixes resolve the current category color sale attribute and validate enum ids", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const updateBlock = source.slice(
    source.indexOf("function updateListingSkcColors"),
    source.indexOf("function persistDraftFields"),
  );

  assert.match(updateBlock, /getRequiredAttributes\(db,\s*categoryId,\s*productTypeId\)/);
  assert.match(updateBlock, /findColorSaleAttribute/);
  assert.match(updateBlock, /hasExplicitColorSelection/);
  assert.match(updateBlock, /if \(hasExplicitColorSelection && colorAttr\.values\.length > 0 && !colorOption\)/);
  assert.match(updateBlock, /findEnumOption\(colorAttr\.values,\s*\[String\(item\.attributeValueId\),\s*item\.attributeValue\]\)/);
  assert.match(updateBlock, /saleAttributePayload\(colorAttr,\s*colorOption,\s*item\.customValue\s*\|\|\s*item\.attributeValue\s*\|\|\s*normalizeText\(current\?\.color_name\)\)/);
  assert.match(updateBlock, /existingSalePayloadIsValid/);
  assert.doesNotMatch(updateBlock, /attribute_id:\s*27/);
});

test("batch publish dialog saves quick fixes through one batched endpoint and includes size fixes", async () => {
  const route = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const dialog = await readFile(path.join(PROJECT_ROOT, "web/src/components/pre-publish/batch-publish-dialog.tsx"), "utf8");

  assert.match(route, /\/drafts\/batch-quick-fix/);
  assert.match(route, /buildBatchPublishCheckResponse/);
  assert.match(route, /sku_sizes/);
  assert.match(route, /changedListingIds/);
  assert.match(route, /for \(const listingId of changedListingIds\)/);
  assert.match(dialog, /\/pre-publish\/drafts\/batch-quick-fix/);
  assert.match(dialog, /skuSizeEdits/);
  assert.match(dialog, /SHEIN 发布尺码/);
  assert.match(dialog, /mapWithConcurrency/);
  assert.doesNotMatch(dialog, /for \(const item of items\) \{\s*const fields = item\.fields/);
});

test("deployment preserves runtime image uploads and operator backups outside release sync", async () => {
  const buildScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-build.sh"), "utf8");
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");

  assert.match(buildScript, /--exclude='\.\/data\/listing-assets'/);
  assert.match(deployScript, /--exclude='data\/listing-assets'/);
  assert.match(deployScript, /--exclude='data\/product-archive-draft-images'/);
  assert.match(deployScript, /--exclude='\/tmp'/);
  assert.match(deployScript, /mkdir -p "\$APP_DIR\/data\/listing-assets"/);
  assert.match(deployScript, /"\$APP_DIR\/data\/product-archive-draft-images"/);
  assert.match(deployScript, /"\$APP_DIR\/tmp"/);
});

test("deployment writes AI routing and Semir gateway environment variables", async () => {
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");

  assert.match(deployScript, /write_optional_env\(\)/);
  for (const name of [
    "AI_ROUTING_ENABLED",
    "AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_BASE_URL",
    "AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_GEMINI_MODEL",
    "AI_PROVIDER_SEMIR_OVERSEAS_OPENAI_API_KEY",
    "AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_BASE_URL",
    "AI_PROVIDER_SEMIR_OVERSEAS_ANTHROPIC_API_KEY",
    "AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_BASE_URL",
    "AI_PROVIDER_SEMIR_DOMESTIC_OPENAI_API_KEY",
    "AI_GEMINI_INLINE_REMOTE_IMAGES",
    "AI_SCENARIO_TITLE_TRANSLATION_MODE",
    "AI_SCENARIO_SHEIN_ATTRIBUTE_MODE",
    "AI_SCENARIO_SHEIN_DESCRIPTION_MODE",
    "AI_SCENARIO_DEEPDRAW_FIELD_FILL_MODE",
    "AI_1XM_DAILY_REQUEST_BUDGET",
  ]) {
    assert.match(deployScript, new RegExp(`\\b${name}\\b`));
  }
});

test("deployment writes product archive background and OCR concurrency environment variables", async () => {
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");
  const envOutputBlock = deployScript.slice(
    deployScript.indexOf("===== Write production env ====="),
    deployScript.indexOf("} > .env.local"),
  );

  for (const name of [
    "LISTINGIFY_BACKGROUND_MAX_ACTIVE",
    "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_CONCURRENCY",
    "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY",
    "LISTINGIFY_HANGTAG_OCR_FILE_CONCURRENCY",
    "LISTINGIFY_HANGTAG_OCR_CACHE_TTL_MS",
  ]) {
    assert.match(envOutputBlock, new RegExp(`\\b${name}\\b`));
  }
});

test("deployment prepares a complete release before publishing to the live app directory", async () => {
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");
  const publishBlock = deployScript.slice(deployScript.indexOf("===== Publish prepared release ====="));

  assert.doesNotMatch(deployScript, /rsync -a --delete "\$SRC_DIR"\/ "\$APP_DIR"\//);
  assert.match(deployScript, /PREPARED_DIR/);
  assert.match(deployScript, /===== Prepare release workspace =====/);
  assert.match(deployScript, /rsync -a --delete "\$SRC_DIR"\/ "\$PREPARED_DIR"\//);
  assert.match(deployScript, /npm --prefix web ci --include=dev --prefer-offline/);
  assert.match(deployScript, /test -x "\$PREPARED_DIR\/web\/node_modules\/\.bin\/tsx"/);
  assert.match(deployScript, /test -f "\$PREPARED_DIR\/web\/dist\/index\.html"/);
  assert.match(deployScript, /test -f "\$PREPARED_DIR\/nginx\.conf"/);
  assert.match(deployScript, /===== Publish prepared release =====/);
  assert.match(deployScript, /rsync -a --delete "\$PREPARED_DIR"\/ "\$APP_DIR"\//);
  assert.match(deployScript, /LISTINGIFY_NPM_CACHE_DIR/);
  assert.match(deployScript, /npm_config_fetch_retries/);
  assert.match(deployScript, /-v "\$NPM_CACHE_DIR:\/root\/\.npm"/);
  assert.doesNotMatch(publishBlock, /--exclude='web\/node_modules'/);
  assert.match(publishBlock, /--exclude='\/node_modules'/);
});

test("deployment prepares the DeepDraw Java SDK runtime for production publishing", async () => {
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");

  assert.match(deployScript, /DEEPDRAW_M2_DIR/);
  assert.match(deployScript, /DEEPDRAW_M2_REPOSITORY/);
  assert.match(deployScript, /DEEPDRAW_MAVEN_MIRROR_URL/);
  assert.match(deployScript, /scripts\/deepdraw_sdk_prepare\.mjs/);
  assert.match(deployScript, /LISTINGIFY_MAVEN_IMAGE/);
  assert.match(deployScript, /FROM \$\{MAVEN_IMAGE\} AS java_toolchain/);
  assert.match(deployScript, /COPY --from=java_toolchain \/opt\/java\/openjdk \/opt\/java\/openjdk/);
  assert.match(deployScript, /COPY --from=java_toolchain \/usr\/share\/maven \/usr\/share\/maven/);
  assert.match(deployScript, /LISTINGIFY_FORCE_RUNTIME_IMAGE_REBUILD/);
  assert.match(deployScript, /docker image inspect "\$RUNTIME_IMAGE"/);
  assert.match(deployScript, /Reusing existing Docker runtime image/);
  assert.doesNotMatch(deployScript, /apt-get install[\s\S]*openjdk-17-jdk-headless/);
  assert.doesNotMatch(deployScript, /apt-get install[\s\S]*\bmaven\b/);
  assert.match(deployScript, /-v "\$DEEPDRAW_M2_DIR:\/app\/\.m2"/);
  assert.match(deployScript, /java -version/);
  assert.match(deployScript, /javac -version/);
  assert.match(deployScript, /bash -c 'set -e; node -v; npm -v; java -version/);
  assert.match(deployScript, /bash -c 'java -version >\/dev\/null && \.\/web\/node_modules\/\.bin\/tsx/);
  assert.doesNotMatch(deployScript, /bash -lc 'set -e; node -v; npm -v; java -version/);
  assert.doesNotMatch(deployScript, /bash -lc 'java -version/);
});

test("DeepDraw SDK prepare can use a configured Maven mirror for dependency downloads", async () => {
  const prepareScript = await readFile(path.join(PROJECT_ROOT, "scripts/deepdraw_sdk_prepare.mjs"), "utf8");

  assert.match(prepareScript, /DEEPDRAW_MAVEN_MIRROR_URL/);
  assert.match(prepareScript, /DEEPDRAW_MAVEN_SETTINGS/);
  assert.match(prepareScript, /<mirrorOf>\*<\/mirrorOf>/);
  assert.match(prepareScript, /--settings/);
});

test("DeepDraw SDK prepare checks runtime commands without resetting Docker PATH", async () => {
  const prepareScript = await readFile(path.join(PROJECT_ROOT, "scripts/deepdraw_sdk_prepare.mjs"), "utf8");

  assert.match(prepareScript, /function hasCommand\(command\)/);
  assert.doesNotMatch(prepareScript, /spawnSync\("bash", \["-lc"/);
  assert.match(prepareScript, /spawnSync\("bash", \["-c", `command -v \$\{command\}`\]/);
});

test("publish precheck treats local uploaded images as pending SHEIN image assets", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /allowLocalImages\?:\s*boolean/);
  assert.match(source, /allowSkcImageUrl\?:\s*boolean/);
  assert.match(source, /allowLocalImages\s*&&\s*normalizeText\(asset\.local_path\)/);
  assert.match(source, /skcImageUrl:\s*options\.allowSkcImageUrl === false \? "" : skc\.image_url/);
  assert.match(source, /skcHasPendingPublishImage/);
  assert.match(source, /图片将在提交前转换为 SHEIN 可用 URL/);
  assert.match(source, /buildPublishPayload\(db,\s*listingId,\s*\{\s*allowLocalImages:\s*true,\s*requirePreparedImages:\s*false\s*\}\)/);
  assert.match(source, /allowSourceImages:\s*true,\s*allowLocalImages:\s*true,\s*requirePreparedImages:\s*false/);
  assert.match(source, /allowSkcImageUrl:\s*!requirePreparedImages/);
  assert.doesNotMatch(source, /ensureFallbackColorAssets\(db,\s*listingId\)/);
  assert.doesNotMatch(source, /发布前自动补齐 SKC 色块图/);
  assert.match(source, /isAutoFallbackColorAsset/);
  assert.match(source, /realImageAssets\(getListingAssets\(db,\s*listingId,\s*\{ onlySelected: true \}\)\)/);
  assert.match(source, /if \(isAutoFallbackColorAsset\(asset\)\) continue/);
  assert.match(source, /缺 \$\{requirement\.name\}/);
});

test("publish preparation auto-converts SKC source images before final SHEIN submit", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function ensureSkcSourceImageAssetsForPublish/);
  assert.match(source, /values \(\?, \?, \?, 'SKC_SOURCE_IMAGE', \?, 1,/);
  assert.match(source, /assetType: "MAIN", sheinImageType: 1/);
  assert.match(source, /assetType: "COLOR_BLOCK", sheinImageType: 6/);
  assert.match(source, /shein_image_type: target\.sheinImageType/);
  assert.doesNotMatch(source, /target\.sheinImageType === 6 && assetPreparedForImageType\(existing,\s*6\)/);
  assert.match(source, /function targetImageTypeForAsset/);
  assert.match(source, /function preparedAssetImageType/);
  assert.match(source, /assetPreparedForImageType/);
  assert.match(source, /shein_image_type: imageType/);
  assert.match(source, /source:\s*"listing_skc\.image_url"/);
  assert.match(source, /ensureSkcSourceImageAssetsForPublish\(db,\s*listingId\)/);
  assert.match(source, /ensureSkcSourceImageAssetsForPublish\(db,\s*listingId\)[\s\S]+const preview = buildPublishPayload/);
  assert.match(source, /transformOnlineImageToShein\(sourceUrl,\s*imageType,\s*credentials\)/);
  assert.match(source, /function assertPublishPayloadHasOnlyPreparedImages/);
  assert.match(source, /product\.resources\.deepdraw\.biz/);
  assert.match(source, /assertPublishPayloadHasOnlyPreparedImages\(prepared\.payload\)/);
  assert.match(source, /const pendingImagePreparePayload = \{/);
  assert.match(source, /image_prepare_status:\s*"PENDING"/);
  assert.match(source, /requestPayload:\s*pendingImagePreparePayload/);
  assert.doesNotMatch(source, /requestPayload:\s*preview\.payload/);
});

test("pre-publish basic fields expose DeepDraw product description", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /const productDescription = firstField\(fields,\s*\["商品描述", "商品卖点", "产品描述", "卖点", "推荐理由"\]\)/);
  assert.match(source, /key:\s*"product_description"[\s\S]+label:\s*"商品描述"[\s\S]+compactText\(productDescription,\s*160\)/);
  assert.match(source, /深绘字段池未返回商品描述\/卖点来源/);
  assert.match(source, /function shouldGenerateProductDescription/);
  assert.match(source, /scenario:\s*"shein_description"/);
  assert.match(source, /promptVersion:\s*"shein-description-v1"/);
  assert.match(source, /source:\s*"AI_DESCRIPTION"/);
  assert.match(source, /不要编造成分、材质、百分比、毛重、图片上传状态/);
  assert.match(source, /面料\|毛重\|重量\|净重\|克重\|图片\|主图/);
  assert.match(source, /const fallback = sanitizeProductDescription\(heuristicProductDescription\(row\)\)/);
  assert.match(source, /catch\(\(\) => sanitizeProductDescription\(heuristicProductDescription\(row\)\)\)/);
});

test("SHEIN SKC title defaults to the product title and AI fill reports warnings", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const detailPage = await readFile(path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/[listingId]/page.tsx"), "utf8");

  assert.match(source, /normalizeText\(readiness\.title_cn\) \|\| normalizeText\(skc\.skc_name\) \|\| skcCode/);
  assert.match(source, /skc_title:\s*normalizeText\(listing\.title\) \|\| normalizeText\(skc\.skc_title\) \|\| normalizeText\(listing\.spu_code\)/);
  assert.match(source, /function aiErrorText/);
  assert.match(source, /visit\(record\.cause,\s*depth \+ 1\)/);
  assert.match(source, /Array\.isArray\(record\.errors\)/);
  assert.match(source, /function aiFillWarningMessage/);
  assert.match(source, /const warnings: Array<\{ spu_code: string; message: string \}> = \[\]/);
  assert.match(source, /AI 填写字段失败：\$\{aiFillWarningMessage\(error\)\}/);
  assert.match(source, /warning_count: warnings\.length/);
  assert.match(source, /warningMessage:\s*aiFillWarningMessage\(error\)/);
  assert.match(source, /AI 生成字段失败：\$\{generatedResult\.warningMessage \|\| "AI 服务暂不可用"\}/);
  assert.match(source, /etimedout\|econnreset\|und_err_socket/);
  assert.match(source, /AI 服务暂不可用，请检查网关\/模型配置后重试/);
  assert.match(source, /function getListingDetailForAiWarning/);
  assert.match(source, /detail:\s*getListingDetailForAiWarning\(db,\s*listingId\)/);
  assert.match(source, /field: null/);
  assert.match(detailPage, /warning_count\?: number/);
  assert.match(detailPage, /toast\.warning\(result\.warnings\?\.\[0\]\?\.message/);
});

test("legacy fallback color cards do not masquerade as valid color-block assets", async () => {
  const detailPage = await readFile(path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/[listingId]/page.tsx"), "utf8");

  assert.match(detailPage, /asset\.source_type === "SOURCE_FALLBACK" && \["COLOR_BLOCK", "COLOR"\]\.includes\(asset\.asset_type\)/);
});

test("draft category AI recomputes from source data instead of replaying the draft category", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const bucketSource = await readFile(path.join(PROJECT_ROOT, "web/server/routes/shein-products.ts"), "utf8");

  assert.match(source, /ignoreListingCategory\?:\s*boolean/);
  assert.match(source, /ignoreStoredCategory\?:\s*boolean/);
  assert.match(source, /const storedCategory = ignoreStoredCategory\s*\?\s*null\s*:\s*readStoredCategoryOverride\(fills,\s*spuCode\)/);
  assert.match(source, /getReadinessForListing\(db,\s*listing,\s*\{\s*ignoreListingCategory:\s*true,\s*ignoreStoredCategory:\s*true,\s*\}\)/);
  assert.match(source, /const ruleDecision = categoryDecisionForReadiness\(db,\s*categoryReadiness\.category/);
  assert.match(source, /function selectedReadinessForListing/);
  assert.match(source, /displayReadinessForSelectedSkcs\(readiness,\s*selectedSkcs,\s*readiness\.skcs\)/);
  assert.match(source, /function isLikelyEnglishTitle/);
  assert.match(source, /function readinessWithListingTitle/);
  assert.match(source, /isLikelyEnglishTitle\(listingTitle\) && !hasStoredReadinessField\(adjustedReadiness,\s*"title_en"\)[\s\S]+readinessWithListingTitle\(adjustedReadiness,\s*listingTitle\)/);
  assert.match(source, /function readinessWithListingDescription/);
  assert.match(source, /function readinessWithoutSharedAiDescription/);
  assert.match(source, /sanitizeProductDescription\(listing\.description\)/);
  assert.match(source, /normalizeText\(listing\.split_group_key\)[\s\S]+readinessWithoutSharedAiDescription\(adjustedReadiness\)/);
  assert.match(source, /description = \?/);
  assert.match(source, /readinessFieldValue\(readiness,\s*"product_description"\)/);
  assert.match(source, /set description = \?,[\s\S]+where id = \?/);
  assert.match(source, /function categoryGenderValueForAttribute/);
  assert.match(source, /const categoryGenderValue = categoryGenderValueForAttribute\(attr,\s*category\)/);
  assert.match(source, /source:\s*"SHEIN 类目"[\s\S]+按当前 SHEIN 叶子类目确定性别。/);
  assert.match(source, /normalizeText\(field\.source\) === "SHEIN 类目" && normalizeText\(field\.label\)\.includes\("性别"\)[\s\S]+continue/);
  assert.match(source, /let enrichmentReadiness = selectedReadinessForListing\(db,\s*listingId,\s*readiness\)/);
  assert.match(source, /const updatedReadiness = updatedListing \? getReadinessForListing\(db,\s*updatedListing\) : null/);
  assert.match(source, /if \(updatedReadiness\) enrichmentReadiness = selectedReadinessForListing\(db,\s*listingId,\s*updatedReadiness\)/);
  assert.match(source, /function safeAiTranslateTitle/);
  assert.match(source, /const titleEn = await safeAiTranslateTitle\(enrichmentReadiness\)/);
  assert.match(source, /const titleAlreadyReady = Boolean/);
  assert.match(source, /mode === "title" \|\| \(mode === "all" && !titleAlreadyReady\)/);
  assert.match(source, /const descriptionAlreadyReady = Boolean/);
  assert.match(source, /mode === "description" \|\| \(mode === "all" && !descriptionAlreadyReady\)/);
  assert.match(source, /let aiFills: Array<Record<string, unknown>> = \[\]/);
  assert.match(source, /aiFills = await callAiFill\(enrichmentReadiness\) as Array<Record<string, unknown>>/);
  assert.match(source, /resolveSheinKidsCategoryFallback/);
  assert.match(bucketSource, /resolveSheinKidsCategoryFallback/);
  assert.match(source, /AI_CATEGORY_LIVE_REVIEW/);
  assert.match(source, /category\.status === "WARNING" \|\| \(category\.category_id && category\.product_type_id\)[\s\S]+?\? "WARNING"/);
  assert.match(source, /跑步鞋/);
});

test("manual optimized titles survive draft refresh, AI enrich all, publish payload, and snapshots", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const versionSource = await readFile(path.join(PROJECT_ROOT, "web/server/services/pre-publish/versions.ts"), "utf8");

  assert.match(source, /const storedTitleCn = getStoredFill\(fills,\s*spuCode,\s*"title_cn"\)/);
  assert.match(source, /const titleCn = normalizeText\(storedTitleCn\?\.field_value\) \|\| normalizeText\(row\.deepdraw_title\)/);
  assert.match(source, /const storedTitleEn = getStoredFill\(fills,\s*spuCode,\s*"title_en"\)/);
  assert.match(source, /const titleEn = normalizeText\(storedTitleEn\?\.field_value\) \|\| normalizeText\(row\.listing_title_en\)/);
  assert.match(source, /source:\s*storedTitleEn \? String\(storedTitleEn\.source \?\? "MANUAL"\) : "AI\/人工"/);
  assert.match(source, /function readinessFieldSource\(readiness:\s*ReadinessRow,\s*fieldKey:\s*string\)/);
  assert.match(source, /function hasStoredReadinessField\(readiness:\s*ReadinessRow,\s*fieldKey:\s*string\)/);
  assert.match(source, /source !== "AI\/人工" && source !== "LISTING_TITLE"/);
  assert.match(source, /isLikelyEnglishTitle\(listingTitle\) && !hasStoredReadinessField\(adjustedReadiness,\s*"title_en"\)/);
  assert.match(source, /persistDraftFields\(\{ db,\s*listing,\s*listingId,\s*fields,\s*savedFrom:\s*"draft_whole_save"\s*\}\)/);
  assert.match(source, /normalizeFillFieldValue\(fieldKey,\s*field\.field_label,\s*field\.field_value\)/);
  assert.match(source, /normalizeFillFieldValue\(fieldKey,\s*body\.field_label,\s*body\.field_value\)/);
  assert.match(source, /const titleAlreadyReady = Boolean\(normalizeText\(readinessFieldValue\(enrichmentReadiness,\s*"title_en"\)\) \|\| normalizeText\(enrichmentReadiness\.title_en\)\)/);
  assert.match(source, /mode === "title" \|\| \(mode === "all" && !titleAlreadyReady\)/);
  assert.match(source, /const titleEn = sanitizeSingleItemTitleEn\(\s*normalizeText\(readinessFieldValue\(readiness,\s*"title_en"\)\) \|\| normalizeText\(readiness\.title_en\) \|\| heuristicEnglishTitle\(readiness\)/);
  assert.match(source, /language:\s*"en"[\s\S]+name:\s*titleEn/);
  assert.match(versionSource, /select scope_key, spu_code, skc_code, sku_code, field_key, field_label, field_value, source, confidence, updated_at[\s\S]+from listing_field_fill[\s\S]+where status = 'ACTIVE'/);
  assert.match(versionSource, /field_fills:\s*fieldFills/);
});

test("SHEIN AI fill avoids unsupported composition guesses and handles conditional lining", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function compositionSourceForReadiness/);
  assert.match(source, /const deepdrawCompositionText = materialEvidenceFromDeepDraw\(fields\)/);
  assert.match(source, /const mdmCompositionText = normalizeText\(row\.composition\)[\s\S]+normalizeText\(row\.wash_label_ingr\)[\s\S]+normalizeText\(row\.fabric\)/);
  assert.match(source, /const compositionTextSource = deepdrawCompositionText \? "DEEPDRAW" : mdmCompositionText \? "MDM" : "MDM\/DEEPDRAW"/);
  assert.match(source, /isCompositionAttributeField\(field\)\s*&&\s*!compositionSourceForReadiness\(row\)\)\s*return ""/);
  assert.match(source, /normalizeText\(attr\.attribute_name\)\.includes\("成分"\) && !compositionText/);
  assert.match(source, /const ignoreStoredAiComposition = Boolean\(/);
  assert.match(source, /stored && !ignoreStoredAiComposition/);
  assert.match(source, /isCompositionAttributeField\(field\)[\s\S]+!compositionText[\s\S]+normalizeText\(stored\.source\)\.toUpperCase\(\)\.startsWith\("AI"\)[\s\S]+continue/);
  assert.match(source, /note:\s*"缺少 MDM\/深绘成分来源，禁止 AI 猜测成分枚举。"/);
  assert.match(source, /function isAiFillableAttributeField/);
  assert.match(source, /if \(!isAiFillableAttributeField\(field\)\) return ""/);
  assert.match(source, /AI_MULTIMODAL_ATTRIBUTE_IDS\.has\(attributeId\)/);
  assert.match(source, /AI_RECOMMENDED_ATTRIBUTE_IDS\.has\(attributeId\)/);
  assert.match(source, /AI_RULE_ATTRIBUTE_IDS\.has\(attributeId\)/);
  assert.match(source, /\["性别",\s*"袖长"\]\.some/);
  assert.match(source, /function shouldIncludeFieldInAiFill/);
  assert.match(source, /if \(!isAiFillableAttributeField\(field\)\) return false/);
  assert.match(source, /field\.status === "NEEDS_AI" \|\| field\.status === "MISSING"/);
  assert.match(source, /manual_fields:\s*attributeFields\.filter\(shouldIncludeFieldInAiFill\)/);
  assert.match(source, /field\.label\.includes\("里衬"\)\)\s*return pick\(\["无内衬"\]\)/);
  assert.match(source, /function inferredAttributeSource/);
  assert.match(source, /if \(normalizeText\(materialEvidenceFromDeepDraw\(fields\)\)\) return "DEEPDRAW"/);
  assert.match(source, /normalizeText\(row\.fabric_type_name\)[\s\S]+return "MDM"/);
});

test("SHEIN attribute AI can fill recommended visual and text fields with Gemini image parts", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const aiChatClient = await readFile(path.join(PROJECT_ROOT, "scripts/lib/ai_chat_client.mjs"), "utf8");

  assert.match(source, /const AI_MULTIMODAL_ATTRIBUTE_IDS = new Set\(\[[\s\S]+54[\s\S]+1000438[\s\S]+1001518[\s\S]+1002281[\s\S]+\]\)/);
  assert.match(source, /const AI_RECOMMENDED_ATTRIBUTE_IDS = new Set\(\[[\s\S]+39[\s\S]+77[\s\S]+128[\s\S]+154[\s\S]+1000437[\s\S]+1000600[\s\S]+1001236[\s\S]+\]\)/);
  assert.match(source, /supplementalAiAttributeIds = uniqueStrings\(\[[\s\S]+AI_RECOMMENDED_ATTRIBUTE_IDS[\s\S]+AI_MULTIMODAL_ATTRIBUTE_IDS[\s\S]+AI_RULE_ATTRIBUTE_IDS/);
  assert.match(source, /attr\.attribute_id in \(58\$\{supplementalPlaceholders/);
  assert.match(source, /attr\.is_required/);
  assert.match(source, /function isBlockingFillField/);
  assert.match(source, /\.filter\(isBlockingFillField\)/);
  assert.match(source, /AI_MULTIMODAL_ATTRIBUTE_IDS\.has\(attributeId\)/);
  assert.match(source, /AI_RECOMMENDED_ATTRIBUTE_IDS\.has\(attributeId\)/);
  assert.match(source, /if \(Number\(field\.attribute_type \?\? 0\) === 1\) return false/);
  assert.match(source, /function sheinAgeNeedlesForReadiness/);
  assert.match(source, /\.includes\("中童"\)[\s\S]+8-12Y中大童/);
  assert.match(source, /175[\s\S]+8-12Y中大童/);
  assert.match(source, /if \(field\.label\.includes\("年龄"\)\) return pick\(sheinAgeNeedlesForReadiness\(row\)\)/);
  assert.match(source, /if \(field\.label\.includes\("合身"\)\)[\s\S]+合体/);
  assert.match(source, /if \(field\.label\.includes\("口袋"\)\)[\s\S]+\[text\.includes\("口袋"\) \? "是" : "否"\]/);
  assert.match(source, /function aiAttributeGuidance/);
  assert.match(source, /1001518[\s\S]+版型/);
  assert.match(source, /1001236[\s\S]+厚薄/);
  assert.match(source, /1000600[\s\S]+睡衣类型/);
  assert.match(source, /known_field_facts:\s*aiKnownFieldFacts\(row\)/);
  assert.match(source, /return optionValues\.length === 1 \? optionValues\[0\] : ""/);
  assert.match(source, /function aiImageUrlForSkc/);
  assert.match(source, /normalizeText\(skc\.image_url\)/);
  assert.match(source, /function buildSheinAttributeAiMessages/);
  assert.match(source, /type:\s*"image_url"[\s\S]+image_url:\s*\{\s*url\s*\}/);
  assert.match(source, /const messages = buildSheinAttributeAiMessages\(row,\s*prompt\)/);
  assert.match(aiChatClient, /AI_GEMINI_INLINE_REMOTE_IMAGES/);
  assert.match(aiChatClient, /data:\$\{mimeType\};base64/);
  assert.match(source, /function deterministicAttributeFillsForAiEnrich/);
  assert.match(source, /manualFieldKeys = new Set\(readiness\.manual_fields\.map\(\(field\) => field\.key\)\)/);
  assert.match(source, /source === "RULE" \|\| source === "MDM"/);
  assert.match(source, /for \(const field of deterministicAttributeFillsForAiEnrich\(enrichmentReadiness\)\)/);
});

test("SHEIN draft validation suggestions separate AI-fillable fields from source-owned blockers", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function blockingIssueSuggestion/);
  assert.match(source, /AI 不生成毛重/);
  assert.match(source, /AI 不补图片/);
  assert.match(source, /AI 不编造成分/);
  assert.match(source, /使用“AI 自动选类目”自动写入合法 SHEIN 叶子类目/);
  assert.match(source, /canAiHelpIssue\(row,\s*issue\)/);
  assert.doesNotMatch(source, /使用 AI 补齐后重新保存/);
});

test("SHEIN title fallback names pants instead of generic clothing", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /function selectedSkcsForTitle/);
  assert.match(source, /selected_for_publish \?\? 1/);
  assert.match(source, /const colorText = selectedSkcsForTitle\(row\)/);
  assert.match(source, /const genderPrefix = category\.includes\("女童"\) \? "Girls"/);
  assert.match(source, /category\.includes\("卫裤"\)[\s\S]+productName = `\$\{genderPrefix\} Sweatpants`/);
  assert.match(source, /title\.includes\("裤"\)[\s\S]+productName = `\$\{genderPrefix\} Pants`/);
  assert.match(source, /colors:\s*selectedSkcsForTitle\(row\)\.map/);
  assert.match(source, /const selectedReadiness = selectedReadinessForListing\(db,\s*listingId,\s*readiness\)/);
  assert.match(source, /generateSingleAiField\(selectedReadiness,\s*fieldKey\)/);
});

test("neutral products use all selected SKC images and expand into gender-specific draft inputs", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const groupStart = source.indexOf("function buildLiveAiCategoryGroup");
  const groupEnd = source.indexOf("\nasync function resolveLiveAiDraftCategory", groupStart);
  const groupSource = source.slice(groupStart, groupEnd);

  assert.match(source, /planNeutralSkcDrafts/);
  assert.match(source, /function expandNeutralSkcDraftInputs/);
  assert.match(source, /skcCodes:\s*group\.skcCodes/);
  assert.match(source, /categoryId:\s*group\.category\.categoryId/);
  assert.match(source, /splitGroupKey:\s*`neutral-gender:/);
  assert.match(source, /splitGender:\s*group\.gender/);
  assert.match(source, /splitEvidenceBasis:\s*group\.evidenceBasis/);
  assert.match(source, /selected_skc_codes:\s*input\.skcCodes/);
  assert.match(source, /split_evidence_basis:\s*input\.splitEvidenceBasis/);
  assert.match(source, /category_ai_skc_suggestions:\s*input\.aiSkcEvidence/);
  assert.match(source, /split_group_key,\s*split_reason,/);
  assert.match(source, /input\.splitPlanStatus === "NOT_APPLICABLE"\s*\?\s*undefined/);
  assert.match(source, /body\.skc_codes_by_spu\?\.\[input\.spuCode\][\s\S]*readinessForDraftCreation/);
  assert.match(groupSource, /skcCodes\?:\s*string\[\]/);
  assert.match(groupSource, /selectedSkcCodes\.has\(normalizeText\(skc\.skc_code\)\)/);
  assert.doesNotMatch(groupSource, /\.slice\(0,\s*8\)/);
});

test("neutral SKC uncertainty falls back to one unclassified review draft", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /neutralReviewDecision/);
  assert.match(source, /plan\.status !== "READY"/);
  assert.match(source, /categoryDecision:\s*neutralReviewDecision/);
  assert.match(source, /category_needs_review:\s*!categoryDecision\.apply/);
});
