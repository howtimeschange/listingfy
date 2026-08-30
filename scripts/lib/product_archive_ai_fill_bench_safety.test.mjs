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
