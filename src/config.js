import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(dirname(__dirname), "config.json");

const DEFAULT_PROMPT_TEMPLATES = {
  pull_request_review: `A review was submitted on PR #{{prNumber}} ("{{prTitle}}") by {{reviewer}} (state: {{reviewState}}).
Read the review comments with \`gh pr view {{prNumber}} --comments\` and \`gh api repos/{{repo}}/pulls/{{prNumber}}/comments\`.
If there are actionable code review comments, fix them, commit, and push. If the comments are just informational or approvals, do nothing. Be concise.`,
  check_suite: `CI failed on the default branch ({{branch}}) at commit {{sha}}.
Check the failure with \`gh run list --limit 3\` and \`gh run view --log-failed\`.
Investigate the failure, fix if possible, commit and push. If it's a flaky test or infrastructure issue, report what you found.`,
  issues: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was {{action}} with labels: {{labels}}.
Read the issue with \`gh issue view {{issueNumber}}\`.
If it's a deploy failure, investigate the deploy logs and fix the issue. If it's tagged auto-fix, investigate and fix the reported bug.`,
  issue_comment: `A comment was posted on PR #{{prNumber}} ("{{prTitle}}") by {{author}}: "{{body}}".
Read the full PR context with \`gh pr view {{prNumber}}\`.
Address what's being asked — fix code issues, respond to questions, etc. Commit and push if code changes are needed.`,
  agent_task: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was created as an agent task.
Labels: {{labels}}

Issue description:
{{issueBody}}

Instructions:
1. Read the full issue with \`gh issue view {{issueNumber}}\`
2. Investigate the codebase as needed
3. Implement the requested changes
4. Create a PR with the fix/feature, adding the label "agent-authored"
5. Reference the issue in the PR body: "Fixes #{{issueNumber}}" or "Addresses #{{issueNumber}}"
6. Post a comment on the issue summarizing what was done: \`gh issue comment {{issueNumber}} --body "..."\``,
  issue_followup: `A follow-up comment was posted on issue #{{issueNumber}} ("{{issueTitle}}") by {{author}}: "{{body}}"
Labels: {{labels}}

Read the full issue and comment thread with \`gh issue view {{issueNumber}} --comments\`.
If the comment asks for additional changes or clarifications on work already done, address them.
If there's an open PR for this issue, update it. Otherwise create a new PR if code changes are needed.
Post a comment on the issue summarizing what was done.`,
  merge_conflict: `PR #{{prNumber}}: "{{prTitle}}" has merge conflicts with the {{baseBranch}} branch.

Instructions:
1. Check the PR details: \`gh pr view {{prNumber}}\`
2. Check the merge conflict status: \`gh pr view {{prNumber}} --json mergeable\`
3. Checkout the branch: \`git fetch origin && git checkout {{headBranch}}\`
4. Try to rebase: \`git rebase origin/{{baseBranch}}\`
5. If conflicts appear, resolve them using \`git status\` to find conflicted files
6. Edit conflicted files to remove conflict markers (<<<<, ====, >>>>)
7. After resolving all conflicts: \`git add .\` and \`git rebase --continue\`
8. Force push the resolved branch: \`git push --force-with-lease origin {{headBranch}}\`
9. Post a comment on the PR summarizing the resolution: \`gh pr comment {{prNumber}} --body "Merge conflicts have been resolved."\`

If the conflicts are too complex to auto-resolve, post a comment explaining what needs manual intervention.`,
};

function defaultConfig() {
  return {
    repos: {
      "vega113/incubator-wave": {
        localPath: "/Users/vega/devroot/incubator-wave",
        enabled: true,
      },
    },
    agentConfig: {
      defaultAgent: "claude",
      perRepoOverride: {},
    },
    agent: {
      type: "claude",
      claude: {
        bin: "claude",
        model: "",
        allowedTools: "",
        extraArgs: "--dangerously-skip-permissions",
      },
      codex: {
        bin: "codex",
        model: "gpt-5.3-codex",
        reasoningEffort: "high",
        sandbox: "workspace-write",
        extraArgs: "--full-auto",
      },
    },
    settings: {
      webhookSecret: process.env.WEBHOOK_SECRET || "",
      maxConcurrentJobs: 3,
      jobTimeoutMinutes: 15,
      mergeableCheckInterval: 60000,
      enabledEvents: {
        pull_request_review: true,
        check_suite: true,
        check_run: true,
        issues: true,
        issue_comment: true,
        pull_request: true,
      },
      triggerKeywords: ["@claude", "please fix"],
      issueLabels: ["deploy-failure", "auto-fix", "agent-task"],
      ignoredBots: ["github-actions[bot]", "dependabot[bot]"],
      gateCheckNames: ["Codex Review Gate"],
      autoResolveBots: ["coderabbitai", "chatgpt-codex-connector"],
      botUsername: "github-actions[bot]",
      useAssignmentForCoordination: true,
      useLabelsForCoordination: true,
      inProgressLabel: "agent-working",
      agentResolvedLabel: "agent-resolved",
    },
    promptTemplates: { ...DEFAULT_PROMPT_TEMPLATES },
  };
}

function validateBotUsername(config) {
  const botUsername = config.settings?.botUsername;
  const useAssignment = config.settings?.useAssignmentForCoordination;

  if (useAssignment && (!botUsername || botUsername.trim().length === 0)) {
    console.warn(
      "WARNING: Issue assignment coordination is enabled (useAssignmentForCoordination: true) " +
      "but botUsername is empty or not set. Assignment operations will fail. " +
      "Set a valid botUsername in settings (e.g., 'github-actions[bot]')"
    );
  }
}

function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const def = defaultConfig();
    const config = {
      repos: saved.repos || def.repos,
      agentConfig: {
        defaultAgent: saved.agentConfig?.defaultAgent || def.agentConfig.defaultAgent,
        perRepoOverride: saved.agentConfig?.perRepoOverride || def.agentConfig.perRepoOverride,
      },
      agent: {
        ...def.agent,
        ...saved.agent,
        claude: { ...def.agent.claude, ...(saved.agent?.claude || {}) },
        codex: { ...def.agent.codex, ...(saved.agent?.codex || {}) },
      },
      settings: {
        ...def.settings,
        ...saved.settings,
        enabledEvents: {
          ...def.settings.enabledEvents,
          ...(saved.settings?.enabledEvents || {}),
        },
      },
      promptTemplates: { ...def.promptTemplates, ...(saved.promptTemplates || {}) },
    };
    validateBotUsername(config);
    return config;
  }
  const c = defaultConfig();
  writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
  validateBotUsername(c);
  return c;
}

let config = loadConfig();

function saveConfig() {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getRepoPath(fullName) {
  const r = config.repos[fullName];
  return r?.enabled ? r.localPath : null;
}

function getAgentForRepo(repoFullName) {
  const agentCfg = config.agentConfig;
  return agentCfg.perRepoOverride[repoFullName] || agentCfg.defaultAgent;
}

function getSecret() {
  return config.settings.webhookSecret || process.env.WEBHOOK_SECRET || "";
}

function getConfig() {
  return config;
}

function setConfig(newConfig) {
  config = newConfig;
  saveConfig();
}

export {
  loadConfig,
  saveConfig,
  getRepoPath,
  getAgentForRepo,
  getSecret,
  getConfig,
  setConfig,
  DEFAULT_PROMPT_TEMPLATES,
};
