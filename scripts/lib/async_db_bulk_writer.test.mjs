import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import {
  copyRowsToStaging,
  sourceRowSpec,
  withAsyncTransaction,
} from "../../web/server/async-db.ts";

function fakePool() {
  const calls = [];
  const connectState = {
    released: false,
    rolledBack: false,
  };
  const client = {
    calls,
    query(sql, params) {
      calls.push({ sql, params });
      if (/rollback/i.test(sql)) connectState.rolledBack = true;
      return { rows: [], rowCount: 0 };
    },
    release() {
      connectState.released = true;
    },
  };
  return {
    calls,
    connectState,
    async connect() {
      return client;
    },
  };
}

function fakeCopyClient({ stagingCount, mergeCount, failCopyAtChunk = 0 } = {}) {
  const calls = [];
  const copiedChunks = [];
  const state = { released: false, rolledBack: false };
  return {
    calls,
    state,
    copiedText() {
      return copiedChunks.join("");
    },
    copiedChunks() {
      return copiedChunks.slice();
    },
    async query(sql, params) {
      calls.push({ sql, params });
      if (/rollback/i.test(sql)) state.rolledBack = true;
      if (/select count\(\*\)::integer as count/i.test(sql)) {
        return { rows: [{ count: stagingCount }], rowCount: 1 };
      }
      if (/insert into "?product_archive_source_row"?/i.test(sql)) {
        return { rows: [], rowCount: mergeCount };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      state.released = true;
    },
    queryCopyStream(sql) {
      calls.push({ sql, copy: true });
      return new Writable({
        write(chunk, _encoding, callback) {
          copiedChunks.push(chunk.toString("utf8"));
          if (failCopyAtChunk > 0 && copiedChunks.length >= failCopyAtChunk) {
            callback(new Error("copy stream failed"));
            return;
          }
          callback();
        },
      });
    },
  };
}

function sourceRows(count) {
  return Array.from({ length: count }, (_value, index) => ({
    sourceBatchId: 12,
    sourceType: "launch_plan",
    spuCode: `SPU-${String(index + 1).padStart(3, "0")}`,
    skcCode: null,
    rowJson: { index },
    createdAt: "2026-09-04T00:00:00.000Z",
  }));
}

test("async transaction releases the client after rollback", async () => {
  const pool = fakePool();

  await assert.rejects(
    () => withAsyncTransaction(pool, async (client) => {
      await client.query("insert into staging values ($1)", [1]);
      throw new Error("abort");
    }),
    /abort/,
  );

  assert.equal(pool.connectState.released, true);
  assert.equal(pool.connectState.rolledBack, true);
  assert.deepEqual(pool.calls.map((call) => call.sql.toLowerCase()), [
    "begin",
    "insert into staging values ($1)",
    "rollback",
  ]);
});

test("copy writer rejects unallowlisted table names", async () => {
  const client = fakeCopyClient();

  await assert.rejects(
    () => copyRowsToStaging(client, { ...sourceRowSpec, table: "user_input" }, []),
    /unsupported bulk table/i,
  );
});

test("copy writer encodes null, control characters, backslashes, and json safely", async () => {
  const client = fakeCopyClient({ stagingCount: 1, mergeCount: 1 });

  const result = await copyRowsToStaging(client, sourceRowSpec, [{
    sourceBatchId: 12,
    sourceType: "copywriting",
    spuCode: "SPU\tA\nB\\C",
    skcCode: null,
    rowJson: { title: "line\nbreak", nested: { slash: "\\" } },
    createdAt: "2026-09-04T00:00:00.000Z",
  }], { stagingTable: "pg_temp.product_archive_source_row_stage_test" });

  assert.equal(result.rowCount, 1);
  assert.equal(
    client.copiedText(),
    "12\tcopywriting\tSPU\\tA\\nB\\\\C\t\\N\t{\"title\":\"line\\\\nbreak\",\"nested\":{\"slash\":\"\\\\\\\\\"}}\t2026-09-04T00:00:00.000Z\n",
  );
});

test("copy writer validates staging row count before committing target rows", async () => {
  const client = fakeCopyClient({ stagingCount: 1, mergeCount: 1 });

  await assert.rejects(
    () => copyRowsToStaging(client, sourceRowSpec, [
      {
        sourceBatchId: 12,
        sourceType: "launch_plan",
        spuCode: "SPU-1",
        skcCode: null,
        rowJson: {},
        createdAt: "2026-09-04T00:00:00.000Z",
      },
      {
        sourceBatchId: 12,
        sourceType: "launch_plan",
        spuCode: "SPU-2",
        skcCode: null,
        rowJson: {},
        createdAt: "2026-09-04T00:00:00.000Z",
      },
    ], { stagingTable: "pg_temp.product_archive_source_row_stage_test" }),
    /staging row count mismatch/i,
  );

  assert.equal(
    client.calls.some((call) => /insert into "?product_archive_source_row"?/i.test(call.sql)),
    false,
  );
});

test("copy writer streams COPY data in chunks bounded by the bulk batch size config", async () => {
  const previous = process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
  process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = "50";
  const client = fakeCopyClient({ stagingCount: 51, mergeCount: 51 });

  try {
    const result = await copyRowsToStaging(
      client,
      sourceRowSpec,
      sourceRows(51),
      { stagingTable: "pg_temp.product_archive_source_row_stage_test" },
    );

    assert.equal(result.rowCount, 51);
    assert.equal(client.copiedChunks().length, 2);
    assert.equal(client.copiedChunks()[0].split("\n").filter(Boolean).length, 50);
    assert.equal(client.copiedChunks()[1].split("\n").filter(Boolean).length, 1);
  } finally {
    if (previous == null) delete process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
    else process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = previous;
  }
});

test("copy writer falls back to the safe default when COPY chunk config is invalid", async () => {
  const previous = process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
  process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = "2";
  const client = fakeCopyClient({ stagingCount: 60, mergeCount: 60 });

  try {
    const result = await copyRowsToStaging(
      client,
      sourceRowSpec,
      sourceRows(60),
      { stagingTable: "pg_temp.product_archive_source_row_stage_test" },
    );

    assert.equal(result.rowCount, 60);
    assert.equal(client.copiedChunks().length, 1);
  } finally {
    if (previous == null) delete process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE;
    else process.env.LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE = previous;
  }
});

test("copy stream errors roll back the transaction and release the client", async () => {
  const client = fakeCopyClient({ stagingCount: 2, mergeCount: 2, failCopyAtChunk: 1 });
  const pool = {
    async connect() {
      return client;
    },
  };
  let beforeCommitCalled = false;

  await assert.rejects(
    () => withAsyncTransaction(
      pool,
      async (tx) => copyRowsToStaging(
        tx,
        sourceRowSpec,
        sourceRows(2),
        { stagingTable: "pg_temp.product_archive_source_row_stage_test" },
      ),
      { beforeCommit: () => { beforeCommitCalled = true; } },
    ),
    /copy stream failed/,
  );

  assert.equal(beforeCommitCalled, false);
  assert.equal(client.state.rolledBack, true);
  assert.equal(client.state.released, true);
  assert.equal(client.calls.some((call) => /^commit$/i.test(call.sql)), false);
});
