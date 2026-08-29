import { randomUUID } from "node:crypto"
import { Hono } from "hono"
import { getDb } from "../db"
import { routePermissionGuard } from "../lib/auth"
import { uniqueStrings } from "../services/pre-publish/shared"
import { resolveSheinKidsCategoryFallback } from "../services/pre-publish/category-fallback"
import { refreshBucketProduct } from "./shein-products"
import { withBackgroundTaskSlot } from "../lib/background-task-limiter"
import {
  buildCategoryMatchPrompt,
  callAiCategoryMatcher,
} from "../../../scripts/lib/ai_category_matcher.mjs"
import { getDefaultAiScenarioRouter } from "../../../scripts/lib/ai_routing_context.mjs"

const categoryMapping = new Hono()
categoryMapping.use("*", routePermissionGuard("RULE_READ", "RULE_WRITE"))
const AI_CATEGORY_CANDIDATE_LIMIT = 20
const DEFAULT_CATEGORY_AI_CLAIM_MS = 10 * 60 * 1000
const MAX_CATEGORY_AI_CLAIM_MS = 60 * 60 * 1000

type MappingRuleBody = {
  mdm_middle_category_code?: string | null
  mdm_middle_category_name?: string | null
  mdm_small_category_code?: string | null
  mdm_small_category_name?: string | null
  gender_code?: string | null
  gender_name?: string | null
  age_group_code?: string | null
  age_group_name?: string | null
  match_mode?: string | null
  match_key?: string | null
  shein_category_id?: number | null
  shein_product_type_id?: number | null
  priority?: number | null
  status?: string | null
  source?: string | null
  note?: string | null
  dimension_payload_json?: string | null
}

type CategoryCandidate = {
  category_id: number
  product_type_id: number
  category_name: string
  path: string
  attr_count?: number
  required_count?: number
}

type UnmappedGroup = {
  match_key: string
  mdm_middle_category_code: string | null
  mdm_middle_category_name: string
  mdm_small_category_code: string | null
  mdm_small_category_name: string
  gender_code: string | null
  gender_name: string | null
  age_group_code: string | null
  age_group_name: string | null
  spec_range: string | null
  fabric_type_name: string | null
  model_name: string | null
  length_name: string | null
  deepdraw_category_name: string | null
  deepdraw_title: string | null
  trade_path: string | null
  spus: string[]
  spu_count: number
  skc_examples: SkcExample[]
}

type SkcExample = {
  spu_code: string
  skc_code: string
  color_code: string | null
  color_name: string | null
  mdm_image_url: string | null
  tmall_color_image_url: string | null
}

type CategoryAiSuggestionRequest = {
  limit?: number
  dry_run?: boolean
  spu_codes?: unknown
}

type CategoryAiSuggestionResponse = {
  groups: UnmappedGroup[]
  candidates: CategoryCandidate[]
  suggestions: Array<Record<string, unknown>>
  requested_spu_codes: string[]
  provider?: unknown
  prompt?: string
  refreshed_spu_codes?: string[]
}

type CategoryAiSuggestionJobItem = {
  spu_code: string
  status: "queued" | "running" | "completed" | "failed"
  error?: string | null
}

type CategoryAiSuggestionJob = {
  id: string
  status: "queued" | "running" | "completed"
  total_count: number
  completed_count: number
  failed_count: number
  limit: number
  requested_spu_codes: string[]
  refreshed_spu_codes: string[]
  items: CategoryAiSuggestionJobItem[]
  groups: UnmappedGroup[]
  candidates: CategoryCandidate[]
  suggestions: Array<Record<string, unknown>>
  provider?: unknown
  error?: string | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  updated_at: string
}

type CategoryAiJobClaim = {
  token: string
  version: number
}

const categoryAiPending: string[] = []
let categoryAiRunning = false
let categoryAiScheduled = false

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function buildMatchKey(input: {
  mdm_middle_category_name?: unknown
  mdm_small_category_name?: unknown
  gender_name?: unknown
  age_group_name?: unknown
}) {
  return [
    normalizeText(input.mdm_middle_category_name),
    normalizeText(input.mdm_small_category_name),
    normalizeText(input.gender_name),
    normalizeText(input.age_group_name),
  ].join("|")
}

function readLimit(value: string | undefined, fallback = 50, max = 200) {
  const limit = Number(value ?? fallback)
  if (!Number.isFinite(limit)) return fallback
  return Math.max(1, Math.min(max, Math.floor(limit)))
}

function readOffset(value: string | undefined) {
  const offset = Number(value ?? 0)
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, Math.floor(offset))
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>
  if (typeof value !== "string" || !value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function toUnmappedGroup(row: Record<string, unknown>): UnmappedGroup {
  return {
    match_key: buildMatchKey(row),
    mdm_middle_category_code: row.mdm_middle_category_code as string | null,
    mdm_middle_category_name: normalizeText(row.mdm_middle_category_name),
    mdm_small_category_code: row.mdm_small_category_code as string | null,
    mdm_small_category_name: normalizeText(row.mdm_small_category_name),
    gender_code: row.gender_code as string | null,
    gender_name: row.gender_name as string | null,
    age_group_code: row.age_group_code as string | null,
    age_group_name: row.age_group_name as string | null,
    spec_range: row.spec_range as string | null,
    fabric_type_name: row.fabric_type_name as string | null,
    model_name: row.model_name as string | null,
    length_name: row.length_name as string | null,
    deepdraw_category_name: row.deepdraw_category_name as string | null,
    deepdraw_title: row.deepdraw_title as string | null,
    trade_path: row.trade_path as string | null,
    spus: parseJsonArray(row.spus).map((item) => String(item)),
    spu_count: Number(row.spu_count ?? 0),
    skc_examples: [],
  }
}

function categoryFallbackInputForGroup(group: UnmappedGroup) {
  return {
    ...group,
    middle_class_name: group.mdm_middle_category_name,
    subclass_name: group.mdm_small_category_name,
    deepdraw_trade_path: group.trade_path,
  }
}

function filterGroupsWithoutCodeFallback(groups: UnmappedGroup[]) {
  return groups.filter((group) => !resolveSheinKidsCategoryFallback(categoryFallbackInputForGroup(group)))
}

function collectCandidateKeywords(groups: UnmappedGroup[]) {
  const keywords = new Set<string>()
  for (const group of groups) {
    for (const value of [
      group.mdm_middle_category_name,
      group.mdm_small_category_name,
      group.deepdraw_category_name,
      group.deepdraw_title,
    ]) {
      const text = normalizeText(value)
      if (!text) continue
      if (text.includes("T恤") || /t恤/i.test(text)) keywords.add("T恤")
      if (text.includes("卫衣")) keywords.add("卫衣")
      if (text.includes("外套")) keywords.add("外套")
      if (text.includes("裤")) keywords.add("裤")
      if (text.includes("衬衫")) keywords.add("衬衫")
      if (text.includes("连衣裙")) keywords.add("连衣裙")
      if (text.includes("毛衫") || text.includes("毛衣")) keywords.add("毛衣")
      if (text.includes("开襟")) keywords.add("开襟")
      if (text.includes("针织")) keywords.add("针织")
      if (text.includes("牛仔")) keywords.add("牛仔")
      if (text.includes("套装")) keywords.add("套装")
      if (text.includes("泳")) keywords.add("泳")
    }
  }
  if (keywords.size === 0) {
    keywords.add("T恤")
    keywords.add("卫衣")
    keywords.add("外套")
    keywords.add("裤")
    keywords.add("衬衫")
    keywords.add("连衣裙")
    keywords.add("毛衣")
    keywords.add("开襟")
    keywords.add("针织")
  }
  return [...keywords]
}

function listUnmappedGroups(db: ReturnType<typeof getDb>, limit: number, spuCodes: string[] = []) {
  const queryLimit = Math.max(limit, Math.min(500, limit * 5))
  const spuFilter = spuCodes.length
    ? `and spu.spu_code in (${spuCodes.map(() => "?").join(",")})`
    : ""
  const rows = db.prepare(`
    with grouped as (
      select
        spu.middle_class_code as mdm_middle_category_code,
        coalesce(spu.middle_class_name, '') as mdm_middle_category_name,
        spu.subclass_code as mdm_small_category_code,
        coalesce(spu.subclass_name, '') as mdm_small_category_name,
        spu.gender_code,
        spu.gender_name,
        spu.age_group_code,
        spu.age_group_name,
        group_concat(distinct spu.spec_range) as spec_range,
        group_concat(distinct spu.fabric_type_name) as fabric_type_name,
        group_concat(distinct spu.model_name) as model_name,
        group_concat(distinct spu.length_name) as length_name,
        group_concat(distinct pkg.category_name) as deepdraw_category_name,
        group_concat(distinct pkg.title) as deepdraw_title,
        group_concat(distinct pkg.trade_path) as trade_path,
        json_group_array(distinct spu.spu_code) as spus,
        count(distinct spu.spu_code) as spu_count
      from product_spu spu
      left join v_latest_product_content_package pkg on pkg.spu_code = spu.spu_code
      where coalesce(spu.subclass_name, '') <> ''
        ${spuFilter}
      group by
        spu.middle_class_code,
        spu.middle_class_name,
        spu.subclass_code,
        spu.subclass_name,
        spu.gender_code,
        spu.gender_name,
        spu.age_group_code,
        spu.age_group_name
    )
    select *
    from grouped
    where not exists (
      select 1
      from mdm_shein_category_mapping_rule rule
      where rule.status = 'ACTIVE'
        and rule.match_mode = 'EXACT'
        and rule.match_key = (
          coalesce(grouped.mdm_middle_category_name, '') || '|' ||
          coalesce(grouped.mdm_small_category_name, '') || '|' ||
          coalesce(grouped.gender_name, '') || '|' ||
          coalesce(grouped.age_group_name, '')
        )
    )
      and not exists (
        select 1
        from mdm_shein_category_mapping_rule rule
        where rule.status = 'ACTIVE'
          and rule.match_mode = 'FALLBACK'
          and rule.mdm_small_category_name = grouped.mdm_small_category_name
      )
    order by spu_count desc, mdm_middle_category_name, mdm_small_category_name
    limit ?
  `).all(...spuCodes, queryLimit) as Record<string, unknown>[]

  return filterGroupsWithoutCodeFallback(rows.map(toUnmappedGroup)).slice(0, limit)
}

function listSkcExamplesForGroup(
  db: ReturnType<typeof getDb>,
  group: UnmappedGroup,
  limit = 12,
): SkcExample[] {
  const spus = group.spus.filter(Boolean)
  if (spus.length === 0) return []

  const placeholders = spus.map(() => "?").join(", ")
  return db.prepare(`
    select
      spu.spu_code,
      skc.skc_code,
      skc.color_code,
      skc.color_name,
      skc.pic_url as mdm_image_url,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.spu_code = spu.spu_code
          and asset.skc_code = skc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR_BLOCK'
          and asset.picture_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_image_url
    from product_skc skc
    join product_spu spu on spu.id = skc.spu_id
    where spu.spu_code in (${placeholders})
    order by spu.spu_code, skc.skc_code
    limit ?
  `).all(...spus, limit) as SkcExample[]
}

function attachSkcExamples(
  db: ReturnType<typeof getDb>,
  groups: UnmappedGroup[],
) {
  return groups.map((group) => ({
    ...group,
    skc_examples: listSkcExamplesForGroup(db, group),
  }))
}

function listCategoryCandidates(db: ReturnType<typeof getDb>, groups: UnmappedGroup[]) {
  const keywords = collectCandidateKeywords(groups)
  const where = keywords.map(() => "(category_name like ? or path like ?)").join(" or ")
  const params = keywords.flatMap((keyword) => [`%${keyword}%`, `%${keyword}%`])
  const rows = db.prepare(`
    select category_id, product_type_id, category_name, path, attr_count, required_count
    from v_shein_leaf_category
    where root_category_name in ('儿童', '婴儿')
      and (${where})
    order by
      case
        when path like '儿童 > 女童（小）%' then 0
        when path like '儿童 > 男童（小）%' then 1
        when path like '婴儿 > 婴童%' then 2
        when path like '儿童 > 女童（大）%' then 3
        when path like '儿童 > 男童（大）%' then 4
        else 9
      end,
      path
    limit 180
  `).all(...params) as CategoryCandidate[]

  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.category_id}:${row.product_type_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function enrichSuggestions({
  groups,
  suggestions,
}: {
  groups: UnmappedGroup[]
  suggestions: Array<Record<string, unknown>>
}) {
  const groupByKey = new Map(groups.map((group) => [group.match_key, group]))
  return suggestions.map((suggestion) => ({
    ...suggestion,
    group: groupByKey.get(String(suggestion.match_key)) ?? null,
  }))
}

function persistAiSuggestions({
  db,
  groups,
  suggestions,
  provider,
}: {
  db: ReturnType<typeof getDb>
  groups: UnmappedGroup[]
  suggestions: Array<Record<string, unknown>>
  provider?: unknown
}) {
  const groupByKey = new Map(groups.map((group) => [group.match_key, group]))
  const stmt = db.prepare(`
    insert into mdm_shein_category_ai_suggestion (
      match_key,
      status,
      confidence,
      shein_category_id,
      shein_product_type_id,
      payload_json,
      group_payload_json,
      provider_payload_json,
      review_status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(match_key) do update set
      status = excluded.status,
      confidence = excluded.confidence,
      shein_category_id = excluded.shein_category_id,
      shein_product_type_id = excluded.shein_product_type_id,
      payload_json = excluded.payload_json,
      group_payload_json = excluded.group_payload_json,
      provider_payload_json = excluded.provider_payload_json,
      review_status = case
        when mdm_shein_category_ai_suggestion.review_status = 'CONFIRMED' then 'CONFIRMED'
        else 'PENDING'
      end,
      updated_at = excluded.updated_at
  `)

  for (const suggestion of suggestions) {
    const matchKey = String(suggestion.match_key ?? "")
    if (!matchKey) continue
    const primary = parseJsonObject(suggestion.primary)
    stmt.run(
      matchKey,
      String(suggestion.status ?? "READY"),
      Number(suggestion.confidence ?? 0),
      primary.category_id ?? null,
      primary.product_type_id ?? null,
      JSON.stringify(suggestion),
      JSON.stringify(groupByKey.get(matchKey) ?? null),
      JSON.stringify(provider ?? {}),
    )
  }
}

function listPersistedAiSuggestions(db: ReturnType<typeof getDb>, limit: number) {
  const rows = db.prepare(`
    select *
    from mdm_shein_category_ai_suggestion
    where review_status = 'PENDING'
    order by updated_at desc, id desc
    limit ?
  `).all(limit) as Array<Record<string, unknown>>

  const suggestions = rows.map((row) => {
    const suggestion = parseJsonObject(row.payload_json)
    const group = parseJsonObject(row.group_payload_json)
    return {
      ...suggestion,
      persisted_id: row.id,
      review_status: row.review_status,
      group,
    }
  })

  return {
    groups: suggestions.map((item) => item.group).filter(Boolean),
    candidates: [],
    suggestions,
  }
}

function readCategoryAiSuggestionRequest(
  body: CategoryAiSuggestionRequest,
  queryLimit: string | undefined,
) {
  const limit = readLimit(String(body.limit ?? queryLimit ?? 20), 20, 50)
  const rawSpuCodes = Array.isArray(body.spu_codes) ? body.spu_codes : []
  return {
    limit,
    dryRun: Boolean(body.dry_run),
    spuCodes: uniqueStrings(rawSpuCodes),
  }
}

function refreshAffectedBucketProducts(
  db: ReturnType<typeof getDb>,
  groups: UnmappedGroup[],
  requestedSpuCodes: string[],
) {
  const codes = uniqueStrings([
    ...requestedSpuCodes,
    ...groups.flatMap((group) => group.spus),
  ])
  const refreshed: string[] = []
  for (const code of codes) {
    try {
      if (refreshBucketProduct(db, code)) refreshed.push(code)
    } catch {
      // Category suggestions should not fail just because a bucket row cannot be refreshed.
    }
  }
  return refreshed
}

async function generateCategoryAiSuggestions({
  limit,
  spuCodes,
  dryRun,
  refreshBuckets = false,
}: {
  limit: number
  spuCodes: string[]
  dryRun?: boolean
  refreshBuckets?: boolean
}): Promise<CategoryAiSuggestionResponse> {
  const db = getDb()
  const groups = attachSkcExamples(db, listUnmappedGroups(db, limit, spuCodes))
  const candidates = listCategoryCandidates(db, groups)

  if (groups.length === 0) {
    return { groups, candidates, suggestions: [], requested_spu_codes: spuCodes, refreshed_spu_codes: [] }
  }

  if (dryRun) {
    return {
      groups,
      candidates,
      suggestions: [],
      requested_spu_codes: spuCodes,
      refreshed_spu_codes: [],
      prompt: buildCategoryMatchPrompt({ groups, candidates: candidates.slice(0, AI_CATEGORY_CANDIDATE_LIMIT) }),
    }
  }

  const result = await withBackgroundTaskSlot("category_mapping_ai_suggestions", () => callAiCategoryMatcher({
    groups,
    candidates: candidates.slice(0, AI_CATEGORY_CANDIDATE_LIMIT),
    router: getDefaultAiScenarioRouter({ db }),
  }))
  const suggestions = enrichSuggestions({
    groups,
    suggestions: result.suggestions as unknown as Array<Record<string, unknown>>,
  })
  persistAiSuggestions({
    db,
    groups,
    suggestions,
    provider: result.provider,
  })
  return {
    groups,
    candidates,
    suggestions,
    requested_spu_codes: spuCodes,
    provider: result.provider,
    refreshed_spu_codes: refreshBuckets ? refreshAffectedBucketProducts(db, groups, spuCodes) : [],
  }
}

function snapshotCategoryAiJob(job: CategoryAiSuggestionJob): CategoryAiSuggestionJob {
  return {
    ...job,
    requested_spu_codes: [...job.requested_spu_codes],
    refreshed_spu_codes: [...job.refreshed_spu_codes],
    items: job.items.map((item) => ({ ...item })),
    groups: job.groups.map((group) => ({
      ...group,
      spus: [...group.spus],
      skc_examples: group.skc_examples.map((example) => ({ ...example })),
    })),
    candidates: job.candidates.map((candidate) => ({ ...candidate })),
    suggestions: job.suggestions.map((suggestion) => ({ ...suggestion })),
  }
}

function isoTimestamp(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function categoryAiJobFromRow(row: Record<string, unknown>): CategoryAiSuggestionJob {
  const createdAt = isoTimestamp(row.created_at) ?? new Date().toISOString()
  const updatedAt = isoTimestamp(row.updated_at) ?? createdAt
  return {
    id: String(row.id),
    status: (normalizeText(row.status) || "queued") as CategoryAiSuggestionJob["status"],
    total_count: Number(row.total_count ?? 0),
    completed_count: Number(row.completed_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    limit: Number(row.limit_count ?? 30),
    requested_spu_codes: parseJsonArray(row.requested_spu_codes_json).map(String),
    refreshed_spu_codes: parseJsonArray(row.refreshed_spu_codes_json).map(String),
    items: parseJsonArray(row.items_json) as CategoryAiSuggestionJobItem[],
    groups: parseJsonArray(row.groups_json) as UnmappedGroup[],
    candidates: parseJsonArray(row.candidates_json) as CategoryCandidate[],
    suggestions: parseJsonArray(row.suggestions_json) as Array<Record<string, unknown>>,
    provider: parseJsonObject(row.provider_json),
    error: row.error_message == null ? null : String(row.error_message),
    created_at: createdAt,
    started_at: isoTimestamp(row.started_at),
    finished_at: isoTimestamp(row.finished_at),
    updated_at: updatedAt,
  }
}

function persistCategoryAiJob(db: ReturnType<typeof getDb>, job: CategoryAiSuggestionJob) {
  db.prepare(`
    insert into category_ai_suggestion_job (
      id,
      status,
      total_count,
      completed_count,
      failed_count,
      limit_count,
      requested_spu_codes_json,
      refreshed_spu_codes_json,
      items_json,
      groups_json,
      candidates_json,
      suggestions_json,
      provider_json,
      error_message,
      started_at,
      finished_at,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?::timestamptz, ?::timestamptz, ?::timestamptz, ?::timestamptz)
    on conflict(id) do update set
      status = excluded.status,
      total_count = excluded.total_count,
      completed_count = excluded.completed_count,
      failed_count = excluded.failed_count,
      limit_count = excluded.limit_count,
      requested_spu_codes_json = excluded.requested_spu_codes_json,
      refreshed_spu_codes_json = excluded.refreshed_spu_codes_json,
      items_json = excluded.items_json,
      groups_json = excluded.groups_json,
      candidates_json = excluded.candidates_json,
      suggestions_json = excluded.suggestions_json,
      provider_json = excluded.provider_json,
      error_message = excluded.error_message,
      started_at = excluded.started_at,
      finished_at = excluded.finished_at,
      updated_at = excluded.updated_at
  `).run(
    job.id,
    job.status,
    job.total_count,
    job.completed_count,
    job.failed_count,
    job.limit,
    JSON.stringify(job.requested_spu_codes ?? []),
    JSON.stringify(job.refreshed_spu_codes ?? []),
    JSON.stringify(job.items ?? []),
    JSON.stringify(job.groups ?? []),
    JSON.stringify(job.candidates ?? []),
    JSON.stringify(job.suggestions ?? []),
    JSON.stringify(job.provider ?? {}),
    job.error ?? null,
    job.started_at ?? null,
    job.finished_at ?? null,
    job.created_at,
    job.updated_at,
  )
  return snapshotCategoryAiJob(job)
}

function readCategoryAiSuggestionJob(db: ReturnType<typeof getDb>, jobId: string) {
  const row = db.prepare(`
    select *
    from category_ai_suggestion_job
    where id = ?
  `).get(jobId) as Record<string, unknown> | undefined
  return row ? snapshotCategoryAiJob(categoryAiJobFromRow(row)) : null
}

function categoryAiClaimMs() {
  const value = Number(process.env.LISTINGIFY_CATEGORY_AI_CLAIM_MS ?? DEFAULT_CATEGORY_AI_CLAIM_MS)
  if (!Number.isFinite(value)) return DEFAULT_CATEGORY_AI_CLAIM_MS
  return Math.max(60_000, Math.min(MAX_CATEGORY_AI_CLAIM_MS, Math.floor(value)))
}

function categoryAiClaimLostError() {
  return new Error("类目 AI 任务 claim 已失效，拒绝旧 worker 写入")
}

function isCategoryAiClaimLostError(error: unknown) {
  return error instanceof Error && error.message.includes("类目 AI 任务 claim 已失效")
}

function claimCategoryAiSuggestionJob(db: ReturnType<typeof getDb>, jobId: string) {
  const token = randomUUID()
  const row = db.prepare(`
    update category_ai_suggestion_job
    set status = 'running',
      claim_token = ?,
      claim_version = claim_version + 1,
      claim_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
      started_at = coalesce(started_at, clock_timestamp()),
      updated_at = clock_timestamp()
    where id = ?
      and (
        status = 'queued'
        or (
          status = 'running'
          and (claim_expires_at is null or claim_expires_at <= clock_timestamp())
        )
      )
    returning *
  `).get(token, categoryAiClaimMs(), jobId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    job: snapshotCategoryAiJob(categoryAiJobFromRow(row)),
    claim: {
      token,
      version: Number(row.claim_version ?? 0),
    } satisfies CategoryAiJobClaim,
  }
}

function renewCategoryAiClaim(db: ReturnType<typeof getDb>, jobId: string, claim: CategoryAiJobClaim) {
  const result = db.prepare(`
    update category_ai_suggestion_job
    set claim_expires_at = clock_timestamp() + (?::double precision * interval '1 millisecond'),
      updated_at = clock_timestamp()
    where id = ?
      and status = 'running'
      and claim_token = ?
      and claim_version = ?
  `).run(categoryAiClaimMs(), jobId, claim.token, claim.version)
  return Number(result.changes ?? 0) > 0
}

function startCategoryAiClaimHeartbeat(db: ReturnType<typeof getDb>, jobId: string, claim: CategoryAiJobClaim) {
  const timer = setInterval(() => {
    try {
      renewCategoryAiClaim(db, jobId, claim)
    } catch {
      // The fenced write below remains the source of truth if a heartbeat fails.
    }
  }, Math.max(10_000, Math.floor(categoryAiClaimMs() / 3)))
  timer.unref?.()
  return () => clearInterval(timer)
}

function assertCategoryAiClaim(db: ReturnType<typeof getDb>, jobId: string, claim: CategoryAiJobClaim) {
  const row = db.prepare(`
    select id
    from category_ai_suggestion_job
    where id = ?
      and status = 'running'
      and claim_token = ?
      and claim_version = ?
      and claim_expires_at > clock_timestamp()
    for update
  `).get(jobId, claim.token, claim.version)
  if (!row) throw categoryAiClaimLostError()
}

function updateClaimedCategoryAiJob(
  db: ReturnType<typeof getDb>,
  job: CategoryAiSuggestionJob,
  patch: Partial<CategoryAiSuggestionJob>,
  claim: CategoryAiJobClaim,
) {
  const next = snapshotCategoryAiJob({
    ...job,
    ...patch,
    updated_at: new Date().toISOString(),
  })
  const completed = next.status === "completed"
  const row = db.prepare(`
    update category_ai_suggestion_job
    set status = ?,
      total_count = ?,
      completed_count = ?,
      failed_count = ?,
      limit_count = ?,
      requested_spu_codes_json = ?::jsonb,
      refreshed_spu_codes_json = ?::jsonb,
      items_json = ?::jsonb,
      groups_json = ?::jsonb,
      candidates_json = ?::jsonb,
      suggestions_json = ?::jsonb,
      provider_json = ?::jsonb,
      error_message = ?,
      started_at = ?::timestamptz,
      finished_at = ?::timestamptz,
      claim_token = case when ? then null else claim_token end,
      claim_expires_at = case when ? then null else claim_expires_at end,
      updated_at = clock_timestamp()
    where id = ?
      and status = 'running'
      and claim_token = ?
      and claim_version = ?
    returning *
  `).get(
    next.status,
    next.total_count,
    next.completed_count,
    next.failed_count,
    next.limit,
    JSON.stringify(next.requested_spu_codes ?? []),
    JSON.stringify(next.refreshed_spu_codes ?? []),
    JSON.stringify(next.items ?? []),
    JSON.stringify(next.groups ?? []),
    JSON.stringify(next.candidates ?? []),
    JSON.stringify(next.suggestions ?? []),
    JSON.stringify(next.provider ?? {}),
    next.error ?? null,
    next.started_at ?? null,
    next.finished_at ?? null,
    completed,
    completed,
    next.id,
    claim.token,
    claim.version,
  ) as Record<string, unknown> | undefined
  if (!row) throw categoryAiClaimLostError()
  return snapshotCategoryAiJob(categoryAiJobFromRow(row))
}

function buildCategoryAiJobItems(groups: UnmappedGroup[], requestedSpuCodes: string[]) {
  if (requestedSpuCodes.length > 0) {
    return requestedSpuCodes.map((spuCode) => ({
      spu_code: spuCode,
      status: "running" as const,
      error: null,
    }))
  }
  return groups.map((group) => ({
    spu_code: group.spus[0] ?? group.match_key,
    status: "running" as const,
    error: null,
  }))
}

function scheduleCategoryAiSuggestionWorker(run: () => void) {
  if (typeof setImmediate === "function") {
    setImmediate(run)
    return
  }
  setTimeout(run, 0)
}

function scheduleCategoryAiSuggestionJob(jobId: string) {
  if (!categoryAiPending.includes(jobId)) {
    categoryAiPending.push(jobId)
  }
  if (!categoryAiScheduled) {
    categoryAiScheduled = true
    scheduleCategoryAiSuggestionWorker(() => {
      void processCategoryAiSuggestionQueue()
    })
  }
}

function recoverCategoryAiSuggestionJobs(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select id
    from category_ai_suggestion_job
    where status = 'queued'
      or (
        status = 'running'
        and (claim_expires_at is null or claim_expires_at <= clock_timestamp())
      )
    order by created_at asc
    limit 20
  `).all() as Array<{ id: string }>
  for (const row of rows) scheduleCategoryAiSuggestionJob(String(row.id))
}

function createCategoryAiSuggestionJob(options: { limit: number; spuCodes: string[] }) {
  const now = new Date().toISOString()
  const initialItems = options.spuCodes.map((spuCode) => ({
    spu_code: spuCode,
    status: "queued" as const,
    error: null,
  }))
  return {
    id: randomUUID(),
    status: "queued",
    total_count: initialItems.length,
    completed_count: 0,
    failed_count: 0,
    limit: options.limit,
    requested_spu_codes: options.spuCodes,
    refreshed_spu_codes: [],
    items: initialItems,
    groups: [],
    candidates: [],
    suggestions: [],
    provider: null,
    error: null,
    created_at: now,
    started_at: null,
    finished_at: null,
    updated_at: now,
  } satisfies CategoryAiSuggestionJob
}

function enqueueCategoryAiSuggestionJob(options: { limit: number; spuCodes: string[] }) {
  const db = getDb()
  const job = createCategoryAiSuggestionJob(options)
  persistCategoryAiJob(db, job)
  scheduleCategoryAiSuggestionJob(job.id)
  return snapshotCategoryAiJob(job)
}

export function requeueCategoryAiSuggestionTask(jobId: string) {
  const db = getDb()
  const next = db.transaction(() => {
    const row = db.prepare(`
      select *
      from category_ai_suggestion_job
      where id = ?
      for update
    `).get(jobId) as Record<string, unknown> | undefined
    if (!row) return null
    if (normalizeText(row.status) !== "completed") {
      throw new HTTPException(409, { message: "任务仍在执行中，请先停止或等待任务完成后再重新加入队列" })
    }
    const original = snapshotCategoryAiJob(categoryAiJobFromRow(row))
    const spuCodes = uniqueStrings(
      (original.items ?? [])
        .filter((item) => String(item.status ?? "").trim() !== "completed")
        .map((item) => item.spu_code),
    )
    const requestedCodes = spuCodes.length || (original.items ?? []).length
      ? spuCodes
      : uniqueStrings(original.requested_spu_codes ?? [])
    if (requestedCodes.length === 0) {
      throw new HTTPException(409, { message: "这个类目 AI 任务没有可重新加入队列的未完成项目" })
    }
    const job = createCategoryAiSuggestionJob({
      limit: original.limit,
      spuCodes: requestedCodes,
    })
    persistCategoryAiJob(db, job)
    return snapshotCategoryAiJob(job)
  })()
  if (next) scheduleCategoryAiSuggestionJob(next.id)
  return next
}

async function runCategoryAiSuggestionJob(jobId: string) {
  const db = getDb()
  const claimed = claimCategoryAiSuggestionJob(db, jobId)
  if (!claimed) return
  let { job } = claimed
  const { claim } = claimed
  const stopHeartbeat = startCategoryAiClaimHeartbeat(db, jobId, claim)

  try {
    const groups = attachSkcExamples(db, listUnmappedGroups(db, job.limit, job.requested_spu_codes))
    const candidates = listCategoryCandidates(db, groups)
    const items = buildCategoryAiJobItems(groups, job.requested_spu_codes)
    job = updateClaimedCategoryAiJob(db, job, {
      groups,
      candidates,
      items,
      total_count: items.length,
      completed_count: 0,
      failed_count: 0,
    }, claim)

    if (groups.length === 0) {
      const completedItems = items.map((item) => ({ ...item, status: "completed" as const }))
      db.transaction(() => {
        assertCategoryAiClaim(db, jobId, claim)
        updateClaimedCategoryAiJob(db, job, {
          status: "completed",
          completed_count: completedItems.length,
          items: completedItems,
          finished_at: new Date().toISOString(),
        }, claim)
      })()
      return
    }

    const result = await withBackgroundTaskSlot("category_mapping_ai_suggestions", () => callAiCategoryMatcher({
      groups,
      candidates: candidates.slice(0, AI_CATEGORY_CANDIDATE_LIMIT),
      router: getDefaultAiScenarioRouter({ db }),
    }))
    const suggestions = enrichSuggestions({
      groups,
      suggestions: result.suggestions as unknown as Array<Record<string, unknown>>,
    })
    const completedItems = items.map((item) => ({ ...item, status: "completed" as const }))
    db.transaction(() => {
      assertCategoryAiClaim(db, jobId, claim)
      persistAiSuggestions({
        db,
        groups,
        suggestions,
        provider: result.provider,
      })
      const refreshedSpuCodes = refreshAffectedBucketProducts(db, groups, job.requested_spu_codes)
      updateClaimedCategoryAiJob(db, job, {
        status: "completed",
        completed_count: completedItems.length,
        failed_count: 0,
        items: completedItems,
        suggestions,
        provider: result.provider,
        refreshed_spu_codes: refreshedSpuCodes,
        finished_at: new Date().toISOString(),
      }, claim)
    })()
  } catch (error) {
    if (isCategoryAiClaimLostError(error)) return
    const message = error instanceof Error ? error.message : String(error)
    const failedItems = job.items.length
      ? job.items.map((item) => ({ ...item, status: "failed" as const, error: message }))
      : [{ spu_code: job.requested_spu_codes[0] ?? "AI_CATEGORY_MATCH", status: "failed" as const, error: message }]
    try {
      db.transaction(() => {
        assertCategoryAiClaim(db, jobId, claim)
        updateClaimedCategoryAiJob(db, job, {
          status: "completed",
          completed_count: 0,
          failed_count: failedItems.length || 1,
          total_count: failedItems.length || 1,
          items: failedItems,
          error: message,
          finished_at: new Date().toISOString(),
        }, claim)
      })()
    } catch (claimError) {
      if (!isCategoryAiClaimLostError(claimError)) throw claimError
    }
  } finally {
    stopHeartbeat()
  }
}

async function processCategoryAiSuggestionQueue() {
  categoryAiScheduled = false
  if (categoryAiRunning) return
  categoryAiRunning = true
  try {
    while (categoryAiPending.length > 0) {
      const jobId = categoryAiPending.shift()
      if (!jobId) continue
      try {
        await runCategoryAiSuggestionJob(jobId)
      } catch (error) {
        console.error("Category AI suggestion queue internal error", error)
      }
    }
  } finally {
    categoryAiRunning = false
    if (categoryAiPending.length > 0) scheduleCategoryAiSuggestionJob(categoryAiPending[0])
  }
}

// GET /api/category-mapping/rules
categoryMapping.get("/rules", (c) => {
  const db = getDb()
  const status = c.req.query("status")
  const search = c.req.query("q")
  const limit = readLimit(c.req.query("limit"), 50, 200)
  const offset = readOffset(c.req.query("offset"))

  let sql = `
    SELECT id, mdm_middle_category_code, mdm_middle_category_name,
      mdm_small_category_code, mdm_small_category_name,
      gender_code, gender_name, age_group_code, age_group_name,
      match_mode, match_key, shein_category_id, shein_product_type_id,
      priority, status, source, note, dimension_payload_json, created_at, updated_at
    FROM mdm_shein_category_mapping_rule
    WHERE 1=1
  `
  const params: unknown[] = []

  if (status) {
    sql += " AND status = ?"
    params.push(status)
  }

  if (search) {
    sql += ` AND (mdm_small_category_name LIKE ? OR mdm_middle_category_name LIKE ? OR match_key LIKE ?)`
    const like = `%${search}%`
    params.push(like, like, like)
  }

  const total = db.prepare(`
    SELECT count(*) as count
    FROM mdm_shein_category_mapping_rule
    WHERE 1=1
    ${status ? " AND status = ?" : ""}
    ${search ? " AND (mdm_small_category_name LIKE ? OR mdm_middle_category_name LIKE ? OR match_key LIKE ?)" : ""}
  `).get(...params) as { count: number }

  sql += " ORDER BY priority ASC, id DESC LIMIT ? OFFSET ?"

  const rules = db.prepare(sql).all(...params, limit, offset)
  return c.json({ rules, pagination: { total: total.count, limit, offset } })
})

// POST /api/category-mapping/rules - create new rule
categoryMapping.post("/rules", async (c) => {
  const db = getDb()
  const body = await c.req.json() as MappingRuleBody

  const stmt = db.prepare(`
    INSERT INTO mdm_shein_category_mapping_rule (
      mdm_middle_category_code, mdm_middle_category_name,
      mdm_small_category_code, mdm_small_category_name,
      gender_code, gender_name, age_group_code, age_group_name,
      match_mode, match_key, shein_category_id, shein_product_type_id,
      priority, status, source, note, dimension_payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const matchKey = body.match_key ?? buildMatchKey(body)

  const result = stmt.run(
    body.mdm_middle_category_code ?? null,
    body.mdm_middle_category_name ?? "",
    body.mdm_small_category_code ?? null,
    body.mdm_small_category_name,
    body.gender_code ?? null,
    body.gender_name ?? null,
    body.age_group_code ?? null,
    body.age_group_name ?? null,
    body.match_mode ?? "EXACT",
    matchKey,
    body.shein_category_id,
    body.shein_product_type_id,
    body.priority ?? 100,
    body.status ?? "ACTIVE",
    body.source ?? "MANUAL",
    body.note ?? null,
    body.dimension_payload_json ?? "{}",
  )

  return c.json({ id: result.lastInsertRowid })
})

// PATCH /api/category-mapping/rules/:id
categoryMapping.patch("/rules/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json() as Record<string, unknown>

  const allowed = [
    "mdm_middle_category_code",
    "mdm_middle_category_name",
    "mdm_small_category_code",
    "mdm_small_category_name",
    "gender_code",
    "gender_name",
    "age_group_code",
    "age_group_name",
    "match_mode",
    "match_key",
    "shein_category_id",
    "shein_product_type_id",
    "priority",
    "status",
    "source",
    "note",
    "dimension_payload_json",
  ]

  const setClauses: string[] = []
  const params: unknown[] = []
  for (const key of allowed) {
    if (key in body) {
      setClauses.push(`${key} = ?`)
      params.push(body[key])
    }
  }

  if (setClauses.length === 0) {
    return c.json({ error: "No fields to update" }, 400)
  }

  setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  params.push(id)

  db.prepare(`UPDATE mdm_shein_category_mapping_rule SET ${setClauses.join(", ")} WHERE id = ?`).run(...params)
  return c.json({ ok: true })
})

// DELETE /api/category-mapping/rules/:id
categoryMapping.delete("/rules/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`DELETE FROM mdm_shein_category_mapping_rule WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

// GET /api/category-mapping/unmapped-groups - list MDM combinations without active exact rules
categoryMapping.get("/unmapped-groups", (c) => {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"), 50, 200)
  const groups = attachSkcExamples(db, listUnmappedGroups(db, limit))
  return c.json({ groups })
})

// GET /api/category-mapping/category-candidates - list compact SHEIN category candidates for current groups
categoryMapping.get("/category-candidates", (c) => {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"), 50, 200)
  const groups = attachSkcExamples(db, listUnmappedGroups(db, limit))
  const candidates = listCategoryCandidates(db, groups)
  return c.json({ candidates })
})

// GET /api/category-mapping/ai-suggestions - load persisted AI review suggestions
categoryMapping.get("/ai-suggestions", (c) => {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"), 30, 100)
  return c.json(listPersistedAiSuggestions(db, limit))
})

// POST /api/category-mapping/ai-suggestions/jobs - enqueue AI category recommendations
categoryMapping.post("/ai-suggestions/jobs", async (c) => {
  const body = await c.req.json().catch(() => ({})) as CategoryAiSuggestionRequest
  const { limit, spuCodes } = readCategoryAiSuggestionRequest(body, c.req.query("limit"))
  const job = enqueueCategoryAiSuggestionJob({ limit, spuCodes })
  return c.json(job, 202)
})

// GET /api/category-mapping/ai-suggestions/jobs/:jobId - poll an AI category recommendation job
categoryMapping.get("/ai-suggestions/jobs/:jobId", (c) => {
  const db = getDb()
  recoverCategoryAiSuggestionJobs(db)
  const job = readCategoryAiSuggestionJob(db, c.req.param("jobId"))
  if (!job) return c.json({ error: "AI category suggestion job not found" }, 404)
  if (job.status !== "completed") scheduleCategoryAiSuggestionJob(job.id)
  return c.json(job)
})

// POST /api/category-mapping/ai-suggestions - ask AI to recommend SHEIN categories for unmapped groups
categoryMapping.post("/ai-suggestions", async (c) => {
  const body = await c.req.json().catch(() => ({})) as CategoryAiSuggestionRequest
  const { limit, dryRun, spuCodes } = readCategoryAiSuggestionRequest(body, c.req.query("limit"))
  if (!dryRun) {
    const job = enqueueCategoryAiSuggestionJob({ limit, spuCodes })
    return c.json(job, 202)
  }
  const result = await generateCategoryAiSuggestions({
    limit,
    spuCodes,
    dryRun,
  })
  return c.json(result)
})

// POST /api/category-mapping/ai-suggestions/confirm - persist one AI suggestion as a mapping rule
categoryMapping.post("/ai-suggestions/confirm", async (c) => {
  const db = getDb()
  const body = await c.req.json() as {
    group: UnmappedGroup
    selected: CategoryCandidate
    suggestion?: unknown
    priority?: number
    source?: string
    note?: string
  }
  const group = body.group
  const selected = body.selected
  if (!group?.mdm_small_category_name || !selected?.category_id || !selected?.product_type_id) {
    return c.json({ error: "Missing group or selected category" }, 400)
  }

  const matchKey = group.match_key ?? buildMatchKey(group)
  const note = body.note
    ?? `AI 推荐确认：${selected.category_name}${selected.path ? ` (${selected.path})` : ""}`
  const dimensionPayload = JSON.stringify({
    confirmed_at: new Date().toISOString(),
    group,
    selected,
    suggestion: body.suggestion ?? null,
  })

  const result = db.prepare(`
    insert into mdm_shein_category_mapping_rule (
      mdm_middle_category_code,
      mdm_middle_category_name,
      mdm_small_category_code,
      mdm_small_category_name,
      gender_code,
      gender_name,
      age_group_code,
      age_group_name,
      match_mode,
      match_key,
      shein_category_id,
      shein_product_type_id,
      priority,
      status,
      source,
      note,
      dimension_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, 'EXACT', ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(match_key) where status = 'ACTIVE' and match_mode = 'EXACT'
    do update set
      shein_category_id = excluded.shein_category_id,
      shein_product_type_id = excluded.shein_product_type_id,
      priority = excluded.priority,
      source = excluded.source,
      note = excluded.note,
      dimension_payload_json = excluded.dimension_payload_json,
      updated_at = excluded.updated_at
  `).run(
    group.mdm_middle_category_code ?? null,
    group.mdm_middle_category_name ?? "",
    group.mdm_small_category_code ?? null,
    group.mdm_small_category_name,
    group.gender_code ?? null,
    group.gender_name ?? null,
    group.age_group_code ?? null,
    group.age_group_name ?? null,
    matchKey,
    selected.category_id,
    selected.product_type_id,
    body.priority ?? 80,
    body.source ?? "AI_SUGGESTED",
    note,
    dimensionPayload,
  )

  db.prepare(`
    update mdm_shein_category_ai_suggestion
    set review_status = 'CONFIRMED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where match_key = ?
  `).run(matchKey)

  return c.json({
    ok: true,
    id: result.lastInsertRowid,
    match_key: matchKey,
  })
})

// POST /api/category-mapping/test-match - test rule matching
categoryMapping.post("/test-match", async (c) => {
  const db = getDb()
  const body = await c.req.json() as {
    mdm_middle_category_name?: string
    mdm_small_category_name?: string
    gender_name?: string
    age_group_name?: string
  }

  const exactMatch = db.prepare(`
    SELECT * FROM mdm_shein_category_mapping_rule
    WHERE status = 'ACTIVE'
      AND match_mode = 'EXACT'
      AND mdm_middle_category_name = ?
      AND mdm_small_category_name = ?
      AND coalesce(gender_name, '') = coalesce(?, '')
      AND coalesce(age_group_name, '') = coalesce(?, '')
    ORDER BY priority ASC
    LIMIT 1
  `).get(
    body.mdm_middle_category_name ?? "",
    body.mdm_small_category_name ?? "",
    body.gender_name ?? "",
    body.age_group_name ?? "",
  )

  if (exactMatch) {
    return c.json({ match: exactMatch, mode: "EXACT" })
  }

  const fallbackMatch = db.prepare(`
    SELECT * FROM mdm_shein_category_mapping_rule
    WHERE status = 'ACTIVE'
      AND match_mode = 'FALLBACK'
      AND mdm_small_category_name = ?
    ORDER BY priority ASC
    LIMIT 1
  `).get(body.mdm_small_category_name ?? "")

  if (fallbackMatch) {
    return c.json({ match: fallbackMatch, mode: "FALLBACK" })
  }

  return c.json({ match: null, mode: null })
})

export default categoryMapping
