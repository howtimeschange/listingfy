import crypto from "node:crypto"
import type { Context, Next } from "hono"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import { HTTPException } from "hono/http-exception"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

export const SESSION_COOKIE = "listingify_session"
const SESSION_TTL_DAYS = 7

export interface AuthUser {
  id: number
  username: string
  display_name: string
  email: string | null
  status: string
  roles: string[]
  permissions: string[]
}

interface UserRow {
  id: number
  username: string
  display_name: string
  email: string | null
  password_hash: string
  password_salt: string
  status: string
  failed_login_count?: number
  locked_until?: string | null
}

export interface LoginFailurePolicy {
  maxFailures: number
  lockMinutes: number
  now?: Date
}

function nowIso() {
  return new Date().toISOString()
}

function expiresAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function readPositiveInteger(value: string | undefined, fallback: number, max: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

export function loginFailurePolicyFromEnv(): LoginFailurePolicy {
  return {
    maxFailures: readPositiveInteger(process.env.LISTINGIFY_LOGIN_MAX_FAILURES, 5, 20),
    lockMinutes: readPositiveInteger(process.env.LISTINGIFY_LOGIN_LOCK_MINUTES, 15, 1440),
  }
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return { salt, hash }
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, "hex")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function loadUserById(db: SyncPostgresDatabase, userId: number): AuthUser | null {
  const user = db.prepare(`
    select id, username, display_name, email, status
    from app_user
    where id = ?
  `).get(userId) as Omit<UserRow, "password_hash" | "password_salt"> | undefined

  if (!user || user.status !== "ACTIVE") return null

  const roles = db.prepare(`
    select role.role_key
    from app_user_role user_role
    join rbac_role role on role.id = user_role.role_id
    where user_role.user_id = ?
    order by role.role_key
  `).all(userId).map((row) => String((row as { role_key: string }).role_key))

  const permissions = db.prepare(`
    select distinct permission.permission_key
    from app_user_role user_role
    join rbac_role_permission role_permission on role_permission.role_id = user_role.role_id
    join rbac_permission permission on permission.id = role_permission.permission_id
    where user_role.user_id = ?
    order by permission.permission_key
  `).all(userId).map((row) => String((row as { permission_key: string }).permission_key))

  return { ...user, roles, permissions }
}

export function currentUser(c: Context): AuthUser | null {
  return c.get("user") ?? null
}

export function requireCurrentUser(c: Context): AuthUser {
  const user = currentUser(c)
  if (!user) throw new HTTPException(401, { message: "请先登录" })
  return user
}

export function requirePermission(c: Context, permission: string) {
  const user = requireCurrentUser(c)
  if (!user.permissions.includes(permission)) {
    throw new HTTPException(403, { message: "当前账号没有执行此操作的权限" })
  }
  return user
}

export function isLoginLocked(user: Pick<UserRow, "locked_until"> | Record<string, unknown>, now = new Date()) {
  const lockedUntil = typeof user.locked_until === "string" ? user.locked_until : null
  if (!lockedUntil) return false
  const lockedUntilMs = new Date(lockedUntil).getTime()
  return Number.isFinite(lockedUntilMs) && lockedUntilMs > now.getTime()
}

function hasColumn(db: SyncPostgresDatabase, tableName: string, columnName: string) {
  return db.prepare(`pragma table_info(${tableName})`)
    .all()
    .some((row) => String((row as { name: string }).name) === columnName)
}

function loginFailureColumnsExist(db: SyncPostgresDatabase) {
  return hasColumn(db, "app_user", "failed_login_count") && hasColumn(db, "app_user", "locked_until")
}

export function recordFailedLogin(
  db: SyncPostgresDatabase,
  userId: number,
  policy: LoginFailurePolicy = loginFailurePolicyFromEnv(),
) {
  if (!loginFailureColumnsExist(db)) return { failedLoginCount: 0, lockedUntil: null }
  const now = policy.now ?? new Date()
  const user = db.prepare(`
    select failed_login_count
    from app_user
    where id = ?
  `).get(userId) as { failed_login_count: number } | undefined
  const failedLoginCount = Number(user?.failed_login_count ?? 0) + 1
  const shouldLock = failedLoginCount >= policy.maxFailures
  const lockedUntil = shouldLock
    ? new Date(now.getTime() + policy.lockMinutes * 60 * 1000).toISOString()
    : null

  db.prepare(`
    update app_user
    set failed_login_count = ?,
      locked_until = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(failedLoginCount, lockedUntil, userId)

  return { failedLoginCount, lockedUntil }
}

export function clearLoginFailures(db: SyncPostgresDatabase, userId: number) {
  if (!loginFailureColumnsExist(db)) return
  db.prepare(`
    update app_user
    set failed_login_count = 0,
      locked_until = null,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(userId)
}

export async function requireAuth(c: Context, next: Next) {
  const { getDb } = await import("../db")
  const db = getDb()
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (!sessionId) throw new HTTPException(401, { message: "请先登录" })

  const session = db.prepare(`
    select id, user_id, expires_at
    from user_session
    where id = ?
  `).get(sessionId) as { id: string; user_id: number; expires_at: string } | undefined

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) db.prepare("delete from user_session where id = ?").run(session.id)
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    throw new HTTPException(401, { message: "登录已过期，请重新登录" })
  }

  const user = loadUserById(db, session.user_id)
  if (!user) {
    db.prepare("delete from user_session where id = ?").run(session.id)
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
    throw new HTTPException(401, { message: "账号不可用，请重新登录" })
  }

  db.prepare("update user_session set last_seen_at = ? where id = ?").run(nowIso(), session.id)
  c.set("user", user)
  await next()
}

export function createSession(c: Context, db: SyncPostgresDatabase, userId: number) {
  const sessionId = crypto.randomBytes(32).toString("hex")
  const expiry = expiresAt()
  db.prepare(`
    insert into user_session(id, user_id, expires_at, created_at, last_seen_at)
    values (?, ?, ?, ?, ?)
  `).run(sessionId, userId, expiry, nowIso(), nowIso())
  setCookie(c, SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
  return sessionId
}

export async function clearSession(c: Context) {
  const { getDb } = await import("../db")
  const db = getDb()
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (sessionId) db.prepare("delete from user_session where id = ?").run(sessionId)
  deleteCookie(c, SESSION_COOKIE, { path: "/" })
}

export function ensureAdminUser(db: SyncPostgresDatabase) {
  const username = process.env.LISTINGIFY_ADMIN_USERNAME?.trim()
  const password = process.env.LISTINGIFY_ADMIN_PASSWORD
  const displayName = process.env.LISTINGIFY_ADMIN_DISPLAY_NAME || "系统管理员"

  if (!username || !password) return false
  const existing = db.prepare("select id from app_user where username = ?").get(username) as { id: number } | undefined
  if (existing) return false

  const { salt, hash } = hashPassword(password)
  const result = db.prepare(`
    insert into app_user(username, display_name, email, password_hash, password_salt, status, updated_at)
    values (?, ?, null, ?, ?, 'ACTIVE', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(username, displayName, hash, salt)

  const adminRole = db.prepare("select id from rbac_role where role_key = 'ADMIN'").get() as { id: number } | undefined
  if (adminRole) {
    db.prepare("insert or ignore into app_user_role(user_id, role_id) values (?, ?)").run(result.lastInsertRowid, adminRole.id)
  }
  return true
}

export function getUserForLogin(db: SyncPostgresDatabase, username: string) {
  return db.prepare(`
    select *
    from app_user
    where username = ?
  `).get(username) as UserRow | undefined
}

export function serializeUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    status: user.status,
    roles: user.roles,
    permissions: user.permissions,
  }
}
