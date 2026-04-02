import { getConfig, getRepoPath } from "../config.js";
import { logEvent } from "../logger.js";
import { spawnAgent } from "../actions/spawnAgent.js";
import { skipIfPRPaused } from "../prActionGuards.js";

/**
 * Handle PR merge conflict detection
 * Called when a PR has mergeable: false (merge conflicts)
 * Spawns an agent to resolve conflicts automatically
 */
function handlePullRequestConflict(payload, prStateCache) {
  const config = getConfig();
  if (!config.settings.enabledEvents.pull_request) return;

  const pr = payload.pull_request;
  const repo = payload.repository.full_name;
  const prNumber = pr?.number;

  if (!getRepoPath(repo)) return;

  if (!prNumber) {
    logEvent(
      "CONFLICT",
      "invalid",
      repo,
      "Missing PR number in conflict payload"
    );
    return;
  }

  if (skipIfPRPaused(repo, prNumber, "paused conflict resolution")) {
    return;
  }

  // Check if we've already processed this conflict recently (5 minute cooldown)
  if (prStateCache && prStateCache.wasConflictRecentlyProcessed(repo, prNumber)) {
    logEvent(
      "CONFLICT",
      "skip-recent",
      repo,
      `PR #${prNumber}: Already processing conflict (cooldown active)`
    );
    return;
  }

  // Record conflict detection
  if (prStateCache) {
    prStateCache.recordConflictDetection(repo, prNumber);
  }

  // Spawn agent to resolve conflict
  const jobKey = `${repo}#${prNumber}-conflict`;
  const prompt = buildMergeConflictPrompt(config, repo, prNumber, pr);

  logEvent(
    "CONFLICT",
    "detected",
    repo,
    `PR #${prNumber}: "${pr.title}" has merge conflicts`
  );

  const repoPath = getRepoPath(repo);
  spawnAgent(repoPath, prompt, jobKey, repo, {
    eventType: "merge_conflict",
  });
}

/**
 * Build the merge conflict resolution prompt from template
 */
function buildMergeConflictPrompt(config, repo, prNumber, pr) {
  const template = config.promptTemplates?.merge_conflict;

  if (!template) {
    return defaultMergeConflictPrompt(repo, prNumber, pr);
  }

  // Interpolate variables in template
  return template
    .replace(/\{\{prNumber\}\}/g, prNumber)
    .replace(/\{\{prTitle\}\}/g, pr.title || "Unknown")
    .replace(/\{\{repo\}\}/g, repo)
    .replace(/\{\{baseBranch\}\}/g, pr.base?.ref || "main")
    .replace(/\{\{headBranch\}\}/g, pr.head?.ref || "unknown");
}

/**
 * Default merge conflict resolution prompt
 */
function defaultMergeConflictPrompt(repo, prNumber, pr) {
  const base = pr.base?.ref || "main";
  const head = pr.head?.ref || "feature";

  return `PR #${prNumber}: "${pr.title}" has merge conflicts with the ${base} branch.

Instructions:
1. Check the PR details: \`gh pr view ${prNumber}\`
2. Check the merge conflict status: \`gh pr view ${prNumber} --json mergeable\`
3. Checkout the branch: \`git fetch origin && git checkout ${head}\`
4. Try to rebase: \`git rebase origin/${base}\`
5. If conflicts appear, resolve them using \`git status\` to find conflicted files
6. Preserve newly added behavior from both branches unless clearly obsolete
7. Do not resolve conflicts by dropping code just to make the build pass
8. If you cannot prove which side is correct, escalate instead of choosing destructively
9. Edit conflicted files to remove conflict markers (<<<<, ====, >>>>)
10. After resolving all conflicts: \`git add .\` and \`git rebase --continue\`
11. Force push the resolved branch: \`git push --force-with-lease origin ${head}\`
12. Post a comment on the PR summarizing the resolution: \`gh pr comment ${prNumber} --body "Merge conflicts have been resolved."\`

If the conflicts are too complex to auto-resolve, post a comment explaining what needs manual intervention.`;
}

export { handlePullRequestConflict, buildMergeConflictPrompt };
