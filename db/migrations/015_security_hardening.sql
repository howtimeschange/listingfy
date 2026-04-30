alter table app_user add column failed_login_count integer not null default 0;
alter table app_user add column locked_until text;

create index if not exists idx_app_user_login_lock
  on app_user(status, locked_until, failed_login_count);
