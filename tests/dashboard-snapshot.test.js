import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardSnapshot } from "../src/dashboard/snapshot.js";

const now = Date.parse("2026-03-27T08:00:00Z");

test("buildDashboardSnapshot groups actionable PRs and issues by repository", () => {
  const snapshot = buildDashboardSnapshot({
    now,
    repos: {
      "vega113/incubator-wave": { enabled: true },
      "vega113/tube2web": { enabled: true },
    },
    statuses: [
      {
        repo: "vega113/incubator-wave",
        prNumber: 398,
        title: "fix bootstrap",
        branch: "main",
        mergeable: false,
        ciStatus: "pending",
        reviewState: "pending",
        blockers: [{ type: "conflict", message: "Merge conflicts detected", severity: "error" }],
        lastUpdated: "2026-03-27T07:59:00Z",
        openedAt: "2026-03-27T07:00:00Z",
        isDraft: false,
        autoMergeEnabled: true,
      },
      {
        repo: "vega113/incubator-wave",
        prNumber: 396,
        title: "docs cleanup",
        branch: "main",
        mergeable: true,
        ciStatus: "passing",
        reviewState: "approved",
        blockers: [],
        lastUpdated: "2026-03-27T07:58:00Z",
        openedAt: "2026-03-27T06:00:00Z",
        isDraft: false,
        autoMergeEnabled: false,
      },
    ],
    issues: [
      {
        repo: "vega113/incubator-wave",
        number: 300,
        title: "Deploy failed",
        labels: ["deploy-failure"],
        state: "open",
        openedAt: "2026-03-27T05:00:00Z",
      },
      {
        repo: "vega113/tube2web",
        number: 22,
        title: "Normal issue",
        labels: ["bug"],
        state: "open",
        openedAt: "2026-03-27T05:00:00Z",
      },
    ],
    jobs: {
      active: [
        {
          key: "review-vega113/incubator-wave-398",
          running: "42s",
          startTime: "2026-03-27T07:59:18Z",
        },
      ],
      pending: [],
      history: [
        {
          key: "review-vega113/incubator-wave-398",
          code: 0,
          duration: "15.0s",
          startTime: "2026-03-27T07:30:00Z",
          logFile: "/tmp/review-398.log",
          outputTail: "done",
          agentType: "codex",
        },
        {
          key: "issue-vega113/incubator-wave-300",
          code: 0,
          duration: "12.0s",
          startTime: "2026-03-27T07:20:00Z",
          logFile: "/tmp/issue-300.log",
          outputTail: "reported",
          agentType: "codex",
        }
      ],
    },
    prControls: {
      "vega113/incubator-wave#398": {
        repo: "vega113/incubator-wave",
        prNumber: 398,
        isPaused: true,
      },
    },
    settings: {
      statusPollInterval: 60000,
      dashboardRepoPageSize: 25,
    },
  });

  assert.equal(snapshot.repositories.length, 2);
  const wave = snapshot.repositories.find((r) => r.repo === "vega113/incubator-wave");
  assert.ok(wave);
  assert.deepEqual(wave.prs.map((pr) => pr.prNumber), [398]);
  assert.deepEqual(wave.issues.map((issue) => issue.number), [300]);
  assert.equal(wave.summary.actionablePrs, 1);
  assert.equal(wave.summary.actionableIssues, 1);
  assert.equal(wave.summary.totalPrs, 2);
  assert.equal(wave.prs[0].iterationCount, 1);
  assert.equal(wave.prs[0].waitingFor, "Resolve merge conflicts");
  assert.equal(wave.prs[0].prAgeMinutes, 60);
  assert.equal(wave.prs[0].jobs.length, 1);
  assert.equal(wave.prs[0].isPaused, true);
  assert.equal(wave.prs[0].autoMergeEnabled, true);
  assert.equal(wave.prs[0].hasActiveJob, true);
  assert.equal(wave.prs[0].lifecycleState, "Active");
  assert.equal(wave.prs[0].activeJobElapsed, "42s");
  assert.equal(wave.prs[0].lastJobDuration, "15.0s");
  assert.equal(wave.prs[0].nextPollAt, "2026-03-27T08:01:00.000Z");
  assert.equal(wave.prs[0].nextPollInSeconds, 60);
  assert.equal(wave.prPageSize, 25);
  assert.equal(wave.hasMorePrs, false);
  assert.equal(wave.issues[0].lifecycleState, "Waiting");
  assert.equal(wave.issues[0].hasActiveJob, false);
  assert.equal(wave.issues[0].nextPollAt, "2026-03-27T08:01:00.000Z");

  const tube2web = snapshot.repositories.find((r) => r.repo === "vega113/tube2web");
  assert.ok(tube2web);
  assert.equal(tube2web.prs.length, 0);
  assert.equal(tube2web.issues.length, 0);
});
