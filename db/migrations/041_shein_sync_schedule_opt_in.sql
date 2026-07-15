-- postgres-only
alter table shein_platform_product_sync_schedule
  alter column enabled set default 0;

update shein_platform_product_sync_schedule
set enabled = 0,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
where id = 'default'
  and enabled = 1
  and last_enqueued_date is null;
