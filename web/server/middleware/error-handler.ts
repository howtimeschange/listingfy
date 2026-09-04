import type { Context, Next } from "hono"
import { HTTPException } from "hono/http-exception"
import { getPerformanceContext, summarizePerformanceContext } from "../lib/performance-metrics"

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  console.error(JSON.stringify({
    event: "api.error",
    requestId: getPerformanceContext()?.requestId ?? null,
    errorName: err.name,
  }))
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    },
    500,
  )
}

export async function logger(c: Context, next: Next) {
  const start = Date.now()
  try {
    await next()
  } finally {
    const context = summarizePerformanceContext()
    console.log(JSON.stringify({
      event: "api.request",
      requestId: context?.requestId ?? c.req.header("x-request-id") ?? null,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
      queryCount: context?.queryCount ?? 0,
      queryDurationMs: context?.queryDurationMs ?? 0,
      spans: context?.spans ?? [],
    }))
  }
}
