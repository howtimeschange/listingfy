import { requestSheinWithCredentialsAndRetry } from "../../../scripts/lib/shein_client.mjs"
import {
  transformOnlineImageToShein,
  uploadLocalImageToShein,
} from "../services/pre-publish/shein-api"
import type {
  PlatformAdapter,
  PlatformPayloadInput,
  PublishListingInput,
  TransformAssetInput,
  UploadAssetInput,
} from "./types"

function unsupported(operation: string) {
  return async () => {
    throw new Error(`SHEIN adapter operation is not implemented yet: ${operation}`)
  }
}

function sheinPost(path: string, input: PlatformPayloadInput) {
  return requestSheinWithCredentialsAndRetry(path, {
    credentials: input.credentials,
    body: input.payload ?? {},
  })
}

function sheinGet(path: string, input: PlatformPayloadInput) {
  return requestSheinWithCredentialsAndRetry(path, {
    method: "GET",
    credentials: input.credentials,
  })
}

function queryPath(path: string, params: Record<string, unknown>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
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
  addVariantsToListing(input: PublishListingInput) {
    return requestSheinWithCredentialsAndRetry("/open-api/goods/product/publishOrEdit", {
      credentials: input.credentials,
      body: input.payload,
    })
  },
  checkEditPermission(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/product/check-edit-permission", input)
  },
  partialEditListing(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/product/partialEdit", input)
  },
  updateCost(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/update-cost", input)
  },
  queryStoreSites(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/query-site-list", input)
  },
  queryProductList(input: PlatformPayloadInput) {
    return sheinPost("/open-api/openapi-business-backend/product/query", input)
  },
  queryProductDetail(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/spu-info", input)
  },
  queryDocumentState(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/query-document-state", input)
  },
  searchProducts(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/searchProduct", input)
  },
  revokeProduct(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/revoke-product", input)
  },
  queryNumberList(input: PlatformPayloadInput) {
    const payload = input.payload && typeof input.payload === "object" ? input.payload as Record<string, unknown> : {}
    return sheinGet(queryPath("/open-api/goods/number-list", {
      page: payload.page ?? 1,
      per_page: payload.per_page ?? payload.perPage ?? 100,
      type: payload.type ?? 1,
    }), input)
  },
  checkSupplierSkuRepeated(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/product/check-supplierSku-repeated", input)
  },
  batchSkcSize(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/batch-skc-size", input)
  },
  printBarcode(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/print-barcode", input)
  },
  queryChangePriceReason(input: PlatformPayloadInput) {
    return sheinPost("/open-api/goods/query-change-price-reason", input)
  },
}
