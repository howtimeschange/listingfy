-- Maintains SHEIN operation-list read models without rescanning raw lifecycle data.

create table if not exists shein_platform_sale_site_summary (
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  site_abbr text not null,
  site_name text,
  active_product_count integer not null default 0,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (platform, platform_account_key, site_abbr)
);

insert into shein_platform_sale_site_summary (
  platform,
  platform_account_key,
  site_abbr,
  site_name,
  active_product_count,
  updated_at
)
select
  platform,
  platform_account_key,
  site_abbr,
  max(nullif(site_name, '')) as site_name,
  count(distinct product_id) as active_product_count,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as updated_at
from shein_platform_product_sale_site
where shelf_status = 1
group by platform, platform_account_key, site_abbr
on conflict (platform, platform_account_key, site_abbr) do update set
  site_name = coalesce(nullif(excluded.site_name, ''), shein_platform_sale_site_summary.site_name),
  active_product_count = excluded.active_product_count,
  updated_at = excluded.updated_at;

create index if not exists idx_shein_lifecycle_operation_recent
  on shein_lifecycle_operation(platform, platform_account_key, created_at desc, id desc);
