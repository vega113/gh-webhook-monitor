import { logEvent } from "./logger.js";

/**
 * Action types enum
 */
const ActionType = {
  UPDATE_BRANCH: "UPDATE_BRANCH",
  RERUN_GATE: "RERUN_GATE",
  RESOLVE_THREADS: "RESOLVE_THREADS",
  MERGE_PR: "MERGE_PR",
  SPAWN_AGENT: "SPAWN_AGENT",
  RESOLVE_CONFLICT: "RESOLVE_CONFLICT",
  NOOP: "NOOP",
};

/**
 * ActionDispatcher: Centralized decision engine for webhook events
 * Receives webhook events and decides what actions to take based on PR state
 */
class ActionDispatcher {
  constructor(prStateCache, config) {
    this.prStateCache = prStateCache;
    this.config = config;
    this.decisionHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Main entry point: receive a webhook event and return array of actions
   * @param {Object} event - GitHub webhook event
   * @returns {Promise<Array<string>>} Array of action type strings
   */
  async receive(event) {
    const eventType = event.type;
    const payload = event.payload;
    const repo = payload.repository?.full_name || "unknown";

    try {
      // Parse webhook to extract PR info
      const prInfo = this.extractPRInfo(eventType, payload);
      if (!prInfo) {
        return [ActionType.NOOP];
      }

      // Fetch PR state
      let prState = null;
      if (this.prStateCache && prInfo.prNumber) {
        prState = await this.prStateCache.get(repo, prInfo.prNumber);
      }

      // Decide actions
      const actions = await this.decidActions(eventType, payload, prState, prInfo);

      // Log decision
      this.recordDecision(repo, prInfo.prNumber || prInfo.branch || "unknown", {
        event: eventType,
        action: payload.action,
        actions,
        prState: prState ? this.summarizePRState(prState) : null,
      });

      return actions;
    } catch (err) {
      logEvent("ERROR", "dispatch-error", repo, err.message);
      return [ActionType.NOOP];
    }
  }

  /**
   * Extract PR info from webhook payload
   */
  extractPRInfo(eventType, payload) {
    let prNumber, branch, prTitle;

    switch (eventType) {
      case "pull_request":
        prNumber = payload.pull_request?.number;
        branch = payload.pull_request?.base?.ref;
        prTitle = payload.pull_request?.title;
        break;
      case "pull_request_review":
        prNumber = payload.pull_request?.number;
        branch = payload.pull_request?.base?.ref;
        prTitle = payload.pull_request?.title;
        break;
      case "check_suite":
        // check_suite events may not have PR, use branch
        branch = payload.check_suite?.head_branch;
        break;
      case "check_run":
        // check_run events contain PR info in pull_requests array
        if (payload.check_run?.pull_requests?.length > 0) {
          prNumber = payload.check_run.pull_requests[0].number;
        }
        break;
      case "issue_comment":
        prNumber = payload.issue?.number;
        prTitle = payload.issue?.title;
        break;
      default:
        return null;
    }

    return { prNumber, branch, prTitle };
  }

  /**
   * Core decision logic: determine what actions to take
   * @param {string} eventType - GitHub event type
   * @param {Object} payload - Event payload
   * @param {Object} prState - PR state from cache (can be null)
   * @param {Object} prInfo - Extracted PR info
   * @returns {Promise<Array<string>>} Array of action types
   */
  async decidActions(eventType, payload, prState, prInfo) {
    const action = payload.action;

    // pull_request: synchronize (new push) → wait for CI, don't spawn agent
    if (eventType === "pull_request" && action === "synchronize") {
      return [ActionType.NOOP];
    }

    // pull_request: opened → wait for CI
    if (eventType === "pull_request" && action === "opened") {
      return [ActionType.NOOP];
    }

    // pull_request: closed with merged=true → notify other PRs on same base
    if (eventType === "pull_request" && action === "closed") {
      if (payload.pull_request?.merged) {
        return [ActionType.UPDATE_BRANCH];
      }
      return [ActionType.NOOP];
    }

    // check_suite: completed with failure → spawn agent
    if (eventType === "check_suite" && action === "completed") {
      const suite = payload.check_suite;
      if (suite?.conclusion === "failure") {
        // Only spawn agent for failures on monitored branches
        return [ActionType.SPAWN_AGENT];
      }
      return [ActionType.NOOP];
    }

    // pull_request_review: changes_requested → spawn agent
    if (eventType === "pull_request_review" && action === "submitted") {
      const review = payload.review;
      if (review?.state === "changes_requested") {
        return [ActionType.SPAWN_AGENT];
      }
      // approved: check for other blockers
      if (review?.state === "approved") {
        if (prState) {
          const blockers = this.findBlockers(prState);
          if (blockers.length > 0) {
            return [ActionType.SPAWN_AGENT];
          }
        }
        return [ActionType.NOOP];
      }
      return [ActionType.NOOP];
    }

    // check_run: completed → potentially rerun gate
    if (eventType === "check_run" && action === "completed") {
      const checkRun = payload.check_run;
      // Handler will evaluate if gate should be re-run
      // Dispatcher just records the decision
      return [ActionType.RERUN_GATE];
    }

    // issue_comment: mention/command → spawn agent
    if (eventType === "issue_comment" && action === "created") {
      const comment = payload.comment;
      const triggerKeywords = this.config?.settings?.triggerKeywords || [
        "@claude",
        "please fix",
      ];
      const commentBody = comment?.body || "";
      const hasKeyword = triggerKeywords.some((kw) =>
        commentBody.toLowerCase().includes(kw.toLowerCase())
      );
      if (hasKeyword) {
        return [ActionType.SPAWN_AGENT];
      }
      return [ActionType.NOOP];
    }

    // Default: no action
    return [ActionType.NOOP];
  }

  /**
   * Find blockers for a PR (failing checks, unresolved reviews, conflicts)
   */
  findBlockers(prState) {
    const blockers = [];

    if (!prState) return blockers;

    // Check if CI is failing
    if (prState.checkStatus === "failure") {
      blockers.push("ci-failure");
    }

    // Check if there are unresolved review comments
    if (prState.reviewState === "changes_requested") {
      blockers.push("changes-requested");
    }

    // Check for merge conflicts
    if (prState.mergeable === false) {
      blockers.push("merge-conflict");
    }

    return blockers;
  }

  /**
   * Record decision to history for debugging/audit trail
   */
  recordDecision(repo, prRef, decision) {
    const record = {
      timestamp: new Date().toISOString(),
      repo,
      prRef,
      ...decision,
    };
    this.decisionHistory.unshift(record);
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.pop();
    }
  }

  /**
   * Get decision history for a PR
   */
  getDecisionHistory(repo, prNumber) {
    return this.decisionHistory.filter(
      (d) => d.repo === repo && d.prRef === prNumber
    );
  }

  /**
   * Get recent decisions across all PRs
   */
  getRecentDecisions(limit = 50) {
    return this.decisionHistory.slice(0, limit);
  }

  /**
   * Summarize PR state for logging
   */
  summarizePRState(prState) {
    return {
      mergeable: prState.mergeable,
      checkStatus: prState.checkStatus,
      reviewState: prState.reviewState,
      isDraft: prState.isDraft,
    };
  }
}

export { ActionDispatcher, ActionType };
