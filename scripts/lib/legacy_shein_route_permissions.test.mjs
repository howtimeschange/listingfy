import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

const ROUTES = [
  {
    file: "web/server/routes/pre-publish.ts",
    router: "prePublish",
    expected: [
      ["get", "/platforms", "LISTING_READ"],
      ["get", "/readiness", "LISTING_READ"],
      ["get", "/draft-categories", "LISTING_READ"],
      ["get", "/category-tree", "LISTING_READ"],
      ["get", "/drafts", "LISTING_READ"],
      ["post", "/drafts", "LISTING_WRITE"],
      ["get", "/drafts/:id", "LISTING_READ"],
      ["post", "/drafts/:id/duplicate", "LISTING_WRITE"],
      ["patch", "/drafts/:id/status", "LISTING_WRITE"],
      ["delete", "/drafts/:id", "LISTING_WRITE"],
      ["patch", "/drafts/:id/category", "LISTING_WRITE"],
      ["post", "/drafts/:id/convert-openapi-single-item", "LISTING_WRITE"],
      ["patch", "/drafts/:id/fields", "LISTING_WRITE"],
      ["post", "/drafts/:id/refresh-weights", "LISTING_WRITE"],
      ["patch", "/drafts/:id/image-confirmation", "LISTING_WRITE"],
      ["post", "/drafts/:id/save", "LISTING_WRITE"],
      ["post", "/drafts/:id/ai-enrich", "LISTING_WRITE"],
      ["post", "/drafts/:id/ai-field", "LISTING_WRITE"],
      ["post", "/drafts/batch-import-folders", "LISTING_WRITE"],
      ["post", "/drafts/:id/images/import-folder", "LISTING_WRITE"],
      ["get", "/drafts/:id/image-candidates", "LISTING_READ"],
      ["post", "/drafts/:id/images/from-library", "LISTING_WRITE"],
      ["post", "/drafts/:id/images/upload", "LISTING_WRITE"],
      ["patch", "/drafts/:id/images/:assetId", "LISTING_WRITE"],
      ["delete", "/drafts/:id/images/:assetId", "LISTING_WRITE"],
      ["get", "/assets/:id/file", "LISTING_READ"],
      ["post", "/drafts/:id/versions", "LISTING_WRITE"],
      ["get", "/drafts/:id/publish-payload", "LISTING_READ"],
      ["post", "/drafts/batch-publish-check", "LISTING_READ"],
      ["post", "/drafts/batch-quick-fix", "LISTING_WRITE"],
      ["post", "/drafts/:id/publish", "PUBLISH_RUN"],
      ["post", "/field-fills", "LISTING_WRITE"],
      ["post", "/ai-fill", "LISTING_WRITE"],
    ],
  },
  {
    file: "web/server/routes/listing-batches.ts",
    router: "listingBatches",
    expected: [
      ["get", "/", "LISTING_READ"],
      ["post", "/", "LISTING_WRITE"],
      ["post", "/:id/publish-tasks", "PUBLISH_RUN"],
      ["get", "/:id/publish-summary", "LISTING_READ"],
      ["post", "/:id/sync-status", "PUBLISH_RUN"],
      ["post", "/:id/retry-failed", "PUBLISH_RUN"],
      ["get", "/:id", "LISTING_READ"],
    ],
  },
  {
    file: "web/server/routes/publish-tasks.ts",
    router: "publishTasks",
    expected: [
      ["get", "/", "LISTING_READ"],
      ["get", "/filters", "LISTING_READ"],
      ["post", "/audit-status/sync", "PUBLISH_RUN"],
      ["get", "/:id", "LISTING_READ"],
      ["post", "/:id/retry", "PUBLISH_RUN"],
      ["post", "/:id/sync-status", "PUBLISH_RUN"],
    ],
  },
  {
    file: "web/server/routes/shein-products.ts",
    router: "sheinProducts",
    expected: [
      ["get", "/", "LISTING_READ"],
      ["get", "/filters", "LISTING_READ"],
      ["post", "/import", "SYNC_RUN"],
      ["post", "/:spuCode/refresh", "SYNC_RUN"],
      ["delete", "/:spuCode", "LISTING_WRITE"],
    ],
  },
];

const MUTATING_METHODS = new Set(["post", "patch", "put", "delete"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeBlocks(source, router) {
  const declaration = new RegExp(`${escapeRegExp(router)}\\.(get|post|patch|put|delete)\\("([^"]+)"`, "g");
  const matches = Array.from(source.matchAll(declaration));
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? source.length;
    return {
      method: match[1],
      path: match[2],
      source: source.slice(start, end),
    };
  });
}

function routeKey(method, routePath) {
  return `${method.toUpperCase()} ${routePath}`;
}

test("legacy SHEIN and pre-publish routes enforce backend permissions", async () => {
  for (const routeFile of ROUTES) {
    const source = await readFile(path.join(PROJECT_ROOT, routeFile.file), "utf8");
    const blocks = routeBlocks(source, routeFile.router);
    const byKey = new Map(blocks.map((block) => [routeKey(block.method, block.path), block]));
    const expected = new Map(routeFile.expected.map(([method, routePath, permission]) => [
      routeKey(method, routePath),
      permission,
    ]));

    const uncoveredMutations = blocks
      .filter((block) => MUTATING_METHODS.has(block.method))
      .filter((block) => !expected.has(routeKey(block.method, block.path)))
      .map((block) => routeKey(block.method, block.path));
    assert.deepEqual(uncoveredMutations, [], `${routeFile.file} has mutating routes without an explicit permission contract`);

    for (const [key, permission] of expected.entries()) {
      const block = byKey.get(key);
      assert.ok(block, `${routeFile.file} is missing route ${key}`);
      assert.match(
        block.source,
        new RegExp(`requirePermission\\(c,\\s*"${escapeRegExp(permission)}"\\)`),
        `${routeFile.file} ${key} must require ${permission}`,
      );
    }
  }
});
