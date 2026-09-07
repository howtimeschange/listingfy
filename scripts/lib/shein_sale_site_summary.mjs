const SUMMARY_CANDIDATES_SQL = `
  select platform, platform_account_key, site_abbr, max(site_name) as site_name
  from (
    select platform, platform_account_key, site_abbr, site_name
    from shein_platform_sale_site_summary
    union all
    select platform, platform_account_key, site_abbr, site_name
    from shein_platform_product_sale_site
    where shelf_status = 1
  ) candidate
  group by platform, platform_account_key, site_abbr
  order by platform, platform_account_key, site_abbr
`

export const SHEIN_SALE_SITE_SUMMARY_MISMATCH_SQL = `
  with actual as (
    select
      platform,
      platform_account_key,
      site_abbr,
      count(distinct product_id)::integer as active_product_count
    from shein_platform_product_sale_site
    where shelf_status = 1
    group by platform, platform_account_key, site_abbr
  )
  select
    coalesce(summary.platform, actual.platform) as platform,
    coalesce(summary.platform_account_key, actual.platform_account_key) as platform_account_key,
    coalesce(summary.site_abbr, actual.site_abbr) as site_abbr,
    coalesce(summary.active_product_count, 0)::integer as summary_count,
    coalesce(actual.active_product_count, 0)::integer as actual_count
  from shein_platform_sale_site_summary summary
  full outer join actual
    on actual.platform = summary.platform
    and actual.platform_account_key = summary.platform_account_key
    and actual.site_abbr = summary.site_abbr
  where coalesce(summary.active_product_count, 0) <> coalesce(actual.active_product_count, 0)
  order by platform, platform_account_key, site_abbr
`

export async function reconcileSheinSaleSiteSummary(pool) {
  const client = await pool.connect()
  try {
    await client.query("begin")
    const candidates = await client.query(SUMMARY_CANDIDATES_SQL)
    for (const candidate of candidates.rows) {
      const params = [
        candidate.platform,
        candidate.platform_account_key,
        candidate.site_abbr,
        candidate.site_name || null,
      ]
      await client.query(`
        insert into shein_platform_sale_site_summary (
          platform,
          platform_account_key,
          site_abbr,
          site_name,
          active_product_count,
          updated_at
        )
        values ($1, $2, $3, $4, 0, to_char((clock_timestamp() at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        on conflict (platform, platform_account_key, site_abbr) do nothing
      `, params)
      await client.query(`
        select 1
        from shein_platform_sale_site_summary
        where platform = $1
          and platform_account_key = $2
          and site_abbr = $3
        for update
      `, params.slice(0, 3))
      await client.query(`
        update shein_platform_sale_site_summary summary
        set site_name = coalesce(nullif($4, ''), summary.site_name),
          active_product_count = (
            select count(distinct detail.product_id)::integer
            from shein_platform_product_sale_site detail
            where detail.platform = $1
              and detail.platform_account_key = $2
              and detail.site_abbr = $3
              and detail.shelf_status = 1
          ),
          updated_at = to_char((clock_timestamp() at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        where summary.platform = $1
          and summary.platform_account_key = $2
          and summary.site_abbr = $3
      `, params)
    }
    const mismatch = await client.query(SHEIN_SALE_SITE_SUMMARY_MISMATCH_SQL)
    if (mismatch.rows.length) {
      throw new Error(`SHEIN sale-site summary reconciliation mismatch: ${JSON.stringify(mismatch.rows)}`)
    }
    await client.query("commit")
    return { siteCount: candidates.rows.length, mismatchCount: 0 }
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}
