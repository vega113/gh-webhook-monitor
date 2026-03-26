import test from "node:test";
import assert from "node:assert/strict";
import { createHandleIssues } from "../src/handlers/issues.js";
import { createHandleIssueComment } from "../src/handlers/issueComment.js";

function makeConfig() {
  return {
    settings: {
      enabledEvents: {
        issues: true,
      issue_comment: true,
      },
      triggerKeywords: ["@claude", "please fix"],
      issueLabels: ["deploy-failure", "auto-fix", "agent-task"],
      ignoredBots: ["github-actions[bot]", "dependabot[bot]"],
      useAssignmentForCoordination: true,
      useLabelsForCoordination: true,
      botUsername: "vega113",
      inProgressLabel: "in-progress",
    },
  };
}

test("handleIssues uses labels only for issue coordination", () => {
  const calls = {
    label: 0,
    spawn: 0,
  };

  const handleIssues = createHandleIssues({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: (name, data) => `${name}:${data.issueNumber}`,
    spawnAgentWithReaction: (...args) => {
      calls.spawn += 1;
      assert.equal(args[1], "agent_task:42");
    },
    isOnCooldown: () => false,
    setCooldown: () => {},
    addInProgressLabel: () => {
      calls.label += 1;
    },
    isIssueAssigned: () => {
      throw new Error("assignment should not be checked");
    },
    assignIssueToBot: () => {
      throw new Error("assignment should not be attempted");
    },
  });

  handleIssues({
    action: "opened",
    repository: { full_name: "vega113/incubator-wave" },
    issue: {
      number: 42,
      title: "Agent task",
      body: "Please do work",
      labels: [{ name: "agent-task" }],
    },
  });

  assert.equal(calls.label, 1);
  assert.equal(calls.spawn, 1);
});

test("handleIssues skips issues already assigned to the repo owner", () => {
  const calls = {
    label: 0,
    spawn: 0,
  };

  const handleIssues = createHandleIssues({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: () => {
      throw new Error("should not render a prompt for owned issues");
    },
    spawnAgentWithReaction: () => {
      calls.spawn += 1;
    },
    isOnCooldown: () => false,
    setCooldown: () => {},
    addInProgressLabel: () => {
      calls.label += 1;
    },
    getIssueAssignees: () => ["vega113"],
  });

  handleIssues({
    action: "opened",
    repository: { full_name: "vega113/incubator-wave" },
    issue: {
      number: 42,
      title: "Owner-assigned issue",
      body: "Please do work",
      labels: [{ name: "agent-task" }],
    },
  });

  assert.equal(calls.label, 0);
  assert.equal(calls.spawn, 0);
});

test("handleIssueComment uses labels only for issue coordination", () => {
  const calls = {
    label: 0,
    spawn: 0,
    react: 0,
  };

  const handleIssueComment = createHandleIssueComment({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: (name, data) => `${name}:${data.issueNumber}`,
    spawnAgent: () => {
      throw new Error("PR comment branch should not run");
    },
    spawnAgentWithReaction: (...args) => {
      calls.spawn += 1;
      assert.equal(args[1], "issue_followup:42");
    },
    reactToComment: () => {
      calls.react += 1;
    },
    isOnCooldown: () => false,
    setCooldown: () => {},
    getRateLimiter: () => ({
      canExecute: () => true,
      recordExecution: () => {},
    }),
    addInProgressLabel: () => {
      calls.label += 1;
    },
    isIssueAssigned: () => {
      throw new Error("assignment should not be checked");
    },
    assignIssueToBot: () => {
      throw new Error("assignment should not be attempted");
    },
  });

  handleIssueComment({
    action: "created",
    repository: { full_name: "vega113/incubator-wave" },
    issue: {
      number: 42,
      title: "Agent task",
      labels: [{ name: "agent-task" }],
    },
    comment: {
      id: 99,
      body: "please continue",
      user: { type: "User", login: "vega113" },
    },
  });

  assert.equal(calls.react, 1);
  assert.equal(calls.label, 1);
  assert.equal(calls.spawn, 1);
});

test("handleIssueComment skips issues already assigned to the repo owner", () => {
  const calls = {
    label: 0,
    spawn: 0,
    react: 0,
  };

  const handleIssueComment = createHandleIssueComment({
    getConfig: () => makeConfig(),
    getRepoPath: () => "/repo",
    renderPrompt: () => {
      throw new Error("should not render a prompt for owned issues");
    },
    spawnAgent: () => {
      throw new Error("PR comment branch should not run");
    },
    spawnAgentWithReaction: () => {
      calls.spawn += 1;
    },
    reactToComment: () => {
      calls.react += 1;
    },
    isOnCooldown: () => false,
    setCooldown: () => {},
    getRateLimiter: () => ({
      canExecute: () => true,
      recordExecution: () => {},
    }),
    addInProgressLabel: () => {
      calls.label += 1;
    },
    getIssueAssignees: () => ["vega113"],
  });

  handleIssueComment({
    action: "created",
    repository: { full_name: "vega113/incubator-wave" },
    issue: {
      number: 42,
      title: "Owner-assigned issue",
      labels: [{ name: "agent-task" }],
    },
    comment: {
      id: 99,
      body: "please continue",
      user: { type: "User", login: "vega113" },
    },
  });

  assert.equal(calls.react, 0);
  assert.equal(calls.label, 0);
  assert.equal(calls.spawn, 0);
});
