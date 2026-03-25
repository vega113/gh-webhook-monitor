import express from "express";
import { loadConfig, getConfig } from "./src/config.js";
import { logEvent } from "./src/logger.js";
import { verifySignature } from "./src/webhook.js";
import { handlePullRequestReview } from "./src/handlers/pullRequestReview.js";
import { handleCheckSuite } from "./src/handlers/checkSuite.js";
import { handleIssues } from "./src/handlers/issues.js";
import { handlePullRequest } from "./src/handlers/pullRequest.js";
import { handleIssueComment } from "./src/handlers/issueComment.js";
import { setupRoutes } from "./src/api/routes.js";
import { getDashboardHTML } from "./src/dashboard/html.js";
import { initializeRateLimiter, getRateLimiter } from "./src/rateLimiterInstance.js";

const PORT = parseInt(process.env.PORT || "3847", 10);

// Initialize config
loadConfig();
const config = getConfig();

// Initialize rate limiter
initializeRateLimiter();
const rateLimiter = getRateLimiter();

// Create Express app
const app = express();
app.use(express.json({ verify: (req, _res, buf) => (req.rawBody = buf) }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Webhook endpoint
app.post("/webhook", (req, res) => {
  if (!verifySignature(req.rawBody, req.headers["x-hub-signature-256"])) {
    logEvent("REJECT", "bad-sig", "unknown", "");
    return res.status(401).send("Bad signature");
  }

  const event = req.headers["x-github-event"];
  const payload = req.body;
  const repo = payload.repository?.full_name || "unknown";

  logEvent(event, payload.action || "", repo, "received");

  switch (event) {
    case "pull_request_review":
      handlePullRequestReview(payload);
      break;
    case "check_suite":
      handleCheckSuite(payload);
      break;
    case "issues":
      handleIssues(payload);
      break;
    case "pull_request":
      handlePullRequest(payload);
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
setupRoutes(app, rateLimiter);

// Dashboard endpoint
app.get("/", (_req, res) => res.type("html").send(getDashboardHTML()));

// Start server
app.listen(PORT, () => {
  console.log("\n🌊 gh-webhook-monitor listening on http://localhost:" + PORT);
  console.log("   Dashboard:  http://localhost:" + PORT + "/");
  console.log("   Agent type: " + config.agent.type);
  console.log("   Repos:      " + Object.keys(config.repos).join(", "));
  console.log("");
});
