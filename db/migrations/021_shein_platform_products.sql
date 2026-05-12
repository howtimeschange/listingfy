create table if not exists shein_platform_product (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  spu_name text not null,
  supplier_code text,
  product_name text,
  brand_code text,
  brand_name text,
  category_id text,
  category_name text,
  product_type_id text,
  product_status text,
  shelf_status_text text,
  skc_count integer not null default 0,
  sku_count integer not null default 0,
  editable_status text,
  editable_message text,
  editable_checked_at text,
  last_list_synced_at text,
  last_detail_synced_at text,
  raw_list_payload_json text not null default '{}',
  raw_detail_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, platform_account_key, spu_name)
);

create index if not exists idx_shein_platform_product_updated
  on shein_platform_product(platform, platform_account_key, updated_at desc);

create index if not exists idx_shein_platform_product_search
  on shein_platform_product(spu_name, supplier_code, product_name);

create index if not exists idx_shein_platform_product_brand_category
  on shein_platform_product(platform, platform_account_key, brand_name, category_name);

create table if not exists shein_platform_skc (
  id integer primary key autoincrement,
  product_id integer not null references shein_platform_product(id) on delete cascade,
  skc_name text not null,
  supplier_code text,
  sale_attribute_text text,
  shelf_status_text text,
  image_url text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(product_id, skc_name)
);

create index if not exists idx_shein_platform_skc_name
  on shein_platform_skc(skc_name);

create table if not exists shein_platform_sku (
  id integer primary key autoincrement,
  skc_id integer not null references shein_platform_skc(id) on delete cascade,
  sku_code text not null,
  supplier_sku text,
  sale_attribute_text text,
  mall_state integer,
  stop_purchase integer,
  package_weight numeric,
  package_length numeric,
  package_width numeric,
  package_height numeric,
  cost_price numeric,
  currency text,
  cost_text text,
  price_text text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(skc_id, sku_code)
);

create index if not exists idx_shein_platform_sku_code
  on shein_platform_sku(sku_code);

create table if not exists shein_platform_site (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  main_site text,
  main_site_name text,
  site_abbr text not null,
  site_name text,
  currency text,
  site_status integer,
  symbol_left text,
  symbol_right text,
  store_type integer,
  raw_payload_json text not null default '{}',
  last_synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, platform_account_key, site_abbr)
);

create index if not exists idx_shein_platform_site_currency
  on shein_platform_site(platform, platform_account_key, currency, site_status);

create table if not exists shein_lifecycle_operation (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  operation_type text not null,
  spu_name text,
  skc_name text,
  sku_code text,
  status text not null default 'PENDING',
  request_payload_json text not null default '{}',
  response_payload_json text not null default '{}',
  response_code text,
  response_message text,
  trace_id text,
  error_message text,
  actor_user_id integer references app_user(id) on delete set null,
  actor_username text,
  started_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(status in ('PENDING', 'SUCCESS', 'FAILED'))
);

create index if not exists idx_shein_lifecycle_operation_product
  on shein_lifecycle_operation(platform, platform_account_key, spu_name, created_at desc);

create index if not exists idx_shein_lifecycle_operation_type
  on shein_lifecycle_operation(operation_type, status, created_at desc);
