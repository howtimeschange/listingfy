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

function parseJsonArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
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

function sourceBatchIdsFromSnapshot(value: unknown, legacyValue: unknown = null) {
  const ids = new Set<number>()
  const push = (item: unknown) => {
    const id = Number(item)
    if (Number.isInteger(id) && id > 0) ids.add(id)
  }
  push(legacyValue)
  if (Array.isArray(value)) {
    for (const item of value) push(item)
    return Array.from(ids)
  }
  const record = jsonRecord(value)
  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      for (const id of item) push(id)
    } else {
      push(item)
    }
  }
  return Array.from(ids)
}

function sourceRowSnapshot(row: JsonRecord) {
  return {
    id: row.id ?? null,
    sourceBatchId: row.source_batch_id ?? null,
    sourceType: stringValue(row.source_type),
    spuCode: stringValue(row.spu_code),
    skcCode: stringValue(row.skc_code),
    rowJson: parseJsonRecord(row.row_json),
    createdAt: isoString(row.created_at),
  }
}

function sourceRowsForDraftInputs(db: SyncPostgresDatabase, draft: JsonRecord, sourceBatchIds: unknown) {
  const spuCode = stringValue(draft.spu_code)
  if (!spuCode) return []
  const batchIds = sourceBatchIdsFromSnapshot(sourceBatchIds, parseJsonRecord(draft.source_snapshot_json).sourceBatchId)
  const batchClause = batchIds.length > 0
    ? `and source.source_batch_id in (${batchIds.map(() => "?").join(", ")})`
    : ""
  const params = batchIds.length > 0 ? [spuCode, ...batchIds] : [spuCode]
  return db.prepare(`
    select source.id,
      source.source_batch_id,
      source.source_type,
      source.spu_code,
      source.skc_code,
      source.row_json,
      source.created_at
    from product_archive_source_row source
    join product_archive_source_batch batch
      on batch.id = source.source_batch_id
     and batch.import_status = 'committed'
    where source.spu_code = ?
      ${batchClause}
    order by source.source_type, source.source_batch_id desc, source.skc_code nulls first, source.id desc
    limit 5000
  `).all(...params) as JsonRecord[]
}

function productSpuSnapshot(db: SyncPostgresDatabase, draft: JsonRecord) {
  const spuCode = stringValue(draft.spu_code)
  if (!spuCode) return null
  const row = db.prepare(`
    select id,
      spu_code,
      spu_name,
      spu_name_en,
      brand_code,
      brand_name,
      year,
      season_code,
      season_name,
      product_chain_code,
      product_chain_name,
      product_line_code,
      product_line_name,
      product_type_code,
      product_type_name,
      middle_class_code,
      middle_class_name,
      subclass_code,
      subclass_name,
      gender_code,
      gender_name,
      age_group_code,
      age_group_name,
      main_size_group_code,
      main_size_group_name,
      order_size_group_code,
      order_size_group_name,
      spec_range,
      price_tag,
      fabric_type_code,
      fabric_type_name,
      fabric,
      composition,
      lining_material,
      wash_label_ingr,
      creation_date,
      last_update_date,
      multi_lang_json,
      source_hash,
      synced_at,
      updated_at
    from product_spu
    where spu_code = ?
  `).get(spuCode) as JsonRecord | undefined
  if (!row) return null
  return {
    ...row,
    multi_lang_json: parseJsonArray(row.multi_lang_json),
    updated_at: isoString(row.updated_at),
    synced_at: isoString(row.synced_at),
  }
}

function templateRawRevision(raw: JsonRecord) {
  const attributes = parseJsonRecord(raw.attributes)
  return stringValue(raw.revision)
    || stringValue(raw.rawRevision)
    || stringValue(raw.version)
    || stringValue(raw.updatedAt)
    || stringValue(attributes.revision)
    || stringValue(attributes.rawRevision)
    || stringValue(attributes.version)
}

function templateFieldSnapshot(row: JsonRecord) {
  const raw = parseJsonRecord(row.raw_payload_json)
  const attributes = parseJsonRecord(raw.attributes)
  return {
    id: row.id ?? null,
    fieldName: stringValue(row.field_name),
    fieldId: stringValue(row.field_id),
    fieldType: stringValue(row.field_type),
    optionsJson: parseJsonArray(row.options_json),
    required: Boolean(row.required),
    saleProp: Boolean(row.sale_prop),
    thirdPlatform: stringValue(row.third_platform ?? attributes.thirdPlatform),
    rawRevision: templateRawRevision(raw),
    updatedAt: isoString(row.updated_at),
  }
}

function templateFieldsForDraftInputs(db: SyncPostgresDatabase, draft: JsonRecord) {
  const tenantName = stringValue(draft.tenant_name)
  const merchantId = stringValue(draft.merchant_id)
  const tradeId = stringValue(draft.trade_id)
  if (!tenantName || !merchantId || !tradeId) return []
  return db.prepare(`
    select id,
      field_name,
      field_id,
      field_type,
      options_json,
      required,
      sale_prop,
      raw_payload_json #>> '{attributes,thirdPlatform}' as third_platform,
      raw_payload_json,
      updated_at
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_name, field_id
  `).all(tenantName, merchantId, tradeId) as JsonRecord[]
}

function shoeSizeChartInputSnapshot(db: SyncPostgresDatabase) {
  return db.prepare(`
    select chart.chart_code,
      chart.chart_name,
      chart.applicable_categories,
      chart.version_label,
      chart.enabled as chart_enabled,
      chart.updated_at as chart_updated_at,
      row.size_value,
      row.foot_length_mm,
      row.foot_length_tolerance_mm,
      row.inner_length_mm,
      row.age_segment,
      row.reference_age,
      row.reference_stage,
      row.enabled as row_enabled,
      row.updated_at as row_updated_at
    from product_archive_shoe_size_chart chart
    left join product_archive_shoe_size_chart_row row on row.chart_id = chart.id
    where chart.enabled = true
    order by chart.chart_code, row.size_value
  `).all() as JsonRecord[]
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
    if (isMissingSizeChartMappingTableError(error)) return []
    throw error
  }
}

function isMissingSizeChartMappingTableError(error: unknown) {
  const record = error && typeof error === "object" ? error as JsonRecord : {}
  if (stringValue(record.code) === "42P01") return true
  const message = error instanceof Error ? error.message : String(error)
  return /(?:^|: )no such table: product_archive_size_chart_mapping$/i.test(message.trim())
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
    ? sourceSnapshot.sourceBatchIds ?? {}
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
    templateFields: sortedRows(templateFieldsForDraftInputs(db, draft).map(templateFieldSnapshot)),
    productSpu: productSpuSnapshot(db, draft),
    sourceRows: sortedRows(sourceRowsForDraftInputs(db, draft, sourceBatchIds).map(sourceRowSnapshot)),
    shoeSizeCharts: sortedRows(shoeSizeChartInputSnapshot(db)),
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
