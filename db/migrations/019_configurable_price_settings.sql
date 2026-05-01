create table if not exists shein_price_config (
  id integer primary key check (id = 1),
  default_discount numeric not null default 0.4,
  usd_exchange_rate numeric not null default 7.3,
  note text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

insert into shein_price_config (
  id,
  default_discount,
  usd_exchange_rate,
  note
)
select 1, 0.4, 7.3, 'SHEIN 默认价格参数'
where not exists (select 1 from shein_price_config where id = 1);
