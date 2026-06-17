-- postgres-only schema revision: persists SHEIN category AI suggestion jobs for stable polling.

create table if not exists category_ai_suggestion_job (
  id text primary key,
  status text not null default 'queued',
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  limit_count integer not null default 30,
  requested_spu_codes_json jsonb not null default '[]'::jsonb,
  refreshed_spu_codes_json jsonb not null default '[]'::jsonb,
  items_json jsonb not null default '[]'::jsonb,
  groups_json jsonb not null default '[]'::jsonb,
  candidates_json jsonb not null default '[]'::jsonb,
  suggestions_json jsonb not null default '[]'::jsonb,
  provider_json jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status in ('queued', 'running', 'completed'))
);

create index if not exists idx_category_ai_suggestion_job_status
  on category_ai_suggestion_job(status, created_at);
