import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { reactToComment } from "../actions/reactions.js";
import { isOnCooldown, setCooldown } from "./utils.js";
import { getRateLimiter } from "../rateLimiterInstance.js";
import {
  isIssueAssigned,
  assignIssueToBot,
  addInProgressLabel,
} from "../issueCoordination.js";

function handleIssueComment(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.issue_comment) return;

  const comment = payload.comment;
  const issue = payload.issue;
  const repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo);

  if (!repoPath) return;
  if (payload.action !== "created") return;
  if (
    comment.user.type === "Bot" ||
    config.settings.ignoredBots.some((b) => comment.user.login.includes(b))
  )
    return;

  const body = comment.body.toLowerCase();
  const hasTrigger = config.settings.triggerKeywords.some((kw) =>
    body.includes(kw.toLowerCase())
  );

  if (issue.pull_request) {
    // PR comment — only react to trigger keywords
    if (!hasTrigger) return;

    const rateLimiter = getRateLimiter();
    const actionType = "spawnAgent";

    // Check rate limit
    if (!rateLimiter.canExecute(issue.number, actionType)) {
      logEvent("SKIP", "rate-limited", repo, `PR #${issue.number}-${actionType}`);
      return;
    }

    const jobKey = `comment-${repo}-${issue.number}-${comment.id}`;
    const prompt = renderPrompt("issue_comment", {
      prNumber: issue.number,
      prTitle: issue.title,
      author: comment.user.login,
      body: comment.body.slice(0, 500),
      repo,
    });
    rateLimiter.recordExecution(issue.number, actionType);
    spawnAgent(repoPath, prompt, jobKey, repo);
  } else {
    // Issue comment — react if the issue has agent-task label OR comment has trigger keyword
    const labels = (issue.labels || []).map((l) => l.name);
    const isAgentIssue =
      labels.includes("agent-task") ||
      config.settings.issueLabels.some((l) => labels.includes(l));
    if (!isAgentIssue && !hasTrigger) return;

    const jobKey = `issue-comment-${repo}-${issue.number}-${comment.id}`;
    if (isOnCooldown(`issue-${repo}-${issue.number}`)) {
      logEvent("SKIP", "cooldown", repo, jobKey);
      return;
    }

    // Check if issue is already assigned (being handled)
    const settings = config.settings;
    if (settings.useAssignmentForCoordination && isIssueAssigned(repo, issue.number)) {
      logEvent("SKIP", "already-assigned", repo, `Issue #${issue.number}`);
      return;
    }

    // React with eyes on the comment itself
    reactToComment(repo, comment.id, "eyes");

    const prompt = renderPrompt("issue_followup", {
      issueNumber: issue.number,
      issueTitle: issue.title,
      author: comment.user.login,
      body: comment.body.slice(0, 500),
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

    setCooldown(`issue-${repo}-${issue.number}`);
    spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
  }
}

export { handleIssueComment };
