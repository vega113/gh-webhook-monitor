import test from "node:test";
import assert from "node:assert/strict";
import { createHandlePullRequestReview } from "../src/handlers/pullRequestReview.js";

function makePayload(reviewOverrides = {}) {
  return {
    action: "submitted",
    repository: { full_name: "vega113/incubator-wave" },
    pull_request: {
      number: 660,
      title: "fix(rtl): wire icon-based RTL button into toolbar",
      head: { ref: "fix/rtl-toolbar-icon" },
      labels: [],
    },
    review: {
      state: "commented",
      user: { login: "coderabbitai", type: "Bot" },
      ...reviewOverrides,
    },
  };
}

function makeConfig() {
  return {
    settings: {
      enabledEvents: { pull_request_review: true },
      ignoredBots: ["github-actions[bot]", "dependabot[bot]"],
      autoResolveBots: ["coderabbitai", "chatgpt-codex-connector"],
    },
  };
}

test("pull_request_review skips spawning an agent for auto-resolve bot comments", async () => {
  let spawnCount = 0;
  const handlePullRequestReview = createHandlePullRequestReview({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: () => "prompt",
    spawnAgent: () => {
      spawnCount += 1;
    },
    getRateLimiter: () => ({
      canExecute: () => true,
      recordExecution: () => {},
    }),
    skipIfPRPaused: () => false,
  });

  await handlePullRequestReview(makePayload());

  assert.equal(spawnCount, 0);
});

test("pull_request_review still spawns for human commented reviews", async () => {
  let spawnCount = 0;
  const handlePullRequestReview = createHandlePullRequestReview({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: () => "prompt",
    spawnAgent: () => {
      spawnCount += 1;
    },
    getRateLimiter: () => ({
      canExecute: () => true,
      recordExecution: () => {},
    }),
    skipIfPRPaused: () => false,
  });

  await handlePullRequestReview(
    makePayload({
      user: { login: "vega113", type: "User" },
    })
  );

  assert.equal(spawnCount, 1);
});
