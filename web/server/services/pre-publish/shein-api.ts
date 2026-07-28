import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"
import sharp from "sharp"
import {
  headersForOpenApiCredentials,
  requestSheinWithCredentialsAndRetry,
} from "../../../../scripts/lib/shein_client.mjs"
import type { SheinCredentials } from "../../lib/platform-config"
import { normalizeText } from "./shared"
import { publishInfo, responseCode, responseMessage } from "./payload"

const MAX_REMOTE_SQUARE_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_REMOTE_SQUARE_IMAGE_REDIRECTS = 3
const REMOTE_SQUARE_IMAGE_TIMEOUT_MS = 10_000
const DEFAULT_REMOTE_SQUARE_IMAGE_ALLOWED_HOSTS = ["product.resources.deepdraw.biz"]

type RemoteImageFetch = (input: string, init?: RequestInit) => Promise<Response>
type RemoteImageLookup = (hostname: string) => Promise<Array<{ address: string }>>

function normalizedHostname(value: string) {
  return value.replace(/^\[/, "").replace(/\]$/, "").toLowerCase()
}

function remoteSquareImageAllowedHosts(configuredHosts = process.env.LISTINGIFY_REMOTE_IMAGE_ALLOWED_HOSTS) {
  return new Set([
    ...DEFAULT_REMOTE_SQUARE_IMAGE_ALLOWED_HOSTS,
    ...normalizeText(configuredHosts).split(","),
  ].map((item) => normalizedHostname(item.trim())).filter(Boolean))
}

function isPrivateOrReservedIpv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [first, second, third] = parts
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 0)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 2)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
}

function isPrivateOrReservedIp(address: string) {
  const normalized = normalizedHostname(address)
  const family = isIP(normalized)
  if (family === 4) return isPrivateOrReservedIpv4(normalized)
  if (family !== 6) return true
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length)
    return isIP(mapped) !== 4 || isPrivateOrReservedIpv4(mapped)
  }
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("fec")
    || normalized.startsWith("fed")
    || normalized.startsWith("fee")
    || normalized.startsWith("fef")
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8")
}

async function assertSafeRemoteImageUrl(
  url: URL,
  lookupImpl: RemoteImageLookup,
  allowedHosts: ReadonlySet<string>,
) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SHEIN 方块图来源仅支持 HTTP(S)")
  }
  if (url.username || url.password) throw new Error("SHEIN 方块图来源 URL 不允许包含账号信息")

  const hostname = normalizedHostname(url.hostname)
  if (
    !hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname.endsWith(".lan")
    || !hostname.includes(".")
  ) {
    throw new Error("SHEIN 方块图来源不允许访问本机或内网地址")
  }
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("SHEIN 方块图来源不允许访问本机或内网地址")
    }
    if (!allowedHosts.has(hostname)) throw new Error("SHEIN 方块图来源域名不在允许列表")
    return
  }
  if (!allowedHosts.has(hostname)) throw new Error("SHEIN 方块图来源域名不在允许列表")

  let addresses: Array<{ address: string }>
  try {
    addresses = await lookupImpl(hostname)
  } catch {
    throw new Error("SHEIN 方块图来源域名无法解析")
  }
  if (addresses.length === 0 || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
    throw new Error("SHEIN 方块图来源不允许访问本机或内网地址")
  }
}

async function readLimitedRemoteImage(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0)
  if (declaredLength > MAX_REMOTE_SQUARE_IMAGE_BYTES) {
    throw new Error("SHEIN 方块图来源文件超过 8MB")
  }
  if (!response.body) {
    const source = Buffer.from(await response.arrayBuffer())
    if (source.length > MAX_REMOTE_SQUARE_IMAGE_BYTES) throw new Error("SHEIN 方块图来源文件超过 8MB")
    return source
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_REMOTE_SQUARE_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new Error("SHEIN 方块图来源文件超过 8MB")
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

export async function centerCropSquareImageBuffer(source: Buffer) {
  const metadata = await sharp(source).metadata()
  const width = Number(metadata.width ?? 0)
  const height = Number(metadata.height ?? 0)
  if (!width || !height) throw new Error("无法读取 SHEIN 方块图尺寸")
  const side = Math.min(2200, Math.max(900, Math.min(width, height)))
  return sharp(source)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: side, height: side, fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toBuffer()
}

export async function downloadAndCenterCropSquareImage(
  sourceUrl: string,
  fetchImpl: RemoteImageFetch = (input, init) => fetch(input, init),
  lookupImpl: RemoteImageLookup = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true }),
  allowedHosts: ReadonlySet<string> = remoteSquareImageAllowedHosts(),
) {
  let currentUrl: URL
  try {
    currentUrl = new URL(sourceUrl)
  } catch {
    throw new Error("SHEIN 方块图来源 URL 无效")
  }

  for (let redirectCount = 0; redirectCount <= MAX_REMOTE_SQUARE_IMAGE_REDIRECTS; redirectCount += 1) {
    await assertSafeRemoteImageUrl(currentUrl, lookupImpl, allowedHosts)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REMOTE_SQUARE_IMAGE_TIMEOUT_MS)
    timeout.unref()
    try {
      const response = await fetchImpl(currentUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) throw new Error("SHEIN 方块图下载重定向缺少目标地址")
        if (redirectCount >= MAX_REMOTE_SQUARE_IMAGE_REDIRECTS) {
          throw new Error("SHEIN 方块图下载重定向次数过多")
        }
        currentUrl = new URL(location, currentUrl)
        continue
      }
      if (!response.ok) {
        throw new Error(`SHEIN 方块图下载失败：HTTP ${response.status}`)
      }
      const contentType = normalizeText(response.headers.get("content-type")).toLowerCase()
      if (
        contentType
        && !contentType.startsWith("image/")
        && !contentType.startsWith("application/octet-stream")
      ) {
        throw new Error("SHEIN 方块图来源返回的不是图片")
      }
      const source = await readLimitedRemoteImage(response)
      if (!source.length) throw new Error("SHEIN 方块图来源文件为空")
      return centerCropSquareImageBuffer(source)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error("SHEIN 方块图下载重定向次数过多")
}

export async function prepareLocalImageForSheinUpload(localPath: string, imageType: number) {
  if (imageType !== 5) {
    return { uploadPath: localPath, generated: false, cleanup: () => undefined }
  }

  const metadata = await sharp(localPath).metadata()
  const width = Number(metadata.width ?? 0)
  const height = Number(metadata.height ?? 0)
  if (!width || !height) throw new Error("无法读取 SHEIN 方块图尺寸")
  if (width === height) {
    return { uploadPath: localPath, generated: false, cleanup: () => undefined }
  }

  const uploadPath = path.join(os.tmpdir(), `listingify-shein-square-${randomUUID()}.jpg`)
  const bytes = await centerCropSquareImageBuffer(fs.readFileSync(localPath))
  fs.writeFileSync(uploadPath, bytes)

  return {
    uploadPath,
    generated: true,
    cleanup: () => fs.rmSync(uploadPath, { force: true }),
  }
}

export async function uploadLocalImageToShein(localPath: string, imageType: number, credentials: SheinCredentials) {
  const apiPath = "/open-api/goods/upload-pic"
  const url = new URL(apiPath, credentials.baseUrl)
  const headers = headersForOpenApiCredentials(apiPath, {
    openKeyId: credentials.openKeyId,
    secretKey: credentials.secretKey,
    language: credentials.language,
  })
  delete (headers as Record<string, string>)["Content-Type"]
  const prepared = await prepareLocalImageForSheinUpload(localPath, imageType)
  try {
    const bytes = fs.readFileSync(prepared.uploadPath)
    const form = new FormData()
    form.append("image_type", String(imageType))
    form.append("file", new Blob([new Uint8Array(bytes)]), path.basename(prepared.uploadPath))
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: form,
    })
    const payload = await response.json().catch(async () => ({ code: String(response.status), msg: await response.text().catch(() => "") }))
    if (responseCode(payload) !== "0") {
      throw new Error(`SHEIN 图片上传失败：${responseCode(payload) || response.status} ${responseMessage(payload)}`)
    }
    const info = publishInfo(payload)
    const imageUrl = normalizeText(info.image_url ?? info.imageUrl)
    if (!imageUrl) throw new Error("SHEIN 图片上传未返回 image_url")
    return { imageUrl, payload }
  } finally {
    prepared.cleanup()
  }
}

export async function uploadRemoteSquareImageToShein(sourceUrl: string, credentials: SheinCredentials) {
  const uploadPath = path.join(os.tmpdir(), `listingify-shein-square-source-${randomUUID()}.jpg`)
  try {
    const bytes = await downloadAndCenterCropSquareImage(sourceUrl)
    fs.writeFileSync(uploadPath, bytes)
    return await uploadLocalImageToShein(uploadPath, 5, credentials)
  } finally {
    fs.rmSync(uploadPath, { force: true })
  }
}

export async function transformOnlineImageToShein(sourceUrl: string, imageType: number, credentials: SheinCredentials) {
  const result = await requestSheinWithCredentialsAndRetry("/open-api/goods/transform-pic", {
    credentials,
    body: {
      image_type: imageType,
      original_url: sourceUrl,
    },
  })
  if (responseCode(result.payload) !== "0") {
    throw new Error(`SHEIN 图片转换失败：${responseCode(result.payload) || result.status} ${responseMessage(result.payload)}`)
  }
  const info = publishInfo(result.payload)
  const imageUrl = normalizeText(info.transformed ?? info.image_url ?? info.imageUrl)
  if (!imageUrl) throw new Error("SHEIN 图片转换未返回 transformed")
  return { imageUrl, payload: result.payload }
}
