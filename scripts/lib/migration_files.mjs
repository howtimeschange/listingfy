import fs from "node:fs";

const HISTORICAL_DUPLICATE_MIGRATIONS = new Map([
  ["033", new Set([
    "033_deepdraw_operator_data_read.sql",
    "033_listing_launch_plan_import_jobs.sql",
  ])],
]);

export function listMigrationFiles(migrationsDir) {
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const filesByPrefix = new Map();

  for (const file of files) {
    const prefix = file.match(/^(\d+)_/)?.[1];
    if (!prefix) continue;
    const group = filesByPrefix.get(prefix) ?? [];
    group.push(file);
    filesByPrefix.set(prefix, group);
  }

  for (const [prefix, group] of filesByPrefix) {
    if (group.length < 2) continue;
    const allowed = HISTORICAL_DUPLICATE_MIGRATIONS.get(prefix);
    const isKnownHistoricalPair = allowed
      && group.length === allowed.size
      && group.every((file) => allowed.has(file));
    if (!isKnownHistoricalPair) {
      throw new Error(`Duplicate migration prefix ${prefix}: ${group.join(", ")}`);
    }
  }

  return files;
}
