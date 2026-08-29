import { Worker } from "node:worker_threads"
import { statSync } from "node:fs"

type JsonRecord = Record<string, unknown>

export interface SpreadsheetSheet {
  name: string
  rows: JsonRecord[]
}

interface SpreadsheetWorkerError {
  name?: string
  message?: string
  stack?: string
  code?: string
}

type SpreadsheetWorkerMessage =
  | { type: "chunk"; sequence: number; sheetIndex: number; name: string; rows: JsonRecord[] }
  | { type: "reset"; sequence: number }
  | { type: "done"; sequence: number }
  | { type: "error"; sequence: number; error?: SpreadsheetWorkerError }

export type SpreadsheetWorkerOptions = {
  fileName?: string | null
  signal?: AbortSignal
  chunkRows?: number
  maxSheets?: number
  maxRows?: number
  maxCells?: number
  maxCellChars?: number
  maxTotalChars?: number
  maxFileBytes?: number
  maxWorkerMemoryMb?: number
  onChunk?: (input: { sheetIndex: number; name: string; rowCount: number }) => void | Promise<void>
}

const SPREADSHEET_PARSE_WORKER_URL = new URL("../../../scripts/lib/spreadsheet_parse_worker.mjs", import.meta.url)
const DEFAULT_LIMITS = {
  chunkRows: 500,
  maxSheets: 50,
  maxRows: 200_000,
  maxCells: 4_000_000,
  maxCellChars: 100_000,
  maxTotalChars: 64 * 1024 * 1024,
  maxFileBytes: 50 * 1024 * 1024,
  maxWorkerMemoryMb: 256,
}

function boundedInteger(value: unknown, fallback: number, cap: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(1, Math.min(cap, Math.floor(parsed)))
}

function readLimits(options: SpreadsheetWorkerOptions) {
  return {
    chunkRows: boundedInteger(options.chunkRows ?? process.env.LISTINGIFY_SPREADSHEET_CHUNK_ROWS, DEFAULT_LIMITS.chunkRows, 5_000),
    maxSheets: boundedInteger(options.maxSheets ?? process.env.LISTINGIFY_SPREADSHEET_MAX_SHEETS, DEFAULT_LIMITS.maxSheets, 200),
    maxRows: boundedInteger(options.maxRows ?? process.env.LISTINGIFY_SPREADSHEET_MAX_ROWS, DEFAULT_LIMITS.maxRows, 1_000_000),
    maxCells: boundedInteger(options.maxCells ?? process.env.LISTINGIFY_SPREADSHEET_MAX_CELLS, DEFAULT_LIMITS.maxCells, 20_000_000),
    maxCellChars: boundedInteger(options.maxCellChars ?? process.env.LISTINGIFY_SPREADSHEET_MAX_CELL_CHARS, DEFAULT_LIMITS.maxCellChars, 1_000_000),
    maxTotalChars: boundedInteger(options.maxTotalChars ?? process.env.LISTINGIFY_SPREADSHEET_MAX_TOTAL_CHARS, DEFAULT_LIMITS.maxTotalChars, 256 * 1024 * 1024),
    maxFileBytes: boundedInteger(options.maxFileBytes ?? process.env.LISTINGIFY_SPREADSHEET_MAX_FILE_BYTES, DEFAULT_LIMITS.maxFileBytes, 200 * 1024 * 1024),
    maxWorkerMemoryMb: Math.max(64, boundedInteger(options.maxWorkerMemoryMb ?? process.env.LISTINGIFY_SPREADSHEET_WORKER_MEMORY_MB, DEFAULT_LIMITS.maxWorkerMemoryMb, 1_024)),
  }
}

function workerError(error?: SpreadsheetWorkerError) {
  const parsed = new Error(error?.message || "表格解析 worker 执行失败") as Error & { code?: string }
  parsed.name = error?.name || "SpreadsheetParseWorkerError"
  if (error?.stack) parsed.stack = error.stack
  if (error?.code) parsed.code = error.code
  return parsed
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isSpreadsheetWorkerMessage(value: unknown): value is SpreadsheetWorkerMessage {
  if (!isJsonRecord(value) || !Number.isInteger(value.sequence)) return false
  if (value.type === "reset" || value.type === "done") return true
  if (value.type === "error") return value.error == null || isJsonRecord(value.error)
  return value.type === "chunk"
    && Number.isInteger(value.sheetIndex)
    && typeof value.name === "string"
    && Array.isArray(value.rows)
    && value.rows.every(isJsonRecord)
}

function abortError() {
  const error = new Error("表格解析已取消")
  error.name = "AbortError"
  return error
}

export function readSpreadsheetSheetsFromFileInWorker(
  filePath: string,
  options: SpreadsheetWorkerOptions = {},
): Promise<SpreadsheetSheet[]> {
  const limits = readLimits(options)
  let fileSize: number
  try {
    fileSize = statSync(filePath).size
  } catch (error) {
    return Promise.reject(error)
  }
  if (fileSize > limits.maxFileBytes) {
    return Promise.reject(new Error(`表格文件大小超过 worker 限制（最多 ${limits.maxFileBytes} 字节）`))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(SPREADSHEET_PARSE_WORKER_URL, {
      workerData: {
        filePath,
        fileName: options.fileName ?? filePath,
        limits,
      },
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: limits.maxWorkerMemoryMb,
      },
    })
    let settled = false
    let rowCount = 0
    let cellCount = 0
    let totalChars = 0
    const sheets = new Map<number, SpreadsheetSheet>()

    const abortListener = () => {
      settle(() => reject(abortError()))
    }

    function settle(run: () => void) {
      if (settled) return
      settled = true
      options.signal?.removeEventListener("abort", abortListener)
      void worker.terminate()
      run()
    }

    function rejectProtocol(message: string) {
      settle(() => reject(new Error(message)))
    }

    function acknowledge(sequence: number) {
      worker.postMessage({ type: "ack", sequence })
    }

    options.signal?.addEventListener("abort", abortListener, { once: true })
    if (options.signal?.aborted) {
      abortListener()
      return
    }

    worker.on("message", async (message: unknown) => {
      if (settled) return
      if (!isSpreadsheetWorkerMessage(message)) {
        rejectProtocol("表格解析 worker 返回了不可识别的分块结果")
        return
      }
      if (message.type === "reset") {
        sheets.clear()
        rowCount = 0
        cellCount = 0
        totalChars = 0
        acknowledge(message.sequence)
        return
      }
      if (message.type === "error") {
        acknowledge(message.sequence)
        settle(() => reject(workerError(message.error)))
        return
      }
      if (message.type === "done") {
        acknowledge(message.sequence)
        const result = [...sheets.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, sheet]) => sheet)
        settle(() => resolve(result))
        return
      }
      if (message.sheetIndex < 0 || message.rows.length === 0 || message.rows.length > limits.chunkRows) {
        rejectProtocol("表格解析 worker 返回的分块大小不合法")
        return
      }
      if (!sheets.has(message.sheetIndex) && sheets.size >= limits.maxSheets) {
        rejectProtocol(`表格工作表数量超过限制（最多 ${limits.maxSheets} 个）`)
        return
      }
      for (const row of message.rows) {
        rowCount += 1
        if (rowCount > limits.maxRows) {
          rejectProtocol(`表格数据行数超过限制（最多 ${limits.maxRows} 行）`)
          return
        }
        for (const value of Object.values(row)) {
          cellCount += 1
          const chars = String(value ?? "").length
          totalChars += chars
          if (cellCount > limits.maxCells || chars > limits.maxCellChars || totalChars > limits.maxTotalChars) {
            rejectProtocol("表格单元格或文本总量超过资源限制")
            return
          }
        }
      }
      const sheet = sheets.get(message.sheetIndex) ?? { name: message.name, rows: [] }
      sheet.rows.push(...message.rows)
      sheets.set(message.sheetIndex, sheet)
      try {
        await options.onChunk?.({ sheetIndex: message.sheetIndex, name: message.name, rowCount: message.rows.length })
      } catch (error) {
        settle(() => reject(error))
        return
      }
      acknowledge(message.sequence)
    })
    worker.once("error", (error) => {
      settle(() => reject(error))
    })
    worker.once("exit", (code) => {
      if (settled) return
      settle(() => reject(new Error(code === 0
        ? "表格解析 worker 未返回完成消息"
        : `表格解析 worker 异常退出：${code}`)))
    })
  })
}
