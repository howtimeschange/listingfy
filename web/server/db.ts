import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { loadLocalEnv } from "../../scripts/lib/local_env.mjs"

const localEnv = loadLocalEnv()
const projectRoot = localEnv.filePath
  ? path.dirname(localEnv.filePath)
  : path.resolve(process.cwd(), "..")

// Web server is at <root>/web/server, db is at <root>/data/app.sqlite
const DB_PATH = process.env.APP_DB_PATH
  ? path.resolve(projectRoot, process.env.APP_DB_PATH)
  : path.resolve(projectRoot, "data", "app.sqlite")

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const db = new Database(DB_PATH, { fileMustExist: false })
  db.pragma("busy_timeout = 10000")
  db.pragma("journal_mode = WAL")
  db.pragma("synchronous = NORMAL")
  db.pragma("foreign_keys = ON")
  _db = db
  return db
}

export function applyPendingMigrations(db = getDb()): string[] {
  const migrationsDir = path.resolve(projectRoot, "db", "migrations")
  db.exec(`
    create table if not exists schema_migration (
      version text primary key,
      applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `)
  const applied = new Set(
    (db.prepare("select version from schema_migration").all() as Array<{ version: string }>)
      .map((row) => row.version),
  )
  const migrations = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const appliedNow: string[] = []
  for (const file of migrations) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    db.exec("begin immediate")
    try {
      db.exec(sql)
      db.prepare("insert into schema_migration(version) values (?)").run(file)
      db.exec("commit")
      appliedNow.push(file)
    } catch (error) {
      db.exec("rollback")
      throw error
    }
  }
  return appliedNow
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

export const DB_FILE = DB_PATH
