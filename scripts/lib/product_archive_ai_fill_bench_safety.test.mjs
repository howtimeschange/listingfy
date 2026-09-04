import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const BENCHMARK_PATH = path.join(PROJECT_ROOT, "scripts/bench/product_archive_ai_fill_concurrency_bench.mjs");

function cleanBenchmarkEnv(overrides = {}) {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("AI_FILL_BENCH_")),
    ),
    ...overrides,
  };
}

async function runBenchmarkPreflight(env) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "listingify-ai-fill-bench-safety-"));
  try {
    return spawnSync(process.execPath, [BENCHMARK_PATH], {
      cwd: workDir,
      env: cleanBenchmarkEnv(env),
      encoding: "utf8",
      timeout: 10_000,
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

test("AI fill concurrency benchmark is explicitly named and safe by default", async () => {
  const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  const benchmark = await readFile(
    path.join(PROJECT_ROOT, "scripts/bench/product_archive_ai_fill_concurrency_bench.mjs"),
    "utf8",
  );

  assert.equal(packageJson.scripts["test:ai-fill-concurrency"], undefined);
  assert.match(packageJson.scripts["bench:ai-fill-concurrency"] ?? "", /product_archive_ai_fill_concurrency_bench\.mjs/);
  assert.match(benchmark, /envText\("AI_FILL_BENCH_STORE", "memory"\)/);
  assert.match(benchmark, /envEnabled\("AI_FILL_BENCH_REAL_AI", false\)/);
});

test("AI fill concurrency benchmark requires explicit targets and side-effect confirmation", async () => {
  const benchmark = await readFile(
    path.join(PROJECT_ROOT, "scripts/bench/product_archive_ai_fill_concurrency_bench.mjs"),
    "utf8",
  );

  assert.match(benchmark, /AI_FILL_BENCH_CONFIRM_SIDE_EFFECTS/);
  assert.match(benchmark, /AI_FILL_BENCH_CONFIRM_REAL_AI/);
  assert.match(benchmark, /AI_FILL_BENCH_DRAFT_IDS/);
  assert.match(benchmark, /AI_FILL_BENCH_DRAFT_CODES/);
  assert.match(benchmark, /explicitCount\s*===\s*0/);
  const mainIndex = benchmark.indexOf("async function main()");
  const targetGuardIndex = benchmark.indexOf("if (explicitCount === 0)", mainIndex);
  const sideEffectGuardIndex = benchmark.indexOf('"AI_FILL_BENCH_CONFIRM_SIDE_EFFECTS"', mainIndex);
  const realAiGuardIndex = benchmark.indexOf('"AI_FILL_BENCH_CONFIRM_REAL_AI"', mainIndex);
  const databaseImportIndex = benchmark.indexOf('import("../../web/server/db.ts")', mainIndex);
  assert.ok(targetGuardIndex > mainIndex && targetGuardIndex < databaseImportIndex);
  assert.ok(sideEffectGuardIndex > targetGuardIndex && sideEffectGuardIndex < databaseImportIndex);
  assert.ok(realAiGuardIndex > sideEffectGuardIndex && realAiGuardIndex < databaseImportIndex);
});

test("AI fill concurrency benchmark fails before database access without explicit targets or confirmations", async () => {
  const withoutTargets = await runBenchmarkPreflight();
  assert.notEqual(withoutTargets.status, 0);
  assert.match(withoutTargets.stderr, /AI_FILL_BENCH_DRAFT_IDS or AI_FILL_BENCH_DRAFT_CODES/);

  const withoutSideEffectConfirmation = await runBenchmarkPreflight({
    AI_FILL_BENCH_DRAFT_IDS: "1",
  });
  assert.notEqual(withoutSideEffectConfirmation.status, 0);
  assert.match(withoutSideEffectConfirmation.stderr, /AI_FILL_BENCH_CONFIRM_SIDE_EFFECTS=I_UNDERSTAND/);

  const withoutRealAiConfirmation = await runBenchmarkPreflight({
    AI_FILL_BENCH_DRAFT_IDS: "1",
    AI_FILL_BENCH_CONFIRM_SIDE_EFFECTS: "I_UNDERSTAND",
    AI_FILL_BENCH_REAL_AI: "true",
  });
  assert.notEqual(withoutRealAiConfirmation.status, 0);
  assert.match(withoutRealAiConfirmation.stderr, /AI_FILL_BENCH_CONFIRM_REAL_AI=I_UNDERSTAND/);
});

test("batch AI fill item concurrency fails closed to the default when configured out of range", async () => {
  const { createProductArchiveAiFillQueue } = await import("../../web/server/routes/product-archive-drafts.ts");
  const previousItemConcurrency = process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY;
  const previousUserMax = process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY;
  const previousBackgroundMax = process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
  process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY = "10";
  process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY = "10";
  process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = "16";
  const savedJobs = new Map();
  let active = 0;
  let maxActive = 0;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const store = {
    requiresLease: false,
    save(job) {
      savedJobs.set(job.id, structuredClone(job));
      return true;
    },
    get(id) {
      return savedJobs.get(id) ?? null;
    },
    recover() {
      return [];
    },
  };

  try {
    const queue = createProductArchiveAiFillQueue({
      store,
      getDatabase: () => ({
        prepare() {
          return { run: () => ({ changes: 1 }) };
        },
      }),
      runWithSlot: async (run) => run(new AbortController().signal),
      processDraftFieldsWithAi: async (_db, draftId) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await wait(25);
        active -= 1;
        return {
          saved: [{ field_id: draftId }],
          warnings: [],
          detail: {
            draft: {
              status: "ready",
              validation_summary_json: { blocker_count: 0, warning_count: 0 },
            },
          },
        };
      },
    });
    const job = queue.enqueue({
      actor: { id: 101, username: "item-cap" },
      ipAddress: "127.0.0.1",
      targets: Array.from({ length: 5 }, (_unused, index) => ({
        draftId: index + 1,
        spuCode: `ITEM-CAP-${index + 1}`,
        title: null,
        status: "draft",
      })),
    });

    let finalJob = queue.getJob(job.id);
    const deadline = Date.now() + 2_000;
    while (finalJob?.status !== "completed" && Date.now() < deadline) {
      await wait(5);
      finalJob = queue.getJob(job.id);
    }

    assert.equal(finalJob?.status, "completed");
    assert.equal(finalJob?.completed_count, 5);
    assert.equal(finalJob?.result.concurrency, 1);
    assert.equal(finalJob?.result.itemConcurrency, 1);
    assert.ok(maxActive <= 1, `expected item concurrency default of 1; maxActive=${maxActive}`);
  } finally {
    if (previousItemConcurrency == null) delete process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY;
    else process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY = previousItemConcurrency;
    if (previousUserMax == null) delete process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY;
    else process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY = previousUserMax;
    if (previousBackgroundMax == null) delete process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE;
    else process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = previousBackgroundMax;
  }
});

test("batch AI fill reports draft-changed mismatches as retryable without overwriting", async () => {
  const { createProductArchiveAiFillQueue } = await import("../../web/server/routes/product-archive-drafts.ts");
  const savedJobs = new Map();
  const store = {
    requiresLease: false,
    save(job) {
      savedJobs.set(job.id, structuredClone(job));
      return true;
    },
    get(id) {
      return savedJobs.get(id) ?? null;
    },
    recover() {
      return [];
    },
  };
  const queue = createProductArchiveAiFillQueue({
    store,
    getDatabase: () => ({
      prepare() {
        return { run: () => ({ changes: 1 }) };
      },
    }),
    runWithSlot: async (run) => run(new AbortController().signal),
    processDraftFieldsWithAi: async () => {
      const error = new Error("草稿内容已变化，请重试");
      error.code = "PRODUCT_ARCHIVE_DRAFT_CHANGED";
      throw error;
    },
  });

  const job = queue.enqueue({
    actor: { id: 102, username: "draft-changed" },
    ipAddress: "127.0.0.1",
    targets: [{ draftId: 1, spuCode: "DRAFT-CHANGED-1", title: null, status: "draft" }],
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  const finalJob = queue.getJob(job.id);

  assert.equal(finalJob?.status, "completed");
  assert.equal(finalJob?.outcome, "failed");
  assert.equal(finalJob?.items[0]?.status, "failed");
  assert.equal(finalJob?.items[0]?.retryable, true);
  assert.equal(finalJob?.items[0]?.reasonCode, "draft_changed");
});
