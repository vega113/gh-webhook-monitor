import { getConfig, getRepoPath } from "../config.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { isAwaitingPostMergeGateForSha } from "../postMergeGateState.js";

function handleCheckSuite(payload) {
  const config = getConfig();
  if (!config.settings.enabledEvents.check_suite) return;

  const suite = payload.check_suite;
  const repo = payload.repository.full_name;
  const repoPath = getRepoPath(repo);

  if (!repoPath) return;
  if (
    suite.conclusion !== "failure" ||
    suite.head_branch !== payload.repository.default_branch
  )
    return;

  if (isAwaitingPostMergeGateForSha(repo, suite.head_branch, suite.head_sha)) {
    return;
  }

  const prompt = renderPrompt("check_suite", {
    branch: suite.head_branch,
    sha: suite.head_sha.slice(0, 8),
    repo,
  });

  spawnAgent(
    repoPath,
    prompt,
    `ci-fail-${repo}-${suite.head_sha.slice(0, 8)}`,
    repo,
    {
      eventType: "check_suite",
      inspectionOnly: true,
      branch: suite.head_branch,
    }
  );
}

export { handleCheckSuite };
