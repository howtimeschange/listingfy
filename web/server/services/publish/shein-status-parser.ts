type SourceRow = Record<string, unknown>

function parseObject(value: unknown): SourceRow {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as SourceRow
  if (typeof value !== "string" || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SourceRow : {}
  } catch {
    return {}
  }
}

const VALID_DOCUMENT_STATES = new Set([-1, 1, 2, 3, 4, 5])

export interface ParsedSheinDocumentStates {
  valid: boolean
  states: number[]
  reason?: string
}

export function parseSheinDocumentStates(payload: unknown): ParsedSheinDocumentStates {
  const root = parseObject(payload)
  const info = parseObject(root.info)
  const rawRows = info.data
  if (!Array.isArray(rawRows)) {
    return { valid: false, states: [], reason: "SHEIN 审核状态响应缺少 data 数组" }
  }
  if (rawRows.length === 0) {
    return { valid: false, states: [], reason: "SHEIN 审核状态响应为空" }
  }

  const states: number[] = []
  for (const row of rawRows) {
    const object = parseObject(row)
    const rawSkcs = object.skcList ?? object.skc_list
    if (!Array.isArray(rawSkcs) || rawSkcs.length === 0) {
      return { valid: false, states: [], reason: "SHEIN 审核状态响应缺少 skcList" }
    }
    for (const skc of rawSkcs) {
      const skcObject = parseObject(skc)
      const rawState = skcObject.documentState ?? skcObject.document_state
      const state = Number(rawState)
      if (!Number.isFinite(state) || !VALID_DOCUMENT_STATES.has(state)) {
        return { valid: false, states: [], reason: "SHEIN 审核状态包含未知值" }
      }
      states.push(state)
    }
  }
  return states.length > 0
    ? { valid: true, states }
    : { valid: false, states: [], reason: "SHEIN 审核状态未返回任何 SKC" }
}

export function mapSheinDocumentState(states: number[]) {
  if (states.some((state) => state === 3 || state === -1)) return "REJECTED"
  if (states.every((state) => state === 2)) return "APPROVED"
  if (states.some((state) => state === 2) && states.some((state) => [1, 5].includes(state))) return "PARTIALLY_APPROVED"
  if (states.some((state) => [1, 5].includes(state))) return "UNDER_REVIEW"
  if (states.some((state) => state === 4)) return "REVOKED"
  return "STATUS_UNKNOWN"
}

export function sheinDocumentStateLabel(state: number) {
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
