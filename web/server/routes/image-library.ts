import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const imageLibrary = new Hono()

type SourceRow = {
  id: number
  [key: string]: unknown
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function readLimit(value: string | undefined) {
  const limit = Number(value ?? 120)
  if (!Number.isFinite(limit)) return 120
  return Math.max(1, Math.min(240, limit))
}

function readOffset(value: string | undefined) {
  const offset = Number(value ?? 0)
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, offset)
}

function listWhere({
  query,
  sourceKind,
}: {
  query?: string
  sourceKind?: string
}) {
  const clauses: string[] = []
  const params: unknown[] = []

  if (query?.trim()) {
    const like = likeQuery(query)
    clauses.push(`
      (
        asset.spu_code like ?
        or asset.skc_code like ?
        or asset.owner_code like ?
        or asset.asset_type like ?
        or asset.picture_type like ?
        or asset.place like ?
        or asset.file_name like ?
        or asset.module_name like ?
        or pkg.title like ?
        or pkg.brand_name like ?
        or pkg.category_name like ?
      )
    `)
    params.push(like, like, like, like, like, like, like, like, like, like, like)
  }

  if (sourceKind?.trim() && sourceKind !== "all") {
    clauses.push("asset.source_kind = ?")
    params.push(sourceKind)
  }

  return {
    clause: clauses.length ? `where ${clauses.join(" and ")}` : "",
    params,
  }
}

imageLibrary.get("/", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const sourceKind = c.req.query("sourceKind")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere({ query: q, sourceKind })

  const items = db.prepare(`
    select
      asset.*,
      pkg.title as content_title,
      pkg.brand_name as content_brand_name,
      pkg.category_name as content_category_name,
      pkg.synced_at as content_synced_at
    from product_asset asset
    left join product_content_package pkg on pkg.id = asset.content_package_id
    ${clause}
    order by coalesce(asset.synced_at, asset.updated_at) desc,
      asset.spu_code desc,
      asset.id desc
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from product_asset asset
    left join product_content_package pkg on pkg.id = asset.content_package_id
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

imageLibrary.get("/summary", (c) => {
  const db = getDb()
  const summary = db.prepare(`
    select
      count(*) as asset_count,
      count(distinct normalized_url) as unique_url_count,
      sum(case when source_kind = 'PICTURE' then 1 else 0 end) as picture_count,
      sum(case when source_kind in ('DETAIL_SCREENSHOT', 'DETAIL_MODULE') then 1 else 0 end) as detail_count,
      count(distinct spu_code) as spu_count,
      max(synced_at) as latest_synced_at
    from product_asset
  `).get()

  const sourceKinds = db.prepare(`
    select source_kind, count(*) as count
    from product_asset
    group by source_kind
    order by count(*) desc, source_kind
  `).all()

  return c.json({
    ...summary,
    source_kinds: sourceKinds,
  })
})

imageLibrary.get("/:assetId", (c) => {
  const db = getDb()
  const assetId = Number(c.req.param("assetId"))
  if (!Number.isFinite(assetId)) {
    throw new HTTPException(400, { message: "Invalid asset id" })
  }

  const asset = (db.prepare(`
    select
      asset.*,
      pkg.title as content_title,
      pkg.brand_name as content_brand_name,
      pkg.category_name as content_category_name,
      pkg.trade_path as content_trade_path,
      pkg.synced_at as content_synced_at
    from product_asset asset
    left join product_content_package pkg on pkg.id = asset.content_package_id
    where asset.id = ?
  `).get(assetId) as SourceRow | undefined) ?? null

  if (!asset) {
    throw new HTTPException(404, { message: `Image asset not found: ${assetId}` })
  }

  const siblingAssets = db.prepare(`
    select * from product_asset
    where id != ?
      and (
        (content_package_id is not null and content_package_id = ?)
        or (content_package_id is null and coalesce(spu_code, '') = coalesce(?, ''))
      )
    order by
      case source_kind
        when 'PICTURE' then 0
        when 'DETAIL_SCREENSHOT' then 1
        when 'DETAIL_MODULE' then 2
        else 3
      end,
      coalesce(sort_no, module_index, 999999),
      id
    limit 80
  `).all(asset.id, asset.content_package_id, asset.spu_code)

  return c.json({
    asset,
    sibling_assets: siblingAssets,
  })
})

export default imageLibrary

