import path from "node:path"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import {
  getDeepdrawProduct,
  resolveDeepdrawConfig,
} from "../../../scripts/lib/deepdraw_client.mjs"
import { importDeepdrawPayloads } from "../../../scripts/lib/deepdraw_content_importer.mjs"
import {
  BRAND_MAPPINGS,
  DEEPDRAW_TENANT_OPTIONS,
} from "../../../scripts/lib/brand_mapping.mjs"
import { queryMdmProduct } from "../../../scripts/lib/mdm_client.mjs"
import { importMdmProductRows } from "../../../scripts/lib/mdm_product_importer.mjs"
import { createProductArchiveSyncQueue } from "../../../scripts/lib/product_archive_sync_queue.mjs"

const productArchives = new Hono()

const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()

type ProductArchiveListRow = {
  mdm_synced_at?: string | null
  deepdraw_synced_at?: string | null
  [key: string]: unknown
}

type SourceRow = {
  id: number
  synced_at?: string | null
  [key: string]: unknown
}

type DeepdrawPayload = {
  code?: unknown
  reason?: string
  message?: string
  body?: {
    code?: unknown
    [key: string]: unknown
  }
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function statusForSource(syncedAt: string | null | undefined) {
  return syncedAt ? "SYNCED" : "MISSING"
}

function readLimit(value: string | undefined) {
  const limit = Number(value ?? 50)
  if (!Number.isFinite(limit)) return 50
  return Math.max(1, Math.min(200, limit))
}

function readOffset(value: string | undefined) {
  const offset = Number(value ?? 0)
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, offset)
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes("MDM_APP_ID")
    || message.includes("MDM_APP_KEY")
    || message.includes("DeepDraw credential")
  ) {
    return 400
  }
  return 500
}

function readIntervalMs(value: unknown) {
  const number = Number(value ?? process.env.PRODUCT_ARCHIVE_SYNC_INTERVAL_MS ?? 1500)
  if (!Number.isFinite(number)) return 1500
  return Math.max(0, Math.min(60000, Math.floor(number)))
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
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

function packageRule(row: SourceRow | null) {
  const text = [
    row?.middle_class_name,
    row?.subclass_name,
    row?.fabric_type_name,
    row?.length_name,
  ].map(normalizeText).join(" ")
  if (text.includes("鞋")) return "30*20*10cm"
  if (text.includes("内裤")) return "25*14*2cm"
  if (text.includes("毛衫") || text.includes("毛衣") || text.includes("厚") || text.includes("外套")) {
    return "35*25*1.5cm"
  }
  return "28*24*1cm"
}

function enrichArchiveSkus(
  db: ReturnType<typeof getDb>,
  spu: SourceRow | null,
  skus: SourceRow[],
) {
  if (!spu || skus.length === 0) return skus

  const sizeRows = db.prepare(`
    select *
    from size_conversion_rule
    where platform = 'SHEIN'
      and status = 'ACTIVE'
  `).all() as SourceRow[]
  const sizeMap = new Map<string, SourceRow>()
  for (const row of sizeRows) {
    for (const key of [...sizeKeys(row.local_size_code), ...sizeKeys(row.local_size_name)]) {
      sizeMap.set(key, row)
    }
  }

  const discountRow = db.prepare(`
    select *
    from supply_discount_rule
    where status = 'ACTIVE'
      and spu_code = ?
    order by id desc
    limit 1
  `).get(spu.spu_code) as SourceRow | undefined
  const discount = Number(discountRow?.discount ?? 0.4)
  const packageSize = packageRule(spu)
  const weightRows = db.prepare(`
    select *
    from product_weight_import
    where spu_code = ?
       or skc_code in (${skus.map(() => "?").join(",") || "null"})
       or sku_code in (${skus.map(() => "?").join(",") || "null"})
    order by created_at desc, id desc
  `).all(
    spu.spu_code,
    ...skus.map((sku) => sku.skc_code),
    ...skus.map((sku) => sku.sku_code),
  ) as SourceRow[]
  const weightBySku = new Map<string, SourceRow>()
  const weightBySkc = new Map<string, SourceRow>()
  let weightBySpu: SourceRow | null = null
  for (const row of weightRows) {
    const skuCode = normalizeText(row.sku_code)
    const skcCode = normalizeText(row.skc_code)
    if (skuCode && !weightBySku.has(skuCode)) weightBySku.set(skuCode, row)
    if (skcCode && !weightBySkc.has(skcCode)) weightBySkc.set(skcCode, row)
    if (!weightBySpu && normalizeText(row.spu_code) === normalizeText(spu.spu_code)) weightBySpu = row
  }

  return skus.map((sku) => {
    const sizeRule = [...sizeKeys(sku.size_code), ...sizeKeys(sku.size_name)]
      .map((key) => sizeMap.get(key))
      .find(Boolean)
    const priceTag = Number(sku.price_tag ?? spu.price_tag ?? 0)
    const weight = weightBySku.get(normalizeText(sku.sku_code))
      ?? weightBySkc.get(normalizeText(sku.skc_code))
      ?? weightBySpu
    return {
      ...sku,
      shein_size_name: sku.shein_size_name ?? sizeRule?.shein_size_value ?? null,
      supply_discount: sku.supply_discount ?? discount,
      supply_price_cny: sku.supply_price_cny ?? (priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null),
      suggested_retail_price_usd: sku.suggested_retail_price_usd ?? (priceTag > 0 ? Math.round(priceTag / 7.3) : null),
      gross_weight_g: sku.gross_weight_g ?? weight?.package_weight_g ?? null,
      package_size_text: sku.package_size_text ?? packageSize,
    }
  })
}

function contentSkuToArchiveSku(row: SourceRow) {
  return {
    id: row.id,
    skc_code: row.skc_code,
    sku_code: row.sku_code,
    sku_name: null,
    size_code: row.size_code,
    size_name: row.size_name,
    shein_size_name: null,
    ean_code: row.barcode,
    inner_code: row.seller_code,
    supplier_product_code: row.seller_code,
    price_tag: row.price,
    supply_price_cny: null,
    suggested_retail_price_usd: null,
    gross_weight_g: null,
    supply_discount: null,
    package_size_text: null,
    status_name: null,
  }
}

async function syncMdmProduct(db: ReturnType<typeof getDb>, spuCode: string) {
  const startedAt = new Date().toISOString()
  const result = await queryMdmProduct({ spuCode })
  const finishedAt = new Date().toISOString()
  const summary = importMdmProductRows(db, {
    spuCode,
    spuRows: result.spuRows,
    skuRows: result.skuRows,
    syncedAt: finishedAt,
    manifest: {
      batch_no: `web-mdm-${spuCode}-${Date.now()}`,
      started_at: startedAt,
      finished_at: finishedAt,
      request: { spuCode },
      counts: {
        spu: result.spuRows.length,
        sku: result.skuRows.length,
      },
      raw: result.raw,
    },
  })

  return {
    ok: true,
    source: "MDM",
    spu_code: spuCode,
    ...summary,
  }
}

async function syncDeepdrawProduct(
  db: ReturnType<typeof getDb>,
  spuCode: string,
  options: { deepdrawTenantName?: string | null } = {},
) {
  const startedAt = new Date().toISOString()
  const config = resolveDeepdrawConfig({
    projectRoot: PROJECT_ROOT,
    tenantName: options.deepdrawTenantName ?? undefined,
  })
  const result = await getDeepdrawProduct({
    config,
    productCode: spuCode,
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
  })
  const payload = (
    result.payload && typeof result.payload === "object"
      ? result.payload
      : { message: String(result.payload ?? "") }
  ) as DeepdrawPayload
  const body = payload.body
  if (!result.ok || !body) {
    throw new Error(
      payload.reason
        ?? payload.message
        ?? `DeepDraw request failed with HTTP ${result.status}`,
    )
  }

  const finishedAt = new Date().toISOString()
  const manifest = {
    batch_no: `web-deepdraw-${spuCode}-${Date.now()}`,
    started_at: startedAt,
    finished_at: finishedAt,
    requested_codes: [spuCode],
    deepdraw_tenant_name: config.tenantName,
    deepdraw_merchant_id: config.merchantId,
    counts: {
      requested: 1,
      success: 1,
      failed: 0,
    },
    products: [
      {
        productCode: spuCode,
        httpStatus: result.status,
        requestId: result.requestId,
        responseCode: payload.code ?? null,
        returnedCode: body.code ?? null,
      },
    ],
  }
  const summary = importDeepdrawPayloads(db, {
    payloads: [{ productCode: spuCode, payload: result.payload }],
    sourceDir: `web-sync/deepdraw/${spuCode}`,
    manifest,
    syncedAt: finishedAt,
  })

  return {
    ok: true,
    source: "DEEPDRAW",
    spu_code: spuCode,
    deepdraw_tenant_name: config.tenantName,
    deepdraw_merchant_id: config.merchantId,
    ...summary,
  }
}

const syncQueue = createProductArchiveSyncQueue({
  syncOne: async ({ source, spuCode, options }) => {
    const db = getDb()
    return source === "mdm"
      ? syncMdmProduct(db, spuCode)
      : syncDeepdrawProduct(db, spuCode, options)
  },
})

const codesCte = `
  with product_codes as (
    select spu_code from product_spu
    union
    select spu_code from product_content_package
  )
`

const listSelect = `
  select
    c.spu_code,
    spu.spu_name,
    spu.listing_title_cn,
    coalesce(title_fill.field_value, spu.listing_title_en) as listing_title_en,
    spu.shein_spu_code,
    spu.shein_category_name,
    matched_rule.id as matched_category_rule_id,
    matched_rule.source as matched_category_rule_source,
    matched_rule.match_key as matched_category_match_key,
    matched_rule.shein_category_id as matched_shein_category_id,
    matched_rule.shein_product_type_id as matched_shein_product_type_id,
    matched_category.category_name as matched_shein_category_name,
    matched_category.path as matched_shein_category_path,
    ai_suggestion.id as suggested_category_suggestion_id,
    ai_suggestion.source as suggested_category_rule_source,
    ai_suggestion.shein_category_id as suggested_shein_category_id,
    ai_suggestion.shein_product_type_id as suggested_shein_product_type_id,
    suggested_category.category_name as suggested_shein_category_name,
    suggested_category.path as suggested_shein_category_path,
    spu.old_style_code,
    spu.deepdraw_info_status,
    spu.brand_name as mdm_brand_name,
    spu.brand_code as mdm_brand_code,
    spu.year,
    spu.season_name,
    spu.product_line_name,
    spu.middle_class_name,
    spu.subclass_name,
    spu.gender_name,
    spu.age_group_name,
    spu.status_name as mdm_status_name,
    spu.synced_at as mdm_synced_at,
    pkg.id as content_package_id,
    pkg.title as deepdraw_title,
    pkg.brand_name as deepdraw_brand_name,
    pkg.category_name as deepdraw_category_name,
    pkg.complete as deepdraw_complete,
    pkg.synced_at as deepdraw_synced_at,
    (
      select count(*) from product_skc skc
      where skc.spu_id = spu.id
    ) as mdm_skc_count,
    (
      select count(*) from product_sku sku
      join product_skc skc on skc.id = sku.skc_id
      where skc.spu_id = spu.id
    ) as mdm_sku_count,
    (
      select count(*) from product_content_skc content_skc
      where content_skc.content_package_id = pkg.id
    ) as deepdraw_skc_count,
    (
      select count(*) from product_content_sku content_sku
      where content_sku.content_package_id = pkg.id
    ) as deepdraw_sku_count,
    (
      select count(*) from product_asset asset
      where asset.spu_code = c.spu_code
        and asset.source_kind = 'PICTURE'
        and asset.asset_type in ('MAIN', 'COLOR_BLOCK')
    ) as product_image_count,
    (
      select count(*) from product_asset asset
      where asset.spu_code = c.spu_code
        and asset.source_kind in ('DETAIL_SCREENSHOT', 'DETAIL_MODULE')
    ) as detail_image_count,
    coalesce(discount_rule.discount, 0.4) as publish_supply_discount,
    case
      when coalesce(spu.price_tag, pkg.retail_price) is not null
      then round(coalesce(spu.price_tag, pkg.retail_price) * coalesce(discount_rule.discount, 0.4), 2)
      else null
    end as publish_supply_price_cny,
    case
      when coalesce(spu.price_tag, pkg.retail_price) is not null
      then round(coalesce(spu.price_tag, pkg.retail_price) / 7.3, 0)
      else null
    end as publish_retail_price_usd,
    case
      when coalesce(spu.middle_class_name, '') || coalesce(spu.subclass_name, '') like '%鞋%' then '30*20*10cm'
      when coalesce(spu.subclass_name, '') like '%内裤%' then '25*14*2cm'
      when coalesce(spu.middle_class_name, '') || coalesce(spu.subclass_name, '') || coalesce(spu.fabric_type_name, '') like '%毛%'
        then '35*25*1.5cm'
      else '28*24*1cm'
    end as publish_package_size_text,
    (
      select count(*)
      from product_weight_import weight
      where weight.spu_code = c.spu_code
    ) as publish_weight_record_count,
    (
      select normalized_url from product_asset asset
      where asset.spu_code = c.spu_code
        and asset.source_kind = 'PICTURE'
        and asset.asset_type in ('MAIN', 'COLOR_BLOCK')
      order by
        case asset.asset_type
          when 'MAIN' then 0
          when 'COLOR_BLOCK' then 1
          else 2
        end,
        coalesce(asset.sort_no, 999999),
        asset.id
      limit 1
    ) as hero_image_url
  from product_codes c
  left join product_spu spu on spu.spu_code = c.spu_code
  left join product_content_package pkg on pkg.spu_code = c.spu_code
  left join listing_field_fill title_fill
    on title_fill.status = 'ACTIVE'
    and title_fill.spu_code = c.spu_code
    and title_fill.field_key = 'title_en'
  left join supply_discount_rule discount_rule
    on discount_rule.status = 'ACTIVE'
    and discount_rule.spu_code = c.spu_code
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
  left join (
    select
      id,
      match_key,
      shein_category_id,
      shein_product_type_id,
      'AI 建议' as source
    from mdm_shein_category_ai_suggestion ai_suggestion
    where ai_suggestion.review_status = 'PENDING'
  ) ai_suggestion
    on ai_suggestion.match_key = (
      coalesce(spu.middle_class_name, '') || '|' ||
      coalesce(spu.subclass_name, '') || '|' ||
      coalesce(spu.gender_name, '') || '|' ||
      coalesce(spu.age_group_name, '')
    )
  left join v_shein_leaf_category suggested_category
    on suggested_category.category_id = ai_suggestion.shein_category_id
    and suggested_category.product_type_id = ai_suggestion.shein_product_type_id
`

function listWhere({
  query,
  brand,
}: {
  query?: string
  brand?: string
}) {
  const clauses: string[] = []
  const params: unknown[] = []

  if (query?.trim()) {
    const like = likeQuery(query)
    clauses.push(`
      (
        c.spu_code like ?
        or spu.spu_name like ?
        or spu.listing_title_cn like ?
        or spu.listing_title_en like ?
        or spu.shein_category_name like ?
        or spu.old_style_code like ?
        or spu.deepdraw_info_status like ?
        or spu.brand_name like ?
        or spu.brand_code like ?
        or spu.product_line_name like ?
        or pkg.title like ?
        or pkg.brand_name like ?
        or pkg.category_name like ?
      )
    `)
    params.push(like, like, like, like, like, like, like, like, like, like, like, like, like)
  }

  if (brand?.trim() && brand !== "all") {
    clauses.push("(spu.brand_code = ? or spu.brand_name = ? or pkg.brand_name = ?)")
    params.push(brand, brand, brand)
  }

  return {
    clause: clauses.length ? `where ${clauses.join(" and ")}` : "",
    params,
  }
}

productArchives.get("/", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const brand = c.req.query("brand")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere({ query: q, brand })

  const rows = db.prepare(`
    ${codesCte}
    ${listSelect}
    ${clause}
    order by coalesce(pkg.synced_at, spu.synced_at, spu.updated_at, pkg.updated_at) desc,
      c.spu_code desc
    limit ? offset ?
  `).all(...params, limit, offset) as ProductArchiveListRow[]

  const items = rows.map((row) => ({
    ...row,
    mdm_status: statusForSource(row.mdm_synced_at),
    deepdraw_status: statusForSource(row.deepdraw_synced_at),
  }))

  const total = db.prepare(`
    ${codesCte}
    select count(*) as count
    from product_codes c
    left join product_spu spu on spu.spu_code = c.spu_code
    left join product_content_package pkg on pkg.spu_code = c.spu_code
    ${clause}
  `).get(...params) as { count: number }

  return c.json({
    items,
    pagination: {
      total: total.count,
      limit,
      offset,
    },
  })
})

productArchives.get("/summary", (c) => {
  const db = getDb()
  const row = db.prepare(`
    ${codesCte}
    select
      count(*) as total,
      sum(case when spu.id is not null then 1 else 0 end) as mdm_count,
      sum(case when pkg.id is not null then 1 else 0 end) as deepdraw_count,
      sum(case when spu.id is not null and pkg.id is not null then 1 else 0 end) as complete_count
    from product_codes c
    left join product_spu spu on spu.spu_code = c.spu_code
    left join product_content_package pkg on pkg.spu_code = c.spu_code
  `).get()
  return c.json(row)
})

productArchives.get("/config", (c) => c.json({
  brands: BRAND_MAPPINGS,
  deepdraw_tenants: DEEPDRAW_TENANT_OPTIONS,
}))

productArchives.get("/sync-jobs/:jobId", (c) => {
  const job = syncQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "Sync job not found" })
  }
  return c.json(job)
})

productArchives.post("/sync-jobs", async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    source?: string
    codes?: unknown
    rawCodes?: unknown
    intervalMs?: unknown
    deepdrawTenantName?: string
  }

  try {
    const job = syncQueue.enqueue({
      source: body.source,
      rawCodes: body.codes ?? body.rawCodes,
      intervalMs: readIntervalMs(body.intervalMs),
      options: {
        deepdrawTenantName: body.deepdrawTenantName,
      },
    })
    return c.json(job, 202)
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

productArchives.get("/:spuCode", (c) => {
  const db = getDb()
  const spuCode = c.req.param("spuCode")

  const spu = (db.prepare(`
    select
      spu.*,
      matched_rule.id as matched_category_rule_id,
      matched_rule.source as matched_category_rule_source,
      matched_rule.match_key as matched_category_match_key,
      matched_rule.shein_category_id as matched_shein_category_id,
      matched_rule.shein_product_type_id as matched_shein_product_type_id,
      matched_category.category_name as matched_shein_category_name,
      matched_category.path as matched_shein_category_path,
      ai_suggestion.id as suggested_category_suggestion_id,
      ai_suggestion.source as suggested_category_rule_source,
      ai_suggestion.shein_category_id as suggested_shein_category_id,
      ai_suggestion.shein_product_type_id as suggested_shein_product_type_id,
      suggested_category.category_name as suggested_shein_category_name,
      suggested_category.path as suggested_shein_category_path
    from product_spu spu
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
    left join (
      select
        id,
        match_key,
        shein_category_id,
        shein_product_type_id,
        'AI 建议' as source
      from mdm_shein_category_ai_suggestion ai_suggestion
      where ai_suggestion.review_status = 'PENDING'
    ) ai_suggestion
      on ai_suggestion.match_key = (
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
  `).get(spuCode) as SourceRow | undefined) ?? null

  const contentPackage = (db.prepare(`
    select * from product_content_package
    where spu_code = ?
    order by updated_at desc, id desc
    limit 1
  `).get(spuCode) as SourceRow | undefined) ?? null

  if (!spu && !contentPackage) {
    throw new HTTPException(404, { message: `Product archive not found: ${spuCode}` })
  }

  const skcs = db.prepare(`
    select skc.*, count(sku.id) as sku_count
    from product_skc skc
    left join product_sku sku on sku.skc_id = skc.id
    where skc.spu_id = ?
    group by skc.id
    order by skc.skc_code
  `).all(spu?.id ?? -1)

  const skus = db.prepare(`
    select sku.*, skc.skc_code, skc.color_name as skc_color_name
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    where skc.spu_id = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(spu?.id ?? -1)

  const contentPackageId = contentPackage?.id ?? -1
  const contentSkcs = db.prepare(`
    select * from product_content_skc
    where content_package_id = ?
    order by skc_code
  `).all(contentPackageId)

  const contentSkus = db.prepare(`
    select * from product_content_sku
    where content_package_id = ?
    order by skc_code, size_code, sku_code
  `).all(contentPackageId)

  const keyFields = db.prepare(`
    select * from product_content_field
    where content_package_id = ?
    order by is_key desc, field_name
  `).all(contentPackageId)

  const detailPages = db.prepare(`
    select * from product_content_detail_page
    where content_package_id = ?
    order by page_index
  `).all(contentPackageId)

  const sizeTables = db.prepare(`
    select * from product_content_size_table
    where content_package_id = ?
    order by table_index
  `).all(contentPackageId)

  const sizeTableRows = db.prepare(`
    select * from product_content_size_table_row
    where content_package_id = ?
    order by table_index, row_index
  `).all(contentPackageId)

  const productImages = db.prepare(`
    select * from product_asset
    where spu_code = ?
      and source_kind = 'PICTURE'
      and asset_type in ('MAIN', 'COLOR_BLOCK')
    order by
      case asset_type
        when 'MAIN' then 0
        when 'COLOR_BLOCK' then 1
        else 3
      end,
      coalesce(sort_no, 999999),
      id
  `).all(spuCode)

  const detailImages = db.prepare(`
    select * from product_asset
    where spu_code = ?
      and source_kind in ('DETAIL_SCREENSHOT', 'DETAIL_MODULE')
    order by coalesce(detail_page_index, 999999),
      case source_kind when 'DETAIL_SCREENSHOT' then 0 else 1 end,
      module_name,
      coalesce(module_index, sort_no, 999999),
      id
  `).all(spuCode)

  const storedTitleEn = db.prepare(`
    select field_value
    from listing_field_fill
    where status = 'ACTIVE'
      and spu_code = ?
      and field_key = 'title_en'
    order by updated_at desc, id desc
    limit 1
  `).get(spuCode) as { field_value?: string } | undefined
  const enrichedSpu = spu && storedTitleEn?.field_value
    ? { ...spu, listing_title_en: storedTitleEn.field_value }
    : spu
  const archiveSkus = (skus as SourceRow[]).length
    ? skus as SourceRow[]
    : (contentSkus as SourceRow[]).map(contentSkuToArchiveSku)
  const enrichedSkus = enrichArchiveSkus(db, enrichedSpu, archiveSkus)

  return c.json({
    spu_code: spuCode,
    spu: enrichedSpu,
    content_package: contentPackage,
    skcs,
    skus: enrichedSkus,
    content_skcs: contentSkcs,
    content_skus: contentSkus,
    key_fields: keyFields,
    detail_pages: detailPages,
    size_tables: sizeTables,
    size_table_rows: sizeTableRows,
    product_images: productImages,
    detail_images: detailImages,
    source_status: {
      mdm: statusForSource(spu?.synced_at),
      deepdraw: statusForSource(contentPackage?.synced_at),
    },
  })
})

productArchives.post("/:spuCode/sync/mdm", async (c) => {
  const db = getDb()
  const spuCode = c.req.param("spuCode")
  try {
    return c.json(await syncMdmProduct(db, spuCode))
  } catch (error) {
    return c.json({
      ok: false,
      source: "MDM",
      spu_code: spuCode,
      error: error instanceof Error ? error.message : String(error),
    }, errorStatus(error))
  }
})

productArchives.post("/:spuCode/sync/deepdraw", async (c) => {
  const db = getDb()
  const spuCode = c.req.param("spuCode")
  try {
    return c.json(await syncDeepdrawProduct(db, spuCode))
  } catch (error) {
    return c.json({
      ok: false,
      source: "DEEPDRAW",
      spu_code: spuCode,
      error: error instanceof Error ? error.message : String(error),
    }, errorStatus(error))
  }
})

export default productArchives
