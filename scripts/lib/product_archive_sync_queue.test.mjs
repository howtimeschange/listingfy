import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductArchiveSyncQueue,
  parseSpuCodes,
} from "./product_archive_sync_queue.mjs";

test("parseSpuCodes splits pasted text, trims noise, and deduplicates codes", () => {
  assert.deepEqual(
    parseSpuCodes(`
      208226102001
      208226103201, 208226102001
      208226104001，208226105001
      208226106001\t208226104001
    `),
    [
      "208226102001",
      "208226103201",
      "208226104001",
      "208226105001",
      "208226106001",
    ],
  );
});

test("parseSpuCodes drops script-like and path-like payloads", () => {
  assert.deepEqual(
    parseSpuCodes([
      "208226102001",
      "<iframe src=javascript:alert(1)>",
      "../config",
      "208226103201<script>alert(1)</script>",
    ]),
    ["208226102001"],
  );
});

test("queue processes product sync jobs serially with a delay between codes", async () => {
  const events = [];
  let now = 1000;
  const queue = createProductArchiveSyncQueue({
    now: () => now,
    wait: async (ms) => {
      events.push(["wait", ms]);
      now += ms;
    },
    syncOne: async ({ source, spuCode }) => {
      events.push(["sync", source, spuCode, now]);
      return { counts: { spu: 1 } };
    },
  });

  const job = queue.enqueue({
    source: "mdm",
    rawCodes: "208226102001\n208226103201\n208226102001",
    intervalMs: 250,
  });

  assert.equal(job.status, "queued");
  assert.deepEqual(job.codes, ["208226102001", "208226103201"]);
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.completed_count, 2);
  assert.equal(finished.failed_count, 0);
  assert.deepEqual(
    events,
    [
      ["sync", "mdm", "208226102001", 1000],
      ["wait", 250],
      ["sync", "mdm", "208226103201", 1250],
    ],
  );
});

test("queue keeps going after one code fails", async () => {
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ spuCode }) => {
      if (spuCode === "208226103201") {
        throw new Error("upstream failed");
      }
      return { counts: { spu: 1 } };
    },
  });

  const job = queue.enqueue({
    source: "deepdraw",
    rawCodes: ["208226102001", "208226103201", "208226104001"],
    intervalMs: 0,
  });

  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.completed_count, 2);
  assert.equal(finished.failed_count, 1);
  assert.equal(finished.items[1].status, "failed");
  assert.match(finished.items[1].error, /upstream failed/);
});

test("queue passes sync options to each item", async () => {
  const seen = [];
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ spuCode, options }) => {
      seen.push([spuCode, options.deepdrawTenantName]);
      return { ok: true };
    },
  });

  queue.enqueue({
    source: "deepdraw",
    rawCodes: ["208226102001"],
    options: { deepdrawTenantName: "迷你巴拉" },
  });
  await queue.waitForIdle();

  assert.deepEqual(seen, [["208226102001", "迷你巴拉"]]);
});

test("queue accepts combined mdm and deepdraw sync jobs", async () => {
  const events = [];
  const queue = createProductArchiveSyncQueue({
    wait: async () => {},
    syncOne: async ({ source, spuCode, options }) => {
      events.push([source, spuCode, options.deepdrawTenantName]);
      return {
        mdm: { ok: true },
        deepdraw: { ok: true },
      };
    },
  });

  const job = queue.enqueue({
    source: "mdm_deepdraw",
    rawCodes: ["208226102001"],
    options: { deepdrawTenantName: "电商巴拉巴拉" },
  });
  await queue.waitForIdle();

  const finished = queue.getJob(job.id);
  assert.equal(finished.status, "completed");
  assert.equal(finished.source, "mdm_deepdraw");
  assert.deepEqual(events, [["mdm_deepdraw", "208226102001", "电商巴拉巴拉"]]);
  assert.deepEqual(finished.items[0].result, {
    mdm: { ok: true },
    deepdraw: { ok: true },
  });
});
