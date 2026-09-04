import assert from "node:assert/strict";
import test from "node:test";

const service = await import("../../web/server/services/product-archive-drafts.ts");

function baseDraft(overrides = {}) {
  return {
    id: 1,
    spu_code: "SPU-1",
    title: "测试商品",
    tenant_name: "tenant",
    merchant_id: "merchant",
    trade_id: "trade-1",
    trade_path: "童装/服装",
    status: "draft",
    retail_price: 99,
    source_snapshot_json: {
      spu: { product_line_name: "童装" },
      sourceRows: [],
    },
    duplicate_result_json: {},
    ...overrides,
  };
}

function baseFields(overrides = {}) {
  return [
    {
      id: 11,
      draft_id: 1,
      field_name: "材质",
      field_id: "material",
      source_type: "manual",
      value_text: "",
      value_json: {},
      required: true,
      blocking: true,
      validation_status: "missing",
      ...overrides.material,
    },
    {
      id: 12,
      draft_id: 1,
      field_name: "性别",
      field_id: "gender",
      source_type: "manual",
      value_text: "未知",
      value_json: {},
      required: false,
      blocking: false,
      validation_status: "valid",
      ...overrides.gender,
    },
    ...(overrides.extra ?? []),
  ];
}

function baseTemplates(overrides = {}) {
  return [
    {
      field_name: "材质",
      field_id: "material",
      field_type: "input_text",
      required: true,
      options_json: [],
      raw_payload_json: {},
      ...overrides.material,
    },
    {
      field_name: "性别",
      field_id: "gender",
      field_type: "single_select",
      required: false,
      options_json: [{ value: "男" }, { value: "女" }],
      raw_payload_json: {},
      ...overrides.gender,
    },
    ...(overrides.extra ?? []),
  ];
}

function fixture(overrides = {}) {
  return {
    draft: baseDraft(overrides.draft),
    fields: overrides.fields ?? baseFields(overrides),
    skus: overrides.skus ?? [],
    templateLookup: overrides.templateLookup ?? new Map(
      baseTemplates(overrides).map((row) => [row.field_name, {
        options: row.options_json,
        required: row.required,
        rawPayload: row.raw_payload_json,
        fieldType: row.field_type,
      }]),
    ),
    now: "2026-09-04T00:00:00.000Z",
  };
}

function normalizeValidation(result) {
  return {
    status: result.status,
    summary: {
      blocker_count: result.summary.blocker_count,
      warning_count: result.summary.warning_count,
      info_count: result.summary.info_count,
    },
    issues: result.issues.map((issue) => ({
      severity: issue.severity,
      issueType: issue.issueType ?? issue.issue_type,
      fieldName: issue.fieldName ?? issue.field_name ?? null,
      skuCode: issue.skuCode ?? issue.sku_code ?? null,
      message: issue.message,
    })),
  };
}

function fakeDatabaseForFixture(input) {
  return fakeDatabase({
    drafts: [input.draft],
    fields: input.fields,
    skus: input.skus,
    templates: Array.from(input.templateLookup.entries()).map(([field_name, template]) => ({
      field_name,
      field_id: field_name,
      field_type: template.fieldType,
      required: template.required,
      options_json: template.options,
      raw_payload_json: template.rawPayload,
      tenant_name: input.draft.tenant_name,
      merchant_id: input.draft.merchant_id,
      trade_id: input.draft.trade_id,
    })),
  });
}

function fakeDatabase({ drafts, fields, skus, templates }) {
  const calls = [];
  const state = {
    drafts: (drafts ?? []).map((draft) => ({ ...draft })),
    fields: fields.map((field) => ({ ...field })),
    skus: skus.map((sku) => ({ ...sku })),
    templates: templates.map((template) => ({ ...template })),
  };
  const draftFor = (id) => state.drafts.find((draft) => Number(draft.id) === Number(id));
  const idsFromParams = (params) => params.map(Number).filter((id) => Number.isInteger(id) && id > 0);

  return {
    calls,
    prepare(sql) {
      return {
        all(...params) {
          calls.push({ method: "all", sql, params });
          if (/from product_archive_draft_field/i.test(sql)) {
            const ids = idsFromParams(params);
            return state.fields.filter((field) => ids.length === 0 || ids.includes(Number(field.draft_id)));
          }
          if (/from product_archive_draft_sku/i.test(sql)) {
            const ids = idsFromParams(params);
            return state.skus.filter((sku) => ids.length === 0 || ids.includes(Number(sku.draft_id)));
          }
          if (/from deepdraw_trade_field_cache/i.test(sql)) return state.templates;
          if (/from product_archive_draft\b/i.test(sql)) {
            const ids = idsFromParams(params);
            return state.drafts.filter((draft) => ids.length === 0 || ids.includes(Number(draft.id)));
          }
          return [];
        },
        get(...params) {
          calls.push({ method: "get", sql, params });
          if (/from product_archive_draft\b/i.test(sql)) return draftFor(params[0]);
          return undefined;
        },
        run(...params) {
          calls.push({ method: "run", sql, params });
          if (/update product_archive_draft\s+set\s+status/i.test(sql)) {
            const draftId = Number(params.at(-1));
            const draft = draftFor(draftId);
            if (draft) draft.status = "ready";
          }
          return { changes: 1 };
        },
      };
    },
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };
}

test("batch validation matches single validation for missing and invalid fields", async () => {
  const input = fixture();
  const singleDb = fakeDatabaseForFixture(input);
  const batchDb = fakeDatabaseForFixture(input);

  const single = service.validateProductArchiveDraft(singleDb, 1);
  const batch = await service.validateProductArchiveDraftsBatch(batchDb, [1]);

  assert.deepEqual(normalizeValidation(single), normalizeValidation(batch.items[0]));
  assert.equal(batch.validatedDraftCount, 1);
  assert.equal(batch.failedDrafts.length, 0);
  assert.ok(
    batchDb.calls.filter((call) => call.method === "all" && /from product_archive_draft_field/i.test(call.sql)).length <= 1,
    "batch validation should preload draft fields once",
  );
});

test("validation evaluator preserves duplicate exception and shoe/apparel size-chart rules", () => {
  const duplicate = fixture({
    draft: baseDraft({ duplicate_result_json: { duplicateFound: true } }),
  });
  assert.ok(service.evaluateProductArchiveDraftValidation(duplicate).issues.some((issue) => issue.issueType === "duplicate_product_found"));
  assert.equal(
    service.evaluateProductArchiveDraftValidation({ ...duplicate, allowExistingProduct: true }).issues.some((issue) => issue.issueType === "duplicate_product_found"),
    false,
  );

  const shoe = fixture({
    draft: baseDraft({
      source_snapshot_json: { spu: { product_line_name: "鞋品" }, sourceRows: [] },
    }),
    fields: [{
      id: 21,
      draft_id: 1,
      field_name: "尺码表",
      field_id: "shoe-size-chart",
      source_type: "shoe_size_chart",
      value_text: null,
      value_json: { title: "脚长,脚宽", "100": "10,5" },
      required: true,
      blocking: true,
    }],
    skus: [{
      id: 31,
      draft_id: 1,
      sku_code: "SKU-1",
      color_name: "黑",
      size_name: "100",
      size_code: "100",
      price: 99,
    }],
    templateLookup: new Map([[
      "尺码表",
      { options: [], required: true, rawPayload: {}, fieldType: "MULTI_TEXT" },
    ]]),
  });
  assert.equal(service.evaluateProductArchiveDraftValidation(shoe).issues.length, 0);

  const apparel = fixture({
    draft: baseDraft({
      source_snapshot_json: { spu: { product_line_name: "童装" }, sourceRows: [] },
    }),
    fields: [{
      id: 22,
      draft_id: 1,
      field_name: "尺码表",
      field_id: "apparel-size-chart",
      source_type: "manual",
      value_text: null,
      value_json: {},
      required: false,
      blocking: false,
    }],
    templateLookup: new Map([[
      "尺码表",
      { options: [], required: false, rawPayload: {}, fieldType: "MULTI_TEXT" },
    ]]),
  });
  assert.ok(service.evaluateProductArchiveDraftValidation(apparel).issues.some((issue) => issue.issueType === "required_field_missing"));
});

test("refresh deduplicates a draft matched by repeated source rows", async () => {
  const input = fixture({
    draft: baseDraft({ trade_id: null, trade_path: null }),
  });
  const db = fakeDatabaseForFixture(input);
  const result = await service.refreshProductArchiveDraftsBatch(db, [1, 1, 1], {
    sourceType: "copywriting",
    sourceBatchId: 7,
  });

  assert.equal(result.scannedDraftCount, 1);
  assert.equal(result.failedDrafts.length, 0);
  assert.equal(result.validatedDraftCount, 1);
});
