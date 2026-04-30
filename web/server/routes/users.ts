import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { hashPassword, requirePermission } from "../lib/auth"
import { auditFromContext } from "../lib/audit"

const users = new Hono()

type UserBody = {
  username?: string
  display_name?: string
  email?: string
  password?: string
  status?: string
  roles?: string[]
}

function normalizeRoles(roles: unknown) {
  if (!Array.isArray(roles)) return []
  return roles.map((role) => String(role).trim().toUpperCase()).filter(Boolean)
}

function userForResponse(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    username: String(row.username),
    display_name: String(row.display_name),
    email: row.email ? String(row.email) : null,
    status: String(row.status),
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    roles: String(row.roles ?? "").split(",").filter(Boolean),
  }
}

function replaceRoles(db: ReturnType<typeof getDb>, userId: number, roleKeys: string[]) {
  db.prepare("delete from app_user_role where user_id = ?").run(userId)
  const stmt = db.prepare(`
    insert or ignore into app_user_role(user_id, role_id)
    select ?, id
    from rbac_role
    where role_key = ?
  `)
  for (const role of roleKeys) stmt.run(userId, role)
}

users.get("/roles", (c) => {
  requirePermission(c, "USER_ADMIN")
  const roles = getDb().prepare(`
    select role_key, role_name, description
    from rbac_role
    order by id
  `).all()
  return c.json({ items: roles })
})

users.get("/", (c) => {
  requirePermission(c, "USER_ADMIN")
  const items = getDb().prepare(`
    select
      user.id,
      user.username,
      user.display_name,
      user.email,
      user.status,
      user.last_login_at,
      user.created_at,
      user.updated_at,
      group_concat(role.role_key) as roles
    from app_user user
    left join app_user_role user_role on user_role.user_id = user.id
    left join rbac_role role on role.id = user_role.role_id
    group by user.id
    order by user.updated_at desc, user.id desc
  `).all().map((row) => userForResponse(row as Record<string, unknown>))
  return c.json({ items })
})

users.post("/", async (c) => {
  requirePermission(c, "USER_ADMIN")
  const body = await c.req.json().catch(() => ({})) as UserBody
  const username = String(body.username ?? "").trim()
  const displayName = String(body.display_name ?? "").trim()
  const email = String(body.email ?? "").trim() || null
  const password = String(body.password ?? "")
  const status = body.status === "DISABLED" ? "DISABLED" : "ACTIVE"
  const roles = normalizeRoles(body.roles)

  if (!username || !displayName || !password) {
    throw new HTTPException(400, { message: "账号、姓名和初始密码不能为空" })
  }
  if (password.length < 8) throw new HTTPException(400, { message: "密码至少 8 位" })
  if (roles.length === 0) throw new HTTPException(400, { message: "请至少选择一个角色" })

  const db = getDb()
  const { salt, hash } = hashPassword(password)
  const result = db.prepare(`
    insert into app_user(username, display_name, email, password_hash, password_salt, status, updated_at)
    values (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(username, displayName, email, hash, salt, status)
  replaceRoles(db, Number(result.lastInsertRowid), roles)
  auditFromContext(c, {
    module: "USER",
    action: "CREATE",
    entityType: "user",
    entityId: Number(result.lastInsertRowid),
    summary: `创建用户 ${username}`,
    metadata: { roles, status },
  })
  return c.json({ id: Number(result.lastInsertRowid) })
})

users.put("/:id", async (c) => {
  requirePermission(c, "USER_ADMIN")
  const userId = Number(c.req.param("id"))
  if (!Number.isFinite(userId)) throw new HTTPException(400, { message: "用户 ID 不合法" })
  const body = await c.req.json().catch(() => ({})) as UserBody
  const displayName = String(body.display_name ?? "").trim()
  const email = String(body.email ?? "").trim() || null
  const status = body.status === "DISABLED" ? "DISABLED" : "ACTIVE"
  const roles = normalizeRoles(body.roles)
  if (!displayName) throw new HTTPException(400, { message: "姓名不能为空" })
  if (roles.length === 0) throw new HTTPException(400, { message: "请至少选择一个角色" })

  const db = getDb()
  db.prepare(`
    update app_user
    set display_name = ?,
      email = ?,
      status = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(displayName, email, status, userId)
  replaceRoles(db, userId, roles)
  auditFromContext(c, {
    module: "USER",
    action: "UPDATE",
    entityType: "user",
    entityId: userId,
    summary: `更新用户 ${displayName}`,
    metadata: { roles, status },
  })
  return c.json({ ok: true })
})

users.post("/:id/reset-password", async (c) => {
  requirePermission(c, "USER_ADMIN")
  const userId = Number(c.req.param("id"))
  const body = await c.req.json().catch(() => ({})) as { password?: string }
  const password = String(body.password ?? "")
  if (password.length < 8) throw new HTTPException(400, { message: "密码至少 8 位" })
  const { salt, hash } = hashPassword(password)
  getDb().prepare(`
    update app_user
    set password_hash = ?,
      password_salt = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(hash, salt, userId)
  auditFromContext(c, {
    module: "USER",
    action: "RESET_PASSWORD",
    entityType: "user",
    entityId: userId,
    summary: `重置用户 ${userId} 的密码`,
  })
  return c.json({ ok: true })
})

users.delete("/:id", (c) => {
  requirePermission(c, "USER_ADMIN")
  const userId = Number(c.req.param("id"))
  getDb().prepare(`
    update app_user
    set status = 'DISABLED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(userId)
  auditFromContext(c, {
    module: "USER",
    action: "DISABLE",
    entityType: "user",
    entityId: userId,
    summary: `停用用户 ${userId}`,
  })
  return c.json({ ok: true })
})

export default users
