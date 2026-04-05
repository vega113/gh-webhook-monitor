import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { hasLabel, AGENT_PR_LABEL } from "./utils.js";
import { getRateLimiter } from "../rateLimiterInstance.js";
import { skipIfPRPaused } from "../prActionGuards.js";
import { matchesBotLogin } from "../reviewThreads.js";

const defaultDeps = {
  getConfig,
  getRepoPath,
  renderPrompt,
  spawnAgent,
  getRateLimiter,
  skipIfPRPaused,
};

function createHandlePullRequestReview(deps = defaultDeps) {
  return async function handlePullRequestReview(payload) {
    const config = deps.getConfig();
    if (!config.settings.enabledEvents.pull_request_review) return;

    const review = payload.review;
    const pr = payload.pull_request;
    const repo = payload.repository.full_name;
    const repoPath = deps.getRepoPath(repo);

    if (!repoPath) return;
    if (deps.skipIfPRPaused(repo, pr.number, "paused PR review handling")) return;
    if (review.state !== "changes_requested" && review.state !== "commented")
      return;
    if (config.settings.ignoredBots.some((bot) => review.user.login.includes(bot)))
      return;

    const reviewer = review.user.login;
    const autoResolveBots = config.settings.autoResolveBots || [];

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

    const isAutoResolveBot = matchesBotLogin(reviewer, autoResolveBots);

    if (isAutoResolveBot) {
      logEvent(
        "RESOLVE_THREADS",
        "triggered",
        repo,
        `PR #${pr.number}: Review from bot "${reviewer}" - resolve threads without spawning an agent`
      );
      return;
    }

    const rateLimiter = deps.getRateLimiter();
    const actionType = "spawnAgent";

    if (!rateLimiter.canExecute(pr.number, actionType)) {
      logEvent("SKIP", "rate-limited", repo, `PR #${pr.number}-${actionType}`);
      return;
    }

    const prompt = deps.renderPrompt("pull_request_review", {
      prNumber: pr.number,
      prTitle: pr.title,
      reviewer: review.user.login,
      reviewState: review.state,
      headBranch: pr.head?.ref || "unknown",
      repo,
    });

    const jobKey = `review-${repo}-${pr.number}`;
    rateLimiter.recordExecution(pr.number, actionType);
    deps.spawnAgent(repoPath, prompt, jobKey, repo, {
      eventType: "pull_request_review",
      reviewState: review.state,
    });
  };
}

const handlePullRequestReview = createHandlePullRequestReview();

export { createHandlePullRequestReview, handlePullRequestReview };
