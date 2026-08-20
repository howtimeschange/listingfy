create view if not exists v_latest_product_content_package as
with ranked as (
  select
    id,
    row_number() over (
      partition by spu_code
      order by coalesce(updated_at, synced_at) desc nulls last, id desc
    ) as latest_rank
  from product_content_package
)
select pkg.*
from product_content_package pkg
join ranked
  on ranked.id = pkg.id
where ranked.latest_rank = 1;
