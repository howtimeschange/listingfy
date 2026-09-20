import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShoeSizeChartFieldValues, buildShoeSizeRemarks, resolveShoeSizeChartMatch } from '../../web/server/services/shoe-size-chart-matching.ts';
import { normalizeShoeSizeChartImportRows } from '../../web/server/services/shoe-size-charts.ts';
import { buildDeepdrawSdkProductInput, buildDeepdrawProductFullUpdateInput, selectDeepdrawLegacyShoeCreateFields, selectDeepdrawLegacyShoeUpdateFields, deepdrawLegacyShoePostCreateUpdateRequired } from './deepdraw_sdk_adapter.mjs';

const row = { size_value: 28, foot_length_mm: 173.5, foot_length_tolerance_mm: 2, inner_length_mm: 183,
  china_size: '175', us_size: '11C', foot_range_cm: '17-17.7',
  general_mapping_text: '(脚长17-17.7/内长18.3)', douyin_mapping_text: '脚长17-17.7/内长18.3',
  video_pdd_vip_mapping_text: '28码(脚长17-17.7/内长18.3)' };
const fieldTemplates = [
  {fieldName:'尺码表',options:['脚长','鞋内长']},
  {fieldName:'唯品会尺码表',options:['欧洲码','脚长','鞋内长','美国码','中国码']},
  {fieldName:'天猫尺码表',options:['脚长','鞋内长']},
  {fieldName:'抖音尺码表',options:['脚长(cm)','备注']},
  {fieldName:'淘宝尺码表',options:['脚长']},
  {fieldName:'多平台尺码',options:['京东','拼多多','小红书','微信视频小店']},
];

test('2026 shoe values survive create follow-up and covering update SDK construction', () => {
  const values=buildShoeSizeChartFieldValues({rows:[row],skuSizes:['28码'],fieldTemplates,match:resolveShoeSizeChartMatch({tradeId:'546'})});
  assert.deepEqual(values['唯品会尺码表'].valueJson,{title:'欧洲码,脚长,鞋内长,美国码,中国码','28码':'28,173.5,183,11C,175'});
  assert.equal(values['尺码表'].valueJson['28码'],'17.35,18.3');
  assert.equal(values['淘宝尺码表'].valueJson['28'],'17-17.7');
  assert.equal(values['抖音尺码表'].valueJson['28'],'17.35,脚长17-17.7/内长18.3');
  const sizeRemarks=buildShoeSizeRemarks({rows:[row],skuSizes:['28码']});
  assert.equal(sizeRemarks['28'],'脚长(17-17.7/内长18.3)');
  const fields=Object.entries(values).map(([name,v])=>({name,fieldType:'MULTI_TEXT',value:v.valueJson}));
  const createFields=selectDeepdrawLegacyShoeCreateFields(fields);
  const legacyUpdateFields=selectDeepdrawLegacyShoeUpdateFields(fields,{includeMultiPlatformSizeField:true});
  assert.equal(deepdrawLegacyShoePostCreateUpdateRequired(createFields,legacyUpdateFields),true);
  const payload={code:'shoe-test',shoeSizes:true,withSizeRemarks:true,includeMultiPlatformSizeField:true,sizeRemarks,fields:createFields,legacyUpdateFields,skus:[{size:'28',color:'蓝色'}]};
  const create=buildDeepdrawSdkProductInput({config:{},payload}).product;
  const update=buildDeepdrawProductFullUpdateInput({config:{},productId:'123',payload}).product;
  assert.equal(create.fields['尺码表']['28码'],'17.35,18.3');
  assert.deepEqual(update.fields['唯品会尺码表'],values['唯品会尺码表'].valueJson);
  assert.deepEqual(update.fields['多平台尺码'],create.fields['多平台尺码']);
  assert.equal(update.fields['淘宝尺码表'],undefined);
});

test('2026 three-row workbook headers import China/US codes, exact ranges and merged ages', () => {
  const matrix=[
    ['岁段','参考年龄段','参考阶段','号码','号码',null,null,'脚长（鞋号）（+/-2mm)','脚长（鞋号）（+/-2cm)','适合脚长(cm)'],
    [null,null,null,null,null,'中国码','美码',null,null,null,'运动鞋/休闲鞋/婴童鞋/其他'],
    [null,null,null,null,null,null,null,null,null,null,'楦底样长(内长）(mm)','楦底样长(内长）(cm)','脚长内长上新','抖音','唯品/拼多多/小红书'],
    ['中小童（一段）','5岁','幼儿园中班',28,'28码',175,'11C',173.5,17.35,'17-17.7',183,18.3,'(脚长17-17.7/内长18.3)','脚长17-17.7/内长18.3','28码(脚长17-17.7/内长18.3)'],
    [null,'5岁半',null,29,'29码',180,'12C',181,18.1,'17.8-18.4',190,19,'(脚长17.8-18.4/内长19)','脚长17.8-18.4/内长19','29码(脚长17.8-18.4/内长19)'],
    [null,'13岁','初一',41,'41码'],
  ];
  const result=normalizeShoeSizeChartImportRows(matrix.map(r=>Object.fromEntries(r.map((v,i)=>[`Column ${i+1}`,v]))));
  assert.deepEqual(result.errors,[]);
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[0].chinaSize,'175');
  assert.equal(result.rows[0].usSize,'11C');
  assert.equal(result.rows[0].footRangeCm,'17-17.7');
  assert.equal(result.rows[1].referenceStage,'幼儿园中班');
  assert(result.rows.every(r=>r.chartCode==='sport_leisure'));
});
