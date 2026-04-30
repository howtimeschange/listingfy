import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyMigrations, openDatabase } from "./sqlite_db.mjs";
import { importMdmProductRows } from "./mdm_product_importer.mjs";

const spuRows = [
  {
    MDM_CODE: "208226102001",
    MDM_NAME: "巴拉巴拉女童衬衫",
    MDM_NAME_US: "Balabala girls shirt",
    BRAND_CODE: "BAL",
    BRAND_DESC: "巴拉巴拉",
    YEAR: "2026",
    SEASON_CODE: "Q2",
    SEASON_DESC: "2026 Q2",
    MIDDLE_CLASS_CODE: "MC01",
    MIDDLE_CLASS_DESC: "长袖衬衫",
    SUBCLASS_CODE: "SC01",
    SUBCLASS_DESC: "梭织长袖衬衫",
    SEX_CODE: "F",
    SEX_DESC: "女",
    AGE_GROUP_CODE: "KID",
    AGE_GROUP_DESC: "幼童",
    PRICE_TAG: "169",
    PIC_URL: "https://mdm.example.com/spu.jpg",
    STATUS_CODE: "40",
    STATUS_DESC: "活动",
    ENABLE_STATUS: "ENABLE",
    DATA_STATUS: "ACTIVE",
    APPROVE_STATUS: "APPROVED",
    MULTI_LANG: [
      { LANG: "zh-CN", MDM_NAME: "巴拉巴拉女童衬衫", CHANNEL_LEVEL: "A" },
      { LANG: "en-US", MDM_NAME: "Balabala girls shirt" },
    ],
  },
];

const skuRows = [
  {
    MDM_CODE: "208226102001",
    SKU_CODE: "20822610200100311080",
    SKU_NAME: "白色调00311/080",
    SKC_CODE: "20822610200100311",
    SKC_NAME: "白色调00311",
    COLOR_CODE: "00311",
    COLOR_DESC: "白色调00311",
    SIZE_CODE: "080",
    SIZE_DESC: "80cm",
    EAN_CODE: "6900137868198",
    INNER_CODE: "IN-080",
    PRICE_TAG: "169",
    PIC_URL: "https://mdm.example.com/skc.jpg",
    BRAND_CODE: "BAL",
    BRAND_DESC: "巴拉巴拉",
    YEAR: "2026",
    SEASON_CODE: "Q2",
    SEASON_DESC: "2026 Q2",
    STATUS_CODE: "40",
    STATUS_DESC: "活动",
    ENABLE_STATUS: "ENABLE",
    DATA_STATUS: "ACTIVE",
    APPROVE_STATUS: "APPROVED",
    MULTI_LANG: [
      { LANG: "zh-CN", SKU_NAME: "白色调00311/080", SKC_NAME: "白色调00311" },
      { LANG: "en-US", SKU_NAME: "White 080", SKC_NAME: "White" },
    ],
  },
  {
    MDM_CODE: "208226102001",
    SKU_CODE: "20822610200100311090",
    SKU_NAME: "白色调00311/090",
    SKC_CODE: "20822610200100311",
    SKC_NAME: "白色调00311",
    COLOR_CODE: "00311",
    COLOR_DESC: "白色调00311",
    SIZE_CODE: "090",
    SIZE_DESC: "90cm",
    EAN_CODE: "6900137868199",
    INNER_CODE: "IN-090",
    PRICE_TAG: "169",
    PIC_URL: "https://mdm.example.com/skc.jpg",
    STATUS_CODE: "40",
    STATUS_DESC: "活动",
    ENABLE_STATUS: "ENABLE",
    DATA_STATUS: "ACTIVE",
    APPROVE_STATUS: "APPROVED",
    MULTI_LANG: [
      { LANG: "zh-CN", SKU_NAME: "白色调00311/090", SKC_NAME: "白色调00311" },
    ],
  },
];

test("importMdmProductRows upserts SPU and derives SKC from SKU rows idempotently", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "listingify-mdm-"));
  const db = openDatabase(path.join(tmpDir, "app.sqlite"), { configureJournal: false });
  try {
    applyMigrations(db);
    const summary1 = importMdmProductRows(db, {
      spuCode: "208226102001",
      spuRows,
      skuRows,
      manifest: { request: { spuCode: "208226102001" } },
      syncedAt: "2026-04-29T00:00:00.000Z",
    });
    const summary2 = importMdmProductRows(db, {
      spuCode: "208226102001",
      spuRows,
      skuRows,
      manifest: { request: { spuCode: "208226102001" } },
      syncedAt: "2026-04-29T00:00:00.000Z",
    });

    assert.deepEqual(summary1.counts, { spu: 1, skc: 1, sku: 2 });
    assert.deepEqual(summary2.counts, { spu: 1, skc: 1, sku: 2 });

    const spu = db.prepare("select * from product_spu where spu_code = ?").get("208226102001");
    assert.equal(spu.spu_name, "巴拉巴拉女童衬衫");
    assert.equal(spu.spu_name_en, "Balabala girls shirt");
    assert.equal(spu.brand_name, "巴拉巴拉");
    assert.equal(spu.channel_level, "A");

    const skc = db.prepare("select * from product_skc where skc_code = ?").get("20822610200100311");
    assert.equal(skc.skc_name, "白色调00311");
    assert.equal(skc.color_name, "白色调00311");
    assert.equal(skc.pic_url, "https://mdm.example.com/skc.jpg");

    const skuCount = db.prepare("select count(*) as c from product_sku").get().c;
    assert.equal(skuCount, 2);
    assert.equal(db.prepare("select count(*) as c from product_spu").get().c, 1);
    assert.equal(db.prepare("select count(*) as c from product_skc").get().c, 1);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
