-- postgres-only
alter table deepdraw_metadata_sync_job
  add column if not exists worker_id text;

alter table deepdraw_metadata_sync_job
  add column if not exists heartbeat_at timestamptz;

create index if not exists idx_deepdraw_metadata_sync_job_claim
  on deepdraw_metadata_sync_job(status, heartbeat_at, created_at);
