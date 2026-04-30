alter table product_weight_import add column status text not null default 'ACTIVE';

alter table product_weight_import add column updated_at text;

alter table listing_skc add column selected_for_publish integer not null default 1;

alter table listing_skc add column image_confirmed integer not null default 0;

alter table listing_sku add column selected_for_publish integer not null default 1;

create table if not exists listing_asset (
  id integer primary key autoincrement,
  listing_id integer not null references listing(id) on delete cascade,
  listing_skc_id integer references listing_skc(id) on delete set null,
  skc_code text,
  source_type text not null default 'MANUAL_UPLOAD',
  asset_type text not null,
  image_sort integer not null default 0,
  source_url text,
  local_path text,
  platform_url text,
  width integer,
  height integer,
  status text not null default 'PENDING_CONFIRM',
  confirmed integer not null default 0,
  note text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_listing_asset_listing
  on listing_asset(listing_id, listing_skc_id, asset_type, status);

create index if not exists idx_listing_asset_skc
  on listing_asset(skc_code, asset_type, image_sort);
