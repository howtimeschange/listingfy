import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

const publishTasks = new Hono()

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

function parseJsonObject(value: unknown) {
  if (!value || typeof value !== "string") return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function taskBaseFrom() {
  return `
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    join product_spu spu on spu.id = listing.product_spu_id
    join channel_account account on account.id = listing.channel_account_id
    left join listing_publish_version version on version.id = task.publish_version_id
  `
}

function taskSelect() {
  return `
    select
      task.*,
      listing.spu_code,
      listing.title,
      listing.status as listing_status,
      listing.validation_status,
      listing.platform_category_id,
      listing.product_type_id,
      listing.platform_category_name,
      listing.platform_category_path,
      listing.completeness,
      listing.channel_account_id,
      account.account_name,
      spu.spu_name,
      spu.brand_name,
      version.version_no,
      version.status as version_status,
      version.change_summary,
      version.submitted_at
  `
}

function buildListWhere(c: Context) {
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN")
  const q = normalizeText(c.req.query("q"))
  const batchSearch = readCsv(c.req.query("batch_search"))
  const statuses = readCsv(c.req.query("statuses") ?? c.req.query("status"))
  const clauses: string[] = []
  const params: unknown[] = []

  if (platform && platform !== "all") {
    clauses.push("task.platform = ?")
    params.push(platform)
  }
  if (statuses.length > 0) {
    clauses.push(`task.status in (${statuses.map(() => "?").join(", ")})`)
    params.push(...statuses)
  }

  const terms = Array.from(new Set([q, ...batchSearch].filter(Boolean)))
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() => `(
      listing.spu_code like ?
      or listing.title like ?
      or spu.spu_name like ?
      or task.platform_trace_id like ?
      or task.platform_version like ?
      or task.error_code like ?
      or task.error_message like ?
    )`).join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like, like, like, like, like)
    }
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    params,
  }
}

publishTasks.get("/", (c) => {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { where, params } = buildListWhere(c)
  const from = taskBaseFrom()

  const items = db.prepare(`
    ${taskSelect()}
    ${from}
    ${where}
    order by task.created_at desc, task.id desc
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]

  const total = db.prepare(`
    select count(*) as count
    ${from}
    ${where}
  `).get(...params) as { count: number }

  const statusRows = db.prepare(`
    select task.status, count(*) as count
    ${from}
    ${where}
    group by task.status
    order by count(*) desc
  `).all(...params) as SourceRow[]

  return c.json({
    items,
    summary: {
      total: Number(total.count ?? 0),
      by_status: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count ?? 0)])),
    },
    pagination: {
      total: Number(total.count ?? 0),
      limit,
      offset,
    },
  })
})

publishTasks.get("/filters", (c) => {
  const db = getDb()
  const platforms = db.prepare(`
    select platform, count(*) as count
    from listing_publish_task
    group by platform
    order by platform
  `).all() as SourceRow[]
  const statuses = db.prepare(`
    select status, count(*) as count
    from listing_publish_task
    group by status
    order by status
  `).all() as SourceRow[]
  return c.json({ platforms, statuses })
})

publishTasks.get("/:id", (c) => {
  const db = getDb()
  const taskId = Number(c.req.param("id"))
  if (!Number.isFinite(taskId)) {
    throw new HTTPException(400, { message: "无效发布任务 ID" })
  }

  const task = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.id = ?
  `).get(taskId) as SourceRow | undefined
  if (!task) {
    throw new HTTPException(404, { message: "发布任务不存在" })
  }

  const platformIdentities = db.prepare(`
    select identity.*
    from platform_identity identity
    where identity.platform = ?
      and identity.channel_account_id = ?
      and (
        (identity.local_type = 'listing' and identity.local_id = ?)
        or (identity.local_type = 'listing_skc' and identity.local_id in (
          select id from listing_skc where listing_id = ?
        ))
        or (identity.local_type = 'listing_sku' and identity.local_id in (
          select sku.id
          from listing_sku sku
          join listing_skc skc on skc.id = sku.listing_skc_id
          where skc.listing_id = ?
        ))
      )
    order by
      case identity.local_type when 'listing' then 1 when 'listing_skc' then 2 else 3 end,
      identity.id
  `).all(task.platform, task.channel_account_id, task.listing_id, task.listing_id, task.listing_id) as SourceRow[]

  const relatedTasks = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.listing_id = ?
    order by task.id desc
  `).all(task.listing_id) as SourceRow[]

  return c.json({
    task: {
      ...task,
      request_payload: parseJsonObject(task.request_payload_json),
      response_payload: parseJsonObject(task.response_payload_json),
    },
    platform_identities: platformIdentities,
    related_tasks: relatedTasks,
  })
})

export default publishTasks
