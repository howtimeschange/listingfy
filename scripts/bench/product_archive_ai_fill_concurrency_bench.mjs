import { performance } from "node:perf_hooks";

import { loadLocalEnv } from "../lib/local_env.mjs";
import { createPostgresProductArchiveSyncJobStore } from "../lib/product_archive_sync_queue.mjs";
import {
  createAiScenarioRouter,
  resolveAiProviderRegistry,
  resolveAiScenarioPolicy,
} from "../lib/ai_scenario_router.mjs";

loadLocalEnv({ cwd: process.cwd(), override: false });

function envInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function envText(name, fallback = "") {
  const value = String(process.env[name] ?? "").trim();
  return value || fallback;
}

function envList(name) {
  return String(process.env[name] ?? "")
    .split(/[\s,，;；]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function envEnabled(name, fallback = true) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

const BENCH_CONFIRMATION = "I_UNDERSTAND";

function requireBenchConfirmation(name, reason) {
  if (envText(name) === BENCH_CONFIRMATION) return;
  throw new Error(`${name}=${BENCH_CONFIRMATION} is required because ${reason}.`);
}

function explicitDraftSelection() {
  const rawIds = envList("AI_FILL_BENCH_DRAFT_IDS");
  const ids = rawIds.map((value) => Number(value));
  const invalidIds = rawIds.filter((_value, index) => !Number.isInteger(ids[index]) || ids[index] <= 0);
  if (invalidIds.length > 0) {
    throw new Error(`AI_FILL_BENCH_DRAFT_IDS contains invalid IDs: ${invalidIds.join(", ")}`);
  }
  return {
    ids: Array.from(new Set(ids)),
    codes: Array.from(new Set(envList("AI_FILL_BENCH_DRAFT_CODES"))),
  };
}

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function percentile(values, value) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((value / 100) * sorted.length) - 1));
  return sorted[index];
}

function round(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function summarizeLatencies(values) {
  if (values.length === 0) {
    return { count: 0, min: 0, p50: 0, avg: 0, p90: 0, p95: 0, max: 0 };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: round(Math.min(...values)),
    p50: round(percentile(values, 50)),
    avg: round(total / values.length),
    p90: round(percentile(values, 90)),
    p95: round(percentile(values, 95)),
    max: round(Math.max(...values)),
  };
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function normalizeRows(rows) {
  return rows.map((row) => ({
    id: Number(row.id),
    draftId: Number(row.id),
    spuCode: String(row.spu_code ?? ""),
    title: row.title == null ? null : String(row.title),
    status: String(row.status ?? ""),
    tradeId: row.trade_id == null ? null : String(row.trade_id),
    tradePath: row.trade_path == null ? null : String(row.trade_path),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
    fieldCount: Number(row.field_count ?? 0),
    blankCount: Number(row.blank_count ?? 0),
  })).filter((row) => Number.isInteger(row.id) && row.id > 0 && row.spuCode);
}

function readExplicitDraftRows(db, selection) {
  const { ids, codes } = selection;
  if (ids.length === 0 && codes.length === 0) return [];

  const clauses = [];
  const params = [];
  if (ids.length > 0) {
    clauses.push(`d.id in (${placeholders(ids)})`);
    params.push(...ids);
  }
  if (codes.length > 0) {
    clauses.push(`d.spu_code in (${placeholders(codes)})`);
    params.push(...codes);
  }

  return normalizeRows(db.prepare(`
    select
      d.id,
      d.spu_code,
      d.title,
      d.status,
      d.trade_id,
      d.trade_path,
      d.updated_at,
      count(f.id)::int as field_count,
      sum(case
        when coalesce(nullif(f.value_text, ''), '') = ''
          and (f.value_json is null or f.value_json::text in ('{}', '[]', 'null'))
          then 1
        else 0
      end)::int as blank_count
    from product_archive_draft d
    left join product_archive_draft_field f on f.draft_id = d.id
    where (${clauses.join(" or ")})
      and d.submit_claim_token is null
      and d.trade_id is not null
    group by d.id
    order by d.updated_at desc, d.id desc
  `).all(...params));
}

function detailArray(detail, key) {
  const value = detail?.[key];
  return Array.isArray(value) ? value : [];
}

function selectDraftTargets({
  db,
  service,
  selection,
  allowNoAiCandidates,
}) {
  const rows = readExplicitDraftRows(db, selection);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const targetRows = [];
  for (const id of selection.ids) {
    const row = rowsById.get(id);
    if (!row) {
      throw new Error(`Explicit benchmark draft ID ${id} was not found or is not runnable.`);
    }
    targetRows.push(row);
  }
  for (const code of selection.codes) {
    const matches = rows.filter((row) => row.spuCode === code);
    if (matches.length === 0) {
      throw new Error(`Explicit benchmark draft code ${code} was not found or is not runnable.`);
    }
    if (matches.length > 1) {
      throw new Error(`Explicit benchmark draft code ${code} is ambiguous; use AI_FILL_BENCH_DRAFT_IDS with one of: ${matches.map((row) => row.id).join(", ")}.`);
    }
    targetRows.push(matches[0]);
  }

  const selected = [];
  const skipped = [];

  for (const row of Array.from(new Map(targetRows.map((target) => [target.id, target])).values())) {
    try {
      const validation = service.validateProductArchiveDraft(db, row.id);
      const detail = validation.detail ?? {};
      const fields = detailArray(detail, "fields");
      const issues = detailArray(detail, "issues");
      const skus = detailArray(detail, "skus");
      const candidates = service.buildProductArchiveAiFillCandidateFields(fields, issues, skus);
      const candidateCount = candidates.length;
      if (!allowNoAiCandidates && candidateCount === 0) {
        skipped.push({ id: row.id, spuCode: row.spuCode, reason: "no_ai_candidates" });
        continue;
      }
      selected.push({
        ...row,
        candidateCount,
        issueCount: issues.length,
        imageCount: detailArray(detail, "images").length,
      });
    } catch (error) {
      skipped.push({
        id: row.id,
        spuCode: row.spuCode,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { selected, skipped, targetCount: new Set(targetRows.map((target) => target.id)).size };
}

function distributeTargets(targets, users) {
  return Array.from({ length: users }, (_unused, index) => ({
    userIndex: index + 1,
    userLabel: `bench-user-${index + 1}`,
    targets: [],
  })).map((bucket, index, buckets) => {
    for (let targetIndex = index; targetIndex < targets.length; targetIndex += buckets.length) {
      bucket.targets.push(targets[targetIndex]);
    }
    return bucket;
  }).filter((bucket) => bucket.targets.length > 0);
}

function makeMemoryStore() {
  const savedJobs = new Map();
  return {
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
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function tableColumns(db, tableName) {
  return db.prepare(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ?
    order by ordinal_position
  `).all(tableName).map((column) => ({
    name: String(column.column_name),
    dataType: String(column.data_type),
  }));
}

function columnPlaceholder(column) {
  if (column.dataType === "json" || column.dataType === "jsonb") return "?::jsonb";
  if (/timestamp/i.test(column.dataType)) return "?::timestamptz";
  return "?";
}

function columnValue(row, column) {
  const value = row[column.name];
  if ((column.dataType === "json" || column.dataType === "jsonb") && value != null) {
    return JSON.stringify(value);
  }
  return value;
}

function rowsByDraftIds(db, tableName, columnName, draftIds) {
  if (draftIds.length === 0) return [];
  return db.prepare(`
    select *
    from ${quoteIdent(tableName)}
    where ${quoteIdent(columnName)} in (${placeholders(draftIds)})
  `).all(...draftIds);
}

function snapshotDraftState(db, draftIds) {
  const ids = Array.from(new Set(draftIds.filter((id) => Number.isInteger(id) && id > 0)));
  return {
    draftIds: ids,
    columns: {
      product_archive_draft: tableColumns(db, "product_archive_draft"),
      product_archive_draft_field: tableColumns(db, "product_archive_draft_field"),
      product_archive_validation_issue: tableColumns(db, "product_archive_validation_issue"),
    },
    drafts: rowsByDraftIds(db, "product_archive_draft", "id", ids),
    fields: rowsByDraftIds(db, "product_archive_draft_field", "draft_id", ids),
    issues: rowsByDraftIds(db, "product_archive_validation_issue", "draft_id", ids),
  };
}

function insertRows(db, tableName, columns, rows) {
  if (rows.length === 0) return;
  const statement = db.prepare(`
    insert into ${quoteIdent(tableName)} (
      ${columns.map((column) => quoteIdent(column.name)).join(", ")}
    ) values (
      ${columns.map(columnPlaceholder).join(", ")}
    )
  `);
  for (const row of rows) {
    statement.run(...columns.map((column) => columnValue(row, column)));
  }
}

function restoreDraftState(db, snapshot) {
  if (!snapshot?.draftIds?.length) return;
  const draftColumns = snapshot.columns.product_archive_draft.filter((column) => column.name !== "id");
  const updateDraft = db.prepare(`
    update product_archive_draft
    set ${draftColumns.map((column) => `${quoteIdent(column.name)} = ${columnPlaceholder(column)}`).join(", ")}
    where id = ?
  `);
  db.transaction(() => {
    db.prepare(`
      delete from product_archive_validation_issue
      where draft_id in (${placeholders(snapshot.draftIds)})
    `).run(...snapshot.draftIds);
    db.prepare(`
      delete from product_archive_draft_field
      where draft_id in (${placeholders(snapshot.draftIds)})
    `).run(...snapshot.draftIds);
    for (const row of snapshot.drafts) {
      updateDraft.run(
        ...draftColumns.map((column) => columnValue(row, column)),
        row.id,
      );
    }
    insertRows(
      db,
      "product_archive_draft_field",
      snapshot.columns.product_archive_draft_field,
      snapshot.fields,
    );
    insertRows(
      db,
      "product_archive_validation_issue",
      snapshot.columns.product_archive_validation_issue,
      snapshot.issues,
    );
  })();
}

function printAiRoute() {
  const registry = resolveAiProviderRegistry(process.env);
  const policy = resolveAiScenarioPolicy("deepdraw_field_fill", process.env);
  console.log("--- AI route ---");
  console.log(`Scenario: ${policy.scenario}`);
  console.log(`Mode: ${policy.mode}`);
  console.log(`Legacy config: ${process.env.AI_BASE_URL ?? "https://api.1xm.ai/v1"} / ${process.env.AI_MODEL ?? "gemini-3-flash-preview"}`);
  console.log("Guarded route:");
  for (const [index, route] of policy.guardedRoute.entries()) {
    const provider = registry[route.providerKey];
    console.log(
      `  ${index + 1}. ${route.providerKey} / ${route.model} / base=${provider?.baseUrl ?? "(missing)"} / hasApiKey=${Boolean(provider?.apiKey)}`,
    );
  }
}

function firstSuccessfulAttempt(response) {
  return [...(response.routing?.attempts ?? [])]
    .reverse()
    .find((attempt) => attempt.status === "SUCCEEDED") ?? null;
}

async function main() {
  const users = envInteger("AI_FILL_BENCH_USERS", 2, { min: 1, max: 8 });
  const perUserConcurrency = envInteger("LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_CONCURRENCY", 2, { min: 1, max: 10 });
  if (!process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_CONCURRENCY) {
    process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_CONCURRENCY = String(perUserConcurrency);
  }
  const plannedGlobalConcurrency = Math.min(16, Math.max(1, users * perUserConcurrency));
  if (!process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE) {
    process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE = String(plannedGlobalConcurrency);
  }
  const perUserMaxConcurrency = envInteger(
    "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY",
    Math.min(10, Number(process.env.LISTINGIFY_BACKGROUND_MAX_ACTIVE) || plannedGlobalConcurrency),
    { min: 1, max: 10 },
  );
  if (!process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY) {
    process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY = String(perUserMaxConcurrency);
  }

  const timeoutMs = envInteger("AI_FILL_BENCH_TIMEOUT_MS", 30 * 60 * 1000, { min: 5000, max: 60 * 60 * 1000 });
  const storeMode = envText("AI_FILL_BENCH_STORE", "memory");
  const queueName = envText("AI_FILL_BENCH_QUEUE_NAME", "product_archive_ai_fill");
  const restoreAfter = envEnabled("AI_FILL_BENCH_RESTORE_AFTER", true);
  const allowNoAiCandidates = envEnabled("AI_FILL_BENCH_ALLOW_NO_AI_CANDIDATES", false);
  const useRealAi = envEnabled("AI_FILL_BENCH_REAL_AI", false);
  const mockAiLatencyMs = envInteger("AI_FILL_BENCH_MOCK_AI_LATENCY_MS", 250, { min: 1, max: 60000 });
  const selection = explicitDraftSelection();
  const explicitCount = selection.ids.length + selection.codes.length;
  if (explicitCount === 0) {
    throw new Error("AI_FILL_BENCH_DRAFT_IDS or AI_FILL_BENCH_DRAFT_CODES must explicitly select benchmark drafts.");
  }
  if (storeMode !== "memory" && storeMode !== "postgres") {
    throw new Error("AI_FILL_BENCH_STORE must be memory or postgres.");
  }
  requireBenchConfirmation(
    "AI_FILL_BENCH_CONFIRM_SIDE_EFFECTS",
    "the benchmark validates and may update the selected PostgreSQL drafts and write operation logs",
  );
  if (useRealAi) {
    requireBenchConfirmation(
      "AI_FILL_BENCH_CONFIRM_REAL_AI",
      "real AI calls can incur cost and external side effects",
    );
  }

  const [
    { createProductArchiveAiFillQueue },
    { backgroundTaskLimiterSnapshot, withBackgroundTaskSlot },
    dbModule,
    service,
    ocrModule,
  ] = await Promise.all([
    import("../../web/server/routes/product-archive-drafts.ts"),
    import("../../web/server/lib/background-task-limiter.ts"),
    import("../../web/server/db.ts"),
    import("../../web/server/services/product-archive-drafts.ts"),
    import("../lib/product_archive_hangtag_ocr.mjs"),
  ]);
  const { getDb, closeDb } = dbModule;
  const db = getDb();
  let draftSnapshot = null;

  try {
    printAiRoute();

    const { selected, skipped, targetCount } = selectDraftTargets({
      db,
      service,
      selection,
      allowNoAiCandidates,
    });
    if (selected.length === 0) {
      console.error("No runnable local drafts were found for the AI fill benchmark.");
      if (skipped.length > 0) console.error(`Skipped examples: ${JSON.stringify(skipped.slice(0, 10))}`);
      process.exitCode = 1;
      return;
    }
    if (selected.length < targetCount) {
      console.error(`Only ${selected.length}/${targetCount} explicitly selected drafts are runnable.`);
      if (skipped.length > 0) console.error(`Skipped examples: ${JSON.stringify(skipped.slice(0, 10))}`);
      process.exitCode = 1;
      return;
    }

    if (restoreAfter) {
      draftSnapshot = snapshotDraftState(db, selected.map((target) => target.id));
    }
    ocrModule.clearProductArchiveOcrRuntimeCache?.();

    const buckets = distributeTargets(selected, users);
    const snapshot = backgroundTaskLimiterSnapshot();
    const internalErrors = [];
    const taskEvents = [];
    const taskRequests = [];
    const aiRequests = [];
    const taskMaxActiveByUser = new Map();
    const aiMaxActiveByUser = new Map();
    const activeTaskByUser = new Map();
    const activeAiByUser = new Map();
    const providerCounts = new Map();
    const statusCounts = new Map();
    let activeTaskTotal = 0;
    let maxActiveTaskTotal = 0;
    let activeAiTotal = 0;
    let maxActiveAiTotal = 0;

    console.log("");
    console.log("--- Benchmark config ---");
    console.log(`Users: ${buckets.length}`);
    console.log(`Total drafts: ${selected.length}`);
    console.log(`Per-user planning concurrency: ${process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_CONCURRENCY}`);
    console.log(`Per-user dynamic max concurrency: ${process.env.LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_USER_MAX_CONCURRENCY}`);
    console.log(`Global background max active: ${snapshot.maxActive}`);
    console.log(`Store: ${storeMode} (${queueName})`);
    console.log(`AI mode: ${useRealAi ? "real service prompt" : "mock provider inside real queue"}`);
    console.log(`Restore draft state after run: ${restoreAfter ? "yes" : "no"}`);
    console.log("Selected drafts:");
    for (const target of selected) {
      console.log(
        `  ${target.id} / ${target.spuCode} / ${target.status} / candidates=${target.candidateCount} / issues=${target.issueCount} / images=${target.imageCount} / ${target.tradePath}`,
      );
    }
    if (skipped.length > 0) {
      console.log(`Skipped during preflight: ${JSON.stringify(skipped.slice(0, 5))}`);
    }

    const router = createAiScenarioRouter({
      env: process.env,
      fetchImpl: globalThis.fetch,
    });
    const targetByDraftId = new Map(
      buckets.flatMap((bucket) => bucket.targets.map((target) => [target.id, { ...target, bucket }])),
    );
    const store = storeMode === "memory"
      ? makeMemoryStore()
      : createPostgresProductArchiveSyncJobStore({
          getDb,
          queueName,
        });

    const queue = createProductArchiveAiFillQueue({
      store,
      getDatabase: getDb,
      onInternalError(error, context) {
        internalErrors.push({
          message: error instanceof Error ? error.message : String(error),
          context,
        });
      },
      runWithSlot: (run, options) => withBackgroundTaskSlot("product_archive_ai_fill", run, options),
      processDraftFieldsWithAi: async (draftDb, draftId, options) => {
        const target = targetByDraftId.get(draftId) ?? { bucket: { userLabel: "unknown", userIndex: 0 } };
        const userLabel = target.bucket.userLabel;
        const started = performance.now();
        activeTaskTotal += 1;
        maxActiveTaskTotal = Math.max(maxActiveTaskTotal, activeTaskTotal);
        activeTaskByUser.set(userLabel, (activeTaskByUser.get(userLabel) ?? 0) + 1);
        taskMaxActiveByUser.set(
          userLabel,
          Math.max(taskMaxActiveByUser.get(userLabel) ?? 0, activeTaskByUser.get(userLabel) ?? 0),
        );
        taskEvents.push({ type: "start", draftId, spuCode: target.spuCode, user: userLabel, atMs: round(started, 3), activeTaskTotal });

        let aiCallCount = 0;
        const measuredRouter = {
          async callJson(input) {
            aiCallCount += 1;
            const aiStarted = performance.now();
            activeAiTotal += 1;
            maxActiveAiTotal = Math.max(maxActiveAiTotal, activeAiTotal);
            activeAiByUser.set(userLabel, (activeAiByUser.get(userLabel) ?? 0) + 1);
            aiMaxActiveByUser.set(
              userLabel,
              Math.max(aiMaxActiveByUser.get(userLabel) ?? 0, activeAiByUser.get(userLabel) ?? 0),
            );
            try {
              let response;
              if (useRealAi) {
                response = await router.callJson(input);
              } else {
                await sleep(mockAiLatencyMs, options?.signal);
                response = {
                  json: { fills: [] },
                  provider: { key: "mock", model: "mock-ai-fill" },
                  routing: {
                    attempts: [{
                      providerKey: "mock",
                      model: "mock-ai-fill",
                      status: "SUCCEEDED",
                      latencyMs: mockAiLatencyMs,
                      transportAttempts: 1,
                    }],
                  },
                };
              }
              const elapsedMs = performance.now() - aiStarted;
              const successAttempt = firstSuccessfulAttempt(response);
              const providerKey = response.provider?.key ?? successAttempt?.providerKey ?? "unknown";
              const model = response.provider?.model ?? successAttempt?.model ?? "unknown";
              increment(providerCounts, `${providerKey}/${model}`);
              increment(statusCounts, successAttempt?.status ?? "SUCCEEDED");
              aiRequests.push({
                draftId,
                spuCode: target.spuCode,
                user: userLabel,
                scenario: String(input?.scenario ?? ""),
                ok: true,
                providerKey,
                model,
                elapsedMs,
                providerLatencyMs: Number(successAttempt?.latencyMs ?? elapsedMs) || elapsedMs,
                transportAttempts: Number(successAttempt?.transportAttempts ?? 1) || 1,
                attempts: response.routing?.attempts ?? [],
              });
              return response;
            } catch (error) {
              const elapsedMs = performance.now() - aiStarted;
              const attempts = Array.isArray(error?.attempts) ? error.attempts : [];
              for (const attempt of attempts) {
                increment(statusCounts, attempt.status ?? "FAILED");
              }
              aiRequests.push({
                draftId,
                spuCode: target.spuCode,
                user: userLabel,
                scenario: String(input?.scenario ?? ""),
                ok: false,
                elapsedMs,
                attempts,
                error: error instanceof Error ? error.message : String(error),
              });
              throw error;
            } finally {
              activeAiTotal = Math.max(0, activeAiTotal - 1);
              activeAiByUser.set(userLabel, Math.max(0, (activeAiByUser.get(userLabel) ?? 0) - 1));
            }
          },
        };

        try {
          const result = await service.fillProductArchiveDraftFieldsWithAi(draftDb, draftId, {
            ...options,
            router: measuredRouter,
          });
          const elapsedMs = performance.now() - started;
          taskRequests.push({
            draftId,
            spuCode: target.spuCode,
            user: userLabel,
            ok: true,
            elapsedMs,
            aiCallCount,
            savedCount: Array.isArray(result.saved) ? result.saved.length : 0,
            warningCodes: Array.isArray(result.warnings) ? result.warnings.map((warning) => warning.code) : [],
            finalStatus: result.detail?.draft?.status ?? null,
          });
          return result;
        } catch (error) {
          const elapsedMs = performance.now() - started;
          taskRequests.push({
            draftId,
            spuCode: target.spuCode,
            user: userLabel,
            ok: false,
            elapsedMs,
            aiCallCount,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          const finished = performance.now();
          activeTaskTotal = Math.max(0, activeTaskTotal - 1);
          activeTaskByUser.set(userLabel, Math.max(0, (activeTaskByUser.get(userLabel) ?? 0) - 1));
          taskEvents.push({ type: "finish", draftId, spuCode: target.spuCode, user: userLabel, atMs: round(finished, 3), activeTaskTotal });
        }
      },
    });

    const jobs = buckets.map((bucket) => queue.enqueue({
      actor: { id: null, username: bucket.userLabel },
      ipAddress: "127.0.0.1",
      targets: bucket.targets.map((target) => ({
        draftId: target.id,
        spuCode: target.spuCode,
        title: target.title,
        status: target.status,
      })),
    }));

    const benchStarted = performance.now();
    let lastProgress = 0;
    while (performance.now() - benchStarted < timeoutMs) {
      const snapshots = jobs.map((job) => queue.getJob(job.id));
      const completed = snapshots.filter((job) => job?.status === "completed").length;
      const itemsDone = snapshots.reduce((sum, job) => sum + Number(job?.completed_count ?? 0) + Number(job?.failed_count ?? 0), 0);
      const elapsed = performance.now() - benchStarted;
      if (elapsed - lastProgress >= 5000) {
        lastProgress = elapsed;
        console.log(`[progress] elapsed=${round(elapsed / 1000, 1)}s jobs=${completed}/${jobs.length} items=${itemsDone}/${selected.length} activeTasks=${activeTaskTotal} activeAi=${activeAiTotal}`);
      }
      if (completed === jobs.length) break;
      await sleep(100);
    }

    const finalJobs = jobs.map((job) => queue.getJob(job.id));
    const wallMs = performance.now() - benchStarted;
    const completedItems = finalJobs.reduce((sum, job) => sum + Number(job?.completed_count ?? 0), 0);
    const failedItems = finalJobs.reduce((sum, job) => sum + Number(job?.failed_count ?? 0), 0);
    const okTasks = taskRequests.filter((request) => request.ok);
    const failedTasks = taskRequests.filter((request) => !request.ok);
    const fillAiRequests = aiRequests.filter((request) => request.scenario === "deepdraw_field_fill");
    const okAiRequests = aiRequests.filter((request) => request.ok);
    const failedAiRequests = aiRequests.filter((request) => !request.ok);
    const failedFillAiRequests = fillAiRequests.filter((request) => !request.ok);
    const taskLatencies = okTasks.map((request) => request.elapsedMs);
    const aiWallLatencies = okAiRequests.map((request) => request.elapsedMs);
    const providerLatencies = okAiRequests.map((request) => request.providerLatencyMs);
    const throughput = (completedItems + failedItems) / Math.max(0.001, wallMs / 1000);

    console.log("");
    console.log("--- Benchmark result ---");
    console.log(`Jobs completed: ${finalJobs.filter((job) => job?.status === "completed").length}/${jobs.length}`);
    console.log(`Items completed: ${completedItems}`);
    console.log(`Items failed: ${failedItems}`);
    console.log(`AI provider calls: ${okAiRequests.length} ok / ${failedAiRequests.length} failed`);
    console.log(`DeepDraw field-fill AI calls: ${fillAiRequests.filter((request) => request.ok).length} ok / ${failedFillAiRequests.length} failed`);
    console.log(`Wall time: ${round(wallMs / 1000, 2)}s`);
    console.log(`Throughput: ${round(throughput, 2)} drafts/s`);
    console.log(`Max active fill tasks: ${maxActiveTaskTotal}`);
    console.log(`Max active AI provider calls: ${maxActiveAiTotal}`);
    console.log(`Max active fill tasks by user: ${JSON.stringify(Object.fromEntries(taskMaxActiveByUser.entries()))}`);
    console.log(`Max active AI provider calls by user: ${JSON.stringify(Object.fromEntries(aiMaxActiveByUser.entries()))}`);
    console.log(`Fill task latency ms: ${JSON.stringify(summarizeLatencies(taskLatencies))}`);
    console.log(`AI call wall latency ms: ${JSON.stringify(summarizeLatencies(aiWallLatencies))}`);
    console.log(`Provider latency ms: ${JSON.stringify(summarizeLatencies(providerLatencies))}`);
    console.log(`Provider/model successes: ${JSON.stringify(Object.fromEntries(providerCounts.entries()))}`);
    console.log(`Attempt statuses: ${JSON.stringify(Object.fromEntries(statusCounts.entries()))}`);
    console.log(`First starts: ${JSON.stringify(taskEvents.filter((event) => event.type === "start").slice(0, Math.min(selected.length, Math.max(snapshot.maxActive, buckets.length * perUserConcurrency))))}`);
    console.log("Task details:");
    for (const request of taskRequests.sort((left, right) => left.draftId - right.draftId)) {
      console.log(JSON.stringify({
        draftId: request.draftId,
        spuCode: request.spuCode,
        user: request.user,
        ok: request.ok,
        elapsedMs: round(request.elapsedMs),
        aiCallCount: request.aiCallCount,
        savedCount: request.savedCount,
        warningCodes: request.warningCodes,
        finalStatus: request.finalStatus,
        error: request.error,
      }));
    }

    if (failedTasks.length > 0 || failedAiRequests.length > 0) {
      console.log("");
      console.log("--- Failures ---");
      for (const request of [...failedTasks, ...failedAiRequests].slice(0, 8)) {
        console.log(JSON.stringify({
          draftId: request.draftId,
          spuCode: request.spuCode,
          user: request.user,
          scenario: request.scenario,
          error: request.error,
          attempts: request.attempts,
        }));
      }
    }

    if (internalErrors.length > 0) {
      console.log("");
      console.log("--- Internal errors ---");
      for (const error of internalErrors.slice(0, 5)) {
        console.log(JSON.stringify(error));
      }
    }

    if (
      finalJobs.some((job) => job?.status !== "completed")
      || failedItems > 0
      || failedFillAiRequests.length > 0
      || (useRealAi && fillAiRequests.length === 0)
      || internalErrors.length > 0
    ) {
      process.exitCode = 1;
    }
  } finally {
    if (draftSnapshot) {
      restoreDraftState(db, draftSnapshot);
      console.log("");
      console.log(`Restored draft state for ${draftSnapshot.draftIds.length} benchmark drafts.`);
    }
    closeDb();
  }
}

await main();
