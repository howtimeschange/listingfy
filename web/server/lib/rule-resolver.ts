import type Database from "better-sqlite3"

type SourceRow = Record<string, unknown>

export interface PackageRuleResult {
  id: number | null
  name: string
  size: string
  length: number
  width: number
  height: number
  type: string
  source: "CONFIG" | "FALLBACK"
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function readKeywords(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"))
    return Array.isArray(parsed) ? parsed.map(normalizeText).filter(Boolean) : []
  } catch {
    return []
  }
}

function packageMatchText(row: SourceRow) {
  return [
    row.middle_class_name,
    row.subclass_name,
    row.fabric_type_name,
    row.length_name,
    row.deepdraw_title,
    row.spu_name,
    row.listing_title_cn,
  ].map(normalizeText).join(" ")
}

function formatDimension(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "")
}

export function formatPackageSize(length: number, width: number, height: number) {
  return `${formatDimension(length)}*${formatDimension(width)}*${formatDimension(height)}cm`
}

function fallbackPackageRule(row: SourceRow): PackageRuleResult {
  const text = packageMatchText(row)
  if (text.includes("鞋")) {
    return { id: null, name: "鞋品", size: "30*20*10cm", length: 30, width: 20, height: 10, type: "硬包装", source: "FALLBACK" }
  }
  if (text.includes("内裤")) {
    return { id: null, name: "内裤", size: "25*14*2cm", length: 25, width: 14, height: 2, type: "软包装+软物品", source: "FALLBACK" }
  }
  if (text.includes("毛衫") || text.includes("毛衣") || text.includes("厚") || text.includes("外套")) {
    return { id: null, name: "服装厚款", size: "35*25*1.5cm", length: 35, width: 25, height: 1.5, type: "软包装+软物品", source: "FALLBACK" }
  }
  return { id: null, name: "服装薄款", size: "28*24*1cm", length: 28, width: 24, height: 1, type: "软包装+软物品", source: "FALLBACK" }
}

export function resolvePackageRule(db: Database.Database, row: SourceRow): PackageRuleResult {
  const text = packageMatchText(row)
  const rules = db.prepare(`
    select *
    from shein_package_rule
    where status = 'ACTIVE'
    order by priority desc, id asc
  `).all() as SourceRow[]

  for (const rule of rules) {
    const keywords = readKeywords(rule.match_keywords_json)
    const mode = normalizeText(rule.match_mode).toUpperCase() === "ALL" ? "ALL" : "ANY"
    const matched = keywords.length === 0
      ? true
      : mode === "ALL"
        ? keywords.every((keyword) => text.includes(keyword))
        : keywords.some((keyword) => text.includes(keyword))
    if (!matched) continue

    const length = Number(rule.package_length_cm)
    const width = Number(rule.package_width_cm)
    const height = Number(rule.package_height_cm)
    if (![length, width, height].every((value) => Number.isFinite(value) && value > 0)) continue
    return {
      id: Number(rule.id),
      name: normalizeText(rule.rule_name) || "未命名规则",
      size: formatPackageSize(length, width, height),
      length,
      width,
      height,
      type: normalizeText(rule.package_type) || "软包装+软物品",
      source: "CONFIG",
    }
  }

  return fallbackPackageRule(row)
}
