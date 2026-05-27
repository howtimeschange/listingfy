import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/page.tsx");
const BATCH_PUBLISH_DIALOG = path.join(PROJECT_ROOT, "web/src/components/pre-publish/batch-publish-dialog.tsx");
const DETAIL_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/pre-publish-validation/[listingId]/page.tsx");
const SHEIN_PRODUCTS_PAGE = path.join(PROJECT_ROOT, "web/src/pages/shein-products/page.tsx");
const APP_SIDEBAR_FILE = path.join(PROJECT_ROOT, "web/src/components/layout/app-sidebar.tsx");
const PAGINATION_COMPONENT = path.join(PROJECT_ROOT, "web/src/components/server-pagination.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts");
const PUBLISH_TASKS_ROUTE = path.join(PROJECT_ROOT, "web/server/routes/publish-tasks.ts");
const PUBLISH_TASKS_PAGE = path.join(PROJECT_ROOT, "web/src/pages/publish-tasks/page.tsx");
const PUBLISH_TASK_DETAIL_PAGE = path.join(PROJECT_ROOT, "web/src/pages/publish-tasks/[id]/page.tsx");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");

test("pre publish route builds readiness rows from SHEIN product bucket data", async () => {
  const [route, server] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/pre-publish", prePublish\)/);
  assert.match(server, /app\.route\("\/api\/shein-products", sheinProducts\)/);
  assert.match(route, /\/readiness/);
  assert.match(route, /bucketReadinessRows/);
  assert.match(route, /shein_product_bucket/);
  assert.doesNotMatch(route, /select distinct bucket\.spu_code\s+from shein_product_bucket[\s\S]*?order by bucket\.updated_at desc, bucket\.id desc/);
  assert.match(route, /group by bucket\.spu_code/);
  assert.match(route, /\/ai-fill/);
  assert.match(route, /\/field-fills/);
  assert.match(route, /\/platforms/);
  assert.match(route, /\/drafts/);
  assert.match(route, /function createDraft/);
  assert.match(route, /nextPublishUnitNo/);
  assert.match(route, /\/drafts\/:id\/duplicate/);
  assert.match(route, /\/drafts\/:id\/status/);
  assert.match(route, /prePublish\.delete\("\/drafts\/:id"/);
  assert.match(route, /canTransitionDraftStatus/);
  assert.match(route, /\/draft-categories/);
  assert.match(route, /\/category-tree/);
  assert.match(route, /\/drafts\/:id\/category/);
  assert.match(route, /\/drafts\/:id\/convert-openapi-single-item/);
  assert.match(route, /isSheinOpenApiUnsupportedSuitCategory/);
  assert.match(route, /resolveOpenApiSingleItemCategory/);
  assert.match(route, /sanitizeSingleItemTitleCn/);
  assert.match(route, /sanitizeSingleItemTitleEn/);
  assert.match(route, /SHEIN OpenAPI 套装类目限制/);
  assert.match(route, /existingSalePayloadIsValid/);
  assert.match(route, /\/drafts\/:id\/ai-enrich/);
  assert.match(route, /\/drafts\/:id\/save/);
  assert.match(route, /\/drafts\/batch-publish-check/);
  assert.match(route, /\/drafts\/:id\/images\/import-folder/);
  assert.match(route, /sku_size_values/);
  assert.match(route, /updateListingSkuSizes/);
  assert.match(route, /size_attribute_payload_json/);
  assert.match(route, /mapped_size_charts/);
  assert.match(route, /size_chart_template/);
  assert.match(route, /isChannelSpecificTable/);
  assert.match(route, /唯品会\|抖音\|天猫\|得物/);
  assert.match(route, /upperTable/);
  assert.match(route, /lowerTable/);
  assert.match(route, /listing\b/);
  assert.match(route, /listing_skc/);
  assert.match(route, /listing_sku/);
  assert.match(route, /listing_asset/);
  assert.match(route, /selected_for_publish/);
  assert.match(route, /listing_publish_version/);
  assert.match(route, /publish_unit_no/);
  assert.match(route, /hero_image_url/);
  assert.match(route, /skc_preview/);
  assert.match(route, /listing_validation_result/);
  assert.match(route, /buildSupplierBarcodePayload/);
  assert.match(route, /fieldShown\(publishFields,\s*"supplier_barcode"\)/);
  assert.match(route, /barcode_type/);
  assert.doesNotMatch(route, /supplier_barcode:\s*normalizeText\(sku\.supplier_barcode\)/);
  assert.match(route, /buildCompositionAttributeItems/);
  assert.match(route, /stock_info_list/);
  assert.match(route, /publishBusinessValidationErrors/);
  assert.match(route, /SHEIN_PRE_VALIDATION/);
  assert.match(route, /buildDependentAttributeItems/);
  assert.match(route, /门襟类型/);
  assert.match(route, /\.\.\.\(sizeAttributeList\.length/);
  assert.match(route, /product_content_size_table_row/);
  assert.match(route, /channel_required_attribute/);
  assert.match(route, /channel_picture_config/);
  assert.match(route, /buildPictureRequirements/);
  assert.match(route, /image_requirements/);
  assert.match(route, /dimension_field_groups/);
  assert.match(route, /SPU 款维度/);
  assert.match(route, /SKC 款色维度/);
  assert.match(route, /SKC-SKU 发布尺码与价格包装/);
  assert.match(route, /requirement_key/);
  assert.match(route, /size_conversion_rule/);
  assert.match(route, /supply_discount_rule/);
  assert.match(route, /product_weight_import/);
  assert.match(route, /listing_field_fill/);
  assert.match(route, /sku_commercial_values/);
  assert.match(route, /updateListingSkuCommercials/);
  assert.match(route, /priceConfirmedForSkuCommercial/);
  assert.doesNotMatch(route, /when \? is not null and \? > 0/);
  assert.match(route, /manual_size_chart_rows/);
  assert.match(route, /getManualSizeChart/);
  assert.match(route, /persistManualSizeChart/);
  assert.match(route, /\/drafts\/:id\/images\/upload/);
  assert.match(route, /selectedListingSkcWhere/);
  assert.match(route, /selectedListingSkuWhere/);
  assert.match(route, /onlySelected:\s*true/);
  assert.match(route, /skc\.selected_for_publish = 1/);
  assert.match(route, /displayListingForSelectedSkcs/);
  assert.match(route, /withoutUnselectedSkcColors/);
  assert.match(route, /displayReadinessForSelectedSkcs/);
  assert.match(route, /readiness:\s*selectedReadiness/);
});

test("draft detail supports manual SHEIN category size chart editing", async () => {
  const [route, detailPage] = await Promise.all([
    readFile(ROUTE_FILE, "utf8"),
    readFile(DETAIL_PAGE_FILE, "utf8"),
  ]);

  assert.match(route, /size_chart_attributes/);
  assert.match(route, /manual_size_chart/);
  assert.match(route, /buildManualSizeChartAttributeList/);
  assert.match(detailPage, /manualSizeChartValues/);
  assert.match(detailPage, /downloadManualSizeChartTemplate/);
  assert.match(detailPage, /importManualSizeChartTemplate/);
  assert.match(detailPage, /readSpreadsheetFile/);
  assert.match(detailPage, /下载模板/);
  assert.match(detailPage, /导入填充/);
});

test("publish task center shows submitted platform tasks and task detail payloads", async () => {
  const [route, page, detailPage, server, router] = await Promise.all([
    readFile(PUBLISH_TASKS_ROUTE, "utf8"),
    readFile(PUBLISH_TASKS_PAGE, "utf8"),
    readFile(PUBLISH_TASK_DETAIL_PAGE, "utf8"),
    readFile(SERVER_INDEX, "utf8"),
    readFile(ROUTER_FILE, "utf8"),
  ]);

  assert.match(server, /app\.route\("\/api\/publish-tasks", publishTasks\)/);
  assert.match(router, /PublishTasksPage/);
  assert.match(router, /PublishTaskDetailPage/);
  assert.match(route, /listing_publish_task/);
  assert.match(route, /platform_identity/);
  assert.match(route, /request_payload/);
  assert.match(route, /response_payload/);
  assert.match(route, /related_tasks/);
  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /发布任务/);
  assert.match(page, /任务列表/);
  assert.match(page, /任务中心负责追踪/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /\/publish-tasks\/\$\{item\.id\}/);
  assert.doesNotMatch(detailPage, /ComingSoonPage/);
  assert.match(detailPage, /平台身份回写/);
  assert.match(detailPage, /同款发布尝试/);
  assert.match(detailPage, /请求 Payload/);
  assert.match(detailPage, /平台响应/);
});

test("pre publish validation page is now a draft list after selection moved to SHEIN bucket", async () => {
  const [page, batchPublishDialog, pagination, sidebar] = await Promise.all([
    readFile(PAGE_FILE, "utf8"),
    readFile(BATCH_PUBLISH_DIALOG, "utf8"),
    readFile(PAGINATION_COMPONENT, "utf8"),
    readFile(APP_SIDEBAR_FILE, "utf8"),
  ]);
  const combined = `${page}\n${batchPublishDialog}`;

  assert.doesNotMatch(page, /ComingSoonPage/);
  assert.match(page, /SHEIN 发布草稿箱/);
  assert.match(page, /同一个 SHEIN 商品可以派生多个独立草稿/);
  assert.match(page, /新建草稿/);
  assert.match(page, /派生新草稿/);
  assert.match(page, /派生一份草稿/);
  assert.match(page, /删除草稿/);
  assert.match(page, /\/pre-publish\/drafts\/\$\{listingId\}\/duplicate/);
  assert.match(page, /\/pre-publish\/drafts\/\$\{listingId\}\/status/);
  assert.match(page, /api\.delete\(`\/pre-publish\/drafts\/\$\{listingId\}`\)/);
  assert.match(page, /hero_image_url/);
  assert.match(page, /skc_preview/);
  assert.match(page, /publish_unit_no/);
  assert.match(page, /ProductThumb/);
  assert.match(page, /批量提交发布/);
  assert.match(page, /BatchPublishDialog/);
  assert.match(combined, /batch-publish-check/);
  assert.match(combined, /保存调整并重新预检/);
  assert.match(combined, /确认批量发布/);
  assert.match(page, /发布平台/);
  assert.match(page, /SHEIN/);
  assert.match(page, /字段完整度/);
  assert.match(page, /批量搜索款号/);
  assert.match(page, /\/pre-publish\/drafts/);
  assert.match(page, /ServerPagination/);
  assert.match(page, /draftPagination/);
  assert.match(page, /categoryFilter/);
  assert.match(page, /useDraftCategories/);
  assert.match(page, /SHEIN 类目筛选/);
  assert.doesNotMatch(page, /usePrePublishReadiness/);
  assert.doesNotMatch(page, /勾选发布商品/);
  assert.doesNotMatch(page, /Tabs/);
  assert.doesNotMatch(page, /placeholder="搜索.*类目"/);
  assert.match(pagination, /每页数量/);
  assert.match(pagination, /上一页/);
  assert.match(pagination, /下一页/);
  assert.match(sidebar, /SHEIN 发布草稿箱/);
  assert.doesNotMatch(sidebar, /草稿工作台/);
  assert.doesNotMatch(sidebar, /发布校验/);
});

test("pre publish has a single listing detail route with editable fields and version history", async () => {
  const [detailPage, router, route] = await Promise.all([
    readFile(DETAIL_PAGE_FILE, "utf8"),
    readFile(ROUTER_FILE, "utf8"),
    readFile(ROUTE_FILE, "utf8"),
  ]);

  assert.match(router, /PrePublishDraftDetailPage/);
  assert.match(router, /pre-publish-validation\/:listingId/);
  assert.match(detailPage, /useParams/);
  assert.match(route, /\/drafts\/:id\/ai-field/);
  assert.match(route, /generateSingleAiField/);
  assert.match(detailPage, /上新填写工作台/);
  assert.match(detailPage, /WorkbenchElevator/);
  assert.match(detailPage, /上新填写工作台配置项/);
  assert.match(detailPage, /updateActiveElevatorSectionFromScroll/);
  assert.match(detailPage, /onScroll=\{handleWorkbenchScroll\}/);
  assert.match(detailPage, /scrollToWorkbenchSection/);
  assert.match(detailPage, /value=\{activeWorkbenchTab\}/);
  assert.match(detailPage, /onValueChange=\{handleWorkbenchTabChange\}/);
  assert.match(detailPage, /id="draft-summary"/);
  assert.match(detailPage, /id="draft-required-fields"/);
  assert.match(detailPage, /id="draft-spu-assets"/);
  assert.match(detailPage, /id="draft-skc-sku"/);
  assert.match(detailPage, /id="draft-size-chart"/);
  assert.match(detailPage, /id="draft-publish-records"/);
  assert.match(detailPage, /更多发布记录/);
  assert.match(detailPage, /Tabs/);
  assert.match(detailPage, /TabsTrigger value="listing"/);
  assert.match(detailPage, /TabsTrigger value="records"/);
  assert.match(detailPage, /issuesByFieldKey/);
  assert.match(detailPage, /validationIssues=\{fieldValidationIssues\}/);
  assert.match(detailPage, /bg-\[#fff1f1\]/);
  assert.doesNotMatch(detailPage, /Collapsible/);
  assert.match(detailPage, /aiFieldMutation/);
  assert.match(detailPage, /AI 生成/);
  assert.match(detailPage, /generatingFieldKey=\{aiFieldMutation\.isPending \? aiFieldMutation\.variables\?\.key \?\? null : null\}/);
  assert.doesNotMatch(detailPage, /generatingFieldKey=\{aiFieldMutation\.variables\?\.key \?\? null\}/);
  assert.match(detailPage, /AI 转换类目/);
  assert.match(detailPage, /AI 翻译标题/);
  assert.match(detailPage, /AI 推荐补齐空字段/);
  assert.match(detailPage, /<Button[\s\S]+onClick=\{\(\) => aiEnrichMutation\.mutate\("all"\)\}[\s\S]+AI 推荐补齐空字段[\s\S]+<\/Button>[\s\S]+<DropdownMenu>/);
  assert.doesNotMatch(detailPage, /<DropdownMenuItem[\s\S]+aiEnrichMutation\.mutate\("all"\)[\s\S]+AI 推荐补齐空字段[\s\S]+<\/DropdownMenuItem>/);
  assert.match(detailPage, /保存草稿/);
  assert.match(detailPage, /上新需要关注/);
  assert.match(detailPage, /只保留类目要求、缺失项、标题、品牌、属性、图片和包装价格等上新必填信息/);
  assert.match(detailPage, /需要填写的字段/);
  assert.match(detailPage, /SKC 款色维度/);
  assert.match(detailPage, /SHEIN 类目尺码表/);
  assert.match(detailPage, /dimension_field_groups/);
  assert.match(detailPage, /image_requirements/);
  assert.match(detailPage, /图片规则/);
  assert.match(detailPage, /SPU 图片规则/);
  assert.match(detailPage, /主图、方形图和色块图/);
  assert.match(detailPage, /类目树选择/);
  assert.match(detailPage, /onEditCategory/);
  assert.match(detailPage, /onGenerateCategoryAi/);
  assert.match(detailPage, /categoryAiGenerating/);
  assert.match(detailPage, /field\.key === "category"/);
  assert.match(detailPage, /修改类目/);
  assert.match(detailPage, /转为 OpenAPI 单品发布/);
  assert.match(detailPage, /convert-openapi-single-item/);
  assert.match(detailPage, /OpenAPI 套装类目限制/);
  assert.match(detailPage, /categoryTree/);
  assert.match(detailPage, /\/pre-publish\/category-tree/);
  assert.match(detailPage, /\/pre-publish\/drafts\/\$\{listingId\}\/category/);
  assert.match(detailPage, /按 SKC 选择发布尺码/);
  assert.match(detailPage, /selectedSkuIdsBySkc/);
  assert.doesNotMatch(detailPage, /保存字段/);
  assert.match(detailPage, /skcGroups/);
  assert.match(detailPage, /sale_attribute/);
  assert.match(detailPage, /attribute_value_id/);
  assert.match(detailPage, /SHEIN 发布尺码/);
  assert.match(detailPage, /商品档案尺码/);
  assert.match(detailPage, /setSkuSizeValues/);
  assert.match(detailPage, /sku_size_values/);
  assert.match(detailPage, /sku_commercial_values/);
  assert.match(detailPage, /updateSkuCommercialValue/);
  assert.match(detailPage, /sku\.sku_code/);
  assert.match(detailPage, /skcImageForSku/);
  assert.match(detailPage, /SKC 款色图/);
  assert.match(detailPage, /尺码表/);
  assert.match(detailPage, /深绘来源表/);
  assert.match(detailPage, /SHEIN 类目尺码模板/);
  assert.match(detailPage, /mapped_size_charts/);
  assert.match(detailPage, /图片确认/);
  assert.match(detailPage, /导入本地图片目录/);
  assert.match(detailPage, /导入图片/);
  assert.match(detailPage, /上传补齐/);
  assert.match(detailPage, /files: File\[\]/);
  assert.match(detailPage, /multiple/);
  assert.match(detailPage, /Array\.from\(event\.target\.files \?\? \[\]\)/);
  assert.match(detailPage, /for \(const \[index, file\] of files\.entries\(\)\)/);
  assert.match(detailPage, /images\/upload/);
  assert.match(detailPage, /MultiEnumPicker/);
  assert.match(detailPage, /版本历史/);
  assert.match(detailPage, /发布回显/);
  assert.match(detailPage, /publish_tasks/);
  assert.match(detailPage, /platform_identities/);
  assert.doesNotMatch(detailPage, /<CardTitle>校验阻断<\/CardTitle>/);
  assert.match(detailPage, /创建版本快照/);
  assert.match(detailPage, /发布到 SHEIN/);
  assert.match(detailPage, /\/publish/);
  assert.match(detailPage, /TMALL COLOR_BLOCK \/ COLOR/);
});

test("creating drafts returns to the unified SHEIN draft box", async () => {
  const [page, router] = await Promise.all([
    readFile(SHEIN_PRODUCTS_PAGE, "utf8"),
    readFile(ROUTER_FILE, "utf8"),
  ]);

  assert.match(page, /\/pre-publish-validation\?batch_search=/);
  assert.doesNotMatch(page, /\/draft-workbench\?ids=/);
  assert.match(router, /path: "draft-workbench"/);
  assert.match(router, /Navigate to="\/pre-publish-validation"/);
});

test("pre publish AI calls handle reasoning responses and transient provider failures", async () => {
  const route = await readFile(ROUTE_FILE, "utf8");

  assert.match(route, /responseMessageContent/);
  assert.match(route, /reasoning_content/);
  assert.match(route, /retryableAiError/);
  assert.match(route, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(route, /response\.status === 429 \|\| response\.status >= 500/);
});
