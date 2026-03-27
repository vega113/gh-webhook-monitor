import { execSync } from "node:child_process";
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
    this.repoSyncTimes = new Map();
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
      openedAt: null,
      lastObservedAt: null,
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
        openedAt: null,
        lastObservedAt: null,
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
      state.headBranch = pr.head?.ref || state.headBranch || null;
      state.lastObservedAt = new Date().toISOString();
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
      state.lastObservedAt = new Date().toISOString();
    }

    if (webhookData.type === "check_suite") {
      const suite = webhookData.checkSuite;
      state.checkStatus = suite.conclusion || "pending";
      state.checks = webhookData.checks || [];
      state.lastObservedAt = new Date().toISOString();
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
    this.repoSyncTimes.clear();
  }

  syncOpenPRsFromGitHub(repo, runner = null) {
    const run =
      runner ||
      ((command) =>
        execSync(command, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }));

    const raw = run(
      `gh pr list --repo ${repo} --state open --json number,title,isDraft,mergeStateStatus,reviewDecision,baseRefName,statusCheckRollup,createdAt,latestReviews`
    );
    const prs = JSON.parse(raw);
    const seen = new Set();

    for (const pr of prs) {
      const cacheKey = `${repo}#${pr.number}`;
      seen.add(cacheKey);
      const existing = this.cache.get(cacheKey)?.state || {
        prNumber: pr.number,
        repo,
        reviews: [],
        checks: [],
        comments: 0,
        threads: [],
      };

      const next = {
        ...existing,
        prNumber: pr.number,
        repo,
        title: pr.title,
        openedAt: pr.createdAt || existing.openedAt || null,
        isDraft: pr.isDraft,
        base: pr.baseRefName,
        headBranch: pr.headRefName || existing.headBranch || null,
        mergeable: this.mapMergeStateStatus(pr.mergeStateStatus),
        reviewState: this.mapReviewDecision(pr.reviewDecision),
        checkStatus: this.mapStatusCheckRollup(pr.statusCheckRollup),
        checks: pr.statusCheckRollup || [],
        latestReviews: pr.latestReviews || [],
        lastObservedAt: new Date().toISOString(),
      };

      this.cache.set(cacheKey, {
        state: next,
        expiresAt: Date.now() + this.cacheTTLSeconds * 1000,
      });
    }

    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${repo}#`) && !seen.has(key)) {
        this.cache.delete(key);
      }
    }

    this.repoSyncTimes.set(repo, Date.now());
    return prs.length;
  }

  ensureRepoSynced(repo, syncTTLSeconds = 60, runner = null) {
    const last = this.repoSyncTimes.get(repo);
    if (last && Date.now() - last < syncTTLSeconds * 1000) {
      return 0;
    }
    return this.syncOpenPRsFromGitHub(repo, runner);
  }

  mapMergeStateStatus(mergeStateStatus) {
    if (mergeStateStatus === "DIRTY") return false;
    if (["CLEAN", "HAS_HOOKS", "UNSTABLE", "BLOCKED"].includes(mergeStateStatus)) {
      return true;
    }
    return null;
  }

  mapReviewDecision(reviewDecision) {
    if (reviewDecision === "APPROVED") return "approved";
    if (reviewDecision === "CHANGES_REQUESTED") return "changes_requested";
    return "pending";
  }

  mapStatusCheckRollup(statusCheckRollup = []) {
    if (!statusCheckRollup.length) return "pending";

    const hasFailure = statusCheckRollup.some((check) => {
      return check.conclusion === "FAILURE" || check.state === "FAILURE";
    });
    if (hasFailure) return "failure";

    const hasPending = statusCheckRollup.some((check) => {
      return check.status === "IN_PROGRESS" || check.status === "QUEUED" || check.state === "PENDING";
    });
    if (hasPending) return "pending";

    const hasSuccess = statusCheckRollup.some((check) => {
      return check.conclusion === "SUCCESS" || check.state === "SUCCESS";
    });
    if (hasSuccess) return "success";

    return "pending";
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

  getLastObservedTime(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    return this.cache.get(cacheKey)?.state?.lastObservedAt || null;
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
          lastUpdated: this.getLastObservedTime(repo, state.prNumber),
          base: state.base,
        });
      }
    }
    return openPRs;
  }

  /**
   * Track review threads for a PR (from webhook data)
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @param {Array<Object>} threads - Array of thread objects with id, isResolved, authorLogin
   */
  updateThreads(repo, prNumber, threads = []) {
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
        threads: [],
      };
    }

    state.threads = threads || [];

    // Update cache
    this.cache.set(cacheKey, {
      state,
      expiresAt: Date.now() + this.cacheTTLSeconds * 1000,
    });

    return state;
  }

  /**
   * Get unresolved threads from a specific bot on a PR
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @param {string} botLogin - Bot login name to filter by
   * @returns {Array<Object>} Array of unresolved threads from the bot
   */
  getUnresolvedThreadsFromBot(repo, prNumber, botLogin) {
    const cacheKey = `${repo}#${prNumber}`;
    const state = this.cache.get(cacheKey)?.state;

    if (!state || !state.threads) return [];

    return state.threads.filter(
      (thread) =>
        !thread.isResolved &&
        thread.authorLogin &&
        thread.authorLogin.toLowerCase().includes(botLogin.toLowerCase())
    );
  }

  /**
   * Check if a thread is from a specific bot
   * @param {Object} thread - Thread object with authorLogin property
   * @param {string} botLogin - Bot login name
   * @returns {boolean} True if thread is from the bot
   */
  isThreadFromBot(thread, botLogin) {
    if (!thread || !thread.authorLogin) return false;
    return thread.authorLogin.toLowerCase().includes(botLogin.toLowerCase());
  }

  /**
   * Get PR mergeable state with caching and conflict detection
   * Updates cache with mergeable status from webhook data when available
   * Returns mergeable state: null (unknown), false (conflict), true (mergeable)
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Promise<string|null>} "mergeable", "conflict", or null if unknown
   */
  async getPRMergeableState(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.state) {
      // Convert mergeable boolean to state string
      if (cached.state.mergeable === false) {
        return "conflict";
      } else if (cached.state.mergeable === true) {
        return "mergeable";
      }
    }

    // If unknown, return null (would need real API call in production)
    return null;
  }

  /**
   * Get all PRs with merge conflicts from cache
   * @param {string} repo - Repository in format owner/repo
   * @returns {Array<Object>} Array of PR objects with conflict state
   */
  getPRsWithConflicts(repo) {
    const conflictPRs = [];
    for (const [key, cached] of this.cache.entries()) {
      if (!key.startsWith(`${repo}#`)) continue;

      const state = cached.state;
      if (state && state.mergeable === false) {
        conflictPRs.push({
          prNumber: state.prNumber,
          repo: state.repo,
          title: state.title || "Unknown",
          base: state.base,
          mergeable: state.mergeable,
        });
      }
    }
    return conflictPRs;
  }

  /**
   * Track a PR that has been detected as having merge conflicts
   * Used to avoid duplicate conflict resolution attempts
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Object} Conflict tracking info
   */
  recordConflictDetection(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const now = Date.now();
    const key = `conflict_${cacheKey}`;
    this.prUpdateTimes.set(key, now);
    return { prNumber, repo, timestamp: new Date(now).toISOString() };
  }

  /**
   * Check if a PR's conflict was recently processed (within cooldown)
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @param {number} cooldownMs - Cooldown period in milliseconds (default: 300000 = 5 minutes)
   * @returns {boolean} True if conflict was processed recently
   */
  wasConflictRecentlyProcessed(repo, prNumber, cooldownMs = 300000) {
    const cacheKey = `${repo}#${prNumber}`;
    const key = `conflict_${cacheKey}`;
    const lastUpdate = this.prUpdateTimes.get(key);
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate < cooldownMs;
  }

  /**
   * Determine CI status from PR state
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {string} "passing", "pending", "failed", or null
   */
  determineCIStatus(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.cache.get(cacheKey);
    if (!cached || !cached.state) return null;

    const checkStatus = cached.state.checkStatus || "pending";
    if (checkStatus === "success") return "passing";
    if (checkStatus === "failure") return "failed";
    if (checkStatus === "neutral") return "neutral";
    return "pending";
  }

  /**
   * Determine review state from PR state
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {string} "approved", "changes_requested", "pending", or null
   */
  determineReviewState(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.cache.get(cacheKey);
    if (!cached || !cached.state) return null;

    const reviewState = cached.state.reviewState || "pending";
    if (reviewState === "approved") return "approved";
    if (reviewState === "changes_requested") return "changes_requested";
    if (reviewState === "commented") return "pending";
    return "pending";
  }

  /**
   * Determine blockers preventing merge
   * @param {string} repo - Repository in format owner/repo
   * @param {number} prNumber - PR number
   * @returns {Array<Object>} Array of blocker objects with type, message, severity
   */
  determineBlockers(repo, prNumber) {
    const cacheKey = `${repo}#${prNumber}`;
    const cached = this.cache.get(cacheKey);
    if (!cached || !cached.state) return [];

    const state = cached.state;
    const blockers = [];

    // Check draft status
    if (state.isDraft) {
      blockers.push({
        type: "draft",
        message: "PR is a draft",
        severity: "warning",
      });
    }

    // Check mergeable state
    if (state.mergeable === false) {
      blockers.push({
        type: "conflict",
        message: "Merge conflicts detected",
        severity: "error",
      });
    }

    // Check CI status
    const checkStatus = state.checkStatus || "pending";
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
    const reviewState = state.reviewState || "pending";
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
    const unresolvedCount = (state.threads || []).filter(
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
   * Get all open PRs cached for a repo
   * Returns PRs regardless of base branch (unlike listOpenPRs)
   * @param {string} repo - Repository in format owner/repo
   * @returns {Array<Object>} Array of PR state objects
   */
  getAllOpenPRs(repo) {
    const prs = [];
    for (const [key, cached] of this.cache.entries()) {
      if (!key.startsWith(`${repo}#`)) continue;

      const state = cached.state;
      if (state && state.prNumber) {
        prs.push(state);
      }
    }
    return prs;
  }
}

export { PRStateCache };
