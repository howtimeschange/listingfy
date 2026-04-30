# SHEIN Publish Loop Phase A/B/C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the SHEIN listing flow from draft validation through publish task tracking, price/image confirmation, and batch-level operations.

**Architecture:** Keep platform-neutral product data in product archive tables, keep SHEIN-specific readiness in `shein_product_bucket` and `listing_*`, and treat publish attempts as immutable versions plus task records. The draft box remains the editing surface; publish tasks become the post-submit tracking and retry surface; listing batches group drafts for batch operations and progress tracking.

**Tech Stack:** SQLite migrations, Hono server routes, React Router pages, TanStack Query, local UI components, Node test runner.

---

### Task 1: Phase A Publish Loop State Machine

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Modify: `web/server/routes/publish-tasks.ts`
- Modify: `web/src/pages/publish-tasks/page.tsx`
- Modify: `web/src/pages/publish-tasks/[id]/page.tsx`

- [ ] Normalize publish task statuses into `PUBLISHING`, `SUBMITTED`, `AUDITING`, `PUBLISHED`, `FAILED`, and `REJECTABLE` display labels while remaining compatible with existing persisted `PUBLISH_SUBMITTED` and `PUBLISH_FAILED` rows.
- [ ] Add task actions for retry and manual status sync.
- [ ] Ensure retry creates a new publish version and task, never mutates old request/response history.
- [ ] Ensure successful responses update `platform_identity` for listing, SKC, and SKU where SHEIN returns IDs.
- [ ] Surface task actions and status explanations in list/detail UI.

### Task 2: Phase B Price And Asset Gates

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Modify: `web/src/pages/pre-publish-validation/[listingId]/page.tsx`
- Create migration if needed.

- [ ] Add price confirmation status at SKU/draft level.
- [ ] Block publish when selected SKU price is missing or unconfirmed.
- [ ] Add explicit asset prepare status and error fields for `listing_asset`.
- [ ] Treat missing SHEIN URL, failed transform, or unconfirmed selected SKC image as field-level blockers.
- [ ] Add draft detail controls to confirm prices and prepare/refresh images.

### Task 3: Phase C Listing Batch Workbench

**Files:**
- Modify: `web/server/routes/listing-batches.ts` or create it if missing.
- Modify: `web/server/index.ts`
- Modify: `web/src/pages/listing-batches/page.tsx`
- Modify: `web/src/pages/listing-batches/[id]/page.tsx`

- [ ] Replace coming-soon batch page with a usable SHEIN batch list.
- [ ] Support creating a batch from SPU codes or selected drafts.
- [ ] Show batch-level counts by draft status, validation status, SKU count, SKC count, and blocking issue count.
- [ ] Link batch rows to a batch detail page listing its drafts and publish progress.
- [ ] Support batch preflight and batch publish entry points by reusing draft APIs.

### Task 4: Verification

**Commands:**
- `node --test scripts/lib/list_pagination_ui.test.mjs scripts/lib/pre_publish_workbench_ui.test.mjs scripts/lib/shein_product_bucket_ui.test.mjs`
- `npm --prefix web run build`

- [ ] Fix failing tests/build errors.
- [ ] Browser check `/pre-publish-validation`, `/publish-tasks`, `/listing-batches`, and one listing detail.
- [ ] Summarize remaining spec gaps after A/B/C.
