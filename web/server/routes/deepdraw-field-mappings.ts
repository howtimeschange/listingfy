import { mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { auditFromContext } from "../lib/audit"
import { requirePermission } from "../lib/auth"
import { parseDeepdrawFieldMappingRows } from "../../../scripts/lib/deepdraw_field_mapping_importer.mjs"
import { readSpreadsheetSheetsFromFile } from "../../../scripts/lib/listing_launch_plan_importer.mjs"
import {
  createDeepdrawFieldMappingRule,
  deleteDeepdrawFieldMappingRule,
  importDeepdrawFieldMappingRows,
  listDeepdrawFieldMappingRules,
  updateDeepdrawFieldMappingRule,
} from "../services/deepdraw-field-mappings"

const deepdrawFieldMappings = new Hono()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function readId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new HTTPException(400, { message: "无效的字段对应关系 ID" })
  }
  return id
}

async function readJson(c: Context) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

function safeUploadName(fileName: string) {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${Date.now()}-${base || "field-mapping.xlsx"}`
}

async function saveUploadedSpreadsheet(c: Context) {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "请上传深绘字段对应关系表" })
  }
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filePath = path.join(UPLOAD_DIR, safeUploadName(file.name))
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()))
  return { form, file, filePath }
}

deepdrawFieldMappings.get("/", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  const db = getDb()
  return c.json(listDeepdrawFieldMappingRules(db, {
    tenantName: c.req.query("tenantName"),
    merchantId: c.req.query("merchantId"),
    sourceType: c.req.query("sourceType"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  }))
})

deepdrawFieldMappings.post("/imports", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const { form, file, filePath } = await saveUploadedSpreadsheet(c)
  const tenantName = stringValue(form.get("tenantName") ?? form.get("tenant_name"))
  const merchantId = stringValue(form.get("merchantId") ?? form.get("merchant_id"))
  if (!tenantName || !merchantId) {
    throw new HTTPException(400, { message: "请先选择深绘品牌租户和商户 ID" })
  }
  try {
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: file.name })
    const rows = sheets.flatMap((sheet) => parseDeepdrawFieldMappingRows(sheet.rows))
    const result = importDeepdrawFieldMappingRows(db, {
      tenantName,
      merchantId,
      rows,
      createdBy: user.id,
    })
    auditFromContext(c, {
      action: "deepdraw_field_mapping.imported",
      module: "PRODUCT_ARCHIVE_RULE",
      entityType: "deepdraw_field_mapping_rule",
      entityId: null,
      summary: `导入深绘字段对应关系 ${tenantName}`,
      metadata: {
        tenantName,
        merchantId,
        fileName: file.name,
        sheetCount: sheets.length,
        parsedRowCount: rows.length,
        upsertedCount: result.upsertedCount,
        userId: user.id,
      },
    })
    return c.json({ ...result, sheetCount: sheets.length, fileName: file.name })
  } finally {
    await rm(filePath, { force: true })
  }
})

deepdrawFieldMappings.post("/", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const rule = createDeepdrawFieldMappingRule(db, { ...await readJson(c), createdBy: user.id })
  auditFromContext(c, {
    action: "deepdraw_field_mapping.created",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "deepdraw_field_mapping_rule",
    entityId: rule.id,
    summary: `新增深绘字段对应关系 ${rule.deepdraw_field}`,
    metadata: { tenantName: rule.tenant_name, merchantId: rule.merchant_id, userId: user.id },
  })
  return c.json(rule, 201)
})

deepdrawFieldMappings.patch("/:ruleId", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const ruleId = readId(c.req.param("ruleId"))
  const rule = updateDeepdrawFieldMappingRule(db, ruleId, await readJson(c))
  auditFromContext(c, {
    action: "deepdraw_field_mapping.updated",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "deepdraw_field_mapping_rule",
    entityId: rule.id,
    summary: `更新深绘字段对应关系 ${rule.deepdraw_field}`,
    metadata: { tenantName: rule.tenant_name, merchantId: rule.merchant_id, userId: user.id },
  })
  return c.json(rule)
})

deepdrawFieldMappings.delete("/:ruleId", (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const db = getDb()
  const ruleId = readId(c.req.param("ruleId"))
  const rule = deleteDeepdrawFieldMappingRule(db, ruleId)
  auditFromContext(c, {
    action: "deepdraw_field_mapping.deleted",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "deepdraw_field_mapping_rule",
    entityId: ruleId,
    summary: `删除深绘字段对应关系 ${rule.deepdraw_field}`,
    metadata: { tenantName: rule.tenant_name, merchantId: rule.merchant_id, userId: user.id },
  })
  return c.json({ ok: true, rule })
})

export default deepdrawFieldMappings
