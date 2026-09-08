-- Query errors do not change the last confirmed publish/audit state.
alter table listing_publish_task add column status_sync_error_code text;
alter table listing_publish_task add column status_sync_error_message text;
alter table listing_publish_task add column status_sync_attempted_at text;
