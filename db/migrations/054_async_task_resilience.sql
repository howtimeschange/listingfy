-- postgres-only: fences category AI workers and hides partially imported source batches.

alter table category_ai_suggestion_job
  add column if not exists claim_token text;

alter table category_ai_suggestion_job
  add column if not exists claim_version bigint not null default 0;

alter table category_ai_suggestion_job
  add column if not exists claim_expires_at timestamptz;

create index if not exists idx_category_ai_suggestion_job_claim
  on category_ai_suggestion_job(status, claim_expires_at, created_at);

alter table product_archive_source_batch
  add column if not exists import_status text not null default 'committed';

alter table product_archive_source_batch
  add column if not exists committed_at timestamptz;

update product_archive_source_batch
set committed_at = coalesce(committed_at, created_at)
where import_status = 'committed';

alter table product_archive_source_batch
  drop constraint if exists product_archive_source_batch_import_status_check;

alter table product_archive_source_batch
  add constraint product_archive_source_batch_import_status_check
  check(import_status in ('importing', 'committed'));

create index if not exists idx_product_archive_source_batch_visible
  on product_archive_source_batch(source_type, import_status, id desc);
