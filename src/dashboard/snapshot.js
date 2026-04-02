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

function buildDashboardSnapshot({
  now = Date.now(),
  repos = {},
  statuses = [],
  issues = [],
  jobs = {},
  prControls = {},
  settings = {},
}) {
  const statusPollInterval = settings.statusPollInterval || 60000;
  const repositories = Object.keys(repos).map((repo) => {
    const allRepoStatuses = statuses
      .filter((status) => status.repo === repo)
      .map((status) => {
        const jobHistory = (jobs.history || []).filter((job) => jobMatchesRepoAndNumber(job, repo, status.prNumber));
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
        hiddenPrs: Math.max(0, allRepoStatuses.length - repoStatuses.length),
        hiddenIssues: Math.max(0, allRepoIssues.length - repoIssues.length),
        activeJobs: (jobs.active || []).filter((job) => job.key.includes(repo)).length,
      },
      prs: repoStatuses,
      issues: repoIssues,
      allPrs: allRepoStatuses,
      allIssues: allRepoIssues,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    repositories,
  };
}

export { buildDashboardSnapshot };
