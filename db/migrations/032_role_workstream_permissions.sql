-- postgres-only data revision: split operators by DeepDraw archive and SHEIN workstreams.

insert into rbac_role(role_key, role_name, description, is_system) values
  ('DEEPDRAW_OPERATOR', '深绘建档运营', '可处理深绘商品建档草稿、上市计划、字段规则和深绘类目字段，不具备 SHEIN 上新/平台运营权限。', 1),
  ('SHEIN_OPERATOR', 'SHEIN 运营', '可处理 SHEIN 上新、发布、平台商品运营、规则维护和同步任务，不具备深绘建档链路权限。', 1)
on conflict (role_key) do update set
  role_name = excluded.role_name,
  description = excluded.description,
  is_system = excluded.is_system;

update rbac_role
set
  role_name = '旧运营（已停用）',
  description = '历史兼容角色，请改用 SHEIN 运营或深绘建档运营。'
where role_key = 'OPERATOR';

insert into app_user_role(user_id, role_id)
select user_role.user_id, shein_role.id
from app_user_role user_role
join rbac_role old_role on old_role.id = user_role.role_id
join rbac_role shein_role on shein_role.role_key = 'SHEIN_OPERATOR'
where old_role.role_key = 'OPERATOR'
  and not exists (
    select 1
    from app_user_role existing
    where existing.user_id = user_role.user_id
      and existing.role_id = shein_role.id
  );

delete from rbac_role_permission role_permission
using rbac_role role
where role_permission.role_id = role.id
  and role.role_key in ('OPERATOR', 'DEEPDRAW_OPERATOR', 'SHEIN_OPERATOR');

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'ADMIN'
on conflict (role_id, permission_id) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'DEEPDRAW_OPERATOR'
  and p.permission_key in (
    'DASHBOARD_READ',
    'PRODUCT_ARCHIVE_DRAFT_READ',
    'PRODUCT_ARCHIVE_DRAFT_WRITE',
    'PRODUCT_ARCHIVE_DRAFT_APPROVE',
    'PRODUCT_ARCHIVE_DRAFT_SUBMIT',
    'PRODUCT_ARCHIVE_RULE_MANAGE',
    'DEEPDRAW_METADATA_MANAGE'
  )
on conflict (role_id, permission_id) do nothing;

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'VIEWER'
  and p.permission_key in (
    'DASHBOARD_READ',
    'LISTING_READ',
    'DATA_READ',
    'RULE_READ',
    'SYNC_READ',
    'OPERATION_LOG_READ',
    'PRODUCT_ARCHIVE_DRAFT_READ'
  )
  and not exists (
    select 1
    from rbac_role_permission existing
    where existing.role_id = r.id
      and existing.permission_id = p.id
  );

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'SHEIN_OPERATOR'
  and p.permission_key in (
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
  and not exists (
    select 1
    from rbac_role_permission existing
    where existing.role_id = r.id
      and existing.permission_id = p.id
  );
