import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import sharp from "sharp"
import unzipper, { type CentralDirectory, type File as ZipFile } from "unzipper"
import { DATA_DIR, getDb } from "../db"
import { callAiCategoryMatcher } from "../../../scripts/lib/ai_category_matcher.mjs"
import { resolveAiConfig } from "../../../scripts/lib/ai_chat_client.mjs"
import {
  getDefaultAiScenarioRouter,
  withAiRoutingHashes,
} from "../../../scripts/lib/ai_routing_context.mjs"
import { resolveAiScenarioPolicy } from "../../../scripts/lib/ai_scenario_router.mjs"
import { refreshBucketProduct } from "./shein-products"
import { requirePermission } from "../lib/auth"
import { assertLocalImageFile } from "../lib/local-path-guard"
import { resolveSheinCredentials } from "../lib/platform-config"
import { getSheinPriceConfig } from "../lib/price-config"
import { resolvePackageRule } from "../lib/rule-resolver"
import { detectImageUploadType, maxUploadBytes, readImageDimensions, readValidatedUploadBuffer, safeUploadFileName } from "../lib/upload-guard"
import { platformAdapterFor } from "../platform-adapters"
import {
  ensurePublishTask,
  findUnresolvedPublishTask,
  markPublishTaskFailed,
  markPublishTransportUnknown,
  updatePublishTaskRequestPayload,
} from "../services/publish/publish-job-service"
import { canTransitionDraftStatus } from "../services/pre-publish/drafts"
import { resolveSheinKidsCategoryFallback } from "../services/pre-publish/category-fallback"
import {
  categoryAutoSelectionDecision,
  normalizeAiCategoryCandidate,
  normalizedAiCategoryPayload,
  normalizeLiveAiSkcCategorySuggestions,
  type CategoryAutoSelectionDecision,
  type CategorySelectionCandidate,
} from "../services/pre-publish/category-selection"
import {
  isNeutralProductGender,
  planNeutralSkcDrafts,
} from "../services/pre-publish/neutral-skc-draft-planner"
import {
  blockingAttributeMessages,
  buildCompositionAttributeItems as buildCompositionPayloadItems,
  categoryPairState,
  coerceFieldValues,
  contextualAttributeState,
  normalizeMaterialValue,
  tariffValueCandidatesForContext,
} from "../services/pre-publish/field-fills"
import {
  boolConfigValue,
  buildPictureRequirements,
  buildSheinImageInfo,
  canAddImagesToRequirement,
  classifyImportedImage,
  assetPreparedForImageType,
  imageCompliance,
  inferAssetTypeFromLibraryAsset,
  inferAssetTypeFromRequirement,
  pictureCapacityRules,
  sheinImageType,
  sheinMainImageError,
  type PictureConfigRow,
  type PictureRequirement,
  type SheinImageInfo,
} from "../services/pre-publish/images"
import {
  buildPublishSupplierSkuMap,
  normalizeBarcode,
  publishBusinessValidationErrors,
  publishInfo,
  publishPackageWeight,
  publishSupplierSku,
  resolveMissingSkuWeightUpdates,
  resolveSkuWeightRecord,
  skuWeightLookupKeys,
  responseCode,
  responseMessage,
} from "../services/pre-publish/payload"
import {
  centerCropSquareImageBuffer,
  transformOnlineImageToShein,
  uploadLocalImageToShein,
  uploadRemoteSquareImageToShein,
} from "../services/pre-publish/shein-api"
import {
  groupSheinImagePackageEntries,
  MAX_SHEIN_IMAGE_PACKAGE_ENTRIES,
  MAX_SHEIN_IMAGE_PACKAGE_UNCOMPRESSED_BYTES,
  packageImageAssignments,
  parseSheinImagePackageEntry,
  type SheinImagePackageEntry,
  type SheinImagePackageGroup,
} from "../services/pre-publish/image-package"
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
  validateRequestedDraftSkcCodes,
} from "../services/pre-publish/shared"
import { createPublishVersion } from "../services/pre-publish/versions"

const prePublish = new Hono()
const MANUAL_SIZE_CHART_FIELD_KEY = "size_chart_manual"
const TARIFF_ATTRIBUTE_ID = 1000407
const DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID = 1000714
const UNSPECIFIED_TARIFF_VALUE = "未列明关税种类"
const DEPRECATED_TARIFF_MATERIAL_LABEL = "废弃关税种类或废弃材质"
const AI_MULTIMODAL_ATTRIBUTE_IDS = new Set([
  40, // 合身类型
  54, // 长度
  66, // 领型
  106, // 鞋尖
  109, // 类型
  113, // 腰线
  207, // 是否透明
  1000070, // 是否深浅撞色
  1000410, // 工艺选项
  1000438, // 是否有口袋
  1000595, // 鞋靴款式
  1000627, // 细化图案
  1001159, // 款式特征
  1001197, // 图案款
  1001515, // 附带拉绳
  1001518, // 版型
  1001899, // 脚背
  1001907, // 是否无缝
  1002212, // 穿戴类型
  1002281, // 是否含有色镜片
  1002315, // 是否带袖或袖孔
  9, // 腰带
])
const AI_RECOMMENDED_ATTRIBUTE_IDS = new Set([
  ...AI_MULTIMODAL_ATTRIBUTE_IDS,
  39, // 面料弹性
  77, // 季节
  128, // 场合
  154, // 年龄
  1000437, // 是否加绒
  1000600, // 睡衣类型
  1001236, // 厚薄程度
])
const AI_RULE_ATTRIBUTE_IDS = new Set([58, 160, 1000062])

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
  is_required?: number | null
  is_size_attribute?: number | null
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
  is_required?: number | null
  is_size_attribute?: number | null
  render_kind?: "text" | "textarea" | "single_enum" | "multi_enum" | "enum_with_text" | "readonly"
  conditional_on?: {
    field_key: string
    value: string
  } | null
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
  mdm_age_group_name?: string | null
  mdm_main_size_group_name?: string | null
  mdm_order_size_group_name?: string | null
  mdm_spec_range?: string | null
  category: {
    category_id: number | null
    product_type_id: number | null
    category_name: string | null
    path: string | null
    source: string
    status: string
    error?: string | null
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

type ManualSizeChartInputRow = {
  sku_id?: unknown
  sku_code?: unknown
  size_name?: unknown
  shein_size_value?: unknown
  relate_sale_attribute_value_id?: unknown
  values?: unknown
}

type CategoryOverride = {
  category_id: number | null
  product_type_id: number | null
  category_name: string | null
  path: string | null
  source?: string
  status?: string
  error?: string | null
}

type CategoryReadinessOptions = {
  ignoreListingCategory?: boolean
  ignoreStoredCategory?: boolean
}

type CategoryCandidate = {
  category_id: number
  product_type_id: number
  category_name: string
  path: string
  attr_count?: number | null
  required_count?: number | null
}

type LiveAiDraftCategory = {
  categoryId: number
  productTypeId: number
  categoryName: string | null
  path: string | null
  status: string
  confidence: number | null
  splitBySkc: boolean
  reasons: string[]
  risks: string[]
  blockingRisks: string[]
  alternatives: unknown[]
  skcSuggestions: unknown[]
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
  if (source === "AI_DESCRIPTION") return "AI 基于商品标题、类目和款色生成商品描述"
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
    for (const key of skuWeightLookupKeys(row)) {
      if (!map.has(key)) map.set(key, row)
    }
  }
  return map
}

function fallbackCategory(row: SourceRow) {
  const sharedFallback = resolveSheinKidsCategoryFallback(row)
  if (sharedFallback) return sharedFallback
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
  const fallback = fallbackCategory(row)
  if (fallback.category_id && fallback.product_type_id) return fallback
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
  return fallback
}

function readStoredCategoryOverride(fills: Map<string, SourceRow>, spuCode: string): CategoryOverride | null {
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
    status: normalizeText(payload.status) || "READY",
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

function getCategoryPairMetadata(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  if (!categoryId || !productTypeId) return null
  const row = db.prepare(`
    select category_id, product_type_id, category_name, path
    from channel_category
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
      and coalesce(last_category, 0) = 1
    limit 1
  `).get(categoryId, productTypeId) as SourceRow | undefined
  return row ?? null
}

function categoryPairMetadataState(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  const metadata = getCategoryPairMetadata(db, categoryId, productTypeId)
  if (metadata || !categoryId || !productTypeId) {
    return { metadata, known: Boolean(metadata) }
  }
  const categoryKnown = Boolean(db.prepare(`
    select 1
    from channel_category
    where platform = 'SHEIN'
      and category_id = ?
      and coalesce(last_category, 0) = 1
    limit 1
  `).get(categoryId))
  const productTypeKnown = Boolean(db.prepare(`
    select 1
    from channel_category
    where platform = 'SHEIN'
      and product_type_id = ?
      and coalesce(last_category, 0) = 1
    limit 1
  `).get(productTypeId))
  return {
    metadata: null,
    known: categoryKnown && productTypeKnown,
  }
}

function unverifiedCategoryPairMessage(categoryId: number | null, productTypeId: number | null) {
  return `本地 SHEIN 元数据暂无法核验类目与 Product Type：${categoryId}/${productTypeId}，请先同步元数据`
}

function requiredAttributeCategoryId(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  if (!productTypeId) return null
  if (getCategoryPairMetadata(db, categoryId, productTypeId)) return categoryId
  const candidates = db.prepare(`
    select distinct category_id
    from channel_category
    where platform = 'SHEIN'
      and product_type_id = ?
      and coalesce(last_category, 0) = 1
    order by category_id
    limit 2
  `).all(productTypeId) as SourceRow[]
  if (candidates.length !== 1) return categoryId
  return asPositiveNumber(candidates[0]?.category_id)
}

function getRequiredAttributes(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  if (!productTypeId) return []
  const attributeCategoryId = requiredAttributeCategoryId(db, categoryId, productTypeId)
  if (!attributeCategoryId) return []
  const supplementalAiAttributeIds = uniqueStrings([
    ...Array.from(AI_RECOMMENDED_ATTRIBUTE_IDS),
    ...Array.from(AI_MULTIMODAL_ATTRIBUTE_IDS),
    ...Array.from(AI_RULE_ATTRIBUTE_IDS),
  ]).map(Number).filter((id) => Number.isInteger(id) && id > 0)
  const supplementalPlaceholders = supplementalAiAttributeIds.map(() => "?").join(", ")
  const rows = db.prepare(`
    select
      req.platform,
      req.category_id,
      req.product_type_id,
      req.attribute_id,
      req.attribute_name,
      req.attribute_name_en,
      req.attribute_type,
      req.attribute_label,
      req.attribute_mode,
      req.attribute_status,
      req.attribute_input_num,
      1 as is_required,
      coalesce(attr.is_size_attribute, 0) as is_size_attribute,
      req.values_count,
      req.sample_values_json
    from channel_required_attribute req
    left join channel_attribute attr
      on attr.platform = req.platform
      and attr.product_type_id = req.product_type_id
      and attr.attribute_id = req.attribute_id
    where req.platform = 'SHEIN'
      and req.category_id = ?
      and req.product_type_id = ?
    union all
    select
      attr.platform,
      ? as category_id,
      attr.product_type_id,
      attr.attribute_id,
      attr.attribute_name,
      attr.attribute_name_en,
      attr.attribute_type,
      attr.attribute_label,
      attr.attribute_mode,
      attr.attribute_status,
      attr.attribute_input_num,
      attr.is_required,
      attr.is_size_attribute,
      attr.values_count,
      attr.values_json as sample_values_json
    from channel_attribute attr
    where attr.platform = 'SHEIN'
      and attr.product_type_id = ?
      and (
        attr.attribute_type = 1
        or attr.attribute_id in (58${supplementalPlaceholders ? `, ${supplementalPlaceholders}` : ""})
        or attr.attribute_name in ('性别', '袖长')
      )
      and not exists (
        select 1
        from channel_required_attribute req
        where req.platform = attr.platform
          and req.category_id = ?
          and req.product_type_id = attr.product_type_id
          and req.attribute_id = attr.attribute_id
      )
    order by attribute_type, attribute_id
  `).all(
    attributeCategoryId,
    productTypeId,
    attributeCategoryId,
    productTypeId,
    ...supplementalAiAttributeIds,
    attributeCategoryId,
  ) as SourceRow[]

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
    is_required: asNumber(row.is_required),
    is_size_attribute: asNumber(row.is_size_attribute),
    values_count: Number(row.values_count ?? 0),
    sample_values_json: normalizeText(row.sample_values_json),
    values: valueStmt.all(productTypeId, Number(row.attribute_id)) as AttributeValue[],
  })) as RequiredAttribute[]
}

function getAttributeById(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
  attributeId: number,
) {
  if (!productTypeId) return null
  const row = db.prepare(`
    select
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
      is_required,
      is_size_attribute,
      values_count,
      values_json as sample_values_json
    from channel_attribute
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = ?
    limit 1
  `).get(categoryId, productTypeId, attributeId) as SourceRow | undefined
  if (!row) return null
  const values = db.prepare(`
    select attribute_value_id, attribute_value, attribute_value_en
    from channel_attribute_value
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = ?
      and coalesce(is_black, 0) = 0
    order by is_show desc, attribute_value
    limit 320
  `).all(productTypeId, attributeId) as AttributeValue[]
  return {
    category_id: Number(row.category_id ?? 0),
    product_type_id: Number(row.product_type_id),
    attribute_id: Number(row.attribute_id),
    attribute_name: normalizeText(row.attribute_name),
    attribute_name_en: row.attribute_name_en ? String(row.attribute_name_en) : null,
    attribute_type: asNumber(row.attribute_type),
    attribute_label: asNumber(row.attribute_label),
    attribute_mode: asNumber(row.attribute_mode),
    attribute_status: asNumber(row.attribute_status),
    attribute_input_num: asNumber(row.attribute_input_num),
    is_required: asNumber(row.is_required),
    is_size_attribute: asNumber(row.is_size_attribute),
    values_count: Number(row.values_count ?? 0),
    sample_values_json: normalizeText(row.sample_values_json),
    values,
  } as RequiredAttribute
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

function findEnumOptionByValue(values: AttributeValue[], needles: string[]) {
  const normalized = needles.map((item) => normalizeText(item)).filter(Boolean)
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

function sheinAgeNeedlesFromContext({
  ageGroup,
  specRange,
  mainSizeGroup,
  orderSizeGroup,
}: {
  ageGroup?: unknown
  specRange?: unknown
  mainSizeGroup?: unknown
  orderSizeGroup?: unknown
}) {
  const ageGroupText = normalizeText(ageGroup)
  const specRangeText = normalizeText(specRange)
  const sizeText = [
    specRangeText,
    mainSizeGroup,
    orderSizeGroup,
  ].map(normalizeText).filter(Boolean).join(" ")
  const needles: string[] = []
  if (/婴|宝宝|0-3|0岁|1岁|2岁|3岁/.test(`${ageGroupText} ${sizeText}`)) {
    needles.push("婴儿", "婴幼儿", "宝宝", "Baby")
  }
  if (
    ageGroupText.includes("幼童")
    || /小童/.test(ageGroupText)
    || /0?7[03]-13[0]?|080-130|073-130|090-130/.test(sizeText)
  ) {
    needles.push("小童4-7Y", "4-7Y", "幼童", "儿童")
  }
  if (
    ageGroupText.includes("中童")
    || ageGroupText.includes("大童")
    || /090-175|100-175|110-175|120-175|130-175|14[0-9].*175|175/.test(sizeText)
  ) {
    needles.push("8-12Y中大童", "8-12Y", "中大童", "青少年", "儿童")
  }
  if (/青少年|少年|teen/i.test(`${ageGroupText} ${sizeText}`)) {
    needles.push("青少年", "8-12Y中大童")
  }
  needles.push("ALL/全球/所有", "全人群", "儿童")
  return [...new Set(needles)]
}

function sheinAgeNeedlesForReadiness(row: ReadinessRow) {
  return sheinAgeNeedlesFromContext({
    ageGroup: row.mdm_age_group_name,
    specRange: row.mdm_spec_range,
    mainSizeGroup: row.mdm_main_size_group_name,
    orderSizeGroup: row.mdm_order_size_group_name,
  })
}

function isSizeSaleAttribute(attr: Pick<RequiredAttribute, "attribute_type" | "attribute_label" | "attribute_name" | "attribute_name_en" | "is_size_attribute">) {
  const text = `${normalizeText(attr.attribute_name)} ${normalizeText(attr.attribute_name_en)}`.toLowerCase()
  return Number(attr.attribute_type ?? 0) === 1
    && Number(attr.attribute_label ?? 0) === 0
    && (
      Number(attr.is_size_attribute ?? 0) === 1
      || /尺寸|尺码|size/i.test(text)
    )
}

function findSizeSaleAttribute(attrs: RequiredAttribute[]) {
  return attrs.find(isSizeSaleAttribute)
}

function findColorSaleAttribute(attrs: RequiredAttribute[]) {
  return attrs.find((attr) => {
    const text = `${normalizeText(attr.attribute_name)} ${normalizeText(attr.attribute_name_en)}`.toLowerCase()
    return Number(attr.attribute_type ?? 0) === 1
      && Number(attr.attribute_label ?? 0) === 1
      && /颜色|color/i.test(text)
  }) ?? attrs.find((attr) =>
    Number(attr.attribute_type ?? 0) === 1
    && Number(attr.attribute_label ?? 0) === 1,
  )
}

function sizeConversionForSku(
  sizeConversions: ReturnType<typeof activeSizeConversions>,
  sku: SourceRow,
) {
  const sizeCodeKeys = sizeKeys(sku.size_code)
  const sizeNameKeys = sizeKeys(sku.size_name)
  return sizeCodeKeys.map((key) => sizeConversions.byCode.get(key) ?? sizeConversions.byName.get(key)).find(Boolean)
    ?? sizeNameKeys.map((key) => sizeConversions.byName.get(key) ?? sizeConversions.byCode.get(key)).find(Boolean)
    ?? null
}

function resolveSkuSizeSelection(
  sizeAttr: RequiredAttribute | undefined,
  sku: SourceRow,
  sizeRule?: SourceRow | null,
) {
  const directCandidates = uniqueStrings([
    normalizeText(sku.size_name),
    normalizeText(sku.size_code),
    ...sizeKeys(sku.size_name),
    ...sizeKeys(sku.size_code),
  ])
  const convertedCandidates = uniqueStrings([
    normalizeText(sizeRule?.shein_size_value),
    ...sizeKeys(sizeRule?.shein_size_value),
  ])
  const directOption = sizeAttr ? findEnumOptionByValue(sizeAttr.values, directCandidates) : null
  const convertedOption = sizeAttr ? findEnumOptionByValue(sizeAttr.values, convertedCandidates) : null
  const option = convertedOption ?? directOption
  const sheinSize = normalizeText(option?.attribute_value)
    || normalizeText(sizeRule?.shein_size_value)
    || normalizeText(sku.size_name)
    || normalizeText(sku.size_code)
  return {
    sheinSize,
    option,
    directOption,
    convertedOption,
  }
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
    is_required: attr.is_required,
    is_size_attribute: attr.is_size_attribute,
    render_kind: renderKindForAttribute(attr),
    options: attr.values.slice(0, 320),
  }
}

function isRequiredFillField(field: FillField) {
  const value = field.is_required
  if (value == null) return true
  return Number(value) !== 0
}

function isBlockingFillField(field: FillField) {
  if (field.status !== "MISSING" && field.status !== "NEEDS_AI") return false
  return isRequiredFillField(field)
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
  if (attr.values.length > 0) return false
  return Boolean(normalizeText(payload.custom_attribute_value))
}

function inferMaterialValue(attr: RequiredAttribute, context: string) {
  const needles: string[] = []
  const isCompositionAttribute = normalizeText(attr.attribute_name).includes("成分")
  if (!isCompositionAttribute && /针织|梭织|卫裤|长裤|裤/.test(context)) needles.push("织物")
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
  const attributeId = Number(attr.attribute_id)
  const context = [
    row.spu_name,
    row.deepdraw_title,
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.main_size_group_name,
    row.order_size_group_name,
    row.spec_range,
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
    return findEnumValue(attr.values, tariffValueCandidatesForContext(context, attr.values))
  }
  if (name.includes("加绒")) {
    if (/不加绒|无绒|薄款|超薄/.test(context)) return findEnumValue(attr.values, ["否"])
    if (context.includes("加绒")) return findEnumValue(attr.values, ["是"])
    if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId)) return ""
    return findEnumValue(attr.values, ["否"])
  }
  if (name.includes("透明")) {
    if (/不透明|非透明/.test(context)) return findEnumValue(attr.values, ["否"])
    if (/半透|透明|透视/.test(context)) return findEnumValue(attr.values, ["半透", "是"])
    if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId)) return ""
    return findEnumValue(attr.values, ["否"])
  }
  if (name.includes("深浅撞色")) {
    if (/无撞色|不撞色|非撞色|纯色|同色|净色/.test(context)) return findEnumValue(attr.values, ["否"])
    if (/撞色|拼色|色块|对比色/.test(context)) return findEnumValue(attr.values, ["是"])
    if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId)) return ""
    return findEnumValue(attr.values, ["否"])
  }
  if (name.includes("面料弹性")) {
    if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId) && !/高弹|中弹|低弹|无弹|弹力|弹性/.test(context)) return ""
    return findEnumValue(attr.values, [
      context.includes("高弹") ? "高弹" : "",
      context.includes("中弹") ? "中弹" : "",
      context.includes("低弹") ? "低弹" : "",
      context.includes("无弹") ? "无弹" : "",
      context.includes("弹") ? "中弹" : "",
      "低弹",
    ])
  }
  if (name.includes("合身") || name.includes("版型")) {
    const fit = findEnumValue(attr.values, [
      context.includes("超宽松") ? "超宽松" : "",
      context.includes("宽松") ? "宽松" : "",
      context.includes("修身") ? "修身" : "",
      context.includes("合体") ? "合体" : "",
      context.includes("标准") ? "常规" : "",
    ])
    if (fit) return fit
    if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId)) return ""
  }
  if (name === "长度") {
    return findEnumValue(attr.values, [
      context.includes("全P") ? "常规" : "",
      "常规",
    ])
  }
  if (name === "年龄") {
    return findEnumValue(attr.values, sheinAgeNeedlesFromContext({
      ageGroup: row.age_group_name,
      specRange: row.spec_range ?? row.size_range_name,
      mainSizeGroup: row.main_size_group_name,
      orderSizeGroup: row.order_size_group_name,
    }))
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

function materialEvidenceFromDeepDraw(fields: Map<string, string>) {
  return firstField(fields, ["材质成分", "25面料成分", "材质", "面料", "详情页面料"])
}

function inferredAttributeSource({
  attr,
  row,
  fields,
}: {
  attr: RequiredAttribute
  row: SourceRow
  fields: Map<string, string>
}) {
  const name = normalizeText(attr.attribute_name)
  if (name.includes("织造方式")) return "MDM"
  if (name.includes("成分") || name.includes("材质")) {
    if (normalizeText(materialEvidenceFromDeepDraw(fields))) return "DEEPDRAW"
    if (
      normalizeText(row.composition)
      || normalizeText(row.fabric_type_name)
      || normalizeText(row.middle_class_name)
      || normalizeText(row.subclass_name)
    ) {
      return "MDM"
    }
    return "RULE"
  }
  return "RULE"
}

function fieldStatus(value: unknown, fallback: FillField["status"] = "READY") {
  return normalizeText(value) ? fallback : "MISSING"
}

function isLikelyEnglishTitle(value: unknown) {
  const text = normalizeText(value)
  return /[A-Za-z]/.test(text) && !/[\u3400-\u9fff]/.test(text)
}

function readinessWithListingTitle(readiness: ReadinessRow, titleEn: string): ReadinessRow {
  const fieldGroups = readiness.field_groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => field.key === "title_en"
      ? {
        ...field,
        value: titleEn,
        source: "LISTING_TITLE",
        status: "READY" as const,
        note: "当前发布草稿标题",
      }
      : field),
  }))
  return {
    ...readiness,
    title_en: titleEn,
    field_groups: fieldGroups,
    dimension_field_groups: buildDimensionFieldGroups(fieldGroups),
  }
}

function readinessWithListingDescription(readiness: ReadinessRow, description: string): ReadinessRow {
  const fieldGroups = readiness.field_groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => field.key === "product_description"
      ? {
        ...field,
        value: description,
        source: "LISTING_DESCRIPTION",
        status: "READY" as const,
        note: "当前发布草稿描述",
      }
      : field),
  }))
  return {
    ...readiness,
    field_groups: fieldGroups,
    dimension_field_groups: buildDimensionFieldGroups(fieldGroups),
  }
}

function readinessWithoutSharedAiDescription(readiness: ReadinessRow): ReadinessRow {
  const fieldGroups = readiness.field_groups.map((group) => ({
    ...group,
    fields: group.fields.map((field) => field.key === "product_description" && normalizeText(field.source).startsWith("AI_")
      ? {
        ...field,
        value: null,
        source: "AI/人工",
        status: "NEEDS_AI" as const,
        note: "拆分草稿需按当前发布单独生成商品描述。",
      }
      : field),
  }))
  return {
    ...readiness,
    field_groups: fieldGroups,
    dimension_field_groups: buildDimensionFieldGroups(fieldGroups),
  }
}

function categoryGenderValueForAttribute(attr: RequiredAttribute, category: CategoryOverride) {
  const name = normalizeText(attr.attribute_name)
  if (!name.includes("性别")) return ""
  const categoryText = `${normalizeText(category.category_name)} ${normalizeText(category.path)}`
  if (/男童|男孩|婴童（男）|男\)/.test(categoryText)) {
    return findEnumValue(attr.values, ["男童", "男孩", "Boys", "Boy", "男"])
  }
  if (/女童|女孩|婴童（女）|女\)/.test(categoryText)) {
    return findEnumValue(attr.values, ["女童", "女孩", "Girls", "Girl", "女"])
  }
  return ""
}

function shouldIncludeDependentCustomsField(value: unknown) {
  return parseJsonList(value).concat([normalizeText(value)])
    .some((item) => normalizeText(item) === UNSPECIFIED_TARIFF_VALUE)
}

function buildDeprecatedTariffMaterialField({
  db,
  category,
  fills,
  spuCode,
  tariffField,
}: {
  db: ReturnType<typeof getDb>
  category: CategoryOverride
  fills: Map<string, SourceRow>
  spuCode: string
  tariffField: FillField | undefined
}) {
  const attr = getAttributeById(db, category.category_id, category.product_type_id, DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID)
  if (!attr || !tariffField) return null
  const key = `attr:${DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID}`
  const stored = getStoredFill(fills, spuCode, key)
  const active = shouldIncludeDependentCustomsField(tariffField.value)
  const storedValue = stored?.field_value == null ? "" : String(stored.field_value)
  return {
    key,
    label: DEPRECATED_TARIFF_MATERIAL_LABEL,
    value: storedValue || null,
    source: stored ? String(stored.source ?? "MANUAL") : "SHEIN关务规则",
    status: active ? fieldStatus(storedValue) : "READY",
    confidence: stored?.confidence == null ? null : Number(stored.confidence),
    note: active
      ? `关税种类为「${UNSPECIFIED_TARIFF_VALUE}」时，SHEIN 关务规则要求填写。元数据字段：${attr.attribute_name}。`
      : `仅当关税种类选择「${UNSPECIFIED_TARIFF_VALUE}」时显示。元数据字段：${attr.attribute_name}。`,
    conditional_on: {
      field_key: tariffField.key,
      value: UNSPECIFIED_TARIFF_VALUE,
    },
    ...attributeFillMeta(attr),
  } as FillField
}

function buildRow({
  db,
  row,
  sizeConversions,
  discounts,
  weights,
  fills,
  categoryOverride,
  ignoreStoredCategory = false,
}: {
  db: ReturnType<typeof getDb>
  row: SourceRow
  sizeConversions: ReturnType<typeof activeSizeConversions>
  discounts: Map<string, SourceRow>
  weights: Map<string, SourceRow>
  fills: Map<string, SourceRow>
  categoryOverride?: CategoryOverride | null
  ignoreStoredCategory?: boolean
}): ReadinessRow {
  const spuCode = String(row.spu_code)
  const fields = getProductFields(db, row.content_package_id)
  const mdmSkcs = getSkcs(db, row.id)
  const mdmSkus = getSkus(db, row.id)
  const skcs = mdmSkcs.length ? mdmSkcs : getContentSkcs(db, row.content_package_id)
  const skus = mdmSkus.length ? mdmSkus : getContentSkus(db, row.content_package_id)
  const storedCategory = ignoreStoredCategory ? null : readStoredCategoryOverride(fills, spuCode)
  const resolvedCategory = categoryOverride ?? storedCategory ?? resolveCategory(row)
  const categoryMetadataState = categoryPairMetadataState(
    db,
    resolvedCategory.category_id,
    resolvedCategory.product_type_id,
  )
  const categoryMetadata = categoryMetadataState.metadata
  const categoryPair = categoryPairState({
    categoryId: resolvedCategory.category_id,
    productTypeId: resolvedCategory.product_type_id,
    metadataMatch: Boolean(categoryMetadata),
    metadataKnown: categoryMetadataState.known,
  })
  const category = categoryPair.status === "WARNING"
    ? {
      ...resolvedCategory,
      status: categoryPair.status,
      error: unverifiedCategoryPairMessage(
        resolvedCategory.category_id,
        resolvedCategory.product_type_id,
      ),
    }
    : categoryPair.valid || !resolvedCategory.category_id || !resolvedCategory.product_type_id
    ? resolvedCategory
    : {
      ...resolvedCategory,
      category_name: normalizeText(categoryMetadata?.category_name) || resolvedCategory.category_name,
      path: normalizeText(categoryMetadata?.path) || resolvedCategory.path,
      source: "CATEGORY_PAIR_MISMATCH",
      status: categoryPair.status,
      error: categoryPair.error,
    }
  const attrs = getRequiredAttributes(db, category.category_id, category.product_type_id)
  const sizeAttr = findSizeSaleAttribute(attrs)
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
  const productDescription = firstField(fields, ["商品描述", "商品卖点", "产品描述", "卖点", "推荐理由"])
  const deepdrawCompositionText = materialEvidenceFromDeepDraw(fields)
  const mdmCompositionText = normalizeText(row.composition)
    || normalizeText(row.wash_label_ingr)
    || normalizeText(row.fabric)
  const compositionText = deepdrawCompositionText || mdmCompositionText
  const compositionTextSource = deepdrawCompositionText ? "DEEPDRAW" : mdmCompositionText ? "MDM" : "MDM/DEEPDRAW"
  const weightCoverage = skus.filter((sku) => resolveSkuWeightRecord(weights, sku)).length
  const sizeCoverage = skus.filter((sku) => {
    const sizeRule = sizeConversionForSku(sizeConversions, sku)
    return Boolean(resolveSkuSizeSelection(sizeAttr, sku, sizeRule).option)
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
      status: category.status === "READY"
        ? "READY"
        : category.status === "WARNING" || (category.category_id && category.product_type_id)
          ? "WARNING"
          : "MISSING",
      note: category.error || category.path,
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
    {
      key: "product_description",
      label: "商品描述",
      value: compactText(productDescription, 160),
      source: "DEEPDRAW",
      status: fieldStatus(productDescription),
      note: productDescription ? null : "深绘字段池未返回商品描述/卖点来源。",
    },
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
    const categoryGenderValue = categoryGenderValueForAttribute(attr, category)
    if (categoryGenderValue) {
      return {
        key,
        label: attr.attribute_name,
        value: categoryGenderValue,
        source: "SHEIN 类目",
        status: "READY",
        confidence: 1,
        note: "按当前 SHEIN 叶子类目确定性别。",
        ...attributeFillMeta(attr),
      }
    }
    const ignoreStoredAiComposition = Boolean(
      stored
      && normalizeText(attr.attribute_name).includes("成分")
      && !compositionText
      && normalizeText(stored.source).toUpperCase().startsWith("AI"),
    )
    if (stored && !ignoreStoredAiComposition) {
      const storedValue = stored.field_value == null ? "" : String(stored.field_value)
      if (!normalizeText(storedValue) && isAiFillableAttributeField({ ...attributeFillMeta(attr), key, label: attr.attribute_name, value: null, source: "AI/人工", status: "NEEDS_AI" })) {
        const inferred = inferAttributeValue({ attr, row, fields })
        if (inferred) {
          return {
            key,
            label: attr.attribute_name,
            value: inferred,
            source: inferredAttributeSource({ attr, row, fields }),
            status: "READY",
            confidence: 0.72,
            note: "已忽略空的人工保存值，按当前 MDM/业务数据重新推荐。",
            ...attributeFillMeta(attr),
          }
        }
        return {
          key,
          label: attr.attribute_name,
          value: null,
          source: "AI/人工",
          status: "NEEDS_AI",
          note: "已忽略空的人工保存值，可由 AI 结合商品档案和枚举值重新判断。",
          ...attributeFillMeta(attr),
        }
      }
      const storedValues = renderKindForAttribute(attr) === "multi_enum" ? parseJsonList(storedValue) : [storedValue]
      const storedValid = (attr.values ?? []).length === 0
        || storedValues.every((value) => optionForFieldValue({ ...attributeFillMeta(attr), key, label: attr.attribute_name, value: storedValue, source: String(stored.source ?? "MANUAL"), status: "READY" }, normalizeText(value)))
      if (!storedValid) {
        const inferred = inferAttributeValue({ attr, row, fields })
        if (inferred) {
          return {
            key,
            label: attr.attribute_name,
            value: inferred,
            source: inferredAttributeSource({ attr, row, fields }),
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

    if (isSizeSaleAttribute(attr) && sizeCoverage === skus.length && skus.length > 0) {
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

    if (normalizeText(attr.attribute_name).includes("成分") && !compositionText) {
      return {
        key,
        label: attr.attribute_name,
        value: null,
        source: compositionTextSource,
        status: "MISSING",
        note: "缺少 MDM/深绘成分来源，禁止 AI 猜测成分枚举。",
        ...attributeFillMeta(attr),
      }
    }

    const inferred = inferAttributeValue({ attr, row, fields })
    if (inferred) {
      return {
        key,
        label: attr.attribute_name,
        value: inferred,
        source: inferredAttributeSource({ attr, row, fields }),
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
      status: isSizeSaleAttribute(attr) ? "MISSING" : "NEEDS_AI",
      note: isSizeSaleAttribute(attr)
        ? "由 SKU 尺码转换明细补齐"
        : "需要结合商品档案和枚举值判断",
      ...attributeFillMeta(attr),
    }
  })
  const deprecatedTariffMaterialField = buildDeprecatedTariffMaterialField({
    db,
    category,
    fills,
    spuCode,
    tariffField: attributeFields.find((field) => field.attribute_id === TARIFF_ATTRIBUTE_ID),
  })
  if (deprecatedTariffMaterialField && !attributeFields.some((field) => field.attribute_id === DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID)) {
    attributeFields.push(deprecatedTariffMaterialField)
  }
  const contentFields: FillField[] = [
    {
      key: "composition_text",
      label: "成分来源",
      value: compactText(compositionText, 120),
      source: compositionTextSource,
      status: compositionText ? "READY" : "MISSING",
      note: compositionText ? null : "MDM composition/wash_label_ingr/fabric 与深绘材质成分字段均为空。",
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
      if (field.key === "category") continue
      const stored = getStoredFill(fills, spuCode, field.key)
      if (!stored) continue
      if (normalizeText(field.source) === "SHEIN 类目" && normalizeText(field.label).includes("性别")) {
        continue
      }
      const storedValue = stored.field_value == null ? "" : String(stored.field_value)
      if (
        isCompositionAttributeField(field)
        && !compositionText
        && normalizeText(stored.source).toUpperCase().startsWith("AI")
      ) {
        continue
      }
      if (field.conditional_on && !normalizeText(storedValue)) continue
      if (field.key.startsWith("attr:") && !normalizeText(storedValue) && isAiFillableAttributeField(field)) continue
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
  const tariffField = attributeFields.find((field) => field.attribute_id === TARIFF_ATTRIBUTE_ID)
  const materialField = attributeFields.find((field) => field.attribute_id === 160)
  for (const field of attributeFields) {
    const contextual = contextualAttributeState({
      attributeId: field.attribute_id,
      value: field.value,
      tariffValue: tariffField?.value,
      materialValue: materialField?.value,
    })
    if (!contextual) continue
    field.status = contextual.status
    if (contextual.required) field.is_required = 1
    if (!field.value) field.source = "SHEIN 关务条件属性"
    field.note = contextual.required
      ? "当前关税种类与材质组合触发平台关务规则，此属性必填。"
      : "SHEIN 可能根据关税种类与材质组合将此属性设为必填，可提前填写。"
  }

  const allFields = fieldGroups.flatMap((group) => group.fields)
  const ready = allFields.filter((field) => field.status === "READY" || field.status === "WARNING").length
  const missing = allFields.filter((field) => field.status === "MISSING").length
  const needsAi = allFields.filter((field) => field.status === "NEEDS_AI").length
  const blockingIssues = allFields
    .filter(isBlockingFillField)
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
    mdm_age_group_name: normalizeText(row.age_group_name) || null,
    mdm_main_size_group_name: normalizeText(row.main_size_group_name) || null,
    mdm_order_size_group_name: normalizeText(row.order_size_group_name) || null,
    mdm_spec_range: normalizeText(row.spec_range ?? row.size_range_name) || null,
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
    manual_fields: attributeFields.filter(shouldIncludeFieldInAiFill),
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

function storedReviewCategoryOverrideForListing(
  db: ReturnType<typeof getDb>,
  listing: ListingRow,
  categoryId: number,
  productTypeId: number,
  metadata?: SourceRow | null,
): CategoryOverride | null {
  const stored = db.prepare(`
    select *
    from listing_field_fill
    where spu_code = ?
      and field_key = 'category'
      and coalesce(status, 'ACTIVE') = 'ACTIVE'
    order by updated_at desc, id desc
    limit 1
  `).get(listing.spu_code) as SourceRow | undefined
  if (!stored) return null
  const payload = parseJsonObject(stored.payload_json)
  const storedCategoryId = asPositiveNumber(payload.category_id)
  const storedProductTypeId = asPositiveNumber(payload.product_type_id)
  if (storedCategoryId !== categoryId || storedProductTypeId !== productTypeId) return null
  const source = normalizeText(stored.source)
  const status = normalizeText(payload.status)
  const reviewSource = source.endsWith("_REVIEW") || source === "AI_CATEGORY_REVIEW" || source === "AI_CATEGORY_LIVE_REVIEW"
  if (status !== "NEEDS_REVIEW" && !reviewSource) return null
  return {
    category_id: categoryId,
    product_type_id: productTypeId,
    category_name: normalizeText(metadata?.category_name)
      || normalizeText(payload.category_name)
      || normalizeText(stored.field_value)
      || normalizeText(listing.platform_category_name)
      || null,
    path: normalizeText(metadata?.path) || normalizeText(payload.path) || normalizeText(listing.platform_category_path) || null,
    source: source || "AI_CATEGORY_REVIEW",
    status: "NEEDS_REVIEW",
    error: normalizeText(payload.error) || "AI 已自动选择类目，需要人工复核。",
  }
}

function listingCategoryOverride(
  db: ReturnType<typeof getDb>,
  listing: ListingRow,
): CategoryOverride | null {
  const categoryId = asPositiveNumber(listing.platform_category_id)
  const productTypeId = asPositiveNumber(listing.product_type_id)
  if (!categoryId || !productTypeId) return null
  const metadataState = categoryPairMetadataState(db, categoryId, productTypeId)
  const metadata = metadataState.metadata
  const pair = categoryPairState({
    categoryId,
    productTypeId,
    metadataMatch: Boolean(metadata),
    metadataKnown: metadataState.known,
  })
  const storedReview = pair.valid
    ? storedReviewCategoryOverrideForListing(db, listing, categoryId, productTypeId, metadata)
    : null
  if (storedReview) return storedReview
  return {
    category_id: categoryId,
    product_type_id: productTypeId,
    category_name: normalizeText(metadata?.category_name)
      || normalizeText(listing.platform_category_name)
      || null,
    path: normalizeText(metadata?.path) || normalizeText(listing.platform_category_path) || null,
    source: pair.status === "WARNING"
      ? "LISTING_CATEGORY_UNVERIFIED"
      : pair.valid
        ? "LISTING_CATEGORY"
        : "LISTING_CATEGORY_MISMATCH",
    status: pair.status,
    error: pair.status === "WARNING"
      ? unverifiedCategoryPairMessage(categoryId, productTypeId)
      : pair.error,
  }
}

function getReadinessForListing(
  db: ReturnType<typeof getDb>,
  listing: ListingRow,
  options: CategoryReadinessOptions = {},
) {
  const row = getSourceProductRow(db, listing.spu_code)
  if (!row) return null
  const sizeConversions = activeSizeConversions(db)
  const discounts = activeDiscounts(db)
  const weights = activeWeights(db)
  const fills = activeFillMap(db, [listing.spu_code])
  const override = options.ignoreListingCategory ? null : listingCategoryOverride(db, listing)
  const readiness = buildRow({
    db,
    row,
    sizeConversions,
    discounts,
    weights,
    fills,
    categoryOverride: override,
    ignoreStoredCategory: options.ignoreStoredCategory,
  })
  let adjustedReadiness = readiness
  const listingTitle = normalizeText(listing.title)
  if (isLikelyEnglishTitle(listingTitle) && !hasStoredReadinessField(adjustedReadiness, "title_en")) {
    adjustedReadiness = readinessWithListingTitle(adjustedReadiness, listingTitle)
  }
  const listingDescription = sanitizeProductDescription(listing.description)
  if (listingDescription) {
    adjustedReadiness = readinessWithListingDescription(adjustedReadiness, listingDescription)
  } else if (normalizeText(listing.split_group_key)) {
    adjustedReadiness = readinessWithoutSharedAiDescription(adjustedReadiness)
  }
  return adjustedReadiness
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

function issueField(row: ReadinessRow, issue: string) {
  return row.field_groups
    .flatMap((group) => group.fields)
    .find((field) => field.label === issue || field.key === issue) ?? null
}

function canAiHelpIssue(row: ReadinessRow, issue: string) {
  const field = issueField(row, issue)
  if (!field) return false
  if (field.key === "category") return true
  if (field.key === "title_en" || field.key === "product_description") return true
  return isAiFillableAttributeField(field)
}

function blockingIssueSuggestion(row: ReadinessRow, issue: string) {
  if (issue === "SHEIN OpenAPI 套装类目限制") {
    return "使用“转为 OpenAPI 单品发布”切换到非套装叶子类目，或先拆分部件。"
  }
  if (issue === "SHEIN 类目") {
    return "使用“AI 自动选类目”自动写入合法 SHEIN 叶子类目；低置信或高风险类目会保留人工复核提示。"
  }
  if (issue === "产品毛重/g") {
    return "导入毛重报表、刷新 SKU 毛重，或在尺码发布表人工填写；AI 不生成毛重。"
  }
  if (issue === "SKC 图片") {
    return "上传/导入 SHEIN 图包并确认图片，完成平台图片转换后再发布；AI 不补图片。"
  }
  if (issue === "SHEIN尺码-录入" || /尺码|尺寸/.test(issue)) {
    return "先选择合法 SHEIN 叶子类目，并维护尺码转换/销售属性枚举映射。"
  }
  if (issue === "成分" || issue === "成分来源" || /成分/.test(issue)) {
    return "补充 MDM、深绘、吊牌或洗标/OCR 成分来源后再匹配枚举；AI 不编造成分。"
  }
  if (canAiHelpIssue(row, issue)) {
    return "可在单款详情页使用 AI 生成候选值，人工复核后保存。"
  }
  return "在单款详情页人工编辑，或先补齐对应业务数据源后重新保存。"
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
      blockingIssueSuggestion(row, issue),
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
  const colorAttr = findColorSaleAttribute(attrs)
  const sizeAttr = findSizeSaleAttribute(attrs)

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
      normalizeText(readiness.title_cn) || normalizeText(skc.skc_name) || skcCode,
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
      const sizeRule = sizeConversionForSku(sizeConversions, sku)
      const sizeSelection = resolveSkuSizeSelection(sizeAttr, sku, sizeRule)
      const sheinSize = sizeSelection.sheinSize
      const sizeOption = sizeSelection.option
      const priceTag = Number(sku.price_tag ?? sourceRow.price_tag ?? 0)
      const costPrice = priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null
      const weightRow = resolveSkuWeightRecord(weights, sku)
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
      const existingManualSizeOverride = Boolean(existingSizePayload.manual_override)
      const existingSheinSize = normalizeText(existingSku?.shein_size_value)
      const staleDirectSizeFromRule = Boolean(
        normalizeText(sizeRule?.shein_size_value)
        && existingSizeIsValid
        && !existingManualSizeOverride
        && existingSheinSize
        && existingSheinSize !== sheinSize
        && (
          sizeSelection.convertedOption
          || existingSheinSize === normalizeText(sizeSelection.directOption?.attribute_value)
          || Number(existingSizePayload.attribute_value_id) === Number(sizeSelection.directOption?.attribute_value_id ?? 0)
          || sizeKeys(sku.size_name).includes(existingSheinSize)
          || sizeKeys(sku.size_code).includes(existingSheinSize)
        ),
      )
      const keepExistingSizePayload = existingSizeIsValid && !staleDirectSizeFromRule
      const finalSheinSize = keepExistingSizePayload ? (existingSheinSize || sheinSize) : sheinSize
      const finalSizePayload = keepExistingSizePayload
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
  preparedCategoryDecision?: CategoryAutoSelectionDecision,
  split?: {
    groupKey?: string | null
    reason?: string | null
    gender?: string | null
    evidenceBasis?: string | null
    aiSkcEvidence?: unknown[]
  },
) {
  const account = getDefaultChannelAccount(db, platform)
  const publishUnitNo = nextPublishUnitNo(db, platform, Number(account.id), row.product_spu_id)
  const categoryDecision = preparedCategoryDecision ?? categoryDecisionForReadiness(db, row.category, {
    allowRuleFallback: true,
  })
  const selectedCategory = categoryDecision.apply ? categoryDecision.category : null
  const sourceSnapshot = {
    ...row,
    category_creation_decision: {
      ...categoryDecision,
      message: categoryDecisionMessage(categoryDecision.reason),
    },
    neutral_skc_split: split ? {
      group_key: split.groupKey ?? null,
      reason: split.reason ?? null,
      gender: split.gender ?? null,
      evidence_basis: split.evidenceBasis ?? null,
      selected_skc_codes: skcCodes ?? [],
      ai_skc_evidence: split.aiSkcEvidence ?? [],
    } : null,
  }

  const result = db.prepare(`
    insert into listing (
      platform,
      channel_account_id,
      business_mode,
      product_spu_id,
      spu_code,
      listing_batch_no,
      publish_unit_no,
      split_group_key,
      split_reason,
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
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 'CNY', ?, ?, ?, ?, 'codex')
  `).run(
    platform,
    account.id,
    normalizeText(account.business_mode) || "FULL_MANAGED",
    row.product_spu_id,
    row.spu_code,
    `PREPUB-${nowIso().slice(0, 10).replaceAll("-", "")}`,
    publishUnitNo,
    normalizeText(split?.groupKey) || null,
    normalizeText(split?.reason) || null,
    row.title_en || row.title_cn || row.spu_name,
    selectedCategory?.categoryId ?? null,
    selectedCategory?.productTypeId ?? null,
    selectedCategory?.categoryName ?? null,
    selectedCategory?.path ?? null,
    listingStatusFor(row),
    validationStatusFor(row),
    row.completeness,
    JSON.stringify(sourceSnapshot),
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
  return { listing, version, created: true, categoryDecision }
}

function refreshListingAfterFill(db: ReturnType<typeof getDb>, listingId: number, changeSummary: string) {
  const existing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!existing) return null
  const sourceRow = getSourceProductRow(db, existing.spu_code)
  const readiness = getReadinessForListing(db, existing)
  if (!sourceRow || !readiness) return null
  const categoryDecision = categoryDecisionForReadiness(db, readiness.category, {
    allowRuleFallback: true,
  })
  const existingCategoryId = asPositiveNumber(existing.platform_category_id)
  const existingProductTypeId = asPositiveNumber(existing.product_type_id)
  const persistedCategory = categoryDecision.apply
    ? categoryDecision.category
    : existingCategoryId && existingProductTypeId
      ? {
        categoryId: existingCategoryId,
        productTypeId: existingProductTypeId,
        categoryName: normalizeText(existing.platform_category_name) || null,
        path: normalizeText(existing.platform_category_path) || null,
      }
      : null
  const existingSnapshot = parseJsonObject(existing.source_snapshot_json)
  const sourceSnapshot = {
    ...readiness,
    ...(existingSnapshot.category_creation_decision
      ? { category_creation_decision: existingSnapshot.category_creation_decision }
      : {}),
  }
  db.prepare(`
    update listing
    set title = ?,
        description = ?,
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
    normalizeText(readinessFieldValue(readiness, "product_description")) || normalizeText(existing.description) || null,
    persistedCategory?.categoryId ?? null,
    persistedCategory?.productTypeId ?? null,
    persistedCategory?.categoryName ?? null,
    persistedCategory?.path ?? null,
    listingStatusFor(readiness),
    validationStatusFor(readiness),
    readiness.completeness,
    JSON.stringify(sourceSnapshot),
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

function listingSkuWeightRows(db: ReturnType<typeof getDb>, listingId: number) {
  return db.prepare(`
    select
      sku.id,
      sku.sku_code,
      sku.supplier_barcode,
      source_sku.ean_code as source_ean_code,
      source_sku.inner_code as source_supplier_barcode,
      sku.package_weight_g,
      sku.selected_for_publish,
      skc.skc_code
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    left join product_sku source_sku on source_sku.id = sku.product_sku_id
    where skc.listing_id = ?
    order by skc.skc_code, sku.sku_code
  `).all(listingId) as SourceRow[]
}

function applyMissingListingSkuWeights(
  db: ReturnType<typeof getDb>,
  listingId: number,
  rows: SourceRow[],
  weights: Map<string, SourceRow>,
) {
  const updates = resolveMissingSkuWeightUpdates(weights, rows)
  const update = db.prepare(`
    update listing_sku
    set package_weight_g = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and coalesce(package_weight_g, 0) <= 0
      and listing_skc_id in (
        select id from listing_skc where listing_id = ?
      )
  `)
  for (const item of updates) update.run(item.package_weight_g, item.id, listingId)
  return updates
}

function summarizeListingWeightSync(
  beforeRows: SourceRow[],
  afterRows: SourceRow[],
  weights: Map<string, SourceRow>,
) {
  const beforeById = new Map(beforeRows.map((row) => [Number(row.id), row]))
  const sourceMatchedCount = beforeRows.filter((row) => resolveSkuWeightRecord(weights, row)).length
  const filledRows = afterRows.filter((row) => (
    !asPositiveNumber(beforeById.get(Number(row.id))?.package_weight_g)
    && Boolean(asPositiveNumber(row.package_weight_g))
  ))
  const missingRows = afterRows.filter((row) => !asPositiveNumber(row.package_weight_g))
  return {
    total_sku_count: afterRows.length,
    source_matched_count: sourceMatchedCount,
    filled_count: filledRows.length,
    preserved_count: afterRows.filter((row) => asPositiveNumber(beforeById.get(Number(row.id))?.package_weight_g)).length,
    missing_count: missingRows.length,
    missing_sku_codes: missingRows.slice(0, 20).map((row) => normalizeText(row.sku_code)),
  }
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

function selectedReadinessForListing(
  db: ReturnType<typeof getDb>,
  listingId: number,
  readiness: ReadinessRow,
) {
  const selectedSkcs = db.prepare(`
    select skc.*
    from listing_skc skc
    where skc.listing_id = ?
      ${selectedListingSkcWhere("skc", { onlySelected: true })}
    order by skc.skc_code
  `).all(listingId) as SourceRow[]
  return displayReadinessForSelectedSkcs(readiness, selectedSkcs, readiness.skcs)
}

function summarizeListings(
  db: ReturnType<typeof getDb>,
  listings: SourceRow[],
  options?: { onlySelected?: boolean },
) {
  if (listings.length === 0) return []
  const listingIds = listings.map((listing) => Number(listing.id))
  const placeholders = listingIds.map(() => "?").join(", ")
  const selectedSkuFilter = options?.onlySelected
    ? "and sku.selected_for_publish = 1 and skc.selected_for_publish = 1"
    : ""
  const summaryRows = db.prepare(`
    with target_listing as (
      select id
      from listing
      where id in (${placeholders})
    ),
    skc_summary as (
      select
        skc.listing_id,
        jsonb_agg(
          jsonb_build_object(
            'skc_code', skc.skc_code,
            'color_name', skc.color_name,
            'image_url', skc.image_url,
            'selected_for_publish', skc.selected_for_publish
          )
          order by skc.selected_for_publish desc, skc.skc_code
        ) as all_skcs
      from listing_skc skc
      join target_listing target on target.id = skc.listing_id
      group by skc.listing_id
    ),
    version_summary as (
      select distinct on (version.listing_id)
        version.listing_id,
        version.version_no,
        version.status,
        version.change_summary
      from listing_publish_version version
      join target_listing target on target.id = version.listing_id
      order by version.listing_id, version.version_no desc
    ),
    validation_summary as (
      select
        validation.listing_id,
        count(*) as issue_count,
        count(*) filter (where validation.severity = 'ERROR' and validation.resolved = 0) as blocker_count
      from listing_validation_result validation
      join target_listing target on target.id = validation.listing_id
      group by validation.listing_id
    ),
    sku_summary as (
      select skc.listing_id, count(*) as sku_count
      from listing_sku sku
      join listing_skc skc on skc.id = sku.listing_skc_id
      join target_listing target on target.id = skc.listing_id
      where true ${selectedSkuFilter}
      group by skc.listing_id
    )
    select
      target.id as listing_id,
      coalesce(skc_summary.all_skcs, '[]'::jsonb) as all_skcs,
      version_summary.version_no as latest_version_no,
      version_summary.status as latest_version_status,
      version_summary.change_summary as latest_version_summary,
      coalesce(validation_summary.issue_count, 0) as issue_count,
      coalesce(validation_summary.blocker_count, 0) as blocker_count,
      coalesce(sku_summary.sku_count, 0) as sku_count
    from target_listing target
    left join skc_summary on skc_summary.listing_id = target.id
    left join version_summary on version_summary.listing_id = target.id
    left join validation_summary on validation_summary.listing_id = target.id
    left join sku_summary on sku_summary.listing_id = target.id
  `).all(...listingIds) as SourceRow[]
  const summaryById = new Map(summaryRows.map((row) => [Number(row.listing_id), row]))

  return listings.map((listing) => {
    const summary = summaryById.get(Number(listing.id)) ?? {}
    const allSkcs = parseJsonArray(summary.all_skcs) as SourceRow[]
    const selectedSkcs = options?.onlySelected
      ? allSkcs.filter((skc) => Number(skc.selected_for_publish ?? 1) === 1)
      : allSkcs
    const hero = selectedSkcs.find((skc) => normalizeText(skc.image_url))
    const skcPreview = selectedSkcs.slice(0, 4).map((skc) => ({
      skc_code: skc.skc_code,
      color_name: skc.color_name,
      image_url: skc.image_url,
    }))
    return {
      ...displayListingForSelectedSkcs(listing, selectedSkcs, allSkcs),
      latest_version_no: summary.latest_version_no ?? null,
      latest_version_status: summary.latest_version_status ?? null,
      latest_version_summary: summary.latest_version_summary ?? null,
      issue_count: Number(summary.issue_count ?? 0),
      blocker_count: Number(summary.blocker_count ?? 0),
      skc_count: selectedSkcs.length,
      sku_count: Number(summary.sku_count ?? 0),
      hero_image_url: hero?.image_url ?? null,
      hero_color_name: hero?.color_name ?? null,
      hero_skc_code: hero?.skc_code ?? null,
      skc_preview: skcPreview,
    }
  })
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
  const sizeAttr = findSizeSaleAttribute(attrs)
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

function inspectListingImageForRequirement(bytes: Buffer, requirement: PictureRequirement) {
  const detected = detectImageUploadType(bytes)
  if (detected.contentType === "image/webp") {
    throw new HTTPException(400, { message: `${requirement.name} 仅支持 JPG、JPEG、PNG` })
  }
  const { width, height } = readImageDimensions(bytes)
  const compliance = imageCompliance({
    width,
    height,
    file_size: bytes.length,
  }, requirement)
  if (!compliance.compliant) {
    throw new HTTPException(400, {
      message: `图片不符合${requirement.name}要求：${compliance.reasons.join("；")}`,
    })
  }
  return { detected, width, height, compliance }
}

function listingImageRequirementAssetCount({
  db,
  listingId,
  listingSkcId,
  assetTypes,
  excludeAssetId,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  listingSkcId?: unknown
  assetTypes: string[]
  excludeAssetId?: unknown
}) {
  const clauses = ["listing_id = ?"]
  const params: unknown[] = [listingId]
  if (Number.isFinite(Number(listingSkcId)) && Number(listingSkcId) > 0) {
    clauses.push("listing_skc_id = ?")
    params.push(Number(listingSkcId))
  } else {
    clauses.push("listing_skc_id is null")
  }
  clauses.push(`asset_type in (${assetTypes.map(() => "?").join(",")})`)
  params.push(...assetTypes)
  const excludedId = Number(excludeAssetId)
  if (Number.isFinite(excludedId) && excludedId > 0) {
    clauses.push("id <> ?")
    params.push(excludedId)
  }
  const row = db.prepare(`
    select count(*) as count
    from listing_asset
    where ${clauses.join(" and ")}
  `).get(...params) as SourceRow | undefined
  return Number(row?.count ?? 0)
}

function assertListingImageCapacity(input: {
  db: ReturnType<typeof getDb>
  listingId: number
  listingSkcId?: unknown
  requirement: PictureRequirement
  assetType: string
  incomingCount?: number
  excludeAssetId?: unknown
}) {
  const incomingCount = input.incomingCount ?? 1
  for (const rule of pictureCapacityRules(input.requirement)) {
    if (!rule.asset_types.includes(input.assetType)) continue
    const currentCount = listingImageRequirementAssetCount({
      db: input.db,
      listingId: input.listingId,
      listingSkcId: input.listingSkcId,
      assetTypes: rule.asset_types,
      excludeAssetId: input.excludeAssetId,
    })
    const ruleRequirement = { ...input.requirement, max_count: rule.max_count }
    if (!canAddImagesToRequirement(currentCount, incomingCount, ruleRequirement)) {
      throw new HTTPException(409, {
        message: `${rule.label}最多 ${rule.max_count} 张，请先删除或调整已有图片`,
      })
    }
  }
}

function deleteAutoSourceImagesForUserAsset(input: {
  db: ReturnType<typeof getDb>
  listingId: number
  listingSkcId?: unknown
  assetType: string
}) {
  const assetType = normalizeText(input.assetType)
  if (!["MAIN", "SQUARE", "COLOR_BLOCK", "COLOR"].includes(assetType)) return
  const imageType = sheinImageType(assetType)
  const typesToDelete = imageType === 6
    ? ["COLOR_BLOCK", "COLOR"]
    : [assetType]
  const clauses = [
    "listing_id = ?",
    "source_type = 'SKC_SOURCE_IMAGE'",
    `asset_type in (${typesToDelete.map(() => "?").join(",")})`,
  ]
  const params: unknown[] = [input.listingId, ...typesToDelete]
  if (Number.isFinite(Number(input.listingSkcId)) && Number(input.listingSkcId) > 0) {
    clauses.push("listing_skc_id = ?")
    params.push(Number(input.listingSkcId))
  } else {
    clauses.push("listing_skc_id is null")
  }
  input.db.prepare(`
    delete from listing_asset
    where ${clauses.join(" and ")}
  `).run(...params)
}

function lockListingImageMutation(db: ReturnType<typeof getDb>, listingId: number) {
  const listing = db.prepare("select id from listing where id = ? for update").get(listingId) as SourceRow | undefined
  if (!listing) throw new HTTPException(404, { message: "草稿不存在" })
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
  if (isAutoFallbackColorAsset(asset)) return false
  const assetType = normalizeText(asset.asset_type)
  return requirement.asset_types.includes(assetType)
}

function isAutoFallbackColorAsset(asset: SourceRow) {
  const assetType = normalizeText(asset.asset_type)
  return normalizeText(asset.source_type) === "SOURCE_FALLBACK"
    && (assetType === "COLOR_BLOCK" || assetType === "COLOR")
}

function realImageAssets(assets: SourceRow[]) {
  return assets.filter((asset) => !isAutoFallbackColorAsset(asset))
}

function getImageChecklist(skcs: SourceRow[], assets: SourceRow[], imageRequirements: PictureRequirement[] = []) {
  const visibleSkcRequirements = imageRequirements.filter((item) => item.level === "SKC" && item.show !== 0)
  return skcs.map((skc) => {
    const skcCode = normalizeText(skc.skc_code)
    const selected = Number(skc.selected_for_publish ?? 1) === 1
    const skcAssets = realImageAssets(assets).filter((asset) => normalizeText(asset.skc_code) === skcCode)
    const hasTmallColor = Boolean(normalizeText(skc.image_url))
    const detailCount = skcAssets.filter((asset) => normalizeText(asset.asset_type).includes("DETAIL")).length
    const missing: string[] = []
    const requirementStatus = visibleSkcRequirements.map((requirement) => {
      const requirementAssets = skcAssets.filter((asset) => assetMatchesRequirement(asset, requirement))
      const hasSourceMain = requirement.requirement_key === "SKC_DETAIL" && hasTmallColor
      const required = requirement.required === 1
        || (requirement.requirement_key === "SKC_COLOR_BLOCK" && skcs.filter((item) => Number(item.selected_for_publish ?? 1) === 1).length > 1)
      const satisfied = !selected || !required || hasSourceMain || requirementAssets.length > 0
      if (selected && required && !satisfied) missing.push(requirement.name)
      return {
        requirement_key: requirement.requirement_key,
        name: requirement.name,
        level: requirement.level,
        required,
        asset_count: requirementAssets.length + (hasSourceMain ? 1 : 0),
        status: satisfied ? "READY" : "MISSING",
      }
    })
    const groupConfirmed = Number(skc.image_confirmed ?? 0) === 1
    const assetConfirmationsAligned = skcAssets.every((asset) => Number(asset.confirmed ?? 0) === 1)
    return {
      skc_code: skcCode,
      color_name: skc.color_name ?? null,
      selected_for_publish: selected,
      has_tmall_color_image: hasTmallColor,
      imported_asset_count: skcAssets.length,
      detail_asset_count: detailCount,
      confirmed: groupConfirmed && assetConfirmationsAligned,
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
  ensureSkcSourceImageAssetsForPublish(db, listingId)
  const assets = realImageAssets(getListingAssets(db, listingId, { onlySelected: true }))
  const mapped_size_charts = getMappedSizeCharts({ db, listing, sizeTables: size_tables, sizeTableRows: size_table_rows })
  const size_chart_attributes = getSizeChartAttributes(db, listing.product_type_id)
  const manual_size_chart = getManualSizeChart(db, listing)
  const image_requirements = getImageRequirements(db, listing)
  const sale_attributes = getRequiredAttributes(db, asNumber(listing.platform_category_id), asNumber(listing.product_type_id))
    .filter((attr) => attr.attribute_type === 1)

  const selectedReadiness = displayReadinessForSelectedSkcs(readiness, skcs, readiness.skcs)
  const sourceSnapshot = parseJsonObject(listing.source_snapshot_json)
  return {
    listing: summarizeListing(db, listing, { onlySelected: true }),
    readiness: selectedReadiness,
    category_creation_decision: sourceSnapshot.category_creation_decision ?? null,
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
    size_chart_attributes,
    manual_size_chart,
    validation_issues: validationIssues,
    versions,
    publish_tasks: publishTasks,
    platform_identities: platformIdentities,
  }
}

function getListingDetailForAiWarning(db: ReturnType<typeof getDb>, listingId: number) {
  try {
    return getListingDetail(db, listingId)
  } catch {
    return null
  }
}

function selectedSkcsForTitle(row: ReadinessRow) {
  const selected = row.skcs.filter((skc) => Number(skc.selected_for_publish ?? 1) !== 0)
  return selected.length ? selected : row.skcs
}

function heuristicEnglishTitle(row: ReadinessRow) {
  const title = normalizeText(row.title_cn || row.spu_name)
  const category = normalizeText(row.category.category_name)
  const colorText = selectedSkcsForTitle(row).map((skc) => englishColorName(skc.color_name)).filter(Boolean).slice(0, 3).join("/")
  const brand = englishBrandName(row.brand_name)
  let productName = "Kids Clothing"
  const genderPrefix = category.includes("女童") ? "Girls" : category.includes("男童") ? "Boys" : "Kids"
  if (category.includes("衬衫") || title.includes("衬衫")) productName = `${genderPrefix} Long Sleeve Shirt`
  else if (category.includes("连衣裙") || title.includes("连衣裙") || title.includes("裙")) productName = `${genderPrefix} Dress`
  else if (category.includes("卫衣套装") || title.includes("连帽") || title.includes("卫衣")) {
    productName = `${genderPrefix} Hooded Two-Piece Sweatshirt Set`
  }
  else if (category.includes("套装") || title.includes("套装")) {
    productName = `${genderPrefix} Two-Piece Outfit Set`
  }
  else if (category.includes("开襟") || title.includes("毛衫") || title.includes("毛衣")) productName = "Kids Cardigan Sweater"
  else if (category.includes("卫裤") || title.includes("卫裤")) productName = `${genderPrefix} Sweatpants`
  else if (category.includes("长裤") || category.includes("下装") || title.includes("长裤") || title.includes("裤")) productName = `${genderPrefix} Pants`

  const season = title.includes("夏") ? "Summer" : title.includes("春") ? "Spring" : ""
  return [brand, productName, season, colorText].filter(Boolean).join(" ")
}

function productDescriptionField(row: ReadinessRow) {
  return row.field_groups
    .flatMap((group) => group.fields)
    .find((field) => field.key === "product_description") ?? null
}

function shouldGenerateProductDescription(row: ReadinessRow) {
  const field = productDescriptionField(row)
  if (!field) return false
  return !normalizeText(field.value) && (field.status === "MISSING" || field.status === "NEEDS_AI")
}

function heuristicProductDescription(row: ReadinessRow) {
  const productName = normalizeText(row.title_cn) || normalizeText(row.spu_name) || normalizeText(row.category.category_name) || "童装单品"
  const categoryName = normalizeText(row.category.category_name)
  const brand = normalizeText(row.brand_name)
  const colorNames = uniqueStrings(row.skcs.map((skc) => normalizeText(skc.color_name))).slice(0, 3)
  const sentences = [
    `${brand ? `${brand} ` : ""}${productName}，适合儿童日常穿着与出行搭配。`,
  ]
  if (categoryName && categoryName !== productName) {
    sentences.push(`商品定位为${categoryName}，版型设计便于活动。`)
  }
  if (colorNames.length > 0) {
    sentences.push(`当前款色包含${colorNames.join("、")}，可按搭配需求选择。`)
  }
  sentences.push("整体简洁耐看，适合上学、居家和户外等多种场景。")
  return compactText(sentences.join(""), 320)
}

function sanitizeProductDescription(value: unknown) {
  const text = compactText(value, 320)
  if (text.length < 12) return ""
  if (/(\d+(?:\.\d+)?\s*(?:%|g|kg|克|千克|公斤)|成分|材质|面料|毛重|重量|净重|克重|图片|主图|已上传|平台审核)/i.test(text)) return ""
  return text
}

async function callAiGenerateProductDescription(row: ReadinessRow) {
  const fallback = sanitizeProductDescription(heuristicProductDescription(row))
  const config = resolveAiConfig()
  const policy = resolveAiScenarioPolicy("shein_description")
  if (policy.mode === "disabled") return fallback
  if (policy.mode !== "guarded" && !config.apiKey) return fallback
  const prompt = JSON.stringify({
    task: "为 SHEIN 童装发布草稿生成商品描述",
    output_schema: {
      product_description: "80-160 字中文商品描述",
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "描述只能基于商品标题、类目、品牌、款色和普通穿着场景。",
      "不要编造成分、材质、百分比、毛重、图片上传状态、认证或平台审核承诺。",
      "语气面向商品详情页，简洁自然，不写内部处理建议。",
    ],
    product: {
      spu_code: row.spu_code,
      spu_name: row.spu_name,
      title_cn: row.title_cn,
      title_en: row.title_en,
      brand_name: row.brand_name,
      category: row.category,
      colors: row.skcs.map((skc) => normalizeText(skc.color_name)).filter(Boolean),
    },
  }, null, 2)
  const response = await getDefaultAiScenarioRouter({ db: getDb() }).callJson(
    withAiRoutingHashes({
      scenario: "shein_description",
      promptVersion: "shein-description-v1",
      messages: [
        {
          role: "system",
          content: "你是跨境童装商品文案助手，只能根据给定事实写保守商品描述。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      validate: (json: { product_description?: unknown }) => Boolean(sanitizeProductDescription(json?.product_description)),
      auditValue: (json: { product_description?: unknown }) => ({
        product_description: sanitizeProductDescription(json?.product_description),
      }),
    }, {
      input: {
        spu_code: row.spu_code,
        title_cn: row.title_cn,
        category: row.category,
        colors: row.skcs.map((skc) => normalizeText(skc.color_name)).filter(Boolean),
      },
    }),
  )
  const parsed = response.json as { product_description?: unknown }
  return sanitizeProductDescription(parsed.product_description) || fallback
}

async function safeAiGenerateProductDescription(row: ReadinessRow) {
  return callAiGenerateProductDescription(row).catch(() => sanitizeProductDescription(heuristicProductDescription(row)))
}

async function callAiTranslateTitle(row: ReadinessRow) {
  const config = resolveAiConfig()
  const policy = resolveAiScenarioPolicy("title_translation")
  if (policy.mode === "disabled") return heuristicEnglishTitle(row)
  if (policy.mode !== "guarded" && !config.apiKey) {
    return heuristicEnglishTitle(row)
  }
  const messages = [
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
          colors: selectedSkcsForTitle(row).map((skc) => skc.color_name).filter(Boolean),
        },
      }),
    },
  ]
  const response = await getDefaultAiScenarioRouter({ db: getDb() }).callJson(
    withAiRoutingHashes({
      scenario: "title_translation",
      promptVersion: "title-translation-v1",
      messages,
      validate: (json: { title_en?: unknown }) =>
        typeof json?.title_en === "string" && Boolean(normalizeText(json.title_en)),
      auditValue: (json: { title_en?: unknown }) => ({
        title_en: normalizeText(json?.title_en),
      }),
    }, {
      input: {
        spu_code: row.spu_code,
        brand: row.brand_name,
        title_cn: row.title_cn,
        category: row.category,
        colors: selectedSkcsForTitle(row).map((skc) => skc.color_name).filter(Boolean),
      },
    }),
  )
  const parsed = response.json as { title_en?: string }
  return normalizeText(parsed.title_en) || heuristicEnglishTitle(row)
}

async function safeAiTranslateTitle(row: ReadinessRow) {
  return callAiTranslateTitle(row).catch(() => heuristicEnglishTitle(row))
}

function shouldAskLiveAiCategory(category: ReadinessRow["category"]) {
  const source = normalizeText(category.source)
  return Boolean(
    !category.category_id
    || !category.product_type_id
    || category.status !== "READY"
    || source === "AI_CATEGORY"
    || source === "MISSING",
  )
}

function categorySelectionCandidate(category: ReadinessRow["category"]): CategorySelectionCandidate {
  return {
    categoryId: category.category_id,
    productTypeId: category.product_type_id,
    categoryName: category.category_name,
    path: category.path,
    source: category.source,
    status: category.status,
  }
}

function liveAiSelectionCandidate(liveCategory: LiveAiDraftCategory) {
  return {
    categoryId: liveCategory.categoryId,
    productTypeId: liveCategory.productTypeId,
    categoryName: liveCategory.categoryName,
    path: liveCategory.path,
    source: "AI_CATEGORY_LIVE",
    status: liveCategory.status,
    confidence: liveCategory.confidence,
    splitBySkc: liveCategory.splitBySkc,
    risks: liveCategory.risks,
    blockingRisks: liveCategory.blockingRisks,
  }
}

function verifiedCategorySelection(
  db: ReturnType<typeof getDb>,
  category: CategorySelectionCandidate | null | undefined,
) {
  return Boolean(getCategoryPairMetadata(
    db,
    asPositiveNumber(category?.categoryId),
    asPositiveNumber(category?.productTypeId),
  ))
}

function categoryDecisionForReadiness(
  db: ReturnType<typeof getDb>,
  category: ReadinessRow["category"],
  options: {
    allowRuleFallback?: boolean
    liveAi?: LiveAiDraftCategory | null
  } = {},
) {
  const selection = categorySelectionCandidate(category)
  const liveAi = options.liveAi ? liveAiSelectionCandidate(options.liveAi) : null
  return categoryAutoSelectionDecision({
    category: selection,
    metadataValid: verifiedCategorySelection(db, selection),
    allowRuleFallback: options.allowRuleFallback,
    liveAi,
    liveAiMetadataValid: verifiedCategorySelection(db, liveAi),
  })
}

function categoryDecisionMessage(reason: CategoryAutoSelectionDecision["reason"]) {
  const messages: Record<CategoryAutoSelectionDecision["reason"], string> = {
    RULE_READY: "已命中确认类目规则",
    RULE_FALLBACK_READY: "性别、年龄段和品类均明确，已应用确定性类目算法",
    AI_READY: "AI 建议达到自动应用门槛，已自动选择 SHEIN 类目",
    CATEGORY_MISSING: "没有可用类目候选，需要人工选择",
    CATEGORY_PAIR_INVALID: "类目与 Product Type 未通过本地叶子类目校验",
    CATEGORY_NEEDS_REVIEW: "现有类目建议尚未确认",
    RULE_FALLBACK_DISABLED: "本次操作未允许自动应用 fallback 类目",
    AI_STATUS_NOT_READY: "AI 判定为歧义或无匹配",
    AI_LOW_CONFIDENCE: "AI 已选择合法类目，但置信度未达到 0.92，需要人工复核",
    AI_SPLIT_BY_SKC: "同一 SPU 的不同 SKC 可能需要不同类目",
    AI_HAS_RISKS: "AI 已选择合法类目，但返回了需要人工核对的风险",
    AI_HIGH_RISK_CATEGORY: "AI 已选择合法类目，但该细分类目必须人工确认",
    AI_CATEGORY_PAIR_INVALID: "AI 类目未通过本地叶子类目校验",
  }
  return messages[reason]
}

function reviewCategorySourceForDecision(decision: CategoryAutoSelectionDecision) {
  const source = normalizeText(decision.source || decision.suggestion?.source || "AI_CATEGORY")
  if (source === "AI_CATEGORY_LIVE") return "AI_CATEGORY_LIVE_REVIEW"
  if (source === "AI_CATEGORY") return "AI_CATEGORY_REVIEW"
  return source.endsWith("_REVIEW") ? source : `${source}_REVIEW`
}

function categoryApplicationFromDecision(decision: CategoryAutoSelectionDecision) {
  if (decision.apply && decision.category) {
    return {
      category: decision.category,
      source: normalizeText(decision.source || decision.category.source) || "CATEGORY_RULE",
      status: "READY",
      error: null,
      reviewRequired: false,
    }
  }
  if (decision.applyAsReview && decision.suggestion) {
    return {
      category: decision.suggestion,
      source: reviewCategorySourceForDecision(decision),
      status: "NEEDS_REVIEW",
      error: categoryDecisionMessage(decision.reason),
      reviewRequired: true,
    }
  }
  return null
}

function categoryOverrideFromSelection(
  category: CategorySelectionCandidate,
  options: {
    source?: string
    status?: string
    error?: string | null
  } = {},
): CategoryOverride {
  return {
    category_id: asPositiveNumber(category.categoryId),
    product_type_id: asPositiveNumber(category.productTypeId),
    category_name: normalizeText(category.categoryName) || null,
    path: normalizeText(category.path) || null,
    source: options.source || normalizeText(category.source) || "CATEGORY_RULE",
    status: options.status || normalizeText(category.status) || "READY",
    error: options.error ?? null,
  }
}

function buildReadinessWithCategoryOverride(
  db: ReturnType<typeof getDb>,
  sourceRow: SourceRow,
  categoryOverride: CategoryOverride,
) {
  const spuCode = String(sourceRow.spu_code)
  return buildRow({
    db,
    row: sourceRow,
    sizeConversions: activeSizeConversions(db),
    discounts: activeDiscounts(db),
    weights: activeWeights(db),
    fills: activeFillMap(db, [spuCode]),
    categoryOverride,
    ignoreStoredCategory: true,
  })
}

async function readinessForDraftCreation(
  db: ReturnType<typeof getDb>,
  sourceRow: SourceRow,
  readiness: ReadinessRow,
  options: {
    autoSelectCategory?: boolean
    skcCodes?: string[]
  } = {},
) {
  const neutralProduct = isNeutralProductGender(sourceRow.gender_name)
  const initialDecision = categoryDecisionForReadiness(db, readiness.category, {
    allowRuleFallback: true,
  })
  if (initialDecision.apply && !neutralProduct) {
    return {
      readiness,
      decision: initialDecision,
      liveAi: null,
    }
  }
  if (
    options.autoSelectCategory === false
    || (!neutralProduct && !shouldAskLiveAiCategory(readiness.category))
  ) {
    return {
      readiness,
      decision: initialDecision,
      liveAi: null,
    }
  }
  const liveCategory = await safeResolveLiveAiDraftCategory(db, readiness, options.skcCodes)
  if (!liveCategory) {
    return {
      readiness,
      decision: initialDecision,
      liveAi: null,
    }
  }

  const decision = categoryDecisionForReadiness(db, readiness.category, {
    allowRuleFallback: true,
    liveAi: liveCategory,
  })
  const selectedCategory = decision.category ?? decision.suggestion
  if (!selectedCategory) {
    return {
      readiness,
      decision,
      liveAi: liveCategory,
    }
  }
  const categoryOverride = categoryOverrideFromSelection(selectedCategory, decision.apply
    ? {
      source: decision.source || "AI_CATEGORY_LIVE",
      status: "READY",
    }
    : {
      source: "AI_CATEGORY_LIVE_REVIEW",
      status: "NEEDS_REVIEW",
      error: categoryDecisionMessage(decision.reason),
    })
  return {
    readiness: buildReadinessWithCategoryOverride(db, sourceRow, categoryOverride),
    decision,
    liveAi: liveCategory,
  }
}

function liveAiCategoryKeywordText(row: ReadinessRow, sourceRow: SourceRow | null) {
  return [
    row.spu_name,
    row.title_cn,
    row.title_en,
    sourceRow?.middle_class_name,
    sourceRow?.subclass_name,
    sourceRow?.gender_name,
    sourceRow?.age_group_name,
    sourceRow?.deepdraw_category_name,
    sourceRow?.deepdraw_trade_path,
    ...row.skcs.map((skc) => skc.color_name),
  ].map(normalizeText).filter(Boolean).join(" ")
}

function liveAiCategoryKeywords(row: ReadinessRow, sourceRow: SourceRow | null) {
  const text = liveAiCategoryKeywordText(row, sourceRow)
  const keywords = new Set<string>()
  if (/开襟|毛衫|毛衣|针织/.test(text)) {
    keywords.add("开襟衫")
    keywords.add("针织衫")
    keywords.add("毛衣")
  }
  if (/卫衣|连帽/.test(text)) {
    keywords.add("卫衣")
    keywords.add("连帽衫")
  }
  if (/衬衫/.test(text)) keywords.add("衬衫")
  if (/T恤|T 恤|短袖|上衣/.test(text)) {
    keywords.add("T恤")
    keywords.add("上衣")
  }
  if (/裤|长裤|短裤|打底裤|牛仔裤/.test(text)) {
    keywords.add("裤")
    keywords.add("长裤")
    keywords.add("短裤")
  }
  if (/鞋|慢跑|跑步|运动鞋|户外运动|凉鞋|拖鞋|靴/.test(text)) {
    keywords.add("鞋")
    keywords.add("运动鞋")
    if (/慢跑|跑步/.test(text)) keywords.add("跑步鞋")
    if (/户外/.test(text)) keywords.add("户外运动鞋")
    if (/凉鞋/.test(text)) keywords.add("凉鞋")
    if (/拖鞋/.test(text)) keywords.add("拖鞋")
    if (/靴/.test(text)) keywords.add("靴")
  }
  if (/连衣裙|裙/.test(text)) {
    keywords.add("连衣裙")
    keywords.add("裙")
  }
  if (/套装/.test(text)) keywords.add("套装")
  if (/外套|夹克|大衣|羽绒/.test(text)) {
    keywords.add("外套")
    keywords.add("夹克")
  }
  if (/婴|宝宝|幼童/.test(text)) keywords.add("婴童")
  if (keywords.size === 0) keywords.add("服装")
  return [...keywords].slice(0, 8)
}

function listLiveAiCategoryCandidates(
  db: ReturnType<typeof getDb>,
  row: ReadinessRow,
  sourceRow: SourceRow | null,
) {
  const keywords = liveAiCategoryKeywords(row, sourceRow)
  const where = keywords.map(() => "(category_name like ? or path like ?)").join(" or ")
  const params = keywords.flatMap((keyword) => [`%${keyword}%`, `%${keyword}%`])
  const rows = db.prepare(`
    select category_id, product_type_id, category_name, path, attr_count, required_count
    from v_shein_leaf_category
    where root_category_name in ('儿童', '婴儿')
      and (${where})
    order by
      case
        when path like '儿童 > 女童（小）%' then 0
        when path like '儿童 > 男童（小）%' then 1
        when path like '婴儿 > 婴童%' then 2
        when path like '儿童 > 女童（大）%' then 3
        when path like '儿童 > 男童（大）%' then 4
        else 9
      end,
      path
    limit 180
  `).all(...params) as CategoryCandidate[]

  const seen = new Set<string>()
  return rows.filter((candidate) => {
    const key = `${candidate.category_id}:${candidate.product_type_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildLiveAiCategoryGroup(
  row: ReadinessRow,
  sourceRow: SourceRow | null,
  skcCodes?: string[],
) {
  const selectedSkcCodes = new Set((skcCodes ?? []).map(normalizeText).filter(Boolean))
  const selectedSkcs = selectedSkcCodes.size > 0
    ? row.skcs.filter((skc) => selectedSkcCodes.has(normalizeText(skc.skc_code)))
    : row.skcs
  return {
    match_key: `draft:${row.spu_code}`,
    mdm_middle_category_name: normalizeText(sourceRow?.middle_class_name),
    mdm_small_category_name: normalizeText(sourceRow?.subclass_name),
    gender_name: normalizeText(sourceRow?.gender_name),
    age_group_name: normalizeText(sourceRow?.age_group_name),
    spec_range: normalizeText(sourceRow?.spec_range ?? sourceRow?.size_range_name),
    fabric_type_name: normalizeText(sourceRow?.fabric_type_name),
    model_name: normalizeText(sourceRow?.model_name),
    length_name: normalizeText(sourceRow?.length_name),
    deepdraw_category_name: normalizeText(sourceRow?.deepdraw_category_name),
    trade_path: normalizeText(sourceRow?.deepdraw_trade_path),
    deepdraw_title: normalizeText(row.title_cn) || normalizeText(row.spu_name),
    deepdraw_fields: row.manual_fields.slice(0, 12).map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
    })),
    spus: [row.spu_code],
    spu_count: 1,
    skc_examples: selectedSkcs.map((skc) => ({
      spu_code: row.spu_code,
      skc_code: normalizeText(skc.skc_code),
      color_code: normalizeText(skc.color_code),
      color_name: normalizeText(skc.color_name),
      tmall_color_image_url: normalizeText(skc.tmall_color_image_url)
        || normalizeText(skc.tmall_color_url)
        || normalizeText(skc.pic_url),
    })),
  }
}

async function resolveLiveAiDraftCategory(
  db: ReturnType<typeof getDb>,
  row: ReadinessRow,
  skcCodes?: string[],
): Promise<LiveAiDraftCategory | null> {
  const sourceRow = getSourceProductRow(db, row.spu_code)
  const candidates = listLiveAiCategoryCandidates(db, row, sourceRow)
  if (candidates.length === 0) return null

  const group = buildLiveAiCategoryGroup(row, sourceRow, skcCodes)
  const result = await callAiCategoryMatcher({
    groups: [group],
    candidates,
    router: getDefaultAiScenarioRouter({ db }),
  })
  const suggestion = result.suggestions.find((item: Record<string, unknown>) => normalizeText(item.match_key) === group.match_key)
    ?? result.suggestions[0]
  const suggestionStatus = normalizeText(suggestion?.status).toUpperCase()
  const confidence = Number(suggestion?.confidence)
  const risks = Array.isArray(suggestion?.risks) ? suggestion.risks.map(normalizeText).filter(Boolean) : []
  if (!suggestion || suggestionStatus === "NO_MATCH" || !suggestion.primary) return null

  const primary = suggestion.primary as Record<string, unknown>
  const categoryId = asPositiveNumber(primary.category_id)
  const productTypeId = asPositiveNumber(primary.product_type_id)
  if (!categoryId || !productTypeId) return null

  const candidate = normalizeAiCategoryCandidate(primary, candidates)
  if (!candidate) {
    throw new HTTPException(422, { message: `AI 返回了候选集之外的 SHEIN 类目：${categoryId}/${productTypeId}` })
  }
  const normalizedCategoryId = Number(candidate.category_id)
  const normalizedProductTypeId = Number(candidate.product_type_id)
  const category = db.prepare(`
    select category_id, product_type_id, category_name, path
    from channel_category
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
      and coalesce(last_category, 0) = 1
    limit 1
  `).get(normalizedCategoryId, normalizedProductTypeId) as CategoryCandidate | undefined
  if (!category) {
    throw new HTTPException(404, { message: `AI 返回的 SHEIN 类目不存在：${normalizedCategoryId}/${normalizedProductTypeId}` })
  }

  return {
    categoryId: normalizedCategoryId,
    productTypeId: normalizedProductTypeId,
    categoryName: normalizeText(category.category_name) || normalizeText(candidate.category_name) || null,
    path: normalizeText(category.path) || normalizeText(candidate.path) || null,
    status: suggestionStatus,
    confidence: Number.isFinite(confidence) ? confidence : null,
    splitBySkc: suggestion.split_by_skc === true,
    reasons: Array.isArray(suggestion.reasons) ? suggestion.reasons.map(normalizeText).filter(Boolean) : [],
    risks,
    blockingRisks: Array.isArray(suggestion.blocking_risks)
      ? suggestion.blocking_risks.map(normalizeText).filter(Boolean)
      : [],
    alternatives: Array.isArray(suggestion.alternatives)
      ? suggestion.alternatives
        .map((alternative) => {
          const alternativeCandidate = normalizeAiCategoryCandidate(alternative, candidates)
          return alternativeCandidate
            ? normalizedAiCategoryPayload(alternative, alternativeCandidate)
            : null
        })
        .filter((alternative) => alternative !== null)
      : [],
    skcSuggestions: normalizeLiveAiSkcCategorySuggestions(
      suggestion.skc_suggestions,
      candidates,
    ),
  }
}

async function safeResolveLiveAiDraftCategory(
  db: ReturnType<typeof getDb>,
  row: ReadinessRow,
  skcCodes?: string[],
): Promise<LiveAiDraftCategory | null> {
  try {
    return await resolveLiveAiDraftCategory(db, row, skcCodes)
  } catch (error) {
    console.warn("Draft live AI category recommendation failed", error)
    return null
  }
}

function neutralReviewDecision(
  decision: CategoryAutoSelectionDecision,
): CategoryAutoSelectionDecision {
  const suggestion = decision.category ?? decision.suggestion
  return {
    apply: false,
    category: null,
    suggestion,
    source: suggestion?.source ? String(suggestion.source) : decision.source,
    confidence: decision.confidence,
    reason: "CATEGORY_NEEDS_REVIEW",
  }
}

function expandNeutralSkcDraftInputs(
  db: ReturnType<typeof getDb>,
  input: {
    spuCode: string
    sourceRow: SourceRow
    readiness: ReadinessRow
    categoryDecision: CategoryAutoSelectionDecision
    liveAi: LiveAiDraftCategory | null
    skcCodes?: string[]
  },
) {
  const selectedSkcCodes = new Set((input.skcCodes ?? []).map(normalizeText).filter(Boolean))
  const selectedSkcs = selectedSkcCodes.size > 0
    ? input.readiness.skcs.filter((skc) => selectedSkcCodes.has(normalizeText(skc.skc_code)))
    : input.readiness.skcs
  const targetSkcCodes = selectedSkcs.map((skc) => normalizeText(skc.skc_code)).filter(Boolean)
  const aiEvidenceFor = (skcCodes: string[]) => {
    const selected = new Set(skcCodes)
    return (input.liveAi?.skcSuggestions ?? []).filter((suggestion) => {
      const row = suggestion && typeof suggestion === "object"
        ? suggestion as Record<string, unknown>
        : null
      return row ? selected.has(normalizeText(row.skc_code ?? row.skcCode)) : false
    })
  }
  const plan = planNeutralSkcDrafts({
    genderName: input.sourceRow.gender_name,
    productText: [
      input.sourceRow.middle_class_name,
      input.sourceRow.subclass_name,
      input.sourceRow.deepdraw_category_name,
      input.sourceRow.deepdraw_trade_path,
      input.readiness.spu_name,
      input.readiness.title_cn,
      input.readiness.title_en,
    ].map(normalizeText).filter(Boolean).join(" "),
    skcs: selectedSkcs.map((skc) => ({
      skcCode: normalizeText(skc.skc_code),
      colorName: normalizeText(skc.color_name),
      imageUrl: normalizeText(skc.tmall_color_image_url)
        || normalizeText(skc.tmall_color_url)
        || normalizeText(skc.pic_url)
        || null,
    })),
    liveAi: input.liveAi ? {
      status: input.liveAi.status,
      splitBySkc: input.liveAi.splitBySkc,
      risks: input.liveAi.risks,
      blockingRisks: input.liveAi.blockingRisks,
      skcSuggestions: input.liveAi.skcSuggestions,
    } : null,
    resolveCategory: (categoryId, productTypeId) => {
      const metadata = getCategoryPairMetadata(db, categoryId, productTypeId)
      if (!metadata) return null
      return {
        categoryId: Number(metadata.category_id),
        productTypeId: Number(metadata.product_type_id),
        categoryName: normalizeText(metadata.category_name) || null,
        path: normalizeText(metadata.path) || null,
      }
    },
  })

  if (plan.status === "NOT_APPLICABLE") {
    return [{
      ...input,
      skcCodes: input.skcCodes,
      splitGroupKey: null,
      splitReason: null,
      splitGender: null,
      splitEvidenceBasis: null,
      aiSkcEvidence: [],
      splitPlanStatus: plan.status,
      splitPlanReason: plan.reason,
    }]
  }
  if (plan.status !== "READY") {
    return [{
      ...input,
      skcCodes: targetSkcCodes,
      categoryDecision: neutralReviewDecision(input.categoryDecision),
      splitGroupKey: null,
      splitReason: `中性款 SKC 性别证据待确认：${plan.reason}`,
      splitGender: null,
      splitEvidenceBasis: null,
      aiSkcEvidence: aiEvidenceFor(targetSkcCodes),
      splitPlanStatus: plan.status,
      splitPlanReason: plan.reason,
      unresolvedSkcCodes: plan.unresolvedSkcCodes,
    }]
  }

  const splitToken = nowIso()
  return plan.groups.map((group) => {
    const category: CategorySelectionCandidate = {
      categoryId: group.category.categoryId,
      productTypeId: group.category.productTypeId,
      categoryName: group.category.categoryName,
      path: group.category.path,
      source: "AI_CATEGORY_LIVE_SKC",
      status: "READY",
    }
    const categoryDecision: CategoryAutoSelectionDecision = {
      apply: true,
      category,
      suggestion: null,
      source: "AI_CATEGORY_LIVE_SKC",
      confidence: group.confidence,
      reason: "AI_READY",
    }
    const categoryOverride = categoryOverrideFromSelection(category, {
      source: "AI_CATEGORY_LIVE_SKC",
      status: "READY",
    })
    return {
      ...input,
      readiness: buildReadinessWithCategoryOverride(db, input.sourceRow, categoryOverride),
      categoryDecision,
      skcCodes: group.skcCodes,
      splitGroupKey: `neutral-gender:${input.readiness.spu_code}:${splitToken}`,
      splitReason: `中性款按款色图 AI 判断拆分为${group.gender === "MALE" ? "男童" : "女童"}发布草稿`,
      splitGender: group.gender,
      splitEvidenceBasis: group.evidenceBasis,
      aiSkcEvidence: group.skcEvidence,
      splitPlanStatus: plan.status,
      splitPlanReason: plan.reason,
      unresolvedSkcCodes: [],
    }
  })
}

function normalizeFillFieldValue(fieldKey: unknown, fieldLabel: unknown, value: unknown) {
  const key = normalizeText(fieldKey)
  const label = normalizeText(fieldLabel)
  if (key.startsWith("attr:") && (label.includes("材质") || label.includes("成分"))) {
    return normalizeMaterialValue(value)
  }
  return normalizeText(value)
}

function compositionSourceForReadiness(row: ReadinessRow) {
  return normalizeText(readinessFieldValue(row, "composition_text"))
}

function isCompositionAttributeField(field: FillField) {
  return field.key.startsWith("attr:") && normalizeText(field.label).includes("成分")
}

function isAiFillableAttributeField(field: FillField) {
  if (!field.key.startsWith("attr:")) return false
  if (field.conditional_on) return false
  if (isCompositionAttributeField(field)) return false
  const label = normalizeText(field.label)
  if (Number(field.attribute_type ?? 0) === 1) return false
  if (Number(field.is_size_attribute ?? 0) === 1 || /尺码|尺寸/.test(label)) return false
  const attributeId = Number(field.attribute_id)
  if (AI_MULTIMODAL_ATTRIBUTE_IDS.has(attributeId)) return true
  if (AI_RECOMMENDED_ATTRIBUTE_IDS.has(attributeId)) return true
  if (AI_RULE_ATTRIBUTE_IDS.has(attributeId)) return true
  return ["性别", "袖长"].some((keyword) => label.includes(keyword))
}

function safeAutomaticAttributeFillValue(field: FillField, row: ReadinessRow, aiFill?: Record<string, unknown>) {
  if (!isAiFillableAttributeField(field)) return ""
  if (isCompositionAttributeField(field) && !compositionSourceForReadiness(row)) return ""
  const candidateValue = normalizeFillFieldValue(field.key, field.label, aiFill?.field_value)
  const validValues = new Set((field.options ?? []).map((option) => option.attribute_value))
  if (candidateValue && (validValues.size === 0 || validValues.has(candidateValue))) return candidateValue
  return heuristicAiValue(field, row)
}

function shouldIncludeFieldInAiFill(field: FillField) {
  if (!isAiFillableAttributeField(field)) return false
  return field.status === "NEEDS_AI" || field.status === "MISSING"
}

function heuristicAiValue(field: FillField, row: ReadinessRow) {
  if (field.key === "title_en") return heuristicEnglishTitle(row)
  if (isCompositionAttributeField(field) && !compositionSourceForReadiness(row)) return ""

  const optionValues = (field.options ?? []).map((item) => item.attribute_value)
  const text = [
    row.spu_name,
    row.title_cn,
    row.category.category_name,
    row.mdm_age_group_name,
    row.mdm_spec_range,
    row.mdm_main_size_group_name,
    row.mdm_order_size_group_name,
    row.skcs.map((skc) => skc.color_name).join(" "),
    aiKnownFieldFacts(row, { includeNeedsAi: false }),
  ].map(normalizeText).join(" ")

  const pick = (needles: string[]) => findEnumValue(
    (field.options ?? []) as AttributeValue[],
    needles,
  )

  if (field.label.includes("图案")) return pick([text.includes("纯色") ? "纯色" : "", text.includes("条纹") ? "条纹" : "", text.includes("格子") ? "格子" : ""])
  if (field.label.includes("风格") || field.label.includes("企划")) return pick(["Casual休闲", "休闲"])
  if (field.label.includes("里衬")) return pick(["无内衬"])
  if (field.label.includes("透明")) return pick([
    /不透明|非透明/.test(text) ? "否" : "",
    /半透|透明|透视/.test(text) ? "半透" : "",
    /半透|透明|透视/.test(text) ? "是" : "",
  ])
  if (field.label.includes("加绒")) return pick([
    /不加绒|无绒|薄款|超薄/.test(text) ? "否" : "",
    text.includes("加绒") ? "是" : "",
  ])
  if (field.label.includes("撞色")) return pick([
    /无撞色|不撞色|非撞色|纯色|同色|净色/.test(text) ? "否" : "",
    /撞色|拼色|色块|对比色/.test(text) ? "是" : "",
  ])
  if (field.label.includes("年龄")) return pick(sheinAgeNeedlesForReadiness(row))
  if (field.label.includes("合身")) return pick([
    text.includes("超宽松") ? "超宽松" : "",
    text.includes("宽松") ? "宽松" : "",
    text.includes("修身") ? "修身" : "",
    text.includes("合体") ? "合体" : "",
    "合体",
    "常规",
  ])
  if (field.label.includes("口袋")) return pick([text.includes("口袋") ? "是" : "否"])
  if (field.label.includes("所在地")) return pick(["ALL/全球/所有", "All"])
  if (field.label.includes("关税")) {
    return pick(tariffValueCandidatesForContext(text, field.options ?? []))
  }
  return optionValues.length === 1 ? optionValues[0] : ""
}

function aiImageUrlForSkc(skc: SourceRow) {
  return normalizeText(skc.image_url)
    || normalizeText(skc.tmall_color_image_url)
    || normalizeText(skc.tmall_color_url)
    || normalizeText(skc.pic_url)
}

function aiKnownFieldFacts(row: ReadinessRow, options: { includeNeedsAi?: boolean } = {}) {
  const facts: string[] = []
  for (const group of row.field_groups) {
    for (const field of group.fields) {
      const label = normalizeText(field.label)
      if (!label) continue
      const value = normalizeText(field.value)
      if (value) {
        facts.push(`${label}: ${value}`)
        continue
      }
      if (options.includeNeedsAi && (field.status === "NEEDS_AI" || field.status === "MISSING")) {
        facts.push(`${label}: 待判断`)
      }
    }
  }
  return compactText(uniqueStrings(facts).join("；"), 2400)
}

function aiAttributeGuidance(field: FillField) {
  const id = Number(field.attribute_id)
  const label = normalizeText(field.label)
  if (id === 40 || label.includes("合身")) return "结合商品图轮廓和文案版型词判断宽松/修身/合体等；证据不清选保守常规/合体。"
  if (id === 154 || label === "年龄") return "优先依据 MDM 年龄段、SHEIN 尺码段、主尺码段、订货尺码段判断，不主要依赖图片。"
  if (id === 1000438 || label.includes("口袋")) return "结合商品图判断是否有真实口袋；装饰线、假袋口按枚举选择假口袋或否。"
  if (id === 1001518 || label.includes("版型")) return "结合商品图廓形、领肩腰线和标题文案判断；只在当前枚举中选择最贴近款式。"
  if (id === 39 || label.includes("面料弹性")) return "主要依据深绘/MDM 文案里的弹力指数、高弹/中弹/低弹/无弹描述；图片只作辅助。"
  if (id === 207 || label.includes("透明")) return "结合图片和文案判断透明/半透/不透明；灯光导致的透光不等于透明材质。"
  if (id === 1000437 || label.includes("加绒")) return "主要依据标题、卖点、厚薄、内里图判断是否加绒；外观不清时保守。"
  if (id === 1000070 || label.includes("撞色")) return "依据图片判断深浅撞色、拼色、明显对比色块；印花或多色图案不一定是撞色。"
  if (id === 66 || label.includes("领型")) return "依据上衣图片判断圆领、翻领、V领等领型；看不清时选最通用枚举。"
  if (id === 106 || label.includes("鞋尖")) return "依据鞋图判断包头/露趾等鞋尖形态。"
  if (id === 113 || label.includes("腰线")) return "依据裤裙腰部位置、标题和模特图判断高腰/中腰/低腰。"
  if (id === 1000595 || label.includes("鞋靴款式")) return "依据鞋图判断低帮、过踝、靴筒高度等款式。"
  if (id === 1001899 || label.includes("脚背")) return "依据鞋面覆盖程度判断露脚背/不露脚背。"
  if (id === 1001907 || label.includes("无缝")) return "依据袜/内衣文案和图片判断是否无缝；没有明确证据时保守。"
  if (id === 1002315 || label.includes("袖孔") || label.includes("带袖")) return "依据服装图片判断是否带袖或袖孔。"
  if (id === 1001236 || label.includes("厚薄")) return "主要依据标题、面料、季节、加绒、厚薄字段判断常规/超薄/加厚等。"
  if (id === 77 || label.includes("季节")) return "依据袖长、厚薄、面料、加绒、标题季节词判断适用季节；运营主观性强时降低置信。"
  if (id === 128 || label.includes("场合")) return "依据标题、图案和商品用途判断圣诞、万圣节、外出、沙滩等场合。"
  if (id === 1000627 || label.includes("细化图案")) return "依据图片和颜色/图案文案判断动物、条纹、格纹、花朵等细化图案。"
  if (id === 1001197 || label.includes("图案款")) return "依据图片和标题判断是否为图案款；纯色、普通拼色不算图案款。"
  if (id === 1000410 || label.includes("工艺")) return "依据图片和文案判断刺绣、扎染、印花、钉珠等工艺；不可见则保守。"
  if (id === 109 || label === "类型") return "结合当前 SHEIN 类目、标题和图片判断类型字段含义，只在枚举中选择最贴近项。"
  if (id === 1001159 || label.includes("款式特征")) return "依据图片和文案判断胸杯款、特殊结构或无等款式特征。"
  if (id === 1000600 || label.includes("睡衣类型")) return "依据标题、类目和文案判断紧身/阻燃/其它；阻燃必须有文字证据。"
  if (id === 1002212 || label.includes("穿戴类型")) return "依据类目、标题和图片判断装扮套装或基础服装。"
  if (id === 1001515 || label.includes("拉绳")) return "依据图片判断是否附带可见拉绳。"
  if (id === 9 || label.includes("腰带")) return "依据图片判断是否含腰带或腰部系带。"
  if (id === 1002281 || label.includes("有色镜片")) return "依据眼镜图片判断镜片是否有色。"
  if (label.includes("性别")) return "优先依据 SHEIN 类目路径和 MDM 性别描述判断男童/女童/中性。"
  if (label.includes("袖长")) return "依据图片和标题判断长袖、短袖、无袖、七分袖等。"
  if (id === 58 || label.includes("里衬")) return "依据图片和文案判断是否有内衬；关务条件触发时更保守。"
  if (id === 160 || label.includes("材质")) return "依据 MDM/深绘面料和成分来源判断材质枚举；不要编造成分比例。"
  if (id === 1000062 || label.includes("织造方式")) return "依据 MDM 面种、深绘文案和类目判断针织/梭织/毛织等。"
  return "结合当前类目、MDM/深绘文案和图片，在枚举中保守选择；无法判断时选择最通用项并降低置信。"
}

function aiPrompt(row: ReadinessRow) {
  const attributes = row.manual_fields.map((field) => ({
    field_key: field.key,
    field_label: field.label,
    options: (field.options ?? []).map((option) => option.attribute_value).slice(0, 80),
    guidance: aiAttributeGuidance(field),
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
      "只处理 attributes 中列出的字段；不要输出 attributes 中不存在的字段。",
      "如果字段无法可靠判断，选择最保守的通用值并降低 confidence。",
      "童装默认风格可偏休闲；是否类字段没有证据时默认否。",
      "成分、尺码、重量、销售属性、检测证书类字段不在本任务中，不要补充或猜测。",
    ],
    product: {
      spu_code: row.spu_code,
      spu_name: row.spu_name,
      title_cn: row.title_cn,
      title_en: row.title_en,
      category: row.category,
      mdm_age_group_name: row.mdm_age_group_name,
      mdm_main_size_group_name: row.mdm_main_size_group_name,
      mdm_order_size_group_name: row.mdm_order_size_group_name,
      mdm_spec_range: row.mdm_spec_range,
      known_field_facts: aiKnownFieldFacts(row),
      skcs: row.skcs.map((skc) => ({
        skc_code: skc.skc_code,
        color_name: skc.color_name,
        has_image: Boolean(aiImageUrlForSkc(skc)),
      })),
    },
    attributes,
  }, null, 2)
}

function buildSheinAttributeAiMessages(row: ReadinessRow, prompt: string) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }]
  for (const skc of row.skcs.slice(0, 8)) {
    const url = aiImageUrlForSkc(skc)
    const skcCode = normalizeText(skc.skc_code) || "UNKNOWN_SKC"
    const colorName = normalizeText(skc.color_name) || "未提供颜色名"
    if (!url) {
      content.push({
        type: "text",
        text: `SKC ${skcCode}｜颜色 ${colorName}｜没有可用款色图；视觉字段需保守判断。`,
      })
      continue
    }
    content.push({
      type: "text",
      text: `下图对应 SKC ${skcCode}｜颜色 ${colorName}。用于判断合身类型、版型、口袋、领型、腰线、鞋类形态、图案、工艺、撞色、透明等可视属性；图片证据不明确时选择保守通用枚举并降低置信。`,
    })
    content.push({
      type: "image_url",
      image_url: { url },
    })
  }
  return [
    {
      role: "system",
      content: "你是跨境童装 SHEIN 发品属性专家，负责在给定枚举里做保守选择。",
    },
    {
      role: "user",
      content,
    },
  ]
}

function deterministicAttributeFillsForAiEnrich(readiness: ReadinessRow) {
  const manualFieldKeys = new Set(readiness.manual_fields.map((field) => field.key))
  return readiness.field_groups
    .flatMap((group) => group.fields)
    .filter((field) => {
      if (!field.key.startsWith("attr:")) return false
      if (manualFieldKeys.has(field.key)) return false
      if (!isAiFillableAttributeField(field)) return false
      if (field.status !== "READY") return false
      if (!normalizeText(field.value)) return false
      const source = normalizeText(field.source)
      return source === "RULE" || source === "MDM"
    })
}

async function callAiFill(row: ReadinessRow) {
  const config = resolveAiConfig()
  const policy = resolveAiScenarioPolicy("shein_attribute")
  if (row.manual_fields.length === 0 || policy.mode === "disabled") return []
  if (policy.mode !== "guarded" && !config.apiKey) return []
  const prompt = aiPrompt(row)
  const messages = buildSheinAttributeAiMessages(row, prompt)
  const allowedValues = new Map(row.manual_fields.map((field) => [
    field.key,
    new Set((field.options ?? []).map((option) => option.attribute_value)),
  ]))
  const response = await getDefaultAiScenarioRouter({ db: getDb() }).callJson(
    withAiRoutingHashes({
      scenario: "shein_attribute",
      promptVersion: "shein-enum-attribute-v1",
      messages,
      validate: (json: { fills?: unknown }) => (
        Array.isArray(json?.fills)
        && json.fills.every((fill) => {
          if (!fill || typeof fill !== "object") return false
          const value = fill as Record<string, unknown>
          const fieldKey = normalizeText(value.field_key)
          const fieldValue = normalizeText(value.field_value)
          const options = allowedValues.get(fieldKey)
          return Boolean(options && fieldValue && options.has(fieldValue))
        })
      ),
      auditValue: (json: { fills?: unknown }) => ({
        fills: Array.isArray(json?.fills)
          ? json.fills.map((fill) => {
            const value = fill && typeof fill === "object"
              ? fill as Record<string, unknown>
              : {}
            return {
              field_key: normalizeText(value.field_key),
              field_value: normalizeText(value.field_value),
              confidence: Number(value.confidence),
            }
          })
          : [],
      }),
    }, {
      input: {
        spu_code: row.spu_code,
        spu_name: row.spu_name,
        title_cn: row.title_cn,
        title_en: row.title_en,
        category: row.category,
        mdm_age_group_name: row.mdm_age_group_name,
        mdm_spec_range: row.mdm_spec_range,
        skcs: row.skcs.map((skc) => ({
          skc_code: skc.skc_code,
          color_name: skc.color_name,
          has_image: Boolean(aiImageUrlForSkc(skc)),
        })),
      },
      candidates: row.manual_fields.map((field) => ({
        field_key: field.key,
        options: (field.options ?? []).map((option) => option.attribute_value),
      })),
    }),
  )
  const json = response.json as { fills?: unknown }
  return Array.isArray(json.fills) ? json.fills : []
}

function aiErrorText(error: unknown) {
  const parts: string[] = []
  const seen = new Set<unknown>()
  const visit = (value: unknown, depth = 0) => {
    if (value == null || depth > 3 || seen.has(value)) return
    seen.add(value)
    if (typeof value === "string") {
      parts.push(value)
      return
    }
    if (!(value instanceof Error) && typeof value !== "object") {
      parts.push(String(value))
      return
    }
    const record = value as Record<string, unknown>
    for (const key of ["name", "message", "code"]) {
      if (record[key] != null) parts.push(String(record[key]))
    }
    visit(record.cause, depth + 1)
    if (Array.isArray(record.errors)) {
      for (const nested of record.errors.slice(0, 4)) visit(nested, depth + 1)
    }
  }
  visit(error)
  return normalizeText(parts.join(" "))
}

function aiFillWarningMessage(error: unknown) {
  const message = aiErrorText(error)
  if (!message) return "AI 服务暂不可用"
  if (
    /internal server error|no admitted ai model succeeded|ai request failed|fetch failed|abort|timeout|timed out|etimedout|econnreset|und_err_socket|gateway|quota|rate limit|429|5\d\d|401|403/i
      .test(message)
  ) {
    return "AI 服务暂不可用，请检查网关/模型配置后重试"
  }
  return message
}

async function generateSingleAiField(readiness: ReadinessRow, fieldKey: string) {
  const field = readiness.field_groups
    .flatMap((group) => group.fields)
    .find((item) => item.key === fieldKey)
  if (!field) {
    throw new HTTPException(404, { message: "字段不存在" })
  }
  if (field.key !== "title_en" && field.key !== "product_description" && !isAiFillableAttributeField(field)) {
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

  if (field.key === "product_description") {
    const fieldValue = await safeAiGenerateProductDescription(readiness)
    return {
      field,
      fieldValue: normalizeFillFieldValue(field.key, field.label, fieldValue),
      source: "AI_DESCRIPTION",
      confidence: 0.74,
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
  const fieldValue = safeAutomaticAttributeFillValue(field, readiness, aiFill)
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

function buildCompositionAttributeItems(field: FillField, compositionSource: unknown) {
  return buildCompositionPayloadItems({
    attributeId: field.attribute_id,
    compositionSource,
    options: field.options ?? [],
    fallbackValue: field.value,
  })
}

function buildDependentAttributeItems(db: ReturnType<typeof getDb>, listing: ListingRow, currentItems: Array<Record<string, unknown>>) {
  const hasTariffSweatshirt = currentItems.some((item) =>
    Number(item.attribute_id) === TARIFF_ATTRIBUTE_ID && Number(item.attribute_value_id) === 1002272,
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

function tariffFieldValuesForListing(field: FillField, listing: ListingRow) {
  const currentValues = coerceFieldValues(field, field.value)
  const context = [
    listing.platform_category_name,
    listing.platform_category_path,
    listing.title,
    listing.spu_name,
    listing.middle_class_name,
    listing.subclass_name,
  ].map(normalizeText).join(" ")
  const candidates = tariffValueCandidatesForContext(context, field.options ?? [])
  if (candidates.length === 1 && candidates[0] === UNSPECIFIED_TARIFF_VALUE) return currentValues
  const currentSpecificValues = currentValues.filter((value) =>
    value !== UNSPECIFIED_TARIFF_VALUE && candidates.includes(value),
  )
  if (currentSpecificValues.length > 0) return currentSpecificValues
  const inferred = findEnumValue((field.options ?? []) as AttributeValue[], candidates)
  return inferred ? [inferred.attribute_value] : currentValues
}

function buildProductAttributeList(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const fields = requiredFillFields(db, listing)
  const compositionSource = fields.find((field) => field.key === "composition_text")?.value
  const tariffField = fields.find((field) => field.attribute_id === TARIFF_ATTRIBUTE_ID)
  const publishTariffValues = tariffField ? tariffFieldValuesForListing(tariffField, listing) : []
  const includeDeprecatedTariffMaterial = publishTariffValues.includes(UNSPECIFIED_TARIFF_VALUE)
  const output: Array<Record<string, unknown>> = []
  for (const field of fields) {
    if (!field.key.startsWith("attr:")) continue
    if (field.attribute_type !== 3 && field.attribute_type !== 4) continue
    if (field.attribute_id === DEPRECATED_TARIFF_MATERIAL_ATTRIBUTE_ID && !includeDeprecatedTariffMaterial) continue
    if (field.label.includes("成分")) {
      output.push(...buildCompositionAttributeItems(field, compositionSource))
      continue
    }
    const values = field.attribute_id === TARIFF_ATTRIBUTE_ID
      ? tariffFieldValuesForListing(field, listing)
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

function imageUrlHost(value: unknown) {
  const text = normalizeText(value)
  if (!text) return ""
  try {
    return new URL(text).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function isKnownSourceImageUrl(value: unknown) {
  const host = imageUrlHost(value)
  return host === "product.resources.deepdraw.biz" || host.endsWith(".deepdraw.biz")
}

function publishPayloadImageUrls(payload: unknown) {
  const object = parseJsonObject(payload)
  return parseJsonList(object.skc_list).flatMap((skcPayload) => {
    const skc = parseJsonObject(skcPayload)
    const imageInfo = parseJsonObject(skc.image_info)
    return parseJsonList(imageInfo.image_info_list)
      .map((imagePayload) => normalizeText(parseJsonObject(imagePayload).image_url))
      .filter(Boolean)
  })
}

function assertPublishPayloadHasOnlyPreparedImages(payload: unknown) {
  const leaked = uniqueStrings(publishPayloadImageUrls(payload).filter(isKnownSourceImageUrl))
  if (leaked.length === 0) return
  throw new Error(`图片尚未转换为 SHEIN 可用 URL：${leaked.join("；")}`)
}

function ensureSkcSourceImageAssetsForPublish(db: ReturnType<typeof getDb>, listingId: number) {
  const sourceSkcs = db.prepare(`
    select id, skc_code, image_url, image_confirmed
    from listing_skc
    where listing_id = ?
      and selected_for_publish = 1
      and coalesce(image_url, '') <> ''
    order by skc_code
  `).all(listingId) as SourceRow[]
  if (sourceSkcs.length === 0) return

  const sourceAssets = db.prepare(`
    select id, listing_skc_id, source_type, asset_type, source_url, raw_payload_json
    from listing_asset
    where listing_id = ?
      and asset_type in ('MAIN', 'COLOR_BLOCK')
      and (
        coalesce(platform_url, '') <> ''
        or coalesce(source_url, '') <> ''
        or coalesce(local_path, '') <> ''
      )
    order by listing_skc_id, asset_type, id
  `).all(listingId) as SourceRow[]
  const existingSourceBySkcIdAndType = new Map<string, SourceRow>()
  for (const asset of sourceAssets) {
    if (isAutoFallbackColorAsset(asset)) continue
    const skcId = normalizeText(asset.listing_skc_id)
    const assetType = normalizeText(asset.asset_type).toUpperCase()
    const key = `${skcId}:${assetType}`
    if (skcId && assetType && !existingSourceBySkcIdAndType.has(key)) {
      existingSourceBySkcIdAndType.set(key, asset)
    }
  }

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
      transform_status,
      updated_at
    )
    values (?, ?, ?, 'SKC_SOURCE_IMAGE', ?, 1, ?, 'PENDING_CONFIRM', ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `)
  const update = db.prepare(`
    update listing_asset
    set source_url = ?,
      platform_url = null,
      status = 'PENDING_CONFIRM',
      confirmed = ?,
      note = ?,
      raw_payload_json = ?,
      transform_status = 'PENDING',
      transform_error = null,
      transformed_at = null,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `)
  const refresh = db.prepare(`
    update listing_asset
    set confirmed = ?,
      note = ?,
      raw_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `)

  for (const skc of sourceSkcs) {
    const sourceUrl = normalizeText(skc.image_url)
    if (!sourceUrl) continue
    const confirmed = Number(skc.image_confirmed ?? 0) === 1
    const skcId = normalizeText(skc.id)
    for (const target of [
      { assetType: "MAIN", sheinImageType: 1, note: "SKC 来源图自动转 SHEIN URL：SKC 主图" },
      { assetType: "COLOR_BLOCK", sheinImageType: 6, note: "SKC 来源图自动转 SHEIN URL：SKC 色块图" },
    ]) {
      const existing = existingSourceBySkcIdAndType.get(`${skcId}:${target.assetType}`)
      const payload = JSON.stringify({
        source: "listing_skc.image_url",
        skc_code: normalizeText(skc.skc_code),
        prepared_for_publish: true,
        shein_image_type: target.sheinImageType,
      })
      if (existing) {
        if (normalizeText(existing.source_type) === "SKC_SOURCE_IMAGE") {
          if (normalizeText(existing.source_url) === sourceUrl) {
            refresh.run(confirmed ? 1 : 0, target.note, payload, existing.id)
          } else {
            update.run(sourceUrl, confirmed ? 1 : 0, target.note, payload, existing.id)
          }
        }
        continue
      }
      insert.run(listingId, skc.id, skc.skc_code, target.assetType, sourceUrl, confirmed ? 1 : 0, target.note, payload)
    }
  }
}

function preparedAssetImageType(asset: SourceRow) {
  if (assetPreparedForImageType(asset, 6)) return 6
  if (assetPreparedForImageType(asset, 5)) return 5
  const assetType = normalizeText(asset.asset_type)
  return sheinImageType(assetType)
}

function targetImageTypeForAsset(asset: SourceRow) {
  const explicit = asNumber(parseJsonObject(asset.raw_payload_json).shein_image_type)
  if (explicit) return explicit
  return sheinImageType(asset.asset_type)
}

function shouldPrepareListingAsset(asset: SourceRow) {
  if (!normalizeText(asset.platform_url)) return true
  return targetImageTypeForAsset(asset) !== preparedAssetImageType(asset)
}

function nextImagePrepareInput(asset: SourceRow) {
  const targetType = targetImageTypeForAsset(asset)
  const existingType = preparedAssetImageType(asset)
  if (targetType === existingType && normalizeText(asset.platform_url)) {
    return null
  }
  return {
    imageType: targetType,
  }
}

async function prepareListingImagesForPublish(db: ReturnType<typeof getDb>, listingId: number) {
  const credentials = resolveSheinCredentials(db)
  ensureSkcSourceImageAssetsForPublish(db, listingId)
  const assets = db.prepare(`
    select *
    from listing_asset
    where listing_id = ?
      and not (coalesce(source_type, '') = 'SOURCE_FALLBACK' and asset_type in ('COLOR_BLOCK', 'COLOR'))
      and (
        coalesce(platform_url, '') <> ''
        or coalesce(source_url, '') <> ''
        or coalesce(local_path, '') <> ''
      )
    order by skc_code, image_sort, id
  `).all(listingId).filter(shouldPrepareListingAsset) as SourceRow[]
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
    const prepareInput = nextImagePrepareInput(asset)
    if (!prepareInput) continue
    const imageType = prepareInput.imageType
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
        prepared = imageType === 5
          ? await uploadRemoteSquareImageToShein(sourceUrl, credentials)
          : await transformOnlineImageToShein(sourceUrl, imageType, credentials)
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
          shein_image_type: imageType,
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

function selectedImageInfo(
  skc: SourceRow,
  assets: SourceRow[],
  options: { allowSourceImages?: boolean; allowLocalImages?: boolean; allowSkcImageUrl?: boolean } = {},
) {
  const allowSourceImages = Boolean(options.allowSourceImages)
  const allowLocalImages = Boolean(options.allowLocalImages)
  const publishableAssets = realImageAssets(assets).filter((asset) =>
    normalizeText(asset.platform_url)
    || (allowSourceImages && normalizeText(asset.source_url))
    || (allowLocalImages && normalizeText(asset.local_path)),
  )
  return buildSheinImageInfo({
    skcCode: skc.skc_code,
    skcImageUrl: options.allowSkcImageUrl === false ? "" : skc.image_url,
    allowSourceImages,
    allowLocalImages,
    assets: publishableAssets,
  })
}

function assetCanPrepareForPublish(
  asset: SourceRow,
  options: { allowSourceImages?: boolean; allowLocalImages?: boolean },
) {
  return Boolean(
    normalizeText(asset.platform_url)
    || (options.allowSourceImages && normalizeText(asset.source_url))
    || (options.allowLocalImages && normalizeText(asset.local_path)),
  )
}

function skcHasPendingPublishImage(
  skc: SourceRow,
  skcAssets: SourceRow[],
  options: { allowSourceImages?: boolean; allowLocalImages?: boolean },
) {
  return Boolean(
    normalizeText(skc.image_url)
    || skcAssets.some((asset) => assetCanPrepareForPublish(asset, options)),
  )
}

function skcHasPendingMainImage(
  skc: SourceRow,
  skcAssets: SourceRow[],
  options: { allowSourceImages?: boolean; allowLocalImages?: boolean },
) {
  return Boolean(
    normalizeText(skc.image_url)
    || skcAssets.some((asset) => normalizeText(asset.asset_type) === "MAIN" && assetCanPrepareForPublish(asset, options)),
  )
}

function skcHasRequirementImage({
  requirement,
  imageInfo,
  skcAssets,
  options,
}: {
  requirement: PictureRequirement
  imageInfo: SheinImageInfo
  skcAssets: SourceRow[]
  options: { allowSourceImages?: boolean; allowLocalImages?: boolean; requirePreparedImages?: boolean }
}) {
  const images = Array.isArray(imageInfo.image_info_list) ? imageInfo.image_info_list : []
  if (requirement.requirement_key === "SKC_DETAIL" && images.some((image) => [1, 2].includes(Number(image.image_type)))) return true
  if (requirement.requirement_key === "SKC_SQUARE" && images.some((image) => Number(image.image_type) === 5)) return true
  if (requirement.requirement_key === "SKC_COLOR_BLOCK" && images.some((image) => Number(image.image_type) === 6)) return true
  if (options.requirePreparedImages ?? true) return false
  return skcAssets.some((asset) =>
    assetMatchesRequirement(asset, requirement)
    && assetCanPrepareForPublish(asset, options),
  )
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

function readinessFieldSource(readiness: ReadinessRow, fieldKey: string) {
  for (const group of readiness.field_groups) {
    const field = group.fields.find((item) => item.key === fieldKey)
    if (field) return normalizeText(field.source)
  }
  return ""
}

function hasStoredReadinessField(readiness: ReadinessRow, fieldKey: string) {
  const source = readinessFieldSource(readiness, fieldKey)
  return Boolean(source && source !== "AI/人工" && source !== "LISTING_TITLE")
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

function getManualSizeChart(db: ReturnType<typeof getDb>, listing: ListingRow) {
  const fill = db.prepare(`
    select *
    from listing_field_fill
    where spu_code = ?
      and field_key = ?
      and status = 'ACTIVE'
    order by updated_at desc
    limit 1
  `).get(listing.spu_code, MANUAL_SIZE_CHART_FIELD_KEY) as SourceRow | undefined
  if (!fill) return { source: null, updated_at: null, rows: [] }
  const payload = parseJsonObject(fill.payload_json)
  const rows = parseJsonArray(payload.rows).length > 0
    ? parseJsonArray(payload.rows)
    : parseJsonArray(fill.field_value)
  return {
    source: normalizeText(fill.source) || "MANUAL_SIZE_CHART",
    updated_at: fill.updated_at ?? null,
    rows,
  }
}

function listingSkusForManualSizeChart(db: ReturnType<typeof getDb>, listingId: number) {
  return db.prepare(`
    select
      sku.*,
      skc.skc_code,
      skc.color_name,
      skc.image_url as skc_image_url
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    where skc.listing_id = ?
    order by skc.skc_code, sku.size_name, sku.sku_code
  `).all(listingId) as SourceRow[]
}

function normalizeManualSizeChartRows({
  db,
  listing,
  rows,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  rows: ManualSizeChartInputRow[]
}) {
  const skus = listingSkusForManualSizeChart(db, listing.id)
  const byId = new Map(skus.map((sku) => [Number(sku.id), sku]))
  const byCode = new Map(skus.map((sku) => [normalizeText(sku.sku_code), sku]))
  const attrs = getSizeChartAttributes(db, listing.product_type_id)
  const output: Array<Record<string, unknown>> = []
  const seen = new Set<number>()

  for (const row of rows) {
    const sku = byId.get(Number(row.sku_id)) ?? byCode.get(normalizeText(row.sku_code))
    if (!sku) continue
    const skuId = Number(sku.id)
    if (!Number.isFinite(skuId) || seen.has(skuId)) continue
    const values = parseJsonObject(row.values)
    const normalizedValues: Record<string, string> = {}
    for (const attr of attrs) {
      const attrId = normalizeText(attr.attribute_id)
      const attrName = normalizeText(attr.attribute_name)
      const attrNameEn = normalizeText(attr.attribute_name_en)
      const value = normalizeText(
        values[attrId]
        ?? values[attrName]
        ?? (attrNameEn ? values[attrNameEn] : undefined),
      )
      if (value) normalizedValues[attrId] = value
    }
    if (Object.keys(normalizedValues).length === 0) continue
    const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
    output.push({
      sku_id: skuId,
      sku_code: normalizeText(sku.sku_code),
      size_name: normalizeText(sku.size_name) || null,
      shein_size_value: normalizeText(row.shein_size_value) || normalizeText(sku.shein_size_value) || normalizeText(sku.size_name) || null,
      relate_sale_attribute_value_id: asPositiveNumber(row.relate_sale_attribute_value_id)
        ?? asPositiveNumber(sizePayload.attribute_value_id)
        ?? null,
      values: normalizedValues,
    })
    seen.add(skuId)
  }
  return output
}

function persistManualSizeChart({
  db,
  listing,
  rows,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  rows: ManualSizeChartInputRow[]
}) {
  const normalizedRows = normalizeManualSizeChartRows({ db, listing, rows })
  const scopeKey = buildScopeKey({ spuCode: listing.spu_code, fieldKey: MANUAL_SIZE_CHART_FIELD_KEY })
  if (normalizedRows.length === 0) {
    db.prepare(`
      update listing_field_fill
      set status = 'INACTIVE',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where scope_key = ?
    `).run(scopeKey)
    return normalizedRows
  }

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
    values (?, ?, null, null, ?, ?, ?, 'MANUAL_SIZE_CHART', 1, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
    MANUAL_SIZE_CHART_FIELD_KEY,
    "SHEIN 类目尺码表",
    JSON.stringify(normalizedRows),
    JSON.stringify({
      rows: normalizedRows,
      product_type_id: listing.product_type_id,
      saved_from: "draft_manual_size_chart",
    }),
  )
  return normalizedRows
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

function buildManualSizeChartAttributeList({
  db,
  listing,
  skus,
  sizeAttrId,
  sizeChartAttrs,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  skus: SourceRow[]
  sizeAttrId: number | null
  sizeChartAttrs: SourceRow[]
}) {
  if (!sizeAttrId || sizeChartAttrs.length === 0) return []
  const manualRows = getManualSizeChart(db, listing).rows as SourceRow[]
  if (manualRows.length === 0) return []
  const bySkuId = new Map(manualRows.map((row) => [Number(row.sku_id), row]))
  const bySkuCode = new Map(manualRows.map((row) => [normalizeText(row.sku_code), row]))
  const output: Array<Record<string, unknown>> = []

  for (const sku of skus) {
    const row = bySkuId.get(Number(sku.id)) ?? bySkuCode.get(normalizeText(sku.sku_code))
    if (!row) continue
    const values = parseJsonObject(row.values)
    const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
    const sizeValueId = asPositiveNumber(row.relate_sale_attribute_value_id) ?? asPositiveNumber(sizePayload.attribute_value_id)
    if (!sizeValueId) continue
    for (const attr of sizeChartAttrs) {
      const attrId = normalizeText(attr.attribute_id)
      const value = asPositiveNumber(values[attrId] ?? values[normalizeText(attr.attribute_name)])
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
  const manualSizeChartAttrs = buildManualSizeChartAttributeList({
    db,
    listing: listing as ListingRow,
    skus,
    sizeAttrId,
    sizeChartAttrs,
  })
  if (manualSizeChartAttrs.length > 0) return manualSizeChartAttrs
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
  allowLocalImages?: boolean
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
  const colorAttr = findColorSaleAttribute(attrs)
  const sizeAttr = findSizeSaleAttribute(attrs)
  const assets = realImageAssets(detail.assets as SourceRow[])
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
  const requirePreparedImages = options?.requirePreparedImages ?? true
  const selectedSkcCount = skcs.length
  const skcImageRequirements = getImageRequirements(db, listing)
    .filter((requirement) => requirement.level === "SKC" && requirement.show !== 0)
  const attributeFields = readiness.field_groups.find((group) => group.group === "商品属性")?.fields ?? []
  errors.push(...blockingAttributeMessages(attributeFields))

  if (isSheinOpenApiUnsupportedSuitCategory(listing.platform_category_name, listing.platform_category_path)) {
    errors.push(sheinOpenApiSuitCategoryMessage(listing.platform_category_name))
  }
  if (!listing.platform_category_id || !listing.product_type_id) errors.push("缺 SHEIN 类目")
  const categoryMetadataState = categoryPairMetadataState(
    db,
    asPositiveNumber(listing.platform_category_id),
    asPositiveNumber(listing.product_type_id),
  )
  const categoryPair = categoryPairState({
    categoryId: listing.platform_category_id,
    productTypeId: listing.product_type_id,
    metadataMatch: Boolean(categoryMetadataState.metadata),
    metadataKnown: categoryMetadataState.known,
  })
  if (listing.platform_category_id && listing.product_type_id && categoryPair.error) {
    errors.push(categoryPair.error)
  }
  if (listing.platform_category_id && listing.product_type_id && categoryPair.status === "WARNING") {
    warnings.push(unverifiedCategoryPairMessage(
      asPositiveNumber(listing.platform_category_id),
      asPositiveNumber(listing.product_type_id),
    ))
  }
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
    const skcAssets = selectedAssetBySkc.get(normalizeText(skc.skc_code)) ?? []
    const imagesConfirmed = Number(skc.image_confirmed ?? 0) === 1
      && skcAssets.every((asset) => Number(asset.confirmed ?? 0) === 1)
    if (!imagesConfirmed) errors.push(`${skc.skc_code} 图片未确认`)
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
    const imageInfo = selectedImageInfo(skc, assets, {
      allowSourceImages: Boolean(options?.allowSourceImages),
      allowLocalImages: Boolean(options?.allowLocalImages),
      allowSkcImageUrl: !requirePreparedImages,
    })
    const mainImageError = sheinMainImageError(skc.skc_code, imageInfo)
    if (mainImageError && (requirePreparedImages || !skcHasPendingMainImage(skc, skcAssets, options ?? {}))) {
      errors.push(mainImageError)
    }
    for (const requirement of skcImageRequirements) {
      const required = requirement.required === 1
        || (requirement.requirement_key === "SKC_COLOR_BLOCK" && selectedSkcCount > 1)
      if (!required) continue
      if (!skcHasRequirementImage({ requirement, imageInfo, skcAssets, options: { ...options, requirePreparedImages } })) {
        errors.push(`${skc.skc_code} 缺 ${requirement.name}`)
      }
    }
    return {
      supplier_code: normalizeText(skc.supplier_code) || normalizeText(skc.skc_code),
      ...(fieldShown(publishFields, "skc_title", true)
        ? { skc_title: normalizeText(listing.title) || normalizeText(skc.skc_title) || normalizeText(listing.spu_code) }
        : {}),
      sale_attribute: saleAttribute,
      image_info: imageInfo,
      sku_list: skuList,
      shelf_way: "1",
      ...(fieldShown(publishFields, "shelf_require") ? { shelf_require: "0" } : {}),
      ...(suggestedRetailPrice ? { suggested_retail_price: suggestedRetailPrice } : {}),
    }
  })

  for (const [index, skc] of skcList.entries()) {
    const imageCount = Array.isArray(skc.image_info.image_info_list) ? skc.image_info.image_info_list.length : 0
    const sourceSkc = skcs[index]
    const sourceAssets = sourceSkc ? selectedAssetBySkc.get(normalizeText(sourceSkc.skc_code)) ?? [] : []
    if (imageCount === 0) {
      if (requirePreparedImages || !sourceSkc || !skcHasPendingPublishImage(sourceSkc, sourceAssets, options ?? {})) {
        errors.push(`${skc.supplier_code} 缺 SHEIN 可用图片 URL`)
      } else {
        warnings.push(`${skc.supplier_code} 图片将在提交前转换为 SHEIN 可用 URL`)
      }
    }
  }
  for (const skc of skcs) {
    const skcCode = normalizeText(skc.skc_code)
    const skcAssets = selectedAssetBySkc.get(skcCode) ?? []
    const hasPlatformUrl = skcAssets.some((asset) => normalizeText(asset.platform_url))
    const failedAsset = skcAssets.find((asset) => normalizeText(asset.transform_status) === "FAILED" || normalizeText(asset.status) === "FAILED")
    if (requirePreparedImages && !hasPlatformUrl) errors.push(`${skc.skc_code} 图片未转换为 SHEIN 可用 URL`)
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
      manual_override: true,
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

function priceConfirmedForSkuCommercial(item: { costPrice: number | null }) {
  return item.costPrice != null && item.costPrice > 0 ? 1 : 0
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
        when ? = 1 then 1
        else price_confirmed
      end,
      price_confirmed_at = case
        when ? = 1 and price_confirmed_at is null then strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        else price_confirmed_at
      end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_skc_id in (
        select id from listing_skc where listing_id = ?
      )
  `)
  for (const item of valid) {
    const priceConfirmed = priceConfirmedForSkuCommercial(item)
    stmt.run(
      item.costPrice,
      item.currency,
      item.length,
      item.width,
      item.height,
      priceConfirmed,
      priceConfirmed,
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

  const listing = db.prepare(`
    select platform_category_id, product_type_id
    from listing
    where id = ?
  `).get(listingId) as SourceRow | undefined
  const categoryId = asPositiveNumber(listing?.platform_category_id)
  const productTypeId = asPositiveNumber(listing?.product_type_id)
  const attrs = getRequiredAttributes(db, categoryId, productTypeId)
  const colorAttr = findColorSaleAttribute(attrs)
  if (!colorAttr) {
    throw new HTTPException(400, { message: "当前类目缺颜色销售属性元数据，无法保存颜色枚举" })
  }

  const stmt = db.prepare(`
    update listing_skc
    set color_attribute_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_id = ?
  `)
  for (const item of valid) {
    const current = db.prepare("select color_name, color_attribute_payload_json from listing_skc where id = ? and listing_id = ?").get(item.id, listingId) as SourceRow | undefined
    if (!current) continue
    const existingPayload = parseJsonObject(current.color_attribute_payload_json)
    const hasExplicitColorSelection = item.attributeValueId != null || Boolean(item.attributeValue)
    const colorOption = findEnumOption(colorAttr.values, [String(item.attributeValueId), item.attributeValue])
      ?? findEnumOption(colorAttr.values, saleColorNeedles(item.attributeValue || item.customValue || normalizeText(current?.color_name)))
    if (hasExplicitColorSelection && colorAttr.values.length > 0 && !colorOption) {
      throw new HTTPException(400, { message: `${normalizeText(current.color_name) || item.id} 颜色枚举不属于当前类目` })
    }
    if (colorAttr.values.length > 0 && !colorOption && !existingSalePayloadIsValid(existingPayload, colorAttr)) {
      throw new HTTPException(400, { message: `${normalizeText(current.color_name) || item.id} 颜色枚举不属于当前类目` })
    }
    const selectedPayload = colorOption || !existingSalePayloadIsValid(existingPayload, colorAttr)
      ? saleAttributePayload(colorAttr, colorOption, item.customValue || item.attributeValue || normalizeText(current?.color_name))
      : existingPayload
    const payload = {
      ...selectedPayload,
      color_name: normalizeText(current?.color_name),
    }
    stmt.run(JSON.stringify(payload), item.id, listingId)
  }
}

function persistDraftFields({
  db,
  listing,
  listingId,
  fields,
  savedFrom,
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  listingId: number
  fields: Array<{
    field_key?: unknown
    field_label?: unknown
    field_value?: unknown
    skc_code?: string | null
    sku_code?: string | null
    source?: unknown
    confidence?: number | null
  }>
  savedFrom: string
}) {
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
      JSON.stringify({ listing_id: listingId, saved_from: savedFrom }),
    )
  }
}

function applyDraftCategorySelection({
  db,
  listing,
  listingId,
  categoryId,
  productTypeId,
  source,
  confidence = 1,
  status = "READY",
  error = null,
  payload = {},
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  listingId: number
  categoryId: number | null
  productTypeId: number | null
  source: string
  confidence?: number | null
  status?: string | null
  error?: string | null
  payload?: Record<string, unknown>
}) {
  if (!categoryId && !productTypeId) return false
  if (!categoryId || !productTypeId) {
    throw new HTTPException(400, { message: "批量类目需要同时填写 Category ID 和 Product Type" })
  }
  const category = db.prepare(`
    select *
    from channel_category
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
      and coalesce(last_category, 0) = 1
    limit 1
  `).get(categoryId, productTypeId) as SourceRow | undefined
  if (!category) {
    throw new HTTPException(404, { message: `SHEIN 类目不存在：${categoryId}/${productTypeId}` })
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
    source,
    confidence,
    payload: {
      category_id: categoryId,
      product_type_id: productTypeId,
      category_name: category.category_name,
      path: category.path,
      source,
      status: normalizeText(status) || "READY",
      error: normalizeText(error) || null,
      ...payload,
    },
  })
  return true
}

function applyDraftCategoryDecision({
  db,
  listing,
  listingId,
  decision,
  selectedFrom,
  payload = {},
}: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  listingId: number
  decision: CategoryAutoSelectionDecision
  selectedFrom: string
  payload?: Record<string, unknown>
}) {
  const application = categoryApplicationFromDecision(decision)
  if (!application) return null
  applyDraftCategorySelection({
    db,
    listing,
    listingId,
    categoryId: application.category.categoryId,
    productTypeId: application.category.productTypeId,
    source: application.source,
    confidence: decision.confidence,
    status: application.status,
    error: application.error,
    payload: {
      selected_from: selectedFrom,
      decision_reason: decision.reason,
      review_required: application.reviewRequired,
      ...payload,
    },
  })
  return {
    field_key: "category",
    field_label: "SHEIN 类目",
    field_value: application.category.categoryName || String(application.category.categoryId),
    source: application.source,
    confidence: decision.confidence,
    review_required: application.reviewRequired,
  }
}

function resetListingSkcImageConfirmation(
  db: ReturnType<typeof getDb>,
  listingId: number,
  listingSkcId: unknown,
) {
  const skcId = Number(listingSkcId)
  if (!Number.isFinite(skcId) || skcId <= 0) return
  db.prepare(`
    update listing_skc
    set image_confirmed = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_id = ?
  `).run(skcId, listingId)
  db.prepare(`
    update listing_asset
    set confirmed = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where listing_id = ?
      and listing_skc_id = ?
  `).run(listingId, skcId)
}

function setListingSkcImageConfirmation({
  db,
  listingId,
  listingSkcId,
  confirmed,
  expectedAssetIds,
}: {
  db: ReturnType<typeof getDb>
  listingId: number
  listingSkcId: unknown
  confirmed: boolean
  expectedAssetIds?: unknown[]
}) {
  const skcId = Number(listingSkcId)
  lockListingImageMutation(db, listingId)
  const skc = Number.isFinite(skcId) && skcId > 0
    ? db.prepare("select id from listing_skc where id = ? and listing_id = ?").get(skcId, listingId) as SourceRow | undefined
    : undefined
  if (!skc) throw new HTTPException(404, { message: "草稿款色不存在" })

  if (confirmed) {
    if (!Array.isArray(expectedAssetIds)) {
      throw new HTTPException(400, { message: "确认图片前需要提交当前图片清单" })
    }
    const currentAssetIds = (db.prepare(`
      select id
      from listing_asset
      where listing_id = ?
        and listing_skc_id = ?
      order by id
    `).all(listingId, skcId) as SourceRow[]).map((row) => Number(row.id))
    const submittedAssetIds = Array.from(new Set(
      expectedAssetIds.map(Number).filter((id) => Number.isFinite(id) && id > 0),
    )).sort((a, b) => a - b)
    const assetsUnchanged = currentAssetIds.length === submittedAssetIds.length
      && currentAssetIds.every((id, index) => id === submittedAssetIds[index])
    if (!assetsUnchanged) {
      throw new HTTPException(409, { message: "图片列表已变化，请刷新后重新确认" })
    }
  }

  db.prepare(`
    update listing_skc
    set image_confirmed = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
      and listing_id = ?
  `).run(confirmed ? 1 : 0, skcId, listingId)
  db.prepare(`
    update listing_asset
    set confirmed = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where listing_id = ?
      and listing_skc_id = ?
  `).run(confirmed ? 1 : 0, listingId, skcId)
}

function buildBatchPublishCheckResponse(db: ReturnType<typeof getDb>, listingIds: number[]) {
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
          sku_sizes: [],
          sku_weights: [],
          sku_commercials: [],
          image_confirmations: [],
        },
      }
    }
    const preview = buildPublishPayload(db, listingId, { allowLocalImages: true, requirePreparedImages: false })
    const missingSizeSkuCodes = new Set(
      preview.errors
        .map((error) => normalizeText(error).match(/^(.+?) 缺 SHEIN 尺码枚举$/)?.[1])
        .filter(Boolean) as string[],
    )
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
    const sizeAttribute = findSizeSaleAttribute(detail.sale_attributes as RequiredAttribute[])
    const skuSizes = (detail.skus as SourceRow[])
      .filter((sku) => {
        const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
        return missingSizeSkuCodes.has(normalizeText(sku.sku_code))
          || (
            missingSizeSkuCodes.size > 0
            && Number(sku.selected_for_publish ?? 1) === 1
            && !asPositiveNumber(sizePayload.attribute_value_id)
          )
      })
      .map((sku) => {
        const sizePayload = parseJsonObject(sku.size_attribute_payload_json)
        return {
          sku_id: sku.id,
          sku_code: sku.sku_code,
          skc_code: sku.skc_code,
          size_name: sku.size_name,
          shein_size_value: sku.shein_size_value,
          attribute_value_id: asPositiveNumber(sizePayload.attribute_value_id),
          attribute_value: normalizeText(sizePayload.attribute_value) || normalizeText(sku.shein_size_value),
          selected_for_publish: Number(sku.selected_for_publish ?? 1) === 1,
          options: sizeAttribute?.values ?? [],
        }
      })
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
        asset_ids: (detail.assets as SourceRow[])
          .filter((asset) => Number(asset.listing_skc_id) === Number(skc.id))
          .map((asset) => Number(asset.id))
          .filter((id) => Number.isFinite(id) && id > 0),
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
        sku_sizes: skuSizes,
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

  return {
    ok: items.every((item) => item.ok),
    items,
    blocker_count: items.reduce((sum, item) => sum + item.errors.length, 0),
  }
}

prePublish.get("/platforms", (c) => {
  requirePermission(c, "LISTING_READ")
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

prePublish.get("/readiness", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(buildReadiness(c))
})

prePublish.get("/draft-categories", (c) => {
  requirePermission(c, "LISTING_READ")
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
  requirePermission(c, "LISTING_READ")
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
  requirePermission(c, "LISTING_READ")
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
      listing.id,
      listing.platform,
      listing.channel_account_id,
      listing.business_mode,
      listing.product_spu_id,
      listing.spu_code,
      listing.listing_batch_no,
      listing.publish_unit_no,
      listing.split_group_key,
      listing.split_reason,
      listing.title,
      listing.platform_category_id,
      listing.product_type_id,
      listing.platform_category_name,
      listing.platform_category_path,
      listing.default_language,
      listing.currency,
      listing.status,
      listing.validation_status,
      listing.completeness,
      listing.created_by,
      listing.created_at,
      listing.updated_at,
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
    items: summarizeListings(db, rows, { onlySelected: true }),
    pagination: {
      total: total.count,
      limit,
      offset,
    },
  })
})

prePublish.post("/drafts", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    platform?: string
    spu_codes?: string[]
    skc_codes_by_spu?: Record<string, string[]>
    batch_search?: string
    auto_select_category?: boolean
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

  const sourceInputs: Array<{
    spuCode: string
    sourceRow: SourceRow
    readiness: ReadinessRow
  }> = []
  const draftInputs: Array<{
    spuCode: string
    sourceRow: SourceRow
    readiness: ReadinessRow
    categoryDecision: CategoryAutoSelectionDecision
    liveAi: LiveAiDraftCategory | null
    skcCodes?: string[]
    splitGroupKey?: string | null
    splitReason?: string | null
    splitGender?: string | null
    splitEvidenceBasis?: string | null
    aiSkcEvidence?: unknown[]
    splitPlanStatus?: string | null
    splitPlanReason?: string | null
    unresolvedSkcCodes?: string[]
  }> = []
  const created: unknown[] = []
  const missing: string[] = []
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
    sourceInputs.push({
      spuCode,
      sourceRow,
      readiness,
    })
  }

  const categoryAiConcurrency = 2
  for (let index = 0; index < sourceInputs.length; index += categoryAiConcurrency) {
    const prepared = await Promise.all(
      sourceInputs.slice(index, index + categoryAiConcurrency).map(async (input) => {
        let requestedSkcCodes: string[] | undefined
        try {
          requestedSkcCodes = validateRequestedDraftSkcCodes(
            body.skc_codes_by_spu?.[input.spuCode],
            input.readiness.skcs.map((skc) => skc.skc_code),
          )
        } catch (error) {
          throw new HTTPException(400, {
            message: error instanceof Error ? error.message : "款色选择无效",
          })
        }
        const categoryPreparation = await readinessForDraftCreation(
          db,
          input.sourceRow,
          input.readiness,
          {
            autoSelectCategory: body.auto_select_category !== false,
            skcCodes: requestedSkcCodes,
          },
        )
        return expandNeutralSkcDraftInputs(db, {
          ...input,
          ...categoryPreparation,
          categoryDecision: categoryPreparation.decision,
          skcCodes: requestedSkcCodes,
        })
      }),
    )
    draftInputs.push(...prepared.flat())
  }

  const transaction = db.transaction(() => {
    for (const input of draftInputs) {
      const { sourceRow, readiness, categoryDecision, liveAi } = input
      const result = createDraft(
        db,
        readiness,
        sourceRow,
        platform,
        input.skcCodes,
        categoryDecision,
        input.splitPlanStatus === "NOT_APPLICABLE" ? undefined : {
          groupKey: input.splitGroupKey,
          reason: input.splitReason,
          gender: input.splitGender,
          evidenceBasis: input.splitEvidenceBasis,
          aiSkcEvidence: input.aiSkcEvidence,
        },
      )
      created.push({
        listing_id: result.listing.id,
        spu_code: readiness.spu_code,
        publish_unit_no: result.listing.publish_unit_no,
        version_no: result.version.version_no,
        created: result.created,
        status: result.listing.status,
        category_id: result.listing.platform_category_id,
        product_type_id: result.listing.product_type_id,
        category_auto_selected: categoryDecision.apply,
        category_source: categoryDecision.source,
        category_confidence: categoryDecision.confidence,
        category_selection_reason: categoryDecision.reason,
        category_selection_message: categoryDecisionMessage(categoryDecision.reason),
        category_needs_review: !categoryDecision.apply,
        category_ai_status: liveAi?.status ?? null,
        category_ai_split_by_skc: liveAi?.splitBySkc ?? false,
        category_ai_risks: liveAi?.risks ?? [],
        category_ai_blocking_risks: liveAi?.blockingRisks ?? [],
        split_gender: input.splitGender ?? null,
        split_evidence_basis: input.splitEvidenceBasis ?? null,
        split_group_key: input.splitGroupKey ?? null,
        split_reason: input.splitReason ?? null,
        selected_skc_codes: input.skcCodes ?? readiness.skcs.map((skc) => normalizeText(skc.skc_code)).filter(Boolean),
        unresolved_skc_codes: input.unresolvedSkcCodes ?? [],
        category_ai_skc_suggestions: input.aiSkcEvidence ?? [],
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
  requirePermission(c, "LISTING_READ")
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
  requirePermission(c, "LISTING_WRITE")
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
  requirePermission(c, "LISTING_WRITE")
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
  requirePermission(c, "LISTING_WRITE")
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
  requirePermission(c, "LISTING_WRITE")
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
  applyDraftCategorySelection({
    db,
    listing,
    listingId,
    categoryId,
    productTypeId,
    source: "MANUAL_CATEGORY_TREE",
  })
  const refreshed = refreshListingAfterFill(db, listingId, "人工调整 SHEIN 类目")
  if (!refreshed) {
    throw new HTTPException(500, { message: "调整类目后刷新草稿失败" })
  }
  return c.json({ ok: true, detail: getListingDetail(db, listingId), version: refreshed.version })
})

prePublish.post("/drafts/:id/convert-openapi-single-item", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
  requirePermission(c, "LISTING_WRITE")
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
    persistDraftFields({ db, listing, listingId, fields, savedFrom: "draft_detail" })
  })
  transaction()
  const refreshed = refreshListingAfterFill(db, listingId, `人工编辑 ${fields.length} 个字段`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "草稿刷新失败" })
  }
  return c.json({ ok: true, version: refreshed.version, detail: getListingDetail(db, listingId) })
})

prePublish.post("/drafts/:id/refresh-weights", (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const transaction = db.transaction(() => {
    const beforeRows = listingSkuWeightRows(db, listingId)
    const weights = activeWeights(db)
    applyMissingListingSkuWeights(db, listingId, beforeRows, weights)
    const readiness = getReadinessForListing(db, listing)
    if (!readiness) {
      throw new HTTPException(500, { message: "同步后台毛重失败" })
    }
    persistListingValidation(db, listingId, readiness)
    const refreshedListing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow
    const version = createPublishVersion({
      db,
      listing: refreshedListing,
      readiness,
      changeSummary: "同步后台 SKU 毛重",
    })
    const afterRows = listingSkuWeightRows(db, listingId)
    const summary = summarizeListingWeightSync(beforeRows, afterRows, weights)
    refreshBucketProduct(db, listing.spu_code)
    return { version, summary }
  })
  const { version, summary } = transaction()
  return c.json({
    ok: true,
    summary,
    version,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.patch("/drafts/:id/image-confirmation", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select id from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as {
    skc_id?: unknown
    confirmed?: unknown
    asset_ids?: unknown[]
  }
  const confirmed = body.confirmed === true || Number(body.confirmed) === 1
  const transaction = db.transaction(() => {
    setListingSkcImageConfirmation({
      db,
      listingId,
      listingSkcId: body.skc_id,
      confirmed,
      expectedAssetIds: body.asset_ids,
    })
  })
  transaction()
  return c.json({ ok: true, detail: getListingDetail(db, listingId) })
})

prePublish.post("/drafts/:id/save", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
    manual_size_chart_rows?: ManualSizeChartInputRow[]
  }
  const fields = Array.isArray(body.fields) ? body.fields : []
  const skuSizeValues = Array.isArray(body.sku_size_values) ? body.sku_size_values : []
  const skuWeightValues = Array.isArray(body.sku_weight_values) ? body.sku_weight_values : []
  const skuCommercialValues = Array.isArray(body.sku_commercial_values) ? body.sku_commercial_values : []
  const skcColorValues = Array.isArray(body.skc_color_values) ? body.skc_color_values : []
  const hasManualSizeChartRows = Array.isArray(body.manual_size_chart_rows)
  const manualSizeChartRows = hasManualSizeChartRows ? body.manual_size_chart_rows ?? [] : []
  const hasSkcSelection = Array.isArray(body.selected_skc_ids)
  const hasSkuSelection = Array.isArray(body.selected_sku_ids)
  const selectedSkcIds = new Set((body.selected_skc_ids ?? []).map(Number).filter(Number.isFinite))
  const selectedSkuIds = new Set((body.selected_sku_ids ?? []).map(Number).filter(Number.isFinite))

  const transaction = db.transaction(() => {
    persistDraftFields({ db, listing, listingId, fields, savedFrom: "draft_whole_save" })

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
    if (hasManualSizeChartRows) persistManualSizeChart({ db, listing, rows: manualSizeChartRows })
  })
  transaction()

  const refreshed = refreshListingAfterFill(db, listingId, `保存草稿：字段 ${fields.length} 个，颜色 ${skcColorValues.length} 个，尺码 ${skuSizeValues.length} 个，毛重 ${skuWeightValues.length} 个，价格包装 ${skuCommercialValues.length} 个${hasManualSizeChartRows ? `，尺码表 ${manualSizeChartRows.length} 行` : ""}`)
  if (!refreshed) {
    throw new HTTPException(500, { message: "草稿保存后刷新失败" })
  }
  return c.json({ ok: true, version: refreshed.version, detail: getListingDetail(db, listingId) })
})

type DraftAiEnrichMode = "all" | "attributes" | "category" | "title" | "description"

prePublish.post("/drafts/:id/ai-enrich", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const body = await c.req.json().catch(() => ({})) as { mode?: string }
  const requestedMode = normalizeText(body.mode || "all")
  const mode: DraftAiEnrichMode = ["all", "attributes", "category", "title", "description"].includes(requestedMode)
    ? requestedMode as DraftAiEnrichMode
    : "all"
  const readiness = getReadinessForListing(db, listing)
  if (!readiness) {
    throw new HTTPException(404, { message: "商品档案不存在" })
  }
  const categoryReadiness = mode === "all" || mode === "category"
    ? selectedReadinessForListing(db, listingId, getReadinessForListing(db, listing, {
        ignoreListingCategory: true,
        ignoreStoredCategory: true,
      }) ?? readiness)
    : selectedReadinessForListing(db, listingId, readiness)
  let enrichmentReadiness = selectedReadinessForListing(db, listingId, readiness)
  const saved: Array<Record<string, unknown>> = []
  const warnings: Array<{ spu_code: string; message: string }> = []
  let categorySelection: CategoryAutoSelectionDecision | null = null

  if (mode === "all" || mode === "category") {
    const ruleDecision = categoryDecisionForReadiness(db, categoryReadiness.category, {
      allowRuleFallback: true,
    })
    categorySelection = ruleDecision
    const ruleApplication = applyDraftCategoryDecision({
      db,
      listing,
      listingId,
      decision: ruleDecision,
      selectedFrom: "draft_ai_enrich_rule",
    })
    if (ruleApplication) {
      saved.push(ruleApplication)
    } else if (shouldAskLiveAiCategory(categoryReadiness.category)) {
      const liveCategory = await safeResolveLiveAiDraftCategory(db, categoryReadiness)
      if (liveCategory) {
        const liveDecision = categoryDecisionForReadiness(db, categoryReadiness.category, {
          allowRuleFallback: true,
          liveAi: liveCategory,
        })
        categorySelection = liveDecision
        const liveApplication = applyDraftCategoryDecision({
          db,
          listing,
          listingId,
          decision: liveDecision,
          selectedFrom: "draft_ai_enrich",
          payload: {
            reason: liveCategory.reasons.join("；"),
            risks: liveCategory.risks,
            blocking_risks: liveCategory.blockingRisks,
          },
        })
        if (liveApplication) saved.push(liveApplication)
      }
    }
    if (saved.some((field) => field.field_key === "category")) {
      const updatedListing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
      const updatedReadiness = updatedListing ? getReadinessForListing(db, updatedListing) : null
      if (updatedReadiness) enrichmentReadiness = selectedReadinessForListing(db, listingId, updatedReadiness)
    }
  }

  const titleAlreadyReady = Boolean(normalizeText(readinessFieldValue(enrichmentReadiness, "title_en")) || normalizeText(enrichmentReadiness.title_en))
  if (mode === "title" || (mode === "all" && !titleAlreadyReady)) {
    const titleEn = await safeAiTranslateTitle(enrichmentReadiness)
    if (titleEn) {
      persistFill({
        db,
        spuCode: enrichmentReadiness.spu_code,
        fieldKey: "title_en",
        fieldLabel: "英文标题",
        fieldValue: titleEn,
        source: "AI_TRANSLATED",
        confidence: 0.78,
        payload: { title_cn: enrichmentReadiness.title_cn, category: enrichmentReadiness.category },
      })
      saved.push({
        field_key: "title_en",
        field_label: "英文标题",
        field_value: titleEn,
      })
    }
  }

  const descriptionAlreadyReady = Boolean(
    sanitizeProductDescription(readinessFieldValue(enrichmentReadiness, "product_description"))
    || sanitizeProductDescription(enrichmentReadiness.description),
  )
  if (mode === "description" || (mode === "all" && !descriptionAlreadyReady)) {
    if (shouldGenerateProductDescription(enrichmentReadiness)) {
      const productDescription = await safeAiGenerateProductDescription(enrichmentReadiness)
      if (productDescription) {
        persistFill({
          db,
          spuCode: enrichmentReadiness.spu_code,
          fieldKey: "product_description",
          fieldLabel: "商品描述",
          fieldValue: productDescription,
          source: "AI_DESCRIPTION",
          confidence: 0.74,
          payload: {
            title_cn: enrichmentReadiness.title_cn,
            category: enrichmentReadiness.category,
            context: "draft_ai_enrich",
          },
        })
        db.prepare(`
          update listing
          set description = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          where id = ?
        `).run(productDescription, listingId)
        saved.push({
          field_key: "product_description",
          field_label: "商品描述",
          field_value: productDescription,
        })
      }
    }
  }

  if (mode === "all" || mode === "attributes") {
    for (const field of deterministicAttributeFillsForAiEnrich(enrichmentReadiness)) {
      const fieldValue = normalizeFillFieldValue(field.key, field.label, field.value)
      if (!fieldValue) continue
      persistFill({
        db,
        spuCode: enrichmentReadiness.spu_code,
        fieldKey: field.key,
        fieldLabel: field.label,
        fieldValue,
        source: normalizeText(field.source) || "RULE",
        confidence: field.confidence ?? 0.72,
        payload: {
          fallback: true,
          context: "draft_ai_enrich",
          reason: field.note ?? "根据商品档案和 SHEIN 枚举确定性推荐。",
        },
      })
      saved.push({
        field_key: field.key,
        field_label: field.label,
        field_value: fieldValue,
      })
    }

    let aiFills: Array<Record<string, unknown>> = []
    try {
      aiFills = await callAiFill(enrichmentReadiness) as Array<Record<string, unknown>>
    } catch (error) {
      warnings.push({
        spu_code: enrichmentReadiness.spu_code,
        message: `AI 填写字段失败：${aiFillWarningMessage(error)}`,
      })
    }
    const byKey = new Map(aiFills.map((fill) => [String(fill.field_key), fill]))
    for (const field of enrichmentReadiness.manual_fields) {
      const aiFill = byKey.get(field.key)
      const fieldValue = safeAutomaticAttributeFillValue(field, enrichmentReadiness, aiFill)
      if (!fieldValue) continue
      const confidence = Number(aiFill?.confidence)
      persistFill({
        db,
        spuCode: enrichmentReadiness.spu_code,
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
  return c.json({
    ok: true,
    saved_count: saved.length,
    warning_count: warnings.length,
    warnings,
    fills: saved,
    category_selection: categorySelection
      ? {
        ...categorySelection,
        message: categoryDecisionMessage(categorySelection.reason),
      }
      : null,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.post("/drafts/:id/ai-field", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
  const selectedReadiness = selectedReadinessForListing(db, listingId, readiness)
  const generatedResult = await generateSingleAiField(selectedReadiness, fieldKey)
    .then((generated) => ({ generated, warningMessage: "" }))
    .catch((error) => {
      if (error instanceof HTTPException && error.status < 500) throw error
      return { generated: null, warningMessage: aiFillWarningMessage(error) }
    })
  const generated = generatedResult.generated
  if (!generated) {
    return c.json({
      ok: true,
      saved_count: 0,
      warning_count: 1,
      warnings: [{
        spu_code: selectedReadiness.spu_code,
        message: `AI 生成字段失败：${generatedResult.warningMessage || "AI 服务暂不可用"}`,
      }],
      field: null,
      detail: getListingDetailForAiWarning(db, listingId),
    })
  }
  persistFill({
    db,
    spuCode: selectedReadiness.spu_code,
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

const MAX_FOLDER_IMPORT_FILES = 200
const MAX_FOLDER_IMPORT_BYTES = 500 * 1024 * 1024

function safeAssetFileName(fileName: string, extension: string) {
  return safeUploadFileName(fileName, { fallbackName: "image", extension })
}

function isPathInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function resolveImportFolderPath(folderPath: string) {
  try {
    const folderRealPath = fs.realpathSync(folderPath)
    if (!fs.statSync(folderRealPath).isDirectory()) return null
    return folderRealPath
  } catch {
    return null
  }
}

function resolveImportImageSource(folderRealPath: string, filePath: string) {
  let linkStat: fs.Stats
  let sourceRealPath: string
  try {
    linkStat = fs.lstatSync(filePath)
    if (linkStat.isSymbolicLink()) {
      return { skipped: true, reason: "不支持符号链接图片" }
    }
    if (!linkStat.isFile()) {
      return { skipped: true, reason: "图片文件不可用" }
    }
    sourceRealPath = fs.realpathSync(filePath)
  } catch {
    return { skipped: true, reason: "图片文件不可用" }
  }
  if (!isPathInside(folderRealPath, sourceRealPath)) {
    return { skipped: true, reason: "图片文件不在导入目录内" }
  }
  const stat = fs.statSync(sourceRealPath)
  if (!stat.isFile()) {
    return { skipped: true, reason: "图片文件不可用" }
  }
  return { realPath: sourceRealPath, size: stat.size }
}

function copyImportedImageToAssetRoot(input: {
  listingId: number
  skcCode?: unknown
  sourcePath: string
  fileName: string
  requirement: PictureRequirement
}) {
  const stat = fs.statSync(input.sourcePath)
  if (!stat.isFile()) return null
  if (stat.size > maxUploadBytes("image")) {
    return { skipped: true, reason: "图片文件过大" }
  }
  const bytes = fs.readFileSync(input.sourcePath)
  let inspection: ReturnType<typeof inspectListingImageForRequirement>
  try {
    inspection = inspectListingImageForRequirement(bytes, input.requirement)
  } catch (error) {
    return { skipped: true, reason: error instanceof Error ? error.message : "图片不符合平台要求" }
  }
  const dir = path.join(uploadsRoot(), String(input.listingId), skcFingerprint(input.skcCode || "spu"))
  fs.mkdirSync(dir, { recursive: true })
  const localPath = path.join(dir, safeAssetFileName(input.fileName, inspection.detected.extension))
  fs.writeFileSync(localPath, bytes)
  return { localPath, bytes, ...inspection }
}

function importListingImagesFromFolder(db: ReturnType<typeof getDb>, listingId: number, folderPath: string) {
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
  if (!listing) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  const folderRealPath = resolveImportFolderPath(folderPath)
  if (!folderRealPath) {
    throw new HTTPException(400, { message: "本地图片目录不存在" })
  }

  const listingSkcs = db.prepare(`
    select *
    from listing_skc
    where listing_id = ?
    order by skc_code
  `).all(listingId) as SourceRow[]
  const requirements = getImageRequirements(db, listing)
  const folderFinger = skcFingerprint(path.basename(folderPath))
  const fallbackSkc = listingSkcs.find((skc) => folderFinger.includes(skcFingerprint(skc.skc_code)))
    ?? listingSkcs.find((skc) => folderFinger.includes(skcFingerprint(String(skc.skc_code).split(":").pop())))
    ?? listingSkcs[0]
  const warnings: Array<{ file_name: string; reason: string }> = []
  const matchedFiles = fs.readdirSync(folderRealPath)
    .filter((fileName) => /\.(jpe?g|png|webp)$/i.test(fileName))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
  const files = matchedFiles.slice(0, MAX_FOLDER_IMPORT_FILES)
  if (matchedFiles.length > MAX_FOLDER_IMPORT_FILES) {
    warnings.push({ file_name: "*", reason: `本次最多导入 ${MAX_FOLDER_IMPORT_FILES} 张图片` })
  }
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
      width,
      height,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'MANUAL_FOLDER_IMPORT', ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `)
  const saved: SourceRow[] = []
  const affectedSkcIds = new Set<number>()
  let importedBytes = 0
  const transaction = db.transaction(() => {
    lockListingImageMutation(db, listingId)
    for (const fileName of files) {
      const filePath = path.join(folderRealPath, fileName)
      const fileFinger = skcFingerprint(fileName)
      const matchedSkc = listingSkcs.find((skc) => fileFinger.includes(skcFingerprint(skc.skc_code)))
        ?? listingSkcs.find((skc) => fileFinger.includes(skcFingerprint(String(skc.skc_code).split(":").pop())))
        ?? fallbackSkc
      if (!matchedSkc) continue
      const classified = classifyImportedImage(fileName)
      const requirement = requirements.find((item) => item.requirement_key === classified.requirementKey)
      if (!requirement) {
        warnings.push({ file_name: fileName, reason: "当前类目没有对应图片规则" })
        continue
      }
      deleteAutoSourceImagesForUserAsset({
        db,
        listingId,
        listingSkcId: matchedSkc.id,
        assetType: classified.assetType,
      })
      try {
        assertListingImageCapacity({
          db,
          listingId,
          listingSkcId: matchedSkc.id,
          requirement,
          assetType: classified.assetType,
        })
      } catch (error) {
        warnings.push({
          file_name: fileName,
          reason: error instanceof Error ? error.message : "图片数量超过平台限制",
        })
        continue
      }
      const sourceFile = resolveImportImageSource(folderRealPath, filePath)
      if ("skipped" in sourceFile) {
        warnings.push({ file_name: fileName, reason: sourceFile.reason })
        continue
      }
      if (importedBytes + sourceFile.size > MAX_FOLDER_IMPORT_BYTES) {
        warnings.push({ file_name: fileName, reason: "本次导入图片总大小超过限制" })
        continue
      }
      const copied = copyImportedImageToAssetRoot({
        listingId,
        skcCode: matchedSkc.skc_code,
        sourcePath: sourceFile.realPath,
        fileName,
        requirement,
      })
      if (!copied || "skipped" in copied) {
        warnings.push({ file_name: fileName, reason: copied?.reason ?? "图片文件不可用" })
        continue
      }
      importedBytes += copied.bytes.length
      const result = insert.run(
        listingId,
        matchedSkc.id,
        matchedSkc.skc_code,
        classified.assetType,
        classified.sort,
        copied.localPath,
        copied.bytes.length,
        copied.width,
        copied.height,
        classified.note,
        JSON.stringify({
          file_name: fileName,
          source_folder: path.basename(folderPath),
          file_size: copied.bytes.length,
          content_type: copied.detected.contentType,
          width: copied.width,
          height: copied.height,
          compliance: copied.compliance,
          requirement_key: classified.requirementKey,
          classification_rule: "filename_index",
        }),
      )
      affectedSkcIds.add(Number(matchedSkc.id))
      saved.push(db.prepare("select * from listing_asset where id = ?").get(result.lastInsertRowid) as SourceRow)
    }
    for (const skcId of affectedSkcIds) resetListingSkcImageConfirmation(db, listingId, skcId)
  })
  transaction()
  return { listing, assets: saved, warnings }
}

prePublish.post("/drafts/batch-import-folders", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as { listing_ids?: unknown[]; folder_path?: string }
  const listingIds = Array.from(new Set((Array.isArray(body.listing_ids) ? body.listing_ids : []).map(Number).filter((id) => Number.isFinite(id) && id > 0)))
  const folderPath = normalizeText(body.folder_path)
  if (listingIds.length === 0) throw new HTTPException(400, { message: "请先勾选草稿" })
  const items = listingIds.map((listingId) => {
    try {
      const result = importListingImagesFromFolder(db, listingId, folderPath)
      return { listing_id: listingId, ok: true, imported_count: result.assets.length, warnings: result.warnings }
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

const DEFAULT_MAX_IMAGE_PACKAGE_BYTES = 600 * 1024 * 1024

function maxImagePackageBytes() {
  const megabytes = Number(process.env.LISTINGIFY_MAX_IMAGE_PACKAGE_MB ?? 600)
  if (!Number.isFinite(megabytes) || megabytes <= 0) return DEFAULT_MAX_IMAGE_PACKAGE_BYTES
  return Math.floor(megabytes) * 1024 * 1024
}

function packageCodeMatches(listingCode: unknown, packageCode: string) {
  const listingFinger = skcFingerprint(listingCode)
  const packageFinger = skcFingerprint(packageCode)
  return Boolean(listingFinger && packageFinger && (listingFinger === packageFinger || listingFinger.endsWith(packageFinger)))
}

function packageUploadListingRows(db: ReturnType<typeof getDb>, listingIds: number[]) {
  const clauses = ["listing.platform = 'SHEIN'"]
  const params: unknown[] = []
  if (listingIds.length > 0) {
    clauses.push(`listing.id in (${listingIds.map(() => "?").join(",")})`)
    params.push(...listingIds)
  }
  return db.prepare(`
    select
      listing.id as listing_id,
      listing.spu_code,
      listing.status as listing_status,
      skc.id as listing_skc_id,
      skc.skc_code,
      skc.color_name
    from listing
    join listing_skc skc on skc.listing_id = listing.id
    where ${clauses.join(" and ")}
    order by listing.id, skc.skc_code
  `).all(...params) as SourceRow[]
}

type PreparedPackageAsset = {
  bytes: Buffer
  extension: string
  fileName: string
  requirement: PictureRequirement
  requirementKey: string
  assetType: string
  imageSort: number
  sourceEntry: SheinImagePackageEntry
  width: number
  height: number
  contentType: string
  compliance: ReturnType<typeof imageCompliance>
  derivative: string | null
}

async function preparePackageAssetsForListing(input: {
  listing: ListingRow
  group: SheinImagePackageGroup
  zipEntries: Map<string, ZipFile>
  db: ReturnType<typeof getDb>
}) {
  const requirements = getImageRequirements(input.db, input.listing)
    .filter((requirement) => requirement.level === "SKC" && requirement.show !== 0)
  const requirementMap = new Map(requirements.map((requirement) => [requirement.requirement_key, requirement]))
  const detailLimit = requirementMap.get("SKC_DETAIL")?.max_count ?? 0
  const assignments = packageImageAssignments(input.group, detailLimit)
    .filter((assignment) => requirementMap.has(assignment.requirement_key))
  const sourceBuffers = new Map<string, Buffer>()
  const prepared: PreparedPackageAsset[] = []
  const warnings: Array<{ file_name: string; reason: string }> = []

  for (const assignment of assignments) {
    const requirement = requirementMap.get(assignment.requirement_key)
    const zipEntry = input.zipEntries.get(assignment.entry.entry_path)
    if (!requirement || !zipEntry) continue
    try {
      let sourceBytes = sourceBuffers.get(assignment.entry.entry_path)
      if (!sourceBytes) {
        sourceBytes = await zipEntry.buffer()
        sourceBuffers.set(assignment.entry.entry_path, sourceBytes)
      }
      let bytes = sourceBytes
      let fileName = path.basename(assignment.entry.entry_path)
      if (assignment.derivative === "square-center-crop") {
        bytes = await centerCropSquareImageBuffer(sourceBytes)
        fileName = `${input.group.skc_code}_${assignment.entry.image_index}_square.jpg`
      } else if (assignment.derivative === "color-square-80") {
        bytes = await sharp(sourceBytes)
          .rotate()
          .flatten({ background: "#ffffff" })
          .resize({ width: 80, height: 80, fit: "cover", position: "centre" })
          .jpeg({ quality: 92 })
          .toBuffer()
        fileName = `${input.group.skc_code}_${assignment.entry.image_index}_color-block.jpg`
      }
      const inspection = inspectListingImageForRequirement(bytes, requirement)
      prepared.push({
        bytes,
        extension: inspection.detected.extension,
        fileName,
        requirement,
        requirementKey: assignment.requirement_key,
        assetType: assignment.asset_type,
        imageSort: assignment.image_sort,
        sourceEntry: assignment.entry,
        width: inspection.width,
        height: inspection.height,
        contentType: inspection.detected.contentType,
        compliance: inspection.compliance,
        derivative: assignment.derivative,
      })
    } catch (error) {
      warnings.push({
        file_name: path.basename(assignment.entry.entry_path),
        reason: error instanceof Error ? error.message : "图包图片处理失败",
      })
    }
  }
  return { assets: prepared, warnings }
}

function savePreparedPackageAssets(input: {
  db: ReturnType<typeof getDb>
  listing: ListingRow
  listingSkc: SourceRow
  group: SheinImagePackageGroup
  packageFileName: string
  assets: PreparedPackageAsset[]
}) {
  const oldAssets = input.db.prepare(`
    select id, local_path
    from listing_asset
    where listing_id = ?
      and listing_skc_id = ?
      and source_type = 'SHEIN_IMAGE_PACKAGE'
  `).all(input.listing.id, input.listingSkc.listing_skc_id) as SourceRow[]
  const insert = input.db.prepare(`
    insert into listing_asset (
      listing_id,
      listing_skc_id,
      skc_code,
      source_type,
      asset_type,
      image_sort,
      local_path,
      file_size,
      width,
      height,
      status,
      confirmed,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, 'SHEIN_IMAGE_PACKAGE', ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `)
  const saved: SourceRow[] = []
  const warnings: Array<{ file_name: string; reason: string }> = []
  const newLocalPaths: string[] = []
  const transaction = input.db.transaction(() => {
    lockListingImageMutation(input.db, Number(input.listing.id))
    input.db.prepare(`
      delete from listing_asset
      where listing_id = ?
        and listing_skc_id = ?
        and source_type = 'SHEIN_IMAGE_PACKAGE'
    `).run(input.listing.id, input.listingSkc.listing_skc_id)

    for (const asset of input.assets) {
      deleteAutoSourceImagesForUserAsset({
        db: input.db,
        listingId: Number(input.listing.id),
        listingSkcId: input.listingSkc.listing_skc_id,
        assetType: asset.assetType,
      })
      try {
        assertListingImageCapacity({
          db: input.db,
          listingId: Number(input.listing.id),
          listingSkcId: input.listingSkc.listing_skc_id,
          requirement: asset.requirement,
          assetType: asset.assetType,
        })
      } catch (error) {
        warnings.push({
          file_name: asset.fileName,
          reason: error instanceof Error ? error.message : "图片数量超过平台限制",
        })
        continue
      }
      const dir = path.join(
        uploadsRoot(),
        String(input.listing.id),
        skcFingerprint(input.listingSkc.skc_code || input.group.skc_code),
      )
      fs.mkdirSync(dir, { recursive: true })
      const localPath = path.join(dir, safeAssetFileName(asset.fileName, asset.extension))
      fs.writeFileSync(localPath, asset.bytes)
      newLocalPaths.push(localPath)
      const result = insert.run(
        input.listing.id,
        input.listingSkc.listing_skc_id,
        input.listingSkc.skc_code,
        asset.assetType,
        asset.imageSort,
        localPath,
        asset.bytes.length,
        asset.width,
        asset.height,
        `SHEIN 图包自动填充：${asset.requirement.name}`,
        JSON.stringify({
          package_file_name: input.packageFileName,
          source_entry: asset.sourceEntry.entry_path,
          source_image_index: asset.sourceEntry.image_index,
          requirement_key: asset.requirementKey,
          classification_rule: "spu_skc_directory_and_image_index",
          derivative: asset.derivative,
          content_type: asset.contentType,
          file_size: asset.bytes.length,
          width: asset.width,
          height: asset.height,
          compliance: asset.compliance,
        }),
      )
      saved.push(input.db.prepare("select * from listing_asset where id = ?").get(result.lastInsertRowid) as SourceRow)
    }
    resetListingSkcImageConfirmation(input.db, Number(input.listing.id), input.listingSkc.listing_skc_id)
    input.db.prepare(`
      update listing
      set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(input.listing.id)
  })

  try {
    transaction()
  } catch (error) {
    for (const localPath of newLocalPaths) fs.rmSync(localPath, { force: true })
    throw error
  }
  for (const oldAsset of oldAssets) {
    const localPath = normalizeText(oldAsset.local_path)
    if (localPath && isPathInside(uploadsRoot(), localPath)) fs.rmSync(localPath, { force: true })
  }
  return { assets: saved, warnings, replaced_count: oldAssets.length }
}

prePublish.post("/drafts/batch-upload-image-package", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    throw new HTTPException(400, { message: "图包上传内容无法解析，请重新选择 ZIP 文件" })
  }
  const file = form.get("file")
  if (!(file instanceof File)) throw new HTTPException(400, { message: "请选择要上传的 SHEIN 图包" })
  if (path.extname(file.name).toLowerCase() !== ".zip") {
    throw new HTTPException(400, { message: "仅支持 ZIP 格式的 SHEIN 图包" })
  }
  if (file.size > maxImagePackageBytes()) {
    throw new HTTPException(413, { message: `SHEIN 图包不能超过 ${Math.floor(maxImagePackageBytes() / 1024 / 1024)}MB` })
  }
  const mimeType = normalizeText(file.type).toLowerCase()
  if (mimeType && !["application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(mimeType)) {
    throw new HTTPException(400, { message: "上传文件不是支持的 ZIP 图包" })
  }
  const listingIds = Array.from(new Set(
    parseJsonArray(form.get("listing_ids"))
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0),
  ))
  const archiveBytes = Buffer.from(await file.arrayBuffer())
  if (archiveBytes.length < 4 || archiveBytes[0] !== 0x50 || archiveBytes[1] !== 0x4b) {
    throw new HTTPException(400, { message: "上传文件不是有效的 ZIP 图包" })
  }

  let archive: CentralDirectory
  try {
    archive = await unzipper.Open.buffer(archiveBytes)
  } catch {
    throw new HTTPException(400, { message: "ZIP 图包已损坏或无法读取" })
  }
  if (archive.files.length > MAX_SHEIN_IMAGE_PACKAGE_ENTRIES) {
    throw new HTTPException(413, { message: `图包文件数不能超过 ${MAX_SHEIN_IMAGE_PACKAGE_ENTRIES} 个` })
  }
  if (archive.files.some((entry) => (entry.flags & 1) === 1)) {
    throw new HTTPException(400, { message: "不支持加密 ZIP 图包" })
  }
  const totalUncompressedBytes = archive.files.reduce((sum, entry) => sum + Number(entry.uncompressedSize ?? 0), 0)
  if (totalUncompressedBytes > MAX_SHEIN_IMAGE_PACKAGE_UNCOMPRESSED_BYTES) {
    throw new HTTPException(413, { message: "ZIP 解压后内容超过 1GB，已停止处理" })
  }
  const parsedEntries = archive.files
    .filter((entry) => entry.type === "File")
    .map((entry) => parseSheinImagePackageEntry(entry.path, entry.uncompressedSize))
    .filter((entry): entry is SheinImagePackageEntry => Boolean(entry))
  if (parsedEntries.length === 0) {
    throw new HTTPException(400, {
      message: "图包中未找到“款号/SKC/SKC_序号.jpg”结构的图片",
    })
  }
  const groups = groupSheinImagePackageEntries(parsedEntries)
  const zipEntries = new Map(archive.files.map((entry) => [entry.path.replaceAll("\\", "/"), entry]))
  const listingSkcRows = packageUploadListingRows(db, listingIds)
  const listingCache = new Map<number, ListingRow>()
  const itemMap = new Map<number, {
    listing_id: number
    spu_code: string
    matched_skc_count: number
    source_image_count: number
    imported_count: number
    replaced_count: number
    warnings: Array<{ file_name: string; reason: string }>
  }>()
  const matchedSpuCodes = new Set<string>()
  const unmatchedSkcCodes: string[] = []

  for (const group of groups) {
    const targets = listingSkcRows.filter((row) => (
      packageCodeMatches(row.spu_code, group.spu_code)
      && packageCodeMatches(row.skc_code, group.skc_code)
    ))
    if (targets.length === 0) {
      unmatchedSkcCodes.push(group.skc_code)
      continue
    }
    matchedSpuCodes.add(group.spu_code)
    for (const target of targets) {
      const listingId = Number(target.listing_id)
      let listing = listingCache.get(listingId)
      if (!listing) {
        listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
        if (!listing) continue
        listingCache.set(listingId, listing)
      }
      const item = itemMap.get(listingId) ?? {
        listing_id: listingId,
        spu_code: normalizeText(listing.spu_code),
        matched_skc_count: 0,
        source_image_count: 0,
        imported_count: 0,
        replaced_count: 0,
        warnings: [],
      }
      try {
        const prepared = await preparePackageAssetsForListing({ listing, group, zipEntries, db })
        if (prepared.assets.length === 0) {
          item.warnings.push(...prepared.warnings, {
            file_name: group.skc_code,
            reason: "当前类目没有可填充的 SKC 图片字段，或图包图片均不符合要求",
          })
          itemMap.set(listingId, item)
          continue
        }
        const saved = savePreparedPackageAssets({
          db,
          listing,
          listingSkc: target,
          group,
          packageFileName: file.name,
          assets: prepared.assets,
        })
        item.matched_skc_count += 1
        item.source_image_count += group.entries.length
        item.imported_count += saved.assets.length
        item.replaced_count += saved.replaced_count
        item.warnings.push(...prepared.warnings, ...saved.warnings)
      } catch (error) {
        item.warnings.push({
          file_name: group.skc_code,
          reason: error instanceof Error ? error.message : "SKC 图包导入失败",
        })
      }
      itemMap.set(listingId, item)
    }
  }

  const items = Array.from(itemMap.values()).sort((left, right) => left.listing_id - right.listing_id)
  const packageSpuCodes = Array.from(new Set(groups.map((group) => group.spu_code))).sort()
  return c.json({
    ok: items.some((item) => item.imported_count > 0),
    package: {
      file_name: file.name,
      size: file.size,
      spu_count: packageSpuCodes.length,
      skc_count: groups.length,
      source_image_count: parsedEntries.length,
      ignored_entry_count: archive.files.length - parsedEntries.length,
    },
    scope: listingIds.length > 0 ? "SELECTED_DRAFTS" : "ALL_SHEIN_DRAFTS",
    matched_draft_count: items.length,
    matched_spu_count: matchedSpuCodes.size,
    matched_skc_count: items.reduce((sum, item) => sum + item.matched_skc_count, 0),
    imported_count: items.reduce((sum, item) => sum + item.imported_count, 0),
    replaced_count: items.reduce((sum, item) => sum + item.replaced_count, 0),
    unmatched_spu_codes: packageSpuCodes.filter((spuCode) => !matchedSpuCodes.has(spuCode)),
    unmatched_skc_codes: unmatchedSkcCodes,
    warning_count: items.reduce((sum, item) => sum + item.warnings.length, 0),
    items,
  })
})

prePublish.post("/drafts/:id/images/import-folder", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const body = await c.req.json().catch(() => ({})) as { folder_path?: string }
  const folderPath = normalizeText(body.folder_path)
  const result = importListingImagesFromFolder(db, listingId, folderPath)
  return c.json({
    ok: true,
    imported_count: result.assets.length,
    assets: result.assets,
    warnings: result.warnings,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.get("/drafts/:id/image-candidates", (c) => {
  requirePermission(c, "LISTING_READ")
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
  requirePermission(c, "LISTING_WRITE")
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
  const requestedSkcCode = normalizeText(body.skc_code)
  if (requirement.level === "SPU" && requestedSkcCode) {
    throw new HTTPException(400, { message: "SPU 图片不能指定 SKC 款色" })
  }
  const skcCode = requirement.level === "SKC"
    ? requestedSkcCode || normalizeText(productAsset.skc_code)
    : ""
  const listingSkc = skcCode
    ? db.prepare("select * from listing_skc where listing_id = ? and skc_code = ?").get(listingId, skcCode) as SourceRow | undefined
    : undefined
  if (requirement.level === "SKC" && !listingSkc) {
    throw new HTTPException(400, { message: "SKC 图片必须指定草稿内的款色" })
  }
  const assetType = normalizeText(body.asset_type) || inferAssetTypeFromLibraryAsset(productAsset, requirement)
  if (!requirement.asset_types.includes(assetType)) {
    throw new HTTPException(400, { message: `图片类型不属于${requirement.name}` })
  }
  const compliance = imageCompliance(productAsset, requirement)
  if (!compliance.compliant) {
    throw new HTTPException(400, {
      message: `图片不符合${requirement.name}要求：${compliance.reasons.join("；")}`,
    })
  }
  const transaction = db.transaction(() => {
    lockListingImageMutation(db, listingId)
    deleteAutoSourceImagesForUserAsset({
      db,
      listingId,
      listingSkcId: listingSkc?.id,
      assetType,
    })
    assertListingImageCapacity({
      db,
      listingId,
      listingSkcId: listingSkc?.id,
      requirement,
      assetType,
    })
    const sortRow = db.prepare(`
      select coalesce(max(image_sort), 0) + 1 as next_sort
      from listing_asset
      where listing_id = ?
        and coalesce(skc_code, '') = coalesce(?, '')
        and asset_type = ?
    `).get(listingId, skcCode || null, assetType) as SourceRow | undefined
    const imageSort = Number(sortRow?.next_sort ?? 1)
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
    resetListingSkcImageConfirmation(db, listingId, listingSkc?.id)
    return result.lastInsertRowid
  })
  const assetId = transaction()

  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(assetId),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.post("/drafts/:id/images/upload", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
  const requirement = getImageRequirements(db, listing).find((item) => item.requirement_key === requirementKey)
  if (!requirement) {
    throw new HTTPException(400, { message: "图片规则不存在，请刷新草稿后重试" })
  }
  if (requirement.level === "SPU" && skcCode) {
    throw new HTTPException(400, { message: "SPU 图片不能指定 SKC 款色" })
  }
  const assetType = normalizeText(form.get("asset_type")) || inferAssetTypeFromRequirement(requirementKey, file.name)
  if (!requirement.asset_types.includes(assetType)) {
    throw new HTTPException(400, { message: `图片类型不属于${requirement.name}` })
  }
  const listingSkc = skcCode
    ? db.prepare("select * from listing_skc where listing_id = ? and skc_code = ?").get(listingId, skcCode) as SourceRow | undefined
    : undefined
  if (requirement.level === "SKC" && !listingSkc) {
    throw new HTTPException(400, { message: "SKC 图片必须指定草稿内的款色" })
  }
  const bytes = await readValidatedUploadBuffer(file, "image")
  const inspection = inspectListingImageForRequirement(bytes, requirement)
  const safeName = safeAssetFileName(file.name, inspection.detected.extension)
  const dir = path.join(uploadsRoot(), String(listingId), skcFingerprint(skcCode || "spu"))
  fs.mkdirSync(dir, { recursive: true })
  const localPath = path.join(dir, safeName)
  const transaction = db.transaction(() => {
    lockListingImageMutation(db, listingId)
    deleteAutoSourceImagesForUserAsset({
      db,
      listingId,
      listingSkcId: listingSkc?.id,
      assetType,
    })
    assertListingImageCapacity({
      db,
      listingId,
      listingSkcId: listingSkc?.id,
      requirement,
      assetType,
    })
    const sortRow = db.prepare(`
      select coalesce(max(image_sort), 0) + 1 as next_sort
      from listing_asset
      where listing_id = ?
        and coalesce(skc_code, '') = coalesce(?, '')
        and asset_type = ?
    `).get(listingId, skcCode || null, assetType) as SourceRow | undefined
    const imageSort = Number(sortRow?.next_sort ?? 1)
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
        width,
        height,
        status,
        confirmed,
        note,
        raw_payload_json,
        updated_at
      )
      values (?, ?, ?, 'MANUAL_UPLOAD', ?, ?, ?, ?, ?, ?, 'PENDING_CONFIRM', 0, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `).run(
      listingId,
      listingSkc?.id ?? null,
      skcCode || null,
      assetType,
      imageSort,
      localPath,
      bytes.length,
      inspection.width,
      inspection.height,
      `人工上传 ${requirementKey || assetType}`,
      JSON.stringify({
        file_name: file.name,
        requirement_key: requirementKey || null,
        content_type: inspection.detected.contentType,
        size: bytes.length,
        width: inspection.width,
        height: inspection.height,
        compliance: inspection.compliance,
      }),
    )
    resetListingSkcImageConfirmation(db, listingId, listingSkc?.id)
    return result.lastInsertRowid
  })
  let assetId: unknown
  try {
    assetId = transaction()
  } catch (error) {
    fs.rmSync(localPath, { force: true })
    throw error
  }
  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(assetId),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.patch("/drafts/:id/images/:assetId", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const assetId = Number(c.req.param("assetId"))
  const body = await c.req.json().catch(() => ({})) as {
    asset_type?: unknown
    image_sort?: unknown
    confirmed?: unknown
    note?: unknown
  }
  const transaction = db.transaction(() => {
    lockListingImageMutation(db, listingId)
    const asset = db.prepare("select * from listing_asset where id = ? and listing_id = ?").get(assetId, listingId) as SourceRow | undefined
    if (!asset) {
      throw new HTTPException(404, { message: "草稿图片不存在" })
    }
    const nextAssetType = normalizeText(body.asset_type) || normalizeText(asset.asset_type)
    const nextSort = asPositiveNumber(body.image_sort) ?? asPositiveNumber(asset.image_sort) ?? 1
    const metadataChanged = nextAssetType !== normalizeText(asset.asset_type)
      || Math.round(nextSort) !== Number(asset.image_sort ?? 1)
    if (nextAssetType !== normalizeText(asset.asset_type)) {
      const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
      const level = asset.listing_skc_id ? "SKC" : "SPU"
      const requirement = listing
        ? getImageRequirements(db, listing).find((item) => (
            item.level === level && item.asset_types.includes(nextAssetType)
          ))
        : undefined
      if (!requirement) {
        throw new HTTPException(400, { message: "图片类型不属于当前类目规则" })
      }
      const compliance = imageCompliance(asset, requirement)
      if (!compliance.compliant) {
        throw new HTTPException(400, {
          message: `图片不符合${requirement.name}要求：${compliance.reasons.join("；")}`,
        })
      }
      assertListingImageCapacity({
        db,
        listingId,
        listingSkcId: asset.listing_skc_id,
        requirement,
        assetType: nextAssetType,
        excludeAssetId: assetId,
      })
    }
    const listingSkc = asset.listing_skc_id
      ? db.prepare("select image_confirmed from listing_skc where id = ? and listing_id = ?").get(asset.listing_skc_id, listingId) as SourceRow | undefined
      : undefined
    const confirmed = asset.listing_skc_id
      ? Number(listingSkc?.image_confirmed ?? 0)
      : body.confirmed == null
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
    if (metadataChanged) resetListingSkcImageConfirmation(db, listingId, asset.listing_skc_id)
  })
  transaction()
  return c.json({
    ok: true,
    asset: db.prepare("select * from listing_asset where id = ?").get(assetId),
    detail: getListingDetail(db, listingId),
  })
})

prePublish.delete("/drafts/:id/images/:assetId", (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const assetId = Number(c.req.param("assetId"))
  const transaction = db.transaction(() => {
    lockListingImageMutation(db, listingId)
    const asset = db.prepare("select * from listing_asset where id = ? and listing_id = ?").get(assetId, listingId) as SourceRow | undefined
    if (!asset) {
      throw new HTTPException(404, { message: "草稿图片不存在" })
    }
    db.prepare("delete from listing_asset where id = ? and listing_id = ?").run(assetId, listingId)
    resetListingSkcImageConfirmation(db, listingId, asset.listing_skc_id)
  })
  transaction()
  return c.json({
    ok: true,
    detail: getListingDetail(db, listingId),
  })
})

prePublish.get("/assets/:id/file", async (c) => {
  requirePermission(c, "LISTING_READ")
  const db = getDb()
  const id = Number(c.req.param("id"))
  const asset = db.prepare("select * from listing_asset where id = ?").get(id) as SourceRow | undefined
  const localPath = normalizeText(asset?.local_path)
  if (!asset || !localPath || !fs.existsSync(localPath)) {
    throw new HTTPException(404, { message: "图片不存在" })
  }
  const file = await assertLocalImageFile({ rootDir: uploadsRoot(), filePath: localPath })
  return new Response(fs.readFileSync(file.realPath), {
    headers: { "Content-Type": file.contentType },
  })
})

prePublish.post("/drafts/:id/versions", (c) => {
  requirePermission(c, "LISTING_WRITE")
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
  requirePermission(c, "LISTING_READ")
  const db = getDb()
  const listingId = Number(c.req.param("id"))
  const skcCodes = csvTerms(c.req.query("skc_codes"))
  const preview = buildPublishPayload(db, listingId, {
    skcCodes,
    allowSourceImages: true,
    allowLocalImages: true,
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
  requirePermission(c, "LISTING_READ")
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

  return c.json(buildBatchPublishCheckResponse(db, listingIds))
})

prePublish.post("/drafts/batch-quick-fix", async (c) => {
  requirePermission(c, "LISTING_WRITE")
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    listing_fixes?: Array<{
      listing_id?: unknown
      fields?: Array<{
        field_key?: unknown
        field_label?: unknown
        field_value?: unknown
        skc_code?: string | null
        sku_code?: string | null
        source?: unknown
        confidence?: number | null
      }>
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
      image_confirmations?: Array<{
        skc_id?: unknown
        confirmed?: unknown
        asset_ids?: unknown[]
      }>
      category?: {
        category_id?: unknown
        product_type_id?: unknown
      }
    }>
  }
  const listingFixes = Array.isArray(body.listing_fixes) ? body.listing_fixes : []
  const listingIds = Array.from(new Set(
    listingFixes
      .map((item) => Number(item.listing_id))
      .filter((id) => Number.isFinite(id) && id > 0),
  ))
  if (listingIds.length === 0) {
    throw new HTTPException(400, { message: "没有要保存的批量调整" })
  }

  const changedListingIds = new Set<number>()
  const transaction = db.transaction(() => {
    for (const fix of listingFixes) {
      const listingId = Number(fix.listing_id)
      if (!Number.isFinite(listingId) || listingId <= 0) continue
      const listing = db.prepare("select * from listing where id = ?").get(listingId) as ListingRow | undefined
      if (!listing) continue
      const fields = Array.isArray(fix.fields) ? fix.fields : []
      const skuSizeValues = Array.isArray(fix.sku_size_values) ? fix.sku_size_values : []
      const skuWeightValues = Array.isArray(fix.sku_weight_values) ? fix.sku_weight_values : []
      const skuCommercialValues = Array.isArray(fix.sku_commercial_values) ? fix.sku_commercial_values : []
      const imageConfirmations = Array.isArray(fix.image_confirmations) ? fix.image_confirmations : []
      const hasCategoryChange = Boolean(fix.category?.category_id || fix.category?.product_type_id)
      const hasImageConfirmationChange = imageConfirmations.length > 0
      const hasChanges = fields.length > 0
        || skuSizeValues.length > 0
        || skuWeightValues.length > 0
        || skuCommercialValues.length > 0
        || hasCategoryChange
        || hasImageConfirmationChange
      persistDraftFields({
        db,
        listing,
        listingId,
        fields,
        savedFrom: "draft_batch_quick_fix",
      })
      applyDraftCategorySelection({
        db,
        listing,
        listingId,
        categoryId: asPositiveNumber(fix.category?.category_id),
        productTypeId: asPositiveNumber(fix.category?.product_type_id),
        source: "MANUAL_BATCH_FIX",
      })
      updateListingSkuSizes({
        db,
        listingId,
        skuSizeValues,
      })
      updateListingSkuWeights({
        db,
        listingId,
        skuWeightValues,
      })
      updateListingSkuCommercials({
        db,
        listingId,
        skuCommercialValues,
      })
      for (const confirmation of imageConfirmations) {
        setListingSkcImageConfirmation({
          db,
          listingId,
          listingSkcId: confirmation.skc_id,
          confirmed: confirmation.confirmed === true || Number(confirmation.confirmed) === 1,
          expectedAssetIds: confirmation.asset_ids,
        })
      }
      if (hasChanges) changedListingIds.add(listingId)
    }
  })
  transaction()

  for (const listingId of changedListingIds) {
    refreshListingAfterFill(db, listingId, "批量快速调整发布阻断项")
  }

  return c.json(buildBatchPublishCheckResponse(db, listingIds))
})

prePublish.post("/drafts/:id/publish", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
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

  const unresolvedTask = findUnresolvedPublishTask(db, listingId)
  if (unresolvedTask) {
    return c.json({
      ok: unresolvedTask.status === "PUBLISH_SUBMITTED",
      deduplicated: true,
      task_id: unresolvedTask.id,
      version_id: unresolvedTask.publish_version_id,
      status: unresolvedTask.status,
      message: unresolvedTask.status === "PUBLISH_RESULT_UNKNOWN"
        ? "上一次发布请求结果未知，请先同步平台状态，系统不会自动重复发布。"
        : "该草稿已有发布请求，已返回原任务。",
      detail: getListingDetail(db, listingId),
    }, unresolvedTask.status === "PUBLISH_SUBMITTED" ? 200 : 202)
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
  ensureSkcSourceImageAssetsForPublish(db, listingId)
  const preview = buildPublishPayload(db, listingId, {
    skcCodes,
    allowSourceImages: true,
    allowLocalImages: true,
    requirePreparedImages: false,
    allowDefaultSkuWeight,
  })
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
  const pendingImagePreparePayload = {
    image_prepare_status: "PENDING",
    listing_id: listing.id,
    note: "SHEIN 图片转换完成后写入正式发布 payload",
  }
  db.prepare(`
    update listing_publish_version
    set status = 'PUBLISHING',
      request_payload_json = ?
    where id = ?
  `).run(JSON.stringify(pendingImagePreparePayload), version.id)
  const ensuredTask = ensurePublishTask(db, {
    listingId: listing.id,
    publishVersionId: Number(version.id),
    platform: normalizeText(listing.platform) || "SHEIN",
    taskType: "PUBLISH_LISTING",
    status: "PUBLISHING",
    attemptCount: 1,
    requestPayload: pendingImagePreparePayload,
  })
  const task = ensuredTask.task
  if (!ensuredTask.created) {
    const errorMessage = "该草稿已有未解决的发布任务，本次重复发布已取消。"
    db.prepare(`
      update listing_publish_version
      set status = 'FAILED',
        request_payload_json = ?,
        error_code = 'DUPLICATE_ACTIVE_TASK',
        error_message = ?
      where id = ?
    `).run(JSON.stringify(pendingImagePreparePayload), errorMessage, version.id)
    return c.json({
      ok: task.status === "PUBLISH_SUBMITTED",
      deduplicated: true,
      task_id: task.id,
      version_id: task.publish_version_id,
      cancelled_version_id: version.id,
      status: task.status,
      message: errorMessage,
      detail: getListingDetail(db, listingId),
    }, task.status === "PUBLISH_SUBMITTED" ? 200 : 202)
  }
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
      assertPublishPayloadHasOnlyPreparedImages(prepared.payload)
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
  let result
  try {
    result = await platformAdapter.publishListing({
      credentials: resolveSheinCredentials(db),
      payload: built.payload,
    })
  } catch (error) {
    const errorCode = normalizeText((error as { code?: unknown })?.code) || "PUBLISH_TRANSPORT_ERROR"
    const errorMessage = error instanceof Error ? error.message : String(error)
    markPublishTransportUnknown(db, {
      taskId,
      versionId: Number(version.id),
      listingId: listing.id,
      spuCode: normalizeText(listing.spu_code),
      versionNo: Number(version.version_no),
      errorCode,
      errorMessage,
    })
    throw new HTTPException(502, {
      message: `SHEIN 发布请求结果未知，请先同步平台状态后再处理：${errorMessage}`,
    })
  }
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
    : message || `SHEIN 发布失败（HTTP ${result.status}）`
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
    message: failureMessage,
    error_code: failureCode,
    error_message: failureMessage,
    response: result.payload,
    detail: getListingDetail(db, listingId),
  }, 502)
})

prePublish.post("/field-fills", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
    normalizeFillFieldValue(fieldKey, body.field_label, body.field_value),
    normalizeText(body.source ?? "MANUAL") || "MANUAL",
    body.confidence ?? null,
    JSON.stringify(body.payload ?? {}),
  )
  return c.json({ ok: true, scope_key: scopeKey })
})

prePublish.post("/ai-fill", async (c) => {
  requirePermission(c, "LISTING_WRITE")
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
  const warnings: Array<{ spu_code: string; message: string }> = []

  for (const row of readiness.items) {
    const titleNeedsAi = row.field_groups
      .flatMap((group) => group.fields)
      .find((field) => field.key === "title_en" && field.status === "NEEDS_AI")
    const descriptionNeedsAi = shouldGenerateProductDescription(row)
    const fieldsToFill = row.manual_fields
    if (!titleNeedsAi && !descriptionNeedsAi && fieldsToFill.length === 0) continue
    if (titleNeedsAi) {
      const titleValue = await safeAiTranslateTitle(row)
      if (titleValue) {
        persistFill({
          db,
          spuCode: row.spu_code,
          fieldKey: titleNeedsAi.key,
          fieldLabel: titleNeedsAi.label,
          fieldValue: titleValue,
          source: "AI_TRANSLATED",
          confidence: 0.78,
          payload: {
            title_cn: row.title_cn,
            category: row.category,
            context: "batch_ai_fill",
          },
        })
        saved.push({
          spu_code: row.spu_code,
          field_key: titleNeedsAi.key,
          field_label: titleNeedsAi.label,
          field_value: titleValue,
        })
      }
    }
        if (descriptionNeedsAi) {
          const productDescription = await safeAiGenerateProductDescription(row)
          if (productDescription) {
            persistFill({
          db,
          spuCode: row.spu_code,
          fieldKey: "product_description",
          fieldLabel: "商品描述",
          fieldValue: productDescription,
          source: "AI_DESCRIPTION",
          confidence: 0.74,
          payload: {
            title_cn: row.title_cn,
            category: row.category,
            context: "batch_ai_fill",
          },
        })
        saved.push({
          spu_code: row.spu_code,
          field_key: "product_description",
          field_label: "商品描述",
          field_value: productDescription,
            })
          }
        }
        for (const field of deterministicAttributeFillsForAiEnrich(row)) {
          const fieldValue = normalizeFillFieldValue(field.key, field.label, field.value)
          if (!fieldValue) continue
          persistFill({
            db,
            spuCode: row.spu_code,
            fieldKey: field.key,
            fieldLabel: field.label,
            fieldValue,
            source: normalizeText(field.source) || "RULE",
            confidence: field.confidence ?? 0.72,
            payload: {
              fallback: true,
              context: "batch_ai_fill",
              reason: field.note ?? "根据商品档案和 SHEIN 枚举确定性推荐。",
            },
          })
          saved.push({
            spu_code: row.spu_code,
            field_key: field.key,
            field_label: field.label,
            field_value: fieldValue,
          })
        }
        let aiFills: Array<Record<string, unknown>> = []
        try {
          aiFills = await callAiFill(row) as Array<Record<string, unknown>>
    } catch (error) {
      warnings.push({
        spu_code: row.spu_code,
        message: `AI 填写字段失败：${aiFillWarningMessage(error)}`,
      })
    }

    const byKey = new Map(aiFills.map((fill) => [String(fill.field_key), fill]))
    for (const field of fieldsToFill) {
      const aiFill = byKey.get(field.key)
      const fieldValue = safeAutomaticAttributeFillValue(field, row, aiFill)
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

  return c.json({ ok: true, saved_count: saved.length, warning_count: warnings.length, warnings, fills: saved })
})

export default prePublish
