# Bala DeepDraw Trade Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `电商巴拉巴拉` tenant recommend DeepDraw categories strictly from the business-approved first, second, and fallback scopes while preserving existing behavior for every other tenant.

**Architecture:** Keep the existing recommendation evaluator as the single entry point and add a tenant policy layer immediately before platform and semantic scoring. Resolve each candidate's approved scope from the complete `parent_trade_id` chain, evaluate one priority tier at a time, and reuse the resulting decision in creation, refresh, detail, confirmation, and safe legacy backfill through the existing `inferDeepdrawTradeSelectionFromLaunchPlan` call path.

**Tech Stack:** Node.js 24+, TypeScript, Hono service layer, PostgreSQL `deepdraw_trade_cache`, Node test runner through `tsx --test`, React/Vite validation.

## Global Constraints

- Apply this whitelist and priority policy only when `tenantName === "电商巴拉巴拉"`.
- First priority contains all descendants of roots `7`, `531`, and `9483`, plus only branches `6741`, `6744`, `905`, and `10087` and their descendants.
- Second priority contains all descendants of roots `3245`, `3525`, and `893`.
- Fallback contains root `9631 / blbl&mini` and its descendants.
- Exclude every other DeepDraw category from automatic recommendation for this tenant.
- Resolve ancestry through `trade_id` and `parent_trade_id`; never infer the root by splitting `trade_path` because root names contain `/`.
- A semantic match in a higher tier wins over any lower-tier score; a higher-tier tie returns `manual_selection_required / ambiguous_match` without falling through.
- Continue to require launch-plan platform coverage inside every tier.
- Do not restrict the existing manual category picker; an operator may still choose excluded categories and record `human_adjusted`.
- Do not change recommendation behavior for other tenants.
- Preserve the current safe-backfill status boundary: only `draft`, `manual_review`, and `ready` may be changed; terminal drafts remain review-only.
- Preserve unrelated modified and untracked files and stage only the scoped Listingify changes.

---

### Task 1: Tenant Priority Policy and Parent-Chain Resolution

**Files:**
- Modify: `web/server/services/product-archive-drafts.ts:1450-1705`
- Test: `scripts/lib/product_archive_creation.test.mjs:174-447`

**Interfaces:**
- Consumes: `tenantName`, launch-plan category rows, and the full DeepDraw candidate list containing `trade_id`, `parent_trade_id`, `trade_name`, `trade_path`, and `third_platforms`.
- Produces: `evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, trades, { tenantName, ... })`, preserving the existing `TradeSelectionDecision` shape.

- [x] **Step 1: Add failing tests for the strict tier order**

Add fixtures with explicit parent rows and assert all of these outcomes:

```js
const root = (tradeId, tradeName) => ({
  trade_id: tradeId,
  parent_trade_id: null,
  trade_name: tradeName,
  trade_path: tradeName,
  third_platforms: platforms,
});
const child = (tradeId, parentTradeId, tradeName, tradePath) => ({
  trade_id: tradeId,
  parent_trade_id: parentTradeId,
  trade_name: tradeName,
  trade_path: tradePath,
  third_platforms: platforms,
});

const decision = service.evaluateDeepdrawTradeSelectionFromLaunchPlanRows(sourceRows, [
  root("7", "童装婴幼儿服装"),
  child("7001", "7", "外套", "童装婴幼儿服装 / 外套"),
  root("3245", "尿片/洗护/喂哺/推车床"),
  child("3245001", "3245", "普通外套", "尿片/洗护/喂哺/推车床 / 普通外套"),
  root("9631", "blbl&mini"),
  child("9631001", "9631", "普通外套", "blbl&mini / 普通外套"),
], {
  tenantName: "电商巴拉巴拉",
  evaluatedAt: "2026-07-16T00:00:00.000Z",
});

assert.equal(decision.recommendedTrade?.tradeId, "7001");
assert.match(decision.reason, /第一优先级.*童装婴幼儿服装/);
```

Add sibling assertions for:

1. Second-tier fallback when every first-tier candidate has a zero semantic score.
2. `blbl&mini` final fallback when both higher tiers have zero semantic scores.
3. Higher-tier ambiguity returning `ambiguous_match` without falling through to an exact lower-tier match.
4. An exact match under an excluded root returning no recommendation.
5. Descendants of `6741`, `6744`, `905`, and `10087` being accepted while sibling branches under roots `888` and `891` are excluded.
6. Root `3245 / 尿片/洗护/喂哺/推车床` being resolved through `parent_trade_id` even though its name contains `/`.
7. The same candidates without `tenantName: "电商巴拉巴拉"` preserving the previous non-Bala result.

- [x] **Step 2: Run the focused priority tests and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test --test-name-pattern='Bala DeepDraw priority' scripts/lib/product_archive_creation.test.mjs
```

Expected: FAIL because the evaluator ignores `tenantName`, still excludes `blbl&mini`, and scores every remaining candidate in one global pass.

- [x] **Step 3: Define the approved policy with stable DeepDraw IDs**

Add exact policy constants beside the evaluator:

```ts
const BALA_DEEPDRAW_TENANT = "电商巴拉巴拉"

const BALA_DEEPDRAW_TRADE_PRIORITY = [
  {
    key: "first",
    label: "第一优先级",
    roots: new Map([
      ["7", "童装婴幼儿服装"],
      ["531", "童鞋/亲子鞋"],
      ["9483", "寝具服饰"],
    ]),
    branches: new Map([
      ["6741", "运动/瑜伽/健身/球迷用品 / 游泳 / 亲子家庭装"],
      ["6744", "运动/瑜伽/健身/球迷用品 / 游泳 / 儿童泳衣/裤"],
      ["905", "运动中性鞋 / 女童鞋"],
      ["10087", "运动中性鞋 / 男童鞋"],
    ]),
  },
  {
    key: "second",
    label: "第二优先级",
    roots: new Map([
      ["3245", "尿片/洗护/喂哺/推车床"],
      ["3525", "婴幼儿寝具"],
      ["893", "玩具/模型/动漫/早教/益智"],
    ]),
    branches: new Map<string, string>(),
  },
  {
    key: "fallback",
    label: "兜底优先级",
    roots: new Map([["9631", "blbl&mini"]]),
    branches: new Map<string, string>(),
  },
] as const
```

- [x] **Step 4: Implement cycle-safe ancestry and tier classification**

Build a `trade_id` map from the complete candidate list. Include the candidate itself in its ancestor chain, stop at an empty/missing parent, and guard cycles with a `Set`.

```ts
function deepdrawTradeAncestorIds(trade: JsonRecord, tradesById: Map<string, JsonRecord>) {
  const ids: string[] = []
  const visited = new Set<string>()
  let current: JsonRecord | undefined = trade
  while (current) {
    const tradeId = stringValue(current.trade_id)
    if (!tradeId || visited.has(tradeId)) break
    ids.push(tradeId)
    visited.add(tradeId)
    const parentId = stringValue(current.parent_trade_id)
    current = parentId ? tradesById.get(parentId) : undefined
  }
  return ids
}
```

For `电商巴拉巴拉`, place a trade in the first policy tier whose `roots` or `branches` contains any ancestor ID. For other tenants, return one unchanged candidate tier after the existing `blbl&mini` exclusion.

- [x] **Step 5: Score candidates tier by tier**

Extract the current score/depth/tie loop into a pure helper. For the Bala tenant, iterate first, second, and fallback tiers in order:

```ts
for (const tier of candidateTiers) {
  const eligibleTrades = platformEligibleTrades(tier.candidates)
  if (eligibleTrades.length === 0) continue
  foundPlatformEligibleTrade = true
  const match = bestTradeMatch(eligibleTrades, categories)
  if (!match.best) continue
  if (match.tied) {
    return manualTradeSelectionDecision({
      reasonCode: "ambiguous_match",
      reason: `${tier.label}存在多个同分且同层级的深绘类目，无法自动确定，需要人工选择。`,
      appliedTrade,
      requiredPlatforms,
      sourceConflict,
      evaluatedAt,
    })
  }
  selected = { ...match.best, priorityLabel: tier.label, policyRootName: match.best.policyRootName }
  break
}
```

If all approved tiers fail, use `missing_platform_coverage` only when no approved candidate covered the required platforms; otherwise use `missing_semantic_match`. Prefix successful decision reasons with the matched priority label and approved root/branch name without adding database columns.

- [x] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
./web/node_modules/.bin/tsx --test --test-name-pattern='trade matching|trade selection decision|Bala DeepDraw priority' scripts/lib/product_archive_creation.test.mjs
```

Expected: PASS for the strict tier cases and all existing evaluator cases.

### Task 2: Runtime Candidate Metadata and Shared-Flow Integration

**Files:**
- Modify: `web/server/services/product-archive-drafts.ts:1783-1845`
- Test: `scripts/lib/product_archive_creation.test.mjs:560-790`

**Interfaces:**
- Consumes: `listDeepdrawTradeSelectionCandidates(db, tenantName, merchantId)` and `inferDeepdrawTradeSelectionFromLaunchPlan`.
- Produces: candidates with `parent_trade_id`, and tenant-aware decisions reused by draft creation, source refresh, detail rendering, confirmation recheck, and backfill.

- [x] **Step 1: Add failing integration-contract tests**

Assert the candidate query and evaluator call carry the two required values:

```js
const serviceSource = await readFile(files.draftService, "utf8");
assert.match(serviceSource, /trade\.parent_trade_id/);
assert.match(serviceSource, /tenantName:\s*input\.tenantName/);
```

Update fake Bala cache rows used by refresh/confirmation tests so each leaf has `parent_trade_id: "7"` and each candidate list contains the root row `{ trade_id: "7", parent_trade_id: null, trade_name: "童装婴幼儿服装" }`.

- [x] **Step 2: Run integration tests and verify RED**

Run:

```bash
./web/node_modules/.bin/tsx --test --test-name-pattern='candidate ancestry|source-batch refresh|confirming a recommendation|legacy recommendation' scripts/lib/product_archive_creation.test.mjs
```

Expected: FAIL because the SQL omits `parent_trade_id` and `inferDeepdrawTradeSelectionFromLaunchPlan` does not pass the tenant into the evaluator.

- [x] **Step 3: Select parent metadata and pass tenant context**

Change the candidate query and evaluator call exactly at the shared boundary:

```ts
select
  trade.trade_id,
  trade.parent_trade_id,
  trade.trade_name,
  trade.trade_path,
  ...
```

```ts
return evaluateDeepdrawTradeSelectionFromLaunchPlanRows(input.sourceRows, trades, {
  tenantName: input.tenantName,
  appliedTrade: input.appliedTrade,
  evaluatedAt: input.evaluatedAt,
})
```

Do not add policy branches to creation, refresh, confirmation, detail, or backfill individually; those flows already call this shared inference function.

- [x] **Step 4: Run the complete backend regression test file**

Run:

```bash
./web/node_modules/.bin/tsx --test scripts/lib/product_archive_creation.test.mjs
```

Expected: PASS with Bala fixtures classified through parent IDs and non-Bala fixtures unchanged.

### Task 3: Safe Local Refresh and Full Verification

**Files:**
- Verify: `scripts/product_archive_trade_backfill.mjs`
- Verify: `package.json`
- Verify: `web/server/services/product-archive-drafts.ts`
- Verify: `web/src/pages/product-archive-drafts/[draftId]/page.tsx`
- Verify: `scripts/lib/product_archive_creation.test.mjs`
- Verify: `scripts/lib/deepdraw_product_archive_ui.test.mjs`

**Interfaces:**
- Consumes: the tenant-aware evaluator and the existing safe backfill command.
- Produces: refreshed editable local drafts, a review-only terminal-draft list, and fresh verification evidence.

- [x] **Step 1: Preview the local safe backfill**

Run:

```bash
npm run deepdraw:trade:backfill
```

Expected: JSON reports `mode: "preview"`; eligible `draft/manual_review/ready` rows are `preview_apply`, while terminal rows are `review_only` and no draft is mutated.

- [x] **Step 2: Apply only the previewed editable drafts**

Run:

```bash
npm run deepdraw:trade:backfill -- --apply
```

Expected: only editable legacy rows receive the current recommended `trade_id/trade_path`, regenerated fields and validation, plus `pending_confirmation / legacy_backfill_confirmation_required`; terminal rows remain unchanged.

- [x] **Step 3: Run all automated checks**

Run:

```bash
npm test
npm run web:lint
npm run web:build
git diff --check
```

Expected: the full test suite has zero failures, lint/build exit 0, and the whitespace check prints nothing.

- [x] **Step 4: Review the complete scoped diff against the approved spec**

Check all eight regression requirements: first-tier precedence, second-tier fallback, `blbl&mini` final fallback, higher-tier ambiguity, excluded exact match, narrow `888/891` branches, parent-chain root resolution, and unchanged non-Bala behavior. Also verify the existing apply-and-confirm transaction and terminal backfill boundary remain intact.

Run:

```bash
git diff -- web/server/services/product-archive-drafts.ts scripts/lib/product_archive_creation.test.mjs scripts/lib/deepdraw_product_archive_ui.test.mjs web/src/pages/product-archive-drafts/'[draftId]'/page.tsx package.json scripts/product_archive_trade_backfill.mjs
git status --short
```

Expected: only the approved recommendation/confirmation implementation, its tests, script, package command, and plan are in scope; unrelated agent documentation stays untracked.

- [x] **Step 5: Commit the reviewed implementation as one local checkpoint**

```bash
git add package.json scripts/lib/product_archive_creation.test.mjs scripts/lib/deepdraw_product_archive_ui.test.mjs scripts/product_archive_trade_backfill.mjs web/server/services/product-archive-drafts.ts web/src/pages/product-archive-drafts/'[draftId]'/page.tsx docs/superpowers/plans/2026-07-16-bala-deepdraw-trade-priority.md
git commit -m "feat: enforce Bala DeepDraw category priorities"
```

Expected: the commit excludes `AGENTS.md`, `web/AGENTS.md`, agent-readiness docs, and unrelated review notes.
