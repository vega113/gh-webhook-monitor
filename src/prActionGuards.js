import { isPRPaused } from "./prControlState.js";
import { logEvent } from "./logger.js";

function skipIfPRPaused(repo, prNumber, actionLabel, store) {
  if (!repo || !Number.isInteger(prNumber)) return false;
  if (!isPRPaused(repo, prNumber, store)) return false;

  logEvent("SKIP", "paused-pr", repo, `PR #${prNumber}: ${actionLabel}`);
  return true;
}

export { skipIfPRPaused };
