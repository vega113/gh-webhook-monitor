import { execSync } from "node:child_process";
import { logEvent } from "./logger.js";

/**
 * Check if an error is a rate limit error
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is a rate limit error
 */
function isRateLimitError(error) {
  const errorStr = error.message.toLowerCase();
  // Check for common rate limit error patterns
  return (
    errorStr.includes("api rate limit exceeded") ||
    errorStr.includes("429") ||
    errorStr.includes("rate limit") ||
    errorStr.includes("secondary rate limit")
  );
}

/**
 * Check if an issue has assignees (is being handled)
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @returns {boolean} True if issue has assignees
 */
function isIssueAssigned(repo, issueNumber) {
  try {
    const result = execSync(
      `gh api repos/${repo}/issues/${issueNumber} --jq '.assignees | length'`,
      { encoding: "utf-8" }
    ).trim();
    return parseInt(result) > 0;
  } catch (error) {
    if (isRateLimitError(error)) {
      logEvent("RATE_LIMIT", "isIssueAssigned", repo, `Issue #${issueNumber}: ${error.message}`);
    } else {
      logEvent("ERROR", "isIssueAssigned", repo, `Issue #${issueNumber}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Get the list of assignees for an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @returns {Array<string>} List of assignee logins
 */
function getIssueAssignees(repo, issueNumber) {
  try {
    const result = execSync(
      `gh api repos/${repo}/issues/${issueNumber} --jq '.assignees[].login' 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    return result ? result.split("\n") : [];
  } catch (error) {
    if (isRateLimitError(error)) {
      logEvent("RATE_LIMIT", "getIssueAssignees", repo, `Issue #${issueNumber}: ${error.message}`);
    } else {
      logEvent("ERROR", "getIssueAssignees", repo, `Issue #${issueNumber}: ${error.message}`);
    }
    return [];
  }
}

/**
 * Assign an issue to the bot
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} botLogin - Bot account login (e.g., github-actions[bot])
 * @returns {boolean} True if assignment succeeded
 */
function assignIssueToBot(repo, issueNumber, botLogin) {
  try {
    // Use PATCH with proper JSON body for assignees
    const body = JSON.stringify({ assignees: [botLogin] });
    execSync(
      `echo ${JSON.stringify(body)} | gh api repos/${repo}/issues/${issueNumber} --input -`,
      { encoding: "utf-8" }
    );
    logEvent("COORD", "assigned", repo, `Issue #${issueNumber} -> ${botLogin}`);
    return true;
  } catch (error) {
    if (isRateLimitError(error)) {
      logEvent("RATE_LIMIT", "assignIssueToBot", repo, `Issue #${issueNumber}: ${error.message}`);
    } else {
      logEvent("ERROR", "assignIssueToBot", repo, `Issue #${issueNumber}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Unassign an issue (remove all assignees)
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @returns {boolean} True if unassignment succeeded
 */
function unassignIssue(repo, issueNumber) {
  try {
    const body = JSON.stringify({ assignees: [] });
    execSync(
      `echo ${JSON.stringify(body)} | gh api repos/${repo}/issues/${issueNumber} --input -`,
      { encoding: "utf-8" }
    );
    logEvent("COORD", "unassigned", repo, `Issue #${issueNumber}`);
    return true;
  } catch (error) {
    if (isRateLimitError(error)) {
      logEvent("RATE_LIMIT", "unassignIssue", repo, `Issue #${issueNumber}: ${error.message}`);
    } else {
      logEvent("ERROR", "unassignIssue", repo, `Issue #${issueNumber}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Helper function to get and update labels on an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name
 * @param {string} action - 'add' or 'remove'
 * @returns {boolean} True if operation succeeded and made changes
 */
function getAndUpdateLabel(repo, issueNumber, labelName, action) {
  try {
    // Get current labels
    const current = execSync(
      `gh api repos/${repo}/issues/${issueNumber} --jq '.labels[].name'`,
      { encoding: "utf-8" }
    ).trim();
    const labels = current ? current.split("\n") : [];
    const hadLabel = labels.includes(labelName);

    let updatedLabels = labels;
    if (action === "add") {
      if (!hadLabel) {
        updatedLabels = [...labels, labelName];
      } else {
        // Label already exists, nothing to do
        return true;
      }
    } else if (action === "remove") {
      if (hadLabel) {
        updatedLabels = labels.filter((l) => l !== labelName);
      } else {
        // Label doesn't exist, nothing to do
        return true;
      }
    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    // Only update if labels changed
    if (updatedLabels.length !== labels.length || updatedLabels.some((l, i) => l !== labels[i])) {
      const body = JSON.stringify({ labels: updatedLabels });
      execSync(
        `echo ${JSON.stringify(body)} | gh api repos/${repo}/issues/${issueNumber} --input -`,
        { encoding: "utf-8" }
      );
    }
    return true;
  } catch (error) {
    if (isRateLimitError(error)) {
      logEvent("RATE_LIMIT", "getAndUpdateLabel", repo, `Issue #${issueNumber} ${action}: ${error.message}`);
    } else {
      logEvent("ERROR", "getAndUpdateLabel", repo, `Issue #${issueNumber} ${action}: ${error.message}`);
    }
    return false;
  }
}

/**
 * Add in-progress label to an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name (e.g., "agent-working")
 * @returns {boolean} True if label operation succeeded
 */
function addInProgressLabel(repo, issueNumber, labelName) {
  const success = getAndUpdateLabel(repo, issueNumber, labelName, "add");
  if (success) {
    logEvent("COORD", "label-added", repo, `Issue #${issueNumber}: ${labelName}`);
  } else {
    logEvent("ERROR", "addInProgressLabel", repo, `Issue #${issueNumber}: Failed to add label`);
  }
  return success;
}

/**
 * Remove in-progress label from an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name to remove
 * @returns {boolean} True if label operation succeeded
 */
function removeInProgressLabel(repo, issueNumber, labelName) {
  const success = getAndUpdateLabel(repo, issueNumber, labelName, "remove");
  if (success) {
    logEvent("COORD", "label-removed", repo, `Issue #${issueNumber}: ${labelName}`);
  } else {
    logEvent("ERROR", "removeInProgressLabel", repo, `Issue #${issueNumber}: Failed to remove label`);
  }
  return success;
}

export {
  isIssueAssigned,
  getIssueAssignees,
  assignIssueToBot,
  unassignIssue,
  addInProgressLabel,
  removeInProgressLabel,
  getAndUpdateLabel,
  isRateLimitError,
};
