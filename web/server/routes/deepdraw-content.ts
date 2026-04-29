import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const deepdrawContent = new Hono()

type SourceRow = {
  id: number
  [key: string]: unknown
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function readLimit(value: string | undefined) {
  const limit = Number(value ?? 100)
  if (!Number.isFinite(limit)) return 100
  return Math.max(1, Math.min(200, limit))
}

function readOffset(value: string | undefined) {
  const offset = Number(value ?? 0)
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, offset)
}

function listWhere(query?: string) {
  if (!query?.trim()) return { clause: "", params: [] as unknown[] }
  const like = likeQuery(query)
  return {
    clause: `
      where (
        pkg.spu_code like ?
        or pkg.source_code like ?
        or pkg.deepdraw_product_id like ?
        or pkg.title like ?
        or pkg.brand_name like ?
        or pkg.category_name like ?
        or pkg.trade_path like ?
        or pkg.primary_color like ?
      )
    `,
    params: [like, like, like, like, like, like, like, like],
  }
}

deepdrawContent.get("/", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere(q)

  const items = db.prepare(`
    select
      pkg.*,
      (
        select count(*) from product_content_skc skc
        where skc.content_package_id = pkg.id
      ) as skc_count,
      (
        select count(*) from product_content_sku sku
        where sku.content_package_id = pkg.id
      ) as sku_count,
      (
        select count(*) from product_content_field field
        where field.content_package_id = pkg.id
      ) as field_count,
      (
        select count(*) from product_content_field field
        where field.content_package_id = pkg.id and field.is_key = 1
      ) as key_field_count,
      (
        select count(*) from product_content_detail_page page
        where page.content_package_id = pkg.id
      ) as detail_page_count,
      (
        select count(*) from product_asset asset
        where asset.content_package_id = pkg.id
      ) as asset_count,
      (
        select normalized_url from product_asset asset
        where asset.content_package_id = pkg.id
        order by
          case asset.source_kind
            when 'PICTURE' then 0
            when 'DETAIL_SCREENSHOT' then 1
            else 2
          end,
          case asset.asset_type
            when 'MAIN' then 0
            when 'DETAIL' then 1
            else 2
          end,
          coalesce(asset.sort_no, 999999),
          asset.id
        limit 1
      ) as hero_image_url
    from product_content_package pkg
    ${clause}
    order by coalesce(pkg.synced_at, pkg.last_update_date, pkg.updated_at) desc,
      pkg.spu_code desc
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from product_content_package pkg
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

deepdrawContent.get("/summary", (c) => {
  const db = getDb()
  const summary = db.prepare(`
    select
      (select count(*) from product_content_package) as package_count,
      (select count(*) from product_content_skc) as skc_count,
      (select count(*) from product_content_sku) as sku_count,
      (select count(*) from product_content_field) as field_count,
      (select count(*) from product_content_detail_page) as detail_page_count,
      (select count(*) from product_asset) as asset_count,
      (select max(synced_at) from product_content_package) as latest_synced_at
  `).get()

  return c.json(summary)
})

deepdrawContent.get("/:spuCode", (c) => {
  const db = getDb()
  const spuCode = c.req.param("spuCode")

  const contentPackage = (db.prepare(`
    select * from product_content_package
    where spu_code = ?
    order by coalesce(updated_at, synced_at) desc, id desc
    limit 1
  `).get(spuCode) as SourceRow | undefined) ?? null

  if (!contentPackage) {
    throw new HTTPException(404, { message: `DeepDraw content not found: ${spuCode}` })
  }

  const packageId = contentPackage.id
  const skcs = db.prepare(`
    select * from product_content_skc
    where content_package_id = ?
    order by skc_code
  `).all(packageId)

  const skus = db.prepare(`
    select * from product_content_sku
    where content_package_id = ?
    order by skc_code, size_code, sku_code
  `).all(packageId)

  const fields = db.prepare(`
    select * from product_content_field
    where content_package_id = ?
    order by is_key desc, field_name
  `).all(packageId)

  const sizes = db.prepare(`
    select * from product_content_size
    where content_package_id = ?
    order by sort_no, size_name
  `).all(packageId)

  const detailPages = db.prepare(`
    select * from product_content_detail_page
    where content_package_id = ?
    order by page_index
  `).all(packageId)

  const sizeTables = db.prepare(`
    select * from product_content_size_table
    where content_package_id = ?
    order by table_index
  `).all(packageId)

  const sizeTableRows = db.prepare(`
    select * from product_content_size_table_row
    where content_package_id = ?
    order by table_index, row_index
  `).all(packageId)

  const assets = db.prepare(`
    select * from product_asset
    where content_package_id = ?
    order by
      case source_kind
        when 'PICTURE' then 0
        when 'DETAIL_SCREENSHOT' then 1
        when 'DETAIL_MODULE' then 2
        else 3
      end,
      coalesce(detail_page_index, 999999),
      coalesce(sort_no, module_index, 999999),
      id
  `).all(packageId)

  return c.json({
    spu_code: spuCode,
    content_package: contentPackage,
    skcs,
    skus,
    fields,
    sizes,
    detail_pages: detailPages,
    size_tables: sizeTables,
    size_table_rows: sizeTableRows,
    assets,
  })
})

export default deepdrawContent

