import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { getDb } from "../db"
import { currentUser, type AuthUser } from "../lib/auth"
import { resolveSheinCredentials, type SheinCredentials } from "../lib/platform-config"
import { sheinAdapter } from "../platform-adapters"
import type { PlatformRequestResult } from "../platform-adapters/types"

type JsonRecord = Record<string, unknown>

interface SheinOperationContext {
  credentials: SheinCredentials
  platform: "SHEIN"
  platformAccountKey: string
  platformIntegrationId: number | null
}

interface OperationActor {
  id: number | null
  username: string | null
}

export interface AuditSnapshotInput {
  context?: SheinOperationContext
  sourceType: "PUBLISH_TASK" | "PLATFORM_PRODUCT" | "LIFECYCLE_OPERATION"
  sourceId?: string | number | null
  result: PlatformRequestResult | { status: number; payload: unknown }
  traceId?: string | null
}

const FALLBACK_PRICE_REASONS = [
  { reasonCode: "1", reasonText: "商品成本上涨" },
  { reasonCode: "2", reasonText: "物流履约费用上涨" },
  { reasonCode: "3", reasonText: "活动结束恢复价格" },
  { reasonCode: "4", reasonText: "其他" },
  { reasonCode: "5", reasonText: "物流履约费用上涨（物流规则调整）" },
]

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function recordValue(value: unknown): JsonRecord {
  if (isRecord(value)) return value
  if (typeof value !== "string" || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function arrayRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (typeof value !== "string" || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch {
    return []
  }
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function jsonArrayText(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [])
}

function responsePayload(result?: PlatformRequestResult | { payload: unknown } | null) {
  return recordValue(result?.payload)
}

function responseInfo(result?: PlatformRequestResult | { payload: unknown } | null) {
  return recordValue(responsePayload(result).info)
}

function responseCode(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).code)
}

function responseMessage(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).msg || responsePayload(result).message)
}

function responseTraceId(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).traceId || responsePayload(result).trace_id)
}

function responseOk(result?: PlatformRequestResult | null) {
  const code = responseCode(result)
  return Boolean(result) && Number(result?.status ?? 0) >= 200 && Number(result?.status ?? 0) < 300 && (!code || code === "0")
}

function readLimit(value: unknown, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function splitTextList(value: unknown, max = 200) {
  const source = Array.isArray(value) ? value.join("\n") : normalizeText(value)
  return Array.from(new Set(source.split(/[\s,，;；|]+/).map((item) => item.trim()).filter(Boolean))).slice(0, max)
}

function actorFromUser(user: AuthUser | null | undefined): OperationActor | null {
  if (!user) return null
  return { id: user.id, username: user.username }
}

export function operationActorFromContext(c: Parameters<typeof currentUser>[0]) {
  return actorFromUser(currentUser(c))
}

function platformContext(db: SyncPostgresDatabase): SheinOperationContext {
  const credentials = resolveSheinCredentials(db)
  return {
    credentials,
    platform: "SHEIN",
    platformIntegrationId: credentials.platformIntegrationId,
    platformAccountKey: credentials.platformIntegrationId
      ? `integration:${credentials.platformIntegrationId}`
      : `env:${credentials.openKeyId || "default"}`,
  }
}

function serializeRegressionLog(row: JsonRecord) {
  return {
    id: Number(row.id),
    scenario: stringValue(row.scenario),
    spuName: stringValue(row.spu_name),
    skcName: stringValue(row.skc_name),
    skuCode: stringValue(row.sku_code),
    status: stringValue(row.status),
    traceId: stringValue(row.trace_id),
    errorMessage: stringValue(row.error_message),
    operatorNote: stringValue(row.operator_note),
    actorUsername: stringValue(row.actor_username),
    createdAt: stringValue(row.created_at),
    requestPayload: recordValue(row.request_payload_json),
    responsePayload: recordValue(row.response_payload_json),
  }
}

export function createRegressionLog(input: unknown, actor?: OperationActor | null) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const scenario = stringValue(object.scenario)
  if (!scenario) throw new Error("请选择回归场景")
  const status = stringValue(object.status || "PASS").toUpperCase()
  if (!["PASS", "FAIL", "BLOCKED"].includes(status)) throw new Error("回归状态只能是 PASS、FAIL 或 BLOCKED")
  const result = db.prepare(`
    insert into shein_real_data_regression_log (
      platform,
      platform_account_key,
      platform_integration_id,
      scenario,
      spu_name,
      skc_name,
      sku_code,
      status,
      trace_id,
      request_payload_json,
      response_payload_json,
      error_message,
      operator_note,
      actor_user_id,
      actor_username,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    context.platform,
    context.platformAccountKey,
    context.platformIntegrationId,
    scenario,
    stringValue(object.spuName ?? object.spu_name) || null,
    stringValue(object.skcName ?? object.skc_name) || null,
    stringValue(object.skuCode ?? object.sku_code) || null,
    status,
    stringValue(object.traceId ?? object.trace_id) || null,
    jsonText(object.requestPayload ?? object.request_payload ?? {}),
    jsonText(object.responsePayload ?? object.response_payload ?? {}),
    stringValue(object.errorMessage ?? object.error_message) || null,
    stringValue(object.operatorNote ?? object.operator_note) || null,
    actor?.id ?? null,
    actor?.username ?? null,
    nowIso(),
  )
  const row = db.prepare("select * from shein_real_data_regression_log where id = ?").get(result.lastInsertRowid) as JsonRecord
  return serializeRegressionLog(row)
}

export function listRegressionLogs(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit, 50, 200)
  const offset = readOffset(object.offset)
  const params: unknown[] = [context.platform, context.platformAccountKey]
  const where = ["platform = ?", "platform_account_key = ?"]
  const scenario = stringValue(object.scenario)
  if (scenario) {
    where.push("scenario = ?")
    params.push(scenario)
  }
  const total = db.prepare(`
    select count(*) as count
    from shein_real_data_regression_log
    where ${where.join(" and ")}
  `).get(...params) as { count: number }
  const rows = db.prepare(`
    select *
    from shein_real_data_regression_log
    where ${where.join(" and ")}
    order by created_at desc, id desc
    limit ? offset ?
  `).all(...params, limit, offset) as JsonRecord[]
  return {
    items: rows.map(serializeRegressionLog),
    pagination: { total: Number(total.count ?? 0), limit, offset },
  }
}

function identityRows(result: PlatformRequestResult) {
  return arrayRecords(responseInfo(result).list)
}

export async function syncNumberList(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const page = Math.max(1, Number(object.page ?? 1) || 1)
  const perPage = readLimit(object.per_page ?? object.perPage, 100, 100)
  const type = Math.max(1, Number(object.type ?? 1) || 1)
  const requestPayload = { page, per_page: perPage, type }
  const result = await sheinAdapter.queryNumberList({ credentials: context.credentials, payload: requestPayload })
  let synced = 0
  const traceId = responseTraceId(result)
  if (responseOk(result)) {
    for (const row of identityRows(result)) {
      const skcName = stringValue(row.skc ?? row.skc_name)
      const skuCode = stringValue(row.sku_code ?? row.skuCode)
      const supplierSku = stringValue(row.supplier_sku ?? row.supplierSku)
      const designCode = stringValue(row.design_code ?? row.designCode)
      db.prepare(`
        insert into shein_platform_identity_snapshot (
          platform,
          platform_account_key,
          platform_integration_id,
          skc_name,
          sku_code,
          supplier_sku,
          design_code,
          attribute_text,
          number_type,
          source_page,
          raw_payload_json,
          trace_id,
          last_synced_at,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(platform, platform_account_key, number_type, skc_name, sku_code, design_code, supplier_sku) do update set
          platform_integration_id = excluded.platform_integration_id,
          attribute_text = excluded.attribute_text,
          source_page = excluded.source_page,
          raw_payload_json = excluded.raw_payload_json,
          trace_id = excluded.trace_id,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at
      `).run(
        context.platform,
        context.platformAccountKey,
        context.platformIntegrationId,
        skcName,
        skuCode,
        supplierSku,
        designCode,
        stringValue(row.attribute),
        type,
        page,
        jsonText(row),
        traceId || null,
        nowIso(),
        nowIso(),
      )
      if (skuCode || supplierSku) {
        db.prepare(`
          update shein_platform_sku
          set supplier_sku = coalesce(nullif(?, ''), supplier_sku),
            sale_attribute_text = coalesce(nullif(?, ''), sale_attribute_text),
            updated_at = ?
          where sku_code = ?
        `).run(supplierSku, stringValue(row.attribute), nowIso(), skuCode)
      }
      synced += 1
    }
  }
  return {
    result,
    persistence: { synced },
    page,
    perPage,
    type,
    count: Number(responseInfo(result).count ?? synced),
    items: listNumberList({ limit: perPage, offset: 0 }).items,
  }
}

function serializeIdentity(row: JsonRecord) {
  return {
    id: Number(row.id),
    skcName: stringValue(row.skc_name),
    skuCode: stringValue(row.sku_code),
    supplierSku: stringValue(row.supplier_sku),
    designCode: stringValue(row.design_code),
    attributeText: stringValue(row.attribute_text),
    numberType: Number(row.number_type ?? 1),
    sourcePage: Number(row.source_page ?? 0),
    traceId: stringValue(row.trace_id),
    lastSyncedAt: stringValue(row.last_synced_at),
  }
}

export function listNumberList(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit)
  const offset = readOffset(object.offset)
  const search = stringValue(object.search)
  const params: unknown[] = [context.platform, context.platformAccountKey]
  const where = ["platform = ?", "platform_account_key = ?"]
  if (search) {
    where.push("(skc_name like ? or sku_code like ? or supplier_sku like ? or design_code like ?)")
    const like = `%${search}%`
    params.push(like, like, like, like)
  }
  const total = db.prepare(`
    select count(*) as count
    from shein_platform_identity_snapshot
    where ${where.join(" and ")}
  `).get(...params) as { count: number }
  const rows = db.prepare(`
    select *
    from shein_platform_identity_snapshot
    where ${where.join(" and ")}
    order by coalesce(last_synced_at, updated_at) desc, id desc
    limit ? offset ?
  `).all(...params, limit, offset) as JsonRecord[]
  return { items: rows.map(serializeIdentity), pagination: { total: Number(total.count ?? 0), limit, offset } }
}

function supplierSkuRows(result: PlatformRequestResult) {
  return arrayRecords(responsePayload(result).info)
}

export async function checkSupplierSkuRepeated(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const supplierSkuList = splitTextList(object.supplierSkuList ?? object.supplier_sku_list ?? object.supplierSkus ?? object.text, 200)
  if (!supplierSkuList.length) throw new Error("请输入商家 SKU")
  const requestPayload = { supplierSkuList }
  const result = await sheinAdapter.checkSupplierSkuRepeated({ credentials: context.credentials, payload: requestPayload })
  const traceId = responseTraceId(result)
  const rows = responseOk(result)
    ? supplierSkuRows(result)
    : supplierSkuList.map((supplierSku) => ({ supplierSku, repeated: false }))
  for (const row of rows) {
    const supplierSku = stringValue(row.supplierSku ?? row.supplier_sku)
    if (!supplierSku) continue
    db.prepare(`
      insert into shein_supplier_sku_check (
        platform,
        platform_account_key,
        platform_integration_id,
        supplier_sku,
        repeated,
        source_type,
        source_id,
        raw_payload_json,
        trace_id,
        checked_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      context.platform,
      context.platformAccountKey,
      context.platformIntegrationId,
      supplierSku,
      row.repeated === true ? 1 : 0,
      stringValue(object.sourceType ?? object.source_type) || null,
      stringValue(object.sourceId ?? object.source_id) || null,
      jsonText(row),
      traceId || null,
      nowIso(),
      nowIso(),
    )
  }
  const items = rows.map((row) => ({
    supplierSku: stringValue(row.supplierSku ?? row.supplier_sku),
    repeated: row.repeated === true,
  }))
  return {
    result,
    items,
    repeated: items.filter((item) => item.repeated),
    available: items.filter((item) => !item.repeated),
  }
}

export function listSupplierSkuChecks(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit)
  const offset = readOffset(object.offset)
  const rows = db.prepare(`
    select *
    from shein_supplier_sku_check
    where platform = ?
      and platform_account_key = ?
    order by checked_at desc, id desc
    limit ? offset ?
  `).all(context.platform, context.platformAccountKey, limit, offset) as JsonRecord[]
  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      supplierSku: stringValue(row.supplier_sku),
      repeated: Number(row.repeated) === 1,
      sourceType: stringValue(row.source_type),
      sourceId: stringValue(row.source_id),
      traceId: stringValue(row.trace_id),
      checkedAt: stringValue(row.checked_at),
    })),
  }
}

export async function syncBarcodeSizes(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const barcodes = splitTextList(object.barcodes ?? object.data ?? object.text, 200)
  if (!barcodes.length) throw new Error("请输入商品条码")
  const result = await sheinAdapter.batchSkcSize({ credentials: context.credentials, payload: { data: barcodes } })
  const traceId = responseTraceId(result)
  const info = responseInfo(result)
  let synced = 0
  if (responseOk(result)) {
    for (const barcode of barcodes) {
      const row = recordValue(info[barcode])
      db.prepare(`
        insert into shein_barcode_size_snapshot (
          platform,
          platform_account_key,
          platform_integration_id,
          barcode,
          skc_name,
          sku_code,
          size_text,
          raw_payload_json,
          trace_id,
          last_synced_at,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(platform, platform_account_key, barcode) do update set
          platform_integration_id = excluded.platform_integration_id,
          skc_name = excluded.skc_name,
          sku_code = excluded.sku_code,
          size_text = excluded.size_text,
          raw_payload_json = excluded.raw_payload_json,
          trace_id = excluded.trace_id,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at
      `).run(
        context.platform,
        context.platformAccountKey,
        context.platformIntegrationId,
        barcode,
        stringValue(row.skc ?? row.skc_name) || null,
        stringValue(row.sku_code ?? row.skuCode) || null,
        stringValue(row.size) || null,
        jsonText(row),
        traceId || null,
        nowIso(),
        nowIso(),
      )
      synced += Object.keys(row).length ? 1 : 0
    }
  }
  return { result, persistence: { synced, requested: barcodes.length }, items: listBarcodeSizes({ limit: barcodes.length }).items }
}

export function listBarcodeSizes(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit)
  const offset = readOffset(object.offset)
  const rows = db.prepare(`
    select *
    from shein_barcode_size_snapshot
    where platform = ?
      and platform_account_key = ?
    order by coalesce(last_synced_at, updated_at) desc, id desc
    limit ? offset ?
  `).all(context.platform, context.platformAccountKey, limit, offset) as JsonRecord[]
  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      barcode: stringValue(row.barcode),
      skcName: stringValue(row.skc_name),
      skuCode: stringValue(row.sku_code),
      sizeText: stringValue(row.size_text),
      traceId: stringValue(row.trace_id),
      lastSyncedAt: stringValue(row.last_synced_at),
    })),
  }
}

function printTaskStatus(result: PlatformRequestResult) {
  if (!responseOk(result)) return "FAILED"
  const info = responseInfo(result)
  const errors = arrayRecords(info.errorData ?? info.error_data)
  if (errors.length) return stringValue(info.url) ? "PARTIAL_FAILED" : "FAILED"
  return "SUCCESS"
}

export async function createBarcodePrintTask(input: unknown = {}, actor?: OperationActor | null) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const data = arrayRecords(object.data).map((row) => ({
    orderNo: stringValue(row.orderNo ?? row.order_no) || null,
    supplierSku: stringValue(row.supplierSku ?? row.supplier_sku) || null,
    printNumber: Math.max(1, Number(row.printNumber ?? row.print_number ?? 1) || 1),
    sheinSku: stringValue(row.sheinSku ?? row.shein_sku ?? row.skuCode ?? row.sku_code),
  })).filter((row) => row.sheinSku || row.supplierSku)
  if (!data.length) throw new Error("请输入要打印的 SKU 或商家 SKU")
  const totalPrints = data.reduce((sum, row) => sum + row.printNumber, 0)
  if (totalPrints > 2000) throw new Error("单次累计打印份数不能超过 2000")
  const requestPayload = {
    data,
    ...(numberValue(object.printContentType ?? object.print_content_type) ? { printContentType: numberValue(object.printContentType ?? object.print_content_type) } : {}),
    ...(numberValue(object.printFormatType ?? object.print_format_type) ? { printFormatType: numberValue(object.printFormatType ?? object.print_format_type) } : {}),
  }
  const pending = db.prepare(`
    insert into shein_barcode_print_task (
      platform,
      platform_account_key,
      platform_integration_id,
      status,
      print_content_type,
      print_format_type,
      request_payload_json,
      created_by_user_id,
      created_by_username,
      updated_at
    )
    values (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)
  `).run(
    context.platform,
    context.platformAccountKey,
    context.platformIntegrationId,
    numberValue(object.printContentType ?? object.print_content_type),
    numberValue(object.printFormatType ?? object.print_format_type),
    jsonText(requestPayload),
    actor?.id ?? null,
    actor?.username ?? null,
    nowIso(),
  )
  const taskId = Number(pending.lastInsertRowid)
  const result = await sheinAdapter.printBarcode({ credentials: context.credentials, payload: requestPayload })
  const info = responseInfo(result)
  const status = printTaskStatus(result)
  const errorRows = arrayRecords(info.errorData ?? info.error_data)
  const errorMessage = errorRows.flatMap((row) => {
    const messages = Array.isArray(row.errorMsg ?? row.error_msg) ? row.errorMsg ?? row.error_msg : []
    return messages.map((message) => stringValue(message)).filter(Boolean)
  }).join("；") || (responseOk(result) ? "" : responseMessage(result))
  db.prepare(`
    update shein_barcode_print_task
    set status = ?,
      response_payload_json = ?,
      barcode_url = ?,
      trace_id = ?,
      error_message = ?,
      updated_at = ?
    where id = ?
  `).run(status, jsonText(result.payload), stringValue(info.url) || null, responseTraceId(result) || null, errorMessage || null, nowIso(), taskId)

  const codingRows = arrayRecords(info.codingInfoList ?? info.coding_info_list)
  const errorsBySku = new Map(errorRows.map((row) => [stringValue(row.sheinSku ?? row.shein_sku ?? row.supplierSku), row]))
  for (const row of data) {
    const coding = codingRows.find((item) => stringValue(item.sheinSku ?? item.shein_sku) === row.sheinSku) ?? {}
    const error = errorsBySku.get(row.sheinSku) ?? errorsBySku.get(row.supplierSku ?? "") ?? {}
    const messages = Array.isArray(error.errorMsg ?? error.error_msg) ? error.errorMsg ?? error.error_msg : []
    db.prepare(`
      insert into shein_barcode_print_task_item (
        task_id,
        order_no,
        supplier_sku,
        sku_code,
        print_number,
        barcode,
        custom_coding_json,
        error_messages_json,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      row.orderNo,
      row.supplierSku,
      row.sheinSku,
      row.printNumber,
      stringValue(coding.barcode) || null,
      jsonArrayText(coding.customCodingList ?? coding.custom_coding_list ?? []),
      jsonArrayText(messages),
      nowIso(),
    )
  }
  return { result, task: getBarcodePrintTask(taskId) }
}

function getBarcodePrintTask(taskId: number) {
  const db = getDb()
  const task = db.prepare("select * from shein_barcode_print_task where id = ?").get(taskId) as JsonRecord | undefined
  if (!task) return null
  const items = db.prepare(`
    select *
    from shein_barcode_print_task_item
    where task_id = ?
    order by id
  `).all(taskId) as JsonRecord[]
  return {
    id: Number(task.id),
    status: stringValue(task.status),
    barcodeUrl: stringValue(task.barcode_url),
    traceId: stringValue(task.trace_id),
    errorMessage: stringValue(task.error_message),
    createdByUsername: stringValue(task.created_by_username),
    createdAt: stringValue(task.created_at),
    items: items.map((item) => ({
      id: Number(item.id),
      orderNo: stringValue(item.order_no),
      supplierSku: stringValue(item.supplier_sku),
      skuCode: stringValue(item.sku_code),
      printNumber: Number(item.print_number ?? 1),
      barcode: stringValue(item.barcode),
      errorMessages: Array.isArray(JSON.parse(stringValue(item.error_messages_json) || "[]")) ? JSON.parse(stringValue(item.error_messages_json) || "[]") : [],
    })),
  }
}

export function listBarcodePrintTasks(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit)
  const offset = readOffset(object.offset)
  const rows = db.prepare(`
    select id
    from shein_barcode_print_task
    where platform = ?
      and platform_account_key = ?
    order by created_at desc, id desc
    limit ? offset ?
  `).all(context.platform, context.platformAccountKey, limit, offset) as JsonRecord[]
  return { items: rows.map((row) => getBarcodePrintTask(Number(row.id))).filter(Boolean) }
}

function normalizeReasonRows(result: PlatformRequestResult) {
  const info = responsePayload(result).info
  const rows = arrayRecords(info)
  if (rows.length) return rows.map((row) => ({
    reasonCode: stringValue(row.reasonCode ?? row.reason_code ?? row.code ?? row.value),
    reasonText: stringValue(row.reasonText ?? row.reason_text ?? row.name ?? row.label ?? row.text),
    raw: row,
  })).filter((row) => row.reasonCode && row.reasonText)
  return []
}

function upsertCostReasons(db: SyncPostgresDatabase, context: SheinOperationContext, rows: Array<{ reasonCode: string; reasonText: string; raw?: unknown }>) {
  for (const row of rows) {
    db.prepare(`
      insert into shein_cost_change_reason (
        platform,
        platform_account_key,
        platform_integration_id,
        reason_code,
        reason_text,
        enabled,
        raw_payload_json,
        last_synced_at,
        updated_at
      )
      values (?, ?, ?, ?, ?, 1, ?, ?, ?)
      on conflict(platform, platform_account_key, reason_code) do update set
        platform_integration_id = excluded.platform_integration_id,
        reason_text = excluded.reason_text,
        enabled = 1,
        raw_payload_json = excluded.raw_payload_json,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `).run(
      context.platform,
      context.platformAccountKey,
      context.platformIntegrationId,
      row.reasonCode,
      row.reasonText,
      jsonText(row.raw ?? { source: "DOCUMENT_FALLBACK" }),
      nowIso(),
      nowIso(),
    )
  }
}

export async function syncCostChangeReasons(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const requestPayload = recordValue(input)
  let result: PlatformRequestResult | null = null
  let source = "DOCUMENT_FALLBACK"
  try {
    result = await sheinAdapter.queryChangePriceReason({ credentials: context.credentials, payload: requestPayload })
    const rows = responseOk(result) ? normalizeReasonRows(result) : []
    if (rows.length) {
      upsertCostReasons(db, context, rows)
      source = "SHEIN"
    } else {
      upsertCostReasons(db, context, FALLBACK_PRICE_REASONS.map((row) => ({ ...row, raw: { source: "DOCUMENT_FALLBACK" } })))
    }
  } catch {
    upsertCostReasons(db, context, FALLBACK_PRICE_REASONS.map((row) => ({ ...row, raw: { source: "DOCUMENT_FALLBACK" } })))
  }
  return { result, source, items: listCostChangeReasons().items }
}

export function listCostChangeReasons() {
  const db = getDb()
  const context = platformContext(db)
  let rows = db.prepare(`
    select *
    from shein_cost_change_reason
    where platform = ?
      and platform_account_key = ?
      and enabled = 1
    order by cast(reason_code as integer), reason_code
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  if (!rows.length) {
    upsertCostReasons(db, context, FALLBACK_PRICE_REASONS.map((row) => ({ ...row, raw: { source: "DOCUMENT_FALLBACK" } })))
    rows = db.prepare(`
      select *
      from shein_cost_change_reason
      where platform = ?
        and platform_account_key = ?
        and enabled = 1
      order by cast(reason_code as integer), reason_code
    `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  }
  return {
    source: rows.some((row) => stringValue(recordValue(row.raw_payload_json).source) === "DOCUMENT_FALLBACK") ? "DOCUMENT_FALLBACK" : "SHEIN",
    items: rows.map((row) => ({
      id: Number(row.id),
      reasonCode: stringValue(row.reason_code),
      reasonText: stringValue(row.reason_text),
      lastSyncedAt: stringValue(row.last_synced_at),
      rawPayload: recordValue(row.raw_payload_json),
    })),
  }
}

function documentStateLabel(state: number | null) {
  const labels: Record<number, string> = {
    [-1]: "接收失败",
    1: "待审核",
    2: "审批成功",
    3: "审批失败",
    4: "已撤回",
    5: "申诉中",
  }
  return state == null ? "未知" : labels[state] ?? `未知状态 ${state}`
}

function documentRows(payload: unknown) {
  return arrayRecords(recordValue(recordValue(payload).info).data)
}

function failureReasonRows(skc: JsonRecord) {
  return arrayRecords(skc.failedReason ?? skc.failed_reason).map((row) => ({
    content: stringValue(row.content ?? row.message),
    language: stringValue(row.language),
  })).filter((row) => row.content)
}

export function upsertAuditStatusSnapshots(db: SyncPostgresDatabase, input: AuditSnapshotInput) {
  const context = input.context ?? platformContext(db)
  const payload = responsePayload(input.result)
  const traceId = input.traceId || stringValue(payload.traceId ?? payload.trace_id)
  let count = 0
  for (const row of documentRows(payload)) {
    const spuName = stringValue(row.spuName ?? row.spu_name)
    const version = stringValue(row.version)
    if (!spuName) continue
    for (const skc of arrayRecords(row.skcList ?? row.skc_list)) {
      const state = numberValue(skc.documentState ?? skc.document_state)
      const reasons = failureReasonRows(skc)
      db.prepare(`
        insert into shein_audit_status_snapshot (
          platform,
          platform_account_key,
          platform_integration_id,
          source_type,
          source_id,
          spu_name,
          skc_name,
          document_sn,
          document_state,
          document_state_label,
          version,
          failure_reasons_json,
          failure_reason_text,
          raw_payload_json,
          trace_id,
          last_synced_at,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(platform, platform_account_key, source_type, source_id, spu_name, skc_name, document_sn, version) do update set
          platform_integration_id = excluded.platform_integration_id,
          document_state = excluded.document_state,
          document_state_label = excluded.document_state_label,
          failure_reasons_json = excluded.failure_reasons_json,
          failure_reason_text = excluded.failure_reason_text,
          raw_payload_json = excluded.raw_payload_json,
          trace_id = excluded.trace_id,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at
      `).run(
        context.platform,
        context.platformAccountKey,
        context.platformIntegrationId,
        input.sourceType,
        input.sourceId == null ? "" : String(input.sourceId),
        spuName,
        stringValue(skc.skcName ?? skc.skc_name) || null,
        stringValue(skc.documentSn ?? skc.document_sn) || null,
        state,
        documentStateLabel(state),
        version || null,
        jsonArrayText(reasons),
        reasons.map((reason) => reason.content).join("；") || null,
        jsonText(skc),
        traceId || null,
        nowIso(),
        nowIso(),
      )
      count += 1
    }
  }
  return { count }
}

function serializeAudit(row: JsonRecord) {
  return {
    id: Number(row.id),
    sourceType: stringValue(row.source_type),
    sourceId: stringValue(row.source_id),
    spuName: stringValue(row.spu_name),
    skcName: stringValue(row.skc_name),
    documentSn: stringValue(row.document_sn),
    documentState: numberValue(row.document_state),
    documentStateLabel: stringValue(row.document_state_label),
    version: stringValue(row.version),
    failureReasonText: stringValue(row.failure_reason_text),
    handledStatus: stringValue(row.handled_status),
    ownerUsername: stringValue(row.owner_username),
    traceId: stringValue(row.trace_id),
    lastSyncedAt: stringValue(row.last_synced_at),
  }
}

export function listAuditStatus(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const limit = readLimit(object.limit, 100, 300)
  const offset = readOffset(object.offset)
  const params: unknown[] = [context.platform, context.platformAccountKey]
  const where = ["platform = ?", "platform_account_key = ?"]
  const handledStatus = stringValue(object.handledStatus ?? object.handled_status)
  if (handledStatus) {
    where.push("handled_status = ?")
    params.push(handledStatus)
  }
  const rows = db.prepare(`
    select *
    from shein_audit_status_snapshot
    where ${where.join(" and ")}
    order by coalesce(last_synced_at, updated_at) desc, id desc
    limit ? offset ?
  `).all(...params, limit, offset) as JsonRecord[]
  const allRows = db.prepare(`
    select *
    from shein_audit_status_snapshot
    where platform = ?
      and platform_account_key = ?
  `).all(context.platform, context.platformAccountKey) as JsonRecord[]
  const bySource: Record<string, number> = {}
  const failureGroups = new Map<string, number>()
  for (const row of allRows) {
    const source = stringValue(row.source_type) || "UNKNOWN"
    bySource[source] = (bySource[source] ?? 0) + 1
    const reason = stringValue(row.failure_reason_text)
    if (reason) {
      const key = reason.slice(0, 80)
      failureGroups.set(key, (failureGroups.get(key) ?? 0) + 1)
    }
  }
  return {
    items: rows.map(serializeAudit),
    summary: {
      total: allRows.length,
      bySource,
      open: allRows.filter((row) => stringValue(row.handled_status) === "OPEN").length,
      rejected: allRows.filter((row) => Number(row.document_state) === 3 || Number(row.document_state) === -1).length,
      failureReasonGroups: Array.from(failureGroups.entries()).map(([reason, count]) => ({ reason, count })),
    },
    pagination: { total: allRows.length, limit, offset },
  }
}

export async function syncAuditStatus(input: unknown = {}) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const spuNames = splitTextList(object.spuNames ?? object.spu_names ?? object.text, 10)
  if (!spuNames.length) return { result: null, persistence: { count: 0 }, audit: listAuditStatus({}) }
  const requestPayload = {
    spuList: spuNames.map((spuName) => ({ spuName })),
  }
  const result = await sheinAdapter.queryDocumentState({ credentials: context.credentials, payload: requestPayload })
  const persistence = responseOk(result)
    ? upsertAuditStatusSnapshots(db, { context, sourceType: "PLATFORM_PRODUCT", sourceId: "manual", result })
    : { count: 0 }
  return { result, persistence, audit: listAuditStatus({}) }
}

export function updateAuditHandling(id: number, input: unknown = {}, actor?: OperationActor | null) {
  const db = getDb()
  const context = platformContext(db)
  const object = recordValue(input)
  const handledStatus = stringValue(object.handledStatus ?? object.handled_status)
  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"].includes(handledStatus)) throw new Error("处理状态无效")
  const ownerUsername = stringValue(object.ownerUsername ?? object.owner_username) || actor?.username || null
  db.prepare(`
    update shein_audit_status_snapshot
    set handled_status = ?,
      owner_user_id = ?,
      owner_username = ?,
      updated_at = ?
    where id = ?
      and platform = ?
      and platform_account_key = ?
  `).run(
    handledStatus,
    actor?.id ?? null,
    ownerUsername,
    nowIso(),
    id,
    context.platform,
    context.platformAccountKey,
  )
  return db.prepare("select * from shein_audit_status_snapshot where id = ?").get(id)
}
