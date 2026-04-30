import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const listingBatches = new Hono()

type SourceRow = Record<string, unknown>

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
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

function batchTerms(value: unknown) {
  return normalizeText(value)
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function batchNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "")
  return `SHEIN-BATCH-${date}-${Date.now().toString().slice(-6)}`
}

function batchWhere(platform: string, q: string) {
  const clauses = ["b.platform = ?"]
  const params: unknown[] = [platform]
  if (q) {
    clauses.push("(b.batch_no like ? or coalesce(batch.batch_name, b.batch_no) like ? or coalesce(batch.note, '') like ?)")
    const like = `%${q}%`
    params.push(like, like, like)
  }
  return { where: clauses.join(" and "), params }
}

function listSelect() {
  return `
    select
      b.batch_no,
      coalesce(batch.id, 0) as id,
      coalesce(batch.batch_name, b.batch_no) as batch_name,
      coalesce(batch.status, 'ACTIVE') as status,
      coalesce(batch.source_type, 'LISTING') as source_type,
      batch.note,
      coalesce(batch.created_at, min(listing.created_at)) as created_at,
      coalesce(batch.updated_at, max(listing.updated_at)) as updated_at,
      count(distinct listing.id) as draft_count,
      count(distinct skc.id) as skc_count,
      count(distinct sku.id) as sku_count,
      count(distinct case when issue.severity = 'ERROR' and issue.resolved = 0 then issue.id end) as blocker_count,
      count(distinct case when listing.status in ('DRAFT', 'NEEDS_ENRICHMENT', 'READY_TO_VALIDATE', 'READY_TO_PUBLISH') then listing.id end) as draft_status_count,
      count(distinct case when listing.status in ('PUBLISHING') then listing.id end) as publishing_count,
      count(distinct case when listing.status in ('PUBLISH_SUBMITTED', 'UNDER_REVIEW') then listing.id end) as auditing_count,
      count(distinct case when listing.status = 'APPROVED' then listing.id end) as approved_count,
      count(distinct case when listing.status in ('PUBLISH_FAILED', 'REJECTED', 'FAILED') then listing.id end) as failed_count
  `
}

function batchesCte() {
  return `
    with batches as (
      select distinct platform, listing_batch_no as batch_no
      from listing
      where coalesce(listing_batch_no, '') <> ''
      union
      select platform, batch_no
      from listing_batch
    )
  `
}

listingBatches.get("/", (c) => {
  const db = getDb()
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN") || "SHEIN"
  const q = normalizeText(c.req.query("q"))
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { where, params } = batchWhere(platform, q)
  const items = db.prepare(`
    ${batchesCte()}
    ${listSelect()}
    from batches b
    left join listing_batch batch on batch.batch_no = b.batch_no and batch.platform = b.platform
    left join listing on listing.listing_batch_no = b.batch_no and listing.platform = b.platform
    left join listing_skc skc on skc.listing_id = listing.id
    left join listing_sku sku on sku.listing_skc_id = skc.id
    left join listing_validation_result issue on issue.listing_id = listing.id
    where ${where}
    group by b.batch_no
    order by updated_at desc, b.batch_no desc
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]
  const total = db.prepare(`
    ${batchesCte()}
    select count(*) as count
    from batches b
    left join listing_batch batch on batch.batch_no = b.batch_no and batch.platform = b.platform
    where ${where}
  `).get(...params) as SourceRow
  return c.json({
    items,
    pagination: {
      total: Number(total.count ?? 0),
      limit,
      offset,
    },
  })
})

listingBatches.post("/", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    batch_name?: unknown
    batch_search?: unknown
    listing_ids?: unknown[]
    note?: unknown
  }
  const platform = "SHEIN"
  const name = normalizeText(body.batch_name) || `SHEIN 上新批次 ${new Date().toISOString().slice(0, 10)}`
  const no = batchNo()
  const terms = batchTerms(body.batch_search)
  const listingIds = Array.from(new Set((Array.isArray(body.listing_ids) ? body.listing_ids : []).map(Number).filter((id) => Number.isFinite(id) && id > 0)))
  if (terms.length === 0 && listingIds.length === 0) {
    throw new HTTPException(400, { message: "请输入款号，或选择要加入批次的草稿" })
  }

  const listingRows = db.prepare(`
    select id
    from listing
    where platform = 'SHEIN'
      and (
        ${listingIds.length ? `id in (${listingIds.map(() => "?").join(",")})` : "0"}
        ${terms.length ? `or ${terms.map(() => "spu_code like ?").join(" or ")}` : ""}
      )
  `).all(
    ...listingIds,
    ...terms.map((term) => `%${term}%`),
  ) as SourceRow[]
  if (listingRows.length === 0) {
    throw new HTTPException(404, { message: "没有找到可加入批次的 SHEIN 发布草稿" })
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      insert into listing_batch (
        platform,
        batch_no,
        batch_name,
        status,
        source_type,
        note,
        created_by
      )
      values (?, ?, ?, 'ACTIVE', 'MANUAL', ?, 'codex')
    `).run(platform, no, name, normalizeText(body.note) || null)
    db.prepare(`
      update listing
      set listing_batch_no = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id in (${listingRows.map(() => "?").join(",")})
    `).run(no, ...listingRows.map((row) => row.id))
  })
  transaction()
  const created = db.prepare("select * from listing_batch where batch_no = ?").get(no)
  return c.json({ ok: true, batch: created, draft_count: listingRows.length })
})

listingBatches.get("/:id", (c) => {
  const db = getDb()
  const id = c.req.param("id")
  const batch = /^\d+$/.test(id)
    ? db.prepare("select * from listing_batch where id = ?").get(Number(id)) as SourceRow | undefined
    : db.prepare("select * from listing_batch where batch_no = ?").get(id) as SourceRow | undefined
  const batchNoValue = normalizeText(batch?.batch_no) || id
  const summary = db.prepare(`
    ${batchesCte()}
    ${listSelect()}
    from batches b
    left join listing_batch batch on batch.batch_no = b.batch_no and batch.platform = b.platform
    left join listing on listing.listing_batch_no = b.batch_no and listing.platform = b.platform
    left join listing_skc skc on skc.listing_id = listing.id
    left join listing_sku sku on sku.listing_skc_id = skc.id
    left join listing_validation_result issue on issue.listing_id = listing.id
    where b.platform = 'SHEIN'
      and b.batch_no = ?
    group by b.batch_no
  `).get(batchNoValue) as SourceRow | undefined
  if (!summary) {
    throw new HTTPException(404, { message: "批次不存在" })
  }
  const drafts = db.prepare(`
    select
      listing.*,
      spu.spu_name,
      spu.brand_name,
      (
        select count(*) from listing_skc skc where skc.listing_id = listing.id
      ) as skc_count,
      (
        select count(*)
        from listing_sku sku
        join listing_skc skc on skc.id = sku.listing_skc_id
        where skc.listing_id = listing.id
      ) as sku_count,
      (
        select count(*)
        from listing_validation_result issue
        where issue.listing_id = listing.id
          and issue.severity = 'ERROR'
          and issue.resolved = 0
      ) as blocker_count,
      (
        select max(version.version_no)
        from listing_publish_version version
        where version.listing_id = listing.id
      ) as latest_version_no
    from listing
    join product_spu spu on spu.id = listing.product_spu_id
    where listing.platform = 'SHEIN'
      and listing.listing_batch_no = ?
    order by listing.updated_at desc, listing.id desc
  `).all(batchNoValue) as SourceRow[]
  return c.json({
    batch: {
      ...summary,
      ...(batch ?? {}),
      batch_no: batchNoValue,
      batch_name: normalizeText(batch?.batch_name) || normalizeText(summary.batch_name) || batchNoValue,
    },
    drafts,
  })
})

export default listingBatches
