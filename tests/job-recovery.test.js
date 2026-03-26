import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JobQueue } from "../src/jobQueue.js";
import { recordActiveJob, recoverActiveJobs } from "../src/jobRuntimeState.js";

function makeQueueJob(jobKey) {
  return {
    jobKey,
    repoPath: `/repo/${jobKey}`,
    prompt: `prompt ${jobKey}`,
    repoFullName: "vega113/incubator-wave",
    queuedAt: "2026-03-25T00:00:00.000Z",
  };
}

test("job queue persists across restarts", () => {
  const dir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-"));
  const stateFile = join(dir, "queue.json");

  const queue1 = new JobQueue({ stateFile });
  queue1.enqueue(makeQueueJob("job-a"));
  queue1.enqueue(makeQueueJob("job-b"));

  const queue2 = new JobQueue({ stateFile });
  assert.equal(queue2.length(), 2);
  assert.equal(queue2.dequeue().jobKey, "job-a");
  assert.equal(queue2.dequeue().jobKey, "job-b");

  rmSync(dir, { recursive: true, force: true });
});

test("active jobs are requeued ahead of pending work after restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-"));
  const queueStateFile = join(dir, "queue.json");
  const activeStateFile = join(dir, "active.json");

  const queue = new JobQueue({ stateFile: queueStateFile });
  queue.enqueue(makeQueueJob("job-c"));
  recordActiveJob(makeQueueJob("job-a"), { stateFile: activeStateFile });
  recordActiveJob(makeQueueJob("job-b"), { stateFile: activeStateFile });

  const recovered = recoverActiveJobs(queue, { stateFile: activeStateFile });
  assert.equal(recovered.length, 2);
  assert.equal(queue.dequeue().jobKey, "job-a");
  assert.equal(queue.dequeue().jobKey, "job-b");
  assert.equal(queue.dequeue().jobKey, "job-c");

  rmSync(dir, { recursive: true, force: true });
});
