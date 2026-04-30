create table if not exists shein_product_bucket (
  id integer primary key autoincrement,
  product_spu_id integer not null references product_spu(id) on delete cascade,
  spu_code text not null,
  bucket_status text not null default 'IN_BUCKET',
  platform_category_id integer,
  product_type_id integer,
  platform_category_name text,
  platform_category_path text,
  category_source text,
  category_status text not null default 'MISSING',
  title_cn text,
  title_en text,
  supply_discount numeric,
  supply_price_cny numeric,
  retail_price_usd numeric,
  package_size_text text,
  weight_record_count integer not null default 0,
  size_match_count integer not null default 0,
  sku_count integer not null default 0,
  skc_count integer not null default 0,
  image_status text not null default 'PENDING',
  readiness_status text not null default 'PENDING',
  latest_listing_id integer references listing(id) on delete set null,
  latest_version_no integer,
  latest_publish_status text,
  raw_payload_json text not null default '{}',
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(product_spu_id)
);

create index if not exists idx_shein_product_bucket_status
  on shein_product_bucket(bucket_status, readiness_status, updated_at);

create index if not exists idx_shein_product_bucket_category
  on shein_product_bucket(platform_category_id, product_type_id, category_status);

create index if not exists idx_shein_product_bucket_spu
  on shein_product_bucket(spu_code);

insert or ignore into shein_product_bucket (
  product_spu_id,
  spu_code,
  bucket_status,
  platform_category_id,
  product_type_id,
  platform_category_name,
  platform_category_path,
  category_source,
  category_status,
  title_cn,
  title_en,
  readiness_status,
  latest_listing_id,
  latest_version_no,
  latest_publish_status,
  raw_payload_json,
  created_by,
  updated_at
)
select
  listing.product_spu_id,
  listing.spu_code,
  'IN_BUCKET',
  listing.platform_category_id,
  listing.product_type_id,
  listing.platform_category_name,
  listing.platform_category_path,
  'LISTING_DRAFT',
  case when listing.platform_category_id is null then 'MISSING' else 'READY' end,
  coalesce(spu.listing_title_cn, spu.spu_name),
  listing.title,
  case when listing.validation_status = 'PASSED' then 'READY' else 'NEEDS_ENRICHMENT' end,
  listing.id,
  (
    select max(version.version_no)
    from listing_publish_version version
    where version.listing_id = listing.id
  ),
  listing.status,
  json_object('seeded_from', 'listing', 'listing_id', listing.id),
  'migration',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
from listing
join product_spu spu on spu.id = listing.product_spu_id
where listing.platform = 'SHEIN';
