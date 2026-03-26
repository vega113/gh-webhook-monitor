import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { reactToComment } from "../actions/reactions.js";
import { isOnCooldown, setCooldown } from "./utils.js";
import { getRateLimiter } from "../rateLimiterInstance.js";
import { addInProgressLabel, getIssueAssignees } from "../issueCoordination.js";

const defaultDeps = {
  getConfig,
  getRepoPath,
  renderPrompt,
  spawnAgent,
  spawnAgentWithReaction,
  reactToComment,
  isOnCooldown,
  setCooldown,
  getRateLimiter,
  addInProgressLabel,
  getIssueAssignees,
};

function createHandleIssueComment(deps = defaultDeps) {
  return function handleIssueComment(payload) {
    const getIssueAssigneesFn = deps.getIssueAssignees || (() => []);
    const config = deps.getConfig();
    if (!config.settings.enabledEvents.issue_comment) return;

    const comment = payload.comment;
    const issue = payload.issue;
    const repo = payload.repository.full_name;
    const repoPath = deps.getRepoPath(repo);

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
    const repoOwner = repo.split("/")[0];

    if (issue.pull_request) {
      // PR comment — only react to trigger keywords
      if (!hasTrigger) return;

      const rateLimiter = deps.getRateLimiter();
      const actionType = "spawnAgent";

      // Check rate limit
      if (!rateLimiter.canExecute(issue.number, actionType)) {
        logEvent("SKIP", "rate-limited", repo, `PR #${issue.number}-${actionType}`);
        return;
      }

      const jobKey = `comment-${repo}-${issue.number}-${comment.id}`;
      const prompt = deps.renderPrompt("issue_comment", {
        prNumber: issue.number,
        prTitle: issue.title,
        author: comment.user.login,
        body: comment.body.slice(0, 500),
        repo,
      });
      rateLimiter.recordExecution(issue.number, actionType);
      deps.spawnAgent(repoPath, prompt, jobKey, repo);
    } else {
      // Issue comment — react if the issue has agent-task label OR comment has trigger keyword
      const labels = (issue.labels || []).map((l) => l.name);
      const isAgentIssue =
        labels.includes("agent-task") ||
        config.settings.issueLabels.some((l) => labels.includes(l));
      if (!isAgentIssue && !hasTrigger) return;

      const assignees = getIssueAssigneesFn(repo, issue.number);
      if (assignees.includes(repoOwner)) {
        logEvent("SKIP", "owner-assigned", repo, `Issue #${issue.number}`);
        return;
      }

      const jobKey = `issue-comment-${repo}-${issue.number}-${comment.id}`;
      if (deps.isOnCooldown(`issue-${repo}-${issue.number}`)) {
        logEvent("SKIP", "cooldown", repo, jobKey);
        return;
      }

      // React with eyes on the comment itself
      deps.reactToComment(repo, comment.id, "eyes");

      const prompt = deps.renderPrompt("issue_followup", {
        issueNumber: issue.number,
        issueTitle: issue.title,
        author: comment.user.login,
        body: comment.body.slice(0, 500),
        labels: labels.join(", "),
        repo,
      });

      if (config.settings.useLabelsForCoordination) {
        deps.addInProgressLabel(repo, issue.number, config.settings.inProgressLabel);
      }

      deps.setCooldown(`issue-${repo}-${issue.number}`);
      deps.spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
    }
  };
}

const handleIssueComment = createHandleIssueComment();

export { createHandleIssueComment, handleIssueComment };
