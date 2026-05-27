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

export function normalizeMaterialValue(value: unknown) {
  const text = normalizeText(value)
  const compact = text.replace(/\s+/g, "").toLowerCase()
  if (!compact) return ""
  if (compact.includes("棉混纺") || compact.includes("棉混") || compact.includes("cottonblend")) {
    return "织物"
  }
  return text
}

export function tariffValueCandidatesForContext(context: unknown) {
  const text = normalizeText(context)
  const compact = text.replace(/[\s_-]+/g, "").toLowerCase()
  if (text.includes("连衣裙")) return ["连衣裙", "未列明关税种类"]
  if (text.includes("T恤") || compact.includes("tshirt") || /(^|[^a-z])tee([^a-z]|$)/i.test(text)) {
    return ["常规T恤", "非常规T恤", "未列明关税种类"]
  }
  if (text.includes("衬衫")) return ["休闲衬衫", "衬衫", "未列明关税种类"]
  if (text.includes("卫衣")) return ["卫衣", "未列明关税种类"]
  if (text.includes("开襟") || text.includes("毛衫")) return ["开襟衫", "毛衣", "未列明关税种类"]
  return ["未列明关税种类"]
}
