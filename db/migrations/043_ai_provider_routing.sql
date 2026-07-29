-- postgres-only schema revision: persist AI routing audit, health, and paid usage.

create table if not exists ai_invocation_audit (
  id bigserial primary key,
  scenario text not null,
  mode text not null,
  role text not null,
  provider_key text not null,
  model text not null,
  status text not null,
  http_status integer,
  latency_ms integer not null default 0,
  transport_attempts integer not null default 1,
  prompt_version text,
  input_hash text,
  candidate_hash text,
  fallback_reason text,
  error_code text,
  result_json jsonb not null default '{}'::jsonb,
  usage_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_ai_invocation_audit_scene_created
  on ai_invocation_audit(scenario, created_at desc);

create index if not exists idx_ai_invocation_audit_model_created
  on ai_invocation_audit(provider_key, model, created_at desc);

create table if not exists ai_model_runtime_state (
  provider_key text not null,
  model text not null,
  status text not null,
  blocked_until timestamptz,
  failure_count integer not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (provider_key, model)
);

create table if not exists ai_provider_daily_usage (
  usage_date date not null,
  provider_key text not null,
  request_count bigint not null default 0,
  total_tokens bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (usage_date, provider_key)
);
