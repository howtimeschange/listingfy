import { Hono, type Context } from "hono"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"
import { resolveSheinCredentials } from "../lib/platform-config"
import { sheinAdapter } from "../platform-adapters"

const sheinLifecycle = new Hono()

type LifecycleOperation =
  | "queryStoreSites"
  | "queryProductList"
  | "queryProductDetail"
  | "searchProducts"
  | "checkEditPermission"
  | "partialEditListing"
  | "addVariantsToListing"
  | "updateCost"
  | "revokeProduct"

function readPayload(value: unknown) {
  return value === undefined ? {} : value
}

async function body(c: Context) {
  return readPayload(await c.req.json().catch(() => ({})))
}

async function runLifecycleOperation(
  c: Context,
  operation: LifecycleOperation,
) {
  const payload = await body(c)
  const credentials = resolveSheinCredentials(getDb())
  const result = await sheinAdapter[operation]({ credentials, payload })
  return c.json(result)
}

function runReadOperation(c: Context, operation: LifecycleOperation) {
  requirePermission(c, "LISTING_READ")
  return runLifecycleOperation(c, operation)
}

function runWriteOperation(c: Context, operation: LifecycleOperation) {
  requirePermission(c, "PUBLISH_RUN")
  return runLifecycleOperation(c, operation)
}

sheinLifecycle.post("/sites", (c) => runReadOperation(c, "queryStoreSites"))

sheinLifecycle.post("/products/query", (c) => runReadOperation(c, "queryProductList"))

sheinLifecycle.post("/products/detail", (c) => runReadOperation(c, "queryProductDetail"))

sheinLifecycle.post("/products/search", (c) => runReadOperation(c, "searchProducts"))

sheinLifecycle.post("/products/check-edit-permission", (c) => (
  runReadOperation(c, "checkEditPermission")
))

sheinLifecycle.post("/products/partial-edit", (c) => runWriteOperation(c, "partialEditListing"))

sheinLifecycle.post("/products/add-variants", (c) => runWriteOperation(c, "addVariantsToListing"))

sheinLifecycle.post("/products/update-cost", (c) => runWriteOperation(c, "updateCost"))

sheinLifecycle.post("/products/revoke", (c) => runWriteOperation(c, "revokeProduct"))

export default sheinLifecycle
