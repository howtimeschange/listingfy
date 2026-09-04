import assert from "node:assert/strict";
import test from "node:test";

const prepared = await import("../../web/server/services/product-archive-prepared-draft.ts");

function stableNow(value = "2026-09-04T10:00:00.000Z") {
  return () => value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeDb() {
  const state = {
    draft: {
      id: 1,
      updated_at: "2026-09-04T09:00:00.000Z",
      spu_code: "SPU-1",
      tenant_name: "tenant",
      merchant_id: "merchant",
      trade_id: "trade-1",
      trade_path: "童装/上衣",
      source_batch_ids_json: { launch_plan: [2], copywriting: [1] },
      source_snapshot_json: { imagePackageVersion: "image-v1" },
    },
    fields: [
      {
        id: 11,
        field_name: "材质",
        field_id: "material",
        value_text: "聚酯纤维",
        value_json: {},
        source_type: "manual",
        updated_at: "2026-09-04T09:00:00.000Z",
      },
    ],
    skus: [
      {
        id: 21,
        sku_code: "SKU-1",
        skc_code: "SKC-1",
        color_name: "红",
        size_name: "120",
        barcode: "690000000001",
        price: 99,
        updated_at: "2026-09-04T09:00:00.000Z",
      },
    ],
    mappings: [
      {
        id: 31,
        tenant_name: "tenant",
        merchant_id: "merchant",
        trade_id: "trade-1",
        field_name: "尺码表",
        target_field: "衣长",
        source_point: "后中长",
        confidence: 0.9,
        source: "manual",
        review_status: "approved",
        evidence_json: { by: "tester" },
        updated_at: "2026-09-04T09:00:00.000Z",
      },
    ],
    snapshots: new Map(),
  };
  const calls = { prepare: 0, upsert: 0 };
  const db = {
    state,
    calls,
    transaction(fn) {
      return () => fn();
    },
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        get(...params) {
          if (/from product_archive_draft_preparation/i.test(normalized)) {
            const row = state.snapshots.get(Number(params[0]));
            if (!row) return undefined;
            if (row.input_hash !== params[1]) return undefined;
            if (row.submit_mode !== params[2]) return undefined;
            if (Date.parse(row.expires_at) <= Date.parse(params[4])) return undefined;
            return clone(row);
          }
          if (/from product_archive_draft\b/i.test(normalized)) return clone(state.draft);
          return undefined;
        },
        all(...params) {
          if (/from product_archive_draft_field/i.test(normalized)) return clone(state.fields);
          if (/from product_archive_draft_sku/i.test(normalized)) return clone(state.skus);
          if (/from product_archive_draft_image/i.test(normalized)) return [];
          if (/from product_archive_size_chart_mapping/i.test(normalized)) return clone(state.mappings);
          return [];
        },
        run(...params) {
          if (/insert into product_archive_draft_preparation/i.test(normalized)) {
            calls.upsert += 1;
            const [draftId, draftUpdatedAt, inputHash, templateVersion, submitMode, payloadJson, validationJson, preparedAt, expiresAt] = params;
            assert.ok(Number.isFinite(Date.parse(draftUpdatedAt)), "draft_updated_at must be a timestamp");
            assert.doesNotMatch(draftUpdatedAt, /^[a-f0-9]{64}$/i, "draft_updated_at must not store a SHA-256 hash");
            state.snapshots.set(Number(draftId), {
              draft_id: Number(draftId),
              draft_updated_at: draftUpdatedAt,
              input_hash: inputHash,
              template_version: templateVersion,
              submit_mode: submitMode,
              payload_json: JSON.parse(payloadJson),
              validation_json: JSON.parse(validationJson),
              prepared_at: preparedAt,
              expires_at: expiresAt,
            });
            return { changes: 1 };
          }
          return { changes: 1 };
        },
      };
    },
  };
  return db;
}

function makePrepare(db, payloadSuffix = "") {
  return () => {
    db.calls.prepare += 1;
    return {
      payload: { code: db.state.draft.spu_code, fields: [{ name: "材质", value: db.state.fields[0].value_text }], skus: [], payloadSuffix },
      validation: { status: "ready", summary: { blocker_count: 0 }, issues: [] },
    };
  };
}

test("unchanged draft reuses one preparation", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db),
  });
  const second = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db, "must-not-run"),
  });

  assert.equal(db.calls.prepare, 1);
  assert.equal(db.calls.upsert, 1);
  assert.equal(first.draftVersion, "2026-09-04T09:00:00.000Z");
  assert.equal(second.preparedAt, first.preparedAt);
  assert.equal(second.inputHash, first.inputHash);
  assert.deepEqual(second.payload, first.payload);
});

test("size-chart mapping mutation invalidates the preparation hash", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db),
  });

  db.state.mappings[0].source_point = "身长";
  db.state.mappings[0].updated_at = "2026-09-04T09:06:00.000Z";

  assert.equal(prepared.loadReusablePreparedProductArchiveDraft(db, 1, first.inputHash, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
  }), null);
});

test("claim revalidation rejects a snapshot when a draft mutation wins the pre-claim race", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db),
  });

  db.state.fields[0].value_text = "棉";
  db.state.fields[0].updated_at = "2026-09-04T09:07:00.000Z";
  db.state.draft.updated_at = "2026-09-04T09:07:00.000Z";

  assert.equal(prepared.revalidatePreparedProductArchiveDraftForClaim(db, 1, first, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    claimedDraftUpdatedAt: "2026-09-04T09:07:00.000Z",
    now: stableNow(),
  }), null);
});

test("claim revalidation accepts a precheck snapshot when only submit claim changes the draft timestamp", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db),
  });

  db.state.draft.updated_at = "2026-09-04T09:08:00.000Z";

  const reused = prepared.revalidatePreparedProductArchiveDraftForClaim(db, 1, first, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    claimedDraftUpdatedAt: "2026-09-04T09:00:00.000Z",
    now: stableNow(),
  });

  assert.equal(reused?.inputHash, first.inputHash);
  assert.equal(reused?.preparedAt, first.preparedAt);
});

test("field mutation invalidates the preparation hash", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
    prepare: makePrepare(db),
  });

  db.state.fields[0].value_text = "棉";
  db.state.fields[0].updated_at = "2026-09-04T09:05:00.000Z";
  db.state.draft.updated_at = "2026-09-04T09:05:00.000Z";

  assert.equal(prepared.loadReusablePreparedProductArchiveDraft(db, 1, first.inputHash, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow(),
  }), null);
});

test("expired or submit-mode-mismatched preparation is not reused", () => {
  const db = createFakeDb();
  const first = prepared.prepareProductArchiveDraft(db, 1, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow("2026-09-04T10:00:00.000Z"),
    prepare: makePrepare(db),
  });

  assert.equal(prepared.loadReusablePreparedProductArchiveDraft(db, 1, first.inputHash, {
    submitMode: "full_update",
    templateVersion: "deepdraw-v1",
    now: stableNow("2026-09-04T10:01:00.000Z"),
  }), null);
  assert.equal(prepared.loadReusablePreparedProductArchiveDraft(db, 1, first.inputHash, {
    submitMode: "create",
    templateVersion: "deepdraw-v1",
    now: stableNow("2026-09-04T10:31:00.000Z"),
  }), null);
});
