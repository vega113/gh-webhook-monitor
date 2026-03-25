import { spawn } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConfig, getAgentForRepo } from "../config.js";
import { logEvent, getLogDir } from "../logger.js";

const activeJobs = new Map();
let jobHistory = [];
const MAX_HISTORY = 200;
const HISTORY_FILE = join(getLogDir(), "job-history.json");
let jobQueue = null; // Set by setJobQueue

// Load job history from disk on startup
function loadJobHistory() {
  try {
    if (existsSync(HISTORY_FILE)) {
      const data = readFileSync(HISTORY_FILE, "utf-8");
      jobHistory = JSON.parse(data);
      if (!Array.isArray(jobHistory)) jobHistory = [];
    }
  } catch (e) {
    // If file is corrupted, start fresh
    jobHistory = [];
  }
}

// Save job history to disk
function saveJobHistory() {
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(jobHistory.slice(0, MAX_HISTORY), null, 2));
  } catch (e) {
    logEvent("WARN", "history-save", "system", `Failed to save job history: ${e.message}`);
  }
}

loadJobHistory();

function buildAgentCommand(prompt, agentType) {
  const config = getConfig();
  const a = config.agent;
  const agent = agentType || a.type;

  if (agent === "codex") {
    const c = a.codex;
    const args = ["exec"];
    if (c.model) args.push("-m", c.model);
    if (c.reasoningEffort)
      args.push("--config", `model_reasoning_effort="${c.reasoningEffort}"`);
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

function spawnAgent(repoPath, prompt, jobKey, repoFullName) {
  const config = getConfig();

  if (activeJobs.has(jobKey)) {
    logEvent("SKIP", "duplicate", jobKey, "Already running");
    return;
  }

  // Check if job would exceed the limit
  if (activeJobs.size >= config.settings.maxConcurrentJobs) {
    // Queue the job instead of dropping it
    if (jobQueue) {
      const queued = jobQueue.enqueue({
        jobKey,
        repoPath,
        prompt,
        repoFullName,
        queuedAt: new Date().toISOString(),
      });
      if (queued) {
        logEvent(
          "QUEUE",
          "max-jobs",
          jobKey,
          `Limit ${config.settings.maxConcurrentJobs}, queued (${jobQueue.length()} pending)`
        );
      } else {
        logEvent("SKIP", "duplicate-queued", jobKey, "Already queued");
      }
    }
    return;
  }

  const agentType = repoFullName ? getAgentForRepo(repoFullName) : config.agent.type;
  const { bin, args } = buildAgentCommand(prompt, agentType);
  logEvent(
    "SPAWN",
    agentType,
    jobKey,
    `${bin} ${args[0]} ... ${prompt.slice(0, 80)}`
  );

  const startTime = Date.now();
  const logFile = join(
    getLogDir(),
    `${jobKey.replace(/[^a-zA-Z0-9-_]/g, "_")}-${startTime}.log`
  );
  const outputChunks = [];

  const child = spawn(bin, args, {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "webhook-monitor" },
  });

  const jobInfo = {
    key: jobKey,
    pid: child.pid,
    startTime,
    logFile,
    prompt,
    agentType,
    output: outputChunks,
  };
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
      logEvent(
        "TIMEOUT",
        "kill",
        jobKey,
        `${config.settings.jobTimeoutMinutes}m`
      );
      child.kill("SIGTERM");
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 5000);
    }
  }, config.settings.jobTimeoutMinutes * 60 * 1000);

  child.on("close", (code) => {
    clearTimeout(timeout);
    activeJobs.delete(jobKey);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullOutput = outputChunks.join("");
    logEvent("DONE", `exit=${code}`, jobKey, `${duration}s`);
    jobHistory.unshift({
      key: jobKey,
      code,
      duration: `${duration}s`,
      logFile,
      startTime: new Date(startTime).toISOString(),
      agentType: jobInfo.agentType,
      prompt: prompt.slice(0, 300),
      outputTail: fullOutput.slice(-2000),
    });
    if (jobHistory.length > MAX_HISTORY) jobHistory.length = MAX_HISTORY;
    saveJobHistory();

    // Try to dequeue and spawn next job
    processQueue();
  });
}

function getActiveJobs() {
  return activeJobs;
}

function getJobHistory() {
  return jobHistory;
}

function setJobQueue(queue) {
  jobQueue = queue;
}

function processQueue() {
  if (!jobQueue || activeJobs.size >= getConfig().settings.maxConcurrentJobs) {
    return; // No queue or still at capacity
  }

  const nextJob = jobQueue.dequeue();
  if (!nextJob) {
    return; // Queue is empty
  }

  logEvent(
    "QUEUE",
    "dequeue",
    nextJob.jobKey,
    `Processing queued job (${jobQueue.length()} remaining)`
  );

  // Spawn the dequeued job
  spawnAgent(nextJob.repoPath, nextJob.prompt, nextJob.jobKey, nextJob.repoFullName);
}

export {
  spawnAgent,
  buildAgentCommand,
  getActiveJobs,
  getJobHistory,
  setJobQueue,
  processQueue,
};
