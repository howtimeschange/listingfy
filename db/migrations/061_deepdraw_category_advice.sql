-- Shadow results are isolated from draft trade selections.
create table if not exists deepdraw_category_advice_cache (
  cache_key text primary key,
  status text not null check (status in ('running','complete','failed')),
  lease_until timestamptz not null,
  result_json jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists deepdraw_category_advice_observation (
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  cache_key text not null,
  input_hash text not null,
  candidate_hash text not null,
  source_json jsonb not null,
  rule_json jsonb not null,
  advice_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (draft_id, cache_key)
);

create table if not exists deepdraw_category_human_event (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  from_trade_id text,
  to_trade_id text,
  selection_status text not null,
  changed boolean not null,
  decision_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists deepdraw_category_human_event_draft_time
  on deepdraw_category_human_event(draft_id, created_at, id);

-- Capture confirmations and adjustments inside the same transaction as the change.
create or replace function record_deepdraw_category_human_event() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.source_snapshot_json #>> '{tradeSelection,status}' in ('human_confirmed','human_adjusted') then
      insert into deepdraw_category_human_event
        (draft_id,from_trade_id,to_trade_id,selection_status,changed,decision_json)
      values (new.id,new.source_snapshot_json #>> '{tradeSelection,recommendedTrade,tradeId}',new.trade_id,
        new.source_snapshot_json #>> '{tradeSelection,status}',
        new.trade_id::text is distinct from new.source_snapshot_json #>> '{tradeSelection,recommendedTrade,tradeId}',
        new.source_snapshot_json->'tradeSelection');
    end if;
    return new;
  end if;
  if new.source_snapshot_json #>> '{tradeSelection,status}' in ('human_confirmed','human_adjusted')
    and (new.trade_id is distinct from old.trade_id
      or new.source_snapshot_json #>> '{tradeSelection,confirmedAt}' is distinct from old.source_snapshot_json #>> '{tradeSelection,confirmedAt}') then
    insert into deepdraw_category_human_event
      (draft_id,from_trade_id,to_trade_id,selection_status,changed,decision_json)
    values (new.id,old.trade_id,new.trade_id,new.source_snapshot_json #>> '{tradeSelection,status}',
      new.trade_id is distinct from old.trade_id,new.source_snapshot_json->'tradeSelection');
  end if;
  return new;
end $$;
drop trigger if exists deepdraw_category_human_event_trigger on product_archive_draft;
create trigger deepdraw_category_human_event_trigger after insert or update of trade_id,source_snapshot_json
  on product_archive_draft for each row execute function record_deepdraw_category_human_event();

-- Historical observations remain immutable. Consumers must only compare outcomes
-- occurring after the observation, and distinguish unprocessed drafts.
create or replace view deepdraw_category_advice_outcomes as
select o.*, d.spu_code, d.tenant_name, d.merchant_id, d.status as draft_status,
  d.trade_id as current_trade_id,
  o.rule_json #>> '{recommendedTrade,tradeId}' as rule_trade_id,
  nullif(o.advice_json->>'choice','NEEDS_REVIEW') as jev_trade_id,
  coalesce(h.modification_count,0) as human_modification_count,
  h.last_event_at,
  (o.rule_json #>> '{recommendedTrade,tradeId}') is distinct from (o.advice_json->>'choice') as recommendations_differ,
  coalesce(h.modified_to_jev,false) as human_ever_modified_to_jev,
  (coalesce(h.modification_count,0)>0 and d.trade_id::text=o.advice_json->>'choice') as human_final_matches_jev
from deepdraw_category_advice_observation o
join product_archive_draft d on d.id=o.draft_id
left join lateral (
  select count(*) filter(where e.changed) as modification_count, max(e.created_at) as last_event_at,
    bool_or(e.changed and e.to_trade_id=o.advice_json->>'choice') as modified_to_jev
  from deepdraw_category_human_event e
  where e.draft_id=o.draft_id and e.created_at>=o.created_at
) h on true;

create or replace view deepdraw_category_advice_latest_outcomes as
select distinct on (draft_id) * from deepdraw_category_advice_outcomes
order by draft_id, created_at desc, cache_key;

create or replace view deepdraw_category_advice_metrics as
select tenant_name, merchant_id,
  count(*) as observed_drafts,
  count(*) filter(where jev_trade_id is not null) as jev_recommended_drafts,
  count(*) filter(where jev_trade_id is not null and rule_trade_id is not null and recommendations_differ) as differing_recommendations,
  count(*) filter(where last_event_at is not null or draft_status in ('created','readback_verified')) as processed_drafts,
  count(*) filter(where rule_trade_id is not null and (last_event_at is not null or draft_status in ('created','readback_verified'))) as rule_adoption_denominator,
  count(*) filter(where rule_trade_id is not null and human_modification_count=0 and current_trade_id::text=rule_trade_id
    and (last_event_at is not null or draft_status in ('created','readback_verified'))) as rule_accepted_without_modification,
  count(*) filter(where jev_trade_id is not null and rule_trade_id is not null and recommendations_differ and human_modification_count>0) as modified_differing_denominator,
  count(*) filter(where jev_trade_id is not null and rule_trade_id is not null and recommendations_differ and human_ever_modified_to_jev) as modified_to_jev_ever,
  count(*) filter(where jev_trade_id is not null and rule_trade_id is not null and recommendations_differ and human_final_matches_jev) as modified_to_jev_final,
  sum(human_modification_count) as human_modifications
from deepdraw_category_advice_latest_outcomes group by tenant_name,merchant_id;
