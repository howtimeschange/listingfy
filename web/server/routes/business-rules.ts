import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"

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

businessRules.get("/size-conversions", (c) => {
  const db = getDb()
  const q = c.req.query("q")
  const batch_search = c.req.query("batch_search")
  const limit = readLimit(c.req.query("limit"))
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
    limit ?
  `).all(...params, limit)

  return c.json({ items })
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
    limit ?
  `).all(...params, limit)

  return c.json({ items })
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
  const clauses: string[] = ["1=1"]
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
    limit ?
  `).all(...params, limit)

  return c.json({ items })
})

export default businessRules
