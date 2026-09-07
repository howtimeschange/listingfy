import { getDatabaseConfig } from "./lib/database_config.mjs"
import { loadLocalEnv } from "./lib/local_env.mjs"
import { createPostgresPool } from "./lib/postgres_db.mjs"
import { reconcileSheinSaleSiteSummary } from "./lib/shein_sale_site_summary.mjs"

loadLocalEnv()
const config = getDatabaseConfig({
  ...process.env,
  DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? "postgres",
})
const pool = createPostgresPool(config.url)
try {
  const result = await reconcileSheinSaleSiteSummary(pool)
  process.stdout.write(`${JSON.stringify(result)}\n`)
} finally {
  await pool.end()
}
