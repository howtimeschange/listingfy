import { HTTPException } from "hono/http-exception"

const PRODUCT_ARCHIVE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function assertAllowedProductArchiveQuery(url: URL | string, allowedKeys: string[]) {
  const parsed = typeof url === "string" ? new URL(url) : url
  const allowed = new Set(allowedKeys)

  for (const key of parsed.searchParams.keys()) {
    if (!allowed.has(key)) {
      throw new HTTPException(400, {
        message: `Unsupported query parameter: ${key}`,
      })
    }
  }
}

export function assertSafeProductArchiveCode(value: string) {
  const code = String(value ?? "").trim()
  if (!PRODUCT_ARCHIVE_CODE_PATTERN.test(code)) {
    throw new HTTPException(400, { message: "Invalid product code" })
  }
  return code
}
