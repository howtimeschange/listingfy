export type CategoryFallbackRow = Record<string, unknown>

export type CategoryFallbackResult = {
  category_id: number | null
  product_type_id: number | null
  category_name: string | null
  path: string | null
  source: string
  status: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function rowText(row: CategoryFallbackRow) {
  return [
    row.middle_class_name,
    row.subclass_name,
    row.gender_name,
    row.age_group_name,
    row.deepdraw_category_name,
    row.deepdraw_title,
    row.spu_name,
    row.spec_range,
    row.model_name,
    row.length_name,
  ].map(normalizeText).join(" ")
}

function inferKidsGender(row: CategoryFallbackRow, text = rowText(row)) {
  const gender = normalizeText(row.gender_name)
  const hasExplicitBoth = /男女童|男童女童|女童男童|boys?\s*(and|&|\/)\s*girls?|girls?\s*(and|&|\/)\s*boys?/i.test(text)
  const hasMale = gender.includes("男") || /男童|男孩|\bboys?\b/i.test(text)
  const hasFemale = gender.includes("女") || /女童|女孩|\bgirls?\b/i.test(text)

  if (hasExplicitBoth || (hasMale && hasFemale)) {
    const lastMale = Math.max(text.lastIndexOf("男童"), text.toLowerCase().lastIndexOf("boy"))
    const lastFemale = Math.max(text.lastIndexOf("女童"), text.toLowerCase().lastIndexOf("girl"))
    return lastMale > lastFemale ? "male" : "female"
  }
  if (hasMale) return "male"
  if (hasFemale) return "female"
  return null
}

function isSmallKidRow(row: CategoryFallbackRow, text: string) {
  const ageGroup = normalizeText(row.age_group_name)
  if (ageGroup.includes("中童") || ageGroup.includes("大童") || text.includes("（大）")) return false
  if (ageGroup.includes("幼童") || ageGroup.includes("婴童")) return true
  return text.includes("幼童")
    || text.includes("婴幼童")
    || text.includes("宝宝")
    || text.includes("小童")
    || text.includes("（小）")
    || /0?(73|80|90)\s*-\s*1[23]0/.test(text)
}

function categoryResult({
  gender,
  small,
  category,
  parent,
  category_id,
  product_type_id,
}: {
  gender: "male" | "female"
  small: boolean
  category: string
  parent: string
  category_id: number
  product_type_id: number
}): CategoryFallbackResult {
  const genderLabel = gender === "male" ? "男童" : "女童"
  const ageLabel = small ? "小" : "大"
  return {
    category_id,
    product_type_id,
    category_name: category,
    path: `儿童 > ${genderLabel}（${ageLabel}）服装 > ${parent} > ${category}`,
    source: "RULE_FALLBACK",
    status: "READY",
  }
}

const KIDS_TSHIRT_CATEGORIES = {
  male: {
    small: { category_id: 2105, product_type_id: 9740, category_name: "男童（小）T恤", parent: "男童（小）上衣" },
    big: { category_id: 1997, product_type_id: 9736, category_name: "男童（大）T恤", parent: "男童（大）上衣" },
  },
  female: {
    small: { category_id: 2116, product_type_id: 9739, category_name: "女童（小）T恤", parent: "女童（小）上衣" },
    big: { category_id: 2013, product_type_id: 9738, category_name: "女童（大）T恤", parent: "女童（大）上衣" },
  },
} as const

function kidsTshirtFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!/t恤/i.test(text)) return null
  const gender = inferKidsGender(row, text)
  if (!gender) return null
  const small = isSmallKidRow(row, text)
  const category = KIDS_TSHIRT_CATEGORIES[gender][small ? "small" : "big"]
  return categoryResult({
    gender,
    small,
    category: category.category_name,
    parent: category.parent,
    category_id: category.category_id,
    product_type_id: category.product_type_id,
  })
}

const KIDS_SWEATSHIRT_CATEGORIES = {
  male: {
    small: { category_id: 2104, product_type_id: 9337, category_name: "男童（小）卫衣" },
    big: { category_id: 1996, product_type_id: 9334, category_name: "男童（大）卫衣" },
  },
  female: {
    small: { category_id: 2113, product_type_id: 9336, category_name: "女童（小）卫衣" },
    big: { category_id: 2011, product_type_id: 9335, category_name: "女童（大）卫衣" },
  },
} as const

function kidsSweatshirtFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!/卫衣|hoodie|sweatshirt/i.test(text)) return null
  if (/套装/.test(text)) return null
  const gender = inferKidsGender(row, text)
  if (!gender) return null
  const small = isSmallKidRow(row, text)
  const category = KIDS_SWEATSHIRT_CATEGORIES[gender][small ? "small" : "big"]
  return categoryResult({
    gender,
    small,
    category: category.category_name,
    parent: category.category_name,
    category_id: category.category_id,
    product_type_id: category.product_type_id,
  })
}

const KIDS_OUTERWEAR_CATEGORIES = {
  male: {
    small: { category_id: 2098, product_type_id: 9339, category_name: "男童（小）外套" },
    big: { category_id: 1990, product_type_id: 9341, category_name: "男童（大）外套" },
  },
  female: {
    small: { category_id: 2064, product_type_id: 9340, category_name: "女童（小）外套" },
    big: { category_id: 2004, product_type_id: 9342, category_name: "女童（大）外套" },
  },
} as const

function kidsOuterwearFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!/外套|夹克|jacket|coat/i.test(text)) return null
  if (/套装/.test(text)) return null
  const gender = inferKidsGender(row, text)
  if (!gender) return null
  const small = isSmallKidRow(row, text)
  const category = KIDS_OUTERWEAR_CATEGORIES[gender][small ? "small" : "big"]
  return categoryResult({
    gender,
    small,
    category: category.category_name,
    parent: category.category_name,
    category_id: category.category_id,
    product_type_id: category.product_type_id,
  })
}

const KIDS_PANTS_CATEGORIES = {
  male: {
    shortsSmall: { category_id: 2103, product_type_id: 1516, category_name: "男童（小）短裤" },
    shortsBig: { category_id: 1995, product_type_id: 1494, category_name: "男童（大）短裤" },
    pantsSmall: { category_id: 2101, product_type_id: 9603, category_name: "男童（小）裤子" },
    pantsBig: { category_id: 1993, product_type_id: 9600, category_name: "男童（大）裤子" },
  },
  female: {
    shortsSmall: { category_id: 2120, product_type_id: 1518, category_name: "女童（小）短裤" },
    shortsBig: { category_id: 2008, product_type_id: 1503, category_name: "女童（大）短裤" },
    pantsSmall: { category_id: 2119, product_type_id: 9602, category_name: "女童（小）长裤" },
    pantsBig: { category_id: 2007, product_type_id: 9601, category_name: "女童（大）长裤" },
  },
} as const

export function kidsPantsFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!/(裤|下装|straight pants|pants|trousers)/i.test(text)) return null
  const gender = inferKidsGender(row, text)
  if (!gender) return null

  const small = isSmallKidRow(row, text)
  const shorts = /短裤|shorts/i.test(text)
  const genderLabel = gender === "male" ? "男童" : "女童"
  const ageLabel = small ? "小" : "大"
  const parent = `${genderLabel}（${ageLabel}）下装`
  const categoryKey = shorts
    ? (small ? "shortsSmall" : "shortsBig")
    : (small ? "pantsSmall" : "pantsBig")
  const category = KIDS_PANTS_CATEGORIES[gender][categoryKey]

  return categoryResult({
    gender,
    small,
    category: category.category_name,
    parent,
    category_id: category.category_id,
    product_type_id: category.product_type_id,
  })
}

function kidsShirtFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!text.includes("衬衫")) return null
  const gender = inferKidsGender(row, text) ?? "female"
  const small = isSmallKidRow(row, text)
  const genderLabel = gender === "male" ? "男童" : "女童"
  const ageLabel = small ? "小" : "大"
  const category = `${genderLabel}（${ageLabel}）衬衫`
  return categoryResult({
    gender,
    small,
    category,
    parent: `${genderLabel}（${ageLabel}）上衣`,
    category_id: gender === "male" ? (small ? 2102 : 1994) : (small ? 2062 : 2009),
    product_type_id: gender === "male" ? (small ? 7405 : 7404) : (small ? 7403 : 7402),
  })
}

function kidsDressFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!text.includes("连衣裙")) return null
  const small = isSmallKidRow(row, text)
  return {
    category_id: small ? 2063 : 2005,
    product_type_id: small ? 5926 : 5925,
    category_name: small ? "女童（小）连衣裙" : "女童（大）连衣裙",
    path: small ? "儿童 > 女童（小）服装 > 女童（小）连衣裙" : "儿童 > 女童（大）服装 > 女童（大）连衣裙",
    source: "RULE_FALLBACK",
    status: "READY",
  }
}

function kidsCardiganFallbackCategory(row: CategoryFallbackRow): CategoryFallbackResult | null {
  const text = rowText(row)
  if (!(text.includes("开襟") || text.includes("毛衫") || text.includes("毛衣"))) return null
  const gender = inferKidsGender(row, text) ?? "female"
  const genderLabel = gender === "male" ? "男童" : "女童"
  return {
    category_id: gender === "male" ? 2499 : 2508,
    product_type_id: gender === "male" ? 9343 : 9344,
    category_name: `${genderLabel}（小）开襟衫`,
    path: `儿童 > ${genderLabel}（小）服装 > ${genderLabel}（小）针织衫 > ${genderLabel}（小）开襟衫`,
    source: "RULE_FALLBACK",
    status: "READY",
  }
}

export function resolveSheinKidsCategoryFallback(row: CategoryFallbackRow): CategoryFallbackResult | null {
  return kidsPantsFallbackCategory(row)
    ?? kidsTshirtFallbackCategory(row)
    ?? kidsSweatshirtFallbackCategory(row)
    ?? kidsOuterwearFallbackCategory(row)
    ?? kidsShirtFallbackCategory(row)
    ?? kidsDressFallbackCategory(row)
    ?? kidsCardiganFallbackCategory(row)
}
