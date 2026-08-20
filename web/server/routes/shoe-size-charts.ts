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
import { readSpreadsheetSheetsFromFile } from "../../../scripts/lib/listing_launch_plan_importer.mjs"
import {
  createShoeSizeChartRow,
  importShoeSizeChartRows,
  listShoeSizeChartRows,
  listShoeSizeCharts,
  normalizeShoeSizeChartImportRows,
  updateShoeSizeChart,
  updateShoeSizeChartRow,
} from "../services/shoe-size-charts"

const shoeSizeCharts = new Hono()
const UPLOAD_DIR = path.join(os.tmpdir(), "listingify-upload")
const MB = 1024 * 1024
const SPREADSHEET_MULTIPART_OVERHEAD_BYTES = MB
const spreadsheetUploadBodyLimit = bodyLimit({
  maxSize: maxUploadBytes("spreadsheet") + SPREADSHEET_MULTIPART_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: "鞋品尺码表上传请求体过大，请压缩后重新上传" }, 413),
})

async function saveUploadedSpreadsheet(c: Context) {
  const form = await c.req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new HTTPException(400, { message: "请上传鞋品尺码表" })
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filePath = path.join(
    UPLOAD_DIR,
    `${randomUUID()}-${safeUploadFileName(file.name, { fallbackName: "shoe-size-chart.xlsx" })}`,
  )
  try {
    await writeValidatedUploadFile(file, "spreadsheet", filePath)
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined)
    throw error
  }
  return { form, file, filePath }
}

async function readJson(c: Context) {
  try {
    return await c.req.json()
  } catch {
    return {}
  }
}

function readId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HTTPException(400, { message: "无效的尺码明细 ID" })
  return id
}

shoeSizeCharts.get("/", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  return c.json({ charts: listShoeSizeCharts(getDb()) })
})

shoeSizeCharts.get("/rows", (c) => {
  requirePermission(c, "PRODUCT_ARCHIVE_DRAFT_READ")
  return c.json(listShoeSizeChartRows(getDb(), {
    chartCode: c.req.query("chartCode"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  }))
})

shoeSizeCharts.post("/imports", spreadsheetUploadBodyLimit, async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const { form, file, filePath } = await saveUploadedSpreadsheet(c)
  try {
    const sheets = await readSpreadsheetSheetsFromFile(filePath, { fileName: file.name })
    const defaultChartCode = String(form.get("chartCode") ?? form.get("chart_code") ?? "").trim()
    const errors: Array<{ sheetName: string; rowNumber: number; chartCode: string | null; sizeValue: string | null; reason: string }> = []
    const rowMap = new Map<string, ReturnType<typeof normalizeShoeSizeChartImportRows>["rows"][number]>()
    let duplicateCount = 0
    const parsedSheets = sheets.map((sheet) => ({
      sheet,
      parsed: normalizeShoeSizeChartImportRows(sheet.rows, { defaultChartCode }),
    }))
    const authoritativeSheets = parsedSheets.filter(({ parsed }) => parsed.sourceFormat === "balabala_horizontal")
    const conversionSheets = parsedSheets.filter(({ parsed }) => parsed.sourceFormat === "balabala_conversion")
    const selectedSheets = authoritativeSheets.length > 0
      ? [...authoritativeSheets, ...conversionSheets]
      : conversionSheets.length > 0
        ? conversionSheets
        : parsedSheets
    for (const { sheet, parsed } of selectedSheets) {
      duplicateCount += parsed.duplicateCount
      parsed.errors.forEach((error) => errors.push({ ...error, sheetName: sheet.name }))
      parsed.rows.forEach((row) => {
        const key = `${row.chartCode}:${row.sizeValue}`
        const existing = rowMap.get(key)
        if (authoritativeSheets.length > 0 && parsed.sourceFormat === "balabala_conversion" && existing) {
          rowMap.set(key, {
            ...existing,
            generalMappingText: row.generalMappingText,
            douyinMappingText: row.douyinMappingText,
            vipMappingText: row.vipMappingText,
            videoPddVipMappingText: row.videoPddVipMappingText,
            pinduoduoMappingText: row.pinduoduoMappingText,
          })
          return
        }
        if (rowMap.has(key)) duplicateCount += 1
        rowMap.set(key, row)
      })
    }
    const rows = [...rowMap.values()]
    const platformMappingRowCount = rows.filter((row) => row.generalMappingText || row.douyinMappingText || row.vipMappingText || row.videoPddVipMappingText).length
    if (rows.length === 0) {
      const firstReason = errors[0]?.reason ? `：${errors[0].reason}` : ""
      throw new HTTPException(400, { message: `没有可导入的鞋品尺码明细${firstReason}` })
    }
    const result = importShoeSizeChartRows(getDb(), {
      rows,
      userId: user.id,
      sourceFileName: file.name,
    })
    const response = {
      ...result,
      fileName: file.name,
      sheetCount: selectedSheets.length,
      sourceSheetCount: sheets.length,
      importedSheetNames: selectedSheets.map(({ sheet }) => sheet.name),
      parsedRowCount: rows.length,
      platformMappingRowCount,
      duplicateCount,
      skippedCount: duplicateCount,
      failedCount: errors.length,
      errors,
    }
    auditFromContext(c, {
      action: "shoe_size_chart.imported",
      module: "PRODUCT_ARCHIVE_RULE",
      entityType: "product_archive_shoe_size_chart_row",
      entityId: null,
      summary: `导入覆盖鞋品尺码表 ${file.name}`,
      metadata: {
        fileName: file.name,
        sheetCount: selectedSheets.length,
        sourceSheetCount: sheets.length,
        importedSheetNames: selectedSheets.map(({ sheet }) => sheet.name),
        parsedRowCount: rows.length,
        platformMappingRowCount,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        skippedCount: duplicateCount,
        failedCount: errors.length,
        userId: user.id,
      },
    })
    return c.json(response)
  } finally {
    await rm(filePath, { force: true })
  }
})

shoeSizeCharts.post("/rows", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const row = createShoeSizeChartRow(getDb(), { ...await readJson(c), userId: user.id })
  auditFromContext(c, {
    action: "shoe_size_chart_row.created",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "product_archive_shoe_size_chart_row",
    entityId: row.id,
    summary: `新增鞋品尺码 ${row.size_value}`,
    metadata: { chartId: row.chart_id, userId: user.id },
  })
  return c.json(row, 201)
})

shoeSizeCharts.patch("/rows/:rowId", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const row = updateShoeSizeChartRow(getDb(), readId(c.req.param("rowId")), {
    ...await readJson(c),
    userId: user.id,
  })
  auditFromContext(c, {
    action: "shoe_size_chart_row.updated",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "product_archive_shoe_size_chart_row",
    entityId: row.id,
    summary: `更新鞋品尺码 ${row.size_value}`,
    metadata: { chartId: row.chart_id, userId: user.id },
  })
  return c.json(row)
})

shoeSizeCharts.patch("/:chartCode", async (c) => {
  const user = requirePermission(c, "PRODUCT_ARCHIVE_RULE_MANAGE")
  const chartCode = c.req.param("chartCode")
  const chart = updateShoeSizeChart(getDb(), chartCode, await readJson(c))
  auditFromContext(c, {
    action: "shoe_size_chart.updated",
    module: "PRODUCT_ARCHIVE_RULE",
    entityType: "product_archive_shoe_size_chart",
    entityId: chart.id,
    summary: `更新鞋品尺码模板 ${chart.chart_name}`,
    metadata: { chartCode, userId: user.id },
  })
  return c.json(chart)
})

export default shoeSizeCharts
