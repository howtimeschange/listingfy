-- postgres-only schema revision: allow the same DeepDraw field to have different rules per domain.

alter table deepdraw_field_mapping_rule
  drop constraint if exists deepdraw_field_mapping_rule_tenant_name_merchant_id_deepdraw_field_key,
  drop constraint if exists deepdraw_field_mapping_rule_tenant_name_merchant_id_deepdra_key;

create unique index if not exists uq_deepdraw_field_mapping_rule_domain_field
  on deepdraw_field_mapping_rule(tenant_name, merchant_id, field_domain_type, deepdraw_field);
