import assert from 'node:assert/strict';
import {test} from 'node:test';
import {businessCategoryMapping} from '../../web/server/services/pre-publish/business-category-mappings.ts';
import {publishSupplierCode} from '../../web/server/services/pre-publish/drafts.ts';
import {parseAssociatedRules,associatedAttributeErrors} from '../../web/server/services/pre-publish/associated-attributes.ts';

test('business mapping handles neutral shoes, rejects ambiguous garments and unknown gender',()=>{
 assert.equal(businessCategoryMapping({middle_class_name:'休闲鞋',subclass_name:'板鞋',gender_name:'中性'})?.category_id,2070);
 assert.equal(businessCategoryMapping({middle_class_name:'长袖T恤',subclass_name:'圆V领长袖T恤',gender_name:'女',age_group_name:'大童'})?.category_id,2013);
 assert.equal(businessCategoryMapping({middle_class_name:'长袖T恤',subclass_name:'圆V领长袖T恤',gender_name:'中性',age_group_name:'大童'})?.status,'NEEDS_REVIEW');
 assert.equal(businessCategoryMapping({middle_class_name:'便服',subclass_name:'针织便服',gender_name:'女',age_group_name:'大童'})?.status,'NEEDS_REVIEW');
 assert.equal(businessCategoryMapping({spu_code:'208326100108',gender_name:'女',age_group_name:'大童'})?.status,'NEEDS_REVIEW');
});
test('publish units have stable distinct supplier codes while retaining original identity',()=>{
 const base={spu_code:'208426107201'};
 assert.equal(publishSupplierCode({...base,id:9,publish_unit_no:'default'}),base.spu_code);
 assert.equal(publishSupplierCode({...base,id:10,publish_unit_no:'draft-001'}),base.spu_code);
 assert.equal(publishSupplierCode({...base,id:11,publish_unit_no:'draft-002'}),'208426107201-L11');
 assert.notEqual(publishSupplierCode({...base,id:11,publish_unit_no:'draft-002'}),publishSupplierCode({...base,id:12,publish_unit_no:'draft-003'}));
});
test('associated rules enforce union of allowed and prefill values, missing field and invalid selection',()=>{
 const rules=parseAssociatedRules({code:'0',info:{data:[{group_id:'listing',link_rule_attribute_list:[{attribute_id:67,attribute_value_list:[1,2],attribute_value_pre_fill_list:[2,3]}]}]}},'listing');
 assert.deepEqual(rules,[{attribute_id:67,allowed_value_ids:[1,2,3]}]);
 assert.equal(associatedAttributeErrors(rules,[],()=> '填充物').length,1);
 assert.equal(associatedAttributeErrors(rules,[{attribute_id:67,attribute_value_id:3}],()=> '填充物').length,0);
 assert.equal(associatedAttributeErrors(rules,[{attribute_id:67,attribute_value_id:4}],()=> '填充物').length,1);
 assert.throws(()=>parseAssociatedRules({code:'0',info:{data:[]}},'listing'));
 assert.throws(()=>parseAssociatedRules({code:'401'},'listing'));
 assert.deepEqual(parseAssociatedRules({code:'0',info:{data:[{group_id:'listing',link_rule_attribute_list:[]}]}},'listing'),[]);
});

test('split publish scope allows disjoint SKCs and fences overlapping unknown/review tasks',async()=>{
 const {assertPublishScopeAvailable}=await import('../../web/server/routes/pre-publish.ts');
 const a={id:1,spu_code:'STYLE',publish_unit_no:'draft-001',status:'APPROVED'};
 const b={id:2,spu_code:'STYLE',publish_unit_no:'draft-002',status:'DRAFT'};
 let overlap=false;
 const db={prepare(sql){
   if(sql.includes('listing_publish_task'))return {get(){return null}};
   if(sql.includes('listing_skc'))return {all(id){return [{skc_code:id===1||overlap?'SKC-A':'SKC-B'}]}};
   throw Error('unexpected SQL');
 }};
 assert.doesNotThrow(()=>assertPublishScopeAvailable(db,b,{siblings:[a,b],activeTasks:[]}));
 overlap=true;
 assert.throws(()=>assertPublishScopeAvailable(db,b,{siblings:[a,b],activeTasks:[]}),/SKC/);
 assert.throws(()=>assertPublishScopeAvailable(db,b,{siblings:[{...a,status:'DRAFT'},b],activeTasks:[{listing_id:1,status:'PUBLISH_RESULT_UNKNOWN'}]}),/未解决/);
 overlap=false;
 assert.doesNotThrow(()=>assertPublishScopeAvailable(db,b,{siblings:[{...a,status:'DRAFT'},b],activeTasks:[{listing_id:1,status:'PUBLISH_RESULT_UNKNOWN'}]}));
});
