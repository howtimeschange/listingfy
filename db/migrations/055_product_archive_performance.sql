-- postgres-only: durable product-archive workflow leases and resumable import state.

alter table listing_launch_plan_import_job
  drop constraint if exists listing_launch_plan_import_job_status_check;

alter table listing_launch_plan_import_job
  add constraint listing_launch_plan_import_job_status_check
  check (status in ('queued', 'running', 'completed', 'failed', 'cancelled'));

alter table listing_launch_plan_import_job
  add column if not exists claim_token text,
  add column if not exists claim_version bigint not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists current_stage integer not null default 0,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists error_code text;

create index if not exists idx_listing_launch_plan_import_job_lease
  on listing_launch_plan_import_job(status, lease_expires_at, created_at);

create table if not exists product_archive_workflow_job (
  id text primary key,
  status text not null default 'queued',
  title text not null,
  files_json jsonb not null default '[]'::jsonb,
  options_json jsonb not null default '{}'::jsonb,
  stages_json jsonb not null default '[]'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  claim_token text,
  claim_version bigint not null default 0,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  created_by bigint references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (status in ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

create index if not exists idx_product_archive_workflow_job_claim
  on product_archive_workflow_job(status, lease_expires_at, created_at);

create table if not exists product_archive_draft_preparation (
  draft_id bigint primary key references product_archive_draft(id) on delete cascade,
  draft_updated_at timestamptz not null,
  input_hash text not null,
  template_version text not null default '',
  submit_mode text not null,
  payload_json jsonb not null,
  validation_json jsonb not null default '{}'::jsonb,
  prepared_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  unique(draft_id, input_hash, submit_mode)
);

create index if not exists idx_product_archive_draft_preparation_expiry
  on product_archive_draft_preparation(expires_at);

create table if not exists product_archive_sync_negative_cache (
  source text not null,
  spu_code text not null,
  reason_code text not null,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(source, spu_code)
);

create index if not exists idx_product_archive_sync_negative_cache_expiry
  on product_archive_sync_negative_cache(expires_at);

create table if not exists listing_launch_plan_spu_latest (
  spu_code text primary key,
  import_id bigint not null references listing_launch_plan_import(id) on delete cascade,
  row_id bigint not null references listing_launch_plan_row(id) on delete cascade,
  sheet_name text not null,
  row_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists idx_listing_launch_plan_spu_latest_import
  on listing_launch_plan_spu_latest(import_id desc, spu_code);

create table if not exists listing_launch_plan_import_sheet_stat (
  import_id bigint not null references listing_launch_plan_import(id) on delete cascade,
  sheet_name text not null,
  row_count integer not null default 0,
  spu_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(import_id, sheet_name)
);
