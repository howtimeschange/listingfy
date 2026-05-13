# Prepublish Rules AI Bulk Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize SHEIN pre-publish preparation by moving deterministic fixes out of AI, adding practical batch entry points, and widening batch edits for category, packaging, weight, and title.

**Architecture:** Add small pure helpers in pre-publish service modules, then wire them into `pre-publish.ts` and the existing batch dialog. AI becomes a suggestion source for category and non-critical enum attributes; deterministic rules own material normalization, packaging, weight, title persistence, and batch fixes.

**Tech Stack:** Hono routes, React + TanStack Query, local static tests with Node test runner.

---

### Task 1: Material Normalization

**Files:**
- Modify: `web/server/services/pre-publish/field-fills.ts`
- Modify: `web/server/routes/pre-publish.ts`
- Test: `scripts/lib/pre_publish_services.test.mjs`

- [ ] Add `normalizeMaterialValue()` so `棉混纺` and close variants become `织物`.
- [ ] Use it when inferring SHEIN material/composition attributes and when saving manual field fills.
- [ ] Verify with `npm test -- scripts/lib/pre_publish_services.test.mjs`.

### Task 2: AI Category Guardrail

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Test: `scripts/lib/pre_publish_services.test.mjs`

- [ ] Treat category fills from deterministic mapping/manual selection as auto-applicable.
- [ ] For `RULE_FALLBACK` and AI suggestions, persist the suggestion but do not overwrite `listing.platform_category_id` during AI enrich unless confidence is high and source is not fallback.
- [ ] Update button text to make category AI read as recommendation, not guaranteed conversion.

### Task 3: Critical Field Ownership

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Test: `scripts/lib/pre_publish_services.test.mjs`

- [ ] Exclude category, packaging, weight, size, and price fields from AI attribute fill.
- [ ] Keep title AI translation as allowed, but mark title source clearly as `AI_TRANSLATED`.
- [ ] Ensure missing critical fields appear in batch check quick fixes where possible.

### Task 4: Batch Modify Category, Packaging, Weight, Title

**Files:**
- Modify: `web/server/routes/pre-publish.ts`
- Modify: `web/src/components/pre-publish/batch-publish-dialog.tsx`
- Test: `scripts/lib/pre_publish_services.test.mjs`

- [ ] Extend `/drafts/batch-publish-check` quick fixes with listing title, category, and SKU packaging dimensions.
- [ ] Add common batch input controls to the batch dialog for English title, category IDs, package dimensions, and package weight.
- [ ] Save fixes through existing `/fields`, `/category`, and `/save` endpoints.

### Task 5: Batch Image Upload Entry

**Files:**
- Modify: `web/src/pages/pre-publish-validation/page.tsx`
- Modify: `web/server/routes/pre-publish.ts`
- Test: `scripts/lib/pre_publish_services.test.mjs`

- [ ] Add a selected-drafts batch image directory action on the draft list.
- [ ] Add a server endpoint that applies folder import to multiple listing IDs and returns per-listing counts.
- [ ] Keep single-draft image import unchanged.

### Verification

- [ ] Run `npm test -- scripts/lib/pre_publish_services.test.mjs scripts/lib/shein_product_bucket_ui.test.mjs`.
- [ ] Run `npm run web:lint` if dependency state allows.
- [ ] Manually review the batch dialog flow for clear copy and no hidden publish side effects.
