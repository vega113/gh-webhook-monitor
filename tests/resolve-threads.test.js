import assert from "node:assert/strict";
import test from "node:test";
import { PRStateCache } from "../src/prStateCache.js";
import { resolveThreads } from "../src/actions/resolveThreads.js";

test("resolveThreads matches bot-authored comments anywhere in a thread", async () => {
  const graphqlResponses = [
    {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: "thread-1",
                  isResolved: false,
                  comments: {
                    nodes: [
                      { author: { login: "human-reviewer" } },
                      { author: { login: "coderabbitai" } },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      data: {
        resolveReviewThread: {
          thread: {
            id: "thread-1",
            isResolved: true,
          },
        },
      },
    },
  ];
  const executedQueries = [];

  const result = await resolveThreads(
    "vega113/incubator-wave",
    576,
    ["coderabbitai"],
    {
      runGraphQL(query) {
        executedQueries.push(query);
        const next = graphqlResponses.shift();
        if (!next) throw new Error("unexpected graphql call");
        return next;
      },
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.resolvedCount, 1);
  assert.deepEqual(result.resolvedThreadIds, ["thread-1"]);
  assert.equal(
    executedQueries.some((query) => query.includes('resolveReviewThread(input: {threadId: "thread-1"})')),
    true,
    "expected resolve mutation for the bot-authored thread"
  );
});

test("markThreadsResolved updates cached unresolved thread blockers immediately", () => {
  const cache = new PRStateCache(null, 300);
  cache.updateThreads("vega113/incubator-wave", 576, [
    { id: "thread-1", isResolved: false, authorLogin: "coderabbitai" },
    { id: "thread-2", isResolved: false, authorLogin: "human-reviewer" },
  ]);

  const updated = cache.markThreadsResolved("vega113/incubator-wave", 576, ["thread-1"]);

  assert.equal(updated.threads.find((thread) => thread.id === "thread-1")?.isResolved, true);
  assert.equal(updated.threads.find((thread) => thread.id === "thread-2")?.isResolved, false);
  assert.equal(
    cache.getUnresolvedThreadsFromBot("vega113/incubator-wave", 576, "coderabbitai").length,
    0
  );
});

test("refreshThreads hydrates unresolved review threads into cached PR state", async () => {
  const cache = new PRStateCache(null, 300);
  cache.updateFromWebhook("vega113/incubator-wave", 660, {
    type: "pull_request",
    pullRequest: {
      number: 660,
      title: "fix(rtl): wire icon-based RTL button into toolbar",
      draft: false,
      mergeable: true,
      base: { ref: "main" },
      head: { ref: "fix/rtl-toolbar-icon" },
    },
  });

  const state = await cache.refreshThreads("vega113/incubator-wave", 660, {
    force: true,
    botNames: ["coderabbitai"],
    runGraphQL() {
      return {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: "thread-1",
                    isResolved: false,
                    comments: {
                      nodes: [
                        { author: { login: "vega113" } },
                        { author: { login: "coderabbitai" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      };
    },
  });

  assert.equal(state.threads.length, 1);
  assert.equal(state.threads[0].authorLogin, "coderabbitai");
  assert.deepEqual(state.threads[0].authorLogins, ["vega113", "coderabbitai"]);
});
