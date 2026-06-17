import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  normalizeProductArchiveSourceRows,
  parseProductArchiveFieldRuleRows,
} from "../../../scripts/lib/product_archive_source_importer.mjs"
import {
  createDeepdrawProduct,
  getDeepdrawProduct,
  resolveDeepdrawConfig,
  searchDeepdrawProductBasic,
} from "../../../scripts/lib/deepdraw_client.mjs"
import { resolveAiConfig } from "../../../scripts/lib/ai_category_matcher.mjs"

type JsonRecord = Record<string, unknown>

interface ListDraftsInput {
  q?: string | null
  status?: string | null
  tenant?: string | null
  limit?: unknown
  offset?: unknown
}

interface CreateDraftInput {
  spuCode: string
  deepdrawTenantName?: string | null
  tradeId?: string | null
  tradePath?: string | null
  sourceBatchId?: number | null
  createdBy?: number | null
  projectRoot?: string
}

interface PatchFieldInput {
  fields: Array<{
    id?: number
    fieldName?: string
    field_name?: string
    valueText?: string | null
    value_text?: string | null
    valueJson?: unknown
    value_json?: unknown
  }>
}

interface ApplyTradeInput {
  tradeId?: string | null
  tradePath?: string | null
}

interface DeepdrawResult {
  status: number
  ok: boolean
  requestId?: string | null
  payload: unknown
}

interface SubmitOptions {
  dryRun?: boolean
  search?: () => Promise<DeepdrawResult>
  create?: (payload: JsonRecord) => Promise<DeepdrawResult>
  readback?: () => Promise<DeepdrawResult>
  projectRoot?: string
}

interface AiFillOptions {
  fetchImpl?: typeof fetch
}

interface SourceImportInput {
  sourceType?: string | null
  fileName?: string | null
  sheetName?: string | null
  rows?: JsonRecord[]
}

function nowIso() {
  return new Date().toISOString()
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

function stringValue(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function optionText(value: unknown) {
  if (value == null) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return stringValue(value)
  const record = recordValue(value)
  return stringValue(
    record.value
      ?? record.name
      ?? record.label
      ?? record.text
      ?? record.optionName
      ?? record.option_name
      ?? record.id,
  )
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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

function likeQuery(value: string) {
  return `%${value.trim()}%`
}

function draftNo(spuCode: string) {
  return `PAD-${spuCode}-${Date.now()}`
}

function sourceBatchNo(sourceType: string) {
  return `PAS-${sourceType}-${Date.now()}`
}

function sourceImportType(value: unknown) {
  const sourceType = stringValue(value)
  if (["field_mapping", "launch_plan", "copywriting"].includes(sourceType)) return sourceType
  throw new Error("sourceType must be field_mapping, launch_plan, or copywriting")
}

function hasValue(value: unknown) {
  if (value == null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

function sourceFieldValue(rows: JsonRecord[], sourceType: string, sourceField: string, skcCode?: string | null) {
  if (!sourceField) return ""
  const candidates = rows.filter((row) => stringValue(row.source_type) === sourceType)
  const ordered = skcCode
    ? [
        ...candidates.filter((row) => stringValue(row.skc_code) === skcCode),
        ...candidates.filter((row) => !stringValue(row.skc_code)),
      ]
    : candidates
  for (const row of ordered) {
    const rowJson = recordValue(row.row_json)
    const value = stringValue(rowJson[sourceField])
    if (value) return value
  }
  return ""
}

function sourceRowsForSpu(db: SyncPostgresDatabase, spuCode: string, sourceBatchId?: number | null) {
  const batchId = numberValue(sourceBatchId)
  const where = ["source.spu_code = ?"]
  const params: unknown[] = [spuCode]
  if (batchId !== null && Number.isInteger(batchId) && batchId > 0) {
    where.push("source.source_batch_id = ?")
    params.push(batchId)
  }
  return db.prepare(`
    select source.*
    from product_archive_source_row source
    where ${where.join(" and ")}
    order by source.source_type, source.skc_code nulls first, source.id desc
  `).all(...params) as JsonRecord[]
}

function sourceRowsForDraft(db: SyncPostgresDatabase, draft: JsonRecord) {
  const snapshot = recordValue(draft.source_snapshot_json)
  return sourceRowsForSpu(
    db,
    stringValue(draft.spu_code),
    numberValue(snapshot.sourceBatchId),
  )
}

export function missingMdmSpuCodes(db: SyncPostgresDatabase, sourceBatchId: number) {
  if (!Number.isInteger(sourceBatchId) || sourceBatchId <= 0) return []
  const rows = db.prepare(`
    select distinct source.spu_code
    from product_archive_source_row source
    left join product_spu spu on spu.spu_code = source.spu_code
    where source.source_batch_id = ?
      and source.spu_code is not null
      and source.spu_code <> ''
      and spu.id is null
    order by source.spu_code
  `).all(sourceBatchId) as Array<{ spu_code: unknown }>
  return rows.map((row) => stringValue(row.spu_code)).filter(Boolean)
}

export function missingDraftSpuCodes(db: SyncPostgresDatabase, sourceBatchId: number, input: {
  tenantName?: string | null
  merchantId?: string | null
} = {}) {
  if (!Number.isInteger(sourceBatchId) || sourceBatchId <= 0) return []
  const tenantName = stringValue(input.tenantName)
  const merchantId = stringValue(input.merchantId)
  if (!tenantName || !merchantId) return []
  const rows = db.prepare(`
    select distinct source.spu_code
    from product_archive_source_row source
    left join product_archive_draft draft
      on draft.spu_code = source.spu_code
     and draft.tenant_name = ?
     and draft.merchant_id = ?
    where source.source_batch_id = ?
      and source.spu_code is not null
      and source.spu_code <> ''
      and draft.id is null
    order by source.spu_code
  `).all(tenantName, merchantId, sourceBatchId) as Array<{ spu_code: unknown }>
  return rows.map((row) => stringValue(row.spu_code)).filter(Boolean)
}

const LAUNCH_PLAN_CATEGORY_FIELDS = [
  "官方发布类目",
  "发布类目(官方)",
  "发布类目 (官方)",
  "发布类目（官方）",
  "发布类目\n(官方)",
  "发布类目 (唯品)",
  "发布类目(唯品)",
  "发布类目（唯品）",
  "主款式 （唯品四级品类）",
  "主款式（唯品四级品类）",
  "主款式 (唯品四级品类)",
  "发布类目 (抖音)",
  "发布类目(抖音)",
  "发布类目（抖音）",
]

function normalizeTradeText(value: unknown) {
  return stringValue(value)
    .replace(/[＞〉》]/g, ">")
    .replace(/》/g, ">")
    .replace(/\/+/g, ">")
    .replace(/>+/g, ">")
    .replace(/\s+/g, "")
    .replace(/^>+|>+$/g, "")
}

function tradeLeaf(value: string) {
  const normalized = normalizeTradeText(value)
  const parts = normalized.split(">").filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

function launchPlanCategoryValues(sourceRows: JsonRecord[]) {
  const values: Array<{ field: string; value: string }> = []
  const seen = new Set<string>()
  for (const row of sourceRows) {
    if (stringValue(row.source_type) !== "launch_plan") continue
    const rowJson = recordValue(row.row_json)
    for (const field of LAUNCH_PLAN_CATEGORY_FIELDS) {
      const value = stringValue(rowJson[field])
      const key = `${field}:${value}`
      if (!value || seen.has(key)) continue
      seen.add(key)
      values.push({ field, value })
    }
  }
  return values
}

function scoreTradeMatch(trade: JsonRecord, category: { field: string; value: string }) {
  const candidatePath = stringValue(trade.trade_path) || stringValue(trade.trade_name)
  const candidateName = stringValue(trade.trade_name)
  const categoryText = normalizeTradeText(category.value)
  const candidatePathText = normalizeTradeText(candidatePath)
  const candidateNameText = normalizeTradeText(candidateName)
  const categoryLeaf = tradeLeaf(category.value)
  if (!categoryText || (!candidatePathText && !candidateNameText)) return 0
  const fieldBoost = category.field.includes("官方") ? 40 : category.field.includes("唯品四级") ? 20 : 10
  if (candidatePathText === categoryText) return 1000 + fieldBoost
  if (candidateNameText === categoryText) return 850 + fieldBoost
  if (candidateNameText && candidateNameText === categoryLeaf) return 760 + fieldBoost
  if (candidatePathText.endsWith(`>${categoryLeaf}`) || candidatePathText === categoryLeaf) return 720 + fieldBoost
  if (categoryLeaf && candidatePathText.includes(categoryLeaf)) return 520 + fieldBoost
  return 0
}

export function chooseDeepdrawTradeFromLaunchPlanRows(sourceRows: JsonRecord[], trades: JsonRecord[]) {
  const categories = launchPlanCategoryValues(sourceRows)
  if (categories.length === 0 || trades.length === 0) return null
  let best: {
    trade: JsonRecord
    category: { field: string; value: string }
    score: number
  } | null = null
  let tied = false
  for (const trade of trades) {
    for (const category of categories) {
      const score = scoreTradeMatch(trade, category)
      if (score <= 0) continue
      if (!best || score > best.score) {
        best = { trade, category, score }
        tied = false
      } else if (score === best.score) {
        tied = true
      }
    }
  }
  if (!best || tied) return null
  return {
    tradeId: stringValue(best.trade.trade_id),
    tradePath: stringValue(best.trade.trade_path) || stringValue(best.trade.trade_name),
    confidence: best.score >= 1000 ? "high" : "medium",
    matchedField: best.category.field,
    matchedValue: best.category.value,
  }
}

function inferDeepdrawTradeFromLaunchPlan(db: SyncPostgresDatabase, input: {
  tenantName: string
  merchantId: string
  sourceRows: JsonRecord[]
}) {
  const trades = db.prepare(`
    select trade_id, trade_name, trade_path
    from deepdraw_trade_cache
    where tenant_name = ?
      and merchant_id = ?
  `).all(input.tenantName, input.merchantId) as JsonRecord[]
  return chooseDeepdrawTradeFromLaunchPlanRows(input.sourceRows, trades)
}

function chooseTitle(spu: JsonRecord, sourceRows: JsonRecord[] = []) {
  return sourceFieldValue(sourceRows, "copywriting", "搜索标题")
    || sourceFieldValue(sourceRows, "copywriting", "商品标题")
    || sourceFieldValue(sourceRows, "copywriting", "标题")
    || stringValue(spu.listing_title_cn)
    || stringValue(spu.spu_name)
    || stringValue(spu.listing_title_en)
    || stringValue(spu.spu_name_en)
}

function readMdmField(spu: JsonRecord, sourceField: string) {
  return stringValue(spu[sourceField])
}

function readSourceValue(spu: JsonRecord, rule: JsonRecord, sourceRows: JsonRecord[] = []) {
  const sourceType = stringValue(rule.source_type)
  if (sourceType === "fixed") return stringValue(rule.default_value)
  if (sourceType === "mdm") return readMdmField(spu, stringValue(rule.source_field))
  if (sourceType === "launch_plan") return sourceFieldValue(sourceRows, "launch_plan", stringValue(rule.source_field)) || stringValue(rule.default_value)
  if (sourceType === "copywriting") return sourceFieldValue(sourceRows, "copywriting", stringValue(rule.source_field)) || stringValue(rule.default_value)
  if (sourceType === "manual") return stringValue(rule.default_value)
  if (sourceType === "skip") return ""
  return stringValue(rule.default_value)
}

function sanitizeDeepdrawLogPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDeepdrawLogPayload)
  if (!value || typeof value !== "object") return value
  const output: JsonRecord = {}
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (/secret|dopKey|appKey|signature|authorization|header/i.test(key)) {
      output[key] = "[redacted]"
      continue
    }
    output[key] = sanitizeDeepdrawLogPayload(child)
  }
  return output
}

function extractJsonText(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1)
  return trimmed
}

function responseMessageContent(body: unknown) {
  const message = (body as { choices?: Array<{ message?: Record<string, unknown> }> })?.choices?.[0]?.message
  const values = [message?.content, message?.reasoning_content, message?.reasoning]
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string" ? part : stringValue((part as JsonRecord)?.text ?? (part as JsonRecord)?.content))
        .join("\n")
        .trim()
      if (text) return text
    } else if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
}

function fieldOptionText(option: unknown, keys: string[]) {
  if (!option || typeof option !== "object") return stringValue(option)
  const record = option as JsonRecord
  for (const key of keys) {
    const value = stringValue(record[key])
    if (value) return value
  }
  return stringValue(record.value) || stringValue(record.label) || stringValue(record.name)
}

function fieldOptionsFromTemplate(optionsJson: unknown) {
  const rawOptions = arrayValue(optionsJson)
  return rawOptions
    .map((option) => {
      const value = fieldOptionText(option, ["value", "code", "id", "optionValue", "option_value", "key", "name", "label"])
      const label = fieldOptionText(option, ["label", "name", "text", "optionName", "option_name", "title", "value", "code"])
      if (!value && !label) return null
      return { value: value || label, label: label || value }
    })
    .filter((option): option is { value: string; label: string } => Boolean(option))
}

function heuristicDeepdrawOptionValue(fieldName: string, options: Array<{ value: string; label: string }>, contextText: string) {
  const pick = (needles: string[]) => {
    for (const needle of needles) {
      const option = options.find((item) => item.value.includes(needle) || item.label.includes(needle))
      if (option) return option.value
    }
    return ""
  }
  if (/是否|有无|支持|加绒|撞色|透明|防水|防晒/.test(fieldName)) return pick(["否", "不支持", "无"]) || options[0]?.value || ""
  if (/风格|企划/.test(fieldName)) return pick(["休闲", "日常", "基础"]) || options[0]?.value || ""
  if (/年龄|适用人群|人群/.test(fieldName)) return pick(["儿童", "中大童", "婴幼儿", "幼童"]) || options[0]?.value || ""
  if (/季节/.test(fieldName)) {
    if (/羽绒|棉服|毛衣|加绒/.test(contextText)) return pick(["冬", "秋冬"])
    if (/短袖|凉感|夏/.test(contextText)) return pick(["夏", "春夏"])
    return pick(["春秋", "四季"]) || options[0]?.value || ""
  }
  if (/单位/.test(fieldName)) return pick(["件", "条", "双", "套"]) || options[0]?.value || ""
  return options[0]?.value || ""
}

function buildDeepdrawAiFillPrompt(input: {
  draft: JsonRecord
  fields: Array<{ id: number; fieldName: string; options: Array<{ value: string; label: string }> }>
  skus: JsonRecord[]
}) {
  return JSON.stringify({
    task: "为深绘商品建档草稿中需要人工判断的枚举字段选择最合适的字段值",
    output_schema: {
      fills: [
        {
          field_id: "必须等于输入 fields[].field_id",
          field_name: "字段名",
          field_value: "必须从该字段 options[].value 中选择一个原文值",
          confidence: "0 到 1",
          reason: "一句短理由",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "不能编造选项，只能从对应字段 options[].value 中选择。",
      "证据不足时选择保守通用值，并降低 confidence。",
      "是否类字段没有明确证据时优先选择否/无。",
    ],
    product: {
      spu_code: input.draft.spu_code,
      title: input.draft.title,
      trade_path: input.draft.trade_path,
      retail_price: input.draft.retail_price,
      source_snapshot: input.draft.source_snapshot_json,
      skus: input.skus.map((sku) => ({
        sku_code: sku.sku_code,
        skc_code: sku.skc_code,
        color_name: sku.color_name,
        size_name: sku.size_name,
      })),
    },
    fields: input.fields.map((field) => ({
      field_id: field.id,
      field_name: field.fieldName,
      options: field.options.slice(0, 120),
    })),
  }, null, 2)
}

async function callDeepdrawAiFill(prompt: string, options: AiFillOptions = {}) {
  const config = resolveAiConfig()
  if (!config.apiKey) return []
  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是深绘商品建档字段专家，负责在给定枚举值里做保守选择。" },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`DeepDraw AI fill failed: HTTP ${response.status}`)
    const text = responseMessageContent(payload)
    const json = JSON.parse(extractJsonText(text))
    return Array.isArray(json.fills) ? json.fills as JsonRecord[] : []
  } finally {
    clearTimeout(timeout)
  }
}

function draftById(db: SyncPostgresDatabase, draftId: number) {
  const draft = db.prepare("select * from product_archive_draft where id = ?").get(draftId) as JsonRecord | undefined
  if (!draft) throw new Error(`建档草稿不存在：${draftId}`)
  return draft
}

function fieldOptionsLookup(db: SyncPostgresDatabase, draft: JsonRecord) {
  const rows = db.prepare(`
    select field_name, options_json, required
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
  `).all(draft.tenant_name, draft.merchant_id, draft.trade_id) as JsonRecord[]
  const lookup = new Map<string, { options: unknown[]; required: boolean }>()
  for (const row of rows) {
    lookup.set(stringValue(row.field_name), {
      options: arrayValue(row.options_json),
      required: Boolean(row.required),
    })
  }
  return lookup
}

function tradeFieldsForDraft(db: SyncPostgresDatabase, draft: JsonRecord, tradeId = stringValue(draft.trade_id)) {
  if (!tradeId) return []
  return db.prepare(`
    select *
    from deepdraw_trade_field_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    order by required desc, sale_prop desc, field_name
  `).all(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord[]
}

function fieldInsertData(db: SyncPostgresDatabase, draft: JsonRecord, tradeFields: JsonRecord[], existingFields: JsonRecord[] = []) {
  const spu = db.prepare("select * from product_spu where spu_code = ?").get(draft.spu_code) as JsonRecord | undefined
  if (!spu) throw new Error(`MDM 款号不存在：${draft.spu_code}`)
  const rules = db.prepare(`
    select *
    from product_archive_field_rule
    order by id
  `).all() as JsonRecord[]
  const sourceRows = sourceRowsForDraft(db, draft)
  const fieldNames = new Set<string>()
  for (const field of tradeFields) fieldNames.add(stringValue(field.field_name))
  for (const rule of rules) fieldNames.add(stringValue(rule.deepdraw_field))

  const fieldTemplateByName = new Map(tradeFields.map((field) => [stringValue(field.field_name), field]))
  const ruleByName = new Map(rules.map((rule) => [stringValue(rule.deepdraw_field), rule]))
  const existingByName = new Map(existingFields.map((field) => [stringValue(field.field_name), field]))

  return Array.from(fieldNames).filter(Boolean).map((fieldName) => {
    const rule = ruleByName.get(fieldName) ?? {}
    const template = fieldTemplateByName.get(fieldName) ?? {}
    const existing = existingByName.get(fieldName) ?? {}
    const sourceType = stringValue(rule.source_type) || "manual"
    const existingManual = Boolean(existing.manual_override)
    const valueText = existingManual
      ? stringValue(existing.value_text)
      : readSourceValue(spu, rule, sourceRows)
    const valueJson = existingManual ? recordValue(existing.value_json) : {}
    const required = Boolean(template.required) || Boolean(rule.blocking)
    const blocking = Boolean(rule.blocking) || Boolean(template.required)
    const missing = blocking && sourceType !== "skip" && !hasValue(valueText) && !hasValue(valueJson)
    return {
      fieldName,
      fieldId: stringValue(template.field_id) || null,
      sourceType: existingManual ? "manual" : sourceType,
      sourceRef: stringValue(rule.source_field || rule.source_table) || null,
      valueText: valueText || null,
      valueJson,
      required,
      blocking,
      manualOverride: existingManual,
      validationStatus: sourceType === "skip" ? "skipped" : missing ? "missing" : "valid",
      validationMessage: missing ? "必填字段缺失" : null,
    }
  })
}

function rebuildProductArchiveDraftFields(
  db: SyncPostgresDatabase,
  draftId: number,
  tradeFields: JsonRecord[] = tradeFieldsForDraft(db, draftById(db, draftId)),
) {
  const draft = draftById(db, draftId)
  const now = nowIso()
  const existingFields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const insertRows = fieldInsertData(db, draft, tradeFields, existingFields)
  const insertField = db.prepare(`
    insert into product_archive_draft_field (
      draft_id,
      field_name,
      field_id,
      source_type,
      source_ref,
      value_text,
      value_json,
      required,
      blocking,
      manual_override,
      validation_status,
      validation_message,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?::timestamptz)
  `)
  db.transaction(() => {
    db.prepare("delete from product_archive_draft_field where draft_id = ?").run(draftId)
    for (const row of insertRows) {
      insertField.run(
        draftId,
        row.fieldName,
        row.fieldId,
        row.sourceType,
        row.sourceRef,
        row.valueText,
        jsonText(row.valueJson),
        row.required,
        row.blocking,
        row.manualOverride,
        row.validationStatus,
        row.validationMessage,
        now,
      )
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()
}

function serializeDraftDetail(db: SyncPostgresDatabase, draftId: number) {
  const draft = draftById(db, draftId)
  return {
    draft,
    fields: db.prepare(`
      select field.*, template.options_json
      from product_archive_draft_field field
      left join deepdraw_trade_field_cache template
        on template.tenant_name = ?
       and template.merchant_id = ?
       and template.trade_id = ?
       and template.field_name = field.field_name
      where field.draft_id = ?
      order by field.required desc, field.blocking desc, field.field_name
    `).all(draft.tenant_name, draft.merchant_id, draft.trade_id, draftId),
    skus: db.prepare(`
      select *
      from product_archive_draft_sku
      where draft_id = ?
      order by skc_code, size_code, sku_code
    `).all(draftId),
    issues: db.prepare(`
      select *
      from product_archive_validation_issue
      where draft_id = ?
      order by resolved_at nulls first,
        case severity when 'blocker' then 0 when 'warning' then 1 else 2 end,
        id
    `).all(draftId),
    logs: listProductArchiveSubmitLogs(db, draftId),
  }
}

export function listProductArchiveDrafts(db: SyncPostgresDatabase, input: ListDraftsInput = {}) {
  const limit = readLimit(input.limit)
  const offset = readOffset(input.offset)
  const params: unknown[] = []
  const where: string[] = []
  if (input.q?.trim()) {
    const like = likeQuery(input.q)
    where.push("(draft.spu_code ilike ? or draft.title ilike ? or draft.trade_path ilike ? or draft.created_product_id ilike ?)")
    params.push(like, like, like, like)
  }
  if (input.status && input.status !== "all") {
    where.push("draft.status = ?")
    params.push(input.status)
  }
  if (input.tenant && input.tenant !== "all") {
    where.push("draft.tenant_name = ?")
    params.push(input.tenant)
  }
  const clause = where.length ? `where ${where.join(" and ")}` : ""
  const items = db.prepare(`
    select
      draft.*,
      coalesce((draft.validation_summary_json::jsonb #>> '{blocker_count}')::integer, 0) as blocker_count,
      coalesce((draft.validation_summary_json::jsonb #>> '{warning_count}')::integer, 0) as warning_count,
      (select count(*) from product_archive_draft_sku sku where sku.draft_id = draft.id) as sku_count
    from product_archive_draft draft
    ${clause}
    order by draft.updated_at desc, draft.id desc
    limit ? offset ?
  `).all(...params, limit, offset)
  const total = db.prepare(`
    select count(*) as count
    from product_archive_draft draft
    ${clause}
  `).get(...params) as { count: number }
  return { items, pagination: { total: Number(total.count ?? 0), limit, offset } }
}

export function getProductArchiveDraftDetail(db: SyncPostgresDatabase, draftId: number) {
  return serializeDraftDetail(db, draftId)
}

export function importProductArchiveSourceRows(db: SyncPostgresDatabase, input: SourceImportInput) {
  const sourceType = sourceImportType(input.sourceType)
  const rows = Array.isArray(input.rows) ? input.rows : []
  const normalizedRows = sourceType === "field_mapping"
    ? parseProductArchiveFieldRuleRows(rows)
    : normalizeProductArchiveSourceRows(sourceType, rows)
  const now = nowIso()

  const batchId = db.transaction(() => {
    const batch = db.prepare(`
      insert into product_archive_source_batch (
        batch_no,
        source_type,
        file_name,
        sheet_name,
        row_count,
        raw_manifest_json,
        created_at
      )
      values (?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
    `).run(
      sourceBatchNo(sourceType),
      sourceType,
      stringValue(input.fileName) || null,
      stringValue(input.sheetName) || null,
      normalizedRows.length,
      jsonText({
        input_row_count: rows.length,
        inserted_row_count: normalizedRows.length,
        source_type: sourceType,
      }),
      now,
    )
    const sourceBatchId = Number(batch.lastInsertRowid)

    if (sourceType === "field_mapping") {
      const insertRule = db.prepare(`
        insert into product_archive_field_rule (
          source_batch_id,
          deepdraw_field,
          source_type,
          source_table,
          source_field,
          default_value,
          transform_rule_json,
          blocking,
          notes,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::timestamptz)
      `)
      for (const row of normalizedRows) {
        insertRule.run(
          sourceBatchId,
          row.deepdrawField,
          row.sourceType,
          row.sourceTable,
          row.sourceField,
          row.defaultValue,
          jsonText(row.transformRule),
          row.blocking,
          row.notes,
          now,
        )
      }
    } else {
      const insertSourceRow = db.prepare(`
        insert into product_archive_source_row (
          source_batch_id,
          source_type,
          spu_code,
          skc_code,
          row_json,
          created_at
        )
        values (?, ?, ?, ?, ?::jsonb, ?::timestamptz)
      `)
      for (const row of normalizedRows) {
        insertSourceRow.run(
          sourceBatchId,
          row.sourceType,
          row.spuCode,
          row.skcCode,
          jsonText(row.rowJson),
          now,
        )
      }
    }
    return sourceBatchId
  })()

  return {
    batch: db.prepare("select * from product_archive_source_batch where id = ?").get(batchId),
    sourceType,
    inputRowCount: rows.length,
    insertedRowCount: normalizedRows.length,
  }
}

export function createProductArchiveDraftFromSpu(db: SyncPostgresDatabase, input: CreateDraftInput) {
  const spu = db.prepare("select * from product_spu where spu_code = ?").get(input.spuCode) as JsonRecord | undefined
  if (!spu) throw new Error(`MDM 款号不存在：${input.spuCode}`)

  const deepdrawConfig = resolveDeepdrawConfig({
    projectRoot: input.projectRoot,
    tenantName: input.deepdrawTenantName ?? undefined,
  })
  const tenantName = deepdrawConfig.tenantName
  const merchantId = String(deepdrawConfig.merchantId)
  const skuRows = db.prepare(`
    select
      spu.spu_code,
      skc.skc_code,
      skc.color_code,
      skc.color_name,
      sku.sku_code,
      sku.ean_code,
      sku.inner_code,
      sku.size_code,
      sku.size_name,
      sku.price_tag,
      sku.raw_payload_json
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    join product_spu spu on spu.id = skc.spu_id
    where spu.spu_code = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(input.spuCode) as JsonRecord[]

  const sourceRows = sourceRowsForSpu(db, input.spuCode, input.sourceBatchId)
  const autoMatchedTrade = input.tradeId
    ? null
    : inferDeepdrawTradeFromLaunchPlan(db, { tenantName, merchantId, sourceRows })
  const draftTradeId = input.tradeId ?? autoMatchedTrade?.tradeId ?? null
  const draftTradePath = input.tradePath ?? autoMatchedTrade?.tradePath ?? null
  const tradeFields = draftTradeId
    ? tradeFieldsForDraft(db, { tenant_name: tenantName, merchant_id: merchantId, trade_id: draftTradeId }, draftTradeId)
    : []

  const now = nowIso()
  const sourceSnapshot = { spu, sourceRows, sourceBatchId: input.sourceBatchId ?? null, autoMatchedTrade }
  const result = db.transaction(() => {
    const inserted = db.prepare(`
      insert into product_archive_draft (
        draft_no,
        spu_code,
        tenant_name,
        merchant_id,
        trade_id,
        trade_path,
        title,
        retail_price,
        source_snapshot_json,
        created_by,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::timestamptz)
    `).run(
      draftNo(input.spuCode),
      input.spuCode,
      tenantName,
      merchantId,
      draftTradeId,
      draftTradePath,
      chooseTitle(spu, sourceRows),
      numberValue(spu.price_tag),
      jsonText(sourceSnapshot),
      input.createdBy ?? null,
      now,
    )
    const draftId = Number(inserted.lastInsertRowid)
    const fieldRows = fieldInsertData(db, {
      id: draftId,
      spu_code: input.spuCode,
      tenant_name: tenantName,
      merchant_id: merchantId,
      trade_id: draftTradeId,
      source_snapshot_json: jsonText(sourceSnapshot),
    }, tradeFields)
    const insertField = db.prepare(`
      insert into product_archive_draft_field (
        draft_id,
        field_name,
        field_id,
        source_type,
        source_ref,
        value_text,
        value_json,
        required,
        blocking,
        manual_override,
        validation_status,
        validation_message,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, false, ?, ?, ?::timestamptz)
    `)
    for (const field of fieldRows) {
      insertField.run(
        draftId,
        field.fieldName,
        field.fieldId,
        field.sourceType,
        field.sourceRef,
        field.valueText,
        jsonText({}),
        field.required,
        field.blocking,
        field.validationStatus,
        field.validationMessage,
        now,
      )
    }

    const insertSku = db.prepare(`
      insert into product_archive_draft_sku (
        draft_id,
        spu_code,
        skc_code,
        sku_code,
        barcode,
        color_name,
        color_code,
        size_name,
        size_code,
        price,
        seller_code,
        raw_payload_json,
        updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::timestamptz)
    `)
    for (const sku of skuRows) {
      insertSku.run(
        draftId,
        input.spuCode,
        sku.skc_code,
        sku.sku_code,
        sku.ean_code,
        sku.color_name,
        sku.color_code,
        sku.size_name,
        sku.size_code,
        numberValue(sku.price_tag),
        stringValue(sku.inner_code) || stringValue(sku.ean_code) || stringValue(sku.sku_code),
        jsonText(recordValue(sku.raw_payload_json)),
        now,
      )
    }
    return draftId
  })()

  validateProductArchiveDraft(db, result)
  return serializeDraftDetail(db, result)
}

export function applyProductArchiveDraftTrade(db: SyncPostgresDatabase, draftId: number, input: ApplyTradeInput) {
  const draft = draftById(db, draftId)
  const tradeId = stringValue(input.tradeId)
  if (!tradeId) throw new Error("请选择深绘类目")
  const trade = db.prepare(`
    select *
    from deepdraw_trade_cache
    where tenant_name = ?
      and merchant_id = ?
      and trade_id = ?
    limit 1
  `).get(draft.tenant_name, draft.merchant_id, tradeId) as JsonRecord | undefined
  if (!trade) throw new Error("本地未找到该深绘类目，请先同步类目主数据")

  const now = nowIso()
  db.prepare(`
    update product_archive_draft
    set trade_id = ?,
      trade_path = ?,
      updated_at = ?::timestamptz
    where id = ?
  `).run(
    tradeId,
    stringValue(input.tradePath) || stringValue(trade.trade_path) || stringValue(trade.trade_name) || tradeId,
    now,
    draftId,
  )
  rebuildProductArchiveDraftFields(db, draftId)
  return validateProductArchiveDraft(db, draftId)
}

export function patchProductArchiveDraftFields(db: SyncPostgresDatabase, draftId: number, input: PatchFieldInput) {
  const now = nowIso()
  db.transaction(() => {
    for (const field of input.fields ?? []) {
      const fieldName = stringValue(field.fieldName ?? field.field_name)
      const valueText = field.valueText ?? field.value_text ?? null
      const valueJson = field.valueJson ?? field.value_json ?? {}
      if (field.id) {
        db.prepare(`
          update product_archive_draft_field
          set value_text = ?,
            value_json = ?::jsonb,
            manual_override = true,
            updated_at = ?::timestamptz
          where draft_id = ? and id = ?
        `).run(valueText, jsonText(valueJson), now, draftId, field.id)
      } else if (fieldName) {
        db.prepare(`
          update product_archive_draft_field
          set value_text = ?,
            value_json = ?::jsonb,
            manual_override = true,
            updated_at = ?::timestamptz
          where draft_id = ? and field_name = ?
        `).run(valueText, jsonText(valueJson), now, draftId, fieldName)
      }
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()
  return validateProductArchiveDraft(db, draftId)
}

export async function fillProductArchiveDraftFieldsWithAi(db: SyncPostgresDatabase, draftId: number, options: AiFillOptions = {}) {
  const detail = serializeDraftDetail(db, draftId)
  const draft = detail.draft as JsonRecord
  const fields = detail.fields as JsonRecord[]
  const skus = detail.skus as JsonRecord[]
  const contextText = [
    draft.title,
    draft.trade_path,
    draft.source_snapshot_json,
    ...skus.map((sku) => `${stringValue(sku.color_name)} ${stringValue(sku.size_name)}`),
  ].map(stringValue).join(" ")
  const candidates = fields
    .filter((field) => !hasValue(field.value_text) && stringValue(field.source_type) !== "skip")
    .map((field) => ({
      id: Number(field.id),
      fieldName: stringValue(field.field_name),
      options: fieldOptionsFromTemplate(field.options_json),
    }))
    .filter((field) => Number.isInteger(field.id) && field.fieldName && field.options.length > 0)

  if (candidates.length === 0) {
    return { saved: [], detail }
  }

  const prompt = buildDeepdrawAiFillPrompt({ draft, fields: candidates, skus })
  const aiFills = await callDeepdrawAiFill(prompt, options).catch(() => [] as JsonRecord[])
  const aiById = new Map(aiFills.map((fill) => [Number(fill.field_id), fill]))
  const now = nowIso()
  const saved: Array<{ field_id: number; field_name: string; field_value: string; source: string; confidence: number | null }> = []
  const updateField = db.prepare(`
    update product_archive_draft_field
    set value_text = ?,
      value_json = ?::jsonb,
      source_type = ?,
      manual_override = true,
      validation_status = 'valid',
      validation_message = null,
      updated_at = ?::timestamptz
    where draft_id = ? and id = ?
  `)

  db.transaction(() => {
    for (const field of candidates) {
      const aiFill = aiById.get(field.id)
      const aiValue = stringValue(aiFill?.field_value)
      const allowed = new Set(field.options.map((option) => option.value))
      const fieldValue = aiValue && allowed.has(aiValue)
        ? aiValue
        : heuristicDeepdrawOptionValue(field.fieldName, field.options, contextText)
      if (!fieldValue || !allowed.has(fieldValue)) continue
      const confidence = Number(aiFill?.confidence)
      updateField.run(
        fieldValue,
        jsonText({
          ai_fill: aiFill ?? { fallback: true },
          source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        }),
        aiFill ? "ai" : "ai_rule_fallback",
        now,
        draftId,
        field.id,
      )
      saved.push({
        field_id: field.id,
        field_name: field.fieldName,
        field_value: fieldValue,
        source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        confidence: Number.isFinite(confidence) ? confidence : null,
      })
    }
    db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
  })()

  const validated = validateProductArchiveDraft(db, draftId)
  return { saved, detail: validated.detail }
}

export function validateProductArchiveDraft(db: SyncPostgresDatabase, draftId: number) {
  const draft = draftById(db, draftId)
  const fields = db.prepare("select * from product_archive_draft_field where draft_id = ?").all(draftId) as JsonRecord[]
  const skus = db.prepare("select * from product_archive_draft_sku where draft_id = ?").all(draftId) as JsonRecord[]
  const templateLookup = fieldOptionsLookup(db, draft)
  const issues: Array<{ severity: string; issueType: string; fieldName?: string | null; skuCode?: string | null; message: string }> = []
  const now = nowIso()

  if (!stringValue(draft.spu_code)) issues.push({ severity: "blocker", issueType: "missing_spu_code", message: "缺少款号" })
  if (!stringValue(draft.title)) issues.push({ severity: "blocker", issueType: "missing_title", message: "缺少商品标题" })
  if (!stringValue(draft.trade_id)) issues.push({ severity: "blocker", issueType: "missing_trade_id", message: "缺少深绘类目" })
  if (stringValue(draft.trade_id) && templateLookup.size === 0) {
    issues.push({ severity: "blocker", issueType: "deepdraw_template_missing", message: "缺少深绘类目字段模板，请先同步字段" })
  }
  if (recordValue(draft.duplicate_result_json).duplicateFound === true) {
    issues.push({ severity: "blocker", issueType: "duplicate_product_found", message: "深绘已存在同货号商品，当前版本不覆盖更新" })
  }

  const updateField = db.prepare(`
    update product_archive_draft_field
    set validation_status = ?,
      validation_message = ?,
      updated_at = ?::timestamptz
    where id = ?
  `)
  for (const field of fields) {
    const fieldName = stringValue(field.field_name)
    const value = stringValue(field.value_text) || recordValue(field.value_json)
    const template = templateLookup.get(fieldName)
    const required = Boolean(field.required) || Boolean(template?.required)
    const blocking = Boolean(field.blocking) || required
    const options = template?.options ?? []
    let status: string
    let message = ""
    if (stringValue(field.source_type) === "skip") {
      status = "skipped"
    } else if (blocking && !hasValue(value)) {
      status = "missing"
      message = "必填字段缺失"
      issues.push({ severity: "blocker", issueType: "required_field_missing", fieldName, message })
    } else if (options.length && hasValue(value)) {
      const allowed = new Set(options.map((option) => optionText(option)).filter(Boolean))
      if (allowed.size && !allowed.has(stringValue(value))) {
        status = "invalid"
        message = "字段值不在深绘模板选项中"
        issues.push({ severity: blocking ? "blocker" : "warning", issueType: "field_option_invalid", fieldName, message })
      } else {
        status = "valid"
      }
    } else {
      status = "valid"
    }
    updateField.run(status, message || null, now, field.id)
  }

  const colorOptions = Array.from(templateLookup.entries())
    .filter(([name]) => /颜色|色$|color/i.test(name))
    .flatMap(([, template]) => template.options.map(optionText).filter(Boolean))
  const sizeOptions = Array.from(templateLookup.entries())
    .filter(([name]) => /尺码|尺寸|规格|size/i.test(name))
    .flatMap(([, template]) => template.options.map(optionText).filter(Boolean))
  const allowedColors = new Set(colorOptions)
  const allowedSizes = new Set(sizeOptions)

  for (const sku of skus) {
    if (!stringValue(sku.color_name)) {
      issues.push({ severity: "blocker", issueType: "sku_color_missing", skuCode: stringValue(sku.sku_code), message: "SKU 缺少颜色" })
    } else if (allowedColors.size && !allowedColors.has(stringValue(sku.color_name)) && !allowedColors.has(stringValue(sku.color_code))) {
      issues.push({ severity: "blocker", issueType: "sku_color_not_in_template", skuCode: stringValue(sku.sku_code), message: "SKU 颜色不在深绘字段模板选项中" })
    }
    if (!stringValue(sku.size_name)) {
      issues.push({ severity: "blocker", issueType: "sku_size_missing", skuCode: stringValue(sku.sku_code), message: "SKU 缺少尺码" })
    } else if (allowedSizes.size && !allowedSizes.has(stringValue(sku.size_name)) && !allowedSizes.has(stringValue(sku.size_code))) {
      issues.push({ severity: "blocker", issueType: "sku_size_not_in_template", skuCode: stringValue(sku.sku_code), message: "SKU 尺码不在深绘字段模板选项中" })
    }
    const draftPrice = numberValue(draft.retail_price)
    const skuPrice = numberValue(sku.price)
    if (draftPrice !== null && skuPrice !== null && draftPrice !== skuPrice) {
      issues.push({ severity: "warning", issueType: "sku_price_mismatch", skuCode: stringValue(sku.sku_code), message: "SKU 价格与 SPU 吊牌价不一致" })
    }
  }

  const summary = {
    blocker_count: issues.filter((issue) => issue.severity === "blocker").length,
    warning_count: issues.filter((issue) => issue.severity === "warning").length,
    info_count: issues.filter((issue) => issue.severity === "info").length,
    validated_at: now,
  }
  const status = summary.blocker_count > 0
    ? fields.some((field) => stringValue(field.source_type) === "manual" && stringValue(field.validation_status) === "missing")
      ? "manual_review"
      : "missing_fields"
    : "ready"

  db.transaction(() => {
    db.prepare("delete from product_archive_validation_issue where draft_id = ?").run(draftId)
    const insertIssue = db.prepare(`
      insert into product_archive_validation_issue(draft_id, severity, issue_type, field_name, sku_code, message)
      values (?, ?, ?, ?, ?, ?)
    `)
    for (const issue of issues) {
      insertIssue.run(draftId, issue.severity, issue.issueType, issue.fieldName ?? null, issue.skuCode ?? null, issue.message)
    }
    db.prepare(`
      update product_archive_draft
      set status = ?,
        validation_summary_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
    `).run(status, jsonText(summary), now, draftId)
  })()

  return { status, summary, issues, detail: serializeDraftDetail(db, draftId) }
}

function productPayload(db: SyncPostgresDatabase, draftId: number) {
  const detail = serializeDraftDetail(db, draftId)
  const draft = detail.draft as JsonRecord
  return {
    code: stringValue(draft.spu_code),
    title: stringValue(draft.title),
    tradeId: stringValue(draft.trade_id),
    retailPrice: numberValue(draft.retail_price),
    fields: (detail.fields as JsonRecord[])
      .filter((field) => stringValue(field.source_type) !== "skip")
      .map((field) => ({
        id: stringValue(field.field_id) || undefined,
        name: stringValue(field.field_name),
        value: stringValue(field.value_text) || recordValue(field.value_json),
      })),
    skus: (detail.skus as JsonRecord[]).map((sku) => ({
      skuCode: stringValue(sku.sku_code),
      skcCode: stringValue(sku.skc_code),
      color: stringValue(sku.color_name),
      size: stringValue(sku.size_name),
      barcode: stringValue(sku.barcode),
      sellerCode: stringValue(sku.seller_code),
      price: numberValue(sku.price),
    })),
  }
}

function writeSubmitLog(
  db: SyncPostgresDatabase,
  draftId: number,
  operation: "search" | "create" | "resource" | "dry_run",
  result: Partial<DeepdrawResult> & { requestSummary?: unknown; productId?: string | null; responseReason?: string | null } = {},
) {
  const payload = recordValue(result.payload)
  db.prepare(`
    insert into product_archive_submit_log (
      draft_id,
      operation,
      request_summary_json,
      http_status,
      response_code,
      response_reason,
      request_id,
      product_id,
      raw_response_json
    )
    values (?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?::jsonb)
  `).run(
    draftId,
    operation,
    jsonText(result.requestSummary ?? {}),
    result.status ?? null,
    stringValue(payload.code ?? payload.responseCode) || null,
    result.responseReason ?? (stringValue(payload.reason ?? payload.message) || null),
    result.requestId ?? null,
    result.productId ?? (stringValue(recordValue(payload.body).productId) || null),
    jsonText(sanitizeDeepdrawLogPayload(payload)),
  )
}

function assertDeepdrawProductArchiveSuccess(result: DeepdrawResult, type: string) {
  const payload = recordValue(result.payload)
  const response = recordValue(payload.response)
  const outerStatus = numberValue(payload.status)
  const responseCode = numberValue(response.code)
  const responseState = stringValue(response.response).toLowerCase()
  if (
    !result.ok
    || (outerStatus !== null && outerStatus !== 200)
    || (responseCode !== null && responseCode !== 10200)
    || (responseState && responseState !== "success")
  ) {
    const reason = stringValue(response.reason ?? response.message ?? payload.reason ?? payload.message)
    throw new Error(`DeepDraw ${type} failed: ${reason || result.status}`)
  }
}

function duplicateRecords(payload: unknown) {
  const body = recordValue(recordValue(payload).body)
  const candidates = [
    body.records,
    body.list,
    body.items,
    body.products,
    recordValue(body.page).records,
  ]
  for (const candidate of candidates) {
    const array = arrayValue(candidate)
    if (array.length) return array
  }
  return []
}

export async function checkDuplicateProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const draft = draftById(db, draftId)
  const runSearch = options.search ?? (async () => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await searchDeepdrawProductBasic({
      config,
      productCode: stringValue(draft.spu_code),
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  const result = await runSearch()
  assertDeepdrawProductArchiveSuccess(result, "search")
  const records = duplicateRecords(result.payload)
  const duplicateFound = records.length > 0
  const summary = {
    duplicateFound,
    records,
    checkedAt: nowIso(),
    requestId: result.requestId ?? null,
  }
  db.transaction(() => {
    writeSubmitLog(db, draftId, "search", {
      ...result,
      requestSummary: { spuCode: draft.spu_code, tenantName: draft.tenant_name },
    })
    db.prepare(`
      update product_archive_draft
      set status = case when ? then 'duplicate_found' else status end,
        duplicate_result_json = ?::jsonb,
        updated_at = ?::timestamptz
      where id = ?
    `).run(duplicateFound, jsonText(sanitizeDeepdrawLogPayload(summary)), nowIso(), draftId)
  })()
  return summary
}

export async function submitProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const validation = validateProductArchiveDraft(db, draftId)
  const payload = productPayload(db, draftId)
  const summary = { fieldCount: payload.fields.length, skuCount: payload.skus.length }
  if (options.dryRun) {
    writeSubmitLog(db, draftId, "dry_run", { requestSummary: summary, status: 200, payload: { dryRun: true } })
    return { dryRun: true, payload, summary }
  }
  if (validation.summary.blocker_count > 0) {
    throw new Error("草稿存在阻断问题，不能提交")
  }
  const duplicate = await checkDuplicateProductArchiveDraft(db, draftId, options)
  if (duplicate.duplicateFound) return { duplicateFound: true, duplicate }

  const draft = draftById(db, draftId)
  const runCreate = options.create ?? (async (requestPayload: JsonRecord) => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await createDeepdrawProduct({
      config,
      payload: requestPayload,
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  db.prepare("update product_archive_draft set status = 'submitting', updated_at = ?::timestamptz where id = ?").run(nowIso(), draftId)
  const result = await runCreate(payload)
  const body = recordValue(recordValue(result.payload).body)
  const productId = stringValue(body.productId ?? body.id)
  db.transaction(() => {
    writeSubmitLog(db, draftId, "create", { ...result, requestSummary: summary, productId })
    db.prepare(`
      update product_archive_draft
      set status = ?,
        created_product_id = ?,
        created_product_code = ?,
        updated_at = ?::timestamptz
      where id = ?
    `).run(result.ok ? "created" : "failed", productId || null, stringValue(body.code) || stringValue(payload.code), nowIso(), draftId)
  })()
  if (!result.ok) return { ok: false, result }
  return await readbackProductArchiveDraft(db, draftId, options)
}

export async function readbackProductArchiveDraft(db: SyncPostgresDatabase, draftId: number, options: SubmitOptions = {}) {
  const draft = draftById(db, draftId)
  const runReadback = options.readback ?? (async () => {
    const config = resolveDeepdrawConfig({
      projectRoot: options.projectRoot,
      tenantName: stringValue(draft.tenant_name),
    })
    return await getDeepdrawProduct({
      config,
      productCode: stringValue(draft.spu_code),
      timeoutMs: Number(process.env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    }) as DeepdrawResult
  })
  const result = await runReadback()
  const body = recordValue(recordValue(result.payload).body)
  const titleMatches = !stringValue(draft.title) || !stringValue(body.title) || stringValue(draft.title) === stringValue(body.title)
  const status = result.ok && titleMatches ? "readback_verified" : "readback_mismatch"
  db.transaction(() => {
    writeSubmitLog(db, draftId, "resource", {
      ...result,
      requestSummary: { spuCode: draft.spu_code },
      productId: stringValue(body.productId ?? body.id) || stringValue(draft.created_product_id) || null,
    })
    db.prepare(`
      update product_archive_draft
      set status = ?,
        updated_at = ?::timestamptz
      where id = ?
    `).run(status, nowIso(), draftId)
  })()
  return { ok: result.ok, status, result }
}

export function listProductArchiveSubmitLogs(db: SyncPostgresDatabase, draftId: number) {
  return db.prepare(`
    select *
    from product_archive_submit_log
    where draft_id = ?
    order by created_at desc, id desc
  `).all(draftId)
}
