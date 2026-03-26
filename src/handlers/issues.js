import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgentWithReaction } from "../actions/spawnAgentWithReaction.js";
import { isOnCooldown, setCooldown } from "./utils.js";
import { addInProgressLabel, getIssueAssignees } from "../issueCoordination.js";

const defaultDeps = {
  getConfig,
  getRepoPath,
  renderPrompt,
  spawnAgentWithReaction,
  isOnCooldown,
  setCooldown,
  addInProgressLabel,
  getIssueAssignees,
};

function createHandleIssues(deps = defaultDeps) {
  return function handleIssues(payload) {
    const getIssueAssigneesFn = deps.getIssueAssignees || (() => []);
    const config = deps.getConfig();
    if (!config.settings.enabledEvents.issues) return;

    const issue = payload.issue;
    const repo = payload.repository.full_name;
    const repoPath = deps.getRepoPath(repo);

    if (!repoPath) return;
    if (payload.action !== "opened" && payload.action !== "labeled") return;

    const labels = issue.labels.map((l) => l.name);
    const repoOwner = repo.split("/")[0];
    const assignees = getIssueAssigneesFn(repo, issue.number);
    if (assignees.includes(repoOwner)) {
      logEvent("SKIP", "owner-assigned", repo, `Issue #${issue.number}`);
      return;
    }

    // Two modes: labeled issues (deploy-failure, auto-fix) OR any new issue with agent-task label
    const isAgentTask = labels.includes("agent-task");
    const isAutoLabel = config.settings.issueLabels.some((l) =>
      labels.includes(l)
    );
    if (!isAgentTask && !isAutoLabel) return;

    const jobKey = `issue-${repo}-${issue.number}`;
    if (deps.isOnCooldown(jobKey)) {
      logEvent("SKIP", "cooldown", repo, jobKey);
      return;
    }

    const prompt = isAgentTask
      ? deps.renderPrompt("agent_task", {
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueBody: (issue.body || "").slice(0, 1500),
          labels: labels.join(", "),
          repo,
        })
      : deps.renderPrompt("issues", {
          issueNumber: issue.number,
          issueTitle: issue.title,
          action: payload.action,
          labels: labels.join(", "),
          repo,
        });

    if (config.settings.useLabelsForCoordination) {
      deps.addInProgressLabel(repo, issue.number, config.settings.inProgressLabel);
    }

    deps.setCooldown(jobKey);
    deps.spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
  };
}

const handleIssues = createHandleIssues();

export { createHandleIssues, handleIssues };
