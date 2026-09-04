import { createHash } from "node:crypto"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

type JsonRecord = Record<string, unknown>

export type ProductArchivePreparationSubmitMode = "create" | "full_update" | "incremental_update"

export interface PreparedProductArchiveDraft {
  draftId: number
  draftVersion: string
  inputHash: string
  templateVersion: string
  submitMode: ProductArchivePreparationSubmitMode
  payload: JsonRecord
  validation: JsonRecord
  preparedAt: string
  expiresAt: string
}

interface PreparationOptions {
  submitMode?: ProductArchivePreparationSubmitMode
  templateVersion?: string
  ttlMs?: number
  now?: () => string
  prepare?: () => {
    payload: JsonRecord
    validation: JsonRecord
  }
}

const DEFAULT_TTL_MS = 30 * 60 * 1000

function stringValue(value: unknown) {
  return value == null ? "" : String(value).trim()
}

function jsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as JsonRecord
}

function parseJsonRecord(value: unknown): JsonRecord {
  if (!value) return {}
  if (typeof value === "object" && !Array.isArray(value)) return value as JsonRecord
  if (typeof value !== "string") return {}
  try {
    return jsonRecord(JSON.parse(value))
  } catch {
    return {}
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") return value
  const record = value as JsonRecord
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key])]),
  )
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

function isoString(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  return stringValue(value)
}

function jsonText(value: unknown) {
  return stableJson(value)
}

function rowId(row: JsonRecord) {
  return stringValue(row.id)
    || stringValue(row.sku_code)
    || stringValue(row.field_id)
    || stringValue(row.field_name)
    || stringValue(row.local_path)
}

function sortedRows(rows: JsonRecord[]) {
  return [...rows].sort((left, right) => rowId(left).localeCompare(rowId(right), "en"))
}

function publicFieldSnapshot(field: JsonRecord) {
  return {
    id: field.id ?? null,
    fieldName: stringValue(field.field_name),
    fieldId: stringValue(field.field_id),
    templateFieldId: stringValue(field.template_field_id),
    templateFieldName: stringValue(field.template_field_name),
    fieldType: stringValue(field.field_type),
    sourceType: stringValue(field.source_type),
    sourceRef: stringValue(field.source_ref),
    valueText: field.value_text == null ? null : String(field.value_text),
    valueJson: parseJsonRecord(field.value_json),
    required: Boolean(field.required),
    blocking: Boolean(field.blocking),
    manualOverride: Boolean(field.manual_override),
    validationStatus: stringValue(field.validation_status),
    updatedAt: isoString(field.updated_at),
  }
}

function skuSnapshot(sku: JsonRecord) {
  return {
    id: sku.id ?? null,
    skuCode: stringValue(sku.sku_code),
    skcCode: stringValue(sku.skc_code),
    colorName: stringValue(sku.color_name),
    sizeName: stringValue(sku.size_name),
    barcode: stringValue(sku.barcode),
    sellerCode: stringValue(sku.seller_code),
    price: sku.price ?? null,
    updatedAt: isoString(sku.updated_at),
  }
}

function imageSnapshot(image: JsonRecord) {
  const raw = parseJsonRecord(image.raw_payload_json)
  return {
    id: image.id ?? null,
    sourceType: stringValue(image.source_type),
    sourceRef: stringValue(image.source_ref),
    fileName: stringValue(image.file_name),
    originalFileName: stringValue(image.original_file_name),
    assetKind: stringValue(raw.asset_kind ?? image.asset_kind),
    assetPackageVersion: stringValue(raw.asset_package_version ?? raw.package_version),
    sortNo: image.sort_no ?? null,
    updatedAt: isoString(image.updated_at),
  }
}

function sizeChartMappingSnapshot(mapping: JsonRecord) {
  return {
    id: mapping.id ?? null,
    tenantName: stringValue(mapping.tenant_name),
    merchantId: stringValue(mapping.merchant_id),
    tradeId: stringValue(mapping.trade_id),
    fieldName: stringValue(mapping.field_name),
    targetField: stringValue(mapping.target_field),
    sourcePoint: stringValue(mapping.source_point),
    confidence: stringValue(mapping.confidence),
    source: stringValue(mapping.source),
    reviewStatus: stringValue(mapping.review_status),
    evidenceJson: parseJsonRecord(mapping.evidence_json),
    updatedAt: isoString(mapping.updated_at),
  }
}

function approvedSizeChartMappingsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  const tenantName = stringValue(draft.tenant_name)
  const merchantId = stringValue(draft.merchant_id)
  const tradeId = stringValue(draft.trade_id)
  if (!tenantName || !merchantId || !tradeId) return []
  try {
    return db.prepare(`
      select id,
        tenant_name,
        merchant_id,
        trade_id,
        field_name,
        target_field,
        source_point,
        confidence,
        source,
        review_status,
        evidence_json,
        updated_at
      from product_archive_size_chart_mapping
      where tenant_name = ?
        and merchant_id = ?
        and trade_id = ?
        and review_status = 'approved'
      order by field_name, target_field, id
    `).all(tenantName, merchantId, tradeId) as JsonRecord[]
  } catch (error) {
    if (/product_archive_size_chart_mapping/i.test(error instanceof Error ? error.message : String(error))) return []
    throw error
  }
}

function draftPreparationInputs(
  db: SyncPostgresDatabase,
  draftId: number,
  submitMode: ProductArchivePreparationSubmitMode,
  templateVersion: string,
  options: { draftUpdatedAtOverride?: string | null } = {},
) {
  const draft = db.prepare("select * from product_archive_draft where id = ?").get(draftId) as JsonRecord | undefined
  if (!draft) throw new Error("商品建档草稿不存在")
  const fields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const skus = db.prepare("select * from product_archive_draft_sku where draft_id = ?").all(draftId) as JsonRecord[]
  const images = db.prepare("select * from product_archive_draft_image where draft_id = ?").all(draftId) as JsonRecord[]
  const sourceSnapshot = parseJsonRecord(draft.source_snapshot_json)
  const sourceBatchIds = draft.source_batch_ids_json == null
    ? parseJsonRecord(sourceSnapshot.sourceBatchIds)
    : parseJsonRecord(draft.source_batch_ids_json)
  return {
    draft: {
      id: draft.id ?? draftId,
      updatedAt: stringValue(options.draftUpdatedAtOverride) || isoString(draft.updated_at),
      spuCode: stringValue(draft.spu_code),
      title: stringValue(draft.title),
      tenantName: stringValue(draft.tenant_name),
      merchantId: stringValue(draft.merchant_id),
      tradeId: stringValue(draft.trade_id),
      tradePath: stringValue(draft.trade_path),
      retailPrice: draft.retail_price ?? null,
      sourceBatchIds,
      imagePackageVersion: stringValue(sourceSnapshot.imagePackageVersion ?? sourceSnapshot.image_package_version),
    },
    submitMode,
    templateVersion,
    fields: sortedRows(fields.map(publicFieldSnapshot)),
    skus: sortedRows(skus.map(skuSnapshot)),
    images: sortedRows(images.map(imageSnapshot)),
    sizeChartMappings: sortedRows(approvedSizeChartMappingsForDraft(db, draft).map(sizeChartMappingSnapshot)),
  }
}

export function productArchiveDraftInputHash(
  draft: unknown,
  sourceBatchIds: unknown = {},
  templateVersion = "",
) {
  const current = jsonRecord(draft)
  const submitMode = stringValue(current.submitMode) || "create"
  return createHash("sha256")
    .update(stableJson({
      ...current,
      sourceBatchIds,
      templateVersion,
      submitMode,
    }))
    .digest("hex")
}

function currentInputHash(
  db: SyncPostgresDatabase,
  draftId: number,
  submitMode: ProductArchivePreparationSubmitMode,
  templateVersion: string,
  options: { draftUpdatedAtOverride?: string | null } = {},
) {
  const inputs = draftPreparationInputs(db, draftId, submitMode, templateVersion, options)
  return {
    inputHash: productArchiveDraftInputHash(inputs, {}, templateVersion),
    draftVersion: inputs.draft.updatedAt,
  }
}

export function revalidatePreparedProductArchiveDraftForClaim(
  db: SyncPostgresDatabase,
  draftId: number,
  prepared: PreparedProductArchiveDraft | null,
  options: Omit<PreparationOptions, "prepare" | "ttlMs"> & { claimedDraftUpdatedAt?: string | null } = {},
): PreparedProductArchiveDraft | null {
  if (!prepared) return null
  const submitMode = options.submitMode ?? prepared.submitMode
  const templateVersion = options.templateVersion ?? prepared.templateVersion
  if (prepared.submitMode !== submitMode || prepared.templateVersion !== templateVersion) return null
  const now = options.now?.() ?? new Date().toISOString()
  if (Date.parse(prepared.expiresAt) <= Date.parse(now)) return null
  const claimedDraftUpdatedAt = isoString(options.claimedDraftUpdatedAt)
  if (!claimedDraftUpdatedAt || prepared.draftVersion !== claimedDraftUpdatedAt) return null
  const current = currentInputHash(db, draftId, submitMode, templateVersion, {
    draftUpdatedAtOverride: claimedDraftUpdatedAt,
  })
  if (current.inputHash !== prepared.inputHash) return null
  return prepared
}

function rowToPrepared(row: JsonRecord): PreparedProductArchiveDraft {
  return {
    draftId: Number(row.draft_id),
    draftVersion: isoString(row.draft_updated_at),
    inputHash: stringValue(row.input_hash),
    templateVersion: stringValue(row.template_version),
    submitMode: stringValue(row.submit_mode) as ProductArchivePreparationSubmitMode,
    payload: parseJsonRecord(row.payload_json),
    validation: parseJsonRecord(row.validation_json),
    preparedAt: isoString(row.prepared_at),
    expiresAt: isoString(row.expires_at),
  }
}

export function loadReusablePreparedProductArchiveDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  inputHash: string,
  options: Omit<PreparationOptions, "prepare" | "ttlMs"> = {},
): PreparedProductArchiveDraft | null {
  const submitMode = options.submitMode ?? "create"
  const templateVersion = options.templateVersion ?? ""
  const now = options.now?.() ?? new Date().toISOString()
  const current = currentInputHash(db, draftId, submitMode, templateVersion)
  if (current.inputHash !== inputHash) return null
  const row = db.prepare(`
    select *
    from product_archive_draft_preparation
    where draft_id = ?
      and input_hash = ?
      and submit_mode = ?
      and template_version = ?
      and expires_at > ?::timestamptz
  `).get(draftId, inputHash, submitMode, templateVersion, now) as JsonRecord | undefined
  if (!row) return null
  if (isoString(row.draft_updated_at) !== current.draftVersion) return null
  return rowToPrepared(row)
}

export function loadCurrentReusablePreparedProductArchiveDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  options: Omit<PreparationOptions, "prepare" | "ttlMs"> = {},
): PreparedProductArchiveDraft | null {
  try {
    const submitMode = options.submitMode ?? "create"
    const templateVersion = options.templateVersion ?? ""
    const now = options.now?.() ?? new Date().toISOString()
    const current = currentInputHash(db, draftId, submitMode, templateVersion)
    return loadReusablePreparedProductArchiveDraft(db, draftId, current.inputHash, {
      submitMode,
      templateVersion,
      now: () => now,
    })
  } catch {
    return null
  }
}

export function prepareProductArchiveDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  options: PreparationOptions = {},
): PreparedProductArchiveDraft {
  const submitMode = options.submitMode ?? "create"
  const templateVersion = options.templateVersion ?? ""
  const now = options.now?.() ?? new Date().toISOString()
  const ttlMs = Number.isFinite(options.ttlMs) ? Number(options.ttlMs) : DEFAULT_TTL_MS
  const before = currentInputHash(db, draftId, submitMode, templateVersion)
  const reusable = loadReusablePreparedProductArchiveDraft(db, draftId, before.inputHash, {
    submitMode,
    templateVersion,
    now: () => now,
  })
  if (reusable) return reusable
  if (!options.prepare) throw new Error("缺少商品建档准备函数")

  const prepared = options.prepare()
  const after = currentInputHash(db, draftId, submitMode, templateVersion)
  const expiresAt = new Date(Date.parse(now) + ttlMs).toISOString()
  db.prepare(`
    insert into product_archive_draft_preparation (
      draft_id,
      draft_updated_at,
      input_hash,
      template_version,
      submit_mode,
      payload_json,
      validation_json,
      prepared_at,
      expires_at
    )
    values (?, ?::timestamptz, ?, ?, ?, ?::jsonb, ?::jsonb, ?::timestamptz, ?::timestamptz)
    on conflict (draft_id) do update set
      draft_updated_at = excluded.draft_updated_at,
      input_hash = excluded.input_hash,
      template_version = excluded.template_version,
      submit_mode = excluded.submit_mode,
      payload_json = excluded.payload_json,
      validation_json = excluded.validation_json,
      prepared_at = excluded.prepared_at,
      expires_at = excluded.expires_at
  `).run(
    draftId,
    after.draftVersion,
    after.inputHash,
    templateVersion,
    submitMode,
    jsonText(prepared.payload),
    jsonText(prepared.validation),
    now,
    expiresAt,
  )
  return {
    draftId,
    draftVersion: after.draftVersion,
    inputHash: after.inputHash,
    templateVersion,
    submitMode,
    payload: prepared.payload,
    validation: prepared.validation,
    preparedAt: now,
    expiresAt,
  }
}
