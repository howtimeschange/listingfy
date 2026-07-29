import { createHash } from "node:crypto";
import { createPostgresAiRoutingRuntime } from "./ai_routing_postgres.mjs";
import { createAiScenarioRouter } from "./ai_scenario_router.mjs";

const routersByDatabase = new WeakMap();

function canonicalAiValue(value, seen = new Set()) {
  if (value == null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "[undefined]";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) throw new TypeError("Cannot hash circular AI routing input");

  seen.add(value);
  if (Array.isArray(value)) {
    const output = value.map((item) => canonicalAiValue(item, seen));
    seen.delete(value);
    return output;
  }

  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonicalAiValue(value[key], seen);
  }
  seen.delete(value);
  return output;
}

export function hashAiRoutingValue(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalAiValue(value)))
    .digest("hex");
}

export function withAiRoutingHashes(call, {
  input = call.messages,
  candidates,
} = {}) {
  return {
    ...call,
    inputHash: hashAiRoutingValue(input),
    candidateHash: candidates == null
      ? null
      : hashAiRoutingValue(candidates),
  };
}

export function getDefaultAiScenarioRouter({
  db,
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!db || (typeof db !== "object" && typeof db !== "function")) {
    throw new TypeError("A database handle is required for persistent AI routing");
  }
  const existing = routersByDatabase.get(db);
  if (existing) return existing;

  const runtime = createPostgresAiRoutingRuntime(db);
  const router = createAiScenarioRouter({
    env,
    fetchImpl,
    ...runtime,
  });
  routersByDatabase.set(db, router);
  return router;
}
