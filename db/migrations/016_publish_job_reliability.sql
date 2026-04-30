alter table listing_publish_task add column idempotency_key text;
alter table listing_publish_task add column next_retry_at text;
alter table listing_publish_task add column last_retry_at text;
alter table listing_publish_task add column failure_category text;
alter table listing_publish_task add column failure_fingerprint text;
alter table listing_publish_task add column retryable integer not null default 0;
alter table listing_publish_task add column last_status_synced_at text;

create unique index if not exists ux_listing_publish_task_idempotency
  on listing_publish_task(platform, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_listing_publish_task_retry
  on listing_publish_task(status, retryable, next_retry_at);
