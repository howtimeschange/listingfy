-- postgres-only schema revision: stores operator-uploaded reference images for DeepDraw archive drafts.

create table if not exists product_archive_draft_image (
  id bigserial primary key,
  draft_id bigint not null references product_archive_draft(id) on delete cascade,
  spu_code text not null,
  source_type text not null default 'manual_upload',
  source_ref text,
  local_path text not null,
  file_name text not null,
  original_file_name text,
  mime_type text,
  file_size integer,
  width integer,
  height integer,
  sort_no integer not null default 1,
  uploaded_by integer references app_user(id) on delete set null,
  raw_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(source_type in ('manual_upload', 'batch_upload'))
);

create index if not exists idx_product_archive_draft_image_draft
  on product_archive_draft_image(draft_id, sort_no, id);

create index if not exists idx_product_archive_draft_image_spu
  on product_archive_draft_image(spu_code, created_at desc);
