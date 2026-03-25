import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";

function handlePullRequest(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.pull_request) return;

  const pr = payload.pull_request;
  const repo = payload.repository.full_name;

  if (!getRepoPath(repo)) return;

  if (payload.action === "opened" || payload.action === "synchronize") {
    logEvent("PR", payload.action, repo, `#${pr.number}: ${pr.title}`);
  }
}

export { handlePullRequest };
