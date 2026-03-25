import { execSync } from "node:child_process";
import { logEvent } from "./logger.js";

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
    logEvent("ERROR", "isIssueAssigned", repo, `Issue #${issueNumber}: ${error.message}`);
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
    logEvent("ERROR", "getIssueAssignees", repo, `Issue #${issueNumber}: ${error.message}`);
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
    execSync(
      `gh api repos/${repo}/issues/${issueNumber} -f assignees='["${botLogin}"]'`,
      { encoding: "utf-8" }
    );
    logEvent("COORD", "assigned", repo, `Issue #${issueNumber} -> ${botLogin}`);
    return true;
  } catch (error) {
    logEvent("ERROR", "assignIssueToBot", repo, `Issue #${issueNumber}: ${error.message}`);
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
    execSync(
      `gh api repos/${repo}/issues/${issueNumber} -f assignees='[]'`,
      { encoding: "utf-8" }
    );
    logEvent("COORD", "unassigned", repo, `Issue #${issueNumber}`);
    return true;
  } catch (error) {
    logEvent("ERROR", "unassignIssue", repo, `Issue #${issueNumber}: ${error.message}`);
    return false;
  }
}

/**
 * Add in-progress label to an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name (e.g., "agent-working")
 * @returns {boolean} True if label was added
 */
function addInProgressLabel(repo, issueNumber, labelName) {
  try {
    // Get current labels
    const current = execSync(
      `gh api repos/${repo}/issues/${issueNumber} --jq '.labels[].name'`,
      { encoding: "utf-8" }
    ).trim();
    const labels = current ? current.split("\n") : [];

    // Add the label if not already present
    if (!labels.includes(labelName)) {
      labels.push(labelName);
      execSync(
        `gh api repos/${repo}/issues/${issueNumber} -f labels='${JSON.stringify(labels)}'`,
        { encoding: "utf-8" }
      );
      logEvent("COORD", "label-added", repo, `Issue #${issueNumber}: ${labelName}`);
    }
    return true;
  } catch (error) {
    logEvent("ERROR", "addInProgressLabel", repo, `Issue #${issueNumber}: ${error.message}`);
    return false;
  }
}

/**
 * Remove in-progress label from an issue
 * @param {string} repo - Repository full name (owner/repo)
 * @param {number} issueNumber - Issue number
 * @param {string} labelName - Label name to remove
 * @returns {boolean} True if label was removed
 */
function removeInProgressLabel(repo, issueNumber, labelName) {
  try {
    // Get current labels
    const current = execSync(
      `gh api repos/${repo}/issues/${issueNumber} --jq '.labels[].name'`,
      { encoding: "utf-8" }
    ).trim();
    const labels = current ? current.split("\n") : [];

    // Remove the label if present
    const filtered = labels.filter((l) => l !== labelName);
    if (filtered.length !== labels.length) {
      execSync(
        `gh api repos/${repo}/issues/${issueNumber} -f labels='${JSON.stringify(filtered)}'`,
        { encoding: "utf-8" }
      );
      logEvent("COORD", "label-removed", repo, `Issue #${issueNumber}: ${labelName}`);
    }
    return true;
  } catch (error) {
    logEvent("ERROR", "removeInProgressLabel", repo, `Issue #${issueNumber}: ${error.message}`);
    return false;
  }
}

export {
  isIssueAssigned,
  getIssueAssignees,
  assignIssueToBot,
  unassignIssue,
  addInProgressLabel,
  removeInProgressLabel,
};
