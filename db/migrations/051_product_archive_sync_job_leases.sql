-- postgres-only
alter table product_archive_sync_job
  add column if not exists lease_token text;

alter table product_archive_sync_job
  add column if not exists lease_expires_at timestamptz;

alter table product_archive_sync_job
  add column if not exists lease_version bigint not null default 0;

create index if not exists idx_product_archive_sync_job_recovery_lease
  on product_archive_sync_job(queue_name, status, lease_expires_at, created_at)
  where status in ('queued', 'running');
