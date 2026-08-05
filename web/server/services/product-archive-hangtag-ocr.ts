import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { validateProductArchiveDraft } from "./product-archive-drafts"

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

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function compactFieldKey(value: unknown) {
  return stringValue(value).replace(/\s+/g, "").replace(/[()（）]/g, "").toLowerCase()
}

function hasFieldValue(field: JsonRecord) {
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

function ocrFieldMatchesDraftField(field: OcrField, draftFieldName: unknown) {
  const key = stringValue(field.key)
  const name = compactFieldKey(draftFieldName)
  if (!key || !name) return false
  if (key === "executionStandard") return name.includes("执行标准") || name.includes("执行规范")
  if (key === "safetyCategory") return name.includes("安全技术类别") || name.includes("安全类别") || name.includes("安全技术要求")
  if (key === "productGrade") return name.includes("产品等级") || name.includes("质量等级")
  if (key === "productName") return name === "产品名称" || name === "商品名称" || name === "品名"
  if (key === "articleNo") return name === "产品货号" || name === "商品货号" || name === "货号" || name === "款号"
  if (key === "materialComposition") return name.includes("材质成分") || name.includes("面料成分") || name.includes("成分含量文本")
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

function draftFields(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select id, field_name, field_id, source_type, source_ref, value_text, value_json, required, blocking, validation_status
    from product_archive_draft_field
    where draft_id = ?
    order by required desc, blocking desc, field_name
  `).all(draftId) as JsonRecord[]
}

function buildTargetFieldsForDocument(
  draftFields: JsonRecord[],
  document: OcrDocument,
  options: { overwriteExisting?: boolean } = {},
) {
  const targetsByFieldId = new Map<number, JsonRecord>()
  for (const ocrField of normalizedOcrFields(document)) {
    for (const draftField of draftFields) {
      if (!ocrFieldMatchesDraftField(ocrField, draftField.field_name)) continue
      const fieldId = Number(draftField.id)
      if (!Number.isInteger(fieldId) || fieldId <= 0) continue
      const currentValueText = stringValue(draftField.value_text)
      const currentHasValue = hasFieldValue(draftField)
      const willApply = !currentHasValue || Boolean(options.overwriteExisting)
      const target = {
        fieldId,
        fieldName: stringValue(draftField.field_name),
        fieldKey: stringValue(ocrField.key),
        label: stringValue(ocrField.label),
        valueText: stringValue(ocrField.value),
        currentValueText,
        currentSourceType: stringValue(draftField.source_type),
        sourceType: sourceTypeForOcrField(ocrField, document),
        sourceRef: sourceRefForOcrField(ocrField, document),
        confidence: stringValue(ocrField.confidence) || "medium",
        sourceKind: stringValue(ocrField.sourceKind) || stringValue(document.sourceKind),
        evidenceText: stringValue(ocrField.evidenceText),
        pageNumber: Number(ocrField.pageNumber) || null,
        willApply,
        skippedReason: willApply ? null : "已有值，默认不覆盖",
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
  const fields = matchedDraft ? draftFields(db, Number(matchedDraft.id)) : []
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

export function previewProductArchiveHangtagWashlabelOcr(db: SyncPostgresDatabase, input: PreviewInput = {}) {
  const documents = Array.isArray(input.documents) ? input.documents : []
  const spuCodes = documents.map((document) => stringValue(document.detectedSpuCode)).filter(Boolean)
  const draftLookup = latestDraftsBySpuCode(db, spuCodes)
  const items = documents.map((document) => buildPreviewItem(db, document, draftLookup, {
    overwriteExisting: input.overwriteExisting,
  }))
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
  const preview = previewProductArchiveHangtagWashlabelOcr(db, {
    documents: input.documents,
    overwriteExisting: input.overwriteExisting,
  })
  const now = nowIso()
  const applied: JsonRecord[] = []
  const skipped: JsonRecord[] = []
  const touchedDraftIds = new Set<number>()
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

  db.transaction(() => {
    for (const item of preview.items) {
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
  })()

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
}
