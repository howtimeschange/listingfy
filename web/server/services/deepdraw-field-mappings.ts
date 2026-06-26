import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"

type JsonRecord = Record<string, unknown>

interface ListRulesInput {
  tenantName?: string | null
  merchantId?: string | null
  sourceType?: string | null
  q?: string | null
  limit?: unknown
  offset?: unknown
}

interface FieldMappingRuleInput {
  tenantName?: string | null
  tenant_name?: string | null
  merchantId?: string | null
  merchant_id?: string | null
  fieldDomainType?: string | null
  field_domain_type?: string | null
  deepdrawField?: string | null
  deepdraw_field?: string | null
  fieldSource?: string | null
  field_source?: string | null
  mappedField?: string | null
  mapped_field?: string | null
  sourceType?: string | null
  source_type?: string | null
  sourceTable?: string | null
  source_table?: string | null
  sourceField?: string | null
  source_field?: string | null
  defaultValue?: string | null
  default_value?: string | null
  fieldType?: string | null
  field_type?: string | null
  importability?: string | null
  blocking?: unknown
  enabled?: unknown
  notes?: string | null
  rawRowJson?: unknown
  raw_row_json?: unknown
}

interface ImportRowsInput {
  tenantName?: string | null
  merchantId?: string | null
  rows?: FieldMappingRuleInput[]
  createdBy?: number | null
}

const SOURCE_TYPES = new Set(["mdm", "launch_plan", "copywriting", "fixed", "manual", "skip"])

function nowIso() {
  return new Date().toISOString()
}

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim()
  return ""
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  const text = stringValue(value).toLowerCase()
  if (!text) return fallback
  if (["1", "true", "yes", "y", "是", "启用", "必填", "阻断"].includes(text)) return true
  if (["0", "false", "no", "n", "否", "停用", "禁用", "非必填", "不阻断"].includes(text)) return false
  return fallback
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {})
}

function readLimit(value: unknown, fallback = 50, max = 200) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: unknown) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function sourceTypeValue(value: unknown) {
  const sourceType = stringValue(value)
  if (!SOURCE_TYPES.has(sourceType)) {
    throw new Error("sourceType must be mdm, launch_plan, copywriting, fixed, manual, or skip")
  }
  return sourceType
}

function ruleKey(value: { fieldDomainType?: string | null; field_domain_type?: unknown; deepdrawField?: string | null; deepdraw_field?: unknown }) {
  const fieldDomainType = stringValue(value.fieldDomainType ?? value.field_domain_type) || "通用字段"
  const deepdrawField = stringValue(value.deepdrawField ?? value.deepdraw_field)
  return `${fieldDomainType}\u0000${deepdrawField}`
}

function requireTenant(input: { tenantName?: string | null; merchantId?: string | null }) {
  const tenantName = stringValue(input.tenantName)
  const merchantId = stringValue(input.merchantId)
  if (!tenantName || !merchantId) {
    throw new Error("tenantName and merchantId are required")
  }
  return { tenantName, merchantId }
}

function normalizeRuleInput(input: FieldMappingRuleInput, defaults: {
  tenantName?: string | null
  merchantId?: string | null
  createdBy?: number | null
} = {}) {
  const tenantName = stringValue(input.tenantName ?? input.tenant_name ?? defaults.tenantName)
  const merchantId = stringValue(input.merchantId ?? input.merchant_id ?? defaults.merchantId)
  const deepdrawField = stringValue(input.deepdrawField ?? input.deepdraw_field)
  if (!tenantName || !merchantId) throw new Error("tenantName and merchantId are required")
  if (!deepdrawField) throw new Error("deepdrawField is required")
  const sourceType = sourceTypeValue(input.sourceType ?? input.source_type)
  const fieldDomainType = stringValue(input.fieldDomainType ?? input.field_domain_type) || "通用字段"
  const fieldSourceInput = stringValue(input.fieldSource ?? input.field_source)
  const mappedFieldInput = stringValue(input.mappedField ?? input.mapped_field)
  const sourceTableInput = stringValue(input.sourceTable ?? input.source_table)
  const sourceFieldInput = stringValue(input.sourceField ?? input.source_field)
  const defaultValueInput = stringValue(input.defaultValue ?? input.default_value)
  const fieldSource = fieldSourceInput || sourceTableInput || null
  const mappedField = mappedFieldInput || sourceFieldInput || (sourceType === "fixed" ? defaultValueInput : "") || null
  const sourceField = sourceType === "launch_plan" || sourceType === "copywriting"
    ? sourceFieldInput || mappedFieldInput || null
    : sourceType === "mdm"
      ? sourceFieldInput || mappedFieldInput || fieldSourceInput || null
      : null
  const defaultValue = sourceType === "fixed"
    ? defaultValueInput || mappedFieldInput || null
    : defaultValueInput || null
  return {
    tenantName,
    merchantId,
    fieldDomainType,
    deepdrawField,
    fieldSource,
    mappedField,
    sourceType,
    sourceTable: fieldSource,
    sourceField,
    defaultValue,
    fieldType: stringValue(input.fieldType ?? input.field_type) || null,
    importability: stringValue(input.importability) || null,
    blocking: booleanValue(input.blocking, sourceType === "manual"),
    enabled: booleanValue(input.enabled, true),
    notes: stringValue(input.notes) || null,
    rawRowJson: input.rawRowJson ?? input.raw_row_json ?? {},
    createdBy: defaults.createdBy ?? null,
  }
}

export function listDeepdrawFieldMappingRules(db: SyncPostgresDatabase, input: ListRulesInput = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const params: unknown[] = []
  const where: string[] = []
  if (input.tenantName) {
    where.push("tenant_name = ?")
    params.push(input.tenantName)
  }
  if (input.merchantId) {
    where.push("merchant_id = ?")
    params.push(input.merchantId)
  }
  if (input.sourceType && input.sourceType !== "all") {
    where.push("source_type = ?")
    params.push(input.sourceType)
  }
  if (input.q?.trim()) {
    const like = likeQuery(input.q)
    where.push("(field_domain_type ilike ? or deepdraw_field ilike ? or field_source ilike ? or mapped_field ilike ? or source_field ilike ? or default_value ilike ? or importability ilike ? or notes ilike ?)")
    params.push(like, like, like, like, like, like, like, like)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const items = db.prepare(`
    select *
    from deepdraw_field_mapping_rule
    ${clause}
    order by enabled desc, source_type, deepdraw_field
    limit ? offset ?
  `).all(...params, limit, offset)
  const total = db.prepare(`
    select count(*) as count
    from deepdraw_field_mapping_rule
    ${clause}
  `).get(...params) as { count: number }
  return { items, pagination: { total: Number(total.count ?? 0), limit, offset } }
}

export function importDeepdrawFieldMappingRows(db: SyncPostgresDatabase, input: ImportRowsInput) {
  const { tenantName, merchantId } = requireTenant(input)
  const rows = Array.isArray(input.rows) ? input.rows : []
  const now = nowIso()
  const importedKeys = new Set<string>()
  const upsertRule = db.prepare(`
    insert into deepdraw_field_mapping_rule (
      tenant_name,
      merchant_id,
      field_domain_type,
      deepdraw_field,
      field_source,
      mapped_field,
      source_type,
      source_table,
      source_field,
      default_value,
      field_type,
      importability,
      blocking,
      enabled,
      notes,
      raw_row_json,
      created_by,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::timestamptz)
    on conflict (tenant_name, merchant_id, field_domain_type, deepdraw_field) do update set
      field_domain_type = excluded.field_domain_type,
      field_source = excluded.field_source,
      mapped_field = excluded.mapped_field,
      source_type = excluded.source_type,
      source_table = excluded.source_table,
      source_field = excluded.source_field,
      default_value = excluded.default_value,
      field_type = excluded.field_type,
      importability = excluded.importability,
      blocking = excluded.blocking,
      enabled = excluded.enabled,
      notes = excluded.notes,
      raw_row_json = excluded.raw_row_json,
      updated_at = excluded.updated_at
  `)
  const listExistingRules = db.prepare(`
    select id, field_domain_type, deepdraw_field
    from deepdraw_field_mapping_rule
    where tenant_name = ?
      and merchant_id = ?
  `)
  const deleteStaleRule = db.prepare("delete from deepdraw_field_mapping_rule where id = ?")
  let upsertedCount = 0
  let deletedStaleCount = 0
  db.transaction(() => {
    for (const rawRow of rows) {
      const row = normalizeRuleInput(rawRow, { tenantName, merchantId, createdBy: input.createdBy })
      importedKeys.add(ruleKey(row))
      upsertRule.run(
        row.tenantName,
        row.merchantId,
        row.fieldDomainType,
        row.deepdrawField,
        row.fieldSource,
        row.mappedField,
        row.sourceType,
        row.sourceTable,
        row.sourceField,
        row.defaultValue,
        row.fieldType,
        row.importability,
        row.blocking,
        row.enabled,
        row.notes,
        jsonText(row.rawRowJson),
        row.createdBy,
        now,
      )
      upsertedCount += 1
    }
    if (importedKeys.size > 0) {
      const existingRules = listExistingRules.all(tenantName, merchantId) as JsonRecord[]
      for (const existingRule of existingRules) {
        if (importedKeys.has(ruleKey(existingRule))) continue
        deleteStaleRule.run(existingRule.id)
        deletedStaleCount += 1
      }
    }
  })()
  return {
    tenantName,
    merchantId,
    inputRowCount: rows.length,
    upsertedCount,
    deletedStaleCount,
  }
}

export function createDeepdrawFieldMappingRule(db: SyncPostgresDatabase, input: FieldMappingRuleInput & { createdBy?: number | null }) {
  const row = normalizeRuleInput(input, { createdBy: input.createdBy })
  const inserted = db.prepare(`
    insert into deepdraw_field_mapping_rule (
      tenant_name,
      merchant_id,
      field_domain_type,
      deepdraw_field,
      field_source,
      mapped_field,
      source_type,
      source_table,
      source_field,
      default_value,
      field_type,
      importability,
      blocking,
      enabled,
      notes,
      raw_row_json,
      created_by,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::timestamptz)
    returning *
  `).get(
    row.tenantName,
    row.merchantId,
    row.fieldDomainType,
    row.deepdrawField,
    row.fieldSource,
    row.mappedField,
    row.sourceType,
    row.sourceTable,
    row.sourceField,
    row.defaultValue,
    row.fieldType,
    row.importability,
    row.blocking,
    row.enabled,
    row.notes,
    jsonText(row.rawRowJson),
    row.createdBy,
    nowIso(),
  )
  return inserted
}

export function updateDeepdrawFieldMappingRule(db: SyncPostgresDatabase, ruleId: number, input: FieldMappingRuleInput) {
  if (!Number.isInteger(ruleId) || ruleId <= 0) throw new Error("invalid ruleId")
  const current = db.prepare("select * from deepdraw_field_mapping_rule where id = ?").get(ruleId) as JsonRecord | undefined
  if (!current) throw new Error(`字段对应关系不存在：${ruleId}`)
  const merged = normalizeRuleInput({
    tenantName: stringValue(input.tenantName ?? input.tenant_name ?? current.tenant_name),
    merchantId: stringValue(input.merchantId ?? input.merchant_id ?? current.merchant_id),
    fieldDomainType: stringValue(input.fieldDomainType ?? input.field_domain_type ?? current.field_domain_type),
    deepdrawField: stringValue(input.deepdrawField ?? input.deepdraw_field ?? current.deepdraw_field),
    fieldSource: input.fieldSource ?? input.field_source ?? current.field_source as string | null,
    mappedField: input.mappedField ?? input.mapped_field ?? current.mapped_field as string | null,
    sourceType: stringValue(input.sourceType ?? input.source_type ?? current.source_type),
    sourceTable: input.sourceTable ?? input.source_table ?? current.source_table as string | null,
    sourceField: input.sourceField ?? input.source_field ?? current.source_field as string | null,
    defaultValue: input.defaultValue ?? input.default_value ?? current.default_value as string | null,
    fieldType: input.fieldType ?? input.field_type ?? current.field_type as string | null,
    importability: input.importability ?? current.importability as string | null,
    blocking: input.blocking ?? current.blocking,
    enabled: input.enabled ?? current.enabled,
    notes: input.notes ?? current.notes as string | null,
    rawRowJson: input.rawRowJson ?? input.raw_row_json ?? current.raw_row_json,
  })
  return db.prepare(`
    update deepdraw_field_mapping_rule set
      tenant_name = ?,
      merchant_id = ?,
      field_domain_type = ?,
      deepdraw_field = ?,
      field_source = ?,
      mapped_field = ?,
      source_type = ?,
      source_table = ?,
      source_field = ?,
      default_value = ?,
      field_type = ?,
      importability = ?,
      blocking = ?,
      enabled = ?,
      notes = ?,
      raw_row_json = ?::jsonb,
      updated_at = ?::timestamptz
    where id = ?
    returning *
  `).get(
    merged.tenantName,
    merged.merchantId,
    merged.fieldDomainType,
    merged.deepdrawField,
    merged.fieldSource,
    merged.mappedField,
    merged.sourceType,
    merged.sourceTable,
    merged.sourceField,
    merged.defaultValue,
    merged.fieldType,
    merged.importability,
    merged.blocking,
    merged.enabled,
    merged.notes,
    jsonText(merged.rawRowJson),
    nowIso(),
    ruleId,
  )
}

export function deleteDeepdrawFieldMappingRule(db: SyncPostgresDatabase, ruleId: number) {
  if (!Number.isInteger(ruleId) || ruleId <= 0) throw new Error("invalid ruleId")
  const deleted = db.prepare("delete from deepdraw_field_mapping_rule where id = ? returning *").get(ruleId)
  if (!deleted) throw new Error(`字段对应关系不存在：${ruleId}`)
  return deleted
}
