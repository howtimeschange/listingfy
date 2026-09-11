import mappings from './business-category-mappings.json'
import type { CategoryFallbackResult, CategoryFallbackRow } from './category-fallback'

// Business attachments received 2026-09-11; IDs reconciled with synced SHEIN leaves.
// Keep alternatives: the same MDM subclass can mean different garment shapes.
export function businessCategoryMapping(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = (value: unknown) => String(value ?? '').trim()
  const exact = mappings.filter((item) => item.spu_code === text(row.spu_code))
  const candidates = exact.length ? exact : mappings.filter((item) => (
    item.subclass_name === text(row.subclass_name)
    && item.middle_class_name === text(row.middle_class_name)
  ))
  if (!candidates.length) return null
  const gender = text(row.gender_name)
  const age = text(row.age_group_name)
  const male = gender.includes('男') && !gender.includes('女')
  const female = gender.includes('女') && !gender.includes('男')
  const ageLabel = /婴|新生/.test(age) ? '婴' : /小童|幼童/.test(age) ? '（小）' : /大童|中童/.test(age) ? '（大）' : ''
  const selected = candidates.filter((item) => {
    const name = item.category_name
    if (male && /女/.test(name) || female && /男/.test(name)) return false
    if (ageLabel && /（小）|（大）|婴童/.test(name) && !name.includes(ageLabel)) return false
    // Exact per-style business decisions can resolve neutral MDM data; generalized
    // mappings must never infer gender or age from a colour, model, or style number.
    if (!exact.length && /男|女/.test(name) && !male && !female) return false
    if (!exact.length && /（小）|（大）|婴/.test(name) && !ageLabel) return false
    return true
  })
  const unique = new Map(selected.map((item) => [item.category_id, item]))
  const match = unique.size === 1 ? [...unique.values()][0] : null
  return match ? {
    category_id: match.category_id, product_type_id: match.product_type_id,
    category_name: match.category_name, path: match.path,
    source: 'RULE_FALLBACK', status: 'READY',
  } : {
    category_id: null, product_type_id: null, category_name: null, path: null,
    source: 'BUSINESS_MAPPING_REVIEW', status: 'NEEDS_REVIEW',
  }
}
