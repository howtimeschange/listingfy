import assert from "node:assert/strict"
import test from "node:test"

const archiveService = await import("../../web/server/services/product-archive-drafts.ts")

const CLIENT_VERSION = "2026-10-11T10:00:00.123Z"
const EXACT_VERSION = "2026-10-11 10:00:00.123456+00"

function createTitlePatchDb(overrides = {}) {
  const state = {
    draft: {
      id: 1,
      draft_no: "DRAFT-1",
      spu_code: "SPU-1",
      title: "旧标题",
      tenant_name: "tenant",
      merchant_id: "merchant",
      trade_id: "trade-1",
      trade_path: "童装/裤子",
      status: "ready",
      retail_price: 99,
      source_snapshot_json: { spu: { spu_name: "测试商品", product_line_name: "童装" }, sourceRows: [] },
      source_batch_ids_json: {},
      duplicate_result_json: {},
      validation_summary_json: {},
      submit_claim_token: null,
      updated_at: CLIENT_VERSION,
      created_product_id: null,
      ...overrides.draft,
    },
    exactVersion: overrides.exactVersion ?? EXACT_VERSION,
    preparationRows: [{ draft_id: 1, input_hash: "prepared" }],
    fields: [
      {
        id: 11,
        draft_id: 1,
        field_name: "材质",
        field_id: "material",
        source_type: "manual",
        source_ref: "人工修正",
        value_text: "手工值",
        value_json: {},
        required: false,
        blocking: false,
        manual_override: true,
        validation_status: "valid",
        validation_message: null,
        updated_at: CLIENT_VERSION,
      },
    ],
    skus: [],
    issues: [],
    images: [],
    logs: [],
    calls: [],
  }

  const clone = (value) => JSON.parse(JSON.stringify(value))
  const draftFor = (id) => (Number(id) === Number(state.draft.id) ? state.draft : null)
  const rowsForDraft = (rows, id) => rows.filter((row) => Number(row.draft_id) === Number(id))

  const db = {
    state,
    transaction(fn) {
      return (...args) => fn(...args)
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim()
      return {
        get(...params) {
          state.calls.push({ method: "get", sql: normalized, params })
          if (/select updated_at::text as updated_at from product_archive_draft/i.test(normalized)) {
            return { updated_at: state.exactVersion }
          }
          if (/from product_spu\b/i.test(normalized)) return undefined
          if (/from product_archive_draft\b/i.test(normalized)) {
            const draft = draftFor(params[0])
            return draft ? clone(draft) : undefined
          }
          return undefined
        },
        all(...params) {
          state.calls.push({ method: "all", sql: normalized, params })
          if (/from product_archive_draft_field/i.test(normalized)) return clone(rowsForDraft(state.fields, params.at(-1)))
          if (/from product_archive_draft_sku/i.test(normalized)) return clone(rowsForDraft(state.skus, params.at(-1)))
          if (/from product_archive_validation_issue/i.test(normalized)) return clone(rowsForDraft(state.issues, params[0]))
          if (/from product_archive_draft_image/i.test(normalized)) return clone(rowsForDraft(state.images, params[0]))
          if (/from product_archive_submit_log/i.test(normalized)) return clone(rowsForDraft(state.logs, params[0]))
          if (/from deepdraw_trade_field_cache/i.test(normalized)) return []
          if (/from product_archive_source_row/i.test(normalized)) return []
          if (/from product_archive_size_chart_mapping/i.test(normalized)) return []
          if (/from product_archive_draft\b/i.test(normalized)) return clone([state.draft])
          return []
        },
        run(...params) {
          state.calls.push({ method: "run", sql: normalized, params })
          if (/update product_archive_draft set title = \?/i.test(normalized)) {
            const [title, updatedAt, draftId, expectedExactVersion] = params
            const draft = draftFor(draftId)
            if (!draft || expectedExactVersion !== state.exactVersion) return { changes: 0 }
            draft.title = title
            draft.updated_at = updatedAt
            return { changes: 1 }
          }
          if (/delete from product_archive_draft_preparation/i.test(normalized)) {
            state.preparationRows = state.preparationRows.filter((row) => Number(row.draft_id) !== Number(params[0]))
            return { changes: 1 }
          }
          if (/update product_archive_draft_field/i.test(normalized)) {
            const [status, message, updatedAt, fieldId] = params
            const field = state.fields.find((item) => Number(item.id) === Number(fieldId))
            if (field) {
              field.validation_status = status
              field.validation_message = message
              field.updated_at = updatedAt
            }
            return { changes: field ? 1 : 0 }
          }
          if (/delete from product_archive_validation_issue/i.test(normalized)) {
            state.issues = state.issues.filter((issue) => Number(issue.draft_id) !== Number(params[0]))
            return { changes: 1 }
          }
          if (/insert into product_archive_validation_issue/i.test(normalized)) {
            const [draftId, severity, issueType, fieldName, skuCode, message] = params
            state.issues.push({ id: state.issues.length + 1, draft_id: draftId, severity, issue_type: issueType, field_name: fieldName, sku_code: skuCode, message })
            return { changes: 1 }
          }
          if (/update product_archive_draft set status = case when submit_claim_token is null then \?/i.test(normalized)) {
            const [status, summaryJson, updatedAt, draftId] = params
            const draft = draftFor(draftId)
            if (!draft || draft.submit_claim_token) return { changes: 0 }
            draft.status = status
            draft.validation_summary_json = JSON.parse(summaryJson)
            draft.updated_at = updatedAt
            return { changes: 1 }
          }
          return { changes: 1 }
        },
      }
    },
  }
  return db
}

test("DeepDraw title validation uses real GBK bytes and rejects corrupted or unsupported text", () => {
  const validTitle = "【商场同款】巴拉巴拉童装男童束脚裤儿童裤子2026新款冬装长裤潮"

  assert.equal([...validTitle].length, 32)
  assert.equal(Buffer.byteLength(validTitle, "utf8"), 88)
  assert.equal(archiveService.deepdrawProductTitleGbkByteLength(validTitle), 60)
  assert.equal(archiveService.validateDeepdrawProductTitle(validTitle), validTitle)

  assert.equal(archiveService.deepdrawProductTitleGbkByteLength("€"), 1)
  assert.equal(archiveService.deepdrawProductTitleGbkByteLength("é"), 2)
  assert.equal(archiveService.validateDeepdrawProductTitle("标题€é"), "标题€é")

  assert.throws(
    () => archiveService.validateDeepdrawProductTitle("【商场同款】巴拉巴拉童装男童束脚裤儿童裤子2026新款冬装长���潮"),
    /乱码替换符/,
  )
  assert.throws(
    () => archiveService.validateDeepdrawProductTitle("标题𠀀"),
    /GBK 不支持/,
  )
  assert.throws(
    () => archiveService.validateDeepdrawProductTitle("标题😀"),
    /GBK 不支持/,
  )
  assert.throws(
    () => archiveService.validateDeepdrawProductTitle(`${validTitle}款`),
    /不能超过 60 字节/,
  )
})

test("title patch saves only the main draft title, keeps manual fields, and clears prepared payload cache", () => {
  const db = createTitlePatchDb()
  const result = archiveService.patchProductArchiveDraftTitle(db, 1, {
    title: "新标题",
    expectedDraftUpdatedAt: CLIENT_VERSION,
  })

  assert.equal(result.detail.draft.title, "新标题")
  assert.equal(db.state.draft.title, "新标题")
  assert.equal(db.state.fields[0].value_text, "手工值")
  assert.equal(db.state.fields[0].source_type, "manual")
  assert.equal(db.state.preparationRows.length, 0)

  const titleUpdate = db.state.calls.find((call) => call.method === "run" && /update product_archive_draft set title = \?/i.test(call.sql))
  assert.ok(titleUpdate)
  assert.equal(titleUpdate.params[3], EXACT_VERSION)
})

test("title patch rejects stale visible versions before changing draft data", () => {
  const db = createTitlePatchDb()
  assert.throws(
    () => archiveService.patchProductArchiveDraftTitle(db, 1, {
      title: "新标题",
      expectedDraftUpdatedAt: "2026-10-11T10:00:00.122Z",
    }),
    /草稿数据已更新/,
  )
  assert.equal(db.state.draft.title, "旧标题")
  assert.equal(db.state.preparationRows.length, 1)
  assert.equal(db.state.calls.some((call) => call.method === "run" && /update product_archive_draft set title = \?/i.test(call.sql)), false)
})

test("title patch rejects drafts held by a submit claim", () => {
  const db = createTitlePatchDb({ draft: { submit_claim_token: "claim-token" } })
  assert.throws(
    () => archiveService.patchProductArchiveDraftTitle(db, 1, {
      title: "新标题",
      expectedDraftUpdatedAt: CLIENT_VERSION,
    }),
    /正在提交/,
  )
  assert.equal(db.state.draft.title, "旧标题")
  assert.equal(db.state.preparationRows.length, 1)
})
