import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const BATCH_DETAIL_PAGE = path.join(PROJECT_ROOT, "web/src/pages/listing-batches/[id]/page.tsx");
const BATCH_LIST_PAGE = path.join(PROJECT_ROOT, "web/src/pages/listing-batches/page.tsx");
const BATCH_PUBLISH_DIALOG = path.join(PROJECT_ROOT, "web/src/components/pre-publish/batch-publish-dialog.tsx");

test("listing batch detail page wires batch publish backend endpoints into real actions", async () => {
  const [page, dialog] = await Promise.all([
    readFile(BATCH_DETAIL_PAGE, "utf8"),
    readFile(BATCH_PUBLISH_DIALOG, "utf8"),
  ]);
  const combined = `${page}\n${dialog}`;

  assert.match(page, /publish-summary/);
  assert.match(page, /\/listing-batches\/\$\{encodeURIComponent\(id \?\? ""\)\}\/sync-status/);
  assert.match(page, /\/listing-batches\/\$\{encodeURIComponent\(id \?\? ""\)\}\/retry-failed/);
  assert.match(page, /failure_groups/);
  assert.match(page, /\/pre-publish-validation\?batch_search=/);
  assert.match(page, /\/publish-tasks\?batch_search=/);
  assert.match(page, /BatchPublishDialog/);
  assert.match(page, /整批提交发布/);
  assert.match(page, /提交已选草稿/);
  assert.match(combined, /确认批量发布/);
  assert.match(combined, /batch-publish-check/);
  assert.match(combined, /\/pre-publish\/drafts\/\$\{item\.listing_id\}\/publish/);
  assert.match(page, /selectedDraftIds/);
  assert.match(page, /allDraftIds/);
  assert.match(page, /轮询审核状态/);
  assert.match(page, /批量重试失败/);
  assert.match(page, /失败原因聚合/);
  assert.match(page, /queryClient\.invalidateQueries\(\{ queryKey: \["publish-tasks"\] \}\)/);
  assert.doesNotMatch(page, /生成发布任务/);
});

test("listing batch list shows stored publish summary and sync time", async () => {
  const page = await readFile(BATCH_LIST_PAGE, "utf8");

  assert.match(page, /publish_status_summary_json/);
  assert.match(page, /last_status_synced_at/);
  assert.match(page, /任务失败/);
  assert.match(page, /最近轮询/);
});
