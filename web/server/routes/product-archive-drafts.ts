import path from "node:path"
import os from "node:os"
import { mkdir, readFile, rm } from "node:fs/promises"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"
import { safeUploadFileName, writeValidatedUploadFile } from "../lib/upload-guard"
import { auditFromContext } from "../lib/audit"
import { assertSafeProductArchiveCode } from "../lib/product-archive-security"
import {
  getProductArchiveOcrRuntimeInfo,
  readScmHangtagWashlabelSupplementWorkbook,
  recognizeProductArchiveOcrFiles,
} from "../../../scripts/lib/product_archive_hangtag_ocr.mjs"
import {
  createPostgresProductArchiveSyncJobStore,
  createProductArchiveSyncQueue,
} from "../../../scripts/lib/product_archive_sync_queue.mjs"
import { resolveDeepdrawConfig } from "../../../scripts/lib/deepdraw_client.mjs"
import { syncMdmProduct } from "../services/product-archive-sync"
import {
  applyProductArchiveHangtagWashlabelOcr,
  previewProductArchiveHangtagWashlabelOcr,
} from "../services/product-archive-hangtag-ocr"
import {
  applyProductArchiveDraftTrade,
  checkDuplicateProductArchiveDraft,
  confirmProductArchiveDraftRecommendedTrade,
  createProductArchiveDraftFromSpu,
  fillProductArchiveDraftFieldsWithAi,
  getProductArchiveDraftDetail,
  importProductArchiveSourceRows,
  listProductArchiveDrafts,
  listProductArchiveSubmitLogs,
  missingDraftSpuCodes,
  patchProductArchiveDraftFields,
  readbackProductArchiveDraft,
  recommendProductArchiveSizeChartMappings,
  refreshDraftTradeSelectionFromLaunchPlan,
  refreshProductArchiveDraftsFromSourceBatch,
  saveProductArchiveSizeChartMappings,
  submitProductArchiveDraft,
  validateProductArchiveDraft,
} from "../services/product-archive-drafts"
import { importListingLaunchPlanSheets } from "../services/listing-launch-plans"
import { readSpreadsheetSheetsFromFile } from "../../../scripts/lib/listing_launch_plan_importer.mjs"
import { readPlmSizeChartWorkbook } from "../../../scripts/lib/product_archive_size_chart.mjs"

const productArchiveDrafts = new Hono()
const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")
const TEMPLATE_DIR = path.join(PROJECT_ROOT, "data", "product-archive-templates")
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

const draftQueue = createProductArchiveSyncQueue({
  autoRecover: false,
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
    return {
      mdm,
      draftId: detail.draft.id,
      draftNo: detail.draft.draft_no,
      status: detail.draft.status,
    }
  },
})

export function resumeProductArchiveDraftQueue() {
  draftQueue.resume()
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

function submitOperationException(error: unknown, prefix: string) {
  if (error instanceof HTTPException) return error
  const message = error instanceof Error ? error.message : String(error)
  const status = /草稿存在阻断|请选择|本地未找到|不存在|缺少|无效/.test(message) ? 400 : 502
  return new HTTPException(status, { message: `${prefix}：${message || "未知错误"}` })
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
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

function isIgnorableOcrFolderEntry(value: string) {
  const baseName = path.basename(value)
  return baseName === ".DS_Store" || baseName.startsWith("~$")
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
  const filePath = path.join(UPLOAD_DIR, safeUploadName(file.name))
  await writeValidatedUploadFile(file, "spreadsheet", filePath)
  return filePath
}

async function saveOcrFormFiles(c: Context) {
  const form = await c.req.formData()
  const displayNames = form.getAll("filePaths").map(stringValue)
  const rawFiles = [
    ...form.getAll("files"),
    ...form.getAll("file"),
    ...form.getAll("scmSupplementFile"),
    ...form.getAll("scmSupplement"),
    ...form.getAll("supplementFile"),
    ...form.getAll("workbook"),
  ].filter((value): value is File => value instanceof File && value.size > 0)
  const maxFileCount = Math.max(1, Math.min(Number(process.env.LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_FILES ?? 80) || 80, 200))
  if (rawFiles.length === 0) {
    throw new HTTPException(400, { message: "请上传 PDF 吊牌、JPG/PNG 洗唛或 SCM 下载结果 Excel" })
  }
  if (rawFiles.length > maxFileCount) {
    throw new HTTPException(400, { message: `单次最多导入 ${maxFileCount} 个吊牌/洗唛文件` })
  }
  await mkdir(UPLOAD_DIR, { recursive: true })
  const files = []
  const supplementFiles = []
  try {
    for (let index = 0; index < rawFiles.length; index += 1) {
      const file = rawFiles[index]
      const fileName = cleanUploadDisplayName(displayNames[index], file.name)
      if (isIgnorableOcrFolderEntry(fileName)) continue
      if (isScmSupplementWorkbookName(fileName)) {
        const filePath = path.join(UPLOAD_DIR, safeScmSupplementUploadName(file.name))
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
      if (!isProductArchiveOcrAssetName(fileName)) {
        throw new HTTPException(400, { message: "仅支持 PDF、JPG、PNG 吊牌/洗唛文件和 SCM 下载结果 .xlsx" })
      }
      const filePath = path.join(UPLOAD_DIR, safeOcrUploadName(file.name))
      await writeValidatedUploadFile(file, "product_archive_ocr", filePath)
      files.push({
        file,
        filePath,
        fileName,
        mimeType: file.type,
        size: file.size,
      })
    }
  } catch (error) {
    await Promise.all([...files, ...supplementFiles].map((file) => rm(file.filePath, { force: true })))
    throw error
  }
  if (files.length === 0 && supplementFiles.length === 0) {
    throw new HTTPException(400, { message: "请上传 PDF 吊牌、JPG/PNG 洗唛或 SCM 下载结果 Excel" })
  }
  return { form, files, supplementFiles }
}

function applyDocumentsFromBody(body: Record<string, unknown>) {
  if (Array.isArray(body.documents)) return body.documents
  if (!Array.isArray(body.items)) return []
  return body.items.map((item) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {}
    return {
      fileName: record.fileName,
      fileType: record.fileType,
      sourceKind: record.sourceKind,
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
    select distinct spu_code
    from product_archive_source_row
    where source_type = 'launch_plan'
      and spu_code in (${codes.map(() => "?").join(", ")})
  `).all(...codes) as Array<{ spu_code: unknown }>
  return new Set(uniqueStrings(rows.map((row) => row.spu_code)))
}

function launchPlanBatchIdsForSpuCodes(db: ReturnType<typeof getDb>, spuCodes: string[]) {
  const codes = uniqueStrings(spuCodes)
  if (codes.length === 0) return []
  const rows = db.prepare(`
    select distinct source_batch_id
    from product_archive_source_row
    where source_type = 'launch_plan'
      and spu_code in (${codes.map(() => "?").join(", ")})
    order by source_batch_id desc
  `).all(...codes) as Array<{ source_batch_id: unknown }>
  return rows.map((row) => Number(row.source_batch_id)).filter((id) => Number.isInteger(id) && id > 0)
}

function missingDraftCodesForCodes(db: ReturnType<typeof getDb>, spuCodes: string[], input: {
  tenantName?: string | null
  merchantId?: string | null
}) {
  const codes = uniqueStrings(spuCodes)
  if (codes.length === 0) return []
  const rows = db.prepare(`
    select distinct draft.spu_code
    from product_archive_draft draft
    where draft.tenant_name = ?
      and draft.merchant_id = ?
      and draft.spu_code in (${codes.map(() => "?").join(", ")})
  `).all(input.tenantName, input.merchantId, ...codes) as Array<{ spu_code: unknown }>
  const existing = new Set(uniqueStrings(rows.map((row) => row.spu_code)))
  return codes.filter((code) => !existing.has(code))
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
      const result = importProductArchiveSourceRows(db, {
        sourceType,
        fileName: file.name,
        sheetName: sheet.name,
        rows: sheet.rows,
      })
      const sourceBatchId = Number(result.batch.id)
      sourceBatchIds.push(sourceBatchId)
      inputRowCount += result.inputRowCount
      insertedRowCount += result.insertedRowCount
      refreshSummaries.push(refreshProductArchiveDraftsFromSourceBatch(db, {
        sourceBatchId,
        sourceType: result.sourceType,
      }))
    }
    const listingPlanImport = sourceType === "launch_plan"
      ? importListingLaunchPlanSheets(db, {
          fileName: file.name,
          fileSizeBytes: file.size,
          sheets,
          sourceBatchIds,
          createdBy,
        })
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
  if (sourceType === "size_chart") {
    const rows = await readPlmSizeChartWorkbook(filePath, { fileName })
    return [{
      name: "PLM尺码表",
      rows: rows.map((row) => row.rowJson ?? row),
    }]
  }
  return readSpreadsheetSheetsFromFile(filePath, { fileName })
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
  auditFromContext(c, {
    action: "draft.created",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: detail.draft.id,
    summary: `生成深绘建档草稿 ${spuCode}`,
    metadata: { spuCode, tenantName: detail.draft.tenant_name },
  })
  return c.json(detail)
})

productArchiveDrafts.post("/batch", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const body = await readJson(c)
  try {
    const job = draftQueue.enqueue({
      source: "draft",
      rawCodes: body.codes ?? body.rawCodes,
      intervalMs: body.intervalMs,
      options: {
        deepdrawTenantName: body.deepdrawTenantName ?? body.tenantName,
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
      metadata: { jobId: job.id, count: job.total_count },
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
    const job = draftQueue.enqueue({
      source: "mdm_draft",
      rawCodes: body.codes ?? body.rawCodes,
      intervalMs: body.intervalMs,
      options: {
        deepdrawTenantName: body.deepdrawTenantName ?? body.tenantName,
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
      metadata: { jobId: job.id, count: job.total_count, source: "mdm_draft" },
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
          sourceBatchId: Number(result.batch.id),
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

productArchiveDrafts.post("/source-imports/upload", async (c) => {
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
      const result = importProductArchiveSourceRows(db, {
        sourceType,
        fileName: file.name,
        sheetName: sheet.name,
        rows: sheet.rows,
      })
      const sourceBatchId = Number(result.batch.id)
      sourceBatchIds.push(sourceBatchId)
      inputRowCount += result.inputRowCount
      insertedRowCount += result.insertedRowCount
      const refreshSummary = refreshProductArchiveDraftsFromSourceBatch(db, {
        sourceBatchId,
        sourceType: result.sourceType,
      })
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
            sourceBatchId,
            createdBy: user.id,
          },
        }))
      }
    }

    const listingPlanImport = sourceType === "launch_plan"
      ? importListingLaunchPlanSheets(db, {
          fileName: file.name,
          fileSizeBytes: file.size,
          sheets,
          sourceBatchIds,
          createdBy: user.id,
        })
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

productArchiveDrafts.post("/size-chart/import", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const { file, filePath } = await saveUploadedSpreadsheet(c)
  try {
    const rows = await readPlmSizeChartWorkbook(filePath, { fileName: file.name })
    const result = importProductArchiveSourceRows(db, {
      sourceType: "size_chart",
      fileName: file.name,
      sheetName: "PLM尺码表",
      rows: rows.map((row) => row.rowJson ?? row),
    })
    const sourceBatchId = Number(result.batch.id)
    const refreshSummary = refreshProductArchiveDraftsFromSourceBatch(db, {
      sourceBatchId,
      sourceType: result.sourceType,
    })
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

productArchiveDrafts.post("/workflow/start", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const form = await c.req.formData()
  const copywritingFile = form.get("copywritingFile")
  const launchPlanFile = form.get("launchPlanFile")
  const sizeChartFile = form.get("sizeChartFile")
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
  const draftCodes = missingDraftCodesForCodes(db, candidateCodes, {
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

productArchiveDrafts.post("/hangtag-washlabel-ocr/preview", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const { form, files, supplementFiles } = await saveOcrFormFiles(c)
  try {
    const documents = await recognizeProductArchiveOcrFiles(files.map((file) => ({
      filePath: file.filePath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
    })))
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
      summary: `识别吊牌/洗唛文件 ${files.length} 个，SCM 补充表 ${supplementFiles.length} 个`,
      metadata: {
        fileCount: files.length,
        supplementFileCount: supplementFiles.length,
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
    })
  } finally {
    await Promise.all([...files, ...supplementFiles].map((file) => rm(file.filePath, { force: true })))
  }
})

productArchiveDrafts.post("/hangtag-washlabel-ocr/apply", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  const db = getDb()
  const body = await readJson(c)
  const documents = applyDocumentsFromBody(body)
  if (documents.length === 0) {
    throw new HTTPException(400, { message: "请先完成吊牌/洗唛 OCR 预览后再写入" })
  }
  const result = applyProductArchiveHangtagWashlabelOcr(db, {
    documents,
    overwriteExisting: booleanInputValue(body.overwriteExisting ?? body.overwrite_existing),
  })
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

productArchiveDrafts.get("/batch-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = draftQueue.getJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "Draft batch job not found" })
  }
  return c.json(job)
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
    const message = error instanceof Error ? error.message : String(error)
    if (message === "草稿数据已更新，请刷新后重试") {
      throw new HTTPException(409, { message })
    }
    throw error
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
    const message = error instanceof Error ? error.message : String(error)
    if (message === "推荐结果已更新，请刷新后重新确认") {
      throw new HTTPException(409, { message })
    }
    throw error
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
  const result = patchProductArchiveDraftFields(db, draftId, await readJson(c))
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
  const tradeRefresh = refreshDraftTradeSelectionFromLaunchPlan(db, draftId)
  const result = validateProductArchiveDraft(db, draftId)
  auditFromContext(c, {
    action: "draft.validated",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `校验深绘建档草稿 ${draftId}`,
    metadata: { ...result.summary, tradeSelectionAutoApplied: tradeRefresh.autoApplied },
  })
  return c.json(result)
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
  const result = await fillProductArchiveDraftFieldsWithAi(db, draftId)
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
  const result = saveProductArchiveSizeChartMappings(db, draftId, await readJson(c))
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
  let result: unknown
  try {
    result = await submitProductArchiveDraft(db, draftId, { dryRun: Boolean(body.dryRun) })
  } catch (error) {
    throw submitOperationException(error, body.dryRun ? "生成深绘提交预览失败" : "发布到深绘失败")
  }
  auditFromContext(c, {
    action: body.dryRun ? "draft.submit.dry_run" : "draft.submit.create",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `${body.dryRun ? "预览" : "提交"}深绘建档草稿 ${draftId}`,
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
