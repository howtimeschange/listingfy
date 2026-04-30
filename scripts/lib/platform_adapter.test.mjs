import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

const types = await import("../../web/server/platform-adapters/types.ts");
const registry = await import("../../web/server/platform-adapters/index.ts");
const shein = await import("../../web/server/platform-adapters/shein.ts");

test("platform adapter registry resolves the SHEIN adapter by platform key", () => {
  const adapter = registry.platformAdapterFor("shein");
  assert.equal(adapter.platform, "SHEIN");
  assert.equal(adapter, shein.sheinAdapter);
});

test("SHEIN adapter exposes platform publish and image operations behind one interface", () => {
  const adapter = shein.sheinAdapter;
  assert.equal(adapter.platform, "SHEIN");
  assert.equal(typeof adapter.uploadAsset, "function");
  assert.equal(typeof adapter.transformAsset, "function");
  assert.equal(typeof adapter.publishListing, "function");
  assert.equal(typeof adapter.syncPublishStatus, "function");
  assert.deepEqual(Object.keys(types.PLATFORM_ADAPTER_CAPABILITIES).sort(), [
    "buildPublishPayload",
    "fetchAttributeTemplate",
    "fetchCategoryTree",
    "publishListing",
    "syncPublishStatus",
    "transformAsset",
    "uploadAsset",
  ].sort());
});

test("pre-publish route delegates platform publish calls to PlatformAdapter", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "web/server/routes/pre-publish.ts"), "utf8");
  assert.match(source, /platformAdapterFor/);
  assert.doesNotMatch(source, /requestSheinWithCredentialsAndRetry\("\/open-api\/goods\/product\/publishOrEdit"/);
});
