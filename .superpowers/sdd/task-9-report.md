# Task 9 Report

Status: DONE_WITH_CONCERNS

Commit: 7ebd277

Changed files:

- db/migrations/055_product_archive_performance.sql
- web/server/services/listing-launch-plans.ts
- web/server/routes/listing-launch-plans.ts
- web/src/pages/listing-launch-plans/page.tsx
- web/src/pages/product-archive-drafts/page.tsx
- scripts/lib/listing_launch_plan_ui.test.mjs
- scripts/lib/frontend_bundle_routes.test.mjs

Red evidence:

- Ran `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_launch_plan_ui.test.mjs scripts/lib/frontend_bundle_routes.test.mjs scripts/lib/compact_list_scroll_ui.test.mjs` after adding tests first.
- Result: failed as expected on missing `listing_launch_plan_spu_latest`, missing summary refresh/listing source, missing cursor route params, cursor page state, and broad draft invalidation removal.

Green evidence:

- Ran `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_launch_plan_ui.test.mjs scripts/lib/frontend_bundle_routes.test.mjs scripts/lib/compact_list_scroll_ui.test.mjs`.
- Result: PASS, 10 tests passed.

Verification output:

- `npm run web:build`: PASS. Vite emitted production chunks including `import-dialog-Ddu0vplQ.js`, confirming the listing launch plan import dialog is split from the route chunk. Vite still warned that `index` and `spreadsheet` chunks are larger than 500 kB.
- `git diff --check`: PASS.
- `git diff --cached --check`: PASS before commit.

Implementation notes:

- Added additive summary tables in migration 055 only.
- Added transactional summary refresh after all launch-plan rows are inserted.
- Changed SPU-level row listing/counts to read through `listing_launch_plan_spu_latest`.
- Added cursor params `afterSpuCode` and `afterRowId`; existing offset remains accepted.
- Added 15-second count cache, cleared after import summary refresh.
- Listing launch plan page now uses cursor pagination and only invalidates listing-plan rows after an unrelated listing-plan import.
- Listing launch plan upload dialog is dynamically imported after first open.
- Product archive draft page now uses a predicate helper for draft list refetches instead of invalidating draft detail queries through the broad key.

Concerns:

- The build still reports large `index` and `spreadsheet` chunks from other routes/importers outside Task 9 scope.
- The chunked import path now commits rows and summaries atomically, so progress callbacks are emitted after commit rather than while rows are becoming visible.

## Review Fix

Status: DONE_WITH_CONCERNS

Commit: see final response / git log for the commit containing this fix note

Fix changes:

- Backfilled `listing_launch_plan_import_sheet_stat` and `listing_launch_plan_spu_latest` additively in migration 055 from existing `listing_launch_plan_row` data.
- Added real service behavior tests that execute `importListingLaunchPlanSheets` and `listListingLaunchPlanRows` against a small transactional fake DB.
- Covered latest-summary selection, cursor stability after a newer import appears before the cursor, and failed import rollback behavior.
- Replaced the lazy import dialog zero-delay trigger click with a callback-ref pending-open handoff so the first user click opens after the chunk mounts.

Red evidence:

- Target test run failed after adding backfill/lazy first-click assertions: migration lacked the existing-row backfill query and lazy dialog still used `window.setTimeout(... triggerRef.current?.click())`.

Green evidence:

- `NODE_OPTIONS=--no-warnings=ExperimentalWarning ./web/node_modules/.bin/tsx --test scripts/lib/listing_launch_plan_ui.test.mjs scripts/lib/frontend_bundle_routes.test.mjs scripts/lib/compact_list_scroll_ui.test.mjs`: PASS, 13 tests passed.
- `npm run web:build`: PASS.
- `git diff --check`: PASS.

Concerns:

- Vite still warns about large `index` and `spreadsheet` chunks outside this fix scope.
