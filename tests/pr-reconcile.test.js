import assert from "node:assert/strict";
import test from "node:test";
import { PRStateCache } from "../src/prStateCache.js";
import { buildWebhookCacheUpdate } from "../src/webhookCacheUpdate.js";

test("syncOpenPRsFromGitHub hydrates cache from gh pr list output", async () => {
  const cache = new PRStateCache(null, 300);
  const sample = JSON.stringify([
    {
      number: 398,
      title: "fix: restore search bootstrap on init to fix blank panel and archive action",
      headRefName: "fix/search-panel-blank-bootstrap",
      isDraft: false,
      mergeStateStatus: "DIRTY",
      reviewDecision: "",
      baseRefName: "main",
      statusCheckRollup: [
        { __typename: "StatusContext", state: "SUCCESS", context: "CodeRabbit" }
      ]
    },
    {
      number: 395,
      title: "docs: agents must read session memory at start of each session",
      headRefName: "docs/session-memory",
      isDraft: false,
      mergeStateStatus: "BLOCKED",
      reviewDecision: "",
      baseRefName: "main",
      statusCheckRollup: [
        { __typename: "CheckRun", status: "IN_PROGRESS", conclusion: "", name: "Server Build (JDK 17)" }
      ]
    }
  ]);

  await cache.syncOpenPRsFromGitHub("vega113/incubator-wave", () => sample);

  const prs = cache.getAllOpenPRs("vega113/incubator-wave");
  assert.deepEqual(prs.map((p) => p.prNumber).sort((a, b) => a - b), [395, 398]);

  const dirty = await cache.get("vega113/incubator-wave", 398);
  assert.equal(dirty.mergeable, false);
  assert.equal(dirty.base, "main");
  assert.equal(dirty.headBranch, "fix/search-panel-blank-bootstrap");
  assert.equal(dirty.title.includes("restore search bootstrap"), true);

  const pending = await cache.get("vega113/incubator-wave", 395);
  assert.equal(pending.checkStatus, "pending");
});

test("buildWebhookCacheUpdate normalizes pull_request and check_suite payloads", () => {
  const prUpdate = buildWebhookCacheUpdate("pull_request", {
    pull_request: {
      number: 398,
      title: "title",
      body: "body",
      draft: false,
      mergeable: false,
      base: { ref: "main" }
    },
    repository: { full_name: "vega113/incubator-wave" }
  });

  assert.equal(prUpdate.repo, "vega113/incubator-wave");
  assert.equal(prUpdate.prNumber, 398);
  assert.equal(prUpdate.webhookData.type, "pull_request");
  assert.equal(prUpdate.webhookData.pullRequest.mergeable, false);

  const checkSuiteUpdate = buildWebhookCacheUpdate("check_suite", {
    check_suite: {
      pull_requests: [{ number: 398 }],
      conclusion: "failure",
      head_branch: "main",
      head_sha: "abc123"
    },
    repository: { full_name: "vega113/incubator-wave" }
  });

  assert.equal(checkSuiteUpdate.repo, "vega113/incubator-wave");
  assert.equal(checkSuiteUpdate.prNumber, 398);
  assert.equal(checkSuiteUpdate.webhookData.type, "check_suite");
  assert.equal(checkSuiteUpdate.webhookData.checkSuite.conclusion, "failure");
});

test("syncOpenPRsFromGitHub keeps latest reviews for backlog automation", async () => {
  const cache = new PRStateCache(null, 300);
  const sample = JSON.stringify([
    {
      number: 393,
      title: "fix websocket reconnect",
      isDraft: false,
      mergeStateStatus: "DIRTY",
      reviewDecision: "",
      baseRefName: "main",
      createdAt: "2026-03-27T07:00:00Z",
      latestReviews: [
        {
          author: { login: "coderabbitai" },
          state: "COMMENTED",
          body: "Actionable comments posted: 1"
        }
      ],
      statusCheckRollup: []
    }
  ]);

  await cache.syncOpenPRsFromGitHub("vega113/incubator-wave", () => sample);
  const pr = await cache.get("vega113/incubator-wave", 393);
  assert.equal(pr.latestReviews.length, 1);
  assert.equal(pr.latestReviews[0].author.login, "coderabbitai");
  assert.equal(pr.latestReviews[0].state, "COMMENTED");
});
