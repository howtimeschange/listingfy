-- Persists SHEIN platform product background jobs so polling works across API workers.

create table if not exists shein_platform_product_job (
  id text primary key,
  job_type text not null,
  status text not null default 'queued',
  title text not null,
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  payload_json text not null default '{}',
  actor_json text not null default '{}',
  items_json text not null default '[]',
  file_name text,
  file_path text,
  download_url text,
  error_message text,
  started_at text,
  finished_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(job_type in ('sync', 'export')),
  check(status in ('queued', 'running', 'completed'))
);

create index if not exists idx_shein_platform_product_job_status
  on shein_platform_product_job(job_type, status, created_at);
