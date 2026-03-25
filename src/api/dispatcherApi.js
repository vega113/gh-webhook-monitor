/**
 * Dispatcher API endpoints
 * GET /api/dispatch-history/:repo/:prNumber - Decision history for specific PR
 * GET /api/dispatch-history - Recent decisions across all PRs
 * GET /api/dispatch-stats - Dispatcher statistics
 */

function setupDispatcherRoutes(app, dispatcher) {
  // Get decision history for a specific PR
  app.get("/api/dispatch-history/:owner/:repo/:prNumber", (req, res) => {
    const { owner, repo, prNumber } = req.params;
    const fullRepo = `${owner}/${repo}`;
    const prNum = parseInt(prNumber, 10);

    const history = dispatcher.getDecisionHistory(fullRepo, prNum);
    res.json({
      repo: fullRepo,
      prNumber: prNum,
      decisions: history,
      count: history.length,
    });
  });

  // Get recent decisions across all PRs
  app.get("/api/dispatch-history", (req, res) => {
    const limit = parseInt(req.query.limit || "50", 10);
    const recent = dispatcher.getRecentDecisions(Math.min(limit, 200));

    res.json({
      decisions: recent,
      count: recent.length,
    });
  });

  // Get dispatcher statistics
  app.get("/api/dispatch-stats", (req, res) => {
    const recent = dispatcher.getRecentDecisions(200);

    // Count decisions by action type
    const actionCounts = {};
    recent.forEach((d) => {
      d.actions?.forEach((action) => {
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      });
    });

    // Count decisions by event type
    const eventCounts = {};
    recent.forEach((d) => {
      eventCounts[d.event] = (eventCounts[d.event] || 0) + 1;
    });

    res.json({
      historySize: dispatcher.decisionHistory.length,
      maxHistorySize: dispatcher.maxHistorySize,
      actionCounts,
      eventCounts,
    });
  });
}

export { setupDispatcherRoutes };
