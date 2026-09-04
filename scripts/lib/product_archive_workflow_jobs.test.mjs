import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductArchiveWorkflowRuntime,
  PRODUCT_ARCHIVE_WORKFLOW_STAGES,
} from "../../web/server/services/product-archive-workflow-jobs.ts";

function workflowInput(files = []) {
  return {
    title: "深绘建档工作流",
    files,
    options: {},
    stages: PRODUCT_ARCHIVE_WORKFLOW_STAGES,
  };
}

test("missing workflow source file becomes failed and is not requeued forever", async () => {
  const runtime = createProductArchiveWorkflowRuntime({
    fileExists: async () => false,
  });

  const job = await runtime.runWorkflowWithFile("/missing/original.xlsx");
  assert.equal(job.status, "failed");
  assert.equal(job.error_code, "source_file_missing");
  assert.equal(await runtime.runNext(), null);
  assert.equal(runtime.getProductArchiveWorkflowJob(job.id).status, "failed");
});

test("stale worker cannot overwrite a job claimed by a newer worker", () => {
  let currentTime = 1_000;
  const runtime = createProductArchiveWorkflowRuntime({
    now: () => currentTime,
    leaseMs: 60_000,
  });
  const queued = runtime.enqueueProductArchiveWorkflowJob(workflowInput([
    { kind: "copywriting", fileName: "copywriting.xlsx", filePath: "/data/copywriting.xlsx", fileSizeBytes: 10 },
  ]));

  const first = runtime.claimWorkflowJob(queued.id, "worker-a");
  currentTime += 60_001;
  const second = runtime.reclaimExpiredWorkflowJob(queued.id, "worker-b");

  assert.equal(runtime.saveWorkflow(first), false);
  assert.equal(runtime.saveWorkflow(second), true);
});

test("restart resumes from the first unfinished stage", () => {
  const runtime = createProductArchiveWorkflowRuntime();
  const recovered = runtime.recoverJob({ completedStages: ["parse", "source_import"] });
  assert.equal(recovered.nextStage, "launch_plan_import");
});
