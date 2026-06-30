-- Stores the configurable singleton schedule for SHEIN platform product detail sync.

create table if not exists shein_platform_product_sync_schedule (
  id text primary key default 'default',
  enabled integer not null default 1,
  schedule_hour integer not null default 23,
  sync_scope text not null default 'full',
  spu_names_json text not null default '[]',
  last_enqueued_date text,
  last_enqueued_job_id text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(enabled in (0, 1)),
  check(schedule_hour >= 0 and schedule_hour <= 23),
  check(sync_scope in ('full', 'spu'))
);

insert into shein_platform_product_sync_schedule (
  id,
  enabled,
  schedule_hour,
  sync_scope,
  spu_names_json
)
values ('default', 1, 23, 'full', '[]')
on conflict(id) do nothing;
