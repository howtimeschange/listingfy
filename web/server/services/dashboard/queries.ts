// Each row represents one product in its channel scope, never a publish attempt.
export const deepdrawProducts = `
with latest as (
  select distinct on (tenant_name, merchant_id, spu_code) *
  from product_archive_draft
  order by tenant_name, merchant_id, spu_code, updated_at desc, id desc
), fields as (
  select f.draft_id,
    count(*) filter (where f.required) as required_count,
    count(*) filter (where f.required and f.validation_status = 'valid') as valid_count,
    count(*) filter (where f.required and f.validation_status in ('missing', 'invalid')) as missing
  from product_archive_draft_field f join latest d on d.id = f.draft_id group by f.draft_id
), products as (
  select d.id::text as key, d.spu_code,
    coalesce(nullif(trim(d.source_snapshot_json #>> '{spu,brand_name}'), ''), nullif(trim(p.brand_name), ''), '未识别品牌') as brand,
    d.title, d.status, d.updated_at,
    d.status in ('created', 'readback_verified', 'readback_mismatch') as success,
    d.status = 'ready' as ready, d.status = 'submitting' as processing, false as submitted,
    (d.status in ('missing_fields', 'manual_review', 'duplicate_found', 'update_pending', 'readback_mismatch', 'failed')
      or coalesce((d.validation_summary_json->>'blocker_count')::int, 0) > 0
      or coalesce((d.validation_summary_json->>'warning_count')::int, 0) > 0
      or coalesce(f.missing, 0) > 0) as problem,
    100.0 * f.valid_count / nullif(f.required_count, 0) as completeness,
    coalesce(f.missing, 0) as missing,
    coalesce((d.validation_summary_json->>'warning_count')::int, 0) as warnings,
    coalesce((select string_agg(message, '；') from (
      select message from product_archive_validation_issue i where i.draft_id = d.id and i.resolved_at is null
      and i.severity in ('blocker', 'warning') order by case when i.severity = 'blocker' then 0 else 1 end, i.id limit 3
    ) reasons), '') as reason,
    '/product-archive-drafts/' || d.id as href
  from latest d left join product_spu p on p.spu_code = d.spu_code left join fields f on f.draft_id = d.id
)`

export const sheinProducts = `
with latest_task as (
  select distinct on (listing_id) listing_id, status, error_message
  from listing_publish_task where platform = 'SHEIN' order by listing_id, id desc
), listings as (
  select l.spu_code, (array_agg(l.id order by case when l.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'REVOKED', 'VALIDATION_FAILED', 'STATUS_UNKNOWN') or l.validation_status = 'FAILED' then 0 else 1 end, l.id desc))[1] as id,
    bool_and(l.status = 'APPROVED') as success,
    bool_and(l.status = 'READY_TO_PUBLISH') as ready,
    bool_or(l.status = 'PUBLISHING') as processing,
    bool_or(l.status in ('PUBLISH_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'PARTIALLY_APPROVED')) as submitted,
    bool_or(l.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'REVOKED', 'VALIDATION_FAILED', 'STATUS_UNKNOWN')
      or l.validation_status = 'FAILED') as problem,
    min(l.completeness) as completeness,
    string_agg(distinct nullif(t.error_message, ''), '；') as reason,
    max(l.updated_at) as updated_at,
    (array_agg(l.status order by case when l.status in ('PUBLISH_FAILED', 'FAILED', 'REJECTED', 'REVOKED', 'VALIDATION_FAILED', 'STATUS_UNKNOWN') then 0 else 1 end, l.id desc))[1] as status
  from listing l left join latest_task t on t.listing_id = l.id
  where l.platform = 'SHEIN' and l.status <> 'ARCHIVED' group by l.spu_code
), codes as (
  select spu_code from shein_product_bucket union select spu_code from listings
), products as (
  select c.spu_code as key, c.spu_code, coalesce(nullif(trim(p.brand_name), ''), '未识别品牌') as brand,
    coalesce(b.title_cn, p.spu_name) as title, coalesce(l.status, b.readiness_status) as status,
    greatest(l.updated_at, b.updated_at)::timestamptz as updated_at,
    coalesce(l.success, false) as success, coalesce(l.ready, b.readiness_status = 'READY', false) as ready,
    coalesce(l.processing, false) as processing, coalesce(l.submitted, false) as submitted,
    (coalesce(l.problem, false) or coalesce(b.readiness_status <> 'READY', false)
      or coalesce(l.completeness < 100, false)) as problem,
    coalesce(l.completeness, (b.raw_payload_json::jsonb #>> '{field_completeness,completeness}')::numeric) as completeness,
    coalesce((b.raw_payload_json::jsonb #>> '{field_completeness,missing_field_count}')::int, 0) as missing,
    coalesce((b.raw_payload_json::jsonb #>> '{field_completeness,needs_ai_count}')::int, 0) as warnings,
    coalesce(l.reason, '') as reason,
    case when l.id is not null then '/pre-publish-validation/' || l.id else '/shein-products' end as href
  from codes c left join shein_product_bucket b on b.spu_code = c.spu_code
  left join listings l on l.spu_code = c.spu_code left join product_spu p on p.spu_code = c.spu_code
)`

const metrics = `count(*)::int as total,
  count(*) filter (where success)::int as success,
  count(*) filter (where problem)::int as problems,
  count(*) filter (where ready and not success)::int as ready,
  count(*) filter (where processing)::int as processing,
  count(*) filter (where submitted)::int as submitted,
  round(avg(completeness), 1)::float8 as completeness,
  count(completeness)::int as assessed,
  coalesce(sum(missing), 0)::int as missing,
  coalesce(sum(warnings), 0)::int as warnings`

export function dashboardQuery(channel: "deepdraw" | "shein") {
  return `${channel === "deepdraw" ? deepdrawProducts : sheinProducts},
    selected as (select * from products where ($1::text = '' or brand = $1)),
    issues as (select * from selected where problem and ($2::text = '' or strpos(lower(spu_code), lower($2)) > 0 or strpos(lower(coalesce(title, '')), lower($2)) > 0)),
    summary as (select ${metrics} from selected),
    brands as (select brand, ${metrics} from products group by brand),
    page as (select * from issues order by updated_at desc, key limit 10 offset $3)
    select row_to_json(summary) as summary,
      coalesce((select json_agg(brands order by total desc, brand) from brands), '[]'::json) as brands,
      coalesce((select json_agg(page order by updated_at desc, key) from page), '[]'::json) as issues,
      (select count(*)::int from issues) as issue_count,
      (select max(updated_at) from selected) as source_updated_at
    from summary`
}
