import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

async function source(relativePath) {
  return readFile(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

test("SHEIN bucket list GETs stay read-only and batch SKC previews", async () => {
  const [route, page] = await Promise.all([
    source("web/server/routes/shein-products.ts"),
    source("web/src/pages/shein-products/page.tsx"),
  ]);
  const listRoute = between(route, 'sheinProducts.get("/",', 'sheinProducts.get("/filters",');
  const filtersRoute = between(route, 'sheinProducts.get("/filters",', 'sheinProducts.post("/import",');
  const bucketSelect = between(route, "const bucketSelect = `", "\n`\n");

  assert.doesNotMatch(listRoute, /refreshBucketProduct|ensureBucketHasRows/);
  assert.doesNotMatch(filtersRoute, /refreshBucketProduct|ensureBucketHasRows/);
  assert.doesNotMatch(bucketSelect, /bucket\.\*/);
  assert.match(bucketSelect, /field_completeness/);
  assert.match(route, /bucketSkcDetailsBySpu\(db, rows\)/);
  assert.doesNotMatch(listRoute, /rows\.map\(\(row\) => \(\{[\s\S]*bucketSkcDetails\(db, row\)/);
  assert.doesNotMatch(page, /raw_payload_json|parsePayload/);
});

test("data-center list endpoints project only list fields", async () => {
  const [deepdrawRoute, mdmRoute, archiveService, launchPlanService] = await Promise.all([
    source("web/server/routes/deepdraw-content.ts"),
    source("web/server/routes/mdm-products.ts"),
    source("web/server/services/product-archive-drafts.ts"),
    source("web/server/services/listing-launch-plans.ts"),
  ]);
  const deepdrawList = between(deepdrawRoute, 'deepdrawContent.get("/",', 'deepdrawContent.get("/summary",');
  const mdmList = between(mdmRoute, 'mdmProducts.get("/",', 'mdmProducts.get("/summary",');
  const archiveList = between(
    archiveService,
    "export function listProductArchiveDrafts",
    "export function getProductArchiveDraftDetail",
  );
  const launchPlanList = between(
    launchPlanService,
    "export function listListingLaunchPlanRows",
    "\n}",
  );

  assert.doesNotMatch(deepdrawList, /pkg\.\*/);
  assert.doesNotMatch(mdmList, /spu\.\*/);
  assert.doesNotMatch(archiveList, /draft\.\*/);
  assert.doesNotMatch(launchPlanList, /row\.\*/);

  assert.match(deepdrawList, /pkg\.spu_code/);
  assert.match(mdmList, /spu\.spu_code/);
  assert.match(archiveList, /draft\.draft_no/);
  assert.match(launchPlanList, /row\.sheet_name/);
});

test("SHEIN platform-product list omits raw transport payloads", async () => {
  const [service, page] = await Promise.all([
    source("web/server/services/shein-platform-products.ts"),
    source("web/src/pages/shein-platform-products/page.tsx"),
  ]);
  const displaySelect = between(service, "const productDisplaySelectSql = `", "\n`\n");
  const summarySerializer = between(service, "function serializeProductSummary(", "\n}\n\nfunction groupRowsByNumber");
  const operationSerializer = between(service, "function serializeOperation(", "\n}\n\nfunction productOperations");

  assert.doesNotMatch(displaySelect, /product\.\*/);
  assert.doesNotMatch(displaySelect, /raw_list_payload_json/);
  assert.match(displaySelect, /product\.spu_name/);
  assert.doesNotMatch(summarySerializer, /rawListPayload/);
  assert.doesNotMatch(operationSerializer, /requestPayload|responsePayload/);
  assert.doesNotMatch(page, /rawListPayload/);
});
