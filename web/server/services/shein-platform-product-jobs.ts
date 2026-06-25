import { randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import ExcelJS from "exceljs"
import {
  listPlatformProducts,
  syncPlatformProducts,
  syncProductDetail,
} from "./shein-platform-products"
import { parseSpuCodes } from "../../../scripts/lib/product_archive_sync_queue.mjs"
import { platformProductWorkbookSheets } from "../../src/lib/shein-platform-product-export"

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
const SHEET_WRITE_CHUNK = 50_000
const EXPORT_DIR = path.join(os.tmpdir(), "listingify-platform-product-exports")
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT = 800
const SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS = 1800 * 1000
const DEFAULT_DETAIL_SYNC_INTERVAL_MS = Math.ceil(SHEIN_DETAIL_RATE_LIMIT_WINDOW_MS / SHEIN_DETAIL_RATE_LIMIT_WINDOW_LIMIT) + 250
const MAX_DETAIL_SYNC_INTERVAL_MS = 60_000
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000
const MAX_RATE_LIMIT_COOLDOWN_MS = 30 * 60_000
const JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const JOB_CLEANUP_INTERVAL_MS = 60 * 60 * 1000

const syncJobs = new Map<string, PlatformProductJob>()
const exportJobs = new Map<string, PlatformProductJob>()
const pending: string[] = []
let running = false

function nowIso() {
  return new Date().toISOString()
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function stringValue(value: unknown) {
  return String(value ?? "").trim()
}

function recordValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
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

function jobFinishedMs(job: PlatformProductJob) {
  if (!job.finished_at) return null
  const value = Date.parse(job.finished_at)
  return Number.isFinite(value) ? value : null
}

function removeJobFile(job: PlatformProductJob) {
  if (!job.filePath) return
  void unlink(job.filePath).catch(() => {})
}

export function pruneExpiredPlatformProductJobs(now = Date.now()) {
  let removed = 0
  for (const jobs of [syncJobs, exportJobs]) {
    for (const [id, job] of jobs) {
      const finishedMs = jobFinishedMs(job)
      if (finishedMs == null || now - finishedMs < JOB_RETENTION_MS) continue
      removeJobFile(job)
      jobs.delete(id)
      removed += 1
    }
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

function getJobMap(type: PlatformProductJobType) {
  return type === "sync" ? syncJobs : exportJobs
}

function getInternalJob(type: PlatformProductJobType, id: string) {
  pruneExpiredPlatformProductJobs()
  return getJobMap(type).get(id) ?? null
}

function setJobDone(job: PlatformProductJob) {
  job.status = "completed"
  job.finished_at = nowIso()
}

function markJobFailed(job: PlatformProductJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  job.error = message
  job.failed_count = Math.max(1, job.failed_count)
  if (!job.items.length) {
    job.items.push({ spu_code: job.type === "export" ? "EXPORT" : "SYNC", status: "failed", error: message })
  } else {
    for (const item of job.items.filter((item) => item.status !== "completed")) {
      item.status = "failed"
      item.error = item.error ?? message
      item.finished_at = nowIso()
    }
  }
  setJobDone(job)
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
    for (let index = 0; index < job.items.length; index += 1) {
      if (index > 0 && detailIntervalMs > 0) {
        await wait(detailIntervalMs)
      }
      const item = job.items[index]
      item.status = "running"
      item.started_at = nowIso()
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
      }
    }
    setJobDone(job)
    return
  }

  job.total_count = 1
  job.items = [{ spu_code: "平台商品列表", status: "running", error: null, result: null, started_at: nowIso(), finished_at: null }]
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

function appendRowsToWorksheet(
  worksheet: ExcelJS.Worksheet,
  columns: string[],
  rows: SpreadsheetRow[],
  start = 0,
  end = rows.length,
) {
  worksheet.addRow(columns)
  for (let index = start; index < end; index += SHEET_WRITE_CHUNK) {
    const chunkEnd = Math.min(index + SHEET_WRITE_CHUNK, end)
    for (let rowIndex = index; rowIndex < chunkEnd; rowIndex += 1) {
      const row = rows[rowIndex]
      worksheet.addRow(columns.map((column) => row[column] ?? ""))
    }
  }
}

async function workbookBuffer(sheets: SpreadsheetSheet[]) {
  const workbook = new ExcelJS.Workbook()
  for (const sheet of sheets) {
    const rows = sheet.rows
    if (!rows.length) continue
    const columns = rowColumns(rows)
    const chunkCount = Math.max(1, Math.ceil(rows.length / SHEET_ROW_LIMIT))
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * SHEET_ROW_LIMIT
      const end = Math.min(start + SHEET_ROW_LIMIT, rows.length)
      const worksheet = workbook.addWorksheet(sheetNameWithIndex(sheet.name, index, chunkCount))
      appendRowsToWorksheet(worksheet, columns, rows, start, end)
    }
  }
  return workbook.xlsx.writeBuffer()
}

async function fetchExportRows(job: PlatformProductJob) {
  const input = exportInput(job.payload)
  const rows = []
  let offset = 0
  while (true) {
    const response = listPlatformProducts({
      ...input,
      limit: EXPORT_PAGE_SIZE,
      offset,
    })
    if (offset === 0) {
      job.total_count = Number(response.pagination.total ?? 0)
    }
    rows.push(...response.items)
    job.completed_count = rows.length
    const total = Number(response.pagination.total ?? 0)
    if (rows.length >= total) break
    if (response.items.length === 0) break
    offset += EXPORT_PAGE_SIZE
  }
  return rows
}

async function processExportJob(job: PlatformProductJob) {
  job.items = [{ spu_code: "EXPORT", status: "running", error: null, result: null, started_at: nowIso(), finished_at: null }]
  const rows = await fetchExportRows(job)
  if (!rows.length) {
    throw new Error("当前筛选条件下没有可导出的平台商品")
  }
  const fileName = `SHEIN平台商品列表-${fileSafeTimestamp()}.xlsx`
  const filePath = path.join(EXPORT_DIR, `${job.id}.xlsx`)
  await mkdir(EXPORT_DIR, { recursive: true })
  const buffer = await workbookBuffer(platformProductWorkbookSheets(rows))
  await writeFile(filePath, Buffer.from(buffer))
  job.fileName = fileName
  job.filePath = filePath
  job.downloadUrl = `/api/shein-platform-products/export-jobs/${job.id}/download`
  job.items[0].status = "completed"
  job.items[0].result = { rowCount: rows.length, fileName }
  job.items[0].finished_at = nowIso()
  job.completed_count = rows.length
  setJobDone(job)
}

async function processLoop() {
  if (running) return
  running = true
  while (pending.length) {
    const id = pending.shift()
    const job = id ? syncJobs.get(id) ?? exportJobs.get(id) : null
    if (!job || job.status !== "queued") continue
    job.status = "running"
    job.started_at = nowIso()
    try {
      if (job.type === "sync") {
        await processSyncJob(job)
      } else {
        await processExportJob(job)
      }
    } catch (error) {
      markJobFailed(job, error)
    }
  }
  running = false
}

function schedule(job: PlatformProductJob) {
  pruneExpiredPlatformProductJobs()
  pending.push(job.id)
  queueMicrotask(() => {
    void processLoop()
  })
}

export function enqueuePlatformProductSyncJob(payload: unknown = {}, actor?: LifecycleActor | null) {
  const object = syncInput(payload)
  const codes = detailSyncCodes(object)
  const job: PlatformProductJob = {
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
  }
  syncJobs.set(job.id, job)
  schedule(job)
  return snapshot(job)
}

export function getPlatformProductSyncJob(id: string) {
  const job = getInternalJob("sync", id)
  return job ? snapshot(job) : null
}

export function enqueuePlatformProductExportJob(payload: unknown = {}) {
  const job: PlatformProductJob = {
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
  }
  exportJobs.set(job.id, job)
  schedule(job)
  return snapshot(job)
}

export function getPlatformProductExportJob(id: string) {
  const job = getInternalJob("export", id)
  return job ? snapshot(job) : null
}

export async function readPlatformProductExportFile(id: string) {
  const job = getInternalJob("export", id)
  if (!job) return null
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
