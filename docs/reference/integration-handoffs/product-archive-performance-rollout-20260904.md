# Product Archive Performance Local-Readiness Handoff - 2026-09-04

## Scope

This handoff covers Task 11 development/local-readiness for the Product Archive performance branch. The local code/config/documentation artifact is ready for controller review, but operational Task 11 is not complete in this worker session.

Deployment, gray rollout, live provider calls, live DeepDraw submit/readback, bastion readback, and the full benchmark matrix remain pending external authorization and the next operational phase. This document must not be read as proof that the branch is deployed, that migrations `055_product_archive_performance.sql` and `056_product_archive_performance_followups.sql` are live, or that production behavior has been measured beyond any read-only evidence separately collected by the controller.

## Safety Defaults

| Variable | Default | Allowed range | Rollout note |
| --- | ---: | ---: | --- |
| `LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY` | 1 | 1..4 | Keep at 1 until MDM/DeepDraw sync metrics show no 429, timeout, repeated not-found retry, or lease loss regression. |
| `LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY` | 1 | 1..4 | Keep at 1 until duplicate-submit, submit-claim-token, and final resource readback evidence are clean on a small batch. |
| `LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY` | 1 | 1..2 | Keep at 1 until AI item telemetry and provider throttling are stable. |
| `LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE` | 500 | 50..5000 | Increase only after import row parity and committed-only visibility are verified. |
| `LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS` | 60000 | 60000..3600000 | Increase only for known long stages; repeated lease loss pauses rollout. |

Invalid values fail closed to the default above and emit a redacted warning containing only the env name, reason, default, and allowed range. Raw env values, secrets, and provider payloads are not logged.

## Local Development Verification

Safe local development verification completed on this branch:

| Check | Result |
| --- | --- |
| Product Archive performance config tests | Passed |
| Targeted Product Archive performance-path tests | Passed, 291/291 |
| Full `npm test` | Passed, 928/929 with 1 skipped |
| `npm run web:lint` | Passed with 6 existing React hook dependency warnings in `web/src/pages/product-archive-drafts/page.tsx` |
| `npm run web:build` | Passed with existing Vite chunk-size warnings |
| `git diff --check` | Passed |
| `git diff --check 9827e6e75bb74bf3b0edb5f5d5bf7b7cea57e225...HEAD` | Passed |

The local benchmark command was limited to unit/in-process aggregate evidence. It did not execute bastion queries, browser TTFB/LCP capture, live provider calls, live DeepDraw readback, gray rollout steps, deployment, production Nginx log analysis, or real PostgreSQL COPY/migration execution. In the latest local check, `DATABASE_URL`/`POSTGRES_URL` were unset and `pg_isready` was unavailable, so PostgreSQL RSS/heap high-water marks were not measured.

## Local Aggregate Evidence

| Case | Local evidence available | Limitation |
| --- | --- | --- |
| Summary page | Detail/list summary performance test suite passed locally. | No live 330-field/100-SKU/20-image/30-log browser matrix was measured in this worker. |
| Source import | Bulk writer tests cover 1001-row chunking at batch size 500, parameterized writes, bounded COPY chunk encoding, COPY stream rollback, and client release. Local no-DB SQL-build aggregate, 5 runs: 1k rows p50 0.304ms / p95 1.128ms / p99 1.128ms, 2 batches, max 3000 params per statement; 10k rows p50 1.817ms / p95 2.736ms / p99 2.736ms, 20 batches; 150k rows p50 20.894ms / p95 27.017ms / p99 27.017ms, 300 batches. | PostgreSQL execution time, lock/pool waits, RSS/heap memory high-water mark, and committed visibility under real transactions were not measured locally. |
| Workflow | Workflow job tests cover lease fencing, missing source failure, and resume from unfinished stage. | 100-SPU copywriting + launch plan + size chart throughput was not measured locally. |
| MDM sync | Sync queue tests cover concurrency clamps, negative-cache behavior, and retry classification. | No live MDM 100 valid / 100 cached-not-found / 20 transient-failure provider matrix was run. |
| Precheck | Prepared-draft tests cover snapshot reuse and freshness gates from prior tasks. | No live 10 unchanged / 10 changed draft timing matrix was run. |
| Publish | Publish concurrency tests cover bounded concurrency and retain final readback boundary. | No fake-provider end-to-end create/update p50/p95/p99 matrix was run in this worker. |

## Gray Rollout Gates

1. Enable detail summary endpoints and compression; compare TTFB, response bytes, query count/time, and errors.
2. Enable batched imports with concurrency 1; compare row parity, committed-only visibility, throughput, memory high-water mark, and retry count.
3. Raise MDM sync concurrency to 2 for a small tenant/SPU set; compare 429s, timeouts, not-found classification, retry count, and lease loss.
4. Raise publish concurrency to 2 for a small create/full-update batch; require zero duplicate submissions, intact `submit_claim_token` behavior, and no readback mismatch increase before considering 4.

Pause rollout on duplicate resources, unknown transport errors, readback mismatch, row-count differences, repeated lease loss, DB lock/pool wait growth, API error regression, or import batches exposing half-batch data.

## Rollback

Set the performance env vars back to their safe defaults:

```bash
LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY=1
LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY=1
LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY=1
LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE=500
LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS=60000
```

Use the compatibility import/workflow/read paths where available. Keep the base `055_product_archive_performance.sql` structures and the split follow-up `056_product_archive_performance_followups.sql` structures intact, including generated summary tables, job tables, negative cache, idempotency fingerprints, and prepared-draft data. Do not drop migration columns or truncate summary tables during rollback.

## Deployment and Readback Status

| Item | Status |
| --- | --- |
| Local commit SHA | Branch HEAD is `9b9ba62`; the latest review repairs are local uncommitted working-tree changes pending explicit commit authorization. |
| Production deployment | Pending external authorization; not performed by this worker. |
| Gray rollout | Pending next operational phase; not performed by this worker. |
| Deployed SHA readback | Pending controller deployment/readback; not performed by this worker. |
| Migration version readback | Pending controller deployment/readback; not performed by this worker. Readback must verify concrete schema objects and backfill results, not only `schema_migrations` names. |
| Live provider/readback matrix | Pending controller-owned operational validation; not performed by this worker. |
| Worker startup logs | Startup now validates Product Archive performance env values locally and emits redacted default warnings for invalid values. Production log readback is reserved for the controller. |
| Metric event format | Existing request/query performance metrics remain aggregate-only and do not include SQL parameters or provider payloads. |

## Controller Checklist

- Confirm deployed SHA before treating this branch as live.
- Confirm migration `055_product_archive_performance.sql` is applied for the base workflow-job structures and `056_product_archive_performance_followups.sql` is applied for follow-up structures, including environments that already registered the early `055`.
- Verify concrete table, column, index, and backfill state: `product_archive_draft_preparation`, `product_archive_sync_negative_cache`, `listing_launch_plan_spu_latest`, `listing_launch_plan_import_sheet_stat`, `product_archive_source_batch.import_fingerprint`, `listing_launch_plan_import.import_fingerprint`, their unique/expiry/latest indexes, and summary rows rebuilt from committed imports.
- Read worker startup logs for redacted env-default warnings.
- Run the representative benchmark matrix against the live environment and append aggregate p50/p95/p99, bytes, query count/time, throughput, retries, 429s, readback mismatch, and memory high-water mark.
- Keep production writes gated by the existing DeepDraw business-code checks, submit-claim-token anti-duplication, and final resource readback.
