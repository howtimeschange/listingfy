create table if not exists mdm_shein_category_ai_suggestion (
  id integer primary key autoincrement,
  match_key text not null,
  status text not null,
  confidence real not null,
  shein_category_id integer,
  shein_product_type_id integer,
  payload_json text not null,
  group_payload_json text not null,
  provider_payload_json text not null default '{}',
  review_status text not null default 'PENDING',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check(review_status in ('PENDING', 'CONFIRMED', 'DISMISSED'))
);

create unique index if not exists ux_mdm_shein_category_ai_suggestion_match_key
  on mdm_shein_category_ai_suggestion(match_key);

create index if not exists idx_mdm_shein_category_ai_suggestion_review
  on mdm_shein_category_ai_suggestion(review_status, updated_at);
