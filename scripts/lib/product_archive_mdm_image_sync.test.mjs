import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const files = {
  migration: path.join(PROJECT_ROOT, "db/migrations/048_product_archive_draft_mdm_main_image.sql"),
  service: path.join(PROJECT_ROOT, "web/server/services/product-archive-draft-mdm-images.ts"),
  route: path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"),
};

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

test("MDM main images have a dedicated idempotent draft-image source", async () => {
  const migration = await readText(files.migration);

  assert.match(migration, /mdm_main_image/);
  assert.match(migration, /product_archive_draft_image_source_type_check/);
  assert.match(migration, /unique[\s\S]+draft_id[\s\S]+source_type/i);
  assert.match(migration, /where source_type = 'mdm_main_image'/i);
});

test("every MDM-backed DeepDraw draft creation path synchronizes the SPU main image without blocking draft creation", async () => {
  const route = await readText(files.route);

  assert.match(route, /syncMdmMainImageToProductArchiveDraft/);
  assert.match(route, /source === "mdm_draft"[\s\S]+syncDraftMdmMainImageSafely/);
  assert.match(route, /post\("\/from-spu\/:spuCode"[\s\S]+syncDraftMdmMainImageSafely/);
  assert.match(route, /mdm_main_image_sync_failed/);
});

test("MDM main-image sync downloads a validated local image for multimodal AI and reuses it idempotently", async () => {
  const service = await readText(files.service);

  assert.match(service, /export async function syncMdmMainImageToProductArchiveDraft/);
  assert.match(service, /select[\s\S]+spu\.pic_url[\s\S]+from product_archive_draft draft/i);
  assert.match(service, /source_type = 'mdm_main_image'/i);
  assert.match(service, /detectImageUploadType/);
  assert.match(service, /readImageDimensions/);
  assert.match(service, /local_path/);
  assert.match(service, /source_ref/);
  assert.match(service, /on conflict/i);
});

test("MDM main-image downloads use an allowlist, reject private redirects, and enforce size limits", async () => {
  const service = await readText(files.service);

  assert.match(service, /MDM_BASE_URL/);
  assert.match(service, /LISTINGIFY_MDM_IMAGE_ALLOWED_HOSTS/);
  assert.match(service, /redirect:\s*"manual"/);
  assert.match(service, /isPrivateOrReservedIp/);
  assert.match(service, /content-length/i);
  assert.match(service, /maxUploadBytes\("image"\)/);
});
