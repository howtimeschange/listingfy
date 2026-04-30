create table if not exists app_user (
  id integer primary key autoincrement,
  username text not null unique,
  display_name text not null,
  email text,
  password_hash text not null,
  password_salt text not null,
  status text not null default 'ACTIVE',
  last_login_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(status in ('ACTIVE', 'DISABLED'))
);

create index if not exists idx_app_user_status
  on app_user(status, updated_at);

create table if not exists rbac_role (
  id integer primary key autoincrement,
  role_key text not null unique,
  role_name text not null,
  description text,
  is_system integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists rbac_permission (
  id integer primary key autoincrement,
  permission_key text not null unique,
  module text not null,
  action text not null,
  description text
);

create table if not exists rbac_role_permission (
  role_id integer not null references rbac_role(id) on delete cascade,
  permission_id integer not null references rbac_permission(id) on delete cascade,
  primary key(role_id, permission_id)
);

create table if not exists app_user_role (
  user_id integer not null references app_user(id) on delete cascade,
  role_id integer not null references rbac_role(id) on delete cascade,
  primary key(user_id, role_id)
);

create table if not exists user_session (
  id text primary key,
  user_id integer not null references app_user(id) on delete cascade,
  expires_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_user_session_user
  on user_session(user_id, expires_at);

create table if not exists operation_log (
  id integer primary key autoincrement,
  actor_user_id integer references app_user(id) on delete set null,
  actor_username text,
  action text not null,
  module text not null,
  entity_type text,
  entity_id text,
  summary text not null,
  metadata_json text not null default '{}',
  ip_address text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_operation_log_created
  on operation_log(created_at desc);

create index if not exists idx_operation_log_module
  on operation_log(module, action, created_at desc);

create table if not exists platform_integration (
  id integer primary key autoincrement,
  platform text not null,
  integration_name text not null,
  business_mode text not null default 'FULL_MANAGED',
  environment text not null default 'TEST',
  status text not null default 'ACTIVE',
  base_url text,
  language text,
  open_key_id text,
  secret_key text,
  app_id text,
  app_secret_key text,
  is_default integer not null default 0,
  last_test_status text,
  last_test_message text,
  last_tested_at text,
  raw_payload_json text not null default '{}',
  created_by integer references app_user(id) on delete set null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(platform, integration_name),
  check(status in ('ACTIVE', 'INACTIVE')),
  check(environment in ('TEST', 'PROD'))
);

create index if not exists idx_platform_integration_lookup
  on platform_integration(platform, status, is_default, updated_at);

insert or ignore into rbac_role(role_key, role_name, description, is_system) values
  ('ADMIN', '管理员', '拥有系统管理、平台配置、发布和同步等全部权限。', 1),
  ('OPERATOR', '运营', '可维护业务数据、发布商品、执行同步，但不能管理用户和平台密钥。', 1),
  ('VIEWER', '只读', '只能查看业务数据和任务结果。', 1);

insert or ignore into rbac_permission(permission_key, module, action, description) values
  ('DASHBOARD_READ', 'DASHBOARD', 'read', '查看工作台'),
  ('LISTING_READ', 'LISTING', 'read', '查看上新、草稿和发布任务'),
  ('LISTING_WRITE', 'LISTING', 'write', '维护上新、草稿、图片和规则'),
  ('PUBLISH_RUN', 'PUBLISH', 'run', '提交发布、同步发布状态、重提任务'),
  ('DATA_READ', 'DATA', 'read', '查看商品、素材、元数据'),
  ('DATA_WRITE', 'DATA', 'write', '导入和维护商品、素材、元数据'),
  ('RULE_READ', 'RULE', 'read', '查看规则中心'),
  ('RULE_WRITE', 'RULE', 'write', '维护规则中心'),
  ('SYNC_RUN', 'SYNC', 'run', '执行同步任务'),
  ('SYNC_READ', 'SYNC', 'read', '查看同步任务'),
  ('OPERATION_LOG_READ', 'OPERATION_LOG', 'read', '查看操作日志'),
  ('USER_ADMIN', 'USER', 'admin', '管理用户和角色'),
  ('PLATFORM_CONFIG', 'PLATFORM', 'config', '管理平台对接配置');

insert or ignore into rbac_role_permission(role_id, permission_id)
select role.id, permission.id
from rbac_role role
join rbac_permission permission
where role.role_key = 'ADMIN';

insert or ignore into rbac_role_permission(role_id, permission_id)
select role.id, permission.id
from rbac_role role
join rbac_permission permission
  on permission.permission_key in (
    'DASHBOARD_READ',
    'LISTING_READ',
    'LISTING_WRITE',
    'PUBLISH_RUN',
    'DATA_READ',
    'DATA_WRITE',
    'RULE_READ',
    'RULE_WRITE',
    'SYNC_RUN',
    'SYNC_READ',
    'OPERATION_LOG_READ'
  )
where role.role_key = 'OPERATOR';

insert or ignore into rbac_role_permission(role_id, permission_id)
select role.id, permission.id
from rbac_role role
join rbac_permission permission
  on permission.permission_key in (
    'DASHBOARD_READ',
    'LISTING_READ',
    'DATA_READ',
    'RULE_READ',
    'SYNC_READ',
    'OPERATION_LOG_READ'
  )
where role.role_key = 'VIEWER';
