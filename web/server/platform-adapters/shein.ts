import { requestSheinWithCredentialsAndRetry } from "../../../scripts/lib/shein_client.mjs"
import {
  transformOnlineImageToShein,
  uploadLocalImageToShein,
} from "../services/pre-publish/shein-api"
import type {
  PlatformAdapter,
  PublishListingInput,
  TransformAssetInput,
  UploadAssetInput,
} from "./types"

function unsupported(operation: string) {
  return async () => {
    throw new Error(`SHEIN adapter operation is not implemented yet: ${operation}`)
  }
}

export const sheinAdapter: PlatformAdapter = {
  platform: "SHEIN",
  fetchCategoryTree: unsupported("fetchCategoryTree"),
  fetchAttributeTemplate: unsupported("fetchAttributeTemplate"),
  buildPublishPayload: unsupported("buildPublishPayload"),
  syncPublishStatus: unsupported("syncPublishStatus"),
  uploadAsset(input: UploadAssetInput) {
    return uploadLocalImageToShein(input.localPath, input.imageType, input.credentials)
  },
  transformAsset(input: TransformAssetInput) {
    return transformOnlineImageToShein(input.sourceUrl, input.imageType, input.credentials)
  },
  publishListing(input: PublishListingInput) {
    return requestSheinWithCredentialsAndRetry("/open-api/goods/product/publishOrEdit", {
      credentials: input.credentials,
      body: input.payload,
    })
  },
}
