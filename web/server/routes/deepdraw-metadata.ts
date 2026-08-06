import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"
import {
  createMetadataSyncJob,
  claimNextMetadataSyncJob,
  createMetadataSyncScheduler,
  drainMetadataSyncJobs,
  getMetadataSyncJob,
  listDeepdrawTradeFields,
  listDeepdrawTrades,
  syncDeepdrawTradeFields,
  syncDeepdrawTrades,
  syncDeepdrawTenantMetadata,
  updateMetadataSyncJobProgress,
} from "../services/deepdraw-metadata"

const deepdrawMetadata = new Hono()
const PROJECT_ROOT =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd()

const metadataSyncWorkerId = `deepdraw-metadata-${process.pid}-${randomUUID()}`

function readTradeId(value: string) {
  const tradeId = String(value ?? "").trim()
  if (!tradeId || !/^[A-Za-z0-9_.:-]{1,80}$/.test(tradeId)) {
    throw new HTTPException(400, { message: "无效的深绘类目 ID" })
  }
  return tradeId
}

async function readJson(c: Context) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

function readFieldConcurrency(value: unknown) {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number > 0 ? number : 8
}

function readFieldRetryCount(value: unknown) {
  const number = Math.floor(Number(value))
  return Number.isFinite(number) && number >= 0 ? number : 2
}

async function drainSyncJobs() {
  await drainMetadataSyncJobs({
    claimNext: () => claimNextMetadataSyncJob(getDb(), { workerId: metadataSyncWorkerId }),
    processJob: async (job) => {
      let lastPersisted = 0
      const summary = await syncDeepdrawTenantMetadata(getDb(), {
        projectRoot: PROJECT_ROOT,
        tenantName: job.tenantName,
        includeFields: true,
        leafOnly: true,
        fieldConcurrency: job.fieldConcurrency,
        fieldRetryCount: job.fieldRetryCount,
        onProgress: (progress) => {
          if (progress.completed === progress.total || progress.completed - lastPersisted >= 25) {
            lastPersisted = progress.completed
            updateMetadataSyncJobProgress(getDb(), job.id, {
              workerId: metadataSyncWorkerId,
              totalCount: progress.total,
              completedCount: progress.completed,
              heartbeatAt: new Date().toISOString(),
            })
          }
        },
      })
      updateMetadataSyncJobProgress(getDb(), job.id, {
        workerId: metadataSyncWorkerId,
        status: "completed",
        totalCount: summary.fieldTradeCount,
        completedCount: summary.fieldTradeCount,
        fieldCount: summary.fieldCount,
        zeroFieldCount: summary.zeroFieldCount,
        failedTradeCount: summary.failedTradeCount,
        summary,
        finishedAt: new Date().toISOString(),
      })
    },
    markFailed: (job, error) => {
      updateMetadataSyncJobProgress(getDb(), job.id, {
        workerId: metadataSyncWorkerId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString(),
      })
    },
    heartbeat: (job) => {
      updateMetadataSyncJobProgress(getDb(), job.id, {
        workerId: metadataSyncWorkerId,
        heartbeatAt: new Date().toISOString(),
      })
    },
  })
}

const scheduleSyncJobs = createMetadataSyncScheduler(drainSyncJobs)

deepdrawMetadata.get("/trades", async (c) => {
  const refresh = c.req.query("refresh") === "1" || c.req.query("refresh") === "true"
  if (refresh) {
    requirePermission(c, "DEEPDRAW_METADATA_MANAGE")
    const summary = await syncDeepdrawTrades(getDb(), {
      tenantName: c.req.query("tenantName"),
    })
    return c.json({ ...summary, items: listDeepdrawTrades(getDb(), { tenantName: c.req.query("tenantName"), q: c.req.query("q") }) })
  }
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  return c.json({ items: listDeepdrawTrades(getDb(), { tenantName: c.req.query("tenantName"), q: c.req.query("q") }) })
})

deepdrawMetadata.get("/trades/:tradeId/fields", async (c) => {
  const tradeId = readTradeId(c.req.param("tradeId"))
  const refresh = c.req.query("refresh") === "1" || c.req.query("refresh") === "true"
  if (refresh) {
    requirePermission(c, "DEEPDRAW_METADATA_MANAGE")
    const summary = await syncDeepdrawTradeFields(getDb(), {
      tradeId,
      tenantName: c.req.query("tenantName"),
    })
    return c.json({
      ...summary,
      items: listDeepdrawTradeFields(getDb(), { tenantName: c.req.query("tenantName"), tradeId }),
    })
  }
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  return c.json({ items: listDeepdrawTradeFields(getDb(), { tenantName: c.req.query("tenantName"), tradeId }) })
})

deepdrawMetadata.post("/sync-jobs", async (c) => {
  requirePermission(c, "DEEPDRAW_METADATA_MANAGE")
  const body = await readJson(c)
  const tenantName = String(body.tenantName ?? body.tenant_name ?? "").trim() || undefined
  const fieldConcurrency = readFieldConcurrency(body.fieldConcurrency ?? body.field_concurrency)
  const fieldRetryCount = readFieldRetryCount(body.fieldRetryCount ?? body.field_retry_count)
  const job = createMetadataSyncJob(getDb(), {
    tenantName: tenantName ?? "",
    fieldConcurrency,
    fieldRetryCount,
  })
  scheduleSyncJobs()
  return c.json(job, 202)
})

deepdrawMetadata.get("/sync-jobs/:jobId", (c) => {
  requirePermission(c, "DEEPDRAW_METADATA_MANAGE")
  const job = getMetadataSyncJob(getDb(), c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "DeepDraw metadata sync job not found" })
  }
  if (job.status === "queued" || job.status === "running") scheduleSyncJobs()
  return c.json(job)
})

export function resumeDeepdrawMetadataSyncJobs() {
  scheduleSyncJobs()
}

export default deepdrawMetadata
