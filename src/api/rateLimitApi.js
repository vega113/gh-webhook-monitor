/**
 * Rate Limit API endpoints
 * GET /api/rate-limits - Get current rate limit state
 * POST /api/rate-limits - Update rate limit intervals
 * POST /api/rate-limits/reset - Reset rate limits (for testing)
 */

function setupRateLimitRoutes(app, rateLimiter) {
  // Get current rate limit state
  app.get("/api/rate-limits", (_req, res) => {
    res.json(rateLimiter.getState());
  });

  // Update rate limit intervals
  app.post("/api/rate-limits", (req, res) => {
    const { updateBranchInterval, rerunGateInterval, resolveThreadsInterval, spawnAgentInterval, batchWindowMs } = req.body;

    // Update only provided values
    if (updateBranchInterval !== undefined) rateLimiter.config.updateBranchInterval = updateBranchInterval;
    if (rerunGateInterval !== undefined) rateLimiter.config.rerunGateInterval = rerunGateInterval;
    if (resolveThreadsInterval !== undefined) rateLimiter.config.resolveThreadsInterval = resolveThreadsInterval;
    if (spawnAgentInterval !== undefined) rateLimiter.config.spawnAgentInterval = spawnAgentInterval;
    if (batchWindowMs !== undefined) {
      rateLimiter.config.batchWindowMs = batchWindowMs;
      // Restart the batch processing interval with new window
      rateLimiter.stopBatchProcessing();
      rateLimiter.startBatchProcessing();
    }

    res.json({ ok: true, config: rateLimiter.config });
  });

  // Reset rate limits for testing
  app.post("/api/rate-limits/reset", (req, res) => {
    const { prNumber, actionType } = req.body;

    if (prNumber !== undefined && actionType !== undefined) {
      rateLimiter.reset(prNumber, actionType);
    } else {
      rateLimiter.resetAll();
    }

    res.json({ ok: true });
  });
}

export { setupRateLimitRoutes };
