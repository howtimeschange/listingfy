import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, stat, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import test from "node:test"

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..")
const productArchiveRoute = await import("../../web/server/routes/product-archive-drafts.ts")
const routes = [
  ["listingLaunchPlans", "web/server/routes/listing-launch-plans.ts"],
  ["shoeSizeCharts", "web/server/routes/shoe-size-charts.ts"],
  ["deepdrawFieldMappings", "web/server/routes/deepdraw-field-mappings.ts"],
]

test("spreadsheet import routes cap raw multipart bodies before parsing", async () => {
  const sources = await Promise.all(routes.map(async ([routeName, relativePath]) => [
    routeName,
    await readFile(path.join(PROJECT_ROOT, relativePath), "utf8"),
  ]))

  for (const [routeName, source] of sources) {
    assert.match(source, /import\s*\{[^}]*bodyLimit[^}]*\}\s*from\s+["']hono\/body-limit["']/s)
    assert.match(source, /maxUploadBytes\(["']spreadsheet["']\)/)
    assert.match(source, /const\s+MB\s*=\s*1024\s*\*\s*1024/)
    assert.match(source, /SPREADSHEET_MULTIPART_OVERHEAD_BYTES\s*=\s*MB/)
    assert.match(source, /maxUploadBytes\(["']spreadsheet["']\)\s*\+\s*[A-Z_]+/)
    assert.match(source, /bodyLimit\(\{[\s\S]*?maxSize:/)
    assert.match(source, /onError:\s*\(c\)\s*=>\s*c\.json\(\{\s*error:\s*["'][^"']*(?:请求体|body)[^"']*["']/)
    assert.match(source, /,\s*413\s*\)/)
    assert.match(source, /writeValidatedUploadFile\(file,\s*["']spreadsheet["']/)

    const routeStart = source.indexOf(`${routeName}.post(`)
    assert.ok(routeStart >= 0, `${routeName} import route is present`)
    const importPathStart = source.indexOf('"/imports"', routeStart)
    const handlerStart = source.indexOf("async (c) =>", importPathStart)
    assert.ok(importPathStart > routeStart, `${routeName} import path is present`)
    assert.ok(handlerStart > importPathStart, `${routeName} import handler is present`)
    const middleware = source.slice(importPathStart, handlerStart)
    assert.match(middleware, /bodyLimit|spreadsheetUploadBodyLimit/)
  }
})

test("spreadsheet temp files use request-owned UUID paths", async () => {
  const sources = await Promise.all(routes.map(async ([routeName, relativePath]) => [
    routeName,
    await readFile(path.join(PROJECT_ROOT, relativePath), "utf8"),
  ]))

  const helperEnds = {
    listingLaunchPlans: "listingLaunchPlans.get(\"/imports\"",
    shoeSizeCharts: "async function readJson",
    deepdrawFieldMappings: "deepdrawFieldMappings.get(\"/\"",
  }
  for (const [routeName, source] of sources) {
    const helperStart = source.indexOf("async function saveUploadedSpreadsheet")
    const helperEnd = source.indexOf(helperEnds[routeName], helperStart)
    assert.ok(helperStart >= 0 && helperEnd > helperStart, `${routeName} upload helper is present`)
    const helper = source.slice(helperStart, helperEnd)
    assert.match(helper, /randomUUID\(\)/, `${routeName} upload path must include a request UUID`)
    assert.match(helper, /path\.join\([\s\S]*\$\{randomUUID\(\)\}-/, `${routeName} path must be UUID-prefixed`)
    assert.match(
      helper,
      /writeValidatedUploadFile\(file,\s*["']spreadsheet["'],\s*filePath\)[\s\S]*?catch \(error\)[\s\S]*?rm\(filePath,\s*\{ force: true \}\)/,
      `${routeName} must clean a path whose write fails`,
    )
  }
})

test("deepdraw spreadsheet validation runs inside the path-owning cleanup boundary", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/deepdraw-field-mappings.ts"), "utf8")
  const routeStart = source.indexOf('deepdrawFieldMappings.post("/imports"')
  assert.ok(routeStart >= 0, "deepdraw import route is present")
  const implementation = source.slice(routeStart)
  const tryOffset = implementation.indexOf("try {")
  const tenantValidationOffset = implementation.indexOf("if (!tenantName || !merchantId)")
  assert.ok(tryOffset >= 0 && tryOffset < tenantValidationOffset, "tenant validation must be inside cleanup try")
  assert.match(
    implementation,
    /try \{[\s\S]*?if \(!tenantName \|\| !merchantId\)[\s\S]*?finally \{[\s\S]*?rm\(filePath,\s*\{ force: true \}\)/,
  )
})

test("product archive image cleanup skips outside-root and shared paths", async () => {
  assert.equal(typeof productArchiveRoute.cleanupUnreferencedDraftImageFiles, "function")
  const root = await mkdtemp(path.join(os.tmpdir(), "listingify-draft-image-cleanup-"))
  const outsideRoot = `${root}-sibling`
  const insidePath = path.join(root, "inside.jpg")
  const outsidePath = path.join(outsideRoot, "outside.jpg")
  const sharedPath = path.join(root, "shared.jpg")
  await writeFile(insidePath, Buffer.from("inside"))
  await mkdir(outsideRoot, { recursive: true })
  await writeFile(outsidePath, Buffer.from("outside"))
  await writeFile(sharedPath, Buffer.from("shared"))
  try {
    const db = { prepare() { return { all: () => [] } } }
    const cleaned = await productArchiveRoute.cleanupUnreferencedDraftImageFiles(db, [insidePath], root)
    assert.deepEqual(cleaned.warnings, [])
    await assert.rejects(stat(insidePath), { code: "ENOENT" })

    const outside = await productArchiveRoute.cleanupUnreferencedDraftImageFiles(db, [outsidePath], root)
    assert.deepEqual(outside.cleaned_paths, [])
    await stat(outsidePath)

    const sharedDb = {
      prepare() { return { all: () => [{ local_path: sharedPath }] } },
    }
    const retained = await productArchiveRoute.cleanupUnreferencedDraftImageFiles(sharedDb, [sharedPath], root)
    assert.deepEqual(retained.cleaned_paths, [])
    await stat(sharedPath)
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outsideRoot, { recursive: true, force: true })
  }
})

test("product archive image cleanup returns warnings after a committed delete", async () => {
  assert.equal(typeof productArchiveRoute.cleanupUnreferencedDraftImageFiles, "function")
  const root = await mkdtemp(path.join(os.tmpdir(), "listingify-draft-image-cleanup-warning-"))
  const localPath = path.join(root, "orphan.jpg")
  await writeFile(localPath, Buffer.from("orphan"))
  try {
    const result = await productArchiveRoute.cleanupUnreferencedDraftImageFiles(
      { prepare() { return { all: () => [] } } },
      [localPath],
      root,
      async () => { throw new Error("permission denied") },
    )
    assert.deepEqual(result.cleaned_paths, [])
    assert.match(result.warnings[0]?.reason ?? "", /permission denied/)
    await stat(localPath)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("product archive single-image delete returns post-commit cleanup warnings", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/product-archive-drafts.ts"), "utf8")
  const start = source.indexOf('productArchiveDrafts.delete("/:draftId/images/:imageId"')
  const end = source.indexOf('productArchiveDrafts.delete("/:draftId"', start)
  assert.ok(start >= 0 && end > start, "single-image delete route is present")
  const implementation = source.slice(start, end)
  assert.match(implementation, /deleteProductArchiveDraftImage\(db, draftId, imageId\)/)
  assert.match(implementation, /cleanupUnreferencedDraftImageFiles\(db, productArchiveDraftImageStoragePaths\(image\)\)/)
  assert.match(implementation, /cleanup_warnings: cleanup\.warnings/)
  assert.ok(
    implementation.indexOf("deleteProductArchiveDraftImage") < implementation.indexOf("cleanupUnreferencedDraftImageFiles"),
    "cleanup must happen after the database deletion commits",
  )
})
