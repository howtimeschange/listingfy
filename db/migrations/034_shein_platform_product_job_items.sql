-- Stores large SHEIN platform product sync job items outside the parent job row.

create table if not exists shein_platform_product_job_item (
  id integer primary key autoincrement,
  job_id text not null,
  item_index integer not null,
  shard_index integer not null default 0,
  spu_code text not null,
  status text not null default 'queued',
  error_message text,
  result_json text not null default '{}',
  started_at text,
  finished_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  foreign key(job_id) references shein_platform_product_job(id) on delete cascade,
  unique(job_id, item_index),
  check(status in ('queued', 'running', 'completed', 'failed'))
);

create index if not exists idx_shein_platform_product_job_item_status
  on shein_platform_product_job_item(job_id, status, item_index);

create index if not exists idx_shein_platform_product_job_item_shard
  on shein_platform_product_job_item(job_id, shard_index, item_index);
