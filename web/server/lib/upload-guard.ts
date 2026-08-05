import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { HTTPException } from "hono/http-exception"

export type UploadKind = "spreadsheet" | "image" | "product_archive_ocr"

export type ImageUploadType = {
  extension: ".jpg" | ".png" | ".webp"
  contentType: "image/jpeg" | "image/png" | "image/webp"
}

export type ProductArchiveOcrUploadType = {
  extension: ".pdf" | ".jpg" | ".png"
  contentType: "application/pdf" | "image/jpeg" | "image/png"
}

export type ImageDimensions = {
  width: number
  height: number
}

const MB = 1024 * 1024
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xlsm", ".csv"])
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const PRODUCT_ARCHIVE_OCR_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"])
const SPREADSHEET_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/plain",
])
const IMAGE_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/webp",
])
const PRODUCT_ARCHIVE_OCR_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/pdf",
  "image/jpeg",
  "image/png",
])
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii")

function readPositiveMb(value: string | undefined, fallback: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.floor(number)
}

export function maxUploadBytes(kind: UploadKind) {
  if (kind === "image") {
    return readPositiveMb(process.env.LISTINGIFY_MAX_IMAGE_UPLOAD_MB, 20) * MB
  }
  if (kind === "product_archive_ocr") {
    return readPositiveMb(process.env.LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_UPLOAD_MB, 50) * MB
  }
  return readPositiveMb(process.env.LISTINGIFY_MAX_SPREADSHEET_UPLOAD_MB, 50) * MB
}

function extensionFor(file: File) {
  return path.extname(file.name || "").toLowerCase()
}

function safeStem(value: string, fallback: string) {
  const stem = path.basename(value, path.extname(value)).replace(/[^a-zA-Z0-9._-]/g, "_")
  return stem || fallback
}

function normalizedExtension(value: string) {
  if (!value) return ""
  return value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`
}

export function safeUploadFileName(fileName: string, options: { fallbackName: string; extension?: string }) {
  const fallbackExt = path.extname(options.fallbackName)
  const extension = normalizedExtension(options.extension ?? (path.extname(fileName) || fallbackExt))
  const fallbackStem = safeStem(options.fallbackName, "upload")
  const stem = safeStem(fileName, fallbackStem)
  return `${Date.now()}-${randomUUID()}-${stem}${extension}`
}

function uploadKindLabel(kind: UploadKind) {
  if (kind === "product_archive_ocr") return "吊牌/洗唛"
  return kind === "image" ? "图片" : "表格"
}

function allowedExtensionMessage(kind: UploadKind) {
  if (kind === "product_archive_ocr") return "仅支持 PDF、JPG、PNG 吊牌/洗唛文件"
  return kind === "image"
    ? "仅支持 JPG、PNG、WEBP 图片文件"
    : "仅支持 .xlsx、.xlsm、.csv 表格文件"
}

function assertAllowedMime(file: File, kind: UploadKind) {
  const mimeType = String(file.type ?? "").toLowerCase()
  const allowed = kind === "image"
    ? IMAGE_MIME_TYPES
    : kind === "product_archive_ocr"
      ? PRODUCT_ARCHIVE_OCR_MIME_TYPES
      : SPREADSHEET_MIME_TYPES
  if (!allowed.has(mimeType)) {
    throw new HTTPException(400, { message: `${uploadKindLabel(kind)}文件类型不受支持` })
  }
}

export function assertUploadFile(file: File, kind: UploadKind): void {
  const ext = extensionFor(file)
  const allowedExtensions = kind === "image"
    ? IMAGE_EXTENSIONS
    : kind === "product_archive_ocr"
      ? PRODUCT_ARCHIVE_OCR_EXTENSIONS
      : SPREADSHEET_EXTENSIONS
  if (!allowedExtensions.has(ext)) {
    throw new HTTPException(400, { message: allowedExtensionMessage(kind) })
  }
  if (file.size > maxUploadBytes(kind)) {
    throw new HTTPException(413, { message: `${uploadKindLabel(kind)}文件过大，请压缩后重新上传` })
  }
  assertAllowedMime(file, kind)
}

function hasZipSignature(buffer: Buffer) {
  return ZIP_SIGNATURES.some((signature) => (
    buffer.length >= signature.length
    && signature.every((byte, index) => buffer[index] === byte)
  ))
}

export function detectImageUploadType(buffer: Buffer): ImageUploadType {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: ".jpg", contentType: "image/jpeg" }
  }
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { extension: ".png", contentType: "image/png" }
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: ".webp", contentType: "image/webp" }
  }
  throw new HTTPException(400, { message: "不是支持的图片文件" })
}

export function detectProductArchiveOcrUploadType(buffer: Buffer): ProductArchiveOcrUploadType {
  if (buffer.length >= PDF_SIGNATURE.length && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return { extension: ".pdf", contentType: "application/pdf" }
  }
  const imageType = detectImageUploadType(buffer)
  if (imageType.contentType === "image/webp") {
    throw new HTTPException(400, { message: "吊牌/洗唛 OCR 暂不支持 WEBP，请导出为 JPG、PNG 或 PDF" })
  }
  return imageType
}

function validDimensions(width: number, height: number): ImageDimensions | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  let offset = 2
  let dimensions: ImageDimensions | null = null
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    offset += 2
    if (marker === 0xd9) return null
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > buffer.length) break
    const segmentLength = buffer.readUInt16BE(offset)
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break
    const isStartOfFrame = (
      marker >= 0xc0
      && marker <= 0xcf
      && ![0xc4, 0xc8, 0xcc].includes(marker)
    )
    if (isStartOfFrame && segmentLength >= 7) {
      dimensions = validDimensions(buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3))
      if (!dimensions) return null
    }
    if (marker === 0xda) {
      if (!dimensions) return null
      let scanOffset = offset + segmentLength
      let hasScanData = false
      while (scanOffset + 1 < buffer.length) {
        if (buffer[scanOffset] !== 0xff) {
          hasScanData = true
          scanOffset += 1
          continue
        }
        const scanMarker = buffer[scanOffset + 1]
        if (scanMarker === 0x00) {
          hasScanData = true
          scanOffset += 2
          continue
        }
        if (scanMarker === 0xd9) return hasScanData ? dimensions : null
        scanOffset += scanMarker === 0xff ? 1 : 2
      }
      return null
    }
    offset += segmentLength
  }
  return null
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  const chunkType = buffer.subarray(12, 16).toString("ascii")
  if (chunkType === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3)
    const height = 1 + buffer.readUIntLE(27, 3)
    return validDimensions(width, height)
  }
  if (chunkType === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const width = 1 + (buffer[21] | ((buffer[22] & 0x3f) << 8))
    const height = 1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10))
    return validDimensions(width, height)
  }
  if (
    chunkType === "VP8 "
    && buffer.length >= 30
    && buffer[23] === 0x9d
    && buffer[24] === 0x01
    && buffer[25] === 0x2a
  ) {
    const width = buffer.readUInt16LE(26) & 0x3fff
    const height = buffer.readUInt16LE(28) & 0x3fff
    return validDimensions(width, height)
  }
  return null
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 45) return null
  if (buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null
  const dimensions = validDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20))
  if (!dimensions) return null

  let offset = 8
  let hasImageData = false
  let hasEnd = false
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset)
    const chunkEnd = offset + 12 + chunkLength
    if (chunkEnd > buffer.length) return null
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii")
    if (chunkType === "IDAT" && chunkLength > 0) hasImageData = true
    if (chunkType === "IEND") {
      if (chunkLength !== 0) return null
      hasEnd = true
      break
    }
    offset = chunkEnd
  }
  return hasImageData && hasEnd ? dimensions : null
}

export function readImageDimensions(buffer: Buffer): ImageDimensions {
  const type = detectImageUploadType(buffer)
  let dimensions: ImageDimensions | null = null
  if (type.contentType === "image/png") {
    dimensions = readPngDimensions(buffer)
  } else if (type.contentType === "image/jpeg") {
    dimensions = readJpegDimensions(buffer)
  } else if (type.contentType === "image/webp") {
    dimensions = readWebpDimensions(buffer)
  }
  if (!dimensions) throw new HTTPException(400, { message: "无法读取图片尺寸，请重新导出图片后上传" })
  return dimensions
}

export async function readValidatedUploadBuffer(file: File, kind: UploadKind): Promise<Buffer> {
  assertUploadFile(file, kind)
  const buffer = Buffer.from(await file.arrayBuffer())
  if (kind === "image") {
    detectImageUploadType(buffer)
    return buffer
  }
  if (kind === "product_archive_ocr") {
    detectProductArchiveOcrUploadType(buffer)
    return buffer
  }
  const ext = extensionFor(file)
  if ((ext === ".xlsx" || ext === ".xlsm") && !hasZipSignature(buffer)) {
    throw new HTTPException(400, { message: "不是有效的 Excel 文件" })
  }
  return buffer
}

export async function writeValidatedUploadFile(file: File, kind: UploadKind, destination: string): Promise<void> {
  const buffer = await readValidatedUploadBuffer(file, kind)
  await writeFile(destination, buffer)
}
