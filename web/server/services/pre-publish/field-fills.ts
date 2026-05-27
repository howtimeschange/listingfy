import { normalizeText, parseJsonList } from "./shared"

export type FillFieldLike = {
  render_kind?: string | null
}

export type AttributeValueLike = {
  attribute_value?: string | null
  attribute_value_en?: string | null
}

export function coerceFieldValues(field: FillFieldLike, rawValue: unknown) {
  if (field.render_kind === "multi_enum") {
    const values = parseJsonList(rawValue).map(normalizeText).filter(Boolean)
    return values.length ? values : []
  }
  const value = normalizeText(rawValue)
  return value ? [value] : []
}

export function normalizeMaterialValue(value: unknown) {
  const text = normalizeText(value)
  const compact = text.replace(/\s+/g, "").toLowerCase()
  if (!compact) return ""
  if (compact.includes("棉混纺") || compact.includes("棉混") || compact.includes("cottonblend")) {
    return "织物"
  }
  return text
}

const UNSPECIFIED_TARIFF_VALUE = "未列明关税种类"

const TARIFF_CONTEXT_MATCHERS: Array<{ patterns: RegExp[]; candidates: string[] }> = [
  { patterns: [/T恤/i, /t[\s_-]?shirt/i, /(^|[^a-z])tee([^a-z]|$)/i], candidates: ["常规T恤", "非常规T恤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/POLO/i, /polo/i], candidates: ["POLO衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/卫衣/, /sweatshirt/i], candidates: ["卫衣", "运动衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/运动衫/], candidates: ["运动衫", "卫衣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/连衣裙|裙装/, /dress/i], candidates: ["连衣裙", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/半身裙|短裙/, /skirt/i], candidates: ["半身裙", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/裙裤|裤裙/, /skort/i], candidates: ["裙裤", "半身裙", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/衬衫/, /\b(casual|dress|denim|kimono)\s+shirt\b/i], candidates: ["休闲衬衫", "礼服衬衫", "牛仔衬衫", "和服衬衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/罩衫|blouse/i], candidates: ["罩衫", "休闲衬衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/开襟|开衫|cardigan/i], candidates: ["开襟衫", "毛衣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/毛衣|毛衫|针织衫|sweater/i], candidates: ["毛衣", "开襟衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/背心|吊带|tank/i], candidates: ["常规背心", "非常规背心", "吊带背心", "胸罩背心", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/马甲|vest/i], candidates: ["无胎料马甲", "有胎料马甲", "无袖大衣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/夹克|jacket/i], candidates: ["夹克衫", "防寒夹克", "防风夹克", "防寒夹克(填充物)", "防风夹克(填充物)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/大衣|外套|coat/i], candidates: ["防寒大衣", "防风大衣", "无袖大衣", "防寒大衣(填充物)", "防风大衣(填充物)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/派克|parka/i], candidates: ["派克大衣", "派克大衣(填充物)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/披肩|披巾|围巾|方巾|shawl|scarf/i], candidates: ["披肩", "披巾", "围巾", "方巾", "小长巾", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/连体衣|连体裤|爬爬服|jumpsuit|bodysuit/i], candidates: ["连衫裤", "紧身连体衫", "连体睡衣裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/长裤|裤子|trousers|pants/i], candidates: ["无腰带环长裤", "有腰带环长裤", "运动长裤", "睡裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/短裤|shorts/i], candidates: ["无腰带环短裤", "有腰带环短裤", "睡裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/泳衣|泳装|泳裤|swim/i], candidates: ["连体泳衣", "泳衣上装", "泳裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/睡衣|睡裙|pajama|sleep/i], candidates: ["睡衣上装", "睡裤", "睡裙", "连体睡衣裤", "长睡衣(男式)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/胸罩|内衣|bra|underwear/i], candidates: ["胸罩", "胸罩背心", "三角内裤", "四角内裤", "连体内衣裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/靴|boot/i], candidates: ["靴子", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/凉鞋|sandal/i], candidates: ["凉鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/拖鞋|slipper/i], candidates: ["拖鞋", "家居鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/平底鞋|运动鞋|单鞋|休闲鞋|shoe/i], candidates: ["单鞋", "休闲鞋", "凉鞋", "拖鞋", "家居鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/袜|打底袜|sock|pantyhose/i], candidates: ["袜子", "连裤袜", "护腿", "腿套", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/背包|双肩包|backpack/i], candidates: ["双肩包", "单肩包", "托特包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/单肩包|shoulder/i], candidates: ["单肩包", "斜挎包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手提包|handbag/i], candidates: ["手提包", "托特包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/钱包|卡包|wallet|card/i], candidates: ["钱包", "卡包", "护照夹", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手表|watch/i], candidates: ["手表", "智能手表", "怀表", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手链|手镯|bracelet/i], candidates: ["手链", "手链套装", "啪啪圈", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/项链|necklace/i], candidates: ["项链", "项链套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/戒指|ring/i], candidates: ["戒指", "戒指套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/胸针|brooch/i], candidates: ["胸针", "胸针套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/耳环|耳饰|earring/i], candidates: ["耳饰", "耳饰套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/脚链|anklet/i], candidates: ["脚链", "脚链套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/发饰|发夹|发圈|发箍|hair/i], candidates: ["发饰头巾", "发饰方巾", "发夹", "发圈", "发圈套装", "发箍", "束发带", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/帽|hat/i], candidates: ["帽子", "婴儿帽", "节日帽", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/口罩|mask/i], candidates: ["口罩", "口罩链", "面罩", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手套|glove/i], candidates: ["手套", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/腰带|belt/i], candidates: ["腰带", "捆绑腰带", "束腰带", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/围兜|口水巾|bib/i], candidates: ["口水巾", "婴儿围兜", "围兜服", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/毯|毛毯|blanket/i], candidates: ["婴儿毯子", "浴巾", "沙滩巾", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/玩具|积木|doll|toy|game/i], candidates: ["益智玩具", "过家家玩具", "积木", "玩偶", "音乐玩具", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/收纳|storage/i], candidates: ["收纳包", "收纳袋", "收纳盒", "收纳架", "收纳挂袋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/贴纸|装饰|decoration/i], candidates: ["装饰贴纸", "装饰片", "挂饰", "摆饰", UNSPECIFIED_TARIFF_VALUE] },
]

function tariffValueName(value: unknown) {
  if (typeof value === "string") return normalizeText(value)
  if (value && typeof value === "object") {
    return normalizeText((value as AttributeValueLike).attribute_value)
  }
  return ""
}

function tariffEnglishName(value: unknown) {
  if (value && typeof value === "object") return normalizeText((value as AttributeValueLike).attribute_value_en)
  return ""
}

function compactForMatch(value: unknown) {
  return normalizeText(value).replace(/[\s_\-()（）/]+/g, "").toLowerCase()
}

function tariffCoreTerms(value: string) {
  const cleaned = value
    .replace(UNSPECIFIED_TARIFF_VALUE, "")
    .replace(/常规|非常规|有腰带环|无腰带环|有胎料|无胎料|填充物|男式|女式|儿童|婴儿|婴童/g, "")
    .replace(/[()（）]/g, "")
  return Array.from(new Set([
    cleaned,
    cleaned.replace(/衫$/, ""),
    cleaned.replace(/套装$/, ""),
    cleaned.replace(/包$/, "包"),
  ].map(normalizeText).filter((item) => item.length >= 2)))
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const text = normalizeText(value)
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  })
}

export function tariffValueCandidatesForContext(context: unknown, availableValues?: Array<string | AttributeValueLike>) {
  const text = normalizeText(context)
  const compact = compactForMatch(text)
  const explicitCandidates = TARIFF_CONTEXT_MATCHERS
    .filter((matcher) => matcher.patterns.some((pattern) => pattern.test(text) || pattern.test(compact)))
    .flatMap((matcher) => matcher.candidates)
  const available = (availableValues ?? []).map((value) => ({
    value: tariffValueName(value),
    valueEn: tariffEnglishName(value),
  })).filter((value) => value.value)

  if (available.length === 0) {
    return uniqueValues([...explicitCandidates, UNSPECIFIED_TARIFF_VALUE])
  }

  const explicitRank = new Map(explicitCandidates.map((value, index) => [value, explicitCandidates.length - index]))
  const scored = available
    .filter((item) => item.value !== UNSPECIFIED_TARIFF_VALUE)
    .map((item, index) => {
      const valueCompact = compactForMatch(item.value)
      const englishCompact = compactForMatch(item.valueEn)
      const coreMatched = tariffCoreTerms(item.value).some((term) => compact.includes(compactForMatch(term)))
      let score = explicitRank.has(item.value) ? 120 + Number(explicitRank.get(item.value)) : 0
      if (valueCompact && compact.includes(valueCompact)) score += 100
      if (englishCompact && compact.includes(englishCompact)) score += 80
      if (coreMatched) score += 45
      return { ...item, score, index }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.value)
  const hasUnspecified = available.some((item) => item.value === UNSPECIFIED_TARIFF_VALUE)
  return uniqueValues([...scored, ...(hasUnspecified ? [UNSPECIFIED_TARIFF_VALUE] : [])])
}
