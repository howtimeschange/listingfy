import assert from "node:assert/strict";
import test from "node:test";
import { SyncPostgresDatabase } from "./postgres_db.mjs";

test("performance context returns one request summary without SQL parameters", async () => {
  const metrics = await import("../../web/server/lib/performance-metrics.ts");
  const seen = [];

  await metrics.withRequestPerformanceContext(
    "req-1",
    "GET /api/product-archive-drafts/1",
    async () => {
      metrics.recordPerformanceSpan("draft.summary", 12, { draftId: 1 });
      seen.push(metrics.getPerformanceContext());
    },
  );

  assert.equal(seen[0].requestId, "req-1");
  assert.equal(seen[0].spans[0].name, "draft.summary");
  assert.equal(seen[0].queryCount, 0);
  assert.doesNotMatch(JSON.stringify(seen[0]), /password|token|secret|select.*?/i);
});

test("database observer counts duration but never serializes bound values", () => {
  const observed = [];
  const databaseUrl = process.env.DATABASE_URL
    ?? "postgres://listingify:listingify@localhost:5432/listingify";
  const db = new SyncPostgresDatabase(databaseUrl, {
    connectionTimeoutMillis: 1000,
    onQuery: (event) => observed.push(event),
  });

  try {
    db.prepare("select ? as value").get("private-value");
    assert.equal(observed.length, 1);
    assert.equal(typeof observed[0].durationMs, "number");
    assert.equal(observed[0].rowCount, 1);
    assert.equal(observed[0].operation, "select");
    assert.doesNotMatch(JSON.stringify(observed[0]), /private-value/);
  } finally {
    db.close();
  }
});
