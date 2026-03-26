import { execFileSync } from "node:child_process";
import { buildPostMergeGateCommand } from "../postMergeGate.js";
import { logEvent } from "../logger.js";

function triggerPostMergeGate(repo, settings, pr) {
  const mergeCommitSha = pr.merge_commit_sha || pr.head?.sha || "";
  const { command, args } = buildPostMergeGateCommand(repo, settings, {
    number: pr.number,
    mergeCommitSha,
  });

  try {
    execFileSync(command, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    logEvent(
      "POST_MERGE_GATE",
      "triggered",
      repo,
      `PR #${pr.number}: triggered ${settings.workflowFile} for ${mergeCommitSha.slice(0, 8)}`
    );
    return { success: true, mergeCommitSha };
  } catch (error) {
    const message = error.stderr?.toString() || error.message || "unknown error";
    logEvent(
      "POST_MERGE_GATE",
      "trigger-error",
      repo,
      `PR #${pr.number}: ${message.slice(0, 160)}`
    );
    return { success: false, mergeCommitSha, message };
  }
}

export { triggerPostMergeGate };
