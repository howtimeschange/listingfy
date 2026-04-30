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
  clearLoginFailures,
  ensureAdminUser,
  isLoginLocked,
  recordFailedLogin,
  verifyPassword,
} = await import("../../web/server/lib/auth.ts");

async function createTempDb() {
  const tempPath = await mkdtemp(path.join(os.tmpdir(), "listingify-auth-security-"));
  const db = new Database(path.join(tempPath, "test.sqlite"));
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table app_user (
      id integer primary key autoincrement,
      username text not null unique,
      display_name text not null,
      email text,
      password_hash text not null,
      password_salt text not null,
      status text not null default 'ACTIVE',
      failed_login_count integer not null default 0,
      locked_until text,
      last_login_at text,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    create table rbac_role (
      id integer primary key autoincrement,
      role_key text not null unique,
      role_name text not null,
      description text,
      is_system integer not null default 1,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    create table app_user_role (
      user_id integer not null references app_user(id) on delete cascade,
      role_id integer not null references rbac_role(id) on delete cascade,
      primary key(user_id, role_id)
    );
    insert into rbac_role(role_key, role_name) values ('ADMIN', '管理员');
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

test("ensureAdminUser does not create a default weak admin without an explicit password", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    await withEnv({
      LISTINGIFY_ADMIN_USERNAME: undefined,
      LISTINGIFY_ADMIN_PASSWORD: undefined,
      LISTINGIFY_ADMIN_DISPLAY_NAME: undefined,
    }, () => {
      assert.equal(ensureAdminUser(db), false);
    });

    const count = db.prepare("select count(*) as count from app_user").get().count;
    assert.equal(count, 0);
  } finally {
    await cleanup();
  }
});

test("ensureAdminUser creates an administrator only when explicit credentials are provided", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    await withEnv({
      LISTINGIFY_ADMIN_USERNAME: "secure-admin",
      LISTINGIFY_ADMIN_PASSWORD: "S3cure-admin-password-2026",
      LISTINGIFY_ADMIN_DISPLAY_NAME: "安全管理员",
    }, () => {
      assert.equal(ensureAdminUser(db), true);
    });

    const user = db.prepare("select * from app_user where username = ?").get("secure-admin");
    assert.equal(user.display_name, "安全管理员");
    assert.equal(verifyPassword("S3cure-admin-password-2026", user.password_salt, user.password_hash), true);
    assert.equal(verifyPassword("admin123456", user.password_salt, user.password_hash), false);

    const adminRole = db.prepare(`
      select role.role_key
      from app_user_role user_role
      join rbac_role role on role.id = user_role.role_id
      where user_role.user_id = ?
    `).get(user.id);
    assert.equal(adminRole.role_key, "ADMIN");
  } finally {
    await cleanup();
  }
});

test("login failures lock an account and successful login cleanup clears the lock counters", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    await withEnv({
      LISTINGIFY_ADMIN_USERNAME: "lock-admin",
      LISTINGIFY_ADMIN_PASSWORD: "S3cure-admin-password-2026",
    }, () => {
      assert.equal(ensureAdminUser(db), true);
    });

    const user = db.prepare("select * from app_user where username = ?").get("lock-admin");
    const now = new Date("2026-04-30T00:00:00.000Z");

    const firstFailure = recordFailedLogin(db, user.id, {
      maxFailures: 2,
      lockMinutes: 10,
      now,
    });
    assert.equal(firstFailure.failedLoginCount, 1);
    assert.equal(firstFailure.lockedUntil, null);

    const secondFailure = recordFailedLogin(db, user.id, {
      maxFailures: 2,
      lockMinutes: 10,
      now,
    });
    assert.equal(secondFailure.failedLoginCount, 2);
    assert.equal(secondFailure.lockedUntil, "2026-04-30T00:10:00.000Z");

    const lockedUser = db.prepare("select * from app_user where id = ?").get(user.id);
    assert.equal(isLoginLocked(lockedUser, now), true);

    clearLoginFailures(db, user.id);
    const clearedUser = db.prepare("select * from app_user where id = ?").get(user.id);
    assert.equal(clearedUser.failed_login_count, 0);
    assert.equal(clearedUser.locked_until, null);
    assert.equal(isLoginLocked(clearedUser, now), false);
  } finally {
    await cleanup();
  }
});
