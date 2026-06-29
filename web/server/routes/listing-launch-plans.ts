import { mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { auditFromContext } from "../lib/audit"
import { requirePermission } from "../lib/auth"
import { importProductArchiveSourceRows, refreshProductArchiveDraftsFromSourceBatch } from "../services/product-archive-drafts"
import {
  importListingLaunchPlanSheets,
  listListingLaunchPlanImports,
  listListingLaunchPlanRows,
} from "../services/listing-launch-plans"
import { readSpreadsheetSheetsFromFile } from "../../../scripts/lib/listing_launch_plan_importer.mjs"

const listingLaunchPlans = new Hono()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function safeUploadName(fileName: string) {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${Date.now()}-${base || "upload.xlsx"}`
}

async function saveUploadedSpreadsheet(c: Context) {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "请上传上市计划表文件" })
  }
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filePath = path.join(UPLOAD_DIR, safeUploadName(file.name))
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()))
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
  }))
})

listingLaunchPlans.post("/imports", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const { file, filePath } = await saveUploadedSpreadsheet(c)
  try {
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: file.name })
    const sourceBatchIds: number[] = []
    const refreshSummaries = []
    for (const sheet of sheets) {
      const sourceImport = importProductArchiveSourceRows(db, {
        sourceType: "launch_plan",
        fileName: file.name,
        sheetName: sheet.name,
        rows: sheet.rows,
      })
      const sourceBatchId = Number(sourceImport.batch.id)
      sourceBatchIds.push(sourceBatchId)
      refreshSummaries.push(refreshProductArchiveDraftsFromSourceBatch(db, {
        sourceBatchId,
        sourceType: "launch_plan",
      }))
    }
    const result = importListingLaunchPlanSheets(db, {
      fileName: file.name,
      fileSizeBytes: file.size,
      sheets,
      sourceBatchIds,
      createdBy: user.id,
    })
    auditFromContext(c, {
      action: "listing_launch_plan.imported",
      module: "LISTING_LAUNCH_PLAN",
      entityType: "listing_launch_plan_import",
      entityId: result.import.id,
      summary: `导入上市计划表 ${stringValue(file.name)}`,
      metadata: {
        fileName: file.name,
        inputRowCount: result.inputRowCount,
        insertedRowCount: result.insertedRowCount,
        sourceBatchIds,
        userId: user.id,
      },
    })
    return c.json({ ...result, sourceBatchIds, refreshSummaries })
  } finally {
    await rm(filePath, { force: true })
  }
})

export default listingLaunchPlans
