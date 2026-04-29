export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—"
  return value.toLocaleString("zh-CN")
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "CNY",
): string {
  if (value == null) return "—"
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  })
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${(value * 100).toFixed(1)}%`
}
