import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {SyncPostgresDatabase} from './postgres_db.mjs';
import {createCategoryAdviceQueue} from './deepdraw_category_advice_queue.mjs';
import {createManualCategoryAdviceService} from '../../web/server/services/deepdraw-manual-category-advice.ts';
import {createCategoryAdviceProcessor} from '../../web/server/services/deepdraw-category-advice.ts';

const url=process.env.LISTINGIFY_TEST_DATABASE_URL;
function fixture() {
  const db=new SyncPostgresDatabase(url);
  const schema='jev_test_'+randomUUID().replaceAll('-','');
  try { db.exec(`create schema ${schema}; set search_path=${schema};
    create table product_archive_draft(id bigint primary key,trade_id text,source_snapshot_json jsonb default '{}',spu_code text,tenant_name text default 'tenant',merchant_id text default 'merchant',status text default 'draft');
    create table product_archive_source_batch(id bigint primary key,source_type text,import_status text);
    create table product_archive_source_row(id bigint primary key,source_batch_id bigint,source_type text,spu_code text,row_json jsonb);
    create table deepdraw_trade_cache(id bigint primary key,tenant_name text,merchant_id text,trade_id text,trade_name text,updated_at timestamptz);
    create table deepdraw_trade_field_cache(id bigint primary key,tenant_name text,merchant_id text,trade_id text,trade_name text,updated_at timestamptz);
    create table product_archive_draft_sku(id bigint primary key,draft_id bigint,size_name text,size_code text);`);
  for(const file of ['061_deepdraw_category_advice.sql','062_deepdraw_category_advice_queue.sql','063_deepdraw_manual_category_advice.sql'])db.exec(fs.readFileSync(new URL('../../db/migrations/'+file,import.meta.url),'utf8'));
  } catch(error) {db.exec(`set search_path=public;drop schema if exists ${schema} cascade`);db.close();throw error;}
  const queue=createCategoryAdviceQueue(db);
  const due=()=>db.exec("update deepdraw_category_advice_job set available_at=clock_timestamp()-interval '1 second'; update deepdraw_category_advice_scope_event set available_at=clock_timestamp()-interval '1 second'");
  const insert=(id,spu='ambiguous')=>db.prepare('insert into product_archive_draft(id,spu_code) values(?,?)').run(id,spu);
  const contextForDraft=(database,draft)=>({
    sourceRows:database.prepare('select * from product_archive_source_row where spu_code=?').all(draft.spu_code).length
      ? database.prepare('select * from product_archive_source_row where spu_code=?').all(draft.spu_code)
      : [{id:1,source_type:'launch_plan',source_batch_id:1,row_json:{官方发布类目:'童鞋/靴子',性别:'女'}}],
    decision:{status:draft.spu_code==='clear'?'auto_applied':'manual_selection_required',reasonCode:draft.spu_code==='clear'?'unique_high_confidence':'ambiguous_match',recommendedTrade:draft.spu_code==='clear'?{tradeId:'533',tradePath:'童鞋/靴子'}:null},
    candidates:[{trade_id:'533',trade_path:'童鞋/靴子'}],tenantName:draft.tenant_name,merchantId:draft.merchant_id,
  });
  const response=()=>({answer:{choice:'533',confidence:.9,probabilities:{533:.9,NEEDS_REVIEW:.1}},usage:{},latencyMs:1,transportAttempts:1});
  const processor=(requestAdvice=async()=>response(),contextOverride=contextForDraft)=>createCategoryAdviceProcessor({db,contextForDraft:contextOverride,requestAdvice,audit:()=>{}});
  return {db,queue,due,insert,processor,response,contextForDraft,close(){db.exec(`set search_path=public;drop schema ${schema} cascade`);db.close();}};
}

function service(f, overrides={}) {
 return createManualCategoryAdviceService({db:f.db,enabled:true,contextForDraft:f.contextForDraft,
 requestAdvice:async()=>f.response(),audit:()=>{},applyTrade:(db,id,{tradeId})=>{
 db.prepare("update product_archive_draft set trade_id=?,source_snapshot_json=?::jsonb where id=?").run(tradeId,JSON.stringify({tradeSelection:{status:'human_adjusted',confirmedAt:new Date().toISOString()}}),id);
 },...overrides});
}
test('manual overrides clear rules; request/show never apply; explicit confirmation and retry count once', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1,'clear');let calls=0;const s=service(f,{requestAdvice:async()=>{calls++;return f.response()}});
  const id=randomUUID(),r=await s.recommend(1,7,id);
  assert.equal(calls,1);assert.equal(r.candidates[0].tradeId,'533');
  assert.equal(f.db.prepare('select trade_id from product_archive_draft where id=1').get().trade_id,null);
  let m=f.db.prepare('select * from deepdraw_category_manual_metrics').get();
  assert.equal(m.requested_count,1);assert.equal(m.shown_count,0);assert.equal(m.accepted_count,0);
  s.shown(1,7,id);s.shown(1,7,id);
  m=f.db.prepare('select * from deepdraw_category_manual_metrics').get();assert.equal(m.shown_count,1);assert.equal(m.accepted_count,0);
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_outcomes').get().n,0);
  s.apply(1,7,id,'533');s.apply(1,7,id,'533');
  m=f.db.prepare('select * from deepdraw_category_manual_metrics').get();assert.equal(m.accepted_count,1);assert.equal(m.primary_accepted_count,1);
  assert.equal(f.db.prepare('select trade_id from product_archive_draft where id=1').get().trade_id,'533');
  await s.recommend(1,7,randomUUID());assert.equal(calls,1);
  assert.equal(f.db.prepare("select count(*) n from deepdraw_category_advice_observation where trigger_type='manual'").get().n,2);
 }finally{f.close();}
});
test('ownership, arbitrary candidates, expired inputs and changed manual selection are rejected', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);const s=service(f),id=randomUUID();await s.recommend(1,7,id);
  assert.throws(()=>s.shown(1,8,id),e=>e.status===403);
  assert.throws(()=>s.apply(1,8,id,'533'),e=>e.status===403);
  assert.throws(()=>s.apply(1,7,id,'unknown'),e=>e.status===400);
  assert.equal(f.db.prepare('select status from deepdraw_category_manual_request where id=?').get(id).status,'ready');
  f.db.exec("update product_archive_draft set trade_id='other' where id=1");
  assert.throws(()=>s.apply(1,7,id,'533'),e=>e.stale);
  assert.equal(f.db.prepare('select status from deepdraw_category_manual_request where id=?').get(id).status,'stale');
  const expired=randomUUID();await s.recommend(1,7,expired);
  f.db.prepare("update deepdraw_category_manual_request set created_at=clock_timestamp()-interval '31 minutes' where id=?").run(expired);
  assert.throws(()=>s.apply(1,7,expired,'533'),e=>e.stale);
  assert.equal(f.db.prepare('select accepted_count from deepdraw_category_manual_metrics').get().accepted_count,0);
 }finally{f.close();}
});
test('failed apply rolls back category and adoption; changed candidates cannot apply', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);let changed=false;const s=service(f,{contextForDraft:(...a)=>({...f.contextForDraft(...a),candidates:changed?[]:f.contextForDraft(...a).candidates}),applyTrade:(db)=>{
   db.exec("update product_archive_draft set trade_id='533' where id=1");throw Error('field rebuild failed');
  }});const id=randomUUID();await s.recommend(1,7,id);
  assert.throws(()=>s.apply(1,7,id,'533'),/field rebuild failed/);
  assert.equal(f.db.prepare('select trade_id from product_archive_draft where id=1').get().trade_id,null);
  assert.equal(f.db.prepare('select accepted_count from deepdraw_category_manual_metrics').get().accepted_count,0);
  changed=true;assert.throws(()=>s.apply(1,7,id,'533'),e=>e.stale);
 }finally{f.close();}
});
test('source change during request is stale; NEEDS_REVIEW is not exposed or adopted', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);let changed=false;const s=service(f,{contextForDraft:(...a)=>({...f.contextForDraft(...a),candidates:changed?[]:f.contextForDraft(...a).candidates}),requestAdvice:async()=>{changed=true;return f.response()}});
  const id=randomUUID();await assert.rejects(s.recommend(1,7,id),e=>e.stale);
  assert.equal(f.db.prepare('select status from deepdraw_category_manual_request where id=?').get(id).status,'stale');
  f.db.exec('delete from deepdraw_category_advice_cache');
  const other=service(f,{requestAdvice:async()=>({...f.response(),answer:{choice:'NEEDS_REVIEW',probabilities:{NEEDS_REVIEW:1}}})});
  const id2=randomUUID();const r=await other.recommend(1,7,id2);assert.equal(r.candidates.length,0);other.shown(1,7,id2);
  assert.equal(f.db.prepare('select shown_count from deepdraw_category_manual_metrics').get().shown_count,0);
 }finally{f.close();}
});
