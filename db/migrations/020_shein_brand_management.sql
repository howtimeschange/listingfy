create table if not exists shein_brand_rule (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  brand_code text not null,
  brand_name text not null,
  local_brand_name text,
  aliases_json text not null default '[]',
  status text not null default 'ACTIVE',
  note text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create unique index if not exists ux_shein_brand_rule_active_name
  on shein_brand_rule(platform, lower(brand_name))
  where status = 'ACTIVE';

create unique index if not exists ux_shein_brand_rule_active_code
  on shein_brand_rule(platform, brand_code)
  where status = 'ACTIVE';

create index if not exists idx_shein_brand_rule_lookup
  on shein_brand_rule(platform, status, brand_code, brand_name, local_brand_name);

insert into shein_brand_rule (
  brand_code,
  brand_name,
  local_brand_name,
  aliases_json,
  note
)
select '2bbws', 'Balabala', '巴拉巴拉', '["巴拉巴拉","电商巴拉巴拉","股份巴拉巴拉"]', 'SHEIN 发布品牌映射默认值'
where not exists (
  select 1 from shein_brand_rule
  where platform = 'SHEIN'
    and status = 'ACTIVE'
    and (brand_code = '2bbws' or lower(brand_name) = lower('Balabala'))
);

insert into shein_brand_rule (
  brand_code,
  brand_name,
  local_brand_name,
  aliases_json,
  note
)
select '252fb', 'mini bala', '迷你巴拉', '["迷你巴拉","Mini Bala","mini bala"]', 'SHEIN 发布品牌映射默认值'
where not exists (
  select 1 from shein_brand_rule
  where platform = 'SHEIN'
    and status = 'ACTIVE'
    and (brand_code = '252fb' or lower(brand_name) = lower('mini bala'))
);
