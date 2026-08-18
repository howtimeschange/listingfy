-- postgres-only schema revision: stores one idempotent MDM main image per DeepDraw archive draft.

alter table product_archive_draft_image
  drop constraint if exists product_archive_draft_image_source_type_check;

alter table product_archive_draft_image
  add constraint product_archive_draft_image_source_type_check
  check(source_type in ('manual_upload', 'batch_upload', 'crawshrimp_asset_package', 'mdm_main_image'));

-- Unique draft_id + source_type ownership keeps repeated MDM synchronization idempotent.
create unique index if not exists idx_product_archive_draft_image_mdm_main_unique
  on product_archive_draft_image(draft_id, source_type)
  where source_type = 'mdm_main_image';
