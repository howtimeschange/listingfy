#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROD_BASE_URL_CN,
  assertSheinSuccess,
  readEnv,
  requestSheinWithRetry,
} from "./lib/shein_client.mjs";

const CATEGORY_TREE_PATH = "/open-api/goods/query-category-tree";
const PUBLISH_STANDARD_PATH = "/open-api/goods/query-publish-fill-in-standard";
const ATTRIBUTE_TEMPLATE_PATH = "/open-api/goods/query-attribute-template";
const SITE_LIST_PATH = "/open-api/goods/query-site-list";
const STORE_INFO_PATH = "/open-api/openapi-business-backend/query-store-info";

const DEFAULT_STANDARD_CONCURRENCY = 12;
const DEFAULT_ATTRIBUTE_CONCURRENCY = 8;
const ATTRIBUTE_BATCH_SIZE = 10;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const args = {
    baseUrl: readEnv("SHEIN_BASE_URL", PROD_BASE_URL_CN),
    language: readEnv("SHEIN_LANGUAGE", "zh-cn"),
    outDir: path.join(projectRoot, "data", "shein-metadata", timestampForPath()),
    roots: [],
    limitLeaves: null,
    standardConcurrency: DEFAULT_STANDARD_CONCURRENCY,
    attributeConcurrency: DEFAULT_ATTRIBUTE_CONCURRENCY,
    skipStandards: false,
    skipAttributes: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--base-url") args.baseUrl = next();
    else if (arg === "--language") args.language = next();
    else if (arg === "--out") args.outDir = path.resolve(next());
    else if (arg === "--roots") args.roots = next().split(",").map((item) => item.trim()).filter(Boolean);
    else if (arg === "--limit-leaves") args.limitLeaves = Number(next());
    else if (arg === "--standard-concurrency") args.standardConcurrency = Number(next());
    else if (arg === "--attribute-concurrency") args.attributeConcurrency = Number(next());
    else if (arg === "--skip-standards") args.skipStandards = true;
    else if (arg === "--skip-attributes") args.skipAttributes = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(args.standardConcurrency) || args.standardConcurrency < 1) {
    throw new Error("--standard-concurrency must be a positive integer");
  }
  if (!Number.isInteger(args.attributeConcurrency) || args.attributeConcurrency < 1) {
    throw new Error("--attribute-concurrency must be a positive integer");
  }
  if (args.limitLeaves !== null && (!Number.isInteger(args.limitLeaves) || args.limitLeaves < 1)) {
    throw new Error("--limit-leaves must be a positive integer");
  }

  return args;
}

function usage() {
  process.stdout.write(`SHEIN metadata sync

Required environment:
  SHEIN_OPEN_KEY_ID
  SHEIN_SECRET_KEY

Optional environment:
  SHEIN_BASE_URL     default ${PROD_BASE_URL_CN}
  SHEIN_LANGUAGE     default zh-cn

Options:
  --out <dir>                    Output directory.
  --roots <name-or-id,...>       Sync only selected root category names or ids, e.g. 儿童,婴儿.
  --limit-leaves <n>             Limit leaf categories for smoke testing.
  --standard-concurrency <n>     Default ${DEFAULT_STANDARD_CONCURRENCY}.
  --attribute-concurrency <n>    Default ${DEFAULT_ATTRIBUTE_CONCURRENCY}.
  --skip-standards               Skip category publish standard sync.
  --skip-attributes              Skip attribute template sync.

Examples:
  node scripts/shein_metadata_sync.mjs
  node scripts/shein_metadata_sync.mjs --roots 儿童,婴儿
`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(stream, value) {
  stream.write(`${JSON.stringify(value)}\n`);
}

function flattenCategories(nodes) {
  const all = [];
  const leaves = [];

  function walk(items, ancestors = []) {
    for (const item of items || []) {
      const pathItems = [...ancestors, item.category_name];
      const root = pathItems[0] || item.category_name;
      const flat = {
        category_id: item.category_id,
        product_type_id: item.product_type_id,
        parent_category_id: item.parent_category_id,
        category_name: item.category_name,
        last_category: item.last_category,
        level: pathItems.length,
        path: pathItems.join(" > "),
        root_category_id: ancestors.length === 0 ? item.category_id : null,
        root_category_name: root,
      };
      all.push(flat);
      if (item.last_category) {
        leaves.push(flat);
      }
      walk(item.children || [], pathItems);
    }
  }

  walk(nodes);

  const rootIdByName = new Map(all.filter((item) => item.level === 1).map((item) => [item.category_name, item.category_id]));
  for (const item of all) {
    item.root_category_id = rootIdByName.get(item.root_category_name) ?? item.root_category_id;
  }
  for (const item of leaves) {
    item.root_category_id = rootIdByName.get(item.root_category_name) ?? item.root_category_id;
  }

  return { all, leaves };
}

function selectLeaves(leaves, roots, limitLeaves) {
  let selected = leaves;
  if (roots.length) {
    const wanted = new Set(roots);
    selected = selected.filter((leaf) => (
      wanted.has(String(leaf.root_category_id))
      || wanted.has(String(leaf.root_category_name))
      || wanted.has(String(leaf.category_id))
      || wanted.has(String(leaf.category_name))
    ));
  }
  if (limitLeaves !== null) {
    selected = selected.slice(0, limitLeaves);
  }
  return selected;
}

function groupByProductType(leaves) {
  const map = new Map();
  for (const leaf of leaves) {
    const key = String(leaf.product_type_id);
    if (!leaf.product_type_id) continue;
    const existing = map.get(key) || [];
    existing.push({
      category_id: leaf.category_id,
      category_name: leaf.category_name,
      path: leaf.path,
    });
    map.set(key, existing);
  }
  return map;
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function concurrentMap(items, concurrency, worker, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let completed = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
      completed += 1;
      if (onProgress) onProgress(completed, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

function summarizeAttribute(attribute) {
  return {
    attribute_id: attribute.attribute_id,
    attribute_name: attribute.attribute_name,
    attribute_name_en: attribute.attribute_name_en,
    attribute_type: attribute.attribute_type,
    attribute_label: attribute.attribute_label,
    attribute_mode: attribute.attribute_mode,
    attribute_status: attribute.attribute_status,
    attribute_input_num: attribute.attribute_input_num,
    values_count: (attribute.attribute_value_info_list || []).length,
  };
}

async function sheinPost(pathName, body, baseUrl) {
  const result = await requestSheinWithRetry(pathName, {
    body,
    baseUrl,
    retries: 4,
    retryDelayMs: 1200,
  });
  assertSheinSuccess(result, pathName);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  ensureDir(args.outDir);

  const startedAt = new Date();
  const files = {
    manifest: path.join(args.outDir, "manifest.json"),
    storeInfo: path.join(args.outDir, "store-info.json"),
    siteList: path.join(args.outDir, "site-list.json"),
    storePublishStandard: path.join(args.outDir, "store-publish-standard.json"),
    categoryTree: path.join(args.outDir, "category-tree.json"),
    categoriesFlat: path.join(args.outDir, "categories.flat.jsonl"),
    leafCategories: path.join(args.outDir, "leaf-categories.json"),
    publishStandards: path.join(args.outDir, "publish-standards.jsonl"),
    attributeTemplates: path.join(args.outDir, "attribute-templates.jsonl"),
    requiredAttributes: path.join(args.outDir, "required-attributes.jsonl"),
    failures: path.join(args.outDir, "sync-failures.jsonl"),
  };

  const manifest = {
    started_at: startedAt.toISOString(),
    finished_at: null,
    base_url: args.baseUrl,
    language: args.language,
    roots_filter: args.roots,
    limit_leaves: args.limitLeaves,
    standard_concurrency: args.standardConcurrency,
    attribute_concurrency: args.attributeConcurrency,
    counts: {},
    files: Object.fromEntries(Object.entries(files).map(([key, filePath]) => [key, path.relative(projectRoot, filePath)])),
    failures_count: 0,
  };

  process.stderr.write(`Sync output: ${args.outDir}\n`);

  const failuresStream = fs.createWriteStream(files.failures, { flags: "w" });
  const recordFailure = (failure) => {
    manifest.failures_count += 1;
    writeJsonl(failuresStream, failure);
  };

  process.stderr.write("Fetching store info, site list, store publish standard and category tree...\n");
  const [storeInfo, siteList, storePublishStandard, categoryTree] = await Promise.all([
    sheinPost(STORE_INFO_PATH, {}, args.baseUrl),
    sheinPost(SITE_LIST_PATH, {}, args.baseUrl),
    sheinPost(PUBLISH_STANDARD_PATH, "", args.baseUrl),
    sheinPost(CATEGORY_TREE_PATH, "", args.baseUrl),
  ]);

  writeJson(files.storeInfo, storeInfo.payload);
  writeJson(files.siteList, siteList.payload);
  writeJson(files.storePublishStandard, storePublishStandard.payload);
  writeJson(files.categoryTree, categoryTree.payload);

  const roots = categoryTree.payload.info?.data || [];
  const { all, leaves } = flattenCategories(roots);
  const selectedLeaves = selectLeaves(leaves, args.roots, args.limitLeaves);
  const productTypeToLeaves = groupByProductType(selectedLeaves);
  const productTypeIds = [...productTypeToLeaves.keys()].map(Number).sort((a, b) => a - b);

  const flatStream = fs.createWriteStream(files.categoriesFlat, { flags: "w" });
  for (const category of all) {
    writeJsonl(flatStream, category);
  }
  flatStream.end();

  writeJson(files.leafCategories, selectedLeaves);

  manifest.counts.root_categories = roots.length;
  manifest.counts.all_categories = all.length;
  manifest.counts.leaf_categories_total = leaves.length;
  manifest.counts.leaf_categories_selected = selectedLeaves.length;
  manifest.counts.product_type_ids_selected = productTypeIds.length;

  process.stderr.write(`Selected leaves: ${selectedLeaves.length}; product types: ${productTypeIds.length}\n`);

  const standardsStream = fs.createWriteStream(files.publishStandards, { flags: "w" });
  let standardsOk = 0;
  if (!args.skipStandards) {
    process.stderr.write("Syncing category publish standards...\n");
    await concurrentMap(selectedLeaves, args.standardConcurrency, async (leaf) => {
      try {
        const result = await sheinPost(PUBLISH_STANDARD_PATH, { category_id: leaf.category_id }, args.baseUrl);
        standardsOk += 1;
        writeJsonl(standardsStream, {
          category_id: leaf.category_id,
          product_type_id: leaf.product_type_id,
          category_name: leaf.category_name,
          path: leaf.path,
          traceId: result.payload.traceId,
          info: result.payload.info,
        });
      } catch (error) {
        recordFailure({
          type: "publish-standard",
          category_id: leaf.category_id,
          product_type_id: leaf.product_type_id,
          path: leaf.path,
          error: error.message,
        });
      }
    }, (done, total) => {
      if (done % 100 === 0 || done === total) {
        process.stderr.write(`  publish standards ${done}/${total}\n`);
      }
    });
  }
  standardsStream.end();
  manifest.counts.publish_standards_synced = standardsOk;

  const templatesStream = fs.createWriteStream(files.attributeTemplates, { flags: "w" });
  const requiredStream = fs.createWriteStream(files.requiredAttributes, { flags: "w" });
  let templatesOk = 0;
  let requiredRows = 0;

  if (!args.skipAttributes) {
    process.stderr.write("Syncing attribute templates...\n");
    const batches = chunk(productTypeIds, ATTRIBUTE_BATCH_SIZE);
    await concurrentMap(batches, args.attributeConcurrency, async (batch) => {
      try {
        const result = await sheinPost(ATTRIBUTE_TEMPLATE_PATH, { product_type_id_list: batch }, args.baseUrl);
        const items = result.payload.info?.data || [];
        for (const item of items) {
          const categoryRefs = productTypeToLeaves.get(String(item.product_type_id)) || [];
          const attributes = item.attribute_infos || [];
          const required = attributes.filter((attribute) => attribute.attribute_status === 3);
          const saleAttributes = attributes.filter((attribute) => attribute.attribute_type === 1);
          templatesOk += 1;
          writeJsonl(templatesStream, {
            product_type_id: item.product_type_id,
            category_refs: categoryRefs,
            traceId: result.payload.traceId,
            attr_count: attributes.length,
            required_count: required.length,
            sale_attributes: saleAttributes.map(summarizeAttribute),
            attribute_infos: attributes,
          });
          for (const attribute of required) {
            requiredRows += 1;
            writeJsonl(requiredStream, {
              product_type_id: item.product_type_id,
              category_refs: categoryRefs,
              ...summarizeAttribute(attribute),
              sample_values: (attribute.attribute_value_info_list || []).slice(0, 20),
            });
          }
        }
        const returnedIds = new Set(items.map((item) => item.product_type_id));
        for (const requestedId of batch) {
          if (!returnedIds.has(requestedId)) {
            recordFailure({
              type: "attribute-template-missing",
              product_type_id: requestedId,
              category_refs: productTypeToLeaves.get(String(requestedId)) || [],
              error: "SHEIN response did not include requested product_type_id",
            });
          }
        }
      } catch (error) {
        for (const productTypeId of batch) {
          recordFailure({
            type: "attribute-template",
            product_type_id: productTypeId,
            category_refs: productTypeToLeaves.get(String(productTypeId)) || [],
            error: error.message,
          });
        }
      }
    }, (done, total) => {
      if (done % 20 === 0 || done === total) {
        process.stderr.write(`  attribute batches ${done}/${total}\n`);
      }
    });
  }

  templatesStream.end();
  requiredStream.end();
  failuresStream.end();

  manifest.counts.attribute_templates_synced = templatesOk;
  manifest.counts.required_attribute_rows = requiredRows;
  manifest.finished_at = new Date().toISOString();

  writeJson(files.manifest, manifest);
  ensureDir(path.dirname(path.join(projectRoot, "data", "shein-metadata", "latest-manifest.json")));
  writeJson(path.join(projectRoot, "data", "shein-metadata", "latest-manifest.json"), manifest);

  process.stderr.write(`Done. Failures: ${manifest.failures_count}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
