import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { randomUUID } from "node:crypto"
import { mkdir, unlink } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import ExcelJS from "exceljs"
import { getDb } from "../db"
import {
  listPlatformProductSpuNames,
  listPlatformProducts,
  syncPlatformProducts,
  syncProductDetail,
} from "./shein-platform-products"
import { parseSpuCodes } from "../../../scripts/lib/product_archive_sync_queue.mjs"
import {
  PLATFORM_PRODUCT_WORKBOOK_COLUMNS,
  platformProductWorkbookRows,
  type PlatformProductExportRow,
} from "../../src/lib/shein-platform-product-export"
import { withBackgroundTaskSlot } from "../lib/background-task-limiter"

type JsonRecord = Record<string, unknown>
type PlatformProductJobType = "sync" | "export"
type PlatformProductJobStatus = "queued" | "running" | "completed"
type PlatformProductJobItemStatus = "queued" | "running" | "completed" | "failed"
type SpreadsheetRow = Record<string, string | number | boolean | null>

interface LifecycleActor {
  id: number | null
  username: string | null
}

interface PlatformProductJobItem {
  item_index?: number
  shard_index?: number
  spu_code: string
  status: PlatformProductJobItemStatus
  error?: string | null
  result?: unknown
  started_at?: string | null
  finished_at?: string | null
}

interface PlatformProductJob {
  id: string
  type: PlatformProductJobType
  status: PlatformProductJobStatus
  title: string
  total_count: number
  completed_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  items: PlatformProductJobItem[]
  payload: JsonRecord
  actor?: LifecycleActor | null
  fileName?: string
  filePath?: string
  downloadUrl?: string
  error?: string | null
  current_item?: PlatformProductJobItem | null
  failed_items?: PlatformProductJobItem[]
  queued_count?: number
  running_count?: number
  shard_count?: number
  shard_size?: number
}

type PlatformProductSyncScheduleScope = "full" | "spu"

interface PlatformProductSyncScheduleConfig {
  id: string
  enabled: boolean
  schedule_hour: number
  sync_scope: PlatformProductSyncScheduleScope
  spu_names: string[]
  last_enqueued_date: string | null
  last_enqueued_job_id: string | null
  updated_at: string | null
  active_job?: ReturnType<typeof snapshot> | null
}

const EXPORT_PAGE_SIZE = 200
const MAX_DETAIL_CODES_PER_JOB = 20_000
const DETAIL_SYNC_SHARD_SIZE = 2_000
const JOB_ITEM_FAILURE_SAMPLE_LIMIT = 20
const SHEET_ROW_LIMIT = 1_000_000
const EXPORT_DIR = path.join(os.tmpdir(), "listingify-platform-product-exports")
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT = 800
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS = 1800 * 1000
const DEFAULT_DETAIL_SYNC_INTERVAL_MS = Math.ceil(SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS / SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT) + 250
const MAX_DETAIL_SYNC_INTERVAL_MS = 60_000
const DETAIL_SYNC_YIELD_ITEM_COUNT = 10
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000
const MAX_RATE_LIMIT_COOLDOWN_MS = 30 * 60_000
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const JOB_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
const RUNNING_JOB_STALE_MS = 15 * 60 * 1000
const DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID = "default"
const DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR = 23
const PLATFORM_PRODUCT_SYNC_SCHEDULE_TIME_ZONE = "Asia/Shanghai"
const PLATFORM_PRODUCT_SYNC_SCHEDULE_POLL_MS = 60 * 1000
const SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE = "scheduled_platform_product_sync"
const LEGACY_SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR = "system:scheduled-shein-platform-product-sync"
const SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR_ID = 1
const SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR_USERNAME = "admin"
export const PLATFORM_PRODUCT_JOB_WORKER_TYPES = ["sync", "export"] as const

const runningByType: Record<PlatformProductJobType, boolean> = { sync: false, export: false }
let nightlyFullSyncSchedulerStarted = false
const shanghaiScheduleFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLATFORM_PRODUCT_SYNC_SCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
})

function nowIso() {
  return new Date().toISOString()
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
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
  return recordValue(parseJson(value, {}))
}

function parseJsonArray(value: unknown): unknown[] {
  const parsed = parseJson(value, [])
  return Array.isArray(parsed) ? parsed : []
}

function hasSpecificDetailSyncCodes(payload: JsonRecord) {
  return detailSyncCodes(payload).length > 0
}

export function platformProductJobQueuePriority(jobLike: unknown) {
  const record = recordValue(jobLike)
  const type = jobType(record.job_type ?? record.type)
  const payload = record.payload
    ? parseJsonObject(record.payload)
    : parseJsonObject(record.payload_json)
  if (type === "export") return 0
  if (stringValue(payload.source) === SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE) return 30
  if (hasSpecificDetailSyncCodes(payload)) return 10
  return 20
}

export function shouldYieldPlatformProductDetailSyncSlice(input: unknown = {}) {
  const record = recordValue(input)
  return numberValue(record.processedInSlice) >= DETAIL_SYNC_YIELD_ITEM_COUNT
    && numberValue(record.queuedCount) > 0
}

function jsonText(value: unknown, fallback: unknown = {}) {
  return JSON.stringify(value ?? fallback)
}

function jsonArrayText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

function boundedDelayMs(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, Math.floor(number)))
}

function boundedHour(value: unknown, fallback: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(23, Math.floor(number)))
}

function booleanEnv(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const text = stringValue(value).toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(text)) return true
  if (["0", "false", "no", "n", "off"].includes(text)) return false
  return fallback
}

function shanghaiScheduleParts(date = new Date()) {
  const parts = Object.fromEntries(
    shanghaiScheduleFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return {
    year: parts.year || "1970",
    month: parts.month || "01",
    day: parts.day || "01",
    hour: parts.hour || "00",
  }
}

function localNightlySyncDateKey(date = new Date()) {
  const { year, month, day } = shanghaiScheduleParts(date)
  return `${year}-${month}-${day}`
}

export function platformProductSyncScheduleHour(date = new Date()) {
  return boundedHour(shanghaiScheduleParts(date).hour, DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR)
}

export function platformProductDetailSyncIntervalMs(payload: unknown = {}) {
  const object = recordValue(payload)
  return boundedDelayMs(
    object.detailIntervalMs ?? object.detail_interval_ms ?? object.syncIntervalMs ?? object.sync_interval_ms,
    DEFAULT_DETAIL_SYNC_INTERVAL_MS,
    DEFAULT_DETAIL_SYNC_INTERVAL_MS,
    MAX_DETAIL_SYNC_INTERVAL_MS,
  )
}

function platformProductRateLimitCooldownMs(payload: unknown = {}) {
  const object = recordValue(payload)
  return boundedDelayMs(
    object.rateLimitCooldownMs ?? object.rate_limit_cooldown_ms,
    DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    DEFAULT_RATE_LIMIT_COOLDOWN_MS,
    MAX_RATE_LIMIT_COOLDOWN_MS,
  )
}

export function isSheinRateLimitMessage(value: unknown) {
  const message = value instanceof Error ? value.message : stringValue(value)
  return /QPS限流|限流ID|总阈值|rate limit|too many requests/i.test(message)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isJobClaimLostError(error: unknown) {
  return error instanceof Error && error.message.includes("平台商品任务 claim 已失效")
}

function jobStatus(value: unknown): PlatformProductJobStatus {
  const status = stringValue(value)
  return status === "running" || status === "completed" ? status : "queued"
}

function itemStatus(value: unknown): PlatformProductJobItemStatus {
  const status = stringValue(value)
  if (status === "running" || status === "completed" || status === "failed") return status
  return "queued"
}

function jobType(value: unknown): PlatformProductJobType {
  return stringValue(value) === "sync" ? "sync" : "export"
}

function parseActor(value: unknown): LifecycleActor | null {
  const actor = parseJsonObject(value)
  const username = stringValue(actor.username)
  if (username === LEGACY_SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR) return scheduledPlatformProductSyncActor()
  const id = actor.id == null || actor.id === "" ? Number.NaN : numberValue(actor.id, Number.NaN)
  if (!Number.isFinite(id) && !username) return null
  return {
    id: Number.isFinite(id) && id > 0 ? id : null,
    username: username || null,
  }
}

export function scheduledPlatformProductSyncActor(): LifecycleActor {
  return {
    id: SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR_ID,
    username: SCHEDULED_PLATFORM_PRODUCT_SYNC_ACTOR_USERNAME,
  }
}

function parseJobItems(value: unknown): PlatformProductJobItem[] {
  return parseJsonArray(value).map((item) => {
    const record = recordValue(item)
    return {
      item_index: numberValue(record.item_index ?? record.itemIndex, Number.NaN),
      shard_index: numberValue(record.shard_index ?? record.shardIndex, Number.NaN),
      spu_code: stringValue(record.spu_code ?? record.spuName) || "ITEM",
      status: itemStatus(record.status),
      error: stringValue(record.error) || null,
      result: record.result ?? null,
      started_at: stringValue(record.started_at) || null,
      finished_at: stringValue(record.finished_at) || null,
    }
  })
}

function jobFromRow(row: JsonRecord): PlatformProductJob {
  return {
    id: stringValue(row.id),
    type: jobType(row.job_type),
    status: jobStatus(row.status),
    title: stringValue(row.title),
    total_count: numberValue(row.total_count),
    completed_count: numberValue(row.completed_count),
    failed_count: numberValue(row.failed_count),
    created_at: stringValue(row.created_at) || nowIso(),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    items: parseJobItems(row.items_json),
    payload: parseJsonObject(row.payload_json),
    actor: parseActor(row.actor_json),
    fileName: stringValue(row.file_name) || undefined,
    filePath: stringValue(row.file_path) || undefined,
    downloadUrl: stringValue(row.download_url) || undefined,
    error: stringValue(row.error_message) || null,
  }
}

function jobItemFromRow(row: JsonRecord): PlatformProductJobItem {
  return {
    item_index: numberValue(row.item_index, 0),
    shard_index: numberValue(row.shard_index, 0),
    spu_code: stringValue(row.spu_code) || "ITEM",
    status: itemStatus(row.status),
    error: stringValue(row.error_message) || null,
    result: parseJson(row.result_json, null),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
  }
}

function loadPlatformProductJobSummary(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  if (job.type !== "sync") return null
  const counts = db.prepare(`
    select
      count(*) as item_count,
      sum(case when status = 'queued' then 1 else 0 end) as queued_count,
      sum(case when status = 'running' then 1 else 0 end) as running_count,
      sum(case when status = 'completed' then 1 else 0 end) as completed_count,
      sum(case when status = 'failed' then 1 else 0 end) as failed_count,
      max(shard_index) + 1 as shard_count
    from shein_platform_product_job_item
    where job_id = ?
  `).get(job.id) as JsonRecord | undefined
  const itemCount = numberValue(counts?.item_count)
  if (!itemCount) return null
  const runningRow = db.prepare(`
    select *
    from shein_platform_product_job_item
    where job_id = ?
      and status = 'running'
    order by item_index asc
    limit 1
  `).get(job.id) as JsonRecord | undefined
  const failedRows = db.prepare(`
    select *
    from shein_platform_product_job_item
    where job_id = ?
      and status = 'failed'
    order by item_index asc
    limit ?
  `).all(job.id, JOB_ITEM_FAILURE_SAMPLE_LIMIT) as JsonRecord[]

  return {
    total_count: itemCount,
    queued_count: numberValue(counts?.queued_count),
    running_count: numberValue(counts?.running_count),
    completed_count: numberValue(counts?.completed_count),
    failed_count: numberValue(counts?.failed_count),
    shard_count: numberValue(counts?.shard_count, Math.ceil(itemCount / DETAIL_SYNC_SHARD_SIZE)),
    shard_size: DETAIL_SYNC_SHARD_SIZE,
    current_item: runningRow ? jobItemFromRow(runningRow) : null,
    failed_items: failedRows.map(jobItemFromRow),
  }
}

function snapshot(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const summary = loadPlatformProductJobSummary(job, db)
  const publicJob: Partial<PlatformProductJob> = summary
    ? { ...job, ...summary, items: [] }
    : { ...job }
  delete publicJob.filePath
  delete publicJob.payload
  delete publicJob.actor
  return {
    ...publicJob,
    items: summary ? [] : job.items.map((item) => ({ ...item })),
  }
}

function jobFinishedMs(job: PlatformProductJob) {
  if (!job.finished_at) return null
  const value = Date.parse(job.finished_at)
  return Number.isFinite(value) ? value : null
}

function removeJobFile(job: PlatformProductJob) {
  if (!job.filePath) return
  void unlink(job.filePath).catch(() => {})
}

export function createPlatformProductJob(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const now = nowIso()
  const row = db.prepare(`
    insert into shein_platform_product_job (
      id,
      job_type,
      status,
      title,
      total_count,
      completed_count,
      failed_count,
      payload_json,
      actor_json,
      items_json,
      file_name,
      file_path,
      download_url,
      error_message,
      started_at,
      finished_at,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    returning *
  `).get(
    job.id,
    job.type,
    job.status,
    job.title,
    job.total_count,
    job.completed_count,
    job.failed_count,
    jsonText(job.payload),
    jsonText(job.actor ?? {}),
    jsonArrayText(job.items),
    job.fileName ?? null,
    job.filePath ?? null,
    job.downloadUrl ?? null,
    job.error ?? null,
    job.started_at,
    job.finished_at,
    job.created_at || now,
    now,
  ) as JsonRecord | undefined
  return row ? jobFromRow(row) : job
}

export function updatePlatformProductJob(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    update shein_platform_product_job
    set job_type = ?,
      status = ?,
      title = ?,
      total_count = ?,
      completed_count = ?,
      failed_count = ?,
      payload_json = ?,
      actor_json = ?,
      items_json = ?,
      file_name = ?,
      file_path = ?,
      download_url = ?,
      error_message = ?,
      started_at = ?,
      finished_at = ?,
      updated_at = ?
    where id = ?
      and started_at is not distinct from ?
    returning *
  `).get(
    job.type,
    job.status,
    job.title,
    job.total_count,
    job.completed_count,
    job.failed_count,
    jsonText(job.payload),
    jsonText(job.actor ?? {}),
    jsonArrayText(job.items),
    job.fileName ?? null,
    job.filePath ?? null,
    job.downloadUrl ?? null,
    job.error ?? null,
    job.started_at,
    job.finished_at,
    nowIso(),
    job.id,
    job.started_at,
  ) as JsonRecord | undefined
  return row ? jobFromRow(row) : null
}

export async function savePlatformProductJob(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const saved = updatePlatformProductJob(job, db)
  if (!saved) throw new Error("平台商品任务 claim 已失效，拒绝旧 worker 写入")
  return saved
}

function platformProductJobItemCount(jobId: string, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select count(*) as count
    from shein_platform_product_job_item
    where job_id = ?
  `).get(jobId) as JsonRecord | undefined
  return numberValue(row?.count)
}

function queuedPlatformProductJobItemCount(jobId: string, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select count(*) as count
    from shein_platform_product_job_item
    where job_id = ?
      and status = 'queued'
  `).get(jobId) as JsonRecord | undefined
  return numberValue(row?.count)
}

function nonCompletedPlatformProductJobItemCodes(jobId: string, db: SyncPostgresDatabase = getDb()) {
  return db.prepare(`
    select spu_code
    from shein_platform_product_job_item
    where job_id = ?
      and status <> 'completed'
    order by item_index asc
  `).all(jobId)
    .map((row) => stringValue((row as JsonRecord).spu_code))
    .filter(Boolean)
}

export function createPlatformProductJobItems(
  jobId: string,
  codes: string[],
  db: SyncPostgresDatabase = getDb(),
) {
  const now = nowIso()
  const statement = db.prepare(`
    insert into shein_platform_product_job_item (
      job_id,
      item_index,
      shard_index,
      spu_code,
      status,
      error_message,
      result_json,
      started_at,
      finished_at,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, 'queued', null, '{}', null, null, ?, ?)
    on conflict(job_id, item_index) do nothing
  `)
  for (const [index, code] of codes.entries()) {
    statement.run(
      jobId,
      index,
      Math.floor(index / DETAIL_SYNC_SHARD_SIZE),
      code,
      now,
      now,
    )
  }
  return platformProductJobItemCount(jobId, db)
}

function ensurePlatformProductJobItems(job: PlatformProductJob, codes: string[], db: SyncPostgresDatabase = getDb()) {
  const existingCount = platformProductJobItemCount(job.id, db)
  if (existingCount > 0 || codes.length === 0) return existingCount
  return createPlatformProductJobItems(job.id, codes, db)
}

function resetRunningPlatformProductJobItems(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  db.prepare(`
    update shein_platform_product_job_item
    set status = 'queued',
      started_at = null,
      updated_at = ?
    where job_id = ?
      and exists (
        select 1 from shein_platform_product_job job
        where job.id = shein_platform_product_job_item.job_id
          and job.started_at is not distinct from ?
          and job.status = 'running'
      )
      and status = 'running'
      and finished_at is null
  `).run(nowIso(), job.id, job.started_at)
}

function nextPlatformProductJobItem(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select *
    from shein_platform_product_job_item
    where job_id = ?
      and status = 'queued'
      and exists (
        select 1 from shein_platform_product_job parent_job
        where parent_job.id = shein_platform_product_job_item.job_id
          and parent_job.started_at is not distinct from ?
          and parent_job.status = 'running'
      )
    order by item_index asc
    limit 1
  `).get(job.id, job.started_at) as JsonRecord | undefined
  return row ? jobItemFromRow(row) : null
}

function markPlatformProductJobItemRunning(
  job: PlatformProductJob,
  item: PlatformProductJobItem,
  db: SyncPostgresDatabase = getDb(),
) {
  const now = nowIso()
  const write = db.prepare(`
    update shein_platform_product_job_item
    set status = 'running',
      error_message = null,
      started_at = ?,
      finished_at = null,
      updated_at = ?
    where job_id = ?
      and item_index = ?
      and status = 'queued'
      and exists (
        select 1 from shein_platform_product_job parent_job
        where parent_job.id = shein_platform_product_job_item.job_id
          and parent_job.started_at is not distinct from ?
          and parent_job.status = 'running'
      )
  `).run(now, now, job.id, item.item_index ?? 0, job.started_at)
  if (numberValue(write?.changes) !== 1) return null
  return { ...item, status: "running" as const, error: null, started_at: now, finished_at: null }
}

function markPlatformProductJobItemFinished(
  job: PlatformProductJob,
  item: PlatformProductJobItem,
  status: "completed" | "failed",
  result: unknown,
  error: string | null,
  db: SyncPostgresDatabase = getDb(),
) {
  const now = nowIso()
  const write = db.prepare(`
    update shein_platform_product_job_item
    set status = ?,
      error_message = ?,
      result_json = ?,
      finished_at = ?,
      updated_at = ?
    where job_id = ?
      and item_index = ?
      and status = 'running'
      and exists (
        select 1 from shein_platform_product_job parent_job
        where parent_job.id = shein_platform_product_job_item.job_id
          and parent_job.started_at is not distinct from ?
          and parent_job.status = 'running'
      )
  `).run(status, error, jsonText(result), now, now, job.id, item.item_index ?? 0, job.started_at)
  if (numberValue(write?.changes) !== 1) return null
  return { ...item, status, result, error, finished_at: now }
}

type PlatformProductDetailSync = typeof syncProductDetail
type PlatformProductJobItemClaimHook = (runningItem: PlatformProductJobItem) => void | Promise<void>

/**
 * Claims one detail-sync item, performs the remote call only while that claim
 * is current, and fences the completion write against a stale worker.
 *
 * The claim hook lets the queue worker persist its running snapshot before the
 * remote request starts. A failed hook is treated as a lost claim as well, so
 * an old worker cannot continue into an external call after its parent job was
 * reclaimed.
 */
export async function processPlatformProductJobItem(
  job: PlatformProductJob,
  item: PlatformProductJobItem,
  db: SyncPostgresDatabase = getDb(),
  detailSync: PlatformProductDetailSync = syncProductDetail,
  onClaimed?: PlatformProductJobItemClaimHook,
) {
  const runningItem = markPlatformProductJobItemRunning(job, item, db)
  if (!runningItem) return { claimLost: true, item }

  if (onClaimed) {
    try {
      await onClaimed(runningItem)
    } catch (error) {
      return { claimLost: true, item: runningItem, error: errorMessage(error) }
    }
  }

  try {
    const remote = await withBackgroundTaskSlot(
      "shein_platform_product_sync",
      () => detailSync(item.spu_code, {}, job.actor),
    )
    if (!responseOk(remote.result)) {
      throw new Error(responseMessage(remote.result) || "详情同步失败")
    }
    const finishedItem = markPlatformProductJobItemFinished(job, item, "completed", remote.persistence, null, db)
    if (!finishedItem) return { claimLost: true, item: runningItem, remote }
    return { claimLost: false, item: finishedItem, remote }
  } catch (error) {
    const message = errorMessage(error)
    const failedItem = markPlatformProductJobItemFinished(job, item, "failed", null, message, db)
    if (!failedItem) return { claimLost: true, item: runningItem, error: message }
    return { claimLost: false, item: failedItem, error: message }
  }
}

function refreshPlatformProductJobCounts(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  const summary = loadPlatformProductJobSummary(job, db)
  if (!summary) return job
  job.total_count = summary.total_count
  job.completed_count = summary.completed_count
  job.failed_count = summary.failed_count
  job.queued_count = summary.queued_count
  job.running_count = summary.running_count
  job.shard_count = summary.shard_count
  job.shard_size = summary.shard_size
  job.current_item = summary.current_item
  job.failed_items = summary.failed_items
  return job
}

async function yieldPlatformProductDetailSyncJob(
  job: PlatformProductJob,
  processedInSlice: number,
  db: SyncPostgresDatabase = getDb(),
) {
  refreshPlatformProductJobCounts(job, db)
  const queuedCount = job.queued_count ?? queuedPlatformProductJobItemCount(job.id, db)
  if (!shouldYieldPlatformProductDetailSyncSlice({ processedInSlice, queuedCount })) return false
  job.status = "queued"
  job.current_item = null
  job.running_count = 0
  await savePlatformProductJob(job, db)
  return true
}

export function loadPlatformProductJob(type: PlatformProductJobType, id: string, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select *
    from shein_platform_product_job
    where id = ?
      and job_type = ?
  `).get(id, type) as JsonRecord | undefined
  return row ? jobFromRow(row) : null
}

function platformProductJobPrioritySql(alias: string) {
  return `
    case
      when ${alias}.job_type = 'export' then 0
      when ${alias}.job_type = 'sync'
        and ${alias}.payload_json like '%"source":"${SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE}"%' then 30
      when ${alias}.job_type = 'sync'
        and (
          ${alias}.payload_json like '%"spuNames"%'
          or ${alias}.payload_json like '%"spu_names"%'
          or ${alias}.payload_json like '%"codes"%'
          or ${alias}.payload_json like '%"rawCodes"%'
          or ${alias}.payload_json like '%"raw_codes"%'
        ) then 10
      else 20
    end
  `
}

function claimNextPlatformProductJob(type: PlatformProductJobType, db: SyncPostgresDatabase = getDb()) {
  const now = nowIso()
  const staleBefore = new Date(Date.now() - RUNNING_JOB_STALE_MS).toISOString()
  const row = db.prepare(`
    with next_job as (
      select candidate.id
      from shein_platform_product_job candidate
      where candidate.job_type = ?
        and (
          candidate.status = 'queued'
        or (
            candidate.status = 'running'
            and candidate.finished_at is null
            and candidate.updated_at < ?
          )
        )
      order by ${platformProductJobPrioritySql("candidate")},
        candidate.created_at asc
      limit 1
      for update skip locked
    )
    update shein_platform_product_job as job
    set status = 'running',
      started_at = ?,
      updated_at = ?
    from next_job
    where job.id = next_job.id
    returning job.*
  `).get(type, staleBefore, now, now) as JsonRecord | undefined
  return row ? jobFromRow(row) : null
}

export function pruneExpiredPlatformProductJobs(now = Date.now(), db: SyncPostgresDatabase = getDb()) {
  let removed = 0
  const rows = db.prepare(`
    select *
    from shein_platform_product_job
    where status = 'completed'
      and finished_at is not null
  `).all() as JsonRecord[]
  for (const row of rows) {
    const job = jobFromRow(row)
    const finishedMs = jobFinishedMs(job)
    if (finishedMs == null || now - finishedMs < JOB_RETENTION_MS) continue
    removeJobFile(job)
    db.prepare("delete from shein_platform_product_job where id = ?").run(job.id)
    removed += 1
  }
  return removed
}

function responsePayload(result: unknown) {
  const payload = recordValue(recordValue(result).payload)
  return payload
}

function responseOk(result: unknown) {
  const record = recordValue(result)
  const status = Number(record.status ?? 0)
  const code = stringValue(responsePayload(result).code)
  return status >= 200 && status < 300 && (!code || code === "0")
}

function responseMessage(result: unknown) {
  const payload = responsePayload(result)
  return stringValue(payload.msg ?? payload.message ?? payload.error_message)
}

function fileSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function exportInput(payload: unknown) {
  const object = recordValue(payload)
  return {
    search: stringValue(object.search),
    brand: stringValue(object.brand),
    category: stringValue(object.category),
    site: stringValue(object.site),
    includeDetails: true,
  }
}

function syncInput(payload: unknown) {
  return recordValue(payload)
}

function detailSyncCodes(payload: JsonRecord) {
  return parseSpuCodes(
    payload.spuNames ?? payload.spu_names ?? payload.codes ?? payload.rawCodes ?? payload.raw_codes ?? "",
    { maxCodes: MAX_DETAIL_CODES_PER_JOB },
  )
}

function setJobDone(job: PlatformProductJob) {
  job.status = "completed"
  job.finished_at = nowIso()
}

async function markJobFailed(job: PlatformProductJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  job.error = message
  if (job.type === "export") {
    job.total_count = 1
    job.completed_count = 0
    job.failed_count = 1
  }
  if (!job.items.length) {
    job.items.push({ spu_code: job.type === "export" ? "EXPORT" : "SYNC", status: "failed", error: message })
  } else {
    for (const item of job.items.filter((item) => item.status !== "completed")) {
      item.status = "failed"
      item.error = item.error ?? message
      item.finished_at = nowIso()
    }
  }
  if (job.type !== "export") {
    job.completed_count = job.items.filter((item) => item.status === "completed").length
    job.failed_count = Math.max(1, job.items.filter((item) => item.status === "failed").length)
  }
  setJobDone(job)
  await savePlatformProductJob(job)
}

function requeueFailedPlatformProductJobItems(jobId: string, db: SyncPostgresDatabase = getDb()) {
  const now = nowIso()
  const result = db.prepare(`
    update shein_platform_product_job_item
    set status = 'queued',
      error_message = null,
      result_json = '{}',
      started_at = null,
      finished_at = null,
      updated_at = ?
    where job_id = ?
      and status = 'failed'
  `).run(now, jobId)
  return numberValue(result.changes)
}

function failedItemRetryPasses(job: PlatformProductJob) {
  return numberValue(job.payload.failedItemRetryPasses, 0)
}

function shouldRetryFailedPlatformProductJobItems(job: PlatformProductJob) {
  return booleanEnv(job.payload.retryFailedItems, false)
    && failedItemRetryPasses(job) < 1
    && job.failed_count > 0
}

async function processSyncJob(job: PlatformProductJob) {
  const codes = detailSyncCodes(job.payload)
  const db = getDb()
  const existingItemCount = codes.length ? 0 : platformProductJobItemCount(job.id, db)
  if (codes.length || existingItemCount > 0) {
    const detailIntervalMs = platformProductDetailSyncIntervalMs(job.payload)
    ensurePlatformProductJobItems(job, codes, db)
    resetRunningPlatformProductJobItems(job, db)
    refreshPlatformProductJobCounts(job, db)
    job.items = []
    await savePlatformProductJob(job)

    let processedInThisRun = 0
    while (true) {
      const item = nextPlatformProductJobItem(job, db)
      if (!item) {
        refreshPlatformProductJobCounts(job, db)
        if (shouldRetryFailedPlatformProductJobItems(job)) {
          job.payload = {
            ...job.payload,
            failedItemRetryPasses: failedItemRetryPasses(job) + 1,
          }
          requeueFailedPlatformProductJobItems(job.id, db)
          job.failed_items = []
          refreshPlatformProductJobCounts(job, db)
          await savePlatformProductJob(job)
          continue
        }
        break
      }
      if (processedInThisRun > 0 && detailIntervalMs > 0) {
        await wait(detailIntervalMs)
      }
      const outcome = await processPlatformProductJobItem(
        job,
        item,
        db,
        syncProductDetail,
        async (runningItem) => {
          job.current_item = runningItem
          job.running_count = 1
          job.queued_count = Math.max(0, (job.queued_count ?? 0) - 1)
          await savePlatformProductJob(job)
        },
      )
      if (outcome.claimLost) return
      if (outcome.error) {
        job.failed_count += 1
        if (outcome.item && (job.failed_items?.length ?? 0) < JOB_ITEM_FAILURE_SAMPLE_LIMIT) {
          job.failed_items = [...(job.failed_items ?? []), outcome.item]
        }
        const rateLimitCooldownMs = isSheinRateLimitMessage(outcome.error)
          ? platformProductRateLimitCooldownMs(job.payload)
          : 0
        if (rateLimitCooldownMs > 0) {
          await wait(rateLimitCooldownMs)
        }
      } else {
        job.completed_count += 1
      }
      job.current_item = null
      job.running_count = 0
      processedInThisRun += 1
      await savePlatformProductJob(job)
      if (await yieldPlatformProductDetailSyncJob(job, processedInThisRun, db)) return
    }
    refreshPlatformProductJobCounts(job, db)
    setJobDone(job)
    await savePlatformProductJob(job)
    return
  }

  job.total_count = 1
  job.items = [{ spu_code: "平台商品列表", status: "running", error: null, result: null, started_at: nowIso(), finished_at: null }]
  await savePlatformProductJob(job)
  try {
    const result = await withBackgroundTaskSlot(
      "shein_platform_product_sync",
      () => syncPlatformProducts(syncInput(job.payload), job.actor),
    )
    if (!responseOk(result.result)) {
      throw new Error(responseMessage(result.result) || "同步平台商品失败")
    }
    job.items[0].status = "completed"
    job.items[0].result = result.persistence
    job.completed_count = 1
  } catch (error) {
    job.items[0].status = "failed"
    job.items[0].error = error instanceof Error ? error.message : String(error)
    job.failed_count = 1
  } finally {
    job.items[0].finished_at = nowIso()
    setJobDone(job)
    await savePlatformProductJob(job)
  }
}

function sheetNameWithIndex(baseName: string, index: number) {
  const suffix = index > 0 ? `-${index + 1}` : ""
  const maxBaseLength = 31 - suffix.length
  const safeBase = baseName.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet"
  return `${safeBase.slice(0, Math.max(1, maxBaseLength))}${suffix}`
}

type WorksheetWriter = {
  addRow(values: unknown[]): { commit: () => void }
  commit: () => void
}

type WorkbookWriter = {
  addWorksheet(name: string): WorksheetWriter
  commit(): Promise<void>
}

function createStreamingSheetAppender(
  workbook: WorkbookWriter,
  name: string,
  columns: readonly string[],
) {
  let worksheet: WorksheetWriter | null = null
  let sheetIndex = 0
  let currentRowCount = 0
  let totalRowCount = 0

  function openWorksheet() {
    worksheet = workbook.addWorksheet(sheetNameWithIndex(name, sheetIndex))
    worksheet.addRow([...columns]).commit()
    currentRowCount = 0
  }

  function append(rows: SpreadsheetRow[]) {
    for (const row of rows) {
      if (!worksheet) openWorksheet()
      if (currentRowCount >= SHEET_ROW_LIMIT) {
        worksheet?.commit()
        sheetIndex += 1
        openWorksheet()
      }
      worksheet?.addRow(columns.map((column) => row[column] ?? "")).commit()
      currentRowCount += 1
      totalRowCount += 1
    }
  }

  function ensurePlaceholder() {
    if (totalRowCount === 0) append([Object.fromEntries(columns.map((column) => [column, ""]))])
  }

  function commit() {
    worksheet?.commit()
  }

  return { append, commit, ensurePlaceholder, get totalRowCount() { return totalRowCount } }
}

async function writePlatformProductWorkbookFromPages(filePath: string, job: PlatformProductJob) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: false,
    useSharedStrings: false,
  }) as WorkbookWriter
  const overview = createStreamingSheetAppender(workbook, "平台商品列表", PLATFORM_PRODUCT_WORKBOOK_COLUMNS.overview)
  const skcSku = createStreamingSheetAppender(workbook, "SKC-SKU明细", PLATFORM_PRODUCT_WORKBOOK_COLUMNS.skcSku)
  const saleSite = createStreamingSheetAppender(workbook, "销售站点明细", PLATFORM_PRODUCT_WORKBOOK_COLUMNS.saleSite)
  const input = exportInput(job.payload)
  let offset = 0
  let writtenProducts = 0
  try {
    while (true) {
      const response = listPlatformProducts({
        ...input,
        limit: EXPORT_PAGE_SIZE,
        offset,
      })
      const total = Number(response.pagination.total ?? 0)
      const pageRows = response.items as PlatformProductExportRow[]
      if (offset === 0) job.total_count = total
      for (const row of pageRows) {
        const transformed = platformProductWorkbookRows(row)
        overview.append([transformed.overview])
        skcSku.append(transformed.skcSku)
        saleSite.append(transformed.saleSite)
      }
      writtenProducts += pageRows.length
      job.completed_count = writtenProducts
      job.items[0].result = {
        stage: "streaming_workbook",
        writtenProducts,
        totalProducts: total,
        detailRows: skcSku.totalRowCount,
        saleSiteRows: saleSite.totalRowCount,
      }
      await savePlatformProductJob(job)
      await wait(0)
      if (total <= 0 || writtenProducts >= total || pageRows.length === 0) break
      offset += pageRows.length
    }
    if (writtenProducts === 0) throw new Error("当前筛选条件下没有可导出的平台商品")
    skcSku.ensurePlaceholder()
    saleSite.ensurePlaceholder()
    overview.commit()
    skcSku.commit()
    saleSite.commit()
    await workbook.commit()
    return writtenProducts
  } catch (error) {
    await workbook.commit().catch(() => undefined)
    await unlink(filePath).catch(() => undefined)
    throw error
  }
}

async function processExportJob(job: PlatformProductJob) {
  job.completed_count = 0
  job.failed_count = 0
  job.fileName = undefined
  job.filePath = undefined
  job.downloadUrl = undefined
  job.error = null
  job.items = [{ spu_code: "读取平台商品数据", status: "running", error: null, result: null, started_at: nowIso(), finished_at: null }]
  await savePlatformProductJob(job)
  const fileName = `SHEIN平台商品列表-${fileSafeTimestamp()}.xlsx`
  const filePath = path.join(EXPORT_DIR, `${job.id}.xlsx`)
  await mkdir(EXPORT_DIR, { recursive: true })
  job.items[0].spu_code = "生成 Excel 文件"
  job.items[0].result = { stage: "streaming_workbook", rowCount: 0, fileName }
  await savePlatformProductJob(job)
  const rowCount = await withBackgroundTaskSlot(
    "shein_platform_product_export",
    () => writePlatformProductWorkbookFromPages(filePath, job),
  )
  job.fileName = fileName
  job.filePath = filePath
  job.downloadUrl = `/api/shein-platform-products/export-jobs/${job.id}/download`
  job.items[0].spu_code = "EXPORT"
  job.items[0].status = "completed"
  job.items[0].result = { rowCount, fileName }
  job.items[0].finished_at = nowIso()
  job.completed_count = rowCount
  setJobDone(job)
  await savePlatformProductJob(job)
}

async function processLoop(type: PlatformProductJobType) {
  if (runningByType[type]) return
  runningByType[type] = true
  try {
    while (true) {
      const job = claimNextPlatformProductJob(type)
      if (!job) break
      try {
        if (job.type === "sync") {
          await processSyncJob(job)
        } else {
          await processExportJob(job)
        }
      } catch (error) {
        if (isJobClaimLostError(error)) continue
        try {
          await markJobFailed(job, error)
        } catch (failureError) {
          if (!isJobClaimLostError(failureError)) throw failureError
        }
      }
      await wait(0)
    }
  } finally {
    runningByType[type] = false
  }
}

function schedulePlatformProductJobs() {
  const runSync = () => {
    void processLoop("sync")
  }
  const runExport = () => {
    void processLoop("export")
  }
  if (typeof setImmediate === "function") {
    setImmediate(runSync)
    setImmediate(runExport)
    return
  }
  setTimeout(runSync, 0)
  setTimeout(runExport, 0)
}

export function enqueuePlatformProductSyncJob(payload: unknown = {}, actor?: LifecycleActor | null) {
  const object = syncInput(payload)
  const codes = detailSyncCodes(object)
  const db = getDb()
  const job = createPlatformProductJob({
    id: randomUUID(),
    type: "sync",
    status: "queued",
    title: codes.length ? "按款号同步 SHEIN 平台商品详情" : "同步 SHEIN 平台商品列表",
    total_count: codes.length || 1,
    completed_count: 0,
    failed_count: 0,
    created_at: nowIso(),
    started_at: null,
    finished_at: null,
    items: [],
    payload: object,
    actor: actor ?? null,
    error: null,
  }, db)
  if (codes.length) createPlatformProductJobItems(job.id, codes, db)
  schedulePlatformProductJobs()
  return snapshot(job, db)
}

export function requeuePlatformProductAsyncTask(input: {
  type: PlatformProductJobType
  jobId: string
  actor?: LifecycleActor | null
}) {
  const original = loadPlatformProductJob(input.type, input.jobId)
  if (!original) return null
  if (input.type === "export") {
    if (original.status === "completed" && original.failed_count <= 0) {
      throw new Error("这个平台商品导出任务已成功完成，没有需要重新加入队列的内容")
    }
    return enqueuePlatformProductExportJob(original.payload)
  }

  const db = getDb()
  const persistedItemCount = platformProductJobItemCount(original.id, db)
  if (persistedItemCount > 0) {
    const codes = nonCompletedPlatformProductJobItemCodes(original.id, db)
    if (codes.length === 0) {
      throw new Error("这个平台商品同步任务已成功完成，没有需要重新加入队列的 SPU")
    }
    return enqueuePlatformProductSyncJob({
      ...original.payload,
      spuNames: codes,
      retryOfJobId: original.id,
    }, input.actor ?? original.actor ?? null)
  }

  const itemCodes = original.items
    .filter((item) => item.status !== "completed")
    .map((item) => item.spu_code)
    .filter((code) => code && code !== "平台商品列表" && code !== "SYNC")
  const payloadCodes = detailSyncCodes(original.payload)
  const codes = itemCodes.length ? itemCodes : payloadCodes
  if (codes.length > 0) {
    return enqueuePlatformProductSyncJob({
      ...original.payload,
      spuNames: codes,
      retryOfJobId: original.id,
    }, input.actor ?? original.actor ?? null)
  }
  if (original.status === "completed" && original.failed_count <= 0) {
    throw new Error("这个平台商品同步任务已成功完成，没有需要重新加入队列的内容")
  }
  return enqueuePlatformProductSyncJob({
    ...original.payload,
    retryOfJobId: original.id,
  }, input.actor ?? original.actor ?? null)
}

function platformProductJobMatchesPayload(row: JsonRecord | undefined) {
  return row ? jobFromRow(row) : null
}

function syncScheduleScope(value: unknown): PlatformProductSyncScheduleScope {
  return stringValue(value) === "spu" ? "spu" : "full"
}

function scheduleSpuNames(value: unknown) {
  const parsed = typeof value === "string" ? parseJson(value, value) : value
  return parseSpuCodes(parsed, { maxCodes: MAX_DETAIL_CODES_PER_JOB })
}

function ensurePlatformProductSyncScheduleRow(db: SyncPostgresDatabase = getDb()) {
  db.prepare(`
    insert into shein_platform_product_sync_schedule (
      id,
      enabled,
      schedule_hour,
      sync_scope,
      spu_names_json
    )
    values (?, 0, ?, 'full', '[]')
    on conflict(id) do nothing
  `).run(DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID, DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR)
}

function scheduleConfigFromRow(row: JsonRecord | undefined, db: SyncPostgresDatabase = getDb()): PlatformProductSyncScheduleConfig {
  const activeJob = activeScheduledPlatformProductSyncJob(db)
  return {
    id: stringValue(row?.id) || DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID,
    enabled: booleanEnv(row?.enabled, false),
    schedule_hour: boundedHour(row?.schedule_hour, DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR),
    sync_scope: syncScheduleScope(row?.sync_scope),
    spu_names: scheduleSpuNames(row?.spu_names_json),
    last_enqueued_date: stringValue(row?.last_enqueued_date) || null,
    last_enqueued_job_id: stringValue(row?.last_enqueued_job_id) || null,
    updated_at: stringValue(row?.updated_at) || null,
    active_job: activeJob ? snapshot(activeJob, db) : null,
  }
}

export function getPlatformProductSyncScheduleConfig(db: SyncPostgresDatabase = getDb()) {
  ensurePlatformProductSyncScheduleRow(db)
  const row = db.prepare(`
    select *
    from shein_platform_product_sync_schedule
    where id = ?
  `).get(DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID) as JsonRecord | undefined
  return scheduleConfigFromRow(row, db)
}

export function savePlatformProductSyncScheduleConfig(input: unknown = {}, db: SyncPostgresDatabase = getDb()) {
  ensurePlatformProductSyncScheduleRow(db)
  const current = getPlatformProductSyncScheduleConfig(db)
  const object = recordValue(input)
  const enabled = object.enabled == null ? current.enabled : booleanEnv(object.enabled, current.enabled)
  const scheduleHour = boundedHour(
    object.schedule_hour ?? object.scheduleHour,
    current.schedule_hour || DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_HOUR,
  )
  const syncScope = syncScheduleScope(object.sync_scope ?? object.syncScope ?? current.sync_scope)
  const spuNames = scheduleSpuNames(object.spu_names ?? object.spuNames ?? current.spu_names)
  const now = nowIso()
  const row = db.prepare(`
    update shein_platform_product_sync_schedule
    set enabled = ?,
      schedule_hour = ?,
      sync_scope = ?,
      spu_names_json = ?,
      updated_at = ?
    where id = ?
    returning *
  `).get(
    enabled ? 1 : 0,
    scheduleHour,
    syncScope,
    jsonArrayText(spuNames),
    now,
    DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID,
  ) as JsonRecord | undefined
  return scheduleConfigFromRow(row, db)
}

function activeScheduledPlatformProductSyncJob(db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select *
    from shein_platform_product_job
    where job_type = 'sync'
      and status in ('queued', 'running')
      and payload_json like ?
    order by created_at asc
    limit 1
  `).get(`%"source":"${SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE}"%`) as JsonRecord | undefined
  return platformProductJobMatchesPayload(row)
}

function scheduledPlatformProductSyncJobForDate(scheduleDate: string, db: SyncPostgresDatabase = getDb()) {
  const row = db.prepare(`
    select *
    from shein_platform_product_job
    where job_type = 'sync'
      and payload_json like ?
      and payload_json like ?
    order by created_at desc
    limit 1
  `).get(
    `%"source":"${SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE}"%`,
    `%"scheduleDate":"${scheduleDate}"%`,
  ) as JsonRecord | undefined
  return platformProductJobMatchesPayload(row)
}

function scheduledPlatformProductSyncCodes(schedule: PlatformProductSyncScheduleConfig, db: SyncPostgresDatabase = getDb()) {
  if (schedule.sync_scope === "spu") return schedule.spu_names
  return listPlatformProductSpuNames({ limit: MAX_DETAIL_CODES_PER_JOB }, db)
}

export function enqueueScheduledPlatformProductSyncJob(options: {
  now?: Date
  db?: SyncPostgresDatabase
  schedule?: PlatformProductSyncScheduleConfig
  scheduleJobs?: boolean
} = {}) {
  const db = options.db ?? getDb()
  const now = options.now ?? new Date()
  const schedule = options.schedule ?? getPlatformProductSyncScheduleConfig(db)
  if (!schedule.enabled) return null
  const activeJob = activeScheduledPlatformProductSyncJob(db)
  if (activeJob) return snapshot(activeJob, db)

  const scheduleDate = localNightlySyncDateKey(now)
  const existingJob = scheduledPlatformProductSyncJobForDate(scheduleDate, db)
  if (existingJob) return snapshot(existingJob, db)

  const codes = scheduledPlatformProductSyncCodes(schedule, db)
  if (!codes.length) return null

  const job = createPlatformProductJob({
    id: randomUUID(),
    type: "sync",
    status: "queued",
    title: schedule.sync_scope === "spu" ? "定时按款号同步 SHEIN 平台商品详情" : "定时全量同步 SHEIN 平台商品详情",
    total_count: codes.length,
    completed_count: 0,
    failed_count: 0,
    created_at: now.toISOString(),
    started_at: null,
    finished_at: null,
    items: [],
    payload: {
      spuNames: codes,
      source: SCHEDULED_PLATFORM_PRODUCT_SYNC_SOURCE,
      scheduleDate,
      scheduleHour: schedule.schedule_hour,
      syncScope: schedule.sync_scope,
      retryFailedItems: true,
      detailIntervalMs: DEFAULT_DETAIL_SYNC_INTERVAL_MS,
    },
    actor: scheduledPlatformProductSyncActor(),
    error: null,
  }, db)
  createPlatformProductJobItems(job.id, codes, db)
  db.prepare(`
    update shein_platform_product_sync_schedule
    set last_enqueued_date = ?,
      last_enqueued_job_id = ?,
      updated_at = ?
    where id = ?
  `).run(scheduleDate, job.id, nowIso(), DEFAULT_PLATFORM_PRODUCT_SYNC_SCHEDULE_ID)
  if (options.scheduleJobs !== false) schedulePlatformProductJobs()
  return snapshot(job, db)
}

export function enqueueNightlyPlatformProductFullSyncJob(options: {
  now?: Date
  db?: SyncPostgresDatabase
  scheduleJobs?: boolean
} = {}) {
  return enqueueScheduledPlatformProductSyncJob(options)
}

export function runPlatformProductNightlyFullSyncOnce(input: Date | {
  now?: Date
  db?: SyncPostgresDatabase
  schedule?: PlatformProductSyncScheduleConfig
  scheduleJobs?: boolean
} = {}) {
  const options = input instanceof Date ? { now: input } : input
  const now = options.now ?? new Date()
  const db = options.db ?? getDb()
  if (options.scheduleJobs !== false) schedulePlatformProductJobs()
  const schedule = options.schedule ?? getPlatformProductSyncScheduleConfig(db)
  if (!schedule.enabled) return null
  if (platformProductSyncScheduleHour(now) !== schedule.schedule_hour) return null
  return enqueueScheduledPlatformProductSyncJob({
    now,
    db,
    schedule,
    scheduleJobs: options.scheduleJobs,
  })
}

export function startPlatformProductNightlyFullSyncScheduler() {
  if (nightlyFullSyncSchedulerStarted) return
  nightlyFullSyncSchedulerStarted = true
  void runPlatformProductNightlyFullSyncOnce()
  const timer = setInterval(() => {
    void runPlatformProductNightlyFullSyncOnce()
  }, PLATFORM_PRODUCT_SYNC_SCHEDULE_POLL_MS)
  timer.unref?.()
}

function getInternalJob(type: PlatformProductJobType, id: string) {
  const job = loadPlatformProductJob(type, id)
  if (job?.status !== "completed") schedulePlatformProductJobs()
  return job
}

export function getPlatformProductSyncJob(id: string) {
  const job = getInternalJob("sync", id)
  return job ? snapshot(job) : null
}

export function enqueuePlatformProductExportJob(payload: unknown = {}) {
  const job = createPlatformProductJob({
    id: randomUUID(),
    type: "export",
    status: "queued",
    title: "导出 SHEIN 平台商品列表",
    total_count: 1,
    completed_count: 0,
    failed_count: 0,
    created_at: nowIso(),
    started_at: null,
    finished_at: null,
    items: [{ spu_code: "EXPORT", status: "queued", error: null, result: null }],
    payload: exportInput(payload),
    error: null,
  })
  schedulePlatformProductJobs()
  return snapshot(job)
}

export function getPlatformProductExportJob(id: string) {
  const job = getInternalJob("export", id)
  return job ? snapshot(job) : null
}

export function readPlatformProductExportFile(id: string) {
  const job = loadPlatformProductJob("export", id)
  if (!job) return null
  if (job.status !== "completed") schedulePlatformProductJobs()
  if (job.status !== "completed" || !job.filePath || !job.fileName) {
    return { pending: true as const, job: snapshot(job) }
  }
  return {
    pending: false as const,
    job: snapshot(job),
    fileName: job.fileName,
    filePath: job.filePath,
  }
}

const cleanupTimer = setInterval(() => {
  pruneExpiredPlatformProductJobs()
}, JOB_CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()
