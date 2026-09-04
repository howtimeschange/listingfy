import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createProductArchiveWorkflowRuntime,
  PRODUCT_ARCHIVE_WORKFLOW_STAGES,
} from "../../web/server/services/product-archive-workflow-jobs.ts";

const WORKFLOW_ARTIFACT_ROOT = path.resolve(import.meta.dirname, "../../data/product-archive-workflow");

function workflowInput(files = []) {
  return {
    title: "深绘建档工作流",
    files,
    options: {},
    stages: PRODUCT_ARCHIVE_WORKFLOW_STAGES,
  };
}

async function workflowArtifact(name) {
  await mkdir(WORKFLOW_ARTIFACT_ROOT, { recursive: true });
  const directory = await mkdtemp(path.join(WORKFLOW_ARTIFACT_ROOT, `${name}-`));
  const filePath = path.join(directory, "copywriting.xlsx");
  await writeFile(filePath, "test workbook");
  return { directory, filePath };
}

async function waitForMissing(filePath, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(filePath);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
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

test("cancelling a queued workflow cleans its uploaded artifacts", async () => {
  const artifact = await workflowArtifact("queued-cancel");
  try {
    const runtime = createProductArchiveWorkflowRuntime();
    const queued = runtime.enqueueProductArchiveWorkflowJob(workflowInput([
      { kind: "copywriting", fileName: "copywriting.xlsx", filePath: artifact.filePath, fileSizeBytes: 10 },
    ]));

    const cancelled = await runtime.cancelProductArchiveWorkflowJob(queued.id, { id: 1 });

    assert.equal(cancelled.status, "cancelled");
    await assert.rejects(access(artifact.filePath));
    await assert.rejects(access(artifact.directory));
  } finally {
    await rm(artifact.directory, { recursive: true, force: true });
  }
});

test("cancelling a running workflow cleans artifacts after its worker stops", async () => {
  let releaseFileCheck;
  let markFileCheckStarted;
  const fileCheckStarted = new Promise((resolve) => {
    markFileCheckStarted = resolve;
  });
  const artifact = await workflowArtifact("running-cancel");
  try {
    const runtime = createProductArchiveWorkflowRuntime({
      fileExists: async () => {
        markFileCheckStarted();
        return new Promise((resolve) => {
          releaseFileCheck = resolve;
        });
      },
    });
    const queued = runtime.enqueueProductArchiveWorkflowJob(workflowInput([
      { kind: "copywriting", fileName: "copywriting.xlsx", filePath: artifact.filePath, fileSizeBytes: 10 },
    ]));

    await fileCheckStarted;
    const cancelled = await runtime.cancelProductArchiveWorkflowJob(queued.id, { id: 1 });
    releaseFileCheck(true);

    assert.equal(cancelled.status, "cancelled");
    assert.equal(await waitForMissing(artifact.filePath), true);
    await assert.rejects(access(artifact.directory));
  } finally {
    await rm(artifact.directory, { recursive: true, force: true });
  }
});
