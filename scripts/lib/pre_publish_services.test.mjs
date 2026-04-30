import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

const shared = await import("../../web/server/services/pre-publish/shared.ts");
const drafts = await import("../../web/server/services/pre-publish/drafts.ts");
const fieldFills = await import("../../web/server/services/pre-publish/field-fills.ts");
const images = await import("../../web/server/services/pre-publish/images.ts");
const payload = await import("../../web/server/services/pre-publish/payload.ts");
const sheinApi = await import("../../web/server/services/pre-publish/shein-api.ts");
const versions = await import("../../web/server/services/pre-publish/versions.ts");

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

test("draft status transitions block active publish states and permit ordinary draft repair flows", () => {
  assert.equal(drafts.canTransitionDraftStatus("PUBLISHING", "DRAFT"), false);
  assert.equal(drafts.canTransitionDraftStatus("PUBLISH_SUBMITTED", "PAUSED"), false);
  assert.equal(drafts.canTransitionDraftStatus("READY_TO_PUBLISH", "PAUSED"), true);
  assert.equal(drafts.canTransitionDraftStatus("PAUSED", "READY_TO_PUBLISH"), false);
  assert.equal(drafts.canTransitionDraftStatus("ARCHIVED", "DRAFT"), true);
});

test("field-fill helpers coerce enum values without losing manual text values", () => {
  const multiEnumField = { render_kind: "multi_enum" };
  const textField = { render_kind: "text" };
  assert.deepEqual(fieldFills.coerceFieldValues(multiEnumField, "[\"红色\",\"蓝色\"]"), ["红色", "蓝色"]);
  assert.deepEqual(fieldFills.coerceFieldValues(multiEnumField, "红色、蓝色"), ["红色", "蓝色"]);
  assert.deepEqual(fieldFills.coerceFieldValues(textField, "  手填值  "), ["手填值"]);
  assert.deepEqual(fieldFills.coerceFieldValues(textField, "   "), []);
});

test("image service builds SHEIN picture requirements and validates common image constraints", () => {
  const requirements = images.buildPictureRequirements([
    { field_key: "skc_image_square_show", is_true: 1 },
    { field_key: "skc_image_square_required", is_true: 1 },
    { field_key: "skc_image_detail_single", is_true: 0 },
  ]);
  const squareRequirement = requirements.find((item) => item.requirement_key === "SKC_SQUARE");
  assert.equal(squareRequirement.required, 1);
  assert.deepEqual(squareRequirement.asset_types, ["SQUARE"]);

  assert.equal(
    images.imageCompliance({ width: 1200, height: 1200, file_size: 1024 * 1024 }, squareRequirement).status,
    "PASS",
  );
  assert.deepEqual(
    images.imageCompliance({ width: 800, height: 1200, file_size: 1024 * 1024 }, squareRequirement).reasons,
    ["方形图需为 1:1", "方形图尺寸需在 900-2200 px"],
  );

  const switchOnly = images.buildPictureRequirements([{ field_key: "switch_spu_picture", is_true: 1 }]);
  assert.equal(switchOnly.every((item) => item.key.startsWith("skc-")), true);
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

test("SHEIN API service exposes upload and transform helpers for platform-bound image calls", () => {
  assert.equal(typeof sheinApi.uploadLocalImageToShein, "function");
  assert.equal(typeof sheinApi.transformOnlineImageToShein, "function");
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
