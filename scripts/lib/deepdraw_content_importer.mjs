import path from "node:path";
import { boolInt, json, runInTransaction } from "./sqlite_db.mjs";
import { extractDeepdrawContentRows } from "./deepdraw_content_model.mjs";

function currentIso() {
  return new Date().toISOString();
}

function upsertSyncBatch(db, { sourceDir, manifest }) {
  const counts = manifest?.counts || {};
  const successCount = counts.success || 0;
  const failedCount = counts.failed || 0;
  const totalCount = counts.requested || successCount + failedCount;
  const batchNo = path.basename(sourceDir || "manual");
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
      source_dir = excluded.source_dir,
      total_count = excluded.total_count,
      success_count = excluded.success_count,
      failed_count = excluded.failed_count,
      manifest_json = excluded.manifest_json
    returning id
  `).get(
    "DEEPDRAW",
    "content_package",
    batchNo,
    failedCount > 0 ? "PARTIAL" : "SUCCESS",
    manifest?.started_at || null,
    manifest?.finished_at || null,
    sourceDir || null,
    totalCount,
    successCount,
    failedCount,
    json(manifest || {}),
  );
  return row.id;
}

function prepareStatements(db) {
  return {
    package: db.prepare(`
      insert into product_content_package (
        source_system, source_code, spu_code, deepdraw_product_id, deepdraw_body_id,
        title, brand_name, category_id, category_name, trade_path, retail_price,
        primary_color, version, complete, create_date, last_update_date, onsale_date,
        places_json, colors_json, sizes_json, response_code, response_text, reason,
        request_id, raw_payload_json, raw_response_json, source_hash, sync_batch_id,
        synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(source_system, source_code)
      do update set
        spu_code = excluded.spu_code,
        deepdraw_product_id = excluded.deepdraw_product_id,
        deepdraw_body_id = excluded.deepdraw_body_id,
        title = excluded.title,
        brand_name = excluded.brand_name,
        category_id = excluded.category_id,
        category_name = excluded.category_name,
        trade_path = excluded.trade_path,
        retail_price = excluded.retail_price,
        primary_color = excluded.primary_color,
        version = excluded.version,
        complete = excluded.complete,
        create_date = excluded.create_date,
        last_update_date = excluded.last_update_date,
        onsale_date = excluded.onsale_date,
        places_json = excluded.places_json,
        colors_json = excluded.colors_json,
        sizes_json = excluded.sizes_json,
        response_code = excluded.response_code,
        response_text = excluded.response_text,
        reason = excluded.reason,
        request_id = excluded.request_id,
        raw_payload_json = excluded.raw_payload_json,
        raw_response_json = excluded.raw_response_json,
        source_hash = excluded.source_hash,
        sync_batch_id = excluded.sync_batch_id,
        synced_at = excluded.synced_at,
        updated_at = excluded.updated_at
      returning id
    `),
    deleteAssets: db.prepare("delete from product_asset where content_package_id = ?"),
    deleteFields: db.prepare("delete from product_content_field where content_package_id = ?"),
    deleteSizeTableRows: db.prepare("delete from product_content_size_table_row where content_package_id = ?"),
    deleteSizeTables: db.prepare("delete from product_content_size_table where content_package_id = ?"),
    deleteDetailPages: db.prepare("delete from product_content_detail_page where content_package_id = ?"),
    deleteSizes: db.prepare("delete from product_content_size where content_package_id = ?"),
    deleteSkus: db.prepare("delete from product_content_sku where content_package_id = ?"),
    deleteSkcs: db.prepare("delete from product_content_skc where content_package_id = ?"),
    skc: db.prepare(`
      insert into product_content_skc (
        content_package_id, spu_code, skc_code, color_name, color_alias, sku_count,
        raw_payload_json, source_hash, sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      returning id
    `),
    sku: db.prepare(`
      insert into product_content_sku (
        content_package_id, content_skc_id, spu_code, skc_code, sku_code, color_name,
        color_alias, size_name, size_code, barcode, seller_code, xhs_seller_code,
        vip_skc_code, price, retail_price, quantity, values_json, raw_payload_json,
        source_hash, sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    size: db.prepare(`
      insert into product_content_size (
        content_package_id, spu_code, size_name, size_code, size_alias, sort_no,
        field_id, field_name, field_type, raw_payload_json, sync_batch_id, synced_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    detailPage: db.prepare(`
      insert into product_content_detail_page (
        content_package_id, spu_code, page_index, template_name, template_width,
        active, page_time, html_page_url, image_page_url, mixed_page_url,
        screenshot_count, module_count, template_sites_json, modules_json,
        raw_payload_json, sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      returning id
    `),
    sizeTable: db.prepare(`
      insert into product_content_size_table (
        content_package_id, spu_code, table_index, field_id, field_name, field_type,
        row_count, options_json, option_aliases_json, raw_payload_json, sync_batch_id,
        synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      returning id
    `),
    sizeTableRow: db.prepare(`
      insert into product_content_size_table_row (
        size_table_id, content_package_id, spu_code, table_index, row_index,
        size_name, values_json, raw_payload_json, sync_batch_id, synced_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    field: db.prepare(`
      insert into product_content_field (
        content_package_id, spu_code, field_id, field_name, field_type, value_text,
        texts_json, options_json, option_aliases_json, is_key, raw_payload_json,
        sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    asset: db.prepare(`
      insert into product_asset (
        source_system, source_kind, content_package_id, content_skc_id, detail_page_id,
        spu_code, skc_code, owner_type, owner_code, asset_type, place, picture_type,
        detail_page_index, module_name, module_index, source_url, normalized_url,
        file_name, deepdraw_image_id, width, height, file_size, sort_no,
        with_watermark, raw_payload_json, sync_batch_id, synced_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  };
}

function insertPackage(stmt, row, syncBatchId, updatedAt) {
  return stmt.get(
    row.sourceSystem,
    row.sourceCode,
    row.spuCode,
    row.deepdrawProductId,
    row.deepdrawBodyId,
    row.title,
    row.brandName,
    row.categoryId,
    row.categoryName,
    row.tradePath,
    row.retailPrice,
    row.primaryColor,
    row.version,
    boolInt(row.complete),
    row.createDate,
    row.lastUpdateDate,
    row.onsaleDate,
    row.placesJson,
    row.colorsJson,
    row.sizesJson,
    row.responseCode,
    row.responseText,
    row.reason,
    row.requestId,
    row.rawPayloadJson,
    row.rawResponseJson,
    row.sourceHash,
    syncBatchId,
    row.syncedAt,
    updatedAt,
  ).id;
}

function clearPackageChildren(statements, packageId) {
  statements.deleteAssets.run(packageId);
  statements.deleteFields.run(packageId);
  statements.deleteSizeTableRows.run(packageId);
  statements.deleteSizeTables.run(packageId);
  statements.deleteDetailPages.run(packageId);
  statements.deleteSizes.run(packageId);
  statements.deleteSkus.run(packageId);
  statements.deleteSkcs.run(packageId);
}

function importRows(statements, rows, { packageId, syncBatchId, updatedAt }) {
  const skcIdsByCode = new Map();
  for (const row of rows.skcs) {
    const skcId = statements.skc.get(
      packageId,
      row.spuCode,
      row.skcCode,
      row.colorName,
      row.colorAlias,
      row.skuCount,
      row.rawPayloadJson,
      row.sourceHash,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    ).id;
    skcIdsByCode.set(row.skcCode, skcId);
  }

  for (const row of rows.skus) {
    const skcId = skcIdsByCode.get(row.skcCode);
    if (!skcId) {
      throw new Error(`Missing SKC for SKU ${row.skuCode}: ${row.skcCode}`);
    }
    statements.sku.run(
      packageId,
      skcId,
      row.spuCode,
      row.skcCode,
      row.skuCode,
      row.colorName,
      row.colorAlias,
      row.sizeName,
      row.sizeCode,
      row.barcode,
      row.sellerCode,
      row.xhsSellerCode,
      row.vipSkcCode,
      row.price,
      row.retailPrice,
      row.quantity,
      row.valuesJson,
      row.rawPayloadJson,
      row.sourceHash,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    );
  }

  for (const row of rows.sizes) {
    statements.size.run(
      packageId,
      row.spuCode,
      row.sizeName,
      row.sizeCode,
      row.sizeAlias,
      row.sortNo,
      row.fieldId,
      row.fieldName,
      row.fieldType,
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    );
  }

  const detailPageIdsByIndex = new Map();
  for (const row of rows.detailPages) {
    const id = statements.detailPage.get(
      packageId,
      row.spuCode,
      row.pageIndex,
      row.templateName,
      row.templateWidth,
      row.active == null ? null : boolInt(row.active),
      row.pageTime,
      row.htmlPageUrl,
      row.imagePageUrl,
      row.mixedPageUrl,
      row.screenshotCount,
      row.moduleCount,
      row.templateSitesJson,
      row.modulesJson,
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    ).id;
    detailPageIdsByIndex.set(row.pageIndex, id);
  }

  const sizeTableIdsByIndex = new Map();
  for (const row of rows.sizeTables) {
    const id = statements.sizeTable.get(
      packageId,
      row.spuCode,
      row.tableIndex,
      row.fieldId,
      row.fieldName,
      row.fieldType,
      row.rowCount,
      row.optionsJson,
      row.optionAliasesJson,
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    ).id;
    sizeTableIdsByIndex.set(row.tableIndex, id);
  }

  for (const row of rows.sizeTableRows) {
    const sizeTableId = sizeTableIdsByIndex.get(row.tableIndex);
    if (!sizeTableId) {
      throw new Error(`Missing size table for row ${row.rowIndex}: ${row.tableIndex}`);
    }
    statements.sizeTableRow.run(
      sizeTableId,
      packageId,
      row.spuCode,
      row.tableIndex,
      row.rowIndex,
      row.sizeName,
      row.valuesJson,
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    );
  }

  for (const row of rows.fields) {
    statements.field.run(
      packageId,
      row.spuCode,
      row.fieldId,
      row.fieldName,
      row.fieldType,
      row.valueText,
      row.textsJson,
      row.optionsJson,
      row.optionAliasesJson,
      boolInt(row.isKey),
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    );
  }

  for (const row of rows.assets) {
    statements.asset.run(
      row.sourceSystem,
      row.sourceKind,
      packageId,
      row.skcCode ? skcIdsByCode.get(row.skcCode) ?? null : null,
      row.detailPageIndex ? detailPageIdsByIndex.get(row.detailPageIndex) ?? null : null,
      row.spuCode,
      row.skcCode,
      row.ownerType,
      row.ownerCode,
      row.assetType,
      row.place,
      row.pictureType,
      row.detailPageIndex,
      row.moduleName,
      row.moduleIndex,
      row.sourceUrl,
      row.normalizedUrl,
      row.fileName,
      row.deepdrawImageId,
      row.width,
      row.height,
      row.fileSize,
      row.sortNo,
      row.withWatermark == null ? null : boolInt(row.withWatermark),
      row.rawPayloadJson,
      syncBatchId,
      row.syncedAt,
      updatedAt,
    );
  }
}

function addCounts(target, rows) {
  target.packages += 1;
  target.skcs += rows.skcs.length;
  target.skus += rows.skus.length;
  target.sizes += rows.sizes.length;
  target.detailPages += rows.detailPages.length;
  target.sizeTables += rows.sizeTables.length;
  target.sizeTableRows += rows.sizeTableRows.length;
  target.fields += rows.fields.length;
  target.assets += rows.assets.length;
}

export function importDeepdrawPayloads(db, {
  payloads,
  sourceDir = null,
  manifest = {},
  syncedAt = currentIso(),
} = {}) {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error("payloads must contain at least one DeepDraw payload");
  }

  const statements = prepareStatements(db);
  const updatedAt = currentIso();
  return runInTransaction(db, () => {
    const syncBatchId = upsertSyncBatch(db, { sourceDir, manifest });
    const counts = {
      packages: 0,
      skcs: 0,
      skus: 0,
      sizes: 0,
      detailPages: 0,
      sizeTables: 0,
      sizeTableRows: 0,
      fields: 0,
      assets: 0,
    };
    const products = [];

    for (const item of payloads) {
      const rows = extractDeepdrawContentRows({
        payload: item.payload,
        productCode: item.productCode,
        syncedAt,
      });
      const packageId = insertPackage(statements.package, rows.package, syncBatchId, updatedAt);
      clearPackageChildren(statements, packageId);
      importRows(statements, rows, { packageId, syncBatchId, updatedAt });
      addCounts(counts, rows);
      products.push({
        spuCode: rows.package.spuCode,
        packageId,
        skcs: rows.skcs.length,
        skus: rows.skus.length,
        assets: rows.assets.length,
        fields: rows.fields.length,
      });
    }

    return {
      syncBatchId,
      counts,
      products,
    };
  });
}
