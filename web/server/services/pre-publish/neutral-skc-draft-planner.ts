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
  skcEvidence: Array<Record<string, unknown>>
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
  productText?: unknown
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
  localColorFallback: boolean
  evidence: Record<string, unknown>
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

function colorFallbackGender(value: unknown): NeutralSkcGender | null {
  const normalized = text(value)
  const male = /铁灰|深灰|炭灰|烟灰|卡其/.test(normalized)
  const female = /风信紫|粉紫|紫粉|藕粉|玫粉/.test(normalized)
  if (male === female) return null
  return male ? "MALE" : "FEMALE"
}

function resolvedEvidence(
  suggestion: Record<string, unknown>,
  skc: Record<string, unknown>,
): {
  gender: NeutralSkcGender
  basis: "MODEL" | "COLOR"
  localColorFallback: boolean
} | null {
  const modelPresent = optionalBoolean(suggestion.model_present)
  if (modelPresent === true) {
    const gender = normalizedGender(suggestion.model_gender)
    return gender ? { gender, basis: "MODEL", localColorFallback: false } : null
  }
  if (modelPresent === false || modelPresent === null) {
    const localGender = colorFallbackGender(
      skc.colorName
      ?? skc.color_name
      ?? suggestion.color_name,
    )
    if (localGender) {
      return {
        gender: localGender,
        basis: "COLOR",
        localColorFallback: true,
      }
    }
    if (text(suggestion.gender_basis).toUpperCase() !== "COLOR") return null
    const gender = normalizedGender(suggestion.color_gender)
    return gender ? { gender, basis: "COLOR", localColorFallback: false } : null
  }
  return null
}

function recoverableColorFallbackRisk(value: unknown) {
  const normalized = text(value)
  if (!normalized) return false
  if (/冲突|矛盾|不一致|类目.*(?:无法|不确定)|无法确认.*类目/.test(normalized)) {
    return false
  }
  return /铁灰|深灰|炭灰|烟灰|卡其|风信紫|粉紫|紫粉|藕粉|玫粉/.test(normalized)
}

function isGenericPantsCategory(category: NeutralSkcCategory) {
  return /[）)](?:裤子|长裤)$/.test(text(category.categoryName))
}

function isSweatpantsCategory(category: NeutralSkcCategory) {
  return /卫裤/.test(text(category.categoryName))
}

function hasSweatpantsProductSemantics(productText: unknown) {
  return /卫裤|针织长裤|sweat\s*pants/i.test(text(productText))
}

function preferredCategory(
  suggestion: Record<string, unknown>,
  gender: NeutralSkcGender,
  resolveCategory: CategoryResolver,
  productText: unknown,
) {
  const rawCandidates = [
    suggestion.primary,
    ...(Array.isArray(suggestion.alternatives) ? suggestion.alternatives : []),
  ]
  const candidates = new Map<string, {
    category: NeutralSkcCategory
    raw: Record<string, unknown>
    primary: boolean
  }>()
  rawCandidates.forEach((raw, index) => {
    const candidate = record(raw)
    if (!candidate) return
    const categoryId = positiveInteger(candidate.category_id ?? candidate.categoryId)
    const productTypeId = positiveInteger(candidate.product_type_id ?? candidate.productTypeId)
    if (!categoryId || !productTypeId) return
    const category = normalizeCategory(resolveCategory(categoryId, productTypeId))
    if (!category || categoryGender(category) !== gender) return
    const key = `${category.categoryId}:${category.productTypeId}`
    if (!candidates.has(key)) {
      candidates.set(key, {
        category,
        raw: candidate,
        primary: index === 0,
      })
    }
  })
  const options = [...candidates.values()]
  if (options.length === 0) return null
  const primary = options.find((option) => option.primary)
  if (primary) {
    if (
      !isGenericPantsCategory(primary.category)
      || !hasSweatpantsProductSemantics(productText)
    ) {
      return primary
    }
    const sweatpantsAlternatives = options.filter((option) =>
      !option.primary && isSweatpantsCategory(option.category),
    )
    return sweatpantsAlternatives.length === 1
      ? sweatpantsAlternatives[0]
      : primary
  }
  if (options.length === 1) return options[0]
  if (!hasSweatpantsProductSemantics(productText)) return null
  const sweatpantsOptions = options.filter((option) => isSweatpantsCategory(option.category))
  return sweatpantsOptions.length === 1 ? sweatpantsOptions[0] : null
}

function categoryEvidencePayload(
  raw: Record<string, unknown>,
  category: NeutralSkcCategory,
) {
  return {
    ...raw,
    category_id: category.categoryId,
    product_type_id: category.productTypeId,
    category_name: category.categoryName ?? "",
    path: category.path ?? "",
  }
}

function resolvedSuggestionEvidence(
  suggestion: Record<string, unknown>,
  skcCode: string,
  evidence: {
    gender: NeutralSkcGender
    basis: "MODEL" | "COLOR"
    localColorFallback: boolean
  },
  confidence: number,
  categoryChoice: {
    category: NeutralSkcCategory
    raw: Record<string, unknown>
    primary: boolean
  },
) {
  const reasons = Array.isArray(suggestion.reasons)
    ? suggestion.reasons.map(text).filter(Boolean)
    : []
  if (evidence.localColorFallback) {
    reasons.push(
      `本地业务规则兜底：${evidence.gender === "MALE" ? "铁灰/卡其偏男童" : "风信紫/粉紫偏女童"}`,
    )
  }
  if (!categoryChoice.primary) {
    reasons.push(`本地类目规则：优先采用更具体的${categoryChoice.category.categoryName ?? "候选类目"}`)
  }
  return {
    ...suggestion,
    skc_code: skcCode,
    color_gender: evidence.gender === "MALE" ? "男童" : "女童",
    resolved_gender: evidence.gender === "MALE" ? "男童" : "女童",
    gender_basis: evidence.basis,
    confidence,
    primary: categoryEvidencePayload(categoryChoice.raw, categoryChoice.category),
    reasons,
  }
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
  if (blockingRisks.some((risk) => !recoverableColorFallbackRisk(risk))) {
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
  const skcsByCode = new Map(input.skcs.map((skc) => [skcCodeOf(skc), skc]))

  for (const skcCode of targetSkcCodes) {
    const suggestions = suggestionsBySkc.get(skcCode) ?? []
    const suggestion = suggestions.length === 1 ? suggestions[0] : null
    const rawConfidence = Number(suggestion?.confidence)
    const evidence = suggestion
      ? resolvedEvidence(suggestion, skcsByCode.get(skcCode) ?? {})
      : null
    const confidence = evidence?.localColorFallback
      ? Math.max(
        Number.isFinite(rawConfidence) ? rawConfidence : 0,
        DEFAULT_NEUTRAL_SKC_MIN_CONFIDENCE,
      )
      : rawConfidence
    const categoryChoice = suggestion && evidence
      ? preferredCategory(
        suggestion,
        evidence.gender,
        input.resolveCategory,
        input.productText,
      )
      : null
    if (
      !suggestion
      || !Number.isFinite(confidence)
      || confidence < minConfidence
      || !evidence
      || !categoryChoice
    ) {
      unresolved.push(skcCode)
      continue
    }
    resolved.push({
      skcCode,
      gender: evidence.gender,
      category: categoryChoice.category,
      confidence,
      evidenceBasis: evidence.basis,
      localColorFallback: evidence.localColorFallback,
      evidence: resolvedSuggestionEvidence(
        suggestion,
        skcCode,
        evidence,
        confidence,
        categoryChoice,
      ),
    })
  }

  if (unresolved.length > 0) {
    return reviewPlan("SKC_EVIDENCE_INCOMPLETE", unresolved)
  }
  if (
    blockingRisks.length > 0
    && resolved.some((item) => !item.localColorFallback)
  ) {
    return reviewPlan("AI_RESULT_RISKY", targetSkcCodes)
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
      skcEvidence: items.map((item) => item.evidence),
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
