create table if not exists business_import_batch (
  id integer primary key autoincrement,
  import_type text not null,
  file_name text,
  status text not null default 'COMPLETED',
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  uploaded_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at text
);

create index if not exists idx_business_import_batch_type
  on business_import_batch(import_type, created_at);

create table if not exists size_conversion_rule (
  id integer primary key autoincrement,
  import_batch_id integer references business_import_batch(id),
  platform text not null default 'SHEIN',
  local_size_code text,
  local_size_name text,
  shein_size_value text not null,
  status text not null default 'ACTIVE',
  note text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create unique index if not exists ux_size_conversion_rule_active
  on size_conversion_rule(platform, local_size_code, local_size_name)
  where status = 'ACTIVE';

create index if not exists idx_size_conversion_rule_lookup
  on size_conversion_rule(platform, status, local_size_code, local_size_name, shein_size_value);

create table if not exists supply_discount_rule (
  id integer primary key autoincrement,
  import_batch_id integer references business_import_batch(id),
  spu_code text not null,
  discount numeric not null default 0.4,
  multiplier numeric,
  status text not null default 'ACTIVE',
  note text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create unique index if not exists ux_supply_discount_rule_active
  on supply_discount_rule(spu_code)
  where status = 'ACTIVE';

create index if not exists idx_supply_discount_rule_lookup
  on supply_discount_rule(status, spu_code, discount);

create table if not exists product_weight_import (
  id integer primary key autoincrement,
  import_batch_id integer references business_import_batch(id),
  spu_code text,
  skc_code text,
  sku_code text,
  package_weight_g integer,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_product_weight_import_lookup
  on product_weight_import(spu_code, skc_code, sku_code);

create table if not exists listing_field_fill (
  id integer primary key autoincrement,
  scope_key text not null unique,
  spu_code text not null,
  skc_code text,
  sku_code text,
  field_key text not null,
  field_label text,
  field_value text,
  source text not null default 'MANUAL',
  confidence numeric,
  status text not null default 'ACTIVE',
  payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_listing_field_fill_product
  on listing_field_fill(spu_code, skc_code, sku_code, status);
