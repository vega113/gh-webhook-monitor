function jobMatchesRepoAndNumber(job, repo, number) {
  if (typeof job?.key !== "string") return false;
  const normalizedRepo = repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|-)${normalizedRepo}(?:#|-).*${number}(?:$|-)`).test(job.key);
}

function prWaitingFor(status) {
  const blockers = status.blockers || [];
  if (blockers.some((b) => b.type === "conflict")) return "Resolve merge conflicts";
  if (blockers.some((b) => b.type === "ci")) {
    return status.ciStatus === "failed" ? "Address failing CI checks" : "Wait for CI to finish";
  }
  if (blockers.some((b) => b.type === "review")) {
    return status.reviewState === "changes_requested"
      ? "Address requested review changes"
      : "Wait for review";
  }
  if (blockers.some((b) => b.type === "threads")) return "Resolve review threads";
  return "No action required";
}

function minutesBetween(now, isoString) {
  const ts = Date.parse(isoString || "");
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.round((now - ts) / 60000));
}

function isActionablePr(status) {
  return Array.isArray(status.blockers) && status.blockers.length > 0;
}

function isActionableIssue(issue) {
  const labels = issue.labels || [];
  return issue.state === "open" && labels.some((label) => ["agent-task", "deploy-failure", "auto-fix"].includes(label));
}

function getLifecycleState({ hasActiveJob = false, isPaused = false, actionable = false }) {
  if (hasActiveJob) return "Active";
  if (isPaused) return "Paused";
  if (actionable) return "Waiting";
  return "Idle";
}

function getNextPollAt(now, polling = {}, settings = {}) {
  const intervalMs = Number(polling?.status?.intervalMs || settings.statusPollInterval || 60000);
  const lastRunAtMs = Date.parse(polling?.status?.lastRunAt || "");
  const baseMs = Number.isFinite(lastRunAtMs) ? lastRunAtMs : now;
  return new Date(baseMs + intervalMs).toISOString();
}

function matchesPrRowFilter(pr, options = {}) {
  const filterText = String(options.filterText || "").trim().toLowerCase();
  if (filterText) {
    const haystack = [pr.prNumber, pr.title, pr.branch, pr.waitingFor]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filterText)) return false;
  }

  switch (options.statusFilter || "all") {
    case "ci-failed":
      return pr.ciStatus === "failed";
    case "review-pending":
      return pr.reviewState !== "approved";
    case "paused":
      return pr.isPaused === true;
    case "active-job":
      return pr.hasActiveJob === true;
    case "auto-merge":
      return pr.autoMergeEnabled === true;
    default:
      return true;
  }
}

function buildPrRows({
  now = Date.now(),
  repo,
  statuses = [],
  jobs = {},
  prControls = {},
  settings = {},
  polling = {},
}) {
  const nextPollAt = getNextPollAt(now, polling, settings);
  return statuses
    .filter((status) => status.repo === repo)
    .map((status) => {
      const jobHistory = (jobs.history || []).filter((job) =>
        jobMatchesRepoAndNumber(job, repo, status.prNumber)
      );
      const activeJob = (jobs.active || []).find((job) =>
        jobMatchesRepoAndNumber(job, repo, status.prNumber)
      );
      const control = prControls[`${repo}#${status.prNumber}`] || null;
      const hasActiveJob = Boolean(activeJob);
      const lifecycleState = getLifecycleState({
        hasActiveJob,
        isPaused: Boolean(control?.isPaused),
        actionable: isActionablePr(status),
      });
      const activeJobOutputTail = activeJob?.outputTail || activeJob?.output || "";
      return {
        ...status,
        prAgeMinutes: minutesBetween(now, status.openedAt),
        waitingFor: prWaitingFor(status),
        lifecycleState,
        iterationCount: jobHistory.length,
        jobs: jobHistory,
        activeJob: activeJob
          ? {
              key: activeJob.key,
              pid: activeJob.pid,
              running: activeJob.running,
              agentType: activeJob.agentType,
              logFile: activeJob.logFile,
              outputTail: activeJobOutputTail,
              startTime: activeJob.startTime,
            }
          : null,
        jobCount: jobHistory.length + (hasActiveJob ? 1 : 0),
        hasActiveJob,
        activeJobElapsed: activeJob?.running || null,
        activeJobOutputTail,
        lastJobDuration: jobHistory[0]?.duration || null,
        nextPollAt,
        nextPollInSeconds: Math.max(0, Math.ceil((Date.parse(nextPollAt) - now) / 1000)),
        isPaused: Boolean(control?.isPaused),
        canPause: !control?.isPaused,
        canResume: Boolean(control?.isPaused),
        canToggleAutoMerge: true,
        actionable: isActionablePr(status),
      };
    });
}

function buildRepoPrPage({
  now = Date.now(),
  repo,
  statuses = [],
  jobs = {},
  prControls = {},
  settings = {},
  polling = {},
  options = {},
}) {
  const pageLimit = Number(options.limit) > 0 ? Number(options.limit) : Number(settings.dashboardRepoPageSize || 25);
  const offset = Math.max(0, Number(options.offset) || 0);
  const allRows = buildPrRows({ now, repo, statuses, jobs, prControls, settings, polling });
  const baseRows = options.showAll ? allRows : allRows.filter((row) => row.actionable);
  const filteredRows = baseRows.filter((row) => matchesPrRowFilter(row, options));
  const rows = filteredRows.slice(offset, offset + pageLimit);

  return {
    repo,
    rows,
    totalCount: filteredRows.length,
    offset,
    limit: pageLimit,
    hasMore: offset + rows.length < filteredRows.length,
    nextOffset: offset + rows.length,
  };
}

function buildDashboardSnapshot({
  now = Date.now(),
  repos = {},
  statuses = [],
  issues = [],
  jobs = {},
  prControls = {},
  settings = {},
  polling = {},
}) {
  const dashboardRepoPageSize = settings.dashboardRepoPageSize || 25;
  const nextPollAt = getNextPollAt(now, polling, settings);
  const repositories = Object.keys(repos).map((repo) => {
    const allRepoStatuses = buildPrRows({
      now,
      repo,
      statuses,
      jobs,
      prControls,
      settings,
      polling,
    });
    const repoStatuses = allRepoStatuses.filter((status) => status.actionable);

    const allRepoIssues = issues
      .filter((issue) => issue.repo === repo)
      .map((issue) => ({
        ...issue,
        actionable: isActionableIssue(issue),
        issueAgeMinutes: minutesBetween(now, issue.openedAt),
        waitingFor: issue.labels?.includes("deploy-failure")
          ? "Fix deployment failure"
          : issue.labels?.includes("auto-fix")
            ? "Investigate and fix"
            : issue.labels?.includes("agent-task")
              ? "Complete agent task"
              : "Waiting",
        iterationCount: (jobs.history || []).filter((job) => jobMatchesRepoAndNumber(job, repo, issue.number)).length,
        jobs: (jobs.history || []).filter((job) => jobMatchesRepoAndNumber(job, repo, issue.number)),
        activeJob: (jobs.active || []).find((job) => jobMatchesRepoAndNumber(job, repo, issue.number)) || null,
      }));
    const repoIssues = allRepoIssues.filter((issue) => issue.actionable);

    const shapedIssues = allRepoIssues.map((issue) => {
      const activeJob = issue.activeJob;
      const hasActiveJob = Boolean(activeJob);
      const lifecycleState = getLifecycleState({
        hasActiveJob,
        actionable: issue.actionable,
      });
      const activeJobOutputTail = activeJob?.outputTail || activeJob?.output || "";
      return {
        ...issue,
        activeJob: activeJob
          ? {
              key: activeJob.key,
              pid: activeJob.pid,
              running: activeJob.running,
              agentType: activeJob.agentType,
              logFile: activeJob.logFile,
              outputTail: activeJobOutputTail,
              startTime: activeJob.startTime,
            }
          : null,
        lifecycleState,
        hasActiveJob,
        activeJobElapsed: activeJob?.running || null,
        activeJobOutputTail,
        nextPollAt,
        nextPollInSeconds: Math.max(0, Math.ceil((Date.parse(nextPollAt) - now) / 1000)),
      };
    });

    return {
      repo,
      summary: {
        actionablePrs: repoStatuses.length,
        actionableIssues: repoIssues.length,
        totalPrs: allRepoStatuses.length,
        hiddenPrs: Math.max(0, allRepoStatuses.length - repoStatuses.length),
        hiddenIssues: Math.max(0, allRepoIssues.length - repoIssues.length),
        activeJobs: (jobs.active || []).filter((job) => job.key.includes(repo)).length,
      },
      prPageSize: dashboardRepoPageSize,
      hasMorePrs: repoStatuses.length > dashboardRepoPageSize,
      prs: repoStatuses.slice(0, dashboardRepoPageSize),
      issues: shapedIssues.filter((issue) => issue.actionable),
      allIssues: shapedIssues,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    polling: {
      status: {
        intervalMs: Number(polling?.status?.intervalMs || settings.statusPollInterval || 60000),
        lastRunAt: polling?.status?.lastRunAt || new Date(now).toISOString(),
        nextRunAt: nextPollAt,
      },
      mergeable: {
        intervalMs: Number(polling?.mergeable?.intervalMs || settings.mergeableCheckInterval || 60000),
        lastRunAt: polling?.mergeable?.lastRunAt || new Date(now).toISOString(),
      },
    },
    repositories,
  };
}

export { buildDashboardSnapshot, buildRepoPrPage };
