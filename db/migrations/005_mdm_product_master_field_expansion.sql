alter table product_spu add column shein_spu_code text;
alter table product_spu add column shein_category_name text;
alter table product_spu add column old_style_code text;
alter table product_spu add column deepdraw_info_status text;
alter table product_spu add column listing_title_cn text;
alter table product_spu add column listing_title_en text;
alter table product_spu add column version_number text;
alter table product_spu add column model_code text;
alter table product_spu add column model_name text;
alter table product_spu add column length_code text;
alter table product_spu add column length_name text;
alter table product_spu add column price_range_code text;
alter table product_spu add column price_range_name text;
alter table product_spu add column product_positioning_code text;
alter table product_spu add column product_positioning_name text;
alter table product_spu add column purchase_group_code text;
alter table product_spu add column purchase_group_name text;
alter table product_spu add column purchase_pattern_code text;
alter table product_spu add column purchase_pattern_name text;
alter table product_spu add column scene_code text;
alter table product_spu add column scene_name text;
alter table product_spu add column is_continue_code text;
alter table product_spu add column is_continue_name text;
alter table product_spu add column is_ip_code text;
alter table product_spu add column is_ip_name text;
alter table product_spu add column is_mental_products_code text;
alter table product_spu add column is_mental_products_name text;
alter table product_spu add column is_uni_size_code text;
alter table product_spu add column is_uni_size_name text;
alter table product_spu add column channel_level text;
alter table product_spu add column filler text;
alter table product_spu add column spu_group text;
alter table product_spu add column created_by text;
alter table product_spu add column last_updated_by text;

alter table product_sku add column brand_code text;
alter table product_sku add column brand_name text;
alter table product_sku add column year text;
alter table product_sku add column season_code text;
alter table product_sku add column season_name text;
alter table product_sku add column is_ip_code text;
alter table product_sku add column is_ip_name text;
alter table product_sku add column shein_size_name text;
alter table product_sku add column supply_price_cny numeric;
alter table product_sku add column suggested_retail_price_usd numeric;
alter table product_sku add column gross_weight_g numeric;
alter table product_sku add column supply_discount numeric;
alter table product_sku add column package_size_text text;
alter table product_sku add column created_by text;
alter table product_sku add column last_updated_by text;

create index if not exists idx_product_spu_listing_title
  on product_spu(listing_title_cn, listing_title_en);

create index if not exists idx_product_sku_supply_price
  on product_sku(supply_price_cny, suggested_retail_price_usd);

drop view if exists v_product_skc_summary;

create view v_product_skc_summary as
select
  spu.id as spu_id,
  spu.spu_code,
  spu.spu_name,
  spu.listing_title_cn,
  spu.listing_title_en,
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

drop view if exists v_product_sku_flat;

create view v_product_sku_flat as
select
  spu.id as spu_id,
  spu.spu_code,
  spu.spu_name,
  spu.listing_title_cn,
  spu.listing_title_en,
  spu.shein_category_name,
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
  spu.fabric_type_code,
  spu.fabric_type_name,
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
  sku.shein_size_name,
  sku.ean_code,
  sku.inner_code,
  sku.supplier_product_code,
  sku.price_tag,
  sku.supply_price_cny,
  sku.suggested_retail_price_usd,
  sku.gross_weight_g,
  sku.supply_discount,
  sku.package_size_text,
  sku.status_name,
  sku.enable_status,
  sku.data_status,
  sku.approve_status
from product_sku sku
join product_skc skc on skc.id = sku.skc_id
join product_spu spu on spu.id = skc.spu_id;
