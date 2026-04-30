import { normalizeText, parseJsonList } from "./shared"

export type FillFieldLike = {
  render_kind?: string | null
}

export function coerceFieldValues(field: FillFieldLike, rawValue: unknown) {
  if (field.render_kind === "multi_enum") {
    const values = parseJsonList(rawValue).map(normalizeText).filter(Boolean)
    return values.length ? values : []
  }
  const value = normalizeText(rawValue)
  return value ? [value] : []
}
