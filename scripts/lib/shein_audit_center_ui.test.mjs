import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const PUBLISH_TASKS_PAGE = path.join(PROJECT_ROOT, "web/src/pages/publish-tasks/page.tsx");
const AUDIT_STATUS_PAGE = path.join(PROJECT_ROOT, "web/src/pages/shein-operations/audit-status/page.tsx");

test("publish tasks page becomes the primary publish and audit workbench", async () => {
  const page = await readFile(PUBLISH_TASKS_PAGE, "utf8");

  assert.match(page, /发布与审核任务/);
  assert.match(page, /批量同步审核/);
  assert.match(page, /失败原因/);
  assert.match(page, /审核驳回/);
  assert.match(page, /部分通过/);
  assert.match(page, /\/publish-tasks\/audit-status\/sync/);
  assert.match(page, /failureReasonGroups/);
  assert.match(page, /selectedTaskIds/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}/);
});

test("SHEIN audit status page is an aggregation dashboard, not a duplicate publish task table", async () => {
  const page = await readFile(AUDIT_STATUS_PAGE, "utf8");

  assert.match(page, /审核状态中心/);
  assert.match(page, /\/shein-operations\/audit-status/);
  assert.match(page, /\/shein-operations\/audit-status\/sync/);
  assert.match(page, /\/shein-operations\/audit-status\/\$\{.*id.*\}\/handling/);
  assert.match(page, /发布任务/);
  assert.match(page, /平台商品/);
  assert.match(page, /生命周期操作/);
  assert.match(page, /失败原因分组/);
  assert.match(page, /处理状态/);
  assert.match(page, /\/publish-tasks\?statuses=REJECTED%2CPARTIALLY_APPROVED/);
  assert.match(page, /\/shein-platform-products\/\$\{.*spuName.*\}/);
  assert.doesNotMatch(page, /OperationCapabilityPage/);
});
