import assert from "node:assert/strict";
import test from "node:test";
import { taskPresentation } from "../../web/src/lib/task-presentation.ts";

const job = { id: "test", total_count: 10, completed_count: 8, failed_count: 2 };
test("task presentation keeps terminal failures, partial failures and stopped outcomes distinct", () => {
  assert.deepEqual(taskPresentation({ ...job, status: "completed", outcome: "partial_failure" }), { label: "部分失败", status: "warning" });
  assert.deepEqual(taskPresentation({ ...job, status: "completed", outcome: "stopped" }), { label: "已停止", status: "neutral" });
  assert.deepEqual(taskPresentation({ ...job, status: "cancelled" }), { label: "已停止", status: "neutral" });
  assert.deepEqual(taskPresentation({ ...job, status: "failed" }), { label: "失败", status: "danger" });
  assert.deepEqual(taskPresentation({ ...job, status: "completed", failed_count: 0 }), { label: "已完成", status: "success" });
});
test("missing, queued and running task states are not reported as completed", () => {
  assert.equal(taskPresentation(null).label, "获取状态");
  assert.equal(taskPresentation({ ...job, status: "queued" }).status, "neutral");
  assert.equal(taskPresentation({ ...job, status: "running" }).status, "loading");
});
