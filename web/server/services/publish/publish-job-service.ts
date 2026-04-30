import type Database from "better-sqlite3"

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

function taskById(db: Database.Database, taskId: number) {
  return db.prepare("select * from listing_publish_task where id = ?").get(taskId) as PublishTaskRow
}

function platformOf(value: unknown) {
  return normalizeText(value || "SHEIN").toUpperCase()
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

export function ensurePublishTask(db: Database.Database, input: EnsurePublishTaskInput) {
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

  const result = db.prepare(`
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
  return { created: true, task: taskById(db, Number(result.lastInsertRowid)) }
}

function latestPublishableVersion(db: Database.Database, listingId: number) {
  return db.prepare(`
    select *
    from listing_publish_version
    where listing_id = ?
      and coalesce(request_payload_json, '') <> ''
    order by version_no desc, id desc
    limit 1
  `).get(listingId) as SourceRow | undefined
}

function unresolvedBlockerCount(db: Database.Database, listingId: number) {
  const row = db.prepare(`
    select count(*) as count
    from listing_validation_result
    where listing_id = ?
      and severity = 'ERROR'
      and resolved = 0
  `).get(listingId) as SourceRow
  return Number(row?.count ?? 0)
}

function batchListingRows(db: Database.Database, input: BatchPublishInput) {
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

export function ensureBatchPublishTasks(db: Database.Database, input: BatchPublishInput) {
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

export function updatePublishTaskRequestPayload(db: Database.Database, taskId: number, requestPayload: unknown) {
  db.prepare(`
    update listing_publish_task
    set request_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(json(requestPayload), taskId)
  return taskById(db, taskId)
}

export function markPublishTaskFailed(db: Database.Database, input: MarkPublishTaskFailedInput) {
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

export function markPublishTaskStatusSynced(db: Database.Database, input: MarkPublishTaskStatusSyncedInput) {
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

export function publishSummaryForBatch(db: Database.Database, input: BatchPublishSummaryInput) {
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

export function refreshBatchPublishSummary(db: Database.Database, input: BatchPublishSummaryInput) {
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

function failedBatchTasksForRetry(db: Database.Database, input: RetryFailedBatchTasksInput) {
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

function existingRetryForTask(db: Database.Database, taskId: number) {
  return db.prepare(`
    select version.*
    from listing_publish_version version
    where version.version_type = 'RETRY'
      and json_extract(version.source_snapshot_json, '$.retry_from_task_id') = ?
    order by version.id desc
    limit 1
  `).get(taskId) as SourceRow | undefined
}

function nextVersionNo(db: Database.Database, listingId: number) {
  const row = db.prepare(`
    select coalesce(max(version_no), 0) + 1 as next_no
    from listing_publish_version
    where listing_id = ?
  `).get(listingId) as SourceRow
  return Number(row.next_no ?? 1)
}

export function retryFailedBatchTasks(db: Database.Database, input: RetryFailedBatchTasksInput) {
  const platform = platformOf(input.platform)
  const batchNo = normalizeText(input.batchNo)
  const now = input.now ?? new Date()
  const created: Array<{ task: PublishTaskRow; version: SourceRow; retry_task: PublishTaskRow }> = []
  const existing: Array<{ task: PublishTaskRow; version: SourceRow; retry_task: PublishTaskRow | null }> = []
  const skipped: Array<{ task_id: number; listing_id: number; reason: string }> = []

  const transaction = db.transaction(() => {
    const candidates = failedBatchTasksForRetry(db, { ...input, platform, batchNo })
    const existingRetryRows = db.prepare(`
      select task.*
      from listing_publish_task task
      join listing on listing.id = task.listing_id
      join listing_publish_version version on version.id = task.publish_version_id
      where listing.platform = ?
        and listing.listing_batch_no = ?
        and version.version_type = 'RETRY'
        and task.status in ('PENDING_CONFIRM', 'PUBLISHING', 'PUBLISH_SUBMITTED', 'UNDER_REVIEW')
    `).all(platform, batchNo) as PublishTaskRow[]
    const existingRetryByListing = new Map(existingRetryRows.map((task) => [Number(task.listing_id), task]))

    for (const task of candidates) {
      const listingId = Number(task.listing_id)
      const inFlightRetryTask = existingRetryByListing.get(listingId)
      if (inFlightRetryTask) {
        const version = db.prepare("select * from listing_publish_version where id = ?").get(inFlightRetryTask.publish_version_id) as SourceRow
        existing.push({ task, version, retry_task: inFlightRetryTask })
        continue
      }

      let retryVersion = existingRetryForTask(db, Number(task.id))
      if (!retryVersion) {
        const requestPayload = parseJsonObject(task.request_payload_json)
        if (Object.keys(requestPayload).length === 0) {
          skipped.push({ task_id: Number(task.id), listing_id: listingId, reason: "原失败任务缺少 request payload" })
          continue
        }
        const result = db.prepare(`
          insert into listing_publish_version (
            listing_id,
            version_no,
            version_type,
            status,
            change_summary,
            source_snapshot_json,
            request_payload_json,
            response_payload_json,
            error_code,
            error_message,
            created_by
          )
          values (?, ?, 'RETRY', 'DRAFT', ?, ?, ?, ?, ?, ?, 'codex')
        `).run(
          listingId,
          nextVersionNo(db, listingId),
          `批量重试发布任务 #${task.id}`,
          JSON.stringify({
            retry_from_task_id: task.id,
            retry_from_version_id: task.publish_version_id,
            retry_reason: task.error_message,
            batch_no: batchNo,
          }),
          JSON.stringify(requestPayload),
          normalizeText(task.response_payload_json) || "{}",
          normalizeText(task.error_code) || null,
          normalizeText(task.error_message) || null,
        )
        retryVersion = db.prepare("select * from listing_publish_version where id = ?").get(result.lastInsertRowid) as SourceRow
      }

      const ensured = ensurePublishTask(db, {
        listingId,
        publishVersionId: Number(retryVersion.id),
        platform,
        taskType: "PUBLISH_LISTING",
        status: "PENDING_CONFIRM",
        attemptCount: 0,
        requestPayload: parseJsonObject(retryVersion.request_payload_json),
      })
      db.prepare(`
        update listing_publish_task
        set last_retry_at = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ?
      `).run(nowIso(now), task.id)
      db.prepare(`
        update listing
        set status = 'READY_TO_VALIDATE',
          validation_status = 'NOT_VALIDATED',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        where id = ?
      `).run(listingId)
      if (ensured.created) created.push({ task, version: retryVersion, retry_task: ensured.task })
      else existing.push({ task, version: retryVersion, retry_task: ensured.task })
    }
  })
  transaction()

  const summary = refreshBatchPublishSummary(db, { platform, batchNo })
  return {
    ok: true,
    platform,
    batch_no: batchNo,
    created_count: created.length,
    existing_count: existing.length,
    skipped_count: skipped.length,
    created,
    existing,
    skipped,
    summary,
  }
}
