import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../web/src/pages/product-archive-drafts/page.tsx', import.meta.url), 'utf8');

test('standalone MDM sync queues a task without reopening workflow progress', () => {
  const handler = source.split('const syncMdmAndCreateBatch = useMutation({')[1].split('const importCopywriting')[0];
  assert.match(handler, /addTask\(/);
  assert.match(handler, /setBatchJobId\(job.id\)/);
  assert.doesNotMatch(handler, /setWorkflowProgressDialogOpen\(true\)/);
});

test('progress display follows the initiating operation rather than retained workflow data', () => {
  assert.match(source, /setBatchJobId\(latestJob.id\)\s+setProgressKind\("mdm"\)/);
  assert.match(source, /setWorkflowJobId\(result.workflowJobId\)\s+setProgressKind\("workflow"\)/);
  assert.match(source, /setBatchJobId\(result.syncJob.id\)\s+setProgressKind\("mdm"\)/);
  assert.match(source, /progressKind === "workflow" \? trackedWorkflowJob \?/);
  assert.match(source, /正在获取工作流进度/);
});
