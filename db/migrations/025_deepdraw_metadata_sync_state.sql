-- postgres-only schema revision: persists DeepDraw metadata sync jobs and field sync markers.

create table if not exists deepdraw_trade_field_sync_marker (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text not null,
  sync_type text not null default 'fields',
  sync_status text not null,
  field_count integer not null default 0,
  error_message text,
  request_id text,
  raw_summary_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, trade_id, sync_type),
  check(sync_type in ('fields')),
  check(sync_status in ('success', 'zero_fields', 'failed'))
);

create index if not exists idx_deepdraw_trade_field_sync_marker_status
  on deepdraw_trade_field_sync_marker(tenant_name, merchant_id, sync_status, synced_at desc);

create table if not exists deepdraw_metadata_sync_job (
  id text primary key,
  tenant_name text not null,
  field_concurrency integer not null default 8,
  field_retry_count integer not null default 2,
  status text not null default 'queued',
  total_count integer not null default 0,
  completed_count integer not null default 0,
  field_count integer not null default 0,
  zero_field_count integer not null default 0,
  failed_trade_count integer not null default 0,
  summary_json jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists idx_deepdraw_metadata_sync_job_status
  on deepdraw_metadata_sync_job(status, created_at);

with leaf_trades as (
  select trade.tenant_name,
    trade.merchant_id,
    trade.trade_id,
    coalesce(field_counts.field_count, 0) as field_count,
    greatest(
      trade.synced_at,
      coalesce(field_counts.synced_at, trade.synced_at)
    ) as synced_at
  from deepdraw_trade_cache trade
  left join (
    select tenant_name,
      merchant_id,
      trade_id,
      count(*)::integer as field_count,
      max(synced_at) as synced_at
    from deepdraw_trade_field_cache
    group by tenant_name, merchant_id, trade_id
  ) field_counts
    on field_counts.tenant_name = trade.tenant_name
    and field_counts.merchant_id = trade.merchant_id
    and field_counts.trade_id = trade.trade_id
  where not exists (
    select 1
    from deepdraw_trade_cache child
    where child.tenant_name = trade.tenant_name
      and child.merchant_id = trade.merchant_id
      and child.parent_trade_id = trade.trade_id
  )
)
insert into deepdraw_trade_field_sync_marker (
  tenant_name,
  merchant_id,
  trade_id,
  sync_type,
  sync_status,
  field_count,
  raw_summary_json,
  synced_at,
  updated_at
)
select tenant_name,
  merchant_id,
  trade_id,
  'fields',
  case when field_count > 0 then 'success' else 'zero_fields' end,
  field_count,
  jsonb_build_object('backfilled', true, 'fieldCount', field_count),
  synced_at,
  synced_at
from leaf_trades
on conflict (tenant_name, merchant_id, trade_id, sync_type) do update set
  sync_status = excluded.sync_status,
  field_count = excluded.field_count,
  raw_summary_json = excluded.raw_summary_json,
  synced_at = excluded.synced_at,
  updated_at = excluded.updated_at;
