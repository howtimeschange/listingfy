import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { getDb } from "../db"
import { writeOperationLog } from "../lib/audit"
import { withBackgroundTaskSlot } from "../lib/background-task-limiter"
import { importProductArchiveSourceRowsInChunks, refreshProductArchiveDraftsFromSourceBatchInChunks } from "./product-archive-drafts"
import { importListingLaunchPlanSheetsInChunks } from "./listing-launch-plans"
import { readSpreadsheetSheetsFromFileInWorker } from "./spreadsheet-worker"
import { readProductArchiveJobLeaseMs } from "../../../scripts/lib/product_archive_performance_config.mjs"
import type { AuditActor } from "../lib/audit"

type JsonRecord = Record<string, unknown>
type ImportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
type ImportJobItemStatus = "queued" | "running" | "completed" | "failed"

interface ImportJobItem {
  spu_code: string
  status: ImportJobItemStatus
  error?: string | null
  result?: unknown
  started_at?: string | null
  finished_at?: string | null
}

interface ImportJob {
  id: string
  status: ImportJobStatus
  title: string
  total_count: number
  completed_count: number
  failed_count: number
  payload: JsonRecord
  actor: { id: number | null; username: string | null } | null
  items: ImportJobItem[]
  result: JsonRecord
  fileName?: string
  fileSizeBytes: number
  filePath?: string
  error?: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  claim_token: string | null
  claim_version: number
  lease_expires_at: number | null
  last_heartbeat_at: string | null
  current_stage: number
  error_code: string | null
}

const JOB_STAGE_LABELS = [
  "解析表格",
  "写入来源行",
  "写入上市计划表",
  "刷新建档草稿",
]
const RUNNING_JOB_STALE_MS = 30 * 60 * 1000

let running = false

function nowIso() {
  return new Date().toISOString()
}

function wait(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jobLeaseMs() {
  return readProductArchiveJobLeaseMs(process.env.LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS)
}

function jobHeartbeatIntervalMs() {
  return Math.max(1000, Math.floor(jobLeaseMs() / 3))
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

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function isJobClaimLostError(error: unknown) {
  return error instanceof Error && error.message.includes("上市计划导入任务 claim 已失效")
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason instanceof Error) throw signal.reason
  const error = new Error("上市计划导入任务已取消")
  error.name = "AbortError"
  throw error
}

function jobStatus(value: unknown): ImportJobStatus {
  const status = stringValue(value)
  return status === "running" || status === "completed" || status === "failed" || status === "cancelled" ? status : "queued"
}

function itemStatus(value: unknown): ImportJobItemStatus {
  const status = stringValue(value)
  if (status === "running" || status === "completed" || status === "failed") return status
  return "queued"
}

function parseActor(value: unknown): ImportJob["actor"] {
  const actor = parseJsonObject(value)
  const rawId = actor.id
  const id = rawId == null || rawId === "" ? Number.NaN : Number(rawId)
  const username = stringValue(actor.username)
  if (!Number.isFinite(id) && !username) return null
  return {
    id: Number.isFinite(id) ? id : null,
    username: username || null,
  }
}

function auditActorFromJobActor(actor: ImportJob["actor"]): AuditActor | null {
  if (!actor?.id && !actor?.username) return null
  return {
    id: actor.id ?? null,
    username: actor.username ?? null,
  }
}

function stageItems(): ImportJobItem[] {
  return JOB_STAGE_LABELS.map((label) => ({
    spu_code: label,
    status: "queued",
    error: null,
    result: null,
    started_at: null,
    finished_at: null,
  }))
}

function parseJobItems(value: unknown): ImportJobItem[] {
  const items = parseJsonArray(value).map((item) => {
    const record = recordValue(item)
    return {
      spu_code: stringValue(record.spu_code) || "导入阶段",
      status: itemStatus(record.status),
      error: stringValue(record.error) || null,
      result: record.result ?? null,
      started_at: stringValue(record.started_at) || null,
      finished_at: stringValue(record.finished_at) || null,
    }
  })
  return items.length ? items : stageItems()
}

function jobFromRow(row: JsonRecord): ImportJob {
  return {
    id: stringValue(row.id),
    status: jobStatus(row.status),
    title: stringValue(row.title) || "导入上市计划表",
    total_count: numberValue(row.total_count, JOB_STAGE_LABELS.length),
    completed_count: numberValue(row.completed_count),
    failed_count: numberValue(row.failed_count),
    payload: parseJsonObject(row.payload_json),
    actor: parseActor(row.actor_json),
    items: parseJobItems(row.items_json),
    result: parseJsonObject(row.result_json),
    fileName: stringValue(row.file_name) || undefined,
    fileSizeBytes: numberValue(row.file_size_bytes),
    filePath: stringValue(row.file_path) || undefined,
    error: stringValue(row.error_message) || null,
    created_at: stringValue(row.created_at) || nowIso(),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    claim_token: stringValue(row.claim_token) || null,
    claim_version: Math.max(0, Math.floor(numberValue(row.claim_version))),
    lease_expires_at: row.lease_expires_at instanceof Date
      ? row.lease_expires_at.getTime()
      : (Number.isFinite(Number(row.lease_expires_at)) ? Number(row.lease_expires_at) : null),
    last_heartbeat_at: stringValue(row.last_heartbeat_at) || null,
    current_stage: Math.max(0, Math.floor(numberValue(row.current_stage))),
    error_code: stringValue(row.error_code) || null,
  }
}

function snapshot(job: ImportJob) {
  const publicJob: Partial<ImportJob> = { ...job }
  delete publicJob.filePath
  delete publicJob.payload
  delete publicJob.actor
  delete publicJob.claim_token
  delete publicJob.claim_version
  delete publicJob.lease_expires_at
  delete publicJob.last_heartbeat_at
  delete publicJob.current_stage
  delete publicJob.error_code
  return {
    ...publicJob,
    items: job.items.map((item) => ({ ...item })),
  }
}

function saveListingLaunchPlanImportJob(job: ImportJob) {
  const row = getDb().prepare(`
    update listing_launch_plan_import_job
    set status = ?,
      title = ?,
      total_count = ?,
      completed_count = ?,
      failed_count = ?,
      payload_json = ?::jsonb,
      actor_json = ?::jsonb,
      items_json = ?::jsonb,
      result_json = ?::jsonb,
      file_name = ?,
      file_size_bytes = ?,
      file_path = ?,
      error_message = ?,
      error_code = ?,
      started_at = ?,
      finished_at = ?,
      claim_token = case when ? then null else ? end,
      lease_expires_at = case when ? then null else clock_timestamp() + (?::double precision * interval '1 millisecond') end,
      last_heartbeat_at = clock_timestamp(),
      current_stage = ?,
      updated_at = ?
    where id = ?
      and started_at is not distinct from ?
      and claim_token = ?
      and claim_version = ?
    returning *
  `).get(
    job.status,
    job.title,
    job.total_count,
    job.completed_count,
    job.failed_count,
    jsonText(job.payload),
    jsonText(job.actor ?? {}),
    jsonText(job.items),
    jsonText(job.result),
    job.fileName ?? null,
    job.fileSizeBytes,
    job.filePath ?? null,
    job.error ?? null,
    job.error_code,
    job.started_at,
    job.finished_at,
    ["completed", "failed", "cancelled"].includes(job.status),
    job.claim_token,
    ["completed", "failed", "cancelled"].includes(job.status),
    jobLeaseMs(),
    job.current_stage,
    nowIso(),
    job.id,
    job.started_at,
    job.claim_token,
    job.claim_version,
  ) as JsonRecord | undefined
  if (!row) throw new Error("上市计划导入任务 claim 已失效，拒绝旧 worker 写入")
  return jobFromRow(row)
}

function loadListingLaunchPlanImportJob(id: string) {
  const row = getDb().prepare("select * from listing_launch_plan_import_job where id = ?").get(id) as JsonRecord | undefined
  return row ? jobFromRow(row) : null
}

function claimNextListingLaunchPlanImportJob() {
  const now = nowIso()
  const staleBefore = new Date(Date.now() - RUNNING_JOB_STALE_MS).toISOString()
  const claimToken = randomUUID()
  const row = getDb().prepare(`
    with next_job as (
      select id
      from listing_launch_plan_import_job
      where status = 'queued'
        or (
          status = 'running'
          and finished_at is null
          and (
            lease_expires_at is null
            or lease_expires_at <= clock_timestamp()
            or updated_at < ?
          )
        )
      order by created_at asc
      limit 1
      for update skip locked
    )
    update listing_launch_plan_import_job as job
    set status = 'running',
      started_at = coalesce(job.started_at, ?),
      updated_at = ?,
      claim_token = ?,
      claim_version = job.claim_version + 1,
      lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
      last_heartbeat_at = clock_timestamp(),
      error_code = null
    from next_job
    where job.id = next_job.id
    returning job.*
  `).get(staleBefore, now, now, claimToken, jobLeaseMs()) as JsonRecord | undefined
  return row ? jobFromRow(row) : null
}

function renewListingLaunchPlanImportJob(job: ImportJob) {
  const row = getDb().prepare(`
    update listing_launch_plan_import_job
    set lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
        last_heartbeat_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = ?
      and status = 'running'
      and claim_token = ?
      and claim_version = ?
    returning id
  `).get(jobLeaseMs(), job.id, job.claim_token, job.claim_version) as JsonRecord | undefined
  if (!row) throw new Error("上市计划导入任务 claim 已失效，拒绝旧 worker 写入")
}

function assertImportJobActive(job: ImportJob, signal?: AbortSignal) {
  throwIfAborted(signal)
  renewListingLaunchPlanImportJob(job)
  throwIfAborted(signal)
}

function stageResult(job: ImportJob, index: number) {
  return recordValue(job.items[index]?.result)
}

function sourceImportCheckpoints(job: ImportJob) {
  const raw = recordValue(job.result.sourceImportCheckpoints)
  const checkpoints: Record<string, JsonRecord> = {}
  for (const [key, value] of Object.entries(raw)) {
    checkpoints[key] = recordValue(value)
  }
  return checkpoints
}

function sourceBatchIdsFromJob(job: ImportJob) {
  const ids = new Set<number>()
  for (const value of Object.values(sourceImportCheckpoints(job))) {
    const id = Number(recordValue(value).sourceBatchId)
    if (Number.isInteger(id) && id > 0) ids.add(id)
  }
  for (const id of parseJsonArray(stageResult(job, 1).sourceBatchIds)) {
    const number = Number(id)
    if (Number.isInteger(number) && number > 0) ids.add(number)
  }
  return Array.from(ids)
}

function listingLaunchPlanImportJobKey(job: ImportJob, stage: string, sheetName = "") {
  return [
    "listing_launch_plan_import_job",
    job.id,
    stage,
    stringValue(job.fileName),
    Number(job.fileSizeBytes) || 0,
    stringValue(sheetName),
  ].join(":")
}

function appendSourceImportCheckpoint(
  job: ImportJob,
  key: string,
  result: { batch?: JsonRecord | null; inputRowCount?: unknown; insertedRowCount?: unknown },
) {
  const sourceBatchId = Number(result.batch?.id)
  if (!Number.isInteger(sourceBatchId) || sourceBatchId <= 0) return sourceBatchIdsFromJob(job)
  const checkpoints = sourceImportCheckpoints(job)
  checkpoints[key] = {
    sourceBatchId,
    inputRowCount: Number(result.inputRowCount ?? 0),
    insertedRowCount: Number(result.insertedRowCount ?? 0),
  }
  job.result = {
    ...job.result,
    sourceImportCheckpoints: checkpoints,
    sourceBatchIds: Object.values(checkpoints)
      .map((checkpoint) => Number(recordValue(checkpoint).sourceBatchId))
      .filter((id) => Number.isInteger(id) && id > 0),
  }
  return sourceBatchIdsFromJob(job)
}

function setStageRunning(job: ImportJob, index: number) {
  const item = job.items[index]
  if (!item) return
  if (item.status === "completed") return
  item.status = "running"
  item.error = null
  item.started_at = item.started_at ?? nowIso()
  job.current_stage = index
  job.completed_count = job.items.filter((current) => current.status === "completed").length
  job.failed_count = job.items.filter((current) => current.status === "failed").length
}

function setStageCompleted(job: ImportJob, index: number, result?: unknown) {
  const item = job.items[index]
  if (!item) return
  item.status = "completed"
  item.result = result ?? null
  item.finished_at = nowIso()
  job.current_stage = Math.min(JOB_STAGE_LABELS.length - 1, index + 1)
  job.completed_count = job.items.filter((current) => current.status === "completed").length
  job.failed_count = job.items.filter((current) => current.status === "failed").length
}

function setJobDone(job: ImportJob) {
  job.status = "completed"
  job.finished_at = nowIso()
}

async function markJobFailed(job: ImportJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  job.error = message
  job.error_code = /文件不存在|导入文件不存在|source file/i.test(message) ? "source_file_missing" : "import_failed"
  const runningItem = job.items.find((item) => item.status === "running")
  const failedItem = runningItem ?? job.items.find((item) => item.status === "queued") ?? job.items[0]
  if (failedItem) {
    failedItem.status = "failed"
    failedItem.error = message
    failedItem.finished_at = nowIso()
  }
  for (const item of job.items.filter((current) => current.status === "queued")) {
    item.status = "failed"
    item.error = message
    item.finished_at = nowIso()
  }
  job.completed_count = job.items.filter((item) => item.status === "completed").length
  job.failed_count = Math.max(1, job.items.filter((item) => item.status === "failed").length)
  job.status = "failed"
  job.finished_at = nowIso()
  saveListingLaunchPlanImportJob(job)
}

async function processImportJob(job: ImportJob) {
  if (!job.filePath) throw new Error("导入文件不存在，请重新上传上市计划表")
  job.status = "running"
  job.started_at = job.started_at ?? nowIso()
  job.error = null
  job.error_code = null
  let completedAndSaved = false
  const controller = new AbortController()
  let leaseLost = false
  const abortForLeaseLoss = () => {
    leaseLost = true
    if (!controller.signal.aborted) {
      controller.abort(new Error("上市计划导入任务 claim 已失效，拒绝旧 worker 写入"))
    }
  }
  const heartbeat = setInterval(() => {
    if (leaseLost) return
    try {
      renewListingLaunchPlanImportJob(job)
    } catch {
      abortForLeaseLoss()
    }
  }, jobHeartbeatIntervalMs())
  heartbeat.unref?.()
  const assertActive = () => assertImportJobActive(job, controller.signal)
  const saveProgress = () => {
    assertActive()
    return saveListingLaunchPlanImportJob(job)
  }
  let sheetsPromise: Promise<Array<{ name: string; rows: JsonRecord[] }>> | null = null
  const readSheets = async () => {
    assertActive()
    sheetsPromise ??= withBackgroundTaskSlot(
      "listing_launch_plan_import",
      (signal) => readSpreadsheetSheetsFromFileInWorker(job.filePath, { fileName: job.fileName, signal }),
      { signal: controller.signal },
    )
    const sheets = await sheetsPromise
    assertActive()
    return sheets
  }

  try {
    saveListingLaunchPlanImportJob(job)
    if (job.items[0]?.status !== "completed") {
      setStageRunning(job, 0)
      saveProgress()
      const sheets = await readSheets()
      const inputRowCount = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0)
      setStageCompleted(job, 0, { sheetCount: sheets.length, inputRowCount })
      saveProgress()
      await wait()
    }

    if (job.items[1]?.status !== "completed") {
      setStageRunning(job, 1)
      saveProgress()
      const sheets = await readSheets()
      let sourceBatchIds = sourceBatchIdsFromJob(job)
      let sourceInsertedRowCount = Object.values(sourceImportCheckpoints(job))
        .reduce((sum, checkpoint) => sum + Number(recordValue(checkpoint).insertedRowCount ?? 0), 0)
      for (const sheet of sheets) {
        const checkpointKey = listingLaunchPlanImportJobKey(job, "source_import", sheet.name)
        const checkpoint = sourceImportCheckpoints(job)[checkpointKey]
        const checkpointBatchId = Number(checkpoint?.sourceBatchId)
        if (Number.isInteger(checkpointBatchId) && checkpointBatchId > 0) continue
        assertActive()
        const sourceImport = await withBackgroundTaskSlot("listing_launch_plan_import", async (signal) => (
          importProductArchiveSourceRowsInChunks(getDb(), {
            sourceType: "launch_plan",
            fileName: job.fileName,
            sheetName: sheet.name,
            rows: sheet.rows,
            idempotencyKey: checkpointKey,
          }, {
            chunkSize: 1000,
            signal,
            beforeCommit: assertActive,
            onProgress: ({ sourceBatchId, insertedRowCount, totalRowCount }) => {
              const item = job.items[1]
              if (item) {
                item.result = {
                  sourceBatchId,
                  insertedRowCount,
                  totalRowCount,
                  sourceBatchCount: sourceBatchIds.length + 1,
                }
              }
              saveProgress()
            },
          })
        ), { signal: controller.signal })
        sourceBatchIds = appendSourceImportCheckpoint(job, checkpointKey, sourceImport)
        sourceInsertedRowCount += Number(sourceImport.insertedRowCount ?? 0)
        const item = job.items[1]
        if (item) {
          item.result = {
            sourceBatchIds,
            insertedRowCount: sourceInsertedRowCount,
            sourceBatchCount: sourceBatchIds.length,
          }
        }
        saveProgress()
      }
      sourceBatchIds = sourceBatchIdsFromJob(job)
      setStageCompleted(job, 1, { sourceBatchIds, insertedRowCount: sourceInsertedRowCount })
      saveProgress()
      await wait()
    }

    let listingPlanImport = recordValue(job.result.listingPlanImportPayload)
    if (job.items[2]?.status !== "completed") {
      setStageRunning(job, 2)
      saveProgress()
      const sheets = await readSheets()
      const sourceBatchIds = sourceBatchIdsFromJob(job)
      assertActive()
      listingPlanImport = await withBackgroundTaskSlot(
        "listing_launch_plan_import",
        (signal) => importListingLaunchPlanSheetsInChunks(getDb(), {
          fileName: job.fileName,
          fileSizeBytes: job.fileSizeBytes,
          sheets,
          sourceBatchIds,
          createdBy: job.actor?.id ?? null,
          idempotencyKey: listingLaunchPlanImportJobKey(job, "listing_launch_plan_import", "workbook"),
        }, {
          chunkSize: 250,
          signal,
          beforeCommit: assertActive,
          onProgress: ({ importId, insertedRowCount, totalRowCount }) => {
            const item = job.items[2]
            if (item) {
              item.result = { importId, insertedRowCount, totalRowCount }
            }
            saveProgress()
          },
        }),
        { signal: controller.signal },
      ) as JsonRecord
      const importId = Number(recordValue(listingPlanImport.import).id)
      const importSummary = {
        importId: Number.isInteger(importId) && importId > 0 ? importId : null,
        insertedRowCount: listingPlanImport.insertedRowCount,
        inputRowCount: listingPlanImport.inputRowCount,
      }
      job.result = {
        ...job.result,
        ...listingPlanImport,
        listingPlanImport: importSummary,
        listingPlanImportPayload: listingPlanImport,
      }
      setStageCompleted(job, 2, importSummary)
      saveProgress()
      await wait()
    } else {
      listingPlanImport = recordValue(job.result.listingPlanImportPayload)
    }

    let refreshSummaries = parseJsonArray(job.result.refreshSummaries).map(recordValue)
    if (job.items[3]?.status !== "completed") {
      setStageRunning(job, 3)
      saveProgress()
      const sourceBatchIds = sourceBatchIdsFromJob(job)
      refreshSummaries = []
      for (let index = 0; index < sourceBatchIds.length; index += 1) {
        const sourceBatchId = sourceBatchIds[index]
        assertActive()
        const summary = await withBackgroundTaskSlot(
          "listing_launch_plan_import",
          (signal) => refreshProductArchiveDraftsFromSourceBatchInChunks(getDb(), {
            sourceBatchId,
            sourceType: "launch_plan",
          }, {
            chunkSize: 5,
            signal,
            onProgress: (progress) => {
              const item = job.items[3]
              if (item) {
                item.result = {
                  sourceBatchIndex: index + 1,
                  sourceBatchCount: sourceBatchIds.length,
                  ...progress,
                }
              }
              saveProgress()
            },
          }),
          { signal: controller.signal },
        )
        refreshSummaries.push(recordValue(summary))
        job.result = { ...job.result, refreshSummaries }
        saveProgress()
      }
      const autoAppliedTradeCount = refreshSummaries.reduce((sum, item) => sum + Number(item.autoAppliedTradeCount ?? 0), 0)
      setStageCompleted(job, 3, { refreshSummaries, autoAppliedTradeCount })
      job.result = {
        ...job.result,
        refreshSummaries,
        autoAppliedTradeCount,
      }
    }

    const sourceBatchIds = sourceBatchIdsFromJob(job)
    const autoAppliedTradeCount = refreshSummaries.reduce((sum, item) => sum + Number(item.autoAppliedTradeCount ?? 0), 0)
    job.result = {
      ...job.result,
      ...listingPlanImport,
      sourceBatchIds,
      refreshSummaries,
      autoAppliedTradeCount,
    }
    setJobDone(job)
    saveListingLaunchPlanImportJob(job)
    completedAndSaved = true
    try {
      writeOperationLog(getDb(), {
        action: "listing_launch_plan.imported",
        module: "LISTING_LAUNCH_PLAN",
        entityType: "listing_launch_plan_import",
        entityId: recordValue(listingPlanImport.import).id,
        summary: `异步导入上市计划表 ${job.fileName ?? ""}`.trim(),
        metadata: {
          jobId: job.id,
          fileName: job.fileName,
          inputRowCount: listingPlanImport.inputRowCount,
          insertedRowCount: listingPlanImport.insertedRowCount,
          sourceBatchIds,
        },
      }, auditActorFromJobActor(job.actor))
    } catch {
      // Audit logging must not turn a fenced completed import back into a failed job.
    }
  } finally {
    clearInterval(heartbeat)
    if (completedAndSaved) await rm(job.filePath, { force: true })
  }
}

async function processLoop() {
  if (running) return
  running = true
  try {
    while (true) {
      const job = claimNextListingLaunchPlanImportJob()
      if (!job) break
      try {
        await processImportJob(job)
      } catch (error) {
        if (isJobClaimLostError(error)) {
          continue
        }
        try {
          await markJobFailed(job, error)
        } catch (failureError) {
          if (!isJobClaimLostError(failureError)) throw failureError
        }
      }
      await wait()
    }
  } finally {
    running = false
  }
}

export function scheduleListingLaunchPlanImportJobs() {
  const run = () => {
    void processLoop()
  }
  if (typeof setImmediate === "function") {
    setImmediate(run)
    return
  }
  setTimeout(run, 0)
}

export function enqueueListingLaunchPlanImportJob(input: {
  fileName: string
  fileSizeBytes: number
  filePath: string
  createdBy?: number | null
  username?: string | null
}) {
  const now = nowIso()
  const job: ImportJob = {
    id: randomUUID(),
    status: "queued",
    title: "导入上市计划表",
    total_count: JOB_STAGE_LABELS.length,
    completed_count: 0,
    failed_count: 0,
    payload: {},
    actor: {
      id: input.createdBy ?? null,
      username: input.username ?? null,
    },
    items: stageItems(),
    result: {},
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    filePath: input.filePath,
    error: null,
    created_at: now,
    started_at: null,
    finished_at: null,
    claim_token: null,
    claim_version: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    current_stage: 0,
    error_code: null,
  }
  const row = getDb().prepare(`
    insert into listing_launch_plan_import_job (
      id,
      status,
      title,
      total_count,
      completed_count,
      failed_count,
      payload_json,
      actor_json,
      items_json,
      result_json,
      file_name,
      file_size_bytes,
      file_path,
      error_message,
      started_at,
      finished_at,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?)
    returning *
  `).get(
    job.id,
    job.status,
    job.title,
    job.total_count,
    job.completed_count,
    job.failed_count,
    jsonText(job.payload),
    jsonText(job.actor ?? {}),
    jsonText(job.items),
    jsonText(job.result),
    job.fileName ?? null,
    job.fileSizeBytes,
    job.filePath ?? null,
    job.error ?? null,
    job.started_at,
    job.finished_at,
    job.created_at,
    now,
  ) as JsonRecord | undefined
  const created = row ? jobFromRow(row) : job
  scheduleListingLaunchPlanImportJobs()
  return snapshot(created)
}

export function getListingLaunchPlanImportJob(id: string) {
  const job = loadListingLaunchPlanImportJob(id)
  if (job?.status !== "completed") scheduleListingLaunchPlanImportJobs()
  return job ? snapshot(job) : null
}
