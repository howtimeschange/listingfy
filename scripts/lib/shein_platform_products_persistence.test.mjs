import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const requireFromWeb = createRequire(path.join(PROJECT_ROOT, "web/package.json"));
const Database = requireFromWeb("better-sqlite3");
const MIGRATION_FILE = path.join(PROJECT_ROOT, "db/migrations/021_shein_platform_products.sql");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/shein-platform-products.ts");
const SERVICE_FILE = path.join(PROJECT_ROOT, "web/server/services/shein-platform-products.ts");
const SERVER_INDEX = path.join(PROJECT_ROOT, "web/server/index.ts");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-platform-products/page.tsx");

async function fileText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-shein-platform-products-"));
  const db = new Database(path.join(tempPath, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table platform_integration (
      id integer primary key autoincrement
    );
    create table app_user (
      id integer primary key autoincrement
    );
  `);
  db.exec(await readFile(MIGRATION_FILE, "utf8"));
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

async function importService() {
  process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/listingify_test";
  return await import("../../web/server/services/shein-platform-products.ts");
}

function testContext() {
  return {
    credentials: {
      source: "environment",
      platformIntegrationId: null,
      baseUrl: "https://example.invalid",
      language: "zh-cn",
      openKeyId: "test-open-key",
      secretKey: "test-secret",
    },
    platform: "SHEIN",
    platformAccountKey: "test-account",
    platformIntegrationId: null,
  };
}

test("SHEIN platform products have persistent product, variant, site, and operation tables", async () => {
  const migration = await fileText(MIGRATION_FILE);

  assert.match(migration, /create table if not exists shein_platform_product/);
  assert.match(migration, /spu_name text not null/);
  assert.match(migration, /raw_list_payload_json text not null default '\{\}'/);
  assert.match(migration, /raw_detail_payload_json text not null default '\{\}'/);
  assert.match(migration, /unique\(platform, platform_account_key, spu_name\)/);
  assert.match(migration, /brand_name text/);
  assert.match(migration, /category_name text/);

  assert.match(migration, /create table if not exists shein_platform_skc/);
  assert.match(migration, /skc_name text not null/);
  assert.match(migration, /unique\(product_id, skc_name\)/);

  assert.match(migration, /create table if not exists shein_platform_sku/);
  assert.match(migration, /sku_code text not null/);
  assert.match(migration, /supplier_sku/);
  assert.match(migration, /cost_price numeric/);
  assert.match(migration, /unique\(skc_id, sku_code\)/);

  assert.match(migration, /create table if not exists shein_platform_site/);
  assert.match(migration, /site_abbr text not null/);
  assert.match(migration, /currency text/);

  assert.match(migration, /create table if not exists shein_lifecycle_operation/);
  assert.match(migration, /operation_type text not null/);
  assert.match(migration, /request_payload_json text not null default '\{\}'/);
  assert.match(migration, /response_payload_json text not null default '\{\}'/);
});

test("SHEIN platform products backend exposes durable sync and lifecycle actions", async () => {
  const [server, route, service, adapterTypes, adapter] = await Promise.all([
    fileText(SERVER_INDEX),
    fileText(ROUTE_FILE),
    fileText(SERVICE_FILE),
    fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/types.ts")),
    fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/shein.ts")),
  ]);

  assert.match(server, /import sheinPlatformProducts from "\.\/routes\/shein-platform-products"/);
  assert.match(server, /app\.route\("\/api\/shein-platform-products", sheinPlatformProducts\)/);

  assert.match(route, /sheinPlatformProducts\.get\("\/"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/sync"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/sites"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/sites\/sync"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/detail"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/sync-detail"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/check-edit-permission"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/partial-edit"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/edit-template"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/field-edit"/);
  assert.match(route, /sheinPlatformProducts\.get\("\/:spuName\/variant-template"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/add-variants"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/update-cost"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/sync-status"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/status\/sync"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/operations\/:operationId\/retry"/);
  assert.match(route, /sheinPlatformProducts\.post\("\/:spuName\/revoke"/);
  assert.match(route, /requirePermission\(c,\s*"LISTING_READ"\)/);
  assert.match(route, /requirePermission\(c,\s*"SYNC_RUN"\)/);
  assert.match(route, /requirePermission\(c,\s*"PUBLISH_RUN"\)/);

  assert.match(service, /persistProductListResult/);
  assert.match(service, /persistProductDetailResult/);
  assert.match(service, /recordLifecycleOperation/);
  assert.match(service, /syncPlatformProducts/);
  assert.match(service, /syncProductDetail/);
  assert.match(service, /checkEditPermission/);
  assert.match(service, /partialEditProduct/);
  assert.match(service, /buildEditPayloadFromForm/);
  assert.match(service, /buildVariantTemplateFromDetail/);
  assert.match(service, /fieldEditProduct/);
  assert.match(service, /syncProductDocumentState/);
  assert.match(service, /batchSyncProductDocumentStates/);
  assert.match(service, /retryLifecycleOperation/);
  assert.match(service, /addVariantsToProduct/);
  assert.match(service, /updateProductCost/);
  assert.match(service, /revokeProduct/);
  assert.match(service, /shein_platform_product/);
  assert.match(service, /shein_platform_skc/);
  assert.match(service, /shein_platform_sku/);
  assert.match(service, /shein_lifecycle_operation/);

  assert.match(adapterTypes, /queryDocumentState/);
  assert.match(adapter, /\/open-api\/goods\/query-document-state/);
});

test("SHEIN platform products page reads local durable data and exposes lifecycle controls", async () => {
  const page = await fileText(PAGE_FILE);

  assert.match(page, /\/shein-platform-products\?/);
  assert.match(page, /\/shein-platform-products\/sync/);
  assert.match(page, /\/shein-platform-products\/sites/);
  assert.match(page, /\/shein-platform-products\/sites\/sync/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/detail/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}\/sync-detail/);
  assert.match(page, /\/check-edit-permission/);
  assert.match(page, /\/partial-edit/);
  assert.match(page, /\/edit-template/);
  assert.match(page, /\/field-edit/);
  assert.match(page, /\/variant-template/);
  assert.match(page, /\/add-variants/);
  assert.match(page, /\/update-cost/);
  assert.match(page, /\/sync-status/);
  assert.match(page, /\/status\/sync/);
  assert.match(page, /\/operations\/\$\{.*operation.*id.*\}\/retry/);
  assert.match(page, /\/revoke/);

  assert.match(page, /同步平台商品/);
  assert.match(page, /同步详情/);
  assert.match(page, /检查可编辑/);
  assert.match(page, /常用字段编辑/);
  assert.match(page, /编辑商品资料/);
  assert.match(page, /拼款模板/);
  assert.match(page, /拼款\/追加变体/);
  assert.match(page, /更新成本价/);
  assert.match(page, /同步状态/);
  assert.match(page, /重试失败操作/);
  assert.match(page, /撤回商品/);
  assert.match(page, /最近操作/);
});

test("SHEIN platform product sync paginates list rows and hydrates SPU details incrementally", async () => {
  const service = await fileText(SERVICE_FILE);
  const adapter = await fileText(path.join(PROJECT_ROOT, "web/server/platform-adapters/shein.ts"));

  assert.match(adapter, /\/open-api\/openapi-business-backend\/product\/query/);
  assert.match(adapter, /\/open-api\/goods\/spu-info/);
  assert.match(service, /maxPages/);
  assert.match(service, /syncDetails/);
  assert.match(service, /detailLimit/);
  assert.match(service, /while\s*\(|for\s*\(/);
  assert.match(service, /rows\.length\s*<\s*pageSize/);
  assert.match(service, /syncProductDetail/);
  assert.match(service, /last_list_synced_at/);
  assert.match(service, /insertTimeStart/);
  assert.match(service, /updateTimeStart/);
  assert.match(service, /brandName/);
  assert.match(service, /categoryName/);
  assert.match(service, /product\.brand_name/);
  assert.match(service, /product\.category_name/);
  assert.match(service, /filters:\s*\{\s*brands/);
  assert.match(service, /queryProductList\(\{ credentials: context\.credentials, payload: pagePayload \}\)/);
  assert.match(service, /queryProductDetail\(\{ credentials: context\.credentials, payload: requestPayload \}\)/);
  assert.match(service, /spuName: normalizedSpuName/);
  assert.match(service, /languageList: \["zh-cn", "en"\]/);
  assert.doesNotMatch(service, /queryProductList\(\{ credentials: context\.credentials, payload: requestPayload \}\),\s*\)\s*const persistence/s);
});

test("SHEIN platform products list resolves brand and category display names from metadata tables", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.match(service, /shein_brand_rule/);
  assert.match(service, /channel_category/);
  assert.match(service, /brand_display_name/);
  assert.match(service, /category_display_name/);
  assert.match(service, /brand_rule\.local_brand_name/);
  assert.match(service, /brand_rule\.brand_name/);
  assert.match(service, /category_mapping\.category_name/);
  assert.doesNotMatch(service, /coalesce\(nullif\(brand_name, ''\), nullif\(brand_code, ''\)\) as label/);
  assert.doesNotMatch(service, /coalesce\(nullif\(category_name, ''\), nullif\(category_id, ''\)\) as label/);
});

test("SHEIN platform products derive sale site details from synced SPU detail payloads", async () => {
  const service = await fileText(SERVICE_FILE);

  assert.match(service, /interface SaleSiteDetail/);
  assert.match(service, /saleSitesFromProduct/);
  assert.match(service, /shelfStatusInfoList/);
  assert.match(service, /shelf_status_info_list/);
  assert.match(service, /siteAbbr/);
  assert.match(service, /shelfStatus/);
  assert.match(service, /firstShelfTime/);
  assert.match(service, /lastShelfTime/);
  assert.match(service, /link/);
  assert.match(service, /saleSites/);
  assert.match(service, /saleSiteSummary/);
  assert.match(service, /saleSiteCount/);
  assert.match(service, /saleSiteSkcs/);
  assert.match(service, /sites:\s*filters\.sites/);
  assert.match(service, /input\.site/);
});

test("SHEIN common edit form payload preserves required published identifiers while applying safe fields", async () => {
  const service = await importService();
  const payload = service.buildEditPayloadFromForm(
    {
      spuName: "SPU001",
      supplierCode: "SUP-OLD",
      brandCode: "BRAND-OLD",
      categoryId: "123",
      productTypeId: "456",
      productMultiNameList: [
        { language: "zh-cn", productName: "旧中文标题" },
        { language: "en", productName: "Old English Title" },
      ],
      productMultiDescList: [{ language: "zh-cn", productDesc: "旧描述" }],
      skcInfoList: [
        {
          skcName: "SKC001",
          supplierCode: "SKC-SUP-OLD",
          attributeId: 1000248,
          attributeValueId: 1001484,
          skcImageInfoList: [{ imageGroupCode: "G-SKC", imageUrl: "https://example.invalid/skc.jpg", imageType: 1, imageSort: 1 }],
          skuInfoList: [
            {
              skuCode: "SKU001",
              supplierSku: "SKU-SUP-OLD",
              weight: "120",
              length: "10",
              width: "20",
              height: "3",
              mallState: 1,
              stopPurchase: 1,
              saleAttributeList: [{ attributeId: 1001184, attributeValueId: 19268998 }],
              costInfoList: [{ costPrice: "9.99", currency: "EUR" }],
              priceInfoList: [{ basePrice: "19.99", currency: "EUR" }],
              stockInfoList: [{ inventoryNum: 100 }],
            },
          ],
        },
      ],
    },
    {
      productTitleZh: "新中文标题",
      productTitleEn: "New English Title",
      productDescriptionZh: "新描述",
      brandCode: "BRAND-NEW",
      supplierCode: "SUP-NEW",
      skuUpdates: [
        {
          skuCode: "SKU001",
          supplierSku: "SKU-SUP-NEW",
          weight: "130",
          length: "11",
          width: "21",
          height: "4",
          mallState: "1",
          stopPurchase: "1",
        },
      ],
    },
  );

  assert.equal(payload.spu_name, "SPU001");
  assert.equal(payload.supplier_code, "SUP-NEW");
  assert.equal(payload.brand_code, "BRAND-NEW");
  assert.deepEqual(payload.multi_language_name_list, [
    { language: "zh-cn", name: "新中文标题" },
    { language: "en", name: "New English Title" },
  ]);
  assert.equal(payload.skc_list[0].skc_name, "SKC001");
  assert.equal(payload.skc_list[0].sku_list[0].sku_code, "SKU001");
  assert.equal(payload.skc_list[0].sku_list[0].supplier_sku, "SKU-SUP-NEW");
  assert.equal(payload.skc_list[0].sku_list[0].weight, "130");
  assert.equal(payload.skc_list[0].sku_list[0].length, "11");
  assert.equal(payload.skc_list[0].sku_list[0].width, "21");
  assert.equal(payload.skc_list[0].sku_list[0].height, "4");
  assert.equal(payload.skc_list[0].sku_list[0].cost_info, undefined);
  assert.equal(payload.skc_list[0].sku_list[0].price_info_list, undefined);
  assert.equal(payload.skc_list[0].sku_list[0].stock_info_list, undefined);
});

test("SHEIN variant template starts from synced detail and separates existing identifiers from new variant fields", async () => {
  const service = await importService();
  const template = service.buildVariantTemplateFromDetail({
    spuName: "SPU001",
    supplierCode: "SUP001",
    categoryId: "123",
    productTypeId: "456",
    productMultiNameList: [{ language: "zh-cn", productName: "测试商品" }],
    skcInfoList: [
      {
        skcName: "SKC001",
        supplierCode: "SKC-SUP-OLD",
        attributeId: 1000248,
        attributeValueId: 1001484,
        skuInfoList: [
          {
            skuCode: "SKU001",
            supplierSku: "SKU-SUP-OLD",
            weight: "120",
            length: "10",
            width: "20",
            height: "3",
            mallState: 1,
            stopPurchase: 1,
            saleAttributeList: [{ attributeId: 1001184, attributeValueId: 19268998 }],
          },
        ],
      },
    ],
  });

  assert.equal(template.payload.spu_name, "SPU001");
  assert.equal(template.payload.skc_list[0].skc_name, "SKC001");
  assert.equal(template.payload.skc_list[0].sku_list[0].sku_code, "SKU001");
  assert.equal(template.newVariant.skc.supplier_code, "");
  assert.equal(template.newVariant.sku.supplier_sku, "");
  assert.equal(template.newVariant.sku.cost_info.currency, "CNY");
  assert.match(template.notes.join("\n"), /新增 SKC\/SKU/);
});

test("SHEIN platform product persistence stores list rows and SPU detail variants", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    const service = await importService();
    const context = testContext();

    const listSummary = service.persistProductListResult(db, context, {
      status: 200,
      payload: {
        code: "0",
        info: {
          data: [
            {
              spuName: "SPU001",
              skcName: "SKC001",
              skuCodeList: ["SKU001", "SKU002"],
              supplierCode: "SUP001",
              productName: "Test Product",
            },
          ],
        },
      },
    });

    assert.deepEqual(listSummary, { rowCount: 1, productCount: 1 });
    assert.equal(db.prepare("select count(*) as count from shein_platform_product").get().count, 1);
    assert.equal(db.prepare("select count(*) as count from shein_platform_skc").get().count, 1);
    assert.equal(db.prepare("select count(*) as count from shein_platform_sku").get().count, 2);

    const detailSummary = service.persistProductDetailResult(db, context, {
      status: 200,
      payload: {
        code: "0",
        info: {
          spuName: "SPU001",
          supplierCode: "SUP001",
          brandCode: "BRAND001",
          categoryId: "123",
          productTypeId: "456",
          productMultiNameList: [{ language: "zh-cn", productName: "测试商品" }],
          skcInfoList: [
            {
              skcName: "SKC001",
              supplierCode: "SUP-SKC",
              skcImageInfoList: [{ imageMediumUrl: "https://example.invalid/skc.jpg" }],
              shelfStatusInfoList: [{ shelfStatus: 1, siteAbbr: "DE" }],
              skuInfoList: [
                {
                  skuCode: "SKU001",
                  supplierSku: "SUP-SKU-1",
                  mallState: 1,
                  stopPurchase: 1,
                  weight: "120",
                  length: "10",
                  width: "20",
                  height: "3",
                  costInfoList: [{ costPrice: "10.55", currency: "EUR" }],
                  priceInfoList: [{ site: "DE", basePrice: "19.99", currency: "EUR" }],
                },
              ],
            },
          ],
        },
      },
    });

    assert.deepEqual(detailSummary, { persisted: true, skcCount: 1, skuCount: 1 });

    const product = db.prepare("select * from shein_platform_product where spu_name = ?").get("SPU001");
    assert.equal(product.product_name, "测试商品");
    assert.equal(product.brand_code, "BRAND001");
    assert.equal(product.skc_count, 1);
    assert.equal(product.sku_count, 1);

    const sku = db.prepare(`
      select sku.*
      from shein_platform_sku sku
      join shein_platform_skc skc on skc.id = sku.skc_id
      where skc.skc_name = 'SKC001'
        and sku.sku_code = 'SKU001'
    `).get();
    assert.equal(sku.supplier_sku, "SUP-SKU-1");
    assert.equal(sku.cost_price, 10.55);
    assert.equal(sku.currency, "EUR");
  } finally {
    await cleanup();
  }
});
