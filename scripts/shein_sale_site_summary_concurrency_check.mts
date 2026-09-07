import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createPostgresPool } from "./lib/postgres_db.mjs"

const databaseUrl = process.env.SHEIN_CONCURRENCY_CHECK_DATABASE_URL
if (!databaseUrl) {
  throw new Error("Set SHEIN_CONCURRENCY_CHECK_DATABASE_URL to an isolated PostgreSQL database; do not point this check at production.")
}
if (!process.argv.includes("--allow-isolated-db-write")) {
  throw new Error("Pass --allow-isolated-db-write after selecting an isolated database. This check writes and cleans up temporary SHEIN rows.")
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const worker = path.join(scriptDir, "shein_sale_site_summary_concurrency_worker.mts")
const tsx = path.join(projectRoot, "web", "node_modules", ".bin", "tsx")
const accountKey = `concurrency-check:${randomUUID()}`
const pool = createPostgresPool(databaseUrl)

function runWorker(input: { spuName: string; siteAbbr: string; shelfStatus: number }) {
  const payload = Buffer.from(JSON.stringify({ databaseUrl, accountKey, ...input })).toString("base64url")
  return new Promise<void>((resolve, reject) => {
    const child = spawn(tsx, [worker, payload], {
      cwd: projectRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_PROVIDER: "postgres" },
      stdio: "inherit",
    })
    child.once("error", reject)
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Concurrency worker exited ${code ?? "unknown"}`)))
  })
}

async function activeCount(siteAbbr: string) {
  const result = await pool.query(`
    select active_product_count
    from shein_platform_sale_site_summary
    where platform = 'SHEIN'
      and platform_account_key = $1
      and site_abbr = $2
  `, [accountKey, siteAbbr])
  return Number(result.rows[0]?.active_product_count ?? 0)
}

try {
  await Promise.all([
    runWorker({ spuName: "SPU-SAME", siteAbbr: "DE", shelfStatus: 1 }),
    runWorker({ spuName: "SPU-SAME", siteAbbr: "DE", shelfStatus: 1 }),
  ])
  if (await activeCount("DE") !== 1) throw new Error("Concurrent same-SPU shelf-on did not converge to one active product")

  await Promise.all([
    runWorker({ spuName: "SPU-SAME", siteAbbr: "DE", shelfStatus: 0 }),
    runWorker({ spuName: "SPU-SAME", siteAbbr: "DE", shelfStatus: 0 }),
  ])
  if (await activeCount("DE") !== 0) throw new Error("Concurrent same-SPU shelf-off did not converge to zero active products")

  await Promise.all([
    runWorker({ spuName: "SPU-FIRST", siteAbbr: "FR", shelfStatus: 1 }),
    runWorker({ spuName: "SPU-SECOND", siteAbbr: "FR", shelfStatus: 1 }),
  ])
  if (await activeCount("FR") !== 2) throw new Error("Concurrent different-SPU shelf-on did not converge to two active products")

  process.stdout.write("SHEIN sale-site summary PostgreSQL concurrency check passed\n")
} finally {
  await pool.query(`delete from shein_platform_product where platform = 'SHEIN' and platform_account_key = $1`, [accountKey])
  await pool.query(`delete from shein_platform_sale_site_summary where platform = 'SHEIN' and platform_account_key = $1`, [accountKey])
  await pool.end()
}
