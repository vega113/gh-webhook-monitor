import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { rerunGate } from "../actions/rerunGate.js";
import { isPostMergeGateCheckRun } from "../postMergeGate.js";
import { recordPostMergeGateResult } from "../postMergeGateState.js";

/**
 * Handle check_run webhook events
 * Integrates with dispatcher to decide if gate re-run is needed
 */
function handleCheckRun(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.check_run) return;

  const checkRun = payload.check_run;
  const repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo);

  if (!repoPath) return;

  // Only process completed check_run events
  if (payload.action !== "completed") return;

  const checkName = checkRun.name;
  const conclusion = checkRun.conclusion;
  const prNumbers = checkRun.pull_requests?.map((pr) => pr.number) || [];

  logEvent(
    "CHECK_RUN",
    payload.action,
    repo,
    `${checkName} (${conclusion}) - PRs: ${prNumbers.join(",")}`
  );

  if (
    isPostMergeGateCheckRun(config, {
      repo,
      branch: checkRun.check_suite?.head_branch || checkRun.head_branch || payload.repository.default_branch,
      name: checkName,
    })
  ) {
    recordPostMergeGateResult(repo, {
      branch: checkRun.check_suite?.head_branch || checkRun.head_branch || payload.repository.default_branch,
      sha: checkRun.head_sha,
      conclusion,
      checkName,
    });
    logEvent(
      "POST_MERGE_GATE",
      conclusion || "completed",
      repo,
      `${checkName} on ${String(checkRun.head_sha || "").slice(0, 8)}`
    );
    return;
  }

  // Process for each associated PR
  if (prNumbers.length > 0) {
    for (const prNumber of prNumbers) {
      // Attempt to re-run gate if conditions are met
      rerunGate(repo, prNumber, checkRun);
    }
  }
}

export { handleCheckRun };
