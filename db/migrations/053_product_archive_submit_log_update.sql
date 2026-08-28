-- postgres-only: allow audited DeepDraw product update submissions.

alter table product_archive_submit_log
  drop constraint if exists product_archive_submit_log_operation_check;

alter table product_archive_submit_log
  add constraint product_archive_submit_log_operation_check
  check(operation in ('search', 'create', 'update', 'resource', 'dry_run'));
