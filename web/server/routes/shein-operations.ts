import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { requirePermission } from "../lib/auth"
import {
  checkSupplierSkuRepeated,
  createBarcodePrintTask,
  createRegressionLog,
  listAuditStatus,
  listBarcodePrintTasks,
  listBarcodeSizes,
  listCostChangeReasons,
  listNumberList,
  listRegressionLogs,
  listSupplierSkuChecks,
  operationActorFromContext,
  syncAuditStatus,
  syncBarcodeSizes,
  syncCostChangeReasons,
  syncNumberList,
  updateAuditHandling,
} from "../services/shein-operations"

const sheinOperations = new Hono()

async function jsonBody(c: Context) {
  return await c.req.json().catch(() => ({}))
}

function listParams(c: Context) {
  return {
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    search: c.req.query("search"),
    scenario: c.req.query("scenario"),
    handledStatus: c.req.query("handled_status") ?? c.req.query("handledStatus"),
  }
}

sheinOperations.post("/p0-regression/logs", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(createRegressionLog(await jsonBody(c), operationActorFromContext(c)))
})

sheinOperations.get("/p0-regression/logs", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listRegressionLogs(listParams(c)))
})

sheinOperations.post("/platform-identities/number-list/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncNumberList(await jsonBody(c)))
})

sheinOperations.get("/platform-identities/number-list", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listNumberList(listParams(c)))
})

sheinOperations.post("/platform-identities/supplier-sku/check", async (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(await checkSupplierSkuRepeated(await jsonBody(c)))
})

sheinOperations.get("/platform-identities/supplier-sku/checks", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listSupplierSkuChecks(listParams(c)))
})

sheinOperations.post("/barcodes/batch-skc-size", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncBarcodeSizes(await jsonBody(c)))
})

sheinOperations.get("/barcodes/sizes", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listBarcodeSizes(listParams(c)))
})

sheinOperations.post("/barcodes/print", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  return c.json(await createBarcodePrintTask(await jsonBody(c), operationActorFromContext(c)))
})

sheinOperations.get("/barcodes/print-tasks", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listBarcodePrintTasks(listParams(c)))
})

sheinOperations.post("/price-reasons/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncCostChangeReasons(await jsonBody(c)))
})

sheinOperations.get("/price-reasons", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listCostChangeReasons())
})

sheinOperations.get("/audit-status", (c) => {
  requirePermission(c, "LISTING_READ")
  return c.json(listAuditStatus(listParams(c)))
})

sheinOperations.post("/audit-status/sync", async (c) => {
  requirePermission(c, "SYNC_RUN")
  return c.json(await syncAuditStatus(await jsonBody(c)))
})

sheinOperations.patch("/audit-status/:id/handling", async (c) => {
  requirePermission(c, "PUBLISH_RUN")
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id) || id <= 0) throw new HTTPException(400, { message: "无效审核状态 ID" })
  return c.json(updateAuditHandling(id, await jsonBody(c), operationActorFromContext(c)))
})

export default sheinOperations
