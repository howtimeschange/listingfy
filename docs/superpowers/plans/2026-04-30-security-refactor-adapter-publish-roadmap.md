# Listingify Security, Refactor, Adapter, Publish Reliability Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按安全加固、`pre-publish.ts` 拆分、`PlatformAdapter` 抽象、可靠批量发布、统一测试入口的顺序，把当前可试运营 MVP 推进到更接近生产化的工程形态。

**Architecture:** 先不重写业务流程，优先把高风险边界收住：认证、CORS、凭据存储、登录限流和测试入口。随后把 `pre-publish.ts` 按业务职责拆成服务模块，再把 SHEIN 平台调用沉淀到 `PlatformAdapter`，最后用任务幂等和状态轮询稳定批量发布。

**Tech Stack:** Node.js 24+, Hono, React/Vite, TypeScript, SQLite/better-sqlite3, node:test, tsx.

---

## File Structure

- Modify: `web/server/lib/auth.ts` - 管理密码哈希、会话、管理员初始化、登录失败限制。
- Modify: `web/server/routes/auth.ts` - 登录时记录失败、锁定、成功清理失败记录。
- Modify: `web/server/index.ts` - CORS 白名单配置。
- Modify: `web/server/lib/platform-config.ts` - 平台凭据加密、解密、响应脱敏、环境迁移。
- Modify: `web/server/routes/platform-integrations.ts` - 写入平台凭据时加密，测试配置时用解密后的值判断。
- Modify: `db/migrations/014_system_management_auth_platform_integrations.sql` - 给用户表补登录失败计数和锁定时间字段。
- Create: `db/migrations/015_security_hardening.sql` - 给已迁移库补安全字段。
- Create: `scripts/create_admin_user.mjs` - 显式创建或重置管理员账号，替代默认弱口令自动创建。
- Modify: `.env.example` - 增加管理员初始化、CORS、凭据加密密钥、登录失败限制说明。
- Modify: `package.json` - 增加统一 `npm test`、安全测试入口。
- Modify: `scripts/lib/system_management_ui.test.mjs` - 用文本测试覆盖安全配置存在性。
- Modify: `scripts/lib/platform_config.test.mjs` - 覆盖平台凭据加密、解密、脱敏、环境迁移。
- Create: `scripts/lib/auth_security.test.mjs` - 覆盖管理员初始化和登录失败限制。
- Future create: `web/server/services/pre-publish/drafts.ts` - 草稿查询、创建、复制、暂停、归档。
- Future create: `web/server/services/pre-publish/field-fills.ts` - 字段填充、枚举映射、AI 推荐结果落库。
- Future create: `web/server/services/pre-publish/assets.ts` - 草稿图片、本地上传、素材库选择、图片规则判断。
- Future create: `web/server/services/pre-publish/validation.ts` - 发布前阻断项、完整度、类型化校验。
- Future create: `web/server/services/pre-publish/payload.ts` - SHEIN payload 构造和版本快照。
- Future create: `web/server/platform-adapters/types.ts` - `PlatformAdapter` 接口。
- Future create: `web/server/platform-adapters/shein.ts` - SHEIN 类目、属性、图片、发布、状态同步适配器。
- Future create: `web/server/platform-adapters/index.ts` - 平台适配器注册表。
- Future create: `web/server/services/publish/publish-job-service.ts` - 批量发布幂等、重试、失败归因、批次状态聚合。

---

## Task 1: Security Hardening

**Files:**
- Modify: `web/server/lib/auth.ts`
- Modify: `web/server/routes/auth.ts`
- Modify: `web/server/index.ts`
- Modify: `web/server/lib/platform-config.ts`
- Modify: `web/server/routes/platform-integrations.ts`
- Modify: `db/migrations/014_system_management_auth_platform_integrations.sql`
- Create: `db/migrations/015_security_hardening.sql`
- Create: `scripts/create_admin_user.mjs`
- Modify: `.env.example`
- Test: `scripts/lib/auth_security.test.mjs`
- Test: `scripts/lib/platform_config.test.mjs`
- Test: `scripts/lib/system_management_ui.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests asserting:
- `ensureAdminUser()` does not seed `admin/admin123456` when `LISTINGIFY_ADMIN_PASSWORD` is absent.
- `ensureAdminUser()` seeds an admin when explicit env credentials are present.
- Login failure logic locks an account after the configured threshold and clears counters after success.
- Platform credentials are stored encrypted when `LISTINGIFY_CREDENTIAL_SECRET` is present and resolve back to plaintext only inside server code.
- CORS is configured from `LISTINGIFY_ALLOWED_ORIGINS`, not `cors()` with no options.

Run:

```bash
npm --prefix web exec tsx -- --test ../scripts/lib/auth_security.test.mjs ../scripts/lib/platform_config.test.mjs ../scripts/lib/system_management_ui.test.mjs
```

Expected: FAIL before implementation because the new helpers and config do not exist yet.

- [ ] **Step 2: Implement minimal security code**

Implement:
- `ensureAdminUser()` requires explicit `LISTINGIFY_ADMIN_PASSWORD`; no fallback password.
- `scripts/create_admin_user.mjs --username <name> --password <password>` creates or resets an admin user.
- CORS whitelist parser accepts comma-separated origins and defaults to localhost development origins.
- Platform config encrypts `secret_key` and `app_secret_key` with AES-256-GCM when `LISTINGIFY_CREDENTIAL_SECRET` is set.
- Login failure tracking uses `failed_login_count` and `locked_until` on `app_user`.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npm --prefix web exec tsx -- --test ../scripts/lib/auth_security.test.mjs ../scripts/lib/platform_config.test.mjs ../scripts/lib/system_management_ui.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Create local administrator**

Run a generated strong password through:

```bash
node scripts/create_admin_user.mjs --username admin --display-name 系统管理员 --password '<generated-password>'
```

Expected: command reports the admin user was created or reset and assigned the `ADMIN` role.

---

## Task 2: Unified Test Entry

**Files:**
- Modify: `package.json`
- Modify: `web/package.json`

- [ ] **Step 1: Add failing script check**

Run:

```bash
npm test
```

Expected before implementation: missing script.

- [ ] **Step 2: Add stable scripts**

Root scripts:

```json
{
  "test": "npm --prefix web exec tsx -- --test scripts/lib/*.test.mjs",
  "test:security": "npm --prefix web exec tsx -- --test scripts/lib/auth_security.test.mjs scripts/lib/platform_config.test.mjs scripts/lib/system_management_ui.test.mjs",
  "web:build": "npm --prefix web run build",
  "web:lint": "npm --prefix web run lint"
}
```

The final command may need `../scripts/lib/*.test.mjs` depending on `npm --prefix web exec` cwd behavior; verify with an actual run before committing.

- [ ] **Step 3: Verify**

Run:

```bash
npm test
npm --prefix web run build
```

Expected: test suite and TypeScript/Vite build both exit 0.

---

## Task 3: Split `pre-publish.ts`

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Create: `web/server/services/pre-publish/drafts.ts`
- Create: `web/server/services/pre-publish/field-fills.ts`
- Create: `web/server/services/pre-publish/assets.ts`
- Create: `web/server/services/pre-publish/validation.ts`
- Create: `web/server/services/pre-publish/payload.ts`
- Create: `scripts/lib/pre_publish_services.test.mjs`

- [ ] **Step 1: Characterization tests**

Add tests around current API behavior by reading exported services only after extracting pure functions:
- list drafts preserves filters and pagination.
- draft detail keeps `SPU -> SKC -> SKU` grouping.
- validation returns blocking issues for missing category, title, required attributes, weight, package dimensions, and required images.
- payload builder omits hidden SHEIN fields and includes required attributes.

- [ ] **Step 2: Extract pure helpers first**

Move JSON parsing, numeric parsing, scope key building, field grouping, picture requirement building, and payload shaping into focused service files without changing route behavior.

- [ ] **Step 3: Extract write paths**

Move create/copy/pause/resume/delete draft operations and image operations into service functions. Keep Hono route handlers thin: parse request, call service, return JSON.

- [ ] **Step 4: Verify route behavior**

Run:

```bash
npm test
npm --prefix web run build
```

Expected: existing UI text tests, service tests, and TypeScript build pass.

---

## Task 4: PlatformAdapter Abstraction

**Files:**
- Create: `web/server/platform-adapters/types.ts`
- Create: `web/server/platform-adapters/shein.ts`
- Create: `web/server/platform-adapters/index.ts`
- Modify: `web/server/routes/pre-publish.ts`
- Modify: `web/server/routes/publish-tasks.ts`
- Test: `scripts/lib/platform_adapter.test.mjs`

- [ ] **Step 1: Define interface from existing SHEIN behavior**

`PlatformAdapter` must include:
- `platform`
- `fetchCategoryTree()`
- `fetchAttributeTemplate(categoryId, productTypeId)`
- `uploadAsset(input)`
- `buildPublishPayload(listingId)`
- `publishListing(payload)`
- `syncPublishStatus(taskId)`

- [ ] **Step 2: Wrap current SHEIN client**

Create `SheinAdapter` that delegates to existing `shein_client.mjs`, platform config resolution, payload builder, and status sync code.

- [ ] **Step 3: Replace direct SHEIN calls on publish paths**

Route-level publish code calls adapter registry by listing/platform instead of importing SHEIN client directly.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm --prefix web run build
```

Expected: adapter tests and existing publish route tests pass.

---

## Task 5: Reliable Batch Publish Jobs

**Files:**
- Create: `db/migrations/016_publish_job_reliability.sql`
- Create: `web/server/services/publish/publish-job-service.ts`
- Modify: `web/server/routes/listing-batches.ts`
- Modify: `web/server/routes/publish-tasks.ts`
- Test: `scripts/lib/publish_job_reliability.test.mjs`

- [ ] **Step 1: Add idempotency model**

Migration adds:
- `listing_publish_task.idempotency_key`
- unique index on `(platform, idempotency_key)`
- retry counters and next retry time
- failure category and failure fingerprint
- batch-level last sync timestamp.

- [ ] **Step 2: Implement submit orchestration**

Batch submit creates tasks idempotently, skips already submitted draft versions, and records per-draft outcomes.

- [ ] **Step 3: Implement retry and failure grouping**

Retry uses task state and idempotency key. Failure grouping normalizes platform errors into user-facing categories.

- [ ] **Step 4: Implement status polling hook**

Manual endpoint first; scheduled worker can be added after the sync code is deterministic.

- [ ] **Step 5: Verify**

Run:

```bash
npm test
npm --prefix web run build
```

Expected: publish job tests and build pass.

---

## Execution Order

1. Complete Task 1 and Task 2 in the current session.
2. Start Task 3 only after security tests and build pass.
3. Start Task 4 only after `pre-publish.ts` has service boundaries.
4. Start Task 5 only after publish calls go through `PlatformAdapter`.

## Self-Review

- Spec coverage: all five requested priorities are represented.
- Placeholder scan: no `TBD`, no unbounded “add tests” instruction without explicit behaviors.
- Type consistency: adapter names, service paths, and test filenames are consistent across tasks.
