import { AsyncLocalStorage } from "node:async_hooks"

const MAX_SPANS = 40
const MAX_ATTRIBUTES = 12
const MAX_ATTRIBUTE_KEY_LENGTH = 48
const MAX_ATTRIBUTE_VALUE_LENGTH = 120

const performanceStorage = new AsyncLocalStorage<RequestPerformanceContext>()

export type PerformanceAttribute = string | number | boolean | null

export type PerformanceSpan = {
  name: string
  durationMs: number
  attributes: Record<string, PerformanceAttribute>
}

export type RequestPerformanceContext = {
  requestId: string
  route: string
  startedAt: number
  queryCount: number
  queryDurationMs: number
  spans: PerformanceSpan[]
}

export type DatabasePerformanceEvent = {
  durationMs: number
  rowCount: number
  operation: string
}

const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|cookie|sql|query|body|payload/i
const SAFE_OPERATION_PATTERN = /^(select|insert|update|delete)$/

function boundedDuration(durationMs: number) {
  return Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs * 100) / 100 : 0
}

function sanitizeAttributes(attributes: Record<string, PerformanceAttribute>) {
  const sanitized: Record<string, PerformanceAttribute> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (Object.keys(sanitized).length >= MAX_ATTRIBUTES) break
    if (!key || key.length > MAX_ATTRIBUTE_KEY_LENGTH || SENSITIVE_KEY_PATTERN.test(key)) continue
    if (typeof value === "string") {
      const boundedValue = value.trim().slice(0, MAX_ATTRIBUTE_VALUE_LENGTH)
      if (!boundedValue || SENSITIVE_KEY_PATTERN.test(boundedValue)) continue
      sanitized[key] = boundedValue
      continue
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[key] = value
      continue
    }
    if (typeof value === "boolean" || value === null) sanitized[key] = value
  }
  return sanitized
}

export async function withRequestPerformanceContext<T>(
  requestId: string,
  route: string,
  run: () => T | Promise<T>,
): Promise<T> {
  const context: RequestPerformanceContext = {
    requestId: requestId.slice(0, 128),
    route: route.slice(0, 256),
    startedAt: Date.now(),
    queryCount: 0,
    queryDurationMs: 0,
    spans: [],
  }
  return performanceStorage.run(context, async () => await run())
}

export function getPerformanceContext(): RequestPerformanceContext | null {
  return performanceStorage.getStore() ?? null
}

export function recordPerformanceSpan(
  name: string,
  durationMs: number,
  attributes: Record<string, PerformanceAttribute> = {},
) {
  const context = getPerformanceContext()
  if (!context || context.spans.length >= MAX_SPANS) return
  const boundedName = name.trim().slice(0, 96)
  if (!boundedName) return
  context.spans.push({
    name: boundedName,
    durationMs: boundedDuration(durationMs),
    attributes: sanitizeAttributes(attributes),
  })
}

export function recordDatabaseQuery(event: DatabasePerformanceEvent) {
  const context = getPerformanceContext()
  if (!context) return
  context.queryCount += 1
  context.queryDurationMs += boundedDuration(event.durationMs)
}

export function summarizePerformanceContext(context = getPerformanceContext()) {
  if (!context) return null
  return {
    requestId: context.requestId,
    route: context.route,
    startedAt: context.startedAt,
    queryCount: context.queryCount,
    queryDurationMs: boundedDuration(context.queryDurationMs),
    spans: context.spans.map((span) => ({
      name: span.name,
      durationMs: span.durationMs,
      attributes: { ...span.attributes },
    })),
  }
}

export function isSafeDatabaseOperation(operation: string): operation is "select" | "insert" | "update" | "delete" {
  return SAFE_OPERATION_PATTERN.test(operation)
}
