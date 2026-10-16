import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLightSupplyShoeDocument } from './product_archive_light_supply_shoes.mjs';
import { analyzeProductArchiveOcrDocument } from './product_archive_hangtag_ocr.mjs';

const text = '产品名称：儿童家居鞋\n产品货号：BaHF-1775\n颜色：靛绿萌爪龙\n鞋号：【150】码 内长150mm(2.0)\n执行标准：QB/T 4552-2020 GB30585-2024\n帮面材质：织物\n鞋底材质：乙烯-醋酸乙烯酯共聚物(EVA)\n产品等级：合格品\n产地：浙江省宁波市';
const document = () => analyzeProductArchiveOcrDocument({fileName:'2084261412A7/吊牌.png',pages:[{text}]});
test('light supply shoes preserve internal identity and extract separate label evidence', () => {
  const result = normalizeLightSupplyShoeDocument(document());
  const fields = Object.fromEntries(result.fields.map(field => [field.key,field.value]));
  assert.equal(result.detectedSpuCode, '2084261412A7');
  assert.equal(fields.articleNo, '2084261412A7');
  assert.equal(fields.supplierArticleNo, 'BaHF-1775');
  assert.equal(fields.executionStandard, 'QB/T 4552-2020；GB 30585-2024');
  assert.equal(fields.upperMaterial, '织物');
  assert.match(fields.soleMaterial, /EVA/);
  assert.equal(fields.productName, '儿童家居鞋');
  assert.equal(fields.labelColor, '靛绿萌爪龙');
  assert.match(fields.shoeSize, /150mm/);
  assert.equal(fields.origin, '浙江省宁波市');
  assert.equal(fields.insoleMaterial, undefined);
  assert.equal(fields.safetyCategory, undefined);
  assert.deepEqual(normalizeLightSupplyShoeDocument(result), result);
});
test('shoe rules do not change ordinary apparel or unknown identity', () => {
  for(const fileName of ['208426103215/吊牌.png','unknown/吊牌.png']) {
    const doc = {...document(),fileName};
    assert.equal(normalizeLightSupplyShoeDocument(doc), doc);
  }
});
test('shoe mapping fences supplier code and SKU evidence, keeping materials separate', async () => {
  const {buildProductArchiveAiFillOcrEvidenceFills} = await import('../../web/server/services/product-archive-hangtag-ocr.ts');
  const names=['款号','供应商款号','帮面材质','鞋底材质','鞋垫材质','颜色','尺码','执行标准','产地'];
  const fields=names.map((name,index)=>({id:index+1,field_name:name,value_text:'',options_json:[]}));
  const fills=buildProductArchiveAiFillOcrEvidenceFills({draftId:1,spuCode:'2084261412A7',documents:[document()],fields});
  const values=Object.fromEntries(fills.map(fill=>[fill.field_name,fill.field_value]));
  assert.equal(values['款号'],'2084261412A7');
  assert.equal(values['供应商款号'],'BaHF-1775');
  assert.equal(values['帮面材质'],'织物');
  assert.match(values['鞋底材质'],/EVA/);
  for(const name of ['鞋垫材质','颜色','尺码'])assert.equal(values[name],undefined);
  assert.equal(values['执行标准'],'QB/T 4552-2020；GB 30585-2024');
});
test('shoe OCR noise is not mapped as material and model supplier identity cannot replace SPU', () => {
  const result=normalizeLightSupplyShoeDocument({...document(),detectedSpuCode:'BaHF-1775',rawText:'帮面材质: we',fields:[{key:'articleNo',value:'BaHF-1775'},{key:'upperMaterial',value:'we'}]});
  assert.equal(result.detectedSpuCode,'2084261412A7');
  assert.equal(result.fields.some(field=>field.key==='upperMaterial'),false);
});
