import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  assertProductArchiveDraftMutable,
  normalizeProductArchiveDeepdrawFieldValue,
  productArchiveFieldValueMatchesOptions,
  syncProductArchiveDownFillWeightSizeCharts,
  validateProductArchiveDraft,
} from "./product-archive-drafts"

type JsonRecord = Record<string, unknown>

interface OcrField {
  key?: string
  label?: string
  value?: string
  confidence?: string
  evidenceText?: string
  pageNumber?: number
  sourceKind?: string
}

interface OcrDocument {
  fileName?: string
  fileType?: string
  sourceKind?: string
  detectedSpuCode?: string | null
  styleCodes?: string[]
  pageCount?: number
  fields?: OcrField[]
  warnings?: string[]
  status?: string
  error?: string | null
}

interface PreviewInput {
  documents?: OcrDocument[]
  overwriteExisting?: boolean
}

interface ApplyInput extends PreviewInput {
  overwriteExisting?: boolean
}

function nowIso() {
  return new Date().toISOString()
}

const PRODUCT_ARCHIVE_DRAFT_LOCK_SET_CHANGED = "草稿数据已更新，请刷新后重试"

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function recordValue(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {}
    } catch {
      return {}
    }
  }
  return {}
}

function arrayValue(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function compactFieldKey(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").replace(/[().。]/g, "").toLowerCase()
}

function isStaleMaterialAiRuleFallbackField(field: JsonRecord) {
  if (!/材质|面料/.test(stringValue(field.field_name))) return false
  if (stringValue(field.source_type) !== "ai_rule_fallback") return false
  const metadata = recordValue(field.value_json)
  return stringValue(metadata.source) === "AI_RULE_FALLBACK" || recordValue(metadata.ai_fill).fallback === true
}

function hasFieldValue(field: JsonRecord) {
  if (isStaleMaterialAiRuleFallbackField(field)) return false
  if (stringValue(field.value_text)) return true
  return Object.keys(recordValue(field.value_json)).length > 0
}

function fieldConfidenceRank(value: unknown) {
  return { high: 3, medium: 2, low: 1 }[stringValue(value)] ?? 0
}

function sourceRank(value: unknown) {
  return { hangtag: 4, scm_list: 3, washlabel: 2, unknown: 1 }[stringValue(value)] ?? 0
}

function sourceTypeForOcrField(field: OcrField, document: OcrDocument) {
  const sourceKind = stringValue(field.sourceKind) || stringValue(document.sourceKind) || "unknown"
  if (sourceKind === "hangtag") return "hangtag_ocr"
  if (sourceKind === "washlabel") return "washlabel_ocr"
  if (sourceKind === "scm_list") return "scm_list"
  return "document_ocr"
}

function sourceRefForOcrField(field: OcrField, document: OcrDocument) {
  const pageNumber = Number(field.pageNumber)
  const explicitSourceRef = stringValue((document as JsonRecord).sourceRef)
  if (explicitSourceRef) return explicitSourceRef
  return `${stringValue(document.fileName) || "OCR文件"}${Number.isInteger(pageNumber) && pageNumber > 0 ? `#p${pageNumber}` : ""}`
}

function numericTextValues(value: unknown) {
  return stringValue(value).match(/\d+(?:\.\d+)?/g) ?? []
}

function cleanNumberText(value: string) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/g, "")
}

function plausibleDownFillSize(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 50 && number <= 220
}

function plausibleDownFillWeight(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 500
}

function mostlyAscending(values: string[]) {
  let ascendingCount = 0
  for (let index = 1; index < values.length; index += 1) {
    if (Number(values[index]) >= Number(values[index - 1])) ascendingCount += 1
  }
  return ascendingCount >= Math.max(1, values.length - 2)
}

function downFillPairsFromSizeAndWeightRows(sizes: string[], weights: string[]) {
  if (sizes.length < 2 || sizes.length !== weights.length) return []
  if (!sizes.every(plausibleDownFillSize) || !weights.every(plausibleDownFillWeight)) return []
  if (!mostlyAscending(sizes)) return []
  return sizes.map((size, index) => [size, weights[index]])
}

function downFillPairsFromFlatTokens(tokens: string[]) {
  const candidates = [tokens]
  if (tokens.length % 2 === 1) {
    tokens.forEach((token, index) => {
      if (!/^\d{4,6}$/.test(token)) return
      for (const splitAt of [2, 3]) {
        const left = token.slice(0, splitAt)
        const right = token.slice(splitAt)
        candidates.push([...tokens.slice(0, index), left, right, ...tokens.slice(index + 1)])
      }
    })
  }
  for (const candidate of candidates) {
    if (candidate.length < 4 || candidate.length % 2 !== 0) continue
    const half = candidate.length / 2
    const pairs = downFillPairsFromSizeAndWeightRows(candidate.slice(0, half), candidate.slice(half))
    if (pairs.length > 0) return pairs
  }
  return []
}

function downFillPairsFromText(value: unknown) {
  const text = stringValue(value)
  const normalizedPairs = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|CM|厘米|码)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:g|G|克)/g))
    .map((match) => [match[1], match[2]])
    .filter(([size, weight]) => plausibleDownFillSize(size) && plausibleDownFillWeight(weight))
  if (normalizedPairs.length >= 2) return normalizedPairs
  const explicitPairs = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|CM|厘米|码)?\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:g|G|克)?/g))
    .map((match) => [match[1], match[2]])
    .filter(([size, weight]) => plausibleDownFillSize(size) && plausibleDownFillWeight(weight))
  if (explicitPairs.length >= 2) return explicitPairs

  const lines = text
    .replace(/[|｜/、,，]+/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const pairedLines = lines.map(numericTextValues).filter((lineTokens) => lineTokens.length === 2)
  if (pairedLines.length >= 2) {
    const pairs = pairedLines
      .filter(([size, weight]) => plausibleDownFillSize(size) && plausibleDownFillWeight(weight))
    if (pairs.length === pairedLines.length) return pairs
  }

  const labelledSizeLine = lines.find((line) => /尺码|码数|规格|身高|size/i.test(line))
  const labelledWeightLine = lines.find((line) => /克数|充绒量|重量|克重/i.test(line) && numericTextValues(line).length >= 2)
  const labelledPairs = downFillPairsFromSizeAndWeightRows(
    numericTextValues(labelledSizeLine),
    numericTextValues(labelledWeightLine),
  )
  if (labelledPairs.length > 0) return labelledPairs

  const numberRows = lines.map(numericTextValues).filter((lineTokens) => lineTokens.length >= 2)
  if (numberRows.length >= 2) {
    const tablePairs = downFillPairsFromSizeAndWeightRows(numberRows[0], numberRows[1])
    if (tablePairs.length > 0) return tablePairs
  }

  return downFillPairsFromFlatTokens(numericTextValues(text))
}

function normalizeDownFillWeightText(value: unknown) {
  const pairs = downFillPairsFromText(value)
  if (pairs.length === 0) return stringValue(value)
  return pairs
    .map(([size, weight]) => `${cleanNumberText(size)}码${cleanNumberText(weight)}克`)
    .join("；")
}

export function minimumProductArchiveDownFillWeightText(values: unknown[]) {
  const weightsBySize = new Map<string, number>()
  for (const value of values) {
    for (const [rawSize, rawWeight] of downFillPairsFromText(value)) {
      const size = cleanNumberText(rawSize)
      const weight = Number(rawWeight)
      if (!size || !Number.isFinite(weight)) continue
      const current = weightsBySize.get(size)
      if (current === undefined || weight < current) weightsBySize.set(size, weight)
    }
  }
  return Array.from(weightsBySize.entries())
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([size, weight]) => `${size}码${cleanNumberText(String(weight))}克`)
    .join("；")
}

function ocrFieldMatchesDraftField(field: OcrField, draftFieldName: unknown, draftField: JsonRecord = {}) {
  const key = stringValue(field.key)
  const name = compactFieldKey(draftFieldName)
  if (!key || !name) return false
  if (key === "executionStandard") return name.includes("执行标准") || name.includes("执行规范")
  if (key === "safetyCategory") {
    return name === "安全等级"
      || name === "安全等级多选"
      || name.includes("安全技术类别")
      || name.includes("安全类别")
      || name.includes("安全技术要求")
  }
  if (key === "productGrade") return name.includes("产品等级") || name.includes("质量等级")
  if (key === "productName") return name === "产品名称" || name === "商品名称" || name === "品名"
  if (key === "articleNo") return name === "产品货号" || name === "商品货号" || name === "货号" || name === "款号"
  if (key === "materialComposition") {
    if (name.includes("材质成分") || name.includes("面料成分") || name.includes("成分含量文本")) return true
    const hasTemplateOptions = arrayValue(draftField.options_json).length > 0
    return hasTemplateOptions && (name.includes("材质") || name.includes("面料"))
  }
  if (key === "downFillWeight") return name.includes("充绒量") && arrayValue(draftField.options_json).length === 0
  if (key === "washCare") return name.includes("洗涤说明") || name.includes("洗护说明") || name.includes("洗涤方法")
  if (key === "rawText") {
    const sourceKind = stringValue(field.sourceKind)
    if (sourceKind === "hangtag") return name.includes("吊牌截取")
    if (sourceKind === "washlabel") return name.includes("洗唛截取")
    return name.includes("吊牌截取") || name.includes("洗唛截取")
  }
  return false
}

function ocrFieldForRawText(document: OcrDocument): OcrField | null {
  const rawText = stringValue((document as JsonRecord).rawText)
  const sourceKind = stringValue(document.sourceKind)
  if (sourceKind !== "hangtag" && sourceKind !== "washlabel") return null
  if (!rawText) return null
  return {
    key: "rawText",
    label: "吊牌/洗唛截取",
    value: rawText.slice(0, 3000),
    confidence: "medium",
    evidenceText: rawText.slice(0, 300),
    pageNumber: 1,
    sourceKind,
  }
}

function normalizedOcrFields(document: OcrDocument) {
  const fields = Array.isArray(document.fields) ? document.fields : []
  return [...fields, ocrFieldForRawText(document)].filter((field): field is OcrField => Boolean(field?.key && stringValue(field.value)))
}

function betterTarget(left: JsonRecord, right: JsonRecord) {
  const confidenceDelta = fieldConfidenceRank(left.confidence) - fieldConfidenceRank(right.confidence)
  if (confidenceDelta !== 0) return confidenceDelta > 0 ? left : right
  const sourceDelta = sourceRank(left.sourceKind) - sourceRank(right.sourceKind)
  if (sourceDelta !== 0) return sourceDelta > 0 ? left : right
  return stringValue(left.valueText).length >= stringValue(right.valueText).length ? left : right
}

function latestDraftsBySpuCode(db: SyncPostgresDatabase, spuCodes: string[]) {
  const codes = Array.from(new Set(spuCodes.map(stringValue).filter(Boolean)))
  if (codes.length === 0) return new Map<string, JsonRecord>()
  const rows = db.prepare(`
    select *
    from product_archive_draft
    where spu_code in (${codes.map(() => "?").join(", ")})
    order by spu_code, updated_at desc, id desc
  `).all(...codes) as JsonRecord[]
  const lookup = new Map<string, JsonRecord>()
  for (const row of rows) {
    const spuCode = stringValue(row.spu_code)
    if (spuCode && !lookup.has(spuCode)) lookup.set(spuCode, row)
  }
  return lookup
}

function productArchiveDraftIdsForOcrApply(db: SyncPostgresDatabase, spuCodes: string[]) {
  const codes = Array.from(new Set(spuCodes.map(stringValue).filter(Boolean))).sort()
  if (codes.length === 0) return []
  const candidates = db.prepare(`
    select id, spu_code
    from product_archive_draft
    where spu_code in (${codes.map(() => "?").join(", ")})
    order by spu_code, updated_at desc nulls last, id desc
  `).all(...codes) as JsonRecord[]
  const lockedDraftIds = new Set<number>()
  for (const candidate of candidates) {
    const draftId = Number(candidate.id)
    if (!Number.isInteger(draftId) || draftId <= 0 || lockedDraftIds.has(draftId)) continue
    lockedDraftIds.add(draftId)
  }
  return Array.from(lockedDraftIds)
}

function draftFields(db: SyncPostgresDatabase, draft: JsonRecord) {
  const draftId = Number(draft.id)
  return db.prepare(`
    select field.id,
      field.field_name,
      field.field_id,
      field.source_type,
      field.source_ref,
      field.value_text,
      field.value_json,
      field.required,
      field.blocking,
      field.validation_status,
      template.options_json,
      template.field_type
    from product_archive_draft_field field
    left join lateral (
      select options_json, field_type
      from deepdraw_trade_field_cache template
      where template.tenant_name = ?
        and template.merchant_id = ?
        and template.trade_id = ?
        and (template.field_id = field.field_id or template.field_name = field.field_name)
      order by case when template.field_id = field.field_id then 0 else 1 end, template.field_id
      limit 1
    ) template on true
    where field.draft_id = ?
    order by required desc, blocking desc, field_name
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id, draftId) as JsonRecord[]
}

function normalizeOcrValueForDraftField(draftField: JsonRecord, ocrField: OcrField) {
  const rawValue = stringValue(ocrField.value)
  if (stringValue(ocrField.key) === "downFillWeight") {
    return {
      valueText: normalizeDownFillWeightText(rawValue),
      optionCompatible: true,
    }
  }
  const options = arrayValue(draftField.options_json)
  if (!options.length) return {
    valueText: rawValue,
    optionCompatible: true,
  }
  const fieldName = stringValue(draftField.field_name)
  const normalizedValue = normalizeProductArchiveDeepdrawFieldValue(fieldName, rawValue, options)
  return {
    valueText: normalizedValue,
    optionCompatible: productArchiveFieldValueMatchesOptions(normalizedValue, options),
  }
}

function buildTargetFieldsForDocument(
  draftFields: JsonRecord[],
  document: OcrDocument,
  options: { overwriteExisting?: boolean } = {},
) {
  const targetsByFieldId = new Map<number, JsonRecord>()
  for (const ocrField of normalizedOcrFields(document)) {
    for (const draftField of draftFields) {
      if (!ocrFieldMatchesDraftField(ocrField, draftField.field_name, draftField)) continue
      const fieldId = Number(draftField.id)
      if (!Number.isInteger(fieldId) || fieldId <= 0) continue
      const currentValueText = stringValue(draftField.value_text)
      const currentHasValue = hasFieldValue(draftField)
      const normalized = normalizeOcrValueForDraftField(draftField, ocrField)
      const canOverwrite = !currentHasValue || Boolean(options.overwriteExisting)
      const willApply = canOverwrite && normalized.optionCompatible
      const target = {
        fieldId,
        fieldName: stringValue(draftField.field_name),
        fieldKey: stringValue(ocrField.key),
        label: stringValue(ocrField.label),
        valueText: normalized.valueText,
        rawValueText: stringValue(ocrField.value),
        currentValueText,
        currentSourceType: stringValue(draftField.source_type),
        sourceType: sourceTypeForOcrField(ocrField, document),
        sourceRef: sourceRefForOcrField(ocrField, document),
        confidence: stringValue(ocrField.confidence) || "medium",
        sourceKind: stringValue(ocrField.sourceKind) || stringValue(document.sourceKind),
        evidenceText: stringValue(ocrField.evidenceText),
        pageNumber: Number(ocrField.pageNumber) || null,
        willApply,
        skippedReason: willApply
          ? null
          : canOverwrite
            ? "识别值未匹配深绘模板选项"
            : "已有值，默认不覆盖",
      }
      const existing = targetsByFieldId.get(fieldId)
      targetsByFieldId.set(fieldId, existing ? betterTarget(existing, target) : target)
    }
  }
  return Array.from(targetsByFieldId.values())
}

function itemStatus(input: {
  document: OcrDocument
  detectedSpuCode: string
  matchedDraft: JsonRecord | null
  targetFields: JsonRecord[]
}) {
  if (stringValue(input.document.status) === "ocr_failed") return "ocr_failed"
  if (!input.detectedSpuCode) return "no_style_code"
  if (!input.matchedDraft) return "unmatched"
  if (!Array.isArray(input.document.fields) || input.document.fields.length === 0) return "no_fields"
  if (input.targetFields.length === 0) return "no_target_fields"
  if (!input.targetFields.some((field) => Boolean(field.willApply))) return "all_skipped"
  return "ready"
}

function buildPreviewItem(db: SyncPostgresDatabase, document: OcrDocument, draftLookup: Map<string, JsonRecord>, options: {
  overwriteExisting?: boolean
}) {
  const detectedSpuCode = stringValue(document.detectedSpuCode)
  const matchedDraft = detectedSpuCode ? draftLookup.get(detectedSpuCode) ?? null : null
  const fields = matchedDraft ? draftFields(db, matchedDraft) : []
  const targetFields = matchedDraft ? buildTargetFieldsForDocument(fields, document, options) : []
  const warnings = Array.isArray(document.warnings) ? document.warnings.map(stringValue).filter(Boolean) : []
  const status = itemStatus({ document, detectedSpuCode, matchedDraft, targetFields })
  return {
    fileName: stringValue(document.fileName),
    fileType: stringValue(document.fileType),
    sourceKind: stringValue(document.sourceKind),
    status,
    error: stringValue(document.error) || null,
    detectedSpuCode: detectedSpuCode || null,
    styleCodes: Array.isArray(document.styleCodes) ? document.styleCodes.map(stringValue).filter(Boolean) : [],
    pageCount: Number(document.pageCount ?? 0),
    matchedDraft: matchedDraft
      ? {
          id: Number(matchedDraft.id),
          spuCode: stringValue(matchedDraft.spu_code),
          title: stringValue(matchedDraft.title) || null,
          status: stringValue(matchedDraft.status),
        }
      : null,
    extractedFields: normalizedOcrFields(document).map((field) => ({
      key: stringValue(field.key),
      label: stringValue(field.label),
      value: stringValue(field.value),
      confidence: stringValue(field.confidence) || "medium",
      sourceKind: stringValue(field.sourceKind) || stringValue(document.sourceKind),
      evidenceText: stringValue(field.evidenceText),
      pageNumber: Number(field.pageNumber) || null,
    })),
    targetFields,
    warnings,
  }
}

function applyMinimumDownFillWeightRule(items: ReturnType<typeof buildPreviewItem>[]) {
  const targetsByDraftField = new Map<string, Array<{
    item: ReturnType<typeof buildPreviewItem>
    target: ReturnType<typeof buildPreviewItem>["targetFields"][number]
  }>>()
  for (const item of items) {
    const draftId = Number(item.matchedDraft?.id)
    if (!Number.isInteger(draftId) || draftId <= 0) continue
    for (const target of item.targetFields) {
      if (target.fieldKey !== "downFillWeight" || !target.willApply) continue
      const key = `${draftId}:${target.fieldId}`
      const entries = targetsByDraftField.get(key) ?? []
      entries.push({ item, target })
      targetsByDraftField.set(key, entries)
    }
  }
  for (const entries of targetsByDraftField.values()) {
    if (entries.length < 2) continue
    const minimumValue = minimumProductArchiveDownFillWeightText(entries.map(({ target }) => target.valueText))
    if (!minimumValue) continue
    const fileNames = Array.from(new Set(entries.map(({ item }) => item.fileName).filter(Boolean)))
    const [selected, ...duplicates] = entries
    selected.target.valueText = minimumValue
    selected.target.rawValueText = minimumValue
    selected.target.sourceRef = `同款多色洗唛OCR取小值:${fileNames.join("、")}`
    selected.target.evidenceText = `同款不同色充绒量按尺码取较小值：${minimumValue}`
    for (const duplicate of duplicates) {
      duplicate.target.willApply = false
      duplicate.target.skippedReason = "同款多色充绒量已合并，并按各尺码取较小值"
    }
  }
  for (const item of items) {
    if (item.status === "ready" && !item.targetFields.some((field) => Boolean(field.willApply))) {
      item.status = "all_skipped"
    }
  }
}

export function previewProductArchiveHangtagWashlabelOcr(db: SyncPostgresDatabase, input: PreviewInput = {}) {
  const documents = Array.isArray(input.documents) ? input.documents : []
  const spuCodes = documents.map((document) => stringValue(document.detectedSpuCode)).filter(Boolean)
  const draftLookup = latestDraftsBySpuCode(db, spuCodes)
  const items = documents.map((document) => buildPreviewItem(db, document, draftLookup, {
    overwriteExisting: input.overwriteExisting,
  }))
  applyMinimumDownFillWeightRule(items)
  const summary = {
    fileCount: items.length,
    matchedCount: items.filter((item) => Boolean(item.matchedDraft)).length,
    readyCount: items.filter((item) => item.status === "ready").length,
    unmatchedCount: items.filter((item) => item.status === "unmatched").length,
    failedCount: items.filter((item) => item.status === "ocr_failed").length,
    extractedFieldCount: items.reduce((sum, item) => sum + item.extractedFields.length, 0),
    writableFieldCount: items.reduce((sum, item) => sum + item.targetFields.filter((field) => Boolean(field.willApply)).length, 0),
    skippedFieldCount: items.reduce((sum, item) => sum + item.targetFields.filter((field) => !field.willApply).length, 0),
    warningCount: items.reduce((sum, item) => sum + item.warnings.length + (item.error ? 1 : 0), 0),
  }
  return {
    overwriteExisting: Boolean(input.overwriteExisting),
    summary,
    items,
  }
}

export function applyProductArchiveHangtagWashlabelOcr(db: SyncPostgresDatabase, input: ApplyInput = {}) {
  const applied: JsonRecord[] = []
  const skipped: JsonRecord[] = []
  const touchedDraftIds = new Set<number>()
  return db.transaction(() => {
    const documents = Array.isArray(input.documents) ? input.documents : []
    const candidateDraftIds = productArchiveDraftIdsForOcrApply(
      db,
      documents.map((document) => stringValue(document.detectedSpuCode)),
    )
    for (const draftId of candidateDraftIds) {
      assertProductArchiveDraftMutable(db, draftId)
    }
    const draftLookup = latestDraftsBySpuCode(db, documents.map((document) => stringValue(document.detectedSpuCode)))
    const lockedDraftIdSet = new Set(candidateDraftIds)
    for (const draft of draftLookup.values()) {
      const draftId = Number(draft.id)
      if (!lockedDraftIdSet.has(draftId)) throw new Error(PRODUCT_ARCHIVE_DRAFT_LOCK_SET_CHANGED)
    }
    const items = documents.map((document) => buildPreviewItem(db, document, draftLookup, {
      overwriteExisting: input.overwriteExisting,
    }))
    applyMinimumDownFillWeightRule(items)
    const now = nowIso()
    const updateField = db.prepare(`
      update product_archive_draft_field
      set value_text = ?,
        value_json = ?::jsonb,
        source_type = ?,
        source_ref = ?,
        manual_override = true,
        validation_status = 'valid',
        validation_message = null,
        updated_at = ?::timestamptz
      where draft_id = ? and id = ?
    `)

    for (const item of items) {
      const draftId = Number(item.matchedDraft?.id)
      if (!Number.isInteger(draftId) || draftId <= 0) {
        skipped.push({ fileName: item.fileName, reason: "未匹配草稿" })
        continue
      }
      for (const target of item.targetFields) {
        if (!target.willApply) {
          skipped.push({
            draftId,
            fileName: item.fileName,
            fieldName: target.fieldName,
            reason: stringValue(target.skippedReason) || "跳过",
          })
          continue
        }
        updateField.run(
          target.valueText,
          jsonText({
            product_archive_ocr: {
              file_name: item.fileName,
              source_kind: item.sourceKind,
              field_key: target.fieldKey,
              field_label: target.label,
              confidence: target.confidence,
              evidence_text: target.evidenceText,
              page_number: target.pageNumber,
              applied_at: now,
            },
          }),
          target.sourceType,
          target.sourceRef,
          now,
          draftId,
          target.fieldId,
        )
        touchedDraftIds.add(draftId)
        applied.push({
          draftId,
          spuCode: item.matchedDraft?.spuCode,
          fileName: item.fileName,
          fieldId: target.fieldId,
          fieldName: target.fieldName,
          valueText: target.valueText,
          sourceType: target.sourceType,
          sourceRef: target.sourceRef,
        })
      }
      if (item.targetFields.length === 0) {
        skipped.push({ draftId, fileName: item.fileName, reason: "未找到可对应的深绘字段" })
      }
    }
    for (const draftId of touchedDraftIds) {
      db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
    }
    for (const draftId of touchedDraftIds) {
      const sizeChartUpdates = syncProductArchiveDownFillWeightSizeCharts(db, draftId)
      for (const update of sizeChartUpdates) {
        applied.push({
          draftId,
          fieldId: update.fieldId,
          fieldName: update.fieldName,
          valueJson: update.valueJson,
          sourceType: update.sourceType,
          sourceRef: update.sourceRef,
        })
      }
    }

    const validations = Array.from(touchedDraftIds).map((draftId) => validateProductArchiveDraft(db, draftId))
    return {
      summary: {
        appliedDraftCount: touchedDraftIds.size,
        appliedFieldCount: applied.length,
        skippedCount: skipped.length,
      },
      applied,
      skipped,
      validations: validations.map((validation) => ({
        status: validation.status,
        summary: validation.summary,
        draftId: Number((validation.detail.draft as JsonRecord).id),
        spuCode: stringValue((validation.detail.draft as JsonRecord).spu_code),
      })),
    }
  })()
}
