import { createHash, randomUUID } from "node:crypto"
import { lookup as dnsLookup } from "node:dns/promises"
import fs from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { isIP } from "node:net"
import path from "node:path"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import {
  detectImageUploadType,
  maxUploadBytes,
  readImageDimensions,
} from "../lib/upload-guard"

const DEFAULT_MDM_BASE_URL = "https://mdm.semirapp.com"
const DEFAULT_MDM_IMAGE_HOSTS = ["product.resources.deepdraw.biz"]
const MAX_MDM_IMAGE_REDIRECTS = 3
const MDM_IMAGE_TIMEOUT_MS = 15_000

type JsonRecord = Record<string, unknown>
type RemoteImageFetch = (input: string, init?: RequestInit) => Promise<Response>
type RemoteImageLookup = (hostname: string) => Promise<Array<{ address: string }>>

export type SyncMdmMainImageOptions = {
  imageRootDir: string
  fetchImpl?: RemoteImageFetch
  lookupImpl?: RemoteImageLookup
  allowedHosts?: ReadonlySet<string>
}

function textValue(value: unknown) {
  return value == null ? "" : String(value).trim()
}

function normalizedHostname(value: string) {
  return value.replace(/^\[/, "").replace(/\]$/, "").toLowerCase()
}

function configuredMdmImageAllowedHosts() {
  const configuredBaseUrl = textValue(process.env.MDM_BASE_URL) || DEFAULT_MDM_BASE_URL
  const baseHost = (() => {
    try {
      return normalizedHostname(new URL(configuredBaseUrl).hostname)
    } catch {
      return normalizedHostname(new URL(DEFAULT_MDM_BASE_URL).hostname)
    }
  })()
  return new Set([
    baseHost,
    ...DEFAULT_MDM_IMAGE_HOSTS,
    ...textValue(process.env.LISTINGIFY_MDM_IMAGE_ALLOWED_HOSTS).split(","),
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
    || (first === 192 && second === 168)
    || (first === 192 && second === 0 && third === 0)
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
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8")
}

function isProxyDnsFakeIpv4(address: string) {
  const parts = address.split(".").map(Number)
  return parts.length === 4 && parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)
}

function proxyDnsFakeIpAllowed(address: string) {
  return Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY)
    && isProxyDnsFakeIpv4(normalizedHostname(address))
}

async function assertSafeMdmImageUrl(
  url: URL,
  lookupImpl: RemoteImageLookup,
  allowedHosts: ReadonlySet<string>,
) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MDM 主图仅支持 HTTP(S) 地址")
  }
  if (url.username || url.password) throw new Error("MDM 主图地址不能包含账号信息")
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
    throw new Error("MDM 主图不允许访问本机或内网地址")
  }
  if (!allowedHosts.has(hostname)) throw new Error("MDM 主图域名不在允许列表")
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) throw new Error("MDM 主图不允许访问本机或内网地址")
    return
  }
  let addresses: Array<{ address: string }>
  try {
    addresses = await lookupImpl(hostname)
  } catch {
    throw new Error("MDM 主图域名无法解析")
  }
  if (
    addresses.length === 0
    || addresses.some((item) => isPrivateOrReservedIp(item.address) && !proxyDnsFakeIpAllowed(item.address))
  ) {
    throw new Error("MDM 主图不允许访问本机或内网地址")
  }
}

async function readLimitedImage(response: Response) {
  const maxBytes = maxUploadBytes("image")
  const declaredLength = Number(response.headers.get("content-length") ?? 0)
  if (declaredLength > maxBytes) throw new Error("MDM 主图文件超过大小限制")
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) throw new Error("MDM 主图文件超过大小限制")
    return buffer
  }
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new Error("MDM 主图文件超过大小限制")
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

async function downloadMdmMainImage(
  sourceUrl: string,
  options: Pick<SyncMdmMainImageOptions, "fetchImpl" | "lookupImpl" | "allowedHosts"> = {},
) {
  let currentUrl: URL
  try {
    currentUrl = new URL(sourceUrl)
  } catch {
    throw new Error("MDM 主图地址无效")
  }
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const lookupImpl = options.lookupImpl ?? (async (hostname) => dnsLookup(hostname, { all: true, verbatim: true }))
  const allowedHosts = options.allowedHosts ?? configuredMdmImageAllowedHosts()

  for (let redirectCount = 0; redirectCount <= MAX_MDM_IMAGE_REDIRECTS; redirectCount += 1) {
    await assertSafeMdmImageUrl(currentUrl, lookupImpl, allowedHosts)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MDM_IMAGE_TIMEOUT_MS)
    timeout.unref()
    try {
      const response = await fetchImpl(currentUrl.toString(), {
        redirect: "manual",
        signal: controller.signal,
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) throw new Error("MDM 主图重定向缺少目标地址")
        if (redirectCount >= MAX_MDM_IMAGE_REDIRECTS) throw new Error("MDM 主图重定向次数过多")
        currentUrl = new URL(location, currentUrl)
        continue
      }
      if (!response.ok) throw new Error(`MDM 主图下载失败：HTTP ${response.status}`)
      const contentType = textValue(response.headers.get("content-type")).toLowerCase()
      if (contentType && !contentType.startsWith("image/") && !contentType.startsWith("application/octet-stream")) {
        throw new Error("MDM 主图来源返回的不是图片")
      }
      const buffer = await readLimitedImage(response)
      if (!buffer.length) throw new Error("MDM 主图文件为空")
      const detected = detectImageUploadType(buffer)
      const dimensions = readImageDimensions(buffer)
      return { buffer, detected, dimensions }
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error("MDM 主图重定向次数过多")
}

export async function syncMdmMainImageToProductArchiveDraft(
  db: SyncPostgresDatabase,
  draftId: number,
  options: SyncMdmMainImageOptions,
) {
  const source = db.prepare(`
    select draft.id as draft_id, draft.spu_code, spu.pic_url
    from product_archive_draft draft
    join product_spu spu on spu.spu_code = draft.spu_code
    where draft.id = ?
  `).get(draftId) as JsonRecord | undefined
  if (!source) throw new Error("深绘建档草稿不存在")
  const sourceUrl = textValue(source.pic_url)
  if (!sourceUrl) return { status: "missing", image: null }

  const existing = db.prepare(`
    select *
    from product_archive_draft_image
    where draft_id = ? and source_type = 'mdm_main_image'
    limit 1
  `).get(draftId) as JsonRecord | undefined
  const existingPath = textValue(existing?.local_path)
  if (textValue(existing?.source_ref) === sourceUrl && existingPath && fs.existsSync(existingPath)) {
    const stat = fs.statSync(existingPath)
    if (stat.isFile() && stat.size > 0) return { status: "reused", image: existing }
  }

  const downloaded = await downloadMdmMainImage(sourceUrl, options)
  const imageDir = path.join(options.imageRootDir, String(draftId))
  await mkdir(imageDir, { recursive: true })
  const digest = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16)
  const fileName = `mdm-main-${digest}${downloaded.detected.extension}`
  const localPath = path.join(imageDir, fileName)
  const temporaryPath = path.join(imageDir, `.mdm-main-${randomUUID()}.tmp`)
  await writeFile(temporaryPath, downloaded.buffer)
  await rename(temporaryPath, localPath)

  const now = new Date().toISOString()
  try {
    db.transaction(() => {
      db.prepare(`
        insert into product_archive_draft_image (
          draft_id, spu_code, source_type, source_ref, local_path, file_name,
          original_file_name, mime_type, file_size, width, height, sort_no,
          uploaded_by, raw_payload_json, created_at, updated_at
        )
        values (?, ?, 'mdm_main_image', ?, ?, ?, ?, ?, ?, ?, ?, 1, null, ?::jsonb, ?::timestamptz, ?::timestamptz)
        on conflict (draft_id, source_type) where source_type = 'mdm_main_image'
        do update set
          source_ref = excluded.source_ref,
          local_path = excluded.local_path,
          file_name = excluded.file_name,
          original_file_name = excluded.original_file_name,
          mime_type = excluded.mime_type,
          file_size = excluded.file_size,
          width = excluded.width,
          height = excluded.height,
          raw_payload_json = excluded.raw_payload_json,
          updated_at = excluded.updated_at
      `).run(
        draftId,
        textValue(source.spu_code),
        sourceUrl,
        localPath,
        fileName,
        fileName,
        downloaded.detected.contentType,
        downloaded.buffer.length,
        downloaded.dimensions.width,
        downloaded.dimensions.height,
        JSON.stringify({ source: "product_spu.pic_url", source_url: sourceUrl }),
        now,
        now,
      )
      db.prepare("update product_archive_draft set updated_at = ?::timestamptz where id = ?").run(now, draftId)
    })()
  } catch (error) {
    await rm(localPath, { force: true }).catch(() => undefined)
    throw error
  }
  if (existingPath && existingPath !== localPath) await rm(existingPath, { force: true }).catch(() => undefined)
  const image = db.prepare(`
    select *
    from product_archive_draft_image
    where draft_id = ? and source_type = 'mdm_main_image'
    limit 1
  `).get(draftId) as JsonRecord | undefined
  return { status: existing ? "updated" : "created", image: image ?? null }
}
