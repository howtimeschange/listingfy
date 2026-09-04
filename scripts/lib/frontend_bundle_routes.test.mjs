import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");
const LAZY_ROUTES_FILE = path.join(PROJECT_ROOT, "web/src/router-lazy-pages.tsx");
const LISTING_LAUNCH_PLANS_PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/listing-launch-plans/page.tsx");

const HEAVY_PAGE_IMPORTS = [
  "@/pages/product-archive-drafts/page",
  "@/pages/product-archive-drafts/[draftId]/page",
  "@/pages/shein-platform-products/page",
  "@/pages/publish-tasks/page",
  "@/pages/publish-tasks/[id]/page",
  "@/pages/listing-launch-plans/page",
  "@/pages/deepdraw-field-mappings/page",
];

test("heavy operator routes are lazy-loaded out of the initial bundle", async () => {
  const router = await readFile(ROUTER_FILE, "utf8");
  const lazyRoutes = await readFile(LAZY_ROUTES_FILE, "utf8");
  assert.match(lazyRoutes, /from "react"/);
  assert.match(lazyRoutes, /lazy\(\(\) => import\(/);
  assert.match(lazyRoutes, /<Suspense\b/);
  assert.match(router, /<RouteSuspense>/);

  for (const modulePath of HEAVY_PAGE_IMPORTS) {
    assert.doesNotMatch(
      router,
      new RegExp(`import\\s+\\w+\\s+from\\s+"${modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `${modulePath} should not be a static router import`,
    );
    assert.match(
      lazyRoutes,
      new RegExp(`lazy\\(\\(\\) => import\\("${modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)\\)`),
      `${modulePath} should be imported through React.lazy`,
    );
  }
});

test("listing launch plan spreadsheet import dialog is split out of the route chunk", async () => {
  const page = await readFile(LISTING_LAUNCH_PLANS_PAGE_FILE, "utf8");

  assert.doesNotMatch(page, /import \{ ImportDialog \} from "@\/components\/import-dialog"/);
  assert.match(page, /const SpreadsheetImportDialog = lazy\(\(\) =>\s*import\("@\/components\/import-dialog"\)/);
  assert.match(page, /function DeferredSpreadsheetImportDialog/);
  assert.match(page, /if \(!shouldLoad\)/);
  assert.match(page, /openPendingRef/);
  assert.match(page, /ref=\{\(element\) => \{/);
  assert.doesNotMatch(page, /window\.setTimeout\(\(\) => \{[\s\S]*triggerRef\.current\?\.click\(\)/);
});
