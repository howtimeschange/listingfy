create unique index if not exists ux_product_weight_import_active_sku
  on product_weight_import(sku_code)
  where coalesce(status, 'ACTIVE') = 'ACTIVE'
    and coalesce(sku_code, '') <> '';

create table if not exists listing_publish_task (
  id integer primary key autoincrement,
  listing_id integer not null references listing(id) on delete cascade,
  publish_version_id integer references listing_publish_version(id) on delete set null,
  platform text not null default 'SHEIN',
  task_type text not null default 'PUBLISH_LISTING',
  status text not null default 'PENDING_CONFIRM',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  request_payload_json text not null default '{}',
  response_payload_json text not null default '{}',
  platform_trace_id text,
  platform_version text,
  error_code text,
  error_message text,
  started_at text,
  finished_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_listing_publish_task_listing
  on listing_publish_task(listing_id, status, created_at);

create table if not exists platform_identity (
  id integer primary key autoincrement,
  platform text not null,
  channel_account_id integer not null references channel_account(id),
  local_type text not null,
  local_id integer not null,
  platform_type text not null,
  platform_id text not null,
  platform_parent_id text,
  raw_payload_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, channel_account_id, local_type, local_id, platform_type)
);

create index if not exists idx_platform_identity_lookup
  on platform_identity(platform, platform_type, platform_id);
