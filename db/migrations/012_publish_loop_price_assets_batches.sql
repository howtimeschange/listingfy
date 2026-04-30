alter table listing_sku add column price_confirmed integer not null default 0;

alter table listing_sku add column price_confirmed_at text;

alter table listing_asset add column transform_status text not null default 'PENDING';

alter table listing_asset add column transform_error text;

alter table listing_asset add column transformed_at text;

create table if not exists listing_batch (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  batch_no text not null unique,
  batch_name text not null,
  status text not null default 'DRAFT',
  source_type text not null default 'MANUAL',
  note text,
  created_by text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_listing_batch_platform_status
  on listing_batch(platform, status, updated_at);

create index if not exists idx_listing_batch_no
  on listing(listing_batch_no, platform, status);
