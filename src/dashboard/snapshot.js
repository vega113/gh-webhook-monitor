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
}) {
  const statusPollInterval = settings.statusPollInterval || 60000;
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
      return {
        ...status,
        prAgeMinutes: minutesBetween(now, status.openedAt),
        waitingFor: prWaitingFor(status),
        iterationCount: jobHistory.length,
        jobs: jobHistory,
        jobCount: jobHistory.length + (activeJob ? 1 : 0),
        hasActiveJob: Boolean(activeJob),
        activeJobElapsed: activeJob?.running || null,
        lastJobDuration: jobHistory[0]?.duration || null,
        nextPollInSeconds: Math.ceil(statusPollInterval / 1000),
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
  options = {},
}) {
  const pageLimit = Number(options.limit) > 0 ? Number(options.limit) : Number(settings.dashboardRepoPageSize || 25);
  const offset = Math.max(0, Number(options.offset) || 0);
  const allRows = buildPrRows({ now, repo, statuses, jobs, prControls, settings });
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
}) {
  const dashboardRepoPageSize = settings.dashboardRepoPageSize || 25;
  const repositories = Object.keys(repos).map((repo) => {
    const allRepoStatuses = buildPrRows({
      now,
      repo,
      statuses,
      jobs,
      prControls,
      settings,
    });
    const repoStatuses = allRepoStatuses.filter((status) => status.actionable);

    const allRepoIssues = issues
      .filter((issue) => issue.repo === repo)
      .map((issue) => ({
        ...issue,
        actionable: isActionableIssue(issue),
        issueAgeMinutes: minutesBetween(now, issue.openedAt),
        iterationCount: (jobs.history || []).filter((job) => jobMatchesRepoAndNumber(job, repo, issue.number)).length,
        jobs: (jobs.history || []).filter((job) => jobMatchesRepoAndNumber(job, repo, issue.number)),
      }));
    const repoIssues = allRepoIssues.filter((issue) => issue.actionable);

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
      issues: repoIssues,
      allIssues: allRepoIssues,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    repositories,
  };
}

export { buildDashboardSnapshot, buildRepoPrPage };
