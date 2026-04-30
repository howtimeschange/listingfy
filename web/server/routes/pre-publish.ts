import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { getDb } from "../db"
import { resolveAiConfig } from "../../../scripts/lib/ai_category_matcher.mjs"

const prePublish = new Hono()

type SourceRow = Record<string, unknown>

type AttributeValue = {
  attribute_value_id: number
  attribute_value: string
  attribute_value_en: string | null
}

type RequiredAttribute = {
  category_id: number
  product_type_id: number
  attribute_id: number
  attribute_name: string
  attribute_name_en: string | null
  attribute_type: number | null
  attribute_mode: number | null
  values_count: number
  sample_values_json: string
  values: AttributeValue[]
}

type FillField = {
  key: string
  label: string
  value: string | number | null
  source: string
  status: "READY" | "MISSING" | "NEEDS_AI" | "WARNING"
  confidence?: number | null
  note?: string | null
  options?: AttributeValue[]
}

type FieldGroup = {
  group: string
  fields: FillField[]
}

type ReadinessRow = {
  spu_code: string
  spu_name: string | null
  title_cn: string | null
  title_en: string | null
  brand_name: string | null
  category: {
    category_id: number | null
    product_type_id: number | null
    category_name: string | null
    path: string | null
    source: string
    status: string
  }
  skcs: SourceRow[]
  sku_count: number
  completeness: number
  ready_field_count: number
  total_field_count: number
  missing_field_count: number
  needs_ai_count: number
  field_groups: FieldGroup[]
  manual_fields: FillField[]
  blocking_issues: string[]
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function compactText(value: unknown, maxLength = 180) {
  const text = normalizeText(value).replace(/\s+/g, " ")
  if (!text) return ""
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object") return value as Record<string, unknown>
  if (typeof value !== "string" || !value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
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

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildMatchKey(row: SourceRow) {
  return [
    normalizeText(row.middle_class_name),
    normalizeText(row.subclass_name),
    normalizeText(row.gender_name),
    normalizeText(row.age_group_name),
  ].join("|")
}

function buildScopeKey({
  spuCode,
  skcCode,
  skuCode,
  fieldKey,
}: {
  spuCode: string
  skcCode?: string | null
  skuCode?: string | null
  fieldKey: string
}) {
  return [
    `spu:${spuCode}`,
    skcCode ? `skc:${skcCode}` : "skc:*",
    skuCode ? `sku:${skuCode}` : "sku:*",
    `field:${fieldKey}`,
  ].join("|")
}

function activeFillMap(db: ReturnType<typeof getDb>, spuCodes: string[]) {
  if (spuCodes.length === 0) return new Map<string, SourceRow>()
  const placeholders = spuCodes.map(() => "?").join(",")
  const rows = db.prepare(`
    select *
    from listing_field_fill
    where status = 'ACTIVE'
      and spu_code in (${placeholders})
  `).all(...spuCodes) as SourceRow[]
  return new Map(rows.map((row) => [String(row.scope_key), row]))
}

function getStoredFill(
  fills: Map<string, SourceRow>,
  spuCode: string,
  fieldKey: string,
  skcCode?: string | null,
  skuCode?: string | null,
) {
  return fills.get(buildScopeKey({ spuCode, skcCode, skuCode, fieldKey }))
    ?? fills.get(buildScopeKey({ spuCode, fieldKey }))
    ?? null
}

function productRows(db: ReturnType<typeof getDb>, q?: string, batchSearch?: string) {
  const clauses: string[] = ["1=1"]
  const params: unknown[] = []
  const terms = batchTerms(batchSearch)
  if (q?.trim()) terms.push(q.trim())
  if (terms.length > 0) {
    clauses.push(`(${terms.map(() =>
      "(spu.spu_code like ? or spu.spu_name like ? or pkg.title like ? or skc.skc_code like ?)",
    ).join(" or ")})`)
    for (const term of terms) {
      const like = `%${term}%`
      params.push(like, like, like, like)
    }
  }

  return db.prepare(`
    select distinct
      spu.*,
      pkg.id as content_package_id,
      pkg.title as deepdraw_title,
      pkg.brand_name as deepdraw_brand_name,
      pkg.category_name as deepdraw_category_name,
      pkg.trade_path as deepdraw_trade_path,
      pkg.primary_color as deepdraw_primary_color,
      matched_rule.id as matched_category_rule_id,
      matched_rule.source as matched_category_rule_source,
      matched_rule.shein_category_id as matched_shein_category_id,
      matched_rule.shein_product_type_id as matched_shein_product_type_id,
      matched_category.category_name as matched_shein_category_name,
      matched_category.path as matched_shein_category_path,
      ai_suggestion.shein_category_id as suggested_shein_category_id,
      ai_suggestion.shein_product_type_id as suggested_shein_product_type_id,
      suggested_category.category_name as suggested_shein_category_name,
      suggested_category.path as suggested_shein_category_path
    from product_spu spu
    left join product_content_package pkg on pkg.spu_code = spu.spu_code
    left join product_skc skc on skc.spu_id = spu.id
    left join mdm_shein_category_mapping_rule matched_rule
      on matched_rule.status = 'ACTIVE'
      and (
        (
          matched_rule.match_mode = 'EXACT'
          and matched_rule.match_key = (
            coalesce(spu.middle_class_name, '') || '|' ||
            coalesce(spu.subclass_name, '') || '|' ||
            coalesce(spu.gender_name, '') || '|' ||
            coalesce(spu.age_group_name, '')
          )
        )
        or (
          matched_rule.match_mode = 'FALLBACK'
          and matched_rule.mdm_small_category_name = coalesce(spu.subclass_name, '')
        )
      )
    left join v_shein_leaf_category matched_category
      on matched_category.category_id = matched_rule.shein_category_id
      and matched_category.product_type_id = matched_rule.shein_product_type_id
    left join mdm_shein_category_ai_suggestion ai_suggestion
      on ai_suggestion.review_status in ('PENDING', 'CONFIRMED')
      and ai_suggestion.match_key = (
        coalesce(spu.middle_class_name, '') || '|' ||
        coalesce(spu.subclass_name, '') || '|' ||
        coalesce(spu.gender_name, '') || '|' ||
        coalesce(spu.age_group_name, '')
      )
    left join v_shein_leaf_category suggested_category
      on suggested_category.category_id = ai_suggestion.shein_category_id
      and suggested_category.product_type_id = ai_suggestion.shein_product_type_id
    where ${clauses.join(" and ")}
    order by spu.spu_code
    limit 200
  `).all(...params) as SourceRow[]
}

function getProductFields(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return new Map<string, string>()
  const rows = db.prepare(`
    select field_name, value_text
    from product_content_field
    where content_package_id = ?
    order by is_key desc, field_name
  `).all(contentPackageId) as SourceRow[]

  const map = new Map<string, string>()
  for (const row of rows) {
    const name = normalizeText(row.field_name)
    const value = normalizeText(row.value_text)
    if (!name || !value || map.has(name)) continue
    map.set(name, value)
  }
  return map
}

function firstField(fields: Map<string, string>, names: string[]) {
  for (const name of names) {
    const exact = fields.get(name)
    if (exact) return exact
  }
  for (const [name, value] of fields) {
    if (names.some((needle) => name.includes(needle))) return value
  }
  return ""
}

function getSkcs(db: ReturnType<typeof getDb>, spuId: unknown) {
  if (!spuId) return []
  return db.prepare(`
    select
      skc.*,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = skc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR_BLOCK'
          and asset.picture_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_image_url,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = skc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_url,
      (
        select count(*)
        from product_sku sku
        where sku.skc_id = skc.id
      ) as sku_count
    from product_skc skc
    where skc.spu_id = ?
    order by skc.skc_code
  `).all(spuId) as SourceRow[]
}

function getContentSkcs(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return []
  return db.prepare(`
    select
      cskc.id,
      cskc.spu_code,
      cskc.skc_code,
      null as skc_name,
      null as color_code,
      cskc.color_name,
      null as pic_url,
      cskc.sku_count,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = cskc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR_BLOCK'
          and asset.picture_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_image_url,
      (
        select asset.normalized_url
        from product_asset asset
        where asset.skc_code = cskc.skc_code
          and asset.source_kind = 'PICTURE'
          and asset.place = 'TMALL'
          and asset.asset_type = 'COLOR'
          and coalesce(asset.normalized_url, '') <> ''
        order by coalesce(asset.sort_no, 999999), asset.id
        limit 1
      ) as tmall_color_url
    from product_content_skc cskc
    where cskc.content_package_id = ?
    order by cskc.skc_code
  `).all(contentPackageId) as SourceRow[]
}

function getSkus(db: ReturnType<typeof getDb>, spuId: unknown) {
  if (!spuId) return []
  return db.prepare(`
    select sku.*, skc.skc_code
    from product_sku sku
    join product_skc skc on skc.id = sku.skc_id
    where skc.spu_id = ?
    order by skc.skc_code, sku.size_code, sku.sku_code
  `).all(spuId) as SourceRow[]
}

function getContentSkus(db: ReturnType<typeof getDb>, contentPackageId: unknown) {
  if (!contentPackageId) return []
  return db.prepare(`
    select
      csku.id,
      csku.spu_code,
      csku.skc_code,
      csku.sku_code,
      null as sku_name,
      csku.size_code,
      csku.size_name,
      null as shein_size_name,
      csku.barcode as ean_code,
      csku.seller_code as inner_code,
      csku.seller_code as supplier_product_code,
      csku.price as price_tag,
      null as supply_price_cny,
      null as suggested_retail_price_usd,
      null as gross_weight_g,
      null as supply_discount,
      null as package_size_text,
      null as status_name
    from product_content_sku csku
    where csku.content_package_id = ?
    order by csku.skc_code, csku.size_code, csku.sku_code
  `).all(contentPackageId) as SourceRow[]
}

function sizeKeys(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return []
  const keys = new Set<string>([raw])
  const digits = raw.match(/\d+/)?.[0] ?? ""
  if (digits) {
    keys.add(digits)
    keys.add(digits.padStart(3, "0"))
  }
  if (raw.toLowerCase().endsWith("cm")) {
    const withoutCm = raw.replace(/cm$/i, "")
    keys.add(withoutCm)
    keys.add(withoutCm.padStart(3, "0"))
  }
  return [...keys].filter(Boolean)
}

function activeSizeConversions(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from size_conversion_rule
    where platform = 'SHEIN'
      and status = 'ACTIVE'
  `).all() as SourceRow[]
  const byCode = new Map<string, SourceRow>()
  const byName = new Map<string, SourceRow>()
  for (const row of rows) {
    for (const code of sizeKeys(row.local_size_code)) byCode.set(code, row)
    for (const name of sizeKeys(row.local_size_name)) byName.set(name, row)
  }
  return { rows, byCode, byName }
}

function activeDiscounts(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from supply_discount_rule
    where status = 'ACTIVE'
  `).all() as SourceRow[]
  return new Map(rows.map((row) => [String(row.spu_code), row]))
}

function activeWeights(db: ReturnType<typeof getDb>) {
  const rows = db.prepare(`
    select *
    from product_weight_import
    order by created_at desc, id desc
  `).all() as SourceRow[]
  const map = new Map<string, SourceRow>()
  for (const row of rows) {
    for (const key of [
      normalizeText(row.sku_code) ? `sku:${normalizeText(row.sku_code)}` : "",
      normalizeText(row.skc_code) ? `skc:${normalizeText(row.skc_code)}` : "",
      normalizeText(row.spu_code) ? `spu:${normalizeText(row.spu_code)}` : "",
    ]) {
      if (key && !map.has(key)) map.set(key, row)
    }
  }
  return map
}

function fallbackCategory(row: SourceRow) {
  const text = [
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.deepdraw_category_name,
    row.deepdraw_title,
  ].map(normalizeText).join(" ")
  const gender = normalizeText(row.gender_name)
  if (text.includes("衬衫")) {
    return {
      category_id: 2062,
      product_type_id: 7403,
      category_name: "女童（小）衬衫",
      path: "儿童 > 女童（小）服装 > 女童（小）上衣 > 女童（小）衬衫",
      source: "RULE_FALLBACK",
      status: "READY",
    }
  }
  if (text.includes("连衣裙")) {
    return {
      category_id: 2063,
      product_type_id: 5926,
      category_name: "女童（小）连衣裙",
      path: "儿童 > 女童（小）服装 > 女童（小）连衣裙",
      source: "RULE_FALLBACK",
      status: "READY",
    }
  }
  if (text.includes("开襟") || text.includes("毛衫") || text.includes("毛衣")) {
    const male = gender.includes("男")
    return {
      category_id: male ? 2499 : 2508,
      product_type_id: male ? 9343 : 9344,
      category_name: male ? "男童（小）开襟衫" : "女童（小）开襟衫",
      path: male
        ? "儿童 > 男童（小）服装 > 男童（小）针织衫 > 男童（小）开襟衫"
        : "儿童 > 女童（小）服装 > 女童（小）针织衫 > 女童（小）开襟衫",
      source: "RULE_FALLBACK",
      status: gender.includes("中性") ? "NEEDS_SKC_REVIEW" : "READY",
    }
  }
  return {
    category_id: null,
    product_type_id: null,
    category_name: null,
    path: null,
    source: "MISSING",
    status: "MISSING",
  }
}

function resolveCategory(row: SourceRow) {
  if (row.matched_shein_category_id && row.matched_shein_product_type_id) {
    return {
      category_id: Number(row.matched_shein_category_id),
      product_type_id: Number(row.matched_shein_product_type_id),
      category_name: normalizeText(row.matched_shein_category_name),
      path: normalizeText(row.matched_shein_category_path),
      source: normalizeText(row.matched_category_rule_source) || "CATEGORY_RULE",
      status: "READY",
    }
  }
  if (row.suggested_shein_category_id && row.suggested_shein_product_type_id) {
    return {
      category_id: Number(row.suggested_shein_category_id),
      product_type_id: Number(row.suggested_shein_product_type_id),
      category_name: normalizeText(row.suggested_shein_category_name),
      path: normalizeText(row.suggested_shein_category_path),
      source: "AI_CATEGORY",
      status: "NEEDS_REVIEW",
    }
  }
  return fallbackCategory(row)
}

function getRequiredAttributes(
  db: ReturnType<typeof getDb>,
  categoryId: number | null,
  productTypeId: number | null,
) {
  if (!categoryId || !productTypeId) return []
  const rows = db.prepare(`
    select *
    from channel_required_attribute
    where platform = 'SHEIN'
      and category_id = ?
      and product_type_id = ?
    order by attribute_type, attribute_id
  `).all(categoryId, productTypeId) as SourceRow[]

  const valueStmt = db.prepare(`
    select attribute_value_id, attribute_value, attribute_value_en
    from channel_attribute_value
    where platform = 'SHEIN'
      and product_type_id = ?
      and attribute_id = ?
      and coalesce(is_black, 0) = 0
    order by is_show desc, attribute_value
    limit 120
  `)

  return rows.map((row) => ({
    category_id: Number(row.category_id),
    product_type_id: Number(row.product_type_id),
    attribute_id: Number(row.attribute_id),
    attribute_name: normalizeText(row.attribute_name),
    attribute_name_en: row.attribute_name_en ? String(row.attribute_name_en) : null,
    attribute_type: asNumber(row.attribute_type),
    attribute_mode: asNumber(row.attribute_mode),
    values_count: Number(row.values_count ?? 0),
    sample_values_json: normalizeText(row.sample_values_json),
    values: valueStmt.all(productTypeId, Number(row.attribute_id)) as AttributeValue[],
  })) as RequiredAttribute[]
}

function findEnumValue(values: AttributeValue[], needles: string[]) {
  const normalized = needles.map((item) => normalizeText(item)).filter(Boolean)
  for (const needle of normalized) {
    const exact = values.find((value) => value.attribute_value === needle)
    if (exact) return exact.attribute_value
  }
  for (const needle of normalized) {
    const contains = values.find((value) => value.attribute_value.includes(needle))
    if (contains) return contains.attribute_value
  }
  return ""
}

function inferMaterialValue(attr: RequiredAttribute, context: string) {
  const needles: string[] = []
  if (/棉/.test(context)) needles.push("棉")
  if (/聚酯|涤纶/.test(context)) needles.push("聚酯纤维")
  if (/粘纤|粘胶/.test(context)) needles.push("粘胶纤维", "粘纤")
  if (/腈纶/.test(context)) needles.push("腈纶")
  if (/锦纶|尼龙/.test(context)) needles.push("锦纶")
  if (/氨纶/.test(context)) needles.push("氨纶")
  return findEnumValue(attr.values, needles)
}

function inferAttributeValue({
  attr,
  row,
  fields,
}: {
  attr: RequiredAttribute
  row: SourceRow
  fields: Map<string, string>
}) {
  const name = attr.attribute_name
  const context = [
    row.spu_name,
    row.deepdraw_title,
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.fabric_type_name,
    row.model_name,
    row.length_name,
    row.composition,
    firstField(fields, ["材质成分", "25面料成分", "材质", "面料", "详情页面料"]),
    firstField(fields, ["图案", "风格", "厚薄", "25弹力指数", "25厚薄指数"]),
  ].map(normalizeText).join(" ")

  if (name === "尺寸") return ""
  if (name.includes("成分") || name.includes("材质")) {
    return inferMaterialValue(attr, context)
  }
  if (name.includes("织造方式")) {
    if (context.includes("梭织")) return findEnumValue(attr.values, ["梭织"])
    if (context.includes("针织") || context.includes("毛织") || context.includes("毛衫")) {
      return findEnumValue(attr.values, ["针织"])
    }
  }
  if (name.includes("袖长")) {
    if (context.includes("长袖") || context.includes("开襟")) return findEnumValue(attr.values, ["长袖"])
    if (context.includes("短袖")) return findEnumValue(attr.values, ["短袖"])
    if (context.includes("无袖")) return findEnumValue(attr.values, ["无袖"])
  }
  if (name.includes("护理")) {
    return findEnumValue(attr.values, ["可机洗,不可干洗", "手洗,不可干洗", "机洗", "手洗"])
  }
  if (name.includes("数量")) {
    return findEnumValue(attr.values, ["件", "1件"])
  }
  if (name.includes("关税")) {
    if (context.includes("连衣裙")) return findEnumValue(attr.values, ["连衣裙", "未列明关税种类"])
    if (context.includes("衬衫")) return findEnumValue(attr.values, ["休闲衬衫", "衬衫", "未列明关税种类"])
    if (context.includes("开襟") || context.includes("毛衫")) {
      return findEnumValue(attr.values, ["开襟衫", "毛衣", "未列明关税种类"])
    }
    return findEnumValue(attr.values, ["未列明关税种类"])
  }
  if (name.includes("加绒")) {
    return findEnumValue(attr.values, [context.includes("加绒") ? "是" : "否"])
  }
  if (name.includes("透明")) {
    return findEnumValue(attr.values, [context.includes("透明") ? "是" : "否"])
  }
  if (name.includes("深浅撞色")) {
    return findEnumValue(attr.values, [context.includes("撞色") ? "是" : "否"])
  }
  if (name.includes("面料弹性")) {
    return findEnumValue(attr.values, [
      context.includes("高弹") ? "高弹" : "",
      context.includes("弹") && !context.includes("无弹") ? "中弹" : "无弹",
      "低弹",
    ])
  }
  if (name.includes("合身") || name.includes("版型")) {
    return findEnumValue(attr.values, [
      context.includes("宽松") ? "宽松" : "",
      context.includes("标准") ? "常规" : "",
      "常规",
    ])
  }
  if (name === "长度") {
    return findEnumValue(attr.values, [
      context.includes("全P") ? "常规" : "",
      "常规",
    ])
  }
  if (name === "年龄") {
    return findEnumValue(attr.values, ["幼童", "婴幼儿", "儿童", "3-7Y"])
  }
  if (name === "所在地") {
    return findEnumValue(attr.values, ["ALL/全球/所有", "All"])
  }
  if (name.includes("企划风格")) {
    return findEnumValue(attr.values, ["Casual休闲", "休闲"])
  }
  if (name.includes("纱线") || name.includes("织法")) {
    return findEnumValue(attr.values, ["其他"])
  }
  if (name.includes("针数")) {
    return findEnumValue(attr.values, ["细针", "粗针", "其他"])
  }
  return ""
}

function packageRule(row: SourceRow) {
  const text = [
    row.middle_class_name,
    row.subclass_name,
    row.fabric_type_name,
    row.deepdraw_title,
    row.length_name,
  ].map(normalizeText).join(" ")
  if (text.includes("鞋")) {
    return { size: "30*20*10cm", length: 30, width: 20, height: 10, type: "硬包装", source: "RULE" }
  }
  if (text.includes("内裤")) {
    return { size: "25*14*2cm", length: 25, width: 14, height: 2, type: "软包装+软物品", source: "RULE" }
  }
  if (text.includes("毛衫") || text.includes("毛衣") || text.includes("厚") || text.includes("外套")) {
    return { size: "35*25*1.5cm", length: 35, width: 25, height: 1.5, type: "软包装+软物品", source: "RULE" }
  }
  return { size: "28*24*1cm", length: 28, width: 24, height: 1, type: "软包装+软物品", source: "RULE" }
}

function fieldStatus(value: unknown, fallback: FillField["status"] = "READY") {
  return normalizeText(value) ? fallback : "MISSING"
}

function buildRow({
  db,
  row,
  sizeConversions,
  discounts,
  weights,
  fills,
}: {
  db: ReturnType<typeof getDb>
  row: SourceRow
  sizeConversions: ReturnType<typeof activeSizeConversions>
  discounts: Map<string, SourceRow>
  weights: Map<string, SourceRow>
  fills: Map<string, SourceRow>
}): ReadinessRow {
  const spuCode = String(row.spu_code)
  const fields = getProductFields(db, row.content_package_id)
  const mdmSkcs = getSkcs(db, row.id)
  const mdmSkus = getSkus(db, row.id)
  const skcs = mdmSkcs.length ? mdmSkcs : getContentSkcs(db, row.content_package_id)
  const skus = mdmSkus.length ? mdmSkus : getContentSkus(db, row.content_package_id)
  const category = resolveCategory(row)
  const attrs = getRequiredAttributes(db, category.category_id, category.product_type_id)
  const discountRule = discounts.get(spuCode)
  const discount = Number(discountRule?.discount ?? 0.4)
  const priceTag = Number(row.price_tag ?? 0)
  const costPrice = priceTag > 0 ? Number((priceTag * discount).toFixed(2)) : null
  const retailUsd = priceTag > 0 ? Math.round(priceTag / 7.3) : null
  const pkg = packageRule(row)
  const titleCn = normalizeText(row.deepdraw_title) || normalizeText(row.listing_title_cn) || normalizeText(row.spu_name)
  const storedTitleEn = getStoredFill(fills, spuCode, "title_en")
  const titleEn = normalizeText(storedTitleEn?.field_value) || normalizeText(row.listing_title_en)
  const compositionText = firstField(fields, ["材质成分", "25面料成分", "详情页面料", "材质"])
  const weightCoverage = skus.filter((sku) =>
    weights.has(`sku:${normalizeText(sku.sku_code)}`)
    || weights.has(`skc:${normalizeText(sku.skc_code)}`)
    || weights.has(`spu:${spuCode}`),
  ).length
  const sizeCoverage = skus.filter((sku) => {
    const codeKeys = sizeKeys(sku.size_code)
    const nameKeys = sizeKeys(sku.size_name)
    return codeKeys.some((key) => sizeConversions.byCode.has(key) || sizeConversions.byName.has(key))
      || nameKeys.some((key) => sizeConversions.byCode.has(key) || sizeConversions.byName.has(key))
  }).length
  const imageCoverage = skcs.filter((skc) =>
    normalizeText(skc.tmall_color_image_url) || normalizeText(skc.tmall_color_url) || normalizeText(skc.pic_url),
  ).length

  const baseFields: FillField[] = [
    {
      key: "category",
      label: "SHEIN 类目",
      value: category.category_name,
      source: category.source,
      status: category.category_id ? (category.status === "READY" ? "READY" : "WARNING") : "MISSING",
      note: category.path,
    },
    { key: "title_cn", label: "中文标题", value: titleCn, source: "DEEPDRAW", status: fieldStatus(titleCn) },
    {
      key: "title_en",
      label: "英文标题",
      value: titleEn,
      source: storedTitleEn ? String(storedTitleEn.source ?? "MANUAL") : "AI/人工",
      status: titleEn ? "READY" : "NEEDS_AI",
      note: titleEn ? null : "深绘英文标题为空，可由 AI 基于中文标题生成",
    },
    { key: "brand", label: "商品品牌", value: row.deepdraw_brand_name ?? row.brand_name, source: "MDM/DEEPDRAW", status: fieldStatus(row.deepdraw_brand_name ?? row.brand_name) },
    { key: "product_line", label: "产品线描述", value: row.product_line_name, source: "MDM", status: fieldStatus(row.product_line_name) },
    { key: "gender", label: "性别描述", value: row.gender_name, source: "MDM", status: fieldStatus(row.gender_name) },
    { key: "season", label: "季节描述", value: row.season_name, source: "MDM", status: fieldStatus(row.season_name) },
    { key: "middle_class", label: "中类描述", value: row.middle_class_name, source: "MDM", status: fieldStatus(row.middle_class_name) },
    { key: "subclass", label: "小类描述", value: row.subclass_name, source: "MDM", status: fieldStatus(row.subclass_name) },
    { key: "fabric_type", label: "面种描述", value: row.fabric_type_name, source: "MDM", status: fieldStatus(row.fabric_type_name) },
  ]

  const skuFields: FillField[] = [
    {
      key: "skc_code",
      label: "SKC 编码",
      value: `${skcs.length} 个款色`,
      source: "MDM",
      status: skcs.length > 0 ? "READY" : "MISSING",
    },
    {
      key: "skc_image",
      label: "SKC 图片",
      value: `${imageCoverage}/${skcs.length}`,
      source: "TMALL COLOR_BLOCK/COLOR",
      status: imageCoverage === skcs.length && skcs.length > 0 ? "READY" : "MISSING",
      note: "优先使用 TMALL 款色图，避免取错模特图",
    },
    {
      key: "color",
      label: "颜色编码/描述",
      value: skcs.map((skc) => `${normalizeText(skc.color_code)} ${normalizeText(skc.color_name)}`.trim()).join(" | "),
      source: "MDM",
      status: skcs.some((skc) => normalizeText(skc.color_name)) ? "READY" : "MISSING",
    },
    {
      key: "size_conversion",
      label: "SHEIN尺码-录入",
      value: `${sizeCoverage}/${skus.length}`,
      source: "尺码转换规则",
      status: sizeCoverage === skus.length && skus.length > 0 ? "READY" : "MISSING",
    },
    {
      key: "supplier_sku",
      label: "商家 SKU/企业码",
      value: `${skus.filter((sku) => normalizeText(sku.inner_code) || normalizeText(sku.supplier_product_code) || normalizeText(sku.sku_code)).length}/${skus.length}`,
      source: "MDM",
      status: skus.length > 0 ? "READY" : "MISSING",
    },
  ]

  const priceFields: FillField[] = [
    { key: "list_price", label: "挂牌单价", value: priceTag || null, source: "MDM", status: priceTag > 0 ? "READY" : "MISSING" },
    {
      key: "supply_discount",
      label: "供货折扣",
      value: discount,
      source: discountRule ? "低倍率清单" : "默认规则",
      status: discountRule ? "WARNING" : "READY",
      note: discountRule ? "命中低倍率清单" : "默认 0.4",
    },
    { key: "supply_price", label: "供货价(人民币)", value: costPrice, source: "公式", status: costPrice ? "READY" : "MISSING" },
    { key: "retail_usd", label: "建议零售价(美元)", value: retailUsd, source: "公式", status: retailUsd ? "READY" : "MISSING", note: "Round(挂牌单价/7.3,0)" },
    { key: "package_size", label: "含包装尺寸", value: pkg.size, source: pkg.source, status: "READY", note: pkg.type },
    {
      key: "package_weight",
      label: "产品毛重/g",
      value: `${weightCoverage}/${skus.length}`,
      source: "产品毛重报表",
      status: weightCoverage === skus.length && skus.length > 0 ? "READY" : "MISSING",
      note: "当前观远 BI 毛重报表未导入，可先人工补齐或等待表格",
    },
  ]

  const attributeFields: FillField[] = attrs.map((attr) => {
    const key = `attr:${attr.attribute_id}`
    const stored = getStoredFill(fills, spuCode, key)
    if (stored) {
      return {
        key,
        label: attr.attribute_name,
        value: stored.field_value == null ? null : String(stored.field_value),
        source: String(stored.source ?? "MANUAL"),
        status: "READY",
        confidence: stored.confidence == null ? null : Number(stored.confidence),
        options: attr.values.slice(0, 24),
      }
    }

    if (attr.attribute_name === "尺寸" && sizeCoverage === skus.length && skus.length > 0) {
      return {
        key,
        label: attr.attribute_name,
        value: `${sizeCoverage}/${skus.length} SKU 已匹配`,
        source: "尺码转换规则",
        status: "READY",
        confidence: 1,
        note: "尺寸销售属性由 SKU 级 SHEIN 尺码转换填充",
        options: attr.values.slice(0, 24),
      }
    }

    const inferred = inferAttributeValue({ attr, row, fields })
    if (inferred) {
      const source = attr.attribute_name.includes("织造方式")
        ? "MDM"
        : attr.attribute_name.includes("成分") || attr.attribute_name.includes("材质")
          ? "DEEPDRAW"
          : "RULE"
      return {
        key,
        label: attr.attribute_name,
        value: inferred,
        source,
        status: "READY",
        confidence: 0.72,
        options: attr.values.slice(0, 24),
      }
    }

    return {
      key,
      label: attr.attribute_name,
      value: null,
      source: "AI/人工",
      status: attr.attribute_name === "尺寸" ? "MISSING" : "NEEDS_AI",
      note: attr.attribute_name === "尺寸"
        ? "由 SKU 尺码转换明细补齐"
        : "需要结合商品档案和枚举值判断",
      options: attr.values.slice(0, 24),
    }
  })

  const contentFields: FillField[] = [
    {
      key: "composition_text",
      label: "成分来源",
      value: compactText(compositionText, 120),
      source: "DEEPDRAW",
      status: compositionText ? "READY" : "MISSING",
    },
    {
      key: "size_chart",
      label: "尺码表",
      value: fields.size > 0 ? `${fields.size} 个字段` : "深绘尺码表",
      source: "DEEPDRAW",
      status: "READY",
    },
  ]

  const fieldGroups = [
    { group: "基础资料", fields: baseFields },
    { group: "规格与图片", fields: skuFields },
    { group: "价格与包装", fields: priceFields },
    { group: "商品属性", fields: attributeFields },
    { group: "内容资料", fields: contentFields },
  ]

  const allFields = fieldGroups.flatMap((group) => group.fields)
  const ready = allFields.filter((field) => field.status === "READY" || field.status === "WARNING").length
  const missing = allFields.filter((field) => field.status === "MISSING").length
  const needsAi = allFields.filter((field) => field.status === "NEEDS_AI").length
  const blockingIssues = allFields
    .filter((field) => field.status === "MISSING" || field.status === "NEEDS_AI")
    .map((field) => field.label)

  return {
    spu_code: spuCode,
    spu_name: row.spu_name ? String(row.spu_name) : null,
    title_cn: titleCn || null,
    title_en: titleEn || null,
    brand_name: normalizeText(row.deepdraw_brand_name) || normalizeText(row.brand_name) || null,
    category,
    skcs,
    sku_count: skus.length,
    completeness: allFields.length ? Math.round((ready / allFields.length) * 100) : 0,
    ready_field_count: ready,
    total_field_count: allFields.length,
    missing_field_count: missing,
    needs_ai_count: needsAi,
    field_groups: fieldGroups,
    manual_fields: attributeFields.filter((field) => field.status === "NEEDS_AI"),
    blocking_issues: blockingIssues,
  }
}

function buildReadiness(c: { req: { query: (name: string) => string | undefined } }) {
  const db = getDb()
  const rows = productRows(db, c.req.query("q"), c.req.query("batch_search"))
  const spuCodes = rows.map((row) => String(row.spu_code))
  const sizeConversions = activeSizeConversions(db)
  const discounts = activeDiscounts(db)
  const weights = activeWeights(db)
  const fills = activeFillMap(db, spuCodes)

  const items = rows.map((row) =>
    buildRow({
      db,
      row,
      sizeConversions,
      discounts,
      weights,
      fills,
    }),
  )
  const summary = {
    total_products: items.length,
    ready_products: items.filter((item) => item.blocking_issues.length === 0).length,
    needs_ai_products: items.filter((item) => item.needs_ai_count > 0).length,
    blocking_products: items.filter((item) => item.blocking_issues.length > 0).length,
    missing_field_count: items.reduce((sum, item) => sum + item.missing_field_count, 0),
    needs_ai_count: items.reduce((sum, item) => sum + item.needs_ai_count, 0),
    avg_completeness: items.length
      ? Math.round(items.reduce((sum, item) => sum + item.completeness, 0) / items.length)
      : 0,
  }

  return { summary, items }
}

function heuristicEnglishTitle(row: ReadinessRow) {
  const title = normalizeText(row.title_cn || row.spu_name)
  const category = normalizeText(row.category.category_name)
  const colorText = row.skcs.map((skc) => normalizeText(skc.color_name)).filter(Boolean).slice(0, 3).join("/")
  const brand = normalizeText(row.brand_name) || "Balabala"
  let productName = "Kids Clothing"
  if (category.includes("衬衫") || title.includes("衬衫")) productName = "Girls Long Sleeve Shirt"
  else if (category.includes("连衣裙") || title.includes("连衣裙") || title.includes("裙")) productName = "Girls Dress"
  else if (category.includes("开襟") || title.includes("毛衫") || title.includes("毛衣")) productName = "Kids Cardigan Sweater"

  const season = title.includes("夏") ? "Summer" : title.includes("春") ? "Spring" : ""
  return [brand, productName, season, colorText].filter(Boolean).join(" ")
}

function heuristicAiValue(field: FillField, row: ReadinessRow) {
  if (field.key === "title_en") return heuristicEnglishTitle(row)

  const optionValues = (field.options ?? []).map((item) => item.attribute_value)
  const text = [
    row.spu_name,
    row.title_cn,
    row.category.category_name,
    row.skcs.map((skc) => skc.color_name).join(" "),
  ].map(normalizeText).join(" ")

  const pick = (needles: string[]) => findEnumValue(
    (field.options ?? []) as AttributeValue[],
    needles,
  )

  if (field.label.includes("图案")) return pick(["纯色", "条纹", "格子"]) || optionValues[0] || ""
  if (field.label.includes("风格") || field.label.includes("企划")) return pick(["Casual休闲", "休闲"]) || optionValues[0] || ""
  if (field.label.includes("透明")) return pick(["否"])
  if (field.label.includes("加绒")) return pick(["否"])
  if (field.label.includes("撞色")) return pick([text.includes("撞色") ? "是" : "否"])
  if (field.label.includes("年龄")) return pick(["幼童", "儿童", "婴幼儿"])
  if (field.label.includes("所在地")) return pick(["ALL/全球/所有", "All"])
  if (field.label.includes("关税")) {
    if (text.includes("连衣裙")) return pick(["连衣裙", "未列明关税种类"])
    if (text.includes("衬衫")) return pick(["休闲衬衫", "衬衫", "未列明关税种类"])
    return pick(["开襟衫", "毛衣", "未列明关税种类"])
  }
  return optionValues[0] || ""
}

function aiPrompt(row: ReadinessRow) {
  const attributes = row.manual_fields.map((field) => ({
    field_key: field.key,
    field_label: field.label,
    options: (field.options ?? []).map((option) => option.attribute_value).slice(0, 80),
  }))
  return JSON.stringify({
    task: "为 SHEIN 发布前需要人工判断的必填属性选择最合适枚举值",
    output_schema: {
      fills: [
        {
          field_key: "必须等于输入 attributes[].field_key",
          field_label: "字段名",
          field_value: "必须从 options 中选择一个原文值",
          confidence: "0 到 1",
          reason: "一句短理由",
        },
      ],
    },
    rules: [
      "只返回 JSON，不要 Markdown。",
      "不能编造枚举值，只能从对应字段 options 中选择。",
      "如果字段无法可靠判断，选择最保守的通用值并降低 confidence。",
      "童装默认风格可偏休闲；是否类字段没有证据时默认否。",
    ],
    product: {
      spu_code: row.spu_code,
      spu_name: row.spu_name,
      title_cn: row.title_cn,
      title_en: row.title_en,
      category: row.category,
      skcs: row.skcs.map((skc) => ({
        skc_code: skc.skc_code,
        color_name: skc.color_name,
        tmall_color_image_url: skc.tmall_color_image_url ?? skc.tmall_color_url ?? null,
      })),
    },
    attributes,
  }, null, 2)
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

async function callAiFill(row: ReadinessRow) {
  const config = resolveAiConfig()
  if (!config.apiKey || row.manual_fields.length === 0) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
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
          {
            role: "system",
            content: "你是跨境童装 SHEIN 发品属性专家，负责在给定枚举里做保守选择。",
          },
          {
            role: "user",
            content: aiPrompt(row),
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`AI fill failed: HTTP ${response.status}`)
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = payload.choices?.[0]?.message?.content ?? ""
    const json = JSON.parse(extractJsonText(text))
    return Array.isArray(json.fills) ? json.fills : []
  } finally {
    clearTimeout(timeout)
  }
}

function persistFill({
  db,
  spuCode,
  fieldKey,
  fieldLabel,
  fieldValue,
  source,
  confidence,
  payload,
}: {
  db: ReturnType<typeof getDb>
  spuCode: string
  fieldKey: string
  fieldLabel: string
  fieldValue: string
  source: string
  confidence?: number | null
  payload?: unknown
}) {
  const scopeKey = buildScopeKey({ spuCode, fieldKey })
  db.prepare(`
    insert into listing_field_fill (
      scope_key,
      spu_code,
      field_key,
      field_label,
      field_value,
      source,
      confidence,
      status,
      payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(scope_key) do update set
      field_label = excluded.field_label,
      field_value = excluded.field_value,
      source = excluded.source,
      confidence = excluded.confidence,
      status = 'ACTIVE',
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run(
    scopeKey,
    spuCode,
    fieldKey,
    fieldLabel,
    fieldValue,
    source,
    confidence ?? null,
    JSON.stringify(payload ?? {}),
  )
}

prePublish.get("/readiness", (c) => c.json(buildReadiness(c)))

prePublish.post("/field-fills", async (c) => {
  const db = getDb()
  const body = await c.req.json() as {
    spu_code?: string
    skc_code?: string | null
    sku_code?: string | null
    field_key?: string
    field_label?: string
    field_value?: string
    source?: string
    confidence?: number | null
    payload?: unknown
  }
  const spuCode = normalizeText(body.spu_code)
  const fieldKey = normalizeText(body.field_key)
  if (!spuCode || !fieldKey) {
    throw new HTTPException(400, { message: "缺少款号或字段 key" })
  }
  const scopeKey = buildScopeKey({
    spuCode,
    skcCode: body.skc_code,
    skuCode: body.sku_code,
    fieldKey,
  })
  db.prepare(`
    insert into listing_field_fill (
      scope_key,
      spu_code,
      skc_code,
      sku_code,
      field_key,
      field_label,
      field_value,
      source,
      confidence,
      status,
      payload_json,
      updated_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    on conflict(scope_key) do update set
      field_label = excluded.field_label,
      field_value = excluded.field_value,
      source = excluded.source,
      confidence = excluded.confidence,
      status = 'ACTIVE',
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run(
    scopeKey,
    spuCode,
    body.skc_code ?? null,
    body.sku_code ?? null,
    fieldKey,
    normalizeText(body.field_label),
    normalizeText(body.field_value),
    normalizeText(body.source ?? "MANUAL") || "MANUAL",
    body.confidence ?? null,
    JSON.stringify(body.payload ?? {}),
  )
  return c.json({ ok: true, scope_key: scopeKey })
})

prePublish.post("/ai-fill", async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({})) as {
    spu_codes?: string[]
    batch_search?: string
  }
  const query = {
    req: {
      query: (name: string) => {
        if (name === "batch_search") {
          return Array.isArray(body.spu_codes) ? body.spu_codes.join("\n") : body.batch_search
        }
        return undefined
      },
    },
  }
  const readiness = buildReadiness(query)
  const saved: Array<Record<string, unknown>> = []

  for (const row of readiness.items) {
    const titleNeedsAi = row.field_groups
      .flatMap((group) => group.fields)
      .find((field) => field.key === "title_en" && field.status === "NEEDS_AI")
    const fieldsToFill = [
      ...(titleNeedsAi ? [titleNeedsAi] : []),
      ...row.manual_fields,
    ]
    if (fieldsToFill.length === 0) continue
    let aiFills: Array<Record<string, unknown>> = []
    try {
      aiFills = await callAiFill(row) as Array<Record<string, unknown>>
    } catch (error) {
      aiFills = []
    }

    const byKey = new Map(aiFills.map((fill) => [String(fill.field_key), fill]))
    for (const field of fieldsToFill) {
      const aiFill = byKey.get(field.key)
      const candidateValue = normalizeText(aiFill?.field_value)
      const validValues = new Set((field.options ?? []).map((option) => option.attribute_value))
      const fieldValue = field.key === "title_en" && candidateValue
        ? candidateValue
        : candidateValue && validValues.has(candidateValue)
        ? candidateValue
        : heuristicAiValue(field, row)
      if (!fieldValue) continue

      const confidence = Number(aiFill?.confidence)
      persistFill({
        db,
        spuCode: row.spu_code,
        fieldKey: field.key,
        fieldLabel: field.label,
        fieldValue,
        source: aiFill ? "AI_SUGGESTED" : "AI_RULE_FALLBACK",
        confidence: Number.isFinite(confidence) ? confidence : 0.62,
        payload: aiFill ?? { fallback: true },
      })
      saved.push({
        spu_code: row.spu_code,
        field_key: field.key,
        field_label: field.label,
        field_value: fieldValue,
      })
    }
  }

  return c.json({ ok: true, saved_count: saved.length, fills: saved })
})

export default prePublish
