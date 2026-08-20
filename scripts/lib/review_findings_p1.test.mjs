import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const ROOT = path.resolve(import.meta.dirname, "../..")

async function source(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8")
}

test("P1 local image folder imports are confined to configured server roots", async () => {
  const [route, page] = await Promise.all([
    source("web/server/routes/pre-publish.ts"),
    source("web/src/pages/pre-publish-validation/[listingId]/page.tsx"),
  ])

  assert.match(route, /LISTINGIFY_IMAGE_IMPORT_ROOTS/)
  assert.match(route, /assertConfiguredImageImportFolder/)
  assert.doesNotMatch(page, /\/Users\/[^"']+\/Downloads/)
})

test("P1 DeepDraw submission claims before validation and fences every terminal write", async () => {
  const service = await source("web/server/services/product-archive-drafts.ts")
  const implementation = service.slice(
    service.indexOf("export async function submitProductArchiveDraft"),
    service.indexOf("export function listProductArchiveSubmitLogs"),
  )

  assert.ok(
    implementation.indexOf("claimProductArchiveDraftForSubmit") < implementation.indexOf("refreshDraftTradeSelectionFromLaunchPlan"),
    "the submission lease must be acquired before mutable validation work",
  )
  assert.match(service, /submit_claim_token/)
  assert.match(implementation, /where id = \?\s+and submit_claim_token = \?/)
  assert.match(service, /delete from product_archive_draft\s+where id = \?\s+and submit_claim_token is null\s+returning/i)
})

test("P1 SHEIN mutations and deletion are fenced by the current publish state", async () => {
  const route = await source("web/server/routes/pre-publish.ts")

  assert.match(route, /lockListingForMutation/)
  assert.match(route, /claimListingForPublish/)
  assert.match(route, /PUBLISH_MUTATION_FENCED_STATUSES[\s\S]*PUBLISH_RESULT_UNKNOWN/)
  const fencedSql = route.match(/status not in \('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN'\)/g) ?? []
  assert.ok(fencedSql.length >= 2, "claim and delete must both fence unknown publish results")
  assert.match(route, /LISTING_PUBLISH_IN_PROGRESS/)
})

test("P1 SHEIN claim preparation failures close the version and listing behind a state fence", async () => {
  const route = await source("web/server/routes/pre-publish.ts")
  const publishRoute = route.slice(route.indexOf('prePublish.post("/drafts/:id/publish"'))

  assert.match(route, /function markClaimedPublishPreparationFailed/)
  assert.match(route, /update listing_publish_version[\s\S]*status = 'FAILED'[\s\S]*status not in \('SUBMITTED', 'RESULT_UNKNOWN'\)/)
  assert.match(route, /update listing[\s\S]*status = 'PUBLISH_FAILED'[\s\S]*status = 'PUBLISHING'/)
  assert.match(publishRoute, /claimListingForPublish[\s\S]*try \{[\s\S]*createPublishVersion[\s\S]*ensureSkcSourceImageAssetsForPublish[\s\S]*buildPublishPayload[\s\S]*ensurePublishTask/)
  assert.match(publishRoute, /catch \(error\)[\s\S]*markClaimedPublishPreparationFailed/)
  assert.match(publishRoute, /markPublishTransportUnknown/)
})

test("P1 publish pages distinguish verified success from accepted or mismatched outcomes", async () => {
  const [deepdrawPage, sheinPage] = await Promise.all([
    source("web/src/pages/product-archive-drafts/[draftId]/page.tsx"),
    source("web/src/pages/pre-publish-validation/[listingId]/page.tsx"),
  ])

  assert.match(deepdrawPage, /status === "readback_verified"/)
  assert.match(deepdrawPage, /duplicateFound/)
  assert.match(deepdrawPage, /alreadySubmitting/)
  assert.match(sheinPage, /status === "PUBLISH_SUBMITTED"/)
  assert.match(sheinPage, /result\.ok/)
  assert.match(sheinPage, /PUBLISH_RESULT_UNKNOWN/)
})

test("P1 SHEIN status readback uses the same stored credentials as publish", async () => {
  const service = await source("web/server/services/publish/shein-status-sync.ts")

  assert.match(service, /resolveSheinCredentials/)
  assert.match(service, /requestSheinWithCredentialsAndRetry/)
  assert.doesNotMatch(service, /requestSheinWithRetry/)
})
