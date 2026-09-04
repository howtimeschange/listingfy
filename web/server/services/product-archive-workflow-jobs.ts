import { randomUUID } from "node:crypto"
import { access, rm } from "node:fs/promises"
import path from "node:path"
import { DATA_DIR, getDb } from "../db"
import { recordPerformanceSpan } from "../lib/performance-metrics"
import { readProductArchiveJobLeaseMs } from "../../../scripts/lib/product_archive_performance_config.mjs"

type JsonRecord = Record<string, unknown>

export type ProductArchiveWorkflowStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
export type ProductArchiveWorkflowStageStatus = "queued" | "running" | "completed" | "failed"

export const PRODUCT_ARCHIVE_WORKFLOW_STAGES = Object.freeze([
  { key: "parse", label: "解析表格" },
  { key: "source_import", label: "写入来源行" },
  { key: "launch_plan_import", label: "写入上市计划表" },
  { key: "draft_refresh", label: "刷新建档草稿" },
])

export type ProductArchiveWorkflowStageKey = (typeof PRODUCT_ARCHIVE_WORKFLOW_STAGES)[number]["key"]

export interface ProductArchiveWorkflowFile {
  kind: string
  fileName: string
  filePath: string
  fileSizeBytes: number
  fileHash?: string | null
}

export interface ProductArchiveWorkflowStage {
  key: string
  label: string
  status: ProductArchiveWorkflowStageStatus
  result?: unknown
  error_code?: string | null
  error_message?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface ProductArchiveWorkflowJobInput {
  id?: string
  title: string
  files: ReadonlyArray<Partial<ProductArchiveWorkflowFile> & { kind: string; fileName: string; filePath: string }>
  options?: JsonRecord
  stages?: ReadonlyArray<Partial<ProductArchiveWorkflowStage> & { key: string; label: string }>
  createdBy?: number | null
}

export interface ProductArchiveWorkflowJobSnapshot {
  id: string
  status: ProductArchiveWorkflowStatus
  title: string
  files: Array<Omit<ProductArchiveWorkflowFile, "filePath">>
  stages: ProductArchiveWorkflowStage[]
  result: JsonRecord
  error_code: string | null
  error_message: string | null
  completed_stage_count: number
  total_stage_count: number
  current_stage: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
}

export type ProductArchiveWorkflowJob = ProductArchiveWorkflowJobSnapshot & {
  files: ProductArchiveWorkflowFile[]
  options: JsonRecord
  claim_token: string | null
  claim_version: number
  lease_expires_at: number | null
  last_heartbeat_at: string | null
  created_by: number | null
}

export interface ProductArchiveWorkflowProcessorContext {
  signal: AbortSignal
  assertActive: () => Promise<void>
  checkpoint: (update?: (job: ProductArchiveWorkflowJob) => void | Promise<void>) => Promise<void>
  runSideEffect: <Result>(run: () => Result | Promise<Result>) => Promise<Result>
}

export type ProductArchiveWorkflowProcessor = (
  job: ProductArchiveWorkflowJob,
  stage: ProductArchiveWorkflowStage,
  context: ProductArchiveWorkflowProcessorContext,
) => unknown | Promise<unknown>

type WorkflowProcessor = ProductArchiveWorkflowProcessor

type WorkflowStore = {
  enqueue(input: ProductArchiveWorkflowJobInput): ProductArchiveWorkflowJob
  get(id: string): ProductArchiveWorkflowJob | null
  claim(id: string, workerToken: string): ProductArchiveWorkflowJob | null
  claimNext(workerToken: string): ProductArchiveWorkflowJob | null
  save(job: ProductArchiveWorkflowJob): boolean
  renew(job: ProductArchiveWorkflowJob): boolean
  cancel(id: string, actor: unknown): ProductArchiveWorkflowJob | null
}

const DEFAULT_JOB_LEASE_MS = 60_000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000
const WORKFLOW_ARTIFACT_ROOT = path.resolve(DATA_DIR, "product-archive-workflow")

function nowIso(now: () => number) {
  return new Date(now()).toISOString()
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
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

function parseJsonRecord(value: unknown) {
  return recordValue(parseJson(value, {}))
}

function parseJsonArray(value: unknown) {
  const parsed = parseJson(value, [])
  return Array.isArray(parsed) ? parsed : []
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function normalizedLeaseMs(value: unknown) {
  return readProductArchiveJobLeaseMs(value ?? process.env.LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS ?? DEFAULT_JOB_LEASE_MS)
}

function normalizedStage(stage: Partial<ProductArchiveWorkflowStage> & { key: string; label: string }): ProductArchiveWorkflowStage {
  const status = stage.status === "running" || stage.status === "completed" || stage.status === "failed"
    ? stage.status
    : "queued"
  return {
    key: stage.key,
    label: stage.label,
    status,
    result: stage.result ?? null,
    error_code: stage.error_code ?? null,
    error_message: stage.error_message ?? null,
    started_at: stage.started_at ?? null,
    finished_at: stage.finished_at ?? null,
  }
}

function normalizedStages(stages?: ReadonlyArray<Partial<ProductArchiveWorkflowStage> & { key: string; label: string }>) {
  const source = stages?.length ? stages : PRODUCT_ARCHIVE_WORKFLOW_STAGES
  return source.map(normalizedStage)
}

function normalizedFile(file: Partial<ProductArchiveWorkflowFile> & { kind: string; fileName: string; filePath: string }): ProductArchiveWorkflowFile {
  return {
    kind: stringValue(file.kind) || "source",
    fileName: stringValue(file.fileName) || "upload",
    filePath: stringValue(file.filePath),
    fileSizeBytes: Math.max(0, Math.floor(numberValue(file.fileSizeBytes))),
    fileHash: stringValue(file.fileHash) || null,
  }
}

function cloneJob(job: ProductArchiveWorkflowJob): ProductArchiveWorkflowJob {
  return {
    ...job,
    files: job.files.map((file) => ({ ...file })),
    options: { ...job.options },
    stages: job.stages.map((stage) => ({ ...stage })),
    result: { ...job.result },
  }
}

function jobSnapshot(job: ProductArchiveWorkflowJob): ProductArchiveWorkflowJobSnapshot {
  const completedStageCount = job.stages.filter((stage) => stage.status === "completed").length
  const currentStage = job.stages.find((stage) => stage.status === "running")
    ?? job.stages.find((stage) => stage.status === "queued")
  return {
    id: job.id,
    status: job.status,
    title: job.title,
    files: job.files.map(({ kind, fileName, fileSizeBytes, fileHash }) => ({ kind, fileName, fileSizeBytes, fileHash })),
    stages: job.stages.map((stage) => ({ ...stage })),
    result: { ...job.result },
    error_code: job.error_code,
    error_message: job.error_message,
    completed_stage_count: completedStageCount,
    total_stage_count: job.stages.length,
    current_stage: currentStage?.key ?? null,
    created_at: job.created_at,
    updated_at: job.updated_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
  }
}

function jobFromRow(row: JsonRecord): ProductArchiveWorkflowJob {
  const stages = parseJsonArray(row.stages_json)
    .map((stage) => {
      const value = recordValue(stage)
      return normalizedStage({
        key: stringValue(value.key),
        label: stringValue(value.label) || stringValue(value.key),
        status: stringValue(value.status) as ProductArchiveWorkflowStageStatus,
        result: value.result,
        error_code: stringValue(value.error_code) || null,
        error_message: stringValue(value.error_message) || null,
        started_at: stringValue(value.started_at) || null,
        finished_at: stringValue(value.finished_at) || null,
      })
    })
  return {
    id: stringValue(row.id),
    status: (stringValue(row.status) || "queued") as ProductArchiveWorkflowStatus,
    title: stringValue(row.title) || "深绘建档工作流",
    files: parseJsonArray(row.files_json).map((file) => {
      const value = recordValue(file)
      return normalizedFile({
        kind: stringValue(value.kind),
        fileName: stringValue(value.fileName ?? value.file_name),
        filePath: stringValue(value.filePath ?? value.file_path),
        fileSizeBytes: numberValue(value.fileSizeBytes ?? value.file_size_bytes),
        fileHash: stringValue(value.fileHash ?? value.file_hash) || null,
      })
    }),
    options: parseJsonRecord(row.options_json),
    stages: stages.length ? stages : normalizedStages(),
    result: parseJsonRecord(row.result_json),
    error_code: stringValue(row.error_code) || null,
    error_message: stringValue(row.error_message) || null,
    claim_token: stringValue(row.claim_token) || null,
    claim_version: Math.max(0, Math.floor(numberValue(row.claim_version))),
    lease_expires_at: row.lease_expires_at instanceof Date
      ? row.lease_expires_at.getTime()
      : (Number.isFinite(Number(row.lease_expires_at)) ? Number(row.lease_expires_at) : null),
    last_heartbeat_at: stringValue(row.last_heartbeat_at) || null,
    created_by: Number.isFinite(Number(row.created_by)) ? Number(row.created_by) : null,
    created_at: stringValue(row.created_at) || new Date().toISOString(),
    updated_at: stringValue(row.updated_at) || new Date().toISOString(),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    completed_stage_count: 0,
    total_stage_count: stages.length || PRODUCT_ARCHIVE_WORKFLOW_STAGES.length,
    current_stage: null,
  }
}

function newJob(input: ProductArchiveWorkflowJobInput, now: () => number, idFactory: () => string): ProductArchiveWorkflowJob {
  const createdAt = nowIso(now)
  return {
    id: stringValue(input.id) || idFactory(),
    status: "queued",
    title: stringValue(input.title) || "深绘建档工作流",
    files: input.files.map(normalizedFile),
    options: { ...(input.options ?? {}) },
    stages: normalizedStages(input.stages),
    result: {},
    error_code: null,
    error_message: null,
    claim_token: null,
    claim_version: 0,
    lease_expires_at: null,
    last_heartbeat_at: null,
    created_by: input.createdBy ?? null,
    created_at: createdAt,
    updated_at: createdAt,
    started_at: null,
    finished_at: null,
    completed_stage_count: 0,
    total_stage_count: input.stages?.length || PRODUCT_ARCHIVE_WORKFLOW_STAGES.length,
    current_stage: null,
  }
}

function workflowJobIsLeaseExpired(job: ProductArchiveWorkflowJob, now: number) {
  return job.status === "running" && (job.lease_expires_at == null || job.lease_expires_at <= now)
}

export function nextUnfinishedWorkflowStage(stages: ReadonlyArray<Pick<ProductArchiveWorkflowStage, "key" | "status">>) {
  return stages.find((stage) => stage.status !== "completed")?.key ?? null
}

export class ProductArchiveWorkflowLeaseError extends Error {
  code = "PRODUCT_ARCHIVE_WORKFLOW_LEASE_LOST"
}

function isWorkflowLeaseError(error: unknown) {
  return error instanceof ProductArchiveWorkflowLeaseError
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 1000)
}

function createMemoryWorkflowStore(options: { now: () => number; idFactory: () => string; leaseMs: number }): WorkflowStore {
  const records = new Map<string, ProductArchiveWorkflowJob>()

  function claimRecord(job: ProductArchiveWorkflowJob, workerToken: string) {
    const current = cloneJob(job)
    current.status = "running"
    current.claim_token = `${workerToken}:${options.idFactory()}`
    current.claim_version += 1
    current.lease_expires_at = options.now() + options.leaseMs
    current.last_heartbeat_at = nowIso(options.now)
    current.started_at = current.started_at ?? nowIso(options.now)
    current.updated_at = nowIso(options.now)
    records.set(current.id, current)
    return cloneJob(current)
  }

  return {
    enqueue(input) {
      const job = newJob(input, options.now, options.idFactory)
      records.set(job.id, cloneJob(job))
      return cloneJob(job)
    },
    get(id) {
      const job = records.get(id)
      return job ? cloneJob(job) : null
    },
    claim(id, workerToken) {
      const job = records.get(id)
      if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return null
      if (job.status === "running" && !workflowJobIsLeaseExpired(job, options.now())) return null
      return claimRecord(job, workerToken)
    },
    claimNext(workerToken) {
      const candidate = Array.from(records.values())
        .filter((job) => job.status === "queued" || workflowJobIsLeaseExpired(job, options.now()))
        .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))[0]
      return candidate ? claimRecord(candidate, workerToken) : null
    },
    save(job) {
      const current = records.get(job.id)
      if (!current || !job.claim_token || current.claim_token !== job.claim_token || current.claim_version !== job.claim_version) return false
      const next = cloneJob(job)
      next.updated_at = nowIso(options.now)
      if (["completed", "failed", "cancelled"].includes(next.status)) next.lease_expires_at = null
      records.set(next.id, next)
      return true
    },
    renew(job) {
      const current = records.get(job.id)
      if (!current || current.claim_token !== job.claim_token || current.claim_version !== job.claim_version || current.status !== "running") return false
      current.lease_expires_at = options.now() + options.leaseMs
      current.last_heartbeat_at = nowIso(options.now)
      current.updated_at = nowIso(options.now)
      return true
    },
    cancel(id, actor) {
      const current = records.get(id)
      if (!current || !["queued", "running"].includes(current.status)) return current ? cloneJob(current) : null
      current.status = "cancelled"
      current.error_code = "cancelled"
      current.error_message = "任务已取消"
      current.result = { ...current.result, cancelledBy: actor ?? null }
      current.claim_token = null
      current.claim_version += 1
      current.lease_expires_at = null
      current.finished_at = nowIso(options.now)
      current.updated_at = nowIso(options.now)
      return cloneJob(current)
    },
  }
}

function createWorkflowController({
  store,
  processor,
  now = () => Date.now(),
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  idFactory = () => randomUUID(),
  fileExists = async (filePath: string) => {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  },
  cleanupArtifacts = async (job: ProductArchiveWorkflowJob) => {
    const directories = new Set<string>()
    for (const file of job.files) {
      if (!file.filePath) continue
      const directory = path.dirname(path.resolve(file.filePath))
      if (!directory.startsWith(`${WORKFLOW_ARTIFACT_ROOT}${path.sep}`)) continue
      await rm(file.filePath, { force: true })
      directories.add(directory)
    }
    for (const directory of directories) await rm(directory, { recursive: true, force: true })
  },
}: {
  store: WorkflowStore
  processor?: WorkflowProcessor
  now?: () => number
  heartbeatIntervalMs?: number
  idFactory?: () => string
  fileExists?: (filePath: string) => boolean | Promise<boolean>
  cleanupArtifacts?: (job: ProductArchiveWorkflowJob) => void | Promise<void>
}) {
  const workerToken = `workflow-worker:${idFactory()}`
  let running = false
  let scheduled = false
  const runningControllers = new Map<string, AbortController>()
  const cancelledJobs = new Map<string, ProductArchiveWorkflowJob>()

  async function cleanupWorkflowArtifacts(job: ProductArchiveWorkflowJob) {
    try {
      await cleanupArtifacts(job)
    } catch {
      // Artifact cleanup is best effort after the terminal transition.
    }
  }

  function enqueueProductArchiveWorkflowJob(input: ProductArchiveWorkflowJobInput) {
    const job = store.enqueue(input)
    schedule()
    return jobSnapshot(job)
  }

  function getProductArchiveWorkflowJob(id: string) {
    const job = store.get(id)
    return job ? jobSnapshot(job) : null
  }

  function saveWorkflow(job: ProductArchiveWorkflowJob) {
    return store.save(job)
  }

  function claimWorkflowJob(id: string, worker = workerToken) {
    return store.claim(id, worker)
  }

  function reclaimExpiredWorkflowJob(id: string, worker = workerToken) {
    return store.claim(id, worker)
  }

  async function terminalize(job: ProductArchiveWorkflowJob, status: "completed" | "failed", errorCode: string | null = null, errorMessage: string | null = null) {
    job.status = status
    job.error_code = errorCode
    job.error_message = errorMessage
    job.finished_at = nowIso(now)
    job.updated_at = nowIso(now)
    const saved = store.save(job)
    if (saved) await cleanupWorkflowArtifacts(job)
    return saved
  }

  async function processClaimedJob(job: ProductArchiveWorkflowJob) {
    const startedAt = Date.now()
    let leaseLost = false
    const controller = new AbortController()
    runningControllers.set(job.id, controller)
    const leaseError = () => new ProductArchiveWorkflowLeaseError("深绘建档工作流 claim 已失效")
    const abortForLeaseLoss = () => {
      leaseLost = true
      if (!controller.signal.aborted) controller.abort(leaseError())
    }
    const context: ProductArchiveWorkflowProcessorContext = {
      signal: controller.signal,
      async assertActive() {
        if (controller.signal.aborted) throw controller.signal.reason ?? leaseError()
        if (!store.renew(job)) {
          abortForLeaseLoss()
          throw leaseError()
        }
      },
      async checkpoint(update) {
        await context.assertActive()
        await update?.(job)
        if (!store.save(job)) {
          abortForLeaseLoss()
          throw leaseError()
        }
      },
      async runSideEffect(run) {
        await context.assertActive()
        const result = await run()
        await context.assertActive()
        return result
      },
    }
    const heartbeat = heartbeatIntervalMs > 0
      ? setInterval(() => {
          if (leaseLost) return
          if (!store.renew(job)) abortForLeaseLoss()
        }, Math.max(1000, Math.floor(heartbeatIntervalMs)))
      : null
    heartbeat?.unref?.()

    try {
      for (const file of job.files) {
        if (!file.filePath || !(await fileExists(file.filePath))) {
          await terminalize(job, "failed", "source_file_missing", `工作流源文件不存在：${file.fileName}`)
          return
        }
      }
      if (typeof processor !== "function") {
        await terminalize(job, "failed", "workflow_processor_unavailable", "工作流处理器尚未就绪")
        return
      }
      for (const stage of job.stages) {
        if (stage.status === "completed") continue
        await context.assertActive()
        stage.status = "running"
        stage.started_at = stage.started_at ?? nowIso(now)
        stage.error_code = null
        stage.error_message = null
        if (!store.save(job)) throw leaseError()
        const stageStartedAt = Date.now()
        try {
          const result = await processor(job, stage, context)
          await context.assertActive()
          stage.status = "completed"
          stage.result = result ?? stage.result ?? null
          stage.finished_at = nowIso(now)
          if (!store.save(job)) throw leaseError()
          recordPerformanceSpan("workflow.stage", Date.now() - stageStartedAt, {
            jobId: job.id,
            stage: stage.key,
            status: "completed",
          })
        } catch (error) {
          if (isWorkflowLeaseError(error) || leaseLost) throw new ProductArchiveWorkflowLeaseError()
          stage.status = "failed"
          stage.error_code = "workflow_stage_failed"
          stage.error_message = safeErrorMessage(error)
          await terminalize(job, "failed", stage.error_code, stage.error_message)
          return
        }
      }
      await terminalize(job, "completed")
    } catch (error) {
      if (isWorkflowLeaseError(error) || leaseLost) return
      await terminalize(job, "failed", "workflow_failed", safeErrorMessage(error))
    } finally {
      if (heartbeat) clearInterval(heartbeat)
      runningControllers.delete(job.id)
      let cancelledJob = cancelledJobs.get(job.id) ?? null
      if (!cancelledJob) {
        try {
          const current = store.get(job.id)
          if (current?.status === "cancelled") cancelledJob = current
        } catch {
          // A cleanup read failure must not interrupt the current worker's shutdown.
        }
      }
      if (cancelledJob) {
        cancelledJobs.delete(job.id)
        await cleanupWorkflowArtifacts(cancelledJob)
      }
      recordPerformanceSpan("workflow.job", Date.now() - startedAt, {
        jobId: job.id,
        status: job.status,
      })
    }
  }

  async function runNext() {
    const job = store.claimNext(workerToken)
    if (!job) return null
    await processClaimedJob(job)
    const current = store.get(job.id)
    return current ? jobSnapshot(current) : null
  }

  async function processLoop() {
    if (running) return
    running = true
    try {
      while (true) {
        const result = await runNext()
        if (!result) break
      }
    } finally {
      running = false
      scheduled = false
    }
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    const run = () => {
      void processLoop()
    }
    if (typeof setImmediate === "function") setImmediate(run)
    else setTimeout(run, 0)
  }

  function resumeProductArchiveWorkflowJobs() {
    schedule()
  }

  async function cancelProductArchiveWorkflowJob(id: string, actor: unknown) {
    const job = store.cancel(id, actor)
    if (!job) return null
    const controller = runningControllers.get(id)
    if (controller && !controller.signal.aborted) {
      cancelledJobs.set(id, job)
      const error = new Error("深绘建档工作流已取消")
      error.name = "AbortError"
      controller.abort(error)
    } else if (!job.started_at) {
      await cleanupWorkflowArtifacts(job)
    }
    return jobSnapshot(job)
  }

  return {
    enqueueProductArchiveWorkflowJob,
    getProductArchiveWorkflowJob,
    resumeProductArchiveWorkflowJobs,
    cancelProductArchiveWorkflowJob,
    runNext,
    claimWorkflowJob,
    reclaimExpiredWorkflowJob,
    saveWorkflow,
  }
}

function createPostgresWorkflowStore({ getDatabase = getDb, leaseMs = normalizedLeaseMs(undefined), now = () => Date.now() }: {
  getDatabase?: typeof getDb
  leaseMs?: number
  now?: () => number
} = {}): WorkflowStore {
  const workerToken = `workflow-db-worker:${randomUUID()}`

  return {
    enqueue(input) {
      const job = newJob(input, now, () => randomUUID())
      const row = getDatabase().prepare(`
        insert into product_archive_workflow_job (
          id, status, title, files_json, options_json, stages_json, result_json,
          created_by, created_at, updated_at
        )
        values (?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?::timestamptz, ?::timestamptz)
        returning *
      `).get(
        job.id,
        job.status,
        job.title,
        jsonText(job.files),
        jsonText(job.options),
        jsonText(job.stages),
        jsonText(job.result),
        job.created_by,
        job.created_at,
        job.updated_at,
      ) as JsonRecord | undefined
      return row ? jobFromRow(row) : job
    },
    get(id) {
      const row = getDatabase().prepare("select * from product_archive_workflow_job where id = ?").get(id) as JsonRecord | undefined
      return row ? jobFromRow(row) : null
    },
    claim(id, workerTokenForClaim) {
      const row = getDatabase().prepare(`
        update product_archive_workflow_job
        set status = 'running',
            claim_token = ?,
            claim_version = claim_version + 1,
            lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
            last_heartbeat_at = clock_timestamp(),
            started_at = coalesce(started_at, clock_timestamp()),
            updated_at = clock_timestamp()
        where id = ?
          and (status = 'queued' or (status = 'running' and (lease_expires_at is null or lease_expires_at <= clock_timestamp())))
        returning *
      `).get(workerTokenForClaim || workerToken, leaseMs, id) as JsonRecord | undefined
      return row ? jobFromRow(row) : null
    },
    claimNext(workerTokenForClaim) {
      const row = getDatabase().prepare(`
        with next_job as (
          select id
          from product_archive_workflow_job
          where status = 'queued'
             or (status = 'running' and (lease_expires_at is null or lease_expires_at <= clock_timestamp()))
          order by created_at, id
          for update skip locked
          limit 1
        )
        update product_archive_workflow_job as job
        set status = 'running',
            claim_token = ?,
            claim_version = job.claim_version + 1,
            lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
            last_heartbeat_at = clock_timestamp(),
            started_at = coalesce(job.started_at, clock_timestamp()),
            updated_at = clock_timestamp()
        from next_job
        where job.id = next_job.id
        returning job.*
      `).get(workerTokenForClaim || workerToken, leaseMs) as JsonRecord | undefined
      return row ? jobFromRow(row) : null
    },
    save(job) {
      const terminal = ["completed", "failed", "cancelled"].includes(job.status)
      const row = getDatabase().prepare(`
        update product_archive_workflow_job
        set status = ?,
            title = ?,
            files_json = ?::jsonb,
            options_json = ?::jsonb,
            stages_json = ?::jsonb,
            result_json = ?::jsonb,
            error_code = ?,
            error_message = ?,
            lease_expires_at = case when ? then null else lease_expires_at end,
            claim_token = case when ? then null else claim_token end,
            last_heartbeat_at = coalesce(?, last_heartbeat_at),
            started_at = ?,
            finished_at = ?,
            updated_at = clock_timestamp()
        where id = ?
          and claim_token = ?
          and claim_version = ?
          and status in ('queued', 'running')
        returning id
      `).get(
        job.status,
        job.title,
        jsonText(job.files),
        jsonText(job.options),
        jsonText(job.stages),
        jsonText(job.result),
        job.error_code,
        job.error_message,
        terminal,
        terminal,
        job.last_heartbeat_at,
        job.started_at,
        job.finished_at,
        job.id,
        job.claim_token,
        job.claim_version,
      ) as JsonRecord | undefined
      return Boolean(row)
    },
    renew(job) {
      const row = getDatabase().prepare(`
        update product_archive_workflow_job
        set lease_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
            last_heartbeat_at = clock_timestamp(),
            updated_at = clock_timestamp()
        where id = ? and status = 'running' and claim_token = ? and claim_version = ?
        returning id
      `).get(leaseMs, job.id, job.claim_token, job.claim_version) as JsonRecord | undefined
      return Boolean(row)
    },
    cancel(id, actor) {
      const row = getDatabase().prepare(`
        update product_archive_workflow_job
        set status = 'cancelled',
            result_json = ?::jsonb,
            error_code = 'cancelled',
            error_message = '任务已取消',
            claim_token = null,
            claim_version = claim_version + 1,
            lease_expires_at = null,
            finished_at = clock_timestamp(),
            updated_at = clock_timestamp()
        where id = ? and status in ('queued', 'running')
        returning *
      `).get(jsonText({ cancelledBy: actor ?? null }), id) as JsonRecord | undefined
      return row ? jobFromRow(row) : null
    },
  }
}

export function createProductArchiveWorkflowRuntime(options: {
  now?: () => number
  leaseMs?: number
  fileExists?: (filePath: string) => boolean | Promise<boolean>
  processor?: WorkflowProcessor
} = {}) {
  const now = options.now ?? (() => Date.now())
  const leaseMs = normalizedLeaseMs(options.leaseMs)
  const idFactory = () => randomUUID()
  const store = createMemoryWorkflowStore({ now, leaseMs, idFactory })
  const controller = createWorkflowController({
    store,
    processor: options.processor ?? (async () => null),
    now,
    heartbeatIntervalMs: 0,
    idFactory,
    fileExists: options.fileExists,
  })

  return {
    ...controller,
    async runWorkflowWithFile(filePath: string) {
      const job = controller.enqueueProductArchiveWorkflowJob({
        title: "深绘建档工作流",
        files: [{ kind: "source", fileName: path.basename(filePath), filePath, fileSizeBytes: 0 }],
        options: {},
      })
      return (await controller.runNext()) ?? controller.getProductArchiveWorkflowJob(job.id)
    },
    recoverJob(input: { completedStages: string[] }) {
      const completed = new Set(input.completedStages)
      const job = store.enqueue({
        title: "恢复深绘建档工作流",
        files: [],
        options: {},
        stages: PRODUCT_ARCHIVE_WORKFLOW_STAGES.map((stage) => ({
          ...stage,
          status: completed.has(stage.key) ? "completed" : "queued",
        })),
      })
      return {
        jobId: job.id,
        nextStage: nextUnfinishedWorkflowStage(job.stages),
      }
    },
  }
}

let workflowProcessor: WorkflowProcessor | null = null
let postgresController: ReturnType<typeof createWorkflowController> | null = null

export function registerProductArchiveWorkflowProcessor(processor: WorkflowProcessor) {
  workflowProcessor = processor
  postgresController = null
}

function getPostgresController() {
  postgresController ??= createWorkflowController({
    store: createPostgresWorkflowStore(),
    processor: workflowProcessor ?? undefined,
    heartbeatIntervalMs: Math.max(1000, Math.floor(normalizedLeaseMs(undefined) / 3)),
  })
  return postgresController
}

export function enqueueProductArchiveWorkflowJob(input: ProductArchiveWorkflowJobInput) {
  return getPostgresController().enqueueProductArchiveWorkflowJob(input)
}

export function getProductArchiveWorkflowJob(id: string) {
  return getPostgresController().getProductArchiveWorkflowJob(id)
}

export function resumeProductArchiveWorkflowJobs() {
  getPostgresController().resumeProductArchiveWorkflowJobs()
}

export async function cancelProductArchiveWorkflowJob(id: string, actor: unknown) {
  return getPostgresController().cancelProductArchiveWorkflowJob(id, actor)
}
