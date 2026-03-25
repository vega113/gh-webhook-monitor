import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { isOnCooldown, setCooldown } from "./utils.js";
import {
  isIssueAssigned,
  assignIssueToBot,
  addInProgressLabel,
} from "../issueCoordination.js";

function handleIssues(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.issues) return;

  const issue = payload.issue;
  const repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo);

  if (!repoPath) return;
  if (payload.action !== "opened" && payload.action !== "labeled") return;

  const labels = issue.labels.map((l) => l.name);

  // Two modes: labeled issues (deploy-failure, auto-fix) OR any new issue with agent-task label
  const isAgentTask = labels.includes("agent-task");
  const isAutoLabel = config.settings.issueLabels.some((l) =>
    labels.includes(l)
  );
  if (!isAgentTask && !isAutoLabel) return;

  const jobKey = `issue-${repo}-${issue.number}`;
  if (isOnCooldown(jobKey)) {
    logEvent("SKIP", "cooldown", repo, jobKey);
    return;
  }

  // Check if issue is already assigned (being handled)
  const settings = config.settings;
  if (settings.useAssignmentForCoordination && isIssueAssigned(repo, issue.number)) {
    logEvent("SKIP", "already-assigned", repo, `Issue #${issue.number}`);
    return;
  }

  // For agent-task issues, use the issue body as additional context
  const prompt = isAgentTask
    ? renderPrompt("agent_task", {
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: (issue.body || "").slice(0, 1500),
        labels: labels.join(", "),
        repo,
      })
    : renderPrompt("issues", {
        issueNumber: issue.number,
        issueTitle: issue.title,
        action: payload.action,
        labels: labels.join(", "),
        repo,
      });

  // Assign issue to bot to coordinate handling
  if (settings.useAssignmentForCoordination && settings.botUsername) {
    if (!assignIssueToBot(repo, issue.number, settings.botUsername)) {
      logEvent("WARN", "assignment-failed", repo, `Issue #${issue.number}`);
      // Fall back to label-based coordination
      if (settings.useLabelsForCoordination) {
        addInProgressLabel(repo, issue.number, settings.inProgressLabel);
      }
    }
  } else if (settings.useLabelsForCoordination) {
    // Use label-based coordination as backup
    addInProgressLabel(repo, issue.number, settings.inProgressLabel);
  }

  setCooldown(jobKey);
  spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
}

export { handleIssues };
