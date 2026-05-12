# SHEIN Real Data Regression And P1 Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close P0 against real SHEIN data, then implement P1-A platform identity/barcode operations and P1-B price-reason plus audit workflow without duplicating the existing publish task center.

**Architecture:** Keep `shein_platform_product / shein_platform_skc / shein_platform_sku / shein_lifecycle_operation` as the product lifecycle source of truth. Extend the existing SHEIN adapter and add `shein-operations` service/routes for P1-A. Treat `发布任务` as the primary audit workbench for publish submissions, while `SHEIN运营中心 > 审核状态` becomes a cross-lifecycle aggregation page for publish tasks and platform product lifecycle operations.

**Tech Stack:** Hono backend, Vite React frontend, TanStack Query, SQLite migrations, existing SHEIN adapter via `requestSheinWithCredentialsAndRetry`, Node test scripts under `scripts/lib`.

---

## Product Decision

审核状态可以和发布任务列表结合，但不应该简单把 `审核状态` 菜单删掉。

主入口建议这样分工：

- `发布任务` 改造成 `发布与审核任务` 的工作台：负责上新提交后的审核状态、Trace ID、平台版本、失败原因、重试版本、批量同步。它已经拥有 `listing_publish_task` 和 `/api/publish-tasks/:id/sync-status`，是审核流最自然的操作主表。
- `SHEIN运营中心 > 审核状态` 保留为聚合视图：展示所有和审核有关的异常，包括发布任务、已上架商品编辑、拼款、撤回、状态同步失败。它不再重复做一套完整任务列表，而是提供待处理分组、失败原因聚合、负责人/处理状态、跳转入口。
- `平台商品列表 / SPU 详情` 继续承载已上架商品的对象操作：同步详情、检查可编辑、更新成本价、编辑资料、拼款、撤回。审核状态中心只把异常导回这些详情页处理。

## Existing Anchors

- Lifecycle plan: `docs/shein-product-lifecycle-api-plan-2026-05-11.md`
- P0 migration: `db/migrations/021_shein_platform_products.sql`
- P0 backend route: `web/server/routes/shein-platform-products.ts`
- P0 backend service: `web/server/services/shein-platform-products.ts`
- SHEIN adapter: `web/server/platform-adapters/shein.ts`
- Adapter types: `web/server/platform-adapters/types.ts`
- Publish task route: `web/server/routes/publish-tasks.ts`
- Publish status sync helper: `web/server/services/publish/shein-status-sync.ts`
- Publish task page: `web/src/pages/publish-tasks/page.tsx`
- Audit planning page: `web/src/pages/shein-operations/audit-status/page.tsx`
- P1-A planning pages:
  - `web/src/pages/shein-operations/platform-identities/page.tsx`
  - `web/src/pages/shein-operations/barcode-size/page.tsx`

## File Structure

Create:

- `db/migrations/022_shein_operations_p1.sql`: P1-A/P1-B persistent tables.
- `web/server/services/shein-operations.ts`: P1-A/P1-B SHEIN operation orchestration, response normalization, DB persistence.
- `web/server/routes/shein-operations.ts`: HTTP routes for P1 pages.
- `scripts/lib/shein_operations_p1_persistence.test.mjs`: migration/service contract tests.
- `scripts/lib/shein_audit_center_ui.test.mjs`: audit/publish-task UI contract tests.

Modify:

- `web/server/platform-adapters/types.ts`: add P1 methods to `PlatformAdapter`.
- `web/server/platform-adapters/shein.ts`: map P1 methods to SHEIN OpenAPI paths.
- `scripts/lib/platform_adapter.test.mjs`: assert adapter capability and path coverage.
- `web/server/index.ts`: mount `/api/shein-operations`.
- `web/server/routes/publish-tasks.ts`: add audit filters, batch status sync, failure reason fields.
- `web/src/pages/publish-tasks/page.tsx`: add audit tabs/filters, batch sync, failure reason grouping.
- `web/src/pages/shein-operations/audit-status/page.tsx`: replace static capability page with aggregation dashboard.
- `web/src/pages/shein-operations/platform-identities/page.tsx`: replace static capability page with number-list and SKU duplicate-check workflows.
- `web/src/pages/shein-operations/barcode-size/page.tsx`: replace static capability page with barcode-size and print task workflows.
- `web/src/pages/shein-platform-products/page.tsx`: make update-cost form consume price-reason options when needed.
- `docs/shein-product-lifecycle-api-plan-2026-05-11.md`: keep progress and next step status current.

## Data Model

Add in `db/migrations/022_shein_operations_p1.sql`:

- `shein_real_data_regression_log`
  - `id`, `scenario`, `spu_name`, `skc_name`, `sku_code`, `status`, `trace_id`, `request_payload_json`, `response_payload_json`, `error_message`, `operator_note`, `created_at`, `updated_at`.
  - Used for P0 real SHEIN regression evidence and response sample capture.

- `shein_platform_identity_snapshot`
  - `id`, `platform`, `platform_account_key`, `skc_name`, `sku_code`, `supplier_sku`, `design_code`, `attribute_text`, `number_type`, `source_page`, `raw_payload_json`, `last_synced_at`, timestamps.
  - Unique by `platform, platform_account_key, number_type, skc_name, sku_code, design_code, supplier_sku`.

- `shein_supplier_sku_check`
  - `id`, `platform`, `platform_account_key`, `supplier_sku`, `repeated`, `source_type`, `source_id`, `raw_payload_json`, `trace_id`, `checked_at`, timestamps.
  - Keeps duplicate check evidence for publish and add-variant flows.

- `shein_barcode_size_snapshot`
  - `id`, `platform`, `platform_account_key`, `barcode`, `skc_name`, `sku_code`, `size_text`, `raw_payload_json`, `trace_id`, `last_synced_at`, timestamps.
  - Unique by `platform, platform_account_key, barcode`.

- `shein_barcode_print_task`
  - `id`, `platform`, `platform_account_key`, `status`, `print_content_type`, `print_format_type`, `request_payload_json`, `response_payload_json`, `barcode_url`, `trace_id`, `error_message`, `created_by_user_id`, `created_by_username`, timestamps.

- `shein_barcode_print_task_item`
  - `id`, `task_id`, `order_no`, `supplier_sku`, `sku_code`, `print_number`, `barcode`, `custom_coding_json`, `error_messages_json`, timestamps.

- `shein_cost_change_reason`
  - `id`, `platform`, `platform_account_key`, `reason_code`, `reason_text`, `enabled`, `raw_payload_json`, `last_synced_at`, timestamps.
  - Seed fallback values from current `update-cost` documentation when `/open-api/goods/query-change-price-reason` is unavailable: `1 商品成本上涨`, `2 物流履约费用上涨`, `3 活动结束恢复价格`, `4 其他`, `5 物流履约费用上涨（物流规则调整）`.

- `shein_audit_status_snapshot`
  - `id`, `platform`, `platform_account_key`, `source_type`, `source_id`, `spu_name`, `skc_name`, `document_sn`, `document_state`, `document_state_label`, `version`, `failure_reasons_json`, `failure_reason_text`, `handled_status`, `owner_user_id`, `owner_username`, `raw_payload_json`, `trace_id`, `last_synced_at`, timestamps.
  - `source_type` values: `PUBLISH_TASK`, `PLATFORM_PRODUCT`, `LIFECYCLE_OPERATION`.
  - `handled_status` values: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `IGNORED`.

## API Shape

Adapter methods:

- `queryNumberList({ credentials, payload })`
  - SHEIN path: `/open-api/goods/number-list`
  - Query params from payload: `page`, `per_page`, `type`
  - Store `info.list`.

- `checkSupplierSkuRepeated({ credentials, payload })`
  - SHEIN path: `/open-api/goods/product/check-supplierSku-repeated`
  - Request: `{ supplierSkuList: string[] }`
  - Store `info[]` with `supplierSku`, `repeated`.

- `batchSkcSize({ credentials, payload })`
  - SHEIN path: `/open-api/goods/batch-skc-size`
  - Request: `{ data: string[] }`
  - Store `info[barcode] = { skc, size, sku_code }`.

- `printBarcode({ credentials, payload })`
  - SHEIN path: `/open-api/goods/print-barcode`
  - Request: `{ data: [{ orderNo, supplierSku, printNumber, sheinSku }], printContentType?, printFormatType? }`
  - Store `info.url`, `info.errorData`, `info.codingInfoList`.

- `queryChangePriceReason({ credentials, payload })`
  - Preferred SHEIN path: `/open-api/goods/query-change-price-reason`
  - If the API is unavailable for the account, use documented fallback reasons while keeping the same DB/cache contract.

Routes:

- `POST /api/shein-operations/p0-regression/logs`
- `GET /api/shein-operations/p0-regression/logs`
- `POST /api/shein-operations/platform-identities/number-list/sync`
- `GET /api/shein-operations/platform-identities/number-list`
- `POST /api/shein-operations/platform-identities/supplier-sku/check`
- `GET /api/shein-operations/platform-identities/supplier-sku/checks`
- `POST /api/shein-operations/barcodes/batch-skc-size`
- `GET /api/shein-operations/barcodes/sizes`
- `POST /api/shein-operations/barcodes/print`
- `GET /api/shein-operations/barcodes/print-tasks`
- `POST /api/shein-operations/price-reasons/sync`
- `GET /api/shein-operations/price-reasons`
- `GET /api/shein-operations/audit-status`
- `POST /api/shein-operations/audit-status/sync`
- `PATCH /api/shein-operations/audit-status/:id/handling`

## Task 1: P0 Real SHEIN Data Regression

**Files:**
- Modify: `web/src/pages/shein-platform-products/page.tsx`
- Modify: `web/server/services/shein-platform-products.ts`
- Create: `db/migrations/022_shein_operations_p1.sql`
- Create: `web/server/services/shein-operations.ts`
- Create: `web/server/routes/shein-operations.ts`
- Test: `scripts/lib/shein_operations_p1_persistence.test.mjs`

- [x] **Step 1: Write failing persistence test for regression log**

Add `scripts/lib/shein_operations_p1_persistence.test.mjs` with assertions that `022_shein_operations_p1.sql` creates `shein_real_data_regression_log` and the P1 tables listed in this plan.

- [x] **Step 2: Run the test and verify it fails**

Run: `npm test -- scripts/lib/shein_operations_p1_persistence.test.mjs`

Expected: FAIL because migration `022_shein_operations_p1.sql` does not exist yet.

- [x] **Step 3: Add migration**

Create `db/migrations/022_shein_operations_p1.sql` with the tables listed in **Data Model**.

- [x] **Step 4: Implement regression log service and routes**

In `web/server/services/shein-operations.ts`, implement:

- `listRegressionLogs(params)`
- `createRegressionLog(input, actor)`

In `web/server/routes/shein-operations.ts`, expose:

- `POST /p0-regression/logs`
- `GET /p0-regression/logs`

- [x] **Step 5: Mount route**

Mount `sheinOperations` in `web/server/index.ts` at `/api/shein-operations`.

- [x] **Step 6: Add P0 real-data checklist to platform product page**

Add a compact `真实数据回归` action in the platform product page or operation modal:

- record current SPU/SKC/SKU
- scenario selector: `SYNC_LIST`, `SYNC_SITES`, `SYNC_DETAIL`, `CHECK_EDIT_PERMISSION`, `SYNC_STATUS`, `UPDATE_COST`, `FIELD_EDIT`, `ADD_VARIANTS`, `REVOKE`
- status: `PASS`, `FAIL`, `BLOCKED`
- trace ID and operator note

- [x] **Step 7: Run targeted tests**

Run:

`npm test -- scripts/lib/shein_platform_products_ui.test.mjs scripts/lib/shein_platform_products_persistence.test.mjs scripts/lib/shein_operations_p1_persistence.test.mjs`

Expected: PASS.

## Task 2: P1-A Platform Identity Sync And SKU Duplicate Check

**Files:**
- Modify: `web/server/platform-adapters/types.ts`
- Modify: `web/server/platform-adapters/shein.ts`
- Modify: `web/server/services/shein-operations.ts`
- Modify: `web/server/routes/shein-operations.ts`
- Modify: `web/src/pages/shein-operations/platform-identities/page.tsx`
- Modify: `web/src/pages/shein-platform-products/page.tsx`
- Test: `scripts/lib/platform_adapter.test.mjs`
- Test: `scripts/lib/shein_operations_center_ui.test.mjs`

- [x] **Step 1: Extend adapter tests first**

Update `scripts/lib/platform_adapter.test.mjs` to require:

- `queryNumberList`
- `checkSupplierSkuRepeated`

and assert paths:

- `/open-api/goods/number-list`
- `/open-api/goods/product/check-supplierSku-repeated`

- [x] **Step 2: Run adapter test and verify it fails**

Run: `npm test -- scripts/lib/platform_adapter.test.mjs`

Expected: FAIL because the new adapter methods are missing.

- [x] **Step 3: Add adapter methods**

Add methods to `PlatformAdapter`, `PLATFORM_ADAPTER_CAPABILITIES`, and `sheinAdapter`.

Important implementation detail: `number-list` is documented as `GET` with query strings, while the exported curl sample uses POST. Use the current SHEIN client capability if it supports query params; otherwise add a small helper in the adapter to append `?page=1&per_page=100&type=1` and send an empty body through the existing signed request helper.

- [x] **Step 4: Implement number-list service**

Implement `syncNumberList({ page, perPage, type })`:

- default `page=1`, `perPage=100`, `type=1`
- save each `info.list[]` row to `shein_platform_identity_snapshot`
- opportunistically update matching `shein_platform_skc` and `shein_platform_sku` by `skc_name`/`sku_code`
- return `{ page, perPage, count, synced }`

- [x] **Step 5: Implement supplier SKU check service**

Implement `checkSupplierSkuRepeated({ supplierSkuList, sourceType, sourceId })`:

- de-duplicate and limit to 200
- reject empty input
- call adapter
- save each result to `shein_supplier_sku_check`
- return repeated and available groups

- [x] **Step 6: Implement routes**

Expose:

- `POST /platform-identities/number-list/sync`
- `GET /platform-identities/number-list`
- `POST /platform-identities/supplier-sku/check`
- `GET /platform-identities/supplier-sku/checks`

- [x] **Step 7: Replace static platform identity page with usable UI**

Build:

- filters for `skc_name`, `sku_code`, `supplier_sku`, `design_code`
- `同步编号关系` button with page/type inputs
- duplicate-check textarea for supplier SKUs
- table showing repeated status and latest check time
- links to platform SPU detail when local product mapping exists

- [x] **Step 8: Add duplicate check before add-variants**

In `web/src/pages/shein-platform-products/page.tsx`, before submitting `add-variants`, collect supplier SKUs from the variant template and call `/api/shein-operations/platform-identities/supplier-sku/check`. Block submit when any result has `repeated=true`.

- [x] **Step 9: Run targeted tests**

Run:

`npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_operations_center_ui.test.mjs scripts/lib/shein_platform_products_ui.test.mjs`

Expected: PASS.

## Task 3: P1-A Barcode Size And Print Task Flow

**Files:**
- Modify: `web/server/platform-adapters/types.ts`
- Modify: `web/server/platform-adapters/shein.ts`
- Modify: `web/server/services/shein-operations.ts`
- Modify: `web/server/routes/shein-operations.ts`
- Modify: `web/src/pages/shein-operations/barcode-size/page.tsx`
- Test: `scripts/lib/platform_adapter.test.mjs`
- Test: `scripts/lib/shein_operations_center_ui.test.mjs`

- [x] **Step 1: Extend adapter tests first**

Update adapter test to require:

- `batchSkcSize`
- `printBarcode`

and assert paths:

- `/open-api/goods/batch-skc-size`
- `/open-api/goods/print-barcode`

- [x] **Step 2: Run adapter test and verify it fails**

Run: `npm test -- scripts/lib/platform_adapter.test.mjs`

Expected: FAIL because the new adapter methods are missing.

- [x] **Step 3: Add adapter methods**

Add `batchSkcSize` and `printBarcode` to adapter types and SHEIN adapter.

- [x] **Step 4: Implement barcode-size service**

Implement `syncBarcodeSizes({ barcodes })`:

- split textarea by comma, whitespace, Chinese punctuation, or line breaks
- de-duplicate
- call `/open-api/goods/batch-skc-size` with `{ data: barcodes }`
- save `info[barcode]` to `shein_barcode_size_snapshot`
- return found and missing barcodes

- [x] **Step 5: Implement print service**

Implement `createBarcodePrintTask({ data, printContentType, printFormatType }, actor)`:

- validate `data` is non-empty
- require `printNumber > 0`
- cap total print count at 2000
- call `/open-api/goods/print-barcode`
- save task and items
- set task `status` to `SUCCESS` when `code=0` and `errorData` is empty, `PARTIAL_FAILED` when URL exists but error rows exist, `FAILED` otherwise

- [x] **Step 6: Implement routes**

Expose:

- `POST /barcodes/batch-skc-size`
- `GET /barcodes/sizes`
- `POST /barcodes/print`
- `GET /barcodes/print-tasks`

- [x] **Step 7: Replace static barcode page with usable UI**

Build:

- barcode textarea and `查询 SKC/尺码` button
- result table: barcode, SKC, SKU, size, last sync
- print task form: SKU code, supplier SKU, order no, copies, content type, format type
- print task list with URL, error messages, trace ID, retry button

- [x] **Step 8: Run targeted tests**

Run:

`npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_operations_center_ui.test.mjs`

Expected: PASS.

## Task 4: P1-B Price Reason And Update-Cost Form

**Files:**
- Modify: `web/server/platform-adapters/types.ts`
- Modify: `web/server/platform-adapters/shein.ts`
- Modify: `web/server/services/shein-operations.ts`
- Modify: `web/server/routes/shein-operations.ts`
- Modify: `web/src/pages/shein-platform-products/page.tsx`
- Test: `scripts/lib/platform_adapter.test.mjs`
- Test: `scripts/lib/shein_platform_products_ui.test.mjs`

- [x] **Step 1: Extend tests first**

Update adapter and UI tests to require:

- `queryChangePriceReason`
- price-reason dropdown or fallback reason list in the update-cost flow

- [x] **Step 2: Run tests and verify failure**

Run:

`npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_platform_products_ui.test.mjs`

Expected: FAIL because price-reason support is missing.

- [x] **Step 3: Add adapter method**

Add `queryChangePriceReason` to types and SHEIN adapter. Keep this method isolated because the local document export does not currently expose a detail page for `/open-api/goods/query-change-price-reason`.

- [x] **Step 4: Implement price reason service with fallback**

Implement `syncCostChangeReasons()`:

- try adapter call first
- if SHEIN returns a missing-permission/not-found style error, upsert fallback reasons from the current `update-cost` documentation
- save all reasons to `shein_cost_change_reason`
- return `{ source: "SHEIN" | "DOCUMENT_FALLBACK", items }`

- [x] **Step 5: Update update-cost payload**

Extend the backend update-cost route/service to accept an optional `change_reason_code`. Only include the field in the SHEIN payload if the real SHEIN account confirms the accepted field name during P0 regression. Until then, persist the selected reason in operation request payload and do not invent a platform field.

- [x] **Step 6: Update frontend update-cost form**

In SPU detail:

- fetch `/api/shein-operations/price-reasons`
- show reason select when new cost is greater than current cost
- block submit if price increased and no reason is selected
- show a clear inline note when reasons are from `DOCUMENT_FALLBACK`

- [x] **Step 7: Run targeted tests**

Run:

`npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_platform_products_ui.test.mjs`

Expected: PASS.

## Task 5: Audit Status Center Integrated With Publish Tasks

**Files:**
- Modify: `web/server/routes/publish-tasks.ts`
- Modify: `web/server/services/publish/shein-status-sync.ts`
- Modify: `web/server/services/shein-operations.ts`
- Modify: `web/server/routes/shein-operations.ts`
- Modify: `web/src/pages/publish-tasks/page.tsx`
- Modify: `web/src/pages/shein-operations/audit-status/page.tsx`
- Create: `scripts/lib/shein_audit_center_ui.test.mjs`

- [x] **Step 1: Write UI contract test first**

Create `scripts/lib/shein_audit_center_ui.test.mjs` requiring:

- publish page title or description includes `发布与审核`
- audit filters include `审核中`, `审核驳回`, `部分通过`, `失败原因`
- batch sync action exists
- audit center page contains links/deep-link targets to publish tasks and platform product details
- audit center does not render a duplicate full publish-task table

- [x] **Step 2: Run test and verify failure**

Run:

`npm test -- scripts/lib/shein_audit_center_ui.test.mjs`

Expected: FAIL because the audit center is still a static capability page.

- [x] **Step 3: Normalize audit snapshots**

Whenever publish task status sync or platform product status sync calls `query-document-state`, upsert rows into `shein_audit_status_snapshot`:

- source type and source ID
- SPU, SKC, version, document SN
- document state and label
- failure reasons JSON/text
- trace ID
- last synced time

- [x] **Step 4: Add publish task audit filters**

Extend `GET /api/publish-tasks` and `/filters` to support:

- `audit_state`
- `has_failure_reason`
- `failure_reason`
- `handled_status`
- `owner`

Keep current `statuses` behavior for backward compatibility.

- [x] **Step 5: Add batch audit sync**

Add `POST /api/publish-tasks/audit-status/sync`:

- accepts `taskIds?: number[]`
- when no IDs are provided, sync recent tasks in `PUBLISH_SUBMITTED`, `UNDER_REVIEW`, `PARTIALLY_APPROVED`
- max 50 per request
- returns counts by mapped status and failure reason samples

- [x] **Step 6: Upgrade publish task page**

Change page framing from `发布任务` to `发布与审核任务` and add:

- status summary cards: submitted, under review, rejected, approved, partial
- failure reason group panel collapsed by default
- batch sync selected/current-filter button
- row actions: sync, retry, view response, open SPU detail
- filter presets: `待同步审核`, `审核驳回`, `部分通过`, `需要处理`

- [x] **Step 7: Replace audit status page with aggregation dashboard**

Use `/api/shein-operations/audit-status` to render:

- cards by source type: publish task, platform product, lifecycle operation
- failure reason groups
- latest rejected SKC list
- handled status controls
- deep links:
  - publish source -> `/publish-tasks?statuses=REJECTED,PARTIALLY_APPROVED`
  - platform product source -> `/shein-platform-products/:spuName`

- [x] **Step 8: Add handling updates**

Implement `PATCH /api/shein-operations/audit-status/:id/handling`:

- set `handled_status`
- optional owner assignment
- optional note appended to raw/local handling JSON

- [x] **Step 9: Run targeted tests**

Run:

`npm test -- scripts/lib/shein_audit_center_ui.test.mjs scripts/lib/shein_operations_center_ui.test.mjs scripts/lib/listing_batch_publish_routes.test.mjs scripts/lib/listing_batch_publish_ui.test.mjs`

Expected: PASS.

## Task 6: Real Data Verification Pass

**Files:**
- Modify: `docs/shein-product-lifecycle-api-plan-2026-05-11.md`

- [x] **Step 1: Run unit/UI contract tests**

Run:

`npm test -- scripts/lib/platform_adapter.test.mjs scripts/lib/shein_platform_products_ui.test.mjs scripts/lib/shein_operations_center_ui.test.mjs scripts/lib/shein_operations_p1_persistence.test.mjs scripts/lib/shein_audit_center_ui.test.mjs`

Expected: PASS.

- [x] **Step 2: Run lint and build**

Run:

`npm --prefix web run lint`

Expected: PASS.

Run:

`npm --prefix web run build`

Expected: PASS, allowing existing Vite chunk-size warnings.

- [ ] **Step 3: Run P0 real SHEIN regression manually**

Using the browser and existing services:

1. `SHEIN运营中心 > 平台商品列表`: sync real product list.
2. `SHEIN运营中心 > 站点币种`: sync real site/currency data.
3. Open 3 to 5 SPUs and sync details.
4. Check edit permission on at least one editable and one non-editable SPU.
5. Sync audit status for at least one SPU with a known publish version.
6. Update cost on a safe test SKU.
7. If the account has a safe editable test product, submit a small field edit.
8. If the account has a safe add-variant sample, submit add-variant after supplier SKU duplicate check.
9. Record every result in `shein_real_data_regression_log`.

- [x] **Step 4: Update lifecycle plan**

Update `docs/shein-product-lifecycle-api-plan-2026-05-11.md` with:

- real-data regression date
- passed/failed scenarios
- any SHEIN payload field corrections
- whether `query-change-price-reason` is a real endpoint or fallback enum for this account

## Execution Order

1. Task 1: P0 regression log and evidence loop.
2. Task 2: P1-A number-list and supplier SKU duplicate check.
3. Task 3: P1-A barcode size and print barcode.
4. Task 4: P1-B cost change reason in update-cost flow.
5. Task 5: audit center integrated with publish tasks.
6. Task 6: tests, build, manual real-data verification, lifecycle plan update.

## Acceptance Criteria

- P0真实数据回归有记录、有 traceId、有失败样本沉淀。
- `平台标识对账` 不再只是规划页，可以同步 `number-list` 并校验 supplier SKU 是否重复。
- `条码尺码` 不再只是规划页，可以批量查条码尺码并生成可追踪打印任务。
- 更新成本价上涨时有原因选择；如果 SHEIN 独立原因接口未开放，系统明确使用文档兜底枚举。
- `发布与审核任务` 是发布后审核的主工作台，支持批量同步、失败原因筛选、重试和详情跳转。
- `审核状态` 是跨生命周期聚合页，不重复完整发布任务列表。
- 所有新接 SHEIN 写操作都有本地表和操作/任务流水。
