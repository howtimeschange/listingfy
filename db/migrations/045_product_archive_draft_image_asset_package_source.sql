-- postgres-only schema revision: distinguishes Crawshrimp DeepDraw asset packages from generic SPU image uploads.

alter table product_archive_draft_image
  drop constraint if exists product_archive_draft_image_source_type_check;

alter table product_archive_draft_image
  add constraint product_archive_draft_image_source_type_check
  check(source_type in ('manual_upload', 'batch_upload', 'crawshrimp_asset_package'));
