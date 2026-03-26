const postMergeGateState = new Map();

function clearPostMergeGateState() {
  postMergeGateState.clear();
}

function getPostMergeGateStatus(repo) {
  return (
    postMergeGateState.get(repo) || {
      degraded: false,
      lastRequestedAt: null,
      lastRequestedSha: null,
      lastRequestedBranch: null,
      lastConclusion: null,
      lastCheckName: null,
      lastResultSha: null,
    }
  );
}

function recordPostMergeGateTrigger(repo, { branch, sha, triggeredAt = Date.now() }) {
  const previous = getPostMergeGateStatus(repo);
  const next = {
    ...previous,
    lastRequestedAt: triggeredAt,
    lastRequestedSha: sha || null,
    lastRequestedBranch: branch || null,
  };
  postMergeGateState.set(repo, next);
  return next;
}

function shouldSkipPostMergeGateTrigger(repo, cooldownMs, now = Date.now()) {
  const current = getPostMergeGateStatus(repo);
  if (!current.lastRequestedAt) return false;
  return now - current.lastRequestedAt < cooldownMs;
}

function isAwaitingPostMergeGateForSha(repo, branch, sha) {
  const current = getPostMergeGateStatus(repo);
  return Boolean(
    current.lastRequestedSha &&
      current.lastRequestedSha === sha &&
      current.lastRequestedBranch === branch
  );
}

function recordPostMergeGateResult(repo, { branch, sha, conclusion, checkName }) {
  const previous = getPostMergeGateStatus(repo);
  const next = {
    ...previous,
    degraded: conclusion === "failure",
    lastConclusion: conclusion || null,
    lastCheckName: checkName || null,
    lastResultSha: sha || null,
    lastRequestedBranch: branch || previous.lastRequestedBranch || null,
  };
  postMergeGateState.set(repo, next);
  return next;
}

export {
  clearPostMergeGateState,
  getPostMergeGateStatus,
  isAwaitingPostMergeGateForSha,
  recordPostMergeGateResult,
  recordPostMergeGateTrigger,
  shouldSkipPostMergeGateTrigger,
};
