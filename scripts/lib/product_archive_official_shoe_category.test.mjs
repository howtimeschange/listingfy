import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  evaluateDeepdrawTradeSelectionFromLaunchPlanRows as evaluate,
  mergeTradeSelectionHumanState,
} from '../../web/server/services/product-archive-drafts.ts';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/shoe-official-category-cases.json', import.meta.url), 'utf8'));
const platforms = 'ALIBABA,PDD,TAOBAO,KUAISHOU,VIP,DOUYIN';
const rows = (row) => [{ source_type: 'launch_plan', source_batch_id: 1, row_json: row }];
const run = (row, trades = fixture.trades, extra = {}) => evaluate(rows(row), trades, { tenantName: '电商巴拉巴拉', ...extra });
const bootRow = fixture.cases.find(c => c.spu === '204426141134').row;

for (const c of fixture.cases) {
  test(`official shoe category wins for real style ${c.spu}`, () => {
    const decision = run(c.row);
    assert.equal(decision.recommendedTrade?.tradeId ?? null, c.expectedTradeId);
    if (c.expectedTradeId) {
      assert.equal(decision.status, 'auto_applied');
      assert.equal(decision.matchedField, '官方发布类目');
      assert.equal(decision.matchedValue, c.row['官方发布类目']);
    } else {
      assert.equal(decision.status, 'manual_selection_required');
      assert.equal(decision.reasonCode, 'source_category_conflict');
    }
  });
}

test('conflicting channel rows cannot override a unique official category', () => {
  const decision = evaluate([
    ...rows(bootRow),
    ...rows({ ...bootRow, '发布类目 (唯品)': '儿童皮鞋/时装鞋', '发布类目 (抖音)': '童鞋>学步鞋', '小类': '板鞋' }),
  ], fixture.trades, { tenantName: '电商巴拉巴拉' });
  assert.equal(decision.recommendedTrade.tradeId, '533');
  assert.equal(decision.sourceConflict, false);
});

test('missing official target never falls back to leisure-shoe aliases or a bag', () => {
  const decision = run(bootRow, fixture.trades.filter(t => t.trade_name !== '靴子'));
  assert.equal(decision.status, 'manual_selection_required');
  assert.equal(decision.recommendedTrade, null);
  assert.equal(decision.reasonCode, 'missing_semantic_match');
});

test('unknown official shoe category is not replaced by a channel category', () => {
  const decision = run({ ...bootRow, '官方发布类目': '童鞋>未同步的专用鞋' });
  assert.equal(decision.recommendedTrade, null);
  assert.equal(decision.reasonCode, 'missing_semantic_match');
});

test('official targets must cover required channel platforms', () => {
  const decision = run(bootRow, fixture.trades.map(t => t.trade_name === '靴子' ? { ...t, third_platforms: '' } : t));
  assert.equal(decision.recommendedTrade, null);
  assert.equal(decision.reasonCode, 'missing_platform_coverage');
});

test('official targets with incompatible SKU sizes cannot switch to another shoe family', () => {
  const decision = run(bootRow, fixture.trades.map(t => t.trade_name === '靴子' ? { ...t, size_options: ['26', '27'] } : t), { skus: [{ size_name: '33' }] });
  assert.equal(decision.recommendedTrade, null);
  assert.equal(decision.reasonCode, 'missing_size_template_coverage');
});

test('gender branch fallback considers direct leaves of the official family only', () => {
  const trades = [
    { trade_id: '531', trade_name: '童鞋/亲子鞋', trade_path: '童鞋/亲子鞋', third_platforms: platforms },
    { trade_id: '10159', parent_trade_id: '531', trade_name: '男童鞋', trade_path: '童鞋/亲子鞋 / 男童鞋', third_platforms: platforms },
    { trade_id: '10162', parent_trade_id: '10159', trade_name: '靴子', trade_path: '童鞋/亲子鞋 / 男童鞋 / 靴子', third_platforms: platforms, size_options: ['33'] },
    { trade_id: '533', parent_trade_id: '531', trade_name: '靴子', trade_path: '童鞋/亲子鞋 / 靴子', third_platforms: platforms, size_options: ['26'] },
    { trade_id: '10381', parent_trade_id: '531', trade_name: '板鞋', trade_path: '童鞋/亲子鞋 / 板鞋', third_platforms: platforms, size_options: ['33'] },
  ];
  const decision = run({ ...bootRow, '性别': '男' }, trades, { skus: [{ size_name: '33' }] });
  assert.equal(decision.recommendedTrade.tradeId, '10162');
});

test('equivalent official paths do not create false conflicts; genuinely different leaves do', () => {
  const equivalent = evaluate([...rows(bootRow), ...rows({ ...bootRow, '官方发布类目': '童鞋/亲子鞋>靴子' })], fixture.trades, { tenantName: '电商巴拉巴拉' });
  assert.equal(equivalent.recommendedTrade.tradeId, '533');
  const conflicting = evaluate([...rows(bootRow), ...rows({ ...bootRow, '官方发布类目': '童鞋/亲子鞋>板鞋' })], fixture.trades, { tenantName: '电商巴拉巴拉' });
  assert.equal(conflicting.status, 'manual_selection_required');
});

test('missing official category preserves the previous source fallback', () => {
  const { '官方发布类目': ignored, ...row } = bootRow;
  const decision = run(row);
  assert.equal(decision.recommendedTrade.tradeId, '10381');
});

test('applied and human-selected categories are not overwritten by a new recommendation', () => {
  const appliedTrade = { tradeId: '10381', tradePath: '童鞋/亲子鞋 / 板鞋' };
  const decision = run(bootRow, fixture.trades, { appliedTrade });
  assert.equal(decision.status, 'pending_confirmation');
  assert.deepEqual(decision.appliedTrade, appliedTrade);
  const merged = mergeTradeSelectionHumanState(decision, { status: 'human_adjusted', confirmedAt: '2026-09-21T09:54:18.217Z' });
  assert.equal(merged.status, 'human_adjusted');
  assert.equal(merged.confirmedAt, '2026-09-21T09:54:18.217Z');
  assert.deepEqual(merged.appliedTrade, appliedTrade);
});

test('a non-shoe official value cannot be silently dropped from an official source conflict', () => {
  const decision = evaluate([...rows(bootRow), ...rows({ '官方发布类目': '童装>长裤' })], fixture.trades, { tenantName: '电商巴拉巴拉' });
  assert.equal(decision.status, 'manual_selection_required');
  assert.equal(decision.reasonCode, 'source_category_conflict');
});
