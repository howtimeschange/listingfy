# Batch Publish Frontend and PrePublish Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把批次级发布任务、轮询、失败聚合、批量重试接到前端真实操作流，并继续把 `pre-publish.ts` 中可安全抽离的校验/版本/发布状态 helpers 拆到服务层；TEMU Adapter 本轮不开发。

**Architecture:** 前端以批次详情页作为操作中心，直接调用 `/publish-tasks`、`/publish-summary`、`/sync-status`、`/retry-failed` 四个批次 API，并展示任务汇总和失败原因。后端保持现有接口，只补缺少的批次 summary 字段到列表/详情响应。`pre-publish.ts` 只抽离纯函数和小型 DB helper，不重写核心发布流程。

**Tech Stack:** React, TanStack Query, Hono, SQLite/better-sqlite3, TypeScript, node:test, tsx.

---

## File Structure

- Modify: `web/server/routes/listing-batches.ts` - 批次列表/详情返回 `publish_status_summary_json`、`last_status_synced_at`。
- Modify: `web/src/pages/listing-batches/page.tsx` - 列表显示任务汇总入口和最近同步时间。
- Modify: `web/src/pages/listing-batches/[id]/page.tsx` - 增加批次提交任务、轮询、失败聚合、批量重试 UI。
- Create: `scripts/lib/listing_batch_publish_ui.test.mjs` - 静态 UI 集成测试，保证前端真实调用新增 API。
- Modify/Create: `web/server/services/pre-publish/*` - 抽出状态/版本/发布小 helper。
- Modify: `web/server/routes/pre-publish.ts` - 使用抽出的 helper，降低路由文件职责。
- Test: `scripts/lib/pre_publish_services.test.mjs`, `scripts/lib/pre_publish_workbench_ui.test.mjs`.

## Task 1: Batch Publish UI Wiring

- [ ] Write failing test in `scripts/lib/listing_batch_publish_ui.test.mjs` asserting batch detail page calls:
  - `/listing-batches/${id}/publish-summary`
  - `/listing-batches/${id}/publish-tasks`
  - `/listing-batches/${id}/sync-status`
  - `/listing-batches/${id}/retry-failed`
  and renders failure groups, retry action, status polling action.
- [ ] Run targeted test and confirm it fails because current page does not call these APIs.
- [ ] Implement mutations and summary query in `web/src/pages/listing-batches/[id]/page.tsx`.
- [ ] Add visible batch operations: generate publish tasks, sync review status, retry failed, go to publish task center filtered by batch.
- [ ] Add task/failure summary panels with counts and grouped failure reasons.
- [ ] Run targeted UI test and build.

## Task 2: Batch Summary on List/Detail

- [ ] Extend `ListingBatch` / `BatchDetail` types with `publish_status_summary_json` and `last_status_synced_at`.
- [ ] Display task counts and last sync time in list/detail.
- [ ] Ensure query invalidation refreshes `listing-batches`, `publish-tasks`, and `pre-publish` after every batch action.

## Task 3: Safe `pre-publish.ts` Cleanup

- [ ] Identify pure helpers currently still in `pre-publish.ts` that are used by publish/version logic and can move without API behavior changes.
- [ ] Add/extend tests in `scripts/lib/pre_publish_services.test.mjs` for those helpers.
- [ ] Move helpers to focused files under `web/server/services/pre-publish/`.
- [ ] Replace route-local implementations with imports.
- [ ] Run pre-publish targeted tests.

## Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run web:build`.
- [ ] Run `npm run web:lint`.
- [ ] Report exact pass/warning status and remaining scope. TEMU Adapter remains intentionally out of scope.
