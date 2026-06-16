-- postgres-only schema revision: creates PostgreSQL tables/permissions for DeepDraw archives.
-- This is not a database-engine migration; legacy SQLite test helpers skip postgres-only files.

create table if not exists deepdraw_trade_cache (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text not null,
  parent_trade_id text,
  trade_name text not null,
  trade_path text,
  raw_payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, trade_id)
);

create index if not exists idx_deepdraw_trade_cache_tenant_path
  on deepdraw_trade_cache(tenant_name, merchant_id, trade_path);

create table if not exists deepdraw_trade_field_cache (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text not null,
  field_id text not null,
  field_name text not null,
  field_type text,
  required boolean not null default false,
  sale_prop boolean not null default false,
  options_json jsonb not null default '[]'::jsonb,
  raw_payload_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, trade_id, field_id)
);

create index if not exists idx_deepdraw_trade_field_cache_lookup
  on deepdraw_trade_field_cache(tenant_name, merchant_id, trade_id, field_name);

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

create table if not exists product_archive_source_batch (
  id bigserial primary key,
  batch_no text not null unique,
  source_type text not null,
  file_name text,
  sheet_name text,
  row_count integer not null default 0,
  raw_manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(source_type in ('field_mapping', 'launch_plan', 'copywriting'))
);

create table if not exists product_archive_source_row (
  id bigserial primary key,
  source_batch_id bigint not null references product_archive_source_batch(id) on delete cascade,
  source_type text not null,
  spu_code text not null,
  skc_code text,
  row_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(source_type in ('launch_plan', 'copywriting'))
);

create index if not exists idx_product_archive_source_row_lookup
  on product_archive_source_row(source_type, spu_code, skc_code);

create table if not exists product_archive_field_rule (
  id bigserial primary key,
  source_batch_id bigint references product_archive_source_batch(id) on delete set null,
  deepdraw_field text not null,
  source_type text not null,
  source_table text,
  source_field text,
  default_value text,
  transform_rule_json jsonb not null default '{}'::jsonb,
  blocking boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source_type in ('mdm', 'launch_plan', 'copywriting', 'fixed', 'manual', 'skip'))
);

create index if not exists idx_product_archive_field_rule_field
  on product_archive_field_rule(deepdraw_field, source_type);

create table if not exists product_archive_draft (
  id bigserial primary key,
  draft_no text not null unique,
  spu_code text not null,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text,
  trade_path text,
  title text,
  retail_price numeric,
  status text not null default 'draft',
  source_snapshot_json jsonb not null default '{}'::jsonb,
  validation_summary_json jsonb not null default '{}'::jsonb,
  duplicate_result_json jsonb not null default '{}'::jsonb,
  created_product_id text,
  created_product_code text,
  created_by integer references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(status in (
    'draft',
    'missing_fields',
    'manual_review',
    'ready',
    'duplicate_found',
    'update_pending',
    'submitting',
    'created',
    'readback_verified',
    'readback_mismatch',
    'failed'
  ))
);

create index if not exists idx_product_archive_draft_spu
  on product_archive_draft(spu_code, updated_at desc);

create index if not exists idx_product_archive_draft_status
  on product_archive_draft(status, tenant_name, updated_at desc);

create table if not exists product_archive_draft_field (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  field_name text not null,
  field_id text,
  source_type text not null default 'manual',
  source_ref text,
  value_text text,
  value_json jsonb not null default '{}'::jsonb,
  required boolean not null default false,
  blocking boolean not null default true,
  manual_override boolean not null default false,
  validation_status text not null default 'valid',
  validation_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, field_name),
  check(validation_status in ('valid', 'missing', 'invalid', 'skipped'))
);

create index if not exists idx_product_archive_draft_field_status
  on product_archive_draft_field(draft_id, validation_status, required);

create table if not exists product_archive_draft_sku (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  spu_code text not null,
  skc_code text,
  sku_code text not null,
  barcode text,
  color_name text,
  color_code text,
  size_name text,
  size_code text,
  price numeric,
  seller_code text,
  raw_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, sku_code)
);

create index if not exists idx_product_archive_draft_sku_lookup
  on product_archive_draft_sku(draft_id, skc_code, sku_code);

create table if not exists product_archive_validation_issue (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  severity text not null,
  issue_type text not null,
  field_name text,
  sku_code text,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check(severity in ('blocker', 'warning', 'info'))
);

create index if not exists idx_product_archive_validation_issue_open
  on product_archive_validation_issue(draft_id, severity, resolved_at);

create table if not exists product_archive_submit_log (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  operation text not null,
  request_summary_json jsonb not null default '{}'::jsonb,
  http_status integer,
  response_code text,
  response_reason text,
  request_id text,
  product_id text,
  raw_response_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check(operation in ('search', 'create', 'resource', 'dry_run'))
);

create index if not exists idx_product_archive_submit_log_draft
  on product_archive_submit_log(draft_id, created_at desc);

insert into rbac_permission(permission_key, module, action, description) values
  ('PRODUCT_ARCHIVE_DRAFT_READ', 'PRODUCT_ARCHIVE_DRAFT', 'read', '查看深绘建档草稿'),
  ('PRODUCT_ARCHIVE_DRAFT_WRITE', 'PRODUCT_ARCHIVE_DRAFT', 'write', '生成和编辑深绘建档草稿'),
  ('PRODUCT_ARCHIVE_DRAFT_APPROVE', 'PRODUCT_ARCHIVE_DRAFT', 'approve', '审核深绘建档草稿'),
  ('PRODUCT_ARCHIVE_DRAFT_SUBMIT', 'PRODUCT_ARCHIVE_DRAFT', 'submit', '提交深绘建档创建'),
  ('DEEPDRAW_METADATA_MANAGE', 'DEEPDRAW_METADATA', 'manage', '同步深绘类目和字段模板'),
  ('PRODUCT_ARCHIVE_RULE_MANAGE', 'PRODUCT_ARCHIVE_RULE', 'manage', '维护深绘建档字段规则')
on conflict (permission_key) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'ADMIN'
  and p.permission_key in (
    'PRODUCT_ARCHIVE_DRAFT_READ',
    'PRODUCT_ARCHIVE_DRAFT_WRITE',
    'PRODUCT_ARCHIVE_DRAFT_APPROVE',
    'PRODUCT_ARCHIVE_DRAFT_SUBMIT',
    'DEEPDRAW_METADATA_MANAGE',
    'PRODUCT_ARCHIVE_RULE_MANAGE'
  )
on conflict (role_id, permission_id) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'OPERATOR'
  and p.permission_key in (
    'PRODUCT_ARCHIVE_DRAFT_READ',
    'PRODUCT_ARCHIVE_DRAFT_WRITE',
    'PRODUCT_ARCHIVE_DRAFT_APPROVE',
    'PRODUCT_ARCHIVE_DRAFT_SUBMIT'
  )
on conflict (role_id, permission_id) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'VIEWER'
  and p.permission_key in ('PRODUCT_ARCHIVE_DRAFT_READ')
on conflict (role_id, permission_id) do nothing;
