import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { loadLocalEnv } from "../../scripts/lib/local_env.mjs"
import { errorHandler, logger } from "./middleware/error-handler"
import metadata from "./routes/metadata"
import categoryMapping from "./routes/category-mapping"
import productArchives from "./routes/product-archives"
import mdmProducts from "./routes/mdm-products"
import deepdrawContent from "./routes/deepdraw-content"
import imageLibrary from "./routes/image-library"
import businessRules from "./routes/business-rules"
import sheinProducts from "./routes/shein-products"
import prePublish from "./routes/pre-publish"
import publishTasks from "./routes/publish-tasks"
import listingBatches from "./routes/listing-batches"
import auth from "./routes/auth"
import users from "./routes/users"
import platformIntegrations from "./routes/platform-integrations"
import system from "./routes/system"
import { applyPendingMigrations, DB_FILE, getDb } from "./db"
import { ensureAdminUser, requireAuth } from "./lib/auth"
import { encryptStoredPlatformCredentials, ensurePlatformIntegrationBootstrap } from "./lib/platform-config"

loadLocalEnv()

const db = getDb()
const appliedMigrations = applyPendingMigrations(db)
const adminSeeded = ensureAdminUser(db)
const sheinConfigSeeded = ensurePlatformIntegrationBootstrap(db)
const encryptedPlatformCredentials = encryptStoredPlatformCredentials(db)

const app = new Hono()

const allowedOrigins = (process.env.LISTINGIFY_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
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
    if (allowedOrigins.includes("*")) return origin
    if (allowedOrigins.length === 0 && isLocalDevOrigin(origin)) return origin
    return allowedOrigins.includes(origin) ? origin : null
  },
  credentials: true,
}

app.use("*", cors(corsOptions))
app.use("*", logger)
app.onError(errorHandler)

app.get("/", (c) => c.json({ name: "listingify-api", status: "ok", db: DB_FILE }))
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
app.route("/api/mdm-products", mdmProducts)
app.route("/api/deepdraw-content", deepdrawContent)
app.route("/api/image-library", imageLibrary)
app.route("/api/business-rules", businessRules)
app.route("/api/shein-products", sheinProducts)
app.route("/api/pre-publish", prePublish)
app.route("/api/publish-tasks", publishTasks)
app.route("/api/listing-batches", listingBatches)

const port = Number(process.env.PORT ?? 3001)
console.log(`API server listening on http://localhost:${port}`)
console.log(`Database: ${DB_FILE}`)
if (appliedMigrations.length) console.log(`Applied migrations: ${appliedMigrations.join(", ")}`)
if (adminSeeded) console.log("Seeded default admin user")
if (sheinConfigSeeded) console.log("Migrated SHEIN env credentials into platform_integration")
if (encryptedPlatformCredentials) console.log(`Encrypted platform credentials: ${encryptedPlatformCredentials}`)

serve({ fetch: app.fetch, port })
