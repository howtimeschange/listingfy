# Pre Publish Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 发布校验 into a platform-aware draft workflow with product selection, SHEIN draft records, single-product detail editing, and version history.

**Architecture:** Keep product readiness computation in `web/server/routes/pre-publish.ts`, then persist selected products into spec-aligned `listing`, `listing_skc`, `listing_sku`, `listing_validation_result`, and `listing_publish_version` tables. The list page becomes a selection/workbench surface; a new detail route owns field review and manual edits.

**Tech Stack:** SQLite migrations, Hono API routes, React Router, TanStack Query, shadcn-style local UI components, Node test runner.

---

### Task 1: Lock Required Workflow With Tests

**Files:**
- Modify: `scripts/lib/pre_publish_workbench_ui.test.mjs`
- Test: `scripts/lib/pre_publish_workbench_ui.test.mjs`

- [ ] Add assertions that `/pre-publish-validation` exposes platform selection, batch SPU search, row checkboxes, create draft action, and draft list links.
- [ ] Add assertions that `web/server/routes/pre-publish.ts` exposes draft APIs and uses `listing`, `listing_skc`, `listing_sku`, `listing_publish_version`, and `listing_validation_result`.
- [ ] Add assertions that `web/src/pages/pre-publish-validation/[listingId]/page.tsx` exists and includes platform/category required fields, manual save, and version history.
- [ ] Run `node --test scripts/lib/pre_publish_workbench_ui.test.mjs` and verify the new assertions fail before implementation.

### Task 2: Add Draft Tables

**Files:**
- Create: `db/migrations/008_listing_drafts_and_versions.sql`

- [ ] Create `channel_account` with a default SHEIN account row so `listing.channel_account_id` can be non-null.
- [ ] Create `listing`, `listing_skc`, `listing_sku`, `listing_validation_result`, and `listing_publish_version` with SQLite-compatible columns matching the spec subset.
- [ ] Add indexes for platform/status/product lookups.
- [ ] Run `npm run db:migrate` and verify migration applies.

### Task 3: Implement Draft APIs

**Files:**
- Modify: `web/server/routes/pre-publish.ts`

- [ ] Add `GET /platforms` returning SHEIN as the only enabled platform.
- [ ] Add `GET /drafts` returning persisted drafts with latest version and blocking issue count.
- [ ] Add `POST /drafts` accepting `{ platform, spu_codes }`, creating one draft per SPU from readiness rows, hydrating SKC/SKU children, validation rows, and initial draft version.
- [ ] Add `GET /drafts/:id` returning the draft, SKC/SKU summary, field groups, validation issues, and versions.
- [ ] Add `PATCH /drafts/:id/fields` to persist manual field fills, recompute validation, bump draft updated time, and append a version.
- [ ] Add `POST /drafts/:id/versions` to manually snapshot current draft state.

### Task 4: Refactor List Page

**Files:**
- Modify: `web/src/pages/pre-publish-validation/page.tsx`

- [ ] Replace inline detail with platform selector, batch search, checkbox selection, candidate table, create draft action, and draft table.
- [ ] Keep readiness summary and AI fill, scoped to selected candidates when possible.
- [ ] Link each draft to `/pre-publish-validation/:listingId`.

### Task 5: Add Single Draft Detail Page

**Files:**
- Create: `web/src/pages/pre-publish-validation/[listingId]/page.tsx`
- Modify: `web/src/router.tsx`

- [ ] Show selected platform/category, draft status, validation status, and version number.
- [ ] Show SKC strip with TMALL `COLOR_BLOCK` / `COLOR` images.
- [ ] Show required field groups and exact fill status.
- [ ] Support manual editing and saving fields.
- [ ] Show version history and allow creating a new snapshot.

### Task 6: Label SHEIN-Specific Rules

**Files:**
- Modify: `web/src/pages/size-conversion/page.tsx`
- Modify: `web/src/pages/low-rate-list/page.tsx`
- Modify: `web/src/components/layout/app-sidebar.tsx`
- Modify: `web/src/components/layout/app-header.tsx`

- [ ] Rename visible labels to `SHEIN 尺码转换` and `SHEIN 低倍率清单`.
- [ ] Make descriptions clear these are SHEIN adapters, not platform-neutral rules.

### Task 7: Verify

**Commands:**
- `node --test scripts/lib/pre_publish_workbench_ui.test.mjs scripts/lib/business_rules_page_ui.test.mjs scripts/lib/product_archive_page_ui.test.mjs scripts/lib/category_mapping_page_ui.test.mjs scripts/lib/ai_category_matcher.test.mjs`
- `npm --prefix web run build`
- Browser/IAB: check `/pre-publish-validation` and one `/pre-publish-validation/:listingId`.

- [ ] Fix any failing tests or build errors.
- [ ] Summarize remaining spec gaps clearly.
