create table if not exists shein_real_data_regression_log (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  scenario text not null,
  spu_name text,
  skc_name text,
  sku_code text,
  status text not null default 'PASS',
  trace_id text,
  request_payload_json text not null default '{}',
  response_payload_json text not null default '{}',
  error_message text,
  operator_note text,
  actor_user_id integer references app_user(id) on delete set null,
  actor_username text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(status in ('PASS', 'FAIL', 'BLOCKED'))
);

create index if not exists idx_shein_regression_log_scenario
  on shein_real_data_regression_log(platform, platform_account_key, scenario, created_at desc);

create table if not exists shein_platform_identity_snapshot (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  skc_name text not null default '',
  sku_code text not null default '',
  supplier_sku text not null default '',
  design_code text not null default '',
  attribute_text text,
  number_type integer not null default 1,
  source_page integer,
  raw_payload_json text not null default '{}',
  trace_id text,
  last_synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, platform_account_key, number_type, skc_name, sku_code, design_code, supplier_sku)
);

create index if not exists idx_shein_identity_snapshot_lookup
  on shein_platform_identity_snapshot(platform, platform_account_key, skc_name, sku_code, supplier_sku, design_code);

create table if not exists shein_supplier_sku_check (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  supplier_sku text not null,
  repeated integer not null default 0,
  source_type text,
  source_id text,
  raw_payload_json text not null default '{}',
  trace_id text,
  checked_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_shein_supplier_sku_check_lookup
  on shein_supplier_sku_check(platform, platform_account_key, supplier_sku, checked_at desc);

create table if not exists shein_barcode_size_snapshot (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  barcode text not null,
  skc_name text,
  sku_code text,
  size_text text,
  raw_payload_json text not null default '{}',
  trace_id text,
  last_synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, platform_account_key, barcode)
);

create index if not exists idx_shein_barcode_size_skc_sku
  on shein_barcode_size_snapshot(platform, platform_account_key, skc_name, sku_code);

create table if not exists shein_barcode_print_task (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  status text not null default 'PENDING',
  print_content_type integer,
  print_format_type integer,
  request_payload_json text not null default '{}',
  response_payload_json text not null default '{}',
  barcode_url text,
  trace_id text,
  error_message text,
  created_by_user_id integer references app_user(id) on delete set null,
  created_by_username text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(status in ('PENDING', 'SUCCESS', 'PARTIAL_FAILED', 'FAILED'))
);

create index if not exists idx_shein_barcode_print_task_status
  on shein_barcode_print_task(platform, platform_account_key, status, created_at desc);

create table if not exists shein_barcode_print_task_item (
  id integer primary key autoincrement,
  task_id integer not null references shein_barcode_print_task(id) on delete cascade,
  order_no text,
  supplier_sku text,
  sku_code text,
  print_number integer not null default 1,
  barcode text,
  custom_coding_json text not null default '[]',
  error_messages_json text not null default '[]',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_shein_barcode_print_task_item_task
  on shein_barcode_print_task_item(task_id, sku_code, supplier_sku);

create table if not exists shein_cost_change_reason (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  reason_code text not null,
  reason_text text not null,
  enabled integer not null default 1,
  raw_payload_json text not null default '{}',
  last_synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, platform_account_key, reason_code)
);

insert or ignore into shein_cost_change_reason (
  platform,
  platform_account_key,
  reason_code,
  reason_text,
  raw_payload_json,
  last_synced_at
)
values
  ('SHEIN', 'default', '1', '商品成本上涨', '{"source":"DOCUMENT_FALLBACK"}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('SHEIN', 'default', '2', '物流履约费用上涨', '{"source":"DOCUMENT_FALLBACK"}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('SHEIN', 'default', '3', '活动结束恢复价格', '{"source":"DOCUMENT_FALLBACK"}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('SHEIN', 'default', '4', '其他', '{"source":"DOCUMENT_FALLBACK"}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('SHEIN', 'default', '5', '物流履约费用上涨（物流规则调整）', '{"source":"DOCUMENT_FALLBACK"}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

create table if not exists shein_audit_status_snapshot (
  id integer primary key autoincrement,
  platform text not null default 'SHEIN',
  platform_account_key text not null default 'default',
  platform_integration_id integer references platform_integration(id) on delete set null,
  source_type text not null,
  source_id text,
  spu_name text not null,
  skc_name text,
  document_sn text,
  document_state integer,
  document_state_label text,
  version text,
  failure_reasons_json text not null default '[]',
  failure_reason_text text,
  handled_status text not null default 'OPEN',
  owner_user_id integer references app_user(id) on delete set null,
  owner_username text,
  raw_payload_json text not null default '{}',
  trace_id text,
  last_synced_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(source_type in ('PUBLISH_TASK', 'PLATFORM_PRODUCT', 'LIFECYCLE_OPERATION')),
  check(handled_status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED')),
  unique(platform, platform_account_key, source_type, source_id, spu_name, skc_name, document_sn, version)
);

create index if not exists idx_shein_audit_status_lookup
  on shein_audit_status_snapshot(platform, platform_account_key, handled_status, document_state, last_synced_at desc);
