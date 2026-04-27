create table if not exists schema_migration (
  version text primary key,
  applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sync_batch (
  id integer primary key autoincrement,
  source_system text not null,
  source_object text not null,
  batch_no text not null,
  status text not null,
  started_at text,
  finished_at text,
  source_dir text,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  manifest_json text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(source_system, source_object, batch_no)
);

create table if not exists channel_store_metadata (
  platform text not null,
  metadata_key text not null,
  sync_batch_id integer not null references sync_batch(id),
  payload_json text not null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, metadata_key)
);

create table if not exists channel_category (
  platform text not null,
  category_id integer not null,
  product_type_id integer not null default 0,
  parent_category_id integer,
  category_name text not null,
  root_category_id integer,
  root_category_name text,
  level integer not null,
  path text not null,
  last_category integer not null default 0,
  sync_batch_id integer not null references sync_batch(id),
  raw_payload_json text not null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, category_id)
);

create index if not exists idx_channel_category_platform_leaf
  on channel_category(platform, last_category, root_category_name);

create index if not exists idx_channel_category_platform_product_type
  on channel_category(platform, product_type_id);

create index if not exists idx_channel_category_platform_path
  on channel_category(platform, path);

create table if not exists channel_publish_standard (
  platform text not null,
  standard_scope text not null,
  category_id integer not null default 0,
  product_type_id integer,
  default_language text,
  currency text,
  support_sale_attribute_sort integer,
  trace_id text,
  fill_in_standard_json text not null,
  picture_config_json text not null,
  raw_payload_json text not null,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, standard_scope, category_id)
);

create table if not exists channel_publish_field (
  platform text not null,
  standard_scope text not null,
  category_id integer not null default 0,
  product_type_id integer,
  module text not null,
  field_key text not null,
  required integer not null default 0,
  show integer not null default 0,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, standard_scope, category_id, module, field_key)
);

create index if not exists idx_channel_publish_field_required
  on channel_publish_field(platform, standard_scope, category_id, required, show);

create table if not exists channel_picture_config (
  platform text not null,
  standard_scope text not null,
  category_id integer not null default 0,
  product_type_id integer,
  field_key text not null,
  is_true integer not null default 0,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, standard_scope, category_id, field_key)
);

create table if not exists channel_attribute_template (
  platform text not null,
  product_type_id integer not null,
  attr_count integer not null default 0,
  required_count integer not null default 0,
  sale_attributes_json text not null,
  attribute_infos_json text not null,
  raw_payload_json text not null,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, product_type_id)
);

create table if not exists channel_attribute (
  platform text not null,
  product_type_id integer not null,
  attribute_id integer not null,
  attribute_name text not null,
  attribute_name_en text,
  attribute_type integer,
  attribute_label integer,
  attribute_mode integer,
  attribute_status integer,
  attribute_input_num integer,
  data_dimension integer,
  values_count integer not null default 0,
  is_required integer not null default 0,
  is_sale_attribute integer not null default 0,
  is_size_attribute integer not null default 0,
  values_json text not null,
  raw_payload_json text not null,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, product_type_id, attribute_id)
);

create index if not exists idx_channel_attribute_required
  on channel_attribute(platform, product_type_id, is_required, attribute_type);

create index if not exists idx_channel_attribute_name
  on channel_attribute(platform, attribute_name);

create table if not exists channel_attribute_value (
  platform text not null,
  product_type_id integer not null,
  attribute_id integer not null,
  attribute_value_id integer not null,
  attribute_value text not null,
  attribute_value_en text,
  is_custom_attribute_value integer,
  is_show integer,
  is_black integer,
  color text,
  raw_payload_json text not null,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, product_type_id, attribute_id, attribute_value_id)
);

create index if not exists idx_channel_attribute_value_lookup
  on channel_attribute_value(platform, product_type_id, attribute_id, attribute_value);

create table if not exists channel_required_attribute (
  platform text not null,
  category_id integer not null,
  product_type_id integer not null,
  attribute_id integer not null,
  attribute_name text not null,
  attribute_name_en text,
  attribute_type integer,
  attribute_label integer,
  attribute_mode integer,
  attribute_status integer,
  attribute_input_num integer,
  values_count integer not null default 0,
  sample_values_json text not null,
  sync_batch_id integer not null references sync_batch(id),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key(platform, category_id, product_type_id, attribute_id)
);

create index if not exists idx_channel_required_attribute_product_type
  on channel_required_attribute(platform, product_type_id, attribute_type);

create table if not exists mdm_shein_category_mapping_rule (
  id integer primary key autoincrement,
  mdm_category_code text,
  mdm_category_name text not null,
  mdm_category_path text,
  shein_category_id integer not null,
  shein_product_type_id integer not null,
  priority integer not null default 100,
  status text not null default 'ACTIVE',
  source text not null default 'MANUAL',
  note text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_mdm_shein_category_mapping_rule_active
  on mdm_shein_category_mapping_rule(status, mdm_category_name, priority);

create view if not exists v_shein_leaf_category as
select
  c.category_id,
  c.product_type_id,
  c.category_name,
  c.root_category_name,
  c.level,
  c.path,
  ps.default_language,
  ps.currency,
  ps.support_sale_attribute_sort,
  coalesce(at.attr_count, 0) as attr_count,
  coalesce(at.required_count, 0) as required_count
from channel_category c
left join channel_publish_standard ps
  on ps.platform = c.platform
  and ps.standard_scope = 'category'
  and ps.category_id = c.category_id
left join channel_attribute_template at
  on at.platform = c.platform
  and at.product_type_id = c.product_type_id
where c.platform = 'SHEIN'
  and c.last_category = 1;

create view if not exists v_shein_category_required_attribute as
select
  c.category_id,
  c.category_name,
  c.path,
  c.product_type_id,
  a.attribute_id,
  a.attribute_name,
  a.attribute_name_en,
  a.attribute_type,
  a.attribute_mode,
  a.attribute_status,
  a.values_count
from channel_category c
join channel_required_attribute a
  on a.platform = c.platform
  and a.category_id = c.category_id
  and a.product_type_id = c.product_type_id
where c.platform = 'SHEIN';
