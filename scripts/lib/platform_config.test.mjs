import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const requireFromWeb = createRequire(path.join(PROJECT_ROOT, "web/package.json"));
const Database = requireFromWeb("better-sqlite3");

const {
  ensurePlatformIntegrationBootstrap,
  maskSecret,
  platformIntegrationForResponse,
  resolveSheinCredentials,
} = await import("../../web/server/lib/platform-config.ts");

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-platform-config-"));
  const db = new Database(path.join(tempPath, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table platform_integration (
      id integer primary key autoincrement,
      platform text not null,
      integration_name text not null,
      business_mode text not null default 'FULL_MANAGED',
      environment text not null default 'TEST',
      status text not null default 'ACTIVE',
      base_url text,
      language text,
      open_key_id text,
      secret_key text,
      app_id text,
      app_secret_key text,
      is_default integer not null default 0,
      last_test_status text,
      last_test_message text,
      last_tested_at text,
      raw_payload_json text not null default '{}',
      created_by integer,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      unique(platform, integration_name)
    );
  `);
  return {
    db,
    async cleanup() {
      db.close();
      await rm(tempPath, { recursive: true, force: true });
    },
  };
}

function withEnv(values, fn) {
  const previous = new Map();
  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key]);
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("bootstraps SHEIN platform integration from existing env values", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    await withEnv({
      SHEIN_BASE_URL: "https://openapi.example.test",
      SHEIN_LANGUAGE: "zh-cn",
      SHEIN_OPEN_KEY_ID: "env-open-key",
      SHEIN_SECRET_KEY: "env-secret-key",
    }, () => {
      const seeded = ensurePlatformIntegrationBootstrap(db);
      assert.equal(seeded, true);
    });

    const row = db.prepare("select * from platform_integration where platform = 'SHEIN'").get();
    assert.equal(row.integration_name, "SHEIN 默认全托管账号");
    assert.equal(row.open_key_id, "env-open-key");
    assert.equal(row.secret_key, "env-secret-key");
    assert.equal(row.base_url, "https://openapi.example.test");
    assert.equal(row.is_default, 1);
  } finally {
    await cleanup();
  }
});

test("database SHEIN credentials win over environment credentials", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into platform_integration (
        platform, integration_name, status, base_url, language, open_key_id, secret_key, is_default
      ) values ('SHEIN', 'SHEIN 数据库账号', 'ACTIVE', 'https://db.example.test', 'en', 'db-open-key', 'db-secret-key', 1)
    `).run();

    await withEnv({
      SHEIN_BASE_URL: "https://env.example.test",
      SHEIN_LANGUAGE: "zh-cn",
      SHEIN_OPEN_KEY_ID: "env-open-key",
      SHEIN_SECRET_KEY: "env-secret-key",
    }, () => {
      const credentials = resolveSheinCredentials(db);
      assert.equal(credentials.source, "database");
      assert.equal(credentials.openKeyId, "db-open-key");
      assert.equal(credentials.secretKey, "db-secret-key");
      assert.equal(credentials.baseUrl, "https://db.example.test");
      assert.equal(credentials.language, "en");
    });
  } finally {
    await cleanup();
  }
});

test("inactive database SHEIN credentials fall back to environment credentials", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    db.prepare(`
      insert into platform_integration (
        platform, integration_name, status, base_url, language, open_key_id, secret_key, is_default
      ) values ('SHEIN', 'SHEIN 停用账号', 'INACTIVE', 'https://db.example.test', 'en', 'db-open-key', 'db-secret-key', 1)
    `).run();

    await withEnv({
      SHEIN_BASE_URL: "https://env.example.test",
      SHEIN_LANGUAGE: "zh-cn",
      SHEIN_OPEN_KEY_ID: "env-open-key",
      SHEIN_SECRET_KEY: "env-secret-key",
    }, () => {
      const credentials = resolveSheinCredentials(db);
      assert.equal(credentials.source, "environment");
      assert.equal(credentials.openKeyId, "env-open-key");
      assert.equal(credentials.secretKey, "env-secret-key");
      assert.equal(credentials.baseUrl, "https://env.example.test");
      assert.equal(credentials.language, "zh-cn");
    });
  } finally {
    await cleanup();
  }
});

test("platform integration responses mask secret values", async () => {
  assert.equal(maskSecret("abcdef1234567890"), "abcd********7890");
  assert.equal(maskSecret("short"), "********");
  assert.equal(maskSecret(null), null);

  const response = platformIntegrationForResponse({
    id: 1,
    platform: "SHEIN",
    integration_name: "SHEIN 默认全托管账号",
    business_mode: "FULL_MANAGED",
    environment: "TEST",
    status: "ACTIVE",
    base_url: "https://openapi.example.test",
    language: "zh-cn",
    open_key_id: "open-key-123456",
    secret_key: "secret-key-123456",
    app_id: null,
    app_secret_key: null,
    is_default: 1,
    last_test_status: null,
    last_test_message: null,
    last_tested_at: null,
    raw_payload_json: "{}",
    created_by: null,
    created_at: "2026-04-30T00:00:00.000Z",
    updated_at: "2026-04-30T00:00:00.000Z",
  });

  assert.equal(response.open_key_id, undefined);
  assert.equal(response.secret_key, undefined);
  assert.equal(response.open_key_mask, "open********3456");
  assert.equal(response.secret_mask, "secr********3456");
  assert.equal(response.has_open_key, true);
});
