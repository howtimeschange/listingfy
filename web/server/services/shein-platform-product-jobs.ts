import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, unlink } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import ExcelJS from "exceljs"
import { getDb } from "../db"
import {
  listPlatformProducts,
  syncPlatformProducts,
  syncProductDetail,
} from "./shein-platform-products"
import { parseSpuCodes } from "../../../scripts/lib/product_archive_sync_queue.mjs"
import {
  platformProductWorkbookSheets,
  type PlatformProductExportRow,
} from "../../src/lib/shein-platform-product-export"

type JsonRecord = Record<string, unknown>
type PlatformProductJobType = "sync" | "export"
type PlatformProductJobStatus = "queued" | "running" | "completed"
type PlatformProductJobItemStatus = "queued" | "running" | "completed" | "failed"
type SpreadsheetRow = Record<string, string | number | boolean | null>
type SpreadsheetSheet = { name: string; rows: SpreadsheetRow[] }

interface LifecycleActor {
  id: number | null
  username: string | null
}

interface PlatformProductJobItem {
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
}

const EXPORT_PAGE_SIZE = 200
const SHEET_ROW_LIMIT = 1_000_000
const SHEET_WRITE_CHUNK = 5_000
const EXPORT_DIR = path.join(os.tmpdir(), "listingify-platform-product-exports")
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT = 800
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS = 1800 * 1000
const DEFAULT_DETAIL_SYNC_INTERVAL_MS = Math.ceil(SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS / SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT) + 250
const MAX_DETAIL_SYNC_INTERVAL_MS = 60_000
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000
const MAX_RATE_LIMIT_COOLDOWN_MS = 30 * 60_000
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const JOB_CLEANUP_INTERVAL_MS = 60 * 60 * 1000
const RUNNING_JOB_STALE_MS = 15 * 60 * 1000

let running = false

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
  const id = numberValue(actor.id, Number.NaN)
  const username = stringValue(actor.username)
  if (!Number.isFinite(id) && !username) return null
  return {
    id: Number.isFinite(id) ? id : null,
    username: username || null,
  }
}

function parseJobItems(value: unknown): PlatformProductJobItem[] {
  return parseJsonArray(value).map((item) => {
    const record = recordValue(item)
    return {
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

function snapshot(job: PlatformProductJob) {
  const publicJob: Partial<PlatformProductJob> = { ...job }
  delete publicJob.filePath
  delete publicJob.payload
  delete publicJob.actor
  return {
    ...publicJob,
    items: job.items.map((item) => ({ ...item })),
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
  ) as JsonRecord | undefined
  return row ? jobFromRow(row) : job
}

export async function savePlatformProductJob(job: PlatformProductJob, db: SyncPostgresDatabase = getDb()) {
  return updatePlatformProductJob(job, db)
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

function claimNextPlatformProductJob(db: SyncPostgresDatabase = getDb()) {
  const now = nowIso()
  const staleBefore = new Date(Date.now() - RUNNING_JOB_STALE_MS).toISOString()
  const row = db.prepare(`
    with next_job as (
      select id
      from shein_platform_product_job
      where status = 'queued'
        or (
          status = 'running'
          and finished_at is null
          and updated_at < ?
        )
      order by created_at asc
      limit 1
      for update skip locked
    )
    update shein_platform_product_job as job
    set status = 'running',
      started_at = coalesce(job.started_at, ?),
      updated_at = ?
    from next_job
    where job.id = next_job.id
    returning job.*
  `).get(staleBefore, now, now) as JsonRecord | undefined
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
  return parseSpuCodes(payload.spuNames ?? payload.spu_names ?? payload.codes ?? payload.rawCodes ?? payload.raw_codes ?? "")
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

async function processSyncJob(job: PlatformProductJob) {
  const codes = detailSyncCodes(job.payload)
  if (codes.length) {
    const detailIntervalMs = platformProductDetailSyncIntervalMs(job.payload)
    job.total_count = codes.length
    job.items = codes.map((code) => ({
      spu_code: code,
      status: "queued",
      error: null,
      result: null,
      started_at: null,
      finished_at: null,
    }))
    await savePlatformProductJob(job)
    for (let index = 0; index < job.items.length; index += 1) {
      if (index > 0 && detailIntervalMs > 0) {
        await wait(detailIntervalMs)
      }
      const item = job.items[index]
      item.status = "running"
      item.started_at = nowIso()
      await savePlatformProductJob(job)
      try {
        const result = await syncProductDetail(item.spu_code, {}, job.actor)
        if (!responseOk(result.result)) {
          throw new Error(responseMessage(result.result) || "详情同步失败")
        }
        item.status = "completed"
        item.result = result.persistence
        job.completed_count += 1
      } catch (error) {
        const message = errorMessage(error)
        item.status = "failed"
        item.error = message
        job.failed_count += 1
        const rateLimitCooldownMs = isSheinRateLimitMessage(message) ? platformProductRateLimitCooldownMs(job.payload) : 0
        if (rateLimitCooldownMs > 0) {
          await wait(rateLimitCooldownMs)
        }
      } finally {
        item.finished_at = nowIso()
        await savePlatformProductJob(job)
      }
    }
    setJobDone(job)
    await savePlatformProductJob(job)
    return
  }

  job.total_count = 1
  job.items = [{ spu_code: "平台商品列表", status: "running", error: null, result: null, started_at: nowIso(), finished_at: null }]
  await savePlatformProductJob(job)
  try {
    const result = await syncPlatformProducts(syncInput(job.payload), job.actor)
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

function rowColumns(rows: SpreadsheetRow[]) {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  return columns
}

function sheetNameWithIndex(baseName: string, index: number, total: number) {
  const suffix = total > 1 ? `-${index + 1}` : ""
  const maxBaseLength = 31 - suffix.length
  const safeBase = baseName.replace(/[:\\/?*[\]]/g, " ").trim() || "Sheet"
  return `${safeBase.slice(0, Math.max(1, maxBaseLength))}${suffix}`
}

type WorksheetWriter = {
  addRow(values: unknown[]): { commit: () => void }
  commit: () => void
}

async function appendRowsToWorksheet(
  worksheet: WorksheetWriter,
  columns: string[],
  rows: SpreadsheetRow[],
  job: PlatformProductJob,
  sheetName: string,
  start = 0,
  end = rows.length,
) {
  const headerRow = worksheet.addRow(columns)
  headerRow.commit()
  for (let index = start; index < end; index += SHEET_WRITE_CHUNK) {
    const chunkEnd = Math.min(index + SHEET_WRITE_CHUNK, end)
    for (let rowIndex = index; rowIndex < chunkEnd; rowIndex += 1) {
      const row = rows[rowIndex]
      const outputRow = worksheet.addRow(columns.map((column) => row[column] ?? ""))
      outputRow.commit()
    }
    job.items[0].result = {
      stage: "generating_workbook",
      sheetName,
      writtenRows: chunkEnd,
      totalRows: end,
    }
    await savePlatformProductJob(job)
    await wait(0)
  }
}

async function writeWorkbookFile(sheets: SpreadsheetSheet[], filePath: string, job: PlatformProductJob) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: false,
    useSharedStrings: false,
  })
  for (const sheet of sheets) {
    const rows = sheet.rows
    if (!rows.length) continue
    const columns = rowColumns(rows)
    const chunkCount = Math.max(1, Math.ceil(rows.length / SHEET_ROW_LIMIT))
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * SHEET_ROW_LIMIT
      const end = Math.min(start + SHEET_ROW_LIMIT, rows.length)
      const worksheet = workbook.addWorksheet(sheetNameWithIndex(sheet.name, index, chunkCount))
      await appendRowsToWorksheet(worksheet, columns, rows, job, sheet.name, start, end)
      worksheet.commit()
    }
    await savePlatformProductJob(job)
    await wait(0)
  }
  await workbook.commit()
}

async function fetchExportRows(job: PlatformProductJob) {
  const input = exportInput(job.payload)
  const rows: PlatformProductExportRow[] = []
  let offset = 0
  while (true) {
    const response = listPlatformProducts({
      ...input,
      limit: EXPORT_PAGE_SIZE,
      offset,
    })
    const total = Number(response.pagination.total ?? 0)
    if (offset === 0) {
      job.total_count = total
    }
    rows.push(...response.items as PlatformProductExportRow[])
    job.completed_count = rows.length
    await savePlatformProductJob(job)
    await wait(0)
    if (total <= 0 || rows.length >= total) break
    if (response.items.length === 0) break
    offset += EXPORT_PAGE_SIZE
  }
  return rows
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
  const rows = await fetchExportRows(job)
  if (!rows.length) {
    throw new Error("当前筛选条件下没有可导出的平台商品")
  }
  const fileName = `SHEIN平台商品列表-${fileSafeTimestamp()}.xlsx`
  const filePath = path.join(EXPORT_DIR, `${job.id}.xlsx`)
  await mkdir(EXPORT_DIR, { recursive: true })
  job.items[0].spu_code = "生成 Excel 文件"
  job.items[0].result = { stage: "generating_workbook", rowCount: rows.length, fileName }
  await savePlatformProductJob(job)
  await writeWorkbookFile(platformProductWorkbookSheets(rows), filePath, job)
  job.fileName = fileName
  job.filePath = filePath
  job.downloadUrl = `/api/shein-platform-products/export-jobs/${job.id}/download`
  job.items[0].spu_code = "EXPORT"
  job.items[0].status = "completed"
  job.items[0].result = { rowCount: rows.length, fileName }
  job.items[0].finished_at = nowIso()
  job.completed_count = rows.length
  setJobDone(job)
  await savePlatformProductJob(job)
}

async function processLoop() {
  if (running) return
  running = true
  try {
    while (true) {
      const job = claimNextPlatformProductJob()
      if (!job) break
      try {
        if (job.type === "sync") {
          await processSyncJob(job)
        } else {
          await processExportJob(job)
        }
      } catch (error) {
        await markJobFailed(job, error)
      }
      await wait(0)
    }
  } finally {
    running = false
  }
}

function schedulePlatformProductJobs() {
  const run = () => {
    void processLoop()
  }
  if (typeof setImmediate === "function") {
    setImmediate(run)
    return
  }
  setTimeout(run, 0)
}

export function enqueuePlatformProductSyncJob(payload: unknown = {}, actor?: LifecycleActor | null) {
  const object = syncInput(payload)
  const codes = detailSyncCodes(object)
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
    items: codes.map((code) => ({ spu_code: code, status: "queued", error: null, result: null })),
    payload: object,
    actor: actor ?? null,
    error: null,
  })
  schedulePlatformProductJobs()
  return snapshot(job)
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

export async function readPlatformProductExportFile(id: string) {
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
    buffer: await readFile(job.filePath),
  }
}

const cleanupTimer = setInterval(() => {
  pruneExpiredPlatformProductJobs()
}, JOB_CLEANUP_INTERVAL_MS)
cleanupTimer.unref?.()
