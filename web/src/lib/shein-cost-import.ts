import type { SpreadsheetRow } from "./spreadsheet"

export interface CostImportRow {
  spuName: string
  skcName: string
  skuCode: string
  cost: string
  currency: string
  changeReasonCode: string
  rowNumber: number
}

export interface CostUpdatePayload {
  change_reason_code?: string
  spu_name: string
  skc_info_list: Array<{
    skc_name: string
    sku_info_list: Array<{
      sku_code: string
      cost: string
      currency: string
    }>
  }>
}

export interface PlatformRequestResult {
  status: number
  payload: unknown
}

export interface CostImportRequest {
  spuName: string
  currency: string
  changeReasonCode: string
  rows: CostImportRow[]
  payload: CostUpdatePayload
}

export interface CostImportRequestBatch {
  rowCount: number
  requests: CostImportRequest[]
}

export interface CostImportResult {
  spuName: string
  ok: boolean
  message: string
}

export interface CostImportProgress {
  completedGroups: number
  totalGroups: number
  rowCount: number
  currentSpuName: string
  ok: boolean
  message: string
}

export interface CostImportSubmitResult {
  results: CostImportResult[]
  rowCount: number
  groupCount: number
}

export interface CostImportSubmitOptions {
  concurrency?: number
  onProgress?: (progress: CostImportProgress) => void
}

export type PostCostImportRequest = (
  spuName: string,
  payload: CostUpdatePayload,
) => Promise<{ result: PlatformRequestResult }>

const COST_IMPORT_GROUP_SEPARATOR = "\u0001"
const DEFAULT_COST_IMPORT_CONCURRENCY = 4

function stringValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function recordValue(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function spreadsheetValue(row: SpreadsheetRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function responsePayload(result?: PlatformRequestResult | null) {
  return recordValue(result?.payload)
}

function responseCode(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).code)
}

function responseMessage(result?: PlatformRequestResult | null) {
  return stringValue(responsePayload(result).msg || responsePayload(result).message)
}

function responseOk(result?: PlatformRequestResult | null) {
  const code = responseCode(result)
  return Boolean(result) && (!code || code === "0") && Number(result?.status ?? 0) >= 200 && Number(result?.status ?? 0) < 300
}

function normalizeConcurrency(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return DEFAULT_COST_IMPORT_CONCURRENCY
  return Math.max(1, Math.floor(value))
}

export function parseCostImportRows(rows: SpreadsheetRow[]): CostImportRow[] {
  return rows.map((row, index) => ({
    spuName: spreadsheetValue(row, "SPU", "spu", "spuName", "款号"),
    skcName: spreadsheetValue(row, "SKC", "skc", "skcName"),
    skuCode: spreadsheetValue(row, "SKU", "sku", "skuCode"),
    cost: spreadsheetValue(row, "供货价", "成本价", "cost", "costPrice"),
    currency: spreadsheetValue(row, "币种", "currency") || "CNY",
    changeReasonCode: spreadsheetValue(row, "涨价原因", "changeReasonCode", "原因代码"),
    rowNumber: index + 2,
  })).filter((row) => row.spuName || row.skcName || row.skuCode || row.cost)
}

export function buildCostImportRequests(rows: CostImportRow[]): CostImportRequestBatch {
  const validRows = rows.filter((row) => row.spuName && row.skcName && row.skuCode && row.cost)
  if (!validRows.length) throw new Error("请先上传包含 SPU、SKC、SKU、供货价的表格")
  const invalidRow = validRows.find((row) => {
    const cost = Number(row.cost)
    return !Number.isFinite(cost) || cost <= 0 || cost >= 100000
  })
  if (invalidRow) throw new Error(`第 ${invalidRow.rowNumber} 行供货价需大于 0 且小于 100000`)

  const groups = new Map<string, CostImportRow[]>()
  for (const row of validRows) {
    const key = [row.spuName, row.currency || "CNY", row.changeReasonCode || ""].join(COST_IMPORT_GROUP_SEPARATOR)
    const groupRows = groups.get(key)
    if (groupRows) {
      groupRows.push(row)
    } else {
      groups.set(key, [row])
    }
  }

  return {
    rowCount: validRows.length,
    requests: Array.from(groups.entries()).map(([key, groupRows]) => {
      const [spuName, currency, changeReasonCode] = key.split(COST_IMPORT_GROUP_SEPARATOR)
      const skcGroups = new Map<string, CostImportRow[]>()
      for (const row of groupRows) {
        const skcRows = skcGroups.get(row.skcName)
        if (skcRows) {
          skcRows.push(row)
        } else {
          skcGroups.set(row.skcName, [row])
        }
      }
      const payload: CostUpdatePayload = {
        spu_name: spuName,
        skc_info_list: Array.from(skcGroups.entries()).map(([skcName, skcRows]) => ({
          skc_name: skcName,
          sku_info_list: skcRows.map((row) => ({
            sku_code: row.skuCode,
            cost: Number(row.cost).toFixed(2),
            currency: row.currency || currency || "CNY",
          })),
        })),
      }
      if (changeReasonCode) payload.change_reason_code = changeReasonCode
      return {
        spuName,
        currency,
        changeReasonCode,
        rows: groupRows,
        payload,
      }
    }),
  }
}

export async function submitCostImportRows(
  rows: CostImportRow[],
  postCostImportRequest: PostCostImportRequest,
  options: CostImportSubmitOptions = {},
): Promise<CostImportSubmitResult> {
  const batch = buildCostImportRequests(rows)
  const totalGroups = batch.requests.length
  const results: CostImportResult[] = new Array(totalGroups)
  const concurrency = Math.min(normalizeConcurrency(options.concurrency), totalGroups)
  let nextIndex = 0
  let completedGroups = 0

  async function worker() {
    while (nextIndex < totalGroups) {
      const requestIndex = nextIndex
      nextIndex += 1
      const request = batch.requests[requestIndex]
      let result: CostImportResult
      try {
        const data = await postCostImportRequest(request.spuName, request.payload)
        result = {
          spuName: request.spuName,
          ok: responseOk(data.result),
          message: responseMessage(data.result) || responseCode(data.result) || "",
        }
      } catch (error) {
        result = {
          spuName: request.spuName,
          ok: false,
          message: error instanceof Error ? error.message : "导入更新失败",
        }
      }
      results[requestIndex] = result
      completedGroups += 1
      options.onProgress?.({
        completedGroups,
        totalGroups,
        rowCount: batch.rowCount,
        currentSpuName: request.spuName,
        ok: result.ok,
        message: result.message,
      })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return {
    results,
    rowCount: batch.rowCount,
    groupCount: totalGroups,
  }
}
