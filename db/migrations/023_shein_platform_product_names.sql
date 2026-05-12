alter table shein_platform_product add column if not exists brand_name text;
alter table shein_platform_product add column if not exists category_name text;

create index if not exists idx_shein_platform_product_brand_category
  on shein_platform_product(platform, platform_account_key, brand_name, category_name);
