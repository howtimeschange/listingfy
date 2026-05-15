import assert from "node:assert/strict";
import { test } from "node:test";

const {
  clearLoginFailures,
  ensureAdminUser,
  isLoginLocked,
  recordFailedLogin,
  verifyPassword,
} = await import("../../web/server/lib/auth.ts");

async function createTempDb() {
  const db = new MemoryAuthDb();
  return {
    db,
    async cleanup() {},
  };
}

class MemoryAuthDb {
  users = [];
  roles = [{ id: 1, role_key: "ADMIN", role_name: "管理员" }];
  userRoles = [];
  nextUserId = 1;

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    return {
      all: () => this.all(normalized),
      get: (...params) => this.get(normalized, params),
      run: (...params) => this.run(normalized, params),
    };
  }

  all(sql) {
    if (sql === "pragma table_info(app_user)") {
      return [
        "id",
        "username",
        "display_name",
        "email",
        "password_hash",
        "password_salt",
        "status",
        "failed_login_count",
        "locked_until",
        "last_login_at",
        "created_at",
        "updated_at",
      ].map((name) => ({ name }));
    }
    throw new Error(`Unsupported all query: ${sql}`);
  }

  get(sql, params) {
    if (sql === "select count(*) as count from app_user") {
      return { count: this.users.length };
    }
    if (sql === "select id from app_user where username = ?") {
      const user = this.users.find((row) => row.username === params[0]);
      return user ? { id: user.id } : undefined;
    }
    if (sql === "select * from app_user where username = ?") {
      return this.users.find((row) => row.username === params[0]);
    }
    if (sql === "select * from app_user where id = ?") {
      return this.users.find((row) => row.id === params[0]);
    }
    if (sql === "select failed_login_count from app_user where id = ?") {
      const user = this.users.find((row) => row.id === params[0]);
      return user ? { failed_login_count: user.failed_login_count } : undefined;
    }
    if (sql === "select id from rbac_role where role_key = 'admin'") {
      return this.roles.find((row) => row.role_key === "ADMIN");
    }
    if (sql.includes("from app_user_role user_role join rbac_role role")) {
      const role = this.userRoles
        .filter((row) => row.user_id === params[0])
        .map((row) => this.roles.find((candidate) => candidate.id === row.role_id))
        .find(Boolean);
      return role ? { role_key: role.role_key } : undefined;
    }
    throw new Error(`Unsupported get query: ${sql}`);
  }

  run(sql, params) {
    if (sql.startsWith("insert into app_user(")) {
      const [username, displayName, passwordHash, passwordSalt] = params;
      const id = this.nextUserId;
      this.nextUserId += 1;
      this.users.push({
        id,
        username,
        display_name: displayName,
        email: null,
        password_hash: passwordHash,
        password_salt: passwordSalt,
        status: "ACTIVE",
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
      });
      return { lastInsertRowid: id };
    }
    if (sql === "insert or ignore into app_user_role(user_id, role_id) values (?, ?)") {
      const [userId, roleId] = params;
      if (!this.userRoles.some((row) => row.user_id === userId && row.role_id === roleId)) {
        this.userRoles.push({ user_id: userId, role_id: roleId });
      }
      return { changes: 1 };
    }
    if (sql.startsWith("update app_user set failed_login_count = ?,")) {
      const [failedLoginCount, lockedUntil, userId] = params;
      const user = this.users.find((row) => row.id === userId);
      if (user) {
        user.failed_login_count = failedLoginCount;
        user.locked_until = lockedUntil;
      }
      return { changes: user ? 1 : 0 };
    }
    if (sql.startsWith("update app_user set failed_login_count = 0,")) {
      const [userId] = params;
      const user = this.users.find((row) => row.id === userId);
      if (user) {
        user.failed_login_count = 0;
        user.locked_until = null;
      }
      return { changes: user ? 1 : 0 };
    }
    throw new Error(`Unsupported run query: ${sql}`);
  }
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

test("ensureAdminUser requires an explicit administrator username", async () => {
  const { db, cleanup } = await createTempDb();
  try {
    await withEnv({
      LISTINGIFY_ADMIN_USERNAME: undefined,
      LISTINGIFY_ADMIN_PASSWORD: "S3cure-admin-password-2026",
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
