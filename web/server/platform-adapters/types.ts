import type { SheinCredentials } from "../lib/platform-config"

export const PLATFORM_ADAPTER_CAPABILITIES = {
  fetchCategoryTree: true,
  fetchAttributeTemplate: true,
  uploadAsset: true,
  transformAsset: true,
  buildPublishPayload: true,
  publishListing: true,
  syncPublishStatus: true,
} as const

export type PlatformKey = "SHEIN" | "TEMU"

export type PlatformRequestResult = {
  status: number
  payload: unknown
}

export type UploadAssetInput = {
  localPath: string
  imageType: number
  credentials: SheinCredentials
}

export type TransformAssetInput = {
  sourceUrl: string
  imageType: number
  credentials: SheinCredentials
}

export type PublishListingInput = {
  credentials: SheinCredentials
  payload: unknown
}

export interface PlatformAdapter {
  platform: PlatformKey
  fetchCategoryTree(input?: unknown): Promise<unknown>
  fetchAttributeTemplate(input: unknown): Promise<unknown>
  uploadAsset(input: UploadAssetInput): Promise<{ imageUrl: string; payload: unknown }>
  transformAsset(input: TransformAssetInput): Promise<{ imageUrl: string; payload: unknown }>
  buildPublishPayload(input: unknown): Promise<unknown>
  publishListing(input: PublishListingInput): Promise<PlatformRequestResult>
  syncPublishStatus(input: unknown): Promise<unknown>
}
