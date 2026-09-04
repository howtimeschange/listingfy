import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV,
  PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV,
  PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV,
  PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV,
  PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV,
  readProductArchiveAiFillItemConcurrency,
  readProductArchiveBulkInsertBatchSize,
  readProductArchiveJobLeaseMs,
  readProductArchivePublishConcurrency,
  readProductArchiveSyncConcurrency,
  validateProductArchivePerformanceEnv,
} from "./product_archive_performance_config.mjs";

test("product archive performance config exposes explicit safe defaults", () => {
  const result = validateProductArchivePerformanceEnv({ env: {}, warn: null });

  assert.equal(result.values[PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV], 500);
  assert.equal(result.values[PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV], 60000);
  assert.deepEqual(result.warnings, []);
});

test("product archive performance config accepts only documented ranges", () => {
  assert.equal(readProductArchiveSyncConcurrency("4"), 4);
  assert.equal(readProductArchivePublishConcurrency("4"), 4);
  assert.equal(readProductArchiveAiFillItemConcurrency("2"), 2);
  assert.equal(readProductArchiveBulkInsertBatchSize("5000"), 5000);
  assert.equal(readProductArchiveJobLeaseMs("3600000"), 3600000);
});

test("invalid product archive performance env values fail closed with redacted warnings", () => {
  const warnings = [];
  const env = {
    [PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV]: "0",
    [PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV]: "9",
    [PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV]: "secret-token",
    [PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV]: "49",
    [PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV]: "59999",
  };
  const result = validateProductArchivePerformanceEnv({
    env,
    warn: (warning) => warnings.push(warning),
  });

  assert.equal(result.values[PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV], 1);
  assert.equal(result.values[PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV], 500);
  assert.equal(result.values[PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV], 60000);
  assert.equal(warnings.length, 5);
  assert.doesNotMatch(JSON.stringify(warnings), /secret-token|59999|LISTINGIFY_CREDENTIAL_SECRET|DEEPDRAW_APP_SECRET/i);
});
