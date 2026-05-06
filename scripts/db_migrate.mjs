#!/usr/bin/env node

import path from "node:path";
import { getDatabaseConfig } from "./lib/database_config.mjs";
import { loadLocalEnv } from "./lib/local_env.mjs";
import { applyPostgresMigrations, createPostgresPool } from "./lib/postgres_db.mjs";

loadLocalEnv();

function parseArgs(argv) {
  const args = {
    databaseUrl: process.env.DATABASE_URL,
    migrationsDir: process.env.DB_MIGRATIONS_DIR || path.resolve("db", "migrations"),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--database-url") args.databaseUrl = next();
    else if (arg === "--migrations-dir") args.migrationsDir = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  args.migrationsDir = path.resolve(args.migrationsDir);
  return args;
}

function usage() {
  process.stdout.write(`Database migration

Options:
  --database-url <url>            PostgreSQL connection URL. Default: DATABASE_URL.
  --migrations-dir <path>         SQL migrations directory. Default: db/migrations

Examples:
  npm run db:migrate
  DATABASE_URL=postgres://listingify:listingify@localhost:5432/listingify npm run db:migrate
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const config = getDatabaseConfig({
  ...process.env,
  DATABASE_PROVIDER: "postgres",
  DATABASE_URL: args.databaseUrl,
  DB_MIGRATIONS_DIR: args.migrationsDir,
});

const pool = createPostgresPool(config.url);
try {
  const appliedNow = await applyPostgresMigrations(pool, config.migrationsDir);
  process.stdout.write(`${JSON.stringify({
    provider: config.provider,
    database_url: config.url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@"),
    migrations_dir: config.migrationsDir,
    applied: appliedNow,
  }, null, 2)}\n`);
} finally {
  await pool.end();
}
