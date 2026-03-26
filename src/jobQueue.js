/**
 * JobQueue - Manages a queue of pending jobs
 * Implements FIFO queueing with duplicate prevention
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLogDir } from "./logger.js";

class JobQueue {
  constructor(options = {}) {
    this.queue = []; // Array of queued job specs
    this.queuedKeys = new Set(); // Track which job keys are queued
    this.stateFile = options.stateFile || join(getLogDir(), "job-queue.json");
    this.load();
  }

  load() {
    try {
      if (!this.stateFile || !existsSync(this.stateFile)) return;
      const raw = readFileSync(this.stateFile, "utf-8");
      const parsed = JSON.parse(raw);
      const queuedJobs = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.queuedJobs)
          ? parsed.queuedJobs
          : [];
      this.replaceAll(queuedJobs, false);
    } catch {
      this.queue = [];
      this.queuedKeys.clear();
    }
  }

  save() {
    try {
      if (!this.stateFile) return;
      writeFileSync(this.stateFile, JSON.stringify(this.queue, null, 2));
    } catch {
      // Best-effort persistence. The in-memory queue still works.
    }
  }

  replaceAll(jobSpecs, persist = true) {
    this.queue = [];
    this.queuedKeys.clear();
    for (const jobSpec of jobSpecs || []) {
      if (!jobSpec?.jobKey || this.queuedKeys.has(jobSpec.jobKey)) continue;
      this.queue.push(jobSpec);
      this.queuedKeys.add(jobSpec.jobKey);
    }
    if (persist) this.save();
  }

  /**
   * Add a job to the queue
   * Prevents duplicates - returns false if job already queued
   */
  enqueue(jobSpec) {
    const { jobKey } = jobSpec;

    if (this.queuedKeys.has(jobKey)) {
      return false; // Job already in queue
    }

    this.queue.push(jobSpec);
    this.queuedKeys.add(jobKey);
    this.save();
    return true;
  }

  /**
   * Add a job to the front of the queue
   * Used when recovering active jobs after a restart.
   */
  prepend(jobSpec) {
    const { jobKey } = jobSpec;
    if (!jobKey || this.queuedKeys.has(jobKey)) {
      return false;
    }

    this.queue.unshift(jobSpec);
    this.queuedKeys.add(jobKey);
    this.save();
    return true;
  }

  /**
   * Get the next job from the queue
   * Returns null if queue is empty
   */
  dequeue() {
    const jobSpec = this.queue.shift();
    if (jobSpec) {
      this.queuedKeys.delete(jobSpec.jobKey);
      this.save();
    }
    return jobSpec || null;
  }

  /**
   * Check if a job is currently queued
   */
  isPending(jobKey) {
    return this.queuedKeys.has(jobKey);
  }

  /**
   * Get current queue length
   */
  length() {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  stats() {
    return {
      pending: this.queue.length,
      queuedJobs: this.queue.map((j) => ({
        jobKey: j.jobKey,
        repoFullName: j.repoFullName,
        queuedAt: j.queuedAt,
      })),
    };
  }

  /**
   * Clear the entire queue
   */
  clear() {
    this.queue = [];
    this.queuedKeys.clear();
    this.save();
  }
}

export { JobQueue };
