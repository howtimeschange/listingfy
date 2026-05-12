import type { SheinCredentials } from "../lib/platform-config"

export const PLATFORM_ADAPTER_CAPABILITIES = {
  fetchCategoryTree: true,
  fetchAttributeTemplate: true,
  uploadAsset: true,
  transformAsset: true,
  buildPublishPayload: true,
  publishListing: true,
  addVariantsToListing: true,
  checkEditPermission: true,
  partialEditListing: true,
  updateCost: true,
  queryStoreSites: true,
  queryProductList: true,
  queryProductDetail: true,
  queryDocumentState: true,
  searchProducts: true,
  revokeProduct: true,
  queryNumberList: true,
  checkSupplierSkuRepeated: true,
  batchSkcSize: true,
  printBarcode: true,
  queryChangePriceReason: true,
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

export type PlatformPayloadInput = {
  credentials: SheinCredentials
  payload?: unknown
}

export interface PlatformAdapter {
  platform: PlatformKey
  fetchCategoryTree(input?: unknown): Promise<unknown>
  fetchAttributeTemplate(input: unknown): Promise<unknown>
  uploadAsset(input: UploadAssetInput): Promise<{ imageUrl: string; payload: unknown }>
  transformAsset(input: TransformAssetInput): Promise<{ imageUrl: string; payload: unknown }>
  buildPublishPayload(input: unknown): Promise<unknown>
  publishListing(input: PublishListingInput): Promise<PlatformRequestResult>
  addVariantsToListing(input: PublishListingInput): Promise<PlatformRequestResult>
  checkEditPermission(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  partialEditListing(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  updateCost(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryStoreSites(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryProductList(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryProductDetail(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryDocumentState(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  searchProducts(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  revokeProduct(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryNumberList(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  checkSupplierSkuRepeated(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  batchSkcSize(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  printBarcode(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  queryChangePriceReason(input: PlatformPayloadInput): Promise<PlatformRequestResult>
  syncPublishStatus(input: unknown): Promise<unknown>
}
