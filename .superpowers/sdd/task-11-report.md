# Task 11 Report - Product Archive Performance Rollout Config and Handoff

## Status

DONE_WITH_CONCERNS - local development/readiness only

## Commits

- `08a1529` - `perf: validate product archive rollout config`
- `7d5c03d` - `docs: record product archive rollout handoff`
- `e5665ea` - `fix: scope product archive task 11 readiness`

## Files Changed

- `scripts/lib/product_archive_performance_config.mjs`
- `scripts/lib/product_archive_performance_config.test.mjs`
- `web/server/index.ts`
- `scripts/lib/product_archive_sync_queue.mjs`
- `web/server/routes/product-archive-drafts.ts`
- `web/server/routes/product-archives.ts`
- `web/server/services/product-archive-bulk-write.ts`
- `web/server/services/product-archive-workflow-jobs.ts`
- `scripts/lib/product_archive_bulk_write.test.mjs`
- `scripts/lib/product_archive_ai_fill_bench_safety.test.mjs`
- `scripts/lib/product_archive_creation.test.mjs`
- `scripts/lib/deepdraw_product_archive_ui.test.mjs`
- `ci/yunxiao-deploy.sh`
- `docs/reference/integration-handoffs/product-archive-performance-rollout-20260904.md`

## What Changed

- Added shared Product Archive performance env validation for:
  - `LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY`, default `1`, allowed `1..4`
  - `LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY`, default `1`, allowed `1..4`
  - `LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY`, default `1`, allowed `1..2`
  - `LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE`, default `500`, allowed `50..5000`
  - `LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS`, default `60000`, allowed `60000..3600000`
- Invalid configured values now fail closed to defaults and emit redacted warnings without raw env values.
- Wired the shared validation into server startup and Product Archive sync, publish, AI item, bulk insert, and lease paths.
- Added Yunxiao env passthrough for the five explicit performance variables.
- Created the rollout/handoff doc with gray gates, rollback defaults, controller checklist, and local measurement limitations.
- Preserved DeepDraw submit/readback boundaries; no provider payloads or secrets were logged or documented.
- Task 11 development/local-readiness is complete. Deployment, gray rollout, live provider/readback, and the full benchmark matrix remain pending external authorization and the next operational phase.

## Commands Run

- `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/product_archive_performance_config.test.mjs scripts/lib/product_archive_sync_queue.test.mjs scripts/lib/product_archive_bulk_write.test.mjs scripts/lib/product_archive_workflow_jobs.test.mjs scripts/lib/product_archive_publish_concurrency.test.mjs scripts/lib/product_archive_ai_fill_bench_safety.test.mjs` - passed, 52/52
- Local no-DB source-import SQL-build aggregate benchmark - completed, 5 runs each:
  - 1k rows: p50 `0.304ms`, p95 `1.128ms`, p99 `1.128ms`, 2 batches
  - 10k rows: p50 `1.817ms`, p95 `2.736ms`, p99 `2.736ms`, 20 batches
  - 150k rows: p50 `20.894ms`, p95 `27.017ms`, p99 `27.017ms`, 300 batches
- `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs scripts/lib/deepdraw_product_archive_ui.test.mjs scripts/lib/product_archive_performance_config.test.mjs scripts/lib/product_archive_sync_queue.test.mjs scripts/lib/product_archive_bulk_write.test.mjs scripts/lib/product_archive_workflow_jobs.test.mjs scripts/lib/product_archive_publish_concurrency.test.mjs scripts/lib/product_archive_ai_fill_bench_safety.test.mjs` - passed, 272/272
- `npm test` - passed, 917 passed, 1 skipped
- `npm run web:lint` - passed with 6 existing warnings in `web/src/pages/product-archive-drafts/page.tsx` for missing `refetchDraftQueries` hook dependencies
- `npm run web:build` - passed with Vite chunk-size warnings for existing large chunks
- `git diff --check` - passed
- `git status --short --branch` - checked before and after; unrelated untracked files remained untracked

## Limitations

- No push, deployment, production write, live DeepDraw submit/readback, or bastion readback was performed.
- The representative benchmark matrix could not be fully measured locally because it needs production-sized data, browser/Nginx timing, PostgreSQL execution timing, and fake/live provider readback orchestration reserved for the controller.
- Local aggregate measurements cover only no-DB bulk SQL construction and parameter binding shape, not real DB lock/pool waits, memory high-water mark, committed visibility, provider retry behavior, or readback mismatch rate.

## Concerns

- `npm run web:lint` exits successfully but reports 6 pre-existing React hook dependency warnings in `web/src/pages/product-archive-drafts/page.tsx`.
- `npm run web:build` exits successfully but reports existing Vite chunk-size warnings.
- Production rollout still requires controller-owned deployed SHA readback, migration `055_product_archive_performance.sql` readback, startup log inspection, and the full benchmark matrix.

## Review Fix - Needs Fixes Follow-up

- Addressed finding 1 by re-scoping the local artifact language in `docs/reference/integration-handoffs/product-archive-performance-rollout-20260904.md`: local development/readiness is complete, while deployment, gray rollout, live provider calls, live DeepDraw submit/readback, bastion readback, and the full benchmark matrix are explicitly pending the controller/next operational phase.
- Addressed finding 2 by reverting the unrelated AI-fill stale-change behavior change in `web/server/services/product-archive-drafts.ts` to the pre-Task-11 hard-failure behavior for `PRODUCT_ARCHIVE_DRAFT_CHANGED`; updated the focused test to assert fail-closed behavior.
- Addressed finding 3 by recording commits `08a1529`, `7d5c03d`, and fix commit `e5665ea` in this report.

### Fix Verification

- `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/product_archive_performance_config.test.mjs scripts/lib/product_archive_ai_fill_bench_safety.test.mjs scripts/lib/product_archive_bulk_write.test.mjs scripts/lib/product_archive_sync_queue.test.mjs scripts/lib/product_archive_publish_concurrency.test.mjs scripts/lib/product_archive_creation.test.mjs` - passed, 256/256
- `git diff --check` - passed
- `npm run web:build` - passed with existing Vite chunk-size warnings

### Remaining Operational Boundary

- No push, deployment, production write, live provider call, live DeepDraw submit/readback, gray rollout, or bastion readback was performed in this follow-up.
