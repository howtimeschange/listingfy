-- postgres-only: follow-up performance structures split from early 055 for environments that already registered it.

alter table product_archive_source_batch
  add column if not exists import_fingerprint text;

create unique index if not exists ux_product_archive_source_batch_import_fingerprint
  on product_archive_source_batch(import_fingerprint)
  where import_fingerprint is not null;

alter table listing_launch_plan_import
  add column if not exists import_fingerprint text;

create unique index if not exists ux_listing_launch_plan_import_fingerprint
  on listing_launch_plan_import(import_fingerprint)
  where import_fingerprint is not null;

create table if not exists product_archive_draft_preparation (
  draft_id bigint primary key references product_archive_draft(id) on delete cascade,
  draft_updated_at timestamptz not null,
  input_hash text not null,
  template_version text not null default '',
  submit_mode text not null,
  payload_json jsonb not null,
  validation_json jsonb not null default '{}'::jsonb,
  prepared_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  unique(draft_id, input_hash, submit_mode)
);

create index if not exists idx_product_archive_draft_preparation_expiry
  on product_archive_draft_preparation(expires_at);

create table if not exists product_archive_sync_negative_cache (
  source text not null,
  spu_code text not null,
  reason_code text not null,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(source, spu_code)
);

create index if not exists idx_product_archive_sync_negative_cache_expiry
  on product_archive_sync_negative_cache(expires_at);

create table if not exists listing_launch_plan_spu_latest (
  spu_code text primary key,
  import_id bigint not null references listing_launch_plan_import(id) on delete cascade,
  row_id bigint not null references listing_launch_plan_row(id) on delete cascade,
  sheet_name text not null,
  row_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists idx_listing_launch_plan_spu_latest_import
  on listing_launch_plan_spu_latest(import_id desc, spu_code);

create table if not exists listing_launch_plan_import_sheet_stat (
  import_id bigint not null references listing_launch_plan_import(id) on delete cascade,
  sheet_name text not null,
  row_count integer not null default 0,
  spu_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(import_id, sheet_name)
);

insert into listing_launch_plan_import_sheet_stat (
  import_id,
  sheet_name,
  row_count,
  spu_count,
  updated_at
)
select
  row.import_id,
  row.sheet_name,
  count(*)::integer as row_count,
  count(distinct spu_code)::integer as spu_count,
  now()
from listing_launch_plan_row row
join listing_launch_plan_import imp on imp.id = row.import_id
group by row.import_id, row.sheet_name
on conflict (import_id, sheet_name) do update set
  row_count = excluded.row_count,
  spu_count = excluded.spu_count,
  updated_at = excluded.updated_at;

insert into listing_launch_plan_spu_latest (
  spu_code,
  import_id,
  row_id,
  sheet_name,
  row_count,
  updated_at
)
select
  spu_code,
  import_id,
  id as row_id,
  sheet_name,
  row_count,
  now()
from (
  select
    row.*,
    count(*) over (partition by row.spu_code, row.import_id)::integer as row_count,
    row_number() over (partition by row.spu_code order by row.import_id desc, row.id desc) as latest_rank
  from listing_launch_plan_row row
  join listing_launch_plan_import imp on imp.id = row.import_id
) ranked
where latest_rank = 1
on conflict (spu_code) do update set
  import_id = excluded.import_id,
  row_id = excluded.row_id,
  sheet_name = excluded.sheet_name,
  row_count = excluded.row_count,
  updated_at = excluded.updated_at
where listing_launch_plan_spu_latest.import_id < excluded.import_id
  or (
    listing_launch_plan_spu_latest.import_id = excluded.import_id
    and listing_launch_plan_spu_latest.row_id < excluded.row_id
  );
