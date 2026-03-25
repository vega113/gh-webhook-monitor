import { execSync } from "node:child_process";
import { logEvent } from "../logger.js";
import { getConfig } from "../config.js";
import { getRateLimiter } from "../rateLimiterInstance.js";

/**
 * Re-run a gate check using GitHub API
 * Uses `gh api` to POST to check-runs/{id}/rerequest
 */
async function rerunGate(repo, prNumber, completedCheckRun) {
  const config = getConfig();
  const gateCheckNames = config.settings.gateCheckNames || ["Codex Review Gate"];

  // Only re-run if this is a non-gate check that passed
  if (gateCheckNames.includes(completedCheckRun.name)) {
    // This is a gate check itself, not a trigger
    return;
  }

  if (completedCheckRun.conclusion !== "success") {
    // Only re-run gate when non-gate checks pass
    return;
  }

  try {
    // Fetch all checks for this PR to determine if we should re-run gate
    const checksJson = execSync(
      `gh api repos/${repo}/commits/${completedCheckRun.head_sha}/check-runs --jq '.check_runs'`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const allChecks = JSON.parse(checksJson);

    // Separate gate and non-gate checks
    const gateChecks = allChecks.filter((check) =>
      gateCheckNames.includes(check.name)
    );
    const nonGateChecks = allChecks.filter(
      (check) => !gateCheckNames.includes(check.name)
    );

    // Check if all non-gate checks have passed
    const allNonGateChecksPassed = nonGateChecks.every(
      (check) => check.conclusion === "success" || check.conclusion === "skipped"
    );

    if (!allNonGateChecksPassed) {
      logEvent(
        "GATE_RERUN",
        "skip",
        repo,
        `PR #${prNumber}: Not all non-gate checks passed`
      );
      return;
    }

    // Find gate check that is queued or pending
    const gateToRerun = gateChecks.find(
      (check) =>
        check.status !== "completed" ||
        check.conclusion === "neutral" ||
        check.conclusion === null
    );

    if (!gateToRerun) {
      logEvent(
        "GATE_RERUN",
        "skip",
        repo,
        `PR #${prNumber}: No gate check found in queued/pending state`
      );
      return;
    }

    // Check rate limit: don't re-run same gate more than once per 2 minutes
    const rateLimiter = getRateLimiter();
    const rateLimitKey = `gate-rerun-${repo}-${prNumber}-${gateToRerun.id}`;
    const canRerun = await rateLimiter.checkLimit(rateLimitKey, 1, 120); // 120 seconds = 2 minutes

    if (!canRerun) {
      logEvent(
        "GATE_RERUN",
        "rate-limited",
        repo,
        `PR #${prNumber}: Gate ${gateToRerun.name} rate limited`
      );
      return;
    }

    // Re-run the gate check
    logEvent(
      "GATE_RERUN",
      "attempt",
      repo,
      `PR #${prNumber}: Re-running ${gateToRerun.name} (${gateToRerun.id})`
    );

    execSync(
      `gh api repos/${repo}/check-runs/${gateToRerun.id}/rerequest --method POST`,
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    logEvent(
      "GATE_RERUN",
      "success",
      repo,
      `PR #${prNumber}: Successfully re-ran ${gateToRerun.name}`
    );
  } catch (err) {
    logEvent(
      "GATE_RERUN",
      "error",
      repo,
      `PR #${prNumber}: ${err.message.slice(0, 100)}`
    );
  }
}

export { rerunGate };
