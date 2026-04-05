import { matchesBotLogin } from "./reviewThreads.js";

function hasActionableReview(latestReviews = [], options = {}) {
  const autoResolveBots = options.autoResolveBots || [];
  return latestReviews.some((review) => {
    const state = String(review.state || "").toUpperCase();
    if (state === "CHANGES_REQUESTED") return true;
    if (state === "COMMENTED" && String(review.body || "").trim()) {
      const authorLogin = review.author?.login || review.user?.login || "";
      if (matchesBotLogin(authorLogin, autoResolveBots)) {
        return false;
      }
      return true;
    }
    return false;
  });
}

function hasUnresolvedAutoResolveThreads(pr = {}, autoResolveBots = []) {
  return (pr.threads || []).some(
    (thread) =>
      !thread.isResolved &&
      matchesBotLogin(thread.authorLogin, autoResolveBots)
  );
}

function determineBacklogActions({ prs = [], autoResolveBots = [] }) {
  const actions = [];

  for (const pr of prs) {
    if (pr.isPaused) {
      continue;
    }

    if (pr.mergeable === false) {
      actions.push({ type: "resolve_conflict", prNumber: pr.prNumber });
      continue;
    }

    if (hasUnresolvedAutoResolveThreads(pr, autoResolveBots)) {
      actions.push({ type: "resolve_threads", prNumber: pr.prNumber });
    }

    if (hasActionableReview(pr.latestReviews, { autoResolveBots })) {
      actions.push({ type: "review_backlog", prNumber: pr.prNumber });
    }
  }

  return actions;
}

export {
  determineBacklogActions,
  hasActionableReview,
  hasUnresolvedAutoResolveThreads,
};
