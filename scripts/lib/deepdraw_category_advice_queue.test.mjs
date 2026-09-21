import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {SyncPostgresDatabase} from './postgres_db.mjs';
import {createCategoryAdviceQueue} from './deepdraw_category_advice_queue.mjs';
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
  for(const file of ['061_deepdraw_category_advice.sql','062_deepdraw_category_advice_queue.sql'])db.exec(fs.readFileSync(new URL('../../db/migrations/'+file,import.meta.url),'utf8'));
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

test('transactional events: rollback, committed source, scoped candidates, timestamp-only refresh', {skip:!url},()=>{
 const f=fixture();try{
  assert.throws(()=>f.db.transaction(()=>{f.insert(1);throw Error('rollback');})());
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_job').get().n,0);
  f.insert(1);f.insert(2);f.db.exec("update product_archive_draft set tenant_name='other' where id=2; update deepdraw_category_advice_job set status='completed'");
  f.db.exec("insert into product_archive_source_batch values(1,'launch_plan','importing');insert into product_archive_source_row values(1,1,'launch_plan','ambiguous','{}')");
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_scope_event').get().n,0);
  f.db.exec("update product_archive_source_batch set import_status='committed'");
  assert.equal(f.db.prepare("select count(*) n from deepdraw_category_advice_scope_event where kind='source'").get().n,1);
  f.db.exec('delete from deepdraw_category_advice_scope_event');
  f.db.exec("insert into deepdraw_trade_cache values(1,'tenant','merchant','533','靴子',clock_timestamp());insert into deepdraw_trade_cache values(2,'tenant','merchant','534','雪地靴',clock_timestamp())");
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_scope_event').get().n,1);
  f.due();assert.equal(f.queue.expandOneScope(),true);
  assert.equal(f.db.prepare('select status from deepdraw_category_advice_job where draft_id=1').get().status,'queued');
  assert.equal(f.db.prepare('select status from deepdraw_category_advice_job where draft_id=2').get().status,'completed');
  f.db.exec('update deepdraw_trade_cache set updated_at=clock_timestamp()');
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_scope_event').get().n,0);
  f.db.exec("update deepdraw_trade_cache set trade_name='new';delete from deepdraw_trade_cache where id=2");
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_scope_event').get().n,1);
 }finally{f.close();}
});

test('generation and lease fencing retain in-flight events and reject stale workers', {skip:!url},()=>{
 const f=fixture();try{
  f.insert(1);f.due();const first=f.queue.claim();
  f.db.prepare("select enqueue_deepdraw_category_advice(array[1::bigint],'changed')").get();
  let applied=false;assert.equal(f.queue.finish(first,()=>{applied=true}),false);assert.equal(applied,false);
  f.due();const second=f.queue.claim();f.db.exec("update deepdraw_category_advice_job set lease_until=clock_timestamp()-interval '1 second'");
  const restarted=f.queue.claim();assert.notEqual(second.claim_token,restarted.claim_token);
  assert.equal(f.queue.finish(second,()=>{applied=true}),false);assert.equal(applied,false);
  assert.equal(f.queue.finish(restarted),true);
 }finally{f.close();}
});

test('processor bypasses clear rules, shares cache, records each generation and never applies advice', {skip:!url},async()=>{
 const f=fixture();try{
  let calls=0;const run=f.processor(async()=>{calls++;return f.response()});
  f.insert(1,'clear');f.due();await run();assert.equal(calls,0);
  f.insert(2);f.due();await run();assert.equal(calls,1);
  f.insert(3);f.due();await run();assert.equal(calls,1);
  assert.equal(f.db.prepare('select trade_id from product_archive_draft where id=2').get().trade_id,null);
  f.db.prepare("select enqueue_deepdraw_category_advice(array[2::bigint],'changed_again')").get();f.due();await run();
  assert.equal(calls,1);assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_observation where draft_id=2').get().n,2);
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_latest_outcomes').get().n,3);
 }finally{f.close();}
});

test('manual selection during request fences out the old observation', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);f.due();const run=f.processor(async()=>{
   f.db.exec(`update product_archive_draft set trade_id='534',source_snapshot_json='{"tradeSelection":{"status":"human_adjusted","confirmedAt":"now"}}' where id=1`);
   return f.response();
  });await run();
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_observation').get().n,0);
  assert.equal(f.db.prepare('select trade_id from product_archive_draft where id=1').get().trade_id,'534');
  f.due();await run();assert.equal(f.db.prepare('select status from deepdraw_category_advice_job').get().status,'completed');
 }finally{f.close();}
});

test('source changes during model request are re-read before observation, even before scope expansion', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);f.db.exec(`insert into product_archive_source_batch values(1,'launch_plan','committed');insert into product_archive_source_row values(1,1,'launch_plan','ambiguous','{"官方发布类目":"童鞋/靴子"}')`);f.due();
  const run=f.processor(async()=>{f.db.exec(`update product_archive_source_row set row_json='{"官方发布类目":"童鞋/雪地靴"}' where id=1`);return f.response()});
  // Scope expansion debounces the job; allow the queued job to become due.
  await run();f.due();await run();
  assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_observation').get().n,0);
  assert.equal(f.db.prepare('select status from deepdraw_category_advice_job').get().status,'queued');
 }finally{f.close();}
});

test('transient failures retry and become inspectable failed jobs after three attempts', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);const run=f.processor(async()=>{throw Error('typesafe_http_503')});
  for(let i=0;i<3;i++){f.due();f.db.exec("update deepdraw_category_advice_cache set lease_until=clock_timestamp()-interval '1 second'");await run();}
  const job=f.db.prepare('select * from deepdraw_category_advice_job').get();assert.equal(job.status,'failed');assert.equal(job.attempts,3);assert.equal(job.last_error_code,'typesafe_http_503');
 }finally{f.close();}
});


test('candidate changes during inference invalidate pending observation', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);f.due();let changed=false;
  const context=(db,draft)=>{const input=f.contextForDraft(db,draft);return {...input,candidates:changed?[...input.candidates,{trade_id:'534',trade_path:'童鞋/雪地靴'}]:input.candidates}};
  const run=f.processor(async()=>{changed=true;return f.response()},context);
  await run();assert.equal(f.db.prepare('select count(*) n from deepdraw_category_advice_observation').get().n,0);
  assert.equal(f.db.prepare('select status from deepdraw_category_advice_job').get().status,'queued');
 }finally{f.close();}
});

test('two workers share one in-flight request and reuse its cache', {skip:!url},async()=>{
 const f=fixture();try{
  f.insert(1);f.insert(2);f.due();let release;let calls=0;
  const pending=new Promise(resolve=>{release=resolve});
  const worker1=f.processor(async()=>{calls++;await pending;return f.response()});
  const worker2=f.processor(async()=>{calls++;return f.response()});
  const active=worker1();await worker2();assert.equal(calls,1);
  release();await active;f.due();await worker2();assert.equal(calls,1);
  assert.equal(f.db.prepare("select count(*) n from deepdraw_category_advice_job where status='completed'").get().n,2);
 }finally{f.close();}
});
