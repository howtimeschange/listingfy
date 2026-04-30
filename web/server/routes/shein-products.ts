import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const sheinProducts = new Hono()

type SourceRow = Record<string, unknown>

type BucketReadiness = {
  completeness: number
  ready_field_count: number
  total_field_count: number
  missing_field_count: number
  needs_ai_count: number
  blocking_issues: string[]
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function likeQuery(value: string) {
  return `%${normalizeText(value)}%`
}

function readLimit(value: string | undefined, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: string | undefined) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function readCsv(value: string | undefined) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== "all"),
    ),
  )
}

function batchTerms(value: string | undefined) {
  return readCsv(value)
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

function buildMatchKey(row: SourceRow) {
  return [
    normalizeText(row.middle_class_name),
    normalizeText(row.subclass_name),
    normalizeText(row.gender_name),
    normalizeText(row.age_group_name),
  ].join("|")
}

function packageRule(row: SourceRow) {
  const text = [
    row.middle_class_name,
    row.subclass_name,
    row.fabric_type_name,
    row.length_name,
    row.deepdraw_title,
  ].map(normalizeText).join(" ")
  if (text.includes("鞋")) return "30*20*10cm"
  if (text.includes("内裤")) return "25*14*2cm"
  if (text.includes("毛衫") || text.includes("毛衣") || text.includes("厚") || text.includes("外套")) {
    return "35*25*1.5cm"
  }
  return "28*24*1cm"
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
        path: isSmallKid ? "儿童 > 男童（小）服装 > 男童（小）套装" : "儿童 > 男童（大）服装 > 男童（大）套装",
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
        path: isSmallKid ? "儿童 > 女童（小）服装 > 女童（小）套装" : "儿童 > 女童（大）服装 > 女童（大）套装",
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

function sourceRow(db: ReturnType<typeof getDb>, spuCode: string) {
  return db.prepare(`
    select
      spu.*,
      pkg.id as content_package_id,
      pkg.title as deepdraw_title,
      pkg.brand_name as deepdraw_brand_name,
      pkg.category_name as deepdraw_category_name,
      pkg.trade_path as deepdraw_trade_path,
      pkg.retail_price as deepdraw_retail_price,
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
    where spu.spu_code = ?
    order by matched_rule.priority asc, matched_rule.id desc
    limit 1
  `).get(spuCode) as SourceRow | undefined
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

function activeSizeConversions(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from size_conversion_rule
    where platform = 'SHEIN'
      and status = 'ACTIVE'
  `).all() as SourceRow[]
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of [...sizeKeys(row.local_size_code), ...sizeKeys(row.local_size_name)]) {
      keys.add(key)
    }
  }
  return keys
}

function activeWeights(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from product_weight_import
    where coalesce(status, 'ACTIVE') <> 'DELETED'
    order by updated_at desc, created_at desc, id desc
  `).all() as SourceRow[]
  const bySku = new Map<string, SourceRow>()
  for (const row of rows) {
    const skuCode = normalizeText(row.sku_code)
    if (skuCode && !bySku.has(skuCode)) bySku.set(skuCode, row)
  }
  return { bySku }
}

function skuRows(db: ReturnType<typeof getDb>, row: SourceRow) {
  const mdm = db.prepare(`
    select sku.*, skc.skc_code
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    where skc.spu_id = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(row.id) as SourceRow[]
  if (mdm.length) return mdm
  return db.prepare(`
    select csku.*, csku.price as price_tag
    from product_content_sku csku
    where csku.content_package_id = ?
    order by csku.skc_code, csku.size_code, csku.sku_code
  `).all(row.content_package_id ?? -1) as SourceRow[]
}

function skcRows(db: ReturnType<typeof getDb>, row: SourceRow) {
  const mdm = db.prepare(`
    select skc.*
    from product_skc skc
    where skc.spu_id = ?
    order by skc.skc_code
  `).all(row.id) as SourceRow[]
  if (mdm.length) return mdm
  return db.prepare(`
    select cskc.*
    from product_content_skc cskc
    where cskc.content_package_id = ?
    order by cskc.skc_code
  `).all(row.content_package_id ?? -1) as SourceRow[]
}

function latestListing(db: ReturnType<typeof getDb>, productSpuId: number) {
  return db.prepare(`
    select listing.*,
      (
        select max(version.version_no)
        from listing_publish_version version
        where version.listing_id = listing.id
      ) as latest_version_no
    from listing
    where listing.platform = 'SHEIN'
      and listing.product_spu_id = ?
    order by listing.updated_at desc, listing.id desc
    limit 1
  `).get(productSpuId) as SourceRow | undefined
}

function computeCompleteness({
  categoryReady,
  titleCn,
  titleEn,
  skuCount,
  skcCount,
  sizeMatchCount,
  weightRecordCount,
  imageStatus,
}: {
  categoryReady: boolean
  titleCn: string | null
  titleEn: string | null
  skuCount: number
  skcCount: number
  sizeMatchCount: number
  weightRecordCount: number
  imageStatus: string
}): BucketReadiness {
  const fields = [
    { key: "category", ready: categoryReady, ai: false },
    { key: "title_cn", ready: Boolean(titleCn), ai: false },
    { key: "title_en", ready: Boolean(titleEn), ai: true },
    { key: "sku", ready: skuCount > 0, ai: false },
    { key: "skc", ready: skcCount > 0, ai: false },
    { key: "size_conversion", ready: skuCount > 0 && sizeMatchCount >= skuCount, ai: false },
    { key: "weight", ready: skuCount > 0 && weightRecordCount >= skuCount, ai: false },
    { key: "image", ready: imageStatus === "READY", ai: false },
  ]
  const ready = fields.filter((field) => field.ready).length
  const missing = fields.filter((field) => !field.ready)
  return {
    completeness: Math.round((ready / fields.length) * 100),
    ready_field_count: ready,
    total_field_count: fields.length,
    missing_field_count: missing.length,
    needs_ai_count: missing.filter((field) => field.ai).length,
    blocking_issues: missing.map((field) => field.key),
  }
}

function computeBucketSnapshot(db: ReturnType<typeof getDb>, row: SourceRow) {
  const spus = String(row.spu_code)
  const category = resolveCategory(row)
  const skcs = skcRows(db, row)
  const skus = skuRows(db, row)
  const sizeConversionKeys = activeSizeConversions(db)
  const weights = activeWeights(db)
  const sizeMatchCount = skus.filter((sku) => {
    const keys = [...sizeKeys(sku.size_code), ...sizeKeys(sku.size_name)]
    return keys.some((key) => sizeConversionKeys.has(key))
  }).length
  const discountRow = db.prepare(`
    select *
    from supply_discount_rule
    where status = 'ACTIVE'
      and spu_code = ?
    order by id desc
    limit 1
  `).get(spus) as SourceRow | undefined
  const discount = Number(discountRow?.discount ?? 0.4)
  const priceTag = Number(row.price_tag ?? row.deepdraw_retail_price ?? 0)
  const weightRecordCount = skus.filter((sku) => weights.bySku.has(normalizeText(sku.sku_code))).length
  const imageStats = db.prepare(`
    select
      sum(case when asset_type in ('MAIN', 'COLOR_BLOCK', 'COLOR') then 1 else 0 end) as product_count,
      sum(case when source_kind in ('DETAIL_SCREENSHOT', 'DETAIL_MODULE') then 1 else 0 end) as detail_count
    from product_asset
    where spu_code = ?
  `).get(spus) as SourceRow
  const skcImageCount = db.prepare(`
    select count(distinct skc_code) as count
    from product_asset
    where spu_code = ?
      and source_kind = 'PICTURE'
      and asset_type in ('COLOR_BLOCK', 'COLOR', 'MAIN')
      and coalesce(normalized_url, '') <> ''
  `).get(spus) as SourceRow
  const titleCn = normalizeText(row.deepdraw_title) || normalizeText(row.listing_title_cn) || normalizeText(row.spu_name)
  const titleEnFill = db.prepare(`
    select field_value
    from listing_field_fill
    where status = 'ACTIVE'
      and spu_code = ?
      and field_key = 'title_en'
    order by updated_at desc, id desc
    limit 1
  `).get(spus) as SourceRow | undefined
  const titleEn = normalizeText(titleEnFill?.field_value) || normalizeText(row.listing_title_en)
  const productImageCount = Number(imageStats.product_count ?? 0)
  const detailImageCount = Number(imageStats.detail_count ?? 0)
  const imageStatus = productImageCount > 0 && Number(skcImageCount.count ?? 0) >= Math.max(1, Math.min(skcs.length, 1))
    ? detailImageCount > 0 ? "READY" : "NEEDS_DETAIL"
    : "PENDING"
  const missing: string[] = []
  if (!category.category_id) missing.push("category")
  if (!titleCn) missing.push("title_cn")
  if (!titleEn) missing.push("title_en")
  if (skus.length === 0) missing.push("sku")
  if (skus.length > 0 && sizeMatchCount < skus.length) missing.push("size_conversion")
  if (skus.length > 0 && weightRecordCount < skus.length) missing.push("weight")
  if (imageStatus !== "READY") missing.push("image")
  const readiness = computeCompleteness({
    categoryReady: Boolean(category.category_id),
    titleCn: titleCn || null,
    titleEn: titleEn || null,
    skuCount: skus.length,
    skcCount: skcs.length,
    sizeMatchCount,
    weightRecordCount,
    imageStatus,
  })
  const needsReview = category.status !== "READY" || !titleEn || missing.includes("image")
  const readinessStatus = missing.length === 0
    ? "READY"
    : needsReview
      ? "NEEDS_REVIEW"
      : "NEEDS_ENRICHMENT"
  const listing = latestListing(db, Number(row.id))
  return {
    product_spu_id: Number(row.id),
    spu_code: spus,
    category,
    title_cn: titleCn || null,
    title_en: titleEn || null,
    supply_discount: discount,
    supply_price_cny: priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null,
    retail_price_usd: priceTag > 0 ? Math.round(priceTag / 7.3) : null,
    package_size_text: packageRule(row),
    weight_record_count: weightRecordCount,
    size_match_count: sizeMatchCount,
    sku_count: skus.length,
    skc_count: skcs.length,
    image_status: imageStatus,
    readiness_status: readinessStatus,
    latest_listing_id: listing?.id ?? null,
    latest_version_no: listing?.latest_version_no ?? null,
    latest_publish_status: listing?.status ?? null,
    raw_payload_json: {
      match_key: buildMatchKey(row),
      brand_name: normalizeText(row.brand_name) || normalizeText(row.deepdraw_brand_name),
      mdm_category: [row.middle_class_name, row.subclass_name].map(normalizeText).filter(Boolean).join(" / "),
      deepdraw_category: normalizeText(row.deepdraw_category_name),
      product_image_count: productImageCount,
      detail_image_count: detailImageCount,
      skc_image_count: Number(skcImageCount.count ?? 0),
      missing,
      field_completeness: readiness,
      weight_scope: weightRecordCount > 0 ? "SKU" : "MISSING",
    },
  }
}

export function refreshBucketProduct(db: ReturnType<typeof getDb>, spuCode: string) {
  const row = sourceRow(db, spuCode)
  if (!row) return null
  const snapshot = computeBucketSnapshot(db, row)
  db.prepare(`
    insert into shein_product_bucket (
      product_spu_id,
      spu_code,
      bucket_status,
      platform_category_id,
      product_type_id,
      platform_category_name,
      platform_category_path,
      category_source,
      category_status,
      title_cn,
      title_en,
      supply_discount,
      supply_price_cny,
      retail_price_usd,
      package_size_text,
      weight_record_count,
      size_match_count,
      sku_count,
      skc_count,
      image_status,
      readiness_status,
      latest_listing_id,
      latest_version_no,
      latest_publish_status,
      raw_payload_json,
      created_by,
      updated_at
    )
    values (?, ?, 'IN_BUCKET', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'codex', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(product_spu_id) do update set
      bucket_status = case when shein_product_bucket.bucket_status = 'REMOVED' then 'IN_BUCKET' else shein_product_bucket.bucket_status end,
      platform_category_id = excluded.platform_category_id,
      product_type_id = excluded.product_type_id,
      platform_category_name = excluded.platform_category_name,
      platform_category_path = excluded.platform_category_path,
      category_source = excluded.category_source,
      category_status = excluded.category_status,
      title_cn = excluded.title_cn,
      title_en = excluded.title_en,
      supply_discount = excluded.supply_discount,
      supply_price_cny = excluded.supply_price_cny,
      retail_price_usd = excluded.retail_price_usd,
      package_size_text = excluded.package_size_text,
      weight_record_count = excluded.weight_record_count,
      size_match_count = excluded.size_match_count,
      sku_count = excluded.sku_count,
      skc_count = excluded.skc_count,
      image_status = excluded.image_status,
      readiness_status = excluded.readiness_status,
      latest_listing_id = excluded.latest_listing_id,
      latest_version_no = excluded.latest_version_no,
      latest_publish_status = excluded.latest_publish_status,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `).run(
    snapshot.product_spu_id,
    snapshot.spu_code,
    snapshot.category.category_id,
    snapshot.category.product_type_id,
    snapshot.category.category_name,
    snapshot.category.path,
    snapshot.category.source,
    snapshot.category.status,
    snapshot.title_cn,
    snapshot.title_en,
    snapshot.supply_discount,
    snapshot.supply_price_cny,
    snapshot.retail_price_usd,
    snapshot.package_size_text,
    snapshot.weight_record_count,
    snapshot.size_match_count,
    snapshot.sku_count,
    snapshot.skc_count,
    snapshot.image_status,
    snapshot.readiness_status,
    snapshot.latest_listing_id,
    snapshot.latest_version_no,
    snapshot.latest_publish_status,
    JSON.stringify(snapshot.raw_payload_json),
  )
  return db.prepare(`
    select *
    from shein_product_bucket
    where product_spu_id = ?
  `).get(snapshot.product_spu_id) as SourceRow
}

function listWhere(query: {
  q?: string
  batchSearch?: string
  brandCodes?: string[]
  bucketStatuses?: string[]
  categoryStatuses?: string[]
  readinessStatuses?: string[]
  imageStatuses?: string[]
  categoryIds?: string[]
}) {
  const clauses = ["bucket.bucket_status <> 'REMOVED'"]
  const params: unknown[] = []
  const terms = batchTerms(query.batchSearch)
  if (query.q?.trim()) terms.push(query.q.trim())
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
      const like = likeQuery(term)
      params.push(like, like, like, like, like)
    }
  }
  const addIn = (values: string[] | undefined, sql: string) => {
    if (!values?.length) return
    clauses.push(`${sql} in (${values.map(() => "?").join(",")})`)
    params.push(...values)
  }
  addIn(query.brandCodes, "coalesce(spu.brand_code, pkg.brand_name)")
  addIn(query.bucketStatuses, "bucket.bucket_status")
  addIn(query.categoryStatuses, "bucket.category_status")
  addIn(query.readinessStatuses, "bucket.readiness_status")
  addIn(query.imageStatuses, "bucket.image_status")
  if (query.categoryIds?.length) {
    clauses.push(`cast(bucket.platform_category_id as text) in (${query.categoryIds.map(() => "?").join(",")})`)
    params.push(...query.categoryIds)
  }
  return { clause: `where ${clauses.join(" and ")}`, params }
}

const bucketSelect = `
  select
    bucket.*,
    spu.spu_name,
    spu.brand_code,
    spu.brand_name,
    spu.year,
    spu.season_name,
    spu.product_line_name,
    spu.middle_class_name,
    spu.subclass_name,
    spu.gender_name,
    pkg.title as deepdraw_title,
    pkg.brand_name as deepdraw_brand_name,
    pkg.category_name as deepdraw_category_name,
    (
      select normalized_url
      from product_asset asset
      where asset.spu_code = bucket.spu_code
        and asset.source_kind = 'PICTURE'
        and asset.asset_type in ('COLOR_BLOCK', 'COLOR', 'MAIN')
        and coalesce(asset.normalized_url, '') <> ''
      order by
        case
          when asset.place = 'TMALL' and asset.asset_type = 'COLOR_BLOCK' then 0
          when asset.place = 'TMALL' and asset.asset_type = 'COLOR' then 1
          when asset.place = 'TMALL' then 2
          else 3
        end,
        coalesce(asset.sort_no, 999999),
        asset.id
      limit 1
    ) as hero_image_url
  from shein_product_bucket bucket
  join product_spu spu on spu.id = bucket.product_spu_id
  left join product_content_package pkg on pkg.spu_code = bucket.spu_code
`

function ensureBucketHasRows(db: ReturnType<typeof getDb>) {
  const row = db.prepare("select count(*) as count from shein_product_bucket").get() as { count: number }
  if (Number(row.count ?? 0) === 0) {
    const rows = db.prepare(`
    select spu_code
    from product_spu
    order by updated_at desc, synced_at desc, spu_code desc
    limit 20
    `).all() as SourceRow[]
    for (const item of rows) refreshBucketProduct(db, String(item.spu_code))
    return
  }

  const staleRows = db.prepare(`
    select spu_code
    from shein_product_bucket
    where bucket_status <> 'REMOVED'
      and (
        sku_count = 0
        or skc_count = 0
        or json_type(raw_payload_json, '$.weight_scope') is null
        or json_extract(raw_payload_json, '$.weight_scope') = 'MISSING'
        or json_extract(raw_payload_json, '$.seeded_from') = 'listing'
      )
    order by updated_at desc, id desc
    limit 50
  `).all() as SourceRow[]
  for (const item of staleRows) refreshBucketProduct(db, String(item.spu_code))
}

sheinProducts.get("/", (c) => {
  const db = getDb()
  ensureBucketHasRows(db)
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere({
    q: c.req.query("q"),
    batchSearch: c.req.query("batch_search"),
    brandCodes: readCsv(c.req.query("brand_codes")),
    bucketStatuses: readCsv(c.req.query("bucket_statuses")),
    categoryStatuses: readCsv(c.req.query("category_statuses")),
    readinessStatuses: readCsv(c.req.query("readiness_statuses")),
    imageStatuses: readCsv(c.req.query("image_statuses")),
    categoryIds: readCsv(c.req.query("category_ids")),
  })
  const rows = db.prepare(`
    ${bucketSelect}
    ${clause}
    order by bucket.updated_at desc, bucket.id desc
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]
  const total = db.prepare(`
    select count(*) as count
    from shein_product_bucket bucket
    join product_spu spu on spu.id = bucket.product_spu_id
    left join product_content_package pkg on pkg.spu_code = bucket.spu_code
    ${clause}
  `).get(...params) as { count: number }
  const summary = db.prepare(`
    select
      count(*) as total,
      sum(case when readiness_status = 'READY' then 1 else 0 end) as ready_count,
      sum(case when readiness_status <> 'READY' then 1 else 0 end) as needs_work_count,
      coalesce(avg(cast(json_extract(raw_payload_json, '$.field_completeness.completeness') as numeric)), 0) as avg_completeness,
      sum(cast(coalesce(json_extract(raw_payload_json, '$.field_completeness.missing_field_count'), 0) as integer)) as missing_field_count,
      sum(cast(coalesce(json_extract(raw_payload_json, '$.field_completeness.needs_ai_count'), 0) as integer)) as needs_ai_count,
      sum(case when latest_listing_id is not null then 1 else 0 end) as drafted_count
    from shein_product_bucket
    where bucket_status <> 'REMOVED'
  `).get() as SourceRow
  return c.json({
    items: rows,
    summary,
    pagination: {
      total: total.count,
      limit,
      offset,
    },
  })
})

sheinProducts.get("/filters", (c) => {
  const db = getDb()
  ensureBucketHasRows(db)
  const categories = db.prepare(`
    select
      platform_category_id as category_id,
      product_type_id,
      platform_category_name as category_name,
      platform_category_path as path,
      count(*) as count
    from shein_product_bucket
    where bucket_status <> 'REMOVED'
      and platform_category_id is not null
    group by platform_category_id, product_type_id, platform_category_name, platform_category_path
    order by count desc, platform_category_name
  `).all() as SourceRow[]
  const brands = db.prepare(`
    select
      coalesce(spu.brand_code, pkg.brand_name) as brand_code,
      coalesce(spu.brand_name, pkg.brand_name) as brand_name,
      count(*) as count
    from shein_product_bucket bucket
    join product_spu spu on spu.id = bucket.product_spu_id
    left join product_content_package pkg on pkg.spu_code = bucket.spu_code
    where bucket.bucket_status <> 'REMOVED'
    group by coalesce(spu.brand_code, pkg.brand_name), coalesce(spu.brand_name, pkg.brand_name)
    order by count desc, brand_name
  `).all() as SourceRow[]
  return c.json({
    categories,
    brands,
    bucket_statuses: ["IN_BUCKET", "DRAFTED", "PUBLISHED", "PAUSED"],
    category_statuses: ["READY", "NEEDS_REVIEW", "NEEDS_SKC_REVIEW", "MISSING"],
    readiness_statuses: ["READY", "NEEDS_REVIEW", "NEEDS_ENRICHMENT", "PENDING"],
    image_statuses: ["READY", "NEEDS_DETAIL", "PENDING"],
  })
})

sheinProducts.post("/import", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    spu_codes?: unknown
    batch_search?: unknown
  }
  const rawCodes = Array.isArray(body.spu_codes)
    ? body.spu_codes
    : typeof body.spu_codes === "string"
      ? batchTerms(body.spu_codes)
      : []
  const codes = Array.from(new Set([
    ...rawCodes.map(normalizeText),
    ...batchTerms(String(body.batch_search ?? "")),
  ].filter(Boolean)))
  if (codes.length === 0) {
    throw new HTTPException(400, { message: "请先选择或输入款号" })
  }
  const imported: SourceRow[] = []
  const missing: string[] = []
  const transaction = db.transaction(() => {
    for (const code of codes) {
      const bucket = refreshBucketProduct(db, code)
      if (bucket) imported.push(bucket)
      else missing.push(code)
    }
  })
  transaction()
  return c.json({
    ok: true,
    imported_count: imported.length,
    missing,
    items: imported,
  })
})

sheinProducts.post("/:spuCode/refresh", (c) => {
  const db = getDb()
  const bucket = refreshBucketProduct(db, c.req.param("spuCode"))
  if (!bucket) {
    throw new HTTPException(404, { message: "商品档案不存在，无法刷新 SHEIN 分桶" })
  }
  return c.json({ ok: true, item: bucket })
})

sheinProducts.delete("/:spuCode", (c) => {
  const db = getDb()
  const result = db.prepare(`
    update shein_product_bucket
    set bucket_status = 'REMOVED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where spu_code = ?
  `).run(c.req.param("spuCode"))
  return c.json({ ok: true, changed: result.changes })
})

export default sheinProducts
