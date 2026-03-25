import { execSync } from "node:child_process";
import { logEvent } from "../logger.js";

/**
 * Resolve review threads on a PR using GitHub GraphQL API
 * Fetches unresolved threads and resolves them via mutation
 *
 * @param {string} repo - Repository in format owner/repo
 * @param {number} prNumber - PR number to resolve threads on
 * @param {Array<string>} botNames - Optional array of bot logins to filter threads by
 * @returns {Promise<Object>} Status object with count of resolved threads and details
 */
async function resolveThreads(repo, prNumber, botNames = []) {
  try {
    logEvent(
      "RESOLVE_THREADS",
      "attempt",
      repo,
      `PR #${prNumber}: Attempting to resolve review threads${botNames.length > 0 ? ` from bots: ${botNames.join(", ")}` : ""}`
    );

    // Step 1: Fetch unresolved review threads on the PR
    const threadsQuery = `
      query {
        repository(owner: "${repo.split("/")[0]}", name: "${repo.split("/")[1]}") {
          pullRequest(number: ${prNumber}) {
            reviewThreads(first: 100, isResolved: false) {
              nodes {
                id
                isResolved
                comments(first: 1) {
                  nodes {
                    author {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let threads;
    try {
      const body = JSON.stringify({ query: threadsQuery });
      const output = execSync(`gh api graphql`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        input: body,
      });
      const result = JSON.parse(output);

      if (result.errors) {
        throw new Error(`GraphQL error: ${result.errors.map((e) => e.message).join(", ")}`);
      }

      threads = result.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
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
      targetThreads = threads.filter((thread) => {
        const author = thread.comments?.nodes?.[0]?.author?.login || "";
        return botNames.some((botName) => author.toLowerCase().includes(botName.toLowerCase()));
      });
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

        const mutBody = JSON.stringify({ query: resolveMutation });
        execSync(`gh api graphql`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          input: mutBody,
        });

        resolvedCount++;
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
