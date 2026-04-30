# System Management RBAC Platform Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn system management into working authentication, RBAC user management, audit logs, sync task views, and a multi-platform integration entry that migrates existing SHEIN env credentials into database-backed configuration.

**Architecture:** Keep the existing Hono + React + SQLite shape. Add small server-side auth/platform/audit modules, protect API routes with HttpOnly cookie sessions, and keep platform credentials in `platform_integration` while preserving `.env` fallback for SHEIN scripts and runtime safety.

**Tech Stack:** Hono, React Router, TanStack Query, SQLite migrations, Node `crypto.scrypt`, existing shadcn-style UI primitives.

---

### Task 1: Tests First

**Files:**
- Create: `scripts/lib/system_management_ui.test.mjs`
- Create: `scripts/lib/platform_config.test.mjs`

- [ ] Add static tests that assert routes, pages, menu labels, auth client calls, RBAC API route registration, and platform integration route registration exist.
- [ ] Add behavior tests around SHEIN credential resolution: database config wins, inactive database config falls back to environment variables, secret values are masked for list responses.
- [ ] Run `node --test scripts/lib/system_management_ui.test.mjs scripts/lib/platform_config.test.mjs` and verify it fails because the feature does not exist yet.

### Task 2: Database And Server Foundation

**Files:**
- Create: `db/migrations/014_system_management_auth_platform_integrations.sql`
- Create: `web/server/lib/auth.ts`
- Create: `web/server/lib/audit.ts`
- Create: `web/server/lib/platform-config.ts`
- Modify: `web/server/index.ts`
- Modify: `scripts/lib/shein_client.mjs`

- [ ] Create auth, role, permission, session, operation log, and platform integration tables.
- [ ] Seed RBAC roles and permissions in SQL.
- [ ] Bootstrap a default admin user on server startup using `LISTINGIFY_ADMIN_USERNAME` and `LISTINGIFY_ADMIN_PASSWORD`, with `admin / admin123456` as local-dev fallback.
- [ ] Migrate `.env.local` SHEIN values on startup into `platform_integration` if no active SHEIN config exists.
- [ ] Change SHEIN request helpers to accept explicit credentials while keeping env fallback.

### Task 3: Auth, User, Platform, Sync, Audit APIs

**Files:**
- Create: `web/server/routes/auth.ts`
- Create: `web/server/routes/users.ts`
- Create: `web/server/routes/platform-integrations.ts`
- Create: `web/server/routes/system.ts`
- Modify: `web/server/index.ts`

- [ ] Implement `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`.
- [ ] Implement user CRUD, role assignment, status changes, and password reset.
- [ ] Implement platform integration list/create/update/delete/test endpoints with masked secrets in responses.
- [ ] Implement sync task and operation log list endpoints.
- [ ] Audit user and platform mutations.

### Task 4: Frontend Auth And Pages

**Files:**
- Create: `web/src/pages/login/page.tsx`
- Create: `web/src/pages/users/page.tsx`
- Create: `web/src/pages/platform-integrations/page.tsx`
- Create: `web/src/lib/auth.tsx`
- Modify: `web/src/lib/api-client.ts`
- Modify: `web/src/router.tsx`
- Modify: `web/src/components/layout/app-layout.tsx`
- Modify: `web/src/components/layout/app-header.tsx`
- Modify: `web/src/components/layout/app-sidebar.tsx`
- Modify: `web/src/pages/sync-tasks/page.tsx`
- Modify: `web/src/pages/operation-logs/page.tsx`

- [ ] Add login page and protected app layout.
- [ ] Add user management table and edit dialog.
- [ ] Replace `SHEIN 账号` with `平台对接` and add a SHEIN config form.
- [ ] Replace sync task and operation log placeholders with working list pages.
- [ ] Filter menu items by current user's permissions.

### Task 5: Verification

**Files:**
- Modify only files touched above if failures are found.

- [ ] Run database migrations with `npm run db:migrate`.
- [ ] Run focused tests with `node --test scripts/lib/system_management_ui.test.mjs scripts/lib/platform_config.test.mjs`.
- [ ] Run `npm run build` inside `web`.
- [ ] Confirm SHEIN platform configuration is seeded from existing environment values and secret values are never returned in full.
