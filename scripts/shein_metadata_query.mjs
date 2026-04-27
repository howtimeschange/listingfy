#!/usr/bin/env node

import path from "node:path";
import { DEFAULT_DB_PATH, openDatabase } from "./lib/sqlite_db.mjs";

function parseArgs(argv) {
  const args = {
    dbPath: process.env.APP_DB_PATH || DEFAULT_DB_PATH,
    platform: "SHEIN",
    search: null,
    categoryId: null,
    productTypeId: null,
    attributeId: null,
    limit: 20,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--db") args.dbPath = next();
    else if (arg === "--platform") args.platform = next();
    else if (arg === "--search") args.search = next();
    else if (arg === "--category-id") args.categoryId = Number(next());
    else if (arg === "--product-type-id") args.productTypeId = Number(next());
    else if (arg === "--attribute-id") args.attributeId = Number(next());
    else if (arg === "--limit") args.limit = Number(next());
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (args.categoryId !== null && !Number.isInteger(args.categoryId)) {
    throw new Error("--category-id must be an integer");
  }
  if (args.productTypeId !== null && !Number.isInteger(args.productTypeId)) {
    throw new Error("--product-type-id must be an integer");
  }
  if (args.attributeId !== null && !Number.isInteger(args.attributeId)) {
    throw new Error("--attribute-id must be an integer");
  }

  args.dbPath = path.resolve(args.dbPath);
  args.platform = args.platform.trim().toUpperCase();
  return args;
}

function usage() {
  process.stdout.write(`Query imported SHEIN metadata

Options:
  --search <keyword>             Search category name/path.
  --category-id <id>             Show one category with required fields and attributes.
  --product-type-id <id>         Show one product type attribute summary.
  --attribute-id <id>            With --product-type-id, show enum values for one attribute.
  --limit <n>                    Result limit. Default: 20.
  --db <path>                    SQLite database path. Default: ${DEFAULT_DB_PATH}

Examples:
  npm run shein:metadata:query
  npm run shein:metadata:query -- --search '女童（大）T恤'
  npm run shein:metadata:query -- --category-id 2013
  npm run shein:metadata:query -- --product-type-id 9738 --attribute-id 87
`);
}

function parseJsonColumn(row, key) {
  if (!row || row[key] == null) return row;
  return {
    ...row,
    [key]: JSON.parse(row[key]),
  };
}

function getSummary(db, platform) {
  const latestBatch = db.prepare(`
    select id, batch_no, status, started_at, finished_at, source_dir,
      total_count, success_count, failed_count
    from sync_batch
    where source_system = ?
      and source_object = 'metadata'
    order by id desc
    limit 1
  `).get(platform);

  const counts = Object.fromEntries([
    "channel_category",
    "channel_publish_standard",
    "channel_publish_field",
    "channel_picture_config",
    "channel_attribute_template",
    "channel_attribute",
    "channel_attribute_value",
    "channel_required_attribute",
  ].map((table) => [
    table,
    db.prepare(`select count(*) as count from ${table} where platform = ?`).get(platform).count,
  ]));

  const roots = db.prepare(`
    select root_category_name, count(*) as leaf_count
    from channel_category
    where platform = ?
      and last_category = 1
    group by root_category_name
    order by leaf_count desc, root_category_name
  `).all(platform);

  return {
    latest_batch: latestBatch || null,
    counts,
    roots,
  };
}

function searchCategories(db, args) {
  const like = `%${args.search}%`;
  return db.prepare(`
    select category_id, product_type_id, category_name, root_category_name,
      level, path, last_category
    from channel_category
    where platform = ?
      and (category_name like ? or path like ?)
    order by last_category desc, path
    limit ?
  `).all(args.platform, like, like, args.limit);
}

function getCategory(db, args) {
  const category = db.prepare(`
    select category_id, product_type_id, parent_category_id, category_name,
      root_category_id, root_category_name, level, path, last_category
    from channel_category
    where platform = ?
      and category_id = ?
  `).get(args.platform, args.categoryId);

  if (!category) return null;

  const publishStandard = db.prepare(`
    select default_language, currency, support_sale_attribute_sort, trace_id
    from channel_publish_standard
    where platform = ?
      and standard_scope = 'category'
      and category_id = ?
  `).get(args.platform, args.categoryId) || null;

  const requiredFields = db.prepare(`
    select module, field_key, required, show
    from channel_publish_field
    where platform = ?
      and standard_scope = 'category'
      and category_id = ?
      and show = 1
      and required = 1
    order by module, field_key
  `).all(args.platform, args.categoryId);

  const visibleFields = db.prepare(`
    select module, field_key, required, show
    from channel_publish_field
    where platform = ?
      and standard_scope = 'category'
      and category_id = ?
      and show = 1
    order by required desc, module, field_key
  `).all(args.platform, args.categoryId);

  const pictureConfig = db.prepare(`
    select field_key, is_true
    from channel_picture_config
    where platform = ?
      and standard_scope = 'category'
      and category_id = ?
    order by field_key
  `).all(args.platform, args.categoryId);

  const requiredAttributes = db.prepare(`
    select attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, values_count
    from channel_required_attribute
    where platform = ?
      and category_id = ?
    order by attribute_type, attribute_name
  `).all(args.platform, args.categoryId);

  const saleAttributes = db.prepare(`
    select attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, values_count
    from channel_attribute
    where platform = ?
      and product_type_id = ?
      and is_sale_attribute = 1
    order by attribute_name
  `).all(args.platform, category.product_type_id);

  return {
    category,
    publish_standard: publishStandard,
    required_fields: requiredFields,
    visible_fields: visibleFields,
    picture_config: pictureConfig,
    sale_attributes: saleAttributes,
    required_attributes: requiredAttributes,
  };
}

function getProductType(db, args) {
  const template = db.prepare(`
    select product_type_id, attr_count, required_count, sale_attributes_json
    from channel_attribute_template
    where platform = ?
      and product_type_id = ?
  `).get(args.platform, args.productTypeId);

  if (!template) return null;

  const attributes = db.prepare(`
    select attribute_id, attribute_name, attribute_name_en, attribute_type,
      attribute_mode, attribute_status, attribute_input_num, values_count,
      is_required, is_sale_attribute, is_size_attribute
    from channel_attribute
    where platform = ?
      and product_type_id = ?
      and (? is null or attribute_id = ?)
    order by is_required desc, is_sale_attribute desc, attribute_type, attribute_name
    limit ?
  `).all(
    args.platform,
    args.productTypeId,
    args.attributeId,
    args.attributeId,
    args.limit,
  );

  const result = {
    template: parseJsonColumn(template, "sale_attributes_json"),
    attributes,
  };

  if (args.attributeId !== null) {
    result.values = db.prepare(`
      select attribute_value_id, attribute_value, attribute_value_en,
        is_custom_attribute_value, is_show, is_black, color
      from channel_attribute_value
      where platform = ?
        and product_type_id = ?
        and attribute_id = ?
      order by attribute_value
      limit ?
    `).all(args.platform, args.productTypeId, args.attributeId, args.limit);
  }

  return result;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const db = openDatabase(args.dbPath, { configureJournal: false });
let result;
if (args.categoryId !== null) {
  result = getCategory(db, args);
} else if (args.productTypeId !== null) {
  result = getProductType(db, args);
} else if (args.search) {
  result = {
    query: args.search,
    categories: searchCategories(db, args),
  };
} else {
  result = getSummary(db, args.platform);
}
db.close();

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
