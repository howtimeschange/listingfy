with ranked_active_publish as (
  select
    id,
    row_number() over (
      partition by platform, listing_id, task_type
      order by id desc
    ) as active_rank
  from listing_publish_task
  where status = 'PUBLISHING'
)
update listing_publish_task
set status = 'PUBLISH_FAILED',
  error_code = 'DUPLICATE_ACTIVE_TASK',
  error_message = '迁移时关闭重复的发布中任务，请核实平台状态。',
  retryable = 0,
  finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
where id in (
  select id
  from ranked_active_publish
  where active_rank > 1
);

create unique index if not exists ux_listing_publish_task_active_listing
  on listing_publish_task(platform, listing_id, task_type)
  where status = 'PUBLISHING';
