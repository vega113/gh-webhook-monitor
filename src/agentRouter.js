function getRouterSettings(config = {}) {
  return {
    enabled: config.settings?.agentRouter?.enabled !== false,
    policy: config.settings?.agentRouter?.policy || "conservative-hybrid",
    codexMiniModel:
      config.settings?.agentRouter?.codexMiniModel || "gpt-5.4-mini",
    codexFullModel:
      config.settings?.agentRouter?.codexFullModel || "gpt-5.4",
  };
}

function isFullTier(routeContext = {}, jobKey = "") {
  const labels = routeContext.labels || [];
  return (
    routeContext.eventType === "agent_task" ||
    routeContext.eventType === "issue_followup" ||
    routeContext.eventType === "merge_conflict" ||
    routeContext.reviewState === "changes_requested" ||
    labels.includes("deploy-failure") ||
    routeContext.authSensitive === true ||
    routeContext.requiresCodeWriting === true ||
    /-conflict$/.test(jobKey)
  );
}

function isMiniTier(routeContext = {}) {
  return (
    routeContext.postMergeObservation === true ||
    routeContext.inspectionOnly === true ||
    routeContext.reviewState === "commented"
  );
}

function routeAgentJob({
  config,
  preferredAgent,
  jobKey = "",
  routeContext = {},
}) {
  const router = getRouterSettings(config);
  const defaultCodexModel = config?.agent?.codex?.model || "gpt-5.4";
  const defaultAgent =
    preferredAgent ||
    config?.agentConfig?.defaultAgent ||
    config?.agent?.type ||
    "codex";

  if (!router.enabled) {
    return {
      preferredAgent: defaultAgent,
      effectiveAgent: defaultAgent,
      tier: "default",
      effectiveModel: defaultAgent === "codex" ? defaultCodexModel : null,
      reason: "Router disabled; using configured defaults.",
    };
  }

  const full = isFullTier(routeContext, jobKey);
  const mini = !full && isMiniTier(routeContext);
  const tier = full ? "full" : mini ? "mini" : "default";

  if (defaultAgent === "claude") {
    return {
      preferredAgent: defaultAgent,
      effectiveAgent: "claude",
      tier,
      effectiveModel: null,
      reason:
        "Claude tiering is out of scope in first pass; preserving configured Claude defaults.",
    };
  }

  if (tier === "mini" && router.codexMiniModel) {
    return {
      preferredAgent: defaultAgent,
      effectiveAgent: "codex",
      tier,
      effectiveModel: router.codexMiniModel,
      reason: "Mini-tier read-only or observational work routed to Codex mini.",
    };
  }

  if (tier === "full" && router.codexFullModel) {
    return {
      preferredAgent: defaultAgent,
      effectiveAgent: "codex",
      tier,
      effectiveModel: router.codexFullModel,
      reason: "Full-tier code-writing or high-risk work routed to full Codex.",
    };
  }

  return {
    preferredAgent: defaultAgent,
    effectiveAgent: "codex",
    tier,
    effectiveModel: defaultCodexModel,
    reason: "Router fallback to configured Codex default model.",
  };
}

export { getRouterSettings, routeAgentJob };
