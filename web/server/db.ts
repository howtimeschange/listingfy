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

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

export const DB_FILE = DB_PATH
