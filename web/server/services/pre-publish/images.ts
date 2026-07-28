import { asPositiveNumber, normalizeText } from "./shared"

export type PictureConfigRow = {
  field_key: string
  is_true: number | boolean | null
}

export type PictureRequirement = {
  key: string
  requirement_key: string
  name: string
  level: "SPU" | "SKC" | "SKU"
  show: number | null
  required: number | null
  single: number | null
  image_type: string
  asset_types: string[]
  max_count: number
  count_rule: string
  dimension_rule: string
  format_rule: string
  size_rule: string
  field_keys: Array<{ field_key: string; is_true: number | null }>
  note: string | null
}

export type PictureCapacityRule = {
  label: string
  asset_types: string[]
  max_count: number
}

export type SheinImageAsset = {
  id?: unknown
  skc_code?: unknown
  asset_type?: unknown
  image_sort?: unknown
  platform_url?: unknown
  source_url?: unknown
  local_path?: unknown
}

export type SheinImageInfoItem = {
  image_sort: number
  image_type: number
  image_url: string
}

export type SheinImageInfo = {
  image_info_list: SheinImageInfoItem[]
}

export type BuildSheinImageInfoInput = {
  skcCode: unknown
  skcImageUrl?: unknown
  allowSourceImages?: boolean
  allowLocalImages?: boolean
  assets: SheinImageAsset[]
}

const MAIN_DETAIL_IMAGE_RULE = {
  dimension_rule: "1340 x 1785 px；或 1:1 且 900-2200 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 8MB",
}

const SQUARE_IMAGE_RULE = {
  dimension_rule: "1:1，900-2200 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 8MB",
}

const SKC_SQUARE_IMAGE_RULE = {
  dimension_rule: "1:1，900-2200 px；或 3:4，宽 900-2200 px（发布时自动居中裁切为方图）",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 8MB",
}

const COLOR_IMAGE_RULE = {
  dimension_rule: "1:1，80 x 80 px",
  format_rule: "JPG / JPEG / PNG",
  size_rule: "≤ 3MB",
}

export function boolConfigValue(value: number | boolean | null | undefined) {
  if (value == null) return null
  return value === true || Number(value) === 1 ? 1 : 0
}

export function buildPictureRequirements(config: PictureConfigRow[]): PictureRequirement[] {
  const configMap = new Map(config.map((item) => [item.field_key, boolConfigValue(item.is_true)]))
  const field = (fieldKey: string) => ({
    field_key: fieldKey,
    is_true: configMap.get(fieldKey) ?? null,
  })
  const boolValue = (fieldKey: string) => configMap.get(fieldKey) ?? null
  const detailCountRule = (single: number | null) => {
    if (single === 1) return "最多 1 张主图"
    return "主图最多 1 张；细节图最多 10 张"
  }
  const detailImageType = (single: number | null) => {
    if (single === 1) return "1-主图"
    return "1-主图；2-细节图"
  }

  const requirements: PictureRequirement[] = [
    {
      key: "spu-detail",
      requirement_key: "SPU_DETAIL",
      name: "SPU 轮播图",
      level: "SPU",
      show: boolValue("spu_image_detail_show"),
      required: boolValue("spu_image_detail_required"),
      single: boolValue("spu_image_detail_single"),
      image_type: detailImageType(boolValue("spu_image_detail_single")),
      asset_types: ["MAIN", "DETAIL", "DETAIL_BACK"],
      max_count: boolValue("spu_image_detail_single") === 1 ? 1 : 11,
      count_rule: detailCountRule(boolValue("spu_image_detail_single")),
      ...MAIN_DETAIL_IMAGE_RULE,
      field_keys: [
        field("spu_image_detail_show"),
        field("spu_image_detail_required"),
        field("spu_image_detail_single"),
      ],
      note: "SPU 维度图片当前按类目规则展示；本流程优先使用 SKC 维度图片。",
    },
    {
      key: "spu-square",
      requirement_key: "SPU_SQUARE",
      name: "SPU 方形图",
      level: "SPU",
      show: boolValue("spu_image_square_show"),
      required: boolValue("spu_image_square_required"),
      single: null,
      image_type: "5-方块图",
      asset_types: ["SQUARE"],
      max_count: 1,
      count_rule: "1 张",
      ...SQUARE_IMAGE_RULE,
      field_keys: [
        field("spu_image_square_show"),
        field("spu_image_square_required"),
      ],
      note: null,
    },
    {
      key: "skc-detail",
      requirement_key: "SKC_DETAIL",
      name: "SKC 主图/细节图",
      level: "SKC",
      show: boolValue("skc_image_detail_show"),
      required: boolValue("skc_image_detail_required"),
      single: boolValue("skc_image_detail_single"),
      image_type: detailImageType(boolValue("skc_image_detail_single")),
      asset_types: ["MAIN", "DETAIL", "DETAIL_BACK"],
      max_count: boolValue("skc_image_detail_single") === 1 ? 1 : 11,
      count_rule: detailCountRule(boolValue("skc_image_detail_single")),
      ...MAIN_DETAIL_IMAGE_RULE,
      field_keys: [
        field("skc_image_detail_show"),
        field("skc_image_detail_required"),
        field("skc_image_detail_single"),
      ],
      note: "主图优先取 TMALL COLOR_BLOCK / COLOR；细节图可人工导入补齐。",
    },
    {
      key: "skc-square",
      requirement_key: "SKC_SQUARE",
      name: "SKC 方形图",
      level: "SKC",
      show: boolValue("skc_image_square_show"),
      required: boolValue("skc_image_square_required"),
      single: null,
      image_type: "5-方块图",
      asset_types: ["SQUARE"],
      max_count: 1,
      count_rule: "1 张",
      ...SKC_SQUARE_IMAGE_RULE,
      field_keys: [
        field("skc_image_square_show"),
        field("skc_image_square_required"),
      ],
      note: null,
    },
    {
      key: "skc-color",
      requirement_key: "SKC_COLOR_BLOCK",
      name: "SKC 色块图",
      level: "SKC",
      show: 1,
      required: null,
      single: 1,
      image_type: "6-色块图",
      asset_types: ["COLOR_BLOCK", "COLOR"],
      max_count: 1,
      count_rule: "每个 SKC 1 张；多 SKC 必填，单 SKC 非必填",
      ...COLOR_IMAGE_RULE,
      field_keys: [],
      note: "是否必填取决于实际勾选发布的 SKC 数量。",
    },
  ]

  if (config.length === 1 && config[0]?.field_key === "switch_spu_picture") {
    return requirements.filter((item) => item.key.startsWith("skc-"))
  }

  return requirements
}

export function imageFileSizeLimitBytes(requirement: PictureRequirement) {
  const match = requirement.size_rule.match(/[≤<]\s*(\d+(?:\.\d+)?)\s*M/i)
  if (!match) return null
  return Math.round(Number(match[1]) * 1024 * 1024)
}

export function canAddImagesToRequirement(
  currentCount: number,
  incomingCount: number,
  requirement: PictureRequirement,
) {
  const current = Math.max(0, Math.floor(Number(currentCount) || 0))
  const incoming = Math.max(0, Math.floor(Number(incomingCount) || 0))
  return incoming > 0 && current + incoming <= requirement.max_count
}

export function pictureCapacityRules(requirement: PictureRequirement): PictureCapacityRule[] {
  const rules: PictureCapacityRule[] = [{
    label: requirement.name,
    asset_types: requirement.asset_types,
    max_count: requirement.max_count,
  }]
  if (requirement.requirement_key.endsWith("_DETAIL") && requirement.single !== 1) {
    rules.push(
      { label: "主图", asset_types: ["MAIN"], max_count: 1 },
      { label: "细节图", asset_types: ["DETAIL", "DETAIL_BACK"], max_count: 10 },
    )
  }
  return rules
}

export function isNearRatio(width: number, height: number, ratio: number, tolerance = 0.08) {
  if (width <= 0 || height <= 0) return false
  return Math.abs(width / height - ratio) <= tolerance
}

export function imageCompliance(asset: Record<string, unknown>, requirement: PictureRequirement) {
  const width = asPositiveNumber(asset.width)
  const height = asPositiveNumber(asset.height)
  const fileSize = asPositiveNumber(asset.file_size)
  const maxSize = imageFileSizeLimitBytes(requirement)
  const failures: string[] = []
  const warnings: string[] = []

  if (width != null && height != null) {
    const square = isNearRatio(width, height, 1, 0.03)
    if (requirement.requirement_key === "SKC_COLOR_BLOCK") {
      if (!square) failures.push("色块图需为 1:1")
      if (width < 80 || height < 80) failures.push("色块图尺寸需不小于 80 x 80")
    } else if (requirement.requirement_key === "SPU_SQUARE") {
      if (!square) failures.push("方形图需为 1:1")
      if (width < 900 || height < 900 || width > 2200 || height > 2200) failures.push("方形图尺寸需在 900-2200 px")
    } else if (requirement.requirement_key === "SKC_SQUARE") {
      const portrait = isNearRatio(width, height, 3 / 4, 0.03)
      if (!square && !portrait) {
        failures.push("SKC 方块图需为 1:1 或 3:4")
      } else if (square && (width < 900 || height < 900 || width > 2200 || height > 2200)) {
        failures.push("SKC 方块图 1:1 图片尺寸需在 900-2200 px")
      } else if (portrait && (width < 900 || width > 2200)) {
        failures.push("SKC 方块图 3:4 图片宽度需在 900-2200 px")
      }
    } else {
      const mainRatioOk = isNearRatio(width, height, 1340 / 1785, 0.08) && width >= 900 && height >= 1200
      const squareOk = square && width >= 900 && height >= 900 && width <= 2200 && height <= 2200
      if (!mainRatioOk && !squareOk) failures.push("主图/细节图需接近 1340 x 1785，或 1:1 且 900-2200 px")
    }
  } else {
    warnings.push("素材库暂缺尺寸信息，需人工预览确认")
  }

  if (maxSize != null && fileSize != null && fileSize > maxSize) failures.push("文件大小超过平台限制")
  if (maxSize != null && fileSize == null) warnings.push("素材库暂缺文件大小信息")

  return {
    compliant: failures.length === 0,
    status: failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    reasons: [...failures, ...warnings],
    file_size_limit_bytes: maxSize,
  }
}

export function inferAssetTypeFromRequirement(requirementKey: unknown, fallbackFileName = "") {
  const key = normalizeText(requirementKey)
  if (key === "SPU_SQUARE" || key === "SKC_SQUARE") return "SQUARE"
  if (key === "SKC_COLOR_BLOCK") return "COLOR_BLOCK"
  if (key === "SPU_DETAIL" || key === "SKC_DETAIL") return classifyImportedImage(fallbackFileName).assetType
  return classifyImportedImage(fallbackFileName).assetType
}

export function classifyImportedImage(fileName: string) {
  const base = fileName.toLowerCase()
  const index = Number(base.match(/_(\d+)\.[a-z0-9]+$/)?.[1] ?? 0)
  if (/square|方形|方图|1x1/.test(base)) {
    return { assetType: "SQUARE", requirementKey: "SKC_SQUARE", sort: index || 1, note: "SKC 方形图，满足类目方形图要求" }
  }
  if (/color[-_ ]?block|色块/.test(base)) {
    return { assetType: "COLOR_BLOCK", requirementKey: "SKC_COLOR_BLOCK", sort: index || 1, note: "SKC 色块图，满足颜色展示要求" }
  }
  if (index === 1) return { assetType: "MAIN", requirementKey: "SKC_DETAIL", sort: 1, note: "SKC 主图/款色图，适合作为当前 SKC 首图" }
  if (index === 2) return { assetType: "DETAIL_BACK", requirementKey: "SKC_DETAIL", sort: 2, note: "背面/整体细节图" }
  return { assetType: "DETAIL", requirementKey: "SKC_DETAIL", sort: index || 99, note: "商品细节图" }
}

export function inferAssetTypeFromLibraryAsset(asset: Record<string, unknown>, requirement: PictureRequirement) {
  const assetType = normalizeText(asset.asset_type).toUpperCase()
  const pictureType = normalizeText(asset.picture_type).toUpperCase()
  const sourceKind = normalizeText(asset.source_kind).toUpperCase()
  if (requirement.requirement_key === "SKC_COLOR_BLOCK") return assetType.includes("COLOR") || pictureType.includes("COLOR") ? "COLOR" : "COLOR_BLOCK"
  if (requirement.requirement_key === "SPU_SQUARE" || requirement.requirement_key === "SKC_SQUARE") return "SQUARE"
  if (assetType.includes("MAIN")) return "MAIN"
  if (assetType.includes("BACK")) return "DETAIL_BACK"
  if (sourceKind.includes("DETAIL") || assetType.includes("DETAIL")) return "DETAIL"
  return requirement.asset_types[0] ?? "DETAIL"
}

function sheinAssetType(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function sheinImagePriority(asset: SheinImageAsset) {
  const type = sheinAssetType(asset.asset_type)
  if (type === "MAIN") return 0
  if (type === "DETAIL" || type === "DETAIL_BACK") return 1
  if (type === "SQUARE") return 2
  if (type === "COLOR_BLOCK" || type === "COLOR") return 3
  return 4
}

export function sheinImageType(assetType: unknown, options: { mainImage?: boolean } = {}) {
  const type = sheinAssetType(assetType)
  if (type === "SQUARE") return 5
  if (type === "COLOR_BLOCK" || type === "COLOR") return 6
  if (type === "MAIN") return options.mainImage === false ? 2 : 1
  return 2
}

function sheinAssetUrl(asset: SheinImageAsset, options: { allowSourceImages: boolean; allowLocalImages: boolean }) {
  return normalizeText(asset.platform_url)
    || (options.allowSourceImages ? normalizeText(asset.source_url) : "")
}

function sheinAssetAvailable(asset: SheinImageAsset, options: { allowSourceImages: boolean; allowLocalImages: boolean }) {
  return Boolean(
    sheinAssetUrl(asset, options)
    || (options.allowLocalImages && normalizeText(asset.local_path)),
  )
}

export function buildSheinImageInfo(input: BuildSheinImageInfoInput): SheinImageInfo {
  const skcCode = normalizeText(input.skcCode)
  const allowSourceImages = Boolean(input.allowSourceImages)
  const allowLocalImages = Boolean(input.allowLocalImages)
  const fallbackImage = normalizeText(input.skcImageUrl)
  const selectedAssets = input.assets
    .filter((asset) => normalizeText(asset.skc_code) === skcCode)
    .filter((asset) => sheinAssetAvailable(asset, { allowSourceImages, allowLocalImages }))
    .sort((left, right) =>
      sheinImagePriority(left) - sheinImagePriority(right)
      || Number(left.image_sort ?? 0) - Number(right.image_sort ?? 0)
      || Number(left.id ?? 0) - Number(right.id ?? 0),
    )

  const hasMainAsset = selectedAssets.some((asset) => sheinAssetType(asset.asset_type) === "MAIN")
  const output: SheinImageInfoItem[] = []
  if (!hasMainAsset && fallbackImage) {
    output.push({ image_sort: 0, image_type: 1, image_url: fallbackImage })
  }

  let usedMain = false
  for (const asset of selectedAssets) {
    const type = sheinAssetType(asset.asset_type)
    const isFirstMain = type === "MAIN" && !usedMain
    if (type === "MAIN") usedMain = true
    output.push({
      image_sort: 0,
      image_type: sheinImageType(type, { mainImage: isFirstMain }),
      image_url: sheinAssetUrl(asset, { allowSourceImages, allowLocalImages }),
    })
  }

  if (fallbackImage && !output.some((image) => Number(image.image_type) === 6)) {
    output.push({ image_sort: 0, image_type: 6, image_url: fallbackImage })
  }

  return {
    image_info_list: output.map((image, index) => ({
      ...image,
      image_sort: index + 1,
    })),
  }
}

export function sheinMainImageError(skcCode: unknown, imageInfo: SheinImageInfo | null | undefined) {
  const count = Array.isArray(imageInfo?.image_info_list)
    ? imageInfo.image_info_list.filter((image) => Number(image.image_type) === 1).length
    : 0
  if (count === 1) return null
  return `${normalizeText(skcCode)} 有且只能有 1 张主图(type=1)，当前为 ${count} 张`
}
