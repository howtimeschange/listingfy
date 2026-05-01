import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { getSheinPriceConfig, updateSheinPriceConfig } from "../lib/price-config"

const businessRules = new Hono()

type ImportBody = {
  file_name?: string
  rows?: Array<Record<string, unknown>>
}

type SizeRuleBody = {
  local_size_code?: unknown
  local_size_name?: unknown
  shein_size_value?: unknown
  status?: unknown
  note?: unknown
}

type DiscountRuleBody = {
  spu_code?: unknown
  discount?: unknown
  multiplier?: unknown
  status?: unknown
  note?: unknown
}

type WeightRuleBody = {
  spu_code?: unknown
  skc_code?: unknown
  sku_code?: unknown
  package_weight_g?: unknown
  status?: unknown
  note?: unknown
}

type PackageRuleBody = {
  rule_name?: unknown
  priority?: unknown
  match_mode?: unknown
  match_keywords?: unknown
  package_length_cm?: unknown
  package_width_cm?: unknown
  package_height_cm?: unknown
  package_type?: unknown
  status?: unknown
  note?: unknown
}

type PriceConfigBody = {
  default_discount?: unknown
  usd_exchange_rate?: unknown
  note?: unknown
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value)
  return text || null
}

function readLimit(value: string | undefined, fallback = 100, max = 1000) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.max(1, Math.min(max, Math.floor(number)))
}

function readOffset(value: string | undefined) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.floor(number))
}

function batchTerms(value: string | undefined) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\s,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function firstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && normalizeText(row[key]) !== "") return row[key]
  }
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.replace(/\s+/g, "").toLowerCase(),
    value,
  ] as const)
  for (const key of keys) {
    const normalizedKey = key.replace(/\s+/g, "").toLowerCase()
    const found = normalizedEntries.find(([rowKey]) => rowKey === normalizedKey)
    if (found && normalizeText(found[1]) !== "") return found[1]
  }
  return null
}

function readDiscount(value: unknown, fallback: number | null = null) {
  if (value == null || value === "") return fallback
  const normalized = normalizeText(value).replace("%", "")
  const number = Number(normalized)
  if (!Number.isFinite(number)) return fallback
  return number > 1 ? number / 100 : number
}

function readWeight(value: unknown, fallback: number | null = null) {
  if (value == null || value === "") return fallback
  const normalized = normalizeText(value)
    .replace(/,/g, "")
    .replace(/g$/i, "")
    .replace(/克$/, "")
    .trim()
  const number = Number(normalized)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return number
}

function readNumber(value: unknown, fallback: number | null = null) {
  if (value == null || value === "") return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return number
}

function readInteger(value: unknown, fallback = 0) {
  const number = readNumber(value, fallback) ?? fallback
  return Math.floor(number)
}

function normalizeKeywords(value: unknown) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean)
  return Array.from(
    new Set(
      normalizeText(value)
        .split(/[\n,，;；]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function packageRuleRow(row: Record<string, unknown>) {
  const length = readNumber(row.package_length_cm)
  const width = readNumber(row.package_width_cm)
  const height = readNumber(row.package_height_cm)
  const ruleName = normalizeText(row.rule_name)
  if (!ruleName || !length || !width || !height) return null
  return {
    rule_name: ruleName,
    priority: readInteger(row.priority, 0),
    match_mode: normalizeText(row.match_mode).toUpperCase() === "ALL" ? "ALL" : "ANY",
    match_keywords: normalizeKeywords(row.match_keywords ?? row.match_keywords_json),
    package_length_cm: length,
    package_width_cm: width,
    package_height_cm: height,
    package_type: normalizeText(row.package_type) || "软包装+软物品",
    status: normalizeText(row.status ?? "ACTIVE") || "ACTIVE",
    note: normalizeNullableText(row.note),
  }
}

function parseJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function createImportBatch({
  importType,
  fileName,
  totalCount,
  successCount,
  failedCount,
}: {
  importType: string
  fileName?: string
  totalCount: number
  successCount: number
  failedCount: number
}) {
  const db = getDb()
  const result = db.prepare(`
    insert into business_import_batch (
      import_type,
      file_name,
      status,
      total_count,
      success_count,
      failed_count,
      finished_at
    )
    values (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    importType,
    fileName ?? null,
    failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
    totalCount,
    successCount,
    failedCount,
  )
  return Number(result.lastInsertRowid)
}

function listWhere({
  q,
  batchSearch,
  columns,
}: {
  q?: string
  batchSearch?: string
  columns: string[]
}) {
  const clauses: string[] = ["status <> 'DELETED'"]
  const params: unknown[] = []

  if (q?.trim()) {
    const like = `%${q.trim()}%`
    clauses.push(`(${columns.map((column) => `${column} like ?`).join(" or ")})`)
    params.push(...columns.map(() => like))
  }

  const terms = batchTerms(batchSearch)
  if (terms.length > 0) {
    const termClauses = terms.map(() =>
      `(${columns.map((column) => `${column} like ?`).join(" or ")})`,
    )
    clauses.push(`(${termClauses.join(" or ")})`)
    for (const term of terms) {
      params.push(...columns.map(() => `%${term}%`))
    }
  }

  return {
    clause: `where ${clauses.join(" and ")}`,
    params,
  }
}

function paginatedResponse({
  items,
  total,
  limit,
  offset,
}: {
  items: unknown[]
  total: number
  limit: number
  offset: number
}) {
  return {
    items,
    pagination: {
      total,
      limit,
      offset,
    },
  }
}

function normalizeSizeRow(row: Record<string, unknown>): SizeRuleBody | null {
  const sheinSize = normalizeNullableText(firstValue(row, [
    "shein_size_value",
    "SHEIN尺码-录入",
    "Shein-Size",
    "SHEIN Size",
    "SHEIN尺码",
  ]))
  const localSize = normalizeNullableText(firstValue(row, [
    "local_size_name",
    "尺码",
    "尺码描述",
    "本地尺码",
  ]))
  const localSizeCode = normalizeNullableText(firstValue(row, [
    "local_size_code",
    "尺码编码",
    "size_code",
  ])) ?? localSize

  if (!sheinSize || !localSize) return null
  return {
    local_size_code: localSizeCode,
    local_size_name: localSize,
    shein_size_value: sheinSize,
    status: "ACTIVE",
  }
}

function normalizeDiscountRow(row: Record<string, unknown>): DiscountRuleBody | null {
  const spuCode = normalizeNullableText(firstValue(row, [
    "spu_code",
    "商品款号",
    "款号",
    "SPU",
  ]))
  const discount = readDiscount(firstValue(row, [
    "discount",
    "倍率",
    "供货折扣",
  ]))
  if (!spuCode || discount == null) return null
  return {
    spu_code: spuCode,
    discount,
    multiplier: discount,
    status: "ACTIVE",
  }
}

function normalizeWeightRow(row: Record<string, unknown>): WeightRuleBody | null {
  const spuCode = normalizeNullableText(firstValue(row, [
    "spu_code",
    "商品款号",
    "款号",
    "SPU",
  ]))
  const skcCode = normalizeNullableText(firstValue(row, [
    "skc_code",
    "SKC",
    "款色编码",
    "款色",
  ]))
  const skuCode = normalizeNullableText(firstValue(row, [
    "sku_code",
    "sku",
    "SKU",
    "Sku",
    "商品SKU",
    "商品 SKU",
    "小红书商家编码",
  ]))
  const packageWeight = readWeight(firstValue(row, [
    "package_weight_g",
    "sku重量",
    "SKU重量",
    "SKU 重量",
    "产品毛重",
    "毛重",
  ]))

  if (!skuCode || packageWeight == null) return null
  return {
    spu_code: spuCode,
    skc_code: skcCode,
    sku_code: skuCode,
    package_weight_g: packageWeight,
    status: "ACTIVE",
  }
}

function lookupSkuContext(
  db: ReturnType<typeof getDb>,
  skuCode: string,
): { spu_code: string | null; skc_code: string | null } {
  const mdm = db.prepare(`
    select spu.spu_code, skc.skc_code
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    join product_spu spu on spu.id = skc.spu_id
    where sku.sku_code = ?
    limit 1
  `).get(skuCode) as { spu_code: string | null; skc_code: string | null } | undefined
  if (mdm) return mdm

  const content = db.prepare(`
    select spu_code, skc_code
    from product_content_sku
    where sku_code = ?
    order by updated_at desc, id desc
    limit 1
  `).get(skuCode) as { spu_code: string | null; skc_code: string | null } | undefined
  return content ?? { spu_code: null, skc_code: null }
}

function upsertWeightRule({
  importBatchId,
  body,
}: {
  importBatchId?: number | null
  body: WeightRuleBody
}) {
  const db = getDb()
  const skuCode = normalizeText(body.sku_code)
  const packageWeight = Math.round(readWeight(body.package_weight_g, 0) ?? 0)
  if (!skuCode || packageWeight <= 0) {
    throw new HTTPException(400, { message: "缺少 SKU 或 SKU重量" })
  }
  const context = lookupSkuContext(db, skuCode)
  const spuCode = normalizeNullableText(body.spu_code) ?? context.spu_code
  const skcCode = normalizeNullableText(body.skc_code) ?? context.skc_code

  const existing = db.prepare(`
    select id
    from product_weight_import
    where status = 'ACTIVE'
      and sku_code = ?
    order by id desc
    limit 1
  `).get(skuCode) as { id: number } | undefined

  if (existing) {
    db.prepare(`
      update product_weight_import
      set import_batch_id = coalesce(?, import_batch_id),
        spu_code = ?,
        skc_code = ?,
        package_weight_g = ?,
        raw_payload_json = ?,
        status = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = ?
    `).run(
      importBatchId ?? null,
      spuCode,
      skcCode,
      packageWeight,
      JSON.stringify(body),
      normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
      existing.id,
    )
    return existing.id
  }

  const result = db.prepare(`
    insert into product_weight_import (
      import_batch_id,
      spu_code,
      skc_code,
      sku_code,
      package_weight_g,
      raw_payload_json,
      status,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
      importBatchId ?? null,
      spuCode,
      skcCode,
    skuCode,
    packageWeight,
    JSON.stringify(body),
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
  )
  return Number(result.lastInsertRowid)
}

businessRules.get("/package-rules", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const limit = readLimit(c.req.query("limit"), 100, 500)
  const offset = readOffset(c.req.query("offset"))
  const clauses = ["status <> 'DELETED'"]
  const params: unknown[] = []
  if (q?.trim()) {
    clauses.push("(rule_name like ? or package_type like ? or note like ? or match_keywords_json like ?)")
    params.push(...Array(4).fill(`%${q.trim()}%`))
  }
  const where = `where ${clauses.join(" and ")}`
  const rows = db.prepare(`
    select *
    from shein_package_rule
    ${where}
    order by status = 'ACTIVE' desc, priority desc, id asc
    limit ? offset ?
  `).all(...params, limit, offset) as Array<Record<string, unknown>>
  const total = db.prepare(`
    select count(*) as count
    from shein_package_rule
    ${where}
  `).get(...params) as { count: number }
  const items = rows.map((row) => ({
    ...row,
    match_keywords: parseJsonArray(row.match_keywords_json),
  }))
  return c.json(paginatedResponse({ items, total: total.count, limit, offset }))
})

businessRules.post("/package-rules", async (c) => {
  const db = getDb()
  const body = await c.req.json() as PackageRuleBody
  const normalized = packageRuleRow(body as Record<string, unknown>)
  if (!normalized) throw new HTTPException(400, { message: "缺少规则名称或包装尺寸" })
  const result = db.prepare(`
    insert into shein_package_rule (
      rule_name,
      priority,
      match_mode,
      match_keywords_json,
      package_length_cm,
      package_width_cm,
      package_height_cm,
      package_type,
      status,
      note,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  `).run(
    normalized.rule_name,
    normalized.priority,
    normalized.match_mode,
    JSON.stringify(normalized.match_keywords),
    normalized.package_length_cm,
    normalized.package_width_cm,
    normalized.package_height_cm,
    normalized.package_type,
    normalized.status,
    normalized.note,
  )
  return c.json({ ok: true, id: result.lastInsertRowid })
})

businessRules.patch("/package-rules/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json() as PackageRuleBody
  const normalized = packageRuleRow(body as Record<string, unknown>)
  if (!Number.isFinite(id) || id <= 0 || !normalized) {
    throw new HTTPException(400, { message: "缺少有效规则 ID、规则名称或包装尺寸" })
  }
  db.prepare(`
    update shein_package_rule
    set rule_name = ?,
      priority = ?,
      match_mode = ?,
      match_keywords_json = ?,
      package_length_cm = ?,
      package_width_cm = ?,
      package_height_cm = ?,
      package_type = ?,
      status = ?,
      note = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalized.rule_name,
    normalized.priority,
    normalized.match_mode,
    JSON.stringify(normalized.match_keywords),
    normalized.package_length_cm,
    normalized.package_width_cm,
    normalized.package_height_cm,
    normalized.package_type,
    normalized.status,
    normalized.note,
    id,
  )
  return c.json({ ok: true })
})

businessRules.delete("/package-rules/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`
    update shein_package_rule
    set status = 'DELETED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(id)
  return c.json({ ok: true })
})

businessRules.get("/size-conversions", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const batch_search = c.req.query("batch_search")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere({
    q,
    batchSearch: batch_search,
    columns: ["local_size_code", "local_size_name", "shein_size_value", "note"],
  })

  const items = db.prepare(`
    select *
    from size_conversion_rule
    ${clause}
    order by
      cast(local_size_name as integer),
      local_size_name,
      id desc
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from size_conversion_rule
    ${clause}
  `).get(...params) as { count: number }

  return c.json(paginatedResponse({ items, total: total.count, limit, offset }))
})

businessRules.post("/size-conversions", async (c) => {
  const db = getDb()
  const body = await c.req.json() as SizeRuleBody
  const normalized = normalizeSizeRow(body as Record<string, unknown>)
  if (!normalized) {
    throw new HTTPException(400, { message: "缺少本地尺码或 SHEIN 尺码" })
  }

  const result = db.prepare(`
    insert into size_conversion_rule (
      local_size_code,
      local_size_name,
      shein_size_value,
      status,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(platform, local_size_code, local_size_name)
    where status = 'ACTIVE'
    do update set
      shein_size_value = excluded.shein_size_value,
      note = excluded.note,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `).run(
    normalized.local_size_code ?? null,
    normalized.local_size_name ?? null,
    normalized.shein_size_value,
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
    normalizeNullableText(body.note),
    JSON.stringify(body),
  )
  return c.json({ ok: true, id: result.lastInsertRowid })
})

businessRules.post("/size-conversions/import", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as ImportBody
  const rows = Array.isArray(body.rows) ? body.rows : []
  const normalized = rows.map(normalizeSizeRow)
  const valid = normalized.filter(Boolean) as SizeRuleBody[]
  const batchId = createImportBatch({
    importType: "SIZE_CONVERSION",
    fileName: body.file_name,
    totalCount: rows.length,
    successCount: valid.length,
    failedCount: rows.length - valid.length,
  })

  const stmt = db.prepare(`
    insert into size_conversion_rule (
      import_batch_id,
      local_size_code,
      local_size_name,
      shein_size_value,
      status,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(platform, local_size_code, local_size_name)
    where status = 'ACTIVE'
    do update set
      import_batch_id = excluded.import_batch_id,
      shein_size_value = excluded.shein_size_value,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `)
  const transaction = db.transaction(() => {
    for (const rule of valid) {
      stmt.run(
        batchId,
        rule.local_size_code ?? null,
        rule.local_size_name ?? null,
        rule.shein_size_value,
        JSON.stringify(rule),
      )
    }
  })
  transaction()

  return c.json({
    ok: true,
    batch_id: batchId,
    total_count: rows.length,
    success_count: valid.length,
    failed_count: rows.length - valid.length,
  })
})

businessRules.get("/size-conversions/export", (c) => {
  const db = getDb()
  const rows = db.prepare(`
    select
      shein_size_value as "Shein-Size",
      coalesce(local_size_name, local_size_code) as "尺码",
      local_size_code as "尺码编码",
      note as "备注"
    from size_conversion_rule
    where status = 'ACTIVE'
    order by cast(local_size_name as integer), local_size_name
  `).all()
  return c.json({ rows })
})

businessRules.patch("/size-conversions/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json() as SizeRuleBody
  db.prepare(`
    update size_conversion_rule
    set local_size_code = ?,
      local_size_name = ?,
      shein_size_value = ?,
      status = ?,
      note = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalizeNullableText(body.local_size_code),
    normalizeNullableText(body.local_size_name),
    normalizeText(body.shein_size_value),
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
    normalizeNullableText(body.note),
    id,
  )
  return c.json({ ok: true })
})

businessRules.delete("/size-conversions/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`
    update size_conversion_rule
    set status = 'DELETED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(id)
  return c.json({ ok: true })
})

businessRules.get("/discount-rules", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const batch_search = c.req.query("batch_search")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const { clause, params } = listWhere({
    q,
    batchSearch: batch_search,
    columns: ["spu_code", "note"],
  })

  const items = db.prepare(`
    select *
    from supply_discount_rule
    ${clause}
    order by spu_code
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from supply_discount_rule
    ${clause}
  `).get(...params) as { count: number }

  return c.json(paginatedResponse({ items, total: total.count, limit, offset }))
})

businessRules.post("/discount-rules", async (c) => {
  const db = getDb()
  const body = await c.req.json() as DiscountRuleBody
  const normalized = normalizeDiscountRow(body as Record<string, unknown>)
  if (!normalized) {
    throw new HTTPException(400, { message: "缺少款号或供货折扣" })
  }

  const result = db.prepare(`
    insert into supply_discount_rule (
      spu_code,
      discount,
      multiplier,
      status,
      note,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(spu_code)
    where status = 'ACTIVE'
    do update set
      discount = excluded.discount,
      multiplier = excluded.multiplier,
      note = excluded.note,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `).run(
    normalized.spu_code,
    normalized.discount,
    normalized.multiplier ?? normalized.discount,
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
    normalizeNullableText(body.note),
    JSON.stringify(body),
  )
  return c.json({ ok: true, id: result.lastInsertRowid })
})

businessRules.post("/discount-rules/import", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as ImportBody
  const rows = Array.isArray(body.rows) ? body.rows : []
  const normalized = rows.map(normalizeDiscountRow)
  const valid = normalized.filter(Boolean) as DiscountRuleBody[]
  const batchId = createImportBatch({
    importType: "SUPPLY_DISCOUNT",
    fileName: body.file_name,
    totalCount: rows.length,
    successCount: valid.length,
    failedCount: rows.length - valid.length,
  })

  const stmt = db.prepare(`
    insert into supply_discount_rule (
      import_batch_id,
      spu_code,
      discount,
      multiplier,
      status,
      raw_payload_json,
      updated_at
    )
    values (?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(spu_code)
    where status = 'ACTIVE'
    do update set
      import_batch_id = excluded.import_batch_id,
      discount = excluded.discount,
      multiplier = excluded.multiplier,
      raw_payload_json = excluded.raw_payload_json,
      updated_at = excluded.updated_at
  `)
  const transaction = db.transaction(() => {
    for (const rule of valid) {
      stmt.run(
        batchId,
        rule.spu_code,
        rule.discount,
        rule.multiplier ?? rule.discount,
        JSON.stringify(rule),
      )
    }
  })
  transaction()

  return c.json({
    ok: true,
    batch_id: batchId,
    total_count: rows.length,
    success_count: valid.length,
    failed_count: rows.length - valid.length,
  })
})

businessRules.get("/discount-rules/export", (c) => {
  const db = getDb()
  const rows = db.prepare(`
    select
      spu_code as "商品款号",
      discount as "倍率",
      note as "备注"
    from supply_discount_rule
    where status = 'ACTIVE'
    order by spu_code
  `).all()
  return c.json({ rows })
})

businessRules.get("/price-config", (c) => {
  const config = getSheinPriceConfig(getDb())
  return c.json({
    default_discount: config.defaultDiscount,
    usd_exchange_rate: config.usdExchangeRate,
    note: config.note,
    updated_at: config.updatedAt,
  })
})

businessRules.patch("/price-config", async (c) => {
  const db = getDb()
  const body = await c.req.json() as PriceConfigBody
  const config = updateSheinPriceConfig(db, {
    defaultDiscount: readDiscount(body.default_discount, 0.4) ?? 0.4,
    usdExchangeRate: readNumber(body.usd_exchange_rate, 7.3) ?? 7.3,
    note: normalizeNullableText(body.note),
  })
  return c.json({
    ok: true,
    config: {
      default_discount: config.defaultDiscount,
      usd_exchange_rate: config.usdExchangeRate,
      note: config.note,
      updated_at: config.updatedAt,
    },
  })
})

businessRules.get("/discount-rules/summary", (c) => {
  const db = getDb()
  const config = getSheinPriceConfig(db)
  const summary = db.prepare(`
    select
      count(*) as total,
      sum(case when status = 'ACTIVE' then 1 else 0 end) as active_count,
      sum(case when status = 'ACTIVE' and discount > ? then 1 else 0 end) as low_rate_count,
      avg(case when status = 'ACTIVE' then discount else null end) as average_discount
    from supply_discount_rule
    where status <> 'DELETED'
  `).get(config.defaultDiscount) as Record<string, unknown>
  return c.json({
    total: Number(summary.total ?? 0),
    active_count: Number(summary.active_count ?? 0),
    low_rate_count: Number(summary.low_rate_count ?? 0),
    average_discount: summary.average_discount == null ? null : Number(summary.average_discount),
    default_discount: config.defaultDiscount,
    retail_usd_rate: config.usdExchangeRate,
    note: config.note,
    updated_at: config.updatedAt,
  })
})

businessRules.get("/discount-rules/preview", (c) => {
  const db = getDb()
  const config = getSheinPriceConfig(db)
  const q = normalizeText(c.req.query("q"))
  const limit = readLimit(c.req.query("limit"), 20, 100)
  const params: unknown[] = []
  const where = q
    ? "where spu.spu_code like ? or spu.spu_name like ? or spu.listing_title_cn like ?"
    : ""
  if (q) params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  const items = db.prepare(`
    select
      spu.spu_code,
      spu.spu_name,
      spu.listing_title_cn,
      spu.brand_name,
      spu.price_tag,
      coalesce(rule.discount, ?) as discount,
      rule.id as rule_id,
      round(coalesce(spu.price_tag, 0) * coalesce(rule.discount, ?), 2) as supply_price_cny,
      round(coalesce(spu.price_tag, 0) / ?, 2) as retail_price_usd
    from product_spu spu
    left join supply_discount_rule rule on rule.spu_code = spu.spu_code and rule.status = 'ACTIVE'
    ${where}
    order by rule.id is null asc, spu.updated_at desc, spu.id desc
    limit ?
  `).all(config.defaultDiscount, config.defaultDiscount, config.usdExchangeRate, ...params, limit)
  return c.json({ items })
})

businessRules.patch("/discount-rules/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json() as DiscountRuleBody
  const discount = readDiscount(body.discount, 0.4) ?? 0.4
  db.prepare(`
    update supply_discount_rule
    set spu_code = ?,
      discount = ?,
      multiplier = ?,
      status = ?,
      note = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalizeText(body.spu_code),
    discount,
    readDiscount(body.multiplier, discount) ?? discount,
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
    normalizeNullableText(body.note),
    id,
  )
  return c.json({ ok: true })
})

businessRules.delete("/discount-rules/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`
    update supply_discount_rule
    set status = 'DELETED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(id)
  return c.json({ ok: true })
})

businessRules.get("/product-weights", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const batch_search = c.req.query("batch_search")
  const limit = readLimit(c.req.query("limit"))
  const offset = readOffset(c.req.query("offset"))
  const clauses: string[] = ["status <> 'DELETED'", "coalesce(sku_code, '') <> ''"]
  const params: unknown[] = []
  const terms = batchTerms(batch_search)

  if (q?.trim()) terms.push(q.trim())
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() =>
      "(spu_code like ? or skc_code like ? or sku_code like ?)",
    ).join(" or ")})`)
    for (const term of terms) {
      params.push(`%${term}%`, `%${term}%`, `%${term}%`)
    }
  }

  const items = db.prepare(`
    select *
    from product_weight_import
    where ${clauses.join(" and ")}
    order by created_at desc, id desc
    limit ? offset ?
  `).all(...params, limit, offset)

  const total = db.prepare(`
    select count(*) as count
    from product_weight_import
    where ${clauses.join(" and ")}
  `).get(...params) as { count: number }

  return c.json(paginatedResponse({ items, total: total.count, limit, offset }))
})

businessRules.post("/product-weights", async (c) => {
  const body = await c.req.json() as WeightRuleBody
  const id = upsertWeightRule({ body })
  return c.json({ ok: true, id })
})

businessRules.post("/product-weights/import", async (c) => {
  const body = await c.req.json().catch(() => ({})) as ImportBody
  const rows = Array.isArray(body.rows) ? body.rows : []
  const normalized = rows.map(normalizeWeightRow)
  const validRows = normalized.filter(Boolean) as WeightRuleBody[]
  const validBySku = new Map<string, WeightRuleBody>()
  for (const row of validRows) {
    const skuCode = normalizeText(row.sku_code)
    if (skuCode) validBySku.set(skuCode, row)
  }
  const valid = [...validBySku.values()]

  const batchId = createImportBatch({
    importType: "PRODUCT_WEIGHT",
    fileName: body.file_name,
    totalCount: rows.length,
    successCount: valid.length,
    failedCount: rows.length - validRows.length,
  })

  const saved: Array<Record<string, unknown>> = []
  const db = getDb()
  const transaction = db.transaction(() => {
    for (const row of valid) {
      const payload: WeightRuleBody = {
        ...row,
        note: "由库存毛重表按 SKU 写入 sku重量",
        status: "ACTIVE",
      }
      const id = upsertWeightRule({ importBatchId: batchId, body: payload })
      saved.push({
        id,
        spu_code: payload.spu_code,
        skc_code: payload.skc_code ?? null,
        sku_code: payload.sku_code,
        package_weight_g: payload.package_weight_g,
      })
    }
  })
  transaction()

  return c.json({
    ok: true,
    batch_id: batchId,
    total_count: rows.length,
    success_count: saved.length,
    failed_count: rows.length - validRows.length,
    items: saved,
  })
})

businessRules.get("/product-weights/export", (c) => {
  const db = getDb()
  const rows = db.prepare(`
    select
      spu_code as "款号",
      skc_code as "SKC",
      sku_code as "SKU",
      package_weight_g as "sku重量",
      raw_payload_json as "备注"
    from product_weight_import
    where status = 'ACTIVE'
      and coalesce(sku_code, '') <> ''
    order by spu_code, skc_code, sku_code
  `).all()
  return c.json({ rows })
})

businessRules.patch("/product-weights/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json() as WeightRuleBody
  const packageWeight = Math.round(readWeight(body.package_weight_g, 0) ?? 0)
  const skuCode = normalizeText(body.sku_code)
  if (!Number.isFinite(id) || id <= 0 || !skuCode || packageWeight <= 0) {
    throw new HTTPException(400, { message: "缺少有效 ID、SKU 或 SKU重量" })
  }
  const context = lookupSkuContext(db, skuCode)
  db.prepare(`
    update product_weight_import
    set spu_code = ?,
      skc_code = ?,
      sku_code = ?,
      package_weight_g = ?,
      status = ?,
      raw_payload_json = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(
    normalizeNullableText(body.spu_code) ?? context.spu_code,
    normalizeNullableText(body.skc_code) ?? context.skc_code,
    skuCode,
    packageWeight,
    normalizeText(body.status ?? "ACTIVE") || "ACTIVE",
    JSON.stringify(body),
    id,
  )
  return c.json({ ok: true })
})

businessRules.delete("/product-weights/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`
    update product_weight_import
    set status = 'DELETED',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    where id = ?
  `).run(id)
  return c.json({ ok: true })
})

export default businessRules
