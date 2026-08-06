import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { requestSheinWithRetry } from "../../../../scripts/lib/shein_client.mjs"
import {
  markPublishTaskFailed,
  markPublishTaskStatusSynced,
} from "./publish-job-service"
import { upsertAuditStatusSnapshots } from "../shein-operations"
import {
  mapSheinDocumentState,
  parseSheinDocumentStates,
  sheinDocumentStateLabel,
} from "./shein-status-parser"

type SourceRow = Record<string, unknown>

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>
  if (!value || typeof value !== "string") return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
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

function firstPlatformIdentity(db: SyncPostgresDatabase, task: SourceRow, platformType: string) {
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

function updateListingAndBucketStatus(db: SyncPostgresDatabase, listingId: unknown, status: string) {
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

function taskForStatusSync(db: SyncPostgresDatabase, taskId: number) {
  return db.prepare(`
    select
      task.*,
      listing.channel_account_id,
      listing.spu_code
    from listing_publish_task task
    join listing on listing.id = task.listing_id
    where task.id = ?
  `).get(taskId) as SourceRow | undefined
}

export async function syncPublishTaskStatus(db: SyncPostgresDatabase, taskId: number) {
  const task = taskForStatusSync(db, taskId)
  if (!task) {
    return {
      ok: false,
      task_id: taskId,
      error_code: "TASK_NOT_FOUND",
      error_message: "发布任务不存在",
    }
  }

  const platformVersion = normalizeText(task.platform_version)
  const spuIdentity = firstPlatformIdentity(db, task, "SPU")
  const spuName = normalizeText(spuIdentity?.platform_id)
  if (!spuName) {
    return {
      ok: false,
      task_id: taskId,
      listing_id: task.listing_id,
      error_code: "MISSING_SHEIN_SPU",
      error_message: "缺少 SHEIN spu_name，无法查询审核状态",
    }
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
      taskId,
      responsePayload: result.payload,
      errorCode: code || String(result.status),
      errorMessage: message,
    })
    return {
      ok: false,
      task_id: taskId,
      listing_id: task.listing_id,
      error_code: code || String(result.status),
      error_message: message,
      response: result.payload,
    }
  }

  const parsedStates = parseSheinDocumentStates(result.payload)
  if (!parsedStates.valid) {
    return {
      ok: false,
      task_id: taskId,
      listing_id: task.listing_id,
      error_code: "SHEIN_STATUS_UNKNOWN",
      error_message: parsedStates.reason || "SHEIN 审核状态无法确认",
      response: result.payload,
    }
  }
  const states = parsedStates.states
  const nextStatus = mapSheinDocumentState(states)
  if (nextStatus === "STATUS_UNKNOWN") {
    return {
      ok: false,
      task_id: taskId,
      listing_id: task.listing_id,
      error_code: "SHEIN_STATUS_UNKNOWN",
      error_message: "SHEIN 审核状态无法确认",
      response: result.payload,
    }
  }
  const reasons = failureReasons(result.payload)
  const message = reasons.join("；")
  upsertAuditStatusSnapshots(db, {
    sourceType: "PUBLISH_TASK",
    sourceId: taskId,
    result,
  })
  const syncedTask = markPublishTaskStatusSynced(db, {
    taskId,
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

  return {
    ok: true,
    task_id: taskId,
    listing_id: task.listing_id,
    status: nextStatus,
    task: syncedTask,
    state_labels: states.map(sheinDocumentStateLabel),
    response: result.payload,
  }
}
