import assert from "node:assert/strict";
import test from "node:test";
import { determineBacklogActions } from "../src/backlogActions.js";

test("determineBacklogActions schedules conflict resolution for dirty PRs", () => {
  const actions = determineBacklogActions({
    repo: "vega113/incubator-wave",
    prs: [
      {
        prNumber: 393,
        title: "fix reconnect",
        mergeable: false,
        reviewState: "pending",
        latestReviews: [],
      },
    ],
  });

  assert.deepEqual(actions, [
    { type: "resolve_conflict", prNumber: 393 },
  ]);
});

test("determineBacklogActions schedules review handling for commented review backlog", () => {
  const actions = determineBacklogActions({
    repo: "vega113/incubator-wave",
    prs: [
      {
        prNumber: 391,
        title: "feature flags",
        mergeable: true,
        reviewState: "pending",
        latestReviews: [
          {
            author: { login: "coderabbitai" },
            state: "COMMENTED",
            body: "Actionable comments posted: 2",
          },
        ],
      },
    ],
  });

  assert.deepEqual(actions, [
    { type: "review_backlog", prNumber: 391 },
  ]);
});

test("determineBacklogActions avoids duplicate review action when PR is conflicted", () => {
  const actions = determineBacklogActions({
    repo: "vega113/incubator-wave",
    prs: [
      {
        prNumber: 393,
        title: "fix reconnect",
        mergeable: false,
        reviewState: "changes_requested",
        latestReviews: [
          {
            author: { login: "vega113" },
            state: "CHANGES_REQUESTED",
            body: "Please fix this",
          },
        ],
      },
    ],
  });

  assert.deepEqual(actions, [
    { type: "resolve_conflict", prNumber: 393 },
  ]);
});
