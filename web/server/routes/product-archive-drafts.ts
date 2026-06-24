import path from "node:path"
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
  submitProductArchiveDraft,
  validateProductArchiveDraft,
} from "../services/product-archive-drafts"

const productArchiveDrafts = new Hono()
const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()

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

productArchiveDrafts.get("/", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(listProductArchiveDrafts(db, {
    q: c.req.query("q"),
    status: c.req.query("status"),
    tenant: c.req.query("tenant"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  }))
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
  const deepdrawConfig = autoSyncMissingMdm && result.sourceType === "launch_plan"
    ? resolveDeepdrawConfig({
        projectRoot: PROJECT_ROOT,
        tenantName: body.deepdrawTenantName ?? body.tenantName,
      })
    : null
  const missingCodes = autoSyncMissingMdm && result.sourceType === "launch_plan"
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
      autoSyncMissingMdm,
      skippedExistingDraftCount: result.sourceType === "launch_plan" ? result.insertedRowCount - missingCodes.length : 0,
      missingMdmSpuCodes: missingCodes,
      syncJobId: syncJob?.id ?? null,
      userId: user.id,
    },
  })
  return c.json({ ...result, missingMdmSpuCodes: missingCodes, syncJob })
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
