create table if not exists shein_package_rule (
  id integer primary key autoincrement,
  rule_name text not null,
  priority integer not null default 0,
  match_mode text not null default 'ANY',
  match_keywords_json text not null default '[]',
  package_length_cm numeric not null,
  package_width_cm numeric not null,
  package_height_cm numeric not null,
  package_type text not null default '软包装+软物品',
  status text not null default 'ACTIVE',
  note text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_shein_package_rule_lookup
  on shein_package_rule(status, priority, updated_at);

insert into shein_package_rule (
  rule_name,
  priority,
  match_mode,
  match_keywords_json,
  package_length_cm,
  package_width_cm,
  package_height_cm,
  package_type,
  note
)
select '鞋品', 100, 'ANY', '["鞋"]', 30, 20, 10, '硬包装', '中类/小类/标题包含鞋'
where not exists (select 1 from shein_package_rule where rule_name = '鞋品');

insert into shein_package_rule (
  rule_name,
  priority,
  match_mode,
  match_keywords_json,
  package_length_cm,
  package_width_cm,
  package_height_cm,
  package_type,
  note
)
select '内裤', 90, 'ANY', '["内裤"]', 25, 14, 2, '软包装+软物品', '小类/标题包含内裤'
where not exists (select 1 from shein_package_rule where rule_name = '内裤');

insert into shein_package_rule (
  rule_name,
  priority,
  match_mode,
  match_keywords_json,
  package_length_cm,
  package_width_cm,
  package_height_cm,
  package_type,
  note
)
select '服装厚款', 80, 'ANY', '["毛衫","毛衣","厚","外套"]', 35, 25, 1.5, '软包装+软物品', '毛衫、毛衣、外套、厚款'
where not exists (select 1 from shein_package_rule where rule_name = '服装厚款');

insert into shein_package_rule (
  rule_name,
  priority,
  match_mode,
  match_keywords_json,
  package_length_cm,
  package_width_cm,
  package_height_cm,
  package_type,
  note
)
select '服装薄款', 0, 'ANY', '[]', 28, 24, 1, '软包装+软物品', '默认服饰、梭织、夏季轻薄款'
where not exists (select 1 from shein_package_rule where rule_name = '服装薄款');
