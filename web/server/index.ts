import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { cors } from "hono/cors"
import { errorHandler, logger } from "./middleware/error-handler"
import metadata from "./routes/metadata"
import categoryMapping from "./routes/category-mapping"
import { DB_FILE } from "./db"

const app = new Hono()

app.use("*", cors())
app.use("*", logger)
app.onError(errorHandler)

app.get("/", (c) => c.json({ name: "listingfy-api", status: "ok", db: DB_FILE }))
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }))

app.route("/api/metadata", metadata)
app.route("/api/category-mapping", categoryMapping)

const port = Number(process.env.PORT ?? 3001)
console.log(`API server listening on http://localhost:${port}`)
console.log(`Database: ${DB_FILE}`)

serve({ fetch: app.fetch, port })
