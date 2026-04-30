export function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

export function compactText(value: unknown, maxLength = 180) {
  const text = normalizeText(value).replace(/\s+/g, " ")
  if (!text) return ""
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

export function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== "string" || !value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function parseJsonList(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Fall through to delimiter parsing.
  }
  return value
    .split(/[、,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function batchTerms(value: string | undefined) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function asPositiveNumber(value: unknown) {
  const number = asNumber(value)
  return number != null && number > 0 ? number : null
}

export function readLimit(value: string | undefined, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

export function readOffset(value: string | undefined) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

export function nowIso() {
  return new Date().toISOString()
}

export function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

export function buildScopeKey({
  spuCode,
  skcCode,
  skuCode,
  fieldKey,
}: {
  spuCode: string
  skcCode?: string | null
  skuCode?: string | null
  fieldKey: string
}) {
  return [
    `spu:${spuCode}`,
    skcCode ? `skc:${skcCode}` : "skc:*",
    skuCode ? `sku:${skuCode}` : "sku:*",
    `field:${fieldKey}`,
  ].join("|")
}
