import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { randomUUID } from "node:crypto"
import {
  MERCHANT_TRADES_TYPE,
  TRADE_FIELDS_TYPE,
  requestDeepdrawPost,
  resolveDeepdrawConfig,
} from "../../../scripts/lib/deepdraw_client.mjs"

type JsonRecord = Record<string, unknown>

interface DeepdrawConfigInput {
  projectRoot?: string
  tenantName?: string | null
}

interface TenantMetadataSyncInput extends DeepdrawConfigInput {
  includeFields?: boolean
  leafOnly?: boolean
  limit?: number | null
  fieldConcurrency?: number | null
  fieldRetryCount?: number | null
  onProgress?: (progress: { completed: number; total: number; tradeId?: string; error?: string }) => void
}

interface CacheInput {
  tenantName: string
  merchantId: string
  payload: unknown
  syncedAt?: string
}

interface TradeFieldsCacheInput extends CacheInput {
  tradeId: string
}

interface FieldSyncMarkerInput {
  tenantName: string
  merchantId: string
  tradeId: string
  status: "success" | "zero_fields" | "failed"
  fieldCount: number
  errorMessage?: string | null
  requestId?: string | null
  summary?: unknown
  syncedAt?: string
}

const DEFAULT_FIELD_CONCURRENCY = 8
const MAX_FIELD_CONCURRENCY = 12
const DEFAULT_FIELD_RETRY_COUNT = 2
const MAX_FIELD_RETRY_COUNT = 4

export function createMetadataSyncScheduler(drain: () => Promise<void>) {
  let requested = false
  let activeRun: Promise<void> | null = null

  function schedule(): Promise<void> {
    requested = true
    if (!activeRun) {
      activeRun = Promise.resolve()
        .then(async () => {
          while (requested) {
            requested = false
            await drain()
          }
        })
        .finally(() => {
          activeRun = null
          if (requested) return schedule()
        })
    }
    return activeRun
  }

  return schedule
}

export async function drainMetadataSyncJobs<T>(input: {
  claimNext: () => T | null
  processJob: (job: T) => Promise<void>
  markFailed: (job: T, error: unknown) => void | Promise<void>
  heartbeat?: (job: T) => void | Promise<void>
  heartbeatIntervalMs?: number
}) {
  while (true) {
    const job = input.claimNext()
    if (!job) return
    const heartbeatIntervalMs = Math.max(1, Number(input.heartbeatIntervalMs ?? 30_000))
    const heartbeatTimer = input.heartbeat
      ? setInterval(() => {
          void Promise.resolve(input.heartbeat?.(job)).catch(() => undefined)
        }, heartbeatIntervalMs)
      : null
    heartbeatTimer?.unref?.()
    try {
      await input.processJob(job)
    } catch (error) {
      await input.markFailed(job, error)
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
    }
  }
}

function nowIso() {
  return new Date().toISOString()
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase())
  return false
}

function recordValue(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord
  return {}
}

function arrayRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
  return []
}

function payloadBody(payload: unknown) {
  const record = recordValue(payload)
  const response = recordValue(record.response)
  if (response.body !== undefined) return response.body
  return record.body ?? record.data ?? record.result ?? payload
}

function nestedArray(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return arrayRecords(value)
  const record = recordValue(value)
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return arrayRecords(candidate)
    const nested = recordValue(candidate)
    for (const nestedKey of keys) {
      const nestedCandidate = nested[nestedKey]
      if (Array.isArray(nestedCandidate)) return arrayRecords(nestedCandidate)
    }
  }
  return []
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function jsonArrayText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

function numberValue(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function fieldConcurrency(value: unknown) {
  const number = Math.floor(numberValue(value) ?? DEFAULT_FIELD_CONCURRENCY)
  if (number < 1) return 1
  return Math.min(number, MAX_FIELD_CONCURRENCY)
}

function fieldRetryCount(value: unknown) {
  const number = Math.floor(numberValue(value) ?? DEFAULT_FIELD_RETRY_COUNT)
  if (number < 0) return 0
  return Math.min(number, MAX_FIELD_RETRY_COUNT)
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function assertDeepdrawMetadataSuccess(result: { status: number; ok: boolean; payload: unknown; text?: string }, type: string) {
  const payload = recordValue(result.payload)
  const response = recordValue(payload.response)
  const outerStatus = numberValue(payload.status)
  const responseCode = numberValue(response.code)
  const responseState = stringValue(response.response).toLowerCase()
  if (
    !result.ok
    || (outerStatus !== null && outerStatus !== 200)
    || (responseCode !== null && responseCode !== 10200)
    || (responseState && responseState !== "success")
  ) {
    const reason = stringValue(response.reason ?? payload.reason ?? result.text)
    throw new Error(`DeepDraw ${type} failed: ${reason || result.status}`)
  }
}

function parseJsonObject(value: unknown): JsonRecord {
  if (typeof value !== "string") return recordValue(value)
  try {
    return recordValue(JSON.parse(value))
  } catch {
    return {}
  }
}

function serializeMetadataSyncJob(row: JsonRecord) {
  return {
    id: stringValue(row.id),
    tenantName: stringValue(row.tenant_name),
    fieldConcurrency: numberValue(row.field_concurrency) ?? 0,
    fieldRetryCount: numberValue(row.field_retry_count) ?? 0,
    status: stringValue(row.status),
    started_at: stringValue(row.started_at) || null,
    finished_at: stringValue(row.finished_at) || null,
    total_count: numberValue(row.total_count) ?? 0,
    completed_count: numberValue(row.completed_count) ?? 0,
    field_count: numberValue(row.field_count) ?? 0,
    zero_field_count: numberValue(row.zero_field_count) ?? 0,
    failed_trade_count: numberValue(row.failed_trade_count) ?? 0,
    summary: parseJsonObject(row.summary_json),
    error: stringValue(row.error_message) || null,
    created_at: stringValue(row.created_at) || null,
    updated_at: stringValue(row.updated_at) || null,
  }
}

export function createMetadataSyncJob(db: SyncPostgresDatabase, input: {
  tenantName: string
  fieldConcurrency: number
  fieldRetryCount: number
}) {
  const now = nowIso()
  const row = db.prepare(`
    insert into deepdraw_metadata_sync_job (
      id,
      tenant_name,
      field_concurrency,
      field_retry_count,
      status,
      created_at,
      updated_at
    )
    values (?, ?, ?, ?, 'queued', ?::timestamptz, ?::timestamptz)
    returning *
  `).get(
    randomUUID(),
    input.tenantName,
    input.fieldConcurrency,
    input.fieldRetryCount,
    now,
    now,
  ) as JsonRecord | undefined
  return serializeMetadataSyncJob(row ?? {})
}

export function getMetadataSyncJob(db: SyncPostgresDatabase, id: string) {
  const row = db.prepare("select * from deepdraw_metadata_sync_job where id = ?").get(id) as JsonRecord | undefined
  return row ? serializeMetadataSyncJob(row) : null
}

export function claimNextMetadataSyncJob(db: SyncPostgresDatabase, input: {
  workerId: string
  now?: Date
  staleAfterMs?: number
}) {
  const now = input.now ?? new Date()
  const staleAfterMs = Math.max(1_000, Number(input.staleAfterMs ?? 120_000))
  const nowText = now.toISOString()
  const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString()
  const row = db.prepare(`
    with candidate as (
      select id
      from deepdraw_metadata_sync_job
      where status = 'queued'
        or (
          status = 'running'
          and coalesce(heartbeat_at, updated_at) < ?::timestamptz
        )
      order by case when status = 'queued' then 0 else 1 end, created_at, id
      for update skip locked
      limit 1
    )
    update deepdraw_metadata_sync_job job
    set status = 'running',
      worker_id = ?,
      heartbeat_at = ?::timestamptz,
      started_at = coalesce(job.started_at, ?::timestamptz),
      finished_at = null,
      error_message = null,
      updated_at = ?::timestamptz
    from candidate
    where job.id = candidate.id
    returning job.*
  `).get(staleBefore, input.workerId, nowText, nowText, nowText) as JsonRecord | undefined
  return row ? serializeMetadataSyncJob(row) : null
}

export function updateMetadataSyncJobProgress(db: SyncPostgresDatabase, id: string, input: {
  status?: string | null
  totalCount?: number | null
  completedCount?: number | null
  fieldCount?: number | null
  zeroFieldCount?: number | null
  failedTradeCount?: number | null
  summary?: unknown
  errorMessage?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  heartbeatAt?: string | null
}) {
  const now = nowIso()
  const summaryJson = input.summary === undefined ? null : jsonText(input.summary)
  const row = db.prepare(`
    update deepdraw_metadata_sync_job
    set status = coalesce(?, status),
      total_count = coalesce(?, total_count),
      completed_count = coalesce(?, completed_count),
      field_count = coalesce(?, field_count),
      zero_field_count = coalesce(?, zero_field_count),
      failed_trade_count = coalesce(?, failed_trade_count),
      summary_json = coalesce(?::jsonb, summary_json),
      error_message = coalesce(?, error_message),
      started_at = coalesce(?::timestamptz, started_at),
      finished_at = coalesce(?::timestamptz, finished_at),
      heartbeat_at = coalesce(?::timestamptz, heartbeat_at),
      updated_at = ?::timestamptz
    where id = ?
    returning *
  `).get(
    input.status ?? null,
    input.totalCount ?? null,
    input.completedCount ?? null,
    input.fieldCount ?? null,
    input.zeroFieldCount ?? null,
    input.failedTradeCount ?? null,
    summaryJson,
    input.errorMessage ?? null,
    input.startedAt ?? null,
    input.finishedAt ?? null,
    input.heartbeatAt ?? null,
    now,
    id,
  ) as JsonRecord | undefined
  return row ? serializeMetadataSyncJob(row) : null
}

function normalizeTrade(row: JsonRecord, parentTradeId?: string | null, path: string[] = []) {
  const tradeId = stringValue(row.tradeId ?? row.trade_id ?? row.id ?? row.code)
  const tradeName = stringValue(row.tradeName ?? row.trade_name ?? row.name ?? row.title) || tradeId
  const tradePath = stringValue(row.tradePath ?? row.trade_path ?? row.path ?? row.fullName ?? row.full_name)
    || [...path, tradeName].filter(Boolean).join(" / ")
  return {
    tradeId,
    parentTradeId: stringValue(row.parentTradeId ?? row.parent_trade_id ?? row.parentId ?? row.parent_id) || parentTradeId || null,
    tradeName,
    tradePath: tradePath || null,
    raw: row,
  }
}

function childTrades(row: JsonRecord) {
  for (const key of ["children", "childs", "childList", "tradeList", "trades", "list", "items"]) {
    const candidate = row[key]
    if (Array.isArray(candidate)) return arrayRecords(candidate)
  }
  return []
}

function isLeafTrade(row: JsonRecord) {
  return childTrades(recordValue(row.raw_payload_json ?? row.rawPayloadJson ?? row)).length === 0
}

function flattenTrades(rows: JsonRecord[], parentTradeId?: string | null, path: string[] = []): ReturnType<typeof normalizeTrade>[] {
  const output: ReturnType<typeof normalizeTrade>[] = []
  for (const row of rows) {
    const normalized = normalizeTrade(row, parentTradeId, path)
    if (normalized.tradeId) output.push(normalized)
    output.push(...flattenTrades(childTrades(row), normalized.tradeId || parentTradeId, [...path, normalized.tradeName].filter(Boolean)))
  }
  return output
}

function normalizeField(row: JsonRecord) {
  const fieldRecord = recordValue(row.field)
  const attributes = recordValue(row.attributes ?? fieldRecord.attributes)
  const fieldId = stringValue(row.fieldId ?? row.field_id ?? row.id ?? fieldRecord.id ?? fieldRecord.fieldId)
  const options = row.options ?? row.values ?? row.optionList ?? row.option_list ?? row.items ?? []
  return {
    fieldId,
    fieldName: stringValue(row.fieldName ?? row.field_name ?? row.name ?? fieldRecord.name ?? fieldRecord.fieldName) || fieldId,
    fieldType: stringValue(row.fieldType ?? row.field_type ?? row.type ?? fieldRecord.type ?? fieldRecord.fieldType) || null,
    required: booleanValue(row.required ?? row.isRequired ?? row.must ?? row.requiredFlag ?? attributes.isRequired),
    saleProp: booleanValue(row.saleProp ?? row.sale_prop ?? row.isSaleProp ?? row.is_sale_prop),
    options: Array.isArray(options) ? options : [],
    raw: row,
  }
}

export function syncDeepdrawTradesCache(db: SyncPostgresDatabase, input: CacheInput) {
  const body = payloadBody(input.payload)
  const topRows = nestedArray(body, ["trades", "tradeList", "list", "records", "items"])
  const rows = flattenTrades(topRows)
    .filter((row) => row.tradeId)
  const syncedAt = input.syncedAt ?? nowIso()
  const statement = db.prepare(`
    insert into deepdraw_trade_cache (
      tenant_name,
      merchant_id,
      trade_id,
      parent_trade_id,
      trade_name,
      trade_path,
      raw_payload_json,
      synced_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz, ?::timestamptz)
    on conflict (tenant_name, merchant_id, trade_id) do update set
      parent_trade_id = excluded.parent_trade_id,
      trade_name = excluded.trade_name,
      trade_path = excluded.trade_path,
      raw_payload_json = excluded.raw_payload_json,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at
  `)
  db.transaction(() => {
    for (const row of rows) {
      statement.run(
        input.tenantName,
        input.merchantId,
        row.tradeId,
        row.parentTradeId,
        row.tradeName,
        row.tradePath,
        jsonText(row.raw),
        syncedAt,
        syncedAt,
      )
    }
  })()
  return { count: rows.length, topLevelCount: topRows.length, flattenedCount: rows.length, syncedAt }
}

export function syncDeepdrawTradeFieldsCache(db: SyncPostgresDatabase, input: TradeFieldsCacheInput) {
  const body = payloadBody(input.payload)
  const rows = nestedArray(body, ["fields", "fieldList", "list", "records", "items"])
    .map(normalizeField)
    .filter((row) => row.fieldId || row.fieldName)
  const syncedAt = input.syncedAt ?? nowIso()
  const statement = db.prepare(`
    insert into deepdraw_trade_field_cache (
      tenant_name,
      merchant_id,
      trade_id,
      field_id,
      field_name,
      field_type,
      required,
      sale_prop,
      options_json,
      raw_payload_json,
      synced_at,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::timestamptz, ?::timestamptz)
    on conflict (tenant_name, merchant_id, trade_id, field_id) do update set
      field_name = excluded.field_name,
      field_type = excluded.field_type,
      required = excluded.required,
      sale_prop = excluded.sale_prop,
      options_json = excluded.options_json,
      raw_payload_json = excluded.raw_payload_json,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at
  `)
  db.transaction(() => {
    for (const row of rows) {
      statement.run(
        input.tenantName,
        input.merchantId,
        input.tradeId,
        row.fieldId || row.fieldName,
        row.fieldName,
        row.fieldType,
        row.required,
        row.saleProp,
        jsonArrayText(row.options),
        jsonText(row.raw),
        syncedAt,
        syncedAt,
      )
    }
  })()
  return { count: rows.length, syncedAt }
}

export function recordDeepdrawFieldSyncMarker(db: SyncPostgresDatabase, input: FieldSyncMarkerInput) {
  const syncedAt = input.syncedAt ?? nowIso()
  db.prepare(`
    insert into deepdraw_trade_field_sync_marker (
      tenant_name,
      merchant_id,
      trade_id,
      sync_type,
      sync_status,
      field_count,
      error_message,
      request_id,
      raw_summary_json,
      synced_at,
      updated_at
    )
    values (?, ?, ?, 'fields', ?, ?, ?, ?, ?::jsonb, ?::timestamptz, ?::timestamptz)
    on conflict (tenant_name, merchant_id, trade_id, sync_type) do update set
      sync_status = excluded.sync_status,
      field_count = excluded.field_count,
      error_message = excluded.error_message,
      request_id = excluded.request_id,
      raw_summary_json = excluded.raw_summary_json,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at
  `).run(
    input.tenantName,
    input.merchantId,
    input.tradeId,
    input.status,
    input.fieldCount,
    input.errorMessage ?? null,
    input.requestId ?? null,
    jsonText(input.summary ?? {}),
    syncedAt,
    syncedAt,
  )
}

export function listDeepdrawTrades(db: SyncPostgresDatabase, input: { tenantName?: string | null; q?: string | null } = {}) {
  const params: unknown[] = []
  const where: string[] = []
  if (input.tenantName) {
    where.push("tenant_name = ?")
    params.push(input.tenantName)
  }
  if (input.q?.trim()) {
    where.push("(trade_id ilike ? or trade_name ilike ? or trade_path ilike ?)")
    const like = `%${input.q.trim()}%`
    params.push(like, like, like)
  }
  return db.prepare(`
    select *
    from deepdraw_trade_cache
    ${where.length ? `where ${where.join(" and ")}` : ""}
    order by trade_path nulls last, trade_name, trade_id
  `).all(...params)
}

export function listDeepdrawTradeFields(db: SyncPostgresDatabase, input: { tenantName?: string | null; tradeId: string }) {
  const params: unknown[] = [input.tradeId]
  const where = ["trade_id = ?"]
  if (input.tenantName) {
    where.push("tenant_name = ?")
    params.push(input.tenantName)
  }
  return db.prepare(`
    select *
    from deepdraw_trade_field_cache
    where ${where.join(" and ")}
    order by required desc, sale_prop desc, field_name
  `).all(...params)
}

export async function syncDeepdrawTrades(db: SyncPostgresDatabase, input: DeepdrawConfigInput = {}) {
  const config = resolveDeepdrawConfig({
    projectRoot: input.projectRoot,
    tenantName: input.tenantName ?? undefined,
  })
  const result = await requestDeepdrawPost({
    config,
    type: MERCHANT_TRADES_TYPE,
    query: {},
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
  })
  assertDeepdrawMetadataSuccess(result, MERCHANT_TRADES_TYPE)
  const summary = syncDeepdrawTradesCache(db, {
    tenantName: config.tenantName,
    merchantId: String(config.merchantId),
    payload: result.payload,
  })
  return { ...summary, tenantName: config.tenantName, merchantId: String(config.merchantId), requestId: result.requestId }
}

export async function syncDeepdrawTradeFields(
  db: SyncPostgresDatabase,
  input: DeepdrawConfigInput & { tradeId: string },
) {
  const config = resolveDeepdrawConfig({
    projectRoot: input.projectRoot,
    tenantName: input.tenantName ?? undefined,
  })
  const result = await requestDeepdrawPost({
    config,
    type: TRADE_FIELDS_TYPE,
    query: { tradeId: input.tradeId },
    timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
  })
  assertDeepdrawMetadataSuccess(result, TRADE_FIELDS_TYPE)
  const summary = syncDeepdrawTradeFieldsCache(db, {
    tenantName: config.tenantName,
    merchantId: String(config.merchantId),
    tradeId: input.tradeId,
    payload: result.payload,
  })
  recordDeepdrawFieldSyncMarker(db, {
    tenantName: config.tenantName,
    merchantId: String(config.merchantId),
    tradeId: input.tradeId,
    status: summary.count > 0 ? "success" : "zero_fields",
    fieldCount: summary.count,
    requestId: result.requestId,
    summary: { count: summary.count, requestId: result.requestId },
    syncedAt: summary.syncedAt,
  })
  return { ...summary, tenantName: config.tenantName, merchantId: String(config.merchantId), requestId: result.requestId }
}

async function attemptFieldSync(
  db: SyncPostgresDatabase,
  input: DeepdrawConfigInput & { tradeId: string; retryCount: number },
) {
  let lastError: unknown
  for (let attempt = 0; attempt <= input.retryCount; attempt += 1) {
    try {
      return await syncDeepdrawTradeFields(db, input)
    } catch (error) {
      lastError = error
      if (attempt < input.retryCount) {
        await wait(400 * (attempt + 1))
      }
    }
  }
  throw lastError
}

async function runFieldWorker(input: {
  db: SyncPostgresDatabase
  projectRoot?: string
  tenantName: string
  merchantId: string
  retryCount: number
  fieldCandidates: JsonRecord[]
  nextIndex: () => number
  onResult: (result: { row: JsonRecord; count: number; error?: string }) => void
}) {
  while (true) {
    const index = input.nextIndex()
    if (index >= input.fieldCandidates.length) return
    const row = input.fieldCandidates[index]
    const tradeId = stringValue(row.trade_id)
    try {
      const summary = await attemptFieldSync(input.db, {
        projectRoot: input.projectRoot,
        tenantName: input.tenantName,
        tradeId,
        retryCount: input.retryCount,
      })
      input.onResult({ row, count: summary.count })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      recordDeepdrawFieldSyncMarker(input.db, {
        tenantName: input.tenantName,
        merchantId: input.merchantId,
        tradeId,
        status: "failed",
        fieldCount: 0,
        errorMessage: message,
        summary: { error: message },
      })
      input.onResult({
        row,
        count: 0,
        error: message,
      })
    }
  }
}

export async function syncDeepdrawTenantMetadata(db: SyncPostgresDatabase, input: TenantMetadataSyncInput = {}) {
  const startedAt = nowIso()
  const includeFields = input.includeFields !== false
  const leafOnly = input.leafOnly !== false
  const limit = numberValue(input.limit)
  const retryCount = fieldRetryCount(input.fieldRetryCount)
  const tradesSummary = await syncDeepdrawTrades(db, input)
  const tradeRows = listDeepdrawTrades(db, {
    tenantName: tradesSummary.tenantName,
  }) as JsonRecord[]
  const fieldCandidates = (leafOnly ? tradeRows.filter(isLeafTrade) : tradeRows)
    .filter((row) => stringValue(row.trade_id))
    .slice(0, limit && limit > 0 ? limit : undefined)

  const failures: Array<{ tradeId: string; tradePath: string | null; error: string }> = []
  let completed = 0
  let fieldCount = 0
  let zeroFieldCount = 0
  if (includeFields) {
    let nextIndex = 0
    const workers = Math.min(fieldConcurrency(input.fieldConcurrency), fieldCandidates.length)
    await Promise.all(Array.from({ length: workers }, () => runFieldWorker({
      db,
      projectRoot: input.projectRoot,
      tenantName: tradesSummary.tenantName,
      merchantId: tradesSummary.merchantId,
      retryCount,
      fieldCandidates,
      nextIndex: () => nextIndex++,
      onResult: (result) => {
        const tradeId = stringValue(result.row.trade_id)
        if (result.error) {
          failures.push({
            tradeId,
            tradePath: stringValue(result.row.trade_path) || null,
            error: result.error,
          })
        } else {
          fieldCount += result.count
          if (result.count === 0) zeroFieldCount += 1
        }
        completed += 1
        input.onProgress?.({
          completed,
          total: fieldCandidates.length,
          tradeId,
          error: result.error,
        })
      },
    })))
    if (fieldCandidates.length === 0) {
      input.onProgress?.({ completed: 0, total: 0 })
    }
  }

  return {
    tenantName: tradesSummary.tenantName,
    merchantId: tradesSummary.merchantId,
    startedAt,
    finishedAt: nowIso(),
    topLevelCount: tradesSummary.topLevelCount,
    flattenedCount: tradesSummary.flattenedCount,
    fieldTradeCount: includeFields ? fieldCandidates.length : 0,
    fieldConcurrency: includeFields ? fieldConcurrency(input.fieldConcurrency) : 0,
    fieldRetryCount: retryCount,
    fieldCount,
    zeroFieldCount,
    failedTradeCount: failures.length,
    failures,
  }
}
