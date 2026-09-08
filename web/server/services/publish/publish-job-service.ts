import { HTTPException } from "hono/http-exception"
import type { SyncPostgresDatabase } from "../../../../scripts/lib/postgres_db.mjs"

export type PublishTaskRow = Record<string, unknown> & {
  id: number
  listing_id: number
  publish_version_id: number | null
  platform: string
  task_type: string
  status: string
  attempt_count: number
  max_attempts: number
  idempotency_key: string | null
}

export type EnsurePublishTaskInput = {
  listingId: number
  publishVersionId?: number | null
  platform?: string
  taskType?: string
  status?: string
  attemptCount?: number
  maxAttempts?: number
  requestPayload?: unknown
  idempotencyKey?: string
}

export type MarkPublishTaskFailedInput = {
  taskId: number
  responsePayload?: unknown
  errorCode?: string | null
  errorMessage?: string | null
  now?: Date
}

export type MarkPublishTaskStatusSyncedInput = {
  taskId: number
  status: string
  responsePayload?: unknown
  errorCode?: string | null
  errorMessage?: string | null
  now?: Date
}

export type MarkPublishTransportUnknownInput = {
  taskId: number
  versionId: number
  listingId: number
  spuCode: string
  versionNo: number
  errorCode?: string | null
  errorMessage?: string | null
  now?: Date
}

export type BatchPublishInput = {
  platform?: string
  batchNo: string
  status?: string
  onlyListingIds?: number[]
}

export type BatchPublishSummaryInput = {
  platform?: string
  batchNo: string
}

export type RetryFailedBatchTasksInput = BatchPublishSummaryInput & {
  retryableOnly?: boolean
  now?: Date
}

type SourceRow = Record<string, unknown>

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function nowIso(now = new Date()) {
  return now.toISOString()
}

function json(value: unknown) {
  return JSON.stringify(value ?? {})
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>
  if (!value || typeof value !== "string") return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function taskById(db: SyncPostgresDatabase, taskId: number) {
  return db.prepare("select * from listing_publish_task where id = ?").get(taskId) as PublishTaskRow
}

function platformOf(value: unknown) {
  return normalizeText(value || "SHEIN").toUpperCase()
}

function isUniqueConstraintViolation(error: unknown) {
  const typed = error as { code?: unknown; message?: unknown }
  return normalizeText(typed?.code) === "23505"
    || /unique constraint failed|duplicate key value violates unique constraint/i.test(normalizeText(typed?.message))
}

export function buildPublishTaskIdempotencyKey(input: EnsurePublishTaskInput) {
  const platform = platformOf(input.platform)
  const taskType = normalizeText(input.taskType || "PUBLISH_LISTING").toUpperCase()
  const version = input.publishVersionId == null ? "draft" : String(input.publishVersionId)
  return `${platform}:${taskType}:listing:${input.listingId}:version:${version}`
}

export function classifyPublishFailure(errorCode?: string | null, errorMessage?: string | null) {
  const code = normalizeText(errorCode).toUpperCase()
  const message = normalizeText(errorMessage)
  const haystack = `${code} ${message}`.toLowerCase()
  let category = "PLATFORM_ERROR"
  let retryable = false
  let retryDelayMinutes = 0

  if (["429", "RATE_LIMIT"].includes(code) || /rate limit|too many|限流|频率/.test(haystack)) {
    category = "RATE_LIMIT"
    retryable = true
    retryDelayMinutes = 5
  } else if (/timeout|timed out|econnreset|network|socket|网关|gateway|temporar/.test(haystack)) {
    category = "NETWORK"
    retryable = true
    retryDelayMinutes = 2
  } else if (/pre.?validation|valid|校验|必填|required|missing|枚举/.test(haystack)) {
    category = "VALIDATION"
  } else if (/audit|reject|驳回|审核/.test(haystack)) {
    category = "AUDIT_REJECTED"
  } else if (!code && !message) {
    category = "UNKNOWN"
  }

  const fingerprintText = (message || code || "unknown")
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
  return {
    category,
    retryable,
    retryDelayMinutes,
    fingerprint: `${category}:${fingerprintText}`,
  }
}

export function ensurePublishTask(db: SyncPostgresDatabase, input: EnsurePublishTaskInput) {
  const platform = platformOf(input.platform)
  const taskType = normalizeText(input.taskType || "PUBLISH_LISTING").toUpperCase()
  const idempotencyKey = input.idempotencyKey || buildPublishTaskIdempotencyKey({ ...input, platform, taskType })
  const existing = db.prepare(`
    select *
    from listing_publish_task
    where platform = ?
      and idempotency_key = ?
    limit 1
  `).get(platform, idempotencyKey) as PublishTaskRow | undefined
  if (existing) return { created: false, task: existing }

  const insertTask = () => db.prepare(`
    insert into listing_publish_task (
      listing_id,
      publish_version_id,
      platform,
      task_type,
      status,
      attempt_count,
      max_attempts,
      request_payload_json,
      idempotency_key,
      started_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    input.listingId,
    input.publishVersionId ?? null,
    platform,
    taskType,
    normalizeText(input.status || "PUBLISHING"),
    input.attemptCount ?? 1,
    input.maxAttempts ?? 3,
    json(input.requestPayload),
    idempotencyKey,
  )
  let result
  try {
    const transaction = (db as unknown as {
      transaction?: (operation: () => ReturnType<typeof insertTask>) => () => ReturnType<typeof insertTask>
    }).transaction
    const supportsSavepoints = typeof (db as unknown as { queryResult?: unknown }).queryResult === "function"
    result = supportsSavepoints && typeof transaction === "function"
      ? transaction.call(db, insertTask)()
      : insertTask()
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error

    const racedTask = db.prepare(`
      select *
      from listing_publish_task
      where platform = ?
        and (
          idempotency_key = ?
          or (
            listing_id = ?
            and task_type = ?
            and status in ('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN')
          )
        )
      order by case when idempotency_key = ? then 0 else 1 end, id desc
      limit 1
    `).get(
      platform,
      idempotencyKey,
      input.listingId,
      taskType,
      idempotencyKey,
    ) as PublishTaskRow | undefined
    if (racedTask) return { created: false, task: racedTask }
    throw error
  }
  return { created: true, task: taskById(db, Number(result.lastInsertRowid)) }
}

export function findUnresolvedPublishTask(db: SyncPostgresDatabase, listingId: number) {
  return (db.prepare(`
    select *
    from listing_publish_task
    where listing_id = ?
      and task_type = 'PUBLISH_LISTING'
      and status in ('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN')
    order by id desc
    limit 1
  `).get(listingId) as PublishTaskRow | undefined) ?? null
}

export function markPublishTransportUnknown(
  db: SyncPostgresDatabase,
  input: MarkPublishTransportUnknownInput,
) {
  const finishedAt = nowIso(input.now)
  const errorCode = normalizeText(input.errorCode) || "PUBLISH_TRANSPORT_ERROR"
  const errorMessage = normalizeText(input.errorMessage) || "发布请求结果未知，请先向平台核实后再处理"
  db.transaction(() => {
    db.prepare(`
      update listing_publish_task
      set status = 'PUBLISH_RESULT_UNKNOWN',
        error_code = ?,
        error_message = ?,
        failure_category = 'NETWORK',
        failure_fingerprint = ?,
        retryable = 0,
        finished_at = ?,
        updated_at = ?
      where id = ?
    `).run(errorCode, errorMessage, `NETWORK:${errorCode.toLowerCase()}`, finishedAt, finishedAt, input.taskId)
    db.prepare(`
      update listing_publish_version
      set status = 'RESULT_UNKNOWN',
        error_code = ?,
        error_message = ?
      where id = ?
    `).run(errorCode, errorMessage, input.versionId)
    db.prepare(`
      update listing
      set status = 'PUBLISH_RESULT_UNKNOWN',
        updated_at = ?
      where id = ?
    `).run(finishedAt, input.listingId)
    db.prepare(`
      update shein_product_bucket
      set latest_listing_id = ?,
        latest_version_no = ?,
        latest_publish_status = 'PUBLISH_RESULT_UNKNOWN',
        updated_at = ?
      where spu_code = ?
    `).run(input.listingId, input.versionNo, finishedAt, input.spuCode)
  })()
}

function latestPublishableVersion(db: SyncPostgresDatabase, listingId: number) {
  return db.prepare(`
    select *
    from listing_publish_version
    where listing_id = ?
      and coalesce(request_payload_json, '') <> ''
    order by version_no desc, id desc
    limit 1
  `).get(listingId) as SourceRow | undefined
}

function unresolvedBlockerCount(db: SyncPostgresDatabase, listingId: number) {
  const row = db.prepare(`
    select count(*) as count
    from listing_validation_result
    where listing_id = ?
      and severity = 'ERROR'
      and resolved = 0
  `).get(listingId) as SourceRow
  return Number(row?.count ?? 0)
}

function batchListingRows(db: SyncPostgresDatabase, input: BatchPublishInput) {
  const platform = platformOf(input.platform)
  const ids = Array.from(new Set((input.onlyListingIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0)))
  return db.prepare(`
    select
      listing.id,
      listing.platform,
      listing.spu_code,
      listing.title,
      listing.status,
      listing.validation_status,
      listing.listing_batch_no
    from listing
    where listing.platform = ?
      and listing.listing_batch_no = ?
      ${ids.length ? `and listing.id in (${ids.map(() => "?").join(",")})` : ""}
    order by listing.id
  `).all(platform, normalizeText(input.batchNo), ...ids) as SourceRow[]
}

export function ensureBatchPublishTasks(db: SyncPostgresDatabase, input: BatchPublishInput) {
  const platform = platformOf(input.platform)
  const batchNo = normalizeText(input.batchNo)
  const status = normalizeText(input.status || "PENDING_CONFIRM")
  const created: PublishTaskRow[] = []
  const existing: PublishTaskRow[] = []
  const skipped: Array<{ listing_id: number; spu_code: unknown; title: unknown; reason: string }> = []

  const transaction = db.transaction(() => {
    for (const listing of batchListingRows(db, { ...input, platform, batchNo })) {
      const listingId = Number(listing.id)
      const blockers = unresolvedBlockerCount(db, listingId)
      if (blockers > 0) {
        skipped.push({
          listing_id: listingId,
          spu_code: listing.spu_code,
          title: listing.title,
          reason: `存在 ${blockers} 个未解决阻断项`,
        })
        continue
      }

      const version = latestPublishableVersion(db, listingId)
      if (!version) {
        skipped.push({
          listing_id: listingId,
          spu_code: listing.spu_code,
          title: listing.title,
          reason: "缺少可提交的发布 payload",
        })
        continue
      }
      const requestPayload = parseJsonObject(version.request_payload_json)
      if (Object.keys(requestPayload).length === 0) {
        skipped.push({
          listing_id: listingId,
          spu_code: listing.spu_code,
          title: listing.title,
          reason: "发布 payload 为空",
        })
        continue
      }

      const result = ensurePublishTask(db, {
        listingId,
        publishVersionId: Number(version.id),
        platform,
        taskType: "PUBLISH_LISTING",
        status,
        attemptCount: 0,
        requestPayload,
      })
      if (result.created) created.push(result.task)
      else existing.push(result.task)
    }
  })
  transaction()

  const summary = refreshBatchPublishSummary(db, { platform, batchNo })
  return {
    ok: true,
    batch_no: batchNo,
    platform,
    created_count: created.length,
    existing_count: existing.length,
    skipped_count: skipped.length,
    created,
    existing,
    skipped,
    summary,
  }
}

export function updatePublishTaskRequestPayload(db: SyncPostgresDatabase, taskId: number, requestPayload: unknown) {
  db.prepare(`
    update listing_publish_task
    set request_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(json(requestPayload), taskId)
  return taskById(db, taskId)
}

export function markPublishTaskFailed(db: SyncPostgresDatabase, input: MarkPublishTaskFailedInput) {
  const now = input.now ?? new Date()
  const failure = classifyPublishFailure(input.errorCode, input.errorMessage)
  const nextRetryAt = failure.retryable
    ? new Date(now.getTime() + failure.retryDelayMinutes * 60 * 1000).toISOString()
    : null
  db.prepare(`
    update listing_publish_task
    set status = 'PUBLISH_FAILED',
      response_payload_json = ?,
      error_code = ?,
      error_message = ?,
      failure_category = ?,
      failure_fingerprint = ?,
      retryable = ?,
      next_retry_at = ?,
      finished_at = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    json(input.responsePayload),
    normalizeText(input.errorCode) || null,
    normalizeText(input.errorMessage) || null,
    failure.category,
    failure.fingerprint,
    failure.retryable ? 1 : 0,
    nextRetryAt,
    nowIso(now),
    input.taskId,
  )
  return { task: taskById(db, input.taskId), failure }
}

export function recordPublishStatusQueryFailure(
  db: SyncPostgresDatabase,
  input: { taskId: number; errorCode: string; errorMessage: string },
) {
  db.prepare(`
    update listing_publish_task
    set status_sync_error_code = ?, status_sync_error_message = ?, status_sync_attempted_at = ?
    where id = ?
  `).run(input.errorCode, input.errorMessage, nowIso(), input.taskId)
}

export function markPublishTaskStatusSynced(db: SyncPostgresDatabase, input: MarkPublishTaskStatusSyncedInput) {
  const now = input.now ?? new Date()
  const errorCode = normalizeText(input.errorCode)
  const errorMessage = normalizeText(input.errorMessage)
  const failure = errorCode || errorMessage
    ? classifyPublishFailure(errorCode, errorMessage)
    : null
  db.prepare(`
    update listing_publish_task
    set status = ?,
      response_payload_json = ?,
      error_code = ?,
      error_message = ?,
      failure_category = ?,
      failure_fingerprint = ?,
      retryable = ?,
      next_retry_at = null,
      status_sync_error_code = null,
      status_sync_error_message = null,
      status_sync_attempted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      last_status_synced_at = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalizeText(input.status),
    json(input.responsePayload),
    errorCode || null,
    errorMessage || null,
    failure?.category ?? null,
    failure?.fingerprint ?? null,
    failure?.retryable ? 1 : 0,
    nowIso(now),
    input.taskId,
  )
  return taskById(db, input.taskId)
}

export function publishSummaryForBatch(db: SyncPostgresDatabase, input: BatchPublishSummaryInput) {
  const platform = platformOf(input.platform)
  const batchNo = normalizeText(input.batchNo)
  const listingStatusRows = db.prepare(`
    select status, count(*) as count
    from listing
    where platform = ?
      and listing_batch_no = ?
    group by status
  `).all(platform, batchNo) as SourceRow[]
  const taskStatusRows = db.prepare(`
    select task.status, count(*) as count
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where listing.platform = ?
      and listing.listing_batch_no = ?
    group by task.status
  `).all(platform, batchNo) as SourceRow[]
  const failureGroups = db.prepare(`
    select
      coalesce(task.failure_category, 'UNKNOWN') as category,
      coalesce(task.failure_fingerprint, task.error_code, task.error_message, 'UNKNOWN') as fingerprint,
      max(task.error_code) as sample_error_code,
      max(task.error_message) as sample_error_message,
      count(*) as count,
      sum(case when task.retryable = 1 then 1 else 0 end) as retryable_count,
      max(task.updated_at) as last_seen_at
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where listing.platform = ?
      and listing.listing_batch_no = ?
      and task.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED')
    group by category, fingerprint
    order by count(*) desc, last_seen_at desc
  `).all(platform, batchNo) as SourceRow[]
  const retryableRow = db.prepare(`
    select count(*) as count
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where listing.platform = ?
      and listing.listing_batch_no = ?
      and task.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'PARTIALLY_APPROVED')
      and task.retryable = 1
  `).get(platform, batchNo) as SourceRow
  const totalListings = db.prepare(`
    select count(*) as count
    from listing
    where platform = ?
      and listing_batch_no = ?
  `).get(platform, batchNo) as SourceRow
  const totalTasks = db.prepare(`
    select count(*) as count
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where listing.platform = ?
      and listing.listing_batch_no = ?
  `).get(platform, batchNo) as SourceRow

  return {
    platform,
    batch_no: batchNo,
    total_listings: Number(totalListings.count ?? 0),
    total_tasks: Number(totalTasks.count ?? 0),
    retryable_failed_tasks: Number(retryableRow.count ?? 0),
    by_listing_status: Object.fromEntries(listingStatusRows.map((row) => [normalizeText(row.status), Number(row.count ?? 0)])),
    by_task_status: Object.fromEntries(taskStatusRows.map((row) => [normalizeText(row.status), Number(row.count ?? 0)])),
    failure_groups: failureGroups.map((row) => ({
      category: normalizeText(row.category) || "UNKNOWN",
      fingerprint: normalizeText(row.fingerprint) || "UNKNOWN",
      count: Number(row.count ?? 0),
      retryable_count: Number(row.retryable_count ?? 0),
      sample_error_code: normalizeText(row.sample_error_code) || null,
      sample_error_message: normalizeText(row.sample_error_message) || null,
      last_seen_at: row.last_seen_at ?? null,
    })),
  }
}

export function refreshBatchPublishSummary(db: SyncPostgresDatabase, input: BatchPublishSummaryInput) {
  const platform = platformOf(input.platform)
  const batchNo = normalizeText(input.batchNo)
  const summary = publishSummaryForBatch(db, { platform, batchNo })
  db.prepare(`
    update listing_batch
    set last_status_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      publish_status_summary_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where platform = ?
      and batch_no = ?
  `).run(JSON.stringify(summary), platform, batchNo)
  return summary
}

function failedBatchTasksForRetry(db: SyncPostgresDatabase, input: RetryFailedBatchTasksInput) {
  const platform = platformOf(input.platform)
  const retryableClause = input.retryableOnly ? "and task.retryable = 1" : ""
  const retryableLatestClause = input.retryableOnly ? "and latest.retryable = 1" : ""
  return db.prepare(`
    select task.*
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where listing.platform = ?
      and listing.listing_batch_no = ?
      and task.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'PARTIALLY_APPROVED')
      ${retryableClause}
      and task.id = (
        select latest.id
        from listing_publish_task latest
        where latest.listing_id = task.listing_id
          and latest.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'PARTIALLY_APPROVED')
          ${retryableLatestClause}
        order by latest.updated_at desc, latest.id desc
        limit 1
      )
    order by task.id
  `).all(platform, normalizeText(input.batchNo)) as PublishTaskRow[]
}

function existingRetryForTask(db: SyncPostgresDatabase, taskId: number) {
  return db.prepare(`
    select version.*
    from listing_publish_version version
    where version.version_type = 'RETRY'
      and json_extract(version.source_snapshot_json, '$.retry_from_task_id') = ?
    order by version.id desc
    limit 1
  `).get(taskId) as SourceRow | undefined
}

function nextVersionNo(db: SyncPostgresDatabase, listingId: number) {
  const row = db.prepare(`
    select coalesce(max(version_no), 0) + 1 as next_no
    from listing_publish_version
    where listing_id = ?
  `).get(listingId) as SourceRow
  return Number(row.next_no ?? 1)
}

const RETRYABLE_PUBLISH_STATUSES = new Set(["PUBLISH_FAILED", "FAILED", "REJECTED", "PARTIALLY_APPROVED"])
const RETRY_FENCED_LISTING_STATUSES = new Set(["APPROVED", "PUBLISHING", "PUBLISH_SUBMITTED", "SUBMITTED", "UNDER_REVIEW", "PUBLISH_RESULT_UNKNOWN", "PUBLISHED"])

function retryPublishTaskInTransaction(db: SyncPostgresDatabase, taskId: number, now: Date) {
  const original = taskById(db, taskId)
  if (!original) throw new HTTPException(404, { message: "发布任务不存在" })
  // Publish also locks the listing, so recheck tasks/versions after this lock.
  const locking = typeof (db as unknown as { queryResult?: unknown }).queryResult === "function" ? " for update" : ""
  const listing = db.prepare(`select * from listing where id = ?${locking}`).get(original.listing_id) as SourceRow | undefined
  const task = taskById(db, taskId)
  if (!listing || !task) throw new HTTPException(404, { message: "发布任务不存在" })
  if (!RETRYABLE_PUBLISH_STATUSES.has(task.status)) {
    throw new HTTPException(409, { message: "只有失败或驳回任务可以重试" })
  }
  if (RETRY_FENCED_LISTING_STATUSES.has(normalizeText(listing.status))) {
    throw new HTTPException(409, { message: "商品已发布、审核中或发布结果未知，不能重试历史失败任务" })
  }
  const latestTask = db.prepare(`
    select * from listing_publish_task
    where listing_id = ? and platform = ? and task_type = ?
    order by id desc limit 1
  `).get(task.listing_id, task.platform, task.task_type) as PublishTaskRow
  const latestVersion = db.prepare(`
    select * from listing_publish_version where listing_id = ?
    order by version_no desc, id desc limit 1
  `).get(task.listing_id) as SourceRow | undefined
  const retryVersion = existingRetryForTask(db, taskId)
  const isExistingPendingRetry = retryVersion
    && Number(latestVersion?.id) === Number(retryVersion.id)
    && Number(latestTask.publish_version_id) === Number(retryVersion.id)
    && latestTask.status === "PENDING_CONFIRM"
  if (isExistingPendingRetry) return { task, version: retryVersion, retry_task: latestTask, created: false }
  if (Number(latestTask.id) !== taskId || (latestVersion && Number(latestVersion.id) !== Number(task.publish_version_id))) {
    throw new HTTPException(409, { message: "已有更新的发布任务或版本，不能重试历史失败任务" })
  }
  const requestPayload = parseJsonObject(task.request_payload_json)
  if (!Object.keys(requestPayload).length) throw new HTTPException(409, { message: "原失败任务缺少 request payload" })
  const result = db.prepare(`
    insert into listing_publish_version (
      listing_id, version_no, version_type, status, change_summary, source_snapshot_json,
      request_payload_json, response_payload_json, error_code, error_message, created_by
    ) values (?, ?, 'RETRY', 'DRAFT', ?, ?, ?, ?, ?, ?, 'codex')
  `).run(
    task.listing_id, nextVersionNo(db, task.listing_id), `重试发布任务 #${task.id}`,
    json({ retry_from_task_id: task.id, retry_from_version_id: task.publish_version_id, retry_reason: task.error_message, batch_no: listing.listing_batch_no }),
    json(requestPayload), normalizeText(task.response_payload_json) || "{}",
    normalizeText(task.error_code) || null, normalizeText(task.error_message) || null,
  )
  const version = db.prepare("select * from listing_publish_version where id = ?").get(result.lastInsertRowid) as SourceRow
  const ensured = ensurePublishTask(db, {
    listingId: task.listing_id, publishVersionId: Number(version.id), platform: task.platform,
    taskType: task.task_type, status: "PENDING_CONFIRM", attemptCount: 0, requestPayload,
  })
  if (!ensured.created) throw new HTTPException(409, { message: "已有其他发布任务，请刷新后重试" })
  db.prepare(`
    update listing_publish_task set last_retry_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?
  `).run(nowIso(now), task.id)
  db.prepare(`
    update listing set status = 'READY_TO_VALIDATE', validation_status = 'NOT_VALIDATED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ?
  `).run(task.listing_id)
  if (listing.spu_code) {
    db.prepare(`
      update shein_product_bucket set latest_listing_id = ?, latest_publish_status = 'READY_TO_VALIDATE',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where spu_code = ?
    `).run(task.listing_id, listing.spu_code)
  }
  return { task, version, retry_task: ensured.task, created: true }
}

export function retryPublishTask(db: SyncPostgresDatabase, taskId: number, now = new Date()) {
  return db.transaction(() => retryPublishTaskInTransaction(db, taskId, now))()
}

export function retryFailedBatchTasks(db: SyncPostgresDatabase, input: RetryFailedBatchTasksInput) {
  const platform = platformOf(input.platform)
  const batchNo = normalizeText(input.batchNo)
  const created: Array<ReturnType<typeof retryPublishTaskInTransaction>> = []
  const existing: Array<ReturnType<typeof retryPublishTaskInTransaction>> = []
  const skipped: Array<{ task_id: number; listing_id: number; reason: string }> = []
  // Each retry is atomic. A stale candidate must not roll back other listings.
  for (const task of failedBatchTasksForRetry(db, { ...input, platform, batchNo })) {
    try {
      const result = retryPublishTask(db, Number(task.id), input.now ?? new Date())
      if (result.created) created.push(result)
      else existing.push(result)
    } catch (error) {
      if (!(error instanceof HTTPException) || ![404, 409].includes(error.status)) throw error
      skipped.push({ task_id: Number(task.id), listing_id: Number(task.listing_id), reason: error.message })
    }
  }
  const summary = refreshBatchPublishSummary(db, { platform, batchNo })
  return { ok: true, platform, batch_no: batchNo, created_count: created.length, existing_count: existing.length,
    skipped_count: skipped.length, created, existing, skipped, summary }
}
