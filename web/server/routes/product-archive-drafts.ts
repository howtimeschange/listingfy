import path from "node:path"
import os from "node:os"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"
import { auditFromContext } from "../lib/audit"
import { assertSafeProductArchiveCode } from "../lib/product-archive-security"
import { createProductArchiveSyncQueue } from "../../../scripts/lib/product_archive_sync_queue.mjs"
import { resolveDeepdrawConfig } from "../../../scripts/lib/deepdraw_client.mjs"
import { syncMdmProduct } from "../services/product-archive-sync"
import {
  applyProductArchiveDraftTrade,
  checkDuplicateProductArchiveDraft,
  createProductArchiveDraftFromSpu,
  fillProductArchiveDraftFieldsWithAi,
  getProductArchiveDraftDetail,
  importProductArchiveSourceRows,
  listProductArchiveDrafts,
  listProductArchiveSubmitLogs,
  missingDraftSpuCodes,
  patchProductArchiveDraftFields,
  readbackProductArchiveDraft,
  refreshProductArchiveDraftsFromSourceBatch,
  submitProductArchiveDraft,
  validateProductArchiveDraft,
} from "../services/product-archive-drafts"
import { importListingLaunchPlanSheets } from "../services/listing-launch-plans"
import { readSpreadsheetSheetsFromFile } from "../../../scripts/lib/listing_launch_plan_importer.mjs"

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

function safeUploadName(fileName: string) {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${Date.now()}-${base || "upload.xlsx"}`
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
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()))
  return filePath
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
  sourceType: "copywriting" | "launch_plan",
  createdBy?: number | null,
) {
  const filePath = await saveFormFile(file)
  try {
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: file.name })
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
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: file.name })
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

productArchiveDrafts.post("/workflow/start", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_WRITE")
  requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const form = await c.req.formData()
  const copywritingFile = form.get("copywritingFile")
  const launchPlanFile = form.get("launchPlanFile")
  const skipLaunchPlan = booleanFormValue(form.get("skipLaunchPlan"))
  const sourceBatchIdsByType: Record<string, number[]> = {}
  const refreshSummaries = []
  let copywritingImport = null
  let launchPlanImport = null

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
    sourceBatchIdsByType,
    refreshSummaries,
    syncJob,
  }, syncJob ? 202 : 200)
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
  const result = applyProductArchiveDraftTrade(db, draftId, await readJson(c))
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
  const result = validateProductArchiveDraft(db, draftId)
  auditFromContext(c, {
    action: "draft.validated",
    module: "PRODUCT_ARCHIVE_DRAFT",
    entityType: "product_archive_draft",
    entityId: draftId,
    summary: `校验深绘建档草稿 ${draftId}`,
    metadata: result.summary,
  })
  return c.json(result)
})

productArchiveDrafts.post("/:draftId/check-duplicate", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  return c.json(await checkDuplicateProductArchiveDraft(db, readId(c.req.param("draftId"))))
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

productArchiveDrafts.post("/:draftId/submit", async (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_SUBMIT")
  const db = getDb()
  const draftId = readId(c.req.param("draftId"))
  const body = await readJson(c)
  const result = await submitProductArchiveDraft(db, draftId, { dryRun: Boolean(body.dryRun) })
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
  return c.json(await readbackProductArchiveDraft(db, readId(c.req.param("draftId"))))
})

productArchiveDrafts.get("/:draftId/logs", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json({ items: listProductArchiveSubmitLogs(db, readId(c.req.param("draftId"))) })
})

export default productArchiveDrafts
