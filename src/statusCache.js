import { logEvent } from "./logger.js";

/**
 * StatusCache: High-level status API cache for open PRs
 * Aggregates PR state data with TTL-based caching
 */
class StatusCache {
  constructor(prStateCache, cacheTTLSeconds = 30) {
    this.prStateCache = prStateCache;
    this.cacheTTLSeconds = cacheTTLSeconds;
    this.statusCache = new Map(); // key: "owner/repo#prNumber"
  }

  /**
   * Get aggregated status for a specific PR
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Object} Status object or null if not found
   */
  async get(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.statusCache.get(cacheKey);

    // Return cached if still valid
    if (cached && Date.now() < cached.expiresAt) {
      return cached.status;
    }

    // Build fresh status from PR state cache
    const status = await this.buildStatus(repo, prNumber);
    if (status) {
      this.statusCache.set(cacheKey, {
        status,
        expiresAt: Date.now() + this.cacheTTLSeconds * 1000,
      });
    }

    return status;
  }

  /**
   * Get all cached statuses for a repo
   * @param {string} repo - Repository in format owner/repo
   * @returns {Array<Object>} Array of status objects
   */
  getAll(repo = null) {
    const statuses = [];

    for (const [key, cached] of this.statusCache.entries()) {
      if (repo && !key.startsWith(`${repo}#`)) continue;
      if (Date.now() < cached.expiresAt) {
        statuses.push(cached.status);
      }
    }

    return statuses;
  }

  /**
   * Get all valid (non-expired) cached statuses across all repos
   * @returns {Array<Object>} Array of all valid status objects
   */
  getAllValid() {
    return this.getAll();
  }

  /**
   * Build aggregated status from PR state
   * @private
   */
  async buildStatus(repo, prNumber) {
    const prState = await this.prStateCache.get(repo, prNumber);
    if (!prState) return null;

    const status = {
      prNumber,
      repo,
      title: prState.title || "Unknown",
      branch: prState.base || "unknown",
      mergeable: prState.mergeable, // true, false, or null
      ciStatus: this.determineCIStatus(prState),
      checks: prState.checks || [],
      reviewState: this.determineReviewState(prState),
      unresolvedThreads: (prState.threads || []).filter((t) => !t.isResolved)
        .length,
      blockers: this.determineBlockers(prState),
      lastUpdated: this.prStateCache.getLastObservedTime(repo, prNumber),
      openedAt: prState.openedAt || null,
      isDraft: prState.isDraft || false,
    };

    return status;
  }

  /**
   * Determine CI status from check state
   * @private
   */
  determineCIStatus(prState) {
    const checkStatus = prState.checkStatus || "pending";

    if (checkStatus === "success") return "passing";
    if (checkStatus === "failure") return "failed";
    if (checkStatus === "neutral") return "neutral";

    return "pending";
  }

  /**
   * Determine review state
   * @private
   */
  determineReviewState(prState) {
    const reviewState = prState.reviewState || "pending";

    if (reviewState === "approved") return "approved";
    if (reviewState === "changes_requested") return "changes_requested";
    if (reviewState === "commented") return "pending";

    return "pending";
  }

  /**
   * Determine blockers preventing merge
   * @private
   */
  determineBlockers(prState) {
    const blockers = [];

    // Check draft status
    if (prState.isDraft) {
      blockers.push({
        type: "draft",
        message: "PR is a draft",
        severity: "warning",
      });
    }

    // Check mergeable state
    if (prState.mergeable === false) {
      blockers.push({
        type: "conflict",
        message: "Merge conflicts detected",
        severity: "error",
      });
    }

    // Check CI status
    const checkStatus = prState.checkStatus || "pending";
    if (checkStatus === "failure") {
      blockers.push({
        type: "ci",
        message: "CI checks failed",
        severity: "error",
      });
    } else if (checkStatus === "pending") {
      blockers.push({
        type: "ci",
        message: "CI checks pending",
        severity: "info",
      });
    }

    // Check review state
    const reviewState = prState.reviewState || "pending";
    if (reviewState === "changes_requested") {
      blockers.push({
        type: "review",
        message: "Changes requested by reviewer",
        severity: "error",
      });
    } else if (reviewState === "pending") {
      blockers.push({
        type: "review",
        message: "Pending review",
        severity: "info",
      });
    }

    // Check unresolved threads
    const unresolvedCount = (prState.threads || []).filter(
      (t) => !t.isResolved
    ).length;
    if (unresolvedCount > 0) {
      blockers.push({
        type: "threads",
        message: `${unresolvedCount} unresolved thread${unresolvedCount === 1 ? "" : "s"}`,
        severity: "warning",
      });
    }

    return blockers;
  }

  /**
   * Clear cache (useful for testing)
   */
  clear() {
    this.statusCache.clear();
  }

  /**
   * Force refresh a specific PR status
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   */
  async refresh(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    this.statusCache.delete(cacheKey);
    return await this.get(repo, prNumber);
  }

  /**
   * Manually update a PR status with webhook data
   * Delegates to underlying prStateCache
   */
  updateFromWebhook(repo, prNumber, webhookData) {
    const cacheKey = `${repo}#${prNumber}`;
    // Invalidate our cache so it rebuilds from updated prState
    this.statusCache.delete(cacheKey);
    // Update the underlying pr state cache
    return this.prStateCache.updateFromWebhook(repo, prNumber, webhookData);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedStatuses: this.statusCache.size,
      entries: Array.from(this.statusCache.entries()).map(([key, val]) => ({
        key,
        expiresIn: Math.max(0, Math.floor((val.expiresAt - Date.now()) / 1000)),
      })),
    };
  }
}

export { StatusCache };
