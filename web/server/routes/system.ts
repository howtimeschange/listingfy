import { Hono } from "hono"
import type { Context } from "hono"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"

const system = new Hono()

function pagination(c: Context) {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200)
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0)
  return { limit, offset }
}

system.get("/sync-tasks", (c) => {
  requirePermission(c, "SYNC_READ")
  const { limit, offset } = pagination(c)
  const db = getDb()
  const items = db.prepare(`
    select *
    from (
      select
        'SYNC_BATCH' as task_source,
        id,
        source_system as platform,
        source_object as task_name,
        batch_no as task_no,
        status,
        started_at,
        finished_at,
        total_count,
        success_count,
        failed_count,
        null as error_message,
        created_at
      from sync_batch
      union all
      select
        'PUBLISH_TASK' as task_source,
        id,
        platform,
        task_type as task_name,
        cast(id as text) as task_no,
        status,
        started_at,
        finished_at,
        1 as total_count,
        case when status in ('PUBLISH_SUBMITTED', 'APPROVED', 'SUBMITTED') then 1 else 0 end as success_count,
        case when status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED') then 1 else 0 end as failed_count,
        error_message,
        created_at
      from listing_publish_task
    )
    order by created_at desc
    limit ? offset ?
  `).all(limit, offset)
  const total = db.prepare(`
    select
      (select count(*) from sync_batch) +
      (select count(*) from listing_publish_task) as count
  `).get() as { count: number }
  return c.json({ items, pagination: { total: total.count, limit, offset } })
})

system.get("/operation-logs", (c) => {
  requirePermission(c, "OPERATION_LOG_READ")
  const { limit, offset } = pagination(c)
  const db = getDb()
  const items = db.prepare(`
    select
      id,
      actor_user_id,
      actor_username,
      action,
      module,
      entity_type,
      entity_id,
      summary,
      metadata_json,
      ip_address,
      created_at
    from operation_log
    order by created_at desc, id desc
    limit ? offset ?
  `).all(limit, offset).map((row) => ({
    ...(row as Record<string, unknown>),
    metadata: JSON.parse(String((row as Record<string, unknown>).metadata_json ?? "{}")),
  }))
  const total = db.prepare("select count(*) as count from operation_log").get() as { count: number }
  return c.json({ items, pagination: { total: total.count, limit, offset } })
})

export default system
