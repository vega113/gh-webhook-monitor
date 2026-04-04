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
import { getPostMergeGateStatus } from "../postMergeGateState.js";
import { collectDashboardRepoPrPage, collectDashboardSnapshot } from "../dashboard/data.js";
import { getPRControlStore } from "../prControlState.js";
import { toggleAutoMerge as toggleNativeAutoMerge } from "../actions/toggleAutoMerge.js";

function setupRoutes(
  app,
  rateLimiter,
  dispatcher,
  statusCache = null,
  jobQueue = null,
  options = {}
) {
  const prControlStore = options.prControlStore || getPRControlStore();
  const toggleAutoMerge = options.toggleAutoMerge || toggleNativeAutoMerge;
  const collectRepoPrPage = options.collectDashboardRepoPrPage || collectDashboardRepoPrPage;
  const pollingState = options.pollingState || null;

  // Health check
  app.get("/api/health", (_req, res) => {
    const config = getConfig();
    const degradedRepos = Object.keys(config.repos || {}).filter((repo) => {
      return getPostMergeGateStatus(repo).degraded;
    });
    res.json({
      status: "ok",
      activeJobs: getActiveJobs().size,
      pendingJobs: jobQueue ? jobQueue.length() : 0,
      uptime: Math.floor(process.uptime()),
      agentType: config.agentConfig?.defaultAgent || config.agent.type,
      degradedPostMergeRepos: degradedRepos,
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
    const { defaultAgent, type, claude, codex } = req.body;
    const config = getConfig();
    const hasPayload =
      defaultAgent !== undefined || type !== undefined || claude !== undefined || codex !== undefined;

    if (!hasPayload) {
      return res.status(400).json({ error: "Missing agent payload" });
    }

    if (defaultAgent !== undefined) {
      if (!["claude", "codex"].includes(defaultAgent)) {
        return res.status(400).json({ error: "Invalid default agent type" });
      }
      config.agentConfig.defaultAgent = defaultAgent;
      config.agent.type = defaultAgent;
    }

    if (type !== undefined) {
      if (!["claude", "codex"].includes(type)) {
        return res.status(400).json({ error: "Invalid agent type" });
      }
      config.agent.type = type;
    }

    if (claude && typeof claude === "object") {
      config.agent.claude = { ...config.agent.claude, ...claude };
    }

    if (codex && typeof codex === "object") {
      config.agent.codex = { ...config.agent.codex, ...codex };
    }

    setConfig(config);
    res.json({ ok: true, agentConfig: config.agentConfig, agent: config.agent });
  });

  // Prompts endpoints
  app.post("/api/prompts", (req, res) => {
    const config = getConfig();
    config.promptTemplates = { ...config.promptTemplates, ...req.body };
    setConfig(config);
    res.json({ ok: true });
  });

  app.post("/api/pr/:owner/:repo/:number/pause", (req, res) => {
    const fullRepo = `${req.params.owner}/${req.params.repo}`;
    const prNumber = Number(req.params.number);
    if (!Number.isInteger(prNumber)) {
      return res.status(400).json({ error: "Invalid PR number" });
    }
    const control = prControlStore.setPaused(fullRepo, prNumber, true);
    res.json({ ok: true, control });
  });

  app.post("/api/pr/:owner/:repo/:number/resume", (req, res) => {
    const fullRepo = `${req.params.owner}/${req.params.repo}`;
    const prNumber = Number(req.params.number);
    if (!Number.isInteger(prNumber)) {
      return res.status(400).json({ error: "Invalid PR number" });
    }
    const control = prControlStore.setPaused(fullRepo, prNumber, false);
    res.json({ ok: true, control });
  });

  app.post("/api/pr/:owner/:repo/:number/auto-merge", async (req, res) => {
    const fullRepo = `${req.params.owner}/${req.params.repo}`;
    const prNumber = Number(req.params.number);
    const enabled = req.body?.enabled;

    if (!Number.isInteger(prNumber)) {
      return res.status(400).json({ error: "Invalid PR number" });
    }
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled boolean required" });
    }

    try {
      const autoMerge = await toggleAutoMerge(fullRepo, prNumber, enabled);
      res.json({ ok: true, autoMerge });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Event log endpoints
  app.get("/api/events", (_req, res) => {
    res.json(getEventLog());
  });

  app.get("/api/dashboard", async (_req, res) => {
    try {
      const snapshot = await collectDashboardSnapshot(getConfig(), statusCache, pollingState || {});
      res.json({ ok: true, snapshot });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dashboard/repo/:owner/:repo/prs", async (req, res) => {
    try {
      const repo = `${req.params.owner}/${req.params.repo}`;
      const page = await collectRepoPrPage(getConfig(), statusCache, repo, {
        offset: Number(req.query.offset) || 0,
        limit: Number(req.query.limit) || undefined,
        showAll: req.query.showAll === "true",
        filterText: req.query.filterText || "",
        statusFilter: req.query.statusFilter || "all",
      }, pollingState || {});
      res.json({ ok: true, page });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
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
      pending: jobQueue ? jobQueue.stats().queuedJobs : [],
      history: jobHistory.slice(0, 50),
    });
  });

  // Queue endpoints
  app.get("/api/jobs/queue", (_req, res) => {
    if (!jobQueue) {
      return res.json({ pending: 0, queuedJobs: [] });
    }
    res.json(jobQueue.stats());
  });

  app.get("/api/jobs/stats", (_req, res) => {
    const config = getConfig();
    const activeJobs = getActiveJobs();
    const stats = jobQueue ? jobQueue.stats() : { pending: 0, queuedJobs: [] };
    res.json({
      maxConcurrentJobs: config.settings.maxConcurrentJobs,
      activeJobs: activeJobs.size,
      pendingJobs: stats.pending,
      totalQueuedJobs: stats.queuedJobs.length,
      capacity: {
        used: activeJobs.size,
        available: Math.max(
          0,
          config.settings.maxConcurrentJobs - activeJobs.size
        ),
        total: config.settings.maxConcurrentJobs,
      },
      queuedJobs: stats.queuedJobs,
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
