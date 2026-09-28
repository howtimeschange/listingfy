import assert from "node:assert/strict";
import test from "node:test";
import {normalizeShoeSizeChartImportRows} from "../../web/server/services/shoe-size-charts.ts";
import {buildShoeSizeChartFieldValues,buildShoeSizeRemarks,resolveShoeSizeChartMatch} from "../../web/server/services/shoe-size-chart-matching.ts";
import {buildDeepdrawSdkProductInput,buildDeepdrawProductFullUpdateInput,selectDeepdrawLegacyShoeCreateFields,selectDeepdrawLegacyShoeUpdateFields} from "./deepdraw_sdk_adapter.mjs";

const matrix = [
  ["岁段","参考年龄段","参考阶段","号码","号码",null,null,"脚长（鞋号）（+/-2mm)","脚长（鞋号）（+/-2cm)","适合脚长(cm)"],
  [null,null,null,null,null,"中国码","美码",null,null,null,"运动鞋/休闲鞋/婴童鞋/其他",null,null,null,null,"凉鞋"],
  [null,null,null,null,null,null,null,null,null,null,"楦底样长(内长）(mm)","楦底样长(内长）(cm)","脚长内长上新","抖音","唯品/拼多多/小红书","楦底样长(内长）(mm)","楦底样长(内长）(cm)","脚长内长上新","抖音","唯品/拼多多/小红书"],
  ["中小童（一段）","5岁","幼儿园中班",28,"28码",175,"11C",173.5,17.35,"17-17.7",183,18.3,"(脚长17-17.7/内长18.3)","脚长17-17.7/内长18.3","28码(脚长17-17.7/内长18.3)",178,17.8,"(脚长17-17.7/内长17.8)","脚长17-17.7/内长17.8","28码(脚长17-17.7/内长17.8)"],
  [null,"13岁","初一",41,"41码"],
  [null,"14岁","初二",42,"42码"],
];
const sourceRows=matrix.map(row=>Object.fromEntries(row.map((v,i)=>[`Column ${i+1}`,v])));

test("two category workbook imports both blocks without mixing inner lengths or inventing 41/42",()=>{
  const parsed=normalizeShoeSizeChartImportRows(sourceRows);
  assert.deepEqual(parsed.errors,[]);
  assert.equal(parsed.duplicateCount,0);
  assert.deepEqual(parsed.rows.map(r=>[r.chartCode,r.sizeValue,r.innerLengthMm,r.chinaSize,r.usSize,r.footRangeCm]),[
    ["sport_leisure",28,183,"175","11C","17-17.7"],
    ["sandal",28,178,"175","11C","17-17.7"],
  ]);
  assert.equal(parsed.rows[1].videoPddVipMappingText,"28码(脚长17-17.7/内长17.8)");
});

test("unified sandal data reaches every chart and SDK create/follow-up/full update",()=>{
  const row={size_value:28,foot_length_mm:173.5,inner_length_mm:178,foot_length_tolerance_mm:2,china_size:"175",us_size:"11C",foot_range_cm:"17-17.7",general_mapping_text:"(脚长17-17.7/内长17.8)",douyin_mapping_text:"脚长17-17.7/内长17.8",video_pdd_vip_mapping_text:"28码(脚长17-17.7/内长17.8)"};
  const fieldTemplates=[
    {fieldName:"尺码表",options:["脚长","鞋内长"]},
    {fieldName:"唯品会尺码表",options:["欧洲码","脚长","鞋内长","美国码","中国码"]},
    {fieldName:"天猫尺码表",options:["脚长","鞋内长"]},
    {fieldName:"抖音尺码表",options:["脚长(cm)","备注"]},
    {fieldName:"多平台尺码",options:["京东","拼多多","小红书"]},
    {fieldName:"25鞋子尺码表",options:["凉鞋","包头凉鞋","镂空凉鞋"]},
  ];
  const values=buildShoeSizeChartFieldValues({rows:[row],skuSizes:["28","41","42"],fieldTemplates,match:resolveShoeSizeChartMatch({tradeId:"537",sandalClassification:"中空凉鞋"})});
  assert.equal(values["尺码表"].valueJson["28码"],"17.35,17.8");
  assert.equal(values["唯品会尺码表"].valueJson["28码"],"28,173.5,178,11C,175");
  assert.equal(values["天猫尺码表"].valueJson["28"],"17.35,17.8");
  assert.equal(values["抖音尺码表"].valueJson["28"],"17.35,脚长17-17.7/内长17.8");
  assert.equal(values["25鞋子尺码表"].valueText,"凉鞋");
  assert.equal(values["尺码表"].valueJson["41码"],undefined);
  const fields=Object.entries(values).map(([name,v])=>({name,fieldType:Object.keys(v.valueJson).length?"MULTI_TEXT":"SINGLE_CHOICE",value:Object.keys(v.valueJson).length?v.valueJson:v.valueText}));
  const payload={shoeSizes:true,includeMultiPlatformSizeField:true,withSizeRemarks:true,code:"local-sandal-test",sizeRemarks:buildShoeSizeRemarks({rows:[row],skuSizes:["28"]}),skus:[{size:"28",color:"蓝色"}],fields:selectDeepdrawLegacyShoeCreateFields(fields),legacyUpdateFields:selectDeepdrawLegacyShoeUpdateFields(fields,{includeMultiPlatformSizeField:true})};
  const create=buildDeepdrawSdkProductInput({config:{},payload}).product;
  const update=buildDeepdrawProductFullUpdateInput({config:{},productId:"1",payload}).product;
  assert.deepEqual(update.fields["尺码表"],create.fields["尺码表"]);
  assert.deepEqual(update.fields["唯品会尺码表"],values["唯品会尺码表"].valueJson);
  assert.deepEqual(update.fields["多平台尺码"],create.fields["多平台尺码"]);
  assert.equal(update.fields["多平台尺码"]["28码"],"28,28码(脚长17-17.7/内长17.8),28码(脚长17-17.7/内长17.8)");
  assert.equal(payload.sizeRemarks["28"],"(脚长17-17.7/内长17.8)");
});
