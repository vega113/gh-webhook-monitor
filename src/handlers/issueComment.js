import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { reactToComment } from "../actions/reactions.js";
import { isOnCooldown, setCooldown } from "./utils.js";

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
    const jobKey = `comment-${repo}-${issue.number}-${comment.id}`;
    const prompt = renderPrompt("issue_comment", {
      prNumber: issue.number,
      prTitle: issue.title,
      author: comment.user.login,
      body: comment.body.slice(0, 500),
      repo,
    });
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

    setCooldown(`issue-${repo}-${issue.number}`);
    spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
  }
}

export { handleIssueComment };
