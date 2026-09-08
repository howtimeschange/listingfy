import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { createSession, requireAuth, hashPassword, verifyPassword, resetUserPassword } from "../../web/server/lib/auth.ts";
const { Hono } = createRequire(new URL("../../web/package.json", import.meta.url))("hono");

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.transaction = (fn) => () => { db.exec("begin"); try { const result = fn(); db.exec("commit"); return result; } catch (e) { db.exec("rollback"); throw e; } };
  db.exec(`
    create table app_user(id integer primary key, username text, display_name text, email text,
      status text default 'ACTIVE', password_hash text, password_salt text, updated_at text,
      failed_login_count integer default 0, locked_until text);
    create table user_session(id text primary key, user_id integer, expires_at text, created_at text, last_seen_at text);
    create table app_user_role(user_id integer, role_id integer);
    create table rbac_role(id integer, role_key text);
    create table rbac_role_permission(role_id integer, permission_id integer);
    create table rbac_permission(id integer, permission_key text);
  `);
  const {hash,salt} = hashPassword("old-password");
  for (const id of [1,2]) db.prepare("insert into app_user(id,username,display_name,password_hash,password_salt) values(?,?,?,?,?)").run(id,`user${id}`,`User ${id}`,hash,salt);
  const app = new Hono();
  app.post("/session/:id", c => { createSession(c, db, Number(c.req.param("id"))); return c.json({ok:true}); });
  app.post("/stale-login", c => { createSession(c, db, 1, hash); return c.json({ok:true}); });
  app.get("/private", (c,next) => requireAuth(c,next,db), c => c.json({userId:c.get("user").id}));
  const login = async (id) => (await app.request(`/session/${id}`,{method:"POST"})).headers.get("set-cookie").split(";")[0];
  const read = cookie => app.request("/private",{headers:{cookie}});
  return {db,login,read,app};
}

test("password reset revokes every old cookie for that user, preserves other users and permits a new session", async () => {
  const {db,login,read,app}=fixture();
  try {
    const cookies=[await login(1),await login(1)];
    const other=await login(2);
    assert.equal((await read(cookies[0])).status,200);
    resetUserPassword(db,1,"new-password");
    const staleLogin=await app.request("/stale-login",{method:"POST"});
    assert.equal(staleLogin.status,401);
    assert.equal(staleLogin.headers.get("set-cookie"),null);
    for(const cookie of cookies) assert.equal((await read(cookie)).status,401);
    assert.equal((await read(other)).status,200);
    const row=db.prepare("select * from app_user where id=1").get();
    assert.equal(verifyPassword("old-password",row.password_salt,row.password_hash),false);
    assert.equal(verifyPassword("new-password",row.password_salt,row.password_hash),true);
    assert.equal((await read(await login(1))).status,200);
  } finally {db.close();}
});

test("session invalidation failure rolls back the password update", async () => {
  const {db,login,read}=fixture();
  try {
    const cookie=await login(1);
    db.exec("create trigger block_delete before delete on user_session begin select raise(abort,'delete failed'); end");
    assert.throws(()=>resetUserPassword(db,1,"new-password"),/delete failed/);
    const row=db.prepare("select * from app_user where id=1").get();
    assert.equal(verifyPassword("old-password",row.password_salt,row.password_hash),true);
    assert.equal((await read(cookie)).status,200);
  } finally {db.close();}
});
