import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPostMergeGateCommand,
  getPostMergeGateSettings,
  isPostMergeGateCheckRun,
} from "../src/postMergeGate.js";
import {
  clearPostMergeGateState,
  getPostMergeGateStatus,
  recordPostMergeGateResult,
  recordPostMergeGateTrigger,
  shouldSkipPostMergeGateTrigger,
} from "../src/postMergeGateState.js";

function makeConfig(overrides = {}) {
  return {
    settings: {
      postMergeGate: {
        enabled: true,
        workflowFile: ".github/workflows/post-merge-integration.yml",
        workflowName: "Post-Merge Integration Gate",
        checkName: "Post-Merge Integration Gate",
        branch: "main",
        cooldownMinutes: 10,
      },
      ...overrides,
    },
  };
}

test("buildPostMergeGateCommand targets the configured workflow and merged SHA", () => {
  const settings = getPostMergeGateSettings(makeConfig(), "main");
  const { command, args } = buildPostMergeGateCommand(
    "vega113/incubator-wave",
    settings,
    { number: 312, mergeCommitSha: "abc123def456" }
  );

  assert.equal(command, "gh");
  assert.deepEqual(args, [
    "workflow",
    "run",
    ".github/workflows/post-merge-integration.yml",
    "--repo",
    "vega113/incubator-wave",
    "-r",
    "main",
    "-f",
    "merged_sha=abc123def456",
    "-f",
    "merged_pr=312",
  ]);
});

test("post-merge gate check matching is limited to configured branch and check name", () => {
  const config = makeConfig();

  assert.equal(
    isPostMergeGateCheckRun(config, {
      repo: "vega113/incubator-wave",
      branch: "main",
      name: "Post-Merge Integration Gate",
    }),
    true
  );

  assert.equal(
    isPostMergeGateCheckRun(config, {
      repo: "vega113/incubator-wave",
      branch: "feature/foo",
      name: "Post-Merge Integration Gate",
    }),
    false
  );

  assert.equal(
    isPostMergeGateCheckRun(config, {
      repo: "vega113/incubator-wave",
      branch: "main",
      name: "Build",
    }),
    false
  );
});

test("post-merge gate state tracks cooldown and degraded branch health", () => {
  clearPostMergeGateState();

  recordPostMergeGateTrigger("vega113/incubator-wave", {
    branch: "main",
    sha: "abc123",
    triggeredAt: 1_000,
  });

  assert.equal(
    shouldSkipPostMergeGateTrigger("vega113/incubator-wave", 10 * 60 * 1000, 2_000),
    true
  );
  assert.equal(
    shouldSkipPostMergeGateTrigger("vega113/incubator-wave", 10 * 60 * 1000, 700_001),
    false
  );

  recordPostMergeGateResult("vega113/incubator-wave", {
    branch: "main",
    sha: "abc123",
    conclusion: "failure",
    checkName: "Post-Merge Integration Gate",
  });

  let status = getPostMergeGateStatus("vega113/incubator-wave");
  assert.equal(status.degraded, true);
  assert.equal(status.lastConclusion, "failure");

  recordPostMergeGateResult("vega113/incubator-wave", {
    branch: "main",
    sha: "def456",
    conclusion: "success",
    checkName: "Post-Merge Integration Gate",
  });

  status = getPostMergeGateStatus("vega113/incubator-wave");
  assert.equal(status.degraded, false);
  assert.equal(status.lastConclusion, "success");
  assert.equal(status.lastRequestedSha, "abc123");
});
