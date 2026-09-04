import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { currentUser, requirePermission, trustedClientAddress } from "../lib/auth"
import { auditFromContext } from "../lib/audit"
import { requeueCategoryAiSuggestionTask } from "./category-mapping"
import { requeueProductArchiveDraftAsyncTask } from "./product-archive-drafts"
import { requeuePlatformProductAsyncTask } from "../services/shein-platform-product-jobs"
import { backgroundTaskLimiterSnapshot } from "../lib/background-task-limiter"

const system = new Hono()
const STOPPED_BY_USER_MESSAGE = "用户手动停止任务，未处理的项目已不再继续执行"
const ACTIVE_JOB_STATUSES = new Set(["queued", "running"])
const INTERRUPTIBLE_ITEM_STATUSES = new Set(["queued", "running", "retrying"])

type JsonRecord = Record<string, unknown>
type AsyncTaskType =
  | "product_archive_mdm_draft"
  | "product_archive_hangtag_washlabel_ocr"
  | "product_archive_ai_fill"
  | "product_archive_rebuild"
  | "product_archive_publish_precheck"
  | "product_archive_publish"
  | "listing_launch_plan_import"
  | "category_mapping_ai_suggestions"
  | "shein_platform_product_sync"
  | "shein_platform_product_export"

function pagination(c: Context) {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200)
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0)
  return { limit, offset }
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function parseJson(value: unknown, fallback: unknown) {
  if (value == null || value === "") return fallback
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function parseJsonObject(value: unknown): JsonRecord {
  const parsed = parseJson(value, {})
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {}
}

function parseJsonArray(value: unknown): JsonRecord[] {
  const parsed = parseJson(value, [])
  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as JsonRecord[] : []
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function asyncTaskType(value: string): AsyncTaskType {
  const normalized = value.trim()
  switch (normalized) {
    case "product_archive_mdm_draft":
    case "product_archive_hangtag_washlabel_ocr":
    case "product_archive_ai_fill":
    case "product_archive_rebuild":
    case "product_archive_publish_precheck":
    case "product_archive_publish":
    case "listing_launch_plan_import":
    case "category_mapping_ai_suggestions":
    case "shein_platform_product_sync":
    case "shein_platform_product_export":
      return normalized
    default:
      throw new HTTPException(400, { message: "不支持的任务类型" })
  }
}

function productArchiveQueueName(type: AsyncTaskType) {
  switch (type) {
    case "product_archive_mdm_draft":
      return "product_archive_drafts"
    case "product_archive_hangtag_washlabel_ocr":
      return "product_archive_hangtag_washlabel_ocr"
    case "product_archive_ai_fill":
      return "product_archive_ai_fill"
    case "product_archive_rebuild":
      return "product_archive_rebuild"
    case "product_archive_publish_precheck":
      return "product_archive_publish_precheck"
    case "product_archive_publish":
      return "product_archive_publish"
    default:
      return null
  }
}

function platformProductJobType(type: AsyncTaskType) {
  if (type === "shein_platform_product_sync") return "sync"
  if (type === "shein_platform_product_export") return "export"
  return null
}

function requireAsyncTaskActionPermission(c: Context, type: AsyncTaskType) {
  if (type === "product_archive_publish_precheck" || type === "product_archive_publish") {
    requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
    return
  }
  if (type === "product_archive_mdm_draft" || type === "product_archive_hangtag_washlabel_ocr" || type === "product_archive_ai_fill" || type === "product_archive_rebuild") {
    requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
    return
  }
  if (type === "listing_launch_plan_import") {
    requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
    return
  }
  if (type === "category_mapping_ai_suggestions") {
    requirePermission(c, "RULE_WRITE")
    return
  }
  if (type === "shein_platform_product_sync") {
    requirePermission(c, "SYNC_RUN")
    return
  }
  requirePermission(c, "LISTING_READ")
}

function stopItems(items: JsonRecord[], now: string) {
  return items.map((item) => {
    const status = stringValue(item.status)
    if (!INTERRUPTIBLE_ITEM_STATUSES.has(status)) return item
    return {
      ...item,
      status: "failed",
      error: stringValue(item.error) || STOPPED_BY_USER_MESSAGE,
      error_message: stringValue(item.error_message) || STOPPED_BY_USER_MESSAGE,
      finished_at: now,
      next_retry_at: null,
    }
  })
}

function jobCounts(job: JsonRecord, items: JsonRecord[]) {
  const completed = items.filter((item) => stringValue(item.status) === "completed").length
  const failed = items.filter((item) => stringValue(item.status) === "failed").length
  const total = items.length || numberValue(job.total_count)
  return {
    total,
    completed: items.length ? completed : numberValue(job.completed_count),
    failed: items.length ? failed : Math.max(numberValue(job.failed_count), Math.max(0, total - numberValue(job.completed_count))),
  }
}

function stopJobPayload(value: unknown, now: string) {
  const job = parseJsonObject(value)
  const items = stopItems(parseJsonArray(job.items), now)
  const counts = jobCounts(job, items)
  return {
    ...job,
    status: "completed",
    outcome: "stopped",
    total_count: counts.total,
    completed_count: counts.completed,
    failed_count: counts.failed,
    items,
    current_item: null,
    failed_items: items.filter((item) => stringValue(item.status) === "failed").slice(0, 20),
    error: stringValue(job.error) || STOPPED_BY_USER_MESSAGE,
    finished_at: stringValue(job.finished_at) || now,
  }
}

function stopProductArchiveTask(taskType: AsyncTaskType, jobId: string) {
  const queueName = productArchiveQueueName(taskType)
  if (!queueName) return null
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare(`
      select *
      from product_archive_sync_job
      where id = ?
        and queue_name = ?
      for update
    `).get(jobId, queueName) as JsonRecord | undefined
    if (!row) return null
    const job = ACTIVE_JOB_STATUSES.has(stringValue(row.status))
      ? stopJobPayload(row.payload_json, new Date().toISOString())
      : parseJsonObject(row.payload_json)
    const updated = db.prepare(`
      update product_archive_sync_job
      set status = 'completed',
        payload_json = ?::jsonb,
        lease_token = null,
        lease_expires_at = null,
        updated_at = clock_timestamp()
      where id = ?
        and queue_name = ?
      returning payload_json
    `).get(jsonText(job), jobId, queueName) as JsonRecord | undefined
    return { ok: true, job: parseJsonObject(updated?.payload_json ?? job) }
  })()
}

function stopListingLaunchPlanImportTask(jobId: string) {
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare(`
      select *
      from listing_launch_plan_import_job
      where id = ?
      for update
    `).get(jobId) as JsonRecord | undefined
    if (!row) return null
    if (!ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
      return { ok: true, job: serializeImportLikeJob(row) }
    }
    const now = new Date().toISOString()
    const job = stopJobPayload({
      ...row,
      items: parseJsonArray(row.items_json),
      result: parseJsonObject(row.result_json),
    }, now)
    const result = {
      ...parseJsonObject(row.result_json),
      stopped: true,
      stopped_at: now,
      message: STOPPED_BY_USER_MESSAGE,
    }
    const updated = db.prepare(`
      update listing_launch_plan_import_job
      set status = 'completed',
        completed_count = ?,
        failed_count = ?,
        items_json = ?::jsonb,
        result_json = ?::jsonb,
        error_message = ?,
        started_at = ?,
        finished_at = ?,
        updated_at = ?
      where id = ?
      returning *
    `).get(
      job.completed_count,
      Math.max(1, numberValue(job.failed_count)),
      jsonText(job.items),
      jsonText(result),
      STOPPED_BY_USER_MESSAGE,
      now,
      now,
      now,
      jobId,
    ) as JsonRecord | undefined
    return updated ? { ok: true, job: serializeImportLikeJob(updated) } : null
  })()
}

function serializeImportLikeJob(row: JsonRecord) {
  const items = parseJsonArray(row.items_json)
  return {
    id: stringValue(row.id),
    status: stringValue(row.status) || "queued",
    title: stringValue(row.title),
    total_count: numberValue(row.total_count),
    completed_count: numberValue(row.completed_count),
    failed_count: numberValue(row.failed_count),
    created_at: stringValue(row.created_at),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    items,
    current_item: items.find((item) => stringValue(item.status) === "running") ?? null,
    failed_items: items.filter((item) => stringValue(item.status) === "failed").slice(0, 20),
    result: parseJsonObject(row.result_json),
    error: stringValue(row.error_message) || null,
  }
}

function stopCategoryAiSuggestionTask(jobId: string) {
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare(`
      select *
      from category_ai_suggestion_job
      where id = ?
      for update
    `).get(jobId) as JsonRecord | undefined
    if (!row) return null
    if (!ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
      return { ok: true, job: serializeCategoryAiJob(row) }
    }
    const now = new Date().toISOString()
    const items = stopItems(parseJsonArray(row.items_json), now)
    const counts = jobCounts(row, items)
    const updated = db.prepare(`
      update category_ai_suggestion_job
      set status = 'completed',
        completed_count = ?,
        failed_count = ?,
        items_json = ?::jsonb,
        error_message = ?,
        claim_token = null,
        claim_expires_at = null,
        claim_version = claim_version + 1,
        started_at = ?::timestamptz,
        finished_at = ?::timestamptz,
        updated_at = clock_timestamp()
      where id = ?
      returning *
    `).get(
      counts.completed,
      Math.max(1, counts.failed),
      jsonText(items),
      STOPPED_BY_USER_MESSAGE,
      now,
      now,
      jobId,
    ) as JsonRecord | undefined
    return updated ? { ok: true, job: serializeCategoryAiJob(updated) } : null
  })()
}

function serializeCategoryAiJob(row: JsonRecord) {
  const items = parseJsonArray(row.items_json)
  return {
    id: stringValue(row.id),
    status: stringValue(row.status) || "queued",
    total_count: numberValue(row.total_count),
    completed_count: numberValue(row.completed_count),
    failed_count: numberValue(row.failed_count),
    created_at: stringValue(row.created_at),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    items,
    current_item: items.find((item) => stringValue(item.status) === "running") ?? null,
    failed_items: items.filter((item) => stringValue(item.status) === "failed").slice(0, 20),
    result: { suggestions: parseJsonArray(row.suggestions_json) },
    error: stringValue(row.error_message) || null,
  }
}

function stopPlatformProductTask(taskType: AsyncTaskType, jobId: string) {
  const jobType = platformProductJobType(taskType)
  if (!jobType) return null
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare(`
      select *
      from shein_platform_product_job
      where id = ?
        and job_type = ?
      for update
    `).get(jobId, jobType) as JsonRecord | undefined
    if (!row) return null
    if (!ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
      return { ok: true, job: serializePlatformProductJob(row) }
    }
    const now = new Date().toISOString()
    const itemWrite = db.prepare(`
      update shein_platform_product_job_item
      set status = 'failed',
        error_message = ?,
        finished_at = ?,
        updated_at = ?
      where job_id = ?
        and status in ('queued', 'running')
    `).run(STOPPED_BY_USER_MESSAGE, now, now, jobId)
    const items = stopItems(parseJsonArray(row.items_json), now)
    const counts = platformProductCounts(jobId, row, items)
    const updated = db.prepare(`
      update shein_platform_product_job
      set status = 'completed',
        completed_count = ?,
        failed_count = ?,
        items_json = ?,
        error_message = ?,
        started_at = ?,
        finished_at = ?,
        updated_at = ?
      where id = ?
        and job_type = ?
      returning *
    `).get(
      counts.completed,
      Math.max(numberValue(itemWrite?.changes), counts.failed, 1),
      jsonText(items),
      STOPPED_BY_USER_MESSAGE,
      now,
      now,
      now,
      jobId,
      jobType,
    ) as JsonRecord | undefined
    return updated ? { ok: true, job: serializePlatformProductJob(updated) } : null
  })()
}

function platformProductCounts(jobId: string, row: JsonRecord, items: JsonRecord[]) {
  const db = getDb()
  const counts = db.prepare(`
    select
      count(*) as total_count,
      sum(case when status = 'completed' then 1 else 0 end) as completed_count,
      sum(case when status = 'failed' then 1 else 0 end) as failed_count
    from shein_platform_product_job_item
    where job_id = ?
  `).get(jobId) as JsonRecord | undefined
  if (numberValue(counts?.total_count) > 0) {
    return {
      total: numberValue(counts?.total_count),
      completed: numberValue(counts?.completed_count),
      failed: numberValue(counts?.failed_count),
    }
  }
  return jobCounts(row, items)
}

function serializePlatformProductJob(row: JsonRecord) {
  const items = parseJsonArray(row.items_json)
  const counts = platformProductCounts(stringValue(row.id), row, items)
  const failedRows = getDb().prepare(`
    select spu_code, status, error_message as error, result_json as result, started_at, finished_at
    from shein_platform_product_job_item
    where job_id = ?
      and status = 'failed'
    order by item_index asc
    limit 20
  `).all(stringValue(row.id)) as JsonRecord[]
  return {
    id: stringValue(row.id),
    status: stringValue(row.status) || "queued",
    title: stringValue(row.title),
    total_count: counts.total,
    completed_count: counts.completed,
    failed_count: counts.failed,
    created_at: stringValue(row.created_at),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    items,
    current_item: null,
    failed_items: failedRows.length ? failedRows : items.filter((item) => stringValue(item.status) === "failed").slice(0, 20),
    downloadUrl: stringValue(row.download_url) || undefined,
    fileName: stringValue(row.file_name) || undefined,
    error: stringValue(row.error_message) || null,
  }
}

function stopAsyncTask(type: AsyncTaskType, jobId: string) {
  return stopProductArchiveTask(type, jobId)
    ?? (type === "listing_launch_plan_import" ? stopListingLaunchPlanImportTask(jobId) : null)
    ?? (type === "category_mapping_ai_suggestions" ? stopCategoryAiSuggestionTask(jobId) : null)
    ?? stopPlatformProductTask(type, jobId)
}

function requeueAsyncTask(c: Context, type: AsyncTaskType, jobId: string) {
  const user = currentUser(c)
  const actor = user ? { id: user.id, username: user.username } : null
  const ipAddress = trustedClientAddress({
    forwardedFor: c.req.header("x-forwarded-for"),
    realIp: c.req.header("x-real-ip"),
  })
  const productArchiveQueue = productArchiveQueueName(type)
  if (productArchiveQueue) {
    return requeueProductArchiveDraftAsyncTask({
      taskType: type,
      jobId,
      actor,
      ipAddress,
    })
  }
  if (type === "category_mapping_ai_suggestions") {
    return requeueCategoryAiSuggestionTask(jobId)
  }
  const platformType = platformProductJobType(type)
  if (platformType) {
    return requeuePlatformProductAsyncTask({
      type: platformType,
      jobId,
      actor,
    })
  }
  if (type === "listing_launch_plan_import") {
    throw new HTTPException(409, { message: "上市计划导入依赖原始上传文件；请重新上传表格发起新任务。" })
  }
  throw new HTTPException(400, { message: "不支持的任务类型" })
}

function deleteAsyncTask(type: AsyncTaskType, jobId: string) {
  const db = getDb()
  const productArchiveQueue = productArchiveQueueName(type)
  const platformType = platformProductJobType(type)
  if (productArchiveQueue) {
    const row = db.prepare("select status from product_archive_sync_job where id = ? and queue_name = ?").get(jobId, productArchiveQueue) as JsonRecord | undefined
    if (!row) return { ok: true, deleted: false, missing: true }
    if (ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
      throw new HTTPException(409, { message: "任务还在执行中，请先暂停任务，再移除任务卡片" })
    }
    db.prepare("delete from product_archive_sync_job where id = ? and queue_name = ? and status = 'completed'").run(jobId, productArchiveQueue)
    return { ok: true, deleted: true }
  }
  if (type === "listing_launch_plan_import") {
    return deleteCompletedRow("listing_launch_plan_import_job", jobId)
  }
  if (type === "category_mapping_ai_suggestions") {
    return deleteCompletedRow("category_ai_suggestion_job", jobId)
  }
  if (platformType) {
    const row = db.prepare("select status from shein_platform_product_job where id = ? and job_type = ?").get(jobId, platformType) as JsonRecord | undefined
    if (!row) return { ok: true, deleted: false, missing: true }
    if (ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
      throw new HTTPException(409, { message: "任务还在执行中，请先暂停任务，再移除任务卡片" })
    }
    db.prepare("delete from shein_platform_product_job where id = ? and job_type = ? and status = 'completed'").run(jobId, platformType)
    return { ok: true, deleted: true }
  }
  throw new HTTPException(400, { message: "不支持的任务类型" })
}

function deleteCompletedRow(tableName: "listing_launch_plan_import_job" | "category_ai_suggestion_job", jobId: string) {
  const db = getDb()
  const row = db.prepare(`select status from ${tableName} where id = ?`).get(jobId) as JsonRecord | undefined
  if (!row) return { ok: true, deleted: false, missing: true }
  if (ACTIVE_JOB_STATUSES.has(stringValue(row.status))) {
    throw new HTTPException(409, { message: "任务还在执行中，请先暂停任务，再移除任务卡片" })
  }
  db.prepare(`delete from ${tableName} where id = ? and status = 'completed'`).run(jobId)
  return { ok: true, deleted: true }
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
        cast(id as text) as id,
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
        cast(id as text) as id,
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
      union all
      select
        'PLATFORM_PRODUCT_JOB' as task_source,
        id,
        'SHEIN' as platform,
        title as task_name,
        id as task_no,
        status,
        started_at,
        finished_at,
        total_count,
        completed_count as success_count,
        failed_count,
        error_message,
        created_at
      from shein_platform_product_job
    )
    order by created_at desc
    limit ? offset ?
  `).all(limit, offset)
  const total = db.prepare(`
    select
      (select count(*) from sync_batch) +
      (select count(*) from listing_publish_task) +
      (select count(*) from shein_platform_product_job) as count
  `).get() as { count: number }
  return c.json({ items, pagination: { total: total.count, limit, offset } })
})

system.get("/background-task-limiter", (c) => {
  requirePermission(c, "SYNC_READ")
  return c.json(backgroundTaskLimiterSnapshot())
})

system.post("/async-tasks/:taskType/:taskId/stop", (c) => {
  const taskType = asyncTaskType(c.req.param("taskType"))
  const taskId = c.req.param("taskId").trim()
  if (!taskId) throw new HTTPException(400, { message: "缺少任务 ID" })
  requireAsyncTaskActionPermission(c, taskType)
  const result = stopAsyncTask(taskType, taskId)
  if (!result) throw new HTTPException(404, { message: "后台任务不存在或不支持暂停" })
  auditFromContext(c, {
    action: "async_task.stopped",
    module: "SYSTEM",
    entityType: taskType,
    entityId: taskId,
    summary: `用户手动停止后台任务 ${taskId}`,
    metadata: {
      taskType,
      taskId,
    },
  })
  return c.json({
    ...result,
    message: STOPPED_BY_USER_MESSAGE,
  })
})

system.post("/async-tasks/:taskType/:taskId/requeue", (c) => {
  const taskType = asyncTaskType(c.req.param("taskType"))
  const taskId = c.req.param("taskId").trim()
  if (!taskId) throw new HTTPException(400, { message: "缺少任务 ID" })
  requireAsyncTaskActionPermission(c, taskType)
  let job: { id?: unknown } | null
  try {
    job = requeueAsyncTask(c, taskType, taskId) as { id?: unknown } | null
  } catch (error) {
    if (error instanceof HTTPException) throw error
    throw new HTTPException(409, { message: error instanceof Error ? error.message : String(error) })
  }
  if (!job) throw new HTTPException(404, { message: "后台任务不存在或不支持重新加入队列" })
  auditFromContext(c, {
    action: "async_task.requeued",
    module: "SYSTEM",
    entityType: taskType,
    entityId: taskId,
    summary: `用户将后台任务重新加入队列 ${taskId}`,
    metadata: {
      taskType,
      taskId,
      newJobId: job.id,
    },
  })
  return c.json({
    ok: true,
    job,
    message: "已从未完成项重新加入队列，已成功的项目不会重复执行",
  }, 202)
})

system.delete("/async-tasks/:taskType/:taskId", (c) => {
  const taskType = asyncTaskType(c.req.param("taskType"))
  const taskId = c.req.param("taskId").trim()
  if (!taskId) throw new HTTPException(400, { message: "缺少任务 ID" })
  requireAsyncTaskActionPermission(c, taskType)
  const result = deleteAsyncTask(taskType, taskId)
  auditFromContext(c, {
    action: "async_task.deleted",
    module: "SYSTEM",
    entityType: taskType,
    entityId: taskId,
    summary: `用户移除后台任务记录 ${taskId}`,
    metadata: {
      taskType,
      taskId,
      ...result,
    },
  })
  return c.json(result)
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
