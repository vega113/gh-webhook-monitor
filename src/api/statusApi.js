import { logEvent } from "../logger.js";
import { getPRStateCache } from "../dispatcherInstance.js";
import { getConfig } from "../config.js";

/**
 * Setup status API routes for PR status monitoring
 */
function setupStatusRoutes(app, statusCache) {
  // GET /api/status - Get all PR statuses
  app.get("/api/status", async (_req, res) => {
    try {
      const prStateCache = getPRStateCache();
      const config = getConfig();
      const statuses = [];
      if (prStateCache) {
        for (const repo of Object.keys(config.repos || {})) {
          try {
            prStateCache.ensureRepoSynced(repo);
            const allPRs = prStateCache.getAllOpenPRs(repo);
            for (const pr of allPRs) {
              const status = await statusCache.refresh(repo, pr.prNumber);
              if (status) statuses.push(status);
            }
          } catch (err) {
            logEvent("ERROR", "status-api-sync", repo, err.message);
          }
        }
      }
      res.json({
        ok: true,
        statuses,
        timestamp: new Date().toISOString(),
        count: statuses.length,
      });
    } catch (err) {
      logEvent("ERROR", "status-api", "system", `Failed to get statuses: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/status/:repo/:prNumber - Get specific PR status
  app.get("/api/status/:repo/:prNumber", async (req, res) => {
    try {
      const { repo, prNumber } = req.params;
      const fullRepo = repo.includes("/") ? repo : `${repo}/${req.params.repo}`;
      const status = await statusCache.get(fullRepo, parseInt(prNumber));

      if (!status) {
        return res.status(404).json({ error: "PR not found in cache" });
      }

      res.json({
        ok: true,
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logEvent(
        "ERROR",
        "status-api",
        `${req.params.repo}/${req.params.prNumber}`,
        `Failed to get status: ${err.message}`
      );
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/status/repo/:repo - Get all statuses for a repo
  app.get("/api/status/repo/:owner/:repo", async (req, res) => {
    try {
      const fullRepo = `${req.params.owner}/${req.params.repo}`;
      const prStateCache = getPRStateCache();

      if (!prStateCache) {
        return res.status(500).json({ error: "PR state cache not initialized" });
      }

      const allPRs = prStateCache.getAllOpenPRs(fullRepo);
      const statuses = [];

      for (const pr of allPRs) {
        const status = await statusCache.get(fullRepo, pr.prNumber);
        if (status) {
          statuses.push(status);
        }
      }

      res.json({
        ok: true,
        repo: fullRepo,
        statuses,
        timestamp: new Date().toISOString(),
        count: statuses.length,
      });
    } catch (err) {
      const repo = `${req.params.owner}/${req.params.repo}`;
      logEvent("ERROR", "status-api", repo, `Failed to get repo statuses: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/status/refresh/:owner/:repo/:prNumber - Manually refresh PR status
  app.post("/api/status/refresh/:owner/:repo/:prNumber", async (req, res) => {
    try {
      const fullRepo = `${req.params.owner}/${req.params.repo}`;
      const prNumber = parseInt(req.params.prNumber);

      const status = await statusCache.refresh(fullRepo, prNumber);

      if (!status) {
        return res.status(404).json({ error: "PR not found" });
      }

      logEvent("INFO", "status-refresh", fullRepo, `PR #${prNumber} status refreshed`);

      res.json({
        ok: true,
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const repo = `${req.params.owner}/${req.params.repo}`;
      logEvent(
        "ERROR",
        "status-refresh",
        repo,
        `PR #${req.params.prNumber}: ${err.message}`
      );
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/status/refresh/:owner/:repo - Manually refresh all PR statuses for a repo
  app.post("/api/status/refresh/:owner/:repo", async (req, res) => {
    try {
      const fullRepo = `${req.params.owner}/${req.params.repo}`;
      const prStateCache = getPRStateCache();

      if (!prStateCache) {
        return res.status(500).json({ error: "PR state cache not initialized" });
      }

      const allPRs = prStateCache.getAllOpenPRs(fullRepo);
      const statuses = [];

      for (const pr of allPRs) {
        const status = await statusCache.refresh(fullRepo, pr.prNumber);
        if (status) {
          statuses.push(status);
        }
      }

      logEvent(
        "INFO",
        "status-refresh",
        fullRepo,
        `Refreshed ${statuses.length} PR statuses`
      );

      res.json({
        ok: true,
        repo: fullRepo,
        refreshed: statuses.length,
        statuses,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const repo = `${req.params.owner}/${req.params.repo}`;
      logEvent("ERROR", "status-refresh", repo, `Failed to refresh statuses: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/status/cache/stats - Get cache statistics
  app.get("/api/status/cache/stats", (_req, res) => {
    try {
      const stats = statusCache.getStats();
      res.json({
        ok: true,
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logEvent("ERROR", "status-api", "system", `Failed to get cache stats: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });
}

export { setupStatusRoutes };
