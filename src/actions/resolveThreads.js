import { logEvent } from "../logger.js";
import {
  defaultRunGraphQL,
  fetchReviewThreads,
  matchesBotLogin,
} from "../reviewThreads.js";

/**
 * Resolve review threads on a PR using GitHub GraphQL API
 * Fetches unresolved threads and resolves them via mutation
 *
 * @param {string} repo - Repository in format owner/repo
 * @param {number} prNumber - PR number to resolve threads on
 * @param {Array<string>} botNames - Optional array of bot logins to filter threads by
 * @returns {Promise<Object>} Status object with count of resolved threads and details
 */
async function resolveThreads(repo, prNumber, botNames = [], options = {}) {
  try {
    const runGraphQL = options.runGraphQL || defaultRunGraphQL;

    logEvent(
      "RESOLVE_THREADS",
      "attempt",
      repo,
      `PR #${prNumber}: Attempting to resolve review threads${botNames.length > 0 ? ` from bots: ${botNames.join(", ")}` : ""}`
    );

    let threads;
    try {
      threads = fetchReviewThreads(repo, prNumber, {
        runGraphQL,
        botNames,
      });
    } catch (err) {
      logEvent(
        "RESOLVE_THREADS",
        "error",
        repo,
        `PR #${prNumber}: Failed to fetch threads: ${err.message.slice(0, 100)}`
      );
      return {
        success: false,
        prNumber,
        repo,
        resolvedCount: 0,
        message: `Failed to fetch threads: ${err.message.slice(0, 50)}`,
      };
    }

    // Step 2: Filter threads by bot authors if botNames provided
    let targetThreads = threads;
    if (botNames.length > 0) {
      targetThreads = threads.filter((thread) =>
        (thread.authorLogins || []).some((author) =>
          matchesBotLogin(author, botNames)
        )
      );
    }

    if (targetThreads.length === 0) {
      logEvent(
        "RESOLVE_THREADS",
        "no-threads",
        repo,
        `PR #${prNumber}: No unresolved threads found${botNames.length > 0 ? ` from specified bots` : ""}`
      );
      return {
        success: true,
        prNumber,
        repo,
        resolvedCount: 0,
        message: "No unresolved threads found",
      };
    }

    // Step 3: Resolve each thread via mutation
    let resolvedCount = 0;
    const resolvedThreadIds = [];
    const failedThreads = [];

    for (const thread of targetThreads) {
      try {
        const resolveMutation = `
          mutation {
            resolveReviewThread(input: {threadId: "${thread.id}"}) {
              thread {
                id
                isResolved
              }
            }
          }
        `;

        const result = runGraphQL(resolveMutation);
        if (result.errors) {
          throw new Error(`GraphQL error: ${result.errors.map((e) => e.message).join(", ")}`);
        }

        resolvedCount++;
        resolvedThreadIds.push(thread.id);
      } catch (err) {
        failedThreads.push({
          threadId: thread.id,
          error: err.message.slice(0, 50),
        });
      }
    }

    const allResolved = failedThreads.length === 0;
    logEvent(
      "RESOLVE_THREADS",
      allResolved ? "success" : "partial",
      repo,
      `PR #${prNumber}: Resolved ${resolvedCount}/${targetThreads.length} threads`
    );

    return {
      success: allResolved,
      prNumber,
      repo,
      resolvedCount,
      resolvedThreadIds,
      totalTargetThreads: targetThreads.length,
      failedThreads: failedThreads.length > 0 ? failedThreads : undefined,
      message:
        resolvedCount > 0
          ? `Resolved ${resolvedCount} review thread${resolvedCount !== 1 ? "s" : ""}`
          : "Failed to resolve any threads",
    };
  } catch (err) {
    logEvent(
      "RESOLVE_THREADS",
      "error",
      repo,
      `PR #${prNumber}: Unexpected error: ${err.message.slice(0, 100)}`
    );
    return {
      success: false,
      prNumber,
      repo,
      resolvedCount: 0,
      message: `Unexpected error: ${err.message.slice(0, 50)}`,
    };
  }
}

export { resolveThreads };
