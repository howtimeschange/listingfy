import { normalizeText } from "./shared"

export function canTransitionDraftStatus(currentStatus: string, nextStatus: string) {
  const current = normalizeText(currentStatus).toUpperCase()
  const next = normalizeText(nextStatus).toUpperCase()
  if (current === next) return true
  if (["PUBLISHING", "PUBLISH_SUBMITTED"].includes(current)) return false
  const transitions: Record<string, string[]> = {
    DRAFT: ["NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "READY_TO_PUBLISH", "PAUSED", "ARCHIVED"],
    NEEDS_ENRICHMENT: ["DRAFT", "READY_TO_VALIDATE", "READY_TO_PUBLISH", "PAUSED", "ARCHIVED"],
    READY_TO_VALIDATE: ["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_PUBLISH", "PAUSED", "ARCHIVED"],
    READY_TO_PUBLISH: ["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "PAUSED", "ARCHIVED"],
    PUBLISH_FAILED: ["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "READY_TO_PUBLISH", "PAUSED", "ARCHIVED"],
    PAUSED: ["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "ARCHIVED"],
    ARCHIVED: ["DRAFT", "PAUSED"],
  }
  return (transitions[current] ?? ["DRAFT", "NEEDS_ENRICHMENT", "READY_TO_VALIDATE", "PAUSED", "ARCHIVED"]).includes(next)
}

// First/legacy draft retains the historical code. Further publish units have a
// stable identity independent of category, gender, or the selected SKCs.
export function publishSupplierCode(listing: { id?: unknown; spu_code?: unknown; publish_unit_no?: unknown }) {
  const original = normalizeText(listing.spu_code)
  const unit = normalizeText(listing.publish_unit_no)
  return !unit || unit === 'default' || unit === 'draft-001' ? original : `${original}-L${listing.id}`
}
