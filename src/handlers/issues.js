import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { isOnCooldown, setCooldown } from "./utils.js";

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

  setCooldown(jobKey);
  spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
}

export { handleIssues };
