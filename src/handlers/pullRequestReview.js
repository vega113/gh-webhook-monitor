import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { isOnCooldown, setCooldown, hasLabel, AGENT_PR_LABEL } from "./utils.js";

function handlePullRequestReview(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.pull_request_review) return;

  const review = payload.review;
  const pr = payload.pull_request;
  const repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo);

  if (!repoPath) return;
  if (review.state !== "changes_requested" && review.state !== "commented")
    return;
  if (config.settings.ignoredBots.some((b) => review.user.login.includes(b)))
    return;

  // Anti-loop: skip reviews on agent-authored PRs from bots (human reviews still handled)
  if (
    hasLabel(pr.labels || [], AGENT_PR_LABEL) &&
    review.user.type === "Bot"
  ) {
    logEvent(
      "SKIP",
      "agent-pr-bot-review",
      repo,
      `PR #${pr.number} is agent-authored, bot review ignored`
    );
    return;
  }

  const jobKey = `review-${repo}-${pr.number}`;
  if (isOnCooldown(jobKey)) {
    logEvent("SKIP", "cooldown", repo, jobKey);
    return;
  }

  const prompt = renderPrompt("pull_request_review", {
    prNumber: pr.number,
    prTitle: pr.title,
    reviewer: review.user.login,
    reviewState: review.state,
    repo,
  });

  setCooldown(jobKey);
  spawnAgent(repoPath, prompt, jobKey);
}

export { handlePullRequestReview };
