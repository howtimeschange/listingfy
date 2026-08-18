-- postgres-only: centrally maintained shoe size-chart standards for DeepDraw archives.

create table if not exists product_archive_shoe_size_chart (
  id bigserial primary key,
  chart_code text not null unique,
  chart_name text not null,
  applicable_categories text not null,
  version_label text not null default '2025-2026',
  source_file_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_archive_shoe_size_chart_row (
  id bigserial primary key,
  chart_id bigint not null references product_archive_shoe_size_chart(id) on delete cascade,
  size_value integer not null,
  foot_length_mm numeric(7, 2) not null,
  foot_length_tolerance_mm numeric(5, 2) not null default 2,
  inner_length_mm numeric(7, 2) not null,
  age_segment text,
  reference_age text,
  reference_stage text,
  enabled boolean not null default true,
  notes text,
  created_by bigint references app_user(id) on delete set null,
  updated_by bigint references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chart_id, size_value),
  check(size_value > 0),
  check(foot_length_mm > 0),
  check(foot_length_tolerance_mm >= 0),
  check(inner_length_mm > 0)
);

create index if not exists idx_product_archive_shoe_size_chart_row_lookup
  on product_archive_shoe_size_chart_row(chart_id, enabled, size_value);

insert into product_archive_shoe_size_chart (
  chart_code,
  chart_name,
  applicable_categories,
  version_label,
  source_file_name
) values
  ('open_sandal', '前后空凉鞋', '前后空凉鞋', '2025-2026', 'Balabala脚长和鞋子内长的数据对比2025-2026.xlsx'),
  ('closed_sandal', '中空凉鞋（前后包鞋面）', '中空凉鞋（前后包鞋面）', '2025-2026', 'Balabala脚长和鞋子内长的数据对比2025-2026.xlsx'),
  ('sport_leisure', '运动/休闲/婴童/其他', '运动鞋/休闲鞋/婴童鞋/其他', '2025-2026', 'Balabala脚长和鞋子内长的数据对比2025-2026.xlsx')
on conflict (chart_code) do nothing;

with source_rows(
  chart_code,
  size_value,
  foot_length_mm,
  inner_length_mm,
  age_segment,
  reference_age,
  reference_stage
) as (
  values
    ('open_sandal', 15, 100, 107, '婴幼童（一段）', '6个月', '步前鞋'),
    ('open_sandal', 16, 105, 112, '婴幼童（一段）', '6个月', '步前鞋'),
    ('open_sandal', 17, 110, 117, '婴幼童（一段）', '6-8个月', '学步鞋'),
    ('open_sandal', 18, 115, 122, '婴幼童（一段）', '9-12个月', '学步鞋'),
    ('open_sandal', 19, 120, 127, '婴幼童（一段）', '13-16个月', '学步鞋'),
    ('open_sandal', 20, 125, 132, '婴幼童（一段）', '17-20个月', '学步鞋'),
    ('open_sandal', 21, 130, 137, '婴幼童（二段）', '21-24个月', '幼儿园小小班'),
    ('open_sandal', 22, 135, 142, '婴幼童（二段）', '25-28个月', '幼儿园小小班'),
    ('open_sandal', 23, 140, 147, '婴幼童（二段）', '29-32个月', '幼儿园小小班'),
    ('open_sandal', 24, 145, 152, '婴幼童（二段）', '3岁', '幼儿园小班'),
    ('open_sandal', 25, 150, 158.66, '婴幼童（二段）', '3岁半', '幼儿园小班'),
    ('open_sandal', 26, 160, 165.32, '婴幼童（二段）', '4岁', '幼儿园中班'),
    ('open_sandal', 27, 165, 171.98, '中小童（一段）', '4岁半', '幼儿园中班'),
    ('open_sandal', 28, 170, 178.64, '中小童（一段）', '5岁', '幼儿园中班'),
    ('open_sandal', 29, 180, 185.30, '中小童（一段）', '5岁半', '幼儿园大班'),
    ('open_sandal', 30, 185, 191.96, '中小童（一段）', '6岁', '幼儿园大班'),
    ('open_sandal', 31, 190, 198.62, '中小童（一段）', '6岁半', '幼儿园大班'),
    ('open_sandal', 32, 200, 205.28, '中小童（一段）', '7岁', '一年级'),
    ('open_sandal', 33, 205, 211.94, '中小童（一段）', '7岁半', '一年级'),
    ('open_sandal', 34, 210, 218.60, '中小童（二段）', '8岁', '二年级'),
    ('open_sandal', 35, 220, 225.26, '中小童（二段）', '8岁半', '二年级'),
    ('open_sandal', 36, 225, 231.92, '中小童（二段）', '9岁', '三年级'),
    ('open_sandal', 37, 230, 238.58, '中小童（二段）', '9岁半', '三年级'),
    ('open_sandal', 38, 240, 245.24, '中小童（二段）', '10岁', '四年级'),
    ('open_sandal', 39, 245, 251.90, '中小童（二段）', '11岁', '五年级'),
    ('open_sandal', 40, 250, 258.56, '中小童（二段）', '12岁', '六年级'),
    ('open_sandal', 41, 255, 265.22, '中小童（二段）', '13岁', '初一'),
    ('open_sandal', 42, 260, 271.88, '中小童（二段）', '14岁', '初二'),
    ('closed_sandal', 15, 100, 111, '婴幼童（一段）', '6个月', '步前鞋'),
    ('closed_sandal', 16, 105, 116, '婴幼童（一段）', '6个月', '步前鞋'),
    ('closed_sandal', 17, 110, 121, '婴幼童（一段）', '6-8个月', '学步鞋'),
    ('closed_sandal', 18, 115, 126, '婴幼童（一段）', '9-12个月', '学步鞋'),
    ('closed_sandal', 19, 120, 131, '婴幼童（一段）', '13-16个月', '学步鞋'),
    ('closed_sandal', 20, 125, 136, '婴幼童（一段）', '17-20个月', '学步鞋'),
    ('closed_sandal', 21, 130, 141, '婴幼童（二段）', '21-24个月', '幼儿园小小班'),
    ('closed_sandal', 22, 135, 146, '婴幼童（二段）', '25-28个月', '幼儿园小小班'),
    ('closed_sandal', 23, 140, 151, '婴幼童（二段）', '29-32个月', '幼儿园小小班'),
    ('closed_sandal', 24, 145, 156, '婴幼童（二段）', '3岁', '幼儿园小班'),
    ('closed_sandal', 25, 150, 162.66, '婴幼童（二段）', '3岁半', '幼儿园小班'),
    ('closed_sandal', 26, 160, 169.32, '婴幼童（二段）', '4岁', '幼儿园中班'),
    ('closed_sandal', 27, 165, 175.98, '中小童（一段）', '4岁半', '幼儿园中班'),
    ('closed_sandal', 28, 170, 182.64, '中小童（一段）', '5岁', '幼儿园中班'),
    ('closed_sandal', 29, 180, 189.30, '中小童（一段）', '5岁半', '幼儿园大班'),
    ('closed_sandal', 30, 185, 195.96, '中小童（一段）', '6岁', '幼儿园大班'),
    ('closed_sandal', 31, 190, 202.62, '中小童（一段）', '6岁半', '幼儿园大班'),
    ('closed_sandal', 32, 200, 209.28, '中小童（一段）', '7岁', '一年级'),
    ('closed_sandal', 33, 205, 215.94, '中小童（一段）', '7岁半', '一年级'),
    ('closed_sandal', 34, 210, 222.60, '中小童（二段）', '8岁', '二年级'),
    ('closed_sandal', 35, 220, 229.26, '中小童（二段）', '8岁半', '二年级'),
    ('closed_sandal', 36, 225, 235.92, '中小童（二段）', '9岁', '三年级'),
    ('closed_sandal', 37, 230, 242.58, '中小童（二段）', '9岁半', '三年级'),
    ('closed_sandal', 38, 240, 249.24, '中小童（二段）', '10岁', '四年级'),
    ('closed_sandal', 39, 245, 255.90, '中小童（二段）', '11岁', '五年级'),
    ('closed_sandal', 40, 250, 262.56, '中小童（二段）', '12岁', '六年级'),
    ('sport_leisure', 15, 100, 112, '婴幼童（一段）', '6个月', '步前鞋'),
    ('sport_leisure', 16, 105, 117, '婴幼童（一段）', '6个月', '步前鞋'),
    ('sport_leisure', 17, 110, 122, '婴幼童（一段）', '6-8个月', '学步鞋'),
    ('sport_leisure', 18, 115, 127, '婴幼童（一段）', '9-12个月', '学步鞋'),
    ('sport_leisure', 19, 120, 132, '婴幼童（一段）', '13-16个月', '学步鞋'),
    ('sport_leisure', 20, 125, 137, '婴幼童（一段）', '17-20个月', '学步鞋'),
    ('sport_leisure', 21, 130, 142, '婴幼童（二段）', '21-24个月', '幼儿园小小班'),
    ('sport_leisure', 22, 135, 147, '婴幼童（二段）', '25-28个月', '幼儿园小小班'),
    ('sport_leisure', 23, 140, 152, '婴幼童（二段）', '29-32个月', '幼儿园小小班'),
    ('sport_leisure', 24, 145, 157, '婴幼童（二段）', '3岁', '幼儿园小班'),
    ('sport_leisure', 25, 150, 163.66, '婴幼童（二段）', '3岁半', '幼儿园小班'),
    ('sport_leisure', 26, 160, 170.32, '婴幼童（二段）', '4岁', '幼儿园中班'),
    ('sport_leisure', 27, 165, 176.98, '中小童（一段）', '4岁半', '幼儿园中班'),
    ('sport_leisure', 28, 170, 183.64, '中小童（一段）', '5岁', '幼儿园中班'),
    ('sport_leisure', 29, 180, 190.30, '中小童（一段）', '5岁半', '幼儿园大班'),
    ('sport_leisure', 30, 185, 196.96, '中小童（一段）', '6岁', '幼儿园大班'),
    ('sport_leisure', 31, 190, 203.62, '中小童（一段）', '6岁半', '幼儿园大班'),
    ('sport_leisure', 32, 200, 210.28, '中小童（一段）', '7岁', '一年级'),
    ('sport_leisure', 33, 205, 216.94, '中小童（一段）', '7岁半', '一年级'),
    ('sport_leisure', 34, 210, 223.60, '中小童（二段）', '8岁', '二年级'),
    ('sport_leisure', 35, 220, 230.26, '中小童（二段）', '8岁半', '二年级'),
    ('sport_leisure', 36, 225, 236.92, '中小童（二段）', '9岁', '三年级'),
    ('sport_leisure', 37, 230, 243.58, '中小童（二段）', '9岁半', '三年级'),
    ('sport_leisure', 38, 240, 250.24, '中小童（二段）', '10岁', '四年级'),
    ('sport_leisure', 39, 245, 256.90, '中小童（二段）', '11岁', '五年级'),
    ('sport_leisure', 40, 250, 263.56, '中小童（二段）', '12岁', '六年级'),
    ('sport_leisure', 41, 255, 270.22, '中小童（二段）', '13岁', '初一'),
    ('sport_leisure', 42, 260, 276.88, '中小童（二段）', '14岁', '初二')
)
insert into product_archive_shoe_size_chart_row (
  chart_id,
  size_value,
  foot_length_mm,
  inner_length_mm,
  age_segment,
  reference_age,
  reference_stage
)
select
  chart.id,
  source_rows.size_value,
  source_rows.foot_length_mm,
  source_rows.inner_length_mm,
  source_rows.age_segment,
  source_rows.reference_age,
  source_rows.reference_stage
from source_rows
join product_archive_shoe_size_chart chart on chart.chart_code = source_rows.chart_code
on conflict (chart_id, size_value) do nothing;
