import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import {
  clearSession,
  createSession,
  getUserForLogin,
  loadUserById,
  requireCurrentUser,
  serializeUser,
  verifyPassword,
} from "../lib/auth"
import { auditFromContext } from "../lib/audit"

const auth = new Hono()

auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { username?: string; password?: string }
  const username = String(body.username ?? "").trim()
  const password = String(body.password ?? "")
  if (!username || !password) throw new HTTPException(400, { message: "请输入账号和密码" })

  const db = getDb()
  const user = getUserForLogin(db, username)
  if (!user || user.status !== "ACTIVE" || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new HTTPException(401, { message: "账号或密码错误" })
  }

  createSession(c, db, user.id)
  db.prepare(`
    update app_user
    set last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(user.id)

  const authUser = loadUserById(db, user.id)
  if (!authUser) throw new HTTPException(401, { message: "账号不可用" })
  auditFromContext(c, {
    module: "AUTH",
    action: "LOGIN",
    entityType: "user",
    entityId: user.id,
    summary: `${user.username} 登录系统`,
  })
  return c.json({ user: serializeUser(authUser) })
})

auth.get("/me", (c) => {
  const user = requireCurrentUser(c)
  return c.json({ user: serializeUser(user) })
})

auth.post("/logout", (c) => {
  const user = requireCurrentUser(c)
  clearSession(c)
  auditFromContext(c, {
    module: "AUTH",
    action: "LOGOUT",
    entityType: "user",
    entityId: user.id,
    summary: `${user.username} 退出登录`,
  })
  return c.json({ ok: true })
})

export default auth
