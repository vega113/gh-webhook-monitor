import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { resolveThreads } from "../actions/resolveThreads.js";
import { hasLabel, AGENT_PR_LABEL } from "./utils.js";
import { getRateLimiter } from "../rateLimiterInstance.js";
import { getDispatcher } from "../dispatcherInstance.js";

async function handlePullRequestReview(payload) {
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

  const reviewer = review.user.login;
  const autoResolveBots = config.settings.autoResolveBots || [];

  // Check if reviewer is a bot to auto-resolve threads
  const isAutoResolveBot = autoResolveBots.some((botName) =>
    reviewer.toLowerCase().includes(botName.toLowerCase())
  );

  if (isAutoResolveBot) {
    logEvent(
      "RESOLVE_THREADS",
      "triggered",
      repo,
      `PR #${pr.number}: Review from bot "${reviewer}" - auto-resolving threads`
    );
    await resolveThreads(repo, pr.number, [reviewer]);
    return;
  }

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

  const rateLimiter = getRateLimiter();
  const actionType = "spawnAgent";

  // Check rate limit
  if (!rateLimiter.canExecute(pr.number, actionType)) {
    logEvent("SKIP", "rate-limited", repo, `PR #${pr.number}-${actionType}`);
    return;
  }

  const prompt = renderPrompt("pull_request_review", {
    prNumber: pr.number,
    prTitle: pr.title,
    reviewer: review.user.login,
    reviewState: review.state,
    repo,
  });

  const jobKey = `review-${repo}-${pr.number}`;
  rateLimiter.recordExecution(pr.number, actionType);
  spawnAgent(repoPath, prompt, jobKey, repo);
}

export { handlePullRequestReview };
