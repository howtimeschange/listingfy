import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const mdmProducts = new Hono()

type SourceRow = {
  id: number
  synced_at?: string | null
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
        spu.spu_code like ?
        or spu.spu_name like ?
        or spu.spu_name_en like ?
        or spu.listing_title_cn like ?
        or spu.listing_title_en like ?
        or spu.shein_spu_code like ?
        or spu.shein_category_name like ?
        or spu.old_style_code like ?
        or spu.brand_code like ?
        or spu.brand_name like ?
        or spu.product_line_name like ?
        or spu.middle_class_name like ?
        or spu.subclass_name like ?
      )
    `,
    params: [like, like, like, like, like, like, like, like, like, like, like, like, like],
  }
}

mdmProducts.get("/", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere(q)

  const items = db.prepare(`
    select
      spu.*,
      (
        select count(*) from product_skc skc
        where skc.spu_id = spu.id
      ) as skc_count,
      (
        select count(*) from product_sku sku
        join product_skc skc on skc.id = sku.skc_id
        where skc.spu_id = spu.id
      ) as sku_count,
      (
        select count(distinct skc.color_name) from product_skc skc
        where skc.spu_id = spu.id and skc.color_name is not null
      ) as color_count,
      (
        select count(distinct sku.size_name) from product_sku sku
        join product_skc skc on skc.id = sku.skc_id
        where skc.spu_id = spu.id and sku.size_name is not null
      ) as size_count,
      coalesce(
        spu.pic_url,
        (
          select skc.pic_url from product_skc skc
          where skc.spu_id = spu.id and skc.pic_url is not null
          order by skc.skc_code
          limit 1
        ),
        (
          select sku.pic_url from product_sku sku
          join product_skc skc on skc.id = sku.skc_id
          where skc.spu_id = spu.id and sku.pic_url is not null
          order by skc.skc_code, sku.sku_code
          limit 1
        )
      ) as hero_image_url
    from product_spu spu
    ${clause}
    order by coalesce(spu.synced_at, spu.last_update_date, spu.updated_at) desc,
      spu.spu_code desc
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from product_spu spu
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

mdmProducts.get("/summary", (c) => {
  const db = getDb()
  const summary = db.prepare(`
    select
      (select count(*) from product_spu) as spu_count,
      (select count(*) from product_skc) as skc_count,
      (select count(*) from product_sku) as sku_count,
      (
        select count(*) from product_spu
        where coalesce(enable_status, data_status, approve_status, status_name) is not null
      ) as status_count,
      (select max(synced_at) from product_spu) as latest_synced_at
  `).get()

  return c.json(summary)
})

mdmProducts.get("/:spuCode", (c) => {
  const db = getDb()
  const spuCode = c.req.param("spuCode")

  const spu = (db.prepare(`
    select * from product_spu where spu_code = ?
  `).get(spuCode) as SourceRow | undefined) ?? null

  if (!spu) {
    throw new HTTPException(404, { message: `MDM product not found: ${spuCode}` })
  }

  const skcs = db.prepare(`
    select skc.*, count(sku.id) as sku_count
    from product_skc skc
    left join product_sku sku on sku.skc_id = skc.id
    where skc.spu_id = ?
    group by skc.id
    order by skc.skc_code
  `).all(spu.id)

  const skus = db.prepare(`
    select sku.*, skc.skc_code, skc.color_name as skc_color_name
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    where skc.spu_id = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(spu.id)

  return c.json({
    spu_code: spuCode,
    spu,
    skcs,
    skus,
  })
})

export default mdmProducts

