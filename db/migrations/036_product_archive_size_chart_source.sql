-- postgres-only schema revision: add PLM size-chart source imports and reviewable mapping rules.

alter table product_archive_source_batch
  drop constraint if exists product_archive_source_batch_source_type_check;

alter table product_archive_source_batch
  add constraint product_archive_source_batch_source_type_check
  check(source_type in ('field_mapping', 'launch_plan', 'copywriting', 'size_chart'));

alter table product_archive_source_row
  drop constraint if exists product_archive_source_row_source_type_check;

alter table product_archive_source_row
  add constraint product_archive_source_row_source_type_check
  check(source_type in ('launch_plan', 'copywriting', 'size_chart'));

create table if not exists product_archive_size_chart_mapping (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  trade_id text not null,
  field_name text not null,
  target_field text not null,
  source_point text,
  confidence text not null default 'manual',
  source text not null default 'rule',
  review_status text not null default 'pending',
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, trade_id, field_name, target_field),
  check(confidence in ('high', 'medium', 'low', 'manual', 'unmatched')),
  check(source in ('rule', 'ai', 'rule_fallback', 'manual')),
  check(review_status in ('pending', 'approved', 'rejected'))
);
