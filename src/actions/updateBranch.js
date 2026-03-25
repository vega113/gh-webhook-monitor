import { execSync } from "node:child_process";
import { logEvent } from "../logger.js";

/**
 * Update a PR branch with the latest base branch
 * Uses `gh pr update-branch` to sync the PR branch with its base
 *
 * @param {string} repo - Repository in format owner/repo
 * @param {number} prNumber - PR number to update
 * @returns {Promise<Object>} Status object with success flag and conflict indication
 */
async function updateBranch(repo, prNumber) {
  try {
    logEvent(
      "UPDATE_BRANCH",
      "attempt",
      repo,
      `PR #${prNumber}: Attempting to update branch`
    );

    // Execute gh pr update-branch command
    const output = execSync(
      `gh pr update-branch ${prNumber} --repo ${repo}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );

    logEvent(
      "UPDATE_BRANCH",
      "success",
      repo,
      `PR #${prNumber}: Branch updated successfully`
    );

    return {
      success: true,
      prNumber,
      repo,
      hasConflict: false,
      message: "Branch updated with latest base",
    };
  } catch (err) {
    const errorMessage = err.message || err.stderr?.toString() || "";

    // Check if error indicates a merge conflict (DIRTY state)
    const hasConflict = errorMessage.includes("DIRTY") ||
                       errorMessage.includes("merge conflict") ||
                       errorMessage.includes("cannot be updated");

    if (hasConflict) {
      logEvent(
        "UPDATE_BRANCH",
        "conflict",
        repo,
        `PR #${prNumber}: Merge conflict detected during branch update`
      );

      return {
        success: false,
        prNumber,
        repo,
        hasConflict: true,
        message: "Merge conflict detected - manual resolution required",
      };
    }

    // Other errors (permission, not found, etc)
    logEvent(
      "UPDATE_BRANCH",
      "error",
      repo,
      `PR #${prNumber}: ${errorMessage.slice(0, 100)}`
    );

    return {
      success: false,
      prNumber,
      repo,
      hasConflict: false,
      message: `Update failed: ${errorMessage.slice(0, 50)}`,
    };
  }
}

export { updateBranch };
