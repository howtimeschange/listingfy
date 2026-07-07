import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const ROUTER_FILE = path.join(PROJECT_ROOT, "web/src/router.tsx");
const LAZY_ROUTES_FILE = path.join(PROJECT_ROOT, "web/src/router-lazy-pages.tsx");

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
