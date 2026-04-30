import type Database from "better-sqlite3"

type SourceRow = Record<string, unknown>

export type PublishVersionListing = SourceRow & {
  id: number
  platform: string
  spu_code: string
  status: string
  validation_status: string
  platform_category_id: number | null
  product_type_id: number | null
  platform_category_name: string | null
  updated_at: string
}

export function nextPublishVersionNo(db: Database.Database, listingId: number) {
  const row = db.prepare(`
    select coalesce(max(version_no), 0) + 1 as next_no
    from listing_publish_version
    where listing_id = ?
  `).get(listingId) as SourceRow | undefined
  return Number(row?.next_no ?? 1)
}

export function buildListingSnapshot(db: Database.Database, listing: PublishVersionListing, readiness: unknown) {
  const validationIssues = db.prepare(`
    select severity, module, field_key, message, suggestion, resolved, created_at
    from listing_validation_result
    where listing_id = ?
    order by id
  `).all(listing.id) as SourceRow[]
  const fieldFills = db.prepare(`
    select scope_key, spu_code, skc_code, sku_code, field_key, field_label, field_value, source, confidence, updated_at
    from listing_field_fill
    where status = 'ACTIVE'
      and spu_code = ?
    order by skc_code, sku_code, field_key
  `).all(listing.spu_code) as SourceRow[]
  const skcs = db.prepare(`
    select *
    from listing_skc
    where listing_id = ?
    order by skc_code
  `).all(listing.id) as SourceRow[]
  const skus = db.prepare(`
    select sku.*
    from listing_sku sku
    join listing_skc skc on skc.id = sku.listing_skc_id
    where skc.listing_id = ?
    order by skc.skc_code, sku.size_name, sku.sku_code
  `).all(listing.id) as SourceRow[]
  const assets = db.prepare(`
    select *
    from listing_asset
    where listing_id = ?
    order by skc_code, image_sort, id
  `).all(listing.id) as SourceRow[]
  return {
    listing: {
      id: listing.id,
      platform: listing.platform,
      spu_code: listing.spu_code,
      status: listing.status,
      validation_status: listing.validation_status,
      category_id: listing.platform_category_id,
      product_type_id: listing.product_type_id,
      category_name: listing.platform_category_name,
      updated_at: listing.updated_at,
    },
    readiness,
    skcs,
    skus,
    assets,
    field_fills: fieldFills,
    validation_issues: validationIssues,
  }
}

export function createPublishVersion({
  db,
  listing,
  readiness,
  versionType = "DRAFT",
  changeSummary,
}: {
  db: Database.Database
  listing: PublishVersionListing
  readiness: unknown
  versionType?: string
  changeSummary?: string
}) {
  const versionNo = nextPublishVersionNo(db, listing.id)
  const snapshot = buildListingSnapshot(db, listing, readiness)
  const result = db.prepare(`
    insert into listing_publish_version (
      listing_id,
      version_no,
      version_type,
      status,
      change_summary,
      source_snapshot_json,
      request_payload_json,
      created_by
    )
    values (?, ?, ?, 'DRAFT', ?, ?, ?, 'codex')
  `).run(
    listing.id,
    versionNo,
    versionType,
    changeSummary ?? `草稿版本 v${versionNo}`,
    JSON.stringify(snapshot),
    JSON.stringify({
      platform: listing.platform,
      category_id: listing.platform_category_id,
      product_type_id: listing.product_type_id,
      spu_code: listing.spu_code,
      status: listing.status,
      validation_status: listing.validation_status,
    }),
  )
  return db.prepare("select * from listing_publish_version where id = ?").get(result.lastInsertRowid) as SourceRow
}
