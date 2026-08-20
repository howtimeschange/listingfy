import { createHash, randomUUID } from "node:crypto"
import { lookup as dnsLookup } from "node:dns/promises"
import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { isIP } from "node:net"
import path from "node:path"
import type { SyncPostgresDatabase } from "../../../scripts/lib/postgres_db.mjs"
import { assertProductArchiveDraftMutable } from "./product-archive-drafts"
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
type RemoteImageLookup = (
  hostname: string,
  options?: { all?: boolean; verbatim?: boolean },
) => Promise<Array<{ address: string; family?: number }>>
type PinnedLookup = (
  hostname: string,
  options: unknown,
  callback: (error: Error | null, address?: string, family?: number) => void,
) => void
type PinnedFetchInit = RequestInit & {
  lookup?: PinnedLookup
  servername?: string
  pinnedAddress?: string
  pinnedFamily?: number
}
type RemoteImageFetch = (input: string, init?: PinnedFetchInit) => Promise<Response>

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
  return String(value ?? "").replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase()
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
    || /^fe[c-f]/.test(normalized)
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
    || (!hostname.includes(".") && !hostname.includes(":"))
  ) {
    throw new Error("MDM 主图不允许访问本机或内网地址")
  }
  if (!allowedHosts.has(hostname)) throw new Error("MDM 主图域名不在允许列表")
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) throw new Error("MDM 主图不允许访问本机或内网地址")
    return {
      hostname,
      address: hostname,
      family: isIP(hostname),
    }
  }
  let addresses: Array<{ address: string; family?: number }>
  try {
    addresses = await lookupImpl(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error("MDM 主图域名无法解析")
  }
  if (
    !Array.isArray(addresses)
    || addresses.length === 0
    || addresses.some((item) => isPrivateOrReservedIp(item.address) && !proxyDnsFakeIpAllowed(item.address))
  ) {
    throw new Error("MDM 主图不允许访问本机或内网地址")
  }
  const selected = addresses[0]
  return {
    hostname,
    address: selected.address,
    family: Number(selected.family) || isIP(selected.address),
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

function headerText(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] ?? "" : String(value ?? "")
}

function pinnedLookupFor(address: string, family: number): PinnedLookup {
  return (_hostname, _options, callback) => callback(null, address, family)
}

type NodeImageResponse = {
  status: number
  location: string
  contentType: string
  contentLength: number
  buffer: Buffer | null
}

async function readLimitedNodeImage(response: NodeJS.ReadableStream, maxBytes: number) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      if (typeof response.destroy === "function") response.destroy()
      reject(error)
    }
    response.on("data", (value: Buffer | Uint8Array | string) => {
      const chunk = Buffer.from(value)
      total += chunk.length
      if (total > maxBytes) {
        fail(new Error("MDM 主图文件超过大小限制"))
        return
      }
      chunks.push(chunk)
    })
    response.on("end", () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks, total))
    })
    response.on("error", (error) => fail(error instanceof Error ? error : new Error(String(error))))
  })
}

async function requestPinnedNodeImage(
  url: URL,
  resolved: { hostname: string; address: string; family: number },
  signal: AbortSignal,
) {
  const maxBytes = maxUploadBytes("image")
  return await new Promise<NodeImageResponse>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http
    const request = transport.request(url, {
      method: "GET",
      signal,
      lookup: pinnedLookupFor(resolved.address, resolved.family),
      ...(url.protocol === "https:" ? { servername: resolved.hostname } : {}),
      headers: {
        Accept: "image/*,application/octet-stream",
        Host: url.host,
      },
    }, (response) => {
      const status = Number(response.statusCode ?? 0)
      const headers = response.headers
      const location = headerText(headers, "location")
      const contentType = headerText(headers, "content-type")
      const contentLength = Number(headerText(headers, "content-length") || 0)
      if (status >= 300 && status < 400) {
        response.resume()
        resolve({ status, location, contentType, contentLength, buffer: null })
        return
      }
      if (status < 200 || status >= 300) {
        response.resume()
        resolve({ status, location, contentType, contentLength, buffer: null })
        return
      }
      if (contentLength > maxBytes) {
        response.destroy()
        reject(new Error("MDM 主图文件超过大小限制"))
        return
      }
      readLimitedNodeImage(response, maxBytes)
        .then((buffer) => resolve({ status, location, contentType, contentLength, buffer }))
        .catch(reject)
    })
    request.once("error", reject)
    request.end()
  })
}

function existingMdmImageIsValid(localPath: string) {
  try {
    const stat = fs.statSync(localPath)
    if (!stat.isFile() || stat.size <= 0 || stat.size > maxUploadBytes("image")) return false
    const buffer = fs.readFileSync(localPath)
    detectImageUploadType(buffer)
    readImageDimensions(buffer)
    return true
  } catch {
    return false
  }
}

function ownedMdmImagePath(localPath: string, imageDir: string) {
  if (!localPath) return null
  const resolvedPath = path.resolve(localPath)
  const resolvedDir = path.resolve(imageDir)
  if (!resolvedPath.startsWith(`${resolvedDir}${path.sep}`)) return null
  return resolvedPath
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
  const fetchImpl = options.fetchImpl
  const lookupImpl = options.lookupImpl ?? (async (hostname) => dnsLookup(hostname, { all: true, verbatim: true }))
  const allowedHosts = options.allowedHosts ?? configuredMdmImageAllowedHosts()

  for (let redirectCount = 0; redirectCount <= MAX_MDM_IMAGE_REDIRECTS; redirectCount += 1) {
    const resolved = await assertSafeMdmImageUrl(currentUrl, lookupImpl, allowedHosts)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), MDM_IMAGE_TIMEOUT_MS)
    timeout.unref()
    try {
      const response = fetchImpl
        ? await fetchImpl(currentUrl.toString(), {
          redirect: "manual",
          signal: controller.signal,
          lookup: pinnedLookupFor(resolved.address, resolved.family),
          servername: resolved.hostname,
          pinnedAddress: resolved.address,
          pinnedFamily: resolved.family,
          headers: {
            Accept: "image/*,application/octet-stream",
            Host: currentUrl.host,
          },
        })
        : await requestPinnedNodeImage(currentUrl, resolved, controller.signal)
      const status = response.status
      const location = fetchImpl
        ? response.headers.get("location") ?? ""
        : response.location
      if (status >= 300 && status < 400) {
        if (!location) throw new Error("MDM 主图重定向缺少目标地址")
        if (redirectCount >= MAX_MDM_IMAGE_REDIRECTS) throw new Error("MDM 主图重定向次数过多")
        if (fetchImpl) await response.body?.cancel().catch(() => undefined)
        currentUrl = new URL(location, currentUrl)
        continue
      }
      if (status < 200 || status >= 300) throw new Error(`MDM 主图下载失败：HTTP ${status}`)
      const contentType = textValue(fetchImpl ? response.headers.get("content-type") : response.contentType).toLowerCase()
      if (contentType && !contentType.startsWith("image/") && !contentType.startsWith("application/octet-stream")) {
        throw new Error("MDM 主图来源返回的不是图片")
      }
      const buffer = fetchImpl
        ? await readLimitedImage(response)
        : response.buffer ?? Buffer.alloc(0)
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
    if (existingMdmImageIsValid(existingPath)) return { status: "reused", image: existing }
  }

  const downloaded = await downloadMdmMainImage(sourceUrl, options)
  const imageDir = path.join(options.imageRootDir, String(draftId))
  await mkdir(imageDir, { recursive: true })
  const digest = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16)
  const fileName = `mdm-main-${digest}-${randomUUID()}${downloaded.detected.extension}`
  const localPath = path.join(imageDir, fileName)
  const temporaryPath = path.join(imageDir, `.mdm-main-${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryPath, downloaded.buffer)
    await rename(temporaryPath, localPath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }

  const now = new Date().toISOString()
  let previousPath: string | null = null
  let wasExisting = false
  try {
    db.transaction(() => {
      assertProductArchiveDraftMutable(db, draftId)
      const currentSource = db.prepare(`
        select draft.id as draft_id, draft.spu_code, spu.pic_url
        from product_archive_draft draft
        join product_spu spu on spu.spu_code = draft.spu_code
        where draft.id = ?
        for update
      `).get(draftId) as JsonRecord | undefined
      if (
        !currentSource
        || textValue(currentSource.spu_code) !== textValue(source.spu_code)
        || textValue(currentSource.pic_url) !== sourceUrl
      ) {
        throw new Error("MDM 主图来源已变化，放弃写入")
      }
      const currentExisting = db.prepare(`
        select *
        from product_archive_draft_image
        where draft_id = ? and source_type = 'mdm_main_image'
        limit 1
      `).get(draftId) as JsonRecord | undefined
      previousPath = ownedMdmImagePath(textValue(currentExisting?.local_path), imageDir)
      wasExisting = Boolean(currentExisting)
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
        textValue(currentSource.spu_code),
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
  if (previousPath && previousPath !== localPath) await rm(previousPath, { force: true }).catch(() => undefined)
  const image = db.prepare(`
    select *
    from product_archive_draft_image
    where draft_id = ? and source_type = 'mdm_main_image'
    limit 1
  `).get(draftId) as JsonRecord | undefined
  return { status: wasExisting ? "updated" : "created", image: image ?? null }
}
