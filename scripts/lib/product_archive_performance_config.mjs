const PRODUCT_ARCHIVE_PERFORMANCE_ENV_SPECS = Object.freeze([
  {
    name: "LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY",
    defaultValue: 1,
    min: 1,
    max: 4,
  },
  {
    name: "LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY",
    defaultValue: 1,
    min: 1,
    max: 4,
  },
  {
    name: "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY",
    defaultValue: 1,
    min: 1,
    max: 2,
  },
  {
    name: "LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE",
    defaultValue: 500,
    min: 50,
    max: 5000,
  },
  {
    name: "LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS",
    defaultValue: 60000,
    min: 60000,
    max: 3600000,
  },
]);

function findSpec(name) {
  const spec = PRODUCT_ARCHIVE_PERFORMANCE_ENV_SPECS.find((entry) => entry.name === name);
  if (!spec) throw new Error(`Unsupported product archive performance env: ${String(name)}`);
  return spec;
}

function warningFor(spec, reason) {
  return {
    event: "product_archive_performance_env_defaulted",
    envName: spec.name,
    reason,
    defaultValue: spec.defaultValue,
    allowedMin: spec.min,
    allowedMax: spec.max,
  };
}

function normalizeIntegerValue(spec, rawValue, warn = null) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { value: spec.defaultValue, defaulted: true, warning: null };
  }
  const number = Number(String(rawValue).trim());
  let reason = null;
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    reason = "not_integer";
  } else if (number < spec.min || number > spec.max) {
    reason = "out_of_range";
  }
  if (reason) {
    const warning = warningFor(spec, reason);
    warn?.(warning);
    return { value: spec.defaultValue, defaulted: true, warning };
  }
  return { value: number, defaulted: false, warning: null };
}

export function productArchivePerformanceEnvSpecs() {
  return PRODUCT_ARCHIVE_PERFORMANCE_ENV_SPECS.map((spec) => ({ ...spec }));
}

export function readProductArchivePerformanceInteger(name, {
  env = process.env,
  value,
  warn = null,
} = {}) {
  const spec = findSpec(name);
  return normalizeIntegerValue(spec, value ?? env[name], warn).value;
}

export function validateProductArchivePerformanceEnv({
  env = process.env,
  warn = (warning) => console.warn(JSON.stringify(warning)),
} = {}) {
  const values = {};
  const defaults = [];
  const warnings = [];
  for (const spec of PRODUCT_ARCHIVE_PERFORMANCE_ENV_SPECS) {
    const normalized = normalizeIntegerValue(spec, env[spec.name], (warning) => {
      warnings.push(warning);
      warn?.(warning);
    });
    values[spec.name] = normalized.value;
    if (normalized.defaulted) defaults.push(spec.name);
  }
  return { values, defaults, warnings };
}

export const PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV = "LISTINGIFY_PRODUCT_ARCHIVE_SYNC_CONCURRENCY";
export const PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV = "LISTINGIFY_PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY";
export const PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV = "LISTINGIFY_PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY";
export const PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV = "LISTINGIFY_PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE";
export const PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV = "LISTINGIFY_PRODUCT_ARCHIVE_JOB_LEASE_MS";

export function readProductArchiveSyncConcurrency(value, options = {}) {
  return readProductArchivePerformanceInteger(PRODUCT_ARCHIVE_SYNC_CONCURRENCY_ENV, { ...options, value });
}

export function readProductArchivePublishConcurrency(value, options = {}) {
  return readProductArchivePerformanceInteger(PRODUCT_ARCHIVE_PUBLISH_CONCURRENCY_ENV, { ...options, value });
}

export function readProductArchiveAiFillItemConcurrency(value, options = {}) {
  return readProductArchivePerformanceInteger(PRODUCT_ARCHIVE_AI_FILL_ITEM_CONCURRENCY_ENV, { ...options, value });
}

export function readProductArchiveBulkInsertBatchSize(value, options = {}) {
  return readProductArchivePerformanceInteger(PRODUCT_ARCHIVE_BULK_INSERT_BATCH_SIZE_ENV, { ...options, value });
}

export function readProductArchiveJobLeaseMs(value, options = {}) {
  return readProductArchivePerformanceInteger(PRODUCT_ARCHIVE_JOB_LEASE_MS_ENV, { ...options, value });
}
