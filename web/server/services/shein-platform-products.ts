import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { getDb } from "../db"
import { currentUser, type AuthUser } from "../lib/auth"
import { resolveSheinCredentials, type SheinCredentials } from "../lib/platform-config"
import { sheinAdapter } from "../platform-adapters"
import type { PlatformRequestResult } from "../platform-adapters/types"
import { upsertAuditStatusSnapshots } from "./shein-operations"

type JsonRecord = Record<string, unknown>

interface SheinPlatformContext {
  credentials: SheinCredentials
  platform: "SHEIN"
  platformAccountKey: string
  platformIntegrationId: number | null
}

interface ProductListInput {
  limit?: number
  offset?: number
  search?: string
  brand?: string
  category?: string
  site?: string
  includeDetails?: boolean | number | string
}

interface ProductSyncPlan {
  mode: "incremental" | "full"
  pageSize: number
  maxPages: number
  startPage: number
  syncDetails: boolean
  detailLimit: number
  listPayloadBase: JsonRecord
  incrementalWindowStart: string
}

interface LifecycleActor {
  id: number | null
  username: string | null
}

interface OperationInput {
  context: SheinPlatformContext
  operationType: string
  requestPayload: unknown
  actor?: LifecycleActor | null
  spuName?: string
  skcName?: string
  skuCode?: string
}

interface NormalizedListRow {
  spuName: string
  skcName: string
  skuCodeList: string[]
  supplierCode: string
  productName: string
  brandName: string
  categoryName: string
  raw: JsonRecord
}

interface NormalizedSite {
  mainSite: string
  mainSiteName: string
  siteAbbr: string
  siteName: string
  currency: string
  status: number | null
  symbolLeft: string
  symbolRight: string
  storeType: number | null
  raw: JsonRecord
}

interface SaleSiteDetail {
  siteAbbr: string
  siteName: string
  shelfStatus: number | null
  shelfStatusText: string
  firstShelfTime: string
  lastShelfTime: string
  link: string
  source: string
}

interface SkcSaleSiteDetail extends SaleSiteDetail {
  skcName: string
  skcSupplierCode: string
}

interface ProductFilterOption {
  value: string
  label: string
  count: number
}

interface ProductFilterOptions {
  brands: ProductFilterOption[]
  categories: ProductFilterOption[]
  sites: ProductFilterOption[]
}

interface ProductSummaryOptions {
  includeDetails?: boolean
}

interface NormalizedSku {
  skuCode: string
  supplierSku: string
  saleText: string
  mallState: number | null
  stopPurchase: number | null
  weight: number | null
  length: number | null
  width: number | null
  height: number | null
  currentCost: number | null
  currency: string
  costText: string
  priceText: string
  raw: JsonRecord
}

interface NormalizedSkc {
  skcName: string
  supplierCode: string
  saleText: string
  shelfText: string
  imageUrl: string | null
  skus: NormalizedSku[]
  raw: JsonRecord
}

interface NormalizedDetail {
  spuName: string
  supplierCode: string
  productName: string
  brandCode: string
  brandName: string
  categoryId: string
  categoryName: string
  productTypeId: string
  shelfText: string
  skcs: NormalizedSkc[]
  rawInfo: JsonRecord
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function recordValue(value: unknown): JsonRecord {
  if (isRecord(value)) return value
  if (typeof value !== "string" || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function arrayRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch {
    return []
  }
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value)
    if (text) return text
  }
  return ""
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function stringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => stringValue(item)).filter(Boolean)
  return normalizeText(value)
    .split(/[\s,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function parseJsonText(value: unknown) {
  return recordValue(value)
}

function responsePayload(result?: PlatformRequestResult | null) {
  return recordValue(result?.payload)
}

function responseInfo(result?: PlatformRequestResult | null) {
  return recordValue(responsePayload(result).info)
}

function responseCode(result?: PlatformRequestResult | null) {
  return firstString(responsePayload(result).code)
}

function responseMessage(result?: PlatformRequestResult | null) {
  return firstString(responsePayload(result).msg, responsePayload(result).message)
}

function responseTraceId(result?: PlatformRequestResult | null) {
  return firstString(responsePayload(result).traceId, responsePayload(result).trace_id)
}

function responseOk(result?: PlatformRequestResult | null) {
  const code = responseCode(result)
  return Boolean(result) && result.status >= 200 && result.status < 300 && (!code || code === "0")
}

function readLimit(value: unknown, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false
  }
  return fallback
}

function readListIncludeDetails(value: unknown) {
  return readBoolean(value, false)
}

function readPositiveInteger(value: unknown, fallback: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function actorFromUser(user: AuthUser | null | undefined): LifecycleActor | null {
  if (!user) return null
  return { id: user.id, username: user.username }
}

export function lifecycleActorFromContext(c: Parameters<typeof currentUser>[0]) {
  return actorFromUser(currentUser(c))
}

function platformContext(db: SyncPostgresDatabase): SheinPlatformContext {
  ensurePlatformProductNameColumns(db)
  const credentials = resolveSheinCredentials(db)
  return {
    credentials,
    platform: "SHEIN",
    platformIntegrationId: credentials.platformIntegrationId,
    platformAccountKey: credentials.platformIntegrationId
      ? `integration:${credentials.platformIntegrationId}`
      : `env:${credentials.openKeyId || "default"}`,
  }
}

function ensurePlatformProductNameColumns(db: SyncPostgresDatabase) {
  if (!db.tableHasColumn("shein_platform_product", "brand_name")) {
    db.exec("alter table shein_platform_product add column if not exists brand_name text")
  }
  if (!db.tableHasColumn("shein_platform_product", "category_name")) {
    db.exec("alter table shein_platform_product add column if not exists category_name text")
  }
  db.exec(`
    create index if not exists idx_shein_platform_product_brand_category
      on shein_platform_product(platform, platform_account_key, brand_name, category_name)
  `)
}

function multiText(value: unknown, textKey: string) {
  const rows = arrayRecords(value)
  const zh = rows.find((row) => stringValue(row.language).toLowerCase() === "zh-cn")
  const en = rows.find((row) => stringValue(row.language).toLowerCase() === "en")
  return firstString(zh?.[textKey], en?.[textKey], rows[0]?.[textKey])
}

function namedText(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) return ""
  return firstString(
    ...keys.map((key) => value[key]),
    ...keys.map((key) => multiText(value[`${key}MultiList`] ?? value[`${key}_multi_list`], key)),
  )
}

function brandNameFromRow(row: JsonRecord) {
  return firstString(
    row.brandName,
    row.brand_name,
    namedText(row.brandInfo, "brandName", "name"),
    namedText(row.brand_info, "brandName", "name"),
  )
}

function categoryNameFromRow(row: JsonRecord) {
  return firstString(
    row.categoryName,
    row.category_name,
    row.categoryNameZh,
    row.category_name_zh,
    row.leafCategoryName,
    row.leaf_category_name,
    namedText(row.categoryInfo, "categoryName", "name"),
    namedText(row.category_info, "categoryName", "name"),
    multiText(row.categoryMultiNameList ?? row.category_multi_name_list, "categoryName"),
    multiText(row.categoryMultiNameList ?? row.category_multi_name_list, "name"),
  )
}

function saleAttributeText(value: unknown) {
  return arrayRecords(value)
    .map((item) => {
      const name = multiText(item.attributeMultiList, "attributeName")
      const valueName = multiText(item.attributeValueMultiList, "attributeValueName")
      return [name, valueName || firstString(item.attributeValueId)].filter(Boolean).join(": ")
    })
    .filter(Boolean)
    .join(" / ")
}

function costText(value: unknown) {
  return arrayRecords(value)
    .map((item) => {
      const price = firstString(item.costPrice, item.cost)
      const currency = firstString(item.currency)
      return [price, currency].filter(Boolean).join(" ")
    })
    .filter(Boolean)
    .join(" / ")
}

function priceText(value: unknown) {
  return arrayRecords(value)
    .map((item) => {
      const special = firstString(item.specialPrice)
      const base = firstString(item.basePrice)
      const price = special || base
      const currency = firstString(item.currency)
      const site = firstString(item.site, item.siteAbbr)
      return [site, price && `${price} ${currency}`].filter(Boolean).join(" ")
    })
    .filter(Boolean)
    .join(" / ")
}

function shelfText(value: unknown) {
  const items = arrayRecords(value)
  if (!items.length) return ""
  const active = items.filter((item) => numberValue(item.shelfStatus ?? item.shelf_status) === 1)
  const sites = active.map((item) => firstString(item.siteAbbr, item.site_abbr)).filter(Boolean)
  if (active.length) return `上架 ${active.length} 站${sites.length ? `：${sites.slice(0, 4).join("、")}` : ""}`
  return "未上架"
}

function saleSiteStatusText(shelfStatus: number | null) {
  if (shelfStatus === 1) return "已上架"
  if (shelfStatus === 0) return "未上架"
  if (shelfStatus === 2) return "已下架"
  if (shelfStatus == null) return "未知"
  return `状态 ${shelfStatus}`
}

function mergeSaleSiteSources(existing: string, source: string) {
  const sources = new Set(
    [existing, source]
      .flatMap((item) => item.split(/\s*\/\s*/))
      .map((item) => item.trim())
      .filter(Boolean),
  )
  return Array.from(sources).join(" / ")
}

function pickEarlierText(existing: string, next: string) {
  if (!existing) return next
  if (!next) return existing
  return existing <= next ? existing : next
}

function pickLaterText(existing: string, next: string) {
  if (!existing) return next
  if (!next) return existing
  return existing >= next ? existing : next
}

function siteNameLookup(db: SyncPostgresDatabase, context: SheinPlatformContext) {
  const rows = db.prepare(`
    select site_abbr, site_name
    from shein_platform_site
    where platform = ?
      and platform_account_key = ?
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  return new Map(rows
    .map((row) => [stringValue(row.site_abbr), stringValue(row.site_name)] as const)
    .filter(([siteAbbr]) => siteAbbr))
}

function normalizeSaleSite(
  value: JsonRecord,
  source: string,
  siteNames: Map<string, string>,
): SaleSiteDetail | null {
  const siteAbbr = firstString(value.siteAbbr, value.site_abbr, value.site, value.siteCode, value.site_code)
  if (!siteAbbr) return null
  const shelfStatus = numberValue(value.shelfStatus ?? value.shelf_status)
  const siteName = firstString(value.siteName, value.site_name, siteNames.get(siteAbbr), siteAbbr)
  return {
    siteAbbr,
    siteName,
    shelfStatus,
    shelfStatusText: saleSiteStatusText(shelfStatus),
    firstShelfTime: firstString(value.firstShelfTime, value.first_shelf_time),
    lastShelfTime: firstString(value.lastShelfTime, value.last_shelf_time),
    link: firstString(value.link, value.productLink, value.product_link, value.goodsLink, value.goods_link),
    source,
  }
}

function mergeSaleSites(sites: SaleSiteDetail[]) {
  const byKey = new Map<string, SaleSiteDetail>()
  for (const site of sites) {
    const key = site.siteAbbr
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, site)
      continue
    }
    const shelfStatus = [existing.shelfStatus, site.shelfStatus].includes(1)
      ? 1
      : site.shelfStatus ?? existing.shelfStatus
    byKey.set(key, {
      siteAbbr: existing.siteAbbr,
      siteName: existing.siteName || site.siteName,
      shelfStatus,
      shelfStatusText: saleSiteStatusText(shelfStatus),
      firstShelfTime: pickEarlierText(existing.firstShelfTime, site.firstShelfTime),
      lastShelfTime: pickLaterText(existing.lastShelfTime, site.lastShelfTime),
      link: existing.link || site.link,
      source: mergeSaleSiteSources(existing.source, site.source),
    })
  }
  return Array.from(byKey.values()).sort((left, right) => {
    if (left.shelfStatus === 1 && right.shelfStatus !== 1) return -1
    if (left.shelfStatus !== 1 && right.shelfStatus === 1) return 1
    return `${left.siteAbbr} ${left.source}`.localeCompare(`${right.siteAbbr} ${right.source}`)
  })
}

export function skcSaleSitesFromProduct(
  skcs: JsonRecord[],
  siteNames: Map<string, string> = new Map(),
) {
  return skcs.flatMap((skc) => {
    const rawSkc = parseJsonText(skc.raw_payload_json)
    const skcName = firstString(skc.skc_name, rawSkc.skcName, rawSkc.skc_name)
    const skcSupplierCode = firstString(skc.supplier_code, rawSkc.supplierCode, rawSkc.supplier_code)
    const source = skcName || "SKC"
    return arrayRecords(rawSkc.shelfStatusInfoList ?? rawSkc.shelf_status_info_list)
      .map((item) => normalizeSaleSite(item, source, siteNames))
      .filter((site): site is SaleSiteDetail => Boolean(site))
      .map((site): SkcSaleSiteDetail => ({
        ...site,
        skcName,
        skcSupplierCode,
      }))
  }).sort((left, right) => {
    if (left.skcName !== right.skcName) return left.skcName.localeCompare(right.skcName)
    if (left.shelfStatus === 1 && right.shelfStatus !== 1) return -1
    if (left.shelfStatus !== 1 && right.shelfStatus === 1) return 1
    return left.siteAbbr.localeCompare(right.siteAbbr)
  })
}

export function saleSitesFromProduct(
  row: JsonRecord,
  skcs: JsonRecord[],
  siteNames: Map<string, string> = new Map(),
) {
  const rawInfo = rawInfoFromDetailPayload(parseJsonText(row.raw_detail_payload_json))
  const sites: SaleSiteDetail[] = []
  sites.push(
    ...arrayRecords(rawInfo.shelfStatusInfoList ?? rawInfo.shelf_status_info_list)
      .map((item) => normalizeSaleSite(item, "SPU", siteNames))
      .filter((site): site is SaleSiteDetail => Boolean(site)),
  )
  for (const skc of skcs) {
    const rawSkc = parseJsonText(skc.raw_payload_json)
    const source = firstString(skc.skc_name, rawSkc.skcName, rawSkc.skc_name, "SKC")
    sites.push(
      ...arrayRecords(rawSkc.shelfStatusInfoList ?? rawSkc.shelf_status_info_list)
        .map((item) => normalizeSaleSite(item, source, siteNames))
        .filter((site): site is SaleSiteDetail => Boolean(site)),
    )
  }
  return mergeSaleSites(sites)
}

function activeSaleSiteAbbrs(saleSites: SaleSiteDetail[]) {
  return Array.from(new Set(
    saleSites
      .filter((site) => site.shelfStatus === 1)
      .map((site) => site.siteAbbr)
      .filter(Boolean),
  )).sort()
}

function saleSiteSummary(saleSites: SaleSiteDetail[]) {
  if (!saleSites.length) return "详情同步后显示"
  const activeSites = activeSaleSiteAbbrs(saleSites)
  if (!activeSites.length) return "未上架"
  return `上架 ${activeSites.length} 站：${activeSites.slice(0, 4).join("、")}${activeSites.length > 4 ? "..." : ""}`
}

function productListData(info: JsonRecord) {
  return arrayRecords(info.data ?? info.list ?? info.records ?? info.items)
}

function productListTotal(result: PlatformRequestResult) {
  const info = responseInfo(result)
  return numberValue(info.total ?? info.totalCount ?? info.total_count ?? info.count)
}

function normalizeProductRows(result: PlatformRequestResult): NormalizedListRow[] {
  return productListData(responseInfo(result))
    .map((row) => {
      const skuCodeList = stringList(row.skuCodeList ?? row.sku_code_list ?? row.sku_codes ?? row.skuCode)
      return {
        spuName: firstString(row.spuName, row.spu_name),
        skcName: firstString(row.skcName, row.skc_name),
        skuCodeList,
        supplierCode: firstString(row.supplierCode, row.supplier_code),
        productName: firstString(row.productName, row.product_name, row.goodsName, row.goods_name),
        brandName: brandNameFromRow(row),
        categoryName: categoryNameFromRow(row),
        raw: row,
      }
    })
    .filter((row) => row.spuName)
}

function normalizeStoreSites(result: PlatformRequestResult): NormalizedSite[] {
  return arrayRecords(responseInfo(result).data).flatMap((main) => {
    const mainSite = firstString(main.main_site, main.mainSite)
    const mainSiteName = firstString(main.main_site_name, main.mainSiteName)
    return arrayRecords(main.sub_site_list ?? main.subSiteList).map((site) => ({
      mainSite,
      mainSiteName,
      siteAbbr: firstString(site.site_abbr, site.siteAbbr),
      siteName: firstString(site.site_name, site.siteName),
      currency: firstString(site.currency),
      status: numberValue(site.site_status ?? site.siteStatus),
      symbolLeft: firstString(site.symbol_left, site.symbolLeft),
      symbolRight: firstString(site.symbol_right, site.symbolRight),
      storeType: numberValue(site.store_type ?? site.storeType),
      raw: { main, site },
    }))
  }).filter((site) => site.siteAbbr)
}

function normalizeProductDetail(result: PlatformRequestResult): NormalizedDetail | null {
  const info = responseInfo(result)
  const spuName = firstString(info.spuName, info.spu_name)
  if (!spuName) return null

  const skcs = arrayRecords(info.skcInfoList ?? info.skc_info_list).map((skc) => {
    const skcImage = arrayRecords(skc.skcImageInfoList ?? skc.skc_image_info_list)[0]
    const skus = arrayRecords(skc.skuInfoList ?? skc.sku_info_list).map((sku) => {
      const costInfo = arrayRecords(sku.costInfoList ?? sku.cost_info_list)[0]
      return {
        skuCode: firstString(sku.skuCode, sku.sku_code),
        supplierSku: firstString(sku.supplierSku, sku.supplier_sku),
        saleText: saleAttributeText(sku.saleAttributeList ?? sku.sale_attribute_list),
        mallState: numberValue(sku.mallState ?? sku.mall_state),
        stopPurchase: numberValue(sku.stopPurchase ?? sku.stop_purchase),
        weight: numberValue(sku.weight),
        length: numberValue(sku.length),
        width: numberValue(sku.width),
        height: numberValue(sku.height),
        currentCost: numberValue(costInfo?.costPrice ?? costInfo?.cost),
        currency: firstString(costInfo?.currency),
        costText: costText(sku.costInfoList ?? sku.cost_info_list),
        priceText: priceText(sku.priceInfoList ?? sku.price_info_list),
        raw: sku,
      }
    }).filter((sku) => sku.skuCode)

    return {
      skcName: firstString(skc.skcName, skc.skc_name),
      supplierCode: firstString(skc.supplierCode, skc.supplier_code),
      saleText: saleAttributeText([skc]),
      shelfText: shelfText(skc.shelfStatusInfoList ?? skc.shelf_status_info_list),
      imageUrl: firstString(skcImage?.imageMediumUrl, skcImage?.imageUrl, skcImage?.imageSmallUrl) || null,
      skus,
      raw: skc,
    }
  }).filter((skc) => skc.skcName)

  return {
    spuName,
    supplierCode: firstString(info.supplierCode, info.supplier_code),
    productName: multiText(info.productMultiNameList ?? info.product_multi_name_list, "productName"),
    brandCode: firstString(info.brandCode, info.brand_code),
    brandName: brandNameFromRow(info),
    categoryId: firstString(info.categoryId, info.category_id),
    categoryName: categoryNameFromRow(info),
    productTypeId: firstString(info.productTypeId, info.product_type_id),
    shelfText: shelfText(info.shelfStatusInfoList ?? info.shelf_status_info_list),
    skcs,
    rawInfo: info,
  }
}

function ensureProduct(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  spuName: string,
) {
  db.prepare(`
    insert into shein_platform_product (
      platform,
      platform_account_key,
      platform_integration_id,
      spu_name,
      updated_at
    )
    values (?, ?, ?, ?, ?)
    on conflict(platform, platform_account_key, spu_name) do update set
      platform_integration_id = excluded.platform_integration_id,
      updated_at = excluded.updated_at
  `).run(context.platform, context.platformAccountKey, context.platformIntegrationId, spuName, nowIso())

  return db.prepare(`
    select *
    from shein_platform_product
    where platform = ?
      and platform_account_key = ?
      and spu_name = ?
  `).get(context.platform, context.platformAccountKey, spuName) as JsonRecord
}

function upsertProductFromList(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  row: NormalizedListRow,
) {
  db.prepare(`
    insert into shein_platform_product (
      platform,
      platform_account_key,
      platform_integration_id,
      spu_name,
      supplier_code,
      product_name,
      brand_name,
      category_name,
      raw_list_payload_json,
      last_list_synced_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(platform, platform_account_key, spu_name) do update set
      platform_integration_id = excluded.platform_integration_id,
      supplier_code = coalesce(nullif(excluded.supplier_code, ''), shein_platform_product.supplier_code),
      product_name = coalesce(nullif(excluded.product_name, ''), shein_platform_product.product_name),
      brand_name = coalesce(nullif(excluded.brand_name, ''), shein_platform_product.brand_name),
      category_name = coalesce(nullif(excluded.category_name, ''), shein_platform_product.category_name),
      raw_list_payload_json = excluded.raw_list_payload_json,
      last_list_synced_at = excluded.last_list_synced_at,
      updated_at = excluded.updated_at
  `).run(
    context.platform,
    context.platformAccountKey,
    context.platformIntegrationId,
    row.spuName,
    row.supplierCode,
    row.productName,
    row.brandName,
    row.categoryName,
    jsonText(row.raw),
    nowIso(),
    nowIso(),
  )
  return ensureProduct(db, context, row.spuName)
}

function upsertSkcFromList(db: SyncPostgresDatabase, productId: number, row: NormalizedListRow) {
  if (!row.skcName) return null
  db.prepare(`
    insert into shein_platform_skc (
      product_id,
      skc_name,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?)
    on conflict(product_id, skc_name) do update set
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `).run(productId, row.skcName, jsonText(row.raw), nowIso())

  return db.prepare(`
    select *
    from shein_platform_skc
    where product_id = ?
      and skc_name = ?
  `).get(productId, row.skcName) as JsonRecord | undefined
}

function upsertSkuFromList(db: SyncPostgresDatabase, skcId: number, skuCode: string, raw: JsonRecord) {
  db.prepare(`
    insert into shein_platform_sku (
      skc_id,
      sku_code,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?)
    on conflict(skc_id, sku_code) do update set
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `).run(skcId, skuCode, jsonText(raw), nowIso())
}

function refreshProductCounts(db: SyncPostgresDatabase, productId: number) {
  const skcCount = db.prepare(`
    select count(*) as count
    from shein_platform_skc
    where product_id = ?
  `).get(productId) as { count: number }
  const skuCount = db.prepare(`
    select count(*) as count
    from shein_platform_sku sku
    join shein_platform_skc skc on skc.id = sku.skc_id
    where skc.product_id = ?
  `).get(productId) as { count: number }

  db.prepare(`
    update shein_platform_product
    set skc_count = ?,
      sku_count = ?,
      updated_at = ?
    where id = ?
  `).run(Number(skcCount.count ?? 0), Number(skuCount.count ?? 0), nowIso(), productId)
}

export function persistProductListResult(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  result: PlatformRequestResult,
) {
  const rows = normalizeProductRows(result)
  const touchedProductIds = new Set<number>()
  for (const row of rows) {
    const product = upsertProductFromList(db, context, row)
    const productId = Number(product.id)
    touchedProductIds.add(productId)
    const skc = upsertSkcFromList(db, productId, row)
    if (skc) {
      const skcId = Number(skc.id)
      for (const skuCode of row.skuCodeList) {
        upsertSkuFromList(db, skcId, skuCode, row.raw)
      }
    }
  }
  for (const productId of touchedProductIds) refreshProductCounts(db, productId)
  if (touchedProductIds.size) clearProductFilterCache()
  return { rowCount: rows.length, productCount: touchedProductIds.size }
}

function latestListSyncTime(db: SyncPostgresDatabase, context: SheinPlatformContext) {
  const row = db.prepare(`
    select max(last_list_synced_at) as latest
    from shein_platform_product
    where platform = ?
      and platform_account_key = ?
  `).get(context.platform, context.platformAccountKey) as JsonRecord | undefined
  return stringValue(row?.latest)
}

function platformTimeText(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0")
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("")
}

function incrementalStartFromLatest(latest: string) {
  if (!latest) return ""
  const parsed = new Date(latest)
  if (Number.isNaN(parsed.getTime())) return ""
  parsed.setMinutes(parsed.getMinutes() - 10)
  return platformTimeText(parsed)
}

function syncPlanFromPayload(db: SyncPostgresDatabase, context: SheinPlatformContext, payload: unknown): ProductSyncPlan {
  const object = recordValue(payload)
  const mode = firstString(object.mode) === "full" ? "full" : "incremental"
  const pageSize = readPositiveInteger(object.pageSize ?? object.page_size, 50, 100)
  const defaultMaxPages = mode === "full" ? 200 : 50
  const maxPages = readPositiveInteger(object.maxPages ?? object.max_pages, defaultMaxPages, 1000)
  const startPage = readPositiveInteger(object.pageNum ?? object.page_num ?? object.startPage ?? object.start_page, 1, 100000)
  const syncDetails = readBoolean(object.syncDetails ?? object.sync_details, true)
  const detailLimit = readPositiveInteger(object.detailLimit ?? object.detail_limit, pageSize * maxPages, 100000)
  const latest = latestListSyncTime(db, context)
  const incrementalWindowStart = mode === "incremental" ? incrementalStartFromLatest(latest) : ""
  const listPayloadBase = compactObject({
    insertTimeStart: firstString(object.insertTimeStart, object.insert_time_start),
    insertTimeEnd: firstString(object.insertTimeEnd, object.insert_time_end),
    updateTimeStart: firstString(object.updateTimeStart, object.update_time_start) || incrementalWindowStart,
    updateTimeEnd: firstString(object.updateTimeEnd, object.update_time_end),
  })
  return {
    mode,
    pageSize,
    maxPages,
    startPage,
    syncDetails,
    detailLimit,
    listPayloadBase,
    incrementalWindowStart,
  }
}

export function persistProductDetailResult(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  result: PlatformRequestResult,
) {
  const detail = normalizeProductDetail(result)
  if (!detail) return { persisted: false, skcCount: 0, skuCount: 0 }

  const product = ensureProduct(db, context, detail.spuName)
  const productId = Number(product.id)
  db.prepare(`
    update shein_platform_product
    set platform_integration_id = ?,
      supplier_code = ?,
      product_name = ?,
      brand_code = ?,
      brand_name = ?,
      category_id = ?,
      category_name = ?,
      product_type_id = ?,
      shelf_status_text = ?,
      raw_detail_payload_json = ?,
      last_detail_synced_at = ?,
      updated_at = ?
    where id = ?
  `).run(
    context.platformIntegrationId,
    detail.supplierCode,
    detail.productName,
    detail.brandCode,
    detail.brandName,
    detail.categoryId,
    detail.categoryName,
    detail.productTypeId,
    detail.shelfText,
    jsonText(result.payload),
    nowIso(),
    nowIso(),
    productId,
  )

  db.prepare("delete from shein_platform_skc where product_id = ?").run(productId)
  let skuCount = 0
  for (const skc of detail.skcs) {
    const skcResult = db.prepare(`
      insert into shein_platform_skc (
        product_id,
        skc_name,
        supplier_code,
        sale_attribute_text,
        shelf_status_text,
        image_url,
        raw_payload_json,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      skc.skcName,
      skc.supplierCode,
      skc.saleText,
      skc.shelfText,
      skc.imageUrl,
      jsonText(skc.raw),
      nowIso(),
    )
    const skcId = Number(skcResult.lastInsertRowid)
    for (const sku of skc.skus) {
      db.prepare(`
        insert into shein_platform_sku (
          skc_id,
          sku_code,
          supplier_sku,
          sale_attribute_text,
          mall_state,
          stop_purchase,
          package_weight,
          package_length,
          package_width,
          package_height,
          cost_price,
          currency,
          cost_text,
          price_text,
          raw_payload_json,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        skcId,
        sku.skuCode,
        sku.supplierSku,
        sku.saleText,
        sku.mallState,
        sku.stopPurchase,
        sku.weight,
        sku.length,
        sku.width,
        sku.height,
        sku.currentCost,
        sku.currency,
        sku.costText,
        sku.priceText,
        jsonText(sku.raw),
        nowIso(),
      )
      skuCount += 1
    }
  }
  refreshProductCounts(db, productId)
  clearProductFilterCache()
  return { persisted: true, skcCount: detail.skcs.length, skuCount }
}

function persistSitesResult(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  result: PlatformRequestResult,
) {
  const sites = normalizeStoreSites(result)
  for (const site of sites) {
    db.prepare(`
      insert into shein_platform_site (
        platform,
        platform_account_key,
        platform_integration_id,
        main_site,
        main_site_name,
        site_abbr,
        site_name,
        currency,
        site_status,
        symbol_left,
        symbol_right,
        store_type,
        raw_payload_json,
        last_synced_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(platform, platform_account_key, site_abbr) do update set
        platform_integration_id = excluded.platform_integration_id,
        main_site = excluded.main_site,
        main_site_name = excluded.main_site_name,
        site_name = excluded.site_name,
        currency = excluded.currency,
        site_status = excluded.site_status,
        symbol_left = excluded.symbol_left,
        symbol_right = excluded.symbol_right,
        store_type = excluded.store_type,
        raw_payload_json = excluded.raw_payload_json,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `).run(
      context.platform,
      context.platformAccountKey,
      context.platformIntegrationId,
      site.mainSite,
      site.mainSiteName,
      site.siteAbbr,
      site.siteName,
      site.currency,
      site.status,
      site.symbolLeft,
      site.symbolRight,
      site.storeType,
      jsonText(site.raw),
      nowIso(),
      nowIso(),
    )
  }
  if (sites.length) clearProductFilterCache()
  return { siteCount: sites.length }
}

export function recordLifecycleOperation(db: SyncPostgresDatabase, input: OperationInput) {
  const result = db.prepare(`
    insert into shein_lifecycle_operation (
      platform,
      platform_account_key,
      platform_integration_id,
      operation_type,
      spu_name,
      skc_name,
      sku_code,
      status,
      request_payload_json,
      actor_user_id,
      actor_username,
      started_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
  `).run(
    input.context.platform,
    input.context.platformAccountKey,
    input.context.platformIntegrationId,
    input.operationType,
    input.spuName || null,
    input.skcName || null,
    input.skuCode || null,
    jsonText(input.requestPayload),
    input.actor?.id ?? null,
    input.actor?.username ?? null,
    nowIso(),
    nowIso(),
  )
  return Number(result.lastInsertRowid)
}

function finishLifecycleOperation(
  db: SyncPostgresDatabase,
  operationId: number,
  status: "SUCCESS" | "FAILED",
  result: PlatformRequestResult | null,
  error?: unknown,
) {
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null
  db.prepare(`
    update shein_lifecycle_operation
    set status = ?,
      response_payload_json = ?,
      response_code = ?,
      response_message = ?,
      trace_id = ?,
      error_message = ?,
      finished_at = ?,
      updated_at = ?
    where id = ?
  `).run(
    status,
    jsonText(result?.payload ?? {}),
    result ? responseCode(result) : null,
    result ? responseMessage(result) : null,
    result ? responseTraceId(result) : null,
    errorMessage,
    nowIso(),
    nowIso(),
    operationId,
  )
}

async function runLifecycleCall(
  operationType: string,
  requestPayload: unknown,
  actor: LifecycleActor | null | undefined,
  identifiers: Pick<OperationInput, "spuName" | "skcName" | "skuCode">,
  call: (context: SheinPlatformContext) => Promise<PlatformRequestResult>,
) {
  const db = getDb()
  const context = platformContext(db)
  const operationId = recordLifecycleOperation(db, {
    context,
    operationType,
    requestPayload,
    actor,
    ...identifiers,
  })
  try {
    const result = await call(context)
    finishLifecycleOperation(db, operationId, responseOk(result) ? "SUCCESS" : "FAILED", result)
    return { db, context, result, operationId }
  } catch (error) {
    finishLifecycleOperation(db, operationId, "FAILED", null, error)
    throw error
  }
}

function productWhereForContext(context: SheinPlatformContext) {
  return {
    platform: context.platform,
    platformAccountKey: context.platformAccountKey,
  }
}

const PRODUCT_FILTER_CACHE_TTL_MS = 30_000

const productFilterCache = new Map<string, { expiresAt: number; filters: ProductFilterOptions }>()

function productFilterCacheKey(context: SheinPlatformContext) {
  return `${context.platform}\u0001${context.platformAccountKey}`
}

function clearProductFilterCache() {
  productFilterCache.clear()
}

const productBrandDisplaySql = `coalesce(
  nullif(product.brand_name, ''),
  nullif(brand_rule.local_brand_name, ''),
  nullif(brand_rule.brand_name, '')
)`

const productCategoryDisplaySql = `coalesce(
  nullif(product.category_name, ''),
  nullif(category_mapping.category_name, '')
)`

const productDisplayJoinSql = `
  left join shein_brand_rule brand_rule
    on brand_rule.platform = product.platform
    and brand_rule.status = 'ACTIVE'
    and brand_rule.brand_code = product.brand_code
  left join channel_category category_mapping
    on category_mapping.platform = product.platform
    and cast(category_mapping.category_id as text) = product.category_id
`

const productDisplaySelectSql = `
  product.*,
  ${productBrandDisplaySql} as brand_display_name,
  ${productCategoryDisplaySql} as category_display_name
`

function serializeOperation(row: JsonRecord) {
  return {
    id: Number(row.id),
    operationType: stringValue(row.operation_type),
    spuName: stringValue(row.spu_name),
    skcName: stringValue(row.skc_name),
    skuCode: stringValue(row.sku_code),
    status: stringValue(row.status),
    responseCode: stringValue(row.response_code),
    responseMessage: stringValue(row.response_message),
    traceId: stringValue(row.trace_id),
    errorMessage: stringValue(row.error_message),
    actorUsername: stringValue(row.actor_username),
    requestPayload: parseJsonText(row.request_payload_json),
    responsePayload: parseJsonText(row.response_payload_json),
    startedAt: stringValue(row.started_at),
    finishedAt: stringValue(row.finished_at),
    createdAt: stringValue(row.created_at),
  }
}

function productOperations(db: SyncPostgresDatabase, context: SheinPlatformContext, spuName?: string, limit = 12) {
  const params: unknown[] = [context.platform, context.platformAccountKey]
  let where = "platform = ? and platform_account_key = ?"
  if (spuName) {
    where += " and (spu_name = ? or spu_name is null)"
    params.push(spuName)
  }
  params.push(limit)
  return db.prepare(`
    select *
    from shein_lifecycle_operation
    where ${where}
    order by created_at desc, id desc
    limit ?
  `).all(...params).map((row) => serializeOperation(row as JsonRecord))
}

function serializeProductSummary(
  db: SyncPostgresDatabase,
  row: JsonRecord,
  context?: SheinPlatformContext,
  siteNames?: Map<string, string>,
  options: ProductSummaryOptions = {},
) {
  const skcs = db.prepare(`
    select *
    from shein_platform_skc
    where product_id = ?
    order by id asc
  `).all(row.id) as JsonRecord[]
  const includeDetails = Boolean(options.includeDetails)
  const skuDetailRows = includeDetails
    ? db.prepare(`
      select sku.*, skc.id as skc_id
      from shein_platform_sku sku
      join shein_platform_skc skc on skc.id = sku.skc_id
      where skc.product_id = ?
      order by skc.id asc, sku.id asc
    `).all(row.id) as JsonRecord[]
    : []
  const skuDetailsBySkc = new Map<number, JsonRecord[]>()
  for (const sku of skuDetailRows) {
    const skcId = Number(sku.skc_id)
    skuDetailsBySkc.set(skcId, [...(skuDetailsBySkc.get(skcId) ?? []), sku])
  }
  const costRows = db.prepare(`
    select sku.cost_price, sku.currency, sku.cost_text
    from shein_platform_sku sku
    join shein_platform_skc skc on skc.id = sku.skc_id
    where skc.product_id = ?
      and (
        sku.cost_text is not null
        or sku.cost_price is not null
      )
    order by sku.id asc
  `).all(row.id) as JsonRecord[]
  const costValues = Array.from(new Set(costRows
    .map((sku) => {
      const explicit = stringValue(sku.cost_text)
      if (explicit) return explicit
      const cost = stringValue(sku.cost_price)
      const currency = stringValue(sku.currency)
      return [cost, currency].filter(Boolean).join(" ")
    })
    .filter(Boolean)))
  const imageUrl = skcs.map((skc) => stringValue(skc.image_url)).find(Boolean) || null
  const saleSites = saleSitesFromProduct(
    row,
    skcs,
    siteNames ?? (context ? siteNameLookup(db, context) : new Map()),
  )
  const saleSiteDetails = skcSaleSitesFromProduct(
    skcs,
    siteNames ?? (context ? siteNameLookup(db, context) : new Map()),
  )
  const activeSites = activeSaleSiteAbbrs(saleSites)

  return {
    id: Number(row.id),
    spuName: stringValue(row.spu_name),
    supplierCode: stringValue(row.supplier_code),
    productName: stringValue(row.product_name),
    brandCode: stringValue(row.brand_code),
    brandName: firstString(row.brand_display_name, row.brand_name),
    categoryId: stringValue(row.category_id),
    categoryName: firstString(row.category_display_name, row.category_name),
    productTypeId: stringValue(row.product_type_id),
    productStatus: stringValue(row.product_status),
    shelfStatusText: stringValue(row.shelf_status_text),
    skcCount: Number(row.skc_count ?? 0),
    skuCount: Number(row.sku_count ?? 0),
    editableStatus: stringValue(row.editable_status),
    editableMessage: stringValue(row.editable_message),
    editableCheckedAt: stringValue(row.editable_checked_at),
    lastListSyncedAt: stringValue(row.last_list_synced_at),
    lastDetailSyncedAt: stringValue(row.last_detail_synced_at),
    updatedAt: stringValue(row.updated_at),
    imageUrl,
    saleSites,
    saleSiteDetails,
    saleSiteCount: activeSites.length,
    saleSiteSummary: saleSiteSummary(saleSites),
    costSummary: costValues.length === 1
      ? costValues[0]
      : costValues.length > 1
        ? `多价：${costValues.slice(0, 3).join(" / ")}`
        : "",
    costSkuCount: costRows.length,
    skcs: skcs.map((skc) => ({
      skcName: stringValue(skc.skc_name),
      supplierCode: stringValue(skc.supplier_code),
      imageUrl: stringValue(skc.image_url) || null,
      shelfStatusText: stringValue(skc.shelf_status_text),
      skuCount: includeDetails
        ? skuDetailsBySkc.get(Number(skc.id))?.length ?? 0
        : 0,
      skus: includeDetails ? (skuDetailsBySkc.get(Number(skc.id)) ?? []).map((sku) => ({
        skuCode: stringValue(sku.sku_code),
        supplierSku: stringValue(sku.supplier_sku),
        saleText: stringValue(sku.sale_attribute_text),
        mallState: numberValue(sku.mall_state),
        stopPurchase: numberValue(sku.stop_purchase),
        costs: stringValue(sku.cost_text),
        prices: stringValue(sku.price_text),
      })) : [],
    })),
    skuCodeList: includeDetails
      ? skuDetailRows.map((sku) => stringValue(sku.sku_code)).filter(Boolean).slice(0, 12)
      : [],
    rawListPayload: parseJsonText(row.raw_list_payload_json),
  }
}

function saleSiteFilterOptions(db: SyncPostgresDatabase, context: SheinPlatformContext, siteNames: Map<string, string>) {
  const rows = db.prepare(`
    select ${productDisplaySelectSql}
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  const counts = new Map<string, { value: string; label: string; count: number }>()
  for (const row of rows) {
    const skcs = db.prepare(`
      select *
      from shein_platform_skc
      where product_id = ?
    `).all(row.id) as JsonRecord[]
    for (const siteAbbr of activeSaleSiteAbbrs(saleSitesFromProduct(row, skcs, siteNames))) {
      const current = counts.get(siteAbbr) ?? {
        value: siteAbbr,
        label: firstString(siteNames.get(siteAbbr), siteAbbr),
        count: 0,
      }
      current.count += 1
      counts.set(siteAbbr, current)
    }
  }
  return Array.from(counts.values()).sort((left, right) => left.label.localeCompare(right.label))
}

function productIdsForSaleSite(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  site: string,
  siteNames: Map<string, string>,
) {
  const normalizedSite = normalizeText(site)
  if (!normalizedSite) return []
  const rows = db.prepare(`
    select ${productDisplaySelectSql}
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  const productIds: number[] = []
  for (const row of rows) {
    const skcs = db.prepare(`
      select *
      from shein_platform_skc
      where product_id = ?
    `).all(row.id) as JsonRecord[]
    const matched = saleSitesFromProduct(row, skcs, siteNames).some((saleSite) =>
      saleSite.shelfStatus === 1
      && (
        saleSite.siteAbbr === normalizedSite
        || saleSite.siteName === normalizedSite
      ),
    )
    if (matched) productIds.push(Number(row.id))
  }
  return productIds
}

function productFilterOptions(db: SyncPostgresDatabase, context: SheinPlatformContext, siteNames = siteNameLookup(db, context)) {
  const cacheKey = productFilterCacheKey(context)
  const cached = productFilterCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.filters

  const params = [context.platform, context.platformAccountKey]
  const brands = db.prepare(`
    select
      ${productBrandDisplaySql} as value,
      ${productBrandDisplaySql} as label,
      count(*) as count
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
      and ${productBrandDisplaySql} is not null
    group by ${productBrandDisplaySql}
    order by label asc
    limit 200
  `).all(...params) as JsonRecord[]
  const categories = db.prepare(`
    select
      ${productCategoryDisplaySql} as value,
      ${productCategoryDisplaySql} as label,
      count(*) as count
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
      and ${productCategoryDisplaySql} is not null
    group by ${productCategoryDisplaySql}
    order by label asc
    limit 200
  `).all(...params) as JsonRecord[]
  const filters = {
    brands: brands.map((row) => ({
      value: stringValue(row.value),
      label: stringValue(row.label),
      count: Number(row.count ?? 0),
    })).filter((row) => row.value),
    categories: categories.map((row) => ({
      value: stringValue(row.value),
      label: stringValue(row.label),
      count: Number(row.count ?? 0),
    })).filter((row) => row.value),
    sites: saleSiteFilterOptions(db, context, siteNames),
  }
  productFilterCache.set(cacheKey, {
    expiresAt: Date.now() + PRODUCT_FILTER_CACHE_TTL_MS,
    filters,
  })
  return filters
}

export function listPlatformProducts(input: ProductListInput = {}) {
  const db = getDb()
  const context = platformContext(db)
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const search = normalizeText(input.search)
  const brand = normalizeText(input.brand)
  const category = normalizeText(input.category)
  const site = normalizeText(input.site)
  const includeDetails = readListIncludeDetails(input.includeDetails)
  const siteNames = siteNameLookup(db, context)
  const params: unknown[] = [context.platform, context.platformAccountKey]
  const where = [
    "product.platform = ?",
    "product.platform_account_key = ?",
  ]

  if (search) {
    const query = `%${search}%`
    where.push(`(
      product.spu_name like ?
      or coalesce(product.supplier_code, '') like ?
      or coalesce(product.product_name, '') like ?
      or coalesce(${productBrandDisplaySql}, '') like ?
      or coalesce(product.brand_name, '') like ?
      or coalesce(product.brand_code, '') like ?
      or coalesce(${productCategoryDisplaySql}, '') like ?
      or coalesce(product.category_name, '') like ?
      or coalesce(product.category_id, '') like ?
      or exists (
        select 1
        from shein_platform_skc skc
        left join shein_platform_sku sku on sku.skc_id = skc.id
        where skc.product_id = product.id
          and (
            skc.skc_name like ?
            or coalesce(skc.supplier_code, '') like ?
            or coalesce(sku.sku_code, '') like ?
            or coalesce(sku.supplier_sku, '') like ?
          )
      )
    )`)
    params.push(query, query, query, query, query, query, query, query, query, query, query, query, query)
  }

  if (brand) {
    where.push(`(
      ${productBrandDisplaySql} = ?
      or product.brand_name = ?
      or product.brand_code = ?
      or brand_rule.local_brand_name = ?
      or brand_rule.brand_name = ?
    )`)
    params.push(brand, brand, brand, brand, brand)
  }

  if (category) {
    where.push(`(
      ${productCategoryDisplaySql} = ?
      or product.category_name = ?
      or product.category_id = ?
      or category_mapping.category_name = ?
    )`)
    params.push(category, category, category, category)
  }

  if (site) {
    const productIds = productIdsForSaleSite(db, context, site, siteNames)
    if (!productIds.length) {
      const filters = productFilterOptions(db, context, siteNames)
      return {
        items: [],
        pagination: {
          total: 0,
          limit,
          offset,
        },
        account: productWhereForContext(context),
        filters: {
          brands: filters.brands,
          categories: filters.categories,
          sites: filters.sites,
        },
        operations: productOperations(db, context, undefined, 8),
      }
    }
    where.push(`product.id in (${productIds.map(() => "?").join(", ")})`)
    params.push(...productIds)
  }

  const whereSql = where.join(" and ")
  const totalRow = db.prepare(`
    select count(*) as count
    from shein_platform_product product
    ${productDisplayJoinSql}
    where ${whereSql}
  `).get(...params) as { count: number }

  const rows = db.prepare(`
    select ${productDisplaySelectSql}
    from shein_platform_product product
    ${productDisplayJoinSql}
    where ${whereSql}
    order by coalesce(product.last_detail_synced_at, product.last_list_synced_at, product.updated_at) desc,
      product.id desc
    limit ?
    offset ?
  `).all(...params, limit, offset) as JsonRecord[]
  const filters = productFilterOptions(db, context, siteNames)

  return {
    items: rows.map((row) => serializeProductSummary(db, row, context, siteNames, { includeDetails })),
    pagination: {
      total: Number(totalRow.count ?? 0),
      limit,
      offset,
    },
    account: productWhereForContext(context),
    filters: {
      brands: filters.brands,
      categories: filters.categories,
      sites: filters.sites,
    },
    operations: productOperations(db, context, undefined, 8),
  }
}

function serializeSite(row: JsonRecord) {
  return {
    id: Number(row.id),
    mainSite: stringValue(row.main_site),
    mainSiteName: stringValue(row.main_site_name),
    siteAbbr: stringValue(row.site_abbr),
    siteName: stringValue(row.site_name),
    currency: stringValue(row.currency),
    status: numberValue(row.site_status),
    symbolLeft: stringValue(row.symbol_left),
    symbolRight: stringValue(row.symbol_right),
    storeType: numberValue(row.store_type),
    lastSyncedAt: stringValue(row.last_synced_at),
    rawPayload: parseJsonText(row.raw_payload_json),
  }
}

export function listStoreSites() {
  const db = getDb()
  const context = platformContext(db)
  const rows = db.prepare(`
    select *
    from shein_platform_site
    where platform = ?
      and platform_account_key = ?
    order by main_site asc, site_abbr asc
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  return {
    items: rows.map(serializeSite),
    account: productWhereForContext(context),
    operations: productOperations(db, context, undefined, 8),
  }
}

function serializeProductDetail(db: SyncPostgresDatabase, context: SheinPlatformContext, product: JsonRecord) {
  const skcs = db.prepare(`
    select *
    from shein_platform_skc
    where product_id = ?
    order by id asc
  `).all(product.id) as JsonRecord[]

  return {
    product: serializeProductSummary(db, product, context, undefined, { includeDetails: true }),
    skcs: skcs.map((skc) => {
      const skus = db.prepare(`
        select *
        from shein_platform_sku
        where skc_id = ?
        order by id asc
      `).all(skc.id) as JsonRecord[]
      return {
        id: Number(skc.id),
        skcName: stringValue(skc.skc_name),
        supplierCode: stringValue(skc.supplier_code),
        saleText: stringValue(skc.sale_attribute_text),
        shelfText: stringValue(skc.shelf_status_text),
        imageUrl: stringValue(skc.image_url) || null,
        rawPayload: parseJsonText(skc.raw_payload_json),
        skus: skus.map((sku) => ({
          id: Number(sku.id),
          skuCode: stringValue(sku.sku_code),
          supplierSku: stringValue(sku.supplier_sku),
          saleText: stringValue(sku.sale_attribute_text),
          mallState: numberValue(sku.mall_state),
          stopPurchase: numberValue(sku.stop_purchase),
          weight: numberValue(sku.package_weight),
          dimensions: [sku.package_length, sku.package_width, sku.package_height]
            .map((value) => stringValue(value))
            .filter(Boolean)
            .join(" x "),
          currentCost: stringValue(sku.cost_price),
          currency: stringValue(sku.currency),
          costs: stringValue(sku.cost_text),
          prices: stringValue(sku.price_text),
          rawPayload: parseJsonText(sku.raw_payload_json),
        })),
      }
    }),
    rawInfo: responseInfo({ status: 200, payload: parseJsonText(product.raw_detail_payload_json) }),
    operations: productOperations(db, context, stringValue(product.spu_name), 20),
  }
}

export function getProductDetail(spuName: string) {
  const db = getDb()
  const context = platformContext(db)
  const product = db.prepare(`
    select ${productDisplaySelectSql}
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
      and product.spu_name = ?
  `).get(context.platform, context.platformAccountKey, normalizeText(spuName)) as JsonRecord | undefined

  if (!product) return null
  return serializeProductDetail(db, context, product)
}

export async function syncPlatformProducts(payload: unknown = {}, actor?: LifecycleActor | null) {
  const initialDb = getDb()
  const initialContext = platformContext(initialDb)
  const plan = syncPlanFromPayload(initialDb, initialContext, payload)
  const productSpuNames = new Set<string>()
  let pagesSynced = 0
  let rowCount = 0
  let lastResult: PlatformRequestResult | null = null
  let stoppedReason: "short_page" | "total_reached" | "max_pages" | "request_failed" = "max_pages"

  for (let pageIndex = 0; pageIndex < plan.maxPages; pageIndex += 1) {
    const pageNum = plan.startPage + pageIndex
    const pageSize = plan.pageSize
    const pagePayload = {
      ...plan.listPayloadBase,
      pageNum,
      pageSize,
    }
    const { db, context, result } = await runLifecycleCall(
      "SYNC_PRODUCT_LIST",
      pagePayload,
      actor,
      {},
      (context) => sheinAdapter.queryProductList({ credentials: context.credentials, payload: pagePayload }),
    )
    lastResult = result
    if (!responseOk(result)) {
      stoppedReason = "request_failed"
      break
    }

    const rows = normalizeProductRows(result)
    const persistence = persistProductListResult(db, context, result)
    pagesSynced += 1
    rowCount += persistence.rowCount
    for (const row of rows) productSpuNames.add(row.spuName)

    const total = productListTotal(result)
    if (rows.length < pageSize) {
      stoppedReason = "short_page"
      break
    }
    if (total != null && pageNum * pageSize >= total) {
      stoppedReason = "total_reached"
      break
    }
  }

  const detail = {
    requested: plan.syncDetails,
    attempted: 0,
    succeeded: 0,
    failed: [] as Array<{ spuName: string; message: string }>,
  }
  if (plan.syncDetails && lastResult && responseOk(lastResult)) {
    for (const spuName of Array.from(productSpuNames).slice(0, plan.detailLimit)) {
      detail.attempted += 1
      try {
        const detailResult = await syncProductDetail(spuName, {}, actor)
        if (responseOk(detailResult.result) && detailResult.persistence.persisted) {
          detail.succeeded += 1
        } else {
          detail.failed.push({ spuName, message: responseMessage(detailResult.result) || "详情同步未落库" })
        }
      } catch (error) {
        detail.failed.push({ spuName, message: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  const result = lastResult ?? {
    status: 200,
    payload: { code: "0", msg: "OK", info: { data: [] } },
  }
  return {
    result,
    persistence: {
      rowCount,
      productCount: productSpuNames.size,
      pagesSynced,
      pageSize: plan.pageSize,
      maxPages: plan.maxPages,
      stoppedReason,
    },
    detail,
    sync: {
      mode: plan.mode,
      syncDetails: plan.syncDetails,
      detailLimit: plan.detailLimit,
      incrementalWindowStart: plan.incrementalWindowStart,
    },
    list: listPlatformProducts({}),
  }
}

export async function syncStoreSites(payload: unknown = {}, actor?: LifecycleActor | null) {
  const requestPayload = recordValue(payload)
  const { db, context, result } = await runLifecycleCall(
    "SYNC_STORE_SITES",
    requestPayload,
    actor,
    {},
    (context) => sheinAdapter.queryStoreSites({ credentials: context.credentials, payload: requestPayload }),
  )
  const persistence = responseOk(result) ? persistSitesResult(db, context, result) : { siteCount: 0 }
  return { result, persistence, sites: listStoreSites() }
}

export async function syncProductDetail(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = { ...recordValue(payload), spuName: normalizedSpuName, languageList: ["zh-cn", "en"] }
  const { db, context, result } = await runLifecycleCall(
    "SYNC_PRODUCT_DETAIL",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.queryProductDetail({ credentials: context.credentials, payload: requestPayload }),
  )
  const persistence = responseOk(result)
    ? persistProductDetailResult(db, context, result)
    : { persisted: false, skcCount: 0, skuCount: 0 }
  return { result, persistence, detail: getProductDetail(normalizedSpuName) }
}

function editableStatusFromResult(result: PlatformRequestResult) {
  const info = responseInfo(result)
  const allowed = info.canEdit ?? info.can_edit ?? info.editable ?? info.isEditable ?? info.is_editable
  if (typeof allowed === "boolean") return allowed ? "EDITABLE" : "BLOCKED"
  if (allowed === 1 || allowed === "1" || allowed === "true") return "EDITABLE"
  if (allowed === 0 || allowed === "0" || allowed === "false") return "BLOCKED"
  return responseOk(result) ? "CHECKED" : "FAILED"
}

export async function checkEditPermission(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = { ...recordValue(payload), spuName: normalizedSpuName }
  const { db, context, result } = await runLifecycleCall(
    "CHECK_EDIT_PERMISSION",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.checkEditPermission({ credentials: context.credentials, payload: requestPayload }),
  )

  ensureProduct(db, context, normalizedSpuName)
  db.prepare(`
    update shein_platform_product
    set editable_status = ?,
      editable_message = ?,
      editable_checked_at = ?,
      updated_at = ?
    where platform = ?
      and platform_account_key = ?
      and spu_name = ?
  `).run(
    editableStatusFromResult(result),
    responseMessage(result),
    nowIso(),
    nowIso(),
    context.platform,
    context.platformAccountKey,
    normalizedSpuName,
  )
  return { result, detail: getProductDetail(normalizedSpuName) }
}

function payloadWithSpuName(spuName: string, payload: unknown) {
  const object = recordValue(payload)
  if (object.spuName || object.spu_name) return object
  return { ...object, spuName }
}

function rawInfoFromDetailPayload(value: unknown) {
  const object = recordValue(value)
  const info = recordValue(object.info)
  return Object.keys(info).length ? info : object
}

function numberOrString(value: unknown, fallback: unknown = "") {
  const number = numberValue(value)
  if (number != null) return number
  return firstString(value, fallback)
}

function compactObject<T extends JsonRecord>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value == null) return false
      if (typeof value === "string" && !value.trim()) return false
      if (Array.isArray(value) && value.length === 0) return false
      if (isRecord(value) && Object.keys(value).length === 0) return false
      return true
    }),
  ) as T
}

function languageText(list: unknown, language: string, ...keys: string[]) {
  const rows = arrayRecords(list)
  const preferred = rows.find((row) => stringValue(row.language).toLowerCase() === language)
  const fallback = preferred ?? rows[0]
  if (!fallback) return ""
  return firstString(...keys.map((key) => fallback[key]))
}

function multiLanguageList(
  source: unknown,
  outputKey: "name",
  valueKeys: string[],
  overrides: Record<string, unknown>,
) {
  const byLanguage = new Map<string, string>()
  for (const row of arrayRecords(source)) {
    const language = firstString(row.language) || "zh-cn"
    const value = firstString(...valueKeys.map((key) => row[key]), row.name)
    if (value) byLanguage.set(language, value)
  }
  for (const [language, value] of Object.entries(overrides)) {
    const text = stringValue(value)
    if (text) byLanguage.set(language, text)
  }
  return Array.from(byLanguage.entries()).map(([language, value]) => ({
    language,
    [outputKey]: value,
  }))
}

function attributeList(value: unknown) {
  return arrayRecords(value)
    .map((item) => compactObject({
      attribute_id: numberOrString(item.attributeId ?? item.attribute_id),
      attribute_value_id: numberOrString(item.attributeValueId ?? item.attribute_value_id),
      attribute_value: firstString(item.attributeValue ?? item.attribute_value),
    }))
    .filter((item) => item.attribute_id || item.attribute_value_id || item.attribute_value)
}

function saleAttribute(value: unknown) {
  const object = recordValue(value)
  return compactObject({
    attribute_id: numberOrString(object.attributeId ?? object.attribute_id),
    attribute_value_id: numberOrString(object.attributeValueId ?? object.attribute_value_id),
    attribute_value: firstString(object.attributeValue ?? object.attribute_value),
  })
}

function imageInfo(value: unknown) {
  const rows = arrayRecords(value)
  if (!rows.length) return undefined
  const first = rows[0] ?? {}
  const imageInfoList = rows
    .map((item, index) => compactObject({
      image_item_id: firstString(item.imageItemId, item.image_item_id),
      image_sort: numberValue(item.imageSort ?? item.image_sort) ?? index + 1,
      image_type: numberOrString(item.imageType ?? item.image_type, 1),
      image_url: firstString(item.imageUrl, item.image_url, item.imageMediumUrl, item.imageSmallUrl),
    }))
    .filter((item) => item.image_url)
  const groupCode = firstString(
    first.imageGroupCode,
    first.image_group_code,
    recordValue(first.imageInfo ?? first.image_info).imageGroupCode,
    recordValue(first.imageInfo ?? first.image_info).image_group_code,
  )
  if (!groupCode && !imageInfoList.length) return undefined
  return compactObject({
    image_group_code: groupCode,
    image_info_list: imageInfoList,
  })
}

function skuEditUpdateMap(form: unknown) {
  const formObject = recordValue(form)
  const rows = arrayRecords(formObject.skuUpdates ?? formObject.sku_updates)
  const updates = new Map<string, JsonRecord>()
  for (const row of rows) {
    const skuCode = firstString(row.skuCode, row.sku_code)
    if (skuCode) updates.set(skuCode, row)
  }
  return updates
}

function skcEditUpdateMap(form: unknown) {
  const formObject = recordValue(form)
  const rows = arrayRecords(formObject.skcUpdates ?? formObject.skc_updates)
  const updates = new Map<string, JsonRecord>()
  for (const row of rows) {
    const skcName = firstString(row.skcName, row.skc_name)
    if (skcName) updates.set(skcName, row)
  }
  return updates
}

function skuEditPayload(sku: JsonRecord, update: JsonRecord | undefined) {
  const skuImages = imageInfo(sku.skuImageInfoList ?? sku.sku_image_info_list)
  return compactObject({
    sku_code: firstString(sku.skuCode, sku.sku_code),
    supplier_sku: firstString(update?.supplierSku, update?.supplier_sku, sku.supplierSku, sku.supplier_sku),
    height: firstString(update?.height, sku.height),
    length: firstString(update?.length, sku.length),
    weight: firstString(update?.weight, sku.weight),
    width: firstString(update?.width, sku.width),
    mall_state: numberValue(update?.mallState ?? update?.mall_state ?? sku.mallState ?? sku.mall_state) ?? undefined,
    stop_purchase: numberValue(update?.stopPurchase ?? update?.stop_purchase ?? sku.stopPurchase ?? sku.stop_purchase) ?? undefined,
    sale_attribute_list: attributeList(sku.saleAttributeList ?? sku.sale_attribute_list),
    image_info: skuImages,
    minimum_stock_quantity: firstString(update?.minimumStockQuantity, update?.minimum_stock_quantity, sku.minimumStockQuantity, sku.minimum_stock_quantity),
    competing_product_link: firstString(update?.competingProductLink, update?.competing_product_link, sku.competingProductLink, sku.competing_product_link),
  })
}

function skcEditPayload(skc: JsonRecord, update: JsonRecord | undefined, skuUpdates: Map<string, JsonRecord>) {
  const skcName = firstString(skc.skcName, skc.skc_name)
  const skcImages = imageInfo(skc.skcImageInfoList ?? skc.skc_image_info_list)
  const siteDetailImages = arrayRecords(skc.siteDetailImageInfoList ?? skc.site_detail_image_info_list)
  const skuList = arrayRecords(skc.skuInfoList ?? skc.sku_info_list)
    .map((sku) => skuEditPayload(sku, skuUpdates.get(firstString(sku.skuCode, sku.sku_code))))
    .filter((sku) => sku.sku_code)

  return compactObject({
    skc_name: skcName,
    supplier_code: firstString(update?.supplierCode, update?.supplier_code, skc.supplierCode, skc.supplier_code),
    sale_attribute: saleAttribute({
      attributeId: skc.attributeId ?? skc.attribute_id,
      attributeValueId: skc.attributeValueId ?? skc.attribute_value_id,
      attributeValue: skc.attributeValue ?? skc.attribute_value,
    }),
    shelf_way: numberValue(update?.shelfWay ?? update?.shelf_way ?? skc.shelfWay ?? skc.shelf_way) ?? 1,
    hope_on_sale_date: firstString(update?.hopeOnSaleDate, update?.hope_on_sale_date, skc.hopeOnSaleDate, skc.hope_on_sale_date),
    image_info: skcImages,
    site_detail_image_info_list: siteDetailImages.length ? siteDetailImages : undefined,
    sku_list: skuList,
  })
}

export function buildEditPayloadFromForm(rawDetail: unknown, form: unknown = {}) {
  const info = rawInfoFromDetailPayload(rawDetail)
  const formObject = recordValue(form)
  const skuUpdates = skuEditUpdateMap(formObject)
  const skcUpdates = skcEditUpdateMap(formObject)
  const skcList = arrayRecords(info.skcInfoList ?? info.skc_info_list)
    .map((skc) => skcEditPayload(skc, skcUpdates.get(firstString(skc.skcName, skc.skc_name)), skuUpdates))
    .filter((skc) => skc.skc_name && arrayRecords(skc.sku_list).length)

  return compactObject({
    spu_name: firstString(info.spuName, info.spu_name, formObject.spuName, formObject.spu_name),
    category_id: numberOrString(formObject.categoryId ?? formObject.category_id ?? info.categoryId ?? info.category_id),
    product_type_id: numberOrString(formObject.productTypeId ?? formObject.product_type_id ?? info.productTypeId ?? info.product_type_id),
    suit_flag: firstString(info.suitFlag, info.suit_flag, formObject.suitFlag, formObject.suit_flag, "0"),
    supplier_code: firstString(formObject.supplierCode, formObject.supplier_code, info.supplierCode, info.supplier_code),
    brand_code: firstString(formObject.brandCode, formObject.brand_code, info.brandCode, info.brand_code),
    is_spu_pic: firstString(formObject.isSpuPic, formObject.is_spu_pic, info.isSpuPic, info.is_spu_pic),
    image_info: imageInfo(info.spuImageInfoList ?? info.spu_image_info_list),
    multi_language_name_list: multiLanguageList(
      info.productMultiNameList ?? info.product_multi_name_list,
      "name",
      ["productName", "product_name", "name"],
      {
        "zh-cn": formObject.productTitleZh ?? formObject.titleZh ?? formObject.title_zh,
        en: formObject.productTitleEn ?? formObject.titleEn ?? formObject.title_en,
      },
    ),
    multi_language_desc_list: multiLanguageList(
      info.productMultiDescList ?? info.product_multi_desc_list,
      "name",
      ["productDesc", "product_desc", "description", "name"],
      {
        "zh-cn": formObject.productDescriptionZh ?? formObject.descriptionZh ?? formObject.description_zh,
        en: formObject.productDescriptionEn ?? formObject.descriptionEn ?? formObject.description_en,
      },
    ),
    product_attribute_list: attributeList(info.productAttributeInfoList ?? info.product_attribute_info_list),
    size_attribute_list: attributeList(info.dimensionAttributeInfoList ?? info.dimension_attribute_info_list),
    sale_attribute_sort_list: arrayRecords(info.saleAttributeSortList ?? info.sale_attribute_sort_list),
    skc_list: skcList,
  })
}

export function buildVariantTemplateFromDetail(rawDetail: unknown, input: unknown = {}) {
  const basePayload = buildEditPayloadFromForm(rawDetail, {})
  const object = recordValue(input)
  const currency = firstString(object.currency, "CNY")
  return {
    payload: basePayload,
    newVariant: {
      skc: {
        supplier_code: "",
        shelf_way: 1,
        hope_on_sale_date: "",
        sale_attribute: {
          attribute_id: "",
          attribute_value_id: "",
        },
        image_info: {
          image_info_list: [
            {
              image_sort: 1,
              image_type: 1,
              image_url: "",
            },
          ],
        },
      },
      sku: {
        supplier_sku: "",
        height: "",
        length: "",
        weight: "",
        width: "",
        mall_state: 1,
        stop_purchase: 1,
        sale_attribute_list: [
          {
            attribute_id: "",
            attribute_value_id: "",
          },
        ],
        cost_info: {
          cost_price: "",
          currency,
        },
        stock_info_list: [],
      },
    },
    notes: [
      "新增 SKC/SKU 时保留已发布对象的 skc_name 与 sku_code，新对象不要填写平台生成编号。",
      "成本价随新增 SKU 的 cost_info 提交；已发布 SKU 更新供货价请使用 update-cost。",
    ],
  }
}

function productRawInfo(product: JsonRecord) {
  return rawInfoFromDetailPayload(parseJsonText(product.raw_detail_payload_json))
}

function productForContext(db: SyncPostgresDatabase, context: SheinPlatformContext, spuName: string) {
  return db.prepare(`
    select ${productDisplaySelectSql}
    from shein_platform_product product
    ${productDisplayJoinSql}
    where product.platform = ?
      and product.platform_account_key = ?
      and product.spu_name = ?
  `).get(context.platform, context.platformAccountKey, normalizeText(spuName)) as JsonRecord | undefined
}

function editFormFromRawInfo(info: JsonRecord) {
  const skuUpdates = arrayRecords(info.skcInfoList ?? info.skc_info_list).flatMap((skc) =>
    arrayRecords(skc.skuInfoList ?? skc.sku_info_list).map((sku) => ({
      skuCode: firstString(sku.skuCode, sku.sku_code),
      supplierSku: firstString(sku.supplierSku, sku.supplier_sku),
      weight: firstString(sku.weight),
      length: firstString(sku.length),
      width: firstString(sku.width),
      height: firstString(sku.height),
      mallState: firstString(sku.mallState, sku.mall_state, "1"),
      stopPurchase: firstString(sku.stopPurchase, sku.stop_purchase, "1"),
    })),
  ).filter((sku) => sku.skuCode)

  return {
    productTitleZh: languageText(info.productMultiNameList ?? info.product_multi_name_list, "zh-cn", "productName", "product_name", "name"),
    productTitleEn: languageText(info.productMultiNameList ?? info.product_multi_name_list, "en", "productName", "product_name", "name"),
    productDescriptionZh: languageText(info.productMultiDescList ?? info.product_multi_desc_list, "zh-cn", "productDesc", "product_desc", "description", "name"),
    productDescriptionEn: languageText(info.productMultiDescList ?? info.product_multi_desc_list, "en", "productDesc", "product_desc", "description", "name"),
    brandCode: firstString(info.brandCode, info.brand_code),
    supplierCode: firstString(info.supplierCode, info.supplier_code),
    categoryId: firstString(info.categoryId, info.category_id),
    productTypeId: firstString(info.productTypeId, info.product_type_id),
    skuUpdates,
  }
}

export function getProductEditTemplate(spuName: string) {
  const db = getDb()
  const context = platformContext(db)
  const product = productForContext(db, context, spuName)
  if (!product) return null
  const rawInfo = productRawInfo(product)
  if (!firstString(rawInfo.spuName, rawInfo.spu_name)) return null
  const form = editFormFromRawInfo(rawInfo)
  return {
    product: serializeProductSummary(db, product, undefined, undefined, { includeDetails: true }),
    form,
    payload: buildEditPayloadFromForm(rawInfo, form),
    warnings: [
      "编辑接口会覆盖传入字段；表单会基于本地已同步详情保留 skc_name、sku_code、图片组等平台编号。",
      "销售价、库存和已发布销售属性不在此表单内修改。",
    ],
  }
}

export function getProductVariantTemplate(spuName: string) {
  const db = getDb()
  const context = platformContext(db)
  const product = productForContext(db, context, spuName)
  if (!product) return null
  const rawInfo = productRawInfo(product)
  if (!firstString(rawInfo.spuName, rawInfo.spu_name)) return null
  return {
    product: serializeProductSummary(db, product, undefined, undefined, { includeDetails: true }),
    ...buildVariantTemplateFromDetail(rawInfo, {}),
  }
}

async function refreshDetailAfterSuccess(spuName: string, actor?: LifecycleActor | null) {
  try {
    return await syncProductDetail(spuName, {}, actor)
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function fieldEditProduct(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const db = getDb()
  const context = platformContext(db)
  const product = productForContext(db, context, normalizedSpuName)
  if (!product) throw new Error("本地尚未同步该 SHEIN 平台商品")
  const rawInfo = productRawInfo(product)
  if (!firstString(rawInfo.spuName, rawInfo.spu_name)) throw new Error("本地尚未同步该 SHEIN 平台商品详情")
  const object = recordValue(payload)
  const requestPayload = isRecord(object.payload)
    ? object.payload
    : buildEditPayloadFromForm(rawInfo, isRecord(object.form) ? object.form : object)
  const result = await runLifecycleCall(
    "FIELD_EDIT_PRODUCT",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.publishListing({ credentials: context.credentials, payload: requestPayload }),
  )
  const refresh = responseOk(result.result) ? await refreshDetailAfterSuccess(normalizedSpuName, actor) : null
  return { result: result.result, refresh, detail: getProductDetail(normalizedSpuName) }
}

export async function partialEditProduct(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = payloadWithSpuName(normalizedSpuName, payload)
  const { result } = await runLifecycleCall(
    "PARTIAL_EDIT_PRODUCT",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.partialEditListing({ credentials: context.credentials, payload: requestPayload }),
  )
  const refresh = responseOk(result) ? await refreshDetailAfterSuccess(normalizedSpuName, actor) : null
  return { result, refresh, detail: getProductDetail(normalizedSpuName) }
}

export async function addVariantsToProduct(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = payloadWithSpuName(normalizedSpuName, payload)
  const { result } = await runLifecycleCall(
    "ADD_VARIANTS",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.addVariantsToListing({ credentials: context.credentials, payload: requestPayload }),
  )
  const refresh = responseOk(result) ? await refreshDetailAfterSuccess(normalizedSpuName, actor) : null
  return { result, refresh, detail: getProductDetail(normalizedSpuName) }
}

function costPayloadWithSpuName(spuName: string, payload: unknown) {
  const object = recordValue(payload)
  if (object.spu_name || object.spuName) return object
  return { ...object, spu_name: spuName }
}

function updateLocalCostFromPayload(db: SyncPostgresDatabase, context: SheinPlatformContext, payload: unknown) {
  const object = recordValue(payload)
  const spuName = firstString(object.spu_name, object.spuName)
  if (!spuName) return { updatedSkuCount: 0 }
  const product = ensureProduct(db, context, spuName)
  let updatedSkuCount = 0
  for (const skcPayload of arrayRecords(object.skc_info_list ?? object.skcInfoList)) {
    const skcName = firstString(skcPayload.skc_name, skcPayload.skcName)
    if (!skcName) continue
    const skc = db.prepare(`
      select *
      from shein_platform_skc
      where product_id = ?
        and skc_name = ?
    `).get(product.id, skcName) as JsonRecord | undefined
    if (!skc) continue
    for (const skuPayload of arrayRecords(skcPayload.sku_info_list ?? skcPayload.skuInfoList)) {
      const skuCode = firstString(skuPayload.sku_code, skuPayload.skuCode)
      if (!skuCode) continue
      const cost = numberValue(skuPayload.cost ?? skuPayload.costPrice)
      const currency = firstString(skuPayload.currency)
      const result = db.prepare(`
        update shein_platform_sku
        set cost_price = ?,
          currency = coalesce(nullif(?, ''), currency),
          cost_text = ?,
          updated_at = ?
        where skc_id = ?
          and sku_code = ?
      `).run(cost, currency, [cost == null ? "" : String(cost), currency].filter(Boolean).join(" "), nowIso(), skc.id, skuCode)
      updatedSkuCount += Number(result.changes ?? 0)
    }
  }
  refreshProductCounts(db, Number(product.id))
  return { updatedSkuCount }
}

export async function updateProductCost(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = costPayloadWithSpuName(normalizedSpuName, payload)
  const { db, context, result } = await runLifecycleCall(
    "UPDATE_COST",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.updateCost({ credentials: context.credentials, payload: requestPayload }),
  )
  const localUpdate = responseOk(result)
    ? updateLocalCostFromPayload(db, context, requestPayload)
    : { updatedSkuCount: 0 }
  return { result, localUpdate, detail: getProductDetail(normalizedSpuName) }
}

function documentStateLabel(state: number) {
  const labels: Record<number, string> = {
    [-1]: "接收失败",
    1: "待审核",
    2: "审批成功",
    3: "审批失败",
    4: "已撤回",
    5: "申诉中",
  }
  return labels[state] ?? `未知状态 ${state}`
}

function documentRows(result: PlatformRequestResult) {
  return arrayRecords(responseInfo(result).data)
}

function documentStates(result: PlatformRequestResult) {
  const states: number[] = []
  for (const row of documentRows(result)) {
    for (const skc of arrayRecords(row.skcList ?? row.skc_list)) {
      const state = numberValue(skc.documentState ?? skc.document_state)
      if (state != null) states.push(state)
    }
  }
  return states
}

function documentFailureReasons(result: PlatformRequestResult) {
  const reasons: string[] = []
  for (const row of documentRows(result)) {
    for (const skc of arrayRecords(row.skcList ?? row.skc_list)) {
      const skcName = firstString(skc.skcName, skc.skc_name, skc.documentSn, skc.document_sn, "SKC")
      for (const reason of arrayRecords(skc.failedReason ?? skc.failed_reason)) {
        const content = firstString(reason.content, reason.message)
        if (content) reasons.push(`${skcName}：${content}`)
      }
    }
  }
  return reasons
}

function mapDocumentStatus(states: number[]) {
  if (!states.length) return "UNDER_REVIEW"
  if (states.some((state) => state === 3 || state === -1)) return "REJECTED"
  if (states.every((state) => state === 2)) return "APPROVED"
  if (states.some((state) => state === 4)) return "REVOKED"
  if (states.some((state) => [1, 5].includes(state))) return "UNDER_REVIEW"
  return "UNDER_REVIEW"
}

function documentVersion(db: SyncPostgresDatabase, context: SheinPlatformContext, spuName: string) {
  const latest = db.prepare(`
    select *
    from shein_lifecycle_operation
    where platform = ?
      and platform_account_key = ?
      and spu_name = ?
      and status = 'SUCCESS'
      and operation_type in ('FIELD_EDIT_PRODUCT', 'PARTIAL_EDIT_PRODUCT', 'ADD_VARIANTS', 'SYNC_PRODUCT_DETAIL')
    order by finished_at desc, id desc
    limit 1
  `).get(context.platform, context.platformAccountKey, spuName) as JsonRecord | undefined
  const response = parseJsonText(latest?.response_payload_json)
  const info = recordValue(response.info)
  return firstString(info.version, response.version)
}

function statusSyncPayload(db: SyncPostgresDatabase, context: SheinPlatformContext, spuNames: string[], payload: unknown) {
  const object = recordValue(payload)
  if (Array.isArray(object.spuList) || Array.isArray(object.spu_list)) return object
  return {
    ...object,
    spuList: spuNames.map((spuName) => {
      const version = firstString(object.version, documentVersion(db, context, spuName))
      return compactObject({ spuName, version })
    }),
  }
}

function persistDocumentState(
  db: SyncPostgresDatabase,
  context: SheinPlatformContext,
  result: PlatformRequestResult,
) {
  const states = documentStates(result)
  const status = mapDocumentStatus(states)
  const failureReasons = documentFailureReasons(result)
  const labels = states.map(documentStateLabel)
  for (const row of documentRows(result)) {
    const spuName = firstString(row.spuName, row.spu_name)
    if (!spuName) continue
    ensureProduct(db, context, spuName)
    db.prepare(`
      update shein_platform_product
      set product_status = ?,
        editable_status = case when ? = 'UNDER_REVIEW' then 'BLOCKED' else editable_status end,
        editable_message = ?,
        updated_at = ?
      where platform = ?
        and platform_account_key = ?
        and spu_name = ?
    `).run(
      status,
      status,
      failureReasons.join("；") || labels.join(" / "),
      nowIso(),
      context.platform,
      context.platformAccountKey,
      spuName,
    )
  }
  upsertAuditStatusSnapshots(db, {
    context,
    sourceType: "PLATFORM_PRODUCT",
    sourceId: "platform-product",
    result,
  })
  return { status, states, stateLabels: labels, failureReasons }
}

export async function syncProductDocumentState(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const db = getDb()
  const context = platformContext(db)
  const requestPayload = statusSyncPayload(db, context, [normalizedSpuName], payload)
  const { result } = await runLifecycleCall(
    "SYNC_PRODUCT_STATUS",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.queryDocumentState({ credentials: context.credentials, payload: requestPayload }),
  )
  const state = responseOk(result)
    ? persistDocumentState(db, context, result)
    : { status: "FAILED", states: [], stateLabels: [], failureReasons: [] }
  return { result, state, detail: getProductDetail(normalizedSpuName) }
}

export async function batchSyncProductDocumentStates(payload: unknown = {}, actor?: LifecycleActor | null) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(payload)
  const explicitSpuNames = stringList(object.spuNames ?? object.spu_names)
  const spuNames = explicitSpuNames.length
    ? explicitSpuNames
    : (db.prepare(`
        select spu_name
        from shein_platform_product
        where platform = ?
          and platform_account_key = ?
        order by coalesce(last_detail_synced_at, last_list_synced_at, updated_at) desc
        limit ?
      `).all(context.platform, context.platformAccountKey, readLimit(object.limit, 50, 100)) as JsonRecord[])
        .map((row) => stringValue(row.spu_name))
        .filter(Boolean)
  if (!spuNames.length) return { result: null, state: { status: "EMPTY", states: [], stateLabels: [], failureReasons: [] }, products: listPlatformProducts({}) }

  const requestPayload = statusSyncPayload(db, context, spuNames, object)
  const { result } = await runLifecycleCall(
    "BATCH_SYNC_PRODUCT_STATUS",
    requestPayload,
    actor,
    {},
    (context) => sheinAdapter.queryDocumentState({ credentials: context.credentials, payload: requestPayload }),
  )
  const state = responseOk(result)
    ? persistDocumentState(db, context, result)
    : { status: "FAILED", states: [], stateLabels: [], failureReasons: [] }
  return { result, state, products: listPlatformProducts({}) }
}

function operationForRetry(db: SyncPostgresDatabase, context: SheinPlatformContext, operationId: number) {
  return db.prepare(`
    select *
    from shein_lifecycle_operation
    where id = ?
      and platform = ?
      and platform_account_key = ?
  `).get(operationId, context.platform, context.platformAccountKey) as JsonRecord | undefined
}

async function runRetriedOperation(
  original: JsonRecord,
  requestPayload: JsonRecord,
  actor?: LifecycleActor | null,
) {
  const operationType = firstString(original.operation_type)
  const spuName = firstString(original.spu_name, requestPayload.spuName, requestPayload.spu_name)
  const skcName = firstString(original.skc_name)
  const skuCode = firstString(original.sku_code)
  const retryType = `RETRY_${operationType}`
  switch (operationType) {
    case "SYNC_PRODUCT_DETAIL":
      return syncProductDetail(spuName, requestPayload, actor)
    case "CHECK_EDIT_PERMISSION":
      return checkEditPermission(spuName, requestPayload, actor)
    case "FIELD_EDIT_PRODUCT":
    case "PARTIAL_EDIT_PRODUCT": {
      const { result } = await runLifecycleCall(
        retryType,
        requestPayload,
        actor,
        { spuName, skcName, skuCode },
        (context) => operationType === "FIELD_EDIT_PRODUCT"
          ? sheinAdapter.publishListing({ credentials: context.credentials, payload: requestPayload })
          : sheinAdapter.partialEditListing({ credentials: context.credentials, payload: requestPayload }),
      )
      const refresh = responseOk(result) && spuName ? await refreshDetailAfterSuccess(spuName, actor) : null
      return { result, refresh, detail: spuName ? getProductDetail(spuName) : null }
    }
    case "ADD_VARIANTS": {
      const { result } = await runLifecycleCall(
        retryType,
        requestPayload,
        actor,
        { spuName, skcName, skuCode },
        (context) => sheinAdapter.addVariantsToListing({ credentials: context.credentials, payload: requestPayload }),
      )
      const refresh = responseOk(result) && spuName ? await refreshDetailAfterSuccess(spuName, actor) : null
      return { result, refresh, detail: spuName ? getProductDetail(spuName) : null }
    }
    case "UPDATE_COST":
      return updateProductCost(spuName, requestPayload, actor)
    case "REVOKE_PRODUCT":
      return revokeProduct(spuName, requestPayload, actor)
    case "SYNC_PRODUCT_STATUS":
      return syncProductDocumentState(spuName, requestPayload, actor)
    case "BATCH_SYNC_PRODUCT_STATUS":
      return batchSyncProductDocumentStates(requestPayload, actor)
    case "SYNC_STORE_SITES":
      return syncStoreSites(requestPayload, actor)
    case "SYNC_PRODUCT_LIST":
      return syncPlatformProducts(requestPayload, actor)
    default:
      throw new Error(`暂不支持重试该操作类型：${operationType}`)
  }
}

export async function retryLifecycleOperation(
  operationId: number,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const db = getDb()
  const context = platformContext(db)
  const original = operationForRetry(db, context, operationId)
  if (!original) throw new Error("生命周期操作不存在")
  if (firstString(original.status) !== "FAILED") throw new Error("只有失败操作可以重试")
  const overridePayload = recordValue(payload)
  const requestPayload = isRecord(overridePayload.requestPayload) || isRecord(overridePayload.request_payload)
    ? recordValue(overridePayload.requestPayload ?? overridePayload.request_payload)
    : parseJsonText(original.request_payload_json)
  return {
    original: serializeOperation(original),
    retry: await runRetriedOperation(original, requestPayload, actor),
  }
}

export async function revokeProduct(
  spuName: string,
  payload: unknown = {},
  actor?: LifecycleActor | null,
) {
  const normalizedSpuName = normalizeText(spuName)
  const requestPayload = { ...recordValue(payload), spuName: normalizedSpuName }
  const { db, context, result } = await runLifecycleCall(
    "REVOKE_PRODUCT",
    requestPayload,
    actor,
    { spuName: normalizedSpuName },
    (context) => sheinAdapter.revokeProduct({ credentials: context.credentials, payload: requestPayload }),
  )
  if (responseOk(result)) {
    ensureProduct(db, context, normalizedSpuName)
    db.prepare(`
      update shein_platform_product
      set product_status = 'REVOKE_SUBMITTED',
        updated_at = ?
      where platform = ?
        and platform_account_key = ?
        and spu_name = ?
    `).run(nowIso(), context.platform, context.platformAccountKey, normalizedSpuName)
  }
  return { result, detail: getProductDetail(normalizedSpuName) }
}
