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

test("field-fill helpers normalize cotton blend material to platform fabric", () => {
  assert.equal(fieldFills.normalizeMaterialValue("棉混纺"), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("  棉 混 纺  "), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("Cotton Blend"), "织物");
  assert.equal(fieldFills.normalizeMaterialValue("聚酯纤维"), "聚酯纤维");
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
  assert.match(source, /shouldAutoApplyCategory/);
  assert.match(source, /AI_CATEGORY_LIVE/);
  assert.doesNotMatch(source, /if \(mode === "all" \|\| mode === "category"\) \{\s*persistCategoryFill\(db, readiness\)\s*if \(readiness\.category\.category_id/s);
  assert.match(source, /quick_fixes:\s*\{\s*fields/);
  assert.match(source, /sku_commercials/);
  assert.match(source, /batch-import-folders/);

  assert.match(dialog, /commonPackageEdits/);
  assert.match(dialog, /批量标题/);
  assert.match(dialog, /批量包装/);
  assert.match(dialog, /批量类目/);
  assert.match(dialog, /sku_commercial_values/);

  assert.match(draftList, /批量导入图片目录/);
  assert.match(draftList, /batch-import-folders/);
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

test("draft AI category enrichment calls AI live and applies the suggested category", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /callAiCategoryMatcher/);
  assert.match(source, /function shouldAskLiveAiCategory/);
  assert.match(source, /async function resolveLiveAiDraftCategory/);
  assert.match(source, /async function safeResolveLiveAiDraftCategory/);
  assert.match(source, /safeResolveLiveAiDraftCategory\(db,\s*categoryReadiness\)/);
  assert.match(source, /applyDraftCategorySelection/);
  assert.match(source, /source:\s*"AI_CATEGORY_LIVE"/);
  assert.match(source, /fieldLabel:\s*"SHEIN 类目"/);
  assert.doesNotMatch(source, /fieldLabel:\s*"SHEIN 类目候选"/);
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

test("deployment preserves runtime listing image uploads outside release sync", async () => {
  const buildScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-build.sh"), "utf8");
  const deployScript = await readFile(path.join(PROJECT_ROOT, "ci/yunxiao-deploy.sh"), "utf8");

  assert.match(buildScript, /--exclude='\.\/data\/listing-assets'/);
  assert.match(deployScript, /--exclude='data\/listing-assets'/);
  assert.match(deployScript, /mkdir -p "\$APP_DIR\/data\/listing-assets"/);
});

test("publish precheck treats local uploaded images as pending SHEIN image assets", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");

  assert.match(source, /allowLocalImages\?:\s*boolean/);
  assert.match(source, /allowLocalImages\s*&&\s*normalizeText\(asset\.local_path\)/);
  assert.match(source, /buildPublishPayload\(db,\s*listingId,\s*\{\s*allowLocalImages:\s*true,\s*requirePreparedImages:\s*false\s*\}\)/);
  assert.match(source, /allowSourceImages:\s*true,\s*allowLocalImages:\s*true,\s*requirePreparedImages:\s*false/);
});

test("draft category AI recomputes from source data instead of replaying the draft category", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  const bucketSource = await readFile(path.join(PROJECT_ROOT, "web/server/routes/shein-products.ts"), "utf8");

  assert.match(source, /ignoreListingCategory\?:\s*boolean/);
  assert.match(source, /ignoreStoredCategory\?:\s*boolean/);
  assert.match(source, /const storedCategory = ignoreStoredCategory\s*\?\s*null\s*:\s*readStoredCategoryOverride\(fills,\s*spuCode\)/);
  assert.match(source, /getReadinessForListing\(db,\s*listing,\s*\{\s*ignoreListingCategory:\s*true,\s*ignoreStoredCategory:\s*true,\s*\}\)/);
  assert.match(source, /shouldAutoApplyCategory\(categoryReadiness\.category,\s*\{\s*allowRuleFallback:\s*mode === "category" \|\| mode === "all"\s*\}\)/);
  assert.match(source, /let enrichmentReadiness = mode === "all" \? categoryReadiness : readiness/);
  assert.match(source, /const updatedReadiness = updatedListing \? getReadinessForListing\(db,\s*updatedListing\) : null/);
  assert.match(source, /function safeAiTranslateTitle/);
  assert.match(source, /const titleEn = await safeAiTranslateTitle\(enrichmentReadiness\)/);
  assert.match(source, /const aiFills = await callAiFill\(enrichmentReadiness\)/);
  assert.match(source, /resolveSheinKidsCategoryFallback/);
  assert.match(bucketSource, /resolveSheinKidsCategoryFallback/);
});
