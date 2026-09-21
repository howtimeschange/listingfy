-- postgres-only: event-driven shadow work; no periodic product scan.
create table if not exists deepdraw_category_advice_job (
  draft_id bigint primary key references product_archive_draft(id) on delete cascade,
  revision bigint not null default 1,
  claimed_revision bigint,
  status text not null default 'queued' check(status in ('queued','running','completed','failed')),
  reason text not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token text,
  last_error_code text,
  updated_at timestamptz not null default now()
);
create index if not exists deepdraw_category_advice_job_due on deepdraw_category_advice_job(status,available_at,lease_until);

-- One coalesced source/tenant invalidation per scope, expanded only when changed.
create table if not exists deepdraw_category_advice_scope_event (
  kind text not null check(kind in ('source','candidates')),
  scope_key text not null,
  payload_json jsonb not null,
  available_at timestamptz not null default now(),
  primary key(kind,scope_key)
);
create index if not exists deepdraw_category_advice_scope_due on deepdraw_category_advice_scope_event(available_at);

create or replace function enqueue_deepdraw_category_advice(ids bigint[], event_reason text) returns void
language plpgsql as $$
begin
  insert into deepdraw_category_advice_job(draft_id,reason,available_at)
  select distinct d.id,event_reason,clock_timestamp()+interval '1 second'
  from product_archive_draft d where d.id=any(ids)
  on conflict(draft_id) do update set revision=deepdraw_category_advice_job.revision+1,
    reason=excluded.reason, attempts=0,
    status=case when deepdraw_category_advice_job.status='running' then 'running' else 'queued' end,
    available_at=excluded.available_at,last_error_code=null,updated_at=clock_timestamp();
end $$;

create or replace function queue_deepdraw_category_draft_change() returns trigger
language plpgsql as $$
begin
  if tg_op='INSERT' then
    perform enqueue_deepdraw_category_advice(array[new.id],'draft_created');
  elsif row(new.spu_code,new.tenant_name,new.merchant_id,new.trade_id,new.status,
      new.source_snapshot_json->'sourceRows',new.source_snapshot_json->'sourceBatchIds',new.source_snapshot_json->'sourceBatchId',
      new.source_snapshot_json #>> '{tradeSelection,status}')
    is distinct from row(old.spu_code,old.tenant_name,old.merchant_id,old.trade_id,old.status,
      old.source_snapshot_json->'sourceRows',old.source_snapshot_json->'sourceBatchIds',old.source_snapshot_json->'sourceBatchId',
      old.source_snapshot_json #>> '{tradeSelection,status}') then
    perform enqueue_deepdraw_category_advice(array[new.id],'draft_changed');
  end if;
  return new;
end $$;
create trigger deepdraw_category_draft_queue after insert or update on product_archive_draft
  for each row execute function queue_deepdraw_category_draft_change();

create or replace function queue_deepdraw_category_source_scope(spu text) returns void
language plpgsql as $$
begin
  if spu is null or spu='' then return; end if;
  insert into deepdraw_category_advice_scope_event(kind,scope_key,payload_json,available_at)
  values('source',spu,jsonb_build_object('spu',spu),clock_timestamp()+interval '2 seconds')
  on conflict(kind,scope_key) do update set payload_json=excluded.payload_json,available_at=excluded.available_at;
end $$;

create or replace function queue_deepdraw_category_source_change() returns trigger
language plpgsql as $$
declare item record;
begin
  if tg_op in ('INSERT','UPDATE') then
    for item in select distinct s.spu_code from new_source_rows s
      join product_archive_source_batch b on b.id=s.source_batch_id
      where s.source_type='launch_plan' and b.import_status='committed'
    loop perform queue_deepdraw_category_source_scope(item.spu_code); end loop;
  end if;
  if tg_op in ('DELETE','UPDATE') then
    for item in select distinct spu_code from old_source_rows where source_type='launch_plan'
    loop perform queue_deepdraw_category_source_scope(item.spu_code); end loop;
  end if;
  return null;
end $$;
create trigger deepdraw_category_source_insert after insert on product_archive_source_row
  referencing new table as new_source_rows for each statement execute function queue_deepdraw_category_source_change();
create trigger deepdraw_category_source_update after update on product_archive_source_row
  referencing old table as old_source_rows new table as new_source_rows for each statement execute function queue_deepdraw_category_source_change();
create trigger deepdraw_category_source_delete after delete on product_archive_source_row
  referencing old table as old_source_rows for each statement execute function queue_deepdraw_category_source_change();

create or replace function queue_deepdraw_category_batch_commit() returns trigger
language plpgsql as $$
declare item record;
begin
  if new.source_type='launch_plan' and (new.import_status='committed' or old.import_status='committed')
    and old.import_status is distinct from new.import_status then
    for item in select distinct spu_code from product_archive_source_row where source_batch_id=new.id
    loop perform queue_deepdraw_category_source_scope(item.spu_code); end loop;
  end if;
  return new;
end $$;
create trigger deepdraw_category_batch_commit after update of import_status on product_archive_source_batch
  for each row execute function queue_deepdraw_category_batch_commit();

create or replace function queue_deepdraw_category_candidate_change() returns trigger
language plpgsql as $$
declare item record;
begin
  if tg_op='UPDATE' then
    for item in select distinct n.tenant_name,n.merchant_id from new_candidates n join old_candidates o using(id)
      where (to_jsonb(n)-array['synced_at','updated_at','created_at']) is distinct from
        (to_jsonb(o)-array['synced_at','updated_at','created_at'])
      union
      select distinct o.tenant_name,o.merchant_id from new_candidates n join old_candidates o using(id)
      where row(n.tenant_name,n.merchant_id) is distinct from row(o.tenant_name,o.merchant_id)
    loop
      insert into deepdraw_category_advice_scope_event(kind,scope_key,payload_json,available_at)
      values('candidates',jsonb_build_array(item.tenant_name,item.merchant_id)::text,to_jsonb(item),clock_timestamp()+interval '2 seconds')
      on conflict(kind,scope_key) do update set available_at=excluded.available_at;
    end loop;
  elsif tg_op='INSERT' then
    for item in select distinct tenant_name,merchant_id from new_candidates loop
      insert into deepdraw_category_advice_scope_event(kind,scope_key,payload_json,available_at)
      values('candidates',jsonb_build_array(item.tenant_name,item.merchant_id)::text,to_jsonb(item),clock_timestamp()+interval '2 seconds')
      on conflict(kind,scope_key) do update set available_at=excluded.available_at;
    end loop;
  else
    for item in select distinct tenant_name,merchant_id from old_candidates loop
      insert into deepdraw_category_advice_scope_event(kind,scope_key,payload_json,available_at)
      values('candidates',jsonb_build_array(item.tenant_name,item.merchant_id)::text,to_jsonb(item),clock_timestamp()+interval '2 seconds')
      on conflict(kind,scope_key) do update set available_at=excluded.available_at;
    end loop;
  end if;
  return null;
end $$;
create trigger deepdraw_category_trade_insert after insert on deepdraw_trade_cache referencing new table as new_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();
create trigger deepdraw_category_trade_update after update on deepdraw_trade_cache referencing old table as old_candidates new table as new_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();
create trigger deepdraw_category_trade_delete after delete on deepdraw_trade_cache referencing old table as old_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();
create trigger deepdraw_category_field_insert after insert on deepdraw_trade_field_cache referencing new table as new_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();
create trigger deepdraw_category_field_update after update on deepdraw_trade_field_cache referencing old table as old_candidates new table as new_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();
create trigger deepdraw_category_field_delete after delete on deepdraw_trade_field_cache referencing old table as old_candidates
  for each statement execute function queue_deepdraw_category_candidate_change();

create or replace function queue_deepdraw_category_sku_change() returns trigger
language plpgsql as $$
begin
  if tg_op='INSERT' then
    perform enqueue_deepdraw_category_advice(array[new.draft_id],'sku_changed');
  elsif tg_op='DELETE' then
    perform enqueue_deepdraw_category_advice(array[old.draft_id],'sku_changed');
  elsif row(new.draft_id,new.size_name,new.size_code) is distinct from row(old.draft_id,old.size_name,old.size_code) then
    perform enqueue_deepdraw_category_advice(array[new.draft_id,old.draft_id],'sku_changed');
  end if;
  return null;
end $$;
create trigger deepdraw_category_sku_change after insert or update or delete on product_archive_draft_sku
  for each row execute function queue_deepdraw_category_sku_change();

alter table deepdraw_category_advice_cache add column if not exists claim_token text;
alter table deepdraw_category_advice_observation add column if not exists event_revision bigint not null default 0;
alter table deepdraw_category_advice_observation drop constraint deepdraw_category_advice_observation_pkey;
alter table deepdraw_category_advice_observation add primary key(draft_id,cache_key,event_revision);
