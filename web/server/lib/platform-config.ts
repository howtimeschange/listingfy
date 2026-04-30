import crypto from "node:crypto"
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
const CREDENTIAL_PREFIX = "enc:v1:"

function env(name: string, fallback = "") {
  const value = process.env[name]
  return value === undefined || value === "" ? fallback : value
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= 8) return "********"
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

function credentialSecret() {
  return env("LISTINGIFY_CREDENTIAL_SECRET")
}

function encryptionKey(secret: string) {
  return crypto.createHash("sha256").update(secret, "utf8").digest()
}

export function credentialIsEncrypted(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(CREDENTIAL_PREFIX)
}

export function encryptCredential(value: string | null | undefined) {
  if (!value) return value ?? null
  if (credentialIsEncrypted(value)) return value
  const secret = credentialSecret()
  if (!secret) return value

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    CREDENTIAL_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":")
}

export function decryptCredential(value: string | null | undefined) {
  if (!value) return value ?? null
  if (!credentialIsEncrypted(value)) return value
  const secret = credentialSecret()
  if (!secret) {
    throw new Error("LISTINGIFY_CREDENTIAL_SECRET is required to decrypt platform credentials")
  }

  const [, , ivPart, tagPart, encryptedPart] = value.split(":")
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Invalid encrypted platform credential")
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivPart, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

function maskCredential(value: string | null | undefined) {
  if (!value) return null
  if (!credentialIsEncrypted(value)) return maskSecret(value)
  try {
    return maskSecret(decryptCredential(value))
  } catch {
    return "********"
  }
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
    open_key_mask: maskCredential(row.open_key_id),
    has_open_key: Boolean(row.open_key_id),
    secret_mask: maskCredential(row.secret_key),
    app_id: row.app_id,
    app_secret_mask: maskCredential(row.app_secret_key),
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
      openKeyId: decryptCredential(row.open_key_id) || "",
      secretKey: decryptCredential(row.secret_key) || "",
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

export function encryptStoredPlatformCredentials(db: Database.Database) {
  if (!credentialSecret()) return 0
  const rows = db.prepare(`
    select id, open_key_id, secret_key, app_secret_key
    from platform_integration
  `).all() as Array<Pick<PlatformIntegrationRow, "id" | "open_key_id" | "secret_key" | "app_secret_key">>

  let changed = 0
  const update = db.prepare(`
    update platform_integration
    set open_key_id = ?,
      secret_key = ?,
      app_secret_key = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `)
  for (const row of rows) {
    const openKeyId = encryptCredential(row.open_key_id)
    const secretKey = encryptCredential(row.secret_key)
    const appSecretKey = encryptCredential(row.app_secret_key)
    if (
      openKeyId === row.open_key_id &&
      secretKey === row.secret_key &&
      appSecretKey === row.app_secret_key
    ) {
      continue
    }
    update.run(openKeyId, secretKey, appSecretKey, row.id)
    changed += 1
  }
  return changed
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
      encryptCredential(openKeyId),
      encryptCredential(secretKey),
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
    encryptCredential(openKeyId),
    encryptCredential(secretKey),
    payload,
  )
  return true
}
