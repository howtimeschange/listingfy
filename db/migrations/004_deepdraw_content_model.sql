create table if not exists product_content_package (
  id integer primary key autoincrement,
  source_system text not null default 'DEEPDRAW',
  source_code text not null,
  spu_code text not null,
  deepdraw_product_id text,
  deepdraw_body_id text,
  title text,
  brand_name text,
  category_id text,
  category_name text,
  trade_path text,
  retail_price numeric,
  primary_color text,
  version integer,
  complete integer not null default 0,
  create_date text,
  last_update_date text,
  onsale_date text,
  places_json text not null default '[]',
  colors_json text not null default '{}',
  sizes_json text not null default '{}',
  response_code integer,
  response_text text,
  reason text,
  request_id text,
  raw_payload_json text not null,
  raw_response_json text,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(source_system, source_code)
);

create index if not exists idx_product_content_package_spu
  on product_content_package(spu_code);

create index if not exists idx_product_content_package_brand_category
  on product_content_package(brand_name, category_name);

create table if not exists product_content_skc (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  skc_code text not null,
  color_name text,
  color_alias text,
  sku_count integer not null default 0,
  raw_payload_json text not null,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, skc_code)
);

create index if not exists idx_product_content_skc_spu
  on product_content_skc(spu_code);

create index if not exists idx_product_content_skc_code
  on product_content_skc(skc_code);

create table if not exists product_content_sku (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  content_skc_id integer not null references product_content_skc(id) on delete cascade,
  spu_code text not null,
  skc_code text not null,
  sku_code text not null,
  color_name text,
  color_alias text,
  size_name text,
  size_code text,
  barcode text,
  seller_code text,
  xhs_seller_code text,
  vip_skc_code text,
  price numeric,
  retail_price numeric,
  quantity numeric,
  values_json text not null default '{}',
  raw_payload_json text not null,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, sku_code)
);

create index if not exists idx_product_content_sku_skc
  on product_content_sku(content_skc_id);

create index if not exists idx_product_content_sku_code
  on product_content_sku(sku_code);

create index if not exists idx_product_content_sku_barcode
  on product_content_sku(barcode, seller_code);

create table if not exists product_content_size (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  size_name text not null,
  size_code text,
  size_alias text,
  sort_no integer not null default 0,
  field_id text,
  field_name text,
  field_type text,
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, size_name)
);

create index if not exists idx_product_content_size_spu
  on product_content_size(spu_code, size_code);

create table if not exists product_content_detail_page (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  page_index integer not null,
  template_name text,
  template_width integer,
  active integer,
  page_time text,
  html_page_url text,
  image_page_url text,
  mixed_page_url text,
  screenshot_count integer not null default 0,
  module_count integer not null default 0,
  template_sites_json text not null default '[]',
  modules_json text not null default '{}',
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, page_index)
);

create index if not exists idx_product_content_detail_page_spu
  on product_content_detail_page(spu_code);

create table if not exists product_content_size_table (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  table_index integer not null,
  field_id text,
  field_name text,
  field_type text,
  row_count integer not null default 0,
  options_json text not null default '[]',
  option_aliases_json text not null default '{}',
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, table_index)
);

create index if not exists idx_product_content_size_table_spu
  on product_content_size_table(spu_code, field_name);

create table if not exists product_content_size_table_row (
  id integer primary key autoincrement,
  size_table_id integer not null references product_content_size_table(id) on delete cascade,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  table_index integer not null,
  row_index integer not null,
  size_name text,
  values_json text not null default '{}',
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(size_table_id, row_index)
);

create index if not exists idx_product_content_size_table_row_spu
  on product_content_size_table_row(spu_code, size_name);

create table if not exists product_content_field (
  id integer primary key autoincrement,
  content_package_id integer not null references product_content_package(id) on delete cascade,
  spu_code text not null,
  field_id text,
  field_name text not null,
  field_type text,
  value_text text,
  texts_json text not null default '[]',
  options_json text not null default '[]',
  option_aliases_json text not null default '{}',
  is_key integer not null default 0,
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(content_package_id, field_id, field_name)
);

create index if not exists idx_product_content_field_spu_key
  on product_content_field(spu_code, is_key, field_name);

create table if not exists product_asset (
  id integer primary key autoincrement,
  source_system text not null default 'DEEPDRAW',
  source_kind text not null,
  content_package_id integer references product_content_package(id) on delete cascade,
  content_skc_id integer references product_content_skc(id) on delete set null,
  detail_page_id integer references product_content_detail_page(id) on delete set null,
  spu_code text,
  skc_code text,
  owner_type text,
  owner_code text,
  asset_type text,
  place text,
  picture_type text,
  detail_page_index integer,
  module_name text,
  module_index integer,
  source_url text not null,
  normalized_url text not null,
  file_name text,
  deepdraw_image_id text,
  width integer,
  height integer,
  file_size integer,
  sort_no integer,
  with_watermark integer,
  status text not null default 'PENDING',
  platform_url text,
  raw_payload_json text not null,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_product_asset_owner
  on product_asset(owner_type, owner_code, asset_type);

create index if not exists idx_product_asset_spu_skc
  on product_asset(spu_code, skc_code);

create index if not exists idx_product_asset_url
  on product_asset(normalized_url);

create view if not exists v_product_content_hierarchy as
select
  pkg.id as content_package_id,
  pkg.spu_code,
  pkg.title,
  pkg.brand_name,
  pkg.category_name,
  skc.id as content_skc_id,
  skc.skc_code,
  skc.color_name,
  skc.color_alias,
  sku.id as content_sku_id,
  sku.sku_code,
  sku.size_name,
  sku.size_code,
  sku.barcode,
  sku.price,
  sku.quantity,
  pkg.synced_at
from product_content_package pkg
left join product_content_skc skc on skc.content_package_id = pkg.id
left join product_content_sku sku on sku.content_skc_id = skc.id;

create view if not exists v_product_content_asset_summary as
select
  pkg.spu_code,
  asset.source_kind,
  asset.asset_type,
  asset.place,
  asset.picture_type,
  asset.skc_code,
  count(*) as asset_count,
  count(distinct asset.normalized_url) as unique_url_count
from product_asset asset
join product_content_package pkg on pkg.id = asset.content_package_id
group by
  pkg.spu_code,
  asset.source_kind,
  asset.asset_type,
  asset.place,
  asset.picture_type,
  asset.skc_code;
