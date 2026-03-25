import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig, getAgentForRepo } from "../config.js";
import { logEvent, getLogDir } from "../logger.js";
import { reactToIssue } from "./reactions.js";
import { getActiveJobs, getJobHistory, buildAgentCommand } from "./spawnAgent.js";

const MAX_HISTORY = 200;

function spawnAgentWithReaction(repoPath, prompt, jobKey, repo, issueNumber) {
  const config = getConfig();
  const activeJobs = getActiveJobs();
  const jobHistory = getJobHistory();

  if (activeJobs.has(jobKey)) {
    logEvent("SKIP", "duplicate", jobKey, "Already running");
    return;
  }
  if (activeJobs.size >= config.settings.maxConcurrentJobs) {
    logEvent(
      "SKIP",
      "max-jobs",
      jobKey,
      `Limit ${config.settings.maxConcurrentJobs}`
    );
    return;
  }

  // Acknowledge with eyes emoji immediately
  if (issueNumber) reactToIssue(repo, issueNumber, "eyes");

  const agentType = getAgentForRepo(repo);
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

    // React with rocket on success, confused on failure
    if (issueNumber) {
      reactToIssue(repo, issueNumber, code === 0 ? "rocket" : "confused");
    }
  });
}

export { spawnAgentWithReaction };
