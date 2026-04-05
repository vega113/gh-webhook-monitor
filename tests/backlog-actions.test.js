import assert from "node:assert/strict";
import test from "node:test";
import {
  determineBacklogActions,
  hasActionableReview,
} from "../src/backlogActions.js";

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
    autoResolveBots: [],
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

test("determineBacklogActions resolves bot threads without spawning review backlog for auto-resolve bots", () => {
  const actions = determineBacklogActions({
    repo: "vega113/incubator-wave",
    prs: [
      {
        prNumber: 660,
        title: "wire rtl toolbar icon",
        mergeable: true,
        reviewState: "pending",
        latestReviews: [
          {
            author: { login: "coderabbitai" },
            state: "COMMENTED",
            body: "Actionable comments posted: 2",
          },
        ],
        threads: [
          { id: "thread-1", isResolved: false, authorLogin: "coderabbitai" },
          { id: "thread-2", isResolved: false, authorLogin: "coderabbitai" },
        ],
      },
    ],
    autoResolveBots: ["coderabbitai"],
  });

  assert.deepEqual(actions, [
    { type: "resolve_threads", prNumber: 660 },
  ]);
});

test("hasActionableReview ignores commented reviews from auto-resolve bots", () => {
  assert.equal(
    hasActionableReview(
      [
        {
          author: { login: "coderabbitai" },
          state: "COMMENTED",
          body: "Actionable comments posted: 2",
        },
      ],
      { autoResolveBots: ["coderabbitai"] }
    ),
    false
  );
});
