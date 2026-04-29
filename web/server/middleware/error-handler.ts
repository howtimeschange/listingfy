import type { Context, Next } from "hono"
import { HTTPException } from "hono/http-exception"

export async function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }
  console.error("[api error]", err)
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: err.message || "Internal server error",
      },
    },
    500,
  )
}

export async function logger(c: Context, next: Next) {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`)
}
