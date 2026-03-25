import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfig, setConfig, getRepoPath } from "../config.js";
import { getEventLog, getLogDir } from "../logger.js";
import { getActiveJobs, getJobHistory } from "../actions/spawnAgent.js";
import { setupAgentRoutes } from "./agentApi.js";
import { setupRateLimitRoutes } from "./rateLimitApi.js";
import { setupDispatcherRoutes } from "./dispatcherApi.js";
import { setupStatusRoutes } from "./statusApi.js";
import { getIssueAssignees } from "../issueCoordination.js";

function setupRoutes(app, rateLimiter, dispatcher, statusCache = null) {
  // Health check
  app.get("/api/health", (_req, res) => {
    const config = getConfig();
    res.json({
      status: "ok",
      activeJobs: getActiveJobs().size,
      uptime: Math.floor(process.uptime()),
      agentType: config.agent.type,
    });
  });

  // Config endpoints
  app.get("/api/config", (_req, res) => {
    res.json(getConfig());
  });

  app.post("/api/config", (req, res) => {
    const config = getConfig();
    const newConfig = { ...config, ...req.body };
    setConfig(newConfig);
    res.json({ ok: true });
  });

  // Repos endpoints
  app.post("/api/repos", (req, res) => {
    const { name, localPath, enabled } = req.body;
    if (!name || !localPath) {
      return res.status(400).json({ error: "name and localPath required" });
    }
    const config = getConfig();
    config.repos[name] = { localPath, enabled: enabled !== false };
    setConfig(config);
    res.json({ ok: true });
  });

  app.delete("/api/repos/:owner/:repo", (req, res) => {
    const config = getConfig();
    delete config.repos[`${req.params.owner}/${req.params.repo}`];
    setConfig(config);
    res.json({ ok: true });
  });

  // Settings endpoints
  app.post("/api/settings", (req, res) => {
    const config = getConfig();
    config.settings = { ...config.settings, ...req.body };
    setConfig(config);
    res.json({ ok: true });
  });

  // Agent endpoints
  app.post("/api/agent", (req, res) => {
    const config = getConfig();
    config.agent = { ...config.agent, ...req.body };
    setConfig(config);
    res.json({ ok: true });
  });

  // Prompts endpoints
  app.post("/api/prompts", (req, res) => {
    const config = getConfig();
    config.promptTemplates = { ...config.promptTemplates, ...req.body };
    setConfig(config);
    res.json({ ok: true });
  });

  // Event log endpoints
  app.get("/api/events", (_req, res) => {
    res.json(getEventLog());
  });

  // Jobs endpoints
  app.get("/api/jobs", (_req, res) => {
    const activeJobs = getActiveJobs();
    const jobHistory = getJobHistory();
    res.json({
      active: [...activeJobs.entries()].map(([k, v]) => ({
        key: k,
        pid: v.pid,
        running: `${((Date.now() - v.startTime) / 1000).toFixed(0)}s`,
        prompt: v.prompt.slice(0, 200),
        agentType: v.agentType,
        output: v.output.join("").slice(-1000),
      })),
      history: jobHistory.slice(0, 50),
    });
  });

  app.post("/api/jobs/:key/kill", (req, res) => {
    const activeJobs = getActiveJobs();
    const j = activeJobs.get(req.params.key);
    if (!j) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      process.kill(j.pid, "SIGTERM");
    } catch {}
    res.json({ ok: true });
  });

  // Logs endpoint
  app.get("/api/logs/:filename", (req, res) => {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const p = join(getLogDir(), safe);
    if (!existsSync(p)) {
      return res.status(404).send("Not found");
    }
    res
      .type("text/plain")
      .send(readFileSync(p, "utf-8").split("\n").slice(-500).join("\n"));
  });

  // Issue coordination endpoints
  // GET /api/issues/assigned?repo=owner/repo&issue=123
  // Returns assignee information for a specific issue
  app.get("/api/issues/assigned", (req, res) => {
    const repo = req.query.repo;
    const issue = req.query.issue;

    if (!repo) {
      return res.status(400).json({ error: "repo query parameter required" });
    }

    if (!issue || isNaN(parseInt(issue))) {
      return res.status(400).json({ error: "issue query parameter required (must be a number)" });
    }

    try {
      const assignees = getIssueAssignees(repo, parseInt(issue));
      res.json({ assigned: assignees.length > 0, assignees });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/issues/unassigned?repo=owner/repo
  // Returns guidance on querying unassigned issues using GitHub API
  // Implementation note: This endpoint is informational as real-time unassigned issue listing
  // should be performed directly via GitHub API for accuracy and to avoid stale data
  app.get("/api/issues/unassigned", (req, res) => {
    const repo = req.query.repo;

    if (!repo) {
      return res.status(400).json({ error: "repo query parameter required" });
    }

    // Return informational response directing client to use GitHub API
    // This avoids caching issues and keeps the monitor lightweight
    res.json({
      message: "Use GitHub API directly to query unassigned issues",
      example: `gh api repos/${repo}/issues --jq '.[] | select(.assignees == []) | {number: .number, title: .title}'`,
    });
  });

  // Agent routes
  setupAgentRoutes(app);

  // Rate limit routes
  if (rateLimiter) {
    setupRateLimitRoutes(app, rateLimiter);
  }

  // Dispatcher routes
  if (dispatcher) {
    setupDispatcherRoutes(app, dispatcher);
  }

  // Status routes
  if (statusCache) {
    setupStatusRoutes(app, statusCache);
  }
}

export { setupRoutes };
