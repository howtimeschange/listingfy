import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import sharp from "sharp"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { bodyLimit } from "hono/body-limit"
import { getDb } from "../db"
import { requirePermission, trustedClientAddress } from "../lib/auth"
import { assertLocalImageFile, assertLocalProductArchiveAssetFile } from "../lib/local-path-guard"
import {
  detectProductArchiveOcrUploadType,
  detectImageUploadType,
  maxUploadBytes,
  readImageDimensions,
  readValidatedUploadBuffer,
  safeUploadFileName,
  writeValidatedUploadFile,
} from "../lib/upload-guard"
import { auditFromContext, writeOperationLog, type AuditActor } from "../lib/audit"
import { assertSafeProductArchiveCode } from "../lib/product-archive-security"
import {
  getProductArchiveOcrRuntimeInfo,
  readScmHangtagWashlabelSupplementWorkbook,
  recognizeProductArchiveOcrFiles,
} from "../../../scripts/lib/product_archive_hangtag_ocr.mjs"
import {
  createPostgresProductArchiveSyncJobStore,
  createProductArchiveSyncQueue,
  isProductArchiveSyncLeaseError,
  isRetryableProductArchiveSyncError,
  parseSpuCodes,
  ProductArchiveSyncLeaseError,
} from "../../../scripts/lib/product_archive_sync_queue.mjs"
import { resolveDeepdrawConfig } from "../../../scripts/lib/deepdraw_client.mjs"
import { syncMdmProduct } from "../services/product-archive-sync"
import { syncMdmMainImageToProductArchiveDraft } from "../services/product-archive-draft-mdm-images"
import {
  applyProductArchiveHangtagWashlabelOcr,
  previewProductArchiveHangtagWashlabelOcr,
} from "../services/product-archive-hangtag-ocr"
import {
  applyProductArchiveDraftTrade,
  assertProductArchiveDraftMutable,
  checkDuplicateProductArchiveDraft,
  classifyProductArchiveAssetPackageFileName,
  confirmProductArchiveDraftRecommendedTrade,
  createProductArchiveDraftFromSpu,
  createProductArchiveDraftImage,
  deleteProductArchiveDraft,
  deleteProductArchiveDraftImage,
  extractProductArchiveImageSpuCode,
  fillProductArchiveDraftFieldsWithAi,
  getProductArchiveDraftImageFile,
  getProductArchiveDraftDetail,
  importProductArchiveSourceRowsInChunks,
  importProductArchiveSourceRows,
  isReusableProductArchiveDraftStatus,
  latestProductArchiveDraftForSpuCode,
  listProductArchiveAiFieldStrategies,
  listProductArchiveDrafts,
  listProductArchiveSubmitLogs,
  missingDraftSpuCodes,
  patchProductArchiveDraftFields,
  productArchiveImageHasModelShot,
  readbackProductArchiveDraft,
  recommendProductArchiveSizeChartMappings,
  refreshDraftTradeSelectionFromLaunchPlan,
  refreshProductArchiveDraftsFromSourceBatchInChunks,
  refreshProductArchiveDraftsFromSourceBatch,
  saveProductArchiveSizeChartMappings,
  submitProductArchiveDraft,
  validateProductArchiveDraft,
} from "../services/product-archive-drafts"
import { importListingLaunchPlanSheetsInChunks } from "../services/listing-launch-plans"
import { readSpreadsheetSheetsFromFileInWorker } from "../services/spreadsheet-worker"
import { readPlmSizeChartWorkbook } from "../../../scripts/lib/product_archive_size_chart.mjs"
import { getDefaultAiScenarioRouter } from "../../../scripts/lib/ai_routing_context.mjs"
import { withBackgroundTaskSlot } from "../lib/background-task-limiter"

const productArchiveDrafts = new Hono()
const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")
const TEMPLATE_DIR = path.join(PROJECT_ROOT, "data", "product-archive-templates")
const DRAFT_IMAGE_DIR = path.join(PROJECT_ROOT, "data", "product-archive-draft-images")
const MB = 1024 * 1024
const SPREADSHEET_MULTIPART_OVERHEAD_BYTES = MB

function positiveBatchMegabytes(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function positiveInteger(name: string, fallback: number, cap: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.max(1, Math.min(cap, Math.floor(value)))
}

const MAX_PRODUCT_ARCHIVE_IMAGE_BATCH_BYTES = positiveBatchMegabytes(
  "LISTINGIFY_MAX_PRODUCT_ARCHIVE_IMAGE_BATCH_MB",
  256,
) * MB
const MAX_PRODUCT_ARCHIVE_OCR_BATCH_BYTES = positiveBatchMegabytes(
  "LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_BATCH_MB",
  512,
) * MB
const MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_BYTES = positiveBatchMegabytes(
  "LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_MB",
  128,
) * MB
const MAX_PRODUCT_ARCHIVE_OCR_FILES = positiveInteger(
  "LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_FILES",
  160,
  300,
)
const MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES = positiveInteger(
  "LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES",
  40,
  100,
)
const MAX_PRODUCT_ARCHIVE_WORKFLOW_SPREADSHEET_BYTES = maxUploadBytes("spreadsheet") * 3

function uploadBodyLimit(maxSize: number, message: string) {
  return bodyLimit({
    maxSize: maxSize + MB,
    onError: (c) => c.json({ error: message }, 413),
  })
}

const productArchiveImageBodyLimit = uploadBodyLimit(
  MAX_PRODUCT_ARCHIVE_IMAGE_BATCH_BYTES,
  "SPU 参考图片批次总大小超过限制",
)
const productArchiveOcrBodyLimit = uploadBodyLimit(
  MAX_PRODUCT_ARCHIVE_OCR_BATCH_BYTES,
  "吊牌/洗唛 OCR 批次总大小超过限制",
)
const productArchiveOcrPreviewBodyLimit = uploadBodyLimit(
  MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_BYTES,
  "吊牌/洗唛 OCR 预览批次总大小超过限制",
)
const productArchiveSpreadsheetBodyLimit = bodyLimit({
  maxSize: maxUploadBytes("spreadsheet") + SPREADSHEET_MULTIPART_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: "表格上传请求体总大小超过限制" }, 413),
})
const productArchiveWorkflowSpreadsheetBodyLimit = bodyLimit({
  maxSize: maxUploadBytes("spreadsheet") * 3 + SPREADSHEET_MULTIPART_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: "工作流表格批次请求体总大小超过限制" }, 413),
})

function assertAggregateUploadBytes(files: File[], maxBytes: number, message: string) {
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0)
  if (totalBytes > maxBytes) {
    throw new HTTPException(413, {
      message: `${message}（上限 ${Math.floor(maxBytes / MB)}MB）`,
    })
  }
  return totalBytes
}
const PRODUCT_ARCHIVE_TEMPLATES = {
  copywriting: {
    fileName: "标准文案表-模板.xlsx",
    filePath: path.join(TEMPLATE_DIR, "标准文案表-模板.xlsx"),
  },
  "launch-plan": {
    fileName: "上市计划表-模板.xlsx",
    filePath: path.join(TEMPLATE_DIR, "上市计划表-模板.xlsx"),
  },
} as const

async function syncDraftMdmMainImageSafely(db: ReturnType<typeof getDb>, draftId: number, spuCode: string) {
  try {
    return await syncMdmMainImageToProductArchiveDraft(db, draftId, {
      imageRootDir: DRAFT_IMAGE_DIR,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("MDM main image sync failed", { draftId, spuCode, message })
    return {
      status: "mdm_main_image_sync_failed",
      image: null,
      message,
    }
  }
}

const draftQueue = createProductArchiveSyncQueue({
  autoRecover: false,
  jobSliceSize: process.env.LISTINGIFY_PRODUCT_ARCHIVE_DRAFT_JOB_SLICE_SIZE ?? 5,
  runWithSlot: (_context: unknown, run: () => Promise<unknown>) => withBackgroundTaskSlot("product_archive_draft", run),
  store: createPostgresProductArchiveSyncJobStore({
    getDb,
    queueName: "product_archive_drafts",
  }),
  allowedSources: ["draft", "mdm_draft"],
  syncOne: async ({ source, spuCode, options }) => {
    const db = getDb()
    const mdm = source === "mdm_draft"
      ? await syncMdmProduct(db, spuCode)
      : null
    const detail = createProductArchiveDraftFromSpu(db, {
      spuCode,
      deepdrawTenantName: options.deepdrawTenantName,
      tradeId: options.tradeId,
      tradePath: options.tradePath,
      sourceBatchId: options.sourceBatchId,
      sourceBatchIds: options.sourceBatchIds,
      createdBy: options.createdBy,
      projectRoot: PROJECT_ROOT,
    })
    const mdmMainImage = await syncDraftMdmMainImageSafely(db, Number(detail.draft.id), spuCode)
    return {
      mdm,
      mdmMainImage,
      draftId: detail.draft.id,
      draftNo: detail.draft.draft_no,
      status: detail.draft.status,
    }
  },
})

type HangtagWashlabelOcrUploadFile = {
  filePath: string
  fileName: string
  mimeType: string
  size: number
  kind?: "ocr_asset" | "scm_supplement" | "reference_image"
  width?: number
  height?: number
  extension?: string
  hasModelShot?: boolean
  assetKind?: string
}

type DraftImageUploadFile = {
  buffer: Buffer
  fileName: string
  originalFileName: string
  mimeType: string
  size: number
  width: number
  height: number
  extension: string
  hasModelShot?: boolean
  assetKind?: string
}

type DraftAssetUploadFile = {
  buffer: Buffer
  fileName: string
  originalFileName: string
  mimeType: string
  size: number
  extension: string
  assetKind: "hangtag" | "washlabel"
  width?: number | null
  height?: number | null
}

type HangtagWashlabelOcrJobItem = {
  spu_code: string
  status: "queued" | "running" | "completed" | "failed"
  phase: "recognize" | "import_image" | "apply"
  started_at: string | null
  finished_at: string | null
  result: Record<string, unknown> | null
  error: string | null
}

type HangtagWashlabelOcrJob = {
  id: string
  source: "hangtag_washlabel_ocr"
  status: "queued" | "running" | "completed"
  outcome?: "succeeded" | "partial_failure" | "failed" | null
  total_count: number
  completed_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  files: HangtagWashlabelOcrUploadFile[]
  options: {
    overwriteExisting: boolean
    uploadDir: string
    actor: AuditActor | null
    ipAddress: string | null
  }
  items: HangtagWashlabelOcrJobItem[]
  result: Record<string, unknown> | null
}

function hangtagWashlabelUploadFileCount(...groups: HangtagWashlabelOcrUploadFile[][]) {
  return groups.reduce((sum, files) => sum + files.length, 0)
}

function hangtagWashlabelUploadByteCount(...groups: HangtagWashlabelOcrUploadFile[][]) {
  return groups.reduce(
    (sum, files) => sum + files.reduce((fileSum, file) => fileSum + Number(file.size || 0), 0),
    0,
  )
}

function assertHangtagWashlabelPreviewSize(
  files: HangtagWashlabelOcrUploadFile[],
  supplementFiles: HangtagWashlabelOcrUploadFile[],
  referenceImageFiles: HangtagWashlabelOcrUploadFile[],
) {
  const fileCount = hangtagWashlabelUploadFileCount(files, supplementFiles, referenceImageFiles)
  if (fileCount > MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES) {
    throw new HTTPException(413, {
      message: `识别预览最多支持 ${MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_FILES} 个文件；大图包请提交后台识别`,
    })
  }
  const totalBytes = hangtagWashlabelUploadByteCount(files, supplementFiles, referenceImageFiles)
  if (totalBytes > MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_BYTES) {
    throw new HTTPException(413, {
      message: `识别预览批次总大小超过限制（上限 ${Math.floor(MAX_PRODUCT_ARCHIVE_OCR_PREVIEW_BATCH_BYTES / MB)}MB）；大图包请提交后台识别`,
    })
  }
}

type ProductArchiveDraftBatchTarget = {
  draftId: number
  spuCode: string
  title: string | null
  status: string
}

type ProductArchiveAiFillJobItem = {
  draft_id: number
  spu_code: string
  status: "queued" | "running" | "completed" | "failed"
  started_at: string | null
  finished_at: string | null
  result: Record<string, unknown> | null
  error: string | null
}

type ProductArchiveAiFillJob = {
  id: string
  source: "ai_fill"
  status: "queued" | "running" | "completed"
  outcome?: "succeeded" | "partial_failure" | "failed" | null
  total_count: number
  completed_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  options: {
    actor: AuditActor | null
    ipAddress: string | null
  }
  items: ProductArchiveAiFillJobItem[]
  result: Record<string, unknown> | null
}

type ProductArchivePrecheckJobItem = {
  draft_id: number
  spu_code: string
  status: "queued" | "running" | "retrying" | "completed" | "failed"
  phase: "queued" | "validate" | "duplicate" | "preview"
  started_at: string | null
  finished_at: string | null
  result: Record<string, unknown> | null
  error: string | null
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
}

type ProductArchivePrecheckJob = {
  id: string
  source: "precheck"
  status: "queued" | "running" | "completed"
  outcome?: "succeeded" | "partial_failure" | "failed" | null
  total_count: number
  completed_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  options: {
    actor: AuditActor | null
    ipAddress: string | null
    retryDelayMs: number
  }
  items: ProductArchivePrecheckJobItem[]
  result: Record<string, unknown> | null
}

type ProductArchivePublishJobItem = {
  draft_id: number
  spu_code: string
  status: "queued" | "running" | "retrying" | "completed" | "failed"
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
  started_at: string | null
  finished_at: string | null
  result: Record<string, unknown> | null
  error: string | null
}

type ProductArchivePublishJob = {
  id: string
  source: "publish"
  status: "queued" | "running" | "completed"
  outcome?: "succeeded" | "partial_failure" | "failed" | null
  total_count: number
  completed_count: number
  failed_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  options: {
    actor: AuditActor | null
    ipAddress: string | null
    retryDelayMs: number
  }
  items: ProductArchivePublishJobItem[]
  result: Record<string, unknown> | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function scheduleProductArchiveBackgroundWorker(run: () => void) {
  if (typeof setImmediate === "function") {
    setImmediate(run)
    return
  }
  setTimeout(run, 0)
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => scheduleProductArchiveBackgroundWorker(resolve))
}

function productArchiveJobSliceSize(envName: string, fallback = 5) {
  const number = Number(process.env[envName] ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(100, Math.floor(number)))
}

function hasOpenQueueItems(items: Array<{ status: string }>) {
  return items.some((item) => item.status !== "completed" && item.status !== "failed")
}

async function maybeYieldProductArchiveJob<T extends { status: "queued" | "running" | "completed"; items: Array<{ status: string }> }>(
  job: T,
  pending: T[],
  persist: (job: T) => void,
  processedInSlice: number,
  envName: string,
  fallback = 5,
) {
  if (processedInSlice < productArchiveJobSliceSize(envName, fallback)) return false
  if (!hasOpenQueueItems(job.items)) return false
  job.status = "queued"
  persist(job)
  pending.push(job)
  await yieldToEventLoop()
  return true
}

function cloneProductArchiveAiFillJob(job: ProductArchiveAiFillJob) {
  const currentItem = job.items.find((item) => item.status === "running") ?? null
  return {
    ...job,
    options: {
      ...job.options,
      actor: job.options.actor ? { ...job.options.actor } : null,
    },
    items: job.items.map((item) => ({ ...item, result: item.result ? { ...item.result } : null })),
    current_item: currentItem ? { ...currentItem } : null,
    failed_items: job.items.filter((item) => item.status === "failed").map((item) => ({ ...item })),
    queued_count: job.items.filter((item) => item.status === "queued").length,
    running_count: job.items.filter((item) => item.status === "running").length,
  }
}

function createProductArchiveAiFillQueue({
  store,
  onInternalError = (error: unknown) => console.error("Product archive AI fill queue internal error", error),
  now = () => Date.now(),
}: {
  store: ReturnType<typeof createPostgresProductArchiveSyncJobStore>
  onInternalError?: (error: unknown, context?: Record<string, unknown>) => void
  now?: () => number
}) {
  const jobs = new Map<string, ProductArchiveAiFillJob>()
  const pending: ProductArchiveAiFillJob[] = []
  let running = false
  let processScheduled = false

  function reportInternalError(error: unknown, context: Record<string, unknown>) {
    try {
      onInternalError(error, context)
    } catch {
      // Error reporting must never stop the AI fill worker.
    }
  }

  function persist(job: ProductArchiveAiFillJob) {
    try {
      if (store.save(cloneProductArchiveAiFillJob(job)) === false) {
        throw new ProductArchiveSyncLeaseError()
      }
    } catch (error) {
      reportInternalError(error, { phase: "persist", jobId: job.id })
      if (store.requiresLease) {
        jobs.delete(job.id)
        throw error
      }
    }
  }

  function getJob(id: string) {
    const job = jobs.get(id)
    if (job) return cloneProductArchiveAiFillJob(job)
    const stored = store.get(id) as ProductArchiveAiFillJob | null
    return stored ? cloneProductArchiveAiFillJob(stored) : null
  }

  function setItemFinished(
    job: ProductArchiveAiFillJob,
    item: ProductArchiveAiFillJobItem,
    status: "completed" | "failed",
    result: Record<string, unknown> | null,
    error: string | null,
  ) {
    item.status = status
    item.result = result
    item.error = error
    item.finished_at = new Date(now()).toISOString()
    if (status === "completed") job.completed_count += 1
    if (status === "failed") job.failed_count += 1
    persist(job)
  }

  async function processItem(job: ProductArchiveAiFillJob, item: ProductArchiveAiFillJobItem) {
    return withBackgroundTaskSlot("product_archive_ai_fill", async () => {
      item.status = "running"
      item.started_at ??= new Date(now()).toISOString()
      persist(job)

      const db = getDb()
      const result = await fillProductArchiveDraftFieldsWithAi(db, item.draft_id)
      const detail = result.detail as { draft?: Record<string, unknown> }
      const draft = detail.draft ?? {}
      const validationSummary = draft.validation_summary_json && typeof draft.validation_summary_json === "object"
        ? draft.validation_summary_json as Record<string, unknown>
        : {}
      const savedCount = result.saved.length
      const warningCount = result.warnings.length
      const itemResult = {
        draftId: item.draft_id,
        spuCode: item.spu_code,
        savedCount,
        warningCount,
        status: stringValue(draft.status),
        blockerCount: Number(validationSummary.blocker_count ?? 0) || 0,
        warningIssueCount: Number(validationSummary.warning_count ?? 0) || 0,
      }
      try {
        writeOperationLog(db, {
          action: "draft.ai_fill.background_applied",
          module: "PRODUCT_ARCHIVE_DRAFT",
          entityType: "product_archive_draft",
          entityId: item.draft_id,
          summary: `后台 AI 推荐补齐深绘建档草稿字段 ${item.spu_code}`,
          metadata: {
            jobId: job.id,
            draftId: item.draft_id,
            spuCode: item.spu_code,
            savedCount,
            warningCount,
          },
        }, job.options.actor, job.options.ipAddress ?? undefined)
      } catch (error) {
        reportInternalError(error, { phase: "item_audit", jobId: job.id, draftId: item.draft_id })
      }
      setItemFinished(job, item, "completed", itemResult, null)
    })
  }

  async function processLoop() {
    processScheduled = false
    if (running) return
    running = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()
        if (!job) continue
        try {
          let interrupted = false
          let processedInSlice = 0
          let yielded = false
          job.status = "running"
          job.started_at ??= new Date(now()).toISOString()
          persist(job)
          try {
            for (const item of job.items) {
              if (item.status === "completed" || item.status === "failed") continue
              try {
                await processItem(job, item)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) {
                  interrupted = true
                  throw error
                }
                setItemFinished(job, item, "failed", {
                  draftId: item.draft_id,
                  spuCode: item.spu_code,
                }, errorMessage(error))
              }
              processedInSlice += 1
              try {
                yielded = await maybeYieldProductArchiveJob(job, pending, persist, processedInSlice, "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_JOB_SLICE_SIZE", 5)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) interrupted = true
                throw error
              }
              if (yielded) break
            }
          } finally {
            if (!yielded && !interrupted) {
              const completedItems = job.items.filter((item) => item.status === "completed")
              job.result = {
                processedDraftCount: completedItems.length,
                failedDraftCount: job.items.filter((item) => item.status === "failed").length,
                savedFieldCount: completedItems.reduce((sum, item) => sum + (Number(item.result?.savedCount) || 0), 0),
                warningCount: completedItems.reduce((sum, item) => sum + (Number(item.result?.warningCount) || 0), 0),
              }
              job.status = "completed"
              job.outcome = job.failed_count === 0
                ? "succeeded"
                : job.completed_count === 0
                  ? "failed"
                  : "partial_failure"
              job.finished_at = new Date(now()).toISOString()
              persist(job)
            }
          }
        } catch (error) {
          if (isProductArchiveSyncLeaseError(error)) {
            jobs.delete(job.id)
            reportInternalError(error, { phase: "lease_lost", jobId: job.id })
            continue
          }
          throw error
        }
      }
    } finally {
      running = false
    }
  }

  function schedule() {
    if (processScheduled) return
    processScheduled = true
    scheduleProductArchiveBackgroundWorker(() => {
      void processLoop().catch((error) => {
        reportInternalError(error, { phase: "process_loop" })
      })
    })
  }

  function enqueue({
    targets,
    actor,
    ipAddress,
  }: {
    targets: ProductArchiveDraftBatchTarget[]
    actor: AuditActor | null
    ipAddress: string | null
  }) {
    if (targets.length === 0) throw new Error("请先选择需要 AI 填充的草稿")
    const nowText = new Date(now()).toISOString()
    const job: ProductArchiveAiFillJob = {
      id: randomUUID(),
      source: "ai_fill",
      status: "queued",
      outcome: null,
      total_count: targets.length,
      completed_count: 0,
      failed_count: 0,
      created_at: nowText,
      started_at: null,
      finished_at: null,
      options: { actor, ipAddress },
      items: targets.map((target) => ({
        draft_id: target.draftId,
        spu_code: target.spuCode,
        status: "queued",
        started_at: null,
        finished_at: null,
        result: null,
        error: null,
      })),
      result: null,
    }
    jobs.set(job.id, job)
    pending.push(job)
    persist(job)
    schedule()
    return cloneProductArchiveAiFillJob(job)
  }

  function resume() {
    const recovered = (store.recover() as ProductArchiveAiFillJob[])
      .filter((job) => job?.source === "ai_fill")
    for (const storedJob of recovered) {
      const job = storedJob
      job.status = "queued"
      job.started_at = null
      job.finished_at = null
      for (const item of job.items) {
        if (item.status === "running") {
          item.status = "queued"
          item.started_at = null
          item.finished_at = null
          item.error = null
        }
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length
      job.failed_count = job.items.filter((item) => item.status === "failed").length
      jobs.set(job.id, job)
      pending.push(job)
      persist(job)
    }
    if (pending.length > 0) schedule()
  }

  return {
    enqueue,
    getJob,
    resume,
  }
}

function cloneProductArchivePrecheckJob(job: ProductArchivePrecheckJob) {
  const currentItem = job.items.find((item) => item.status === "running" || item.status === "retrying") ?? null
  return {
    ...job,
    options: {
      ...job.options,
      actor: job.options.actor ? { ...job.options.actor } : null,
    },
    items: job.items.map((item) => ({ ...item, result: item.result ? { ...item.result } : null })),
    current_item: currentItem ? { ...currentItem } : null,
    failed_items: job.items.filter((item) => item.status === "failed").map((item) => ({ ...item })),
    queued_count: job.items.filter((item) => item.status === "queued").length,
    running_count: job.items.filter((item) => item.status === "running" || item.status === "retrying").length,
  }
}

function clampPrecheckAttempts(value: unknown) {
  const number = Number(value ?? process.env.LISTINGIFY_PRODUCT_ARCHIVE_PRECHECK_MAX_ATTEMPTS ?? 3)
  if (!Number.isFinite(number)) return 3
  return Math.max(1, Math.min(6, Math.floor(number)))
}

function clampPrecheckRetryDelayMs(value: unknown) {
  const number = Number(value ?? process.env.LISTINGIFY_PRODUCT_ARCHIVE_PRECHECK_RETRY_DELAY_MS ?? 5000)
  if (!Number.isFinite(number)) return 5000
  return Math.max(1000, Math.min(60000, Math.floor(number)))
}

function precheckErrorIsRetryable(error: unknown) {
  const message = errorMessage(error)
  if (/校验未通过|提交预览后仍有阻断|深绘已存在|草稿存在阻断|本地未找到|不存在|缺少|无效|不能提交|重复|duplicate/i.test(message)) return false
  return isRetryableProductArchiveSyncError(error)
}

function validationIssueSummary(issues: unknown) {
  const rows = Array.isArray(issues) ? issues : []
  const messages = rows.map((issue) => {
    const row = objectValue(issue)
    const fieldName = stringValue(row.fieldName ?? row.field_name)
    const skuCode = stringValue(row.skuCode ?? row.sku_code)
    const prefix = fieldName || skuCode
    const message = stringValue(row.message) || stringValue(row.issueType ?? row.issue_type) || "未知问题"
    return prefix ? `${prefix}：${message}` : message
  }).filter(Boolean)
  if (messages.length === 0) return "存在阻断问题"
  const head = messages.slice(0, 3).join("；")
  return messages.length > 3 ? `${head}；另有 ${messages.length - 3} 项` : head
}

function validationSummaryCounts(validation: unknown) {
  const record = objectValue(validation)
  const summary = objectValue(record.summary)
  return {
    blockerCount: Number(summary.blocker_count ?? 0) || 0,
    warningCount: Number(summary.warning_count ?? 0) || 0,
    infoCount: Number(summary.info_count ?? 0) || 0,
  }
}

function setPrecheckItemFailed(
  job: ProductArchivePrecheckJob,
  item: ProductArchivePrecheckJobItem,
  result: Record<string, unknown>,
  error: string,
  persist: (job: ProductArchivePrecheckJob) => void,
  now: () => number,
) {
  item.status = "failed"
  item.result = result
  item.error = error
  item.next_retry_at = null
  item.finished_at = new Date(now()).toISOString()
  job.failed_count += 1
  persist(job)
}

function setPrecheckItemCompleted(
  job: ProductArchivePrecheckJob,
  item: ProductArchivePrecheckJobItem,
  result: Record<string, unknown>,
  persist: (job: ProductArchivePrecheckJob) => void,
  now: () => number,
) {
  item.status = "completed"
  item.result = result
  item.error = null
  item.next_retry_at = null
  item.finished_at = new Date(now()).toISOString()
  job.completed_count += 1
  persist(job)
}

function createProductArchivePrecheckQueue({
  store,
  onInternalError = (error: unknown) => console.error("Product archive precheck queue internal error", error),
  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}: {
  store: ReturnType<typeof createPostgresProductArchiveSyncJobStore>
  onInternalError?: (error: unknown, context?: Record<string, unknown>) => void
  wait?: (ms: number) => Promise<unknown>
  now?: () => number
}) {
  const jobs = new Map<string, ProductArchivePrecheckJob>()
  const pending: ProductArchivePrecheckJob[] = []
  let running = false
  let processScheduled = false

  function reportInternalError(error: unknown, context: Record<string, unknown>) {
    try {
      onInternalError(error, context)
    } catch {
      // Error reporting must never stop the precheck worker.
    }
  }

  function persist(job: ProductArchivePrecheckJob) {
    try {
      if (store.save(cloneProductArchivePrecheckJob(job)) === false) {
        throw new ProductArchiveSyncLeaseError()
      }
    } catch (error) {
      reportInternalError(error, { phase: "persist", jobId: job.id })
      if (store.requiresLease) {
        jobs.delete(job.id)
        throw error
      }
    }
  }

  function getJob(id: string) {
    const job = jobs.get(id)
    if (job) return cloneProductArchivePrecheckJob(job)
    const stored = store.get(id) as ProductArchivePrecheckJob | null
    return stored ? cloneProductArchivePrecheckJob(stored) : null
  }

  async function runPrecheckItemOnce(job: ProductArchivePrecheckJob, item: ProductArchivePrecheckJobItem) {
    item.status = "running"
    item.phase = "validate"
    item.started_at ??= new Date(now()).toISOString()
    item.next_retry_at = null
    item.error = null
    persist(job)

    const db = getDb()
    const prepared = db.transaction(() => {
      const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, item.draft_id)
      const validation = validateProductArchiveDraft(db, item.draft_id)
      return { tradeRefresh, validation }
    })()
    const { tradeRefresh, validation } = prepared
    const validationCounts = validationSummaryCounts(validation)
    if (validationCounts.blockerCount > 0) {
      const message = `校验未通过：${validationIssueSummary(objectValue(validation).issues)}`
      setPrecheckItemFailed(job, item, {
        draftId: item.draft_id,
        spuCode: item.spu_code,
        resultKind: "validation_failed",
        phase: "validate",
        message,
        blockerCount: validationCounts.blockerCount,
        warningCount: validationCounts.warningCount,
        tradeSelectionAutoApplied: tradeRefresh.autoApplied,
      }, message, persist, now)
      return
    }

    item.phase = "duplicate"
    persist(job)
    const duplicate = await checkDuplicateProductArchiveDraft(db, item.draft_id)
    if (duplicate.duplicateFound) {
      const message = "深绘已存在同货号商品"
      setPrecheckItemFailed(job, item, {
        draftId: item.draft_id,
        spuCode: item.spu_code,
        resultKind: "duplicate_found",
        phase: "duplicate",
        message,
        blockerCount: 1,
        warningCount: validationCounts.warningCount,
        duplicate,
      }, message, persist, now)
      return
    }

    item.phase = "preview"
    persist(job)
    const preview = await submitProductArchiveDraft(db, item.draft_id, { dryRun: true })
    const finalValidation = validateProductArchiveDraft(db, item.draft_id)
    const finalCounts = validationSummaryCounts(finalValidation)
    if (finalCounts.blockerCount > 0) {
      const message = `提交预览后仍有阻断：${validationIssueSummary(objectValue(finalValidation).issues)}`
      setPrecheckItemFailed(job, item, {
        draftId: item.draft_id,
        spuCode: item.spu_code,
        resultKind: "preview_validation_failed",
        phase: "preview",
        message,
        blockerCount: finalCounts.blockerCount,
        warningCount: finalCounts.warningCount,
      }, message, persist, now)
      return
    }

    const previewRecord = objectValue(preview)
    const previewSummary = objectValue(previewRecord.summary)
    const result = {
      draftId: item.draft_id,
      spuCode: item.spu_code,
      resultKind: "precheck_passed",
      phase: "preview",
      message: "预检通过，可批量发布到深绘",
      blockerCount: finalCounts.blockerCount,
      warningCount: finalCounts.warningCount,
      fieldCount: Number(previewSummary.fieldCount ?? 0) || 0,
      skuCount: Number(previewSummary.skuCount ?? 0) || 0,
      duplicateFound: false,
      previewGenerated: true,
      tradeSelectionAutoApplied: tradeRefresh.autoApplied,
    }
    try {
      writeOperationLog(db, {
        action: "draft.publish_precheck.background_completed",
        module: "PRODUCT_ARCHIVE_DRAFT",
        entityType: "product_archive_draft",
        entityId: item.draft_id,
        summary: `后台批量发布预检深绘建档草稿 ${item.spu_code}`,
        metadata: {
          jobId: job.id,
          draftId: item.draft_id,
          spuCode: item.spu_code,
          result,
        },
      }, job.options.actor, job.options.ipAddress ?? undefined)
    } catch (error) {
      reportInternalError(error, { phase: "item_audit", jobId: job.id, draftId: item.draft_id })
    }
    setPrecheckItemCompleted(job, item, result, persist, now)
  }

  async function processItem(job: ProductArchivePrecheckJob, item: ProductArchivePrecheckJobItem) {
    item.started_at ??= new Date(now()).toISOString()
    while (item.attempt_count < item.max_attempts) {
      item.attempt_count += 1
      try {
        await withBackgroundTaskSlot("product_archive_precheck", () => runPrecheckItemOnce(job, item))
        return
      } catch (error) {
        if (isProductArchiveSyncLeaseError(error)) throw error
        const retryable = precheckErrorIsRetryable(error) && item.attempt_count < item.max_attempts
        item.error = errorMessage(error)
        if (!retryable) {
          setPrecheckItemFailed(job, item, {
            draftId: item.draft_id,
            spuCode: item.spu_code,
            resultKind: "failed",
            phase: item.phase,
            retryable: false,
            attemptCount: item.attempt_count,
          }, item.error, persist, now)
          return
        }
        const retryDelay = job.options.retryDelayMs * item.attempt_count
        item.status = "retrying"
        item.result = {
          draftId: item.draft_id,
          spuCode: item.spu_code,
          resultKind: "retrying",
          phase: item.phase,
          retryable: true,
          attemptCount: item.attempt_count,
          message: "接口繁忙，等待自动重试",
        }
        item.next_retry_at = new Date(now() + retryDelay).toISOString()
        persist(job)
        try {
          await wait(retryDelay)
        } catch (waitError) {
          reportInternalError(waitError, { phase: "retry_delay", jobId: job.id, draftId: item.draft_id })
        }
      }
    }
  }

  function finishJob(job: ProductArchivePrecheckJob) {
    const results = job.items.map((item) => objectValue(item.result))
    job.result = {
      precheckPassedCount: results.filter((result) => stringValue(result.resultKind) === "precheck_passed").length,
      validationFailedCount: results.filter((result) => ["validation_failed", "preview_validation_failed"].includes(stringValue(result.resultKind))).length,
      duplicateCount: results.filter((result) => stringValue(result.resultKind) === "duplicate_found").length,
      previewGeneratedCount: results.filter((result) => result.previewGenerated === true).length,
      warningCount: results.reduce((sum, result) => sum + (Number(result.warningCount) || 0), 0),
    }
    job.status = "completed"
    job.outcome = job.failed_count === 0
      ? "succeeded"
      : job.completed_count === 0
        ? "failed"
        : "partial_failure"
    job.finished_at = new Date(now()).toISOString()
    persist(job)
  }

  async function processLoop() {
    processScheduled = false
    if (running) return
    running = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()
        if (!job) continue
        try {
          let interrupted = false
          let processedInSlice = 0
          let yielded = false
          job.status = "running"
          job.started_at ??= new Date(now()).toISOString()
          persist(job)
          try {
            for (const item of job.items) {
              if (item.status === "completed" || item.status === "failed") continue
              try {
                await processItem(job, item)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) {
                  interrupted = true
                  throw error
                }
                setPrecheckItemFailed(job, item, {
                  draftId: item.draft_id,
                  spuCode: item.spu_code,
                  resultKind: "failed",
                  phase: item.phase,
                }, errorMessage(error), persist, now)
              }
              processedInSlice += 1
              try {
                yielded = await maybeYieldProductArchiveJob(job, pending, persist, processedInSlice, "LISTINGIFY_PRODUCT_ARCHIVE_PRECHECK_JOB_SLICE_SIZE", 5)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) interrupted = true
                throw error
              }
              if (yielded) break
            }
          } finally {
            if (!yielded && !interrupted) finishJob(job)
          }
        } catch (error) {
          if (isProductArchiveSyncLeaseError(error)) {
            jobs.delete(job.id)
            reportInternalError(error, { phase: "lease_lost", jobId: job.id })
            continue
          }
          throw error
        }
      }
    } finally {
      running = false
    }
  }

  function schedule() {
    if (processScheduled) return
    processScheduled = true
    scheduleProductArchiveBackgroundWorker(() => {
      void processLoop().catch((error) => {
        reportInternalError(error, { phase: "process_loop" })
      })
    })
  }

  function enqueue({
    targets,
    maxAttempts,
    retryDelayMs,
    actor,
    ipAddress,
  }: {
    targets: ProductArchiveDraftBatchTarget[]
    maxAttempts?: unknown
    retryDelayMs?: unknown
    actor: AuditActor | null
    ipAddress: string | null
  }) {
    if (targets.length === 0) throw new Error("请先选择需要预检的草稿")
    const nowText = new Date(now()).toISOString()
    const normalizedMaxAttempts = clampPrecheckAttempts(maxAttempts)
    const job: ProductArchivePrecheckJob = {
      id: randomUUID(),
      source: "precheck",
      status: "queued",
      outcome: null,
      total_count: targets.length,
      completed_count: 0,
      failed_count: 0,
      created_at: nowText,
      started_at: null,
      finished_at: null,
      options: { actor, ipAddress, retryDelayMs: clampPrecheckRetryDelayMs(retryDelayMs) },
      items: targets.map((target) => ({
        draft_id: target.draftId,
        spu_code: target.spuCode,
        status: "queued",
        phase: "queued",
        started_at: null,
        finished_at: null,
        result: null,
        error: null,
        attempt_count: 0,
        max_attempts: normalizedMaxAttempts,
        next_retry_at: null,
      })),
      result: null,
    }
    jobs.set(job.id, job)
    pending.push(job)
    persist(job)
    schedule()
    return cloneProductArchivePrecheckJob(job)
  }

  function resume() {
    const recovered = (store.recover() as ProductArchivePrecheckJob[])
      .filter((job) => job?.source === "precheck")
    for (const storedJob of recovered) {
      const job = storedJob
      job.status = "queued"
      job.started_at = null
      job.finished_at = null
      job.options.retryDelayMs = clampPrecheckRetryDelayMs(job.options.retryDelayMs)
      for (const item of job.items) {
        item.attempt_count = Math.max(0, Number(item.attempt_count ?? 0) || 0)
        item.max_attempts = clampPrecheckAttempts(item.max_attempts)
        if (item.status === "running" || item.status === "retrying") {
          item.status = "queued"
          item.phase = "queued"
          item.started_at = null
          item.finished_at = null
          item.error = null
          item.next_retry_at = null
        }
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length
      job.failed_count = job.items.filter((item) => item.status === "failed").length
      jobs.set(job.id, job)
      pending.push(job)
      persist(job)
    }
    if (pending.length > 0) schedule()
  }

  return {
    enqueue,
    getJob,
    resume,
  }
}

function clampPublishAttempts(value: unknown) {
  const number = Number(value ?? 3)
  if (!Number.isFinite(number)) return 3
  return Math.max(1, Math.min(6, Math.floor(number)))
}

function clampPublishRetryDelayMs(value: unknown) {
  const number = Number(value ?? 5000)
  if (!Number.isFinite(number)) return 5000
  return Math.max(1000, Math.min(60000, Math.floor(number)))
}

function publishErrorIsRetryable(error: unknown) {
  const message = errorMessage(error)
  if (/草稿存在阻断|请选择|本地未找到|不存在|缺少|无效|不能提交|重复|duplicate/i.test(message)) return false
  return isRetryableProductArchiveSyncError(error)
}

function publishRetrySafety(db: ReturnType<typeof getDb>, draftId: number) {
  const draft = db.prepare(`
    select status, duplicate_result_json
    from product_archive_draft
    where id = ?
  `).get(draftId) as { status?: unknown; duplicate_result_json?: unknown } | undefined
  const status = stringValue(draft?.status)
  const duplicateResult = objectValue(draft?.duplicate_result_json)
  if (status === "submitting" && stringValue(duplicateResult.submit_transport_unknown)) {
    return {
      retryable: false,
      reason: "创建请求结果未知，已保持 submitting 防重复；请先在详情页回读确认后再处理",
    }
  }
  return { retryable: true, reason: "" }
}

function publishItemResultFromSubmitResult(result: unknown, draftId: number, spuCode: string) {
  const record = objectValue(result)
  if (record.alreadySubmitting === true) {
    const message = "草稿正在提交中，请先在详情页回读确认后再重试"
    return {
      ok: false,
      error: message,
      result: {
        draftId,
        spuCode,
        resultKind: "already_submitting",
        status: stringValue(record.status),
        message,
      },
    }
  }
  if (record.duplicateFound === true) {
    const message = "深绘已存在同货号商品"
    return {
      ok: true,
      result: {
        draftId,
        spuCode,
        resultKind: "duplicate_found",
        status: "duplicate_found",
        message,
      },
    }
  }
  const status = stringValue(record.status) || "submitted"
  const resultKind = status === "readback_verified" ? "published" : status === "readback_mismatch" ? "readback_mismatch" : "submitted"
  const message = resultKind === "published"
    ? "已发布并回读一致"
    : resultKind === "readback_mismatch"
      ? "已创建，但深绘回读不一致，请进详情复核"
      : `已提交到深绘，状态：${status}`
  return {
    ok: true,
    result: {
      draftId,
      spuCode,
      resultKind,
      status,
      message,
      ok: record.ok === false ? false : true,
    },
  }
}

function cloneProductArchivePublishJob(job: ProductArchivePublishJob) {
  const currentItem = job.items.find((item) => item.status === "running" || item.status === "retrying") ?? null
  return {
    ...job,
    options: {
      ...job.options,
      actor: job.options.actor ? { ...job.options.actor } : null,
    },
    items: job.items.map((item) => ({ ...item, result: item.result ? { ...item.result } : null })),
    current_item: currentItem ? { ...currentItem } : null,
    failed_items: job.items.filter((item) => item.status === "failed").map((item) => ({ ...item })),
    queued_count: job.items.filter((item) => item.status === "queued").length,
    running_count: job.items.filter((item) => item.status === "running" || item.status === "retrying").length,
  }
}

function createProductArchivePublishQueue({
  store,
  onInternalError = (error: unknown) => console.error("Product archive publish queue internal error", error),
  wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}: {
  store: ReturnType<typeof createPostgresProductArchiveSyncJobStore>
  onInternalError?: (error: unknown, context?: Record<string, unknown>) => void
  wait?: (ms: number) => Promise<unknown>
  now?: () => number
}) {
  const jobs = new Map<string, ProductArchivePublishJob>()
  const pending: ProductArchivePublishJob[] = []
  let running = false
  let processScheduled = false

  function reportInternalError(error: unknown, context: Record<string, unknown>) {
    try {
      onInternalError(error, context)
    } catch {
      // Error reporting must never stop the publish worker.
    }
  }

  function persist(job: ProductArchivePublishJob) {
    try {
      if (store.save(cloneProductArchivePublishJob(job)) === false) {
        throw new ProductArchiveSyncLeaseError()
      }
    } catch (error) {
      reportInternalError(error, { phase: "persist", jobId: job.id })
      if (store.requiresLease) {
        jobs.delete(job.id)
        throw error
      }
    }
  }

  function getJob(id: string) {
    const job = jobs.get(id)
    if (job) return cloneProductArchivePublishJob(job)
    const stored = store.get(id) as ProductArchivePublishJob | null
    return stored ? cloneProductArchivePublishJob(stored) : null
  }

  function setItemFinished(
    job: ProductArchivePublishJob,
    item: ProductArchivePublishJobItem,
    status: "completed" | "failed",
    result: Record<string, unknown> | null,
    error: string | null,
  ) {
    item.status = status
    item.result = result
    item.error = error
    item.next_retry_at = null
    item.finished_at = new Date(now()).toISOString()
    if (status === "completed") job.completed_count += 1
    if (status === "failed") job.failed_count += 1
    persist(job)
  }

  async function processItem(job: ProductArchivePublishJob, item: ProductArchivePublishJobItem) {
    item.started_at ??= new Date(now()).toISOString()
    while (item.attempt_count < item.max_attempts) {
      item.status = "running"
      item.attempt_count += 1
      item.next_retry_at = null
      persist(job)
      try {
        const submitResult = await withBackgroundTaskSlot(
          "product_archive_publish",
          () => submitProductArchiveDraft(getDb(), item.draft_id, { dryRun: false }),
        )
        const finished = publishItemResultFromSubmitResult(submitResult, item.draft_id, item.spu_code)
        if (!finished.ok) {
          setItemFinished(job, item, "failed", finished.result, finished.error)
          return
        }
        try {
          writeOperationLog(getDb(), {
            action: "draft.publish.background_completed",
            module: "PRODUCT_ARCHIVE_DRAFT",
            entityType: "product_archive_draft",
            entityId: item.draft_id,
            summary: `后台批量发布深绘建档草稿 ${item.spu_code}`,
            metadata: {
              jobId: job.id,
              draftId: item.draft_id,
              spuCode: item.spu_code,
              attemptCount: item.attempt_count,
              result: finished.result,
            },
          }, job.options.actor, job.options.ipAddress ?? undefined)
        } catch (error) {
          reportInternalError(error, { phase: "item_audit", jobId: job.id, draftId: item.draft_id })
        }
        setItemFinished(job, item, "completed", finished.result, null)
        return
      } catch (error) {
        if (isProductArchiveSyncLeaseError(error)) throw error
        const safety = publishRetrySafety(getDb(), item.draft_id)
        const retryable = safety.retryable && publishErrorIsRetryable(error) && item.attempt_count < item.max_attempts
        item.error = safety.retryable ? errorMessage(error) : safety.reason || errorMessage(error)
        if (!retryable) {
          setItemFinished(job, item, "failed", {
            draftId: item.draft_id,
            spuCode: item.spu_code,
            resultKind: safety.retryable ? "failed" : "unsafe_retry_blocked",
            retryable: false,
            attemptCount: item.attempt_count,
          }, item.error)
          return
        }
        const retryDelay = job.options.retryDelayMs * item.attempt_count
        item.status = "retrying"
        item.next_retry_at = new Date(now() + retryDelay).toISOString()
        persist(job)
        try {
          await wait(retryDelay)
        } catch (waitError) {
          reportInternalError(waitError, { phase: "retry_delay", jobId: job.id, draftId: item.draft_id })
        }
      }
    }
  }

  function finishJob(job: ProductArchivePublishJob) {
    const completedItems = job.items.filter((item) => item.status === "completed")
    const results = completedItems.map((item) => objectValue(item.result))
    job.result = {
      processedDraftCount: completedItems.length,
      failedDraftCount: job.items.filter((item) => item.status === "failed").length,
      publishedCount: results.filter((result) => stringValue(result.resultKind) === "published").length,
      duplicateCount: results.filter((result) => stringValue(result.resultKind) === "duplicate_found").length,
      readbackMismatchCount: results.filter((result) => stringValue(result.resultKind) === "readback_mismatch").length,
      retryAttemptCount: job.items.reduce((sum, item) => sum + Math.max(0, item.attempt_count - 1), 0),
    }
    job.status = "completed"
    job.outcome = job.failed_count === 0
      ? "succeeded"
      : job.completed_count === 0
        ? "failed"
        : "partial_failure"
    job.finished_at = new Date(now()).toISOString()
    persist(job)
  }

  async function processLoop() {
    processScheduled = false
    if (running) return
    running = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()
        if (!job) continue
        try {
          let interrupted = false
          let processedInSlice = 0
          let yielded = false
          job.status = "running"
          job.started_at ??= new Date(now()).toISOString()
          persist(job)
          try {
            for (const item of job.items) {
              if (item.status === "completed" || item.status === "failed") continue
              try {
                await processItem(job, item)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) {
                  interrupted = true
                  throw error
                }
                throw error
              }
              processedInSlice += 1
              try {
                yielded = await maybeYieldProductArchiveJob(job, pending, persist, processedInSlice, "LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_JOB_SLICE_SIZE", 3)
              } catch (error) {
                if (isProductArchiveSyncLeaseError(error)) interrupted = true
                throw error
              }
              if (yielded) break
            }
          } finally {
            if (!yielded && !interrupted) finishJob(job)
          }
        } catch (error) {
          if (isProductArchiveSyncLeaseError(error)) {
            jobs.delete(job.id)
            reportInternalError(error, { phase: "lease_lost", jobId: job.id })
            continue
          }
          throw error
        }
      }
    } finally {
      running = false
    }
  }

  function schedule() {
    if (processScheduled) return
    processScheduled = true
    scheduleProductArchiveBackgroundWorker(() => {
      void processLoop().catch((error) => {
        reportInternalError(error, { phase: "process_loop" })
      })
    })
  }

  function enqueue({
    targets,
    actor,
    ipAddress,
    maxAttempts,
    retryDelayMs,
  }: {
    targets: ProductArchiveDraftBatchTarget[]
    actor: AuditActor | null
    ipAddress: string | null
    maxAttempts?: unknown
    retryDelayMs?: unknown
  }) {
    if (targets.length === 0) throw new Error("请先选择需要发布的草稿")
    const nowText = new Date(now()).toISOString()
    const attempts = clampPublishAttempts(maxAttempts ?? process.env.LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_MAX_ATTEMPTS)
    const delayMs = clampPublishRetryDelayMs(retryDelayMs ?? process.env.LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_RETRY_DELAY_MS)
    const job: ProductArchivePublishJob = {
      id: randomUUID(),
      source: "publish",
      status: "queued",
      outcome: null,
      total_count: targets.length,
      completed_count: 0,
      failed_count: 0,
      created_at: nowText,
      started_at: null,
      finished_at: null,
      options: { actor, ipAddress, retryDelayMs: delayMs },
      items: targets.map((target) => ({
        draft_id: target.draftId,
        spu_code: target.spuCode,
        status: "queued",
        attempt_count: 0,
        max_attempts: attempts,
        next_retry_at: null,
        started_at: null,
        finished_at: null,
        result: null,
        error: null,
      })),
      result: null,
    }
    jobs.set(job.id, job)
    pending.push(job)
    persist(job)
    schedule()
    return cloneProductArchivePublishJob(job)
  }

  function resume() {
    const recovered = (store.recover() as ProductArchivePublishJob[])
      .filter((job) => job?.source === "publish")
    for (const storedJob of recovered) {
      const job = storedJob
      job.status = "queued"
      job.started_at = null
      job.finished_at = null
      for (const item of job.items) {
        if (item.status === "running" || item.status === "retrying") {
          item.status = "queued"
          item.started_at = null
          item.finished_at = null
          item.next_retry_at = null
        }
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length
      job.failed_count = job.items.filter((item) => item.status === "failed").length
      jobs.set(job.id, job)
      pending.push(job)
      persist(job)
    }
    if (pending.length > 0) schedule()
  }

  return {
    enqueue,
    getJob,
    resume,
  }
}

function cloneHangtagWashlabelOcrJob(job: HangtagWashlabelOcrJob) {
  const currentItem = job.items.find((item) => item.status === "running") ?? null
  return {
    ...job,
    files: job.files.map((file) => ({ ...file })),
    options: {
      ...job.options,
      actor: job.options.actor ? { ...job.options.actor } : null,
    },
    items: job.items.map((item) => ({ ...item, result: item.result ? { ...item.result } : null })),
    current_item: currentItem ? { ...currentItem } : null,
    failed_items: job.items.filter((item) => item.status === "failed").map((item) => ({ ...item })),
    queued_count: job.items.filter((item) => item.status === "queued").length,
    running_count: job.items.filter((item) => item.status === "running").length,
  }
}

function ocrJobItemLabel(file: HangtagWashlabelOcrUploadFile, index: number, total: number) {
  const baseName = path.basename(file.fileName || file.filePath || `文件${index + 1}`)
  return `${index + 1}/${total} ${baseName}`.slice(0, 140)
}

function documentsFromOcrJobItems(items: HangtagWashlabelOcrJobItem[]) {
  const documents = []
  for (const item of items) {
    const document = item.result?.document
    if (document && typeof document === "object") documents.push(document)
    const itemDocuments = item.result?.documents
    if (Array.isArray(itemDocuments)) {
      documents.push(...itemDocuments.filter((value) => value && typeof value === "object"))
    }
  }
  return documents
}

async function importReferenceImageJobFile(file: HangtagWashlabelOcrUploadFile, actorId: number | null) {
  const spuCode = extractProductArchiveImageSpuCode(file.fileName)
  if (!spuCode) {
    return {
      fileName: file.fileName,
      status: "skipped",
      reason: "文件名或目录名未识别到款号",
    }
  }
  const db = getDb()
  const draft = latestProductArchiveDraftForSpuCode(db, spuCode)
  if (!draft) {
    return {
      fileName: file.fileName,
      spuCode,
      status: "skipped",
      reason: "未找到对应建档草稿",
    }
  }
  const buffer = await readFile(file.filePath)
  const image = await saveDraftImageUpload({
    db,
    draft,
    file: {
      buffer,
      fileName: path.basename(file.fileName),
      originalFileName: file.fileName,
      mimeType: file.mimeType,
      size: buffer.length,
      width: Number(file.width ?? 0),
      height: Number(file.height ?? 0),
      extension: stringValue(file.extension) || path.extname(file.fileName).toLowerCase(),
      hasModelShot: file.hasModelShot,
      assetKind: file.assetKind,
    },
    sourceType: "crawshrimp_asset_package",
    sourceRef: file.fileName,
    uploadedBy: actorId,
  })
  return {
    fileName: file.fileName,
    spuCode,
    draftId: Number(draft.id),
    status: image ? "imported" : "skipped",
    image,
  }
}

async function importOcrAssetJobFile(
  file: HangtagWashlabelOcrUploadFile,
  actorId: number | null,
  detectedSpuCode?: string | null,
) {
  const spuCode = stringValue(detectedSpuCode) || extractProductArchiveImageSpuCode(file.fileName)
  const assetKind = ocrAssetKind(file.assetKind)
  if (!spuCode) {
    return {
      fileName: file.fileName,
      assetKind,
      status: "skipped",
      reason: "文件名和 OCR 结果未识别到款号",
    }
  }
  const db = getDb()
  const draft = latestProductArchiveDraftForSpuCode(db, spuCode)
  if (!draft) {
    return {
      fileName: file.fileName,
      assetKind,
      spuCode,
      status: "skipped",
      reason: "未找到对应建档草稿",
    }
  }
  const buffer = await readFile(file.filePath)
  const detected = detectProductArchiveOcrUploadType(buffer)
  const dimensions = detected.contentType === "application/pdf" ? null : readImageDimensions(buffer)
  const image = await saveDraftAssetUpload({
    db,
    draft,
    file: {
      buffer,
      fileName: path.basename(file.fileName),
      originalFileName: file.fileName,
      mimeType: detected.contentType,
      size: buffer.length,
      extension: detected.extension,
      assetKind,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    },
    sourceRef: file.fileName,
    uploadedBy: actorId,
  })
  return {
    fileName: file.fileName,
    assetKind,
    spuCode,
    draftId: Number(draft.id),
    status: image ? "imported" : "skipped",
    image,
  }
}

function createHangtagWashlabelOcrQueue({
  store,
  onInternalError = (error: unknown) => console.error("Hangtag washlabel OCR queue internal error", error),
  now = () => Date.now(),
}: {
  store: ReturnType<typeof createPostgresProductArchiveSyncJobStore>
  onInternalError?: (error: unknown, context?: Record<string, unknown>) => void
  now?: () => number
}) {
  const jobs = new Map<string, HangtagWashlabelOcrJob>()
  const pending: HangtagWashlabelOcrJob[] = []
  let running = false
  let processScheduled = false

  function reportInternalError(error: unknown, context: Record<string, unknown>) {
    try {
      onInternalError(error, context)
    } catch {
      // Error reporting must never stop the OCR worker.
    }
  }

  function persist(job: HangtagWashlabelOcrJob) {
    try {
      if (store.save(cloneHangtagWashlabelOcrJob(job)) === false) {
        throw new ProductArchiveSyncLeaseError()
      }
    } catch (error) {
      reportInternalError(error, { phase: "persist", jobId: job.id })
      if (store.requiresLease) {
        jobs.delete(job.id)
        throw error
      }
    }
  }

  function getJob(id: string) {
    const job = jobs.get(id)
    if (job) return cloneHangtagWashlabelOcrJob(job)
    const stored = store.get(id) as HangtagWashlabelOcrJob | null
    return stored ? cloneHangtagWashlabelOcrJob(stored) : null
  }

  function setItemFinished(job: HangtagWashlabelOcrJob, item: HangtagWashlabelOcrJobItem, status: "completed" | "failed", result: Record<string, unknown> | null, error: string | null) {
    item.status = status
    item.result = result
    item.error = error
    item.finished_at = new Date(now()).toISOString()
    if (status === "completed") job.completed_count += 1
    if (status === "failed") job.failed_count += 1
    persist(job)
  }

  async function processFileItem(job: HangtagWashlabelOcrJob, file: HangtagWashlabelOcrUploadFile, item: HangtagWashlabelOcrJobItem) {
    item.status = "running"
    item.started_at ??= new Date(now()).toISOString()
    persist(job)
    if (file.kind === "scm_supplement") {
      const supplement = await readScmHangtagWashlabelSupplementWorkbook(file.filePath, {
        fileName: file.fileName,
      })
      setItemFinished(job, item, "completed", {
        fileName: supplement.fileName,
        sheetCount: supplement.sheetCount,
        documentCount: supplement.documentCount,
        documents: supplement.documents,
      }, null)
      return
    }
    if (file.kind === "reference_image") {
      const imported = await importReferenceImageJobFile(file, job.options.actor?.id ?? null)
      setItemFinished(job, item, "completed", {
        ...imported,
        importedImageCount: imported.status === "imported" ? 1 : 0,
      }, null)
      return
    }

    const [document] = await recognizeProductArchiveOcrFiles([{
      filePath: file.filePath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
    }], {
      aiRouterFactory: () => getDefaultAiScenarioRouter({
        db: getDb(),
        fetchImpl: fetch,
      }),
    })
    let assetImport: Record<string, unknown> | null = null
    if (file.kind === "ocr_asset") {
      try {
        assetImport = await importOcrAssetJobFile(
          file,
          job.options.actor?.id ?? null,
          document?.detectedSpuCode ?? null,
        )
      } catch (error) {
        assetImport = {
          fileName: file.fileName,
          assetKind: ocrAssetKind(file.assetKind),
          status: "failed",
          error: errorMessage(error),
        }
        reportInternalError(error, { phase: "import_ocr_asset", jobId: job.id, fileName: file.fileName })
      }
    }
    const result = {
      fileName: document?.fileName ?? file.fileName,
      detectedSpuCode: document?.detectedSpuCode ?? null,
      status: document?.status ?? "ocr_failed",
      extractedFieldCount: Array.isArray(document?.fields) ? document.fields.length : 0,
      document,
      assetImport,
      importedImageCount: assetImport?.status === "imported" ? 1 : 0,
      draftId: assetImport?.draftId ?? null,
    }
    if (document?.status === "ocr_failed") {
      setItemFinished(job, item, "failed", result, stringValue(document.error) || "OCR 识别失败")
      return
    }
    setItemFinished(job, item, "completed", result, null)
  }

  async function applyRecognizedDocuments(job: HangtagWashlabelOcrJob, item: HangtagWashlabelOcrJobItem) {
    item.status = "running"
    item.started_at ??= new Date(now()).toISOString()
    persist(job)
    const documents = documentsFromOcrJobItems(job.items)
    const db = getDb()
    const preview = previewProductArchiveHangtagWashlabelOcr(db, {
      documents,
      overwriteExisting: job.options.overwriteExisting,
    })
    const apply = applyProductArchiveHangtagWashlabelOcr(db, {
      documents,
      overwriteExisting: job.options.overwriteExisting,
    })
    const supplementFiles = job.items
      .map((ocrItem) => ocrItem.result)
      .filter((result) => result && Number(result.documentCount) > 0)
      .map((result) => ({
        fileName: stringValue(result?.fileName),
        sheetCount: Number(result?.sheetCount ?? 0),
        documentCount: Number(result?.documentCount ?? 0),
      }))
    const importedImageCount = job.items.reduce((sum, ocrItem) => sum + (Number(ocrItem.result?.importedImageCount) || 0), 0)
    const imageMatchedDraftIds = new Set(job.items
      .map((ocrItem) => Number(ocrItem.result?.draftId))
      .filter((draftId) => Number.isInteger(draftId) && draftId > 0))
    const result = {
      previewSummary: preview.summary,
      applySummary: apply.summary,
      imageImportSummary: {
        importedCount: importedImageCount,
        matchedDraftCount: imageMatchedDraftIds.size,
      },
      overwriteExisting: job.options.overwriteExisting,
      provider: getProductArchiveOcrRuntimeInfo(documents),
      scmSupplement: { files: supplementFiles },
      validations: apply.validations,
    }
    job.result = result
    setItemFinished(job, item, "completed", result, null)
    try {
      writeOperationLog(db, {
        action: "draft.hangtag_washlabel_ocr.background_applied",
        module: "PRODUCT_ARCHIVE_DRAFT",
        entityType: "product_archive_draft_batch",
        entityId: job.id,
        summary: `后台写入吊牌/洗唛 OCR 字段 ${apply.summary.appliedFieldCount} 个，关联附件 ${importedImageCount} 个`,
        metadata: {
          fileCount: preview.summary.fileCount,
          matchedCount: preview.summary.matchedCount,
          appliedDraftCount: apply.summary.appliedDraftCount,
          appliedFieldCount: apply.summary.appliedFieldCount,
          importedImageCount,
          skippedCount: apply.summary.skippedCount,
          overwriteExisting: job.options.overwriteExisting,
        },
      }, job.options.actor, job.options.ipAddress ?? undefined)
    } catch (error) {
      reportInternalError(error, { phase: "completion_audit", jobId: job.id })
    }
  }

  async function processLoop() {
    processScheduled = false
    if (running) return
    running = true
    try {
      while (pending.length > 0) {
        const job = pending.shift()
        if (!job) continue
        try {
          let processedInSlice = 0
          job.status = "running"
          job.started_at ??= new Date(now()).toISOString()
          persist(job)
          for (let index = 0; index < job.files.length; index += 1) {
            const item = job.items[index]
            if (!item || item.status === "completed" || item.status === "failed") continue
            try {
              await withBackgroundTaskSlot("product_archive_ocr", () => processFileItem(job, job.files[index], item))
            } catch (error) {
              if (isProductArchiveSyncLeaseError(error)) throw error
              setItemFinished(job, item, "failed", {
                fileName: job.files[index].fileName,
              }, errorMessage(error))
            }
            processedInSlice += 1
            if (await maybeYieldProductArchiveJob(job, pending, persist, processedInSlice, "LISTINGIFY_PRODUCT_ARCHIVE_OCR_JOB_SLICE_SIZE", 3)) break
          }
          if (job.status === "queued") continue

          const applyItem = job.items[job.items.length - 1]
          if (applyItem && applyItem.status !== "completed" && applyItem.status !== "failed") {
            try {
              await withBackgroundTaskSlot("product_archive_ocr", () => applyRecognizedDocuments(job, applyItem))
            } catch (error) {
              if (isProductArchiveSyncLeaseError(error)) throw error
              setItemFinished(job, applyItem, "failed", null, errorMessage(error))
              job.result = {
                error: errorMessage(error),
                previewSummary: previewProductArchiveHangtagWashlabelOcr(getDb(), {
                  documents: documentsFromOcrJobItems(job.items),
                  overwriteExisting: job.options.overwriteExisting,
                }).summary,
              }
            }
          }

          job.status = "completed"
          job.outcome = job.failed_count === 0
            ? "succeeded"
            : job.completed_count === 0
              ? "failed"
              : "partial_failure"
          job.finished_at = new Date(now()).toISOString()
          persist(job)
          try {
            await rm(job.options.uploadDir, { recursive: true, force: true })
          } catch (error) {
            reportInternalError(error, { phase: "cleanup", jobId: job.id })
          }
        } catch (error) {
          if (isProductArchiveSyncLeaseError(error)) {
            jobs.delete(job.id)
            reportInternalError(error, { phase: "lease_lost", jobId: job.id })
            continue
          }
          throw error
        }
      }
    } finally {
      running = false
    }
  }

  function schedule() {
    if (processScheduled) return
    processScheduled = true
    scheduleProductArchiveBackgroundWorker(() => {
      void processLoop().catch((error) => {
        reportInternalError(error, { phase: "process_loop" })
      })
    })
  }

  function enqueue({
    files,
    supplementFiles,
    referenceImageFiles,
    overwriteExisting,
    actor,
    ipAddress,
    uploadDir,
  }: {
    files: HangtagWashlabelOcrUploadFile[]
    supplementFiles: HangtagWashlabelOcrUploadFile[]
    referenceImageFiles: HangtagWashlabelOcrUploadFile[]
    overwriteExisting: boolean
    actor: AuditActor | null
    ipAddress: string | null
    uploadDir: string
  }) {
    const allFiles = [
      ...files.map((file) => ({ ...file, kind: "ocr_asset" as const })),
      ...supplementFiles.map((file) => ({ ...file, kind: "scm_supplement" as const })),
      ...referenceImageFiles.map((file) => ({ ...file, kind: "reference_image" as const })),
    ]
    const nowText = new Date(now()).toISOString()
    const total = allFiles.length
    const job: HangtagWashlabelOcrJob = {
      id: randomUUID(),
      source: "hangtag_washlabel_ocr",
      status: "queued",
      outcome: null,
      total_count: total + 1,
      completed_count: 0,
      failed_count: 0,
      created_at: nowText,
      started_at: null,
      finished_at: null,
      files: allFiles,
      options: {
        overwriteExisting,
        uploadDir,
        actor,
        ipAddress,
      },
      items: [
        ...allFiles.map((file, index) => ({
          spu_code: ocrJobItemLabel(file, index, total),
          status: "queued" as const,
          phase: file.kind === "reference_image" ? "import_image" as const : "recognize" as const,
          started_at: null,
          finished_at: null,
          result: null,
          error: null,
        })),
        {
          spu_code: "写入草稿并校验",
          status: "queued",
          phase: "apply",
          started_at: null,
          finished_at: null,
          result: null,
          error: null,
        },
      ],
      result: null,
    }
    jobs.set(job.id, job)
    pending.push(job)
    persist(job)
    schedule()
    return cloneHangtagWashlabelOcrJob(job)
  }

  function resume() {
    const recovered = (store.recover() as HangtagWashlabelOcrJob[])
      .filter((job) => job?.source === "hangtag_washlabel_ocr")
    for (const storedJob of recovered) {
      const job = storedJob
      job.status = "queued"
      job.started_at = null
      job.finished_at = null
      for (const item of job.items) {
        if (item.status === "running") {
          item.status = "queued"
          item.started_at = null
          item.finished_at = null
          item.error = null
        }
      }
      job.completed_count = job.items.filter((item) => item.status === "completed").length
      job.failed_count = job.items.filter((item) => item.status === "failed").length
      jobs.set(job.id, job)
      pending.push(job)
      persist(job)
    }
    if (pending.length > 0) schedule()
  }

  return {
    enqueue,
    getJob,
    resume,
  }
}

const hangtagWashlabelOcrQueue = createHangtagWashlabelOcrQueue({
  store: createPostgresProductArchiveSyncJobStore({
    getDb,
    queueName: "product_archive_hangtag_washlabel_ocr",
  }),
})

const productArchiveAiFillQueue = createProductArchiveAiFillQueue({
  store: createPostgresProductArchiveSyncJobStore({
    getDb,
    queueName: "product_archive_ai_fill",
  }),
})

const productArchivePrecheckQueue = createProductArchivePrecheckQueue({
  store: createPostgresProductArchiveSyncJobStore({
    getDb,
    queueName: "product_archive_publish_precheck",
  }),
})

const productArchivePublishQueue = createProductArchivePublishQueue({
  store: createPostgresProductArchiveSyncJobStore({
    getDb,
    queueName: "product_archive_publish",
  }),
})

export function resumeProductArchiveDraftQueue() {
  draftQueue.resume()
  hangtagWashlabelOcrQueue.resume()
  productArchiveAiFillQueue.resume()
  productArchivePrecheckQueue.resume()
  productArchivePublishQueue.resume()
}

type RequeueProductArchiveTaskType =
  | "product_archive_mdm_draft"
  | "product_archive_hangtag_washlabel_ocr"
  | "product_archive_ai_fill"
  | "product_archive_publish_precheck"
  | "product_archive_publish"

function requeueableItems<T extends { status?: string | null }>(items: T[] | undefined | null) {
  return (items ?? []).filter((item) => stringValue(item.status) !== "completed")
}

function requeueTargets(items: Array<{ draft_id?: number | null; spu_code?: string | null; status?: string | null }>) {
  return requeueableItems(items).flatMap((item) => {
    const draftId = Number(item.draft_id)
    const spuCode = stringValue(item.spu_code)
    if (!Number.isFinite(draftId) || draftId <= 0 || !spuCode) return []
    return [{ draftId, spuCode, title: null, status: "draft" }]
  })
}

function assertRequeueableCount(count: number) {
  if (count <= 0) throw new HTTPException(409, { message: "这个任务没有可重新加入队列的未完成项目" })
}

function readCompletedProductArchiveTask<T>(queueName: string, jobId: string) {
  const db = getDb()
  return db.transaction(() => {
    const row = db.prepare(`
      select status, payload_json
      from product_archive_sync_job
      where id = ?
        and queue_name = ?
      for update
    `).get(jobId, queueName) as { status?: unknown; payload_json?: unknown } | undefined
    if (!row) return null
    if (stringValue(row.status) !== "completed") {
      throw new HTTPException(409, { message: "任务仍在执行中，请先停止或等待任务完成后再重新加入队列" })
    }
    let payload = row.payload_json
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload)
      } catch {
        throw new HTTPException(409, { message: "任务快照损坏，无法安全地重新加入队列" })
      }
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new HTTPException(409, { message: "任务快照损坏，无法安全地重新加入队列" })
    }
    return payload as T
  })()
}

export function requeueProductArchiveDraftAsyncTask(input: {
  taskType: RequeueProductArchiveTaskType
  jobId: string
  actor: AuditActor | null
  ipAddress: string | null
}) {
  if (input.taskType === "product_archive_mdm_draft") {
    const original = readCompletedProductArchiveTask<NonNullable<ReturnType<typeof draftQueue.getJob>>>(
      "product_archive_drafts",
      input.jobId,
    )
    if (!original) throw new HTTPException(404, { message: "MDM 同步建档任务不存在" })
    const codes = requeueableItems(original.items).map((item) => item.spu_code).filter(Boolean)
    assertRequeueableCount(codes.length)
    return draftQueue.enqueue({
      source: original.source,
      rawCodes: codes,
      intervalMs: original.interval_ms,
      options: {
        ...original.options,
        retryOfJobId: original.id,
      },
    })
  }

  if (input.taskType === "product_archive_ai_fill") {
    const original = readCompletedProductArchiveTask<NonNullable<ReturnType<typeof productArchiveAiFillQueue.getJob>>>(
      "product_archive_ai_fill",
      input.jobId,
    )
    if (!original) throw new HTTPException(404, { message: "批量 AI 填充任务不存在" })
    const targets = requeueTargets(original.items)
    assertRequeueableCount(targets.length)
    return productArchiveAiFillQueue.enqueue({
      targets,
      actor: input.actor,
      ipAddress: input.ipAddress,
    })
  }

  if (input.taskType === "product_archive_publish_precheck") {
    const original = readCompletedProductArchiveTask<NonNullable<ReturnType<typeof productArchivePrecheckQueue.getJob>>>(
      "product_archive_publish_precheck",
      input.jobId,
    )
    if (!original) throw new HTTPException(404, { message: "批量发布预检任务不存在" })
    const targets = requeueTargets(original.items)
    assertRequeueableCount(targets.length)
    return productArchivePrecheckQueue.enqueue({
      targets,
      maxAttempts: original.items[0]?.max_attempts,
      retryDelayMs: original.options.retryDelayMs,
      actor: input.actor,
      ipAddress: input.ipAddress,
    })
  }

  if (input.taskType === "product_archive_publish") {
    const original = readCompletedProductArchiveTask<NonNullable<ReturnType<typeof productArchivePublishQueue.getJob>>>(
      "product_archive_publish",
      input.jobId,
    )
    if (!original) throw new HTTPException(404, { message: "批量发布任务不存在" })
    const targets = requeueTargets(original.items)
    assertRequeueableCount(targets.length)
    return productArchivePublishQueue.enqueue({
      targets,
      maxAttempts: original.items[0]?.max_attempts,
      retryDelayMs: original.options.retryDelayMs,
      actor: input.actor,
      ipAddress: input.ipAddress,
    })
  }

  const original = readCompletedProductArchiveTask<NonNullable<ReturnType<typeof hangtagWashlabelOcrQueue.getJob>>>(
    "product_archive_hangtag_washlabel_ocr",
    input.jobId,
  )
  if (!original) throw new HTTPException(404, { message: "吊牌/洗唛 OCR 任务不存在" })
  const rerunApply = requeueableItems(original.items).some((item) => item.phase === "apply")
  const files = original.files.filter((file, index) => (
    rerunApply || stringValue(original.items[index]?.status) !== "completed"
  ))
  const existingFiles = files.filter((file) => existsSync(file.filePath))
  if (files.length !== existingFiles.length) {
    throw new HTTPException(409, { message: "原始上传文件已清理，无法自动重新加入 OCR 队列，请重新上传附件" })
  }
  assertRequeueableCount(existingFiles.length)
  return hangtagWashlabelOcrQueue.enqueue({
    files: existingFiles.filter((file) => file.kind === "ocr_asset"),
    supplementFiles: existingFiles.filter((file) => file.kind === "scm_supplement"),
    referenceImageFiles: existingFiles.filter((file) => file.kind === "reference_image"),
    overwriteExisting: original.options.overwriteExisting,
    actor: input.actor,
    ipAddress: input.ipAddress,
    uploadDir: original.options.uploadDir,
  })
}

function readId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new HTTPException(400, { message: "无效的草稿 ID" })
  }
  return id
}

async function readJson(c: Context) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

function isProductArchiveDraftMutationConflictMessage(message: string) {
  return /PRODUCT_ARCHIVE_SUBMIT_IN_PROGRESS|草稿提交权已失效|正在提交的草稿不能删除|草稿数据已更新，请刷新后重试|推荐结果已更新，请刷新后重新确认|图片已更新，请刷新后重试/.test(message)
}

function productArchiveDraftMutationException(error: unknown) {
  if (error instanceof HTTPException) return error
  const message = error instanceof Error ? error.message : String(error)
  if (message === "草稿数据已更新，请刷新后重试") {
    return new HTTPException(409, { message })
  }
  if (isProductArchiveDraftMutationConflictMessage(message)) {
    return new HTTPException(409, { message })
  }
  return error
}

function submitOperationException(error: unknown, prefix: string) {
  if (error instanceof HTTPException) return error
  const message = error instanceof Error ? error.message : String(error)
  if (isProductArchiveDraftMutationConflictMessage(message)) {
    return new HTTPException(409, { message })
  }
  const status = /草稿存在阻断|请选择|本地未找到|不存在|缺少|无效/.test(message) ? 400 : 502
  return new HTTPException(status, { message: `${prefix}：${message || "未知错误"}` })
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function nowIso() {
  return new Date().toISOString()
}

function booleanFormValue(value: unknown) {
  const text = stringValue(value).toLowerCase()
  return ["1", "true", "yes", "y", "是"].includes(text)
}

function booleanInputValue(value: unknown) {
  if (typeof value === "boolean") return value
  return booleanFormValue(value)
}

function safeUploadName(fileName: string) {
  return safeUploadFileName(fileName, { fallbackName: "upload.xlsx" })
}

function safeOcrUploadName(fileName: string) {
  return safeUploadFileName(fileName, { fallbackName: "ocr-document.pdf" })
}

function safeScmSupplementUploadName(fileName: string) {
  return safeUploadFileName(fileName, { fallbackName: "scm-wash-hangtag-result.xlsx" })
}

function safeDraftImageUploadName(fileName: string, extension: string) {
  return safeUploadFileName(fileName, { fallbackName: "spu-reference-image.jpg", extension })
}

function safeDraftAssetUploadName(fileName: string, extension: string) {
  return safeUploadFileName(fileName, { fallbackName: "draft-asset.pdf", extension })
}

function cleanUploadDisplayName(value: unknown, fallback: string) {
  const raw = stringValue(value) || fallback
  const parts = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
  return (parts.length ? parts.join("/") : fallback).slice(0, 500)
}

function uploadDisplayExtension(value: string) {
  return path.extname(value).toLowerCase()
}

function isProductArchiveOcrAssetName(value: string) {
  return [".pdf", ".jpg", ".jpeg", ".png"].includes(uploadDisplayExtension(value))
}

function isScmSupplementWorkbookName(value: string) {
  return [".xlsx", ".xlsm"].includes(uploadDisplayExtension(value))
}

function isProductArchiveReferenceImageName(value: string) {
  return [".jpg", ".jpeg", ".png", ".webp"].includes(uploadDisplayExtension(value))
}

function draftImageAssetKind(fileName: string) {
  return productArchiveImageHasModelShot(fileName) ? "model_image" : "flat_image"
}

function ocrAssetKind(value: unknown): "hangtag" | "washlabel" {
  return value === "washlabel" ? "washlabel" : "hangtag"
}

function productArchiveDraftImageSourceType(value: unknown) {
  return stringValue(value) === "crawshrimp_asset_package" ? "crawshrimp_asset_package" : "batch_upload"
}

function imageFileVariant(value: unknown) {
  const variant = stringValue(value)
  if (variant === "thumbnail" || variant === "thumb") return "thumbnail"
  if (variant === "preview" || variant === "large") return "preview"
  return "original"
}

function isIgnorableOcrFolderEntry(value: string) {
  const baseName = path.basename(value)
  return baseName === ".DS_Store" || baseName.startsWith("~$")
}

async function readDraftImageUploadFiles(c: Context) {
  const form = await c.req.formData()
  const displayNames = form.getAll("filePaths").map(stringValue)
  const sourceType = productArchiveDraftImageSourceType(form.get("sourceType") ?? form.get("source_type"))
  const rawFiles = [
    ...form.getAll("files"),
    ...form.getAll("file"),
    ...form.getAll("images"),
  ].filter((value): value is File => value instanceof File && value.size > 0)
  const maxFileCount = Math.max(1, Math.min(Number(process.env.LISTINGIFY_MAX_PRODUCT_ARCHIVE_IMAGE_FILES ?? 160) || 160, 300))
  if (rawFiles.length === 0) {
    throw new HTTPException(400, { message: "请上传 SPU 参考图片" })
  }
  if (rawFiles.length > maxFileCount) {
    throw new HTTPException(400, { message: `单次最多导入 ${maxFileCount} 张 SPU 参考图片` })
  }
  assertAggregateUploadBytes(
    rawFiles,
    MAX_PRODUCT_ARCHIVE_IMAGE_BATCH_BYTES,
    "SPU 参考图片批次总大小超过限制",
  )
  const files: DraftImageUploadFile[] = []
  let skippedCount = 0
  for (let index = 0; index < rawFiles.length; index += 1) {
    const file = rawFiles[index]
    const originalFileName = cleanUploadDisplayName(displayNames[index], file.name)
    if (isIgnorableOcrFolderEntry(originalFileName)) {
      skippedCount += 1
      continue
    }
    if (!isProductArchiveReferenceImageName(originalFileName)) {
      skippedCount += 1
      continue
    }
    const buffer = await readValidatedUploadBuffer(file, "image")
    const detected = detectImageUploadType(buffer)
    const dimensions = readImageDimensions(buffer)
    files.push({
      buffer,
      fileName: path.basename(originalFileName),
      originalFileName,
      mimeType: detected.contentType,
      size: buffer.length,
      width: dimensions.width,
      height: dimensions.height,
      extension: detected.extension,
      hasModelShot: productArchiveImageHasModelShot(originalFileName),
      assetKind: sourceType === "crawshrimp_asset_package" ? draftImageAssetKind(originalFileName) : undefined,
    })
  }
  if (files.length === 0) {
    throw new HTTPException(400, { message: skippedCount > 0 ? "没有可导入的 JPG、PNG、WEBP 图片" : "请上传 SPU 参考图片" })
  }
  return { files, skippedCount, sourceType }
}

async function saveDraftImageUpload(input: {
  db: ReturnType<typeof getDb>
  draft: Record<string, unknown>
  file: DraftImageUploadFile
  sourceType: "manual_upload" | "batch_upload" | "crawshrimp_asset_package"
  sourceRef: string
  uploadedBy: number | null
}) {
  const draftId = Number(input.draft.id)
  const spuCode = stringValue(input.draft.spu_code)
  const imageDir = path.join(DRAFT_IMAGE_DIR, String(draftId))
  await mkdir(imageDir, { recursive: true })
  const fileName = safeDraftImageUploadName(input.file.fileName, input.file.extension)
  const localPath = path.join(imageDir, `${randomUUID()}-${fileName}`)
  try {
    await writeFile(localPath, input.file.buffer, { flag: "wx" })
    return createProductArchiveDraftImage(input.db, {
      draftId,
      spuCode,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      localPath,
      fileName,
      originalFileName: input.file.originalFileName,
      mimeType: input.file.mimeType,
      fileSize: input.file.size,
      width: input.file.width,
      height: input.file.height,
      uploadedBy: input.uploadedBy,
      rawPayload: {
        original_file_name: input.file.originalFileName,
        source_ref: input.sourceRef,
        width: input.file.width,
        height: input.file.height,
        file_size: input.file.size,
        mime_type: input.file.mimeType,
        has_model_shot: input.file.hasModelShot === true,
        asset_kind: input.file.assetKind || null,
        asset_package: input.sourceType === "crawshrimp_asset_package",
      },
    })
  } catch (error) {
    await rm(localPath, { force: true })
    throw error
  }
}

async function saveDraftAssetUpload(input: {
  db: ReturnType<typeof getDb>
  draft: Record<string, unknown>
  file: DraftAssetUploadFile
  sourceRef: string
  uploadedBy: number | null
}) {
  const draftId = Number(input.draft.id)
  const spuCode = stringValue(input.draft.spu_code)
  const assetDir = path.join(DRAFT_IMAGE_DIR, String(draftId))
  await mkdir(assetDir, { recursive: true })
  const fileName = safeDraftAssetUploadName(input.file.fileName, input.file.extension)
  const localPath = path.join(assetDir, `${randomUUID()}-${fileName}`)
  try {
    await writeFile(localPath, input.file.buffer, { flag: "wx" })
    return createProductArchiveDraftImage(input.db, {
      draftId,
      spuCode,
      sourceType: "crawshrimp_asset_package",
      sourceRef: input.sourceRef,
      localPath,
      fileName,
      originalFileName: input.file.originalFileName,
      mimeType: input.file.mimeType,
      fileSize: input.file.size,
      width: input.file.width ?? null,
      height: input.file.height ?? null,
      uploadedBy: input.uploadedBy,
      rawPayload: {
        original_file_name: input.file.originalFileName,
        source_ref: input.sourceRef,
        width: input.file.width ?? null,
        height: input.file.height ?? null,
        file_size: input.file.size,
        mime_type: input.file.mimeType,
        asset_kind: input.file.assetKind,
        asset_package: true,
        ocr_asset: true,
      },
    })
  } catch (error) {
    await rm(localPath, { force: true })
    throw error
  }
}

async function repairLegacyDraftImageLocalPath(db: ReturnType<typeof getDb>, image: Record<string, unknown>) {
  if (stringValue(image.source_type) !== "crawshrimp_asset_package") return null
  const imageId = Number(image.id)
  const draftId = Number(image.draft_id)
  const sourcePath = stringValue(image.local_path)
  if (!Number.isInteger(imageId) || imageId <= 0 || !Number.isInteger(draftId) || draftId <= 0 || !sourcePath) return null
  const sourceStat = await stat(sourcePath).catch(() => null)
  if (!sourceStat?.isFile()) return null
  if (sourceStat.size > maxUploadBytes("image")) {
    throw new HTTPException(413, { message: "图片文件过大，请重新导入图片" })
  }
  const buffer = await readFile(sourcePath)
  const detected = detectImageUploadType(buffer)
  const dimensions = readImageDimensions(buffer)
  const imageDir = path.join(DRAFT_IMAGE_DIR, String(draftId))
  await mkdir(imageDir, { recursive: true })
  const fileName = safeDraftImageUploadName(stringValue(image.file_name) || path.basename(sourcePath), detected.extension)
  const localPath = path.join(imageDir, `${randomUUID()}-${fileName}`)
  try {
    await writeFile(localPath, buffer, { flag: "wx" })
    const validated = await assertLocalImageFile({ rootDir: DRAFT_IMAGE_DIR, filePath: localPath })
    db.transaction(() => {
      assertProductArchiveDraftMutable(db, draftId)
      const current = db.prepare(`
        select id, draft_id, source_type, local_path
        from product_archive_draft_image
        where id = ?
          and draft_id = ?
          and source_type = 'crawshrimp_asset_package'
        for update
      `).get(imageId, draftId) as Record<string, unknown> | undefined
      if (
        !current
        || stringValue(current.source_type) !== "crawshrimp_asset_package"
        || stringValue(current.local_path) !== sourcePath
      ) {
        throw new Error("图片已更新，请刷新后重试")
      }
      const update = db.prepare(`
        update product_archive_draft_image
        set local_path = ?,
          file_name = ?,
          mime_type = ?,
          file_size = ?,
          width = ?,
          height = ?,
          updated_at = ?::timestamptz
        where id = ?
          and draft_id = ?
          and source_type = 'crawshrimp_asset_package'
          and local_path = ?
      `).run(
        localPath,
        fileName,
        detected.contentType,
        buffer.length,
        dimensions.width,
        dimensions.height,
        nowIso(),
        imageId,
        draftId,
        sourcePath,
      )
      if (Number(update?.changes ?? 0) === 0) {
        throw new Error("图片已更新，请刷新后重试")
      }
    })()
    return validated
  } catch (error) {
    await rm(localPath, { force: true })
    throw error
  }
}

type LocalDraftImageReferenceDb = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[]
  }
}

type DraftImageFileRemover = (paths: Iterable<unknown>, rootDir?: string) => void | Promise<void>

function controlledDraftImagePaths(paths: Iterable<unknown>, rootDir: string) {
  const resolvedRoot = path.resolve(rootDir)
  return Array.from(new Set(Array.from(paths)
    .map(stringValue)
    .filter(Boolean)
    .map((localPath) => path.resolve(localPath))
    .filter((localPath) => {
      const relative = path.relative(resolvedRoot, localPath)
      return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
    })))
}

export function unreferencedDraftImagePaths(
  db: LocalDraftImageReferenceDb,
  paths: Iterable<unknown>,
  rootDir = DRAFT_IMAGE_DIR,
) {
  const candidates = controlledDraftImagePaths(paths, rootDir)
  if (candidates.length === 0) return []
  const rows = db.prepare(`
    select distinct local_path
    from product_archive_draft_image
    where local_path in (${candidates.map(() => "?").join(",")})
  `).all(...candidates) as Array<Record<string, unknown>>
  const referenced = new Set(rows
    .map((row) => stringValue(row.local_path))
    .filter(Boolean)
    .map((localPath) => path.resolve(localPath)))
  return candidates.filter((localPath) => !referenced.has(localPath))
}

async function removeDraftImageFiles(paths: Iterable<unknown>) {
  for (const value of paths) {
    const localPath = stringValue(value)
    if (localPath) await rm(localPath, { force: true })
  }
}

export async function cleanupUnreferencedDraftImageFiles(
  db: LocalDraftImageReferenceDb,
  paths: Iterable<unknown>,
  rootDir = DRAFT_IMAGE_DIR,
  removeFile: DraftImageFileRemover = removeDraftImageFiles,
) {
  let candidates: string[]
  try {
    candidates = unreferencedDraftImagePaths(db, paths, rootDir)
  } catch (error) {
    return {
      cleaned_paths: [],
      warnings: [{
        local_path: "*",
        reason: `本地图片引用检查失败：${error instanceof Error ? error.message : "请稍后重试"}`,
      }],
    }
  }
  const cleaned_paths: string[] = []
  const warnings: Array<{ local_path: string; reason: string }> = []
  for (const localPath of candidates) {
    try {
      await removeFile([localPath], rootDir)
      cleaned_paths.push(localPath)
    } catch (error) {
      warnings.push({
        local_path: localPath,
        reason: `本地图片清理失败：${error instanceof Error ? error.message : "请稍后手动清理"}`,
      })
    }
  }
  return { cleaned_paths, warnings }
}

async function deleteDraftImageFiles(draftId: number, images: Array<Record<string, unknown>>) {
  const rootDir = path.resolve(DRAFT_IMAGE_DIR)
  const localPaths = Array.from(new Set(images.map((image) => stringValue(image.local_path)).filter(Boolean)))
  await Promise.all(localPaths.map(async (localPath) => {
    const resolvedPath = path.resolve(localPath)
    if (!resolvedPath.startsWith(`${rootDir}${path.sep}`)) return
    await rm(resolvedPath, { force: true }).catch(() => undefined)
  }))
  await rm(path.join(DRAFT_IMAGE_DIR, String(draftId)), { force: true, recursive: true }).catch(() => undefined)
}

async function saveUploadedSpreadsheet(c: Context) {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "请上传表格文件" })
  }
  const filePath = await saveFormFile(file)
  return { form, file, filePath }
}

async function saveFormFile(file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filePath = path.join(UPLOAD_DIR, `${randomUUID()}-${safeUploadName(file.name)}`)
  await writeValidatedUploadFile(file, "spreadsheet", filePath)
  return filePath
}

async function saveOcrFormFiles(c: Context) {
  const form = await c.req.formData()
  const displayNames = form.getAll("filePaths").map(stringValue)
  const assetPackageMode = booleanFormValue(form.get("assetPackage") ?? form.get("asset_package"))
  const rawEntries = [
    ...form.getAll("files").map((file) => ({ field: "files", file })),
    ...form.getAll("file").map((file) => ({ field: "file", file })),
    ...form.getAll("referenceImages").map((file) => ({ field: "referenceImages", file })),
    ...form.getAll("referenceImageFiles").map((file) => ({ field: "referenceImages", file })),
    ...form.getAll("scmSupplementFile").map((file) => ({ field: "scmSupplementFile", file })),
    ...form.getAll("scmSupplement").map((file) => ({ field: "scmSupplement", file })),
    ...form.getAll("supplementFile").map((file) => ({ field: "supplementFile", file })),
    ...form.getAll("workbook").map((file) => ({ field: "workbook", file })),
  ].filter((entry): entry is { field: string; file: File } => entry.file instanceof File && entry.file.size > 0)
  if (rawEntries.length === 0) {
    throw new HTTPException(400, { message: "请上传 PDF 吊牌、JPG/PNG 洗唛、平铺图或 SCM 下载结果 Excel" })
  }
  if (rawEntries.length > MAX_PRODUCT_ARCHIVE_OCR_FILES) {
    throw new HTTPException(400, { message: `单次最多导入 ${MAX_PRODUCT_ARCHIVE_OCR_FILES} 个吊牌/洗唛/平铺图文件` })
  }
  assertAggregateUploadBytes(
    rawEntries.map((entry) => entry.file),
    MAX_PRODUCT_ARCHIVE_OCR_BATCH_BYTES,
    "吊牌/洗唛 OCR 批次总大小超过限制",
  )
  const uploadDir = path.join(UPLOAD_DIR, `product-archive-ocr-${randomUUID()}`)
  await mkdir(uploadDir, { recursive: true })
  const files = []
  const supplementFiles = []
  const referenceImageFiles = []
  try {
    for (let index = 0; index < rawEntries.length; index += 1) {
      const { field, file } = rawEntries[index]
      const fileName = cleanUploadDisplayName(displayNames[index], file.name)
      if (isIgnorableOcrFolderEntry(fileName)) continue
      const packageKind = classifyProductArchiveAssetPackageFileName(fileName)
      const shouldImportReferenceImage = field === "referenceImages" || packageKind === "reference_image"
      if (shouldImportReferenceImage) {
        if (!isProductArchiveReferenceImageName(fileName)) {
          throw new HTTPException(400, { message: "平铺图/参考图仅支持 JPG、PNG、WEBP 图片" })
        }
        const buffer = await readValidatedUploadBuffer(file, "image")
        const detected = detectImageUploadType(buffer)
        const dimensions = readImageDimensions(buffer)
        const filePath = path.join(uploadDir, `${randomUUID()}-${safeDraftImageUploadName(file.name, detected.extension)}`)
        await writeFile(filePath, buffer)
        referenceImageFiles.push({
          file,
          filePath,
          fileName,
          mimeType: detected.contentType,
          size: buffer.length,
          width: dimensions.width,
          height: dimensions.height,
          extension: detected.extension,
          hasModelShot: productArchiveImageHasModelShot(fileName),
          assetKind: draftImageAssetKind(fileName),
          kind: "reference_image" as const,
        })
        continue
      }
      if (isScmSupplementWorkbookName(fileName)) {
        const filePath = path.join(uploadDir, `${randomUUID()}-${safeScmSupplementUploadName(file.name)}`)
        await writeValidatedUploadFile(file, "spreadsheet", filePath)
        supplementFiles.push({
          file,
          filePath,
          fileName,
          mimeType: file.type,
          size: file.size,
        })
        continue
      }
      if (assetPackageMode && packageKind === "unsupported") {
        throw new HTTPException(400, { message: "图包目录仅支持 PDF、JPG、PNG、WEBP 和 SCM 下载结果 .xlsx" })
      }
      if (!isProductArchiveOcrAssetName(fileName)) {
        throw new HTTPException(400, { message: "仅支持 PDF、JPG、PNG 吊牌/洗唛文件、平铺图和 SCM 下载结果 .xlsx" })
      }
      const buffer = await readValidatedUploadBuffer(file, "product_archive_ocr")
      const detected = detectProductArchiveOcrUploadType(buffer)
      const filePath = path.join(uploadDir, `${randomUUID()}-${safeOcrUploadName(file.name)}`)
      await writeFile(filePath, buffer)
      files.push({
        file,
        filePath,
        fileName,
        mimeType: detected.contentType,
        size: buffer.length,
        extension: detected.extension,
        assetKind: ocrAssetKind(packageKind),
      })
    }
  } catch (error) {
    await rm(uploadDir, { recursive: true, force: true })
    throw error
  }
  if (files.length === 0 && supplementFiles.length === 0 && referenceImageFiles.length === 0) {
    await rm(uploadDir, { recursive: true, force: true })
    throw new HTTPException(400, { message: "请上传 PDF 吊牌、JPG/PNG 洗唛、平铺图或 SCM 下载结果 Excel" })
  }
  return { form, files, supplementFiles, referenceImageFiles, uploadDir }
}

export function applyDocumentsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.documents)) return body.documents
  if (!Array.isArray(body.items)) return []
  return body.items.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {}
    return {
      fileName: record.fileName,
      fileType: record.fileType,
      sourceKind: record.sourceKind,
      sourceRef: record.sourceRef,
      detectedSpuCode: record.detectedSpuCode,
      styleCodes: record.styleCodes,
      pageCount: record.pageCount,
      fields: record.extractedFields,
      warnings: record.warnings,
      status: record.error ? "ocr_failed" : "recognized",
      error: record.error,
    }
  })
}

function draftIdsForOcrDocuments(db: ReturnType<typeof getDb>, documents: Record<string, unknown>[]) {
  const draftIds = new Set<number>()
  for (const document of documents) {
    const spuCode = stringValue(document.detectedSpuCode ?? document.detected_spu_code)
    if (!spuCode) continue
    const draft = latestProductArchiveDraftForSpuCode(db, spuCode)
    const draftId = Number(draft?.id)
    if (Number.isInteger(draftId) && draftId > 0) draftIds.add(draftId)
  }
  return Array.from(draftIds)
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => stringValue(value)).filter(Boolean)))
}

function sourceSpuCodesForBatchIds(db: ReturnType<typeof getDb>, sourceBatchIds: number[]) {
  const ids = sourceBatchIds.filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) return []
  const rows = db.prepare(`
    select distinct spu_code
    from product_archive_source_row
    where source_batch_id in (${ids.map(() => "?").join(", ")})
      and coalesce(spu_code, '') <> ''
    order by spu_code
  `).all(...ids) as Array<{ spu_code: unknown }>
  return uniqueStrings(rows.map((row) => row.spu_code))
}

function existingLaunchPlanSpuCodes(db: ReturnType<typeof getDb>, spuCodes: string[]) {
  const codes = uniqueStrings(spuCodes)
  if (codes.length === 0) return new Set<string>()
  const rows = db.prepare(`
    select distinct source.spu_code
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.source_type = 'launch_plan'
      and source.spu_code in (${codes.map(() => "?").join(", ")})
  `).all(...codes) as Array<{ spu_code: unknown }>
  return new Set(uniqueStrings(rows.map((row) => row.spu_code)))
}

function launchPlanBatchIdsForSpuCodes(db: ReturnType<typeof getDb>, spuCodes: string[]) {
  const codes = uniqueStrings(spuCodes)
  if (codes.length === 0) return []
  const rows = db.prepare(`
    select distinct on (source.spu_code) source.source_batch_id
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.source_type = 'launch_plan'
      and source.spu_code in (${codes.map(() => "?").join(", ")})
    order by source.spu_code, source.source_batch_id desc
  `).all(...codes) as Array<{ source_batch_id: unknown }>
  return rows.map((row) => Number(row.source_batch_id)).filter((id) => Number.isInteger(id) && id > 0)
}

function queueableDraftRefreshCodesForCodes(db: ReturnType<typeof getDb>, spuCodes: string[], input: {
  tenantName?: string | null
  merchantId?: string | null
}) {
  const codes = uniqueStrings(spuCodes)
  if (codes.length === 0) return []
  const rows = db.prepare(`
    select draft.spu_code, draft.status
    from product_archive_draft draft
    where draft.tenant_name = ?
      and draft.merchant_id = ?
      and draft.spu_code in (${codes.map(() => "?").join(", ")})
  `).all(input.tenantName, input.merchantId, ...codes) as Array<{ spu_code: unknown; status: unknown }>
  const existing = new Map<string, { hasReusable: boolean; hasNonReusable: boolean }>()
  for (const row of rows) {
    const code = stringValue(row.spu_code)
    if (!code) continue
    const current = existing.get(code) ?? { hasReusable: false, hasNonReusable: false }
    if (isReusableProductArchiveDraftStatus(row.status)) {
      current.hasReusable = true
    } else {
      current.hasNonReusable = true
    }
    existing.set(code, current)
  }
  return codes.filter((code) => {
    const current = existing.get(code)
    if (!current) return true
    if (current.hasNonReusable) return false
    return current.hasReusable
  })
}

function numericIdValue(value: unknown) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function draftIdsFromBody(body: Record<string, unknown>) {
  const rawIds = Array.isArray(body.draftIds)
    ? body.draftIds
    : Array.isArray(body.draft_ids)
      ? body.draft_ids
      : Array.isArray(body.ids)
        ? body.ids
        : []
  const seen = new Set<number>()
  const ids: number[] = []
  for (const rawId of rawIds) {
    const id = numericIdValue(rawId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function productArchiveDraftTargetsByIds(db: ReturnType<typeof getDb>, draftIds: number[], options: {
  emptyMessage: string
  limitEnv: string
  defaultLimit: number
  maxLimit: number
  limitMessage: (limit: number) => string
}) {
  const ids = Array.from(new Set(draftIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) {
    throw new HTTPException(400, { message: options.emptyMessage })
  }
  const maxBatchSize = Math.max(
    1,
    Math.min(Number(process.env[options.limitEnv] ?? options.defaultLimit) || options.defaultLimit, options.maxLimit),
  )
  if (ids.length > maxBatchSize) {
    throw new HTTPException(400, { message: options.limitMessage(maxBatchSize) })
  }
  const rows = db.prepare(`
    select id, spu_code, title, status
    from product_archive_draft
    where id in (${ids.map(() => "?").join(", ")})
  `).all(...ids) as Array<{ id: unknown; spu_code: unknown; title: unknown; status: unknown }>
  const byId = new Map(rows.map((row) => [Number(row.id), row]))
  const missingIds = ids.filter((id) => !byId.has(id))
  if (missingIds.length > 0) {
    throw new HTTPException(400, { message: `部分草稿不存在：${missingIds.join(", ")}` })
  }
  return ids.map((id) => {
    const row = byId.get(id)
    return {
      draftId: id,
      spuCode: stringValue(row?.spu_code) || String(id),
      title: stringValue(row?.title) || null,
      status: stringValue(row?.status),
    }
  })
}

function productArchiveAiFillTargetsByIds(db: ReturnType<typeof getDb>, draftIds: number[]) {
  return productArchiveDraftTargetsByIds(db, draftIds, {
    emptyMessage: "请先选择需要 AI 填充的草稿",
    limitEnv: "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_BATCH_LIMIT",
    defaultLimit: 200,
    maxLimit: 500,
    limitMessage: (limit) => `单次最多选择 ${limit} 个草稿进行 AI 填充`,
  })
}

function productArchivePrecheckTargetsByIds(db: ReturnType<typeof getDb>, draftIds: number[]) {
  return productArchiveDraftTargetsByIds(db, draftIds, {
    emptyMessage: "请先选择需要发布预检的草稿",
    limitEnv: "LISTINGIFY_PRODUCT_ARCHIVE_PRECHECK_BATCH_LIMIT",
    defaultLimit: 200,
    maxLimit: 500,
    limitMessage: (limit) => `单次最多选择 ${limit} 个草稿进行发布预检`,
  })
}

async function importWorkflowSourceFile(
  db: ReturnType<typeof getDb>,
  file: File,
  sourceType: "copywriting" | "launch_plan" | "size_chart",
  createdBy?: number | null,
) {
  const filePath = await saveFormFile(file)
  try {
    const sheets = await readProductArchiveSourceSheets(filePath, file.name, sourceType)
    const sourceBatchIds: number[] = []
    const refreshSummaries = []
    let inputRowCount = 0
    let insertedRowCount = 0
    for (const sheet of sheets) {
      const result = await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
        importProductArchiveSourceRowsInChunks(db, {
          sourceType,
          fileName: file.name,
          sheetName: sheet.name,
          rows: sheet.rows,
        }, {
          chunkSize: 1000,
          signal,
        })
      ))
      const sourceBatchId = Number(result.batch.id)
      sourceBatchIds.push(sourceBatchId)
      inputRowCount += result.inputRowCount
      insertedRowCount += result.insertedRowCount
      refreshSummaries.push(await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
        refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
          sourceBatchId,
          sourceType: result.sourceType,
        }, {
          chunkSize: 5,
          signal,
        })
      )))
    }
    const listingPlanImport = sourceType === "launch_plan"
      ? await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
          importListingLaunchPlanSheetsInChunks(db, {
            fileName: file.name,
            fileSizeBytes: file.size,
            sheets,
            sourceBatchIds,
            createdBy,
          }, {
            chunkSize: 1000,
            signal,
          })
        ))
      : null
    return {
      fileName: file.name,
      sheetCount: sheets.length,
      inputRowCount,
      insertedRowCount,
      sourceBatchIds,
      refreshSummaries,
      listingPlanImport,
      spuCodes: sourceSpuCodesForBatchIds(db, sourceBatchIds),
    }
  } finally {
    await rm(filePath, { force: true })
  }
}

async function readProductArchiveSourceSheets(filePath: string, fileName: string, sourceType: string) {
  return withBackgroundTaskSlot("product_archive_source_import", async (signal) => {
    if (sourceType === "size_chart") {
      const rows = await readPlmSizeChartWorkbook(filePath, { fileName })
      if (signal.aborted) throw signal.reason
      return [{
        name: "PLM尺码表",
        rows: rows.map((row) => row.rowJson ?? row),
      }]
    }
    return readSpreadsheetSheetsFromFileInWorker(filePath, { fileName, signal })
  })
}

productArchiveDrafts.get("/", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(listProductArchiveDrafts(db, {
    q: c.req.query("q"),
    spuCodes: c.req.query("spuCodes") ?? c.req.query("codes"),
    status: c.req.query("status"),
    tenant: c.req.query("tenant"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  }))
})

productArchiveDrafts.get("/ai-field-strategies", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  return c.json({ strategies: listProductArchiveAiFieldStrategies() })
})

productArchiveDrafts.get("/templates/:templateType", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const templateType = c.req.param("templateType") as keyof typeof PRODUCT_ARCHIVE_TEMPLATES
  const template = PRODUCT_ARCHIVE_TEMPLATES[templateType]
  if (!template) {
    throw new HTTPException(404, { message: "模板不存在" })
  }
  let buffer: Buffer
  try {
    buffer = await readFile(template.filePath)
  } catch {
    throw new HTTPException(404, { message: "模板文件未配置，请先放入 data/product-archive-templates" })
  }
  return c.body(buffer, 200, {
    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
    "cache-control": "private, max-age=3600",
  })
})

productArchiveDrafts.post("/from-spu/:spuCode", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const body = await readJson(c)
  const spuCode = assertSafeProductArchiveCode(c.req.param("spuCode"))
  const detail = createProductArchiveDraftFromSpu(db, {
    spuCode,
    deepdrawTenantName: body.deepdrawTenantName ?? body.tenantName,
    tradeId: body.tradeId,
    tradePath: body.tradePath,
    sourceBatchId: body.sourceBatchId,
    createdBy: user.id,
    projectRoot: PROJECT_ROOT,
  })
  const mdmMainImage = await syncDraftMdmMainImageSafely(db, Number(detail.draft.id), spuCode)
  auditFromContext(c, {
    action: "draft.created",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: detail.draft.id,
    summary: `生成深绘建档草稿 ${spuCode}`,
    metadata: { spuCode, tenantName: detail.draft.tenant_name, mdmMainImageStatus: mdmMainImage.status },
  })
  return c.json({
    ...getProductArchiveDraftDetail(db, Number(detail.draft.id)),
    mdmMainImage,
  })
})

productArchiveDrafts.post("/batch", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const body = await readJson(c)
  try {
    const db = getDb()
    const deepdrawConfig = resolveDeepdrawConfig({
      projectRoot: PROJECT_ROOT,
      tenantName: body.deepdrawTenantName ?? body.tenantName,
    })
    const rawCodes = parseSpuCodes(body.codes ?? body.rawCodes)
    const queueCodes = queueableDraftRefreshCodesForCodes(db, rawCodes, {
      tenantName: deepdrawConfig.tenantName,
      merchantId: deepdrawConfig.merchantId == null ? null : String(deepdrawConfig.merchantId),
    })
    if (queueCodes.length === 0) {
      return c.json({
        status: "skipped",
        total_count: 0,
        skippedNonReusableDraftCount: rawCodes.length,
        message: "所选款号已有不可覆盖状态的深绘建档草稿，未创建新任务。",
      })
    }
    const job = draftQueue.enqueue({
      source: "draft",
      rawCodes: queueCodes,
      intervalMs: body.intervalMs,
      options: {
        deepdrawTenantName: deepdrawConfig.tenantName,
        tradeId: body.tradeId,
        tradePath: body.tradePath,
        sourceBatchId: body.sourceBatchId,
        sourceBatchIds: body.sourceBatchIds,
        createdBy: user.id,
      },
    })
    auditFromContext(c, {
      action: "draft.batch.queued",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_draft_batch",
      entityId: job.id,
      summary: `批量生成深绘建档草稿 ${job.total_count} 个款号`,
      metadata: { jobId: job.id, count: job.total_count, skippedNonReusableDraftCount: rawCodes.length - queueCodes.length },
    })
    return c.json(job, 202)
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

productArchiveDrafts.post("/mdm-batch", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const body = await readJson(c)
  try {
    const db = getDb()
    const deepdrawConfig = resolveDeepdrawConfig({
      projectRoot: PROJECT_ROOT,
      tenantName: body.deepdrawTenantName ?? body.tenantName,
    })
    const rawCodes = parseSpuCodes(body.codes ?? body.rawCodes)
    const queueCodes = queueableDraftRefreshCodesForCodes(db, rawCodes, {
      tenantName: deepdrawConfig.tenantName,
      merchantId: deepdrawConfig.merchantId == null ? null : String(deepdrawConfig.merchantId),
    })
    if (queueCodes.length === 0) {
      return c.json({
        status: "skipped",
        total_count: 0,
        skippedNonReusableDraftCount: rawCodes.length,
        message: "所选款号已有不可覆盖状态的深绘建档草稿，未创建新任务。",
      })
    }
    const job = draftQueue.enqueue({
      source: "mdm_draft",
      rawCodes: queueCodes,
      intervalMs: body.intervalMs,
      options: {
        deepdrawTenantName: deepdrawConfig.tenantName,
        tradeId: body.tradeId,
        tradePath: body.tradePath,
        sourceBatchId: body.sourceBatchId,
        sourceBatchIds: body.sourceBatchIds,
        createdBy: user.id,
      },
    })
    auditFromContext(c, {
      action: "draft.mdm_batch.queued",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_draft_batch",
      entityId: job.id,
      summary: `批量同步 MDM 并生成深绘建档草稿 ${job.total_count} 个款号`,
      metadata: { jobId: job.id, count: job.total_count, source: "mdm_draft", skippedNonReusableDraftCount: rawCodes.length - queueCodes.length },
    })
    return c.json(job, 202)
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

productArchiveDrafts.post("/source-imports", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const body = await readJson(c)
  const autoSyncMissingMdm = Boolean(body.autoSyncMissingMdm ?? body.auto_sync_missing_mdm)
  if (autoSyncMissingMdm) {
    requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  }
  const result = importProductArchiveSourceRows(db, {
    sourceType: body.sourceType ?? body.source_type,
    fileName: body.fileName ?? body.file_name,
    sheetName: body.sheetName ?? body.sheet_name,
    rows: Array.isArray(body.rows) ? body.rows : [],
  })
  const sourceBatchId = Number(result.batch.id)
  const refreshSummary = refreshProductArchiveDraftsFromSourceBatch(db, {
    sourceBatchId,
    sourceType: result.sourceType,
  })
  const shouldAutoCreateDrafts = autoSyncMissingMdm && ["launch_plan", "copywriting"].includes(result.sourceType)
  const deepdrawConfig = shouldAutoCreateDrafts
    ? resolveDeepdrawConfig({
        projectRoot: PROJECT_ROOT,
        tenantName: body.deepdrawTenantName ?? body.tenantName,
      })
    : null
  const missingCodes = shouldAutoCreateDrafts
    ? missingDraftSpuCodes(db, sourceBatchId, {
        tenantName: deepdrawConfig?.tenantName,
        merchantId: deepdrawConfig?.merchantId == null ? null : String(deepdrawConfig.merchantId),
      })
    : []
  const syncJob = missingCodes.length > 0
    ? draftQueue.enqueue({
        source: "mdm_draft",
        rawCodes: missingCodes,
        intervalMs: body.intervalMs,
        options: {
          deepdrawTenantName: deepdrawConfig?.tenantName ?? body.deepdrawTenantName ?? body.tenantName,
          tradeId: body.tradeId,
          tradePath: body.tradePath,
          sourceBatchId: result.sourceType === "launch_plan" ? sourceBatchId : null,
          sourceBatchIds: { [result.sourceType]: [sourceBatchId] },
          createdBy: user.id,
        },
      })
    : null
  auditFromContext(c, {
    action: "source.imported",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_source_batch",
    entityId: result.batch.id,
    summary: `导入深绘建档来源表 ${result.sourceType}`,
    metadata: {
      sourceType: result.sourceType,
      inputRowCount: result.inputRowCount,
      insertedRowCount: result.insertedRowCount,
      refreshSummary,
      autoSyncMissingMdm,
      skippedExistingDraftCount: shouldAutoCreateDrafts ? result.insertedRowCount - missingCodes.length : 0,
      missingMdmSpuCodes: missingCodes,
      syncJobId: syncJob?.id ?? null,
      userId: user.id,
    },
  })
  return c.json({ ...result, missingMdmSpuCodes: missingCodes, syncJob, refreshSummary })
})

productArchiveDrafts.post("/source-imports/upload", productArchiveSpreadsheetBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const { form, file, filePath } = await saveUploadedSpreadsheet(c)
  try {
    const sourceType = stringValue(form.get("sourceType") ?? form.get("source_type"))
    const autoSyncMissingMdm = booleanFormValue(form.get("autoSyncMissingMdm") ?? form.get("auto_sync_missing_mdm"))
    if (autoSyncMissingMdm) {
      requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
    }
    const sheets = await readProductArchiveSourceSheets(filePath, file.name, sourceType)
    const sourceBatchIds: number[] = []
    const refreshSummaries = []
    const missingMdmSpuCodes: string[] = []
    const syncJobs = []
    let inputRowCount = 0
    let insertedRowCount = 0
    let skippedExistingDraftCount = 0

    for (const sheet of sheets) {
      const result = await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
        importProductArchiveSourceRowsInChunks(db, {
          sourceType,
          fileName: file.name,
          sheetName: sheet.name,
          rows: sheet.rows,
        }, {
          chunkSize: 1000,
          signal,
        })
      ))
      const sourceBatchId = Number(result.batch.id)
      sourceBatchIds.push(sourceBatchId)
      inputRowCount += result.inputRowCount
      insertedRowCount += result.insertedRowCount
      const refreshSummary = await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
        refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
          sourceBatchId,
          sourceType: result.sourceType,
        }, {
          chunkSize: 5,
          signal,
        })
      ))
      refreshSummaries.push(refreshSummary)

      const shouldAutoCreateDrafts = autoSyncMissingMdm && ["launch_plan", "copywriting"].includes(result.sourceType)
      const deepdrawConfig = shouldAutoCreateDrafts
        ? resolveDeepdrawConfig({
            projectRoot: PROJECT_ROOT,
            tenantName: stringValue(form.get("deepdrawTenantName") ?? form.get("tenantName")),
          })
        : null
      const missingCodes = shouldAutoCreateDrafts
        ? missingDraftSpuCodes(db, sourceBatchId, {
            tenantName: deepdrawConfig?.tenantName,
            merchantId: deepdrawConfig?.merchantId == null ? null : String(deepdrawConfig.merchantId),
          })
        : []
      missingMdmSpuCodes.push(...missingCodes)
      skippedExistingDraftCount += shouldAutoCreateDrafts ? result.insertedRowCount - missingCodes.length : 0
      if (missingCodes.length > 0) {
        syncJobs.push(draftQueue.enqueue({
          source: "mdm_draft",
          rawCodes: missingCodes,
          intervalMs: stringValue(form.get("intervalMs")),
          options: {
            deepdrawTenantName: deepdrawConfig?.tenantName ?? stringValue(form.get("deepdrawTenantName") ?? form.get("tenantName")),
            tradeId: stringValue(form.get("tradeId")) || null,
            tradePath: stringValue(form.get("tradePath")) || null,
            sourceBatchId: result.sourceType === "launch_plan" ? sourceBatchId : null,
            sourceBatchIds: { [result.sourceType]: [sourceBatchId] },
            createdBy: user.id,
          },
        }))
      }
    }

    const listingPlanImport = sourceType === "launch_plan"
      ? await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
          importListingLaunchPlanSheetsInChunks(db, {
            fileName: file.name,
            fileSizeBytes: file.size,
            sheets,
            sourceBatchIds,
            createdBy: user.id,
          }, {
            chunkSize: 1000,
            signal,
          })
        ))
      : null
    auditFromContext(c, {
      action: "source.imported",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_source_batch",
      entityId: sourceBatchIds[0] ?? null,
      summary: `服务端导入深绘建档来源表 ${sourceType}`,
      metadata: {
        sourceType,
        fileName: file.name,
        sheetCount: sheets.length,
        inputRowCount,
        insertedRowCount,
        sourceBatchIds,
        refreshSummaries,
        autoSyncMissingMdm,
        skippedExistingDraftCount,
        missingMdmSpuCodes,
        syncJobIds: syncJobs.map((job) => job.id),
        listingPlanImportId: listingPlanImport?.import?.id ?? null,
        userId: user.id,
      },
    })
    return c.json({
      sourceType,
      inputRowCount,
      insertedRowCount,
      sheetCount: sheets.length,
      sourceBatchIds,
      refreshSummaries,
      missingMdmSpuCodes,
      skippedExistingDraftCount,
      syncJob: syncJobs.at(-1) ?? null,
      syncJobs,
      listingPlanImport,
    })
  } finally {
    await rm(filePath, { force: true })
  }
})

productArchiveDrafts.post("/size-chart/import", productArchiveSpreadsheetBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const { file, filePath } = await saveUploadedSpreadsheet(c)
  try {
    const sheets = await readProductArchiveSourceSheets(filePath, file.name, "size_chart")
    const result = await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
      importProductArchiveSourceRowsInChunks(db, {
        sourceType: "size_chart",
        fileName: file.name,
        sheetName: "PLM尺码表",
        rows: sheets.flatMap((sheet) => sheet.rows),
      }, {
        chunkSize: 1000,
        signal,
      })
    ))
    const sourceBatchId = Number(result.batch.id)
    const refreshSummary = await withBackgroundTaskSlot("product_archive_source_import", (signal) => (
      refreshProductArchiveDraftsFromSourceBatchInChunks(db, {
        sourceBatchId,
        sourceType: result.sourceType,
      }, {
        chunkSize: 5,
        signal,
      })
    ))
    auditFromContext(c, {
      action: "size_chart.imported",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_source_batch",
      entityId: result.batch.id,
      summary: "导入 PLM 尺码表并刷新深绘建档草稿",
      metadata: {
        sourceType: result.sourceType,
        fileName: file.name,
        inputRowCount: result.inputRowCount,
        insertedRowCount: result.insertedRowCount,
        sourceBatchId,
        refreshSummary,
        userId: user.id,
      },
    })
    return c.json({ ...result, sourceBatchIds: [sourceBatchId], refreshSummary })
  } finally {
    await rm(filePath, { force: true })
  }
})

productArchiveDrafts.post("/workflow/start", productArchiveWorkflowSpreadsheetBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const form = await c.req.formData()
  const copywritingFile = form.get("copywritingFile")
  const launchPlanFile = form.get("launchPlanFile")
  const sizeChartFile = form.get("sizeChartFile")
  const spreadsheetFiles = [copywritingFile, launchPlanFile, sizeChartFile]
    .filter((file): file is File => file instanceof File && file.size > 0)
  assertAggregateUploadBytes(
    spreadsheetFiles,
    MAX_PRODUCT_ARCHIVE_WORKFLOW_SPREADSHEET_BYTES,
    "工作流表格批次总大小超过限制",
  )
  const skipLaunchPlan = booleanFormValue(form.get("skipLaunchPlan"))
  const sourceBatchIdsByType: Record<string, number[]> = {}
  const refreshSummaries = []
  let copywritingImport = null
  let launchPlanImport = null
  let sizeChartImport = null

  if (copywritingFile instanceof File && copywritingFile.size > 0) {
    copywritingImport = await importWorkflowSourceFile(db, copywritingFile, "copywriting", user.id)
    sourceBatchIdsByType.copywriting = copywritingImport.sourceBatchIds
    refreshSummaries.push(...copywritingImport.refreshSummaries)
  }

  if (launchPlanFile instanceof File && launchPlanFile.size > 0) {
    launchPlanImport = await importWorkflowSourceFile(db, launchPlanFile, "launch_plan", user.id)
    sourceBatchIdsByType.launch_plan = launchPlanImport.sourceBatchIds
    refreshSummaries.push(...launchPlanImport.refreshSummaries)
  }

  if (sizeChartFile instanceof File && sizeChartFile.size > 0) {
    sizeChartImport = await importWorkflowSourceFile(db, sizeChartFile, "size_chart", user.id)
    sourceBatchIdsByType.size_chart = sizeChartImport.sourceBatchIds
    refreshSummaries.push(...sizeChartImport.refreshSummaries)
  }

  const candidateCodes = uniqueStrings([
    ...(copywritingImport?.spuCodes ?? []),
    ...(launchPlanImport?.spuCodes ?? []),
  ])
  if (candidateCodes.length === 0) {
    throw new HTTPException(400, { message: "请上传标准文案表或上市计划表，系统会按表格款号自动同步 MDM 并生成草稿" })
  }

  const existingLaunchPlans = existingLaunchPlanSpuCodes(db, candidateCodes)
  if (copywritingImport && !launchPlanImport && !skipLaunchPlan) {
    const missingLaunchPlanSpuCodes = copywritingImport.spuCodes.filter((code) => !existingLaunchPlans.has(code))
    if (missingLaunchPlanSpuCodes.length > 0) {
      return c.json({
        status: "needs_launch_plan",
        needsLaunchPlan: true,
        message: "标准文案表中有款号还没有匹配到上市计划，请上传上市计划表后继续建档。",
        missingLaunchPlanSpuCodes,
        copywritingImport,
        launchPlanImport,
        sourceBatchIdsByType,
        refreshSummaries,
      })
    }
  }

  const existingLaunchPlanBatchIds = launchPlanBatchIdsForSpuCodes(db, candidateCodes)
  if (existingLaunchPlanBatchIds.length > 0) {
    sourceBatchIdsByType.launch_plan = uniqueStrings([
      ...(sourceBatchIdsByType.launch_plan ?? []),
      ...existingLaunchPlanBatchIds,
    ]).map(Number)
  }

  const deepdrawConfig = resolveDeepdrawConfig({
    projectRoot: PROJECT_ROOT,
    tenantName: stringValue(form.get("deepdrawTenantName") ?? form.get("tenantName")),
  })
  const draftCodes = queueableDraftRefreshCodesForCodes(db, candidateCodes, {
    tenantName: deepdrawConfig.tenantName,
    merchantId: deepdrawConfig.merchantId == null ? null : String(deepdrawConfig.merchantId),
  })
  const legacySourceBatchId = sourceBatchIdsByType.launch_plan?.[0] ?? null
  const syncJob = draftCodes.length > 0
    ? draftQueue.enqueue({
        source: "mdm_draft",
        rawCodes: draftCodes,
        intervalMs: stringValue(form.get("intervalMs")),
        options: {
          deepdrawTenantName: deepdrawConfig.tenantName,
          tradeId: stringValue(form.get("tradeId")) || null,
          tradePath: stringValue(form.get("tradePath")) || null,
          sourceBatchId: legacySourceBatchId,
          sourceBatchIds: sourceBatchIdsByType,
          createdBy: user.id,
        },
      })
    : null

  auditFromContext(c, {
    action: "draft.workflow.started",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: syncJob?.id ?? null,
    summary: `开始商品建档 ${candidateCodes.length} 个款号`,
    metadata: {
      candidateCodeCount: candidateCodes.length,
      draftQueuedCount: draftCodes.length,
      skippedExistingDraftCount: candidateCodes.length - draftCodes.length,
      copywritingSourceBatchIds: sourceBatchIdsByType.copywriting ?? [],
      launchPlanSourceBatchIds: sourceBatchIdsByType.launch_plan ?? [],
      sizeChartSourceBatchIds: sourceBatchIdsByType.size_chart ?? [],
      syncJobId: syncJob?.id ?? null,
      userId: user.id,
    },
  })

  return c.json({
    status: "queued",
    needsLaunchPlan: false,
    candidateCodes,
    draftQueuedCount: draftCodes.length,
    skippedExistingDraftCount: candidateCodes.length - draftCodes.length,
    copywritingImport,
    launchPlanImport,
    sizeChartImport,
    sourceBatchIdsByType,
    refreshSummaries,
    syncJob,
  }, syncJob ? 202 : 200)
})

productArchiveDrafts.post("/hangtag-washlabel-ocr/preview", productArchiveOcrPreviewBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const { form, files, supplementFiles, referenceImageFiles, uploadDir } = await saveOcrFormFiles(c)
  try {
    assertHangtagWashlabelPreviewSize(files, supplementFiles, referenceImageFiles)
    const documents = await recognizeProductArchiveOcrFiles(files.map((file) => ({
      filePath: file.filePath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
    })), {
      aiRouterFactory: () => getDefaultAiScenarioRouter({
        db,
        fetchImpl: fetch,
      }),
    })
    const supplementSummaries = []
    for (const file of supplementFiles) {
      const supplement = await readScmHangtagWashlabelSupplementWorkbook(file.filePath, {
        fileName: file.fileName,
      })
      documents.push(...supplement.documents)
      supplementSummaries.push({
        fileName: supplement.fileName,
        sheetCount: supplement.sheetCount,
        documentCount: supplement.documentCount,
      })
    }
    const overwriteExisting = booleanFormValue(form.get("overwriteExisting") ?? form.get("overwrite_existing"))
    const result = previewProductArchiveHangtagWashlabelOcr(db, {
      documents,
      overwriteExisting,
    })
    auditFromContext(c, {
      action: "draft.hangtag_washlabel_ocr.previewed",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_draft_batch",
      entityId: null,
      summary: `识别吊牌/洗唛文件 ${files.length} 个，平铺图 ${referenceImageFiles.length} 张，SCM 补充表 ${supplementFiles.length} 个`,
      metadata: {
        fileCount: files.length,
        supplementFileCount: supplementFiles.length,
        referenceImageFileCount: referenceImageFiles.length,
        matchedCount: result.summary.matchedCount,
        writableFieldCount: result.summary.writableFieldCount,
        failedCount: result.summary.failedCount,
        userId: user.id,
      },
    })
    return c.json({
      ...result,
      provider: getProductArchiveOcrRuntimeInfo(documents),
      scmSupplement: {
        files: supplementSummaries,
      },
      referenceImages: {
        fileCount: referenceImageFiles.length,
      },
    })
  } finally {
    await rm(uploadDir, { recursive: true, force: true })
  }
})

productArchiveDrafts.post("/hangtag-washlabel-ocr/apply", productArchiveOcrBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const body = await readJson(c)
  const documents = applyDocumentsFromBody(body)
  if (documents.length === 0) {
    throw new HTTPException(400, { message: "请先完成吊牌/洗唛 OCR 预览后再写入；仅导入平铺图请使用后台识别或 SPU 图片入口" })
  }
  let result
  try {
    result = db.transaction(() => {
      for (const draftId of draftIdsForOcrDocuments(db, documents)) {
        assertProductArchiveDraftMutable(db, draftId)
      }
      return applyProductArchiveHangtagWashlabelOcr(db, {
        documents,
        overwriteExisting: booleanInputValue(body.overwriteExisting ?? body.overwrite_existing),
      })
    })()
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.hangtag_washlabel_ocr.applied",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: null,
    summary: `写入吊牌/洗唛 OCR 字段 ${result.summary.appliedFieldCount} 个`,
    metadata: {
      appliedDraftCount: result.summary.appliedDraftCount,
      appliedFieldCount: result.summary.appliedFieldCount,
      skippedCount: result.summary.skippedCount,
      overwriteExisting: booleanInputValue(body.overwriteExisting ?? body.overwrite_existing),
      userId: user.id,
    },
  })
  return c.json(result)
})

productArchiveDrafts.post("/hangtag-washlabel-ocr/jobs", productArchiveOcrBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const { form, files, supplementFiles, referenceImageFiles, uploadDir } = await saveOcrFormFiles(c)
  const overwriteExisting = booleanFormValue(form.get("overwriteExisting") ?? form.get("overwrite_existing"))
  let job: ReturnType<typeof hangtagWashlabelOcrQueue.enqueue>
  try {
    job = hangtagWashlabelOcrQueue.enqueue({
      files,
      supplementFiles,
      referenceImageFiles,
      overwriteExisting,
      actor: {
        id: user.id,
        username: user.username,
      },
      ipAddress: trustedClientAddress({
        forwardedFor: c.req.header("x-forwarded-for"),
        realIp: c.req.header("x-real-ip"),
      }),
      uploadDir,
    })
  } catch (error) {
    await rm(uploadDir, { recursive: true, force: true })
    throw error
  }
  auditFromContext(c, {
    action: "draft.hangtag_washlabel_ocr.background_queued",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: job.id,
    summary: `提交后台吊牌/洗唛 OCR 文件 ${files.length} 个，平铺图 ${referenceImageFiles.length} 张，SCM 补充表 ${supplementFiles.length} 个`,
    metadata: {
      fileCount: files.length,
      supplementFileCount: supplementFiles.length,
      referenceImageFileCount: referenceImageFiles.length,
      overwriteExisting,
      userId: user.id,
    },
  })
  return c.json(job, 202)
})

productArchiveDrafts.get("/hangtag-washlabel-ocr/jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = hangtagWashlabelOcrQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "吊牌/洗唛 OCR 任务不存在" })
  }
  return c.json(job)
})

productArchiveDrafts.post("/ai-fill-jobs", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const body = await readJson(c)
  const targets = productArchiveAiFillTargetsByIds(db, draftIdsFromBody(body))
  const job = productArchiveAiFillQueue.enqueue({
    targets,
    actor: {
      id: user.id,
      username: user.username,
    },
    ipAddress: trustedClientAddress({
      forwardedFor: c.req.header("x-forwarded-for"),
      realIp: c.req.header("x-real-ip"),
    }),
  })
  auditFromContext(c, {
    action: "draft.ai_fill.background_queued",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: job.id,
    summary: `提交后台 AI 推荐补齐深绘建档草稿 ${job.total_count} 个`,
    metadata: {
      jobId: job.id,
      count: job.total_count,
      draftIds: targets.map((target) => target.draftId),
      spuCodes: targets.map((target) => target.spuCode),
      userId: user.id,
    },
  })
  return c.json(job, 202)
})

productArchiveDrafts.get("/ai-fill-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = productArchiveAiFillQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "AI 填充任务不存在" })
  }
  return c.json(job)
})

productArchiveDrafts.post("/precheck-jobs", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  const body = await readJson(c)
  const targets = productArchivePrecheckTargetsByIds(db, draftIdsFromBody(body))
  const job = productArchivePrecheckQueue.enqueue({
    targets,
    maxAttempts: body.maxAttempts ?? body.max_attempts,
    retryDelayMs: body.retryDelayMs ?? body.retry_delay_ms,
    actor: {
      id: user.id,
      username: user.username,
    },
    ipAddress: trustedClientAddress({
      forwardedFor: c.req.header("x-forwarded-for"),
      realIp: c.req.header("x-real-ip"),
    }),
  })
  auditFromContext(c, {
    action: "draft.publish_precheck.background_queued",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: job.id,
    summary: `提交后台批量发布预检深绘建档草稿 ${job.total_count} 个`,
    metadata: {
      jobId: job.id,
      count: job.total_count,
      draftIds: targets.map((target) => target.draftId),
      spuCodes: targets.map((target) => target.spuCode),
      userId: user.id,
    },
  })
  return c.json(job, 202)
})

productArchiveDrafts.get("/precheck-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = productArchivePrecheckQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "批量发布预检任务不存在" })
  }
  return c.json(job)
})

productArchiveDrafts.post("/publish-jobs", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  const body = await readJson(c)
  const targets = productArchiveDraftTargetsByIds(db, draftIdsFromBody(body), {
    emptyMessage: "请先选择需要发布的草稿",
    limitEnv: "LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_BATCH_LIMIT",
    defaultLimit: 100,
    maxLimit: 300,
    limitMessage: (limit) => `单次最多选择 ${limit} 个草稿发布到深绘`,
  })
  const job = productArchivePublishQueue.enqueue({
    targets,
    maxAttempts: body.maxAttempts ?? body.max_attempts,
    retryDelayMs: body.retryDelayMs ?? body.retry_delay_ms,
    actor: {
      id: user.id,
      username: user.username,
    },
    ipAddress: trustedClientAddress({
      forwardedFor: c.req.header("x-forwarded-for"),
      realIp: c.req.header("x-real-ip"),
    }),
  })
  auditFromContext(c, {
    action: "draft.publish.background_queued",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: job.id,
    summary: `提交后台批量发布深绘建档草稿 ${job.total_count} 个`,
    metadata: {
      jobId: job.id,
      count: job.total_count,
      draftIds: targets.map((target) => target.draftId),
      spuCodes: targets.map((target) => target.spuCode),
      userId: user.id,
    },
  })
  return c.json(job, 202)
})

productArchiveDrafts.get("/publish-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = productArchivePublishQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "批量发布任务不存在" })
  }
  return c.json(job)
})

productArchiveDrafts.get("/batch-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = draftQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "Draft batch job not found" })
  }
  return c.json(job)
})

productArchiveDrafts.post("/images/import", productArchiveImageBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const { files, skippedCount: unsupportedSkippedCount, sourceType } = await readDraftImageUploadFiles(c)
  const items = []
  const importedImages = []
  const matchedDraftIds = new Set<number>()
  let skippedCount = unsupportedSkippedCount

  try {
    for (const file of files) {
      const spuCode = extractProductArchiveImageSpuCode(file.originalFileName || file.fileName)
      if (!spuCode) {
        skippedCount += 1
        items.push({
          fileName: file.originalFileName,
          ok: false,
          status: "skipped",
          reason: "文件名或目录名未识别到款号",
        })
        continue
      }
      const draft = latestProductArchiveDraftForSpuCode(db, spuCode)
      if (!draft) {
        skippedCount += 1
        items.push({
          fileName: file.originalFileName,
          spuCode,
          ok: false,
          status: "skipped",
          reason: "未找到对应建档草稿",
        })
        continue
      }
      const image = await saveDraftImageUpload({
        db,
        draft,
        file,
        sourceType,
        sourceRef: file.originalFileName,
        uploadedBy: user.id,
      })
      if (image) {
        importedImages.push(image)
        matchedDraftIds.add(Number(draft.id))
        items.push({
          fileName: file.originalFileName,
          spuCode,
          draftId: Number(draft.id),
          ok: true,
          status: "imported",
          image,
        })
      }
    }
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }

  auditFromContext(c, {
    action: "draft.image.batch_imported",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft_batch",
    entityId: null,
    summary: `批量导入深绘建档 SPU 参考图 ${importedImages.length} 张`,
    metadata: {
      fileCount: files.length + unsupportedSkippedCount,
      importedCount: importedImages.length,
      matchedDraftCount: matchedDraftIds.size,
      skippedCount,
      sourceType,
      userId: user.id,
    },
  })
  return c.json({
    ok: importedImages.length > 0,
    summary: {
      fileCount: files.length + unsupportedSkippedCount,
      importedCount: importedImages.length,
      matchedDraftCount: matchedDraftIds.size,
      skippedCount,
      sourceType,
    },
    items,
  })
})

productArchiveDrafts.get("/images/:imageId/file", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  const imageId = Number(c.req.param("imageId"))
  if (!Number.isInteger(imageId) || imageId <= 0) {
    throw new HTTPException(400, { message: "无效的图片 ID" })
  }
  const image = getProductArchiveDraftImageFile(db, imageId)
  const localPath = stringValue(image?.local_path)
  if (!image || !localPath) {
    throw new HTTPException(404, { message: "图片不存在" })
  }
  const mimeType = stringValue(image.mime_type).toLowerCase()
  const extension = path.extname(stringValue(image.file_name) || localPath).toLowerCase()
  if (mimeType === "application/pdf" || extension === ".pdf") {
    let file: Awaited<ReturnType<typeof assertLocalProductArchiveAssetFile>>
    try {
      file = await assertLocalProductArchiveAssetFile({ rootDir: DRAFT_IMAGE_DIR, filePath: localPath })
    } catch (error) {
      throw productArchiveDraftMutationException(error)
    }
    if (file.contentType === "application/pdf" && imageFileVariant(c.req.query("variant") ?? c.req.query("size")) === "thumbnail") {
      throw new HTTPException(400, { message: "PDF 文件不支持缩略图" })
    }
    return new Response(await readFile(file.realPath), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  }
  let file: Awaited<ReturnType<typeof assertLocalImageFile>>
  try {
    file = await assertLocalImageFile({ rootDir: DRAFT_IMAGE_DIR, filePath: localPath })
  } catch (error) {
    try {
      if (stringValue(image.source_type) === "crawshrimp_asset_package") {
        requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
      }
      const repaired = await repairLegacyDraftImageLocalPath(db, image as Record<string, unknown>)
      if (!repaired) throw error
      file = repaired
    } catch (repairError) {
      throw productArchiveDraftMutationException(repairError)
    }
  }
  const variant = imageFileVariant(c.req.query("variant") ?? c.req.query("size"))
  if (variant === "thumbnail") {
    const buffer = await sharp(file.realPath)
      .rotate()
      .resize(160, 160, { fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  }
  if (variant === "preview") {
    const buffer = await sharp(file.realPath)
      .rotate()
      .resize(960, 960, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  }
  return new Response(await readFile(file.realPath), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  })
})

productArchiveDrafts.post("/:draftId/images", productArchiveImageBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  const detail = getProductArchiveDraftDetail(db, draftId)
  const draft = detail.draft as Record<string, unknown>
  const { files, skippedCount } = await readDraftImageUploadFiles(c)
  const images = []
  try {
    for (const file of files) {
      const image = await saveDraftImageUpload({
        db,
        draft,
        file,
        sourceType: "manual_upload",
        sourceRef: file.originalFileName,
        uploadedBy: user.id,
      })
      if (image) images.push(image)
    }
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.image.uploaded",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `上传深绘建档 SPU 参考图 ${images.length} 张`,
    metadata: {
      importedCount: images.length,
      skippedCount,
      userId: user.id,
    },
  })
  return c.json({
    ok: images.length > 0,
    imported_count: images.length,
    skipped_count: skippedCount,
    images,
    detail: getProductArchiveDraftDetail(db, draftId),
  })
})

productArchiveDrafts.delete("/:draftId/images/:imageId", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  const imageId = Number(c.req.param("imageId"))
  if (!Number.isInteger(imageId) || imageId <= 0) {
    throw new HTTPException(400, { message: "无效的图片 ID" })
  }
  let image
  try {
    image = deleteProductArchiveDraftImage(db, draftId, imageId)
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  if (!image) {
    throw new HTTPException(404, { message: "图片不存在" })
  }
  const cleanup = await cleanupUnreferencedDraftImageFiles(db, [image.local_path])
  auditFromContext(c, {
    action: "draft.image.deleted",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `删除深绘建档 SPU 参考图 ${imageId}`,
    metadata: { imageId, userId: user.id },
  })
  return c.json({
    ok: true,
    cleanup_warnings: cleanup.warnings,
    detail: getProductArchiveDraftDetail(db, draftId),
  })
})

productArchiveDrafts.delete("/:draftId", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let result: ReturnType<typeof deleteProductArchiveDraft>
  try {
    result = deleteProductArchiveDraft(db, draftId)
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  if (!result) {
    throw new HTTPException(404, { message: "草稿不存在" })
  }
  await deleteDraftImageFiles(draftId, result.images)
  auditFromContext(c, {
    action: "draft.deleted",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `删除深绘建档草稿 ${stringValue(result.draft.spu_code) || draftId}`,
    metadata: {
      draftId,
      spuCode: stringValue(result.draft.spu_code),
      status: stringValue(result.draft.status),
      imageCount: result.images.length,
      userId: user.id,
    },
  })
  return c.json({ ok: true })
})

productArchiveDrafts.get("/:draftId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(getProductArchiveDraftDetail(db, readId(c.req.param("draftId"))))
})

productArchiveDrafts.patch("/:draftId/trade", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let result
  try {
    result = applyProductArchiveDraftTrade(db, draftId, await readJson(c))
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.trade.applied",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `应用深绘类目并生成字段 ${draftId}`,
    metadata: { tradeId: result.detail.draft.trade_id },
  })
  return c.json(result.detail)
})

productArchiveDrafts.patch("/:draftId/trade/confirm", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let detail
  try {
    detail = confirmProductArchiveDraftRecommendedTrade(db, draftId, await readJson(c))
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.trade.confirmed",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `确认深绘推荐类目 ${draftId}`,
    metadata: { tradeId: detail.draft.trade_id },
  })
  return c.json(detail)
})

productArchiveDrafts.patch("/:draftId/fields", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let result
  try {
    result = patchProductArchiveDraftFields(db, draftId, await readJson(c))
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.field.updated",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `更新深绘建档草稿字段 ${draftId}`,
  })
  return c.json(result.detail)
})

productArchiveDrafts.post("/:draftId/validate", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  try {
    const prepared = db.transaction(() => {
      const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
      const result = validateProductArchiveDraft(db, draftId)
      return { tradeRefresh, result }
    })()
    const { tradeRefresh, result } = prepared
    auditFromContext(c, {
      action: "draft.validated",
      module: "PRODUCT_ARCHIVE_DRAFT",
      entityType: "product_archive_draft",
      entityId: draftId,
      summary: `校验深绘建档草稿 ${draftId}`,
      metadata: { ...result.summary, tradeSelectionAutoApplied: tradeRefresh.autoApplied },
    })
    return c.json(result)
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
})

productArchiveDrafts.post("/:draftId/check-duplicate", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  try {
    return c.json(await checkDuplicateProductArchiveDraft(db, readId(c.req.param("draftId"))))
  } catch (error) {
    throw submitOperationException(error, "深绘查重失败")
  }
})

productArchiveDrafts.post("/:draftId/ai-fill", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let result
  try {
    result = await fillProductArchiveDraftFieldsWithAi(db, draftId)
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.ai_fill",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `AI 推荐补齐深绘建档草稿字段 ${draftId}`,
    metadata: { savedCount: result.saved.length },
  })
  return c.json(result)
})

productArchiveDrafts.post("/:draftId/size-chart/ai-recommend", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  const result = await recommendProductArchiveSizeChartMappings(db, draftId)
  auditFromContext(c, {
    action: "draft.size_chart.ai_recommend",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `AI 推荐尺码表映射 ${draftId}`,
    metadata: { source: result.source, mappingCount: result.mappings.length },
  })
  return c.json(result)
})

productArchiveDrafts.post("/:draftId/size-chart/mappings", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  let result
  try {
    result = saveProductArchiveSizeChartMappings(db, draftId, await readJson(c))
  } catch (error) {
    throw productArchiveDraftMutationException(error)
  }
  auditFromContext(c, {
    action: "draft.size_chart.mapping_saved",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `保存尺码表字段映射 ${draftId}`,
    metadata: { savedCount: result.saved.length },
  })
  return c.json(result)
})

productArchiveDrafts.post("/:draftId/submit", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  const body = await readJson(c)
  const dryRun = body.dryRun === true
  const updateExisting = body.updateExisting === true
  let result: unknown
  try {
    result = await submitProductArchiveDraft(db, draftId, { dryRun, updateExisting })
  } catch (error) {
    throw submitOperationException(error, dryRun ? "生成深绘提交预览失败" : updateExisting ? "更新深绘已有商品失败" : "发布到深绘失败")
  }
  auditFromContext(c, {
    action: dryRun ? "draft.submit.dry_run" : updateExisting ? "draft.submit.update" : "draft.submit.create",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `${dryRun ? "预览" : updateExisting ? "更新" : "提交"}深绘建档草稿 ${draftId}`,
  })
  return c.json(result)
})

productArchiveDrafts.post("/:draftId/readback", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  try {
    return c.json(await readbackProductArchiveDraft(db, readId(c.req.param("draftId"))))
  } catch (error) {
    throw submitOperationException(error, "深绘回读失败")
  }
})

productArchiveDrafts.get("/:draftId/logs", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json({ items: listProductArchiveSubmitLogs(db, readId(c.req.param("draftId"))) })
})

export default productArchiveDrafts
