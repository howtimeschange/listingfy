// Only launch-plan facts are eligible. Style identity and evaluation labels never
// enter model state, so equivalent facts can share cached advice across styles.
export const CATEGORY_FACT_FIELDS = Object.freeze({
  officialCategory: ['官方发布类目', '发布类目(官方)', '发布类目 (官方)', '发布类目（官方）', '发布类目\n(官方)'],
  category: ['品类', '类目', '分类'],
  subCategory: ['小类', '小类描述', '子类', '细分类目'],
  sizeRange: ['尺码段', '尺码范围', '尺码'],
  age: ['年龄段', '年龄', '适用年龄'],
  gender: ['性别', '适用性别'],
  businessLabels: ['业务标签', '商品标签', '预期标签'],
});

function meaningful(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return !text || /^(?:-|--|无|暂无|null|undefined)$/i.test(text) ? null : text;
}

export function buildCategoryAdviceFacts(sourceRows) {
  const rows = sourceRows.filter(row => row.source_type === 'launch_plan');
  const batches = [...new Set(rows.map(row => Number(row.source_batch_id ?? row.sourceBatchId) || 0))].sort((a, b) => b - a);
  /** @type {Partial<Record<keyof typeof CATEGORY_FACT_FIELDS, string[]>>} */
  const facts = {};
  const provenance = {};
  for (const [field, aliases] of Object.entries(CATEGORY_FACT_FIELDS)) {
    for (const batch of batches) {
      const source = rows.filter(row => (Number(row.source_batch_id ?? row.sourceBatchId) || 0) === batch);
      const values = [...new Set(source.flatMap(row => aliases.map(alias => meaningful(row.row_json?.[alias]))).filter(Boolean))].sort();
      if (!values.length) continue;
      facts[field] = values;
      provenance[field] = { batchId: batch || null, rowIds: source.filter(row => aliases.some(alias => meaningful(row.row_json?.[alias]))).map(row => row.id).filter(id => id != null) };
      break;
    }
  }
  return { facts, provenance, officialConflict: (facts.officialCategory?.length ?? 0) > 1 };
}
