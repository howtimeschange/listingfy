-- postgres-only schema revision: stores imported launch-plan workbooks as first-class data.

create table if not exists listing_launch_plan_import (
  id bigserial primary key,
  import_no text not null unique,
  file_name text,
  file_size_bytes bigint not null default 0,
  sheet_count integer not null default 0,
  input_row_count integer not null default 0,
  normalized_row_count integer not null default 0,
  source_batch_ids_json jsonb not null default '[]'::jsonb,
  raw_manifest_json jsonb not null default '{}'::jsonb,
  created_by integer references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_listing_launch_plan_import_created
  on listing_launch_plan_import(created_at desc);

create table if not exists listing_launch_plan_row (
  id bigserial primary key,
  import_id bigint not null references listing_launch_plan_import(id) on delete cascade,
  sheet_name text not null,
  row_number integer not null,
  spu_code text not null,
  skc_code text,
  product_season text,
  product_line text,
  scene text,
  attribute text,
  age_group text,
  size_range text,
  gender text,
  category_name text,
  subcategory_name text,
  color_name text,
  color_code text,
  tag_price numeric,
  calculated_tag_price numeric,
  fabric text,
  fab text,
  launch_batch text,
  launch_date date,
  launch_date_text text,
  search_launch_date date,
  search_launch_date_text text,
  content_launch_date date,
  content_launch_date_text text,
  listing_channel text,
  official_category text,
  vip_category text,
  vip_style_category text,
  douyin_category text,
  raw_row_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(import_id, sheet_name, row_number)
);

create index if not exists idx_listing_launch_plan_row_spu
  on listing_launch_plan_row(spu_code, skc_code);

create index if not exists idx_listing_launch_plan_row_category
  on listing_launch_plan_row(official_category, vip_category, douyin_category);

create index if not exists idx_listing_launch_plan_row_launch_date
  on listing_launch_plan_row(launch_date, search_launch_date, content_launch_date);
