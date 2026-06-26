-- postgres-only schema revision: aligns DeepDraw field mappings with v2 workbook columns.

alter table deepdraw_field_mapping_rule
  add column if not exists field_domain_type text not null default '通用字段',
  add column if not exists field_source text,
  add column if not exists mapped_field text;

update deepdraw_field_mapping_rule
set
  field_source = coalesce(field_source, source_table),
  mapped_field = coalesce(mapped_field, source_field, default_value),
  field_domain_type = coalesce(nullif(field_domain_type, ''), '通用字段');

alter table deepdraw_field_mapping_rule
  drop constraint if exists deepdraw_field_mapping_rule_tenant_name_merchant_id_deepdraw_field_key;

create unique index if not exists uq_deepdraw_field_mapping_rule_domain_field
  on deepdraw_field_mapping_rule(tenant_name, merchant_id, field_domain_type, deepdraw_field);

create index if not exists idx_deepdraw_field_mapping_rule_domain
  on deepdraw_field_mapping_rule(tenant_name, merchant_id, field_domain_type);
