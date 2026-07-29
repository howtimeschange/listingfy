export const DEFAULT_AUTO_APPLY_AI_CATEGORY_MIN_CONFIDENCE = 0.92

export type CategorySelectionCandidate = {
  categoryId: number | null
  productTypeId: number | null
  categoryName?: string | null
  path?: string | null
  source?: string | null
  status?: string | null
}

export type LiveAiCategorySelectionCandidate = CategorySelectionCandidate & {
  confidence?: number | null
  splitBySkc?: boolean
  risks?: unknown[]
}

export type AiCategoryCandidate = Record<string, unknown> & {
  category_id?: unknown
  product_type_id?: unknown
}

export type CategoryAutoSelectionDecision = {
  apply: boolean
  category: CategorySelectionCandidate | null
  suggestion: CategorySelectionCandidate | null
  source: string | null
  confidence: number | null
  reason:
    | "RULE_READY"
    | "RULE_FALLBACK_READY"
    | "AI_READY"
    | "CATEGORY_MISSING"
    | "CATEGORY_PAIR_INVALID"
    | "CATEGORY_NEEDS_REVIEW"
    | "RULE_FALLBACK_DISABLED"
    | "AI_STATUS_NOT_READY"
    | "AI_LOW_CONFIDENCE"
    | "AI_SPLIT_BY_SKC"
    | "AI_HAS_RISKS"
    | "AI_HIGH_RISK_CATEGORY"
    | "AI_CATEGORY_PAIR_INVALID"
}

function positiveInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

export function normalizeAiCategoryCandidate<T extends AiCategoryCandidate>(
  raw: unknown,
  candidates: readonly T[],
): T | null {
  if (!raw || typeof raw !== "object") return null
  const value = raw as Record<string, unknown>
  const categoryId = positiveInteger(value.category_id)
  const productTypeId = positiveInteger(value.product_type_id)
  if (!categoryId || !productTypeId) return null

  const exact = candidates.find((candidate) =>
    positiveInteger(candidate.category_id) === categoryId
    && positiveInteger(candidate.product_type_id) === productTypeId,
  )
  if (exact) return exact

  const sameCategory = candidates.filter((candidate) =>
    positiveInteger(candidate.category_id) === categoryId,
  )
  return sameCategory.length === 1 ? sameCategory[0] : null
}

export function normalizedAiCategoryPayload(
  raw: unknown,
  candidate: AiCategoryCandidate,
) {
  const value = raw && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {}
  return {
    ...value,
    category_id: positiveInteger(candidate.category_id),
    product_type_id: positiveInteger(candidate.product_type_id),
    category_name: String(candidate.category_name ?? "").trim(),
    path: String(candidate.path ?? "").trim(),
  }
}

export function normalizeLiveAiSkcCategorySuggestions<T extends AiCategoryCandidate>(
  suggestions: unknown,
  candidates: readonly T[],
) {
  if (!Array.isArray(suggestions)) return []
  return suggestions.map((item) => {
    if (!item || typeof item !== "object") return item
    const suggestion = item as Record<string, unknown>
    const primary = normalizeAiCategoryCandidate(suggestion.primary, candidates)
    const alternatives = Array.isArray(suggestion.alternatives)
      ? suggestion.alternatives
        .map((alternative) => {
          const candidate = normalizeAiCategoryCandidate(alternative, candidates)
          return candidate ? normalizedAiCategoryPayload(alternative, candidate) : null
        })
        .filter((candidate) => candidate !== null)
      : []
    return {
      ...suggestion,
      primary: primary
        ? normalizedAiCategoryPayload(suggestion.primary, primary)
        : null,
      alternatives,
    }
  })
}

function normalizedCandidate(candidate: CategorySelectionCandidate | null | undefined) {
  if (!candidate) return null
  const categoryId = positiveInteger(candidate.categoryId)
  const productTypeId = positiveInteger(candidate.productTypeId)
  if (!categoryId || !productTypeId) return null
  return {
    ...candidate,
    categoryId,
    productTypeId,
    source: String(candidate.source ?? "").trim() || null,
    status: String(candidate.status ?? "").trim().toUpperCase() || null,
  }
}

function reviewDecision(
  reason: CategoryAutoSelectionDecision["reason"],
  suggestion: CategorySelectionCandidate | null,
  confidence: number | null = null,
): CategoryAutoSelectionDecision {
  return {
    apply: false,
    category: null,
    suggestion,
    source: suggestion?.source ? String(suggestion.source) : null,
    confidence,
    reason,
  }
}

export function categoryAutoSelectionDecision(input: {
  category?: CategorySelectionCandidate | null
  metadataValid?: boolean
  allowRuleFallback?: boolean
  liveAi?: LiveAiCategorySelectionCandidate | null
  liveAiMetadataValid?: boolean
  minAiConfidence?: number
}): CategoryAutoSelectionDecision {
  const category = normalizedCandidate(input.category)
  const source = String(category?.source ?? "").trim().toUpperCase()
  const status = String(category?.status ?? "").trim().toUpperCase()
  const blockedRuleSources = new Set([
    "AI_CATEGORY",
    "AI_CATEGORY_LIVE",
    "MISSING",
    "CATEGORY_PAIR_MISMATCH",
    "LISTING_CATEGORY_UNVERIFIED",
  ])

  if (
    category
    && input.metadataValid === true
    && status === "READY"
    && !blockedRuleSources.has(source)
  ) {
    if (source === "RULE_FALLBACK" && input.allowRuleFallback !== true) {
      return reviewDecision("RULE_FALLBACK_DISABLED", category)
    }
    return {
      apply: true,
      category,
      suggestion: null,
      source: category.source ? String(category.source) : null,
      confidence: source === "RULE_FALLBACK" ? 0.8 : 1,
      reason: source === "RULE_FALLBACK" ? "RULE_FALLBACK_READY" : "RULE_READY",
    }
  }

  const liveAi = normalizedCandidate(input.liveAi)
  if (liveAi) {
    const aiStatus = String(input.liveAi?.status ?? "").trim().toUpperCase()
    const confidence = Number(input.liveAi?.confidence)
    const minConfidence = Number.isFinite(Number(input.minAiConfidence))
      ? Number(input.minAiConfidence)
      : DEFAULT_AUTO_APPLY_AI_CATEGORY_MIN_CONFIDENCE
    const risks = Array.isArray(input.liveAi?.risks)
      ? input.liveAi.risks.filter((risk) => String(risk ?? "").trim())
      : []

    if (aiStatus !== "READY") {
      return reviewDecision("AI_STATUS_NOT_READY", liveAi, Number.isFinite(confidence) ? confidence : null)
    }
    if (input.liveAi?.splitBySkc === true) {
      return reviewDecision("AI_SPLIT_BY_SKC", liveAi, Number.isFinite(confidence) ? confidence : null)
    }
    if (risks.length > 0) {
      return reviewDecision("AI_HAS_RISKS", liveAi, Number.isFinite(confidence) ? confidence : null)
    }
    const aiCategoryText = `${String(liveAi.categoryName ?? "")} ${String(liveAi.path ?? "")}`
    if (/套装|泳装|泳衣|牛仔|连体裤|婴儿|婴童/.test(aiCategoryText)) {
      return reviewDecision("AI_HIGH_RISK_CATEGORY", liveAi, Number.isFinite(confidence) ? confidence : null)
    }
    if (!Number.isFinite(confidence) || confidence < minConfidence) {
      return reviewDecision("AI_LOW_CONFIDENCE", liveAi, Number.isFinite(confidence) ? confidence : null)
    }
    if (input.liveAiMetadataValid !== true) {
      return reviewDecision("AI_CATEGORY_PAIR_INVALID", liveAi, confidence)
    }
    return {
      apply: true,
      category: {
        ...liveAi,
        source: "AI_CATEGORY_LIVE",
        status: "READY",
      },
      suggestion: null,
      source: "AI_CATEGORY_LIVE",
      confidence,
      reason: "AI_READY",
    }
  }

  if (!category) return reviewDecision("CATEGORY_MISSING", null)
  if (input.metadataValid !== true) return reviewDecision("CATEGORY_PAIR_INVALID", category)
  return reviewDecision("CATEGORY_NEEDS_REVIEW", category)
}
