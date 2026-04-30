import fs from "node:fs"
import path from "node:path"
import {
  headersForOpenApiCredentials,
  requestSheinWithCredentialsAndRetry,
} from "../../../../scripts/lib/shein_client.mjs"
import type { SheinCredentials } from "../../lib/platform-config"
import { normalizeText } from "./shared"
import { publishInfo, responseCode, responseMessage } from "./payload"

export async function uploadLocalImageToShein(localPath: string, imageType: number, credentials: SheinCredentials) {
  const apiPath = "/open-api/goods/upload-pic"
  const url = new URL(apiPath, credentials.baseUrl)
  const headers = headersForOpenApiCredentials(apiPath, {
    openKeyId: credentials.openKeyId,
    secretKey: credentials.secretKey,
    language: credentials.language,
  })
  delete (headers as Record<string, string>)["Content-Type"]
  const bytes = fs.readFileSync(localPath)
  const form = new FormData()
  form.append("image_type", String(imageType))
  form.append("file", new Blob([new Uint8Array(bytes)]), path.basename(localPath))
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
