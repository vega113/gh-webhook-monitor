import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLogDir } from "./logger.js";

const DEFAULT_ACTIVE_STATE_FILE = join(getLogDir(), "job-active.json");

function resolveStateFile(stateFile) {
  return stateFile || DEFAULT_ACTIVE_STATE_FILE;
}

function loadActiveJobs(stateFile) {
  const file = resolveStateFile(stateFile);
  try {
    if (!existsSync(file)) return [];
    const raw = readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.activeJobs)
        ? parsed.activeJobs
        : [];
  } catch {
    return [];
  }
}

function saveActiveJobs(stateFile, jobs) {
  const file = resolveStateFile(stateFile);
  try {
    writeFileSync(file, JSON.stringify(jobs, null, 2));
  } catch {
    // Best-effort persistence only.
  }
}

function recordActiveJob(jobInfo, options = {}) {
  const stateFile = resolveStateFile(options.stateFile);
  try {
    const activeJobs = loadActiveJobs(stateFile);
    const next = activeJobs.filter((job) => job?.jobKey !== jobInfo?.jobKey);
    next.push(jobInfo);
    saveActiveJobs(stateFile, next);
  } catch {
    // Best-effort persistence only.
  }
  return jobInfo;
}

function clearActiveJob(jobKey, options = {}) {
  const stateFile = resolveStateFile(options.stateFile);
  try {
    const activeJobs = loadActiveJobs(stateFile);
    const next = activeJobs.filter((job) => job?.jobKey !== jobKey);
    if (next.length !== activeJobs.length) {
      saveActiveJobs(stateFile, next);
    }
    return next.length !== activeJobs.length;
  } catch {
    return false;
  }
}

function recoverActiveJobs(jobQueue, options = {}) {
  const stateFile = resolveStateFile(options.stateFile);
  try {
    const activeJobs = loadActiveJobs(stateFile);
    if (!activeJobs.length) return [];

    // Restore oldest active jobs first so the queue order is stable.
    for (let i = activeJobs.length - 1; i >= 0; i -= 1) {
      const job = activeJobs[i];
      if (typeof jobQueue.prepend === "function") {
        jobQueue.prepend(job);
      } else if (typeof jobQueue.enqueue === "function") {
        jobQueue.enqueue(job);
      }
    }

    saveActiveJobs(stateFile, []);
    return activeJobs;
  } catch {
    return [];
  }
}

export {
  DEFAULT_ACTIVE_STATE_FILE,
  loadActiveJobs,
  saveActiveJobs,
  recordActiveJob,
  clearActiveJob,
  recoverActiveJobs,
};
