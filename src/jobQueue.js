/**
 * JobQueue - Manages a queue of pending jobs
 * Implements FIFO queueing with duplicate prevention
 */

class JobQueue {
  constructor() {
    this.queue = []; // Array of queued job specs
    this.queuedKeys = new Set(); // Track which job keys are queued
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
  }
}

export { JobQueue };
