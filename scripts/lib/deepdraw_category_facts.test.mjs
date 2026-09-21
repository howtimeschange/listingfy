import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryAdviceFacts } from './deepdraw_category_facts.mjs';

test('uses latest nonempty launch-plan facts per field, with conflict and provenance', () => {
  const result = buildCategoryAdviceFacts([
    { id: 1, source_type: 'launch_plan', source_batch_id: 1, row_json: { 官方发布类目: '皮靴', 性别: '女', 尺码段: '25-30' } },
    { id: 2, source_type: 'launch_plan', source_batch_id: 2, row_json: { 官方发布类目: '雪地靴', 性别: '男', 大货款号: '204426141134', expectedAllowed: '533' } },
    { id: 3, source_type: 'launch_plan', source_batch_id: 2, row_json: { 官方发布类目: '皮靴', 性别: '女' } },
    { id: 4, source_type: 'copywriting', source_batch_id: 3, row_json: { 官方发布类目: '板鞋', 年龄: '儿童' } },
  ]);
  assert.deepEqual(result.facts, { officialCategory: ['皮靴', '雪地靴'], sizeRange: ['25-30'], gender: ['女', '男'] });
  assert.equal(result.officialConflict, true);
  assert.deepEqual(result.provenance.sizeRange, { batchId: 1, rowIds: [1] });
  assert.equal(JSON.stringify(result.facts).includes('204426141134'), false);
});

test('style identity and source row identity do not change model facts', () => {
  const row = { id: 1, source_type: 'launch_plan', source_batch_id: 2, row_json: { 官方发布类目: '帽子', 年龄段: '中童', 预期标签: '秋季' } };
  assert.deepEqual(buildCategoryAdviceFacts([row]).facts, buildCategoryAdviceFacts([{ ...row, id: 99, row_json: { ...row.row_json, 大货款号: 'another-style' } }]).facts);
});
