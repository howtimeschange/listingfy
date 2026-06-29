-- postgres-only schema revision: persists async launch-plan import jobs for large uploads.

create table if not exists listing_launch_plan_import_job (
  id text primary key,
  status text not null default 'queued',
  title text not null,
  total_count integer not null default 4,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  payload_json jsonb not null default '{}'::jsonb,
  actor_json jsonb not null default '{}'::jsonb,
  items_json jsonb not null default '[]'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  file_name text,
  file_size_bytes bigint not null default 0,
  file_path text,
  error_message text,
  started_at text,
  finished_at text,
  created_at text not null,
  updated_at text not null,
  check(status in ('queued', 'running', 'completed'))
);

create index if not exists idx_listing_launch_plan_import_job_status
  on listing_launch_plan_import_job(status, created_at);
