function hasActionableReview(latestReviews = []) {
  return latestReviews.some((review) => {
    const state = String(review.state || "").toUpperCase();
    if (state === "CHANGES_REQUESTED") return true;
    if (state === "COMMENTED" && String(review.body || "").trim()) return true;
    return false;
  });
}

function determineBacklogActions({ prs = [] }) {
  const actions = [];

  for (const pr of prs) {
    if (pr.mergeable === false) {
      actions.push({ type: "resolve_conflict", prNumber: pr.prNumber });
      continue;
    }

    if (hasActionableReview(pr.latestReviews)) {
      actions.push({ type: "review_backlog", prNumber: pr.prNumber });
    }
  }

  return actions;
}

export { determineBacklogActions, hasActionableReview };
