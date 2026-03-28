/**
 * RateLimiter - Per-PR, per-action-type rate limiting with event batching
 */

class RateLimiter {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      updateBranchInterval: 60,        // seconds
      rerunGateInterval: 120,          // seconds
      resolveThreadsInterval: 30,      // seconds
      spawnAgentInterval: 300,         // seconds
      batchWindowMs: 5000,             // milliseconds
      ...config,
    };

    // Track execution timestamps per PR per action type
    // Format: Map<prNumber, Map<actionType, timestamp>>
    this.executionTimes = new Map();

    // Event batch queue
    // Format: Array<{ prNumber, actionType, timestamp }>
    this.eventBatch = [];

    // Processing state
    this.isProcessing = false;
    this.batchInterval = null;
  }

  /**
   * Start the batch processing interval
   */
  startBatchProcessing() {
    if (this.batchInterval) return;

    this.batchInterval = setInterval(() => {
      this.processBatch();
    }, this.config.batchWindowMs);
  }

  /**
   * Stop the batch processing interval
   */
  stopBatchProcessing() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * Check if an action can be executed for a given PR and action type
   * @param {number} prNumber - Pull request number
   * @param {string} actionType - Type of action (e.g., 'updateBranch', 'rerunGate', etc.)
   * @returns {boolean} - true if action can execute, false if rate limited
   */
  canExecute(prNumber, actionType) {
    const prData = this.executionTimes.get(prNumber);
    if (!prData) return true;

    const lastExecution = prData.get(actionType);
    if (!lastExecution) return true;

    const interval = this._getInterval(actionType);
    const elapsed = (Date.now() - lastExecution) / 1000; // Convert to seconds

    return elapsed >= interval;
  }

  getRemainingSeconds(prNumber, actionType) {
    const prData = this.executionTimes.get(prNumber);
    if (!prData) return 0;

    const lastExecution = prData.get(actionType);
    if (!lastExecution) return 0;

    const interval = this._getInterval(actionType);
    const elapsed = (Date.now() - lastExecution) / 1000;
    return Math.max(0, interval - elapsed);
  }

  /**
   * Record an execution for an action on a PR
   * @param {number} prNumber - Pull request number
   * @param {string} actionType - Type of action
   */
  recordExecution(prNumber, actionType) {
    if (!this.executionTimes.has(prNumber)) {
      this.executionTimes.set(prNumber, new Map());
    }

    const prData = this.executionTimes.get(prNumber);
    prData.set(actionType, Date.now());
  }

  /**
   * Add an event to the batch queue
   * @param {number} prNumber - Pull request number
   * @param {string} actionType - Type of action
   */
  queueEvent(prNumber, actionType) {
    this.eventBatch.push({
      prNumber,
      actionType,
      timestamp: Date.now(),
    });
  }

  /**
   * Process batched events and deduplicate them
   * Returns an array of events that should be executed
   */
  processBatch() {
    if (this.isProcessing || this.eventBatch.length === 0) {
      return [];
    }

    this.isProcessing = true;

    try {
      // Deduplicate: for each PR-actionType pair, keep only the first event
      const deduped = new Map();
      const eventsToExecute = [];

      for (const event of this.eventBatch) {
        const key = `${event.prNumber}-${event.actionType}`;

        if (!deduped.has(key)) {
          deduped.set(key, event);
          eventsToExecute.push(event);
        }
      }

      // Clear the batch
      this.eventBatch = [];

      return eventsToExecute;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the rate limit interval for an action type (in seconds)
   * @private
   */
  _getInterval(actionType) {
    const intervalMap = {
      updateBranch: this.config.updateBranchInterval,
      rerunGate: this.config.rerunGateInterval,
      resolveThreads: this.config.resolveThreadsInterval,
      spawnAgent: this.config.spawnAgentInterval,
    };

    return intervalMap[actionType] || 60; // Default to 60 seconds
  }

  /**
   * Get the current state of the rate limiter for API/dashboard visibility
   */
  getState() {
    const state = {
      config: this.config,
      executions: {},
      batchQueueSize: this.eventBatch.length,
      isProcessing: this.isProcessing,
    };

    // Build executions object for easier display
    for (const [prNumber, actionsMap] of this.executionTimes) {
      state.executions[`PR #${prNumber}`] = {};

      for (const [actionType, timestamp] of actionsMap) {
        const interval = this._getInterval(actionType);
        const elapsed = (Date.now() - timestamp) / 1000;
        const remaining = Math.max(0, interval - elapsed);

        state.executions[`PR #${prNumber}`][actionType] = {
          lastExecution: new Date(timestamp).toISOString(),
          interval: interval,
          elapsedSeconds: elapsed.toFixed(1),
          remainingSeconds: remaining.toFixed(1),
          canExecute: remaining === 0,
        };
      }
    }

    return state;
  }

  /**
   * Reset rate limit for a specific PR and action type (useful for testing)
   */
  reset(prNumber, actionType) {
    if (!this.executionTimes.has(prNumber)) {
      return;
    }

    const prData = this.executionTimes.get(prNumber);
    prData.delete(actionType);

    if (prData.size === 0) {
      this.executionTimes.delete(prNumber);
    }
  }

  /**
   * Reset all rate limits (useful for testing)
   */
  resetAll() {
    this.executionTimes.clear();
    this.eventBatch = [];
  }
}

export { RateLimiter };
