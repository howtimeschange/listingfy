alter table listing_batch add column last_status_synced_at text;
alter table listing_batch add column publish_status_summary_json text not null default '{}';
