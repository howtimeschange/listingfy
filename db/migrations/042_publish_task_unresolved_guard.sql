-- postgres-only
drop index if exists ux_listing_publish_task_active_listing;

do $$
begin
  if exists (
    select 1
    from listing_publish_task
    where status in ('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN')
    group by platform, listing_id, task_type
    having count(*) > 1
  ) then
    raise exception 'Cannot enable unresolved publish guard: duplicate unresolved publish tasks require manual review';
  end if;
end
$$;

create unique index ux_listing_publish_task_active_listing
  on listing_publish_task(platform, listing_id, task_type)
  where status in ('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN');
