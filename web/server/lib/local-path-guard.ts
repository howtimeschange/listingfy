import fs from "node:fs/promises"
import path from "node:path"
import { HTTPException } from "hono/http-exception"
import { detectImageUploadType, maxUploadBytes, type ImageUploadType } from "./upload-guard"

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])

export type LocalImageFile = ImageUploadType & {
  realPath: string
  size: number
}

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function missingImage() {
  return new HTTPException(404, { message: "图片不存在，请重新导入图片" })
}

export async function assertLocalImageFile(input: { rootDir: string; filePath: string }): Promise<LocalImageFile> {
  let rootReal: string
  let fileReal: string
  try {
    rootReal = await fs.realpath(input.rootDir)
    fileReal = await fs.realpath(input.filePath)
  } catch {
    throw missingImage()
  }
  if (!isInside(rootReal, fileReal)) {
    throw missingImage()
  }

  const ext = path.extname(fileReal).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new HTTPException(400, { message: "不是支持的图片文件" })
  }

  const stat = await fs.stat(fileReal).catch(() => null)
  if (!stat?.isFile()) {
    throw missingImage()
  }
  if (stat.size > maxUploadBytes("image")) {
    throw new HTTPException(413, { message: "图片文件过大，请重新导入图片" })
  }

  const buffer = await fs.readFile(fileReal)
  const detected = detectImageUploadType(buffer)
  return { ...detected, realPath: fileReal, size: stat.size }
}
