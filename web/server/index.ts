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
import prePublish from "./routes/pre-publish"
import { DB_FILE } from "./db"

loadLocalEnv()

const app = new Hono()

app.use("*", cors())
app.use("*", logger)
app.onError(errorHandler)

app.get("/", (c) => c.json({ name: "listingfy-api", status: "ok", db: DB_FILE }))
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }))

app.route("/api/metadata", metadata)
app.route("/api/category-mapping", categoryMapping)
app.route("/api/product-archives", productArchives)
app.route("/api/mdm-products", mdmProducts)
app.route("/api/deepdraw-content", deepdrawContent)
app.route("/api/image-library", imageLibrary)
app.route("/api/business-rules", businessRules)
app.route("/api/pre-publish", prePublish)

const port = Number(process.env.PORT ?? 3001)
console.log(`API server listening on http://localhost:${port}`)
console.log(`Database: ${DB_FILE}`)

serve({ fetch: app.fetch, port })
