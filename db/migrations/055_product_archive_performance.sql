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
