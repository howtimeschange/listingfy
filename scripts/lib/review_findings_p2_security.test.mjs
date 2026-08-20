import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const ROOT = path.resolve(import.meta.dirname, "../..")

async function source(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8").catch(() => "")
}

test("P2 image-library writes re-check that asset_id belongs to the current SPU", async () => {
  const route = await source("web/server/routes/pre-publish.ts")
  const start = route.indexOf('prePublish.post("/drafts/:id/images/from-library"')
  const end = route.indexOf('prePublish.post("/drafts/:id/images/upload"', start)
  const implementation = route.slice(start, end)

  assert.match(implementation, /assertProductAssetBelongsToListing/)
  assert.match(implementation, /productAssetId/)
  assert.match(implementation, /listing\.spu_code/)
})

test("P2 DeepDraw content packages persist tenant and use a tenant-scoped unique key", async () => {
  const [migration, importer] = await Promise.all([
    source("db/migrations/050_deepdraw_content_tenant.sql"),
    source("scripts/lib/deepdraw_content_importer.mjs"),
  ])

  assert.match(migration, /tenant_name text not null/i)
  assert.match(migration, /unique.*tenant_name.*source_system.*source_code/is)
  assert.match(importer, /on conflict\s*\(\s*tenant_name\s*,\s*source_system\s*,\s*source_code\s*\)\s*do update/i)
  assert.doesNotMatch(importer, /on conflict\s+do update/i)
  assert.match(importer, /tenant_name/)
  assert.match(importer, /tenantName/)
})

test("P2 AI remote image fetch pins the validated DNS answer to the socket", async () => {
  const client = await source("scripts/lib/ai_chat_client.mjs")

  assert.match(client, /requestPinnedRemoteImage/)
  assert.match(client, /lookup:\s*\([^)]*\)\s*=>/)
  assert.match(client, /servername:/)
})

test("P2 image and OCR uploads enforce raw-body and aggregate file byte limits", async () => {
  const route = await source("web/server/routes/product-archive-drafts.ts")

  assert.match(route, /bodyLimit/)
  assert.match(route, /LISTINGIFY_MAX_PRODUCT_ARCHIVE_IMAGE_BATCH_MB/)
  assert.match(route, /LISTINGIFY_MAX_PRODUCT_ARCHIVE_OCR_BATCH_MB/)
  assert.match(route, /assertAggregateUploadBytes/)
})
