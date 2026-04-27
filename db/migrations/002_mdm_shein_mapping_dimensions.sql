drop index if exists idx_mdm_shein_category_mapping_rule_active;

alter table mdm_shein_category_mapping_rule
  rename to mdm_shein_category_mapping_rule_legacy;

create table mdm_shein_category_mapping_rule (
  id integer primary key autoincrement,
  mdm_middle_category_code text,
  mdm_middle_category_name text not null default '',
  mdm_small_category_code text,
  mdm_small_category_name text not null,
  gender_code text,
  gender_name text,
  age_group_code text,
  age_group_name text,
  match_mode text not null default 'EXACT',
  match_key text not null,
  shein_category_id integer not null,
  shein_product_type_id integer not null,
  priority integer not null default 100,
  status text not null default 'ACTIVE',
  source text not null default 'MANUAL',
  dimension_payload_json text not null default '{}',
  note text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(match_mode in ('EXACT', 'FALLBACK'))
);

insert into mdm_shein_category_mapping_rule (
  id,
  mdm_small_category_code,
  mdm_small_category_name,
  match_mode,
  match_key,
  shein_category_id,
  shein_product_type_id,
  priority,
  status,
  source,
  dimension_payload_json,
  note,
  created_at,
  updated_at
)
select
  id,
  mdm_category_code,
  mdm_category_name,
  'FALLBACK',
  'legacy|' || coalesce(mdm_category_path, '') || '|' || coalesce(mdm_category_code, '') || '|' || mdm_category_name,
  shein_category_id,
  shein_product_type_id,
  priority,
  status,
  source,
  json_object(
    'legacy_mdm_category_code', mdm_category_code,
    'legacy_mdm_category_name', mdm_category_name,
    'legacy_mdm_category_path', mdm_category_path
  ),
  note,
  created_at,
  updated_at
from mdm_shein_category_mapping_rule_legacy;

drop table mdm_shein_category_mapping_rule_legacy;

create index if not exists idx_mdm_shein_category_mapping_rule_lookup
  on mdm_shein_category_mapping_rule(
    status,
    mdm_middle_category_name,
    mdm_small_category_name,
    gender_name,
    age_group_name,
    priority
  );

create index if not exists idx_mdm_shein_category_mapping_rule_target
  on mdm_shein_category_mapping_rule(shein_category_id, shein_product_type_id);

create unique index if not exists ux_mdm_shein_category_mapping_rule_active_exact
  on mdm_shein_category_mapping_rule(match_key)
  where status = 'ACTIVE' and match_mode = 'EXACT';
