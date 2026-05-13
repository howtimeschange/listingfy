import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { DATA_DIR, getDb } from "../db"
import { resolveAiConfig } from "../../../scripts/lib/ai_category_matcher.mjs"
import { refreshBucketProduct } from "./shein-products"
import { resolveSheinCredentials } from "../lib/platform-config"
import { getSheinPriceConfig } from "../lib/price-config"
import { resolvePackageRule } from "../lib/rule-resolver"
import { platformAdapterFor } from "../platform-adapters"
import {
  ensurePublishTask,
  markPublishTaskFailed,
  updatePublishTaskRequestPayload,
} from "../services/publish/publish-job-service"
import { canTransitionDraftStatus } from "../services/pre-publish/drafts"
import { coerceFieldValues, normalizeMaterialValue } from "../services/pre-publish/field-fills"
import {
  boolConfigValue,
  buildPictureRequirements,
  classifyImportedImage,
  imageCompliance,
  inferAssetTypeFromLibraryAsset,
  inferAssetTypeFromRequirement,
  type PictureConfigRow,
  type PictureRequirement,
} from "../services/pre-publish/images"
import {
  buildPublishSupplierSkuMap,
  normalizeBarcode,
  publishBusinessValidationErrors,
  publishInfo,
  publishPackageWeight,
  publishSupplierSku,
  responseCode,
  responseMessage,
} from "../services/pre-publish/payload"
import { transformOnlineImageToShein, uploadLocalImageToShein } from "../services/pre-publish/shein-api"
import {
  asNumber,
  asPositiveNumber,
  batchTerms,
  buildScopeKey,
  compactText,
  normalizeText,
  nowIso,
  parseJsonArray,
  parseJsonList,
  parseJsonObject,
  readLimit,
  readOffset,
  uniqueStrings,
} from "../services/pre-publish/shared"
import { createPublishVersion } from "../services/pre-publish/versions"

const prePublish = new Hono()

type SourceRow = Record<string, unknown>

type AttributeValue = {
  attribute_value_id: number
  attribute_value: string
  attribute_value_en: string | null
}

type RequiredAttribute = {
  category_id: number
  product_type_id: number
  attribute_id: number
  attribute_name: string
  attribute_name_en: string | null
  attribute_type: number | null
  attribute_label: number | null
  attribute_mode: number | null
  attribute_status: number | null
  attribute_input_num: number | null
  values_count: number
  sample_values_json: string
  values: AttributeValue[]
}

type FillField = {
  key: string
  label: string
  value: string | number | null
  source: string
  status: "READY" | "MISSING" | "NEEDS_AI" | "WARNING"
  confidence?: number | null
  note?: string | null
  options?: AttributeValue[]
  attribute_id?: number | null
  attribute_type?: number | null
  attribute_label?: number | null
  attribute_mode?: number | null
  attribute_status?: number | null
  attribute_input_num?: number | null
  render_kind?: "text" | "textarea" | "single_enum" | "multi_enum" | "enum_with_text" | "readonly"
}

type FieldGroup = {
  group: string
  fields: FillField[]
}

type DimensionFieldGroup = {
  dimension: "SPU" | "SKC" | "SKU"
  title: string
  description: string
  groups: FieldGroup[]
}

type PublishFieldRule = {
  module: string
  field_key: string
  required: boolean | null
  show: boolean | null
}

type ReadinessRow = {
  product_spu_id: number
  spu_code: string
  spu_name: string | null
  title_cn: string | null
  title_en: string | null
  brand_name: string | null
  category: {
    category_id: number | null
    product_type_id: number | null
    category_name: string | null
    path: string | null
    source: string
    status: string
  }
  skcs: SourceRow[]
  sku_count: number
  completeness: number
  ready_field_count: number
  total_field_count: number
  missing_field_count: number
  needs_ai_count: number
  field_groups: FieldGroup[]
  dimension_field_groups: DimensionFieldGroup[]
  manual_fields: FillField[]
  blocking_issues: string[]
}

type ListingRow = SourceRow & {
  id: number
  spu_code: string
  product_spu_id: number
  platform: string
  platform_category_id: number | null
  product_type_id: number | null
}

type CategoryOverride = {
  category_id: number | null
  product_type_id: number | null
  category_name: string | null
  path: string | null
  source?: string
  status?: string
}


function activeFillMap(db: ReturnType<typeof getDb>, spuCodes: string[]) {
  if (spuCodes.length === 0) return new Map<string, SourceRow>()
  const placeholders = spuCodes.map(() => "?").join(",")
  const rows = db.prepare(`
    select *
    from listing_field_fill
    where status = 'ACTIVE'
      and spu_code in (${placeholders})
  `).all(...spuCodes) as SourceRow[]
  return new Map(rows.map((row) => [String(row.scope_key), row]))
}

function getStoredFill(
  fills: Map<string, SourceRow>,
  spuCode: string,
  fieldKey: string,
  skcCode?: string | null,
  skuCode?: string | null,
) {
  return fills.get(buildScopeKey({ spuCode, skcCode, skuCode, fieldKey }))
    ?? fills.get(buildScopeKey({ spuCode, fieldKey }))
    ?? null
}

function storedFillNote(stored: SourceRow, fallback?: string | null) {
  const payload = parseJsonObject(stored.payload_json)
  const reason = normalizeText(payload.reason)
  if (reason) return reason
  const savedFrom = normalizeText(payload.saved_from)
  if (savedFrom) return fallback ?? null
  const source = normalizeText(stored.source)
  if (source === "AI_TRANSLATED") return "AI 基于中文标题、类目和款色生成英文标题"
  if (source.startsWith("AI_")) return "AI 基于商品档案上下文和 SHEIN 枚举值推荐"
  return fallback ?? null
}

function productListFilter(q?: string, batchSearch?: string) {
  const clauses: string[] = ["1=1"]
  const params: unknown[] = []
  const terms = batchTerms(batchSearch)
  if (q?.trim()) terms.push(q.trim())
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() =>
      "(spu.spu_code like ? or spu.spu_name like ? or pkg.title like ? or skc.skc_code like ?)",
    ).join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like, like)
    }
  }
  return { clauses, params }
}

function productRows(
  db: ReturnType<typeof getDb>,
  q?: string,
  batchSearch?: string,
  options?: { limit?: number; offset?: number },
) {
  const { clauses, params } = productListFilter(q, batchSearch)
  const limit = options?.limit ?? 200
  const offset = options?.offset ?? 0

  return db.prepare(`
    select distinct
      spu.*,
      pkg.id as content_package_id,
      pkg.title as deepdraw_title,
      pkg.brand_name as deepdraw_brand_name,
      pkg.category_name as deepdraw_category_name,
      pkg.trade_path as deepdraw_trade_path,
      pkg.primary_color as deepdraw_primary_color,
      matched_rule.id as matched_category_rule_id,
      matched_rule.source as matched_category_rule_source,
      matched_rule.shein_category_id as matched_shein_category_id,
      matched_rule.shein_product_type_id as matched_shein_product_type_id,
      matched_category.category_name as matched_shein_category_name,
      matched_category.path as matched_shein_category_path,
      ai_suggestion.shein_category_id as suggested_shein_category_id,
      ai_suggestion.shein_product_type_id as suggested_shein_product_type_id,
      suggested_category.category_name as suggested_shein_category_name,
      suggested_category.path as suggested_shein_category_path
    from product_spu spu
    left join product_content_package pkg on pkg.spu_code = spu.spu_code
    left join product_skc skc on skc.spu_id = spu.id
    left join mdm_shein_category_mapping_rule matched_rule
      on matched_rule.status = 'ACTIVE'
      and (
        (
          matched_rule.match_mode = 'EXACT'
          and matched_rule.match_key = (
            coalesce(spu.middle_class_name, '') || '|' ||
            coalesce(spu.subclass_name, '') || '|' ||
            coalesce(spu.gender_name, '') || '|' ||
            coalesce(spu.age_group_name, '')
          )
        )
        or (
          matched_rule.match_mode = 'FALLBACK'
          and matched_rule.mdm_small_category_name = coalesce(spu.subclass_name, '')
        )
      )
    left join v_shein_leaf_category matched_category
      on matched_category.category_id = matched_rule.shein_category_id
      and matched_category.product_type_id = matched_rule.shein_product_type_id
    left join mdm_shein_category_ai_suggestion ai_suggestion
      on ai_suggestion.review_status in ('PENDING', 'CONFIRMED')
      and ai_suggestion.match_key = (
        coalesce(spu.middle_class_name, '') || '|' ||
        coalesce(spu.subclass_name, '') || '|' ||
        coalesce(spu.gender_name, '') || '|' ||
        coalesce(spu.age_group_name, '')
      )
    left join v_shein_leaf_category suggested_category
      on suggested_category.category_id = ai_suggestion.shein_category_id
      and suggested_category.product_type_id = ai_suggestion.shein_product_type_id
    where ${clauses.join(" and ")}
    order by spu.spu_code
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]
}

function ensureSheinBucketRows(db: ReturnType<typeof getDb>) {
  const row = db.prepare("select count(*) as count from shein_product_bucket").get() as { count: number }
  if (Number(row.count ?? 0) > 0) return
  const rows = db.prepare(`
    select spu_code
    from product_spu
    order by updated_at desc, synced_at desc, spu_code desc
    limit 20
  `).all() as SourceRow[]
  for (const item of rows) refreshBucketProduct(db, String(item.spu_code))
}

function csvTerms(value: string | undefined) {
  return batchTerms(value).filter((item) => item !== "all")
}

function bucketReadinessFilter(c: { req: { query: (name: string) => string | undefined } }) {
  const clauses = ["bucket.bucket_status <> 'REMOVED'"]
  const params: unknown[] = []
  const terms = batchTerms(c.req.query("batch_search"))
  const q = normalizeText(c.req.query("q"))
  if (q) terms.push(q)
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() => `
      (
        bucket.spu_code like ?
        or bucket.title_cn like ?
        or bucket.title_en like ?
        or spu.spu_name like ?
        or pkg.title like ?
      )
    `).join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like, like, like)
    }
  }

  const addIn = (name: string, sql: string) => {
    const values = csvTerms(c.req.query(name))
    if (values.length === 0) return
    clauses.push(`${sql} in (${values.map(() => "?").join(",")})`)
    params.push(...values)
  }
  addIn("bucket_statuses", "bucket.bucket_status")
  addIn("category_statuses", "bucket.category_status")
  addIn("readiness_statuses", "bucket.readiness_status")
  addIn("image_statuses", "bucket.image_status")
  addIn("brand_codes", "coalesce(spu.brand_code, pkg.brand_name)")
  const categoryIds = csvTerms(c.req.query("category_ids") ?? c.req.query("category_id"))
  if (categoryIds.length > 0) {
    clauses.push(`cast(bucket.platform_category_id as text) in (${categoryIds.map(() => "?").join(",")})`)
    params.push(...categoryIds)
  }
  return { clause: `where ${clauses.join(" and ")}`, params }
}

function bucketReadinessRows(
  db: ReturnType<typeof getDb>,
  c: { req: { query: (name: string) => string | undefined } },
  options: { limit: number; offset: number },
) {
  ensureSheinBucketRows(db)
  const { clause, params } = bucketReadinessFilter(c)
  const rows = db.prepare(`
    select bucket.spu_code
    from shein_product_bucket bucket
    join product_spu spu on spu.id = bucket.product_spu_id
    left join product_content_package pkg on pkg.spu_code = bucket.spu_code
    ${clause}
    group by bucket.spu_code
    order by max(bucket.updated_at) desc, max(bucket.id) desc
    limit ? offset ?
  `).all(...params, options.limit, options.offset) as SourceRow[]
  const total = db.prepare(`
    select count(distinct bucket.id) as count
    from shein_product_bucket bucket
    join product_spu spu on spu.id = bucket.product_spu_id
    left join product_content_package pkg on pkg.spu_code = bucket.spu_code
    ${clause}
  `).get(...params) as { count: number }
  return {
    rows,
    total: Number(total.count ?? 0),
  }
}

function getProductFields(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return new Map<string, string>()
  const rows = db.prepare(`
    select field_name, value_text
    from product_content_field
    where content_package_id = ?
    order by is_key desc, field_name
  `).all(contentPackageId) as SourceRow[]

  const map = new Map<string, string>()
  for (const row of rows) {
    const name = normalizeText(row.field_name)
    const value = normalizeText(row.value_text)
    if (!name || !value || map.has(name)) continue
    map.set(name, value)
  }
  return map
}

function firstField(fields: Map<string, string>, names: string[]) {
  for (const name of names) {
    const exact = fields.get(name)
    if (exact) return exact
  }
  for (const [name, value] of fields) {
    if (names.some((needle) => name.includes(needle))) return value
  }
  return ""
}

function getSkcs(db: ReturnType<typeof getDb>, spuId: unknown) {
  if (!spuId) return []
  return db.prepare(`
    select
      skc.*,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = skc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR_BLOCK'
          and asset.picture_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_image_url,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = skc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_url,
      (
        select count(*)
        from product_sku sku
        where sku.skc_id = skc.id
      ) as sku_count
    from product_skc skc
    where skc.spu_id = ?
    order by skc.skc_code
  `).all(spuId) as SourceRow[]
}

function getContentSkcs(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return []
  return db.prepare(`
    select
      cskc.id,
      cskc.spu_code,
      cskc.skc_code,
      null as skc_name,
      null as color_code,
      cskc.color_name,
      null as pic_url,
      cskc.sku_count,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = cskc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR_BLOCK'
          and asset.picture_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_image_url,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = cskc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_url
    from product_content_skc cskc
    where cskc.content_package_id = ?
    order by cskc.skc_code
  `).all(contentPackageId) as SourceRow[]
}

function getSkus(db: ReturnType<typeof getDb>, spuId: unknown) {
  if (!spuId) return []
  return db.prepare(`
    select sku.*, skc.skc_code
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    where skc.spu_id = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(spuId) as SourceRow[]
}

function getContentSkus(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return []
  return db.prepare(`
    select
      csku.id,
      csku.spu_code,
      csku.skc_code,
      csku.sku_code,
      null as sku_name,
      csku.size_code,
      csku.size_name,
      null as shein_size_name,
      csku.barcode as ean_code,
      csku.seller_code as inner_code,
      csku.seller_code as supplier_product_code,
      csku.price as price_tag,
      null as supply_price_cny,
      null as suggested_retail_price_usd,
      null as gross_weight_g,
      null as supply_discount,
      null as package_size_text,
      null as status_name
    from product_content_sku csku
    where csku.content_package_id = ?
    order by csku.skc_code, csku.size_code, csku.sku_code
  `).all(contentPackageId) as SourceRow[]
}

function sizeKeys(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return []
  const keys = new Set<string>([raw])
  const digits = raw.match(/\d+/)?.[0] ?? ""
  if (digits) {
    keys.add(digits)
    keys.add(digits.padStart(3, "0"))
  }
  if (raw.toLowerCase().endsWith("cm")) {
    const withoutCm = raw.replace(/cm$/i, "")
    keys.add(withoutCm)
    keys.add(withoutCm.padStart(3, "0"))
  }
  return [...keys].filter(Boolean)
}

function activeSizeConversions(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from size_conversion_rule
    where platform = 'SHEIN'
      and status = 'ACTIVE'
  `).all() as SourceRow[]
  const byCode = new Map<string, SourceRow>()
  const byName = new Map<string, SourceRow>()
  for (const row of rows) {
    for (const code of sizeKeys(row.local_size_code)) byCode.set(code, row)
    for (const name of sizeKeys(row.local_size_name)) byName.set(name, row)
  }
  return { rows, byCode, byName }
}

function activeDiscounts(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from supply_discount_rule
    where status = 'ACTIVE'
  `).all() as SourceRow[]
  return new Map(rows.map((row) => [String(row.spu_code), row]))
}

function activeWeights(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from product_weight_import
    where coalesce(status, 'ACTIVE') <> 'DELETED'
    order by updated_at desc, created_at desc, id desc
  `).all() as SourceRow[]
  const map = new Map<string, SourceRow>()
  for (const row of rows) {
    const skuCode = normalizeText(row.sku_code)
    if (skuCode && !map.has(`sku:${skuCode}`)) map.set(`sku:${skuCode}`, row)
  }
  return map
}

function fallbackCategory(row: SourceRow) {
  const text = [
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.deepdraw_category_name,
    row.deepdraw_title,
  ].map(normalizeText).join(" ")
  const gender = normalizeText(row.gender_name)
  const isMale = gender.includes("男")
  const isFemale = gender.includes("女")
  const isSmallKid = text.includes("幼童") || text.includes("宝宝") || text.includes("小童")
  if (text.includes("套装")) {
    const sweatshirt = text.includes("卫衣") || text.includes("连帽") || text.includes("针织")
    if (isMale) {
      return {
        category_id: isSmallKid ? (sweatshirt ? 15254 : 2106) : (sweatshirt ? 15249 : 1998),
        product_type_id: isSmallKid ? (sweatshirt ? 10935 : 9322) : (sweatshirt ? 10930 : 9316),
        category_name: isSmallKid
          ? (sweatshirt ? "男童（小）卫衣套装" : "男童（小）T恤套装")
          : (sweatshirt ? "男童（大）卫衣套装" : "男童（大）T恤套装"),
        path: isSmallKid
          ? `儿童 > 男童（小）服装 > 男童（小）套装 > ${sweatshirt ? "男童（小）卫衣套装" : "男童（小）T恤套装"}`
          : `儿童 > 男童（大）服装 > 男童（大）套装 > ${sweatshirt ? "男童（大）卫衣套装" : "男童（大）T恤套装"}`,
        source: "RULE_FALLBACK",
        status: "READY",
      }
    }
    if (isFemale) {
      return {
        category_id: isSmallKid ? (sweatshirt ? 15269 : 2115) : (sweatshirt ? 15264 : 2014),
        product_type_id: isSmallKid ? (sweatshirt ? 10957 : 9320) : (sweatshirt ? 10944 : 9318),
        category_name: isSmallKid
          ? (sweatshirt ? "女童（小）卫衣套装" : "女童（小）T恤套装")
          : (sweatshirt ? "女童（大）卫衣套装" : "女童（大）T恤套装"),
        path: isSmallKid
          ? `儿童 > 女童（小）服装 > 女童（小）套装 > ${sweatshirt ? "女童（小）卫衣套装" : "女童（小）T恤套装"}`
          : `儿童 > 女童（大）服装 > 女童（大）套装 > ${sweatshirt ? "女童（大）卫衣套装" : "女童（大）T恤套装"}`,
        source: "RULE_FALLBACK",
        status: "READY",
      }
    }
  }
  if (text.includes("衬衫")) {
    return {
      category_id: 2062,
      product_type_id: 7403,
      category_name: "女童（小）衬衫",
      path: "儿童 > 女童（小）服装 > 女童（小）上衣 > 女童（小）衬衫",
      source: "RULE_FALLBACK",
      status: "READY",
    }
  }
  if (text.includes("连衣裙")) {
    return {
      category_id: 2063,
      product_type_id: 5926,
      category_name: "女童（小）连衣裙",
      path: "儿童 > 女童（小）服装 > 女童（小）连衣裙",
      source: "RULE_FALLBACK",
      status: "READY",
    }
  }
  if (text.includes("开襟") || text.includes("毛衫") || text.includes("毛衣")) {
    const male = gender.includes("男")
    return {
      category_id: male ? 2499 : 2508,
      product_type_id: male ? 9343 : 9344,
      category_name: male ? "男童（小）开襟衫" : "女童（小）开襟衫",
      path: male
        ? "儿童 > 男童（小）服装 > 男童（小）针织衫 > 男童（小）开襟衫"
        : "儿童 > 女童（小）服装 > 女童（小）针织衫 > 女童（小）开襟衫",
      source: "RULE_FALLBACK",
      status: gender.includes("中性") ? "NEEDS_SKC_REVIEW" : "READY",
    }
  }
  return {
    category_id: null,
    product_type_id: null,
    category_name: null,
    path: null,
    source: "MISSING",
    status: "MISSING",
  }
}

function resolveCategory(row: SourceRow) {
  if (row.matched_shein_category_id && row.matched_shein_product_type_id) {
    return {
      category_id: Number(row.matched_shein_category_id),
      product_type_id: Number(row.matched_shein_product_type_id),
      category_name: normalizeText(row.matched_shein_category_name),
      path: normalizeText(row.matched_shein_category_path),
      source: normalizeText(row.matched_category_rule_source) || "CATEGORY_RULE",
      status: "READY",
    }
  }
  if (row.suggested_shein_category_id && row.suggested_shein_product_type_id) {
    return {
      category_id: Number(row.suggested_shein_category_id),
      product_type_id: Number(row.suggested_shein_product_type_id),
      category_name: normalizeText(row.suggested_shein_category_name),
      path: normalizeText(row.suggested_shein_category_path),
      source: "AI_CATEGORY",
      status: "NEEDS_REVIEW",
    }
  }
  return fallbackCategory(row)
}

function readStoredCategoryOverride(
  fills: Map<string, SourceRow>,
  spuCode: string,
): CategoryOverride | null {
  const stored = getStoredFill(fills, spuCode, "category")
  if (!stored) return null
  const payload = parseJsonObject(stored.payload_json)
  const categoryId = asPositiveNumber(payload.category_id)
  const productTypeId = asPositiveNumber(payload.product_type_id)
  if (!categoryId || !productTypeId) return null
  return {
    category_id: categoryId,
    product_type_id: productTypeId,
    category_name: normalizeText(payload.category_name) || normalizeText(stored.field_value) || null,
    path: normalizeText(payload.path) || null,
    source: normalizeText(stored.source) || "MANUAL_CATEGORY",
    status: "READY",
  }
}

function isSheinOpenApiUnsupportedSuitCategory(categoryName?: unknown, categoryPath?: unknown) {
  const text = `${normalizeText(categoryName)} ${normalizeText(categoryPath)}`
  return text.includes("套装")
}

function sheinOpenApiSuitCategoryMessage(categoryName?: unknown) {
  const name = normalizeText(categoryName)
  return `SHEIN OpenAPI 暂不支持套装商品发布${name ? `（当前类目：${name}）` : ""}，请改为非套装叶子类目，或拆分部件后再发布。`
}

function singleItemCategoryNameFromSuitCategory(categoryName?: unknown) {
  const name = normalizeText(categoryName)
  if (!name.includes("套装")) return ""
  return name
    .replace(/polo套装/gi, "Polo衫")
    .replace(/Polo套装/g, "Polo衫")
    .replace(/T恤套装/g, "T恤")
    .replace(/卫衣套装/g, "卫衣")
    .replace(/外套套装/g, "外套")
    .replace(/背心套装/g, "背心")
    .replace(/衬衫套装/g, "衬衫")
    .replace(/毛衣套装/g, "毛衣")
    .replace(/牛仔套装/g, "牛仔上衣")
    .replace(/套装/g, "")
    .trim()
}

function resolveOpenApiSingleItemCategory(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const targetName = singleItemCategoryNameFromSuitCategory(listing.platform_category_name)
  if (!targetName) return null
  const rootPath = normalizeText(listing.platform_category_path).split(" > ").slice(0, 2).join(" > ")
  const category = db.prepare(`
    select *
    from channel_category
    where platform = 'SHEIN'
      and last_category = 1
      and category_name = ?
      and path not like '%套装%'
      and (? = '' or path like ?)
    order by length(path)
    limit 1
  `).get(targetName, rootPath, `${rootPath}%`) as SourceRow | undefined
  return category ?? null
}

function sanitizeSingleItemTitleCn(title: unknown, categoryName?: unknown) {
  let text = normalizeText(title)
    .replace(/两件套|二件套|[0-9一二两三四五六七八九十]+件套|套装/g, "")
    .replace(/\s+/g, " ")
    .replace(/[，,、；;]+$/g, "")
    .trim()
  const category = normalizeText(categoryName)
  if (category.includes("卫衣") && !text.includes("卫衣")) text = `${text}卫衣`
  if (category.includes("T恤") && !text.includes("T恤")) text = `${text}T恤`
  if (category.includes("衬衫") && !text.includes("衬衫")) text = `${text}衬衫`
  if (category.includes("外套") && !text.includes("外套")) text = `${text}外套`
  return text
}

function sanitizeSingleItemTitleEn(title: unknown, categoryName?: unknown) {
  let text = normalizeText(title)
    .replace(/\b(two|2)[-\s]?piece\b/gi, "")
    .replace(/\b(set|sets|outfit|outfits)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–—,;:]+$/g, "")
    .trim()
  const category = normalizeText(categoryName)
  if (category.includes("卫衣") && !/sweatshirt|hoodie/i.test(text)) text = `${text} Sweatshirt`
  if (category.includes("T恤") && !/t-?shirt/i.test(text)) text = `${text} T-Shirt`
  return text
}

function englishBrandName(value: unknown) {
  const text = normalizeText(value)
  const lower = text.toLowerCase()
  if (text.includes("迷你巴拉") || lower.includes("mini bala")) return "Mini Bala"
  if (text.includes("巴拉巴拉") || lower.includes("balabala")) return "Balabala"
  if (text.includes("森马") || lower.includes("semir")) return "Semir"
  if (/^[\x20-\x7E]+$/.test(text)) return text
  return "Balabala"
}

function compactBrandText(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s\-_/（）()]+/g, "")
}

function brandRuleMatches(rule: SourceRow, candidates: string[]) {
  const normalized = new Set(candidates.map(compactBrandText).filter(Boolean))
  if (normalized.size === 0) return false
  const ruleValues = [
    rule.brand_code,
    rule.brand_name,
    rule.local_brand_name,
    ...parseJsonArray(rule.aliases_json),
  ]
  return ruleValues.some((value) => normalized.has(compactBrandText(value)))
}

function resolveSheinBrandCode(db: ReturnType<typeof getDb>, listing: SourceRow) {
  const candidates = uniqueStrings([
    listing.brand_code,
    listing.brand_name,
    listing.deepdraw_brand_name,
    englishBrandName(listing.brand_name),
    englishBrandName(listing.deepdraw_brand_name),
  ])
  if (candidates.length === 0) return ""
  const rows = db.prepare(`
    select brand_code, brand_name, local_brand_name, aliases_json
    from shein_brand_rule
    where platform = 'SHEIN'
      and status = 'ACTIVE'
    order by id
  `).all() as SourceRow[]
  const matched = rows.find((row) => brandRuleMatches(row, candidates))
  return normalizeText(matched?.brand_code) || normalizeText(listing.brand_code)
}

function englishColorName(value: unknown) {
  const text = normalizeText(value)
  if (!text) return ""
  const ascii = text.replace(/[0-9]+/g, "").replace(/[^\x20-\x7E]+/g, " ").trim()
  if (ascii && !/[\u4e00-\u9fff]/.test(text)) return ascii
  if (/黑/.test(text)) return "Black"
  if (/白/.test(text)) return "White"
  if (/藏青|藏蓝/.test(text)) return "Navy"
  if (/黄|姜黄/.test(text)) return "Yellow"
  if (/红/.test(text)) return "Red"
  if (/粉/.test(text)) return "Pink"
  if (/蓝/.test(text)) return "Blue"
  if (/绿/.test(text)) return "Green"
  if (/灰/.test(text)) return "Gray"
  if (/紫/.test(text)) return "Purple"
  if (/橙/.test(text)) return "Orange"
  if (/棕|咖|褐/.test(text)) return "Brown"
  if (/卡其/.test(text)) return "Khaki"
  return ""
}

function buildDimensionFieldGroups(fieldGroups: FieldGroup[]): DimensionFieldGroup[] {
  const byName = new Map(fieldGroups.map((group) => [group.group, group]))
  const basic = byName.get("基础资料")
  const attributes = byName.get("商品属性")
  const content = byName.get("内容资料")
  const specs = byName.get("规格与图片")

  return [
    {
      dimension: "SPU",
      title: "SPU 款维度",
      description: "款级字段用于商品主体、类目、标题、品牌、商品属性和内容资料；SKU 级价格包装统一放在尺码发布表维护。",
      groups: [basic, attributes, content].filter((group): group is FieldGroup => Boolean(group)),
    },
    {
      dimension: "SKC",
      title: "SKC 款色维度",
      description: "款色级字段用于颜色枚举、每个 SKC 的主图/方形图/色块图，以及是否发布该款色。",
      groups: specs ? [{
        group: "SKC 款色维度",
        fields: specs.fields.filter((field) => ["skc_code", "skc_image", "color"].includes(field.key)),
      }] : [],
    },
    {
      dimension: "SKU",
      title: "SKC-SKU 发布尺码与价格包装",
      description: "SKU 级字段用于 MDM SKU、发布尺码、条码、供货价、毛重和包装尺寸；页面按 SKC 聚合维护。",
      groups: [],
    },
  ]
}

function getRequiredAttributes(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  if (!categoryId || !productTypeId) return []
  const rows = db.prepare(`
    select
      platform,
      category_id,
      product_type_id,
      attribute_id,
      attribute_name,
      attribute_name_en,
      attribute_type,
      attribute_label,
      attribute_mode,
      attribute_status,
      attribute_input_num,
      values_count,
      sample_values_json
    from channel_required_attribute
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
    union all
    select
      platform,
      ? as category_id,
      product_type_id,
      attribute_id,
      attribute_name,
      attribute_name_en,
      attribute_type,
      attribute_label,
      attribute_mode,
      attribute_status,
      attribute_input_num,
      values_count,
      values_json as sample_values_json
    from channel_attribute attr
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_type = 1
      and not exists (
        select 1
        from channel_required_attribute req
        where req.platform = attr.platform
          and req.category_id = ?
          and req.product_type_id = attr.product_type_id
          and req.attribute_id = attr.attribute_id
      )
    order by attribute_type, attribute_id
  `).all(categoryId, productTypeId, categoryId, productTypeId, categoryId) as SourceRow[]

  const valueStmt = db.prepare(`
    select attribute_value_id, attribute_value, attribute_value_en
    from channel_attribute_value
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = ?
      and coalesce(is_black, 0) = 0
    order by is_show desc, attribute_value
    limit 120
  `)

  return rows.map((row) => ({
    category_id: Number(row.category_id),
    product_type_id: Number(row.product_type_id),
    attribute_id: Number(row.attribute_id),
    attribute_name: normalizeText(row.attribute_name),
    attribute_name_en: row.attribute_name_en ? String(row.attribute_name_en) : null,
    attribute_type: asNumber(row.attribute_type),
    attribute_label: asNumber(row.attribute_label),
    attribute_mode: asNumber(row.attribute_mode),
    attribute_status: asNumber(row.attribute_status),
    attribute_input_num: asNumber(row.attribute_input_num),
    values_count: Number(row.values_count ?? 0),
    sample_values_json: normalizeText(row.sample_values_json),
    values: valueStmt.all(productTypeId, Number(row.attribute_id)) as AttributeValue[],
  })) as RequiredAttribute[]
}

function findEnumOption(values: AttributeValue[], needles: string[]) {
  const normalized = needles.map((item) => normalizeText(item)).filter(Boolean)
  for (const needle of normalized) {
    const numericId = Number(needle)
    if (Number.isFinite(numericId)) {
      const exactId = values.find((value) => Number(value.attribute_value_id) === numericId)
      if (exactId) return exactId
    }
  }
  for (const needle of normalized) {
    const exact = values.find((value) => value.attribute_value === needle)
    if (exact) return exact
  }
  for (const needle of normalized) {
    const contains = values.find((value) => value.attribute_value.includes(needle))
    if (contains) return contains
  }
  return null
}

function findEnumValue(values: AttributeValue[], needles: string[]) {
  return findEnumOption(values, needles)?.attribute_value ?? ""
}

function renderKindForAttribute(attr: RequiredAttribute): FillField["render_kind"] {
  if (attr.attribute_mode === 1) return "multi_enum"
  if (attr.attribute_mode === 2 || attr.attribute_mode === 3) return "single_enum"
  if (attr.attribute_mode === 4) return "enum_with_text"
  return attr.values.length > 0 ? "single_enum" : "text"
}

function attributeFillMeta(attr: RequiredAttribute) {
  return {
    attribute_id: attr.attribute_id,
    attribute_type: attr.attribute_type,
    attribute_label: attr.attribute_label,
    attribute_mode: attr.attribute_mode,
    attribute_status: attr.attribute_status,
    attribute_input_num: attr.attribute_input_num,
    render_kind: renderKindForAttribute(attr),
    options: attr.values.slice(0, 160),
  }
}

function saleColorNeedles(colorName: unknown) {
  const text = normalizeText(colorName)
  const needles: string[] = []
  if (!text) return needles
  if (/黑/.test(text)) needles.push("黑色")
  if (/白/.test(text)) needles.push("白色")
  if (/黄|30435/.test(text)) needles.push("黄色", "浅黄", "芥末黄")
  if (/红/.test(text)) needles.push("红色")
  if (/粉/.test(text)) needles.push("粉色")
  if (/蓝|藏青|牛仔/.test(text)) needles.push("蓝色", "藏蓝色")
  if (/绿/.test(text)) needles.push("绿色")
  if (/灰/.test(text)) needles.push("灰色")
  if (/紫/.test(text)) needles.push("紫色")
  if (/橙/.test(text)) needles.push("橙色")
  if (/棕|咖|褐/.test(text)) needles.push("棕色", "咖啡棕")
  if (/卡其/.test(text)) needles.push("卡其色")
  needles.push(text.replace(/\d+/g, ""), text)
  return needles
}

function saleAttributePayload(attr: RequiredAttribute | undefined, value: AttributeValue | null, fallbackValue?: string) {
  if (!attr) return {}
  if (value) {
    return {
      attribute_id: attr.attribute_id,
      attribute_value_id: value.attribute_value_id,
      attribute_value: value.attribute_value,
      attribute_value_en: value.attribute_value_en,
    }
  }
  return {
    attribute_id: attr.attribute_id,
    custom_attribute_value: normalizeText(fallbackValue),
    language: "zh-cn",
  }
}

function existingSalePayloadIsValid(payload: Record<string, unknown>, attr: RequiredAttribute | undefined) {
  if (!attr) return false
  const attributeId = asPositiveNumber(payload.attribute_id)
  if (attributeId && attributeId !== attr.attribute_id) return false
  const valueId = asPositiveNumber(payload.attribute_value_id)
  if (valueId) return attr.values.some((value) => Number(value.attribute_value_id) === valueId)
  return Boolean(normalizeText(payload.custom_attribute_value))
}

function inferMaterialValue(attr: RequiredAttribute, context: string) {
  const needles: string[] = []
  if (/卫衣/.test(context)) needles.push("织物", "棉", "聚酯纤维")
  if (/棉混纺|棉混/.test(context)) needles.push("织物")
  if (/棉/.test(context)) needles.push("织物", "棉布", "棉")
  if (/聚酯|涤纶/.test(context)) needles.push("聚酯纤维")
  if (/粘纤|粘胶/.test(context)) needles.push("粘胶纤维", "粘纤")
  if (/腈纶/.test(context)) needles.push("腈纶")
  if (/锦纶|尼龙/.test(context)) needles.push("锦纶")
  if (/氨纶/.test(context)) needles.push("氨纶")
  return findEnumValue(attr.values, needles)
}

function inferAttributeValue({
  attr,
  row,
  fields,
}: {
  attr: RequiredAttribute
  row: SourceRow
  fields: Map<string, string>
}) {
  const name = attr.attribute_name
  const context = [
    row.spu_name,
    row.deepdraw_title,
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.fabric_type_name,
    row.model_name,
    row.length_name,
    row.composition,
    firstField(fields, ["材质成分", "25面料成分", "材质", "面料", "详情页面料"]),
    firstField(fields, ["图案", "风格", "厚薄", "25弹力指数", "25厚薄指数"]),
  ].map(normalizeText).join(" ")

  if (name === "尺寸") return ""
  if (name.includes("成分") || name.includes("材质")) {
    return inferMaterialValue(attr, context)
  }
  if (name.includes("织造方式")) {
    if (context.includes("梭织")) return findEnumValue(attr.values, ["梭织"])
    if (context.includes("针织") || context.includes("毛织") || context.includes("毛衫")) {
      return findEnumValue(attr.values, ["针织"])
    }
  }
  if (name.includes("袖长")) {
    if (context.includes("长袖") || context.includes("开襟")) return findEnumValue(attr.values, ["长袖"])
    if (context.includes("短袖")) return findEnumValue(attr.values, ["短袖"])
    if (context.includes("无袖")) return findEnumValue(attr.values, ["无袖"])
  }
  if (name.includes("护理")) {
    return findEnumValue(attr.values, ["可机洗,不可干洗", "手洗,不可干洗", "机洗", "手洗"])
  }
  if (name.includes("数量")) {
    return findEnumValue(attr.values, ["件", "1件"])
  }
  if (name.includes("面料类型")) {
    if (context.includes("卫衣")) return findEnumValue(attr.values, ["卫衣布", "针织平纹", "其他卫衣布"])
    return findEnumValue(attr.values, ["针织平纹", "梭织平纹", "其他工艺"])
  }
  if (name.includes("关税")) {
    if (context.includes("连衣裙")) return findEnumValue(attr.values, ["连衣裙", "未列明关税种类"])
    if (context.includes("衬衫")) return findEnumValue(attr.values, ["休闲衬衫", "衬衫", "未列明关税种类"])
    if (context.includes("卫衣")) return findEnumValue(attr.values, ["卫衣", "未列明关税种类"])
    if (context.includes("开襟") || context.includes("毛衫")) {
      return findEnumValue(attr.values, ["开襟衫", "毛衣", "未列明关税种类"])
    }
    return findEnumValue(attr.values, ["未列明关税种类"])
  }
  if (name.includes("加绒")) {
    return findEnumValue(attr.values, [context.includes("加绒") ? "是" : "否"])
  }
  if (name.includes("透明")) {
    return findEnumValue(attr.values, [context.includes("透明") ? "是" : "否"])
  }
  if (name.includes("深浅撞色")) {
    return findEnumValue(attr.values, [context.includes("撞色") ? "是" : "否"])
  }
  if (name.includes("面料弹性")) {
    return findEnumValue(attr.values, [
      context.includes("高弹") ? "高弹" : "",
      context.includes("弹") && !context.includes("无弹") ? "中弹" : "无弹",
      "低弹",
    ])
  }
  if (name.includes("合身") || name.includes("版型")) {
    return findEnumValue(attr.values, [
      context.includes("宽松") ? "宽松" : "",
      context.includes("标准") ? "常规" : "",
      "常规",
    ])
  }
  if (name === "长度") {
    return findEnumValue(attr.values, [
      context.includes("全P") ? "常规" : "",
      "常规",
    ])
  }
  if (name === "年龄") {
    return findEnumValue(attr.values, ["幼童", "婴幼儿", "儿童", "3-7Y"])
  }
  if (name === "所在地") {
    return findEnumValue(attr.values, ["ALL/全球/所有", "All"])
  }
  if (name.includes("企划风格")) {
    return findEnumValue(attr.values, ["Casual休闲", "休闲"])
  }
  if (name.includes("纱线") || name.includes("织法")) {
    return findEnumValue(attr.values, ["其他"])
  }
  if (name.includes("针数")) {
    return findEnumValue(attr.values, ["细针", "粗针", "其他"])
  }
  return ""
}

function fieldStatus(value: unknown, fallback: FillField["status"] = "READY") {
  return normalizeText(value) ? fallback : "MISSING"
}

function buildRow({
  db,
  row,
  sizeConversions,
  discounts,
  weights,
  fills,
  categoryOverride,
}: {
  db: ReturnType<typeof getDb>
  row: SourceRow
  sizeConversions: ReturnType<typeof activeSizeConversions>
  discounts: Map<string, SourceRow>
  weights: Map<string, SourceRow>
  fills: Map<string, SourceRow>
  categoryOverride?: CategoryOverride | null
}): ReadinessRow {
  const spuCode = String(row.spu_code)
  const fields = getProductFields(db, row.content_package_id)
  const mdmSkcs = getSkcs(db, row.id)
  const mdmSkus = getSkus(db, row.id)
  const skcs = mdmSkcs.length ? mdmSkcs : getContentSkcs(db, row.content_package_id)
  const skus = mdmSkus.length ? mdmSkus : getContentSkus(db, row.content_package_id)
  const category = categoryOverride ?? readStoredCategoryOverride(fills, spuCode) ?? resolveCategory(row)
  const attrs = getRequiredAttributes(db, category.category_id, category.product_type_id)
  const priceConfig = getSheinPriceConfig(db)
  const discountRule = discounts.get(spuCode)
  const discount = Number(discountRule?.discount ?? priceConfig.defaultDiscount)
  const priceTag = Number(row.price_tag ?? 0)
  const costPrice = priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null
  const retailUsd = priceTag > 0 ? Math.round(priceTag / priceConfig.usdExchangeRate) : null
  const pkg = resolvePackageRule(db, row)
  const storedTitleCn = getStoredFill(fills, spuCode, "title_cn")
  const titleCn = normalizeText(storedTitleCn?.field_value) || normalizeText(row.deepdraw_title) || normalizeText(row.listing_title_cn) || normalizeText(row.spu_name)
  const storedTitleEn = getStoredFill(fills, spuCode, "title_en")
  const titleEn = normalizeText(storedTitleEn?.field_value) || normalizeText(row.listing_title_en)
  const compositionText = firstField(fields, ["材质成分", "25面料成分", "详情页面料", "材质"])
  const weightCoverage = skus.filter((sku) => weights.has(`sku:${normalizeText(sku.sku_code)}`)).length
  const sizeCoverage = skus.filter((sku) => {
    const codeKeys = sizeKeys(sku.size_code)
    const nameKeys = sizeKeys(sku.size_name)
    return codeKeys.some((key) => sizeConversions.byCode.has(key) || sizeConversions.byName.has(key))
      || nameKeys.some((key) => sizeConversions.byCode.has(key) || sizeConversions.byName.has(key))
  }).length
  const imageCoverage = skcs.filter((skc) =>
    normalizeText(skc.tmall_color_image_url) || normalizeText(skc.tmall_color_url) || normalizeText(skc.pic_url),
  ).length

  const baseFields: FillField[] = [
    {
      key: "category",
      label: "SHEIN 类目",
      value: category.category_name,
      source: category.source,
      status: category.category_id ? (category.status === "READY" ? "READY" : "WARNING") : "MISSING",
      note: category.path,
    },
    { key: "title_cn", label: "中文标题", value: titleCn, source: storedTitleCn ? String(storedTitleCn.source ?? "MANUAL") : "DEEPDRAW", status: fieldStatus(titleCn) },
    {
      key: "title_en",
      label: "英文标题",
      value: titleEn,
      source: storedTitleEn ? String(storedTitleEn.source ?? "MANUAL") : "AI/人工",
      status: titleEn ? "READY" : "NEEDS_AI",
      note: titleEn ? null : "深绘英文标题为空，可由 AI 基于中文标题生成",
    },
    { key: "brand", label: "商品品牌", value: row.deepdraw_brand_name ?? row.brand_name, source: "MDM/DEEPDRAW", status: fieldStatus(row.deepdraw_brand_name ?? row.brand_name) },
    { key: "product_line", label: "产品线描述", value: row.product_line_name, source: "MDM", status: fieldStatus(row.product_line_name) },
    { key: "gender", label: "性别描述", value: row.gender_name, source: "MDM", status: fieldStatus(row.gender_name) },
    { key: "season", label: "季节描述", value: row.season_name, source: "MDM", status: fieldStatus(row.season_name) },
    { key: "middle_class", label: "中类描述", value: row.middle_class_name, source: "MDM", status: fieldStatus(row.middle_class_name) },
    { key: "subclass", label: "小类描述", value: row.subclass_name, source: "MDM", status: fieldStatus(row.subclass_name) },
    { key: "fabric_type", label: "面种描述", value: row.fabric_type_name, source: "MDM", status: fieldStatus(row.fabric_type_name) },
  ]

  const skuFields: FillField[] = [
    {
      key: "skc_code",
      label: "SKC 编码",
      value: `${skcs.length} 个款色`,
      source: "MDM",
      status: skcs.length > 0 ? "READY" : "MISSING",
    },
    {
      key: "skc_image",
      label: "SKC 图片",
      value: `${imageCoverage}/${skcs.length}`,
      source: "TMALL COLOR_BLOCK/COLOR",
      status: imageCoverage === skcs.length && skcs.length > 0 ? "READY" : "MISSING",
      note: "优先使用 TMALL 款色图，避免取错模特图",
    },
    {
      key: "color",
      label: "颜色编码/描述",
      value: skcs.map((skc) => `${normalizeText(skc.color_code)} ${normalizeText(skc.color_name)}`.trim()).join(" | "),
      source: "MDM",
      status: skcs.some((skc) => normalizeText(skc.color_name)) ? "READY" : "MISSING",
    },
    {
      key: "size_conversion",
      label: "SHEIN尺码-录入",
      value: `${sizeCoverage}/${skus.length}`,
      source: "尺码转换规则",
      status: sizeCoverage === skus.length && skus.length > 0 ? "READY" : "MISSING",
    },
    {
      key: "supplier_sku",
      label: "商家 SKU/企业码",
      value: `${skus.filter((sku) => normalizeText(sku.inner_code) || normalizeText(sku.supplier_product_code) || normalizeText(sku.sku_code)).length}/${skus.length}`,
      source: "MDM",
      status: skus.length > 0 ? "READY" : "MISSING",
    },
  ]

  const priceFields: FillField[] = [
    { key: "list_price", label: "挂牌单价", value: priceTag || null, source: "MDM", status: priceTag > 0 ? "READY" : "MISSING" },
    {
      key: "supply_discount",
      label: "供货折扣",
      value: discount,
      source: discountRule ? "款号价格规则" : "默认规则",
      status: discountRule ? "WARNING" : "READY",
      note: discountRule ? "命中款号级折扣" : `默认 ${priceConfig.defaultDiscount}`,
    },
    { key: "supply_price", label: "供货价(人民币)", value: costPrice, source: "公式", status: costPrice ? "READY" : "MISSING" },
    { key: "retail_usd", label: "建议零售价(美元)", value: retailUsd, source: "公式", status: retailUsd ? "READY" : "MISSING", note: `Round(挂牌单价/${priceConfig.usdExchangeRate},0)` },
    { key: "package_size", label: "含包装尺寸", value: pkg.size, source: pkg.source, status: "READY", note: pkg.type },
    {
      key: "package_weight",
      label: "产品毛重/g",
      value: `${weightCoverage}/${skus.length}`,
      source: "产品毛重报表",
      status: weightCoverage === skus.length && skus.length > 0 ? "READY" : "MISSING",
      note: "当前观远 BI 毛重报表未导入，可先人工补齐或等待表格",
    },
  ]

  const attributeFields: FillField[] = attrs.filter((attr) => attr.attribute_type !== 1).map((attr) => {
    const key = `attr:${attr.attribute_id}`
    const stored = getStoredFill(fills, spuCode, key)
    if (stored) {
      const storedValue = stored.field_value == null ? "" : String(stored.field_value)
      const storedValues = renderKindForAttribute(attr) === "multi_enum" ? parseJsonList(storedValue) : [storedValue]
      const storedValid = (attr.values ?? []).length === 0
        || storedValues.every((value) => optionForFieldValue({ ...attributeFillMeta(attr), key, label: attr.attribute_name, value: storedValue, source: String(stored.source ?? "MANUAL"), status: "READY" }, normalizeText(value)))
      if (!storedValid) {
        const inferred = inferAttributeValue({ attr, row, fields })
        if (inferred) {
          const source = attr.attribute_name.includes("织造方式")
            ? "MDM"
            : attr.attribute_name.includes("成分") || attr.attribute_name.includes("材质")
              ? "DEEPDRAW"
              : "RULE"
          return {
            key,
            label: attr.attribute_name,
            value: inferred,
            source,
            status: "READY",
            confidence: 0.72,
            note: "已忽略旧类目下失效的枚举值，按当前类目重新推荐。",
            ...attributeFillMeta(attr),
          }
        }
      }
      return {
        key,
        label: attr.attribute_name,
        value: storedValue || null,
        source: String(stored.source ?? "MANUAL"),
        status: "READY",
        confidence: stored.confidence == null ? null : Number(stored.confidence),
        ...attributeFillMeta(attr),
      }
    }

    if (attr.attribute_name === "颜色" && attr.attribute_type === 1 && attr.attribute_label === 1) {
      const matched = skcs
        .map((skc) => findEnumOption(attr.values, saleColorNeedles(skc.color_name)))
        .filter((option): option is AttributeValue => Boolean(option))
      return {
        key,
        label: attr.attribute_name,
        value: matched.length ? `${matched.length}/${skcs.length} SKC 已匹配` : null,
        source: "SKC 颜色枚举",
        status: matched.length === skcs.length && skcs.length > 0 ? "READY" : "MISSING",
        confidence: matched.length ? 0.82 : null,
        note: "主销售属性按 SKC 维度保存，草稿详情中逐个款色确认。",
        ...attributeFillMeta(attr),
      }
    }

    if (attr.attribute_name === "尺寸" && sizeCoverage === skus.length && skus.length > 0) {
      return {
        key,
        label: attr.attribute_name,
        value: `${sizeCoverage}/${skus.length} SKU 已匹配`,
        source: "尺码转换规则",
        status: "READY",
        confidence: 1,
        note: "尺寸销售属性由 SKU 级 SHEIN 尺码转换填充",
        ...attributeFillMeta(attr),
      }
    }

    const inferred = inferAttributeValue({ attr, row, fields })
    if (inferred) {
      const source = attr.attribute_name.includes("织造方式")
        ? "MDM"
        : attr.attribute_name.includes("成分") || attr.attribute_name.includes("材质")
          ? "DEEPDRAW"
          : "RULE"
      return {
        key,
        label: attr.attribute_name,
        value: inferred,
        source,
        status: "READY",
        confidence: 0.72,
        ...attributeFillMeta(attr),
      }
    }

    return {
      key,
      label: attr.attribute_name,
      value: null,
      source: "AI/人工",
      status: attr.attribute_name === "尺寸" ? "MISSING" : "NEEDS_AI",
      note: attr.attribute_name === "尺寸"
        ? "由 SKU 尺码转换明细补齐"
        : "需要结合商品档案和枚举值判断",
      ...attributeFillMeta(attr),
    }
  })

  const contentFields: FillField[] = [
    {
      key: "composition_text",
      label: "成分来源",
      value: compactText(compositionText, 120),
      source: "DEEPDRAW",
      status: compositionText ? "READY" : "MISSING",
    },
    {
      key: "size_chart",
      label: "尺码表",
      value: fields.size > 0 ? `${fields.size} 个字段` : "深绘尺码表",
      source: "DEEPDRAW",
      status: "READY",
    },
  ]

  const fieldGroups = [
    { group: "基础资料", fields: baseFields },
    { group: "规格与图片", fields: skuFields },
    { group: "价格与包装", fields: priceFields },
    { group: "商品属性", fields: attributeFields },
    { group: "内容资料", fields: contentFields },
  ]

  for (const group of fieldGroups) {
    for (const field of group.fields) {
      const stored = getStoredFill(fills, spuCode, field.key)
      if (!stored) continue
      const storedValue = stored.field_value == null ? "" : String(stored.field_value)
      const storedValues = field.render_kind === "multi_enum" ? parseJsonList(storedValue) : [storedValue]
      if (
        field.key.startsWith("attr:")
        && (field.options ?? []).length > 0
        && storedValues.some((value) => !optionForFieldValue(field, normalizeText(value)))
      ) {
        continue
      }
      field.value = storedValue || null
      field.source = String(stored.source ?? "MANUAL")
      field.status = "READY"
      field.confidence = stored.confidence == null ? field.confidence : Number(stored.confidence)
      field.note = storedFillNote(stored, field.note)
    }
  }

  const allFields = fieldGroups.flatMap((group) => group.fields)
  const ready = allFields.filter((field) => field.status === "READY" || field.status === "WARNING").length
  const missing = allFields.filter((field) => field.status === "MISSING").length
  const needsAi = allFields.filter((field) => field.status === "NEEDS_AI").length
  const blockingIssues = allFields
    .filter((field) => field.status === "MISSING" || field.status === "NEEDS_AI")
    .map((field) => field.label)
  if (isSheinOpenApiUnsupportedSuitCategory(category.category_name, category.path)) {
    blockingIssues.unshift("SHEIN OpenAPI 套装类目限制")
  }

  return {
    product_spu_id: Number(row.id),
    spu_code: spuCode,
    spu_name: row.spu_name ? String(row.spu_name) : null,
    title_cn: titleCn || null,
    title_en: titleEn || null,
    brand_name: normalizeText(row.deepdraw_brand_name) || normalizeText(row.brand_name) || null,
    category,
    skcs,
    sku_count: skus.length,
    completeness: allFields.length ? Math.round((ready / allFields.length) * 100) : 0,
    ready_field_count: ready,
    total_field_count: allFields.length,
    missing_field_count: missing,
    needs_ai_count: needsAi,
    field_groups: fieldGroups,
    dimension_field_groups: buildDimensionFieldGroups(fieldGroups),
    manual_fields: attributeFields.filter((field) => field.status === "NEEDS_AI"),
    blocking_issues: blockingIssues,
  }
}

function buildReadiness(c: { req: { query: (name: string) => string | undefined } }) {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const bucketRows = bucketReadinessRows(db, c, { limit, offset })
  const rows = bucketRows.rows
    .map((row) => getSourceProductRow(db, String(row.spu_code)))
    .filter((row): row is SourceRow => Boolean(row))
  const total = bucketRows.total
  const spuCodes = rows.map((row) => String(row.spu_code))
  const sizeConversions = activeSizeConversions(db)
  const discounts = activeDiscounts(db)
  const weights = activeWeights(db)
  const fills = activeFillMap(db, spuCodes)

  const items = rows.map((row) =>
    buildRow({
      db,
      row,
      sizeConversions,
      discounts,
      weights,
      fills,
    }),
  )
  const summary = {
    total_products: total,
    ready_products: items.filter((item) => item.blocking_issues.length === 0).length,
    needs_ai_products: items.filter((item) => item.needs_ai_count > 0).length,
    blocking_products: items.filter((item) => item.blocking_issues.length > 0).length,
    missing_field_count: items.reduce((sum, item) => sum + item.missing_field_count, 0),
    needs_ai_count: items.reduce((sum, item) => sum + item.needs_ai_count, 0),
    avg_completeness: items.length
      ? Math.round(items.reduce((sum, item) => sum + item.completeness, 0) / items.length)
      : 0,
  }

  return {
    summary,
    items,
    pagination: {
      total,
      limit,
      offset,
    },
  }
}

function getDefaultChannelAccount(db: ReturnType<typeof getDb>, platform = "SHEIN") {
  const existing = db.prepare(`
    select *
    from channel_account
    where platform = ?
      and status = 'ACTIVE'
    order by id
    limit 1
  `).get(platform) as SourceRow | undefined
  if (existing) return existing

  const result = db.prepare(`
    insert into channel_account (
      platform,
      account_name,
      business_mode,
      status,
      credential_ref,
      raw_payload_json,
      updated_at
    )
    values (?, ?, 'FULL_MANAGED', 'ACTIVE', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(platform, `${platform} 默认全托管账号`, `${platform}_DEFAULT`, JSON.stringify({ source: "api_default" }))

  return db.prepare("select * from channel_account where id = ?").get(result.lastInsertRowid) as SourceRow
}

function getSourceProductRow(db: ReturnType<typeof getDb>, spuCode: string) {
  return productRows(db, undefined, spuCode, { limit: 20, offset: 0 }).find((row) => normalizeText(row.spu_code) === spuCode) ?? null
}

function getReadinessBySpu(db: ReturnType<typeof getDb>, spuCode: string) {
  const row = getSourceProductRow(db, spuCode)
  if (!row) return null
  const sizeConversions = activeSizeConversions(db)
  const discounts = activeDiscounts(db)
  const weights = activeWeights(db)
  const fills = activeFillMap(db, [spuCode])
  return buildRow({ db, row, sizeConversions, discounts, weights, fills })
}

function listingCategoryOverride(listing: ListingRow): CategoryOverride | null {
  const categoryId = asPositiveNumber(listing.platform_category_id)
  const productTypeId = asPositiveNumber(listing.product_type_id)
  if (!categoryId || !productTypeId) return null
  return {
    category_id: categoryId,
    product_type_id: productTypeId,
    category_name: normalizeText(listing.platform_category_name) || null,
    path: normalizeText(listing.platform_category_path) || null,
    source: "LISTING_CATEGORY",
    status: "READY",
  }
}

function getReadinessForListing(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const row = getSourceProductRow(db, listing.spu_code)
  if (!row) return null
  const sizeConversions = activeSizeConversions(db)
  const discounts = activeDiscounts(db)
  const weights = activeWeights(db)
  const fills = activeFillMap(db, [listing.spu_code])
  const override = listingCategoryOverride(listing)
  return buildRow({ db, row, sizeConversions, discounts, weights, fills, categoryOverride: override })
}

function validationStatusFor(row: ReadinessRow) {
  if (row.blocking_issues.length > 0) return "FAILED"
  return "PASSED"
}

function listingStatusFor(row: ReadinessRow) {
  if (row.blocking_issues.length > 0) return "NEEDS_ENRICHMENT"
  return "READY_TO_VALIDATE"
}

function draftBlockingIssues(db: ReturnType<typeof getDb>, listingId: number, row: ReadinessRow) {
  const issues = new Set(row.blocking_issues)
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) return Array.from(issues)

  const skcs = db.prepare(`
    select *
    from listing_skc
    where listing_id = ?
    order by skc_code
  `).all(listingId) as SourceRow[]
  const skus = db.prepare(`
    select sku.*, skc.skc_code
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    where skc.listing_id = ?
  `).all(listingId) as SourceRow[]
  const selectedSkus = skus.filter((sku) => Number(sku.selected_for_publish ?? 1) === 1)
  if (selectedSkus.length > 0 && selectedSkus.every((sku) => asPositiveNumber(sku.package_weight_g))) {
    issues.delete("产品毛重/g")
  } else if (row.blocking_issues.includes("产品毛重/g")) {
    issues.add("产品毛重/g")
  }

  const selectedSkcs = skcs.filter((skc) => Number(skc.selected_for_publish ?? 1) === 1)
  if (selectedSkcs.length > 0) {
    const imageRequirements = getImageRequirements(db, listing)
    const checklist = getImageChecklist(skcs, getListingAssets(db, listingId), imageRequirements)
    const hasImageBlocker = checklist.some((item) =>
      item.selected_for_publish && (item.status !== "READY" || !item.confirmed),
    )
    if (!hasImageBlocker) issues.delete("SKC 图片")
    else if (row.blocking_issues.includes("SKC 图片")) issues.add("SKC 图片")
  }

  return Array.from(issues)
}

function persistListingValidation(db: ReturnType<typeof getDb>, listingId: number, row: ReadinessRow) {
  db.prepare("delete from listing_validation_result where listing_id = ?").run(listingId)
  const issues = draftBlockingIssues(db, listingId, row)
  const insert = db.prepare(`
    insert into listing_validation_result (
      listing_id,
      severity,
      module,
      field_key,
      owner_type,
      owner_id,
      message,
      suggestion
    )
    values (?, ?, ?, ?, 'LISTING', ?, ?, ?)
  `)
  for (const issue of issues) {
    const isSuitCategoryBlocker = issue === "SHEIN OpenAPI 套装类目限制"
    insert.run(
      listingId,
      "ERROR",
      isSuitCategoryBlocker ? "SHEIN_OPENAPI" : "PRE_PUBLISH",
      issue,
      listingId,
      isSuitCategoryBlocker ? sheinOpenApiSuitCategoryMessage(row.category.category_name) : `${issue} 未补齐`,
      isSuitCategoryBlocker ? "使用“转为 OpenAPI 单品发布”切换到非套装叶子类目，或先拆分部件。" : "在单款详情页人工编辑，或使用 AI 补齐后重新保存。",
    )
  }
  db.prepare(`
    update listing
    set status = ?,
      validation_status = ?,
      completeness = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    issues.length > 0 ? "NEEDS_ENRICHMENT" : "READY_TO_VALIDATE",
    issues.length > 0 ? "FAILED" : "PASSED",
    issues.length > 0 ? row.completeness : 100,
    listingId,
  )
}

function upsertListingChildren(db: ReturnType<typeof getDb>, listingId: number, sourceRow: SourceRow, readiness: ReadinessRow) {
  const mdmSkcs = getSkcs(db, sourceRow.id)
  const contentSkcs = mdmSkcs.length ? [] : getContentSkcs(db, sourceRow.content_package_id)
  const skcs = mdmSkcs.length ? mdmSkcs : contentSkcs
  const mdmSkus = getSkus(db, sourceRow.id)
  const contentSkus = mdmSkus.length ? [] : getContentSkus(db, sourceRow.content_package_id)
  const skus = mdmSkus.length ? mdmSkus : contentSkus
  const sourceSupplierSkuBySkuCode = buildPublishSupplierSkuMap(skus)
  const sizeConversions = activeSizeConversions(db)
  const priceConfig = getSheinPriceConfig(db)
  const discount = Number(activeDiscounts(db).get(readiness.spu_code)?.discount ?? priceConfig.defaultDiscount)
  const weights = activeWeights(db)
  const pkg = resolvePackageRule(db, sourceRow)
  const attrs = getRequiredAttributes(db, readiness.category.category_id, readiness.category.product_type_id)
  const colorAttr = attrs.find((attr) => attr.attribute_type === 1 && attr.attribute_label === 1)
  const sizeAttr = attrs.find((attr) => attr.attribute_type === 1 && attr.attribute_name === "尺寸")

  const skcInsert = db.prepare(`
    insert into listing_skc (
      listing_id,
      product_skc_id,
      skc_code,
      supplier_code,
      skc_title,
      color_name,
      image_url,
      color_attribute_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(listing_id, skc_code) do update set
      supplier_code = excluded.supplier_code,
      skc_title = excluded.skc_title,
      color_name = excluded.color_name,
      image_url = excluded.image_url,
      color_attribute_payload_json = excluded.color_attribute_payload_json,
      selected_for_publish = listing_skc.selected_for_publish,
      image_confirmed = listing_skc.image_confirmed,
      updated_at = excluded.updated_at
  `)
  const skuInsert = db.prepare(`
    insert into listing_sku (
      listing_skc_id,
      product_sku_id,
      sku_code,
      supplier_sku,
      supplier_barcode,
      size_name,
      shein_size_value,
      size_attribute_payload_json,
      package_length_cm,
      package_width_cm,
      package_height_cm,
      package_weight_g,
      cost_price,
      currency,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(listing_skc_id, sku_code) do update set
      supplier_sku = excluded.supplier_sku,
      supplier_barcode = excluded.supplier_barcode,
      size_name = excluded.size_name,
      shein_size_value = excluded.shein_size_value,
      size_attribute_payload_json = excluded.size_attribute_payload_json,
      package_length_cm = excluded.package_length_cm,
      package_width_cm = excluded.package_width_cm,
      package_height_cm = excluded.package_height_cm,
      package_weight_g = excluded.package_weight_g,
      cost_price = excluded.cost_price,
      currency = excluded.currency,
      updated_at = excluded.updated_at
  `)

  for (const skc of skcs) {
    const skcCode = normalizeText(skc.skc_code)
    if (!skcCode) continue
    const imageUrl = normalizeText(skc.tmall_color_image_url) || normalizeText(skc.tmall_color_url) || normalizeText(skc.pic_url)
    const colorOption = colorAttr ? findEnumOption(colorAttr.values, saleColorNeedles(skc.color_name)) : null
    const existingSkc = db.prepare(`
      select color_attribute_payload_json
      from listing_skc
      where listing_id = ?
        and skc_code = ?
    `).get(listingId, skcCode) as SourceRow | undefined
    const existingColorPayload = parseJsonObject(existingSkc?.color_attribute_payload_json)
    const inferredColorPayload = {
      color_name: normalizeText(skc.color_name),
      image_url: imageUrl,
      ...saleAttributePayload(colorAttr, colorOption, normalizeText(skc.color_name)),
    }
    const colorPayload = existingSalePayloadIsValid(existingColorPayload, colorAttr)
      ? {
        ...inferredColorPayload,
        ...existingColorPayload,
        attribute_id: colorAttr?.attribute_id ?? existingColorPayload.attribute_id,
        color_name: normalizeText(skc.color_name),
        image_url: imageUrl,
      }
      : inferredColorPayload
    skcInsert.run(
      listingId,
      mdmSkcs.length ? asNumber(skc.id) : null,
      skcCode,
      skcCode,
      normalizeText(skc.skc_name) || normalizeText(readiness.title_cn) || skcCode,
      normalizeText(skc.color_name),
      imageUrl,
      JSON.stringify(colorPayload),
    )
    const listingSkc = db.prepare(`
      select id
      from listing_skc
      where listing_id = ?
        and skc_code = ?
    `).get(listingId, skcCode) as SourceRow
    for (const sku of skus.filter((item) => normalizeText(item.skc_code) === skcCode)) {
      const skuCode = normalizeText(sku.sku_code)
      if (!skuCode) continue
      const sizeCodeKeys = sizeKeys(sku.size_code)
      const sizeNameKeys = sizeKeys(sku.size_name)
      const sizeRule = sizeCodeKeys.map((key) => sizeConversions.byCode.get(key) ?? sizeConversions.byName.get(key)).find(Boolean)
        ?? sizeNameKeys.map((key) => sizeConversions.byName.get(key) ?? sizeConversions.byCode.get(key)).find(Boolean)
      const sheinSize = normalizeText(sizeRule?.shein_size_value)
      const sizeOption = sizeAttr ? findEnumOption(sizeAttr.values, [sheinSize, sku.size_name, sku.size_code]) : null
      const priceTag = Number(sku.price_tag ?? sourceRow.price_tag ?? 0)
      const costPrice = priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null
      const weightRow = weights.get(`sku:${skuCode}`)
      const existingSku = db.prepare(`
        select
          shein_size_value,
          size_attribute_payload_json,
          package_weight_g,
          cost_price,
          currency,
          package_length_cm,
          package_width_cm,
          package_height_cm
        from listing_sku
        where listing_skc_id = ?
          and sku_code = ?
      `).get(Number(listingSkc.id), skuCode) as SourceRow | undefined
      const existingSizePayload = parseJsonObject(existingSku?.size_attribute_payload_json)
      const existingSizeIsValid = existingSalePayloadIsValid(existingSizePayload, sizeAttr)
      const finalSheinSize = existingSizeIsValid ? (normalizeText(existingSku?.shein_size_value) || sheinSize) : sheinSize
      const finalSizePayload = existingSizeIsValid
        ? {
          local_size_code: normalizeText(sku.size_code),
          local_size_name: normalizeText(sku.size_name),
          ...existingSizePayload,
          attribute_id: sizeAttr?.attribute_id ?? existingSizePayload.attribute_id,
          shein_size_value: finalSheinSize,
        }
        : {
          local_size_code: normalizeText(sku.size_code),
          local_size_name: normalizeText(sku.size_name),
          shein_size_value: sheinSize,
          attribute_id: sizeAttr?.attribute_id ?? null,
          attribute_value_id: sizeOption?.attribute_value_id ?? null,
          attribute_value: sizeOption?.attribute_value ?? sheinSize,
        }
      const packageWeight = asPositiveNumber(existingSku?.package_weight_g) ?? asPositiveNumber(weightRow?.package_weight_g)
      const packageLength = asPositiveNumber(existingSku?.package_length_cm) ?? pkg.length
      const packageWidth = asPositiveNumber(existingSku?.package_width_cm) ?? pkg.width
      const packageHeight = asPositiveNumber(existingSku?.package_height_cm) ?? pkg.height
      const finalCostPrice = asPositiveNumber(existingSku?.cost_price) ?? costPrice
      const finalCurrency = normalizeText(existingSku?.currency) || "CNY"
      const priceConfirmed = finalCostPrice ? 1 : 0
      skuInsert.run(
        Number(listingSkc.id),
        mdmSkus.length ? asNumber(sku.id) : null,
        skuCode,
        sourceSupplierSkuBySkuCode.get(skuCode) ?? publishSupplierSku(sku),
        normalizeText(sku.ean_code) || normalizeText(sku.barcode),
        normalizeText(sku.size_name) || normalizeText(sku.size_code),
        finalSheinSize,
        JSON.stringify(finalSizePayload),
        packageLength,
        packageWidth,
        packageHeight,
        packageWeight,
        finalCostPrice,
        finalCurrency,
      )
      db.prepare(`
        update listing_sku
        set price_confirmed = case
            when price_confirmed = 1 then 1
            else ?
          end,
          price_confirmed_at = case
            when price_confirmed = 1 then price_confirmed_at
            when ? = 1 then strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            else price_confirmed_at
          end
        where listing_skc_id = ?
          and sku_code = ?
      `).run(priceConfirmed, priceConfirmed, Number(listingSkc.id), skuCode)
    }
  }
}

function applyDraftSkcSelection(
  db: ReturnType<typeof getDb>,
  listingId: number,
  skcCodes: string[] | undefined,
) {
  if (!skcCodes) return
  const selected = new Set(skcCodes.map(normalizeText).filter(Boolean))
  if (selected.size === 0) return
  db.prepare(`
    update listing_skc
    set selected_for_publish = case when skc_code in (
        ${Array.from(selected).map(() => "?").join(",")}
      ) then 1 else 0 end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where listing_id = ?
  `).run(...Array.from(selected), listingId)
  db.prepare(`
    update listing_sku
    set selected_for_publish = case when listing_skc_id in (
        select id
        from listing_skc
        where listing_id = ?
          and selected_for_publish = 1
      ) then 1 else 0 end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where listing_skc_id in (
      select id from listing_skc where listing_id = ?
    )
  `).run(listingId, listingId)
}

function nextPublishUnitNo(db: ReturnType<typeof getDb>, platform: string, accountId: number, productSpuId: number) {
  const row = db.prepare(`
    select coalesce(max(
      case
        when publish_unit_no like 'draft-%'
        then cast(substr(publish_unit_no, 7) as integer)
        else 0
      end
    ), 0) + 1 as next_no
    from listing
    where platform = ?
      and channel_account_id = ?
      and product_spu_id = ?
  `).get(platform, accountId, productSpuId) as SourceRow | undefined
  return `draft-${String(Number(row?.next_no ?? 1)).padStart(3, "0")}`
}

function updateBucketLatestForSpu(db: ReturnType<typeof getDb>, spuCode: string) {
  const latest = db.prepare(`
    select
      listing.*,
      (
        select max(version.version_no)
        from listing_publish_version version
        where version.listing_id = listing.id
      ) as latest_version_no
    from listing
    where listing.platform = 'SHEIN'
      and listing.spu_code = ?
    order by listing.updated_at desc, listing.id desc
    limit 1
  `).get(spuCode) as SourceRow | undefined
  if (!latest) {
    db.prepare(`
      update shein_product_bucket
      set bucket_status = case when bucket_status = 'PUBLISHED' then bucket_status else 'IN_BUCKET' end,
        latest_listing_id = null,
        latest_version_no = null,
        latest_publish_status = null,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where spu_code = ?
    `).run(spuCode)
    return
  }
  const latestStatus = normalizeText(latest.status)
  db.prepare(`
    update shein_product_bucket
    set bucket_status = ?,
      latest_listing_id = ?,
      latest_version_no = ?,
      latest_publish_status = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where spu_code = ?
  `).run(
    latestStatus === "PUBLISH_SUBMITTED" ? "PUBLISHED" : "DRAFTED",
    latest.id,
    latest.latest_version_no ?? null,
    latestStatus,
    spuCode,
  )
}

function createDraft(
  db: ReturnType<typeof getDb>,
  row: ReadinessRow,
  sourceRow: SourceRow,
  platform = "SHEIN",
  skcCodes?: string[],
) {
  const account = getDefaultChannelAccount(db, platform)
  const publishUnitNo = nextPublishUnitNo(db, platform, Number(account.id), row.product_spu_id)

  const result = db.prepare(`
    insert into listing (
      platform,
      channel_account_id,
      business_mode,
      product_spu_id,
      spu_code,
      listing_batch_no,
      publish_unit_no,
      title,
      platform_category_id,
      product_type_id,
      platform_category_name,
      platform_category_path,
      default_language,
      currency,
      status,
      validation_status,
      completeness,
      source_snapshot_json,
      created_by
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 'CNY', ?, ?, ?, ?, 'codex')
  `).run(
    platform,
    account.id,
    normalizeText(account.business_mode) || "FULL_MANAGED",
    row.product_spu_id,
    row.spu_code,
    `PREPUB-${nowIso().slice(0, 10).replaceAll("-", "")}`,
    publishUnitNo,
    row.title_en || row.title_cn || row.spu_name,
    row.category.category_id,
    row.category.product_type_id,
    row.category.category_name,
    row.category.path,
    listingStatusFor(row),
    validationStatusFor(row),
    row.completeness,
    JSON.stringify(row),
  )
  const listing = db.prepare("select * from listing where id = ?").get(result.lastInsertRowid) as ListingRow
  upsertListingChildren(db, listing.id, sourceRow, row)
  applyDraftSkcSelection(db, listing.id, skcCodes)
  persistListingValidation(db, listing.id, row)
  const version = createPublishVersion({
    db,
    listing,
    readiness: row,
    changeSummary: "创建发布草稿",
  })
  return { listing, version, created: true }
}

function refreshListingAfterFill(db: ReturnType<typeof getDb>, listingId: number, changeSummary: string) {
  const existing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!existing) return null
  const sourceRow = getSourceProductRow(db, existing.spu_code)
  const readiness = getReadinessForListing(db, existing)
  if (!sourceRow || !readiness) return null
  db.prepare(`
    update listing
    set title = ?,
        platform_category_id = ?,
        product_type_id = ?,
        platform_category_name = ?,
        platform_category_path = ?,
        status = ?,
        validation_status = ?,
        completeness = ?,
        source_snapshot_json = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    readiness.title_en || readiness.title_cn || readiness.spu_name,
    readiness.category.category_id,
    readiness.category.product_type_id,
    readiness.category.category_name,
    readiness.category.path,
    listingStatusFor(readiness),
    validationStatusFor(readiness),
    readiness.completeness,
    JSON.stringify(readiness),
    listingId,
  )
  upsertListingChildren(db, listingId, sourceRow, readiness)
  persistListingValidation(db, listingId, readiness)
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow
  const version = createPublishVersion({
    db,
    listing,
    readiness,
    changeSummary,
  })
  return { listing, readiness, version }
}

function selectedListingSkcWhere(alias = "skc", options?: { onlySelected?: boolean }) {
  return options?.onlySelected ? `and ${alias}.selected_for_publish = 1` : ""
}

function selectedListingSkuWhere(alias = "sku", skcAlias = "skc", options?: { onlySelected?: boolean }) {
  if (!options?.onlySelected) return ""
  return `and ${alias}.selected_for_publish = 1 and ${skcAlias}.selected_for_publish = 1`
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function skcDisplayTokens(skc: SourceRow, spuCode?: unknown) {
  const skcCode = normalizeText(skc.skc_code)
  const normalizedSpu = normalizeText(spuCode)
  const suffix = normalizedSpu && skcCode.startsWith(normalizedSpu)
    ? skcCode.slice(normalizedSpu.length)
    : ""
  const numericSuffix = normalizeText(skcCode.match(/(\d{3,8})$/)?.[1])
  return uniqueStrings([
    skc.color_name,
    suffix,
    numericSuffix,
  ]).filter((token) => token.length >= 3)
}

function withoutUnselectedSkcColors(title: unknown, selectedSkcs: SourceRow[], allSkcs: SourceRow[], spuCode?: unknown) {
  let text = normalizeText(title)
  if (!text || selectedSkcs.length === 0 || allSkcs.length <= selectedSkcs.length) return text
  const selectedCodes = new Set(selectedSkcs.map((skc) => normalizeText(skc.skc_code)).filter(Boolean))
  const selectedTokens = new Set(selectedSkcs.flatMap((skc) => skcDisplayTokens(skc, spuCode)))
  const removableTokens = uniqueStrings(
    allSkcs
      .filter((skc) => !selectedCodes.has(normalizeText(skc.skc_code)))
      .flatMap((skc) => skcDisplayTokens(skc, spuCode)),
  )
    .filter((token) => !selectedTokens.has(token))
    .sort((left, right) => right.length - left.length)

  for (const token of removableTokens) {
    const pattern = new RegExp(`\\s*(?:[/／|、,，;；]+\\s*)?${regexEscape(token)}(?:\\s*[/／|、,，;；]+)?`, "g")
    text = text.replace(pattern, " ")
  }
  return text
    .replace(/\s*([/／|、,，;；])\s*(?=$)/g, "")
    .replace(/(^|\s)([/／|、,，;；])\s*/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function displayListingForSelectedSkcs<T extends SourceRow>(listing: T, selectedSkcs: SourceRow[], allSkcs: SourceRow[]) {
  if (selectedSkcs.length === 0 || allSkcs.length <= selectedSkcs.length) return listing
  return {
    ...listing,
    title: withoutUnselectedSkcColors(listing.title, selectedSkcs, allSkcs, listing.spu_code),
  }
}

function displayFieldForSelectedSkcs(field: FillField, selectedSkcs: SourceRow[], allSkcs: SourceRow[], spuCode: unknown): FillField {
  if (!["title_en", "title_cn", "color", "skc_code", "skc_image"].includes(field.key)) return field
  if (field.key === "title_en" || field.key === "title_cn") {
    return {
      ...field,
      value: withoutUnselectedSkcColors(field.value, selectedSkcs, allSkcs, spuCode) || field.value,
    }
  }
  if (field.key === "skc_code") {
    return {
      ...field,
      value: `${selectedSkcs.length} 个款色`,
      status: selectedSkcs.length > 0 ? "READY" : "MISSING",
    }
  }
  if (field.key === "skc_image") {
    const selectedWithImage = selectedSkcs.filter((skc) =>
      normalizeText(skc.tmall_color_image_url)
      || normalizeText(skc.tmall_color_url)
      || normalizeText(skc.pic_url)
      || normalizeText(skc.image_url),
    ).length
    return {
      ...field,
      value: `${selectedWithImage}/${selectedSkcs.length}`,
      status: selectedWithImage === selectedSkcs.length && selectedSkcs.length > 0 ? "READY" : "MISSING",
    }
  }
  return {
    ...field,
    value: selectedSkcs.map((skc) =>
      `${normalizeText(skc.color_code)} ${normalizeText(skc.color_name)}`.trim(),
    ).filter(Boolean).join(" | "),
    status: selectedSkcs.some((skc) => normalizeText(skc.color_name)) ? "READY" : "MISSING",
  }
}

function displayReadinessForSelectedSkcs(readiness: ReadinessRow, selectedSkcs: SourceRow[], allSkcs: SourceRow[]) {
  if (selectedSkcs.length === 0 || allSkcs.length <= selectedSkcs.length) return readiness
  const fieldGroups = readiness.field_groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => displayFieldForSelectedSkcs(field, selectedSkcs, allSkcs, readiness.spu_code)),
  }))
  return {
    ...readiness,
    title_cn: withoutUnselectedSkcColors(readiness.title_cn, selectedSkcs, allSkcs, readiness.spu_code) || readiness.title_cn,
    title_en: withoutUnselectedSkcColors(readiness.title_en, selectedSkcs, allSkcs, readiness.spu_code) || readiness.title_en,
    skcs: selectedSkcs,
    field_groups: fieldGroups,
    dimension_field_groups: buildDimensionFieldGroups(fieldGroups),
  }
}

function summarizeListing(db: ReturnType<typeof getDb>, listing: SourceRow, options?: { onlySelected?: boolean }) {
  const allSkcs = db.prepare(`
    select skc_code, color_name, image_url, selected_for_publish
    from listing_skc
    where listing_id = ?
    order by selected_for_publish desc, skc_code
  `).all(listing.id) as SourceRow[]
  const selectedSkcs = options?.onlySelected
    ? allSkcs.filter((skc) => Number(skc.selected_for_publish ?? 1) === 1)
    : allSkcs
  const latestVersion = db.prepare(`
    select version_no, status, change_summary, created_at
    from listing_publish_version
    where listing_id = ?
    order by version_no desc
    limit 1
  `).get(listing.id) as SourceRow | undefined
  const stats = db.prepare(`
    select
      count(*) as issue_count,
      sum(case when severity = 'ERROR' and resolved = 0 then 1 else 0 end) as blocker_count
    from listing_validation_result
    where listing_id = ?
  `).get(listing.id) as SourceRow
  const skcCount = db.prepare(`
    select count(*) as count
    from listing_skc skc
    where skc.listing_id = ?
      ${selectedListingSkcWhere("skc", options)}
  `).get(listing.id) as SourceRow
  const skuCount = db.prepare(`
    select count(*) as count
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    where skc.listing_id = ?
      ${selectedListingSkuWhere("sku", "skc", options)}
  `).get(listing.id) as SourceRow
  const hero = db.prepare(`
    select
      skc.image_url,
      skc.color_name,
      skc.skc_code
    from listing_skc skc
    where skc.listing_id = ?
      ${selectedListingSkcWhere("skc", options)}
      and coalesce(skc.image_url, '') <> ''
    order by skc.selected_for_publish desc, skc.skc_code
    limit 1
  `).get(listing.id) as SourceRow | undefined
  const skcPreview = db.prepare(`
    select skc_code, color_name, image_url
    from listing_skc skc
    where skc.listing_id = ?
      ${selectedListingSkcWhere("skc", options)}
    order by skc.selected_for_publish desc, skc.skc_code
    limit 4
  `).all(listing.id) as SourceRow[]
  return {
    ...displayListingForSelectedSkcs(listing, selectedSkcs, allSkcs),
    latest_version_no: latestVersion?.version_no ?? null,
    latest_version_status: latestVersion?.status ?? null,
    latest_version_summary: latestVersion?.change_summary ?? null,
    issue_count: Number(stats.issue_count ?? 0),
    blocker_count: Number(stats.blocker_count ?? 0),
    skc_count: Number(skcCount.count ?? 0),
    sku_count: Number(skuCount.count ?? 0),
    hero_image_url: hero?.image_url ?? null,
    hero_color_name: hero?.color_name ?? null,
    hero_skc_code: hero?.skc_code ?? null,
    skc_preview: skcPreview,
  }
}

function getSizeTables(db: ReturnType<typeof getDb>, listing: ListingRow) {
  return {
    size_tables: db.prepare(`
      select *
      from product_content_size_table
      where spu_code = ?
      order by table_index
    `).all(listing.spu_code) as SourceRow[],
    size_table_rows: db.prepare(`
      select *
      from product_content_size_table_row
      where spu_code = ?
      order by table_index, row_index
    `).all(listing.spu_code) as SourceRow[],
  }
}

function getMappedSizeCharts({
  db,
  listing,
  sizeTables,
  sizeTableRows,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  sizeTables: SourceRow[]
  sizeTableRows: SourceRow[]
}) {
  const attrs = getRequiredAttributes(db, asNumber(listing.platform_category_id), asNumber(listing.product_type_id))
  const sizeAttr = attrs.find((attr) => attr.attribute_name.includes("尺寸"))
  const categoryName = normalizeText(listing.platform_category_name)
  const wantsSet = categoryName.includes("套装")
  const isChannelSpecificTable = (table: SourceRow) =>
    /唯品会|抖音|天猫|得物|京东|淘宝|渠道/.test(normalizeText(table.field_name))
  const usableTables = sizeTables.filter((table) => !isChannelSpecificTable(table))
  const firstByName = (pattern: RegExp) =>
    usableTables.find((table) => pattern.test(normalizeText(table.field_name)))
  const genericTable = usableTables.find((table) => /通用/.test(normalizeText(table.field_name)))
    ?? usableTables[0]

  let tables: SourceRow[]
  if (wantsSet) {
    const upperTable = firstByName(/上衣|上装|卫衣|衬衫|针织|开襟/)
    const lowerTable = firstByName(/裤|下装/)
    tables = [upperTable, lowerTable].filter((table): table is SourceRow => Boolean(table))
    if (tables.length === 0) tables = usableTables.slice(0, 2)
    if (tables.length === 1 && genericTable && Number(genericTable.id) !== Number(tables[0]?.id)) {
      tables = [...tables, genericTable]
    }
  } else if (categoryName.includes("裤")) {
    tables = [firstByName(/裤|下装/) ?? genericTable].filter((table): table is SourceRow => Boolean(table))
  } else {
    tables = [firstByName(/上衣|上装|卫衣|衬衫|针织|开襟|连衣裙|裙/) ?? genericTable].filter((table): table is SourceRow => Boolean(table))
  }
  if (tables.length === 0) tables = sizeTables.slice(0, wantsSet ? 2 : 1)

  return tables.map((table, index) => {
    const rows = sizeTableRows.filter((row) => Number(row.table_index) === Number(table.table_index))
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(parseJsonObject(row.values_json)))))
    return {
      template_key: `size_chart_template:${listing.product_type_id ?? "unknown"}:${index + 1}`,
      template_name: wantsSet
        ? index === 0 ? "SHEIN 类目尺码模板 - 上衣" : "SHEIN 类目尺码模板 - 下装"
        : "SHEIN 类目尺码模板",
      source_table_id: table.id,
      source_table_index: table.table_index,
      source_field_name: table.field_name,
      source_label: "深绘来源表",
      target_label: "SHEIN 类目尺码模板",
      shein_attribute_id: sizeAttr?.attribute_id ?? null,
      shein_attribute_name: sizeAttr?.attribute_name ?? "尺寸",
      columns,
      rows,
      status: rows.length > 0 ? "READY" : "MISSING",
      note: wantsSet
        ? "套装类目优先映射上衣/裤子两张深绘尺码表，发布时需与勾选 SKU 尺码保持一致。"
        : "按所选 SHEIN 类目只展示需要映射的尺码模板，不再平铺全部深绘表。",
    }
  })
}

function standardBool(value: unknown) {
  if (value == null) return null
  if (typeof value === "boolean") return value
  const text = normalizeText(value).toLowerCase()
  if (!text) return null
  if (["1", "true", "yes"].includes(text)) return true
  if (["0", "false", "no"].includes(text)) return false
  return null
}

function publishFieldRules(standard: SourceRow | undefined) {
  const rules = new Map<string, PublishFieldRule>()
  for (const item of parseJsonArray(standard?.fill_in_standard_json)) {
    const object = parseJsonObject(item)
    const fieldKey = normalizeText(object.field_key)
    if (!fieldKey) continue
    rules.set(fieldKey, {
      module: normalizeText(object.module),
      field_key: fieldKey,
      required: standardBool(object.required),
      show: standardBool(object.show),
    })
  }
  return rules
}

function fieldShown(publishFields: Map<string, PublishFieldRule>, fieldKey: string, fallback = false) {
  return publishFields.get(fieldKey)?.show ?? fallback
}

function fieldRequired(publishFields: Map<string, PublishFieldRule>, fieldKey: string, fallback = false) {
  return publishFields.get(fieldKey)?.required ?? fallback
}

function getImageRequirements(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const categoryId = asPositiveNumber(listing.platform_category_id)
  if (!categoryId) return buildPictureRequirements([])
  let rows = db.prepare(`
    select field_key, is_true
    from channel_picture_config
    where platform = 'SHEIN'
      and standard_scope = 'category'
      and category_id = ?
    order by field_key
  `).all(categoryId) as PictureConfigRow[]

  if (rows.length === 0) {
    const standard = db.prepare(`
      select picture_config_json
      from channel_publish_standard
      where platform = 'SHEIN'
        and category_id = ?
      order by updated_at desc
      limit 1
    `).get(categoryId) as SourceRow | undefined
    rows = parseJsonArray(standard?.picture_config_json)
      .map((item) => parseJsonObject(item))
      .map((item) => ({ field_key: normalizeText(item.field_key), is_true: boolConfigValue(item.is_true as number | boolean | null) }))
      .filter((item) => item.field_key)
  }

  return buildPictureRequirements(rows)
}

function getListingAssets(db: ReturnType<typeof getDb>, listingId: number, options?: { onlySelected?: boolean }) {
  return db.prepare(`
    select
      asset.*,
      skc.skc_code as listing_skc_code,
      skc.color_name
    from listing_asset asset
    left join listing_skc skc on skc.id = asset.listing_skc_id
    where asset.listing_id = ?
      ${options?.onlySelected ? "and (asset.listing_skc_id is null or skc.selected_for_publish = 1)" : ""}
    order by coalesce(asset.skc_code, skc.skc_code), asset.image_sort, asset.id
  `).all(listingId) as SourceRow[]
}

function assetMatchesRequirement(asset: SourceRow, requirement: PictureRequirement) {
  const assetType = normalizeText(asset.asset_type)
  return requirement.asset_types.includes(assetType)
}

function getImageChecklist(skcs: SourceRow[], assets: SourceRow[], imageRequirements: PictureRequirement[] = []) {
  const visibleSkcRequirements = imageRequirements.filter((item) => item.level === "SKC" && item.show !== 0)
  return skcs.map((skc) => {
    const skcCode = normalizeText(skc.skc_code)
    const selected = Number(skc.selected_for_publish ?? 1) === 1
    const skcAssets = assets.filter((asset) => normalizeText(asset.skc_code) === skcCode)
    const hasTmallColor = Boolean(normalizeText(skc.image_url))
    const hasImportedMain = skcAssets.some((asset) => ["MAIN", "COLOR_BLOCK", "COLOR"].includes(normalizeText(asset.asset_type)))
    const detailCount = skcAssets.filter((asset) => normalizeText(asset.asset_type).includes("DETAIL")).length
    const missing: string[] = []
    const requirementStatus = visibleSkcRequirements.map((requirement) => {
      const requirementAssets = skcAssets.filter((asset) => assetMatchesRequirement(asset, requirement))
      const hasSourceColor = requirement.requirement_key === "SKC_COLOR_BLOCK" && hasTmallColor
      const hasSourceMain = requirement.requirement_key === "SKC_DETAIL" && (hasTmallColor || hasImportedMain)
      const required = requirement.required === 1
        || (requirement.requirement_key === "SKC_COLOR_BLOCK" && skcs.filter((item) => Number(item.selected_for_publish ?? 1) === 1).length > 1)
      const satisfied = !selected || !required || hasSourceColor || hasSourceMain || requirementAssets.length > 0
      if (selected && required && !satisfied) missing.push(requirement.name)
      return {
        requirement_key: requirement.requirement_key,
        name: requirement.name,
        level: requirement.level,
        required,
        asset_count: requirementAssets.length + (hasSourceColor || hasSourceMain ? 1 : 0),
        status: satisfied ? "READY" : "MISSING",
      }
    })
    return {
      skc_code: skcCode,
      color_name: skc.color_name ?? null,
      selected_for_publish: selected,
      has_tmall_color_image: hasTmallColor,
      imported_asset_count: skcAssets.length,
      detail_asset_count: detailCount,
      confirmed: Number(skc.image_confirmed ?? 0) === 1,
      status: missing.length === 0 ? "READY" : "MISSING",
      missing,
      requirements: requirementStatus,
    }
  })
}

function getListingDetail(db: ReturnType<typeof getDb>, listingId: number) {
  const listing = db.prepare(`
    select
      listing.*,
      account.account_name,
      spu.spu_name,
      spu.brand_code,
      spu.brand_name,
      spu.year,
      spu.season_name,
      spu.product_line_name,
      spu.middle_class_name,
      spu.subclass_name,
      spu.gender_name,
      spu.age_group_name,
      spu.price_tag,
      spu.pic_url as spu_image_url
    from listing
    join channel_account account on account.id = listing.channel_account_id
    join product_spu spu on spu.id = listing.product_spu_id
    where listing.id = ?
  `).get(listingId) as ListingRow | undefined
  if (!listing) return null

  const readiness = getReadinessForListing(db, listing)
  if (!readiness) return null
  const skcs = db.prepare(`
    select skc.*
    from listing_skc skc
    where skc.listing_id = ?
      ${selectedListingSkcWhere("skc", { onlySelected: true })}
    order by skc.skc_code
  `).all(listingId) as SourceRow[]
  const skus = db.prepare(`
    select
      sku.*,
      skc.skc_code,
      skc.color_name,
      skc.image_url as skc_image_url,
      source_sku.inner_code as source_inner_code,
      source_sku.supplier_product_code as source_supplier_product_code,
      source_sku.ean_code as source_ean_code
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    left join product_sku source_sku on source_sku.id = sku.product_sku_id
    where skc.listing_id = ?
      ${selectedListingSkuWhere("sku", "skc", { onlySelected: true })}
    order by skc.skc_code, sku.size_name, sku.sku_code
  `).all(listingId) as SourceRow[]
  const validationIssues = db.prepare(`
    select *
    from listing_validation_result
    where listing_id = ?
    order by severity, id
  `).all(listingId) as SourceRow[]
  const versions = db.prepare(`
    select *
    from listing_publish_version
    where listing_id = ?
    order by version_no desc
  `).all(listingId) as SourceRow[]
  const publishTasks = db.prepare(`
    select *
    from listing_publish_task
    where listing_id = ?
    order by id desc
    limit 10
  `).all(listingId) as SourceRow[]
  const platformIdentities = db.prepare(`
    select identity.*
    from platform_identity identity
    where identity.platform = ?
      and identity.channel_account_id = ?
      and (
        (identity.local_type = 'listing' and identity.local_id = ?)
	        or (identity.local_type = 'listing_skc' and identity.local_id in (
	          select id
	          from listing_skc skc
	          where skc.listing_id = ?
	            ${selectedListingSkcWhere("skc", { onlySelected: true })}
	        ))
	        or (identity.local_type = 'listing_sku' and identity.local_id in (
	          select sku.id
	          from listing_sku sku
	          join listing_skc skc on skc.id = sku.listing_skc_id
	          where skc.listing_id = ?
	            ${selectedListingSkuWhere("sku", "skc", { onlySelected: true })}
	        ))
	      )
    order by
      case identity.local_type when 'listing' then 1 when 'listing_skc' then 2 else 3 end,
      identity.id
  `).all(listing.platform, listing.channel_account_id, listing.id, listing.id, listing.id) as SourceRow[]
  const { size_tables, size_table_rows } = getSizeTables(db, listing)
  const assets = getListingAssets(db, listingId, { onlySelected: true })
  const mapped_size_charts = getMappedSizeCharts({ db, listing, sizeTables: size_tables, sizeTableRows: size_table_rows })
  const image_requirements = getImageRequirements(db, listing)
  const sale_attributes = getRequiredAttributes(db, asNumber(listing.platform_category_id), asNumber(listing.product_type_id))
    .filter((attr) => attr.attribute_type === 1)

  const selectedReadiness = displayReadinessForSelectedSkcs(readiness, skcs, readiness.skcs)
  return {
    listing: summarizeListing(db, listing, { onlySelected: true }),
    readiness: selectedReadiness,
    dimension_field_groups: selectedReadiness.dimension_field_groups,
    skcs,
    skus,
    assets,
    sale_attributes,
    image_requirements,
    image_checklist: getImageChecklist(skcs, assets, image_requirements),
    size_tables,
    size_table_rows,
    mapped_size_charts,
    validation_issues: validationIssues,
    versions,
    publish_tasks: publishTasks,
    platform_identities: platformIdentities,
  }
}

function heuristicEnglishTitle(row: ReadinessRow) {
  const title = normalizeText(row.title_cn || row.spu_name)
  const category = normalizeText(row.category.category_name)
  const colorText = row.skcs.map((skc) => englishColorName(skc.color_name)).filter(Boolean).slice(0, 3).join("/")
  const brand = englishBrandName(row.brand_name)
  let productName = "Kids Clothing"
  if (category.includes("衬衫") || title.includes("衬衫")) productName = "Girls Long Sleeve Shirt"
  else if (category.includes("连衣裙") || title.includes("连衣裙") || title.includes("裙")) productName = "Girls Dress"
  else if (category.includes("卫衣套装") || title.includes("连帽") || title.includes("卫衣")) {
    productName = category.includes("女童") ? "Girls Hooded Two-Piece Sweatshirt Set" : "Boys Hooded Two-Piece Sweatshirt Set"
  }
  else if (category.includes("套装") || title.includes("套装")) {
    productName = category.includes("女童") ? "Girls Two-Piece Outfit Set" : "Boys Two-Piece Outfit Set"
  }
  else if (category.includes("开襟") || title.includes("毛衫") || title.includes("毛衣")) productName = "Kids Cardigan Sweater"

  const season = title.includes("夏") ? "Summer" : title.includes("春") ? "Spring" : ""
  return [brand, productName, season, colorText].filter(Boolean).join(" ")
}

async function callAiTranslateTitle(row: ReadinessRow) {
  const config = resolveAiConfig()
  if (!config.apiKey) return heuristicEnglishTitle(row)
  const requestBody = JSON.stringify({
    model: config.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "你是跨境童装英文标题编辑，只输出适合 SHEIN 发品的简洁英文标题。",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "把中文商品标题翻译成英文标题，保留品牌、性别、品类和季节，不要堆砌关键词。",
          output_schema: { title_en: "英文标题" },
          product: {
            spu_code: row.spu_code,
            brand: row.brand_name,
            title_cn: row.title_cn,
            category: row.category,
            colors: row.skcs.map((skc) => skc.color_name).filter(Boolean),
          },
        }),
      },
    ],
  })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await sleep(800)
          continue
        }
        throw new Error(`AI translate failed: HTTP ${response.status}`)
      }
      const content = responseMessageContent(payload)
      const parsed = JSON.parse(extractJsonText(content)) as { title_en?: string }
      return normalizeText(parsed.title_en) || heuristicEnglishTitle(row)
    }
    catch (error) {
      if (attempt === 0 && retryableAiError(error)) {
        await sleep(800)
        continue
      }
      throw error
    }
    finally {
      clearTimeout(timeout)
    }
  }
  return heuristicEnglishTitle(row)
}

function persistCategoryFill(db: ReturnType<typeof getDb>, row: ReadinessRow) {
  if (!row.category.category_id || !row.category.product_type_id) return
  persistFill({
    db,
    spuCode: row.spu_code,
    fieldKey: "category",
    fieldLabel: "SHEIN 类目",
    fieldValue: row.category.category_name || String(row.category.category_id),
    source: "AI_CATEGORY_RULE",
    confidence: row.category.source === "RULE_FALLBACK" ? 0.76 : 0.88,
    payload: {
      category_id: row.category.category_id,
      product_type_id: row.category.product_type_id,
      category_name: row.category.category_name,
      path: row.category.path,
      source: row.category.source,
    },
  })
}

function shouldAutoApplyCategory(category: ReadinessRow["category"]) {
  const source = normalizeText(category.source)
  return Boolean(
    category.category_id
    && category.product_type_id
    && category.status === "READY"
    && !["AI_CATEGORY", "RULE_FALLBACK", "MISSING"].includes(source),
  )
}

function normalizeFillFieldValue(fieldKey: unknown, fieldLabel: unknown, value: unknown) {
  const key = normalizeText(fieldKey)
  const label = normalizeText(fieldLabel)
  if (key.startsWith("attr:") && (label.includes("材质") || label.includes("成分"))) {
    return normalizeMaterialValue(value)
  }
  return normalizeText(value)
}

function heuristicAiValue(field: FillField, row: ReadinessRow) {
  if (field.key === "title_en") return heuristicEnglishTitle(row)

  const optionValues = (field.options ?? []).map((item) => item.attribute_value)
  const text = [
    row.spu_name,
    row.title_cn,
    row.category.category_name,
    row.skcs.map((skc) => skc.color_name).join(" "),
  ].map(normalizeText).join(" ")

  const pick = (needles: string[]) => findEnumValue(
    (field.options ?? []) as AttributeValue[],
    needles,
  )

  if (field.label.includes("图案")) return pick(["纯色", "条纹", "格子"]) || optionValues[0] || ""
  if (field.label.includes("风格") || field.label.includes("企划")) return pick(["Casual休闲", "休闲"]) || optionValues[0] || ""
  if (field.label.includes("透明")) return pick(["否"])
  if (field.label.includes("加绒")) return pick(["否"])
  if (field.label.includes("撞色")) return pick([text.includes("撞色") ? "是" : "否"])
  if (field.label.includes("年龄")) return pick(["幼童", "儿童", "婴幼儿"])
  if (field.label.includes("所在地")) return pick(["ALL/全球/所有", "All"])
  if (field.label.includes("关税")) {
    if (text.includes("连衣裙")) return pick(["连衣裙", "未列明关税种类"])
    if (text.includes("衬衫")) return pick(["休闲衬衫", "衬衫", "未列明关税种类"])
    return pick(["开襟衫", "毛衣", "未列明关税种类"])
  }
  return optionValues[0] || ""
}

function aiPrompt(row: ReadinessRow) {
  const attributes = row.manual_fields.map((field) => ({
    field_key: field.key,
    field_label: field.label,
    options: (field.options ?? []).map((option) => option.attribute_value).slice(0, 80),
  }))
  return JSON.stringify({
    task: "为 SHEIN 发布前需要人工判断的必填属性选择最合适枚举值",
    output_schema: {
      fills: [
        {
          field_key: "必须等于输入 attributes[].field_key",
          field_label: "字段名",
          field_value: "必须从 options 中选择一个原文值",
          confidence: "0 到 1",
          reason: "一句短理由",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "不能编造枚举值，只能从对应字段 options 中选择。",
      "如果字段无法可靠判断，选择最保守的通用值并降低 confidence。",
      "童装默认风格可偏休闲；是否类字段没有证据时默认否。",
    ],
    product: {
      spu_code: row.spu_code,
      spu_name: row.spu_name,
      title_cn: row.title_cn,
      title_en: row.title_en,
      category: row.category,
      skcs: row.skcs.map((skc) => ({
        skc_code: skc.skc_code,
        color_name: skc.color_name,
        tmall_color_image_url: skc.tmall_color_image_url ?? skc.tmall_color_url ?? null,
      })),
    },
    attributes,
  }, null, 2)
}

function extractJsonText(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1)
  return trimmed
}

function responseMessageContent(body: unknown) {
  const message = (body as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message
  const values = [
    message?.content,
    message?.reasoning_content,
    message?.reasoning,
  ]
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string" ? part : normalizeText((part as { text?: unknown; content?: unknown })?.text ?? (part as { text?: unknown; content?: unknown })?.content))
        .join("\n")
        .trim()
      if (text) return text
    }
    else if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryableAiError(error: unknown) {
  const typed = error as { name?: string; message?: string; code?: string; cause?: { code?: string } }
  const message = String(typed?.message ?? "")
  const code = typed?.cause?.code ?? typed?.code
  return typed?.name === "AbortError"
    || message === "fetch failed"
    || code === "UND_ERR_SOCKET"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT"
}

async function callAiFill(row: ReadinessRow) {
  const config = resolveAiConfig()
  if (!config.apiKey || row.manual_fields.length === 0) return []
  const requestBody = JSON.stringify({
    model: config.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "你是跨境童装 SHEIN 发品属性专家，负责在给定枚举里做保守选择。",
      },
      {
        role: "user",
        content: aiPrompt(row),
      },
    ],
  })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await sleep(800)
          continue
        }
        throw new Error(`AI fill failed: HTTP ${response.status}`)
      }
      const text = responseMessageContent(payload)
      const json = JSON.parse(extractJsonText(text))
      return Array.isArray(json.fills) ? json.fills : []
    }
    catch (error) {
      if (attempt === 0 && retryableAiError(error)) {
        await sleep(800)
        continue
      }
      throw error
    }
    finally {
      clearTimeout(timeout)
    }
  }
  return []
}

async function generateSingleAiField(readiness: ReadinessRow, fieldKey: string) {
  const field = readiness.field_groups
    .flatMap((group) => group.fields)
    .find((item) => item.key === fieldKey)
  if (!field) {
    throw new HTTPException(404, { message: "字段不存在" })
  }
  if (field.key !== "title_en" && !field.key.startsWith("attr:")) {
    throw new HTTPException(400, { message: "当前字段不支持 AI 单字段生成" })
  }

  if (field.key === "title_en") {
    const fieldValue = await callAiTranslateTitle(readiness)
    return {
      field,
      fieldValue: normalizeFillFieldValue(field.key, field.label, fieldValue),
      source: "AI_TRANSLATED",
      confidence: 0.78,
      payload: { title_cn: readiness.title_cn, category: readiness.category, context: "draft_ai_field" },
    }
  }

  const scopedReadiness: ReadinessRow = {
    ...readiness,
    manual_fields: [field],
  }
  const aiFills = await callAiFill(scopedReadiness)
    .catch(() => [] as Array<Record<string, unknown>>) as Array<Record<string, unknown>>
  const aiFill = aiFills.find((fill) => normalizeText(fill.field_key) === field.key)
  const candidateValue = normalizeFillFieldValue(field.key, field.label, aiFill?.field_value)
  const validValues = new Set((field.options ?? []).map((option) => option.attribute_value))
  const fieldValue = candidateValue && (validValues.size === 0 || validValues.has(candidateValue))
    ? candidateValue
    : heuristicAiValue(field, readiness)
  if (!fieldValue) {
    throw new HTTPException(400, { message: "AI 未生成可用字段值" })
  }
  const confidence = Number(aiFill?.confidence)
  return {
    field,
    fieldValue: normalizeFillFieldValue(field.key, field.label, fieldValue),
    source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
    confidence: Number.isFinite(confidence) ? confidence : 0.62,
    payload: aiFill ?? {
      fallback: true,
      context: "draft_ai_field",
    },
  }
}

function persistFill({
  db,
  spuCode,
  fieldKey,
  fieldLabel,
  fieldValue,
  source,
  confidence,
  payload,
}: {
  db: ReturnType<typeof getDb>
  spuCode: string
  fieldKey: string
  fieldLabel: string
  fieldValue: string
  source: string
  confidence?: number | null
  payload?: unknown
}) {
  const scopeKey = buildScopeKey({ spuCode, fieldKey })
  db.prepare(`
    insert into listing_field_fill (
      scope_key,
      spu_code,
      field_key,
      field_label,
      field_value,
      source,
      confidence,
      status,
      payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(scope_key) do update set
      field_label = excluded.field_label,
      field_value = excluded.field_value,
      source = excluded.source,
      confidence = excluded.confidence,
      status = 'ACTIVE',
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run(
    scopeKey,
    spuCode,
    fieldKey,
    fieldLabel,
    fieldValue,
    source,
    confidence ?? null,
    JSON.stringify(payload ?? {}),
  )
}

function requiredFillFields(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const readiness = getReadinessForListing(db, listing)
  if (!readiness) return []
  return readiness.field_groups.flatMap((group) => group.fields)
}

function optionForFieldValue(field: FillField, value: string) {
  return findEnumOption(field.options ?? [], [value])
}

function compositionNeedles(value: string) {
  if (/聚酯|涤纶/.test(value)) return ["聚酯纤维", "涤纶", "聚酯"]
  if (/棉/.test(value)) return ["棉"]
  if (/粘纤|粘胶/.test(value)) return ["粘纤", "粘胶纤维"]
  if (/氨纶/.test(value)) return ["氨纶"]
  if (/锦纶|尼龙/.test(value)) return ["锦纶", "尼龙"]
  if (/腈纶/.test(value)) return ["腈纶"]
  return [value]
}

function normalizeCompositionParts(parts: Array<{ name: string; value: number }>) {
  const valid = parts.filter((part) => part.value > 0)
  if (valid.length === 0) return []
  const floors = valid.map((part) => ({ ...part, floor: Math.floor(part.value), fraction: part.value - Math.floor(part.value) }))
  let remainder = 100 - floors.reduce((sum, part) => sum + part.floor, 0)
  const sorted = [...floors].sort((a, b) => b.fraction - a.fraction)
  for (const part of sorted) {
    if (remainder <= 0) break
    part.floor += 1
    remainder -= 1
  }
  return floors.map((part) => ({ name: part.name, value: Math.max(1, part.floor) }))
}

function parseCompositionParts(value: unknown) {
  const text = normalizeText(value)
  if (!text) return []
  const parsed: Array<{ name: string; value: number }> = []
  const fragments = text.split(/[|｜;；\n]+/).map((item) => item.trim()).filter(Boolean)
  for (const fragment of fragments) {
    const number = asPositiveNumber(fragment.match(/\d+(?:\.\d+)?/)?.[0])
    if (!number) continue
    const needles = compositionNeedles(fragment)
    if (needles.length === 0) continue
    parsed.push({ name: needles[0], value: number })
  }
  return normalizeCompositionParts(parsed)
}

function buildCompositionAttributeItems(field: FillField, compositionSource: unknown) {
  const parts = parseCompositionParts(compositionSource)
  const output: Array<Record<string, unknown>> = []
  for (const part of parts) {
    const option = findEnumOption(field.options ?? [], compositionNeedles(part.name))
    if (!option) continue
    output.push({
      attribute_id: field.attribute_id,
      attribute_value_id: option.attribute_value_id,
      attribute_extra_value: String(part.value),
    })
  }
  if (output.length > 0) return output

  const fallback = optionForFieldValue(field, normalizeText(field.value))
  return fallback
    ? [{ attribute_id: field.attribute_id, attribute_value_id: fallback.attribute_value_id, attribute_extra_value: "100" }]
    : []
}

function buildDependentAttributeItems(db: ReturnType<typeof getDb>, listing: ListingRow, currentItems: Array<Record<string, unknown>>) {
  const hasTariffSweatshirt = currentItems.some((item) =>
    Number(item.attribute_id) === 1000407 && Number(item.attribute_value_id) === 1002272,
  )
  const hasSweatshirtMaterial = currentItems.some((item) => Number(item.attribute_id) === 160)
  const hasPlacketType = currentItems.some((item) => Number(item.attribute_id) === 150)
  if (!hasTariffSweatshirt || !hasSweatshirtMaterial || hasPlacketType) return []

  const attr = db.prepare(`
    select attribute_id, attribute_name
    from channel_attribute
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = 150
      and attribute_name = '门襟类型'
    limit 1
  `).get(listing.product_type_id) as SourceRow | undefined
  if (!attr) return []
  const option = db.prepare(`
    select attribute_value_id, attribute_value
    from channel_attribute_value
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = 150
      and attribute_value = '套头衫'
    limit 1
  `).get(listing.product_type_id) as SourceRow | undefined
  if (!option) return []
  return [{
    attribute_id: Number(attr.attribute_id),
    attribute_value_id: Number(option.attribute_value_id),
  }]
}

function buildProductAttributeList(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const fields = requiredFillFields(db, listing)
  const compositionSource = fields.find((field) => field.key === "composition_text")?.value
  const output: Array<Record<string, unknown>> = []
  for (const field of fields) {
    if (!field.key.startsWith("attr:")) continue
    if (field.attribute_type !== 3 && field.attribute_type !== 4) continue
    if (field.label.includes("成分")) {
      output.push(...buildCompositionAttributeItems(field, compositionSource))
      continue
    }
    const values = field.label.includes("关税") && normalizeText(listing.platform_category_name).includes("卫衣")
      ? ["卫衣"]
      : coerceFieldValues(field, field.value)
    for (const value of values) {
      const option = optionForFieldValue(field, value)
      const item: Record<string, unknown> = { attribute_id: field.attribute_id }
      if (option) {
        item.attribute_value_id = option.attribute_value_id
        if (field.label.includes("数量") && field.render_kind === "enum_with_text") {
          item.attribute_extra_value = "1"
        }
      }
      else if (field.render_kind === "enum_with_text" || field.render_kind === "text") item.attribute_extra_value = value
      else continue
      output.push(item)
    }
  }
  output.push(...buildDependentAttributeItems(db, listing, output))
  return output
}

function sheinImageType(assetType: unknown, sort: number) {
  const type = normalizeText(assetType)
  if (type === "SQUARE") return 5
  if (type === "COLOR_BLOCK" || type === "COLOR") return 6
  if (type === "MAIN" || sort === 1) return 1
  return 2
}

function ensureFallbackColorAssets(db: ReturnType<typeof getDb>, listingId: number) {
  const missing = db.prepare(`
    select
      skc.id as listing_skc_id,
      skc.skc_code,
      skc.image_url,
      (
        select coalesce(max(asset.image_sort), 0) + 1
        from listing_asset asset
        where asset.listing_id = skc.listing_id
          and coalesce(asset.skc_code, '') = coalesce(skc.skc_code, '')
      ) as next_sort
    from listing_skc skc
    where skc.listing_id = ?
      and skc.selected_for_publish = 1
      and coalesce(skc.image_url, '') <> ''
      and not exists (
        select 1
        from listing_asset asset
        where asset.listing_id = skc.listing_id
          and coalesce(asset.skc_code, '') = coalesce(skc.skc_code, '')
          and asset.asset_type in ('COLOR_BLOCK', 'COLOR')
      )
  `).all(listingId) as SourceRow[]
  if (missing.length === 0) return

  const insert = db.prepare(`
    insert into listing_asset (
      listing_id,
      listing_skc_id,
      skc_code,
      source_type,
      asset_type,
      image_sort,
      source_url,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'SOURCE_FALLBACK', 'COLOR_BLOCK', ?, ?, 'PENDING_CONFIRM', 1, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `)
  for (const item of missing) {
    insert.run(
      listingId,
      item.listing_skc_id,
      item.skc_code,
      Number(item.next_sort ?? 1),
      item.image_url,
      "发布前自动补齐 SKC 色块图",
      JSON.stringify({
        source: "listing_skc.image_url",
        requirement_key: "SKC_COLOR_BLOCK",
        prepared_by: "ensureFallbackColorAssets",
      }),
    )
  }
}

async function prepareListingImagesForPublish(db: ReturnType<typeof getDb>, listingId: number) {
  const credentials = resolveSheinCredentials(db)
  ensureFallbackColorAssets(db, listingId)
  const assets = db.prepare(`
    select *
    from listing_asset
    where listing_id = ?
      and coalesce(platform_url, '') = ''
    order by skc_code, image_sort, id
  `).all(listingId) as SourceRow[]
  const update = db.prepare(`
    update listing_asset
    set platform_url = ?,
      status = 'READY',
      transform_status = 'READY',
      transform_error = null,
      transformed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      raw_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `)
  const updateFailed = db.prepare(`
    update listing_asset
    set status = 'FAILED',
      transform_status = 'FAILED',
      transform_error = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `)
  for (const asset of assets) {
    const imageType = sheinImageType(asset.asset_type, Number(asset.image_sort ?? 0))
    const localPath = normalizeText(asset.local_path)
    const sourceUrl = normalizeText(asset.source_url)
    let prepared: { imageUrl: string; payload: unknown } | null = null
    try {
      db.prepare(`
        update listing_asset
        set transform_status = 'TRANSFORMING',
          transform_error = null,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ?
      `).run(asset.id)
      if (localPath) {
        if (!fs.existsSync(localPath)) throw new Error(`本地图片不存在：${localPath}`)
        prepared = await uploadLocalImageToShein(localPath, imageType, credentials)
      } else if (sourceUrl) {
        prepared = await transformOnlineImageToShein(sourceUrl, imageType, credentials)
      }
      if (!prepared) {
        db.prepare(`
          update listing_asset
          set transform_status = case when coalesce(platform_url, '') <> '' then 'READY' else transform_status end,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          where id = ?
        `).run(asset.id)
        continue
      }
      update.run(
        prepared.imageUrl,
        JSON.stringify({
          ...parseJsonObject(asset.raw_payload_json),
          shein_prepare_response: prepared.payload,
          prepared_at: nowIso(),
        }),
        asset.id,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "SHEIN 图片转换失败"
      updateFailed.run(message, asset.id)
      throw error
    }
  }
}

function selectedImageInfo(skc: SourceRow, assets: SourceRow[], allowSourceImages = false) {
  const skcCode = normalizeText(skc.skc_code)
  const selectedAssets = assets
    .filter((asset) => normalizeText(asset.skc_code) === skcCode)
    .filter((asset) => normalizeText(asset.platform_url) || (allowSourceImages && normalizeText(asset.source_url)))
    .sort((a, b) => Number(a.image_sort ?? 0) - Number(b.image_sort ?? 0))

  const imageInfoList = selectedAssets.map((asset, index) => ({
    image_sort: index + 1,
    image_type: sheinImageType(asset.asset_type, index + 1),
    image_url: normalizeText(asset.platform_url) || (allowSourceImages ? normalizeText(asset.source_url) : ""),
  }))

  const tmallImage = normalizeText(skc.image_url)
  if (imageInfoList.length === 0 && tmallImage) {
    imageInfoList.push(
      { image_sort: 1, image_type: 1, image_url: tmallImage },
      { image_sort: 2, image_type: 6, image_url: tmallImage },
    )
  } else if (tmallImage && !imageInfoList.some((image) => Number(image.image_type) === 6)) {
    imageInfoList.push({
      image_sort: imageInfoList.length + 1,
      image_type: 6,
      image_url: tmallImage,
    })
  }

  return { image_info_list: imageInfoList }
}

function buildSupplierBarcodePayload(value: unknown, publishFields: Map<string, PublishFieldRule>) {
  if (!fieldShown(publishFields, "supplier_barcode")) return undefined
  const barcode = normalizeBarcode(value)
  if (!barcode) return undefined
  return {
    barcode,
    barcode_type: barcode.length === 12 ? "UPC" : "EAN",
  }
}

function readinessFieldValue(readiness: ReadinessRow, fieldKey: string) {
  for (const group of readiness.field_groups) {
    const field = group.fields.find((item) => item.key === fieldKey)
    if (field) return field.value
  }
  return null
}

function buildSuggestedRetailPricePayload(readiness: ReadinessRow, publishFields: Map<string, PublishFieldRule>) {
  if (!fieldShown(publishFields, "suggest_price")) return undefined
  const price = asPositiveNumber(readinessFieldValue(readiness, "retail_usd"))
  if (!price) return undefined
  return {
    currency: "USD",
    price: Number(price.toFixed(2)),
  }
}

function getSizeChartAttributes(db: ReturnType<typeof getDb>, productTypeId: unknown) {
  const id = asPositiveNumber(productTypeId)
  if (!id) return []
  return db.prepare(`
    select *
    from channel_attribute
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_type = 2
      and attribute_status in (2, 3)
    order by attribute_id
  `).all(id) as SourceRow[]
}

function sizeRowForSku(sizeRows: SourceRow[], sku: SourceRow) {
  const keys = sizeKeys(sku.size_name).concat(sizeKeys(sku.shein_size_value))
  return sizeRows.find((row) => {
    const rowText = normalizeText(row.size_name)
    return keys.some((key) => rowText.includes(key) || key.includes(rowText.replace(/\D+/g, "")))
  })
}

function sizeChartValueForAttribute(attributeName: unknown, values: Record<string, unknown>) {
  const name = normalizeText(attributeName).replace(/\s*\(cm\)\s*$/i, "")
  const candidates = [
    name,
    name.replace("长度", "衣长"),
    name.replace("长度", "裤长"),
    name.replace("内侧裤长", "裤长"),
    name.replace("臂围", "袖笼围"),
  ].filter(Boolean)
  for (const candidate of candidates) {
    const exact = values[candidate]
    const number = asPositiveNumber(exact)
    if (number) return number
  }
  for (const [key, value] of Object.entries(values)) {
    if (candidates.some((candidate) => key.includes(candidate) || candidate.includes(key))) {
      const number = asPositiveNumber(value)
      if (number) return number
    }
  }
  return null
}

function buildSizeChartAttributeList({
  db,
  listing,
  skus,
  sizeAttrId,
}: {
  db: ReturnType<typeof getDb>
  listing: SourceRow
  skus: SourceRow[]
  sizeAttrId: number | null
}) {
  if (!sizeAttrId) return []
  const sizeChartAttrs = getSizeChartAttributes(db, listing.product_type_id)
  if (sizeChartAttrs.length === 0) return []
  const { size_tables, size_table_rows } = getSizeTables(db, listing as ListingRow)
  const mappedCharts = getMappedSizeCharts({
    db,
    listing: listing as ListingRow,
    sizeTables: size_tables,
    sizeTableRows: size_table_rows,
  })
  const rows = mappedCharts.flatMap((chart) => chart.rows as SourceRow[])
  const output: Array<Record<string, unknown>> = []
  for (const sku of skus) {
    const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
    const sizeValueId = asPositiveNumber(sizePayload.attribute_value_id)
    if (!sizeValueId) continue
    const row = sizeRowForSku(rows, sku)
    if (!row) continue
    const values = parseJsonObject(row.values_json)
    for (const attr of sizeChartAttrs) {
      const value = sizeChartValueForAttribute(attr.attribute_name, values)
      if (!value) continue
      output.push({
        attribute_id: Number(attr.attribute_id),
        attribute_value_id: "",
        attribute_extra_value: String(value),
        relate_sale_attribute_id: sizeAttrId,
        relate_sale_attribute_value_id: sizeValueId,
      })
    }
  }
  return output
}

function buildPublishPayload(db: ReturnType<typeof getDb>, listingId: number, options?: {
  skcCodes?: string[]
  allowSourceImages?: boolean
  requirePreparedImages?: boolean
  allowDefaultSkuWeight?: boolean
}) {
  const detail = getListingDetail(db, listingId)
  if (!detail) throw new HTTPException(404, { message: "草稿不存在" })
  const listing = detail.listing as ListingRow
  const selectedSkcFilter = new Set((options?.skcCodes ?? []).map(normalizeText).filter(Boolean))
  const skcs = (detail.skcs as SourceRow[]).filter((skc) =>
    Number(skc.selected_for_publish ?? 1) === 1
    && (selectedSkcFilter.size === 0 || selectedSkcFilter.has(normalizeText(skc.skc_code)) || selectedSkcFilter.has(normalizeText(skc.skc_code).split(":").pop() ?? "")),
  )
  const skcCodes = new Set(skcs.map((skc) => normalizeText(skc.skc_code)))
  const skus = (detail.skus as SourceRow[]).filter((sku) =>
    Number(sku.selected_for_publish ?? 1) === 1
    && skcCodes.has(normalizeText(sku.skc_code)),
  )
  const attrs = detail.sale_attributes as RequiredAttribute[]
  const colorAttr = attrs.find((attr) => attr.attribute_type === 1 && attr.attribute_label === 1)
  const sizeAttr = attrs.find((attr) => attr.attribute_type === 1 && attr.attribute_label === 0)
  const assets = detail.assets as SourceRow[]
  const selectedAssetBySkc = new Map<string, SourceRow[]>()
  for (const asset of assets) {
    const key = normalizeText(asset.skc_code)
    if (!key) continue
    selectedAssetBySkc.set(key, [...(selectedAssetBySkc.get(key) ?? []), asset])
  }
  const readiness = detail.readiness as ReadinessRow
  const sizeAttributeList = buildSizeChartAttributeList({
    db,
    listing,
    skus,
    sizeAttrId: sizeAttr?.attribute_id ?? null,
  })
  const standard = db.prepare(`
    select default_language, currency, fill_in_standard_json
    from channel_publish_standard
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
    order by updated_at desc
    limit 1
  `).get(listing.platform_category_id, listing.product_type_id) as SourceRow | undefined
  const publishFields = publishFieldRules(standard)
  const defaultLanguage = normalizeText(standard?.default_language) || "zh-cn"
  const suggestedRetailPrice = buildSuggestedRetailPricePayload(readiness, publishFields)
  const brandCode = resolveSheinBrandCode(db, listing)
  const supplierSkuBySkuCode = buildPublishSupplierSkuMap(skus)
  const supplierSkuCounts = new Map<string, number>()
  for (const sku of skus) {
    const supplierSku = supplierSkuBySkuCode.get(normalizeText(sku.sku_code)) ?? publishSupplierSku(sku)
    if (!supplierSku) continue
    supplierSkuCounts.set(supplierSku, (supplierSkuCounts.get(supplierSku) ?? 0) + 1)
  }
  const errors: string[] = []
  const warnings: string[] = []

  if (isSheinOpenApiUnsupportedSuitCategory(listing.platform_category_name, listing.platform_category_path)) {
    errors.push(sheinOpenApiSuitCategoryMessage(listing.platform_category_name))
  }
  if (!listing.platform_category_id || !listing.product_type_id) errors.push("缺 SHEIN 类目")
  if (skcs.length === 0) errors.push("未勾选发布 SKC")
  if (skus.length === 0) errors.push("未勾选发布 SKU")
  if (!colorAttr) errors.push("缺颜色销售属性元数据")
  if (!sizeAttr) errors.push("缺尺寸销售属性元数据")
  if (fieldRequired(publishFields, "suggest_price") && !suggestedRetailPrice) errors.push("缺 SKC 建议零售价")
  if (fieldRequired(publishFields, "brand_code") && !brandCode) errors.push("缺产品品牌")

  const skcList = skcs.map((skc) => {
    const colorPayload = parseJsonObject(skc.color_attribute_payload_json)
    const colorValueId = asPositiveNumber(colorPayload.attribute_value_id)
    if (!colorValueId && !normalizeText(colorPayload.custom_attribute_value)) errors.push(`${skc.skc_code} 缺颜色枚举`)
    if (Number(skc.image_confirmed ?? 0) !== 1) errors.push(`${skc.skc_code} 图片未确认`)
    const skcSkus = skus.filter((sku) => normalizeText(sku.skc_code) === normalizeText(skc.skc_code))
    const barcodeCounts = new Map<string, number>()
    if (fieldShown(publishFields, "supplier_barcode")) {
      for (const sku of skcSkus) {
        const supplierBarcode = buildSupplierBarcodePayload(sku.supplier_barcode, publishFields)
        if (!supplierBarcode) continue
        barcodeCounts.set(supplierBarcode.barcode, (barcodeCounts.get(supplierBarcode.barcode) ?? 0) + 1)
      }
    }
    const skuList = skcSkus.map((sku) => {
      const supplierSku = supplierSkuBySkuCode.get(normalizeText(sku.sku_code)) ?? publishSupplierSku(sku)
      const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
      const sizeValueId = asPositiveNumber(sizePayload.attribute_value_id)
      if (!supplierSku) errors.push(`${sku.sku_code} 缺商家 SKU/69码`)
      if (supplierSku && (supplierSkuCounts.get(supplierSku) ?? 0) > 1) {
        errors.push(`${sku.sku_code} 商家 SKU/69码在本次发布中重复`)
      }
      if (!sizeValueId && !normalizeText(sizePayload.custom_attribute_value)) errors.push(`${sku.sku_code} 缺 SHEIN 尺码枚举`)
      if (!asPositiveNumber(sku.package_weight_g)) {
        const message = `${sku.sku_code} 缺 SKU 毛重`
        if (options?.allowDefaultSkuWeight) warnings.push(`${message}，本次临时按 500g 发布`)
        else errors.push(message)
      }
      if (!asPositiveNumber(sku.cost_price)) errors.push(`${sku.sku_code} 缺 SKU 供货价`)
      if (asPositiveNumber(sku.cost_price) && Number(sku.price_confirmed ?? 0) !== 1) errors.push(`${sku.sku_code} 供货价未确认`)
      let supplierBarcode = fieldShown(publishFields, "supplier_barcode")
        ? buildSupplierBarcodePayload(sku.supplier_barcode, publishFields)
        : undefined
      if (supplierBarcode && (barcodeCounts.get(supplierBarcode.barcode) ?? 0) > 1) {
        if (fieldRequired(publishFields, "supplier_barcode")) {
          errors.push(`${sku.sku_code} 商家条码在同一 SKC 下重复`)
        }
        supplierBarcode = undefined
      }
      if (fieldRequired(publishFields, "supplier_barcode") && !supplierBarcode) {
        errors.push(`${sku.sku_code} 缺可发布商家条码`)
      }
      const saleAttribute: Record<string, unknown> = {
        attribute_id: sizeAttr?.attribute_id,
      }
      if (sizeValueId) saleAttribute.attribute_value_id = sizeValueId
      else if (normalizeText(sizePayload.custom_attribute_value)) {
        saleAttribute.custom_attribute_value = normalizeText(sizePayload.custom_attribute_value)
        saleAttribute.language = "zh-cn"
      }
      return {
        supplier_sku: supplierSku,
        ...(supplierBarcode ? { supplier_barcode: supplierBarcode } : {}),
        ...(fieldShown(publishFields, "mall_state", true) ? { mall_state: Number(sku.mall_state ?? 1) || 1 } : {}),
        ...(fieldShown(publishFields, "stop_purchase", true) ? { stop_purchase: 1 } : {}),
        height: String(sku.package_height_cm ?? 1),
        length: String(sku.package_length_cm ?? 1),
        width: String(sku.package_width_cm ?? 1),
        weight: String(publishPackageWeight(sku.package_weight_g, options?.allowDefaultSkuWeight ? 500 : undefined) ?? ""),
        cost_info: sku.cost_price
          ? { cost_price: Number(sku.cost_price), currency: normalizeText(sku.currency) || "CNY" }
          : undefined,
        sale_attribute_list: [saleAttribute],
        stock_info_list: [{ inventory_num: 1 }],
      }
    })
    const saleAttribute: Record<string, unknown> = {
      attribute_id: colorAttr?.attribute_id,
    }
    if (colorValueId) saleAttribute.attribute_value_id = colorValueId
    else if (normalizeText(colorPayload.custom_attribute_value)) {
      saleAttribute.custom_attribute_value = normalizeText(colorPayload.custom_attribute_value)
      saleAttribute.language = "zh-cn"
    }
    return {
      supplier_code: normalizeText(skc.supplier_code) || normalizeText(skc.skc_code),
      ...(fieldShown(publishFields, "skc_title", true)
        ? { skc_title: normalizeText(skc.skc_title) || normalizeText(listing.title) || normalizeText(listing.spu_code) }
        : {}),
      sale_attribute: saleAttribute,
      image_info: selectedImageInfo(skc, assets, Boolean(options?.allowSourceImages)),
      sku_list: skuList,
      shelf_way: "1",
      ...(fieldShown(publishFields, "shelf_require") ? { shelf_require: "0" } : {}),
      ...(suggestedRetailPrice ? { suggested_retail_price: suggestedRetailPrice } : {}),
    }
  })

  for (const skc of skcList) {
    const imageCount = Array.isArray(skc.image_info.image_info_list) ? skc.image_info.image_info_list.length : 0
    if (imageCount === 0) errors.push(`${skc.supplier_code} 缺 SHEIN 可用图片 URL`)
  }
  for (const skc of skcs) {
    const skcCode = normalizeText(skc.skc_code)
    const skcAssets = selectedAssetBySkc.get(skcCode) ?? []
    const hasPlatformUrl = skcAssets.some((asset) => normalizeText(asset.platform_url))
    const failedAsset = skcAssets.find((asset) => normalizeText(asset.transform_status) === "FAILED" || normalizeText(asset.status) === "FAILED")
    if ((options?.requirePreparedImages ?? true) && !hasPlatformUrl) errors.push(`${skc.skc_code} 图片未转换为 SHEIN 可用 URL`)
    if (failedAsset) {
      errors.push(`${skc.skc_code} 图片转换失败：${normalizeText(failedAsset.transform_error) || normalizeText(failedAsset.note) || "请重新上传或转换"}`)
    }
  }

  const titleEn = sanitizeSingleItemTitleEn(
    normalizeText(readinessFieldValue(readiness, "title_en")) || normalizeText(readiness.title_en) || heuristicEnglishTitle(readiness),
    listing.platform_category_name,
  )
  const nameList = [
    {
      language: "en",
      name: titleEn,
    },
  ]
  if (defaultLanguage.toLowerCase() !== "en") {
    nameList.push({ language: defaultLanguage, name: titleEn })
  }

  const payload = {
    category_id: Number(listing.platform_category_id),
    product_type_id: Number(listing.product_type_id),
    source_system: "OpenAPI",
    suit_flag: "0",
    supplier_code: normalizeText(listing.spu_code),
    is_spu_pic: false,
    ...(fieldShown(publishFields, "brand_code") && brandCode ? { brand_code: brandCode } : {}),
    ...(fieldShown(publishFields, "package_type") ? { package_type: resolvePackageRule(db, listing).type } : {}),
    multi_language_name_list: nameList,
    product_attribute_list: buildProductAttributeList(db, listing as ListingRow),
    ...(sizeAttributeList.length ? { size_attribute_list: sizeAttributeList } : {}),
    skc_list: skcList,
  }

  return {
    payload: JSON.parse(JSON.stringify(payload)),
    errors,
    warnings,
    detail,
  }
}

function persistPlatformIdentity({
  db,
  listing,
  version,
  responsePayload,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  version: SourceRow
  responsePayload: unknown
}) {
  const info = publishInfo(responsePayload)
  const accountId = Number(listing.channel_account_id)
  const upsert = db.prepare(`
    insert into platform_identity (
      platform,
      channel_account_id,
      local_type,
      local_id,
      platform_type,
      platform_id,
      platform_parent_id,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(platform, channel_account_id, local_type, local_id, platform_type) do update set
      platform_id = excluded.platform_id,
      platform_parent_id = excluded.platform_parent_id,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `)
  const spuName = normalizeText(info.spu_name ?? info.spuName)
  if (spuName) {
    upsert.run("SHEIN", accountId, "listing", listing.id, "SPU", spuName, null, JSON.stringify(info))
  }
  const skcRows = db.prepare("select * from listing_skc where listing_id = ?").all(listing.id) as SourceRow[]
  const skuRows = db.prepare(`
    select sku.*, skc.skc_code
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    where skc.listing_id = ?
  `).all(listing.id) as SourceRow[]
  const responseSkcs = parseJsonList(info.skc_list ?? info.skcList)
  for (const skcPayload of responseSkcs) {
    const skcObject = parseJsonObject(skcPayload)
    const supplierCode = normalizeText(skcObject.supplier_code ?? skcObject.supplierCode)
    const platformSkc = normalizeText(skcObject.skc_name ?? skcObject.skcName)
    const localSkc = skcRows.find((row) => normalizeText(row.supplier_code) === supplierCode)
    if (localSkc && platformSkc) {
      upsert.run("SHEIN", accountId, "listing_skc", localSkc.id, "SKC", platformSkc, spuName || null, JSON.stringify(skcObject))
    }
    for (const skuPayload of parseJsonList(skcObject.sku_list ?? skcObject.skuList)) {
      const skuObject = parseJsonObject(skuPayload)
      const supplierSku = normalizeText(skuObject.supplier_sku ?? skuObject.supplierSku)
      const platformSku = normalizeText(skuObject.sku_code ?? skuObject.skuCode)
      const localSku = skuRows.find((row) =>
        normalizeText(row.sku_code) === supplierSku || normalizeText(row.supplier_sku) === supplierSku,
      )
      if (localSku && platformSku) {
        upsert.run("SHEIN", accountId, "listing_sku", localSku.id, "SKU", platformSku, platformSkc || null, JSON.stringify(skuObject))
      }
    }
  }
  if (normalizeText(info.version)) {
    db.prepare(`
      update listing_publish_version
      set platform_version = ?,
        response_payload_json = coalesce(nullif(response_payload_json, ''), ?)
      where id = ?
    `).run(normalizeText(info.version), JSON.stringify(responsePayload), version.id)
  }
}

function updateListingSkuSizes({
  db,
  listingId,
  skuSizeValues,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  skuSizeValues: Array<{
    sku_id?: unknown
    shein_size_value?: unknown
    attribute_value_id?: unknown
    attribute_value?: unknown
  }>
}) {
  if (skuSizeValues.length === 0) return
  const valid = skuSizeValues
    .map((item) => ({
      id: Number(item.sku_id),
      sheinSize: normalizeText(item.shein_size_value) || normalizeText(item.attribute_value),
      attributeValueId: asPositiveNumber(item.attribute_value_id),
      attributeValue: normalizeText(item.attribute_value) || normalizeText(item.shein_size_value),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
  if (valid.length === 0) return

  const stmt = db.prepare(`
    update listing_sku
    set shein_size_value = ?,
      size_attribute_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_skc_id in (
        select id from listing_skc where listing_id = ?
      )
  `)
  for (const item of valid) {
    const current = db.prepare("select size_attribute_payload_json from listing_sku where id = ?").get(item.id) as SourceRow | undefined
    const payload = {
      ...parseJsonObject(current?.size_attribute_payload_json),
      shein_size_value: item.sheinSize,
      attribute_value: item.attributeValue || item.sheinSize,
      attribute_value_id: item.attributeValueId,
    }
    stmt.run(item.sheinSize, JSON.stringify(payload), item.id, listingId)
  }
}

function updateListingSkuWeights({
  db,
  listingId,
  skuWeightValues,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  skuWeightValues: Array<{ sku_id?: unknown; package_weight_g?: unknown }>
}) {
  const valid = skuWeightValues
    .map((item) => ({
      id: Number(item.sku_id),
      weight: asPositiveNumber(item.package_weight_g),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.weight != null)
  if (valid.length === 0) return
  const stmt = db.prepare(`
    update listing_sku
    set package_weight_g = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_skc_id in (
        select id from listing_skc where listing_id = ?
      )
  `)
  for (const item of valid) stmt.run(Math.round(Number(item.weight)), item.id, listingId)
}

function updateListingSkuCommercials({
  db,
  listingId,
  skuCommercialValues,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  skuCommercialValues: Array<{
    sku_id?: unknown
    cost_price?: unknown
    currency?: unknown
    package_length_cm?: unknown
    package_width_cm?: unknown
    package_height_cm?: unknown
  }>
}) {
  const valid = skuCommercialValues
    .map((item) => ({
      id: Number(item.sku_id),
      costPrice: asPositiveNumber(item.cost_price),
      currency: normalizeText(item.currency) || "CNY",
      length: asPositiveNumber(item.package_length_cm),
      width: asPositiveNumber(item.package_width_cm),
      height: asPositiveNumber(item.package_height_cm),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
  if (valid.length === 0) return
  const stmt = db.prepare(`
    update listing_sku
    set cost_price = coalesce(?, cost_price),
      currency = coalesce(?, currency),
      package_length_cm = coalesce(?, package_length_cm),
      package_width_cm = coalesce(?, package_width_cm),
      package_height_cm = coalesce(?, package_height_cm),
      price_confirmed = case
        when ? is not null and ? > 0 then 1
        else price_confirmed
      end,
      price_confirmed_at = case
        when ? is not null and ? > 0 and price_confirmed_at is null then strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        else price_confirmed_at
      end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_skc_id in (
        select id from listing_skc where listing_id = ?
      )
  `)
  for (const item of valid) {
    stmt.run(
      item.costPrice,
      item.currency,
      item.length,
      item.width,
      item.height,
      item.costPrice,
      item.costPrice,
      item.costPrice,
      item.costPrice,
      item.id,
      listingId,
    )
  }
}

function updateListingSkcColors({
  db,
  listingId,
  skcColorValues,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  skcColorValues: Array<{
    skc_id?: unknown
    attribute_value_id?: unknown
    attribute_value?: unknown
    custom_attribute_value?: unknown
  }>
}) {
  if (skcColorValues.length === 0) return
  const valid = skcColorValues
    .map((item) => ({
      id: Number(item.skc_id),
      attributeValueId: asPositiveNumber(item.attribute_value_id),
      attributeValue: normalizeText(item.attribute_value),
      customValue: normalizeText(item.custom_attribute_value),
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
  if (valid.length === 0) return

  const stmt = db.prepare(`
    update listing_skc
    set color_attribute_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_id = ?
  `)
  for (const item of valid) {
    const current = db.prepare("select color_name, color_attribute_payload_json from listing_skc where id = ?").get(item.id) as SourceRow | undefined
    const payload = {
      ...parseJsonObject(current?.color_attribute_payload_json),
      attribute_id: 27,
      attribute_value_id: item.attributeValueId,
      attribute_value: item.attributeValue,
      custom_attribute_value: item.customValue,
      color_name: normalizeText(current?.color_name),
    }
    stmt.run(JSON.stringify(payload), item.id, listingId)
  }
}

prePublish.get("/platforms", (c) => {
  const db = getDb()
  const sheinAccount = getDefaultChannelAccount(db, "SHEIN")
  return c.json({
    items: [
      {
        platform: "SHEIN",
        label: "SHEIN",
        enabled: true,
        account_id: Number(sheinAccount.id),
        account_name: sheinAccount.account_name,
        business_mode: sheinAccount.business_mode,
      },
    ],
  })
})

prePublish.get("/readiness", (c) => c.json(buildReadiness(c)))

prePublish.get("/draft-categories", (c) => {
  const db = getDb()
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN") || "SHEIN"
  const rows = db.prepare(`
    select
      platform_category_id as category_id,
      product_type_id,
      platform_category_name as category_name,
      platform_category_path as path,
      count(*) as listing_count
    from listing
    where platform = ?
      and platform_category_id is not null
      and product_type_id is not null
    group by platform_category_id, product_type_id, platform_category_name, platform_category_path
    order by listing_count desc, platform_category_name
  `).all(platform) as SourceRow[]
  return c.json({ items: rows })
})

prePublish.get("/category-tree", (c) => {
  const db = getDb()
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN") || "SHEIN"
  const q = normalizeText(c.req.query("q"))
  const parent = normalizeText(c.req.query("parent_category_id"))
  const root = normalizeText(c.req.query("root_category_name"))
  const limit = readLimit(c.req.query("limit"), 120, 500)

  if (q) {
    const like = `%${q}%`
    const rows = db.prepare(`
      select
        category_id,
        product_type_id,
        parent_category_id,
        category_name,
        root_category_id,
        root_category_name,
        level,
        path,
        last_category
      from channel_category
      where platform = ?
        and (category_name like ? or path like ?)
      order by last_category desc, path
      limit ?
    `).all(platform, like, like, limit) as SourceRow[]
    return c.json({ items: rows })
  }

  const clauses = ["platform = ?"]
  const params: unknown[] = [platform]
  if (parent) {
    clauses.push("coalesce(parent_category_id, 0) = ?")
    params.push(Number(parent))
  } else if (root) {
    clauses.push("root_category_name = ?")
    params.push(root)
  } else {
    clauses.push("level = 1")
  }

  const rows = db.prepare(`
    select
      category_id,
      product_type_id,
      parent_category_id,
      category_name,
      root_category_id,
      root_category_name,
      level,
      path,
      last_category,
      (
        select count(*)
        from channel_category child
        where child.platform = channel_category.platform
          and coalesce(child.parent_category_id, 0) = channel_category.category_id
      ) as child_count
    from channel_category
    where ${clauses.join(" and ")}
    order by level, category_name
    limit ?
  `).all(...params, limit) as SourceRow[]

  return c.json({ items: rows })
})

prePublish.get("/drafts", (c) => {
  const db = getDb()
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN") || "SHEIN"
  const terms = batchTerms(c.req.query("batch_search"))
  const q = normalizeText(c.req.query("q"))
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const categoryFilter = normalizeText(c.req.query("category_id"))
  if (q) terms.push(q)
  const clauses = ["listing.platform = ?"]
  const params: unknown[] = [platform]
  if (categoryFilter && categoryFilter !== "all") {
    clauses.push("listing.platform_category_id = ?")
    params.push(Number(categoryFilter))
  }
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() => "(listing.spu_code like ? or listing.title like ? or spu.spu_name like ?)").join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like)
    }
  }
  const rows = db.prepare(`
    select
      listing.*,
      account.account_name,
      spu.spu_name,
      spu.brand_name
    from listing
    join channel_account account on account.id = listing.channel_account_id
    join product_spu spu on spu.id = listing.product_spu_id
    where ${clauses.join(" and ")}
    order by listing.updated_at desc, listing.id desc
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]
  const total = db.prepare(`
    select count(*) as count
    from listing
    join channel_account account on account.id = listing.channel_account_id
    join product_spu spu on spu.id = listing.product_spu_id
    where ${clauses.join(" and ")}
  `).get(...params) as { count: number }
  return c.json({
    items: rows.map((row) => summarizeListing(db, row, { onlySelected: true })),
    pagination: {
      total: total.count,
      limit,
      offset,
    },
  })
})

prePublish.post("/drafts", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    platform?: string
    spu_codes?: string[]
    skc_codes_by_spu?: Record<string, string[]>
    batch_search?: string
  }
  const platform = normalizeText(body.platform || "SHEIN").toUpperCase()
  if (platform !== "SHEIN") {
    throw new HTTPException(400, { message: "当前仅支持 SHEIN 平台发布草稿" })
  }
  const spuCodes = uniqueStrings([
    ...(Array.isArray(body.spu_codes) ? body.spu_codes : []),
    ...batchTerms(body.batch_search),
  ])
  if (spuCodes.length === 0) {
    throw new HTTPException(400, { message: "请先勾选或输入款号" })
  }

  const created: unknown[] = []
  const missing: string[] = []
  const transaction = db.transaction(() => {
    for (const spuCode of spuCodes) {
      const bucket = db.prepare(`
        select *
        from shein_product_bucket
        where spu_code = ?
          and bucket_status <> 'REMOVED'
      `).get(spuCode) as SourceRow | undefined
      if (!bucket) {
        missing.push(spuCode)
        continue
      }
      const sourceRow = getSourceProductRow(db, spuCode)
      const readiness = getReadinessBySpu(db, spuCode)
      if (!sourceRow || !readiness) {
        missing.push(spuCode)
        continue
      }
      const result = createDraft(db, readiness, sourceRow, platform, body.skc_codes_by_spu?.[spuCode])
      created.push({
        listing_id: result.listing.id,
        spu_code: readiness.spu_code,
        publish_unit_no: result.listing.publish_unit_no,
        version_no: result.version.version_no,
        created: result.created,
        status: result.listing.status,
      })
      db.prepare(`
        update shein_product_bucket
        set bucket_status = 'DRAFTED',
          latest_listing_id = ?,
          latest_version_no = ?,
          latest_publish_status = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where spu_code = ?
      `).run(
        result.listing.id,
        result.version.version_no,
        result.listing.status,
        readiness.spu_code,
      )
    }
  })
  transaction()

  return c.json({
    ok: true,
    created_count: created.length,
    missing,
    items: created,
  })
})

prePublish.get("/drafts/:id", (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  if (!Number.isFinite(listingId)) {
    throw new HTTPException(400, { message: "无效草稿 ID" })
  }
  const detail = getListingDetail(db, listingId)
  if (!detail) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  return c.json(detail)
})

prePublish.post("/drafts/:id/duplicate", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const sourceRow = getSourceProductRow(db, listing.spu_code)
  const readiness = getReadinessForListing(db, listing)
  if (!sourceRow || !readiness) {
    throw new HTTPException(404, { message: "商品档案不存在，无法派生草稿" })
  }
  const result = db.transaction(() => {
    const draft = createDraft(db, readiness, sourceRow, listing.platform)
    updateBucketLatestForSpu(db, listing.spu_code)
    return draft
  })()
  return c.json({
    ok: true,
    listing_id: result.listing.id,
    publish_unit_no: result.listing.publish_unit_no,
    version_no: result.version.version_no,
    status: result.listing.status,
  })
})

prePublish.patch("/drafts/:id/status", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as { status?: string }
  const status = normalizeText(body.status).toUpperCase()
  const allowed = new Set(["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "READY_TO_PUBLISH", "PAUSED", "ARCHIVED"])
  if (!allowed.has(status)) {
    throw new HTTPException(400, { message: "不支持的草稿状态" })
  }
  if (!canTransitionDraftStatus(normalizeText(listing.status), status)) {
    throw new HTTPException(400, { message: "当前草稿状态不允许切换到目标状态" })
  }
  db.prepare(`
    update listing
    set status = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(status, listingId)
  updateBucketLatestForSpu(db, listing.spu_code)
  return c.json({ ok: true, listing: db.prepare("select * from listing where id = ?").get(listingId) })
})

prePublish.delete("/drafts/:id", (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  if (["PUBLISHING", "PUBLISH_SUBMITTED"].includes(normalizeText(listing.status))) {
    throw new HTTPException(400, { message: "发布中或已提交的草稿不能删除" })
  }
  db.transaction(() => {
    db.prepare("delete from platform_identity where local_type = 'listing' and local_id = ?").run(listingId)
    db.prepare(`
      delete from platform_identity
      where local_type = 'listing_skc'
        and local_id in (select id from listing_skc where listing_id = ?)
    `).run(listingId)
    db.prepare(`
      delete from platform_identity
      where local_type = 'listing_sku'
        and local_id in (
          select sku.id
          from listing_sku sku
          join listing_skc skc on skc.id = sku.listing_skc_id
          where skc.listing_id = ?
        )
    `).run(listingId)
    db.prepare("delete from listing where id = ?").run(listingId)
    updateBucketLatestForSpu(db, listing.spu_code)
  })()
  return c.json({ ok: true })
})

prePublish.patch("/drafts/:id/category", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as {
    category_id?: unknown
    product_type_id?: unknown
  }
  const categoryId = asPositiveNumber(body.category_id)
  const productTypeId = asPositiveNumber(body.product_type_id)
  if (!categoryId || !productTypeId) {
    throw new HTTPException(400, { message: "请选择 SHEIN 叶子类目" })
  }
  const category = db.prepare(`
    select *
    from channel_category
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
    limit 1
  `).get(categoryId, productTypeId) as SourceRow | undefined
  if (!category) {
    throw new HTTPException(404, { message: "SHEIN 类目不存在" })
  }

  db.prepare(`
    update listing
    set platform_category_id = ?,
      product_type_id = ?,
      platform_category_name = ?,
      platform_category_path = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(categoryId, productTypeId, category.category_name, category.path, listingId)
  persistFill({
    db,
    spuCode: listing.spu_code,
    fieldKey: "category",
    fieldLabel: "SHEIN 类目",
    fieldValue: normalizeText(category.category_name),
    source: "MANUAL_CATEGORY_TREE",
    confidence: 1,
    payload: {
      category_id: categoryId,
      product_type_id: productTypeId,
      category_name: category.category_name,
      path: category.path,
      source: "MANUAL_CATEGORY_TREE",
    },
  })
  const refreshed = refreshListingAfterFill(db, listingId, "人工调整 SHEIN 类目")
  if (!refreshed) {
    throw new HTTPException(500, { message: "调整类目后刷新草稿失败" })
  }
  return c.json({ ok: true, detail: getListingDetail(db, listingId), version: refreshed.version })
})

prePublish.post("/drafts/:id/convert-openapi-single-item", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  if (!isSheinOpenApiUnsupportedSuitCategory(listing.platform_category_name, listing.platform_category_path)) {
    throw new HTTPException(400, { message: "当前草稿不是 SHEIN 套装类目，无需转换" })
  }
  const category = resolveOpenApiSingleItemCategory(db, listing)
  if (!category) {
    throw new HTTPException(404, { message: "未找到可替代的 SHEIN 非套装叶子类目" })
  }

  const readiness = getReadinessForListing(db, listing)
  const titleCn = sanitizeSingleItemTitleCn(readiness?.title_cn || listing.title, category.category_name)
  const titleEn = sanitizeSingleItemTitleEn(readiness?.title_en || listing.title, category.category_name)
  const transaction = db.transaction(() => {
    persistFill({
      db,
      spuCode: listing.spu_code,
      fieldKey: "category",
      fieldLabel: "SHEIN 类目",
      fieldValue: normalizeText(category.category_name),
      source: "OPENAPI_SINGLE_ITEM_CONVERT",
      confidence: 0.88,
      payload: {
        category_id: Number(category.category_id),
        product_type_id: Number(category.product_type_id),
        category_name: category.category_name,
        path: category.path,
        source: "OPENAPI_SINGLE_ITEM_CONVERT",
        original_category_id: listing.platform_category_id,
        original_category_name: listing.platform_category_name,
      },
    })
    if (titleCn) {
      persistFill({
        db,
        spuCode: listing.spu_code,
        fieldKey: "title_cn",
        fieldLabel: "中文标题",
        fieldValue: titleCn,
        source: "OPENAPI_SINGLE_ITEM_CONVERT",
        confidence: 0.86,
        payload: {
          original_title: readiness?.title_cn || listing.title,
          reason: "SHEIN OpenAPI 暂不支持套装商品，发布稿按主售单品清理标题中的套装语义。",
        },
      })
    }
    if (titleEn) {
      persistFill({
        db,
        spuCode: listing.spu_code,
        fieldKey: "title_en",
        fieldLabel: "英文标题",
        fieldValue: titleEn,
        source: "OPENAPI_SINGLE_ITEM_CONVERT",
        confidence: 0.86,
        payload: {
          original_title: readiness?.title_en || listing.title,
          reason: "SHEIN OpenAPI 暂不支持套装商品，发布稿按主售单品清理标题中的 Set/Outfit 语义。",
        },
      })
    }
    db.prepare(`
      update listing
      set platform_category_id = ?,
        product_type_id = ?,
        platform_category_name = ?,
        platform_category_path = ?,
        title = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(
      Number(category.category_id),
      Number(category.product_type_id),
      category.category_name,
      category.path,
      titleEn || titleCn || listing.title,
      listingId,
    )
  })
  transaction()

  const refreshed = refreshListingAfterFill(db, listingId, "转换为 SHEIN OpenAPI 单品发布")
  if (!refreshed) {
    throw new HTTPException(500, { message: "转换后刷新草稿失败" })
  }
  return c.json({
    ok: true,
    category: {
      category_id: Number(category.category_id),
      product_type_id: Number(category.product_type_id),
      category_name: category.category_name,
      path: category.path,
    },
    title_cn: titleCn,
    title_en: titleEn,
    detail: getListingDetail(db, listingId),
    version: refreshed.version,
  })
})

prePublish.patch("/drafts/:id/fields", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json() as {
    fields?: Array<{
      field_key?: string
      field_label?: string
      field_value?: string
      skc_code?: string | null
      sku_code?: string | null
      source?: string
      confidence?: number | null
    }>
  }
  const fields = Array.isArray(body.fields) ? body.fields : []
  if (fields.length === 0) {
    throw new HTTPException(400, { message: "没有要保存的字段" })
  }
  const transaction = db.transaction(() => {
    for (const field of fields) {
      const fieldKey = normalizeText(field.field_key)
      if (!fieldKey) continue
      const scopeKey = buildScopeKey({
        spuCode: listing.spu_code,
        skcCode: field.skc_code,
        skuCode: field.sku_code,
        fieldKey,
      })
      db.prepare(`
        insert into listing_field_fill (
          scope_key,
          spu_code,
          skc_code,
          sku_code,
          field_key,
          field_label,
          field_value,
          source,
          confidence,
          status,
          payload_json,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        on conflict(scope_key) do update set
          field_label = excluded.field_label,
          field_value = excluded.field_value,
          source = excluded.source,
          confidence = excluded.confidence,
          status = 'ACTIVE',
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).run(
        scopeKey,
        listing.spu_code,
        field.skc_code ?? null,
        field.sku_code ?? null,
        fieldKey,
        normalizeText(field.field_label),
        normalizeFillFieldValue(fieldKey, field.field_label, field.field_value),
        normalizeText(field.source ?? "MANUAL") || "MANUAL",
        field.confidence ?? null,
        JSON.stringify({ listing_id: listingId, saved_from: "draft_detail" }),
      )
    }
  })
  transaction()
  const refreshed = refreshListingAfterFill(db, listingId, `人工编辑 ${fields.length} 个字段`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "草稿刷新失败" })
  }
  return c.json({ ok: true, version: refreshed.version, detail: getListingDetail(db, listingId) })
})

prePublish.post("/drafts/:id/save", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as {
    fields?: Array<{
      field_key?: string
      field_label?: string
      field_value?: string | number | null
      skc_code?: string | null
      sku_code?: string | null
      source?: string
      confidence?: number | null
    }>
    selected_skc_ids?: number[]
    selected_sku_ids?: number[]
    sku_size_values?: Array<{
      sku_id?: unknown
      shein_size_value?: unknown
      attribute_value_id?: unknown
      attribute_value?: unknown
    }>
    sku_weight_values?: Array<{
      sku_id?: unknown
      package_weight_g?: unknown
    }>
    sku_commercial_values?: Array<{
      sku_id?: unknown
      cost_price?: unknown
      currency?: unknown
      package_length_cm?: unknown
      package_width_cm?: unknown
      package_height_cm?: unknown
    }>
    skc_color_values?: Array<{
      skc_id?: unknown
      attribute_value_id?: unknown
      attribute_value?: unknown
      custom_attribute_value?: unknown
    }>
    image_confirmed_skc_ids?: number[]
  }
  const fields = Array.isArray(body.fields) ? body.fields : []
  const skuSizeValues = Array.isArray(body.sku_size_values) ? body.sku_size_values : []
  const skuWeightValues = Array.isArray(body.sku_weight_values) ? body.sku_weight_values : []
  const skuCommercialValues = Array.isArray(body.sku_commercial_values) ? body.sku_commercial_values : []
  const skcColorValues = Array.isArray(body.skc_color_values) ? body.skc_color_values : []
  const hasSkcSelection = Array.isArray(body.selected_skc_ids)
  const hasSkuSelection = Array.isArray(body.selected_sku_ids)
  const hasImageConfirmation = Array.isArray(body.image_confirmed_skc_ids)
  const selectedSkcIds = new Set((body.selected_skc_ids ?? []).map(Number).filter(Number.isFinite))
  const selectedSkuIds = new Set((body.selected_sku_ids ?? []).map(Number).filter(Number.isFinite))
  const confirmedSkcIds = new Set((body.image_confirmed_skc_ids ?? []).map(Number).filter(Number.isFinite))

  const transaction = db.transaction(() => {
    for (const field of fields) {
      const fieldKey = normalizeText(field.field_key)
      if (!fieldKey) continue
      const scopeKey = buildScopeKey({
        spuCode: listing.spu_code,
        skcCode: field.skc_code,
        skuCode: field.sku_code,
        fieldKey,
      })
      db.prepare(`
        insert into listing_field_fill (
          scope_key,
          spu_code,
          skc_code,
          sku_code,
          field_key,
          field_label,
          field_value,
          source,
          confidence,
          status,
          payload_json,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        on conflict(scope_key) do update set
          field_label = excluded.field_label,
          field_value = excluded.field_value,
          source = excluded.source,
          confidence = excluded.confidence,
          status = 'ACTIVE',
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).run(
        scopeKey,
        listing.spu_code,
        field.skc_code ?? null,
        field.sku_code ?? null,
        fieldKey,
        normalizeText(field.field_label),
        normalizeFillFieldValue(fieldKey, field.field_label, field.field_value),
        normalizeText(field.source ?? "MANUAL") || "MANUAL",
        field.confidence ?? null,
        JSON.stringify({ listing_id: listingId, saved_from: "draft_whole_save" }),
      )
    }

    if (hasSkcSelection) {
      db.prepare(`
        update listing_skc
        set selected_for_publish = case when id in (
          ${selectedSkcIds.size ? Array.from(selectedSkcIds).map(() => "?").join(",") : "null"}
        ) then 1 else 0 end,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where listing_id = ?
      `).run(...Array.from(selectedSkcIds), listingId)
    }

    if (hasSkuSelection) {
      db.prepare(`
        update listing_sku
        set selected_for_publish = case when id in (
          ${selectedSkuIds.size ? Array.from(selectedSkuIds).map(() => "?").join(",") : "null"}
        ) then 1 else 0 end,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where listing_skc_id in (
          select id from listing_skc where listing_id = ?
        )
      `).run(...Array.from(selectedSkuIds), listingId)
    }

    updateListingSkuSizes({ db, listingId, skuSizeValues })
    updateListingSkuWeights({ db, listingId, skuWeightValues })
    updateListingSkuCommercials({ db, listingId, skuCommercialValues })
    updateListingSkcColors({ db, listingId, skcColorValues })

    if (hasImageConfirmation) {
      db.prepare(`
        update listing_skc
        set image_confirmed = case when id in (
          ${confirmedSkcIds.size ? Array.from(confirmedSkcIds).map(() => "?").join(",") : "null"}
        ) then 1 else 0 end,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where listing_id = ?
      `).run(...Array.from(confirmedSkcIds), listingId)
    }
  })
  transaction()

  const refreshed = refreshListingAfterFill(db, listingId, `保存草稿：字段 ${fields.length} 个，颜色 ${skcColorValues.length} 个，尺码 ${skuSizeValues.length} 个，毛重 ${skuWeightValues.length} 个，价格包装 ${skuCommercialValues.length} 个`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "草稿保存后刷新失败" })
  }
  return c.json({ ok: true, version: refreshed.version, detail: getListingDetail(db, listingId) })
})

prePublish.post("/drafts/:id/ai-enrich", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as { mode?: string }
  const mode = normalizeText(body.mode || "all")
  const readiness = getReadinessForListing(db, listing)
  if (!readiness) {
    throw new HTTPException(404, { message: "商品档案不存在" })
  }
  const saved: Array<Record<string, unknown>> = []

  if (mode === "all" || mode === "category") {
    if (shouldAutoApplyCategory(readiness.category)) {
      persistCategoryFill(db, readiness)
      db.prepare(`
        update listing
        set platform_category_id = ?,
          product_type_id = ?,
          platform_category_name = ?,
          platform_category_path = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ?
      `).run(
        readiness.category.category_id,
        readiness.category.product_type_id,
        readiness.category.category_name,
        readiness.category.path,
        listingId,
      )
      saved.push({
        field_key: "category",
        field_label: "SHEIN 类目",
        field_value: readiness.category.category_name,
        source: "CATEGORY_RULE",
      })
    } else if (readiness.category.category_id && readiness.category.product_type_id) {
      persistFill({
        db,
        spuCode: readiness.spu_code,
        fieldKey: "category",
        fieldLabel: "SHEIN 类目候选",
        fieldValue: readiness.category.category_name || String(readiness.category.category_id),
        source: "AI_CATEGORY_SUGGESTED",
        confidence: 0.58,
        payload: {
          category_id: readiness.category.category_id,
          product_type_id: readiness.category.product_type_id,
          category_name: readiness.category.category_name,
          path: readiness.category.path,
          source: readiness.category.source,
          requires_manual_confirm: true,
        },
      })
      saved.push({
        field_key: "category",
        field_label: "SHEIN 类目候选",
        field_value: readiness.category.category_name,
        source: "AI_CATEGORY_SUGGESTED",
      })
    }
  }

  if (mode === "all" || mode === "title") {
    const titleEn = await callAiTranslateTitle(readiness)
    if (titleEn) {
      persistFill({
        db,
        spuCode: readiness.spu_code,
        fieldKey: "title_en",
        fieldLabel: "英文标题",
        fieldValue: titleEn,
        source: "AI_TRANSLATED",
        confidence: 0.78,
        payload: { title_cn: readiness.title_cn, category: readiness.category },
      })
      saved.push({
        field_key: "title_en",
        field_label: "英文标题",
        field_value: titleEn,
      })
    }
  }

  if (mode === "all" || mode === "attributes") {
    const aiFills = await callAiFill(readiness)
      .catch(() => [] as Array<Record<string, unknown>>) as Array<Record<string, unknown>>
    const byKey = new Map(aiFills.map((fill) => [String(fill.field_key), fill]))
    for (const field of readiness.manual_fields) {
      const aiFill = byKey.get(field.key)
      const candidateValue = normalizeFillFieldValue(field.key, field.label, aiFill?.field_value)
      const validValues = new Set((field.options ?? []).map((option) => option.attribute_value))
      const fieldValue = candidateValue && validValues.has(candidateValue)
        ? candidateValue
        : heuristicAiValue(field, readiness)
      if (!fieldValue) continue
      const confidence = Number(aiFill?.confidence)
      persistFill({
        db,
        spuCode: readiness.spu_code,
        fieldKey: field.key,
        fieldLabel: field.label,
        fieldValue: normalizeFillFieldValue(field.key, field.label, fieldValue),
        source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        confidence: Number.isFinite(confidence) ? confidence : 0.62,
        payload: aiFill ?? {
          fallback: true,
          context: "draft_ai_enrich",
        },
      })
      saved.push({
        field_key: field.key,
        field_label: field.label,
        field_value: fieldValue,
      })
    }
  }

  const refreshed = refreshListingAfterFill(db, listingId, `AI 丰富草稿：${mode}`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "AI 丰富后刷新草稿失败" })
  }
  return c.json({ ok: true, saved_count: saved.length, fills: saved, detail: getListingDetail(db, listingId) })
})

prePublish.post("/drafts/:id/ai-field", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as { field_key?: string }
  const fieldKey = normalizeText(body.field_key)
  if (!fieldKey) {
    throw new HTTPException(400, { message: "缺少字段 key" })
  }
  const readiness = getReadinessForListing(db, listing)
  if (!readiness) {
    throw new HTTPException(404, { message: "商品档案不存在" })
  }
  const generated = await generateSingleAiField(readiness, fieldKey)
  persistFill({
    db,
    spuCode: readiness.spu_code,
    fieldKey: generated.field.key,
    fieldLabel: generated.field.label,
    fieldValue: generated.fieldValue,
    source: generated.source,
    confidence: generated.confidence,
    payload: generated.payload,
  })
  const refreshed = refreshListingAfterFill(db, listingId, `AI 生成字段：${generated.field.label}`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "AI 生成字段后刷新草稿失败" })
  }
  return c.json({
    ok: true,
    field: {
      field_key: generated.field.key,
      field_label: generated.field.label,
      field_value: generated.fieldValue,
      source: generated.source,
      confidence: generated.confidence,
    },
    detail: getListingDetail(db, listingId),
  })
})

function skcFingerprint(value: unknown) {
  return normalizeText(value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
}

function uploadsRoot() {
  return path.join(DATA_DIR, "listing-assets")
}

function imageContentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

function importListingImagesFromFolder(db: ReturnType<typeof getDb>, listingId: number, folderPath: string) {
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new HTTPException(400, { message: "本地图片目录不存在" })
  }

  const listingSkcs = db.prepare(`
    select *
    from listing_skc
    where listing_id = ?
    order by skc_code
  `).all(listingId) as SourceRow[]
  const folderFinger = skcFingerprint(path.basename(folderPath))
  const fallbackSkc = listingSkcs.find((skc) => folderFinger.includes(skcFingerprint(skc.skc_code)))
    ?? listingSkcs.find((skc) => folderFinger.includes(skcFingerprint(String(skc.skc_code).split(":").pop())))
    ?? listingSkcs[0]
  const files = fs.readdirSync(folderPath)
    .filter((fileName) => /\.(jpe?g|png|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
  const insert = db.prepare(`
    insert into listing_asset (
      listing_id,
      listing_skc_id,
      skc_code,
      source_type,
      asset_type,
      image_sort,
      local_path,
      file_size,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'MANUAL_FOLDER_IMPORT', ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `)
  const saved: SourceRow[] = []
  const transaction = db.transaction(() => {
    for (const fileName of files) {
      const filePath = path.join(folderPath, fileName)
      const fileFinger = skcFingerprint(fileName)
      const matchedSkc = listingSkcs.find((skc) => fileFinger.includes(skcFingerprint(skc.skc_code)))
        ?? listingSkcs.find((skc) => fileFinger.includes(skcFingerprint(String(skc.skc_code).split(":").pop())))
        ?? fallbackSkc
      if (!matchedSkc) continue
      const classified = classifyImportedImage(fileName)
      const fileSize = fs.statSync(filePath).size
      const result = insert.run(
        listingId,
        matchedSkc.id,
        matchedSkc.skc_code,
        classified.assetType,
        classified.sort,
        filePath,
        fileSize,
        classified.note,
        JSON.stringify({
          file_name: fileName,
          folder_path: folderPath,
          file_size: fileSize,
          requirement_key: classified.requirementKey,
          classification_rule: "filename_index",
        }),
      )
      saved.push(db.prepare("select * from listing_asset where id = ?").get(result.lastInsertRowid) as SourceRow)
    }
  })
  transaction()
  return { listing, assets: saved }
}

prePublish.post("/drafts/batch-import-folders", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as { listing_ids?: unknown[]; folder_path?: string }
  const listingIds = Array.from(new Set((Array.isArray(body.listing_ids) ? body.listing_ids : []).map(Number).filter((id) => Number.isFinite(id) && id > 0)))
  const folderPath = normalizeText(body.folder_path)
  if (listingIds.length === 0) throw new HTTPException(400, { message: "请先勾选草稿" })
  const items = listingIds.map((listingId) => {
    try {
      const result = importListingImagesFromFolder(db, listingId, folderPath)
      return { listing_id: listingId, ok: true, imported_count: result.assets.length }
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片目录导入失败"
      return { listing_id: listingId, ok: false, imported_count: 0, message }
    }
  })
  return c.json({
    ok: items.every((item) => item.ok),
    imported_count: items.reduce((sum, item) => sum + item.imported_count, 0),
    items,
  })
})

prePublish.post("/drafts/:id/images/import-folder", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const body = await c.req.json().catch(() => ({})) as { folder_path?: string }
  const folderPath = normalizeText(body.folder_path)
  const result = importListingImagesFromFolder(db, listingId, folderPath)
  return c.json({
    ok: true,
    imported_count: result.assets.length,
    assets: result.assets,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.get("/drafts/:id/image-candidates", (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const requirementKey = normalizeText(c.req.query("requirement_key"))
  const requirement = getImageRequirements(db, listing).find((item) => item.requirement_key === requirementKey)
  if (!requirement) {
    throw new HTTPException(400, { message: "图片规则不存在" })
  }
  const skcCode = normalizeText(c.req.query("skc_code"))
  const q = normalizeText(c.req.query("q"))
  const onlyCompliant = normalizeText(c.req.query("only_compliant")) === "1"
  const sourceKinds = batchTerms(c.req.query("source_kinds"))
    .map((item) => item.toUpperCase())
    .filter((item) => ["PICTURE", "DETAIL_SCREENSHOT", "DETAIL_MODULE"].includes(item))
  const sourcePlaces = batchTerms(c.req.query("source_places"))
    .map((item) => item.toUpperCase())
    .filter(Boolean)
  const limit = readLimit(c.req.query("limit"), 120, 240)
  const offset = readOffset(c.req.query("offset"))
  const clauses = [
    "coalesce(asset.normalized_url, asset.source_url, '') <> ''",
    "(asset.spu_code = ? or asset.owner_code = ? or asset.owner_code like ?)",
  ]
  const params: unknown[] = [listing.spu_code, listing.spu_code, `%${listing.spu_code}%`]
  if (sourceKinds.length > 0) {
    clauses.push(`asset.source_kind in (${sourceKinds.map(() => "?").join(",")})`)
    params.push(...sourceKinds)
  }
  if (skcCode) {
    clauses.push("(coalesce(asset.skc_code, '') = '' or asset.skc_code = ? or asset.owner_code = ? or asset.owner_code like ?)")
    params.push(skcCode, skcCode, `%${skcCode}%`)
  }
  if (q) {
    const like = `%${q}%`
    clauses.push(`(
      asset.spu_code like ?
      or asset.skc_code like ?
      or asset.owner_code like ?
      or asset.asset_type like ?
      or asset.picture_type like ?
      or asset.file_name like ?
      or asset.module_name like ?
      or asset.place like ?
    )`)
    params.push(like, like, like, like, like, like, like, like)
  }
  const platformClauses = [...clauses]
  const platformParams = [...params]
  if (sourcePlaces.length > 0) {
    clauses.push(`upper(coalesce(asset.place, '')) in (${sourcePlaces.map(() => "?").join(",")})`)
    params.push(...sourcePlaces)
  }

  const sourcePlaceRows = db.prepare(`
    select asset.place as source_place, count(*) as count
    from product_asset asset
    where ${platformClauses.join(" and ")}
      and coalesce(asset.place, '') <> ''
    group by asset.place
    order by
      case upper(asset.place)
        when 'TMALL' then 0
        when 'VIP' then 1
        when 'TAOBAO' then 2
        when 'JD' then 3
        else 9
      end,
      count(*) desc,
      asset.place
  `).all(...platformParams) as SourceRow[]

  const rows = db.prepare(`
    select
      asset.*,
      pkg.title as content_title,
      pkg.brand_name as content_brand_name,
      pkg.category_name as content_category_name
    from product_asset asset
    left join product_content_package pkg on pkg.id = asset.content_package_id
    where ${clauses.join(" and ")}
    order by
      case
        when asset.skc_code = ? then 0
        when coalesce(asset.skc_code, '') = '' then 1
        else 2
      end,
      case
        when asset.source_kind = 'PICTURE' then 0
        when asset.source_kind = 'DETAIL_SCREENSHOT' then 1
        when asset.source_kind = 'DETAIL_MODULE' then 2
        else 3
      end,
      coalesce(asset.sort_no, asset.module_index, asset.detail_page_index, 999999),
      asset.id
    limit ? offset ?
  `).all(...params, skcCode, limit, offset) as SourceRow[]

  const items = rows
    .map((asset) => {
      const compliance = imageCompliance(asset, requirement)
      return {
        ...asset,
        preview_url: normalizeText(asset.normalized_url) || normalizeText(asset.source_url),
        recommended_asset_type: inferAssetTypeFromLibraryAsset(asset, requirement),
        compliance,
      }
    })
    .sort((a, b) => {
      const typeA = requirement.asset_types.includes(normalizeText(a.asset_type)) ? 0 : 1
      const typeB = requirement.asset_types.includes(normalizeText(b.asset_type)) ? 0 : 1
      const statusScore = { PASS: 0, WARN: 1, FAIL: 2 } as const
      const placeScore = (value: unknown) => {
        const place = normalizeText(value).toUpperCase()
        if (place === "TMALL") return 0
        if (place === "VIP") return 1
        if (place === "TAOBAO") return 2
        if (place === "JD") return 3
        return 9
      }
      return statusScore[a.compliance.status as keyof typeof statusScore] - statusScore[b.compliance.status as keyof typeof statusScore]
        || typeA - typeB
        || placeScore(a.place) - placeScore(b.place)
        || Number(a.sort_no ?? a.module_index ?? a.detail_page_index ?? 999999) - Number(b.sort_no ?? b.module_index ?? b.detail_page_index ?? 999999)
        || Number(a.id ?? 0) - Number(b.id ?? 0)
    })
    .filter((asset) => !onlyCompliant || asset.compliance.compliant)

  return c.json({
    items,
    pagination: {
      limit,
      offset,
      total: items.length,
    },
    source_places: sourcePlaceRows,
    requirement,
  })
})

prePublish.post("/drafts/:id/images/from-library", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as {
    asset_id?: unknown
    skc_code?: unknown
    requirement_key?: unknown
    asset_type?: unknown
  }
  const productAssetId = Number(body.asset_id)
  if (!Number.isFinite(productAssetId) || productAssetId <= 0) {
    throw new HTTPException(400, { message: "请选择素材库图片" })
  }
  const productAsset = db.prepare("select * from product_asset where id = ?").get(productAssetId) as SourceRow | undefined
  if (!productAsset) {
    throw new HTTPException(404, { message: "素材库图片不存在" })
  }
  const requirementKey = normalizeText(body.requirement_key)
  const requirement = getImageRequirements(db, listing).find((item) => item.requirement_key === requirementKey)
  if (!requirement) {
    throw new HTTPException(400, { message: "图片规则不存在" })
  }
  const skcCode = normalizeText(body.skc_code) || normalizeText(productAsset.skc_code)
  const listingSkc = skcCode
    ? db.prepare("select * from listing_skc where listing_id = ? and skc_code = ?").get(listingId, skcCode) as SourceRow | undefined
    : undefined
  if (requirement.level === "SKC" && !listingSkc) {
    throw new HTTPException(400, { message: "SKC 图片必须指定草稿内的款色" })
  }
  const assetType = normalizeText(body.asset_type) || inferAssetTypeFromLibraryAsset(productAsset, requirement)
  const sortRow = db.prepare(`
    select coalesce(max(image_sort), 0) + 1 as next_sort
    from listing_asset
    where listing_id = ?
      and coalesce(skc_code, '') = coalesce(?, '')
      and asset_type = ?
  `).get(listingId, skcCode || null, assetType) as SourceRow | undefined
  const imageSort = Number(sortRow?.next_sort ?? 1)
  const compliance = imageCompliance(productAsset, requirement)
  const result = db.prepare(`
    insert into listing_asset (
      listing_id,
      listing_skc_id,
      skc_code,
      source_type,
      asset_type,
      image_sort,
      source_url,
      width,
      height,
      file_size,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'IMAGE_LIBRARY', ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    listingId,
    listingSkc?.id ?? null,
    skcCode || null,
    assetType,
    imageSort,
    normalizeText(productAsset.normalized_url) || normalizeText(productAsset.source_url),
    asPositiveNumber(productAsset.width),
    asPositiveNumber(productAsset.height),
    asPositiveNumber(productAsset.file_size),
    `素材库选图：${requirement.name}`,
    JSON.stringify({
      product_asset_id: productAsset.id,
      requirement_key: requirement.requirement_key,
      source_kind: productAsset.source_kind,
      asset_type: productAsset.asset_type,
      picture_type: productAsset.picture_type,
      file_name: productAsset.file_name,
      compliance,
    }),
  )

  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(result.lastInsertRowid),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.post("/drafts/:id/images/upload", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "请选择要上传的图片" })
  }
  const skcCode = normalizeText(form.get("skc_code"))
  const requirementKey = normalizeText(form.get("requirement_key"))
  const assetType = normalizeText(form.get("asset_type")) || inferAssetTypeFromRequirement(requirementKey, file.name)
  const listingSkc = skcCode
    ? db.prepare("select * from listing_skc where listing_id = ? and skc_code = ?").get(listingId, skcCode) as SourceRow | undefined
    : undefined
  const sortRow = db.prepare(`
    select coalesce(max(image_sort), 0) + 1 as next_sort
    from listing_asset
    where listing_id = ?
      and coalesce(skc_code, '') = coalesce(?, '')
      and asset_type = ?
  `).get(listingId, skcCode || null, assetType) as SourceRow | undefined
  const imageSort = Number(sortRow?.next_sort ?? 1)
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.jpg"}`
  const dir = path.join(uploadsRoot(), String(listingId), skcFingerprint(skcCode || "spu"))
  fs.mkdirSync(dir, { recursive: true })
  const localPath = path.join(dir, safeName)
  const bytes = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(localPath, bytes)
  const result = db.prepare(`
    insert into listing_asset (
      listing_id,
      listing_skc_id,
      skc_code,
      source_type,
      asset_type,
      image_sort,
      local_path,
      file_size,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'MANUAL_UPLOAD', ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    listingId,
    listingSkc?.id ?? null,
    skcCode || null,
    assetType,
    imageSort,
    localPath,
    bytes.length,
    `人工上传 ${requirementKey || assetType}`,
    JSON.stringify({
      file_name: file.name,
      requirement_key: requirementKey || null,
      content_type: imageContentType(file.name),
      size: bytes.length,
    }),
  )
  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(result.lastInsertRowid),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.patch("/drafts/:id/images/:assetId", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const assetId = Number(c.req.param("assetId"))
  const body = await c.req.json().catch(() => ({})) as {
    asset_type?: unknown
    image_sort?: unknown
    confirmed?: unknown
    note?: unknown
  }
  const asset = db.prepare("select * from listing_asset where id = ? and listing_id = ?").get(assetId, listingId) as SourceRow | undefined
  if (!asset) {
    throw new HTTPException(404, { message: "草稿图片不存在" })
  }
  const nextAssetType = normalizeText(body.asset_type) || normalizeText(asset.asset_type)
  const nextSort = asPositiveNumber(body.image_sort) ?? asPositiveNumber(asset.image_sort) ?? 1
  const confirmed = body.confirmed == null
    ? Number(asset.confirmed ?? 0)
    : (Number(body.confirmed) === 1 || body.confirmed === true ? 1 : 0)
  db.prepare(`
    update listing_asset
    set asset_type = ?,
      image_sort = ?,
      confirmed = ?,
      note = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_id = ?
  `).run(nextAssetType, Math.round(nextSort), confirmed, normalizeText(body.note), assetId, listingId)
  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(assetId),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.delete("/drafts/:id/images/:assetId", (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const assetId = Number(c.req.param("assetId"))
  const asset = db.prepare("select * from listing_asset where id = ? and listing_id = ?").get(assetId, listingId) as SourceRow | undefined
  if (!asset) {
    throw new HTTPException(404, { message: "草稿图片不存在" })
  }
  db.prepare("delete from listing_asset where id = ? and listing_id = ?").run(assetId, listingId)
  return c.json({
    ok: true,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.get("/assets/:id/file", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const asset = db.prepare("select * from listing_asset where id = ?").get(id) as SourceRow | undefined
  const localPath = normalizeText(asset?.local_path)
  if (!asset || !localPath || !fs.existsSync(localPath)) {
    throw new HTTPException(404, { message: "图片不存在" })
  }
  const ext = path.extname(localPath).toLowerCase()
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
  return new Response(fs.readFileSync(localPath), {
    headers: { "Content-Type": contentType },
  })
})

prePublish.post("/drafts/:id/versions", (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const readiness = getReadinessForListing(db, listing)
  if (!readiness) {
    throw new HTTPException(404, { message: "商品档案不存在" })
  }
  persistListingValidation(db, listing.id, readiness)
  const version = createPublishVersion({
    db,
    listing,
    readiness,
    changeSummary: "手动创建版本快照",
  })
  return c.json({ ok: true, version })
})

prePublish.get("/drafts/:id/publish-payload", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const skcCodes = csvTerms(c.req.query("skc_codes"))
  const preview = buildPublishPayload(db, listingId, {
    skcCodes,
    allowSourceImages: true,
    requirePreparedImages: false,
    allowDefaultSkuWeight: boolConfigValue(Number(c.req.query("allow_default_sku_weight") ?? 0)) === 1,
  })
  return c.json({
    ok: preview.errors.length === 0,
    errors: preview.errors,
    warnings: preview.warnings,
    payload: preview.payload,
  })
})

prePublish.post("/drafts/batch-publish-check", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    listing_ids?: unknown[]
  }
  const listingIds = Array.from(
    new Set(
      (Array.isArray(body.listing_ids) ? body.listing_ids : [])
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  )
  if (listingIds.length === 0) {
    throw new HTTPException(400, { message: "请先勾选要发布的草稿" })
  }

  const items = listingIds.map((listingId) => {
    const detail = getListingDetail(db, listingId)
    if (!detail) {
      return {
        listing_id: listingId,
        ok: false,
        errors: ["草稿不存在"],
        fields: [],
        quick_fixes: {
          fields: [],
          sku_weights: [],
          sku_commercials: [],
          image_confirmations: [],
        },
      }
    }
    const preview = buildPublishPayload(db, listingId)
    const missingWeightSkuCodes = new Set(
      preview.errors
        .map((error) => normalizeText(error).match(/^(.+?) 缺 SKU 毛重$/)?.[1])
        .filter(Boolean) as string[],
    )
    const imageMissingSkcCodes = new Set(
      preview.errors
        .map((error) => normalizeText(error).match(/^(.+?) 图片未确认$/)?.[1])
        .filter(Boolean) as string[],
    )
    const groups = (detail.readiness?.field_groups ?? []) as FieldGroup[]
    const fields = groups.flatMap((group) =>
      group.fields
        .filter((field) => field.status !== "READY")
        .map((field) => ({
          field_key: field.key,
          field_label: field.label,
          field_value: field.value ?? "",
          status: field.status,
          source: field.source,
          note: field.note ?? null,
          group: group.group,
        })),
    )
    const skuWeights = (detail.skus as SourceRow[])
      .filter((sku) =>
        missingWeightSkuCodes.has(normalizeText(sku.sku_code))
        || (
          missingWeightSkuCodes.size > 0
          && Number(sku.selected_for_publish ?? 1) === 1
          && !asPositiveNumber(sku.package_weight_g)
        ),
      )
      .map((sku) => ({
        sku_id: sku.id,
        sku_code: sku.sku_code,
        skc_code: sku.skc_code,
        size_name: sku.size_name,
        package_weight_g: sku.package_weight_g,
        selected_for_publish: Number(sku.selected_for_publish ?? 1) === 1,
      }))
    const imageConfirmations = (detail.skcs as SourceRow[])
      .filter((skc) =>
        imageMissingSkcCodes.has(normalizeText(skc.skc_code))
        || Number(skc.image_confirmed ?? 0) === 1
        || (
          imageMissingSkcCodes.size > 0
          && Number(skc.selected_for_publish ?? 1) === 1
        ),
      )
      .map((skc) => ({
        skc_id: skc.id,
        skc_code: skc.skc_code,
        color_name: skc.color_name,
        image_url: skc.image_url,
        selected_for_publish: Number(skc.selected_for_publish ?? 1) === 1,
        confirmed: Number(skc.image_confirmed ?? 0) === 1,
        required: imageMissingSkcCodes.has(normalizeText(skc.skc_code)),
      }))
    return {
      listing_id: listingId,
      spu_code: detail.listing.spu_code,
      title: detail.listing.title,
      category_name: detail.listing.platform_category_name,
      ok: preview.errors.length === 0,
      errors: preview.errors,
      fields,
      quick_fixes: {
        fields,
        sku_weights: skuWeights,
        sku_commercials: (detail.skus as SourceRow[])
          .filter((sku) => Number(sku.selected_for_publish ?? 1) === 1)
          .map((sku) => ({
            sku_id: sku.id,
            sku_code: sku.sku_code,
            skc_code: sku.skc_code,
            size_name: sku.size_name,
            cost_price: sku.cost_price,
            currency: sku.currency,
            package_length_cm: sku.package_length_cm,
            package_width_cm: sku.package_width_cm,
            package_height_cm: sku.package_height_cm,
          })),
        image_confirmations: imageConfirmations,
      },
    }
  })

  return c.json({
    ok: items.every((item) => item.ok),
    items,
    blocker_count: items.reduce((sum, item) => sum + item.errors.length, 0),
  })
})

prePublish.post("/drafts/:id/publish", async (c) => {
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as {
    confirm?: boolean
    dry_run?: boolean
    skc_codes?: string[]
    allow_default_sku_weight?: boolean
  }
  const skcCodes = Array.isArray(body.skc_codes) ? body.skc_codes : []
  const allowDefaultSkuWeight = Boolean(body.allow_default_sku_weight)
  if (body.dry_run || !body.confirm) {
    const preview = buildPublishPayload(db, listingId, { skcCodes, allowDefaultSkuWeight })
    return c.json({
      ok: preview.errors.length === 0,
      dry_run: true,
      errors: preview.errors,
      warnings: preview.warnings,
      payload: preview.payload,
    })
  }

  const readiness = getReadinessForListing(db, listing)
  if (!readiness) {
    throw new HTTPException(404, { message: "商品档案不存在" })
  }

  const version = createPublishVersion({
    db,
    listing,
    readiness,
    versionType: "PUBLISH",
    changeSummary: "提交 SHEIN 发布",
  })
  const preview = buildPublishPayload(db, listingId, { skcCodes, allowSourceImages: true, requirePreparedImages: false, allowDefaultSkuWeight })
  if (preview.errors.length > 0) {
    db.prepare(`
      update listing_publish_version
      set status = 'FAILED',
        request_payload_json = ?,
        error_code = 'LOCAL_VALIDATION',
        error_message = ?
      where id = ?
    `).run(JSON.stringify(preview.payload), `发布前仍有阻断项：${preview.errors.join("；")}`, version.id)
    throw new HTTPException(400, { message: `发布前仍有阻断项：${preview.errors.join("；")}` })
  }
  db.prepare(`
    update listing_publish_version
    set status = 'PUBLISHING',
      request_payload_json = ?
    where id = ?
  `).run(JSON.stringify(preview.payload), version.id)
  const { task } = ensurePublishTask(db, {
    listingId: listing.id,
    publishVersionId: Number(version.id),
    platform: normalizeText(listing.platform) || "SHEIN",
    taskType: "PUBLISH_LISTING",
    status: "PUBLISHING",
    attemptCount: 1,
    requestPayload: preview.payload,
  })
  const taskId = Number(task.id)
  db.prepare(`
    update listing
    set status = 'PUBLISHING',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(listing.id)

  const built = await (async () => {
    try {
      await prepareListingImagesForPublish(db, listingId)
      const prepared = buildPublishPayload(db, listingId, { skcCodes, allowDefaultSkuWeight })
      if (prepared.errors.length > 0) {
        throw new Error(`发布前仍有阻断项：${prepared.errors.join("；")}`)
      }
      updatePublishTaskRequestPayload(db, taskId, prepared.payload)
      db.prepare(`
        update listing_publish_version
        set request_payload_json = ?
        where id = ?
      `).run(JSON.stringify(prepared.payload), version.id)
      return prepared
    } catch (error) {
      const message = error instanceof Error ? error.message : "SHEIN 图片准备失败"
      markPublishTaskFailed(db, {
        taskId,
        responsePayload: {},
        errorCode: "IMAGE_PREPARE_FAILED",
        errorMessage: message,
      })
      db.prepare(`
        update listing_publish_version
        set status = 'FAILED',
          error_code = 'IMAGE_PREPARE_FAILED',
          error_message = ?
        where id = ?
      `).run(message, version.id)
      db.prepare(`
        update listing
        set status = 'PUBLISH_FAILED',
          validation_status = 'FAILED',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ?
      `).run(listing.id)
      throw new HTTPException(502, { message })
    }
  })()

  const platformAdapter = platformAdapterFor(normalizeText(listing.platform) || "SHEIN")
  const result = await platformAdapter.publishListing({
    credentials: resolveSheinCredentials(db),
    payload: built.payload,
  })
  const code = responseCode(result.payload)
  const message = responseMessage(result.payload)
  const info = publishInfo(result.payload)
  const platformVersion = normalizeText(info.version)
  const businessValidationErrors = publishBusinessValidationErrors(result.payload)

  if (code === "0" && info.success !== false && businessValidationErrors.length === 0) {
    db.prepare(`
      update listing_publish_task
      set status = 'PUBLISH_SUBMITTED',
        response_payload_json = ?,
        platform_trace_id = ?,
        platform_version = ?,
        finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(JSON.stringify(result.payload), normalizeText(parseJsonObject(result.payload).traceId), platformVersion, taskId)
    db.prepare(`
      update listing_publish_version
      set status = 'SUBMITTED',
        response_payload_json = ?,
        platform_version = ?,
        submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(JSON.stringify(result.payload), platformVersion, version.id)
    db.prepare(`
      update listing
      set status = 'PUBLISH_SUBMITTED',
        validation_status = 'PASSED',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(listing.id)
    db.prepare(`
      update shein_product_bucket
      set bucket_status = 'PUBLISHED',
        latest_listing_id = ?,
        latest_version_no = ?,
        latest_publish_status = 'PUBLISH_SUBMITTED',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where spu_code = ?
    `).run(listing.id, version.version_no, listing.spu_code)
    db.prepare("delete from listing_validation_result where listing_id = ?").run(listing.id)
    persistPlatformIdentity({ db, listing, version, responsePayload: result.payload })
    return c.json({
      ok: true,
      task_id: taskId,
      version_id: version.id,
      status: "PUBLISH_SUBMITTED",
      response: result.payload,
      detail: getListingDetail(db, listingId),
    })
  }

  const failureCode = code === "0" && businessValidationErrors.length > 0
    ? "SHEIN_PRE_VALIDATION"
    : code || String(result.status)
  const failureMessage = code === "0" && businessValidationErrors.length > 0
    ? businessValidationErrors.join("；")
    : message
  markPublishTaskFailed(db, {
    taskId,
    responsePayload: result.payload,
    errorCode: failureCode,
    errorMessage: failureMessage,
  })
  db.prepare(`
    update listing_publish_version
    set status = 'FAILED',
      response_payload_json = ?,
      error_code = ?,
      error_message = ?
    where id = ?
  `).run(JSON.stringify(result.payload), failureCode, failureMessage, version.id)
  db.prepare(`
    update listing
    set status = 'PUBLISH_FAILED',
      validation_status = 'FAILED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(listing.id)
  db.prepare(`
    update shein_product_bucket
    set latest_listing_id = ?,
      latest_version_no = ?,
      latest_publish_status = 'PUBLISH_FAILED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where spu_code = ?
  `).run(listing.id, version.version_no, listing.spu_code)
  db.prepare(`
    insert into listing_validation_result (
      listing_id,
      severity,
      module,
      field_key,
      owner_type,
      owner_id,
      message,
      suggestion
    )
    values (?, 'ERROR', 'SHEIN_PUBLISH', ?, 'LISTING', ?, ?, ?)
  `).run(
    listing.id,
    failureCode,
    listing.id,
    failureMessage || "SHEIN 发布失败",
    "按平台返回错误修正草稿字段后重新提交。",
  )
  return c.json({
    ok: false,
    task_id: taskId,
    version_id: version.id,
    status: "PUBLISH_FAILED",
    error_code: failureCode,
    error_message: failureMessage,
    response: result.payload,
    detail: getListingDetail(db, listingId),
  }, 502)
})

prePublish.post("/field-fills", async (c) => {
  const db = getDb()
  const body = await c.req.json() as {
    spu_code?: string
    skc_code?: string | null
    sku_code?: string | null
    field_key?: string
    field_label?: string
    field_value?: string
    source?: string
    confidence?: number | null
    payload?: unknown
  }
  const spuCode = normalizeText(body.spu_code)
  const fieldKey = normalizeText(body.field_key)
  if (!spuCode || !fieldKey) {
    throw new HTTPException(400, { message: "缺少款号或字段 key" })
  }
  const scopeKey = buildScopeKey({
    spuCode,
    skcCode: body.skc_code,
    skuCode: body.sku_code,
    fieldKey,
  })
  db.prepare(`
    insert into listing_field_fill (
      scope_key,
      spu_code,
      skc_code,
      sku_code,
      field_key,
      field_label,
      field_value,
      source,
      confidence,
      status,
      payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(scope_key) do update set
      field_label = excluded.field_label,
      field_value = excluded.field_value,
      source = excluded.source,
      confidence = excluded.confidence,
      status = 'ACTIVE',
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run(
    scopeKey,
    spuCode,
    body.skc_code ?? null,
    body.sku_code ?? null,
    fieldKey,
    normalizeText(body.field_label),
    normalizeText(body.field_value),
    normalizeText(body.source ?? "MANUAL") || "MANUAL",
    body.confidence ?? null,
    JSON.stringify(body.payload ?? {}),
  )
  return c.json({ ok: true, scope_key: scopeKey })
})

prePublish.post("/ai-fill", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    spu_codes?: string[]
    batch_search?: string
  }
  const query = {
    req: {
      query: (name: string) => {
        if (name === "batch_search") {
          return Array.isArray(body.spu_codes) ? body.spu_codes.join("\n") : body.batch_search
        }
        return undefined
      },
    },
  }
  const readiness = buildReadiness(query)
  const saved: Array<Record<string, unknown>> = []

  for (const row of readiness.items) {
    const titleNeedsAi = row.field_groups
      .flatMap((group) => group.fields)
      .find((field) => field.key === "title_en" && field.status === "NEEDS_AI")
    const fieldsToFill = [
      ...(titleNeedsAi ? [titleNeedsAi] : []),
      ...row.manual_fields,
    ]
    if (fieldsToFill.length === 0) continue
    const aiFills = await callAiFill(row)
      .catch(() => [] as Array<Record<string, unknown>>) as Array<Record<string, unknown>>

    const byKey = new Map(aiFills.map((fill) => [String(fill.field_key), fill]))
    for (const field of fieldsToFill) {
      const aiFill = byKey.get(field.key)
      const candidateValue = normalizeText(aiFill?.field_value)
      const validValues = new Set((field.options ?? []).map((option) => option.attribute_value))
      const fieldValue = field.key === "title_en" && candidateValue
        ? candidateValue
        : candidateValue && validValues.has(candidateValue)
        ? candidateValue
        : heuristicAiValue(field, row)
      if (!fieldValue) continue

      const confidence = Number(aiFill?.confidence)
      persistFill({
        db,
        spuCode: row.spu_code,
        fieldKey: field.key,
        fieldLabel: field.label,
        fieldValue,
        source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        confidence: Number.isFinite(confidence) ? confidence : 0.62,
        payload: aiFill ?? { fallback: true },
      })
      saved.push({
        spu_code: row.spu_code,
        field_key: field.key,
        field_label: field.label,
        field_value: fieldValue,
      })
    }
  }

  return c.json({ ok: true, saved_count: saved.length, fills: saved })
})

export default prePublish
