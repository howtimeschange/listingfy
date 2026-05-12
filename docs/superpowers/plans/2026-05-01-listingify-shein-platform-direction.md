# Listingify SHEIN Platform Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 SHEIN 单款真实发布能力推进到批量可运营，并沉淀任务、异常、发布包、字段血缘和平台适配边界。

**Architecture:** 保持模块化单体。商品事实层保持平台无关，SHEIN 能力通过分桶、草稿、发布版本、发布任务和 adapter 承载。批次详情成为批量操作中心，异常工作台成为失败闭环入口。

**Tech Stack:** React, Vite, Hono, better-sqlite3, TypeScript, Node.js, node:test, tsx.

---

## File Structure

- Modify: `web/server/routes/listing-batches.ts` - 批次级发布任务、状态汇总、失败聚合 API。
- Modify: `web/src/pages/listing-batches/[id]/page.tsx` - 批次详情操作中心。
- Modify: `web/src/pages/listing-batches/page.tsx` - 批次列表展示任务汇总和最近同步时间。
- Modify: `web/server/services/publish/publish-job-service.ts` - 批量任务分项、失败归因、批量重试。
- Modify: `web/server/services/publish/shein-status-sync.ts` - 批次级审核状态同步和异常生成。
- Create: `db/migrations/020_publish_task_items_and_exceptions.sql` - 任务分项和异常表。
- Create: `web/server/services/exceptions/exception-service.ts` - 异常 upsert、关闭、重开、查询 helper。
- Create: `web/server/routes/exceptions.ts` - 异常工作台 API。
- Create: `web/src/pages/exceptions/page.tsx` - 异常列表和详情抽屉。
- Modify: `web/src/components/layout/app-sidebar.tsx` - 增加异常工作台入口。
- Create: `db/migrations/021_field_lineage_events.sql` - 字段血缘事件表。
- Create: `web/server/services/pre-publish/lineage.ts` - 字段来源、AI、规则、人工覆盖记录 helper。
- Modify: `web/server/routes/pre-publish.ts` - 在保存草稿、AI 丰富、类目调整、图片调整时记录血缘。
- Modify: `web/server/platform-adapters/types.ts` - 固化 `PlatformAdapter` contract。
- Modify: `web/server/platform-adapters/shein.ts` - 收敛 SHEIN adapter 实现。
- Test: `scripts/lib/listing_batch_publish_service.test.mjs`
- Test: `scripts/lib/listing_batch_publish_ui.test.mjs`
- Test: `scripts/lib/exception_workbench.test.mjs`
- Test: `scripts/lib/field_lineage.test.mjs`
- Test: `scripts/lib/platform_adapter.test.mjs`

## Task 1: Batch Publish Operation Center

- [ ] **Step 1: Add a failing UI wiring test**

Create `scripts/lib/listing_batch_publish_ui.test.mjs` that reads `web/src/pages/listing-batches/[id]/page.tsx` and asserts the page calls these endpoints:

```js
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const page = fs.readFileSync("web/src/pages/listing-batches/[id]/page.tsx", "utf8")

test("batch detail page wires publish operations", () => {
  assert.match(page, /publish-summary/)
  assert.match(page, /publish-tasks/)
  assert.match(page, /sync-status/)
  assert.match(page, /retry-failed/)
  assert.match(page, /失败原因|failure/i)
  assert.match(page, /重试|retry/i)
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_batch_publish_ui.test.mjs
```

Expected: FAIL until the batch detail page has all required calls and UI labels.

- [ ] **Step 3: Implement batch detail operations**

Modify `web/src/pages/listing-batches/[id]/page.tsx` to:

1. Query `/listing-batches/${id}/publish-summary`.
2. Mutate `/listing-batches/${id}/publish-tasks`.
3. Mutate `/listing-batches/${id}/sync-status`.
4. Mutate `/listing-batches/${id}/retry-failed`.
5. Render task summary cards.
6. Render grouped failure reasons.
7. Render buttons for generating tasks, syncing status, retrying failed items, and opening filtered publish tasks.

- [ ] **Step 4: Return summary fields from backend**

Modify `web/server/routes/listing-batches.ts` to include:

```ts
publish_status_summary_json
last_status_synced_at
failure_groups
task_status_counts
retryable_failed_count
```

in batch detail responses.

- [ ] **Step 5: Verify targeted flow**

Run:

```bash
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_batch_publish_ui.test.mjs
npm run web:build
```

Expected: test PASS and build exit 0.

## Task 2: Publish Task Items

- [ ] **Step 1: Add migration**

Create `db/migrations/020_publish_task_items_and_exceptions.sql` with `listing_publish_task_item`, `exception_record`, and `exception_event` as defined in `docs/spec-listingify-shein-mvp-and-platform-direction-2026-05-01.md`.

- [ ] **Step 2: Add failing service test**

Create `scripts/lib/listing_batch_publish_service.test.mjs` that verifies a batch task can store item-level success and failure, and that the aggregate status becomes `PARTIAL_SUCCESS` when at least one item succeeds and one fails.

- [ ] **Step 3: Implement task item persistence**

Modify `web/server/services/publish/publish-job-service.ts` to:

1. Create one `listing_publish_task_item` per listing submitted inside a batch task.
2. Mark item status independently.
3. Store item error code, message, failure category, fingerprint, and retryability.
4. Compute task status from item statuses.

- [ ] **Step 4: Verify**

Run:

```bash
npm run db:migrate
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_batch_publish_service.test.mjs
```

Expected: migration applies and targeted test PASS.

## Task 3: Exception Workbench Backend

- [ ] **Step 1: Add failing exception service test**

Create `scripts/lib/exception_workbench.test.mjs` to verify:

1. Same fingerprint and listing updates one open exception.
2. Resolving an exception writes an event.
3. Reopening an exception writes an event.
4. Query supports status and failure category filters.

- [ ] **Step 2: Implement exception service**

Create `web/server/services/exceptions/exception-service.ts` with:

```ts
export function upsertException(...)
export function resolveException(...)
export function reopenException(...)
export function listExceptions(...)
export function getExceptionDetail(...)
```

- [ ] **Step 3: Implement routes**

Create `web/server/routes/exceptions.ts`:

```text
GET  /exceptions
GET  /exceptions/:id
POST /exceptions/:id/resolve
POST /exceptions/:id/reopen
POST /exceptions/:id/retry
```

Wire the route in `web/server/index.ts`.

- [ ] **Step 4: Emit exceptions from existing flows**

Update:

1. `web/server/services/publish/publish-job-service.ts`
2. `web/server/services/publish/shein-status-sync.ts`
3. `web/server/routes/pre-publish.ts`

to call `upsertException` for publish failure, audit rejection, image transform failure, and validation blockers.

- [ ] **Step 5: Verify**

Run:

```bash
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/exception_workbench.test.mjs
npm test
```

Expected: targeted test PASS and full test suite PASS.

## Task 4: Exception Workbench UI

- [ ] **Step 1: Add static UI test**

Create `scripts/lib/exception_workbench_ui.test.mjs` to assert:

1. `web/src/pages/exceptions/page.tsx` calls `/exceptions`.
2. The page has filters for status and failure category.
3. The page renders actions for resolve, reopen, retry, and jump to draft/task.
4. `web/src/components/layout/app-sidebar.tsx` contains the exception workbench nav entry.

- [ ] **Step 2: Implement page**

Create `web/src/pages/exceptions/page.tsx`:

1. Table of exceptions.
2. Filter toolbar.
3. Detail drawer.
4. Resolve/reopen buttons.
5. Retry button when retryable.
6. Links to listing draft, publish task, and batch detail.

- [ ] **Step 3: Wire route and navigation**

Modify:

1. `web/src/router.tsx`
2. `web/src/components/layout/app-sidebar.tsx`

Add route `/exceptions` and sidebar label `异常工作台`.

- [ ] **Step 4: Verify**

Run:

```bash
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/exception_workbench_ui.test.mjs
npm run web:build
npm run web:lint
```

Expected: targeted test PASS, build exit 0, lint exit 0.

## Task 5: Publish Package Summary and Version Diff

- [ ] **Step 1: Add test for package summary**

Extend `scripts/lib/pre_publish_services.test.mjs` to verify a publish version includes:

```text
package_summary_json
diff_summary_json
source_snapshot
price_snapshot
asset_snapshot
request_payload
```

- [ ] **Step 2: Add migration if fields are missing**

Create `db/migrations/022_publish_version_summary_diff.sql` adding:

```sql
alter table listing_publish_version add column package_summary_json text not null default '{}';
alter table listing_publish_version add column diff_summary_json text not null default '{}';
```

- [ ] **Step 3: Implement summary builder**

Create `web/server/services/pre-publish/package-summary.ts` with:

```ts
export function buildPackageSummary(...)
export function buildVersionDiffSummary(...)
```

The summary must include category, title, selected SKCs, selected SKUs, image count, unconfirmed image count, price confirmation count, package completeness, and blocking issue count.

- [ ] **Step 4: Show summary before publish**

Modify `web/src/pages/pre-publish-validation/[listingId]/page.tsx` so publish confirmation displays package summary instead of only generic text.

- [ ] **Step 5: Verify**

Run:

```bash
npm run db:migrate
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/pre_publish_services.test.mjs
npm run web:build
```

Expected: migration applies, targeted test PASS, build exit 0.

## Task 6: Field Lineage

- [ ] **Step 1: Add migration**

Create `db/migrations/021_field_lineage_events.sql` with `field_lineage_event` as defined in the SPEC.

- [ ] **Step 2: Add failing lineage test**

Create `scripts/lib/field_lineage.test.mjs` that verifies:

1. Manual field save creates lineage events.
2. AI enrichment creates lineage events with `source_type = AI`.
3. Rule fill creates lineage events with `source_type = RULE`.

- [ ] **Step 3: Implement lineage helper**

Create `web/server/services/pre-publish/lineage.ts` with:

```ts
export function recordFieldLineage(...)
export function recordManyFieldLineage(...)
```

- [ ] **Step 4: Wire lineage recording**

Modify `web/server/routes/pre-publish.ts` at:

1. Save draft.
2. AI enrich.
3. Category update.
4. SKU commercial field save.
5. Image selection/upload.

- [ ] **Step 5: Verify**

Run:

```bash
npm run db:migrate
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/field_lineage.test.mjs
```

Expected: migration applies and targeted test PASS.

## Task 7: Platform Adapter Boundary

- [ ] **Step 1: Add adapter contract test**

Extend `scripts/lib/platform_adapter.test.mjs` to assert:

1. `web/server/platform-adapters/types.ts` exports `PlatformAdapter`.
2. `web/server/platform-adapters/shein.ts` exports a SHEIN adapter implementing required method names.
3. No TEMU real publish route is exposed.

- [ ] **Step 2: Update adapter types**

Modify `web/server/platform-adapters/types.ts` with the contract from the SPEC:

```ts
fetchCategoryTree
fetchPublishRules
fetchAttributeTemplate
validateListing
prepareAssets
buildPublishPayload
publishListing
syncPublishStatus
normalizeError
```

- [ ] **Step 3: Move SHEIN-specific helpers behind adapter**

Modify `web/server/platform-adapters/shein.ts` and existing publish services so SHEIN signing, payload build, response parse, platform identity extraction, and error normalization are adapter-owned.

- [ ] **Step 4: Verify no behavior regression**

Run:

```bash
NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/platform_adapter.test.mjs scripts/lib/publish_job_service.test.mjs scripts/lib/listing_batch_publish_service.test.mjs
npm run web:build
```

Expected: targeted tests PASS and build exit 0.

## Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run web build**

Run:

```bash
npm run web:build
```

Expected: TypeScript and Vite build exit 0.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run web:lint
```

Expected: lint exit 0.

- [ ] **Step 4: Manual smoke test**

Start:

```bash
npm run web:server
npm run web:dev
```

Smoke path:

```text
Login
  -> SHEIN 发布草稿箱
  -> open one draft
  -> view package summary
  -> 上新批次
  -> open one batch
  -> view publish summary
  -> 发布任务
  -> open one task
  -> 异常工作台
  -> filter open exceptions
```

Expected: pages load and actions render without client errors.
