import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

function file(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
}

test("system management exposes auth, users, platform integrations, sync tasks, and operation logs", async () => {
  const [
    router,
    sidebar,
    header,
    appLayout,
    apiClient,
    server,
    loginPage,
    usersPage,
    platformPage,
    syncTasksPage,
    operationLogsPage,
  ] = await Promise.all([
    file("web/src/router.tsx"),
    file("web/src/components/layout/app-sidebar.tsx"),
    file("web/src/components/layout/app-header.tsx"),
    file("web/src/components/layout/app-layout.tsx"),
    file("web/src/lib/api-client.ts"),
    file("web/server/index.ts"),
    file("web/src/pages/login/page.tsx"),
    file("web/src/pages/users/page.tsx"),
    file("web/src/pages/platform-integrations/page.tsx"),
    file("web/src/pages/sync-tasks/page.tsx"),
    file("web/src/pages/operation-logs/page.tsx"),
  ]);

  assert.match(router, /path:\s*"login"/);
  assert.match(router, /path:\s*"users"/);
  assert.match(router, /path:\s*"platform-integrations"/);
  assert.match(router, /<ProtectedLayout/);

  assert.match(sidebar, /平台对接/);
  assert.match(sidebar, /用户管理/);
  assert.doesNotMatch(sidebar, /SHEIN 账号/);
  assert.match(sidebar, /permission/);

  assert.match(header, /logout|退出登录/);
  assert.match(appLayout, /useAuth/);
  assert.match(apiClient, /credentials:\s*"include"/);

  assert.match(server, /app\.route\("\/api\/auth"/);
  assert.match(server, /app\.route\("\/api\/users"/);
  assert.match(server, /app\.route\("\/api\/platform-integrations"/);
  assert.match(server, /app\.route\("\/api\/system"/);
  assert.match(server, /requireAuth/);
  assert.doesNotMatch(server, /app\.use\("\*",\s*cors\(\)\)/);
  assert.match(server, /corsOptions/);
  assert.match(server, /LISTINGIFY_ALLOWED_ORIGINS/);

  assert.match(loginPage, /登录/);
  assert.match(loginPage, /api\.post<.*>\("\/auth\/login"/s);
  assert.match(usersPage, /用户管理/);
  assert.match(usersPage, /角色/);
  assert.match(usersPage, /重置密码/);
  assert.match(platformPage, /平台对接/);
  assert.match(platformPage, /openKeyId/);
  assert.match(platformPage, /secretKey/);
  assert.match(platformPage, /SHEIN/);

  assert.doesNotMatch(syncTasksPage, /ComingSoonPage/);
  assert.match(syncTasksPage, /同步任务/);
  assert.match(syncTasksPage, /\/system\/sync-tasks/);
  assert.doesNotMatch(operationLogsPage, /ComingSoonPage/);
  assert.match(operationLogsPage, /操作日志/);
  assert.match(operationLogsPage, /\/system\/operation-logs/);
});

test("system management migration defines RBAC, sessions, audit logs, and platform integrations", async () => {
  const migration = await file("db/migrations/014_system_management_auth_platform_integrations.sql");
  const securityMigration = await file("db/migrations/015_security_hardening.sql");

  assert.match(migration, /create table if not exists app_user/);
  assert.match(migration, /create table if not exists rbac_role/);
  assert.match(migration, /create table if not exists rbac_permission/);
  assert.match(migration, /create table if not exists user_session/);
  assert.match(migration, /create table if not exists operation_log/);
  assert.match(migration, /create table if not exists platform_integration/);
  assert.match(securityMigration, /failed_login_count/);
  assert.match(securityMigration, /locked_until/);
  assert.match(migration, /USER_ADMIN/);
  assert.match(migration, /PLATFORM_CONFIG/);
  assert.match(migration, /SYNC_RUN/);
});
