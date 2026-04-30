import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { requirePermission } from "../lib/auth"
import { auditFromContext } from "../lib/audit"
import {
  encryptCredential,
  platformIntegrationForResponse,
  type PlatformIntegrationRow,
} from "../lib/platform-config"

const platformIntegrations = new Hono()

type IntegrationBody = {
  platform?: string
  integration_name?: string
  business_mode?: string
  environment?: string
  status?: string
  base_url?: string
  language?: string
  open_key_id?: string
  secret_key?: string
  app_id?: string
  app_secret_key?: string
  is_default?: boolean
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeBody(body: IntegrationBody, existing?: PlatformIntegrationRow) {
  const platform = text(body.platform || existing?.platform || "SHEIN").toUpperCase()
  const integrationName = text(body.integration_name || existing?.integration_name)
  const businessMode = text(body.business_mode || existing?.business_mode || "FULL_MANAGED") || "FULL_MANAGED"
  const environment = text(body.environment || existing?.environment || "TEST").toUpperCase() === "PROD" ? "PROD" : "TEST"
  const status = text(body.status || existing?.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE"
  const baseUrl = text(body.base_url ?? existing?.base_url)
  const language = text(body.language ?? existing?.language) || "zh-cn"
  const openKeyId = body.open_key_id === undefined || body.open_key_id === ""
    ? existing?.open_key_id ?? ""
    : text(body.open_key_id)
  const secretKey = body.secret_key === undefined || body.secret_key === ""
    ? existing?.secret_key ?? ""
    : text(body.secret_key)
  const appId = text(body.app_id ?? existing?.app_id)
  const appSecretKey = body.app_secret_key === undefined || body.app_secret_key === ""
    ? existing?.app_secret_key ?? ""
    : text(body.app_secret_key)
  const isDefault = body.is_default === undefined ? Boolean(existing?.is_default ?? true) : Boolean(body.is_default)

  if (!integrationName) throw new HTTPException(400, { message: "配置名称不能为空" })
  if (platform === "SHEIN" && (!openKeyId || !secretKey)) {
    throw new HTTPException(400, { message: "SHEIN openKeyId 和 secretKey 不能为空" })
  }

  return {
    platform,
    integrationName,
    businessMode,
    environment,
    status,
    baseUrl,
    language,
    openKeyId,
    secretKey,
    appId,
    appSecretKey,
    isDefault,
  }
}

function setDefaultIfNeeded(platform: string, integrationId: number, isDefault: boolean) {
  if (!isDefault) return
  getDb().prepare(`
    update platform_integration
    set is_default = case when id = ? then 1 else 0 end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where platform = ?
  `).run(integrationId, platform)
}

platformIntegrations.get("/", (c) => {
  requirePermission(c, "PLATFORM_CONFIG")
  const items = getDb().prepare(`
    select *
    from platform_integration
    order by platform, is_default desc, id desc
  `).all().map((row) => platformIntegrationForResponse(row as PlatformIntegrationRow))
  return c.json({ items })
})

platformIntegrations.post("/", async (c) => {
  requirePermission(c, "PLATFORM_CONFIG")
  const body = await c.req.json().catch(() => ({})) as IntegrationBody
  const normalized = normalizeBody(body)
  const db = getDb()
  const result = db.prepare(`
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
      app_id,
      app_secret_key,
      is_default,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    normalized.platform,
    normalized.integrationName,
    normalized.businessMode,
    normalized.environment,
    normalized.status,
    normalized.baseUrl || null,
    normalized.language,
    encryptCredential(normalized.openKeyId) || null,
    encryptCredential(normalized.secretKey) || null,
    normalized.appId || null,
    encryptCredential(normalized.appSecretKey) || null,
    normalized.isDefault ? 1 : 0,
    JSON.stringify({ source: "web" }),
  )
  setDefaultIfNeeded(normalized.platform, Number(result.lastInsertRowid), normalized.isDefault)
  auditFromContext(c, {
    module: "PLATFORM",
    action: "CREATE",
    entityType: "platform_integration",
    entityId: Number(result.lastInsertRowid),
    summary: `创建平台对接配置 ${normalized.platform} / ${normalized.integrationName}`,
    metadata: { platform: normalized.platform, is_default: normalized.isDefault },
  })
  return c.json({ id: Number(result.lastInsertRowid) })
})

platformIntegrations.put("/:id", async (c) => {
  requirePermission(c, "PLATFORM_CONFIG")
  const id = Number(c.req.param("id"))
  const db = getDb()
  const existing = db.prepare("select * from platform_integration where id = ?").get(id) as PlatformIntegrationRow | undefined
  if (!existing) throw new HTTPException(404, { message: "平台对接配置不存在" })
  const body = await c.req.json().catch(() => ({})) as IntegrationBody
  const normalized = normalizeBody(body, existing)
  db.prepare(`
    update platform_integration
    set platform = ?,
      integration_name = ?,
      business_mode = ?,
      environment = ?,
      status = ?,
      base_url = ?,
      language = ?,
      open_key_id = ?,
      secret_key = ?,
      app_id = ?,
      app_secret_key = ?,
      is_default = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalized.platform,
    normalized.integrationName,
    normalized.businessMode,
    normalized.environment,
    normalized.status,
    normalized.baseUrl || null,
    normalized.language,
    encryptCredential(normalized.openKeyId) || null,
    encryptCredential(normalized.secretKey) || null,
    normalized.appId || null,
    encryptCredential(normalized.appSecretKey) || null,
    normalized.isDefault ? 1 : 0,
    id,
  )
  setDefaultIfNeeded(normalized.platform, id, normalized.isDefault)
  auditFromContext(c, {
    module: "PLATFORM",
    action: "UPDATE",
    entityType: "platform_integration",
    entityId: id,
    summary: `更新平台对接配置 ${normalized.platform} / ${normalized.integrationName}`,
    metadata: { platform: normalized.platform, status: normalized.status, is_default: normalized.isDefault },
  })
  return c.json({ ok: true })
})

platformIntegrations.post("/:id/test", (c) => {
  requirePermission(c, "PLATFORM_CONFIG")
  const id = Number(c.req.param("id"))
  const db = getDb()
  const row = db.prepare("select * from platform_integration where id = ?").get(id) as PlatformIntegrationRow | undefined
  if (!row) throw new HTTPException(404, { message: "平台对接配置不存在" })
  const ok = row.status === "ACTIVE" && Boolean(row.open_key_id) && Boolean(row.secret_key)
  const message = ok ? "配置完整，已可用于 OpenAPI 签名" : "配置未启用或密钥不完整"
  db.prepare(`
    update platform_integration
    set last_test_status = ?,
      last_test_message = ?,
      last_tested_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(ok ? "SUCCESS" : "FAILED", message, id)
  auditFromContext(c, {
    module: "PLATFORM",
    action: "TEST",
    entityType: "platform_integration",
    entityId: id,
    summary: `测试平台对接配置 ${row.platform} / ${row.integration_name}：${message}`,
    metadata: { status: ok ? "SUCCESS" : "FAILED" },
  })
  return c.json({ ok, status: ok ? "SUCCESS" : "FAILED", message })
})

platformIntegrations.delete("/:id", (c) => {
  requirePermission(c, "PLATFORM_CONFIG")
  const id = Number(c.req.param("id"))
  getDb().prepare(`
    update platform_integration
    set status = 'INACTIVE',
      is_default = 0,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(id)
  auditFromContext(c, {
    module: "PLATFORM",
    action: "DISABLE",
    entityType: "platform_integration",
    entityId: id,
    summary: `停用平台对接配置 ${id}`,
  })
  return c.json({ ok: true })
})

export default platformIntegrations
