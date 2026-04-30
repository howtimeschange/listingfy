import type { Context } from "hono"
import type Database from "better-sqlite3"
import { getDb } from "../db"
import { currentUser } from "./auth"

export interface AuditInput {
  action: string
  module: string
  entityType?: string
  entityId?: string | number
  summary: string
  metadata?: unknown
}

export function writeOperationLog(db: Database.Database, input: AuditInput, actor?: { id: number; username: string } | null, ipAddress?: string) {
  db.prepare(`
    insert into operation_log (
      actor_user_id,
      actor_username,
      action,
      module,
      entity_type,
      entity_id,
      summary,
      metadata_json,
      ip_address
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actor?.id ?? null,
    actor?.username ?? null,
    input.action,
    input.module,
    input.entityType ?? null,
    input.entityId === undefined ? null : String(input.entityId),
    input.summary,
    JSON.stringify(input.metadata ?? {}),
    ipAddress ?? null,
  )
}

export function auditFromContext(c: Context, input: AuditInput) {
  const user = currentUser(c)
  const ip = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? null
  writeOperationLog(getDb(), input, user, ip ?? undefined)
}
