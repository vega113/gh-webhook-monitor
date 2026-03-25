import express from "express";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync,
  readdirSync, statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Persistent config
// ---------------------------------------------------------------------------
const CONFIG_PATH = join(__dirname, "config.json");
const LOG_DIR = join(__dirname, "logs");
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const DEFAULT_PROMPT_TEMPLATES = {
  pull_request_review: `A review was submitted on PR #{{prNumber}} ("{{prTitle}}") by {{reviewer}} (state: {{reviewState}}).
Read the review comments with \`gh pr view {{prNumber}} --comments\` and \`gh api repos/{{repo}}/pulls/{{prNumber}}/comments\`.
If there are actionable code review comments, fix them, commit, and push. If the comments are just informational or approvals, do nothing. Be concise.`,
  check_suite: `CI failed on the default branch ({{branch}}) at commit {{sha}}.
Check the failure with \`gh run list --limit 3\` and \`gh run view --log-failed\`.
Investigate the failure, fix if possible, commit and push. If it's a flaky test or infrastructure issue, report what you found.`,
  issues: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was {{action}} with labels: {{labels}}.
Read the issue with \`gh issue view {{issueNumber}}\`.
If it's a deploy failure, investigate the deploy logs and fix the issue. If it's tagged auto-fix, investigate and fix the reported bug.`,
  issue_comment: `A comment was posted on PR #{{prNumber}} ("{{prTitle}}") by {{author}}: "{{body}}".
Read the full PR context with \`gh pr view {{prNumber}}\`.
Address what's being asked — fix code issues, respond to questions, etc. Commit and push if code changes are needed.`,
  agent_task: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was created as an agent task.
Labels: {{labels}}

Issue description:
{{issueBody}}

Instructions:
1. Read the full issue with \`gh issue view {{issueNumber}}\`
2. Investigate the codebase as needed
3. Implement the requested changes
4. Create a PR with the fix/feature, adding the label "agent-authored"
5. Reference the issue in the PR body: "Fixes #{{issueNumber}}" or "Addresses #{{issueNumber}}"
6. Post a comment on the issue summarizing what was done: \`gh issue comment {{issueNumber}} --body "..."\``,
  issue_followup: `A follow-up comment was posted on issue #{{issueNumber}} ("{{issueTitle}}") by {{author}}: "{{body}}"
Labels: {{labels}}

Read the full issue and comment thread with \`gh issue view {{issueNumber}} --comments\`.
If the comment asks for additional changes or clarifications on work already done, address them.
If there's an open PR for this issue, update it. Otherwise create a new PR if code changes are needed.
Post a comment on the issue summarizing what was done.`,
};

function defaultConfig() {
  return {
    repos: {
      "vega113/incubator-wave": {
        localPath: "/Users/vega/devroot/incubator-wave",
        enabled: true,
      },
    },
    agent: {
      type: "claude",
      claude: {
        bin: "claude",
        model: "",
        allowedTools: "",
        extraArgs: "--dangerously-skip-permissions",
      },
      codex: {
        bin: "codex",
        model: "gpt-5.3-codex",
        reasoningEffort: "high",
        sandbox: "workspace-write",
        extraArgs: "--full-auto",
      },
    },
    settings: {
      webhookSecret: process.env.WEBHOOK_SECRET || "",
      maxConcurrentJobs: 3,
      jobTimeoutMinutes: 15,
      enabledEvents: {
        pull_request_review: true,
        check_suite: true,
        issues: true,
        issue_comment: true,
        pull_request: true,
      },
      triggerKeywords: ["@claude", "please fix"],
      issueLabels: ["deploy-failure", "auto-fix", "agent-task"],
      ignoredBots: ["github-actions[bot]", "dependabot[bot]"],
    },
    promptTemplates: { ...DEFAULT_PROMPT_TEMPLATES },
  };
}

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const def = defaultConfig();
    return {
      repos: saved.repos || def.repos,
      agent: { ...def.agent, ...saved.agent, claude: { ...def.agent.claude, ...(saved.agent?.claude || {}) }, codex: { ...def.agent.codex, ...(saved.agent?.codex || {}) } },
      settings: { ...def.settings, ...saved.settings, enabledEvents: { ...def.settings.enabledEvents, ...(saved.settings?.enabledEvents || {}) } },
      promptTemplates: { ...def.promptTemplates, ...(saved.promptTemplates || {}) },
    };
  }
  const c = defaultConfig();
  writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
  return c;
}

let config = loadConfig();
function saveConfig() { writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
function getRepoPath(fullName) { const r = config.repos[fullName]; return r?.enabled ? r.localPath : null; }
function getSecret() { return config.settings.webhookSecret || process.env.WEBHOOK_SECRET || ""; }

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "3847", 10);

function verifySignature(payload, signature) {
  const secret = getSecret();
  if (!secret) return true;
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Prompt template rendering
// ---------------------------------------------------------------------------
function renderPrompt(templateKey, vars) {
  let tpl = config.promptTemplates[templateKey] || DEFAULT_PROMPT_TEMPLATES[templateKey] || "";
  for (const [k, v] of Object.entries(vars)) {
    tpl = tpl.replaceAll(`{{${k}}}`, String(v));
  }
  return tpl;
}

// ---------------------------------------------------------------------------
// Agent spawning (Claude or Codex)
// ---------------------------------------------------------------------------
const activeJobs = new Map();
const jobHistory = [];
const MAX_HISTORY = 200;
const eventLog = [];
const MAX_EVENT_LOG = 500;

function logEvent(event, action, repo, summary) {
  const ts = new Date().toISOString();
  const line = `${ts} | ${event}:${action} | ${repo} | ${summary}\n`;
  process.stdout.write(line);
  appendFileSync(join(LOG_DIR, "events.log"), line);
  eventLog.unshift({ ts, event, action, repo, summary });
  if (eventLog.length > MAX_EVENT_LOG) eventLog.length = MAX_EVENT_LOG;
}

function buildAgentCommand(prompt) {
  const a = config.agent;
  if (a.type === "codex") {
    const c = a.codex;
    const args = ["exec"];
    if (c.model) args.push("-m", c.model);
    if (c.reasoningEffort) args.push("--config", `model_reasoning_effort="${c.reasoningEffort}"`);
    if (c.sandbox) args.push("--sandbox", c.sandbox);
    if (c.extraArgs) args.push(...c.extraArgs.split(/\s+/).filter(Boolean));
    args.push(prompt);
    return { bin: c.bin || "codex", args };
  }
  // Default: Claude
  const c = a.claude;
  const args = ["--print"];
  if (c.model) args.push("--model", c.model);
  if (c.allowedTools) args.push("--allowedTools", c.allowedTools);
  if (c.extraArgs) args.push(...c.extraArgs.split(/\s+/).filter(Boolean));
  args.push(prompt);
  return { bin: c.bin || "claude", args };
}

function spawnAgent(repoPath, prompt, jobKey) {
  if (activeJobs.has(jobKey)) { logEvent("SKIP", "duplicate", jobKey, "Already running"); return; }
  if (activeJobs.size >= config.settings.maxConcurrentJobs) { logEvent("SKIP", "max-jobs", jobKey, `Limit ${config.settings.maxConcurrentJobs}`); return; }

  const { bin, args } = buildAgentCommand(prompt);
  logEvent("SPAWN", config.agent.type, jobKey, `${bin} ${args[0]} ... ${prompt.slice(0, 80)}`);

  const startTime = Date.now();
  const logFile = join(LOG_DIR, `${jobKey.replace(/[^a-zA-Z0-9-_]/g, "_")}-${startTime}.log`);
  const outputChunks = [];

  const child = spawn(bin, args, {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "webhook-monitor" },
  });

  const jobInfo = { key: jobKey, pid: child.pid, startTime, logFile, prompt, agentType: config.agent.type, output: outputChunks };
  activeJobs.set(jobKey, jobInfo);

  child.stdout.on("data", (data) => {
    appendFileSync(logFile, data);
    outputChunks.push(data.toString());
    if (outputChunks.length > 1000) outputChunks.shift();
  });
  child.stderr.on("data", (data) => {
    appendFileSync(logFile, `[stderr] ${data}`);
  });

  const timeout = setTimeout(() => {
    if (activeJobs.has(jobKey)) {
      logEvent("TIMEOUT", "kill", jobKey, `${config.settings.jobTimeoutMinutes}m`);
      child.kill("SIGTERM");
      setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 5000);
    }
  }, config.settings.jobTimeoutMinutes * 60 * 1000);

  child.on("close", (code) => {
    clearTimeout(timeout);
    activeJobs.delete(jobKey);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullOutput = outputChunks.join("");
    logEvent("DONE", `exit=${code}`, jobKey, `${duration}s`);
    jobHistory.unshift({
      key: jobKey, code, duration: `${duration}s`, logFile,
      startTime: new Date(startTime).toISOString(),
      agentType: jobInfo.agentType, prompt: prompt.slice(0, 300),
      outputTail: fullOutput.slice(-2000),
    });
    if (jobHistory.length > MAX_HISTORY) jobHistory.length = MAX_HISTORY;
  });
}

// ---------------------------------------------------------------------------
// Anti-loop: cooldown tracker (issue key -> last handled timestamp)
// ---------------------------------------------------------------------------
const cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const AGENT_PR_LABEL = "agent-authored";

function isOnCooldown(key) {
  const last = cooldowns.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return true;
  return false;
}
function setCooldown(key) { cooldowns.set(key, Date.now()); }

function hasLabel(labels, name) { return labels.some((l) => (l.name || l) === name); }

// ---------------------------------------------------------------------------
// GitHub reactions (eyes = acknowledged, rocket = done)
// ---------------------------------------------------------------------------
function reactToIssue(repo, issueNumber, reaction) {
  const child = spawn("gh", ["api", `repos/${repo}/issues/${issueNumber}/reactions`, "--method", "POST", "--field", `content=${reaction}`], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.on("error", () => {});
}

function reactToComment(repo, commentId, reaction) {
  const child = spawn("gh", ["api", `repos/${repo}/issues/comments/${commentId}/reactions`, "--method", "POST", "--field", `content=${reaction}`], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  child.on("error", () => {});
}

// Wraps spawnAgent to add reaction on completion
function spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issueNumber) {
  if (activeJobs.has(jobKey)) { logEvent("SKIP", "duplicate", jobKey, "Already running"); return; }
  if (activeJobs.size >= config.settings.maxConcurrentJobs) { logEvent("SKIP", "max-jobs", jobKey, `Limit ${config.settings.maxConcurrentJobs}`); return; }

  // Acknowledge with eyes emoji immediately
  if (issueNumber) reactToIssue(repo, issueNumber, "eyes");

  const { bin, args } = buildAgentCommand(prompt);
  logEvent("SPAWN", config.agent.type, jobKey, `${bin} ${args[0]} ... ${prompt.slice(0, 80)}`);

  const startTime = Date.now();
  const logFile = join(LOG_DIR, `${jobKey.replace(/[^a-zA-Z0-9-_]/g, "_")}-${startTime}.log`);
  const outputChunks = [];

  const child = spawn(bin, args, {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "webhook-monitor" },
  });

  const jobInfo = { key: jobKey, pid: child.pid, startTime, logFile, prompt, agentType: config.agent.type, output: outputChunks };
  activeJobs.set(jobKey, jobInfo);

  child.stdout.on("data", (data) => {
    appendFileSync(logFile, data);
    outputChunks.push(data.toString());
    if (outputChunks.length > 1000) outputChunks.shift();
  });
  child.stderr.on("data", (data) => { appendFileSync(logFile, `[stderr] ${data}`); });

  const timeout = setTimeout(() => {
    if (activeJobs.has(jobKey)) {
      logEvent("TIMEOUT", "kill", jobKey, `${config.settings.jobTimeoutMinutes}m`);
      child.kill("SIGTERM");
      setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 5000);
    }
  }, config.settings.jobTimeoutMinutes * 60 * 1000);

  child.on("close", (code) => {
    clearTimeout(timeout);
    activeJobs.delete(jobKey);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullOutput = outputChunks.join("");
    logEvent("DONE", `exit=${code}`, jobKey, `${duration}s`);
    jobHistory.unshift({
      key: jobKey, code, duration: `${duration}s`, logFile,
      startTime: new Date(startTime).toISOString(),
      agentType: jobInfo.agentType, prompt: prompt.slice(0, 300),
      outputTail: fullOutput.slice(-2000),
    });
    if (jobHistory.length > MAX_HISTORY) jobHistory.length = MAX_HISTORY;

    // React with rocket on success, confused on failure
    if (issueNumber) reactToIssue(repo, issueNumber, code === 0 ? "rocket" : "confused");
  });
}

// ---------------------------------------------------------------------------
// Event routing
// ---------------------------------------------------------------------------
function handlePullRequestReview(payload) {
  if (!config.settings.enabledEvents.pull_request_review) return;
  const review = payload.review, pr = payload.pull_request, repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo); if (!repoPath) return;
  if (review.state !== "changes_requested" && review.state !== "commented") return;
  if (config.settings.ignoredBots.some((b) => review.user.login.includes(b))) return;
  // Anti-loop: skip reviews on agent-authored PRs from bots (human reviews still handled)
  if (hasLabel(pr.labels || [], AGENT_PR_LABEL) && review.user.type === "Bot") {
    logEvent("SKIP", "agent-pr-bot-review", repo, `PR #${pr.number} is agent-authored, bot review ignored`);
    return;
  }
  const jobKey = `review-${repo}-${pr.number}`;
  if (isOnCooldown(jobKey)) { logEvent("SKIP", "cooldown", repo, jobKey); return; }
  const prompt = renderPrompt("pull_request_review", { prNumber: pr.number, prTitle: pr.title, reviewer: review.user.login, reviewState: review.state, repo });
  setCooldown(jobKey);
  spawnAgent(repoPath, prompt, jobKey);
}

function handleCheckSuite(payload) {
  if (!config.settings.enabledEvents.check_suite) return;
  const suite = payload.check_suite, repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo); if (!repoPath) return;
  if (suite.conclusion !== "failure" || suite.head_branch !== payload.repository.default_branch) return;
  const prompt = renderPrompt("check_suite", { branch: suite.head_branch, sha: suite.head_sha.slice(0, 8), repo });
  spawnAgent(repoPath, prompt, `ci-fail-${repo}-${suite.head_sha.slice(0, 8)}`);
}

function handleIssues(payload) {
  if (!config.settings.enabledEvents.issues) return;
  const issue = payload.issue, repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo); if (!repoPath) return;
  if (payload.action !== "opened" && payload.action !== "labeled") return;
  const labels = issue.labels.map((l) => l.name);

  // Two modes: labeled issues (deploy-failure, auto-fix) OR any new issue with agent-task label
  const isAgentTask = labels.includes("agent-task");
  const isAutoLabel = config.settings.issueLabels.some((l) => labels.includes(l));
  if (!isAgentTask && !isAutoLabel) return;

  const jobKey = `issue-${repo}-${issue.number}`;
  if (isOnCooldown(jobKey)) { logEvent("SKIP", "cooldown", repo, jobKey); return; }

  // For agent-task issues, use the issue body as additional context
  const prompt = isAgentTask
    ? renderPrompt("agent_task", { issueNumber: issue.number, issueTitle: issue.title, issueBody: (issue.body || "").slice(0, 1500), labels: labels.join(", "), repo })
    : renderPrompt("issues", { issueNumber: issue.number, issueTitle: issue.title, action: payload.action, labels: labels.join(", "), repo });

  setCooldown(jobKey);
  spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
}

function handlePullRequest(payload) {
  if (!config.settings.enabledEvents.pull_request) return;
  const pr = payload.pull_request, repo = payload.repository.full_name;
  if (!getRepoPath(repo)) return;
  if (payload.action === "opened" || payload.action === "synchronize")
    logEvent("PR", payload.action, repo, `#${pr.number}: ${pr.title}`);
}

function handleIssueComment(payload) {
  if (!config.settings.enabledEvents.issue_comment) return;
  const comment = payload.comment, issue = payload.issue, repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo); if (!repoPath) return;
  if (payload.action !== "created") return;
  if (comment.user.type === "Bot" || config.settings.ignoredBots.some((b) => comment.user.login.includes(b))) return;

  const body = comment.body.toLowerCase();
  const hasTrigger = config.settings.triggerKeywords.some((kw) => body.includes(kw.toLowerCase()));

  if (issue.pull_request) {
    // PR comment — only react to trigger keywords
    if (!hasTrigger) return;
    const jobKey = `comment-${repo}-${issue.number}-${comment.id}`;
    const prompt = renderPrompt("issue_comment", { prNumber: issue.number, prTitle: issue.title, author: comment.user.login, body: comment.body.slice(0, 500), repo });
    spawnAgent(repoPath, prompt, jobKey);
  } else {
    // Issue comment — react if the issue has agent-task label OR comment has trigger keyword
    const labels = (issue.labels || []).map((l) => l.name);
    const isAgentIssue = labels.includes("agent-task") || config.settings.issueLabels.some((l) => labels.includes(l));
    if (!isAgentIssue && !hasTrigger) return;

    const jobKey = `issue-comment-${repo}-${issue.number}-${comment.id}`;
    if (isOnCooldown(`issue-${repo}-${issue.number}`)) { logEvent("SKIP", "cooldown", repo, jobKey); return; }

    // React with eyes on the comment itself
    reactToComment(repo, comment.id, "eyes");

    const prompt = renderPrompt("issue_followup", {
      issueNumber: issue.number, issueTitle: issue.title,
      author: comment.user.login, body: comment.body.slice(0, 500),
      labels: labels.join(", "), repo,
    });
    setCooldown(`issue-${repo}-${issue.number}`);
    spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issue.number);
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ verify: (req, _res, buf) => (req.rawBody = buf) }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.post("/webhook", (req, res) => {
  if (!verifySignature(req.rawBody, req.headers["x-hub-signature-256"])) { logEvent("REJECT", "bad-sig", "unknown", ""); return res.status(401).send("Bad signature"); }
  const event = req.headers["x-github-event"], payload = req.body;
  const repo = payload.repository?.full_name || "unknown";
  logEvent(event, payload.action || "", repo, "received");
  switch (event) {
    case "pull_request_review": handlePullRequestReview(payload); break;
    case "check_suite": handleCheckSuite(payload); break;
    case "issues": handleIssues(payload); break;
    case "pull_request": handlePullRequest(payload); break;
    case "issue_comment": handleIssueComment(payload); break;
    default: logEvent(event, payload.action || "", repo, "unhandled");
  }
  res.json({ ok: true });
});

// --- API ---
app.get("/api/health", (_req, res) => res.json({ status: "ok", activeJobs: activeJobs.size, uptime: Math.floor(process.uptime()), agentType: config.agent.type }));
app.get("/api/config", (_req, res) => res.json(config));
app.post("/api/config", (req, res) => { config = { ...config, ...req.body }; saveConfig(); res.json({ ok: true }); });
app.post("/api/repos", (req, res) => { const { name, localPath, enabled } = req.body; if (!name || !localPath) return res.status(400).json({ error: "name and localPath required" }); config.repos[name] = { localPath, enabled: enabled !== false }; saveConfig(); res.json({ ok: true }); });
app.delete("/api/repos/:owner/:repo", (req, res) => { delete config.repos[`${req.params.owner}/${req.params.repo}`]; saveConfig(); res.json({ ok: true }); });
app.post("/api/settings", (req, res) => { config.settings = { ...config.settings, ...req.body }; saveConfig(); res.json({ ok: true }); });
app.post("/api/agent", (req, res) => { config.agent = { ...config.agent, ...req.body }; saveConfig(); res.json({ ok: true }); });
app.post("/api/prompts", (req, res) => { config.promptTemplates = { ...config.promptTemplates, ...req.body }; saveConfig(); res.json({ ok: true }); });
app.get("/api/events", (_req, res) => res.json(eventLog));
app.get("/api/jobs", (_req, res) => res.json({
  active: [...activeJobs.entries()].map(([k, v]) => ({ key: k, pid: v.pid, running: `${((Date.now() - v.startTime) / 1000).toFixed(0)}s`, prompt: v.prompt.slice(0, 200), agentType: v.agentType, output: v.output.join("").slice(-1000) })),
  history: jobHistory.slice(0, 50),
}));
app.post("/api/jobs/:key/kill", (req, res) => { const j = activeJobs.get(req.params.key); if (!j) return res.status(404).json({ error: "Not found" }); try { process.kill(j.pid, "SIGTERM"); } catch {} res.json({ ok: true }); });
app.get("/api/logs/:filename", (req, res) => {
  const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const p = join(LOG_DIR, safe);
  if (!existsSync(p)) return res.status(404).send("Not found");
  res.type("text/plain").send(readFileSync(p, "utf-8").split("\n").slice(-500).join("\n"));
});

// --- Dashboard ---
app.get("/", (_req, res) => res.type("html").send(dashboardHTML()));

function dashboardHTML() {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Webhook Monitor</title>
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="manifest" href="/manifest.json">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9}
.topbar{background:linear-gradient(135deg,#023e6b,#0077b6,#00b4d8);padding:12px 24px;display:flex;align-items:center;gap:16px}
.topbar h1{font-size:18px;color:#fff;font-weight:600}
.topbar .status{margin-left:auto;display:flex;gap:12px;align-items:center}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.green{background:#3fb950} .dot.red{background:#f85149} .dot.amber{background:#d29922}
.badge{background:rgba(255,255,255,.15);color:#fff;padding:2px 10px;border-radius:12px;font-size:13px}
.container{max-width:1200px;margin:0 auto;padding:20px}
.tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:8px 18px;border-radius:8px 8px 0 0;cursor:pointer;background:#161b22;color:#8b949e;border:1px solid #30363d;border-bottom:none;font-size:14px;user-select:none}
.tab.active{background:#0d1117;color:#c9d1d9}
.panel{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:16px}
.panel h2{font-size:15px;color:#58a6ff;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:#8b949e;font-weight:500;padding:8px;border-bottom:1px solid #30363d}
td{padding:8px;border-bottom:1px solid #21262d;vertical-align:top}
.mono{font-family:'SF Mono',Consolas,monospace;font-size:12px}
input,select,textarea{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;padding:6px 10px;font-size:13px;font-family:inherit}
input:focus,select:focus,textarea:focus{border-color:#58a6ff;outline:none}
textarea{width:100%;min-height:100px;resize:vertical;font-family:'SF Mono',Consolas,monospace;font-size:12px;line-height:1.5}
button{background:#238636;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px}
button:hover{background:#2ea043}
button.danger{background:#da3633} button.danger:hover{background:#f85149}
button.secondary{background:#30363d;color:#c9d1d9}
.toggle{position:relative;width:40px;height:22px;display:inline-block}
.toggle input{opacity:0;width:0;height:0}
.toggle .slider{position:absolute;inset:0;background:#30363d;border-radius:11px;cursor:pointer;transition:.2s}
.toggle .slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#8b949e;border-radius:50%;transition:.2s}
.toggle input:checked+.slider{background:#238636}
.toggle input:checked+.slider::before{transform:translateX(18px);background:#fff}
.row{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.flex-1{flex:1;min-width:150px}
.tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;margin:2px;cursor:default}
.tag .x{cursor:pointer;margin-left:4px;opacity:.6} .tag .x:hover{opacity:1}
.tag.kw{background:#1f2937;color:#93c5fd;border:1px solid #374151}
.tag.label{background:#1c1917;color:#fbbf24;border:1px solid #44403c}
.tag.bot{background:#1a1a2e;color:#a78bfa;border:1px solid #312e81}
.section-tab{display:none} .section-tab.active{display:block}
.job-card{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:8px}
.job-card .key{color:#58a6ff;font-weight:600;font-size:13px}
.job-card .meta{color:#8b949e;font-size:12px;margin-top:4px}
.job-card .agent-badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;margin-left:8px}
.agent-badge.claude{background:#1a1a2e;color:#a78bfa;border:1px solid #312e81}
.agent-badge.codex{background:#1a2e1a;color:#86efac;border:1px solid #166534}
pre.log{background:#0d1117;padding:12px;border-radius:6px;font-size:11px;max-height:400px;overflow:auto;white-space:pre-wrap;word-break:break-all;font-family:'SF Mono',Consolas,monospace;line-height:1.4}
.live-output{border-left:3px solid #58a6ff;padding-left:12px;margin-top:8px}
.empty{color:#484f58;font-style:italic;padding:20px;text-align:center}
.ev-row{padding:4px 0;font-size:12px;border-bottom:1px solid #161b22}
.ev-row .ts{color:#484f58;width:180px;display:inline-block} .ev-row .ev{color:#58a6ff}
.radio-group{display:flex;gap:4px}
.radio-group label{padding:6px 14px;border:1px solid #30363d;border-radius:6px;cursor:pointer;font-size:13px;background:#0d1117}
.radio-group input{display:none}
.radio-group input:checked+span{color:#58a6ff;font-weight:600}
.radio-group label:has(input:checked){border-color:#58a6ff;background:#161b22}
.hint{color:#484f58;font-size:11px;margin-top:2px}
</style></head><body>
<div class="topbar">
  <h1>Webhook Monitor</h1>
  <div class="status">
    <span class="dot green" id="sDot"></span>
    <span class="badge" id="sAgent">...</span>
    <span class="badge" id="sUptime">...</span>
    <span class="badge" id="sJobs">0 jobs</span>
  </div>
</div>
<div class="container">
  <div class="tabs" id="tabBar"></div>
  <div id="tabContent"></div>
</div>
<script>
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const api = async (u, o) => (await fetch(u, {headers:{'Content-Type':'application/json'},...o})).json();

const TABS = ['Dashboard','Repos','Agent','Prompts','Settings','Jobs','Events'];
let currentTab = 'Dashboard';

function renderTabs() {
  $('#tabBar').innerHTML = TABS.map(t => '<div class="tab'+(t===currentTab?' active':'')+'" onclick="switchTab(\\''+t+'\\')">'+t+'</div>').join('');
}
function switchTab(t) { currentTab = t; renderTabs(); renderContent(); }

async function renderContent() {
  const cfg = await api('/api/config');
  const el = $('#tabContent');
  switch(currentTab) {
    case 'Dashboard': el.innerHTML = dashboardTab(); refreshDashboard(); break;
    case 'Repos': el.innerHTML = reposTab(cfg); break;
    case 'Agent': el.innerHTML = agentTab(cfg); break;
    case 'Prompts': el.innerHTML = promptsTab(cfg); break;
    case 'Settings': el.innerHTML = settingsTab(cfg); break;
    case 'Jobs': el.innerHTML = jobsTab(); refreshJobs(); break;
    case 'Events': el.innerHTML = eventsTab(); refreshEvents(); break;
  }
}

// --- Dashboard ---
function dashboardTab() { return '<div class="panel"><h2>Active Jobs</h2><div id="dActive"><div class="empty">No active jobs</div></div></div><div class="panel"><h2>Recent Events</h2><div id="dEvents"><div class="empty">No events</div></div></div>'; }
async function refreshDashboard() {
  const [jobs, events] = await Promise.all([api('/api/jobs'), api('/api/events')]);
  const a = $('#dActive'); const e = $('#dEvents');
  if (!a) return;
  if (jobs.active.length) {
    a.innerHTML = jobs.active.map(j => '<div class="job-card"><div class="key">'+esc(j.key)+'<span class="agent-badge '+j.agentType+'">'+j.agentType+'</span></div><div class="meta">PID '+j.pid+' | '+j.running+'</div><div class="live-output"><pre class="log">'+esc(j.output||'(waiting...)')+'</pre></div><button class="danger" style="margin-top:6px" onclick="killJob(\\''+esc(j.key)+'\\')">Kill</button></div>').join('');
  } else { a.innerHTML = '<div class="empty">No active jobs</div>'; }
  if (e && events.length) {
    e.innerHTML = events.slice(0,15).map(ev => '<div class="ev-row"><span class="ts mono">'+esc(ev.ts)+'</span> <span class="ev">'+esc(ev.event+':'+ev.action)+'</span> '+esc(ev.repo)+' — '+esc(ev.summary)+'</div>').join('');
  }
}

// --- Repos ---
function reposTab(cfg) {
  let rows = Object.entries(cfg.repos).map(([n,r]) => '<tr><td class="mono">'+esc(n)+'</td><td class="mono">'+esc(r.localPath)+'</td><td><label class="toggle"><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="toggleRepo(\\''+esc(n)+'\\',this.checked)"><span class="slider"></span></label></td><td><button class="danger" onclick="removeRepo(\\''+esc(n)+'\\')">Remove</button></td></tr>').join('');
  return '<div class="panel"><h2>Monitored Repositories</h2><table><tr><th>Repository</th><th>Local Path</th><th>Enabled</th><th></th></tr>'+rows+'</table><hr style="border-color:#30363d;margin:16px 0"><h2>Add Repository</h2><div class="row"><input id="nrName" placeholder="owner/repo" class="flex-1"><input id="nrPath" placeholder="/path/to/checkout" class="flex-1"><button onclick="addRepo()">Add</button></div></div>';
}
async function addRepo() { await api('/api/repos',{method:'POST',body:JSON.stringify({name:$('#nrName').value.trim(),localPath:$('#nrPath').value.trim()})}); renderContent(); }
async function removeRepo(n) { if(!confirm('Remove '+n+'?'))return; await fetch('/api/repos/'+n,{method:'DELETE'}); renderContent(); }
async function toggleRepo(n,on) { const c=await api('/api/config'); c.repos[n].enabled=on; await api('/api/config',{method:'POST',body:JSON.stringify({repos:c.repos})}); }

// --- Agent ---
function agentTab(cfg) {
  const a = cfg.agent;
  return '<div class="panel"><h2>AI Agent Type</h2><div class="row"><div class="radio-group">'
    + radioBtn('agentType','claude','Claude Code',a.type==='claude')
    + radioBtn('agentType','codex','Codex CLI',a.type==='codex')
    + '</div></div></div>'
    + '<div class="panel" id="claudeCfg" style="display:'+(a.type==='claude'?'block':'none')+'"><h2>Claude Code Settings</h2>'
    + field('Claude CLI path','cBin',a.claude.bin,'claude')
    + '<div class="row"><label style="width:180px">Model</label><select id="cModel" style="width:200px"><option value="">Default (auto)</option><option value="sonnet"'+(a.claude.model==='sonnet'?' selected':'')+'>Sonnet (fast)</option><option value="opus"'+(a.claude.model==='opus'?' selected':'')+'>Opus (powerful)</option><option value="haiku"'+(a.claude.model==='haiku'?' selected':'')+'>Haiku (light)</option></select></div>'
    + field('Extra args','cExtra',a.claude.extraArgs,'--dangerously-skip-permissions')
    + '<button onclick="saveAgent(\\'claude\\')">Save Claude Settings</button></div>'
    + '<div class="panel" id="codexCfg" style="display:'+(a.type==='codex'?'block':'none')+'"><h2>Codex CLI Settings</h2>'
    + field('Codex CLI path','xBin',a.codex.bin,'codex')
    + field('Model','xModel',a.codex.model,'gpt-5.3-codex')
    + '<div class="row"><label style="width:180px">Reasoning effort</label><select id="xReason" style="width:200px"><option value="xhigh"'+(a.codex.reasoningEffort==='xhigh'?' selected':'')+'>xhigh (reviews/analysis)</option><option value="high"'+(a.codex.reasoningEffort==='high'?' selected':'')+'>high (code edits)</option><option value="medium"'+(a.codex.reasoningEffort==='medium'?' selected':'')+'>medium</option><option value="low"'+(a.codex.reasoningEffort==='low'?' selected':'')+'>low</option></select></div>'
    + '<div class="row"><label style="width:180px">Sandbox</label><select id="xSandbox" style="width:200px"><option value="read-only"'+(a.codex.sandbox==='read-only'?' selected':'')+'>read-only</option><option value="workspace-write"'+(a.codex.sandbox==='workspace-write'?' selected':'')+'>workspace-write</option><option value="danger-full-access"'+(a.codex.sandbox==='danger-full-access'?' selected':'')+'>danger-full-access</option></select></div>'
    + field('Extra args','xExtra',a.codex.extraArgs,'--full-auto')
    + '<button onclick="saveAgent(\\'codex\\')">Save Codex Settings</button></div>';
}
function radioBtn(name,val,label,checked) { return '<label><input type="radio" name="'+name+'" value="'+val+'" '+(checked?'checked':'')+' onchange="switchAgent(\\''+val+'\\')"><span>'+label+'</span></label>'; }
function field(label,id,val,ph) { return '<div class="row"><label style="width:180px">'+label+'</label><input id="'+id+'" value="'+esc(val||'')+'" placeholder="'+esc(ph||'')+'" style="width:300px"></div>'; }
async function switchAgent(type) {
  await api('/api/agent',{method:'POST',body:JSON.stringify({type})});
  renderContent();
}
async function saveAgent(type) {
  if (type==='claude') {
    await api('/api/agent',{method:'POST',body:JSON.stringify({type:'claude',claude:{bin:$('#cBin').value,model:$('#cModel').value,extraArgs:$('#cExtra').value}})});
  } else {
    await api('/api/agent',{method:'POST',body:JSON.stringify({type:'codex',codex:{bin:$('#xBin').value,model:$('#xModel').value,reasoningEffort:$('#xReason').value,sandbox:$('#xSandbox').value,extraArgs:$('#xExtra').value}})});
  }
  renderContent();
}

// --- Prompts ---
function promptsTab(cfg) {
  const tpls = cfg.promptTemplates;
  let html = '<div class="panel"><h2>Prompt Templates</h2><p class="hint" style="margin-bottom:16px">Use {{variable}} placeholders. Each event type has its own template and available variables.</p>';
  const vars = {
    pull_request_review: 'prNumber, prTitle, reviewer, reviewState, repo',
    check_suite: 'branch, sha, repo',
    issues: 'issueNumber, issueTitle, action, labels, repo',
    issue_comment: 'prNumber, prTitle, author, body, repo',
  };
  for (const [key, tpl] of Object.entries(tpls)) {
    html += '<h2 style="margin-top:16px">'+esc(key)+'</h2><div class="hint">Variables: '+esc(vars[key]||'')+'</div><textarea id="tpl_'+key+'" rows="5">'+esc(tpl)+'</textarea>';
  }
  html += '<button style="margin-top:12px" onclick="savePrompts()">Save All Templates</button></div>';
  return html;
}
async function savePrompts() {
  const body = {};
  $$('textarea[id^=tpl_]').forEach(ta => { body[ta.id.replace('tpl_','')]=ta.value; });
  await api('/api/prompts',{method:'POST',body:JSON.stringify(body)});
  renderContent();
}

// --- Settings ---
function settingsTab(cfg) {
  const s = cfg.settings;
  let evHtml = Object.entries(s.enabledEvents).map(([ev,on]) => '<div class="row"><label style="width:220px">'+esc(ev)+'</label><label class="toggle"><input type="checkbox" '+(on?'checked':'')+' onchange="toggleEv(\\''+ev+'\\',this.checked)"><span class="slider"></span></label></div>').join('');
  return '<div class="panel"><h2>General</h2>'
    + '<div class="row"><label style="width:220px">Max concurrent jobs</label><input id="sMaxJ" type="number" min="1" max="10" value="'+s.maxConcurrentJobs+'" style="width:80px"><button onclick="saveSetting(\\'maxConcurrentJobs\\',+$(\\'\\'#sMaxJ\\'\\').value)">Save</button></div>'
    + '<div class="row"><label style="width:220px">Job timeout (minutes)</label><input id="sTimeout" type="number" min="1" max="60" value="'+s.jobTimeoutMinutes+'" style="width:80px"><button onclick="saveSetting(\\'jobTimeoutMinutes\\',+$(\\'\\'#sTimeout\\'\\').value)">Save</button></div>'
    + '</div><div class="panel"><h2>Enabled Events</h2>'+evHtml+'</div>'
    + tagPanel('Trigger Keywords','triggerKeywords',s.triggerKeywords,'kw','newKw')
    + tagPanel('Auto-fix Issue Labels','issueLabels',s.issueLabels,'label','newLbl')
    + tagPanel('Ignored Bots','ignoredBots',s.ignoredBots,'bot','newBot');
}
function tagPanel(title,key,arr,cls,inputId) {
  return '<div class="panel"><h2>'+title+'</h2><div>'+arr.map(v=>'<span class="tag '+cls+'">'+esc(v)+'<span class="x" onclick="removeTag(\\''+key+'\\',\\''+esc(v)+'\\')"> x</span></span>').join(' ')+'</div><div class="row" style="margin-top:8px"><input id="'+inputId+'" placeholder="Add..."><button onclick="addTag(\\''+key+'\\',\\''+inputId+'\\')">Add</button></div></div>';
}
async function saveSetting(k,v) { await api('/api/settings',{method:'POST',body:JSON.stringify({[k]:v})}); }
async function toggleEv(ev,on) { const c=await api('/api/config'); c.settings.enabledEvents[ev]=on; await api('/api/settings',{method:'POST',body:JSON.stringify({enabledEvents:c.settings.enabledEvents})}); }
async function addTag(key,inputId) { const v=$('#'+inputId).value.trim(); if(!v)return; const c=await api('/api/config'); c.settings[key].push(v); await api('/api/settings',{method:'POST',body:JSON.stringify({[key]:c.settings[key]})}); renderContent(); }
async function removeTag(key,val) { const c=await api('/api/config'); c.settings[key]=c.settings[key].filter(x=>x!==val); await api('/api/settings',{method:'POST',body:JSON.stringify({[key]:c.settings[key]})}); renderContent(); }

// --- Jobs ---
function jobsTab() { return '<div class="panel"><h2>Active Jobs (live output)</h2><div id="jActive"><div class="empty">No active jobs</div></div></div><div class="panel"><h2>Job History</h2><div id="jHist"></div></div><div class="panel" id="logPanel" style="display:none"><h2>Session Log</h2><pre class="log" id="logOut"></pre></div>'; }
async function refreshJobs() {
  const d = await api('/api/jobs');
  const a = $('#jActive');
  if(!a) return;
  if(d.active.length) {
    a.innerHTML = d.active.map(j => '<div class="job-card"><div class="key">'+esc(j.key)+'<span class="agent-badge '+j.agentType+'">'+j.agentType+'</span></div><div class="meta">PID '+j.pid+' | Running '+j.running+'</div><div class="live-output"><pre class="log" style="max-height:200px">'+esc(j.output||'(waiting...)')+'</pre></div><button class="danger" style="margin-top:6px" onclick="killJob(\\''+esc(j.key)+'\\')">Kill</button></div>').join('');
  } else { a.innerHTML='<div class="empty">No active jobs</div>'; }
  const h = $('#jHist');
  if(h && d.history.length) {
    h.innerHTML = '<table><tr><th>Job</th><th>Agent</th><th>Exit</th><th>Duration</th><th>Time</th><th></th></tr>'+d.history.map(j => {
      const fname = (j.logFile||'').split('/').pop();
      return '<tr><td class="mono">'+esc(j.key)+'</td><td><span class="agent-badge '+(j.agentType||'claude')+'">'+(j.agentType||'claude')+'</span></td><td>'+j.code+'</td><td>'+j.duration+'</td><td class="mono" style="font-size:11px">'+esc(j.startTime)+'</td><td><button class="secondary" onclick="viewLog(\\''+esc(fname)+'\\')">Log</button> <button class="secondary" onclick="viewOutput(\\''+esc(j.key)+'\\')">Output</button></td></tr>';
    }).join('')+'</table>';
  }
}
async function killJob(k) { await api('/api/jobs/'+encodeURIComponent(k)+'/kill',{method:'POST'}); setTimeout(()=>{if(currentTab==='Jobs')refreshJobs();else refreshDashboard();},1000); }
async function viewLog(f) { $('#logPanel').style.display='block'; const r=await fetch('/api/logs/'+f); $('#logOut').textContent=await r.text(); }
function viewOutput(key) {
  const d = jobHistory_cache?.find(j=>j.key===key);
  if(d?.outputTail) { $('#logPanel').style.display='block'; $('#logOut').textContent=d.outputTail; }
}
let jobHistory_cache;
(async()=>{ const d=await api('/api/jobs'); jobHistory_cache=d.history; })();

// --- Events ---
function eventsTab() { return '<div class="panel"><h2>Event Log</h2><div id="eFull"><div class="empty">No events</div></div></div>'; }
async function refreshEvents() {
  const ev = await api('/api/events');
  const el = $('#eFull'); if(!el||!ev.length) return;
  el.innerHTML = ev.map(e => '<div class="ev-row"><span class="ts mono">'+esc(e.ts)+'</span> <span class="ev">'+esc(e.event+':'+e.action)+'</span> '+esc(e.repo)+' — '+esc(e.summary)+'</div>').join('');
}

function esc(s) { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// --- Health bar + auto-refresh ---
async function tick() {
  try {
    const h = await api('/api/health');
    $('#sDot').className='dot green';
    $('#sAgent').textContent=h.agentType;
    $('#sUptime').textContent=fmt(h.uptime);
    $('#sJobs').textContent=h.activeJobs+' job'+(h.activeJobs!==1?'s':'');
  } catch { $('#sDot').className='dot red'; }
  if(currentTab==='Dashboard') refreshDashboard();
  else if(currentTab==='Jobs') refreshJobs();
}
function fmt(s){if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';return Math.floor(s/86400)+'d';}

renderTabs(); renderContent(); tick(); setInterval(tick, 5000);
</script></body></html>`;
}

app.listen(PORT, () => {
  console.log("\\n\\u{1F30A} gh-webhook-monitor listening on http://localhost:" + PORT);
  console.log("   Dashboard:  http://localhost:" + PORT + "/");
  console.log("   Agent type: " + config.agent.type);
  console.log("   Repos:      " + Object.keys(config.repos).join(", "));
  console.log("");
});
