import { getConfig, getRepoPath } from "../config.js";
import { renderPrompt } from "../prompts.js";
import { spawnAgent } from "../actions/spawnAgent.js";

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

  const prompt = renderPrompt("check_suite", {
    branch: suite.head_branch,
    sha: suite.head_sha.slice(0, 8),
    repo,
  });

  spawnAgent(
    repoPath,
    prompt,
    `ci-fail-${repo}-${suite.head_sha.slice(0, 8)}`,
    repo
  );
}

export { handleCheckSuite };
