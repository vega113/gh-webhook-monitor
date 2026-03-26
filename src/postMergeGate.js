function getPostMergeGateSettings(config, branch) {
  const settings = config?.settings?.postMergeGate;
  if (!settings?.enabled) return null;
  if (settings.branch && branch && settings.branch !== branch) return null;
  return {
    enabled: true,
    workflowFile: settings.workflowFile || "",
    workflowName: settings.workflowName || "",
    checkName: settings.checkName || settings.workflowName || "",
    branch: settings.branch || branch || "main",
    cooldownMinutes: settings.cooldownMinutes ?? 10,
    triggerOnMerge: settings.triggerOnMerge !== false,
  };
}

function buildPostMergeGateCommand(repo, settings, { number, mergeCommitSha }) {
  return {
    command: "gh",
    args: [
      "workflow",
      "run",
      settings.workflowFile,
      "--repo",
      repo,
      "-r",
      settings.branch,
      "-f",
      `merged_sha=${mergeCommitSha}`,
      "-f",
      `merged_pr=${number}`,
    ],
  };
}

function isPostMergeGateCheckRun(config, { branch, name }) {
  const settings = getPostMergeGateSettings(config, branch);
  if (!settings) return false;
  return Boolean(settings.checkName) && settings.checkName === name;
}

export {
  buildPostMergeGateCommand,
  getPostMergeGateSettings,
  isPostMergeGateCheckRun,
};
