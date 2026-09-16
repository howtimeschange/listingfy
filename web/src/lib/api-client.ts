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
    if (status === 504 && /<html[\s\S]*gateway time-?out/i.test(message)) {
      return "网关超时，请稍后重试"
    }
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
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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

  postForm: <T>(path: string, body: FormData) =>
    request<T>(path, {
      method: "POST",
      headers: {},
      body,
    }),

  postFormWithProgress: <T>(path: string, body: FormData, onProgress: (percent: number) => void) =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `${BASE_URL}${path}`)
      xhr.withCredentials = true
      xhr.upload.onprogress = (event) => {
        // Only upload.onload can confirm that transmission has finished.
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(99, Math.max(0, Math.floor(event.loaded / event.total * 100))))
      }
      xhr.upload.onload = () => onProgress(100)
      xhr.onerror = () => reject(new Error("连接中断，提交结果尚未确认，请先检查草稿状态再决定是否重试。"))
      xhr.onabort = () => reject(new Error("连接已取消，请检查草稿状态。"))
      xhr.onload = () => {
        let result: unknown = xhr.responseText
        try { result = JSON.parse(xhr.responseText) } catch {
          if (xhr.status >= 200 && xhr.status < 300) {
            reject(new Error("响应格式异常，请检查草稿状态后再操作。"))
            return
          }
        }
        if (xhr.status < 200 || xhr.status >= 300) reject(new ApiError(xhr.status, result))
        else resolve(result as T)
      }
      xhr.send(body)
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
