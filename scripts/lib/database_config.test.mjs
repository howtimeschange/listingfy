import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseConfig } from "./database_config.mjs";

function withEnv(env, fn) {
  const previous = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
  }
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("getDatabaseConfig defaults to PostgreSQL and requires DATABASE_URL", () => {
  assert.throws(() => withEnv({
    DATABASE_PROVIDER: undefined,
    DATABASE_URL: undefined,
    APP_DB_PATH: undefined,
  }, () => getDatabaseConfig()), /DATABASE_URL is required for PostgreSQL/);
});

test("getDatabaseConfig selects PostgreSQL when DATABASE_URL is provided", () => {
  const config = withEnv({
    DATABASE_PROVIDER: undefined,
    DATABASE_URL: "postgres://listingify:secret@localhost:5432/listingify",
    APP_DB_PATH: "data/dev.sqlite",
  }, () => getDatabaseConfig());

  assert.equal(config.provider, "postgres");
  assert.equal(config.url, "postgres://listingify:secret@localhost:5432/listingify");
  assert.equal(config.sqlitePath, null);
});

test("getDatabaseConfig requires DATABASE_URL for explicit PostgreSQL mode", () => {
  assert.throws(() => withEnv({
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: undefined,
    APP_DB_PATH: undefined,
  }, () => getDatabaseConfig()), /DATABASE_URL is required for PostgreSQL/);
});

test("getDatabaseConfig respects an explicit migrations directory", () => {
  const config = getDatabaseConfig({
    DATABASE_PROVIDER: "postgres",
    DATABASE_URL: "postgres://listingify:secret@localhost:5432/listingify",
    DB_MIGRATIONS_DIR: "/tmp/listingify-migrations",
  });

  assert.equal(config.migrationsDir, "/tmp/listingify-migrations");
});

test("getDatabaseConfig rejects SQLite runtime configuration", () => {
  assert.throws(() => getDatabaseConfig({
    DATABASE_PROVIDER: "sqlite",
    APP_DB_PATH: "data/dev.sqlite",
  }), /requires PostgreSQL/);
});
