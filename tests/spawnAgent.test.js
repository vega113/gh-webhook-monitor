import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("spawnAgent handles missing agent binary without crashing the server", () => {
  const dir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-"));

  const spawnAgentUrl = pathToFileURL(resolve("src/actions/spawnAgent.js")).href;
  const jobQueueUrl = pathToFileURL(resolve("src/jobQueue.js")).href;

  const script = `
    import { mkdtempSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    const { spawnAgent, getActiveJobs, setJobQueue } = await import(${JSON.stringify(spawnAgentUrl)});
    const { JobQueue } = await import(${JSON.stringify(jobQueueUrl)});

    process.env.PATH = "";

    const tempDir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-child-"));
    setJobQueue(new JobQueue({ stateFile: join(tempDir, "queue.json") }));
    spawnAgent(tempDir, "prompt", "missing-binary-job", "vega113/gh-webhook-monitor");

    setTimeout(() => {
      console.log(JSON.stringify({ activeJobs: getActiveJobs().size }));
      process.exit(0);
    }, 100);
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `child exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );

  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const payload = JSON.parse(lines.at(-1));
  assert.equal(payload.activeJobs, 0);

  rmSync(dir, { recursive: true, force: true });
});
