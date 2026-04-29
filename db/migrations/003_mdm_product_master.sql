create table if not exists product_spu (
  id integer primary key autoincrement,
  spu_code text not null unique,
  spu_name text,
  spu_name_en text,
  brand_code text,
  brand_name text,
  year text,
  season_code text,
  season_name text,
  product_chain_code text,
  product_chain_name text,
  product_line_code text,
  product_line_name text,
  product_type_code text,
  product_type_name text,
  middle_class_code text,
  middle_class_name text,
  subclass_code text,
  subclass_name text,
  gender_code text,
  gender_name text,
  age_group_code text,
  age_group_name text,
  article_prop_code text,
  article_prop_name text,
  batch_code text,
  batch_name text,
  main_size_group_code text,
  main_size_group_name text,
  order_size_group_code text,
  order_size_group_name text,
  spec_range text,
  price_tag numeric,
  unit_code text,
  unit_name text,
  fabric_type_code text,
  fabric_type_name text,
  fabric text,
  composition text,
  lining_material text,
  wash_label_ingr text,
  status_code text,
  status_name text,
  enable_status text,
  data_status text,
  approve_status text,
  pic_url text,
  designer text,
  source_mdm_id text,
  source_form_id text,
  creation_date text,
  last_update_date text,
  enabled_date text,
  disabled_date text,
  multi_lang_json text not null default '[]',
  raw_payload_json text not null,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_product_spu_brand_season
  on product_spu(brand_code, year, season_code);

create index if not exists idx_product_spu_category_mapping
  on product_spu(
    middle_class_name,
    subclass_name,
    gender_name,
    age_group_name,
    status_name
  );

create index if not exists idx_product_spu_status
  on product_spu(enable_status, data_status, approve_status);

create table if not exists product_skc (
  id integer primary key autoincrement,
  spu_id integer not null references product_spu(id) on delete cascade,
  skc_code text not null unique,
  skc_name text,
  skc_name_en text,
  color_code text,
  color_name text,
  price_tag numeric,
  status_code text,
  status_name text,
  enable_status text,
  data_status text,
  approve_status text,
  pic_url text,
  source_mdm_id text,
  source_form_id text,
  creation_date text,
  last_update_date text,
  enabled_date text,
  disabled_date text,
  multi_lang_json text not null default '[]',
  raw_payload_json text not null,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(spu_id, color_code)
);

create index if not exists idx_product_skc_spu
  on product_skc(spu_id);

create index if not exists idx_product_skc_color
  on product_skc(color_code, color_name);

create index if not exists idx_product_skc_status
  on product_skc(enable_status, data_status, approve_status);

create table if not exists product_sku (
  id integer primary key autoincrement,
  skc_id integer not null references product_skc(id) on delete cascade,
  sku_code text not null unique,
  sku_name text,
  sku_name_en text,
  supplier_product_code text,
  inner_code text,
  ean_code text,
  size_code text,
  size_name text,
  color_code text,
  color_name text,
  price_tag numeric,
  status_code text,
  status_name text,
  enable_status text,
  data_status text,
  approve_status text,
  pic_url text,
  source_mdm_id text,
  source_form_id text,
  creation_date text,
  last_update_date text,
  enabled_date text,
  disabled_date text,
  multi_lang_json text not null default '[]',
  raw_payload_json text not null,
  source_hash text,
  sync_batch_id integer references sync_batch(id),
  synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(skc_id, size_code)
);

create index if not exists idx_product_sku_skc
  on product_sku(skc_id);

create index if not exists idx_product_sku_barcode
  on product_sku(ean_code, inner_code);

create index if not exists idx_product_sku_size
  on product_sku(size_code, size_name);

create index if not exists idx_product_sku_status
  on product_sku(enable_status, data_status, approve_status);

create view if not exists v_product_skc_summary as
select
  spu.id as spu_id,
  spu.spu_code,
  spu.spu_name,
  spu.brand_name,
  spu.year,
  spu.season_name,
  skc.id as skc_id,
  skc.skc_code,
  skc.skc_name,
  skc.color_code,
  skc.color_name,
  count(sku.id) as sku_count,
  min(sku.size_code) as min_size_code,
  max(sku.size_code) as max_size_code,
  skc.status_name,
  skc.enable_status,
  skc.updated_at
from product_skc skc
join product_spu spu on spu.id = skc.spu_id
left join product_sku sku on sku.skc_id = skc.id
group by skc.id;

create view if not exists v_product_sku_flat as
select
  spu.id as spu_id,
  spu.spu_code,
  spu.spu_name,
  spu.brand_code,
  spu.brand_name,
  spu.year,
  spu.season_code,
  spu.season_name,
  spu.product_chain_code,
  spu.product_chain_name,
  spu.product_line_code,
  spu.product_line_name,
  spu.middle_class_code,
  spu.middle_class_name,
  spu.subclass_code,
  spu.subclass_name,
  spu.gender_code,
  spu.gender_name,
  spu.age_group_code,
  spu.age_group_name,
  skc.id as skc_id,
  skc.skc_code,
  skc.skc_name,
  skc.color_code,
  skc.color_name,
  sku.id as sku_id,
  sku.sku_code,
  sku.sku_name,
  sku.size_code,
  sku.size_name,
  sku.ean_code,
  sku.inner_code,
  sku.supplier_product_code,
  sku.price_tag,
  sku.status_name,
  sku.enable_status,
  sku.data_status,
  sku.approve_status
from product_sku sku
join product_skc skc on skc.id = sku.skc_id
join product_spu spu on spu.id = skc.spu_id;
