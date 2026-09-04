import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { loadLocalEnv } from "../../scripts/lib/local_env.mjs"
import { validateProductArchivePerformanceEnv } from "../../scripts/lib/product_archive_performance_config.mjs"
import { errorHandler, logger } from "./middleware/error-handler"
import metadata from "./routes/metadata"
import categoryMapping from "./routes/category-mapping"
import productArchives, { resumeProductArchiveSyncQueue } from "./routes/product-archives"
import productArchiveDrafts, { resumeProductArchiveDraftQueue, resumeProductArchiveWorkflowJobs } from "./routes/product-archive-drafts"
import deepdrawFieldMappings from "./routes/deepdraw-field-mappings"
import shoeSizeCharts from "./routes/shoe-size-charts"
import mdmProducts from "./routes/mdm-products"
import deepdrawContent from "./routes/deepdraw-content"
import deepdrawMetadata, { resumeDeepdrawMetadataSyncJobs } from "./routes/deepdraw-metadata"
import imageLibrary from "./routes/image-library"
import businessRules from "./routes/business-rules"
import sheinProducts from "./routes/shein-products"
import sheinLifecycle from "./routes/shein-lifecycle"
import sheinPlatformProducts from "./routes/shein-platform-products"
import sheinOperations from "./routes/shein-operations"
import { startPlatformProductNightlyFullSyncScheduler } from "./services/shein-platform-product-jobs"
import prePublish from "./routes/pre-publish"
import publishTasks from "./routes/publish-tasks"
import listingBatches from "./routes/listing-batches"
import listingLaunchPlans from "./routes/listing-launch-plans"
import auth from "./routes/auth"
import users from "./routes/users"
import platformIntegrations from "./routes/platform-integrations"
import system from "./routes/system"
import { applyPendingMigrations, closeAsyncPool, closeDb, DB_DSN_SAFE, DB_PROVIDER, getDb } from "./db"
import { ensureAdminUser, requireAuth } from "./lib/auth"
import { withRequestPerformanceContext } from "./lib/performance-metrics"
import {
  assertCredentialEncryptionConfigured,
  encryptStoredPlatformCredentials,
  ensurePlatformIntegrationBootstrap,
} from "./lib/platform-config"
import { randomUUID } from "node:crypto"

loadLocalEnv()
validateProductArchivePerformanceEnv()
assertCredentialEncryptionConfigured()

const db = getDb()
const appliedMigrations = applyPendingMigrations(db)
const adminSeeded = ensureAdminUser(db)
const sheinConfigSeeded = ensurePlatformIntegrationBootstrap(db)
const encryptedPlatformCredentials = encryptStoredPlatformCredentials(db)
resumeProductArchiveSyncQueue()
resumeProductArchiveDraftQueue()
resumeProductArchiveWorkflowJobs()
resumeDeepdrawMetadataSyncJobs()

const app = new Hono()

const allowedOrigins = (process.env.LISTINGIFY_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
if (allowedOrigins.includes("*")) {
  throw new Error("LISTINGIFY_ALLOWED_ORIGINS cannot contain '*' when credentialed CORS is enabled")
}
function isLocalDevOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  } catch {
    return false
  }
}
const corsOptions = {
  origin: (origin: string) => {
    if (!origin) return null
    if (allowedOrigins.length === 0 && isLocalDevOrigin(origin)) return origin
    return allowedOrigins.includes(origin) ? origin : null
  },
  credentials: true,
}

app.use("*", async (c, next) => {
  const incomingRequestId = c.req.header("x-request-id")?.trim()
  const requestId = incomingRequestId && incomingRequestId.length <= 128 ? incomingRequestId : randomUUID()
  c.header("x-request-id", requestId)
  await withRequestPerformanceContext(requestId, `${c.req.method} ${c.req.path}`, () => next())
})
app.use("*", cors(corsOptions))
app.use("*", logger)
app.onError(errorHandler)

app.get("/", (c) => c.json({ name: "listingify-api", status: "ok", dbProvider: DB_PROVIDER, db: DB_DSN_SAFE }))
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }))

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/auth/login" || c.req.path === "/api/health") {
    await next()
    return
  }
  await requireAuth(c, next)
})

app.route("/api/auth", auth)
app.route("/api/users", users)
app.route("/api/platform-integrations", platformIntegrations)
app.route("/api/system", system)
app.route("/api/metadata", metadata)
app.route("/api/category-mapping", categoryMapping)
app.route("/api/product-archives", productArchives)
app.route("/api/product-archive-drafts", productArchiveDrafts)
app.route("/api/deepdraw-field-mappings", deepdrawFieldMappings)
app.route("/api/shoe-size-charts", shoeSizeCharts)
app.route("/api/mdm-products", mdmProducts)
app.route("/api/deepdraw-content", deepdrawContent)
app.route("/api/deepdraw-metadata", deepdrawMetadata)
app.route("/api/image-library", imageLibrary)
app.route("/api/business-rules", businessRules)
app.route("/api/shein-products", sheinProducts)
app.route("/api/shein-lifecycle", sheinLifecycle)
app.route("/api/shein-platform-products", sheinPlatformProducts)
app.route("/api/shein-operations", sheinOperations)
app.route("/api/pre-publish", prePublish)
app.route("/api/publish-tasks", publishTasks)
app.route("/api/listing-batches", listingBatches)
app.route("/api/listing-launch-plans", listingLaunchPlans)

const port = Number(process.env.PORT ?? 3001)
console.log(`API server listening on http://localhost:${port}`)
console.log(`Database: ${DB_PROVIDER} ${DB_DSN_SAFE}`)
if (appliedMigrations.length) console.log(`Applied migrations: ${appliedMigrations.join(", ")}`)
if (adminSeeded) console.log("Seeded configured admin user")
if (sheinConfigSeeded) console.log("Migrated SHEIN env credentials into platform_integration")
if (encryptedPlatformCredentials) console.log(`Encrypted platform credentials: ${encryptedPlatformCredentials}`)

startPlatformProductNightlyFullSyncScheduler()
const server = serve({ fetch: app.fetch, port })

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; closing database pools`)
  server.close(() => {
    closeAsyncPool()
      .catch((error) => {
        console.error("Failed to close async database pool", error)
      })
      .finally(() => {
        closeDb()
        process.exit(0)
      })
  })
}

process.once("SIGINT", () => void shutdown("SIGINT"))
process.once("SIGTERM", () => void shutdown("SIGTERM"))
