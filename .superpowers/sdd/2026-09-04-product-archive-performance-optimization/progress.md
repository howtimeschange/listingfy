# SDD ledger — plan: docs/superpowers/plans/2026-09-04-product-archive-performance-optimization.md

## Preflight scan

The plan is being resumed at Task 6. Tasks 1–5 are present as separate local
commits; the plan file checkboxes were not rewritten, so the ledger is the
source of execution state for this run.

| Tasks | Shared file/interface | Finding and ruling |
|---|---|---|
| 1 ↔ 10 | `scripts/lib/postgres_db.mjs`, `web/server/db.ts` | Task 1 adds the synchronous observer; Task 10 must retain the sync adapter and add a separate shared async pool. Ruling: do not replace or rename the Task 1 observer contract. |
| 2 ↔ 3 | migration 055, `product-archive-drafts.ts`, `listing-launch-plan-import-jobs.ts` | Task 2 owns durable workflow state; Task 3 owns chunk writes. Ruling: batch writes must preserve Task 2 status/lease transitions and committed-only visibility. |
| 2 ↔ 5 | `product-archive-drafts.ts`, draft list page/routes | Task 5 changes read shape after Task 2 changes workflow polling. Ruling: preserve job-query invalidation and old detail route while adding lazy reads. |
| 2 ↔ 7 | migration 055, `product-archive-drafts.ts` | Both touch workflow-related paths. Ruling: append additive schema only and keep Task 2 lease fencing intact. |
| 2 ↔ 8 | `product-archive-drafts.ts`, draft list page | Task 8 changes publish scheduling after Task 2 durable jobs. Ruling: queue snapshots remain backward compatible and terminal state semantics are unchanged. |
| 2 ↔ 9 | draft list page | Task 9 may reduce invalidation after imports. Ruling: terminal workflow results still invalidate all affected resources, but unrelated imports stay scoped. |
| 3 ↔ 4 | `web/server/services/product-archive-drafts.ts` | Task 4 consumes Task 3's batched import representation while changing refresh/validation. Ruling: keep the bulk writer's transaction and row-parity contract; do not reintroduce per-row writes. |
| 3 ↔ 9 | `web/server/services/listing-launch-plans.ts` | Task 3 changes import insertion; Task 9 changes list/summary reads. Ruling: summaries must be maintained only after Task 3's committed import. |
| 3 ↔ 10 | `product-archive-bulk-write.ts` | Task 10 extends the writer with COPY/staging. Ruling: retain allowlisted multi-value behavior as compatibility fallback and add COPY behind the same table specs. |
| 4 ↔ 5 | `web/server/services/product-archive-drafts.ts` | Task 5 reads data produced by Task 4. Ruling: split reads must use the same refreshed/validated persisted values. |
| 5 ↔ 8 | draft routes/page | Task 8 adds publish status to the list page while Task 5 owns detail lazy reads. Ruling: publish invalidation is tab-scoped and cannot force heavy detail queries. |
| 5 ↔ 9 | draft list page | Both optimize browser transfer/invalidation. Ruling: keep detail-page lazy query behavior and only narrow unrelated list invalidation. |
| 6 ↔ 7 | migration 055, draft route | Task 6 adds preparation snapshots; Task 7 adds sync safety. Ruling: snapshot hashes never include credentials and sync changes cannot bypass preparation validation. |
| 6 ↔ 8 | draft publish route, `pre_publish_services.test.mjs` | Task 6 supplies current prepared payloads; Task 8 schedules `processItem`. Ruling: Task 8 must call the Task 6 preparation/reuse path before network submission and retain duplicate/claim/readback fences. |
| 7 ↔ 9 | migration 055 | Task 7 adds negative cache; Task 9 adds summary tables. Ruling: both are independent additive structures in migration 055. |
| 8 ↔ 9 | draft list page | Task 8 exposes publish outcomes; Task 9 adjusts list transfer. Ruling: new outcome fields remain available in the compact list response. |
| 9 ↔ 10 | migration/import transaction boundary | Task 9 summaries depend on committed import rows; Task 10 introduces staging. Ruling: summary updates occur in the same final transaction after staging merge. |

| Task | Own consistency check |
|---|---|
| 1 | Interfaces, tests and files agree on request/query metrics and sync DB observer. |
| 2 | Lease/status schema, worker recovery tests and workflow routes agree on durable job states. |
| 3 | Allowlisted writer tests and source/listing import call sites agree on chunked multi-value writes. |
| 4 | Batch refresh/validation tests and service boundaries agree on parity-preserving updates. |
| 5 | Summary/paged route contracts and detail-page lazy tabs agree on the split read path. |
| 6 | Snapshot table, hash/reuse interfaces and precheck/publish call sites agree on a 30-minute current-input gate. |
| 7 | Negative-cache schema, classifier tests and bounded sync/AI/OCR lanes agree on safe retry policy. |
| 8 | Queue tests, bounded workers and UI outcome fields agree on per-draft readback before success. |
| 9 | Summary tables, keyset APIs, import maintenance and browser lazy-loading steps agree on committed snapshots. |
| 10 | Async pool lifecycle, COPY allowlist and staging/merge tests agree on rollback/release behavior. |
| 11 | Config defaults, benchmark evidence, rollout gates, rollback switches and handoff artifact agree with the global safety boundary. |

### Rulings

- Ruling: Resume at Task 6 from the existing local branch commits — the user asked to continue execution and the Task 1–5 changes are already committed; cost if wrong: later review may require reconstructing missing prior ledger evidence.
- Ruling: Use one implementer and one reviewer for Task 6, with no parallel implementation touching the shared draft route — Task 6 has tightly coupled precheck/publish changes; cost if wrong: faster parallel edits could create an unsafe publish race.

Task 1: complete (commit 176178f, prior local verification recorded)
Task 2: complete (commit d19eb0b, prior local verification recorded)
Task 3: complete (commit beb82ea, prior local verification recorded)
Task 4: complete (commit 4520741, prior local verification recorded)
Task 5: complete (commit 3f06184, review status inherited from prior run)

Task 6: in progress
Task 6: review round 0 — reviewer found 1 Critical and 2 Important findings; the missing `pre_publish_services.test.mjs` change is recorded as a deferred Minor.
Task 6: Minor (deferred): the brief listed `scripts/lib/pre_publish_services.test.mjs`, but the implementation did not need to modify that unrelated test file; the required command still ran it.
Task 6: Ruling: retain the append to `055_product_archive_performance.sql` — this branch introduced 055 after `origin/main` and has not deployed it, while the plan explicitly requires Task 6 to append to 055; cost if wrong: if 055 is applied independently before this branch, the migrator will skip the appended SQL and deployment must split it into a new migration before release.
Task 6: fix round 1/5 (2 addressed, 0 open pending re-review — claim-fenced freshness revalidation and approved size-chart mapping hash coverage; commits 8f42552..4fdef03)
Task 6: fix round 2/5 (1 addressed, 0 open pending re-review — narrowed missing-table compatibility to explicit error shapes; commit 08b6ca2)
Task 6: complete (commits 8f42552..08b6ca2, 1 deferred Minor, review clean after fix rounds)
Task 7: complete (commits 34695cb..91d58c5, review clean after fix rounds; targeted 55/55 tests pass and git diff --check pass)
Task 8: complete (commits 91d58c5..c0eb8e4, review clean after fix round; targeted 96/96 tests pass, git diff --check pass, web build pass)
Task 9: complete (commits c0eb8e4..fcf8a39, review approved with minor cleanup applied; targeted 14/14 tests pass, git diff --check pass, web build pass)
Task 10: complete (commits fcf8a39..df73b3f, review clean; targeted 28/28 tests pass, git diff --check pass, web build pass)
Task 11: local-readiness complete (commits 08a1529, 7d5c03d; configuration defaults/ranges validated at startup and in shared runtime paths; targeted 52/52 tests pass, full npm test 917 passed/1 skipped, web:lint pass with existing warnings, web:build pass, git diff --check pass; no push, deployment, production write, gray rollout, live provider/readback matrix, or bastion readback performed)
Task 11: review fix complete (commit e5665ea; formally re-scoped handoff wording to local development/readiness only, restored pre-Task-11 AI-fill `PRODUCT_ARCHIVE_DRAFT_CHANGED` hard-failure behavior, and updated focused test expectation; fix verification passed 256/256 focused tests, git diff --check, and web build; operational deployment/readback/full benchmark remain pending controller authorization)
