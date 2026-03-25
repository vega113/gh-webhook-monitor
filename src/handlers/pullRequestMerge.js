import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { updateBranch } from "../actions/updateBranch.js";

/**
 * Handle pull_request:closed events with merged=true
 * Triggers cascade updates to all open PRs on the same base branch
 */
async function handlePullRequestMerge(payload, prStateCache) {
  const config = getConfig();
  if (!config.settings.enabledEvents.pull_request) return;

  const pr = payload.pull_request;
  const repo = payload.repository.full_name;

  if (!getRepoPath(repo)) return;

  // Only handle merge events
  if (payload.action !== "closed" || !pr.merged) return;

  logEvent(
    "PR_MERGE",
    "detected",
    repo,
    `#${pr.number}: ${pr.title} merged into ${pr.base?.ref}`
  );

  // If we have PR state cache, get all open PRs on same base branch
  if (prStateCache) {
    const baseBranch = pr.base?.ref;
    const openPRs = prStateCache.listOpenPRs(repo, baseBranch);

    // Filter out the PR that was just merged
    const targetPRs = openPRs.filter((p) => p.prNumber !== pr.number);

    if (targetPRs.length > 0) {
      logEvent(
        "PR_MERGE",
        "cascade-start",
        repo,
        `Found ${targetPRs.length} open PRs to update on base branch ${baseBranch}`
      );

      // Update each target PR branch
      for (const targetPR of targetPRs) {
        // Check if recently updated to avoid duplicate updates
        const wasRecent = prStateCache.wasRecentlyUpdated(
          repo,
          targetPR.prNumber,
          60000 // 1 minute cooldown
        );

        if (wasRecent) {
          logEvent(
            "PR_MERGE",
            "skip-recent",
            repo,
            `PR #${targetPR.prNumber}: Skipped (recently updated)`
          );
          continue;
        }

        // Attempt to update the branch
        const result = await updateBranch(repo, targetPR.prNumber);

        // Record this update attempt
        prStateCache.recordPRUpdateAttempt(repo, targetPR.prNumber);

        if (result.success) {
          logEvent(
            "PR_MERGE",
            "cascade-success",
            repo,
            `PR #${targetPR.prNumber}: Branch updated via cascade`
          );
        } else if (result.hasConflict) {
          logEvent(
            "PR_MERGE",
            "cascade-conflict",
            repo,
            `PR #${targetPR.prNumber}: Merge conflict during cascade update`
          );
        } else {
          logEvent(
            "PR_MERGE",
            "cascade-error",
            repo,
            `PR #${targetPR.prNumber}: ${result.message}`
          );
        }
      }

      logEvent(
        "PR_MERGE",
        "cascade-complete",
        repo,
        `Cascade updates complete for ${targetPRs.length} PRs`
      );
    } else {
      logEvent(
        "PR_MERGE",
        "no-targets",
        repo,
        `No other open PRs on base branch ${baseBranch}`
      );
    }
  }
}

export { handlePullRequestMerge };
