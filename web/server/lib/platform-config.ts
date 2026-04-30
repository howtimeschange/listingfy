import type Database from "better-sqlite3"

export interface PlatformIntegrationRow {
  id: number
  platform: string
  integration_name: string
  business_mode: string
  environment: string
  status: string
  base_url: string | null
  language: string | null
  open_key_id: string | null
  secret_key: string | null
  app_id: string | null
  app_secret_key: string | null
  is_default: number
  last_test_status: string | null
  last_test_message: string | null
  last_tested_at: string | null
  raw_payload_json: string
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface SheinCredentials {
  source: "database" | "environment"
  platformIntegrationId: number | null
  baseUrl: string
  language: string
  openKeyId: string
  secretKey: string
}

const SHEIN_TEST_BASE_URL = "https://openapi-test01.sheincorp.cn"

function env(name: string, fallback = "") {
  const value = process.env[name]
  return value === undefined || value === "" ? fallback : value
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= 8) return "********"
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

export function platformIntegrationForResponse(row: PlatformIntegrationRow) {
  return {
    id: row.id,
    platform: row.platform,
    integration_name: row.integration_name,
    business_mode: row.business_mode,
    environment: row.environment,
    status: row.status,
    base_url: row.base_url,
    language: row.language,
    open_key_mask: maskSecret(row.open_key_id),
    has_open_key: Boolean(row.open_key_id),
    secret_mask: maskSecret(row.secret_key),
    app_id: row.app_id,
    app_secret_mask: maskSecret(row.app_secret_key),
    is_default: Boolean(row.is_default),
    last_test_status: row.last_test_status,
    last_test_message: row.last_test_message,
    last_tested_at: row.last_tested_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function activeSheinIntegration(db: Database.Database) {
  return db.prepare(`
    select *
    from platform_integration
    where platform = 'SHEIN'
      and status = 'ACTIVE'
      and coalesce(open_key_id, '') <> ''
      and coalesce(secret_key, '') <> ''
    order by is_default desc, id asc
    limit 1
  `).get() as PlatformIntegrationRow | undefined
}

export function resolveSheinCredentials(db?: Database.Database): SheinCredentials {
  const row = db ? activeSheinIntegration(db) : undefined
  if (row) {
    return {
      source: "database",
      platformIntegrationId: row.id,
      baseUrl: row.base_url || SHEIN_TEST_BASE_URL,
      language: row.language || "zh-cn",
      openKeyId: row.open_key_id || "",
      secretKey: row.secret_key || "",
    }
  }

  return {
    source: "environment",
    platformIntegrationId: null,
    baseUrl: env("SHEIN_BASE_URL", SHEIN_TEST_BASE_URL),
    language: env("SHEIN_LANGUAGE", "zh-cn"),
    openKeyId: env("SHEIN_OPEN_KEY_ID"),
    secretKey: env("SHEIN_SECRET_KEY"),
  }
}

export function ensurePlatformIntegrationBootstrap(db: Database.Database) {
  const activeCount = db.prepare(`
    select count(*) as count
    from platform_integration
    where platform = 'SHEIN'
      and status = 'ACTIVE'
      and coalesce(open_key_id, '') <> ''
      and coalesce(secret_key, '') <> ''
  `).get() as { count: number }

  if (activeCount.count > 0) return false

  const openKeyId = env("SHEIN_OPEN_KEY_ID")
  const secretKey = env("SHEIN_SECRET_KEY")
  if (!openKeyId || !secretKey) return false

  const existing = db.prepare(`
    select id
    from platform_integration
    where platform = 'SHEIN'
      and integration_name = 'SHEIN 默认全托管账号'
  `).get() as { id: number } | undefined

  const payload = JSON.stringify({ source: "env_migration", migrated_at: new Date().toISOString() })
  if (existing) {
    db.prepare(`
      update platform_integration
      set business_mode = 'FULL_MANAGED',
        environment = ?,
        status = 'ACTIVE',
        base_url = ?,
        language = ?,
        open_key_id = ?,
        secret_key = ?,
        is_default = 1,
        raw_payload_json = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(
      env("SHEIN_ENVIRONMENT", "TEST").toUpperCase() === "PROD" ? "PROD" : "TEST",
      env("SHEIN_BASE_URL", SHEIN_TEST_BASE_URL),
      env("SHEIN_LANGUAGE", "zh-cn"),
      openKeyId,
      secretKey,
      payload,
      existing.id,
    )
    return true
  }

  db.prepare(`
    insert into platform_integration (
      platform,
      integration_name,
      business_mode,
      environment,
      status,
      base_url,
      language,
      open_key_id,
      secret_key,
      is_default,
      raw_payload_json
    )
    values ('SHEIN', 'SHEIN 默认全托管账号', 'FULL_MANAGED', ?, 'ACTIVE', ?, ?, ?, ?, 1, ?)
  `).run(
    env("SHEIN_ENVIRONMENT", "TEST").toUpperCase() === "PROD" ? "PROD" : "TEST",
    env("SHEIN_BASE_URL", SHEIN_TEST_BASE_URL),
    env("SHEIN_LANGUAGE", "zh-cn"),
    openKeyId,
    secretKey,
    payload,
  )
  return true
}
