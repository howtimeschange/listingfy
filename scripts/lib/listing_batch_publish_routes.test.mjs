import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

test("listing batch routes expose batch publish task summary sync and retry endpoints", async () => {
  const route = await readFile(path.join(PROJECT_ROOT, "web/server/routes/listing-batches.ts"), "utf8");
  assert.match(route, /post\("\/:id\/publish-tasks"/);
  assert.match(route, /get\("\/:id\/publish-summary"/);
  assert.match(route, /post\("\/:id\/sync-status"/);
  assert.match(route, /post\("\/:id\/retry-failed"/);
  assert.match(route, /ensureBatchPublishTasks/);
  assert.match(route, /publishSummaryForBatch/);
  assert.match(route, /retryFailedBatchTasks/);
  assert.match(route, /refreshBatchPublishSummary/);
});

test("single-listing publish deduplicates unresolved attempts and settles transport errors", async () => {
  const migrationDir = path.join(PROJECT_ROOT, "db/migrations");
  const publishGuardMigrations = (await readdir(migrationDir))
    .filter((file) => /^0(38|4[2-9])_.*\.sql$/.test(file))
    .sort();
  const [route, adapter, migrations] = await Promise.all([
    readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8"),
    readFile(path.join(PROJECT_ROOT, "web/server/platform-adapters/shein.ts"), "utf8"),
    Promise.all(publishGuardMigrations.map((file) => readFile(path.join(migrationDir, file), "utf8")))
      .then((sources) => sources.join("\n")),
  ]);

  assert.match(route, /findUnresolvedPublishTask\(db, listingId\)/);
  assert.match(route, /if \(!ensuredTask\.created\)/);
  assert.match(route, /DUPLICATE_ACTIVE_TASK/);
  assert.match(route, /markPublishTransportUnknown\(db,/);
  assert.match(route, /platformAdapter\.publishListing[\s\S]*catch/);
  assert.match(adapter, /publishListing\(input:[\s\S]*retries:\s*0/);
  assert.match(adapter, /addVariantsToListing\(input:[\s\S]*retries:\s*0/);
  assert.match(
    migrations,
    /where status in \('PUBLISHING', 'PUBLISH_SUBMITTED', 'PUBLISH_RESULT_UNKNOWN'\)/i,
  );
});
