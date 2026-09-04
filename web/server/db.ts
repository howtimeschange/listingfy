import fs from "node:fs"
import path from "node:path"
import { getDatabaseConfig } from "../../scripts/lib/database_config.mjs"
import { loadLocalEnv } from "../../scripts/lib/local_env.mjs"
import { SyncPostgresDatabase } from "../../scripts/lib/postgres_db.mjs"
import { createPostgresPool } from "../../scripts/lib/postgres_db.mjs"
import { listMigrationFiles } from "../../scripts/lib/migration_files.mjs"
import { recordDatabaseQuery } from "./lib/performance-metrics"

const localEnv = loadLocalEnv()
const projectRoot = localEnv.filePath
  ? path.dirname(localEnv.filePath)
  : path.resolve(process.cwd(), "..")
const databaseConfig = getDatabaseConfig({
  ...process.env,
  DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? "postgres",
  DB_MIGRATIONS_DIR: path.resolve(projectRoot, "db", "migrations"),
})

if (databaseConfig.provider !== "postgres") {
  throw new Error("Listingify now requires PostgreSQL for the web API. Set DATABASE_URL and DATABASE_PROVIDER=postgres.")
}

const migrationsDir = path.resolve(projectRoot, "db", "migrations")
export const DATA_DIR = path.resolve(projectRoot, "data")

function redactDatabaseUrl(url: string | null): string | null {
  return url?.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@") ?? null
}

let _db: SyncPostgresDatabase | null = null
let _asyncPool: ReturnType<typeof createPostgresPool> | null = null

export function getDb(): SyncPostgresDatabase {
  if (_db) return _db
  const db = new SyncPostgresDatabase(databaseConfig.url, {
    onQuery: recordDatabaseQuery,
  })
  _db = db
  return db
}

export function getAsyncPool(): ReturnType<typeof createPostgresPool> {
  if (_asyncPool) return _asyncPool
  _asyncPool = createPostgresPool(databaseConfig.url, {
    max: process.env.DATABASE_POOL_MAX,
    idleTimeoutMillis: process.env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: process.env.DATABASE_CONNECT_TIMEOUT_MS,
  })
  return _asyncPool
}

export function applyPendingMigrations(db = getDb()): string[] {
  db.exec(`
    create table if not exists schema_migration (
      version text primary key,
      applied_at text not null default (to_char((clock_timestamp() at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );
  `)
  const applied = new Set(
    (db.prepare("select version from schema_migration").all() as Array<{ version: string }>)
      .map((row) => row.version),
  )
  const migrations = listMigrationFiles(migrationsDir)
  const appliedNow: string[] = []
  for (const file of migrations) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    db.transaction(() => {
      db.exec(sql)
      db.syncIdentitySequences()
      db.prepare("insert into schema_migration(version) values (?)").run(file)
    })()
    appliedNow.push(file)
  }
  return appliedNow
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

export async function closeAsyncPool(): Promise<void> {
  if (!_asyncPool) return
  const pool = _asyncPool
  _asyncPool = null
  await pool.end()
}

export const DB_DSN_SAFE = redactDatabaseUrl(databaseConfig.url)
export const DB_PROVIDER = databaseConfig.provider
