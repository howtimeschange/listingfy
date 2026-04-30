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
