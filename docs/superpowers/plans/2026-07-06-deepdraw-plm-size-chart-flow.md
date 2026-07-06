# DeepDraw PLM Size Chart Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import PLM size-chart spreadsheets, map high-confidence PLM measurement points to DeepDraw size-chart templates, use AI for low-confidence recommendations, and integrate the result into the DeepDraw product archive draft workflow.

**Architecture:** Add a focused PLM size-chart domain module under `scripts/lib/`, persist imported PLM rows as a new `size_chart` source type, and have the product archive draft service derive `value_json` for DeepDraw `*尺码表` fields from the latest imported size-chart batch. UI changes expose the flow in the start-draft dialog, list toolbar, and draft detail tabs while keeping manual review/audit data visible.

**Tech Stack:** TypeScript/Hono/PostgreSQL for API and service integration; React/Vite/TanStack Query for UI; Node test runner with `tsx --test`; existing DeepDraw AI fill configuration via `resolveAiConfig`.

## Execution Status

- Implemented on branch `codex/deepdraw-size-chart-flow`.
- Added PLM size-chart parsing/mapping module, `size_chart` source import path, reviewable mapping table, start-dialog import step, list import action, and draft-detail size-chart configuration tab.
- Added AI/manual mapping application path: saving review records can optionally rebuild the draft fields and return refreshed draft detail.
- See `docs/deepdraw-plm-size-chart-mapping-notes-2026-07-06.md` for the investigation notes, current sample results, confidence rules, and follow-up caveats.
- Verification run: real PLM fixture test, `npm test`, `npm run db:migrate`, `npm run web:lint`, and `npm run web:build`.

---

## File Map

- Create `scripts/lib/product_archive_size_chart.mjs`
  - Parse normalized PLM rows.
  - Normalize size values to `80cm`.
  - Resolve DeepDraw `MULTI_TEXT` size-chart templates.
  - Produce high-confidence mappings, conflict records, and draft `value_json`.
- Create `scripts/lib/product_archive_size_chart.test.mjs`
  - Behavior tests for PLM row parsing, high-confidence rules, low-confidence conflicts, and multi-table set templates.
- Modify `db/migrations/034_product_archive_size_chart_source.sql`
  - Extend source batch/row check constraints to include `size_chart`.
  - Add `product_archive_size_chart_mapping` table for rule persistence and AI/manual review metadata.
- Modify `web/server/services/product-archive-drafts.ts`
  - Accept `size_chart` imports.
  - Include size-chart batch IDs in draft snapshots.
  - Fill DeepDraw size-chart `value_json` from PLM data before placeholder fallback.
  - Add AI recommendation and apply helpers.
  - Validate size-chart row keys and column counts.
- Modify `web/server/routes/product-archive-drafts.ts`
  - Wire size-chart upload/import workflow.
  - Add endpoints for importing PLM size charts, applying to existing drafts, fetching size-chart preview, AI recommending mappings, and saving review decisions.
- Modify `web/src/pages/product-archive-drafts/page.tsx`
  - Add start-dialog step 3 for PLM size-chart import.
  - Add toolbar `导入尺码表` action for existing drafts.
  - Add async task feedback and refresh behavior.
- Modify `web/src/pages/product-archive-drafts/[draftId]/page.tsx`
  - Add `尺码表` tab with generated tables, mapping confidence, AI recommendations, and save/apply controls.
- Modify `scripts/lib/product_archive_creation.test.mjs`
  - Integration guards for `size_chart` source type, field generation, and validation.
- Modify `scripts/lib/deepdraw_product_archive_ui.test.mjs`
  - UI contract guards for new buttons, dialog step, and detail tab.

---

### Task 1: PLM Size-Chart Domain Module

**Files:**
- Create: `scripts/lib/product_archive_size_chart.mjs`
- Test: `scripts/lib/product_archive_size_chart.test.mjs`

- [ ] **Step 1: Write failing parser and mapping tests**

```js
test("normalizes PLM long-table rows and builds a high-confidence top size chart", () => {
  const rows = [
    { "款号": "208326100020", "测量点": "衣长", "尺码": "80/", "尺码值": "38.0" },
    { "款号": "208326100020", "测量点": "肩宽", "尺码": "80/", "尺码值": "26.5" },
    { "款号": "208326100020", "测量点": "胸围", "尺码": "80/", "尺码值": "66.0" },
    { "款号": "208326100020", "测量点": "下摆围（弧量）", "尺码": "80/", "尺码值": "80.0" },
    { "款号": "208326100020", "测量点": "里：袖长", "尺码": "80/", "尺码值": "24.5" },
    { "款号": "208326100020", "测量点": "里：1/2袖口（平量）", "尺码": "80/", "尺码值": "8.4" },
  ];
  const template = {
    fieldName: "尺码表",
    options: ["领口", "肩宽", "袖长", "袖口", "胸围", "腰围", "衣长", "下摆围"],
  };
  const result = buildSizeChartForTemplate({ rows, spuCode: "208326100020", template });
  assert.deepEqual(result.valueJson, {
    title: "肩宽,袖长,袖口,胸围,衣长,下摆围",
    "80cm": "26.5,24.5,8.4,66,38,80",
  });
  assert.equal(result.mappings.find((item) => item.targetField === "袖长")?.sourcePoint, "里：袖长");
  assert.equal(result.unmatchedTargets.includes("领口"), true);
});
```

- [ ] **Step 2: Run parser test and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_size_chart.test.mjs
```

Expected: fail because `scripts/lib/product_archive_size_chart.mjs` does not exist.

- [ ] **Step 3: Implement minimal module**

Implement exports:

```js
export function normalizePlmSizeChartRows(rows = []) {}
export function normalizeDeepdrawSize(value) {}
export function buildSizeChartForTemplate({ rows, spuCode, template }) {}
export function recommendSizeChartTrade({ spu, plmPoints, trades }) {}
```

High-confidence rules:

```js
[
  ["衣长", ["衣长"]],
  ["裙长", ["裙长"]],
  ["肩宽", ["肩宽"]],
  ["胸围", ["胸围", "1/2胸围"]],
  ["裤长", ["裤长"]],
  ["腰围", ["全腰围（平量）", "腰围"]],
  ["臀围", ["臀围", "臀围（平量）"]],
  ["脚口", ["1/2脚口（平量）"]],
  ["裤口围", ["1/2脚口（平量）"]],
  ["下摆围", ["下摆围（平量）", "下摆围（弧量）", "裙摆围"]],
]
```

Medium-confidence rules:

```js
[
  ["袖长", ["袖长", "内袖长", "里：袖长"]],
  ["袖口", ["1/2袖口（平量）", "里：1/2袖口（平量）", "1/2袖口"]],
  ["前档", ["前浪（弯量）"]],
  ["前裆", ["前浪（弯量）"]],
  ["后裆", ["后浪（弯量）"]],
  ["大腿围", ["1/2脾围"]],
  ["袖笼围", ["1/2夹圈（弯量）", "1/2夹圈弯量", "1/2夹直（边至边量）背心"]],
]
```

- [ ] **Step 4: Run parser test and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_size_chart.test.mjs
```

Expected: pass.

### Task 2: Database Source Type and Import Path

**Files:**
- Create: `db/migrations/034_product_archive_size_chart_source.sql`
- Modify: `web/server/services/product-archive-drafts.ts`
- Modify: `web/server/routes/product-archive-drafts.ts`
- Test: `scripts/lib/product_archive_creation.test.mjs`

- [ ] **Step 1: Write failing source-type tests**

Add tests asserting:

```js
assert.match(migration, /size_chart/);
assert.match(serviceSource, /sourceImportType\(input\.sourceType\)/);
assert.match(serviceSource, /normalizeProductArchiveSizeChartSourceRows/);
assert.match(routeSource, /sourceType:\s*"size_chart"/);
```

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: fail because migration and size-chart route/service wiring are absent.

- [ ] **Step 3: Implement migration and import wiring**

Migration must:

```sql
alter table product_archive_source_batch
  drop constraint if exists product_archive_source_batch_source_type_check;
alter table product_archive_source_batch
  add constraint product_archive_source_batch_source_type_check
  check(source_type in ('field_mapping', 'launch_plan', 'copywriting', 'size_chart'));

alter table product_archive_source_row
  drop constraint if exists product_archive_source_row_source_type_check;
alter table product_archive_source_row
  add constraint product_archive_source_row_source_type_check
  check(source_type in ('launch_plan', 'copywriting', 'size_chart'));
```

Add mapping table:

```sql
create table if not exists product_archive_size_chart_mapping (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text not null,
  field_name text not null,
  target_field text not null,
  source_point text,
  confidence text not null default 'manual',
  source text not null default 'rule',
  review_status text not null default 'pending',
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, trade_id, field_name, target_field)
);
```

Service changes:

- `sourceImportType` accepts `size_chart`.
- `importProductArchiveSourceRows` normalizes PLM rows via `normalizePlmSizeChartRows`.
- `refreshProductArchiveDraftsFromSourceBatch` treats `size_chart` like refreshable source rows.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: pass.

### Task 3: Draft Field Generation and Validation

**Files:**
- Modify: `web/server/services/product-archive-drafts.ts`
- Test: `scripts/lib/product_archive_creation.test.mjs`

- [ ] **Step 1: Write failing field-generation tests**

Add tests showing:

```js
const value = buildProductArchiveSizeChartFieldValue({
  fieldName: "尺码表",
  spuCode: "208326100020",
  sourceRows: sizeChartRows,
  templateOptions: ["领口", "肩宽", "袖长", "袖口", "胸围", "腰围", "衣长", "下摆围"],
});
assert.deepEqual(value.valueJson.title, "肩宽,袖长,袖口,胸围,衣长,下摆围");
```

Add validation tests for:

- Size-chart row keys must be included in `尺码`.
- Each row value count must match `title` count.

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: fail because `buildProductArchiveSizeChartFieldValue` and validations are absent.

- [ ] **Step 3: Implement service generation**

Add helper:

```ts
export function buildProductArchiveSizeChartFieldValue(input: {
  fieldName: string
  spuCode: string
  sourceRows: JsonRecord[]
  templateOptions: unknown[]
})
```

Update `fieldInsertData`:

- Resolve template options for fields whose compact key includes `尺码表`.
- Build PLM-derived `valueJson`.
- Use PLM-derived `valueJson` before `buildProductArchiveMdmDerivedFieldValue` placeholder.
- Store `sourceType` as `size_chart` when PLM data is used.

Update validation:

- For `*尺码表`, parse title and size rows.
- Compare row keys against `尺码` field values after `deepdrawSizeValue`.
- Add blocker for missing size match and invalid column count.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: pass.

### Task 4: AI Mapping Recommendation Endpoint

**Files:**
- Modify: `web/server/services/product-archive-drafts.ts`
- Modify: `web/server/routes/product-archive-drafts.ts`
- Test: `scripts/lib/product_archive_creation.test.mjs`

- [ ] **Step 1: Write failing AI route/service tests**

Assert route has endpoints:

```text
/product-archive-drafts/:draftId/size-chart/ai-recommend
/product-archive-drafts/:draftId/size-chart/mappings
```

Assert service exports:

```ts
recommendProductArchiveSizeChartMappings
saveProductArchiveSizeChartMappings
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: fail because endpoints/exports are absent.

- [ ] **Step 3: Implement AI recommendation path**

Use existing `resolveAiConfig` and `callDeepdrawAiFill` pattern.

AI input must include:

- Draft SPU and trade path.
- DeepDraw size-chart field options.
- PLM measurement points with descriptions.
- Existing rule-based high/medium/low confidence mapping.

AI output schema:

```json
{
  "mappings": [
    {
      "fieldName": "尺码表",
      "targetField": "袖口",
      "sourcePoint": "里：1/2袖口（平量）",
      "confidence": "medium",
      "reason": "..."
    }
  ]
}
```

Fallback behavior:

- If AI call fails, return rule-based recommendations with `source: "rule_fallback"`.
- Never auto-apply low-confidence AI suggestions without saving review status.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: pass.

### Task 5: List Page and Start Dialog UI

**Files:**
- Modify: `web/src/pages/product-archive-drafts/page.tsx`
- Test: `scripts/lib/deepdraw_product_archive_ui.test.mjs`

- [ ] **Step 1: Write failing UI contract tests**

Assert:

```js
assert.match(page, /3\. 导入尺码表模板/);
assert.match(page, /导入尺码表/);
assert.match(page, /sizeChartFile/);
assert.match(page, /sourceType.*size_chart/s);
```

- [ ] **Step 2: Run UI contract test and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/deepdraw_product_archive_ui.test.mjs
```

Expected: fail because the UI has no size-chart controls.

- [ ] **Step 3: Implement UI controls**

Start dialog:

- Add third section after launch plan.
- File input accepts `.xlsx,.csv`.
- Label: `3. 导入尺码表模板`.
- Helper text: `支持 PLM 导出的宽表/长表，按款号自动补齐深绘尺码表。`
- Submit workflow includes `sizeChartFile`.

Toolbar:

- Add separate button `导入尺码表`.
- Upload PLM file through source import with `sourceType=size_chart`.
- On success, refresh draft list and enqueue/report sync job if returned.

- [ ] **Step 4: Run UI contract test and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/deepdraw_product_archive_ui.test.mjs
```

Expected: pass.

### Task 6: Draft Detail Size-Chart Tab

**Files:**
- Modify: `web/src/pages/product-archive-drafts/[draftId]/page.tsx`
- Test: `scripts/lib/deepdraw_product_archive_ui.test.mjs`

- [ ] **Step 1: Write failing detail UI tests**

Assert:

```js
assert.match(detailPage, /尺码表配置/);
assert.match(detailPage, /AI 推荐尺码映射/);
assert.match(detailPage, /mapping\.confidence/);
assert.match(detailPage, /sizeChartPreview/);
```

- [ ] **Step 2: Run UI contract test and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/deepdraw_product_archive_ui.test.mjs
```

Expected: fail because no size-chart tab exists.

- [ ] **Step 3: Implement detail tab**

Add `TabsTrigger value="size-chart"` label `尺码表配置`.

The tab displays:

- DeepDraw size-chart fields and generated `value_json`.
- Mapping rows: target field, PLM source point, confidence, source, reason.
- Buttons: `AI 推荐尺码映射`, `应用到草稿`, `保存人工审核`.

Use existing `api.post` mutations and invalidate draft detail query after save/apply.

- [ ] **Step 4: Run UI contract test and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/deepdraw_product_archive_ui.test.mjs
```

Expected: pass.

### Task 7: Real PLM Template Regression

**Files:**
- Modify tests as needed only if they expose real defects.
- No production files unless regressions are found.

- [ ] **Step 1: Run targeted parser test against real PLM fixture path**

Run:

```bash
PLM_SIZE_CHART_FIXTURE="/Users/xingyicheng/Downloads/PLM尺码表下载__20260706-111429.xlsx" ./web/node_modules/.bin/tsx --test scripts/lib/product_archive_size_chart.test.mjs
```

Expected: pass and confirm all 5 expected SPUs are parsed.

- [ ] **Step 2: Run root test suite**

Run:

```bash
npm test
```

Expected: pass.

- [ ] **Step 3: Run frontend checks**

Run:

```bash
npm run web:lint
npm run web:build
```

Expected: pass.

- [ ] **Step 4: Run migration check**

Run:

```bash
npm run db:migrate
```

Expected: migration applies cleanly or reports no pending migrations.

- [ ] **Step 5: Manual smoke**

Start:

```bash
npm run web:server
npm run web:dev
```

Smoke:

- Open `/product-archive-drafts`.
- Use `导入尺码表` with `/Users/xingyicheng/Downloads/PLM尺码表下载__20260706-111429.xlsx`.
- Confirm draft `208326100020` and `208326104204` get non-placeholder size-chart JSON.
- Open a draft detail page and confirm `尺码表配置` tab renders mappings.

---

## Self-Review

Spec coverage:

- Expanded DeepDraw size-chart field matching: Tasks 1, 3, and 7.
- High-confidence mapping rules: Task 1.
- AI recommendation for middle/low confidence: Task 4 and Task 6.
- Start dialog third step: Task 5.
- List toolbar import: Task 5.
- Detail size-chart configuration/edit tab: Task 6.
- Existing flow integration and validation: Tasks 2, 3, and 7.

Placeholder scan:

- No `TBD`, `TODO`, or `implement later` remains in the task instructions.

Type consistency:

- Service names are consistently `buildProductArchiveSizeChartFieldValue`, `recommendProductArchiveSizeChartMappings`, and `saveProductArchiveSizeChartMappings`.
- Source type is consistently `size_chart`.
