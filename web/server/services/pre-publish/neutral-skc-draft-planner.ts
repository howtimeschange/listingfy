export const DEFAULT_NEUTRAL_SKC_MIN_CONFIDENCE = 0.8

export type NeutralSkcGender = "MALE" | "FEMALE"

export type NeutralSkcCategory = {
  categoryId: number
  productTypeId: number
  categoryName: string | null
  path: string | null
}

export type NeutralSkcDraftGroup = {
  gender: NeutralSkcGender
  skcCodes: string[]
  category: NeutralSkcCategory
  confidence: number
  evidenceBasis: "MODEL" | "COLOR" | "MODEL_AND_COLOR"
}

export type NeutralSkcDraftPlan = {
  status: "NOT_APPLICABLE" | "READY" | "NEEDS_REVIEW"
  reason:
    | "NON_NEUTRAL"
    | "SKC_GENDER_GROUPS_READY"
    | "AI_RESULT_UNAVAILABLE"
    | "AI_RESULT_RISKY"
    | "SKC_EVIDENCE_INCOMPLETE"
    | "SKC_CATEGORY_CONFLICT"
  splitByGender: boolean
  groups: NeutralSkcDraftGroup[]
  unresolvedSkcCodes: string[]
}

type CategoryResolver = (
  categoryId: number,
  productTypeId: number,
) => NeutralSkcCategory | Record<string, unknown> | null | undefined

type PlannerInput = {
  genderName: unknown
  skcs: Array<Record<string, unknown>>
  liveAi?: {
    status?: unknown
    splitBySkc?: unknown
    risks?: unknown[]
    blockingRisks?: unknown[]
    skcSuggestions?: unknown[]
  } | null
  resolveCategory: CategoryResolver
  minConfidence?: number
}

type ResolvedSkc = {
  skcCode: string
  gender: NeutralSkcGender
  category: NeutralSkcCategory
  confidence: number
  evidenceBasis: "MODEL" | "COLOR"
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function positiveInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null
  const normalized = text(value).toLowerCase()
  if (["true", "1", "yes", "y"].includes(normalized)) return true
  if (["false", "0", "no", "n"].includes(normalized)) return false
  return null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizedGender(value: unknown): NeutralSkcGender | null {
  const normalized = text(value).toUpperCase()
  if (!normalized) return null
  if (["MALE", "BOY", "BOYS", "男", "男童", "婴童（男）", "婴童(男)"].includes(normalized)) {
    return "MALE"
  }
  if (["FEMALE", "GIRL", "GIRLS", "女", "女童", "婴童（女）", "婴童(女)"].includes(normalized)) {
    return "FEMALE"
  }
  const hasMale = /男|BOY|MALE/.test(normalized)
  const hasFemale = /女|GIRL|FEMALE/.test(normalized)
  if (hasMale === hasFemale) return null
  return hasMale ? "MALE" : "FEMALE"
}

export function isNeutralProductGender(value: unknown) {
  return /中性|男女|女男|UNISEX|GENDER[\s_-]*NEUTRAL/i.test(text(value))
}

function normalizeCategory(value: unknown): NeutralSkcCategory | null {
  const candidate = record(value)
  if (!candidate) return null
  const categoryId = positiveInteger(candidate.categoryId ?? candidate.category_id)
  const productTypeId = positiveInteger(candidate.productTypeId ?? candidate.product_type_id)
  if (!categoryId || !productTypeId) return null
  return {
    categoryId,
    productTypeId,
    categoryName: text(candidate.categoryName ?? candidate.category_name) || null,
    path: text(candidate.path) || null,
  }
}

function categoryGender(category: NeutralSkcCategory) {
  return normalizedGender(`${category.categoryName ?? ""} ${category.path ?? ""}`)
}

function skcCodeOf(value: Record<string, unknown>) {
  return text(value.skcCode ?? value.skc_code)
}

function reviewPlan(
  reason: NeutralSkcDraftPlan["reason"],
  unresolvedSkcCodes: string[],
): NeutralSkcDraftPlan {
  return {
    status: "NEEDS_REVIEW",
    reason,
    splitByGender: false,
    groups: [],
    unresolvedSkcCodes,
  }
}

function uniqueTargetSkcCodes(skcs: Array<Record<string, unknown>>) {
  const seen = new Set<string>()
  const codes: string[] = []
  for (const skc of skcs) {
    const code = skcCodeOf(skc)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes
}

function resolvedEvidence(
  suggestion: Record<string, unknown>,
): { gender: NeutralSkcGender; basis: "MODEL" | "COLOR" } | null {
  const modelPresent = optionalBoolean(suggestion.model_present)
  if (modelPresent === true) {
    const gender = normalizedGender(suggestion.model_gender)
    return gender ? { gender, basis: "MODEL" } : null
  }
  if (
    (modelPresent === false || modelPresent === null)
    && text(suggestion.gender_basis).toUpperCase() === "COLOR"
  ) {
    const gender = normalizedGender(suggestion.color_gender)
    return gender ? { gender, basis: "COLOR" } : null
  }
  return null
}

function groupEvidenceBasis(items: ResolvedSkc[]) {
  const bases = new Set(items.map((item) => item.evidenceBasis))
  if (bases.size > 1) return "MODEL_AND_COLOR"
  return items[0]?.evidenceBasis ?? "COLOR"
}

export function planNeutralSkcDrafts(input: PlannerInput): NeutralSkcDraftPlan {
  if (!isNeutralProductGender(input.genderName)) {
    return {
      status: "NOT_APPLICABLE",
      reason: "NON_NEUTRAL",
      splitByGender: false,
      groups: [],
      unresolvedSkcCodes: [],
    }
  }

  const targetSkcCodes = uniqueTargetSkcCodes(input.skcs)
  const liveStatus = text(input.liveAi?.status).toUpperCase()
  if (
    targetSkcCodes.length === 0
    || !input.liveAi
    || !["READY", "AMBIGUOUS"].includes(liveStatus)
    || !Array.isArray(input.liveAi.skcSuggestions)
  ) {
    return reviewPlan("AI_RESULT_UNAVAILABLE", targetSkcCodes)
  }
  const blockingRisks = Array.isArray(input.liveAi.blockingRisks)
    ? input.liveAi.blockingRisks.map(text).filter(Boolean)
    : []
  if (blockingRisks.length > 0) {
    return reviewPlan("AI_RESULT_RISKY", targetSkcCodes)
  }

  const suggestionsBySkc = new Map<string, Record<string, unknown>[]>()
  for (const rawSuggestion of input.liveAi.skcSuggestions) {
    const suggestion = record(rawSuggestion)
    if (!suggestion) continue
    const skcCode = text(suggestion.skc_code ?? suggestion.skcCode)
    if (!skcCode || !targetSkcCodes.includes(skcCode)) continue
    const existing = suggestionsBySkc.get(skcCode) ?? []
    existing.push(suggestion)
    suggestionsBySkc.set(skcCode, existing)
  }

  const minConfidence = Number.isFinite(Number(input.minConfidence))
    ? Number(input.minConfidence)
    : DEFAULT_NEUTRAL_SKC_MIN_CONFIDENCE
  const resolved: ResolvedSkc[] = []
  const unresolved: string[] = []

  for (const skcCode of targetSkcCodes) {
    const suggestions = suggestionsBySkc.get(skcCode) ?? []
    const suggestion = suggestions.length === 1 ? suggestions[0] : null
    const confidence = Number(suggestion?.confidence)
    const evidence = suggestion ? resolvedEvidence(suggestion) : null
    const primary = suggestion ? record(suggestion.primary) : null
    const categoryId = positiveInteger(primary?.category_id ?? primary?.categoryId)
    const productTypeId = positiveInteger(primary?.product_type_id ?? primary?.productTypeId)
    const category = categoryId && productTypeId
      ? normalizeCategory(input.resolveCategory(categoryId, productTypeId))
      : null
    if (
      !suggestion
      || !Number.isFinite(confidence)
      || confidence < minConfidence
      || !evidence
      || !category
      || categoryGender(category) !== evidence.gender
    ) {
      unresolved.push(skcCode)
      continue
    }
    resolved.push({
      skcCode,
      gender: evidence.gender,
      category,
      confidence,
      evidenceBasis: evidence.basis,
    })
  }

  if (unresolved.length > 0) {
    return reviewPlan("SKC_EVIDENCE_INCOMPLETE", unresolved)
  }

  const groups: NeutralSkcDraftGroup[] = []
  for (const gender of ["MALE", "FEMALE"] as const) {
    const items = resolved.filter((item) => item.gender === gender)
    if (items.length === 0) continue
    const categoryPairs = new Set(items.map((item) =>
      `${item.category.categoryId}:${item.category.productTypeId}`,
    ))
    if (categoryPairs.size !== 1) {
      return reviewPlan("SKC_CATEGORY_CONFLICT", targetSkcCodes)
    }
    groups.push({
      gender,
      skcCodes: items.map((item) => item.skcCode),
      category: items[0].category,
      confidence: Math.min(...items.map((item) => item.confidence)),
      evidenceBasis: groupEvidenceBasis(items),
    })
  }

  if (groups.length === 0) {
    return reviewPlan("SKC_EVIDENCE_INCOMPLETE", targetSkcCodes)
  }
  return {
    status: "READY",
    reason: "SKC_GENDER_GROUPS_READY",
    splitByGender: groups.length > 1,
    groups,
    unresolvedSkcCodes: [],
  }
}
