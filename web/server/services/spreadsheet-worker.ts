import { Worker } from "node:worker_threads"

type JsonRecord = Record<string, unknown>

export interface SpreadsheetSheet {
  name: string
  rows: JsonRecord[]
}

interface SpreadsheetWorkerError {
  name?: string
  message?: string
  stack?: string
}

type SpreadsheetWorkerMessage =
  | { ok: true; sheets: SpreadsheetSheet[] }
  | { ok: false; error?: SpreadsheetWorkerError }

const SPREADSHEET_PARSE_WORKER_URL = new URL("../../../scripts/lib/spreadsheet_parse_worker.mjs", import.meta.url)

function workerError(error?: SpreadsheetWorkerError) {
  const parsed = new Error(error?.message || "表格解析 worker 执行失败")
  parsed.name = error?.name || "SpreadsheetParseWorkerError"
  if (error?.stack) parsed.stack = error.stack
  return parsed
}

function isSpreadsheetWorkerMessage(value: unknown): value is SpreadsheetWorkerMessage {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return record.ok === true || record.ok === false
}

export function readSpreadsheetSheetsFromFileInWorker(
  filePath: string,
  options: { fileName?: string | null } = {},
): Promise<SpreadsheetSheet[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SPREADSHEET_PARSE_WORKER_URL, {
      workerData: {
        filePath,
        fileName: options.fileName ?? filePath,
      },
      execArgv: [],
    })
    let settled = false

    function settle(run: () => void) {
      if (settled) return
      settled = true
      run()
    }

    worker.once("message", (message: unknown) => {
      if (!isSpreadsheetWorkerMessage(message)) {
        settle(() => reject(new Error("表格解析 worker 返回了不可识别的结果")))
        return
      }
      if (message.ok) {
        settle(() => resolve(message.sheets))
        return
      }
      settle(() => reject(workerError(message.error)))
    })
    worker.once("error", (error) => {
      settle(() => reject(error))
    })
    worker.once("exit", (code) => {
      if (code === 0) return
      settle(() => reject(new Error(`表格解析 worker 异常退出：${code}`)))
    })
  })
}
