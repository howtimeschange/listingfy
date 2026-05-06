#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { getDatabaseConfig } from "./lib/database_config.mjs";
import { boolInt, json } from "./lib/db_helpers.mjs";
import { loadLocalEnv } from "./lib/local_env.mjs";
import { applyPostgresMigrations, createPostgresPool, SyncPostgresDatabase } from "./lib/postgres_db.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv({ cwd: PROJECT_ROOT });
const LATEST_MANIFEST_PATH = path.join(PROJECT_ROOT, "data", "shein-metadata", "latest-manifest.json");

function parseArgs(argv) {
  const args = {
    databaseUrl: process.env.DATABASE_URL,
    sourceDir: null,
    platform: "SHEIN",
    skipAttributeValues: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--source") args.sourceDir = next();
    else if (arg === "--platform") args.platform = next();
    else if (arg === "--skip-attribute-values") args.skipAttributeValues = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.platform = args.platform.trim().toUpperCase();
  return args;
}

function usage() {
  process.stdout.write(`Import SHEIN metadata into local database

Options:
  --source <dir>                 Metadata directory. Default: latest manifest output.
  --database-url <url>           PostgreSQL connection URL. Default: DATABASE_URL.
  --platform <name>              Platform key. Default: SHEIN
  --skip-attribute-values        Import attributes but skip full enum values.

Examples:
  npm run shein:metadata:import
  npm run shein:metadata:import -- --source data/shein-metadata/20260424T113417Z
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveSourceDir(sourceDir) {
  if (sourceDir) return path.resolve(sourceDir);
  if (!fs.existsSync(LATEST_MANIFEST_PATH)) {
    throw new Error(`Missing latest manifest: ${LATEST_MANIFEST_PATH}`);
  }
  const latest = readJson(LATEST_MANIFEST_PATH);
  if (latest.files?.manifest) {
    return path.dirname(path.resolve(PROJECT_ROOT, latest.files.manifest));
  }
  throw new Error("latest-manifest.json does not contain files.manifest");
}

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing metadata file: ${filePath}`);
  }
}

function metadataFiles(sourceDir) {
  const files = {
    manifest: path.join(sourceDir, "manifest.json"),
    storeInfo: path.join(sourceDir, "store-info.json"),
    siteList: path.join(sourceDir, "site-list.json"),
    storePublishStandard: path.join(sourceDir, "store-publish-standard.json"),
    categoriesFlat: path.join(sourceDir, "categories.flat.jsonl"),
    publishStandards: path.join(sourceDir, "publish-standards.jsonl"),
    attributeTemplates: path.join(sourceDir, "attribute-templates.jsonl"),
    requiredAttributes: path.join(sourceDir, "required-attributes.jsonl"),
  };
  Object.values(files).forEach(assertFileExists);
  return files;
}

async function readJsonl(filePath, onRow) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    count += 1;
    onRow(JSON.parse(line), count);
  }
  return count;
}

function currentIso() {
  return new Date().toISOString();
}

function infoPayload(payload) {
  return payload?.info ?? payload ?? {};
}

function upsertSyncBatch(db, { sourceDir, manifest }) {
  const batchNo = path.basename(sourceDir);
  const counts = manifest.counts || {};
  const successCount = (
    (counts.all_categories || 0)
    + (counts.publish_standards_synced || 0)
    + (counts.attribute_templates_synced || 0)
    + (counts.required_attribute_rows || 0)
  );
  const failedCount = manifest.failures_count || 0;
  const totalCount = successCount + failedCount;

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
    "SHEIN",
    "metadata",
    batchNo,
    failedCount > 0 ? "PARTIAL" : "SUCCESS",
    manifest.started_at || null,
    manifest.finished_at || null,
    sourceDir,
    totalCount,
    successCount,
    failedCount,
    json(manifest),
  );

  return row.id;
}

function prepareStatements(db) {
  return {
    storeMetadata: db.prepare(`
      insert into channel_store_metadata(platform, metadata_key, sync_batch_id, payload_json, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(platform, metadata_key)
      do update set
        sync_batch_id = excluded.sync_batch_id,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `),
    category: db.prepare(`
      insert into channel_category (
        platform, category_id, product_type_id, parent_category_id, category_name,
        root_category_id, root_category_name, level, path, last_category,
        sync_batch_id, raw_payload_json, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(platform, category_id)
      do update set
        product_type_id = excluded.product_type_id,
        parent_category_id = excluded.parent_category_id,
        category_name = excluded.category_name,
        root_category_id = excluded.root_category_id,
        root_category_name = excluded.root_category_name,
        level = excluded.level,
        path = excluded.path,
        last_category = excluded.last_category,
        sync_batch_id = excluded.sync_batch_id,
        raw_payload_json = excluded.raw_payload_json,
        updated_at = excluded.updated_at
    `),
    publishStandard: db.prepare(`
      insert into channel_publish_standard (
        platform, standard_scope, category_id, product_type_id, default_language,
        currency, support_sale_attribute_sort, trace_id, fill_in_standard_json,
        picture_config_json, raw_payload_json, sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(platform, standard_scope, category_id)
      do update set
        product_type_id = excluded.product_type_id,
        default_language = excluded.default_language,
        currency = excluded.currency,
        support_sale_attribute_sort = excluded.support_sale_attribute_sort,
        trace_id = excluded.trace_id,
        fill_in_standard_json = excluded.fill_in_standard_json,
        picture_config_json = excluded.picture_config_json,
        raw_payload_json = excluded.raw_payload_json,
        sync_batch_id = excluded.sync_batch_id,
        updated_at = excluded.updated_at
    `),
    deletePublishField: db.prepare(`
      delete from channel_publish_field
      where platform = ? and standard_scope = ? and category_id = ?
    `),
    publishField: db.prepare(`
      insert into channel_publish_field (
        platform, standard_scope, category_id, product_type_id, module,
        field_key, required, show, sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deletePictureConfig: db.prepare(`
      delete from channel_picture_config
      where platform = ? and standard_scope = ? and category_id = ?
    `),
    pictureConfig: db.prepare(`
      insert into channel_picture_config (
        platform, standard_scope, category_id, product_type_id, field_key,
        is_true, sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteAttributes: db.prepare(`
      delete from channel_attribute
      where platform = ? and product_type_id = ?
    `),
    deleteAttributeValues: db.prepare(`
      delete from channel_attribute_value
      where platform = ? and product_type_id = ?
    `),
    attributeTemplate: db.prepare(`
      insert into channel_attribute_template (
        platform, product_type_id, attr_count, required_count, sale_attributes_json,
        attribute_infos_json, raw_payload_json, sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(platform, product_type_id)
      do update set
        attr_count = excluded.attr_count,
        required_count = excluded.required_count,
        sale_attributes_json = excluded.sale_attributes_json,
        attribute_infos_json = excluded.attribute_infos_json,
        raw_payload_json = excluded.raw_payload_json,
        sync_batch_id = excluded.sync_batch_id,
        updated_at = excluded.updated_at
    `),
    attribute: db.prepare(`
      insert into channel_attribute (
        platform, product_type_id, attribute_id, attribute_name, attribute_name_en,
        attribute_type, attribute_label, attribute_mode, attribute_status,
        attribute_input_num, data_dimension, values_count, is_required,
        is_sale_attribute, is_size_attribute, values_json, raw_payload_json,
        sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    attributeValue: db.prepare(`
      insert or replace into channel_attribute_value (
        platform, product_type_id, attribute_id, attribute_value_id,
        attribute_value, attribute_value_en, is_custom_attribute_value,
        is_show, is_black, color, raw_payload_json, sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteRequiredAttributes: db.prepare(`
      delete from channel_required_attribute
      where platform = ?
    `),
    requiredAttribute: db.prepare(`
      insert or replace into channel_required_attribute (
        platform, category_id, product_type_id, attribute_id, attribute_name,
        attribute_name_en, attribute_type, attribute_label, attribute_mode,
        attribute_status, attribute_input_num, values_count, sample_values_json,
        sync_batch_id, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  };
}

function importStoreMetadata(statements, platform, batchId, files) {
  const now = currentIso();
  const docs = [
    ["store-info", readJson(files.storeInfo)],
    ["site-list", readJson(files.siteList)],
    ["store-publish-standard", readJson(files.storePublishStandard)],
  ];

  for (const [key, payload] of docs) {
    statements.storeMetadata.run(platform, key, batchId, json(payload), now);
  }

  return docs.length;
}

function upsertPublishStandard(statements, {
  platform,
  scope,
  categoryId = 0,
  productTypeId = null,
  info,
  traceId = null,
  rawPayload,
  batchId,
}) {
  const now = currentIso();
  const fields = info.fill_in_standard_list || [];
  const pictureConfig = info.picture_config_list || [];

  statements.publishStandard.run(
    platform,
    scope,
    categoryId,
    productTypeId,
    info.default_language || null,
    info.currency || null,
    info.support_sale_attribute_sort == null ? null : boolInt(info.support_sale_attribute_sort),
    traceId,
    json(fields),
    json(pictureConfig),
    json(rawPayload),
    batchId,
    now,
  );

  statements.deletePublishField.run(platform, scope, categoryId);
  for (const field of fields) {
    statements.publishField.run(
      platform,
      scope,
      categoryId,
      productTypeId,
      field.module || "",
      field.field_key || "",
      boolInt(field.required),
      boolInt(field.show),
      batchId,
      now,
    );
  }

  statements.deletePictureConfig.run(platform, scope, categoryId);
  for (const item of pictureConfig) {
    statements.pictureConfig.run(
      platform,
      scope,
      categoryId,
      productTypeId,
      item.field_key || "",
      boolInt(item.is_true),
      batchId,
      now,
    );
  }

  return {
    fields: fields.length,
    pictureConfigs: pictureConfig.length,
  };
}

async function importCategories(statements, { platform, batchId, files }) {
  const now = currentIso();
  return readJsonl(files.categoriesFlat, (row) => {
    statements.category.run(
      platform,
      row.category_id,
      row.product_type_id || 0,
      row.parent_category_id ?? null,
      row.category_name,
      row.root_category_id ?? null,
      row.root_category_name ?? null,
      row.level,
      row.path,
      boolInt(row.last_category),
      batchId,
      json(row),
      now,
    );
  });
}

async function importPublishStandards(statements, { platform, batchId, files }) {
  const storeStandardPayload = readJson(files.storePublishStandard);
  const storeStats = upsertPublishStandard(statements, {
    platform,
    scope: "store",
    categoryId: 0,
    productTypeId: null,
    info: infoPayload(storeStandardPayload),
    traceId: storeStandardPayload.traceId || null,
    rawPayload: storeStandardPayload,
    batchId,
  });

  const stats = {
    publishStandards: 1,
    publishFields: storeStats.fields,
    pictureConfigs: storeStats.pictureConfigs,
  };

  await readJsonl(files.publishStandards, (row, count) => {
    const rowStats = upsertPublishStandard(statements, {
      platform,
      scope: "category",
      categoryId: row.category_id,
      productTypeId: row.product_type_id || null,
      info: row.info || {},
      traceId: row.traceId || null,
      rawPayload: row,
      batchId,
    });

    stats.publishStandards += 1;
    stats.publishFields += rowStats.fields;
    stats.pictureConfigs += rowStats.pictureConfigs;

    if (count % 200 === 0) {
      process.stderr.write(`  publish standards imported ${count}\n`);
    }
  });

  return stats;
}

function isSizeAttribute(attribute) {
  const name = attribute.attribute_name || "";
  const nameEn = attribute.attribute_name_en || "";
  return attribute.attribute_type === 2 || name === "尺寸" || nameEn.toLowerCase() === "size";
}

function compactAttribute(attribute) {
  const {
    attribute_value_info_list: values,
    ...rest
  } = attribute;
  return {
    ...rest,
    attribute_value_count: (values || []).length,
  };
}

function compactTemplateRow(row) {
  return {
    product_type_id: row.product_type_id,
    category_refs: row.category_refs || [],
    traceId: row.traceId || null,
    attr_count: row.attr_count || 0,
    required_count: row.required_count || 0,
    sale_attributes: row.sale_attributes || [],
    attribute_infos: (row.attribute_infos || []).map(compactAttribute),
  };
}

async function importAttributeTemplates(statements, {
  platform,
  batchId,
  files,
  skipAttributeValues,
}) {
  const stats = {
    attributeTemplates: 0,
    attributes: 0,
    attributeValues: 0,
  };

  await readJsonl(files.attributeTemplates, (row, count) => {
    const productTypeId = row.product_type_id;
    const attributes = row.attribute_infos || [];
    const now = currentIso();

    statements.deleteAttributeValues.run(platform, productTypeId);
    statements.deleteAttributes.run(platform, productTypeId);

    statements.attributeTemplate.run(
      platform,
      productTypeId,
      row.attr_count || attributes.length,
      row.required_count || attributes.filter((item) => item.attribute_status === 3).length,
      json(row.sale_attributes || []),
      json(attributes.map(compactAttribute)),
      json(compactTemplateRow(row)),
      batchId,
      now,
    );
    stats.attributeTemplates += 1;

    for (const attribute of attributes) {
      const values = attribute.attribute_value_info_list || [];
      statements.attribute.run(
        platform,
        productTypeId,
        attribute.attribute_id,
        attribute.attribute_name || "",
        attribute.attribute_name_en || null,
        attribute.attribute_type ?? null,
        attribute.attribute_label ?? null,
        attribute.attribute_mode ?? null,
        attribute.attribute_status ?? null,
        attribute.attribute_input_num ?? null,
        attribute.data_dimension ?? null,
        values.length,
        boolInt(attribute.attribute_status === 3),
        boolInt(attribute.attribute_type === 1),
        boolInt(isSizeAttribute(attribute)),
        json([]),
        json(compactAttribute(attribute)),
        batchId,
        now,
      );
      stats.attributes += 1;

      if (!skipAttributeValues) {
        for (const value of values) {
          if (value.attribute_value_id == null) continue;
          statements.attributeValue.run(
            platform,
            productTypeId,
            attribute.attribute_id,
            value.attribute_value_id,
            value.attribute_value || "",
            value.attribute_value_en || null,
            value.is_custom_attribute_value == null ? null : boolInt(value.is_custom_attribute_value),
            value.is_show ?? null,
            value.is_black ?? null,
            value.color || null,
            json({}),
            batchId,
            now,
          );
          stats.attributeValues += 1;
        }
      }
    }

    if (count % 100 === 0) {
      process.stderr.write(`  attribute templates imported ${count}\n`);
    }
  });

  return stats;
}

async function importRequiredAttributes(statements, { platform, batchId, files }) {
  let rows = 0;
  statements.deleteRequiredAttributes.run(platform);

  await readJsonl(files.requiredAttributes, (row, count) => {
    const categoryRefs = row.category_refs || [];
    const now = currentIso();
    for (const category of categoryRefs) {
      statements.requiredAttribute.run(
        platform,
        category.category_id,
        row.product_type_id,
        row.attribute_id,
        row.attribute_name || "",
        row.attribute_name_en || null,
        row.attribute_type ?? null,
        row.attribute_label ?? null,
        row.attribute_mode ?? null,
        row.attribute_status ?? null,
        row.attribute_input_num ?? null,
        row.values_count || 0,
        json(row.sample_values || []),
        batchId,
        now,
      );
      rows += 1;
    }

    if (count % 2000 === 0) {
      process.stderr.write(`  required attributes imported ${count}\n`);
    }
  });

  return rows;
}

function tableCount(db, tableName) {
  return db.prepare(`select count(*) as count from ${tableName}`).get().count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const sourceDir = resolveSourceDir(args.sourceDir);
  const files = metadataFiles(sourceDir);
  const manifest = readJson(files.manifest);
  const config = getDatabaseConfig({
    ...process.env,
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: args.databaseUrl,
    DB_MIGRATIONS_DIR: path.join(PROJECT_ROOT, "db", "migrations"),
  });
  const pool = createPostgresPool(config.url);
  const applied = await applyPostgresMigrations(pool, config.migrationsDir);
  await pool.end();
  const db = new SyncPostgresDatabase(config.url);
  const statements = prepareStatements(db);

  const summary = {
    database_url: config.url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@"),
    source_dir: sourceDir,
    platform: args.platform,
    migrations_applied: applied,
    imported: {},
    table_counts: {},
  };

  process.stderr.write(`Importing SHEIN metadata from ${sourceDir}\n`);
  try {
    db.transaction(() => {
      const batchId = upsertSyncBatch(db, { sourceDir, manifest });
      summary.sync_batch_id = batchId;

      summary.imported.store_metadata = importStoreMetadata(statements, args.platform, batchId, files);
    })();
    const batchId = summary.sync_batch_id;
    summary.imported.categories = await importCategories(statements, {
      platform: args.platform,
      batchId,
      files,
    });
    Object.assign(summary.imported, await importPublishStandards(statements, {
      platform: args.platform,
      batchId,
      files,
    }));
    Object.assign(summary.imported, await importAttributeTemplates(statements, {
      platform: args.platform,
      batchId,
      files,
      skipAttributeValues: args.skipAttributeValues,
    }));
    summary.imported.requiredAttributes = await importRequiredAttributes(statements, {
      platform: args.platform,
      batchId,
      files,
    });

    db.exec("analyze");
  } catch (error) {
    db.close();
    throw error;
  }

  for (const table of [
    "sync_batch",
    "channel_store_metadata",
    "channel_category",
    "channel_publish_standard",
    "channel_publish_field",
    "channel_picture_config",
    "channel_attribute_template",
    "channel_attribute",
    "channel_attribute_value",
    "channel_required_attribute",
  ]) {
    summary.table_counts[table] = tableCount(db, table);
  }

  db.close();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
