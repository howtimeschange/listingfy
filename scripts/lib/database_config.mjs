import path from "node:path";

function resolveMigrationsDir(env) {
  return env.DB_MIGRATIONS_DIR
    ? path.resolve(env.DB_MIGRATIONS_DIR)
    : path.resolve("db", "migrations");
}

function normalizeProvider(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "postgresql") return "postgres";
  if (normalized === "pg") return "postgres";
  if (normalized === "postgres") return normalized;
  throw new Error(`Unsupported DATABASE_PROVIDER: ${value}. Listingify runtime requires PostgreSQL.`);
}

export function getDatabaseConfig(env = process.env) {
  const explicitProvider = normalizeProvider(env.DATABASE_PROVIDER);
  const provider = explicitProvider ?? "postgres";

  if (provider === "postgres") {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for PostgreSQL.");
    }
    return {
      provider,
      url: env.DATABASE_URL,
      sqlitePath: null,
      migrationsDir: resolveMigrationsDir(env),
    };
  }
}
