import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Hono, type Context } from "hono"
import { bodyLimit } from "hono/body-limit"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { auditFromContext } from "../lib/audit"
import { requirePermission } from "../lib/auth"
import { maxUploadBytes, safeUploadFileName, writeValidatedUploadFile } from "../lib/upload-guard"
import {
  listListingLaunchPlanImports,
  listListingLaunchPlanRows,
} from "../services/listing-launch-plans"
import {
  enqueueListingLaunchPlanImportJob,
  getListingLaunchPlanImportJob,
} from "../services/listing-launch-plan-import-jobs"

const listingLaunchPlans = new Hono()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")
const MB = 1024 * 1024
const SPREADSHEET_MULTIPART_OVERHEAD_BYTES = MB
const spreadsheetUploadBodyLimit = bodyLimit({
  maxSize: maxUploadBytes("spreadsheet") + SPREADSHEET_MULTIPART_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: "上市计划表上传请求体过大，请压缩后重新上传" }, 413),
})

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function safeUploadName(fileName: string) {
  return safeUploadFileName(fileName, { fallbackName: "upload.xlsx" })
}

async function saveUploadedSpreadsheet(c: Context) {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "请上传上市计划表文件" })
  }
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filePath = path.join(UPLOAD_DIR, `${randomUUID()}-${safeUploadName(file.name)}`)
  try {
    await writeValidatedUploadFile(file, "spreadsheet", filePath)
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined)
    throw error
  }
  return { file, filePath }
}

listingLaunchPlans.get("/imports", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(listListingLaunchPlanImports(db, {
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  }))
})

listingLaunchPlans.get("/rows", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(listListingLaunchPlanRows(db, {
    q: c.req.query("q"),
    sheetName: c.req.query("sheetName"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    afterSpuCode: c.req.query("afterSpuCode"),
    afterRowId: c.req.query("afterRowId"),
    includeTotal: c.req.query("includeTotal"),
  }))
})

listingLaunchPlans.post("/imports", spreadsheetUploadBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const { file, filePath } = await saveUploadedSpreadsheet(c)
  let job: ReturnType<typeof enqueueListingLaunchPlanImportJob>
  try {
    job = enqueueListingLaunchPlanImportJob({
      fileName: file.name,
      fileSizeBytes: file.size,
      createdBy: user.id,
      username: user.username,
      filePath,
    })
  } catch (error) {
    await rm(filePath, { force: true })
    throw error
  }
  auditFromContext(c, {
    action: "listing_launch_plan.import_queued",
    module: "LISTING_LAUNCH_PLAN",
    entityType: "listing_launch_plan_import_job",
    entityId: job.id,
    summary: `上市计划表导入任务已加入队列 ${stringValue(file.name)}`,
    metadata: {
      jobId: job.id,
      fileName: file.name,
      fileSizeBytes: file.size,
      userId: user.id,
    },
  })
  return c.json(job, 202)
})

listingLaunchPlans.get("/import-jobs/:jobId", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const job = getListingLaunchPlanImportJob(c.req.param("jobId"))
  if (!job) {
    throw new HTTPException(404, { message: "上市计划表导入任务不存在" })
  }
  return c.json(job)
})

export default listingLaunchPlans
