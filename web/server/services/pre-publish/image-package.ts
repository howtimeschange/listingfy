import path from "node:path"

export const MAX_SHEIN_IMAGE_PACKAGE_ENTRIES = 1_000
export const MAX_SHEIN_IMAGE_PACKAGE_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024

export type SheinImagePackageEntry = {
  entry_path: string
  spu_code: string
  skc_code: string
  image_index: number
  extension: ".jpg" | ".jpeg" | ".png"
  uncompressed_size: number
}

export type SheinImagePackageGroup = {
  spu_code: string
  skc_code: string
  entries: SheinImagePackageEntry[]
}

function numericCode(value: string) {
  return /^\d{10,24}$/.test(value)
}

export function parseSheinImagePackageEntry(entryPath: string, uncompressedSize = 0): SheinImagePackageEntry | null {
  const normalizedPath = String(entryPath ?? "").replaceAll("\\", "/")
  if (!normalizedPath || normalizedPath.startsWith("/") || normalizedPath.includes("\0")) return null
  const segments = normalizedPath.split("/").filter(Boolean)
  if (segments.some((segment) => segment === "." || segment === "..")) return null
  if (segments.some((segment) => segment === "__MACOSX" || segment.startsWith("."))) return null
  if (segments.length < 3) return null

  const fileName = segments.at(-1) ?? ""
  const skcCode = segments.at(-2) ?? ""
  const spuCode = segments.at(-3) ?? ""
  const extension = path.extname(fileName).toLowerCase()
  if (![".jpg", ".jpeg", ".png"].includes(extension)) return null
  if (!numericCode(spuCode) || !numericCode(skcCode) || !skcCode.startsWith(spuCode)) return null

  const escapedSkc = skcCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = fileName.match(new RegExp(`^${escapedSkc}_(\\d+)\\.(?:jpe?g|png)$`, "i"))
  const imageIndex = Number(match?.[1] ?? 0)
  if (!Number.isInteger(imageIndex) || imageIndex <= 0) return null

  return {
    entry_path: normalizedPath,
    spu_code: spuCode,
    skc_code: skcCode,
    image_index: imageIndex,
    extension: extension as SheinImagePackageEntry["extension"],
    uncompressed_size: Math.max(0, Math.floor(Number(uncompressedSize) || 0)),
  }
}

export function groupSheinImagePackageEntries(entries: SheinImagePackageEntry[]): SheinImagePackageGroup[] {
  const groups = new Map<string, SheinImagePackageGroup>()
  for (const entry of entries) {
    const key = `${entry.spu_code}:${entry.skc_code}`
    const group = groups.get(key) ?? {
      spu_code: entry.spu_code,
      skc_code: entry.skc_code,
      entries: [],
    }
    group.entries.push(entry)
    groups.set(key, group)
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      entries: group.entries
        .sort((left, right) => left.image_index - right.image_index || left.entry_path.localeCompare(right.entry_path))
        .filter((entry, index, sorted) => index === 0 || entry.image_index !== sorted[index - 1]?.image_index),
    }))
    .sort((left, right) => left.spu_code.localeCompare(right.spu_code) || left.skc_code.localeCompare(right.skc_code))
}

export function packageImageAssignments(group: SheinImagePackageGroup, detailLimit = 11) {
  const detailEntries = group.entries.slice(0, Math.max(0, Math.floor(detailLimit)))
  const first = group.entries[0]
  return [
    ...detailEntries.map((entry, index) => ({
      entry,
      requirement_key: "SKC_DETAIL" as const,
      asset_type: index === 0 ? "MAIN" as const : "DETAIL" as const,
      image_sort: index + 1,
      derivative: null,
    })),
    ...(first ? [{
      entry: first,
      requirement_key: "SKC_SQUARE" as const,
      asset_type: "SQUARE" as const,
      image_sort: 1,
      derivative: "square-center-crop" as const,
    }] : []),
    ...(first ? [{
      entry: first,
      requirement_key: "SKC_COLOR_BLOCK" as const,
      asset_type: "COLOR_BLOCK" as const,
      image_sort: 1,
      derivative: "color-square-80" as const,
    }] : []),
  ]
}
