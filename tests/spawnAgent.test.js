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

test("buildAgentCommand prepends shared safety guardrails to every agent prompt", async () => {
  const { buildAgentCommand } = await import("../src/actions/spawnAgent.js");

  const { args } = buildAgentCommand("Investigate the failing PR checks.", "codex");
  const finalPrompt = args.at(-1);

  assert.match(finalPrompt, /Never commit secrets/i);
  assert.match(finalPrompt, /git fetch origin/i);
  assert.match(finalPrompt, /slow merge cadence/i);
  assert.match(finalPrompt, /Investigate the failing PR checks\./);
});

test("buildAgentCommand uses gpt-5.4-mini for mini-tier codex jobs", async () => {
  const { buildAgentCommand } = await import("../src/actions/spawnAgent.js");

  const { args } = buildAgentCommand("Inspect the failing check and report back.", {
    effectiveAgent: "codex",
    effectiveModel: "gpt-5.4-mini",
  });

  const modelIdx = args.indexOf("-m");
  assert.equal(modelIdx >= 0, true);
  assert.equal(args[modelIdx + 1], "gpt-5.4-mini");
});

test("buildAgentCommand forces bypass mode for danger-full-access and strips --full-auto", async () => {
  const { buildAgentCommand } = await import("../src/actions/spawnAgent.js");

  const configOverride = {
    agent: {
      type: "codex",
      codex: {
        bin: "codex",
        model: "gpt-5.4",
        reasoningEffort: "xhigh",
        webSearch: "live",
        sandbox: "danger-full-access",
        extraArgs: "--full-auto --config web_search=\"live\"",
      },
      claude: {
        bin: "claude",
        model: "",
        allowedTools: "",
        extraArgs: "",
      },
    },
  };

  const { args } = buildAgentCommand(
    "Investigate and fix the failing automation.",
    "codex",
    configOverride
  );

  assert.equal(
    args.includes("--dangerously-bypass-approvals-and-sandbox"),
    true
  );
  assert.equal(args.includes("--full-auto"), false);
  const sandboxIdx = args.indexOf("--sandbox");
  assert.equal(sandboxIdx >= 0, true);
  assert.equal(args[sandboxIdx + 1], "danger-full-access");
  assert.equal(args.includes('web_search="live"'), true);
});
