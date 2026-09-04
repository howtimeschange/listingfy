import assert from "node:assert/strict";
import test from "node:test";
import {
  insertRowsInBatches,
  sourceRowSpec,
} from "../../web/server/services/product-archive-bulk-write.ts";

function fakeDatabase(calls) {
  return {
    prepare(sql) {
      return {
        run(...params) {
          calls.push({ sql, params });
          return { changes: params.length };
        },
      };
    },
  };
}

test("bulk writer emits one parameterized statement for each chunk", () => {
  const calls = [];
  const db = fakeDatabase(calls);
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    sourceBatchId: 7,
    sourceType: "launch_plan",
    spuCode: "SPU-" + index,
    skcCode: null,
    rowJson: { "款号": "SPU-" + index },
    createdAt: "2026-09-04T00:00:00.000Z",
  }));

  const result = insertRowsInBatches(db, sourceRowSpec, rows, { batchSize: 500 });

  assert.equal(result.insertedRowCount, 1001);
  assert.equal(result.batchCount, 3);
  assert.equal(calls.length, 3);
  assert.match(calls[0].sql, /insert into product_archive_source_row/i);
  assert.doesNotMatch(calls[0].sql, /insert or replace|insert or ignore/i);
  assert.equal(calls[0].params.length, 500 * sourceRowSpec.columns.length);
  assert.equal(calls[2].params.length, sourceRowSpec.columns.length);
});

test("bulk writer keeps JSON, timestamps, and business values as bound parameters", () => {
  const calls = [];
  const db = fakeDatabase(calls);
  const row = {
    sourceBatchId: 7,
    sourceType: "copywriting",
    spuCode: "SPU-private-value",
    skcCode: "SKC-1",
    rowJson: { title: "private-value", nested: { enabled: true } },
    createdAt: "2026-09-04T00:00:00.000Z",
  };

  insertRowsInBatches(db, sourceRowSpec, [row]);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [
    row.sourceBatchId,
    row.sourceType,
    row.spuCode,
    row.skcCode,
    row.rowJson,
    row.createdAt,
  ]);
  assert.doesNotMatch(calls[0].sql, /private-value/);
  assert.match(calls[0].sql, /\?::jsonb/);
  assert.match(calls[0].sql, /\?::timestamptz/);
});

test("bulk writer rejects tables and columns outside the fixed allowlist", () => {
  const db = fakeDatabase([]);

  assert.throws(
    () => insertRowsInBatches(db, { ...sourceRowSpec, table: "user_input" }, []),
    /unsupported bulk table/i,
  );
  assert.throws(
    () => insertRowsInBatches(db, {
      ...sourceRowSpec,
      columns: [...sourceRowSpec.columns, "password"],
    }, []),
    /unsupported bulk column/i,
  );
  assert.throws(
    () => insertRowsInBatches(db, {
      ...sourceRowSpec,
      valueCasts: sourceRowSpec.valueCasts.map((cast, index) => index === 0
        ? "jsonb; drop table product_archive_source_row;--"
        : cast),
    }, []),
    /unsupported bulk cast/i,
  );
});

test("bulk writer uses the safe default when batch size env is invalid", () => {
  const previousBatchSize = process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
  process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = "5001";
  const calls = [];
  const rows = Array.from({ length: 501 }, (_, index) => ({
    sourceBatchId: 7,
    sourceType: "launch_plan",
    spuCode: "SPU-" + index,
    skcCode: null,
    rowJson: {},
    createdAt: "2026-09-04T00:00:00.000Z",
  }));

  try {
    const result = insertRowsInBatches(fakeDatabase(calls), sourceRowSpec, rows);

    assert.equal(result.batchCount, 2);
    assert.equal(calls[0].params.length, 500 * sourceRowSpec.columns.length);
    assert.equal(calls[1].params.length, sourceRowSpec.columns.length);
  } finally {
    if (previousBatchSize == null) delete process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
    else process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = previousBatchSize;
  }
});
