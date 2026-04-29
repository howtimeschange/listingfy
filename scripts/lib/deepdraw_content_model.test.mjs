import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { extractDeepdrawContentRows } from "./deepdraw_content_model.mjs";
import { importDeepdrawPayloads } from "./deepdraw_content_importer.mjs";
import { applyMigrations, openDatabase } from "./sqlite_db.mjs";

function samplePayload() {
  return {
    code: 10200,
    response: "success",
    reason: "访问成功！",
    requestId: "request-1",
    timestamp: 1777420800000,
    body: {
      brandName: "巴拉巴拉",
      code: "208226102001",
      productId: 6241569,
      id: "body-id-1",
      title: "巴拉巴拉女童衬衫",
      retailPrice: "169",
      primaryColor: "雅致白00311",
      version: 21,
      complete: true,
      createDate: 1777420800000,
      lastUpdateDate: 1777420900000,
      onsaleDate: 1777421000000,
      trade: {
        path: "所有行业.服装.童装婴幼儿服装.衬衫",
        name: "衬衫",
        id: "57",
      },
      places: ["TMALL", "DOUYIN"],
      colors: {
        optionAliases: {
          米白: "雅致白00311",
        },
        field: {
          id: "1628",
          name: "颜色",
          type: "MULTI_CHOICE",
        },
        texts: [],
        options: ["米白"],
      },
      sizes: {
        optionAliases: {
          "80cm": "80cm",
          "90cm": "90cm",
        },
        field: {
          id: "1698",
          name: "尺码",
          type: "MULTI_CHOICE",
        },
        texts: ["8708,80cm,TMALL", "8710,90cm,TMALL"],
        options: ["80cm", "90cm"],
      },
      skus: {
        skuItems: [
          {
            color: "米白",
            size: "80cm",
            values: {
              货号: "208226102001",
              唯品会货号: "20822610200100311",
              小红书商家编码: "20822610200100311080",
              单品货号: "6900137868198",
              商家编码: "6900137868198",
              价格: "169",
              数量: "3",
            },
          },
        ],
      },
      pictures: {
        pictures: {
          TMALL: {
            place: "TMALL",
            pictures: {
              HOME: [
                {
                  id: 688265488,
                  name: "main.jpg",
                  url: "//product.resources.deepdraw.biz/demo/main.jpg",
                  skc: "20822610200100311",
                  color: "雅致白00311",
                  width: "800",
                  height: "800",
                  size: "83231",
                  sortNum: 1,
                  withWatermark: false,
                },
              ],
            },
          },
        },
      },
      detalPages: [
        {
          templateName: "巴拉25Q1服饰模板",
          templateWidth: 750,
          templateSites: ["TMALL"],
          active: true,
          time: 1777421100000,
          htmlPageUrl: "http://product.resources.deepdraw.biz/demo/page.html",
          imagePageUrl: "http://product.resources.deepdraw.biz/demo/image.html",
          mixedPageUrl: "http://product.resources.deepdraw.biz/demo/mixed.html",
          screenShotSectionUrls: ["http://product.resources.deepdraw.biz/demo/s1.jpg"],
          modules: {
            商品展示: ["http://product.resources.deepdraw.biz/demo/m1.jpg"],
          },
        },
      ],
      sizeTables: [
        {
          field: {
            id: "1705",
            name: "尺码表",
            type: "MULTI_TEXT",
          },
          options: ["胸围"],
          optionAliases: {
            胸围: "胸围",
          },
          sizeTableItems: [
            {
              size: "80cm",
              values: {
                胸围: "63.5",
              },
            },
          ],
        },
      ],
      fields: [
        {
          field: {
            id: "79469",
            name: "品牌",
            type: "TEXT",
          },
          texts: ["巴拉巴拉(Balabala)"],
          options: [],
          optionAliases: {},
        },
        {
          field: {
            id: "empty",
            name: "空字段",
            type: "TEXT",
          },
          texts: [],
          options: [],
          optionAliases: {},
        },
      ],
    },
  };
}

test("extractDeepdrawContentRows maps body into SPU-SKC-SKU content rows", () => {
  const rows = extractDeepdrawContentRows({
    payload: samplePayload(),
    productCode: "208226102001",
    syncedAt: "2026-04-29T00:00:00.000Z",
  });

  assert.equal(rows.package.spuCode, "208226102001");
  assert.equal(rows.package.rawPayloadJson, JSON.stringify(samplePayload().body));
  assert.equal(rows.skcs.length, 1);
  assert.equal(rows.skcs[0].skcCode, "20822610200100311");
  assert.equal(rows.skcs[0].colorName, "米白");
  assert.equal(rows.skcs[0].colorAlias, "雅致白00311");
  assert.equal(rows.skus.length, 1);
  assert.equal(rows.skus[0].skuCode, "20822610200100311080");
  assert.equal(rows.skus[0].sizeCode, "8708");
  assert.equal(rows.sizes.length, 2);
  assert.equal(rows.sizeTables.length, 1);
  assert.equal(rows.sizeTableRows.length, 1);
  assert.equal(rows.detailPages.length, 1);
  assert.equal(rows.assets.length, 3);
  assert.equal(rows.assets[0].normalizedUrl, "http://product.resources.deepdraw.biz/demo/main.jpg");
  assert.equal(rows.fields.length, 1);
  assert.equal(rows.fields[0].fieldName, "品牌");
  assert.equal(rows.fields[0].isKey, true);
});

test("importDeepdrawPayloads persists structured content tables idempotently", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listingfy-deepdraw-"));
  const db = openDatabase(path.join(tmpDir, "app.sqlite"), { configureJournal: false });
  try {
    applyMigrations(db);
    const summary1 = importDeepdrawPayloads(db, {
      payloads: [{ productCode: "208226102001", payload: samplePayload() }],
      sourceDir: "data/deepdraw-content/test",
      manifest: { counts: { success: 1, failed: 0 } },
      syncedAt: "2026-04-29T00:00:00.000Z",
    });
    const summary2 = importDeepdrawPayloads(db, {
      payloads: [{ productCode: "208226102001", payload: samplePayload() }],
      sourceDir: "data/deepdraw-content/test",
      manifest: { counts: { success: 1, failed: 0 } },
      syncedAt: "2026-04-29T00:00:00.000Z",
    });

    assert.deepEqual(summary1.counts, summary2.counts);
    assert.equal(db.prepare("select count(*) as c from product_content_package").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_content_skc").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_content_sku").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_content_size").get().c, 2);
    assert.equal(db.prepare("select count(*) as c from product_content_size_table").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_content_size_table_row").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_asset").get().c, 3);
    assert.equal(db.prepare("select count(*) as c from product_content_detail_page").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_content_field").get().c, 1);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
