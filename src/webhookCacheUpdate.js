function buildWebhookCacheUpdate(eventType, payload) {
  const repo = payload.repository?.full_name;
  if (!repo) return null;

  if (eventType === "pull_request" && payload.pull_request?.number) {
    return {
      repo,
      prNumber: payload.pull_request.number,
      webhookData: {
        type: "pull_request",
        pullRequest: payload.pull_request,
      },
    };
  }

  if (eventType === "pull_request_review" && payload.pull_request?.number) {
    return {
      repo,
      prNumber: payload.pull_request.number,
      webhookData: {
        type: "pull_request_review",
        review: payload.review,
      },
    };
  }

  if (eventType === "check_suite") {
    const prNumber = payload.check_suite?.pull_requests?.[0]?.number;
    if (!prNumber) return null;
    return {
      repo,
      prNumber,
      webhookData: {
        type: "check_suite",
        checkSuite: payload.check_suite,
      },
    };
  }

  return null;
}

export { buildWebhookCacheUpdate };
