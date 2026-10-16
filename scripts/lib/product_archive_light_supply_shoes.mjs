// Scope the compatibility contract to this light-supply shoe code family.
export function lightSupplyShoeCode(fileName = '') {
  return String(fileName).match(/(?<![A-Za-z0-9])(20842614\d{2}[A-Za-z]\d)(?![A-Za-z0-9])/)?.[1] ?? '';
}

export const SHOE_FIELD_LABELS = {
  supplierArticleNo: ['供应商款号', '供应商货号'],
  upperMaterial: ['帮面材质', '帮面材料'],
  liningMaterial: ['里料材质', '内里材质'],
  soleMaterial: ['鞋底材质', '鞋底材料'],
  insoleMaterial: ['鞋垫材质', '鞋垫材料'],
  labelColor: ['颜色'],
  shoeSize: ['鞋号'],
  origin: ['产地'],
};

export function normalizeLightSupplyShoeDocument(document) {
  const code = lightSupplyShoeCode(document.fileName);
  if (!code || document.sourceKind !== 'hangtag') return document;
  const fields = new Map((document.fields ?? []).map(field => [field.key, field]));
  const reliableMaterial = value => /织物|德绒|绒|棉|麻|皮|革|橡胶|聚|纤维|尼龙|锦纶|涤纶|塑料|网布|羊毛|羊绒|\b(?:EVA|TPR|TPU|PU|PVC)\b/i.test(String(value));
  for (const key of ['upperMaterial', 'liningMaterial', 'soleMaterial', 'insoleMaterial']) {
    if (fields.has(key) && !reliableMaterial(fields.get(key).value)) fields.delete(key);
  }
  const text = String(document.rawText ?? '').replace(/(?<=[\u4e00-\u9fff]) +(?=[\u4e00-\u9fff])/g, '').replace(/[：]/g, ':');
  const put = (key, label, value, evidenceText) => fields.set(key, {key, label, value, evidenceText, confidence: 'medium', sourceKind: 'hangtag', pageNumber: 1});
  const article = fields.get('articleNo');
  const supplier = text.match(/产品货号\s*:\s*([A-Za-z][A-Za-z0-9]*-\d+)\b/)?.[1]
    ?? (article?.value?.match(/^[A-Za-z][A-Za-z0-9]*-\d+$/)?.[0]);
  if (supplier && !document.lightSupplyShoeNormalized) put('supplierArticleNo', '供应商款号', supplier, `标签产品货号: ${supplier}`);
  // Never allow a supplier's article number to replace the internal identifier.
  put('articleNo', '内部款号', code, `图包内部款号目录: ${code}`);
  for (const [key, labels] of Object.entries(SHOE_FIELD_LABELS)) {
    if (key === 'supplierArticleNo' || document.lightSupplyShoeNormalized) continue;
    const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels.join('|')})\\s*:\\s*([^\\n]+)`));
    if (!match) continue;
    const value = match[1].trim();
    // OCR noise must not become a material enum. A vision provider can recover it.
    if (/Material$/.test(key) && !reliableMaterial(value)) continue;
    if (value) put(key, labels[0], value, match[0].trim());
  }
  // Normalize only explicit evidence; do not repair Chinese OCR by guessing.
  for (const key of ['upperMaterial', 'liningMaterial', 'soleMaterial', 'insoleMaterial']) {
    const field = fields.get(key);
    if (field && /\bEVA\b/.test(field.value)) fields.set(key, {...field, value: 'EVA'});
  }
  const origin = fields.get('origin');
  if (origin) {
    const clean = origin.value.match(/^[\u4e00-\u9fff]{2,}(?:省|自治区)[\u4e00-\u9fff]{2,}?市/)?.[0];
    if (clean) fields.set('origin', {...origin, value: clean});
    else fields.delete('origin');
  }
  const name = fields.get('productName');
  if (name && !/^[\u4e00-\u9fff]{2,20}鞋$/.test(name.value)) fields.delete('productName');
  const standardLine = text.match(/(?:执行标准|扣行标准|抒行标准)\s*:\s*([^\n]+)/)?.[1];
  if (standardLine && !document.lightSupplyShoeNormalized) {
    const standards = [...standardLine.matchAll(/(?:QB|GB|FZ)\s*(?:\/\s*T\s*)?\d{4,6}\s*-\s*\d{4}/g)].map(m => m[0].replace(/\s/g, '').replace(/^(GB|QB|FZ)(\/T)?/, '$1$2 '));
    if (standards.length) {
      const existing = String(fields.get('executionStandard')?.value ?? '').match(/(?:QB|GB|FZ)\s*(?:\/\s*T\s*)?\d{4,6}\s*-\s*\d{4}/g) ?? [];
      standards.push(...existing.map(value => value.replace(/\s/g, '').replace(/^(GB|QB|FZ)(\/T)?/, '$1$2 ')));
      put('executionStandard', '执行标准', [...new Set(standards)].join('；'), standardLine);
    }
  }
  const missing = ['productName', 'supplierArticleNo', 'upperMaterial', 'soleMaterial', 'productGrade'].filter(key => !fields.has(key));
  const warnings = (document.warnings ?? []).filter(value => !value.startsWith('轻供鞋品待复核字段:'));
  if (missing.length) warnings.push(`轻供鞋品待复核字段: ${missing.join(', ')}，未推断补齐`);
  return {...document, lightSupplyShoeNormalized: true, warnings, detectedSpuCode: code, styleCodes: [code], internalSpuCode: code, supplierArticleNo: supplier ?? fields.get('supplierArticleNo')?.value ?? null, fields: [...fields.values()]};
}
