import { execSync } from "node:child_process";
import { getEventLog } from "../logger.js";
import { getJobHistory, getActiveJobs } from "../actions/spawnAgent.js";
import { getPRStateCache } from "../dispatcherInstance.js";
import { buildDashboardSnapshot, buildRepoPrPage } from "./snapshot.js";
import { getPRControlStore } from "../prControlState.js";

const ISSUE_CACHE = new Map();
const ISSUE_TTL_MS = 30 * 1000;
const ACTIONABLE_ISSUE_LABELS = new Set(["agent-task", "deploy-failure", "auto-fix"]);

function fetchOpenIssues(repo) {
  const cached = ISSUE_CACHE.get(repo);
  if (cached && Date.now() - cached.ts < ISSUE_TTL_MS) {
    return cached.issues;
  }

  const raw = execSync(
    `gh issue list --repo ${repo} --state open --json number,title,labels,createdAt,url`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  const issues = JSON.parse(raw)
    .filter((issue) =>
      (issue.labels || []).some((label) => ACTIONABLE_ISSUE_LABELS.has(label.name))
    )
    .map((issue) => ({
      repo,
      number: issue.number,
      title: issue.title,
      labels: (issue.labels || []).map((label) => label.name),
      state: "open",
      openedAt: issue.createdAt,
      url: issue.url,
    }));

  ISSUE_CACHE.set(repo, { ts: Date.now(), issues });
  return issues;
}

async function collectDashboardSnapshot(config, statusCache, polling = {}) {
  const prStateCache = getPRStateCache();
  const statuses = [];
  const issues = [];
  const now = Date.now();

  for (const [repo, repoConfig] of Object.entries(config.repos || {})) {
    if (!repoConfig?.enabled) continue;
    prStateCache.ensureRepoSynced(repo);
    for (const pr of prStateCache.getAllOpenPRs(repo)) {
      const status = await statusCache.refresh(repo, pr.prNumber);
      if (status) statuses.push(status);
    }
    try {
      issues.push(...fetchOpenIssues(repo));
    } catch {
      // Dashboard should degrade gracefully if gh issue listing fails.
    }
  }

  const jobs = {
    active: [...getActiveJobs().values()].map((job) => ({
      key: job.key,
      pid: job.pid,
      running: `${((Date.now() - job.startTime) / 1000).toFixed(0)}s`,
      agentType: job.agentType,
      output: job.output.join("").slice(-1000),
      logFile: job.logFile,
      startTime: new Date(job.startTime).toISOString(),
    })),
    history: getJobHistory().slice(0, 100),
  };

  return {
    ...buildDashboardSnapshot({
      now,
      repos: config.repos,
      statuses,
      issues,
      jobs,
      prControls: getPRControlStore().listAll(),
      settings: config.settings || {},
      polling,
    }),
    generatedAt: new Date(now).toISOString(),
    recentEvents: getEventLog().slice(0, 50),
  };
}

async function collectDashboardRepoPrPage(config, statusCache, repo, options = {}, polling = {}) {
  const prStateCache = getPRStateCache();
  const now = Date.now();

  if (!config.repos?.[repo]?.enabled) {
    return {
      repo,
      rows: [],
      totalCount: 0,
      offset: 0,
      limit: Number(options.limit) || Number(config.settings?.dashboardRepoPageSize || 25),
      hasMore: false,
      nextOffset: 0,
    };
  }

  prStateCache.ensureRepoSynced(repo);
  const statuses = [];
  for (const pr of prStateCache.getAllOpenPRs(repo)) {
    const status = await statusCache.refresh(repo, pr.prNumber);
    if (status) statuses.push(status);
  }

  const jobs = {
    active: [...getActiveJobs().values()].map((job) => ({
      key: job.key,
      pid: job.pid,
      running: `${((Date.now() - job.startTime) / 1000).toFixed(0)}s`,
      agentType: job.agentType,
      output: job.output.join("").slice(-1000),
      logFile: job.logFile,
      startTime: new Date(job.startTime).toISOString(),
    })),
    history: getJobHistory().slice(0, 100),
  };

  return buildRepoPrPage({
    now,
    repo,
    statuses,
    jobs,
    prControls: getPRControlStore().listAll(),
    settings: config.settings || {},
    polling,
    options,
  });
}

export { collectDashboardRepoPrPage, collectDashboardSnapshot };
