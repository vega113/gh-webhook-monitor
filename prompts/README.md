# Claude Code Monitoring Prompts

This directory contains structured prompts for using Claude Code as a GitHub PR monitoring agent, either manually or as part of the webhook server automation.

## Prompts

### monitoring-agent.md

The comprehensive monitoring agent prompt containing:
- Complete PR monitoring workflow
- Decision trees for determining actions
- GitHub CLI command reference with examples
- Known bot behavior documentation
- Rate limiting and safety guidelines
- Example scenarios and troubleshooting

**Use this prompt for:**
- Manual monitoring sessions via Claude Code
- Understanding the full monitoring workflow
- Reference for all supported operations
- Training or documentation purposes

## How to Use These Prompts with Claude Code

### Option 1: Manual Monitoring Session

Load the monitoring prompt directly in Claude Code:

```bash
claude < prompts/monitoring-agent.md --context-file=/path/to/repo
```

Or interactively:

```bash
claude
# In the Claude Code REPL, load the prompt
/load prompts/monitoring-agent.md

# Then give a specific task
Monitor PR #42 for any issues and take corrective action if needed.
```

### Option 2: Parameterized Monitoring Task

Customize the prompt for a specific PR:

```bash
# Create a parameterized version
sed -e 's/{PR_NUMBER}/42/g' \
    -e 's/{REPO}/myorg\/myrepo/g' \
    -e 's/{BASE_BRANCH}/main/g' \
    prompts/monitoring-agent.md | claude
```

### Option 3: As Webhook Server Prompt Template

The webhook server uses monitoring-agent.md as a base template. In config.json:

```json
{
  "promptTemplates": {
    "pull_request_review": "A review was submitted on PR #{{prNumber}} ({{prTitle}}) by {{reviewer}}...",
    "check_suite": "CI failed on the default branch...",
    // ... etc
  }
}
```

The webhook server:
1. Detects a GitHub event
2. Selects the appropriate prompt template
3. Renders it with template variables (PR number, reviewer, etc.)
4. Spawns Claude Code with the rendered prompt
5. Claude Code monitors the PR and takes action

## Parameter Reference

When using these prompts manually, you can parameterize them:

| Parameter | Example | Usage |
|-----------|---------|-------|
| `{PR_NUMBER}` | `42` | The PR to monitor |
| `{REPO}` | `myorg/myrepo` | Repository full name |
| `{BASE_BRANCH}` | `main` | Target merge branch |
| `{HEAD_BRANCH}` | `feature-auth` | Feature branch being merged |
| `{EVENT_TYPE}` | `review_submitted` | What triggered the action |
| `{REVIEWER}` | `coderabbitai` | Who submitted the review |
| `{CHECK_NAME}` | `tests` | Name of failing CI check |
| `{SHA}` | `a1b2c3d4` | Commit SHA that triggered event |

## Common Monitoring Scenarios

### 1. Code Review Feedback

**Scenario:** A bot reviewer submitted feedback that needs to be addressed

**Task:**
```bash
# Using parameterized prompt
sed -e 's/{PR_NUMBER}/42/g' \
    -e 's/{REPO}/myorg\/myrepo/g' \
    -e 's/{EVENT_TYPE}/review_submitted/g' \
    -e 's/{REVIEWER}/coderabbitai/g' \
    prompts/monitoring-agent.md | claude

# Then provide specific instruction:
# "Address the code review feedback from coderabbitai"
```

### 2. CI Test Failure

**Scenario:** GitHub Actions tests are failing

**Task:**
```bash
sed -e 's/{PR_NUMBER}/42/g' \
    -e 's/{REPO}/myorg\/myrepo/g' \
    -e 's/{CHECK_NAME}/tests/g' \
    prompts/monitoring-agent.md | claude

# Instruction: "Investigate and fix the failing test"
```

### 3. Merge Conflict

**Scenario:** PR has merge conflicts with the base branch

**Task:**
```bash
sed -e 's/{PR_NUMBER}/42/g' \
    -e 's/{BASE_BRANCH}/main/g' \
    -e 's/{HEAD_BRANCH}/feature-auth/g' \
    prompts/monitoring-agent.md | claude

# Instruction: "Resolve merge conflicts"
```

### 4. Full PR Check

**Scenario:** Manually audit a PR for any issues

**Task:**
```bash
# Use the base prompt without specific parameters
claude < prompts/monitoring-agent.md

# Instruction: "Monitor PR #42 for any issues: check CI status, review comments, conflicts, and take corrective action"
```

## Integration with the Webhook Server

### How It Works

The webhook server (`server.js`) uses these prompts in the following flow:

```
GitHub sends webhook event
  ↓
Server receives and validates event
  ↓
Server determines event type (review, CI failure, conflict, etc.)
  ↓
Server loads appropriate prompt template from config.json
  ↓
Server renders template with event-specific variables
  ↓
Server spawns Claude Code with rendered prompt + repo context
  ↓
Claude Code performs monitoring action
  ↓
Server reacts with emoji, logs result
```

### Configuration

To configure how prompts are used in the webhook server:

**config.json:**
```json
{
  "promptTemplates": {
    "pull_request_review": "Custom prompt here...",
    "check_suite": "Custom prompt here...",
    "merge_conflict": "Custom prompt here..."
  }
}
```

The server renders these templates with variables from the GitHub event before spawning Claude Code.

### Event Types and Corresponding Prompts

| Event | Template Key | Triggered By |
|-------|--------------|--------------|
| Code Review Submitted | `pull_request_review` | review_submitted webhook |
| CI Check Failed | `check_suite` / `check_run` | check run completion |
| Merge Conflict | `merge_conflict` | pull_request event with conflict |
| Issue Opened/Updated | `issues` | issues webhook |
| Issue Comment | `issue_comment` | issue_comment webhook |
| Manual Task | `agent_task` | Issue with "agent-task" label |

## Quick Start for Manual Monitoring

1. **Navigate to your repo:**
   ```bash
   cd /path/to/your/repo
   ```

2. **Load Claude Code with monitoring prompt:**
   ```bash
   claude < prompts/monitoring-agent.md
   ```

3. **Give a specific instruction:**
   ```
   Monitor PR #42 for any issues. Check CI status, review comments, merge conflicts,
   and take corrective action if needed. Report what you did.
   ```

4. **Claude Code will:**
   - Use GitHub CLI to fetch PR details
   - Analyze status and issues
   - Make code changes if needed
   - Commit and push fixes
   - Comment on the PR with updates
   - Report completion status

## Customizing Prompts

### For Specific Workflows

If you have specific monitoring needs, you can:

1. **Create a workflow-specific prompt:**
   ```bash
   cp prompts/monitoring-agent.md prompts/monitoring-codex-reviews.md
   # Edit to focus on handling Codex-specific reviews
   ```

2. **Create a checklist prompt:**
   ```bash
   cat > prompts/pr-checklist.md <<EOF
   PR Review Checklist:
   - [ ] All CI checks passing
   - [ ] No merge conflicts
   - [ ] Code review comments addressed
   - [ ] Commits are descriptive
   - [ ] No security issues

   Check PR #{{prNumber}} against this checklist.
   EOF
   ```

3. **Add to webhook config:**
   ```bash
   # Update config.json to use your new prompt
   ```

## Troubleshooting

### "PR not found"
```bash
# Verify the PR exists
gh pr view {PR_NUMBER}

# Check you're in the right repo
gh repo view
```

### "Permission denied"
```bash
# Verify GitHub CLI auth
gh auth status

# Re-authenticate if needed
gh auth login
```

### "Rate limit exceeded"
```bash
# Check remaining quota
gh api rate_limit --jq '.rate'

# Wait for reset or use GraphQL API for more efficiency
```

### "Merge conflict too complex"
This is expected for architectural changes. When you encounter a complex conflict:
1. Leave a comment on the PR explaining what needs manual review
2. Escalate to the PR author
3. The prompt has explicit escalation guidance in the "Escalation Criteria" section

## Best Practices

1. **Test prompts locally first** before adding to webhook config
2. **Review Claude Code output** before it commits/pushes
3. **Monitor rate limits** - The prompt includes guidance on this
4. **Keep prompt templates in sync** - If you update monitoring-agent.md, update config.json too
5. **Log all monitoring actions** - Makes debugging easier
6. **Use descriptive commit messages** - Helps humans understand what Claude Code did
7. **Escalate when unsure** - The prompt has clear escalation criteria

## Advanced: Custom Prompts

### Create a Gate Check Specialist

```bash
cat > prompts/monitoring-gate-checks.md <<EOF
# Gate Check Specialist Prompt

You specialize in handling "Gate" checks (Release Gate, Review Gate, etc.)

Focus areas:
- Understand gate check purpose
- Identify environmental vs. code issues
- Re-run only when appropriate
- Escalate architectural issues

[Include relevant sections from monitoring-agent.md]
EOF
```

### Create a Conflict Resolution Specialist

```bash
cat > prompts/monitoring-conflicts.md <<EOF
# Merge Conflict Resolution Specialist

You specialize in resolving merge conflicts quickly and safely.

When conflicts occur:
1. Analyze both versions
2. Understand the change intent
3. Merge or choose appropriate version
4. Test if possible
5. Document the resolution

[Include full merge conflict workflow from monitoring-agent.md]
EOF
```

## Contributing

To improve these prompts:

1. Test changes in manual Claude Code sessions
2. Document improvements in comments
3. Update this README with new capabilities
4. Commit with clear messages about what was improved

## Related Files

- `server.js` - Main webhook server using these prompts
- `src/config.js` - Default prompt templates
- `src/handlers/` - Event handlers that trigger monitoring
- `README.md` - Main project documentation
- `docs/` - Additional documentation
