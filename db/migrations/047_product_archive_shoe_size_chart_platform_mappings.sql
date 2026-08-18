-- postgres-only: preserve the channel-specific text mappings from the Balabala data-conversion sheet.

alter table product_archive_shoe_size_chart_row
  add column if not exists general_mapping_text text,
  add column if not exists douyin_mapping_text text,
  add column if not exists vip_mapping_text text,
  add column if not exists video_pdd_vip_mapping_text text,
  add column if not exists pinduoduo_mapping_text text;

comment on column product_archive_shoe_size_chart_row.general_mapping_text is '数据转化 sheet 的脚长内长上新列，即通用口径';
comment on column product_archive_shoe_size_chart_row.douyin_mapping_text is '数据转化 sheet 的抖音口径';
comment on column product_archive_shoe_size_chart_row.vip_mapping_text is '数据转化 sheet 的唯品口径';
comment on column product_archive_shoe_size_chart_row.video_pdd_vip_mapping_text is '数据转化 sheet 的视频号/拼多多/唯品会兼容渠道口径';
comment on column product_archive_shoe_size_chart_row.pinduoduo_mapping_text is '数据转化 sheet 的拼多多口径';

with formatted as (
  select
    row.id,
    chart.chart_code,
    row.size_value::text || '码' as size_label,
    regexp_replace(to_char(round((row.foot_length_mm - row.foot_length_tolerance_mm) / 10, 1), 'FM999990.0'), '\.0$', '')
      || '-'
      || regexp_replace(to_char(round((row.foot_length_mm + row.foot_length_tolerance_mm) / 10, 1), 'FM999990.0'), '\.0$', '') as foot_range_cm,
    regexp_replace(to_char(round(row.foot_length_mm / 10, 1), 'FM999990.0'), '\.0$', '') as foot_length_cm,
    regexp_replace(to_char(round(row.inner_length_mm / 10, 1), 'FM999990.0'), '\.0$', '') as inner_length_cm
  from product_archive_shoe_size_chart_row row
  join product_archive_shoe_size_chart chart on chart.id = row.chart_id
), mapping_values as (
  select
    id,
    '(' || '脚长' || foot_range_cm || '/' || '内长' || inner_length_cm || ')' as general_mapping_text,
    '脚长' || foot_range_cm || '/' || '内长' || inner_length_cm as douyin_mapping_text,
    size_label || '(' || '脚长' || foot_length_cm || '/' || '内长' || inner_length_cm || ')' as vip_mapping_text,
    case when chart_code = 'sport_leisure'
      then size_label || '(' || '脚长' || foot_range_cm || '/' || '内长' || inner_length_cm || ')'
      else null
    end as video_pdd_vip_mapping_text,
    case when chart_code = 'sport_leisure'
      then size_label || '脚长' || foot_range_cm || '/' || '内长' || inner_length_cm
      else null
    end as pinduoduo_mapping_text
  from formatted
)
update product_archive_shoe_size_chart_row row set
  general_mapping_text = coalesce(row.general_mapping_text, mapping_values.general_mapping_text),
  douyin_mapping_text = coalesce(row.douyin_mapping_text, mapping_values.douyin_mapping_text),
  vip_mapping_text = coalesce(row.vip_mapping_text, mapping_values.vip_mapping_text),
  video_pdd_vip_mapping_text = coalesce(row.video_pdd_vip_mapping_text, mapping_values.video_pdd_vip_mapping_text),
  pinduoduo_mapping_text = coalesce(row.pinduoduo_mapping_text, mapping_values.pinduoduo_mapping_text)
from mapping_values
where mapping_values.id = row.id;
