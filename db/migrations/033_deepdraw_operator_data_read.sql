-- postgres-only data revision: allow DeepDraw archive operators to inspect product data.

insert into rbac_role_permission(role_id, permission_id)
select r.id, p.id
from rbac_role r
cross join rbac_permission p
where r.role_key = 'DEEPDRAW_OPERATOR'
  and p.permission_key = 'DATA_READ'
on conflict (role_id, permission_id) do nothing;
