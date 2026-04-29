import { createHash } from "node:crypto";
import { json, runInTransaction } from "./sqlite_db.mjs";

function currentIso() {
  return new Date().toISOString();
}

function text(value) {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
}

function numberValue(value) {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sourceHash(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function langRows(row) {
  if (Array.isArray(row?.MULTI_LANG)) return row.MULTI_LANG;
  if (typeof row?.MULTI_LANG === "string") {
    try {
      const parsed = JSON.parse(row.MULTI_LANG);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function langValue(row, lang, key) {
  const item = langRows(row).find((entry) => entry?.LANG === lang);
  return text(item?.[key]);
}

function localized(row, key, fallbackKey = key) {
  return {
    cn: langValue(row, "zh-CN", key) ?? text(row?.[fallbackKey]),
    en: langValue(row, "en-US", key) ?? text(row?.[`${fallbackKey}_US`]),
  };
}

function batchNoFor(spuCode, manifest) {
  return text(manifest?.batch_no) ?? `spu-${spuCode}`;
}

function upsertSyncBatch(db, { spuCode, manifest, syncedAt }) {
  const batchNo = batchNoFor(spuCode, manifest);
  const row = db.prepare(`
    insert into sync_batch (
      source_system, source_object, batch_no, status, started_at, finished_at,
      source_dir, total_count, success_count, failed_count, manifest_json
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(source_system, source_object, batch_no)
    do update set
      status = excluded.status,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      total_count = excluded.total_count,
      success_count = excluded.success_count,
      failed_count = excluded.failed_count,
      manifest_json = excluded.manifest_json
    returning id
  `).get(
    "MDM",
    "product_master",
    batchNo,
    "SUCCESS",
    manifest?.started_at ?? syncedAt,
    manifest?.finished_at ?? syncedAt,
    null,
    1,
    1,
    0,
    json(manifest ?? {}),
  );
  return row.id;
}

function mapSpu(row, syncBatchId, syncedAt, updatedAt) {
  const spuName = localized(row, "MDM_NAME");
  const zhLang = langRows(row).find((entry) => entry?.LANG === "zh-CN") ?? {};
  return [
    text(row.MDM_CODE),
    spuName.cn,
    spuName.en,
    text(row.BRAND_CODE),
    text(row.BRAND_DESC),
    text(row.YEAR),
    text(row.SEASON_CODE),
    text(row.SEASON_DESC),
    text(row.PRODUCT_CHAIN_CODE),
    text(row.PRODUCT_CHAIN_DESC),
    text(row.PRODUCT_LINE_CODE),
    text(row.PRODUCT_LINE_DESC),
    text(row.PRODUCT_TYPE_CODE),
    text(row.PRODUCT_TYPE_DESC),
    text(row.MIDDLE_CLASS_CODE),
    text(row.MIDDLE_CLASS_DESC),
    text(row.SUBCLASS_CODE),
    text(row.SUBCLASS_DESC),
    text(row.SEX_CODE),
    text(row.SEX_DESC),
    text(row.AGE_GROUP_CODE),
    text(row.AGE_GROUP_DESC),
    text(row.ARTICLE_PROP_CODE),
    text(row.ARTICLE_PROP_DESC),
    text(row.BATCH_CODE),
    text(row.BATCH_DESC),
    text(row.MAIN_SIZE_GROUP_CODE),
    text(row.MAIN_SIZE_GROUP_DESC),
    text(row.ORDER_SIZE_GROUP_CODE),
    text(row.ORDER_SIZE_GROUP_DESC),
    text(row.SPEC_RANGE),
    numberValue(row.PRICE_TAG),
    text(row.UNIT_CODE),
    text(row.UNIT_DESC),
    text(row.FABRIC_TYPE_CODE),
    text(row.FABRIC_TYPE_DESC),
    text(row.FABRIC),
    text(row.COMPOSITION),
    text(row.LINING_MATERIAL),
    text(row.WASH_LABEL_INGR),
    text(row.STATUS_CODE),
    text(row.STATUS_DESC),
    text(row.ENABLE_STATUS),
    text(row.DATA_STATUS),
    text(row.APPROVE_STATUS),
    text(row.PIC_URL),
    text(row.DESIGNER),
    text(row.SOURCE_MDM_ID ?? row.ID),
    text(row.SOURCE_FORM_ID ?? row.FORM_CODE),
    text(row.CREATION_DATE),
    text(row.LAST_UPDATE_DATE),
    text(row.ENABLED_DATE),
    text(row.DISABLED_DATE),
    json(langRows(row)),
    json(row),
    sourceHash(row),
    syncBatchId,
    syncedAt,
    updatedAt,
    text(row.SHEIN_SPU_CODE),
    text(row.SHEIN_CATEGORY_NAME),
    text(row.OLD_ARTICLE_NUMBER),
    text(row.DEEPDRAW_INFO_STATUS),
    text(row.LISTING_TITLE_CN),
    text(row.LISTING_TITLE_EN),
    text(row.VERSION_NUMBER),
    text(row.MODEL_CODE),
    text(row.MODEL_DESC),
    text(row.LENGTH_CODE),
    text(row.LENGTH_DESC),
    text(row.PRICE_RANGE_CODE),
    text(row.PRICE_RANGE_DESC),
    text(row.PRODUCT_POSITIONING_CODE),
    text(row.PRODUCT_POSITIONING_DESC ?? row.RODUCT_POSITIONING_DESC),
    text(row.PURC_GROUP_CODE),
    text(row.PURC_GROUP_DESC),
    text(row.PURC_PATT_CODE),
    text(row.PURC_PATT_DESC),
    text(row.SCENE_CODE),
    text(row.SCENE_DESC),
    text(row.IS_CONTINUE_CODE),
    text(row.IS_CONTINUE_DESC),
    text(row.IS_IP_CODE),
    text(row.IS_IP_DESC),
    text(row.IS_MENTAL_PRODUCTS_CODE),
    text(row.IS_MENTAL_PRODUCTS_DESC),
    text(row.IS_UNI_SIZE_CODE),
    text(row.IS_UNI_SIZE_DESC),
    text(zhLang.CHANNEL_LEVEL ?? row.CHANNEL_LEVEL),
    text(zhLang.FILLER ?? row.FILLER),
    text(zhLang.SPU_GROUP ?? row.SPU_GROUP),
    text(row.CREATED_BY),
    text(row.LAST_UPDATED_BY),
  ];
}

function prepareStatements(db) {
  return {
    spu: db.prepare(`
      insert into product_spu (
        spu_code, spu_name, spu_name_en, brand_code, brand_name, year,
        season_code, season_name, product_chain_code, product_chain_name,
        product_line_code, product_line_name, product_type_code, product_type_name,
        middle_class_code, middle_class_name, subclass_code, subclass_name,
        gender_code, gender_name, age_group_code, age_group_name,
        article_prop_code, article_prop_name, batch_code, batch_name,
        main_size_group_code, main_size_group_name, order_size_group_code,
        order_size_group_name, spec_range, price_tag, unit_code, unit_name,
        fabric_type_code, fabric_type_name, fabric, composition, lining_material,
        wash_label_ingr, status_code, status_name, enable_status, data_status,
        approve_status, pic_url, designer, source_mdm_id, source_form_id,
        creation_date, last_update_date, enabled_date, disabled_date,
        multi_lang_json, raw_payload_json, source_hash, sync_batch_id,
        synced_at, updated_at, shein_spu_code, shein_category_name,
        old_style_code, deepdraw_info_status, listing_title_cn, listing_title_en,
        version_number, model_code, model_name, length_code, length_name,
        price_range_code, price_range_name, product_positioning_code,
        product_positioning_name, purchase_group_code, purchase_group_name,
        purchase_pattern_code, purchase_pattern_name, scene_code, scene_name,
        is_continue_code, is_continue_name, is_ip_code, is_ip_name,
        is_mental_products_code, is_mental_products_name, is_uni_size_code,
        is_uni_size_name, channel_level, filler, spu_group, created_by,
        last_updated_by
      )
      values (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?
      )
      on conflict(spu_code)
      do update set
        spu_name = excluded.spu_name,
        spu_name_en = excluded.spu_name_en,
        brand_code = excluded.brand_code,
        brand_name = excluded.brand_name,
        year = excluded.year,
        season_code = excluded.season_code,
        season_name = excluded.season_name,
        product_chain_code = excluded.product_chain_code,
        product_chain_name = excluded.product_chain_name,
        product_line_code = excluded.product_line_code,
        product_line_name = excluded.product_line_name,
        product_type_code = excluded.product_type_code,
        product_type_name = excluded.product_type_name,
        middle_class_code = excluded.middle_class_code,
        middle_class_name = excluded.middle_class_name,
        subclass_code = excluded.subclass_code,
        subclass_name = excluded.subclass_name,
        gender_code = excluded.gender_code,
        gender_name = excluded.gender_name,
        age_group_code = excluded.age_group_code,
        age_group_name = excluded.age_group_name,
        article_prop_code = excluded.article_prop_code,
        article_prop_name = excluded.article_prop_name,
        batch_code = excluded.batch_code,
        batch_name = excluded.batch_name,
        main_size_group_code = excluded.main_size_group_code,
        main_size_group_name = excluded.main_size_group_name,
        order_size_group_code = excluded.order_size_group_code,
        order_size_group_name = excluded.order_size_group_name,
        spec_range = excluded.spec_range,
        price_tag = excluded.price_tag,
        unit_code = excluded.unit_code,
        unit_name = excluded.unit_name,
        fabric_type_code = excluded.fabric_type_code,
        fabric_type_name = excluded.fabric_type_name,
        fabric = excluded.fabric,
        composition = excluded.composition,
        lining_material = excluded.lining_material,
        wash_label_ingr = excluded.wash_label_ingr,
        status_code = excluded.status_code,
        status_name = excluded.status_name,
        enable_status = excluded.enable_status,
        data_status = excluded.data_status,
        approve_status = excluded.approve_status,
        pic_url = excluded.pic_url,
        designer = excluded.designer,
        source_mdm_id = excluded.source_mdm_id,
        source_form_id = excluded.source_form_id,
        creation_date = excluded.creation_date,
        last_update_date = excluded.last_update_date,
        enabled_date = excluded.enabled_date,
        disabled_date = excluded.disabled_date,
        multi_lang_json = excluded.multi_lang_json,
        raw_payload_json = excluded.raw_payload_json,
        source_hash = excluded.source_hash,
        sync_batch_id = excluded.sync_batch_id,
        synced_at = excluded.synced_at,
        updated_at = excluded.updated_at,
        old_style_code = excluded.old_style_code,
        version_number = excluded.version_number,
        model_code = excluded.model_code,
        model_name = excluded.model_name,
        length_code = excluded.length_code,
        length_name = excluded.length_name,
        price_range_code = excluded.price_range_code,
        price_range_name = excluded.price_range_name,
        product_positioning_code = excluded.product_positioning_code,
        product_positioning_name = excluded.product_positioning_name,
        purchase_group_code = excluded.purchase_group_code,
        purchase_group_name = excluded.purchase_group_name,
        purchase_pattern_code = excluded.purchase_pattern_code,
        purchase_pattern_name = excluded.purchase_pattern_name,
        scene_code = excluded.scene_code,
        scene_name = excluded.scene_name,
        is_continue_code = excluded.is_continue_code,
        is_continue_name = excluded.is_continue_name,
        is_ip_code = excluded.is_ip_code,
        is_ip_name = excluded.is_ip_name,
        is_mental_products_code = excluded.is_mental_products_code,
        is_mental_products_name = excluded.is_mental_products_name,
        is_uni_size_code = excluded.is_uni_size_code,
        is_uni_size_name = excluded.is_uni_size_name,
        channel_level = excluded.channel_level,
        filler = excluded.filler,
        spu_group = excluded.spu_group,
        created_by = excluded.created_by,
        last_updated_by = excluded.last_updated_by
      returning id
    `),
    skc: db.prepare(`
      insert into product_skc (
        spu_id, skc_code, skc_name, skc_name_en, color_code, color_name,
        price_tag, status_code, status_name, enable_status, data_status,
        approve_status, pic_url, source_mdm_id, source_form_id, creation_date,
        last_update_date, enabled_date, disabled_date, multi_lang_json,
        raw_payload_json, source_hash, sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(skc_code)
      do update set
        spu_id = excluded.spu_id,
        skc_name = excluded.skc_name,
        skc_name_en = excluded.skc_name_en,
        color_code = excluded.color_code,
        color_name = excluded.color_name,
        price_tag = excluded.price_tag,
        status_code = excluded.status_code,
        status_name = excluded.status_name,
        enable_status = excluded.enable_status,
        data_status = excluded.data_status,
        approve_status = excluded.approve_status,
        pic_url = excluded.pic_url,
        source_mdm_id = excluded.source_mdm_id,
        source_form_id = excluded.source_form_id,
        creation_date = excluded.creation_date,
        last_update_date = excluded.last_update_date,
        enabled_date = excluded.enabled_date,
        disabled_date = excluded.disabled_date,
        multi_lang_json = excluded.multi_lang_json,
        raw_payload_json = excluded.raw_payload_json,
        source_hash = excluded.source_hash,
        sync_batch_id = excluded.sync_batch_id,
        synced_at = excluded.synced_at,
        updated_at = excluded.updated_at
      returning id
    `),
    sku: db.prepare(`
      insert into product_sku (
        skc_id, sku_code, sku_name, sku_name_en, supplier_product_code,
        inner_code, ean_code, size_code, size_name, color_code, color_name,
        price_tag, status_code, status_name, enable_status, data_status,
        approve_status, pic_url, source_mdm_id, source_form_id, creation_date,
        last_update_date, enabled_date, disabled_date, multi_lang_json,
        raw_payload_json, source_hash, sync_batch_id, synced_at, updated_at,
        brand_code, brand_name, year, season_code, season_name, is_ip_code,
        is_ip_name, created_by, last_updated_by
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(sku_code)
      do update set
        skc_id = excluded.skc_id,
        sku_name = excluded.sku_name,
        sku_name_en = excluded.sku_name_en,
        supplier_product_code = excluded.supplier_product_code,
        inner_code = excluded.inner_code,
        ean_code = excluded.ean_code,
        size_code = excluded.size_code,
        size_name = excluded.size_name,
        color_code = excluded.color_code,
        color_name = excluded.color_name,
        price_tag = excluded.price_tag,
        status_code = excluded.status_code,
        status_name = excluded.status_name,
        enable_status = excluded.enable_status,
        data_status = excluded.data_status,
        approve_status = excluded.approve_status,
        pic_url = excluded.pic_url,
        source_mdm_id = excluded.source_mdm_id,
        source_form_id = excluded.source_form_id,
        creation_date = excluded.creation_date,
        last_update_date = excluded.last_update_date,
        enabled_date = excluded.enabled_date,
        disabled_date = excluded.disabled_date,
        multi_lang_json = excluded.multi_lang_json,
        raw_payload_json = excluded.raw_payload_json,
        source_hash = excluded.source_hash,
        sync_batch_id = excluded.sync_batch_id,
        synced_at = excluded.synced_at,
        updated_at = excluded.updated_at,
        brand_code = excluded.brand_code,
        brand_name = excluded.brand_name,
        year = excluded.year,
        season_code = excluded.season_code,
        season_name = excluded.season_name,
        is_ip_code = excluded.is_ip_code,
        is_ip_name = excluded.is_ip_name,
        created_by = excluded.created_by,
        last_updated_by = excluded.last_updated_by
    `),
  };
}

function groupSkuRowsBySkc(skuRows, fallbackSpuCode) {
  const groups = new Map();
  for (const row of skuRows) {
    const skcCode = text(row.SKC_CODE) ?? `${text(row.MDM_CODE) ?? fallbackSpuCode}:${text(row.COLOR_CODE) ?? text(row.COLOR_DESC) ?? "default"}`;
    if (!groups.has(skcCode)) groups.set(skcCode, []);
    groups.get(skcCode).push(row);
  }
  return groups;
}

function representativeSku(rows) {
  return [...rows].sort((a, b) => {
    const at = Date.parse(a.LAST_UPDATE_DATE ?? "") || 0;
    const bt = Date.parse(b.LAST_UPDATE_DATE ?? "") || 0;
    return bt - at;
  })[0];
}

function upsertSkc(stmt, { spuId, skcCode, skuRows, syncBatchId, syncedAt, updatedAt }) {
  const row = representativeSku(skuRows);
  const skcName = localized(row, "SKC_NAME");
  return stmt.get(
    spuId,
    skcCode,
    skcName.cn ?? text(row.SKC_NAME),
    skcName.en,
    text(row.COLOR_CODE),
    text(row.COLOR_DESC),
    numberValue(row.PRICE_TAG),
    text(row.STATUS_CODE),
    text(row.STATUS_DESC),
    text(row.ENABLE_STATUS),
    text(row.DATA_STATUS),
    text(row.APPROVE_STATUS),
    text(row.PIC_URL),
    text(row.SOURCE_MDM_ID ?? row.ID),
    text(row.FORM_CODE),
    text(row.CREATION_DATE),
    text(row.LAST_UPDATE_DATE),
    text(row.ENABLED_DATE),
    text(row.DISABLED_DATE),
    json(langRows(row)),
    json({ skcCode, rows: skuRows }),
    sourceHash({ skcCode, rows: skuRows }),
    syncBatchId,
    syncedAt,
    updatedAt,
  ).id;
}

function upsertSku(stmt, { skcId, row, syncBatchId, syncedAt, updatedAt }) {
  const skuName = localized(row, "SKU_NAME");
  stmt.run(
    skcId,
    text(row.SKU_CODE),
    skuName.cn ?? text(row.SKU_NAME),
    skuName.en,
    text(row.SUPPLIER_PRODUCT_CODE),
    text(row.INNER_CODE),
    text(row.EAN_CODE),
    text(row.SIZE_CODE),
    text(row.SIZE_DESC),
    text(row.COLOR_CODE),
    text(row.COLOR_DESC),
    numberValue(row.PRICE_TAG),
    text(row.STATUS_CODE),
    text(row.STATUS_DESC),
    text(row.ENABLE_STATUS),
    text(row.DATA_STATUS),
    text(row.APPROVE_STATUS),
    text(row.PIC_URL),
    text(row.SOURCE_MDM_ID ?? row.ID),
    text(row.FORM_CODE),
    text(row.CREATION_DATE),
    text(row.LAST_UPDATE_DATE),
    text(row.ENABLED_DATE),
    text(row.DISABLED_DATE),
    json(langRows(row)),
    json(row),
    sourceHash(row),
    syncBatchId,
    syncedAt,
    updatedAt,
    text(row.BRAND_CODE),
    text(row.BRAND_DESC),
    text(row.YEAR),
    text(row.SEASON_CODE),
    text(row.SEASON_DESC),
    text(row.IS_IP_CODE),
    text(row.IS_IP_DESC),
    text(row.CREATED_BY),
    text(row.LAST_UPDATED_BY),
  );
}

export function importMdmProductRows(db, {
  spuCode,
  spuRows = [],
  skuRows = [],
  manifest = {},
  syncedAt = currentIso(),
} = {}) {
  const normalizedSpuCode = text(spuCode) ?? text(spuRows[0]?.MDM_CODE) ?? text(skuRows[0]?.MDM_CODE);
  if (!normalizedSpuCode) {
    throw new Error("spuCode is required");
  }

  const statements = prepareStatements(db);
  const updatedAt = currentIso();
  return runInTransaction(db, () => {
    const syncBatchId = upsertSyncBatch(db, {
      spuCode: normalizedSpuCode,
      manifest,
      syncedAt,
    });

    let spuId = null;
    let spuCount = 0;
    for (const row of array(spuRows).filter((item) => text(item?.MDM_CODE))) {
      spuId = statements.spu.get(...mapSpu(row, syncBatchId, syncedAt, updatedAt)).id;
      spuCount += 1;
    }

    if (!spuId) {
      const existing = db.prepare("select id from product_spu where spu_code = ?").get(normalizedSpuCode);
      spuId = existing?.id ?? null;
    }

    if (!spuId && skuRows.length) {
      throw new Error(`Cannot import SKU rows without an SPU row for ${normalizedSpuCode}`);
    }

    let skcCount = 0;
    let skuCount = 0;
    if (spuId) {
      for (const [skcCode, rows] of groupSkuRowsBySkc(array(skuRows), normalizedSpuCode)) {
        const skcId = upsertSkc(statements.skc, {
          spuId,
          skcCode,
          skuRows: rows,
          syncBatchId,
          syncedAt,
          updatedAt,
        });
        skcCount += 1;
        for (const row of rows.filter((item) => text(item?.SKU_CODE))) {
          upsertSku(statements.sku, {
            skcId,
            row,
            syncBatchId,
            syncedAt,
            updatedAt,
          });
          skuCount += 1;
        }
      }
    }

    return {
      syncBatchId,
      spuCode: normalizedSpuCode,
      counts: {
        spu: spuCount,
        skc: skcCount,
        sku: skuCount,
      },
    };
  });
}
