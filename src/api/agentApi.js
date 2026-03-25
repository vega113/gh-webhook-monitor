import { getConfig, setConfig } from "../config.js";

function setupAgentRoutes(app) {
  // GET /api/agent — get default agent config
  app.get("/api/agent", (_req, res) => {
    const config = getConfig();
    res.json(config.agentConfig);
  });

  // POST /api/agent — update default agent
  app.post("/api/agent", (req, res) => {
    const { defaultAgent } = req.body;
    if (!["claude", "codex"].includes(defaultAgent)) {
      return res.status(400).json({ error: "Invalid agent type" });
    }
    const config = getConfig();
    config.agentConfig.defaultAgent = defaultAgent;
    setConfig(config);
    res.json({ ok: true, agentConfig: config.agentConfig });
  });

  // GET /api/repos/:owner/:repo/agent — get agent for specific repo
  app.get("/api/repos/:owner/:repo/agent", (req, res) => {
    const config = getConfig();
    const repoName = `${req.params.owner}/${req.params.repo}`;
    const override = config.agentConfig.perRepoOverride[repoName];
    res.json({
      defaultAgent: config.agentConfig.defaultAgent,
      override: override || null,
      effective: override || config.agentConfig.defaultAgent,
    });
  });

  // POST /api/repos/:owner/:repo/agent — override agent for repo
  app.post("/api/repos/:owner/:repo/agent", (req, res) => {
    const { agent } = req.body;
    const repoName = `${req.params.owner}/${req.params.repo}`;

    if (agent !== null && !["claude", "codex"].includes(agent)) {
      return res.status(400).json({ error: "Invalid agent type" });
    }

    const config = getConfig();
    if (agent === null) {
      delete config.agentConfig.perRepoOverride[repoName];
    } else {
      config.agentConfig.perRepoOverride[repoName] = agent;
    }
    setConfig(config);
    res.json({ ok: true, agentConfig: config.agentConfig });
  });
}

export { setupAgentRoutes };
