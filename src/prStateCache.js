import { logEvent } from "./logger.js";

/**
 * PRStateCache: Fetch and cache PR state from GitHub
 * Uses TTL-based caching to avoid excessive API rate limiting
 */
class PRStateCache {
  constructor(ghClient, cacheTTLSeconds = 300) {
    this.ghClient = ghClient;
    this.cacheTTLSeconds = cacheTTLSeconds;
    this.cache = new Map(); // key: "owner/repo#prNumber"
    this.prUpdateTimes = new Map(); // key: "owner/repo#prNumber", tracks last update attempt time
  }

  /**
   * Get PR state with caching
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR state object or null if not found
   */
  async get(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.cache.get(cacheKey);

    // Return cached if still valid
    if (cached && Date.now() < cached.expiresAt) {
      return cached.state;
    }

    try {
      const prState = await this.fetchPRState(repo, prNumber);
      // Cache the result
      this.cache.set(cacheKey, {
        state: prState,
        expiresAt: Date.now() + this.cacheTTLSeconds * 1000,
      });
      return prState;
    } catch (err) {
      logEvent("ERROR", "fetch-pr-state", repo, `PR #${prNumber}: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetch PR state from GitHub API
   * Note: In production, would use actual GitHub API calls (gh cli or octokit)
   * For now, returns a stub that can be populated by webhook data
   */
  async fetchPRState(repo, prNumber) {
    // In a real implementation, this would call the GitHub API
    // For now, we return a structure that the dispatcher expects
    // Actual state would be populated from webhook events

    return {
      prNumber,
      repo,
      mergeable: null, // null = unknown
      isDraft: false,
      base: null, // base branch name
      checkStatus: "pending", // pending, success, failure, neutral
      reviewState: "pending", // pending, approved, changes_requested, commented
      reviews: [],
      checks: [],
      comments: 0,
    };
  }

  /**
   * Update PR state with webhook data (for real-time updates without API calls)
   */
  updateFromWebhook(repo, prNumber, webhookData) {
    const cacheKey = `${repo}#${prNumber}`;
    let state = this.cache.get(cacheKey)?.state;

    if (!state) {
      state = {
        prNumber,
        repo,
        mergeable: null,
        isDraft: false,
        checkStatus: "pending",
        reviewState: "pending",
        reviews: [],
        checks: [],
        comments: 0,
      };
    }

    // Update based on webhook event type
    if (webhookData.type === "pull_request") {
      const pr = webhookData.pullRequest;
      state.mergeable = pr.mergeable;
      state.isDraft = pr.draft;
      state.title = pr.title;
      state.body = pr.body;
      state.base = pr.base?.ref; // Track base branch
    }

    if (webhookData.type === "pull_request_review") {
      const review = webhookData.review;
      state.reviewState = review.state;
      // Update reviews array
      const existingIndex = state.reviews.findIndex(
        (r) => r.id === review.id
      );
      if (existingIndex >= 0) {
        state.reviews[existingIndex] = review;
      } else {
        state.reviews.push(review);
      }
    }

    if (webhookData.type === "check_suite") {
      const suite = webhookData.checkSuite;
      state.checkStatus = suite.conclusion || "pending";
      state.checks = webhookData.checks || [];
    }

    // Update cache expiration to now (fresh)
    this.cache.set(cacheKey, {
      state,
      expiresAt: Date.now() + this.cacheTTLSeconds * 1000,
    });

    return state;
  }

  /**
   * Clear cache (useful for testing)
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedEntries: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, val]) => ({
        key,
        expiresIn: Math.max(0, Math.floor((val.expiresAt - Date.now()) / 1000)),
      })),
    };
  }

  /**
   * Record the last update attempt time for a PR
   * Prevents duplicate updates within a short window
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Object} Update time info
   */
  recordPRUpdateAttempt(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const now = Date.now();
    this.prUpdateTimes.set(cacheKey, now);
    return { prNumber, repo, timestamp: new Date(now).toISOString() };
  }

  /**
   * Check if a PR was recently updated (within cooldown period)
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @param {number} cooldownMs - Cooldown period in milliseconds (default: 60000 = 1 minute)
   * @returns {boolean} True if PR was updated recently
   */
  wasRecentlyUpdated(repo, prNumber, cooldownMs = 60000) {
    const cacheKey = `${repo}#${prNumber}`;
    const lastUpdate = this.prUpdateTimes.get(cacheKey);
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate < cooldownMs;
  }

  /**
   * Get last update time for a PR
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {string|null} ISO timestamp of last update, or null if never updated
   */
  getLastUpdateTime(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const timestamp = this.prUpdateTimes.get(cacheKey);
    return timestamp ? new Date(timestamp).toISOString() : null;
  }

  /**
   * List all cached open PRs for a repo with optional base branch filter
   * @param {string} repo - Repository in format owner/repo
   * @param {string} baseBranch - Optional base branch to filter by
   * @returns {Array<Object>} Array of PR objects
   */
  listOpenPRs(repo, baseBranch = null) {
    const openPRs = [];
    for (const [key, cached] of this.cache.entries()) {
      // Check if this is a PR for the specified repo
      if (!key.startsWith(`${repo}#`)) continue;

      const state = cached.state;
      // Filter for open PRs (not merged, not closed)
      if (state && state.prNumber && state.base === baseBranch) {
        openPRs.push({
          prNumber: state.prNumber,
          title: state.title || "Unknown",
          lastUpdated: this.getLastUpdateTime(repo, state.prNumber),
          base: state.base,
        });
      }
    }
    return openPRs;
  }
}

export { PRStateCache };
