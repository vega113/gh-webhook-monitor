import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(dirname(__dirname), "config.json");

const DEFAULT_PROMPT_TEMPLATES = {
  pull_request_review: `A review was submitted on PR #{{prNumber}} ("{{prTitle}}") by {{reviewer}} (state: {{reviewState}}).
Read the review comments with \`gh pr view {{prNumber}} --comments\` and \`gh api repos/{{repo}}/pulls/{{prNumber}}/comments\`.
Work on the PR's existing branch only: \`git fetch origin && git checkout {{headBranch}}\` (or create it to track \`origin/{{headBranch}}\` if missing locally).
If there are actionable code review comments, fix them on \`{{headBranch}}\`, commit, and push back to that same branch. Do not create a new branch or replacement PR. If the comments are just informational or approvals, do nothing. Be concise.`,
  check_suite: `CI failed on the default branch ({{branch}}) at commit {{sha}}.
Check the failure with \`gh run list --limit 3\` and \`gh run view --log-failed\`.
Investigate the failure, fix if possible, commit and push. If it's a flaky test or infrastructure issue, report what you found.`,
  issues: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was {{action}} with labels: {{labels}}.
Read the issue with \`gh issue view {{issueNumber}}\`.
If it's a deploy failure, investigate the deploy logs and fix the issue. If it's tagged auto-fix, investigate and fix the reported bug.`,
  issue_comment: `A comment was posted on PR #{{prNumber}} ("{{prTitle}}") by {{author}}: "{{body}}".
Read the full PR context with \`gh pr view {{prNumber}}\`.
Address what's being asked — fix code issues, respond to questions, etc. If code changes are needed, make them on the PR's existing branch and push back to that same branch instead of creating a new one.`,
  agent_task: `GitHub issue #{{issueNumber}} ("{{issueTitle}}") was created as an agent task.
Labels: {{labels}}

Issue description:
{{issueBody}}

Instructions:
1. Read the full issue with \`gh issue view {{issueNumber}}\`
2. Write a concise implementation plan before touching code
3. Review that plan with Codex using model \`gpt-5.4\` and reasoning effort \`xhigh\`
4. Incorporate the review feedback, then implement the requested changes
5. Review the implementation with Codex using model \`gpt-5.4\` and reasoning effort \`medium\`
6. If this touches login, authentication, or registration, run the app locally with email registration/confirmation turned off, then verify a real user can register and log in end-to-end without email confirmation
7. Never commit secrets. Use GitHub Actions secrets for hosted automation and environment variables for local-only secrets. If a fix appears to require committing a secret, stop and escalate.
8. Before final push or merge-related actions, run \`git fetch origin\` and rebase onto the latest \`origin/main\` (or the PR base branch). If the branch cannot be refreshed cleanly, stop and report it.
9. If deploys or integration checks are already broken, prefer a slow merge cadence: avoid rushing overlapping PRs through until the branch is healthy again.
10. Create a PR with the fix/feature, adding the label "agent-authored"
11. Reference the issue in the PR body: "Fixes #{{issueNumber}}" or "Addresses #{{issueNumber}}"
12. Post a comment on the issue summarizing what was done: \`gh issue comment {{issueNumber}} --body "..."\``,
  issue_followup: `A follow-up comment was posted on issue #{{issueNumber}} ("{{issueTitle}}") by {{author}}: "{{body}}"
Labels: {{labels}}

Read the full issue and comment thread with \`gh issue view {{issueNumber}} --comments\`.
If the comment asks for additional changes or clarifications on work already done, address them.
Use the same plan -> Codex \`gpt-5.4\` xhigh review -> implement -> Codex \`gpt-5.4\` medium review workflow for any new code changes.
Never commit secrets. Use GitHub Actions secrets for hosted automation and environment variables for local-only secrets. If a fix appears to require committing a secret, stop and escalate.
Before final push or merge-related actions, run \`git fetch origin\` and rebase onto the latest \`origin/main\` (or the PR base branch). If the branch cannot be refreshed cleanly, stop and report it.
If deploys or integration checks are already broken, prefer a slow merge cadence over merging several stale branches quickly.
If there's an open PR for this issue, update it. Otherwise create a new PR if code changes are needed.
Post a comment on the issue summarizing what was done.`,
  merge_conflict: `PR #{{prNumber}}: "{{prTitle}}" has merge conflicts with the {{baseBranch}} branch.

Instructions:
1. Check the PR details: \`gh pr view {{prNumber}}\`
2. Check the merge conflict status: \`gh pr view {{prNumber}} --json mergeable\`
3. Checkout the branch: \`git fetch origin && git checkout {{headBranch}}\`
4. Try to rebase: \`git rebase origin/{{baseBranch}}\`
5. If conflicts appear, resolve them using \`git status\` to find conflicted files
6. Preserve newly added behavior from both branches unless clearly obsolete
7. Do not resolve conflicts by dropping code just to make the build pass
8. If you cannot prove which side is correct, escalate instead of choosing destructively
9. Edit conflicted files to remove conflict markers (<<<<, ====, >>>>)
10. After resolving all conflicts: \`git add .\` and \`git rebase --continue\`
11. Force push the resolved branch: \`git push --force-with-lease origin {{headBranch}}\`
12. Post a comment on the PR summarizing the resolution: \`gh pr comment {{prNumber}} --body "Merge conflicts have been resolved."\`

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
        model: "gpt-5.4",
        reasoningEffort: "high",
        webSearch: "live",
        sandbox: "danger-full-access",
        extraArgs: "",
      },
    },
    settings: {
      maxConcurrentJobs: 3,
      jobTimeoutMinutes: 15,
      mergeableCheckInterval: 60000,
      agentRouter: {
        enabled: true,
        policy: "conservative-hybrid",
        codexMiniModel: "gpt-5.4-mini",
        codexFullModel: "gpt-5.4",
      },
      postMergeGate: {
        enabled: false,
        workflowFile: ".github/workflows/build.yml",
        workflowName: "Build",
        checkName: "Server Build (JDK 17)",
        branch: "main",
        cooldownMinutes: 10,
        triggerOnMerge: false,
      },
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

function sanitizeSettings(settings = {}) {
  const { webhookSecret: _legacyWebhookSecret, ...rest } = settings;
  return rest;
}

function sanitizeConfigForPersistence(configToSave) {
  return {
    ...configToSave,
    settings: sanitizeSettings(configToSave.settings),
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
    const savedSettings = sanitizeSettings(saved.settings);
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
        ...savedSettings,
        agentRouter: {
          ...def.settings.agentRouter,
          ...(savedSettings.agentRouter || {}),
        },
        postMergeGate: {
          ...def.settings.postMergeGate,
          ...(savedSettings.postMergeGate || {}),
        },
        enabledEvents: {
          ...def.settings.enabledEvents,
          ...(savedSettings.enabledEvents || {}),
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
  writeFileSync(CONFIG_PATH, JSON.stringify(sanitizeConfigForPersistence(config), null, 2));
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
  return process.env.GITHUB_WEBHOOK_SECRET || "";
}

function requireWebhookSecret() {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "Missing GITHUB_WEBHOOK_SECRET. Set it in the environment instead of committing it to config files."
    );
  }
  return secret;
}

function getConfig() {
  return config;
}

function setConfig(newConfig) {
  config = {
    ...newConfig,
    settings: sanitizeSettings(newConfig.settings),
  };
  saveConfig();
}

export {
  loadConfig,
  saveConfig,
  getRepoPath,
  getAgentForRepo,
  getSecret,
  requireWebhookSecret,
  getConfig,
  setConfig,
  DEFAULT_PROMPT_TEMPLATES,
};
