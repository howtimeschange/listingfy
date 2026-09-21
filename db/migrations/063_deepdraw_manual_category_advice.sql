-- postgres-only: explicit recommendation exposure and adoption are separate
-- from passive shadow outcome inference.
create table deepdraw_category_manual_request (
  id text primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  requested_by bigint not null,
  tenant_name text not null,
  merchant_id text not null,
  status text not null check(status in ('running','ready','unavailable','failed','stale','applied')),
  state_hash text,
  input_hash text,
  candidate_hash text,
  candidates_json jsonb not null default '[]',
  primary_trade_id text,
  applied_trade_id text,
  error_code text,
  shown_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index deepdraw_category_manual_request_draft on deepdraw_category_manual_request(draft_id,created_at);
alter table deepdraw_category_advice_observation add column trigger_type text not null default 'shadow' check(trigger_type in ('shadow','manual'));
alter table deepdraw_category_advice_observation add column manual_request_id text references deepdraw_category_manual_request(id);
create unique index deepdraw_category_advice_manual_request on deepdraw_category_advice_observation(manual_request_id) where manual_request_id is not null;

create or replace view deepdraw_category_advice_outcomes as
select o.draft_id,o.cache_key,o.input_hash,o.candidate_hash,o.source_json,o.rule_json,o.advice_json,o.created_at,
  d.spu_code,d.tenant_name,d.merchant_id,d.status as draft_status,d.trade_id as current_trade_id,
  o.rule_json #>> '{recommendedTrade,tradeId}' as rule_trade_id,
  nullif(o.advice_json->>'choice','NEEDS_REVIEW') as jev_trade_id,
  coalesce(h.modification_count,0) as human_modification_count,h.last_event_at,
  (o.rule_json #>> '{recommendedTrade,tradeId}') is distinct from (o.advice_json->>'choice') as recommendations_differ,
  coalesce(h.modified_to_jev,false) as human_ever_modified_to_jev,
  (coalesce(h.modification_count,0)>0 and d.trade_id::text=o.advice_json->>'choice') as human_final_matches_jev
from deepdraw_category_advice_observation o join product_archive_draft d on d.id=o.draft_id
left join lateral (
  select count(*) filter(where e.changed) as modification_count,max(e.created_at) as last_event_at,
    bool_or(e.changed and e.to_trade_id=o.advice_json->>'choice') as modified_to_jev
  from deepdraw_category_human_event e where e.draft_id=o.draft_id and e.created_at>=o.created_at
) h on true where o.trigger_type='shadow';

create view deepdraw_category_manual_metrics as
select tenant_name,merchant_id,count(*) as requested_count,
  count(*) filter(where shown_at is not null) as shown_count,
  count(*) filter(where applied_at is not null) as accepted_count,
  count(*) filter(where applied_at is not null and applied_trade_id=primary_trade_id) as primary_accepted_count,
  count(*) filter(where status='stale') as stale_count,
  count(*) filter(where status='failed') as failed_count,
  count(distinct draft_id) filter(where shown_at is not null) as shown_drafts,
  count(distinct draft_id) filter(where applied_at is not null) as accepted_drafts,
  count(*) filter(where applied_at is not null)::numeric/nullif(count(*) filter(where shown_at is not null),0) as adoption_rate
from deepdraw_category_manual_request group by tenant_name,merchant_id;
