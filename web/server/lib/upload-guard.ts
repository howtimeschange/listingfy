import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { HTTPException } from "hono/http-exception"

export type UploadKind = "spreadsheet" | "image"

export type ImageUploadType = {
  extension: ".jpg" | ".png" | ".webp"
  contentType: "image/jpeg" | "image/png" | "image/webp"
}

const MB = 1024 * 1024
const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xlsm", ".csv"])
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
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
const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readPositiveMb(value: string | undefined, fallback: number) {
  const number = Number(value ?? fallback)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.floor(number)
}

export function maxUploadBytes(kind: UploadKind) {
  if (kind === "image") {
    return readPositiveMb(process.env.LISTINGIFY_MAX_IMAGE_UPLOAD_MB, 20) * MB
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
  return kind === "image" ? "图片" : "表格"
}

function allowedExtensionMessage(kind: UploadKind) {
  return kind === "image"
    ? "仅支持 JPG、PNG、WEBP 图片文件"
    : "仅支持 .xlsx、.xlsm、.csv 表格文件"
}

function assertAllowedMime(file: File, kind: UploadKind) {
  const mimeType = String(file.type ?? "").toLowerCase()
  const allowed = kind === "image" ? IMAGE_MIME_TYPES : SPREADSHEET_MIME_TYPES
  if (!allowed.has(mimeType)) {
    throw new HTTPException(400, { message: `${uploadKindLabel(kind)}文件类型不受支持` })
  }
}

export function assertUploadFile(file: File, kind: UploadKind): void {
  const ext = extensionFor(file)
  const allowedExtensions = kind === "image" ? IMAGE_EXTENSIONS : SPREADSHEET_EXTENSIONS
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

export async function readValidatedUploadBuffer(file: File, kind: UploadKind): Promise<Buffer> {
  assertUploadFile(file, kind)
  const buffer = Buffer.from(await file.arrayBuffer())
  if (kind === "image") {
    detectImageUploadType(buffer)
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
