import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PAGE_FILE = path.join(PROJECT_ROOT, "web/src/pages/shein-metadata/page.tsx");
const ROUTE_FILE = path.join(PROJECT_ROOT, "web/server/routes/metadata.ts");

test("SHEIN metadata sync is launched from the metadata page", async () => {
  const [page, route] = await Promise.all([
    readFile(PAGE_FILE, "utf8"),
    readFile(ROUTE_FILE, "utf8"),
  ]);

  assert.match(page, /DialogTrigger\s+asChild/);
  assert.match(page, /<DialogTitle>同步元数据<\/DialogTitle>/);
  assert.match(page, /api\.post<MetadataSyncJob>\("\/metadata\/sync-jobs"/);
  assert.match(page, /api\.get\(`\/metadata\/sync-jobs\/\$\{syncJobId\}`\)/);

  assert.match(route, /metadata\.post\("\/sync-jobs"/);
  assert.match(route, /metadata\.get\("\/sync-jobs\/:jobId"/);
});
