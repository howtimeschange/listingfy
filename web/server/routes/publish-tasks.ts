import { Hono } from "hono"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { requestSheinWithRetry } from "../../../scripts/lib/shein_client.mjs"
import {
  markPublishTaskFailed,
  markPublishTaskStatusSynced,
  refreshBatchPublishSummary as refreshBatchPublishSummaryForBatch,
} from "../services/publish/publish-job-service"
import { upsertAuditStatusSnapshots } from "../services/shein-operations"

const publishTasks = new Hono()

type SourceRow = Record<string, unknown>

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function readLimit(value: string | undefined, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: string | undefined) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function readCsv(value: string | undefined) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== "all"),
    ),
  )
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>
  if (!value || typeof value !== "string") return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function responseCode(payload: unknown) {
  return normalizeText(parseJsonObject(payload).code)
}

function responseMessage(payload: unknown) {
  const object = parseJsonObject(payload)
  return normalizeText(object.msg) || normalizeText(object.message)
}

function publishInfo(payload: unknown) {
  return parseJsonObject(parseJsonObject(payload).info)
}

function firstPlatformIdentity(db: ReturnType<typeof getDb>, task: SourceRow, platformType: string) {
  return db.prepare(`
    select identity.*
    from platform_identity identity
    where identity.platform = ?
      and identity.channel_account_id = ?
      and identity.local_type = 'listing'
      and identity.local_id = ?
      and identity.platform_type = ?
    order by identity.id desc
    limit 1
  `).get(task.platform, task.channel_account_id, task.listing_id, platformType) as SourceRow | undefined
}

function documentStateLabel(state: number) {
  const labels: Record<number, string> = {
    [-1]: "接收失败",
    1: "待审核",
    2: "审批成功",
    3: "审批失败",
    4: "已撤回",
    5: "申诉中",
  }
  return labels[state] ?? `未知状态 ${state}`
}

function mapDocumentState(states: number[]) {
  if (states.length === 0) return "UNDER_REVIEW"
  if (states.some((state) => state === 3 || state === -1)) return "REJECTED"
  if (states.every((state) => state === 2)) return "APPROVED"
  if (states.some((state) => state === 2) && states.some((state) => [1, 5].includes(state))) return "PARTIALLY_APPROVED"
  if (states.some((state) => [1, 5].includes(state))) return "UNDER_REVIEW"
  return "UNDER_REVIEW"
}

function failureReasons(documentPayload: unknown) {
  const info = publishInfo(documentPayload)
  const rows = parseJsonArray(info.data)
  const output: string[] = []
  for (const row of rows) {
    const object = parseJsonObject(row)
    for (const skc of parseJsonArray(object.skcList ?? object.skc_list)) {
      const skcObject = parseJsonObject(skc)
      const skcName = normalizeText(skcObject.skcName ?? skcObject.skc_name)
      const documentSn = normalizeText(skcObject.documentSn ?? skcObject.document_sn)
      for (const reason of parseJsonArray(skcObject.failedReason ?? skcObject.failed_reason)) {
        const reasonObject = parseJsonObject(reason)
        const content = normalizeText(reasonObject.content)
        if (content) output.push(`${skcName || documentSn || "SKC"}：${content}`)
      }
    }
  }
  return output
}

function documentStates(documentPayload: unknown) {
  const info = publishInfo(documentPayload)
  const states: number[] = []
  for (const row of parseJsonArray(info.data)) {
    const object = parseJsonObject(row)
    for (const skc of parseJsonArray(object.skcList ?? object.skc_list)) {
      const state = Number(parseJsonObject(skc).documentState ?? parseJsonObject(skc).document_state)
      if (Number.isFinite(state)) states.push(state)
    }
  }
  return states
}

function updateListingAndBucketStatus(db: ReturnType<typeof getDb>, listingId: unknown, status: string) {
  const listing = db.prepare("select * from listing where id = ?").get(listingId) as SourceRow | undefined
  db.prepare(`
    update listing
    set status = ?,
      validation_status = case when ? in ('APPROVED', 'UNDER_REVIEW', 'PUBLISH_SUBMITTED') then 'PASSED' else validation_status end,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(status, status, listingId)
  if (listing?.spu_code) {
    db.prepare(`
      update shein_product_bucket
      set latest_listing_id = ?,
        latest_publish_status = ?,
        bucket_status = case when ? = 'APPROVED' then 'PUBLISHED' else bucket_status end,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where spu_code = ?
    `).run(listingId, status, status, listing.spu_code)
  }
}

function refreshBatchPublishSummary(db: ReturnType<typeof getDb>, listingId: unknown) {
  const listing = db.prepare("select platform, listing_batch_no from listing where id = ?").get(listingId) as SourceRow | undefined
  const batchNo = normalizeText(listing?.listing_batch_no)
  const platform = normalizeText(listing?.platform)
  if (!batchNo || !platform) return
  refreshBatchPublishSummaryForBatch(db, { platform, batchNo })
}

function taskBaseFrom() {
  return `
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    join product_spu spu on spu.id = listing.product_spu_id
    join channel_account account on account.id = listing.channel_account_id
    left join listing_publish_version version on version.id = task.publish_version_id
  `
}

function taskSelect() {
  return `
    select
      task.*,
      listing.spu_code,
      listing.title,
      listing.status as listing_status,
      listing.validation_status,
      listing.platform_category_id,
      listing.product_type_id,
      listing.platform_category_name,
      listing.platform_category_path,
      listing.completeness,
      listing.channel_account_id,
      account.account_name,
      spu.spu_name,
      spu.brand_name,
      version.version_no,
      version.status as version_status,
      version.change_summary,
      version.submitted_at
  `
}

function buildListWhere(c: Context) {
  const platform = normalizeText(c.req.query("platform") ?? "SHEIN")
  const q = normalizeText(c.req.query("q"))
  const batchSearch = readCsv(c.req.query("batch_search"))
  const statuses = readCsv(c.req.query("statuses") ?? c.req.query("status"))
  const hasFailureReason = normalizeText(c.req.query("has_failure_reason") ?? c.req.query("hasFailureReason"))
  const failureReason = normalizeText(c.req.query("failure_reason") ?? c.req.query("failureReason"))
  const clauses: string[] = []
  const params: unknown[] = []

  if (platform && platform !== "all") {
    clauses.push("task.platform = ?")
    params.push(platform)
  }
  if (statuses.length > 0) {
    clauses.push(`task.status in (${statuses.map(() => "?").join(", ")})`)
    params.push(...statuses)
  }
  if (hasFailureReason === "1" || hasFailureReason.toLowerCase() === "true") {
    clauses.push("coalesce(task.error_message, '') <> ''")
  }
  if (failureReason) {
    clauses.push("coalesce(task.error_message, '') like ?")
    params.push(`%${failureReason}%`)
  }

  const terms = Array.from(new Set([q, ...batchSearch].filter(Boolean)))
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() => `(
      listing.spu_code like ?
      or listing.listing_batch_no like ?
      or listing.title like ?
      or spu.spu_name like ?
      or task.platform_trace_id like ?
      or task.platform_version like ?
      or task.error_code like ?
      or task.error_message like ?
    )`).join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like, like, like, like, like, like)
    }
  }

  return {
    where: clauses.length ? `where ${clauses.join(" and ")}` : "",
    params,
  }
}

publishTasks.get("/", (c) => {
  const db = getDb()
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { where, params } = buildListWhere(c)
  const from = taskBaseFrom()

  const items = db.prepare(`
    ${taskSelect()}
    ${from}
    ${where}
    order by task.created_at desc, task.id desc
    limit ? offset ?
  `).all(...params, limit, offset) as SourceRow[]

  const total = db.prepare(`
    select count(*) as count
    ${from}
    ${where}
  `).get(...params) as { count: number }

  const statusRows = db.prepare(`
    select task.status, count(*) as count
    ${from}
    ${where}
    group by task.status
    order by count(*) desc
  `).all(...params) as SourceRow[]
  const failureReasonRows = db.prepare(`
    select task.error_message as reason, count(*) as count
    ${from}
    ${where}
      ${where ? "and" : "where"} coalesce(task.error_message, '') <> ''
    group by task.error_message
    order by count(*) desc
    limit 8
  `).all(...params) as SourceRow[]

  return c.json({
    items,
    summary: {
      total: Number(total.count ?? 0),
      by_status: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count ?? 0)])),
      failure_reason_groups: failureReasonRows.map((row) => ({
        reason: normalizeText(row.reason),
        count: Number(row.count ?? 0),
      })),
    },
    pagination: {
      total: Number(total.count ?? 0),
      limit,
      offset,
    },
  })
})

publishTasks.get("/filters", (c) => {
  const db = getDb()
  const platforms = db.prepare(`
    select platform, count(*) as count
    from listing_publish_task
    group by platform
    order by platform
  `).all() as SourceRow[]
  const statuses = db.prepare(`
    select status, count(*) as count
    from listing_publish_task
    group by status
    order by status
  `).all() as SourceRow[]
  const failureReasons = db.prepare(`
    select error_message as reason, count(*) as count
    from listing_publish_task
    where coalesce(error_message, '') <> ''
    group by error_message
    order by count(*) desc
    limit 20
  `).all() as SourceRow[]
  return c.json({ platforms, statuses, failure_reasons: failureReasons })
})

publishTasks.post("/audit-status/sync", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as SourceRow
  const taskIds = parseJsonArray(body.taskIds ?? body.task_ids)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
  const tasks = taskIds.length
    ? db.prepare(`
        ${taskSelect()}
        ${taskBaseFrom()}
        where task.id in (${taskIds.map(() => "?").join(", ")})
        order by task.id desc
      `).all(...taskIds) as SourceRow[]
    : db.prepare(`
        ${taskSelect()}
        ${taskBaseFrom()}
        where task.platform = 'SHEIN'
          and task.status in ('PUBLISH_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'PARTIALLY_APPROVED')
        order by task.created_at desc, task.id desc
        limit 50
      `).all() as SourceRow[]

  const results = []
  for (const task of tasks) {
    const platformVersion = normalizeText(task.platform_version)
    const spuIdentity = firstPlatformIdentity(db, task, "SPU")
    const spuName = normalizeText(spuIdentity?.platform_id)
    if (!spuName) {
      results.push({ task_id: task.id, ok: false, error_message: "缺少 SHEIN spu_name" })
      continue
    }
    const body = {
      spuList: [
        {
          spuName,
          ...(platformVersion ? { version: platformVersion } : {}),
        },
      ],
    }
    const result = await requestSheinWithRetry("/open-api/goods/query-document-state", { body })
    if (responseCode(result.payload) === "0") {
      upsertAuditStatusSnapshots(db, {
        sourceType: "PUBLISH_TASK",
        sourceId: task.id == null ? "" : String(task.id),
        result,
      })
      const states = documentStates(result.payload)
      const nextStatus = mapDocumentState(states)
      const reasons = failureReasons(result.payload)
      markPublishTaskStatusSynced(db, {
        taskId: Number(task.id),
        status: nextStatus,
        responsePayload: result.payload,
        errorCode: nextStatus === "REJECTED" ? "SHEIN_AUDIT_REJECTED" : null,
        errorMessage: nextStatus === "REJECTED" ? reasons.join("；") || "SHEIN 审核驳回" : null,
      })
      updateListingAndBucketStatus(db, task.listing_id, nextStatus)
      refreshBatchPublishSummary(db, task.listing_id)
      results.push({ task_id: task.id, ok: true, status: nextStatus })
    } else {
      const message = responseMessage(result.payload) || "SHEIN 审核状态查询失败"
      markPublishTaskFailed(db, {
        taskId: Number(task.id),
        responsePayload: result.payload,
        errorCode: responseCode(result.payload) || String(result.status),
        errorMessage: message,
      })
      results.push({ task_id: task.id, ok: false, error_message: message })
    }
  }

  return c.json({
    ok: true,
    synced: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    results,
  })
})

publishTasks.get("/:id", (c) => {
  const db = getDb()
  const taskId = Number(c.req.param("id"))
  if (!Number.isFinite(taskId)) {
    throw new HTTPException(400, { message: "无效发布任务 ID" })
  }

  const task = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.id = ?
  `).get(taskId) as SourceRow | undefined
  if (!task) {
    throw new HTTPException(404, { message: "发布任务不存在" })
  }

  const platformIdentities = db.prepare(`
    select identity.*
    from platform_identity identity
    where identity.platform = ?
      and identity.channel_account_id = ?
      and (
        (identity.local_type = 'listing' and identity.local_id = ?)
        or (identity.local_type = 'listing_skc' and identity.local_id in (
          select id from listing_skc where listing_id = ?
        ))
        or (identity.local_type = 'listing_sku' and identity.local_id in (
          select sku.id
          from listing_sku sku
          join listing_skc skc on skc.id = sku.listing_skc_id
          where skc.listing_id = ?
        ))
      )
    order by
      case identity.local_type when 'listing' then 1 when 'listing_skc' then 2 else 3 end,
      identity.id
  `).all(task.platform, task.channel_account_id, task.listing_id, task.listing_id, task.listing_id) as SourceRow[]

  const relatedTasks = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.listing_id = ?
    order by task.id desc
  `).all(task.listing_id) as SourceRow[]

  return c.json({
    task: {
      ...task,
      request_payload: parseJsonObject(task.request_payload_json),
      response_payload: parseJsonObject(task.response_payload_json),
    },
    platform_identities: platformIdentities,
    related_tasks: relatedTasks,
  })
})

publishTasks.post("/:id/retry", (c) => {
  const db = getDb()
  const taskId = Number(c.req.param("id"))
  const task = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.id = ?
  `).get(taskId) as SourceRow | undefined
  if (!task) {
    throw new HTTPException(404, { message: "发布任务不存在" })
  }
  const status = normalizeText(task.status)
  if (!["PUBLISH_FAILED", "FAILED", "REJECTED", "PARTIALLY_APPROVED"].includes(status)) {
    throw new HTTPException(400, { message: "只有失败或驳回任务可以从任务页重提" })
  }

  const latestVersion = db.prepare(`
    select coalesce(max(version_no), 0) + 1 as next_no
    from listing_publish_version
    where listing_id = ?
  `).get(task.listing_id) as SourceRow
  const requestPayload = parseJsonObject(task.request_payload_json)
  const responsePayload = parseJsonObject(task.response_payload_json)
  const result = db.prepare(`
    insert into listing_publish_version (
      listing_id,
      version_no,
      version_type,
      status,
      change_summary,
      source_snapshot_json,
      request_payload_json,
      response_payload_json,
      error_code,
      error_message,
      created_by
    )
    values (?, ?, 'RETRY', 'DRAFT', ?, ?, ?, ?, ?, ?, 'codex')
  `).run(
    task.listing_id,
    Number(latestVersion.next_no ?? 1),
    `从发布任务 #${task.id} 失败结果重提`,
    JSON.stringify({
      retry_from_task_id: task.id,
      retry_from_version_id: task.publish_version_id,
      retry_reason: task.error_message,
      listing_status: task.listing_status,
      validation_status: task.validation_status,
    }),
    JSON.stringify(requestPayload),
    JSON.stringify(responsePayload),
    normalizeText(task.error_code) || null,
    normalizeText(task.error_message) || null,
  )
  const version = db.prepare("select * from listing_publish_version where id = ?").get(result.lastInsertRowid) as SourceRow
  db.prepare(`
    update listing
    set status = 'READY_TO_VALIDATE',
      validation_status = 'NOT_VALIDATED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(task.listing_id)
  updateListingAndBucketStatus(db, task.listing_id, "READY_TO_VALIDATE")
  return c.json({
    ok: true,
    version,
    listing_id: task.listing_id,
    redirect_to: `/pre-publish-validation/${task.listing_id}`,
  })
})

publishTasks.post("/:id/sync-status", async (c) => {
  const db = getDb()
  const taskId = Number(c.req.param("id"))
  const task = db.prepare(`
    ${taskSelect()}
    ${taskBaseFrom()}
    where task.id = ?
  `).get(taskId) as SourceRow | undefined
  if (!task) {
    throw new HTTPException(404, { message: "发布任务不存在" })
  }
  const platformVersion = normalizeText(task.platform_version)
  const spuIdentity = firstPlatformIdentity(db, task, "SPU")
  const spuName = normalizeText(spuIdentity?.platform_id)
  if (!spuName) {
    throw new HTTPException(400, { message: "缺少 SHEIN spu_name，无法查询审核状态" })
  }
  const body = {
    spuList: [
      {
        spuName,
        ...(platformVersion ? { version: platformVersion } : {}),
      },
    ],
  }
  const result = await requestSheinWithRetry("/open-api/goods/query-document-state", { body })
  const code = responseCode(result.payload)
  if (code !== "0") {
    const message = responseMessage(result.payload) || "SHEIN 审核状态查询失败"
    markPublishTaskFailed(db, {
      taskId: Number(task.id),
      responsePayload: result.payload,
      errorCode: code || String(result.status),
      errorMessage: message,
    })
    throw new HTTPException(502, { message })
  }
  const states = documentStates(result.payload)
  const nextStatus = mapDocumentState(states)
  const reasons = failureReasons(result.payload)
  const message = reasons.join("；")
  upsertAuditStatusSnapshots(db, {
    sourceType: "PUBLISH_TASK",
    sourceId: task.id == null ? "" : String(task.id),
    result,
  })
  markPublishTaskStatusSynced(db, {
    taskId: Number(task.id),
    status: nextStatus,
    responsePayload: result.payload,
    errorCode: nextStatus === "REJECTED" ? "SHEIN_AUDIT_REJECTED" : null,
    errorMessage: nextStatus === "REJECTED" ? message || "SHEIN 审核驳回" : null,
  })
  if (task.publish_version_id) {
    db.prepare(`
      update listing_publish_version
      set status = ?,
        response_payload_json = ?,
        error_code = case when ? = 'REJECTED' then 'SHEIN_AUDIT_REJECTED' else error_code end,
        error_message = case when ? = 'REJECTED' then ? else error_message end
      where id = ?
    `).run(nextStatus, JSON.stringify(result.payload), nextStatus, nextStatus, message || "SHEIN 审核驳回", task.publish_version_id)
  }
  updateListingAndBucketStatus(db, task.listing_id, nextStatus)
  refreshBatchPublishSummary(db, task.listing_id)
  db.prepare("delete from listing_validation_result where listing_id = ? and module = 'SHEIN_AUDIT'").run(task.listing_id)
  if (nextStatus === "REJECTED") {
    db.prepare(`
      insert into listing_validation_result (
        listing_id,
        severity,
        module,
        field_key,
        owner_type,
        owner_id,
        message,
        suggestion
      )
      values (?, 'ERROR', 'SHEIN_AUDIT', 'audit_status', 'LISTING', ?, ?, ?)
    `).run(task.listing_id, task.listing_id, message || "SHEIN 审核驳回", "按 SHEIN 审核原因修正草稿，生成新版本后重新发布。")
  }
  return c.json({
    ok: true,
    status: nextStatus,
    state_labels: states.map(documentStateLabel),
    response: result.payload,
  })
})

export default publishTasks
