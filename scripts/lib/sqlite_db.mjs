import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_DB_PATH = path.resolve("data", "app.sqlite");

export function openDatabase(dbPath = DEFAULT_DB_PATH, options = {}) {
  const { configureJournal = true } = options;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    pragma busy_timeout = 10000;
    pragma foreign_keys = on;
  `);
  if (configureJournal) {
    db.exec(`
    pragma journal_mode = wal;
    pragma synchronous = normal;
  `);
  }
  return db;
}

export function applyMigrations(db, migrationsDir = path.resolve("db", "migrations")) {
  db.exec(`
    create table if not exists schema_migration (
      version text primary key,
      applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const applied = new Set(
    db.prepare("select version from schema_migration").all().map((row) => row.version),
  );

  const migrations = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const appliedNow = [];
  for (const file of migrations) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec("begin immediate");
    try {
      db.exec(sql);
      db.prepare("insert into schema_migration(version) values (?)").run(file);
      db.exec("commit");
      appliedNow.push(file);
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }

  return appliedNow;
}

export function runInTransaction(db, fn) {
  db.exec("begin immediate");
  try {
    const result = fn();
    db.exec("commit");
    return result;
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
}

export function json(value) {
  return JSON.stringify(value ?? null);
}

export function boolInt(value) {
  return value ? 1 : 0;
}
