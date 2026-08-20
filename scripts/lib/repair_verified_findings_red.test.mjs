import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const publishService = await import("../../web/server/services/publish/shein-status-sync.ts")
const archiveService = await import("../../web/server/services/product-archive-drafts.ts")
const statusParser = await import("../../web/server/services/publish/shein-status-parser.ts")

class RecordingDb {
  writes = []

  prepare(sql) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase()
    return {
      all: () => [],
      get: (...params) => {
        if (normalized.includes("from listing_publish_task task")) {
          return {
            id: 7,
            listing_id: 11,
            publish_version_id: 13,
            platform: "SHEIN",
            channel_account_id: 1,
            platform_version: "1",
          }
        }
        if (normalized.includes("from platform_identity")) return { platform_id: "SPU-11" }
        if (normalized.includes("from listing where id")) return { id: 11, spu_code: "SPU-11" }
        if (normalized.includes("from platform_integration")) return undefined
        if (normalized.includes("from listing_publish_task where id")) {
          return { id: 7, status: "UNDER_REVIEW" }
        }
        return undefined
      },
      run: (...params) => {
        this.writes.push({ sql: normalized, params })
        return { changes: 1 }
      },
    }
  }
}

test("RED P1: empty SHEIN audit data must not persist task, version, listing, or bucket state", async () => {
  const db = new RecordingDb()
  const previousFetch = globalThis.fetch
  const previous = {
    SHEIN_OPEN_KEY_ID: process.env.SHEIN_OPEN_KEY_ID,
    SHEIN_SECRET_KEY: process.env.SHEIN_SECRET_KEY,
    SHEIN_BASE_URL: process.env.SHEIN_BASE_URL,
  }
  process.env.SHEIN_OPEN_KEY_ID = "red-test-open-key"
  process.env.SHEIN_SECRET_KEY = "red-test-secret"
  process.env.SHEIN_BASE_URL = "https://red-test.invalid"
  globalThis.fetch = async () => new Response(JSON.stringify({ code: "0", info: { data: [] } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
  try {
    await publishService.syncPublishTaskStatus(db, 7)
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  assert.equal(db.writes.length, 0, "empty data currently falls through to status persistence")
})

test("RED P2: two submit claims must result in exactly one DeepDraw create", async () => {
  assert.equal(typeof archiveService.claimProductArchiveDraftForSubmit, "function")
  const statuses = new Map([[17, "ready"]])
  const db = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase()
      return {
        get: (_claimToken, _now, id) => {
          if (!normalized.includes("returning") || statuses.get(id) !== "ready") return undefined
          statuses.set(id, "submitting")
          return { id, status: "submitting" }
        },
      }
    },
  }
  const [first, second] = await Promise.all([
    archiveService.claimProductArchiveDraftForSubmit(db, 17),
    archiveService.claimProductArchiveDraftForSubmit(db, 17),
  ])
  assert.equal(Number(Boolean(first)) + Number(Boolean(second)), 1)
})

test("P1 status parser rejects empty, malformed, and unknown SHEIN states", () => {
  for (const payload of [
    { code: "0", info: { data: [] } },
    { code: "0", info: {} },
    { code: "0", info: { data: [{ spuName: "SPU-1", skcList: [{ documentState: 99 }] }] } },
    { code: "0", info: { data: [{ spuName: "SPU-1", skcList: [] }] } },
  ]) {
    assert.equal(statusParser.parseSheinDocumentStates(payload).valid, false)
  }
  assert.equal(statusParser.parseSheinDocumentStates({
    code: "0",
    info: { data: [{ spuName: "SPU-1", skcList: [{ documentState: 2 }] }] },
  }).valid, true)
})

test("S6 listing-plan import stale reclaim fences old worker saves", async () => {
  const service = await readFile(path.resolve(import.meta.dirname, "../../web/server/services/listing-launch-plan-import-jobs.ts"), "utf8")
  assert.match(service, /where id = \?\s+and started_at is not distinct from \?/)
  assert.match(service, /started_at = \?,\s*updated_at = \?/)
  assert.match(service, /拒绝旧 worker 写入/)
})

test("U1A/U5 async tasks isolate users and stop stale polling responses", async () => {
  const [center, context, auth] = await Promise.all([
    readFile(path.resolve(import.meta.dirname, "../../web/src/components/async-task-center.tsx"), "utf8"),
    readFile(path.resolve(import.meta.dirname, "../../web/src/lib/async-task-context.ts"), "utf8"),
    readFile(path.resolve(import.meta.dirname, "../../web/src/lib/auth.tsx"), "utf8"),
  ])
  assert.match(context, /asyncTaskStorageKeys\(userId: number\)/)
  assert.match(center, /userId = user\?\.id \?\? null/)
  assert.match(center, /refreshInFlight\.current/)
  assert.match(center, /refreshGeneration\.current/)
  assert.match(center, /\[401, 403, 404\]/)
  assert.match(auth, /clearAsyncTaskStorage\(currentUserId\)/)
})

test("U2/U3/U4 main workbenches guard writes, show errors, and report mutation failures", async () => {
  const pages = [
    "web/src/pages/listing-batches/page.tsx",
    "web/src/pages/publish-tasks/page.tsx",
    "web/src/pages/pre-publish-validation/page.tsx",
    "web/src/pages/product-archive-drafts/page.tsx",
    "web/src/pages/product-archives/page.tsx",
    "web/src/pages/mdm-products/page.tsx",
    "web/src/pages/deepdraw-content/page.tsx",
  ]
  const content = await Promise.all(pages.map((relativePath) => readFile(path.resolve(import.meta.dirname, `../../${relativePath}`), "utf8")))
  for (const page of content) {
    assert.match(page, /QueryErrorState/)
    assert.match(page, /isError/)
    assert.match(page, /refetch/)
  }
  const rulePages = await Promise.all([
    "web/src/pages/brand-rules/page.tsx",
    "web/src/pages/price-rules/page.tsx",
    "web/src/pages/package-rules/page.tsx",
    "web/src/pages/size-conversion/page.tsx",
  ].map((relativePath) => readFile(path.resolve(import.meta.dirname, `../../${relativePath}`), "utf8")))
  for (const page of rulePages) {
    assert.match(page, /onError:/)
    assert.match(page, /isPending/)
  }

  const permissionPages = [
    "web/src/pages/listing-batches/page.tsx",
    "web/src/pages/pre-publish-validation/page.tsx",
    "web/src/pages/product-archives/page.tsx",
    "web/src/pages/product-archive-drafts/page.tsx",
    "web/src/pages/product-archive-drafts/[draftId]/page.tsx",
    "web/src/pages/brand-rules/page.tsx",
    "web/src/pages/price-rules/page.tsx",
    "web/src/pages/package-rules/page.tsx",
    "web/src/pages/size-conversion/page.tsx",
  ]
  const permissionContent = await Promise.all(permissionPages.map((relativePath) => readFile(path.resolve(import.meta.dirname, `../../${relativePath}`), "utf8")))
  for (const page of permissionContent) {
    assert.match(page, /useAuth/)
    assert.match(page, /hasPermission/)
    assert.match(page, /canWrite/)
    assert.match(page, /disabled=\{!canWrite/)
  }
  const platformProductsPage = await readFile(path.resolve(import.meta.dirname, "../../web/src/pages/shein-platform-products/page.tsx"), "utf8")
  assert.match(platformProductsPage, /const canSync = hasPermission\("SYNC_RUN"\)/)
  assert.match(platformProductsPage, /const canPublish = hasPermission\("PUBLISH_RUN"\)/)
  assert.match(platformProductsPage, /disabled=\{!canSync/)
  assert.match(platformProductsPage, /disabled=\{!canPublish/)
  assert.doesNotMatch(platformProductsPage, /canWrite/)
  const publishTasks = await readFile(path.resolve(import.meta.dirname, "../../web/src/pages/publish-tasks/page.tsx"), "utf8")
  assert.match(publishTasks, /useAuth/)
  assert.match(publishTasks, /hasPermission\("PUBLISH_RUN"\)/)
  assert.match(publishTasks, /disabled=\{!canPublish/)
  const batchPublishDialog = await readFile(path.resolve(import.meta.dirname, "../../web/src/components/pre-publish/batch-publish-dialog.tsx"), "utf8")
  assert.match(batchPublishDialog, /canWrite\??:/)
  assert.match(batchPublishDialog, /canPublish\??:/)
  assert.match(batchPublishDialog, /disabled=\{!canWrite/)
  assert.match(batchPublishDialog, /disabled=\{!canPublish/)
})

test("RED P3: merchant and field errors must not be treated as product-not-found", async () => {
  const service = await import("../../web/server/services/product-archive-drafts.ts")
  for (const reason of ["商户不存在", "字段未找到"]) {
    const fakeDb = {
      prepare() {
        return {
          get() {
            return {
              id: 901,
              spu_code: "SPU-901",
              tenant_name: "电商巴拉巴拉",
              merchant_id: "1162",
              trade_id: "100",
            }
          },
          run() {
            return { changes: 1 }
          },
        }
      },
      transaction(fn) {
        return fn
      },
    }
    await assert.rejects(
      () => service.checkDuplicateProductArchiveDraft(fakeDb, 901, {
        search: async () => ({
          status: 200,
          ok: true,
          payload: { response: { code: 50001, reason, response: "fail" } },
        }),
      }),
      /DeepDraw .*failed/i,
      `business error ${reason} must stop duplicate probing`,
    )
  }
})

test("RED S4: trusted proxy keeps Secure for explicit HTTPS public origin and nginx has no undefined proto variable", async () => {
  const auth = await import("../../web/server/lib/auth.ts")
  const deploy = await readFile(path.resolve(import.meta.dirname, "../../ci/yunxiao-deploy.sh"), "utf8")
  const previous = {
    LISTINGIFY_PUBLIC_ORIGIN: process.env.LISTINGIFY_PUBLIC_ORIGIN,
    LISTINGIFY_TRUSTED_PROXY: process.env.LISTINGIFY_TRUSTED_PROXY,
    LISTINGIFY_COOKIE_SECURE: process.env.LISTINGIFY_COOKIE_SECURE,
  }
  process.env.LISTINGIFY_PUBLIC_ORIGIN = "https://listingify.semirapp.com"
  process.env.LISTINGIFY_TRUSTED_PROXY = "true"
  delete process.env.LISTINGIFY_COOKIE_SECURE
  try {
    assert.equal(auth.secureCookieFromRequest({
      requestUrl: "http://listingify.internal/api/auth/login",
      forwardedProto: "http",
    }), true)
    assert.doesNotMatch(deploy, /\$listingify_forwarded_proto/)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test("RED S6: a lost item claim must stop before external detail sync", async () => {
  const jobs = await import("../../web/server/services/shein-platform-product-jobs.ts")
  assert.equal(typeof jobs.processPlatformProductJobItem, "function")
  const writes = []
  const fakeDb = {
    prepare() {
      return {
        run() {
          writes.push(true)
          return { changes: 0 }
        },
      }
    },
  }
  let externalCalls = 0
  const result = await jobs.processPlatformProductJobItem(
    {
      id: "job-901",
      type: "sync",
      started_at: "2026-08-05T00:00:00.000Z",
    },
    { item_index: 0, spu_code: "SPU-901", status: "queued" },
    fakeDb,
    async () => {
      externalCalls += 1
      return { result: { code: "0" }, persistence: {} }
    },
  )
  assert.equal(result.claimLost, true)
  assert.equal(externalCalls, 0)
  assert.equal(writes.length, 1)
})
