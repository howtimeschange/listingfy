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
  { patterns: [/大衣|外套|coat/i], candidates: ["夹克衫", "防寒夹克", "防风夹克", "防寒大衣", "防风大衣", "无袖大衣", "防寒夹克(填充物)", "防风夹克(填充物)", "防寒大衣(填充物)", "防风大衣(填充物)", "斗篷", "无胎料马甲", "有胎料马甲", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/派克|parka/i], candidates: ["派克大衣", "派克大衣(填充物)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/披肩|披巾|围巾|方巾|shawl|scarf/i], candidates: ["披肩", "披巾", "围巾", "方巾", "小长巾", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/连体衣|连体裤|爬爬服|jumpsuit|bodysuit/i], candidates: ["连衫裤", "紧身连体衫", "连体睡衣裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/上衣/], candidates: ["常规T恤", "非常规T恤", "休闲衬衫", "卫衣", "套头衫", "常规背心", "非常规背心", "吊带背心", "罩衫", "开襟衫", "夹克衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/下装/], candidates: ["无腰带环长裤", "有腰带环长裤", "无腰带环短裤", "有腰带环短裤", "半身裙", "裙裤", "睡裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/卫裤|运动裤/], candidates: ["运动长裤", "无腰带环长裤", "有腰带环长裤", "无腰带环短裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/打底裤|leggings/i], candidates: ["连裤袜", "无腰带环长裤", "有腰带环长裤", "长衬裤", "短衬裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/长裤|裤子|trousers|pants/i], candidates: ["无腰带环长裤", "有腰带环长裤", "运动长裤", "睡裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/短裤|shorts/i], candidates: ["无腰带环短裤", "有腰带环短裤", "睡裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/泳衣|泳装|泳裤|swim/i], candidates: ["连体泳衣", "泳衣上装", "泳裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/潜水服|潜水衣|wetsuit/i], candidates: ["连体泳衣", "泳衣上装", "泳裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/羽绒服|保暖服|防寒服|发热服|降温服/], candidates: ["防寒夹克(填充物)", "防寒大衣(填充物)", "防寒夹克", "防寒大衣", "有胎料马甲", "无胎料马甲", "防风夹克", "防风大衣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/防晒衣|防晒服/], candidates: ["防风夹克", "夹克衫", "开襟衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/睡衣|睡裙|pajama|sleep/i], candidates: ["睡衣上装", "睡裤", "睡裙", "连体睡衣裤", "长睡衣(男式)", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/家居服|居家服/], candidates: ["睡衣上装", "睡裤", "睡裙", "连体睡衣裤", "晨衣", "常规T恤", "套头衫", "无腰带环短裤", "无腰带环长裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/汉服|礼服装/], candidates: ["礼服衬衫", "和服衬衫", "休闲衬衫", "女式长袍", "男式长袍", "连衣裙", "半身裙", "连衫裤", "西服外套", "休闲西服", "帽子", "束发带", "发饰头巾", "腰封", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/绅士服/], candidates: ["休闲西服", "西服外套", "礼服衬衫", "休闲衬衫", "有腰带环长裤", "无腰带环长裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/牛仔上衣/], candidates: ["牛仔衬衫", "休闲衬衫", "夹克衫", "常规T恤", "卫衣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/牛仔裤/], candidates: ["有腰带环长裤", "无腰带环长裤", "护胸背带工装裤", "有腰带环短裤", "无腰带环短裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/牛仔套装|两件套|礼物套装/], candidates: ["牛仔衬衫", "休闲衬衫", "卫衣", "夹克衫", "常规T恤", "无腰带环长裤", "有腰带环长裤", "无腰带环短裤", "有腰带环短裤", "半身裙", "连衣裙", "连衫裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/牛仔/], candidates: ["牛仔衬衫", "休闲衬衫", "夹克衫", "常规T恤", "卫衣", "无腰带环长裤", "有腰带环长裤", "无腰带环短裤", "有腰带环短裤", "半身裙", "裙裤", "连衣裙", "连衫裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/新生儿套装/], candidates: ["连衫裤", "连体睡衣裤", "常规T恤", "卫衣", "套头衫", "无腰带环长裤", "有腰带环长裤", "无腰带环短裤", "有腰带环短裤", "连衣裙", "半身裙", "夹克衫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/造型服|拍摄服装|拍摄道具|造型道具|cosplay|角色扮演/i], candidates: ["角色扮演服装", "斗篷", "紧身连体衫", "连衣裙", "连衫裤", "婴儿帽", "拍摄背景巢", "拍摄背景毯", "装饰贴纸", "摆饰", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/胸罩|内衣|bra|underwear/i], candidates: ["胸罩", "胸罩背心", "三角内裤", "四角内裤", "连体内衣裤", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/靴|boot/i], candidates: ["靴子", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/凉鞋|sandal/i], candidates: ["凉鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/拖鞋|slipper/i], candidates: ["拖鞋", "家居鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/洞洞鞋|乐福鞋|牛津鞋|戏服鞋|溯溪鞋|涉水鞋|雨鞋|带轮运动鞋|鞋垫|脚长测量器|鞋装饰/], candidates: ["休闲鞋", "单鞋", "凉鞋", "家居鞋", "拖鞋", "沙滩鞋", "沙滩袜", "雨靴", "轮滑鞋", "量脚器", "脚部防护垫", "鞋靴装饰小件", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/平底鞋|运动鞋|单鞋|休闲鞋|shoe/i], candidates: ["单鞋", "休闲鞋", "凉鞋", "拖鞋", "家居鞋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/袜|打底袜|sock|pantyhose/i], candidates: ["袜子", "连裤袜", "护腿", "腿套", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/背包|双肩包|backpack/i], candidates: ["双肩包", "单肩包", "托特包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/单肩包|shoulder/i], candidates: ["单肩包", "斜挎包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手提包|handbag/i], candidates: ["手提包", "托特包", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/妈咪包|妈妈包|午餐包|拉杆包|旅行包|斜肩包|组合包|箱包配件|运动户外包|婴儿车储存/], candidates: ["妈妈包", "双肩包", "单肩包", "斜挎包", "手提包", "托特包", "收纳包", "收纳袋", "行李袋", "饭盒袋", "胸包", "腰包", "臂包", "包肩带", "包饰", "箱包把手", "箱包搭扣", "行李牌", "钥匙扣", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/钱包|卡包|wallet|card/i], candidates: ["钱包", "卡包", "护照夹", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手表|watch/i], candidates: ["手表", "智能手表", "怀表", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手表配件|表带|表扣|表盘/], candidates: ["表带", "表带(非智能手表用)", "表扣", "表盘", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手链|手镯|bracelet/i], candidates: ["手链", "手链套装", "啪啪圈", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/项链|necklace/i], candidates: ["项链", "项链套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/戒指|ring/i], candidates: ["戒指", "戒指套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/胸针|brooch/i], candidates: ["胸针", "胸针套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/耳环|耳饰|earring/i], candidates: ["耳饰", "耳饰套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/脚链|anklet/i], candidates: ["脚链", "脚链套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/珠宝套装|品质珠宝套装|珠宝盒|首饰盒/], candidates: ["首饰盒", "戒指", "手链", "手镯", "耳饰", "耳钉", "项链", "胸针", "脚链", "套盒套装(首饰)", "耳饰套装", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/发饰|发夹|发圈|发箍|hair/i], candidates: ["发饰头巾", "发饰方巾", "发夹", "发圈", "发圈套装", "发箍", "束发带", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/美发工具|编发器|发刷|发卡|梳子|卷发棒/], candidates: ["发刷", "发卡", "发圈", "发圈套装", "发夹", "发箍", "梳子", "卷发棒", "编发器", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/眼镜|平光镜|护目镜|太阳镜/], candidates: ["普通眼镜", "眼镜架", "太阳镜", "护目镜", "变色眼镜", "装饰眼镜(日常用)", "装饰眼镜(节日用)", "眼镜盒", "眼镜袋", "眼镜链", "眼镜挂绳", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/帽|hat/i], candidates: ["帽子", "婴儿帽", "节日帽", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/口罩|mask/i], candidates: ["口罩", "口罩链", "面罩", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手套|glove/i], candidates: ["手套", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/腰带|belt/i], candidates: ["腰带", "捆绑腰带", "束腰带", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/纽扣|徽章|假领|领结/], candidates: ["钮扣", "胸针", "袖扣", "假领子", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/围兜|口水巾|bib/i], candidates: ["口水巾", "婴儿围兜", "围兜服", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/毯|毛毯|blanket/i], candidates: ["婴儿毯子", "浴巾", "沙滩巾", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/玩具|积木|doll|toy|game/i], candidates: ["益智玩具", "过家家玩具", "积木", "玩偶", "音乐玩具", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/手抓球|摇摆的马|沐浴玩具|室内攀爬|游戏屋|水上玩具|泳池|运动与娱乐装备/], candidates: ["玩具球", "骑行玩具(不带轮)", "骑行玩具(带轮)", "戏水玩具", "玩具泡泡机", "婴儿游戏垫", "攀爬架", "戏水池", "游泳圈", "浮力袖套", "漂浮板", "玩具水枪", "音乐玩具", "护膝", "野餐垫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/收纳|storage/i], candidates: ["收纳包", "收纳袋", "收纳盒", "收纳架", "收纳挂袋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/贴纸|装饰|decoration/i], candidates: ["装饰贴纸", "装饰片", "挂饰", "摆饰", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/桌面配件|绘图用品|装订工具|剪贴压印|绘画用品|艺术周边|书写板|裁切工具/], candidates: ["DIY绘画套装", "学生绘图套装", "画笔", "画纸", "绘画颜料套装", "水彩笔", "蜡笔", "马克笔", "调色盘", "电子写字板", "绘画板", "圆规", "直尺", "订书机", "订书钉", "活页夹", "夹子", "剪刀", "美工刀", "卷笔刀", "手用压印器", "装饰贴纸", "围裙", "袖套", "笔筒", "桌垫", "书写垫板", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/游泳配件|游泳用品|游泳训练|护具套装|运动水壶|运动配件|露营|徒步/], candidates: ["护目镜", "泳帽", "游泳圈", "游泳蹼", "浮力袖套", "漂浮板", "耳塞", "鼻夹", "护膝", "护肘", "护腕", "头盔", "护腿", "护臂", "水瓶", "运动手环", "帐篷", "睡袋", "登山杖", "登山扣", "吊床", "椅子", "雨衣", "手电筒", "头灯", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/安全带|牵引绳|背巾|汽车座椅配件|婴儿车|餐椅|学坐椅|脚踏凳|摇椅|跳跳架|秋千|五斗柜|衣柜|玩具柜|婴儿床/], candidates: ["婴儿背带", "婴儿学步带", "儿童防走失带", "防摔护垫", "安全带垫套", "安全带调节器", "座垫", "椅子", "固定带", "收纳包", "收纳袋", "收纳挂架", "收纳挂袋", "防雨罩", "防尘套", "小风扇", "储物柜", "婴儿窝", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/乳头霜|吸奶器|哺乳|奶瓶|奶粉盒|辅食|餐具|水杯|温奶器|磨牙围嘴|防污罩衣|饱嗝巾/], candidates: ["润肤膏", "手动吸奶器", "电动吸奶器", "哺乳围裙", "护理毯", "围兜服", "保护套", "奶瓶把手", "瓶嘴", "清洁刷", "食物储存盒", "食物储蓄盒", "收纳盒", "杯子", "电热温奶器", "婴儿围兜", "口水巾", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/如厕|座便器|便盆|马桶|防撞|安全门栏|抽屉锁|插座保护盖|睡眠监视器|床护栏|保险杠织物罩/], candidates: ["马桶座垫", "马桶增高垫", "便携厕所", "安全锁扣", "安全扣", "安全盖", "床围栏", "立体防撞贴", "防撞块", "防撞垫", "摄像头", "报警器", "睡眠仪", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/尿布|纸巾|隔尿|尿布桶|湿袋/], candidates: ["一次性纸尿裤", "布尿裤", "隔尿布垫", "一次性隔尿垫", "卫生护理垫", "湿纸巾", "棉签", "收纳桶", "垃圾袋", "收纳包", "收纳袋", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/成长纪念|房地垫|儿童垫|房灯饰|短帷幔|房钟表|健康护理|护理工具|理发器|婴儿秤|耳朵清洁|浴袍|洗澡用品/], candidates: ["相册", "相框", "摆饰", "挂饰", "婴儿游戏垫", "地毯", "座垫", "防撞垫", "装饰灯", "照明灯", "台灯", "窗幔", "挂钟", "闹钟", "鼻吸器", "牙刷", "清洁刷", "指甲钳", "梳子", "电动理发推剪", "电子秤", "耳挖棒", "棉签", "浴衣", "浴巾", "浴帽", "婴儿浴垫", UNSPECIFIED_TARIFF_VALUE] },
  { patterns: [/孕产皮肤护理|孕产监护|哺乳枕|孕妇护理垫/], candidates: ["防妊娠纹霜", "胎心仪", "枕头", "枕套", "手臂席", "袖套", "卫生护理垫", "床褥垫", "颈枕", UNSPECIFIED_TARIFF_VALUE] },
]

const CONTEXT_PREFIX_WORDS = /儿童|婴儿|婴幼儿|婴童|新生儿|青少年|大码|女童|男童|孕产|孕妇|品质|时尚|男式|女式|男|女|大|小/g
const CONTEXT_SUFFIX_WORDS = /(用品|配件|工具|装备|套装|产品|设备|护理|训练|周边|服装|道具|类)$/g
const GENERIC_CONTEXT_TERMS = new Set([
  "儿童",
  "婴儿",
  "婴童",
  "新生儿",
  "青少年",
  "用品",
  "配件",
  "工具",
  "装备",
  "套装",
  "服装",
  "产品",
  "护理",
  "周边",
  "道具",
  "时尚",
  "品质",
])

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

function addContextTerm(terms: Set<string>, value: unknown) {
  const term = normalizeText(value)
  if (!term || term.length < 2 || GENERIC_CONTEXT_TERMS.has(term)) return
  terms.add(term)
}

function tariffContextTerms(value: unknown) {
  const terms = new Set<string>()
  const text = normalizeText(value)
  const parts = text.split(/[>\s,/，、;；|&]+|和|及|与/g)
  for (const part of parts) {
    const stripped = normalizeText(part)
      .replace(/[()（）]/g, "")
      .replace(CONTEXT_PREFIX_WORDS, "")
    addContextTerm(terms, stripped)
    addContextTerm(terms, stripped.replace(CONTEXT_SUFFIX_WORDS, ""))
  }
  return Array.from(terms)
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
  const contextTerms = tariffContextTerms(text).map((term) => compactForMatch(term))
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
      const contextTermMatched = contextTerms.some((term) =>
        term.length >= 2 && (
          valueCompact.includes(term) ||
          englishCompact.includes(term)
        )
      )
      let score = explicitRank.has(item.value) ? 120 + Number(explicitRank.get(item.value)) : 0
      if (valueCompact && compact.includes(valueCompact)) score += 100
      if (englishCompact && compact.includes(englishCompact)) score += 80
      if (coreMatched) score += 45
      if (contextTermMatched) score += 35
      return { ...item, score, index }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.value)
  const hasUnspecified = available.some((item) => item.value === UNSPECIFIED_TARIFF_VALUE)
  return uniqueValues([...scored, ...(hasUnspecified ? [UNSPECIFIED_TARIFF_VALUE] : [])])
}
