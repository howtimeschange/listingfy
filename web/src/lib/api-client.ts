const BASE_URL = "/api"

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(apiErrorMessage(status, body))
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

function apiErrorMessage(status: number, body: unknown) {
  if (typeof body === "string") {
    const message = body.trim()
    if (message) return message
  }
  if (body && typeof body === "object") {
    const error = "error" in body ? (body as { error?: unknown }).error : null
    if (error && typeof error === "object") {
      const errorRecord = error as { message?: unknown; error_message?: unknown; msg?: unknown; code?: unknown }
      const message = String(errorRecord.message ?? errorRecord.error_message ?? errorRecord.msg ?? "").trim()
      if (message) {
        const code = String(errorRecord.code ?? "").trim()
        return code ? `${code} · ${message}` : message
      }
    }
    const record = body as {
      message?: unknown
      error_message?: unknown
      msg?: unknown
      error_code?: unknown
      code?: unknown
    }
    const message = String(record.message ?? record.error_message ?? record.msg ?? "").trim()
    if (message) {
      const code = String(record.error_code ?? record.code ?? "").trim()
      if (code) return `${code} · ${message}`
      return message
    }
  }
  return `API Error ${status}`
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // Keep the raw response text when the error body is not JSON.
    }
    throw new ApiError(res.status, body)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
}
