import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { requirePermission } from "../lib/auth"
import {
  addVariantsToProduct,
  batchSyncProductDocumentStates,
  checkEditPermission,
  fieldEditProduct,
  getProductEditTemplate,
  getProductDetail,
  getProductVariantTemplate,
  lifecycleActorFromContext,
  listPlatformProducts,
  listStoreSites,
  partialEditProduct,
  retryLifecycleOperation,
  revokeProduct,
  syncPlatformProducts,
  syncProductDocumentState,
  syncProductDetail,
  syncStoreSites,
  updateProductCost,
} from "../services/shein-platform-products"
import {
  enqueuePlatformProductExportJob,
  enqueuePlatformProductSyncJob,
  getPlatformProductSyncScheduleConfig,
  getPlatformProductExportJob,
  getPlatformProductSyncJob,
  readPlatformProductExportFile,
  savePlatformProductSyncScheduleConfig,
} from "../services/shein-platform-product-jobs"

const sheinPlatformProducts = new Hono()

async function jsonBody(c: Context) {
  return await c.req.json().catch(() => ({}))
}

function spuNameParam(c: Context) {
  const spuName = c.req.param("spuName").trim()
  if (!spuName) throw new HTTPException(400, { message: "缺少 SHEIN spuName" })
  return spuName
}

sheinPlatformProducts.get("/", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listPlatformProducts({
    limit: Number(c.req.query("limit") ?? 50),
    offset: Number(c.req.query("offset") ?? 0),
    search: c.req.query("search") ?? "",
    brand: c.req.query("brand") ?? "",
    category: c.req.query("category") ?? "",
    site: c.req.query("site") ?? "",
    includeDetails: c.req.query("includeDetails") ?? c.req.query("details") ?? "",
  }))
})

sheinPlatformProducts.post("/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncPlatformProducts(await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/sync-jobs", async (c) => {
  requirePermission(c, "SYNC_RUN")
  const job = enqueuePlatformProductSyncJob(await jsonBody(c), lifecycleActorFromContext(c))
  return c.json(job, 202)
})

sheinPlatformProducts.get("/sync-jobs/:jobId", (c) => {
  requirePermission(c, "SYNC_RUN")
  const job = getPlatformProductSyncJob(c.req.param("jobId"))
  if (!job) throw new HTTPException(404, { message: "平台商品同步任务不存在" })
  return c.json(job)
})

sheinPlatformProducts.get("/sync-schedule", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(getPlatformProductSyncScheduleConfig())
})

sheinPlatformProducts.put("/sync-schedule", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(savePlatformProductSyncScheduleConfig(await jsonBody(c)))
})

sheinPlatformProducts.post("/export-jobs", async (c) => {
  requirePermission(c, "LISTING_READ")
  const job = enqueuePlatformProductExportJob(await jsonBody(c))
  return c.json(job, 202)
})

sheinPlatformProducts.get("/export-jobs/:jobId", (c) => {
  requirePermission(c, "LISTING_READ")
  const job = getPlatformProductExportJob(c.req.param("jobId"))
  if (!job) throw new HTTPException(404, { message: "平台商品导出任务不存在" })
  return c.json(job)
})

sheinPlatformProducts.get("/export-jobs/:jobId/download", async (c) => {
  requirePermission(c, "LISTING_READ")
  const result = await readPlatformProductExportFile(c.req.param("jobId"))
  if (!result) throw new HTTPException(404, { message: "平台商品导出任务不存在" })
  if (result.pending) throw new HTTPException(409, { message: "导出任务尚未完成" })
  const encodedName = encodeURIComponent(result.fileName)
  return c.body(result.buffer, 200, {
    "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "content-disposition": `attachment; filename*=UTF-8''${encodedName}`,
  })
})

sheinPlatformProducts.get("/sites", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listStoreSites())
})

sheinPlatformProducts.post("/sites/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncStoreSites(await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/status/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await batchSyncProductDocumentStates(await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/operations/:operationId/retry", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  const operationId = Number(c.req.param("operationId"))
  if (!Number.isFinite(operationId) || operationId <= 0) {
    throw new HTTPException(400, { message: "缺少有效的生命周期操作 ID" })
  }
  return c.json(await retryLifecycleOperation(operationId, await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.get("/:spuName/detail", (c) => {
  requirePermission(c, "LISTING_READ")
  const detail = getProductDetail(spuNameParam(c))
  if (!detail) throw new HTTPException(404, { message: "本地尚未同步该 SHEIN 平台商品详情" })
  return c.json(detail)
})

sheinPlatformProducts.post("/:spuName/sync-detail", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncProductDetail(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/:spuName/check-edit-permission", async (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(await checkEditPermission(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.get("/:spuName/edit-template", (c) => {
  requirePermission(c, "LISTING_READ")
  const template = getProductEditTemplate(spuNameParam(c))
  if (!template) throw new HTTPException(404, { message: "本地尚未同步该 SHEIN 平台商品详情，无法生成编辑模板" })
  return c.json(template)
})

sheinPlatformProducts.post("/:spuName/partial-edit", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await partialEditProduct(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/:spuName/field-edit", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await fieldEditProduct(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.get("/:spuName/variant-template", (c) => {
  requirePermission(c, "LISTING_READ")
  const template = getProductVariantTemplate(spuNameParam(c))
  if (!template) throw new HTTPException(404, { message: "本地尚未同步该 SHEIN 平台商品详情，无法生成拼款模板" })
  return c.json(template)
})

sheinPlatformProducts.post("/:spuName/add-variants", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await addVariantsToProduct(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/:spuName/update-cost", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await updateProductCost(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/:spuName/sync-status", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncProductDocumentState(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

sheinPlatformProducts.post("/:spuName/revoke", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await revokeProduct(spuNameParam(c), await jsonBody(c), lifecycleActorFromContext(c)))
})

export default sheinPlatformProducts
