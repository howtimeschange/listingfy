-- postgres-only schema revision: tenant-scoped DeepDraw field mapping rules.

create table if not exists deepdraw_field_mapping_rule (
  id bigserial primary key,
  tenant_name text not null,
  merchant_id text not null,
  field_domain_type text not null default '通用字段',
  deepdraw_field text not null,
  field_source text,
  mapped_field text,
  source_type text not null,
  source_table text,
  source_field text,
  default_value text,
  field_type text,
  importability text,
  blocking boolean not null default false,
  enabled boolean not null default true,
  notes text,
  raw_row_json jsonb not null default '{}'::jsonb,
  created_by integer references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_name, merchant_id, field_domain_type, deepdraw_field),
  check(source_type in ('mdm', 'launch_plan', 'copywriting', 'fixed', 'manual', 'skip'))
);

create index if not exists idx_deepdraw_field_mapping_rule_tenant_source
  on deepdraw_field_mapping_rule(tenant_name, merchant_id, source_type, enabled);

create index if not exists idx_deepdraw_field_mapping_rule_field
  on deepdraw_field_mapping_rule(deepdraw_field);

insert into rbac_permission(permission_key, module, action, description) values
  ('PRODUCT_ARCHIVE_RULE_MANAGE', 'PRODUCT_ARCHIVE_RULE', 'manage', '维护深绘建档字段规则')
on conflict (permission_key) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'ADMIN'
  and p.permission_key = 'PRODUCT_ARCHIVE_RULE_MANAGE'
on conflict (role_id, permission_id) do nothing;
