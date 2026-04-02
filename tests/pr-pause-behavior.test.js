import test from "node:test";
import assert from "node:assert/strict";
import { createHandleIssueComment } from "../src/handlers/issueComment.js";
import { determineBacklogActions } from "../src/backlogActions.js";
import { skipIfPRPaused } from "../src/prActionGuards.js";

function makeConfig() {
  return {
    settings: {
      enabledEvents: {
        issue_comment: true,
      },
      triggerKeywords: ["please fix"],
      ignoredBots: [],
    },
  };
}

test("PR comment handler skips corrective agent work for paused PRs", () => {
  let spawnCount = 0;

  const handleIssueComment = createHandleIssueComment({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: () => "prompt",
    spawnAgent: () => {
      spawnCount += 1;
    },
    spawnAgentWithReaction: () => {
      throw new Error("issue path should not run");
    },
    reactToComment: () => {},
    isOnCooldown: () => false,
    setCooldown: () => {},
    getRateLimiter: () => ({
      canExecute: () => true,
      recordExecution: () => {},
    }),
    addInProgressLabel: () => {},
    getIssueAssignees: () => [],
    isPRPaused: () => true,
  });

  handleIssueComment({
    action: "created",
    repository: { full_name: "vega113/incubator-wave" },
    issue: {
      number: 576,
      title: "fix deploy",
      pull_request: { url: "https://api.github.com/repos/x/pulls/576" },
    },
    comment: {
      id: 10,
      body: "please fix this",
      user: { type: "User", login: "vega113" },
    },
  });

  assert.equal(spawnCount, 0);
});

test("determineBacklogActions skips paused PRs", () => {
  const actions = determineBacklogActions({
    prs: [
      {
        prNumber: 393,
        mergeable: false,
        isPaused: true,
        latestReviews: [
          {
            state: "COMMENTED",
            body: "needs attention",
          },
        ],
      },
    ],
  });

  assert.deepEqual(actions, []);
});

test("pause guard blocks server-level corrective actions", () => {
  const pausedStore = {
    get: () => ({ isPaused: true }),
  };

  assert.equal(
    skipIfPRPaused("vega113/incubator-wave", 576, "skip action", pausedStore),
    true
  );
});
