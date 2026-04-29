import { Hono } from "hono"
import { getDb } from "../db"

const categoryMapping = new Hono()

// GET /api/category-mapping/rules
categoryMapping.get("/rules", (c) => {
  const db = getDb()
  const status = c.req.query("status")
  const search = c.req.query("q")

  let sql = `
    SELECT id, mdm_middle_category_code, mdm_middle_category_name,
      mdm_small_category_code, mdm_small_category_name,
      gender_code, gender_name, age_group_code, age_group_name,
      match_mode, match_key, shein_category_id, shein_product_type_id,
      priority, status, source, note, created_at, updated_at
    FROM mdm_shein_category_mapping_rule
    WHERE 1=1
  `
  const params: unknown[] = []

  if (status) {
    sql += " AND status = ?"
    params.push(status)
  }

  if (search) {
    sql += ` AND (mdm_small_category_name LIKE ? OR mdm_middle_category_name LIKE ? OR match_key LIKE ?)`
    const like = `%${search}%`
    params.push(like, like, like)
  }

  sql += " ORDER BY priority ASC, id DESC LIMIT 500"

  const rules = db.prepare(sql).all(...params)
  return c.json({ rules })
})

// POST /api/category-mapping/rules - create new rule
categoryMapping.post("/rules", async (c) => {
  const db = getDb()
  const body = await c.req.json()

  const stmt = db.prepare(`
    INSERT INTO mdm_shein_category_mapping_rule (
      mdm_middle_category_code, mdm_middle_category_name,
      mdm_small_category_code, mdm_small_category_name,
      gender_code, gender_name, age_group_code, age_group_name,
      match_mode, match_key, shein_category_id, shein_product_type_id,
      priority, status, source, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const matchKey = body.match_key ?? [
    body.mdm_middle_category_name ?? "",
    body.mdm_small_category_name ?? "",
    body.gender_name ?? "",
    body.age_group_name ?? "",
  ].join("|")

  const result = stmt.run(
    body.mdm_middle_category_code ?? null,
    body.mdm_middle_category_name ?? "",
    body.mdm_small_category_code ?? null,
    body.mdm_small_category_name,
    body.gender_code ?? null,
    body.gender_name ?? null,
    body.age_group_code ?? null,
    body.age_group_name ?? null,
    body.match_mode ?? "EXACT",
    matchKey,
    body.shein_category_id,
    body.shein_product_type_id,
    body.priority ?? 100,
    body.status ?? "ACTIVE",
    body.source ?? "MANUAL",
    body.note ?? null,
  )

  return c.json({ id: result.lastInsertRowid })
})

// PATCH /api/category-mapping/rules/:id
categoryMapping.patch("/rules/:id", async (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  const body = await c.req.json()

  const allowed = [
    "mdm_middle_category_code",
    "mdm_middle_category_name",
    "mdm_small_category_code",
    "mdm_small_category_name",
    "gender_code",
    "gender_name",
    "age_group_code",
    "age_group_name",
    "match_mode",
    "match_key",
    "shein_category_id",
    "shein_product_type_id",
    "priority",
    "status",
    "note",
  ]

  const setClauses: string[] = []
  const params: unknown[] = []
  for (const key of allowed) {
    if (key in body) {
      setClauses.push(`${key} = ?`)
      params.push(body[key])
    }
  }

  if (setClauses.length === 0) {
    return c.json({ error: "No fields to update" }, 400)
  }

  setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
  params.push(id)

  db.prepare(`UPDATE mdm_shein_category_mapping_rule SET ${setClauses.join(", ")} WHERE id = ?`).run(...params)
  return c.json({ ok: true })
})

// DELETE /api/category-mapping/rules/:id
categoryMapping.delete("/rules/:id", (c) => {
  const db = getDb()
  const id = Number(c.req.param("id"))
  db.prepare(`DELETE FROM mdm_shein_category_mapping_rule WHERE id = ?`).run(id)
  return c.json({ ok: true })
})

// POST /api/category-mapping/test-match - test rule matching
categoryMapping.post("/test-match", async (c) => {
  const db = getDb()
  const body = await c.req.json() as {
    mdm_middle_category_name?: string
    mdm_small_category_name?: string
    gender_name?: string
    age_group_name?: string
  }

  // Try EXACT mode first, then FALLBACK by priority
  const exactMatch = db.prepare(`
    SELECT * FROM mdm_shein_category_mapping_rule
    WHERE status = 'ACTIVE'
      AND match_mode = 'EXACT'
      AND mdm_middle_category_name = ?
      AND mdm_small_category_name = ?
      AND coalesce(gender_name, '') = coalesce(?, '')
      AND coalesce(age_group_name, '') = coalesce(?, '')
    ORDER BY priority ASC
    LIMIT 1
  `).get(
    body.mdm_middle_category_name ?? "",
    body.mdm_small_category_name ?? "",
    body.gender_name ?? "",
    body.age_group_name ?? "",
  )

  if (exactMatch) {
    return c.json({ match: exactMatch, mode: "EXACT" })
  }

  const fallbackMatch = db.prepare(`
    SELECT * FROM mdm_shein_category_mapping_rule
    WHERE status = 'ACTIVE'
      AND match_mode = 'FALLBACK'
      AND mdm_small_category_name = ?
    ORDER BY priority ASC
    LIMIT 1
  `).get(body.mdm_small_category_name ?? "")

  if (fallbackMatch) {
    return c.json({ match: fallbackMatch, mode: "FALLBACK" })
  }

  return c.json({ match: null, mode: null })
})

export default categoryMapping
