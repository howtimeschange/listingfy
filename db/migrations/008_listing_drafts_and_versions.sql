create table if not exists channel_account (
  id integer primary key autoincrement,
  platform text not null,
  account_name text not null,
  business_mode text not null default 'FULL_MANAGED',
  status text not null default 'ACTIVE',
  credential_ref text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, account_name)
);

insert or ignore into channel_account (
  platform,
  account_name,
  business_mode,
  status,
  credential_ref,
  raw_payload_json
) values (
  'SHEIN',
  'SHEIN 默认全托管账号',
  'FULL_MANAGED',
  'ACTIVE',
  'SHEIN_DEFAULT',
  '{"source":"system_default"}'
);

create table if not exists listing (
  id integer primary key autoincrement,
  platform text not null,
  channel_account_id integer not null references channel_account(id),
  business_mode text not null default 'FULL_MANAGED',
  product_spu_id integer not null references product_spu(id),
  spu_code text not null,
  listing_batch_no text,
  publish_unit_no text not null default 'default',
  split_group_key text,
  split_reason text,
  title text,
  description text,
  platform_category_id integer,
  product_type_id integer,
  platform_category_name text,
  platform_category_path text,
  default_language text,
  currency text,
  status text not null default 'DRAFT',
  validation_status text not null default 'NOT_VALIDATED',
  completeness integer not null default 0,
  source_snapshot_json text not null default '{}',
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, channel_account_id, product_spu_id, publish_unit_no)
);

create index if not exists idx_listing_platform_status
  on listing(platform, status, validation_status, updated_at);

create index if not exists idx_listing_spu
  on listing(spu_code, product_spu_id);

create table if not exists listing_skc (
  id integer primary key autoincrement,
  listing_id integer not null references listing(id) on delete cascade,
  product_skc_id integer references product_skc(id) on delete set null,
  skc_code text not null,
  supplier_code text not null,
  skc_title text,
  color_name text,
  image_url text,
  color_attribute_payload_json text not null default '{}',
  status text not null default 'DRAFT',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(listing_id, skc_code)
);

create index if not exists idx_listing_skc_listing
  on listing_skc(listing_id, skc_code);

create table if not exists listing_sku (
  id integer primary key autoincrement,
  listing_skc_id integer not null references listing_skc(id) on delete cascade,
  product_sku_id integer references product_sku(id) on delete set null,
  sku_code text not null,
  supplier_sku text not null,
  supplier_barcode text,
  size_name text,
  shein_size_value text,
  size_attribute_payload_json text not null default '{}',
  package_length_cm numeric,
  package_width_cm numeric,
  package_height_cm numeric,
  package_weight_g integer,
  mall_state integer not null default 1,
  cost_price numeric,
  currency text,
  status text not null default 'DRAFT',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(listing_skc_id, sku_code)
);

create index if not exists idx_listing_sku_skc
  on listing_sku(listing_skc_id, sku_code);

create table if not exists listing_validation_result (
  id integer primary key autoincrement,
  listing_id integer not null references listing(id) on delete cascade,
  severity text not null,
  module text not null,
  field_key text,
  owner_type text,
  owner_id integer,
  message text not null,
  suggestion text,
  resolved integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_listing_validation_result_listing
  on listing_validation_result(listing_id, severity, resolved);

create table if not exists listing_publish_version (
  id integer primary key autoincrement,
  listing_id integer not null references listing(id) on delete cascade,
  version_no integer not null,
  version_type text not null,
  status text not null default 'DRAFT',
  change_summary text,
  source_snapshot_json text not null,
  price_snapshot_json text,
  asset_snapshot_json text,
  request_payload_json text,
  response_payload_json text,
  platform_version text,
  error_code text,
  error_message text,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  submitted_at text,
  unique(listing_id, version_no)
);

create index if not exists idx_listing_publish_version_listing
  on listing_publish_version(listing_id, version_no desc);
