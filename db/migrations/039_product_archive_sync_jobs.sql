-- postgres-only
create table if not exists product_archive_sync_job (
  id text primary key,
  queue_name text not null,
  source text not null,
  status text not null default 'queued',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_archive_sync_job_status_check
    check (status in ('queued', 'running', 'completed'))
);

create index if not exists idx_product_archive_sync_job_queue_status
  on product_archive_sync_job(queue_name, status, created_at);
