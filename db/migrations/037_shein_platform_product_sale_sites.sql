-- Normalizes SHEIN platform product sale-site status for indexed list filtering.

create table if not exists shein_platform_product_sale_site (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  product_id integer not null references shein_platform_product(id) on delete cascade,
  skc_id integer references shein_platform_skc(id) on delete cascade,
  spu_name text not null,
  skc_name text,
  skc_supplier_code text,
  site_abbr text not null,
  site_name text,
  shelf_status integer,
  first_shelf_time text,
  last_shelf_time text,
  link text,
  source text not null default 'SPU',
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_shein_platform_sale_site_lookup
  on shein_platform_product_sale_site(platform, platform_account_key, site_abbr, shelf_status, product_id);

create index if not exists idx_shein_platform_sale_site_product
  on shein_platform_product_sale_site(product_id, skc_id, site_abbr);
