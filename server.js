import express from "express";
import { loadConfig, getConfig } from "./src/config.js";
import { logEvent } from "./src/logger.js";
import { verifySignature } from "./src/webhook.js";
import { handlePullRequestReview } from "./src/handlers/pullRequestReview.js";
import { handleCheckSuite } from "./src/handlers/checkSuite.js";
import { handleCheckRun } from "./src/handlers/checkRun.js";
import { handleIssues } from "./src/handlers/issues.js";
import { handlePullRequest } from "./src/handlers/pullRequest.js";
import { handlePullRequestMerge } from "./src/handlers/pullRequestMerge.js";
import { handleIssueComment } from "./src/handlers/issueComment.js";
import { setupRoutes } from "./src/api/routes.js";
import { getDashboardHTML } from "./src/dashboard/html.js";
import { initializeRateLimiter, getRateLimiter } from "./src/rateLimiterInstance.js";
import { initializeDispatcher, getDispatcher, getPRStateCache, getStatusCache } from "./src/dispatcherInstance.js";
import { ActionType } from "./src/dispatcher.js";
import { resolveThreads } from "./src/actions/resolveThreads.js";
import { handlePullRequestConflict } from "./src/handlers/pullRequestConflict.js";
import { spawnAgent, setJobQueue } from "./src/actions/spawnAgent.js";
import { getRepoPath } from "./src/config.js";
import { JobQueue } from "./src/jobQueue.js";

const PORT = parseInt(process.env.PORT || "3847", 10);

// Initialize config
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

// Create Express app
const app = express();
app.use(express.json({ verify: (req, _res, buf) => (req.rawBody = buf) }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

  // Use dispatcher to decide what to do
  const actions = await dispatcher.receive({
    type: event,
    payload,
  });

  // Execute actions from dispatcher
  const config = getConfig();
  const prStateCache = getPRStateCache();
  for (const action of actions) {
    if (action === ActionType.RESOLVE_THREADS) {
      const prNumber = payload.pull_request?.number;
      if (prNumber) {
        const autoResolveBots = config.settings.autoResolveBots || [];
        logEvent(
          "RESOLVE_THREADS",
          "action-triggered",
          repo,
          `PR #${prNumber}: Dispatched action to resolve bot review threads`
        );
        // Execute in background
        resolveThreads(repo, prNumber, autoResolveBots).catch((err) => {
          logEvent(
            "RESOLVE_THREADS",
            "error",
            repo,
            `PR #${prNumber}: ${err.message}`
          );
        });
      }
    }
    if (action === ActionType.RESOLVE_CONFLICT) {
      const prNumber = payload.pull_request?.number;
      if (prNumber) {
        logEvent(
          "RESOLVE_CONFLICT",
          "action-triggered",
          repo,
          `PR #${prNumber}: Dispatched action to resolve merge conflict`
        );
        // Handle conflict resolution
        handlePullRequestConflict(payload, prStateCache);
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
    default:
      logEvent(event, payload.action || "", repo, "unhandled");
  }

  res.json({ ok: true });
});

// Setup API routes
const statusCache = getStatusCache();
setupRoutes(app, rateLimiter, dispatcher, statusCache, jobQueue);

// Dashboard endpoint
app.get("/", (_req, res) => res.type("html").send(getDashboardHTML()));

// Start periodic polling for merge conflicts and status updates
const mergeableCheckInterval = config.settings.mergeableCheckInterval || 60000;
const statusPollInterval = config.settings.statusPollInterval || 60000;
let mergeablePollingTimer = null;
let statusPollingTimer = null;

function startMergeablePolling() {
  if (mergeablePollingTimer) return; // Already running

  mergeablePollingTimer = setInterval(async () => {
    try {
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
      const statusCache = getStatusCache();
      const prStateCache = getPRStateCache();
      if (!statusCache || !prStateCache) return;

      // Refresh status for each configured repo
      for (const repo of Object.keys(config.repos)) {
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
      }
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
6. Edit conflicted files to remove conflict markers (<<<<, ====, >>>>)
7. After resolving all conflicts: \`git add .\` and \`git rebase --continue\`
8. Force push if needed: \`git push --force-with-lease\`
9. Post a comment on the PR summarizing the resolution: \`gh pr comment ${prNumber} --body "Merge conflicts have been resolved."\`

If the conflicts are too complex to auto-resolve, post a comment explaining what needs manual intervention.`;
}

// Start server and polling
app.listen(PORT, () => {
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
