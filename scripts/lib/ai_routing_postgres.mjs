function splitStateKey(key) {
  const separator = String(key).indexOf(":");
  if (separator <= 0) throw new Error(`Invalid AI model state key: ${key}`);
  return [
    String(key).slice(0, separator),
    String(key).slice(separator + 1),
  ];
}

function safeUsage(value) {
  const usage = value && typeof value === "object" ? value : {};
  return {
    inputTokens: Number.isFinite(Number(usage.inputTokens))
      ? Number(usage.inputTokens)
      : null,
    outputTokens: Number.isFinite(Number(usage.outputTokens))
      ? Number(usage.outputTokens)
      : null,
    totalTokens: Number.isFinite(Number(usage.totalTokens))
      ? Number(usage.totalTokens)
      : null,
  };
}

function safeAuditResult(value, depth = 0) {
  if (depth > 5 || value == null) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 1000);
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => safeAuditResult(item, depth + 1));
  }
  if (typeof value !== "object") return String(value).slice(0, 1000);

  const output = {};
  for (const [key, child] of Object.entries(value).slice(0, 100)) {
    if (
      /api.?key|authorization|secret|token|prompt|messages?|image|base64|url/i
        .test(key)
    ) {
      continue;
    }
    output[key] = safeAuditResult(child, depth + 1);
  }
  return output;
}

function auditSink(db) {
  const insert = db.prepare(`
    insert into ai_invocation_audit (
      scenario,
      mode,
      role,
      provider_key,
      model,
      status,
      http_status,
      latency_ms,
      transport_attempts,
      prompt_version,
      input_hash,
      candidate_hash,
      fallback_reason,
      error_code,
      result_json,
      usage_json
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return (event) => {
    insert.run(
      String(event?.scenario ?? "unknown"),
      String(event?.mode ?? "unknown"),
      String(event?.role ?? "unknown"),
      String(event?.providerKey ?? "unknown"),
      String(event?.model ?? "unknown"),
      String(event?.status ?? "unknown"),
      Number.isFinite(Number(event?.httpStatus)) ? Number(event.httpStatus) : null,
      Number.isFinite(Number(event?.latencyMs)) ? Number(event.latencyMs) : 0,
      Number.isFinite(Number(event?.transportAttempts))
        ? Number(event.transportAttempts)
        : 1,
      event?.promptVersion == null ? null : String(event.promptVersion),
      event?.inputHash == null ? null : String(event.inputHash),
      event?.candidateHash == null ? null : String(event.candidateHash),
      event?.fallbackReason == null ? null : String(event.fallbackReason),
      event?.errorCode == null ? null : String(event.errorCode),
      JSON.stringify(safeAuditResult(event?.result) ?? {}),
      JSON.stringify(safeUsage(event?.usage)),
    );
  };
}

function modelStateStore(db) {
  const read = db.prepare(`
    select status, blocked_until, failure_count
    from ai_model_runtime_state
    where provider_key = ?
      and model = ?
  `);
  const write = db.prepare(`
    insert into ai_model_runtime_state (
      provider_key,
      model,
      status,
      blocked_until,
      failure_count,
      updated_at
    )
    values (?, ?, ?, ?, ?, clock_timestamp())
    on conflict (provider_key, model) do update set
      status = excluded.status,
      blocked_until = excluded.blocked_until,
      failure_count = excluded.failure_count,
      updated_at = clock_timestamp()
  `);
  return {
    get(key) {
      const [providerKey, model] = splitStateKey(key);
      const row = read.get(providerKey, model);
      if (!row) return null;
      const blockedUntil = row.blocked_until == null
        ? 0
        : new Date(row.blocked_until).getTime();
      return {
        status: String(row.status),
        blockedUntil: Number.isFinite(blockedUntil) ? blockedUntil : 0,
        failureCount: Number(row.failure_count ?? 0),
      };
    },
    set(key, value) {
      const [providerKey, model] = splitStateKey(key);
      const blockedUntil = Number(value?.blockedUntil);
      write.run(
        providerKey,
        model,
        String(value?.status ?? "HEALTHY"),
        Number.isFinite(blockedUntil) && blockedUntil > 0
          ? new Date(blockedUntil).toISOString()
          : null,
        Number(value?.failureCount ?? 0),
      );
    },
  };
}

function usageStore(db) {
  const read = db.prepare(`
    select request_count, total_tokens
    from ai_provider_daily_usage
    where usage_date = ?
      and provider_key = ?
  `);
  const incrementRequest = db.prepare(`
    insert into ai_provider_daily_usage (
      usage_date,
      provider_key,
      request_count,
      total_tokens,
      updated_at
    )
    values (?, ?, 1, 0, clock_timestamp())
    on conflict (usage_date, provider_key) do update set
      request_count = ai_provider_daily_usage.request_count + 1,
      updated_at = clock_timestamp()
  `);
  const reserveRequest = db.prepare(`
    insert into ai_provider_daily_usage (
      usage_date,
      provider_key,
      request_count,
      total_tokens,
      updated_at
    )
    values (?, ?, 1, 0, clock_timestamp())
    on conflict (usage_date, provider_key) do update set
      request_count = ai_provider_daily_usage.request_count + 1,
      updated_at = clock_timestamp()
    where ai_provider_daily_usage.request_count < ?
      and ai_provider_daily_usage.total_tokens < ?
    returning request_count, total_tokens
  `);
  const addTokens = db.prepare(`
    insert into ai_provider_daily_usage (
      usage_date,
      provider_key,
      request_count,
      total_tokens,
      updated_at
    )
    values (?, ?, 0, ?, clock_timestamp())
    on conflict (usage_date, provider_key) do update set
      total_tokens = ai_provider_daily_usage.total_tokens + excluded.total_tokens,
      updated_at = clock_timestamp()
  `);
  return {
    get(date, providerKey) {
      const row = read.get(date, providerKey);
      return {
        requests: Number(row?.request_count ?? 0),
        tokens: Number(row?.total_tokens ?? 0),
      };
    },
    incrementRequest(date, providerKey) {
      incrementRequest.run(date, providerKey);
    },
    tryReserveRequest(
      date,
      providerKey,
      requestBudget,
      tokenBudget,
    ) {
      const requestLimit = postgresBudgetLimit(requestBudget);
      const tokenLimit = postgresBudgetLimit(tokenBudget);
      if (requestLimit <= 0 || tokenLimit <= 0) return false;
      return Boolean(reserveRequest.get(
        date,
        providerKey,
        requestLimit,
        tokenLimit,
      ));
    },
    addTokens(date, providerKey, tokens) {
      addTokens.run(date, providerKey, Math.max(0, Number(tokens) || 0));
    },
  };
}

function postgresBudgetLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor(parsed));
}

export function createPostgresAiRoutingRuntime(db) {
  return {
    audit: auditSink(db),
    modelStateStore: modelStateStore(db),
    usageStore: usageStore(db),
  };
}
