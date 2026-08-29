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
  assert.match(apiClient, /await res\.text\(\)/);
  assert.match(apiClient, /JSON\.parse\(text\)/);

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
  assert.match(loginPage, /api\.get<.*>\("\/auth\/me"/s);
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

test("system sync task list includes SHEIN platform product async jobs", async () => {
  const route = await file("web/server/routes/system.ts");

  assert.match(route, /PLATFORM_PRODUCT_JOB/);
  assert.match(route, /shein_platform_product_job/);
  assert.match(route, /completed_count as success_count/);
  assert.match(route, /failed_count/);
});

test("background task limiter protects API while long queues are running", async () => {
  const [systemRoute, limiter, draftRoute, archiveRoute, categoryRoute, platformJobs, launchPlanJobs] = await Promise.all([
    file("web/server/routes/system.ts"),
    file("web/server/lib/background-task-limiter.ts"),
    file("web/server/routes/product-archive-drafts.ts"),
    file("web/server/routes/product-archives.ts"),
    file("web/server/routes/category-mapping.ts"),
    file("web/server/services/shein-platform-product-jobs.ts"),
    file("web/server/services/listing-launch-plan-import-jobs.ts"),
  ]);

  assert.match(limiter, /LISTINGIFY_BACKGROUND_MAX_ACTIVE/);
  assert.match(limiter, /DEFAULT_MAX_ACTIVE\s*=\s*2/);
  assert.match(systemRoute, /\/background-task-limiter/);
  assert.match(systemRoute, /backgroundTaskLimiterSnapshot/);
  assert.match(draftRoute, /withBackgroundTaskSlot\("product_archive_draft"/);
  assert.match(draftRoute, /withBackgroundTaskSlot\("product_archive_ocr"/);
  assert.match(draftRoute, /LISTINGIFY_PRODUCT_ARCHIVE_OCR_JOB_SLICE_SIZE/);
  assert.match(archiveRoute, /withBackgroundTaskSlot\("product_archive_sync"/);
  assert.match(archiveRoute, /LISTINGIFY_PRODUCT_ARCHIVE_SYNC_JOB_SLICE_SIZE/);
  assert.match(categoryRoute, /withBackgroundTaskSlot\("category_mapping_ai_suggestions"/);
  assert.match(platformJobs, /withBackgroundTaskSlot\(\s*"shein_platform_product_sync"/);
  assert.match(platformJobs, /withBackgroundTaskSlot\(\s*"shein_platform_product_export"/);
  assert.match(launchPlanJobs, /withBackgroundTaskSlot\(\s*"listing_launch_plan_import"/);
});

test("async task center supports backend stop delete and requeue confirmations", async () => {
  const [taskCenter, context, route] = await Promise.all([
    file("web/src/components/async-task-center.tsx"),
    file("web/src/lib/async-task-context.ts"),
    file("web/server/routes/system.ts"),
  ]);

  assert.match(taskCenter, /ConfirmDialog/);
  assert.match(taskCenter, /CircleStop/);
  assert.match(taskCenter, /RotateCcw/);
  assert.match(taskCenter, /重新加入队列/);
  assert.match(taskCenter, /会从未完成项重新跑，已成功的不会重复执行/);
  assert.match(taskCenter, /\/system\/async-tasks\/\$\{task\.type\}\/\$\{encodeURIComponent\(task\.id\)\}\/stop/);
  assert.match(taskCenter, /\/system\/async-tasks\/\$\{task\.type\}\/\$\{encodeURIComponent\(task\.id\)\}\/requeue/);
  assert.match(taskCenter, /api\.delete<AsyncTaskActionResponse>\(`\/system\/async-tasks\/\$\{task\.type\}\/\$\{encodeURIComponent\(task\.id\)\}`\)/);
  assert.match(context, /updateTask/);
  assert.match(route, /post\("\/async-tasks\/:taskType\/:taskId\/stop"/);
  assert.match(route, /post\("\/async-tasks\/:taskType\/:taskId\/requeue"/);
  assert.match(route, /delete\("\/async-tasks\/:taskType\/:taskId"/);
  assert.match(route, /async_task\.requeued/);
  assert.match(route, /STOPPED_BY_USER_MESSAGE/);
  assert.match(route, /product_archive_sync_job/);
  assert.match(route, /listing_launch_plan_import_job/);
  assert.match(route, /category_ai_suggestion_job/);
  assert.match(route, /shein_platform_product_job/);
});

test("Yunxiao deploy overwrites forwarded security headers at the trusted proxy", async () => {
  const deploy = await file("ci/yunxiao-deploy.sh");

  assert.match(deploy, /https:\/\/listingify\.semirapp\.com/);
  assert.match(deploy, /proxy_set_header X-Forwarded-Proto \$scheme/);
  assert.match(deploy, /proxy_set_header X-Forwarded-For \$remote_addr/);
  assert.doesNotMatch(deploy, /proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto/);
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

test("user management backend avoids PostgreSQL reserved aliases in list query", async () => {
  const route = await file("web/server/routes/users.ts");

  assert.match(route, /from app_user app_user/);
  assert.match(route, /group by\s+app_user\.id/s);
  assert.doesNotMatch(route, /from app_user user/);
});
