import { createServer } from "node:http";
import express from "express";
import { loadConfig, getConfig, requireWebhookSecret } from "./src/config.js";
import { logEvent } from "./src/logger.js";
import { verifySignature } from "./src/webhook.js";
import { handlePullRequestReview } from "./src/handlers/pullRequestReview.js";
import { handleCheckSuite } from "./src/handlers/checkSuite.js";
import { handleCheckRun } from "./src/handlers/checkRun.js";
import { handleIssues } from "./src/handlers/issues.js";
import { handlePullRequest } from "./src/handlers/pullRequest.js";
import { handlePullRequestMerge } from "./src/handlers/pullRequestMerge.js";
import { handleIssueComment } from "./src/handlers/issueComment.js";
import { handlePing } from "./src/handlers/ping.js";
import { setupRoutes } from "./src/api/routes.js";
import { getDashboardHTML } from "./src/dashboard/html.js";
import { initializeRateLimiter, getRateLimiter } from "./src/rateLimiterInstance.js";
import { initializeDispatcher, getDispatcher, getPRStateCache, getStatusCache } from "./src/dispatcherInstance.js";
import { ActionType } from "./src/dispatcher.js";
import { resolveThreads } from "./src/actions/resolveThreads.js";
import { handlePullRequestConflict } from "./src/handlers/pullRequestConflict.js";
import { spawnAgent, setJobQueue, processQueue } from "./src/actions/spawnAgent.js";
import { getRepoPath } from "./src/config.js";
import { JobQueue } from "./src/jobQueue.js";
import { recoverActiveJobs } from "./src/jobRuntimeState.js";
import { buildWebhookCacheUpdate } from "./src/webhookCacheUpdate.js";
import { createLiveHub } from "./src/dashboard/liveHub.js";
import { collectDashboardSnapshot } from "./src/dashboard/data.js";
import { determineBacklogActions } from "./src/backlogActions.js";
import { skipIfPRPaused } from "./src/prActionGuards.js";

const PORT = parseInt(process.env.PORT || "3847", 10);

// Initialize config
requireWebhookSecret();
loadConfig();
const config = getConfig();

// Initialize rate limiter
initializeRateLimiter();
const rateLimiter = getRateLimiter();

// Initialize dispatcher
initializeDispatcher();
const dispatcher = getDispatcher();

// Initialize job queue
const jobQueue = new JobQueue();
setJobQueue(jobQueue);
const recoveredJobs = recoverActiveJobs(jobQueue);
if (recoveredJobs.length > 0) {
  logEvent(
    "RECOVER",
    "jobs",
    "system",
    `Recovered ${recoveredJobs.length} active job${recoveredJobs.length === 1 ? "" : "s"} after restart`
  );
}
processQueue();

const pollingState = {
  status: {
    intervalMs: config.settings.statusPollInterval || 60000,
    lastRunAt: new Date().toISOString(),
  },
  mergeable: {
    intervalMs: config.settings.mergeableCheckInterval || 60000,
    lastRunAt: new Date().toISOString(),
  },
};

// Create Express app
const app = express();
app.use(express.json({ verify: (req, _res, buf) => (req.rawBody = buf) }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
const server = createServer(app);

// Webhook endpoint
app.post("/webhook", async (req, res) => {
  if (!verifySignature(req.rawBody, req.headers["x-hub-signature-256"])) {
    logEvent("REJECT", "bad-sig", "unknown", "");
    return res.status(401).send("Bad signature");
  }

  const event = req.headers["x-github-event"];
  const payload = req.body;
  const repo = payload.repository?.full_name || "unknown";

  logEvent(event, payload.action || "", repo, "received");

  const cacheUpdate = buildWebhookCacheUpdate(event, payload);
  if (cacheUpdate) {
    statusCache.updateFromWebhook(
      cacheUpdate.repo,
      cacheUpdate.prNumber,
      cacheUpdate.webhookData
    );
  }

  // Use dispatcher to decide what to do
  const actions = await dispatcher.receive({
    type: event,
    payload,
  });

  // Execute actions from dispatcher
  const config = getConfig();
  for (const action of actions) {
    if (action === ActionType.RESOLVE_THREADS) {
      triggerThreadResolution(repo, payload.pull_request?.number, "action-triggered");
    }
    if (action === ActionType.RESOLVE_CONFLICT) {
      const prStateCache = getPRStateCache();
      const prNumber = payload.pull_request?.number ?? payload.pull_request?.prNumber;
      if (prNumber) {
        if (skipIfPRPaused(repo, prNumber, "paused conflict resolution")) {
          continue;
        }
        logEvent(
          "RESOLVE_CONFLICT",
          "action-triggered",
          repo,
          `PR #${prNumber}: Dispatched action to resolve merge conflict`
        );
        // Handle conflict resolution
        handlePullRequestConflict(payload, prStateCache);
      } else {
        logEvent(
          "RESOLVE_CONFLICT",
          "missing-pr-number",
          repo,
          "Conflict action had no PR number in payload"
        );
      }
    }
  }

  // Execute handlers based on dispatcher decision
  // For now, still call handlers directly - they contain business logic
  // The dispatcher tracks decisions for audit/debugging
  switch (event) {
    case "pull_request_review":
      handlePullRequestReview(payload);
      break;
    case "check_suite":
      handleCheckSuite(payload);
      break;
    case "check_run":
      handleCheckRun(payload);
      break;
    case "issues":
      handleIssues(payload);
      break;
    case "pull_request":
      handlePullRequest(payload);
      // Also handle merge events with cascade updates
      if (payload.action === "closed" && payload.pull_request?.merged) {
        const prStateCache = getPRStateCache();
        await handlePullRequestMerge(payload, prStateCache);
      }
      break;
    case "issue_comment":
      handleIssueComment(payload);
      break;
    case "ping":
      handlePing(payload);
      break;
    default:
      logEvent(event, payload.action || "", repo, "unhandled");
  }

  liveHub.broadcastSnapshot().catch((err) => {
    logEvent("ERROR", "dashboard-live", "system", err.message);
  });

  res.json({ ok: true });
});

// Setup API routes
const statusCache = getStatusCache();
setupRoutes(app, rateLimiter, dispatcher, statusCache, jobQueue, { pollingState });
const liveHub = createLiveHub(server, () => collectDashboardSnapshot(getConfig(), statusCache, pollingState));

// Dashboard endpoint
app.get("/", (_req, res) => res.type("html").send(getDashboardHTML()));

// Start periodic polling for merge conflicts and status updates
const mergeableCheckInterval = config.settings.mergeableCheckInterval || 60000;
const statusPollInterval = config.settings.statusPollInterval || 60000;
let mergeablePollingTimer = null;
let statusPollingTimer = null;

function triggerThreadResolution(repo, prNumber, source = "action-triggered") {
  if (!prNumber) return;
  if (skipIfPRPaused(repo, prNumber, "paused thread resolution")) {
    return;
  }

  const latestConfig = getConfig();
  const autoResolveBots = latestConfig.settings.autoResolveBots || [];
  const prStateCache = getPRStateCache();

  logEvent(
    "RESOLVE_THREADS",
    source,
    repo,
    `PR #${prNumber}: Dispatched action to resolve bot review threads`
  );

  resolveThreads(repo, prNumber, autoResolveBots)
    .then((result) => {
      if (result?.resolvedThreadIds?.length) {
        prStateCache.markThreadsResolved(repo, prNumber, result.resolvedThreadIds);
      }
    })
    .catch((err) => {
      logEvent(
        "RESOLVE_THREADS",
        "error",
        repo,
        `PR #${prNumber}: ${err.message}`
      );
    });
}

function startMergeablePolling() {
  if (mergeablePollingTimer) return; // Already running

  mergeablePollingTimer = setInterval(async () => {
    try {
      pollingState.mergeable.lastRunAt = new Date().toISOString();
      const prStateCache = getPRStateCache();
      if (!prStateCache) return;

      // Check each configured repo for PRs with conflicts
      for (const repo of Object.keys(config.repos)) {
        const conflictPRs = prStateCache.getPRsWithConflicts(repo);
        for (const pr of conflictPRs) {
          // Check if we've already processed this conflict recently (5 min cooldown)
          if (!prStateCache.wasConflictRecentlyProcessed(repo, pr.prNumber)) {
            logEvent(
              "CONFLICT",
              "polling-detected",
              repo,
              `PR #${pr.prNumber}: "${pr.title}" has merge conflicts`
            );

            // Emit conflict detected event through dispatcher
            const actions = await dispatcher.receive({
              type: "conflict_detected",
              payload: {
                repository: { full_name: repo },
                pull_request: pr,
              },
            });

            // Execute RESOLVE_CONFLICT action if returned
            for (const action of actions) {
              if (action === ActionType.RESOLVE_CONFLICT) {
                const repoPath = getRepoPath(repo);
                if (repoPath) {
                  prStateCache.recordConflictDetection(repo, pr.prNumber);
                  logEvent(
                    "CONFLICT",
                    "spawn-agent",
                    repo,
                    `PR #${pr.prNumber}: Spawning agent to resolve conflict`
                  );

                  // Build prompt and spawn agent
                  const prompt = buildMergeConflictPromptForPolling(
                    config,
                    repo,
                    pr.prNumber,
                    pr
                  );
                  const jobKey = `${repo}#${pr.prNumber}-conflict`;
                  spawnAgent(repoPath, prompt, jobKey, repo);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      logEvent(
        "ERROR",
        "merge-polling",
        "system",
        `Polling error: ${err.message}`
      );
    }
  }, mergeableCheckInterval);

  logEvent(
    "INFO",
    "merge-polling-started",
    "system",
    `Polling interval: ${mergeableCheckInterval}ms`
  );
}

function startStatusPolling() {
  if (statusPollingTimer) return; // Already running

  statusPollingTimer = setInterval(async () => {
    try {
      pollingState.status.lastRunAt = new Date().toISOString();
      const statusCache = getStatusCache();
      const prStateCache = getPRStateCache();
      if (!statusCache || !prStateCache) return;

      // Refresh status for each configured repo
      for (const repo of Object.keys(config.repos)) {
        try {
          prStateCache.ensureRepoSynced(repo);
        } catch (err) {
          logEvent(
            "ERROR",
            "status-polling",
            repo,
            `Sync failed: ${err.message}`
          );
        }
        const allPRs = prStateCache.getAllOpenPRs(repo);
        let refreshedCount = 0;

        for (const pr of allPRs) {
          try {
            await statusCache.refresh(repo, pr.prNumber);
            refreshedCount++;
          } catch (err) {
            logEvent(
              "ERROR",
              "status-polling",
              repo,
              `PR #${pr.prNumber}: ${err.message}`
            );
          }
        }

        if (refreshedCount > 0) {
          logEvent(
            "INFO",
            "status-polling",
            repo,
            `Refreshed ${refreshedCount} PR statuses`
          );
        }

        const backlogActions = determineBacklogActions({
          repo,
          prs: allPRs,
          autoResolveBots: config.settings.autoResolveBots || [],
        });
        for (const backlogAction of backlogActions) {
          if (backlogAction.type === "resolve_conflict") {
            const conflictPr = allPRs.find((pr) => pr.prNumber === backlogAction.prNumber);
            if (!conflictPr) continue;
            if (prStateCache.wasConflictRecentlyProcessed(repo, conflictPr.prNumber)) continue;
            prStateCache.recordConflictDetection(repo, conflictPr.prNumber);
            const prompt = buildMergeConflictPromptForPolling(config, repo, conflictPr.prNumber, {
              title: conflictPr.title,
              base: conflictPr.base,
            });
            const repoPath = getRepoPath(repo);
            if (repoPath) {
              logEvent("CONFLICT", "backlog-spawn", repo, `PR #${conflictPr.prNumber}: spawning conflict resolver from status scan`);
              spawnAgent(repoPath, prompt, `${repo}#${conflictPr.prNumber}-conflict`, repo, {
                eventType: "merge_conflict",
              });
            }
          }

          if (backlogAction.type === "resolve_threads") {
            triggerThreadResolution(repo, backlogAction.prNumber, "backlog-triggered");
          }

          if (backlogAction.type === "review_backlog") {
            const pr = allPRs.find((item) => item.prNumber === backlogAction.prNumber);
            if (!pr) continue;
            if (!rateLimiter.canExecute(pr.prNumber, "spawnAgent")) continue;
            const repoPath = getRepoPath(repo);
            if (!repoPath) continue;
            const prompt = config.promptTemplates.pull_request_review
              .replace(/\{\{prNumber\}\}/g, pr.prNumber)
              .replace(/\{\{prTitle\}\}/g, pr.title || "Unknown")
              .replace(/\{\{reviewer\}\}/g, pr.latestReviews?.[0]?.author?.login || "reviewer")
              .replace(/\{\{reviewState\}\}/g, pr.latestReviews?.[0]?.state || pr.reviewState || "commented")
              .replace(/\{\{headBranch\}\}/g, pr.headBranch || "unknown")
              .replace(/\{\{repo\}\}/g, repo);
            rateLimiter.recordExecution(pr.prNumber, "spawnAgent");
            logEvent("SPAWN", "review-backlog", repo, `PR #${pr.prNumber}: spawning review follow-up from status scan`);
            spawnAgent(repoPath, prompt, `review-${repo}-${pr.prNumber}`, repo, {
              eventType: "pull_request_review",
              reviewState: "commented",
            });
          }
        }
      }
      liveHub.broadcastSnapshot().catch((err) => {
        logEvent("ERROR", "dashboard-live", "system", err.message);
      });
    } catch (err) {
      logEvent(
        "ERROR",
        "status-polling",
        "system",
        `Polling error: ${err.message}`
      );
    }
  }, statusPollInterval);

  logEvent(
    "INFO",
    "status-polling-started",
    "system",
    `Polling interval: ${statusPollInterval}ms`
  );
}

function buildMergeConflictPromptForPolling(config, repo, prNumber, pr) {
  const template = config.promptTemplates?.merge_conflict;

  if (!template) {
    return defaultMergeConflictPromptForPolling(repo, prNumber, pr);
  }

  return template
    .replace(/\{\{prNumber\}\}/g, prNumber)
    .replace(/\{\{prTitle\}\}/g, pr.title || "Unknown")
    .replace(/\{\{repo\}\}/g, repo)
    .replace(/\{\{baseBranch\}\}/g, pr.base || "main")
    .replace(/\{\{headBranch\}\}/g, pr.headBranch || "unknown");
}

function defaultMergeConflictPromptForPolling(repo, prNumber, pr) {
  const base = pr.base || "main";

  return `PR #${prNumber}: "${pr.title}" has merge conflicts with the ${base} branch.

Instructions:
1. Check the PR details: \`gh pr view ${prNumber}\`
2. Check the merge conflict status: \`gh pr view ${prNumber} --json mergeable\`
3. Fetch and checkout the branch: \`git fetch origin && git checkout -b pr-${prNumber}\`
4. Try to rebase: \`git rebase origin/${base}\`
5. If conflicts appear, resolve them using \`git status\` to find conflicted files
6. Preserve newly added behavior from both branches unless clearly obsolete
7. Do not resolve conflicts by dropping code just to make the build pass
8. If you cannot prove which side is correct, escalate instead of choosing destructively
9. Edit conflicted files to remove conflict markers (<<<<, ====, >>>>)
10. After resolving all conflicts: \`git add .\` and \`git rebase --continue\`
11. Force push if needed: \`git push --force-with-lease\`
12. Post a comment on the PR summarizing the resolution: \`gh pr comment ${prNumber} --body "Merge conflicts have been resolved."\`

If the conflicts are too complex to auto-resolve, post a comment explaining what needs manual intervention.`;
}

// Start server and polling
server.listen(PORT, () => {
  console.log("\n🌊 gh-webhook-monitor listening on http://localhost:" + PORT);
  console.log("   Dashboard:  http://localhost:" + PORT + "/");
  console.log("   Agent type: " + config.agent.type);
  console.log("   Repos:      " + Object.keys(config.repos).join(", "));
  console.log("");

  // Start merge conflict polling
  startMergeablePolling();

  // Start status polling
  const enableStatusPolling = config.settings.enableStatusPolling !== false;
  if (enableStatusPolling) {
    startStatusPolling();
  }
});
