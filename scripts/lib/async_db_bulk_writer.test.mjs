import assert from "node:assert/strict";
import test from "node:test";
import { PassThrough, Writable } from "node:stream";
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

function fakeCopyClient({ stagingCount, mergeCount } = {}) {
  const calls = [];
  let copiedText = "";
  return {
    calls,
    copiedText() {
      return copiedText;
    },
    async query(sql, params) {
      calls.push({ sql, params });
      if (/select count\(\*\)::integer as count/i.test(sql)) {
        return { rows: [{ count: stagingCount }], rowCount: 1 };
      }
      if (/insert into "?product_archive_source_row"?/i.test(sql)) {
        return { rows: [], rowCount: mergeCount };
      }
      return { rows: [], rowCount: 0 };
    },
    queryCopyStream(sql) {
      calls.push({ sql, copy: true });
      const stream = new PassThrough();
      stream.pipe(new Writable({
        write(chunk, _encoding, callback) {
          copiedText += chunk.toString("utf8");
          callback();
        },
      }));
      return stream;
    },
  };
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
