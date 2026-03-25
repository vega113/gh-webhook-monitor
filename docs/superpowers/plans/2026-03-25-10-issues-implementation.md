# GitHub Webhook Monitor: 10 Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each issue produces its own PR.

**Goal:** Implement all 10 GitHub issues (9 original + 1 new) to add comprehensive webhook automation, intelligent action dispatch, and modular architecture.

**Architecture:** Three-phase rollout:
- **Phase 1 (Foundation)**: Refactor monolithic server.js into modular architecture (#9), add centralized agent configuration (#10), implement per-PR rate limiting (#5)
- **Phase 2 (Automation)**: Smart action dispatcher (#7), then parallel implementation of: check_run event handling (#1), cascade branch updates (#2), auto-resolve bot threads (#3), auto-resolve conflicts (#4)
- **Phase 3 (Intelligence)**: Status endpoint for PR visibility (#6), comprehensive monitoring prompt documentation (#8)

**Tech Stack:** Node.js, Express.js, GitHub API, gh CLI

---

## Phase 1: Foundation (Issues #9, #10, #5)

### Issue #9: Refactor server.js into Modular Architecture

**Files:**
- Create: `src/server.js`, `src/config.js`, `src/webhook.js`, `src/logger.js`, `src/rateLimiter.js`, `src/prState.js`, `src/dispatcher.js`
- Create: `src/handlers/pullRequest.js`, `src/handlers/pullRequestReview.js`, `src/handlers/checkSuite.js`, `src/handlers/issues.js`, `src/handlers/issueComment.js`
- Create: `src/actions/updateBranch.js`, `src/actions/rerunGate.js`, `src/actions/resolveThreads.js`, `src/actions/spawnAgent.js`, `src/actions/mergePr.js`
- Create: `src/api/routes.js`, `src/dashboard/app.js`, `src/dashboard/style.css`, `public/dashboard.html`
- Modify: `package.json` (update entry point), `.gitignore` (add src output)
- Delete: old `server.js` (after migration complete)

**Steps:**

- [ ] **Step 1: Create config module** (`src/config.js`)
  - Load config.json, merge with .env, provide defaults
  - Export loadConfig(), saveConfig(), getDefaultConfig()

- [ ] **Step 2: Create logger module** (`src/logger.js`)
  - Simple file + console logger
  - Log events to logs/events.log
  - Export log() function

- [ ] **Step 3: Create webhook signature verification** (`src/webhook.js`)
  - Extract from server.js: signature verification, event parsing
  - Export verify(req, secret), parseEvent(body)

- [ ] **Step 4: Extract handlers into separate files**
  - `src/handlers/pullRequest.js`
  - `src/handlers/pullRequestReview.js`
  - `src/handlers/checkSuite.js`
  - `src/handlers/issues.js`
  - `src/handlers/issueComment.js`
  - Each exports { handle(event) }

- [ ] **Step 5: Extract action modules**
  - `src/actions/spawnAgent.js` - spawn Claude/Codex agents
  - `src/actions/updateBranch.js` - branch update logic
  - `src/actions/rerunGate.js` - gate check re-run (stub for #1)
  - `src/actions/resolveThreads.js` - thread resolution (stub for #3)
  - `src/actions/mergePr.js` - auto-merge logic
  - Each exports { execute(context) }

- [ ] **Step 6: Extract dashboard HTML/CSS/JS to files**
  - `public/dashboard.html` - HTML structure
  - `src/dashboard/app.js` - Dashboard JavaScript
  - `src/dashboard/style.css` - Dashboard CSS (inlined in HTML via <style> tag)
  - Keep dashboard.html minimal, load app.js

- [ ] **Step 7: Create API routes module** (`src/api/routes.js`)
  - Export setupRoutes(app) function
  - Registers all endpoints: /api/health, /api/config, /api/repos, etc.

- [ ] **Step 8: Create main server.js**
  - Entry point that imports modules
  - Sets up Express app, middleware, routes
  - Starts server

- [ ] **Step 9: Update package.json**
  - Change main to `src/server.js`
  - Keep scripts unchanged

- [ ] **Step 10: Test refactored server**
  ```bash
  npm start
  # Should start normally, no errors
  curl http://localhost:3847/api/health
  # Should return health status
  ```

- [ ] **Step 11: Verify all endpoints work**
  ```bash
  # Test each endpoint from old server.js still works
  curl http://localhost:3847/
  curl http://localhost:3847/api/config
  curl http://localhost:3847/api/events
  # All should respond normally
  ```

- [ ] **Step 12: Commit refactoring**
  ```bash
  git add -A
  git commit -m "refactor: split monolithic server.js into modular architecture

- Move config management to src/config.js
- Extract event handlers to src/handlers/
- Create action modules in src/actions/
- Extract dashboard to separate HTML/CSS/JS files
- Create API routes module
- All existing functionality preserved, no behavioral changes"
  ```

**Notes:**
- This is purely refactoring — no new features yet
- All existing behavior must be preserved
- Goal is clean boundaries for upcoming features (#1-#4)

---

### Issue #10: Centralized Agent Configuration

**Files:**
- Modify: `src/config.js` (add agent config management)
- Modify: `src/actions/spawnAgent.js` (use defaultAgent setting)
- Modify: `src/dashboard/app.js` (add agent selector UI)
- Modify: `package.json` (if adding any dependencies)
- Create: `src/api/agentApi.js` (agent configuration endpoints)

**Steps:**

- [ ] **Step 1: Add agent config schema to config.js**
  ```javascript
  // In config: defaultAgent should be 'claude' or 'codex'
  // perRepoAgent allows per-repo override
  const defaultConfig = {
    agent: {
      defaultAgent: 'claude', // or 'codex'
      claude: {
        bin: 'claude',
        model: '',
        extraArgs: '--dangerously-skip-permissions'
      },
      codex: {
        bin: 'codex',
        model: 'gpt-5.3-codex',
        reasoningEffort: 'high',
        sandbox: 'workspace-write'
      }
    },
    repos: {
      // Can add agentOverride per repo
      'owner/repo': {
        agentOverride: 'codex' // optional
      }
    }
  };
  ```

- [ ] **Step 2: Export agent helper in config.js**
  ```javascript
  export function getAgentForRepo(repo) {
    const repoConfig = config.repos[repo];
    if (repoConfig?.agentOverride) return repoConfig.agentOverride;
    return config.agent.defaultAgent;
  }
  ```

- [ ] **Step 3: Update spawnAgent.js to use getAgentForRepo()**
  - Instead of hardcoding agent, call getAgentForRepo(repo)
  - Select correct bin path and options based on returned agent

- [ ] **Step 4: Create agentApi.js endpoints**
  ```javascript
  // GET /api/agent - returns current default agent
  // POST /api/agent - set default agent (body: { defaultAgent: 'claude'|'codex' })
  // GET /api/repos/:owner/:repo/agent - get agent for specific repo
  // POST /api/repos/:owner/:repo/agent - override agent for repo
  ```

- [ ] **Step 5: Update dashboard to show agent selector**
  - Add "Agent" tab if not present
  - Show current defaultAgent
  - Show per-repo overrides
  - Allow changing default and per-repo settings

- [ ] **Step 6: Test agent configuration**
  ```bash
  # Change default agent and verify it's used
  curl -X POST http://localhost:3847/api/agent -H "Content-Type: application/json" \
    -d '{"defaultAgent": "codex"}'

  curl http://localhost:3847/api/agent
  # Should return { defaultAgent: 'codex' }
  ```

- [ ] **Step 7: Commit**
  ```bash
  git add -A
  git commit -m "feat: add centralized agent configuration

- Add defaultAgent setting at top level of config
- Support per-repo agent override
- Create getAgentForRepo() helper
- Update spawnAgent.js to respect default agent
- Add /api/agent endpoints for configuration
- Update dashboard with agent selector UI"
  ```

---

### Issue #5: Per-PR Rate Limiting and Deduplication

**Files:**
- Create: `src/rateLimiter.js` (complete implementation, not stub)
- Modify: `src/server.js` (initialize rate limiter)
- Create: `src/api/rateLimitApi.js` (expose rate limit state)
- Modify: `src/dashboard/app.js` (show rate limit status)

**Steps:**

- [ ] **Step 1: Design rate limiter data structure**
  ```javascript
  // Track per PR, per action type
  const prActionTimestamps = {
    '42': { // PR number
      updateBranch: 1234567890,
      rerunGate: 1234567890,
      resolveThreads: 1234567890,
      spawnAgent: 1234567890
    }
  };

  // Action intervals (in seconds)
  const actionIntervals = {
    updateBranch: 60,
    rerunGate: 120,
    resolveThreads: 30,
    spawnAgent: 300
  };
  ```

- [ ] **Step 2: Implement rateLimiter module**
  ```javascript
  export class RateLimiter {
    constructor(config = {}) {
      this.prActionTimestamps = {};
      this.actionIntervals = {
        updateBranch: config.updateBranchInterval || 60,
        rerunGate: config.rerunGateInterval || 120,
        resolveThreads: config.resolveThreadsInterval || 30,
        spawnAgent: config.spawnAgentInterval || 300
      };
      this.batchWindow = config.batchWindow || 5000; // ms
      this.eventQueue = [];
    }

    canExecute(prNumber, actionType) {
      const now = Date.now() / 1000;
      const lastExecution = this.prActionTimestamps[prNumber]?.[actionType] || 0;
      const interval = this.actionIntervals[actionType];
      return (now - lastExecution) >= interval;
    }

    recordExecution(prNumber, actionType) {
      if (!this.prActionTimestamps[prNumber]) {
        this.prActionTimestamps[prNumber] = {};
      }
      this.prActionTimestamps[prNumber][actionType] = Date.now() / 1000;
    }

    getState() {
      return {
        prActionTimestamps: this.prActionTimestamps,
        actionIntervals: this.actionIntervals
      };
    }
  }
  ```

- [ ] **Step 3: Event batching implementation**
  ```javascript
  // In RateLimiter class
  addEvent(event) {
    this.eventQueue.push(event);
  }

  async processBatch() {
    if (this.eventQueue.length === 0) return [];

    // Collect unique actions needed
    const actions = {};
    for (const event of this.eventQueue) {
      const key = `${event.prNumber}:${event.actionType}`;
      if (!actions[key]) {
        actions[key] = event; // Keep first, deduplicate
      }
    }

    this.eventQueue = []; // Clear queue
    return Object.values(actions);
  }
  ```

- [ ] **Step 4: Initialize rate limiter in server.js**
  ```javascript
  import { RateLimiter } from './rateLimiter.js';

  const rateLimiter = new RateLimiter(config.settings?.rateLimits || {});

  // Start batch processing
  setInterval(async () => {
    const batch = await rateLimiter.processBatch();
    for (const event of batch) {
      // Process event
    }
  }, 5000);
  ```

- [ ] **Step 5: Update handlers to use rate limiter**
  ```javascript
  // In each handler (pullRequest.js, etc.)
  export async function handle(event, rateLimiter, dispatcher) {
    const prNumber = event.pull_request.number;
    const actionType = determineAction(event);

    // Check rate limit
    if (!rateLimiter.canExecute(prNumber, actionType)) {
      log(`Rate limited: PR #${prNumber} action ${actionType}`);
      return;
    }

    rateLimiter.recordExecution(prNumber, actionType);
    // Process action
  }
  ```

- [ ] **Step 6: Create rate limit API endpoints**
  ```javascript
  // GET /api/rate-limits - returns current rate limit state
  // POST /api/rate-limits - update rate limit intervals
  ```

- [ ] **Step 7: Update dashboard**
  - Add "Rate Limits" section
  - Show per-PR action timestamps
  - Show configurable intervals

- [ ] **Step 8: Test rate limiting**
  ```bash
  # Fire multiple events for same PR rapidly
  # Should only execute first one, others queued/deduped
  ```

- [ ] **Step 9: Commit**
  ```bash
  git add -A
  git commit -m "feat: add per-PR, per-action-type rate limiting with deduplication

- Implement RateLimiter class with action-specific intervals
- Support event batching (5s window by default)
- Configurable intervals per action type
- Preserve global agent spawn cooldown
- Add /api/rate-limits endpoint
- Update dashboard with rate limit state"
  ```

**Notes:** Rate limiter is foundation for Phase 2 automation features.

---

## Phase 2: Automation Actions (Issues #7, #1, #2, #3, #4)

### Issue #7: Smart Action Dispatcher

**Files:**
- Create: `src/dispatcher.js` (complete implementation)
- Modify: `src/server.js` (use dispatcher in webhook handler)
- Create: `src/api/dispatcherApi.js` (expose decision history)
- Modify: `src/dashboard/app.js` (show dispatch decisions)

**Steps:**

- [ ] **Step 1: Design action types enum**
  ```javascript
  const ActionType = {
    UPDATE_BRANCH: 'UPDATE_BRANCH',
    RERUN_GATE: 'RERUN_GATE',
    RESOLVE_THREADS: 'RESOLVE_THREADS',
    MERGE_PR: 'MERGE_PR',
    SPAWN_AGENT: 'SPAWN_AGENT',
    RESOLVE_CONFLICT: 'RESOLVE_CONFLICT',
    NOOP: 'NOOP'
  };
  ```

- [ ] **Step 2: Implement ActionDispatcher class**
  ```javascript
  export class ActionDispatcher {
    constructor(config, prStateCache, rateLimiter) {
      this.config = config;
      this.prStateCache = prStateCache;
      this.rateLimiter = rateLimiter;
      this.decisionHistory = {}; // Track decisions for debugging
    }

    async dispatch(event) {
      const prNumber = event.pull_request?.number;
      const prState = await this.prStateCache.get(prNumber);

      const actions = this.decidActions(event, prState);

      // Log decision
      if (!this.decisionHistory[prNumber]) {
        this.decisionHistory[prNumber] = [];
      }
      this.decisionHistory[prNumber].push({
        timestamp: Date.now(),
        event: event.action,
        eventType: event.type,
        actions: actions,
        reasoning: this.lastReasoning
      });

      return actions; // Return array of { type, context }
    }

    decidActions(event, prState) {
      // Centralized decision logic
      const actions = [];

      switch (event.type) {
        case 'pull_request:synchronize':
          // New push: wait for CI, don't spawn agent
          break;
        case 'check_suite:completed':
          if (event.check_suite.conclusion === 'failure') {
            actions.push({ type: ActionType.SPAWN_AGENT, ... });
          }
          break;
        case 'pull_request_review:submitted':
          if (event.review.state === 'changes_requested') {
            actions.push({ type: ActionType.SPAWN_AGENT, ... });
          }
          break;
        // ... more cases
      }

      return actions;
    }

    getDecisionHistory(prNumber) {
      return this.decisionHistory[prNumber] || [];
    }
  }
  ```

- [ ] **Step 3: Integrate dispatcher into webhook handler**
  ```javascript
  // In server.js webhook route
  const dispatcher = new ActionDispatcher(config, prStateCache, rateLimiter);

  app.post('/webhook', async (req, res) => {
    const event = parseWebhookEvent(req.body);
    const actions = await dispatcher.dispatch(event);

    for (const action of actions) {
      await executeAction(action);
    }

    res.json({ received: true });
  });
  ```

- [ ] **Step 4: Create decision history API**
  ```javascript
  // GET /api/dispatch-history/:prNumber - returns decision history for PR
  ```

- [ ] **Step 5: Update dashboard**
  - Add "Dispatch" tab
  - Show decision history with reasoning
  - Show recent decisions chronologically

- [ ] **Step 6: Test dispatcher logic**
  ```bash
  # Send various webhook events, check dispatcher decisions
  curl http://localhost:3847/api/dispatch-history/42
  # Should show decision history with reasoning
  ```

- [ ] **Step 7: Commit**
  ```bash
  git add -A
  git commit -m "feat: implement centralized action dispatcher

- Create ActionDispatcher class with event→action mapping
- Decision logic based on PR state, event type, rate limits
- Action types: UPDATE_BRANCH, RERUN_GATE, RESOLVE_THREADS, MERGE_PR, SPAWN_AGENT, RESOLVE_CONFLICT, NOOP
- Log all decisions with reasoning for debugging
- Add /api/dispatch-history endpoint
- Update dashboard with dispatch history view"
  ```

**Notes:** Dispatcher is foundation for #1-#4 automation features.

---

### Issue #1: Handle check_run Events for Smart Gate Re-run Logic

**Files:**
- Create: `src/handlers/checkRun.js`
- Modify: `src/actions/rerunGate.js` (implement, currently stub)
- Modify: `src/dispatcher.js` (add check_run decision logic)
- Modify: `src/config.js` (add gateCheckNames config)

**Steps:**

- [ ] **Step 1: Create check_run handler**
  ```javascript
  // src/handlers/checkRun.js
  export async function handle(event, dispatcher, rateLimiter) {
    if (event.action !== 'completed') return;

    const { check_run } = event;
    if (check_run.conclusion !== 'success') return;

    const prNumber = event.pull_request.number;

    // Dispatcher will decide if we should re-run gate
    const actions = await dispatcher.dispatch(event);
    return actions;
  }
  ```

- [ ] **Step 2: Add gateCheckNames to config.js**
  ```javascript
  const defaultConfig = {
    settings: {
      gateCheckNames: ['Codex Review Gate'], // Configurable
      // ...
    }
  };
  ```

- [ ] **Step 3: Implement rerunGate action**
  ```javascript
  // src/actions/rerunGate.js
  import { execSync } from 'child_process';

  export async function rerunGate(context) {
    const { prNumber, repo, checkRunId, gateCheckName } = context;

    try {
      const cmd = `gh api repos/${repo}/check-runs/${checkRunId}/rerequest`;
      execSync(cmd, { stdio: 'inherit' });
      log(`Re-ran gate check "${gateCheckName}" on PR #${prNumber}`);
      return { success: true };
    } catch (err) {
      log(`Failed to re-run gate: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  ```

- [ ] **Step 4: Add check_run decision logic to dispatcher**
  ```javascript
  // In dispatcher.decidActions()
  case 'check_run:completed':
    if (event.check_run.conclusion === 'success') {
      // Check if all non-gate checks pass
      const allChecksPassing = await this.checkAllChecksPassing(
        event.pull_request,
        event.repository
      );

      const gateStatus = await this.getGateCheckStatus(
        event.pull_request,
        this.config.settings.gateCheckNames
      );

      if (allChecksPassing && gateStatus === 'queued') {
        actions.push({
          type: ActionType.RERUN_GATE,
          context: { checkRunId: event.check_run.id, prNumber: ... }
        });
        this.lastReasoning = 'All non-gate checks pass, gate is queued';
      }
    }
    break;
  ```

- [ ] **Step 5: Test gate re-run**
  ```bash
  # Create PR with gate check, make other checks pass
  # Should auto-re-run gate check
  # Verify in event log and GitHub UI
  ```

- [ ] **Step 6: Update dashboard**
  - Show gate check names in Settings
  - Show gate re-run events in event log

- [ ] **Step 7: Commit**
  ```bash
  git add -A
  git commit -m "feat: handle check_run events for smart gate re-run

- Create check_run event handler
- Implement rerunGate action using GitHub API
- Add decision logic: re-run gate when all other checks pass
- Make gate check name(s) configurable
- Rate limit: don't re-run same gate more than once per 2 minutes
- Log all gate re-run attempts"
  ```

---

### Issue #2: Cascade Branch Updates When PR Merges

**Files:**
- Modify: `src/dispatcher.js` (add merge decision logic)
- Modify: `src/actions/updateBranch.js` (implement branch update)
- Modify: `src/prState.js` (add PR listing capability)

**Steps:**

- [ ] **Step 1: Implement updateBranch action**
  ```javascript
  // src/actions/updateBranch.js
  import { execSync } from 'child_process';

  export async function updateBranch(context) {
    const { prNumber, repo } = context;

    try {
      // Use gh api to update branch
      const cmd = `gh api repos/${repo}/pulls/${prNumber}/update-branch --method PUT`;
      execSync(cmd);
      log(`Updated branch for PR #${prNumber}`);
      return { success: true };
    } catch (err) {
      if (err.message.includes('DIRTY')) {
        return { success: false, conflict: true };
      }
      log(`Failed to update branch: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
  ```

- [ ] **Step 2: Add PR listing to prState.js**
  ```javascript
  export async function listOpenPRsForBase(repo, baseBranch) {
    const cmd = `gh pr list --repo ${repo} --state open --json number,headRefName,baseRefName,mergeable`;
    const result = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
    return result.filter(pr => pr.baseRefName === baseBranch);
  }
  ```

- [ ] **Step 3: Add merge detection to dispatcher**
  ```javascript
  // In dispatcher.decidActions()
  case 'pull_request:closed':
    if (event.pull_request.merged) {
      const baseBranch = event.pull_request.base.ref;
      const openPRs = await this.prStateCache.listOpenPRsForBase(
        event.repository.full_name,
        baseBranch
      );

      for (const pr of openPRs) {
        // Don't re-update already updated PRs
        const lastUpdate = await this.prStateCache.getLastUpdateTime(pr.number);
        if (!lastUpdate || Date.now() - lastUpdate > 30000) {
          actions.push({
            type: ActionType.UPDATE_BRANCH,
            context: { prNumber: pr.number, repo: event.repository.full_name }
          });
        }
      }
      this.lastReasoning = `PR merged, updating ${openPRs.length} open PRs targeting ${baseBranch}`;
    }
    break;
  ```

- [ ] **Step 4: Test cascade updates**
  ```bash
  # Merge a PR
  # Should update all other open PRs on same base
  # Check event log for update activities
  ```

- [ ] **Step 5: Update dashboard**
  - Show cascade update events in event log
  - Show "last updated" time per PR

- [ ] **Step 6: Commit**
  ```bash
  git add -A
  git commit -m "feat: cascade branch updates when PR merges

- Detect PR merge via pull_request:closed with merged=true
- List all open PRs targeting same base branch
- Auto-update branches using GitHub API
- Rate limited per PR (minimum 30s between updates)
- Log each branch update
- Handle merge conflicts (return DIRTY status)"
  ```

---

### Issue #3: Auto-resolve Informational Review Threads from Bots

**Files:**
- Modify: `src/actions/resolveThreads.js` (implement thread resolution)
- Modify: `src/dispatcher.js` (add thread resolution logic)
- Modify: `src/config.js` (add autoResolveBots config)

**Steps:**

- [ ] **Step 1: Add autoResolveBots config**
  ```javascript
  const defaultConfig = {
    settings: {
      autoResolveBots: ['coderabbitai', 'chatgpt-codex-connector'],
      // ...
    }
  };
  ```

- [ ] **Step 2: Implement resolveThreads action**
  ```javascript
  // src/actions/resolveThreads.js
  import { execSync } from 'child_process';

  export async function resolveThreads(context) {
    const { prNumber, repo, threadIds } = context;

    let resolved = 0;
    for (const threadId of threadIds) {
      try {
        const mutation = `mutation {
          resolveReviewThread(input: {threadId: "${threadId}"}) {
            thread { isResolved }
          }
        }`;

        execSync(`gh api graphql -f query='${mutation}'`);
        resolved++;
      } catch (err) {
        log(`Failed to resolve thread ${threadId}: ${err.message}`);
      }
    }

    log(`Resolved ${resolved}/${threadIds.length} review threads on PR #${prNumber}`);
    return { success: true, resolved, total: threadIds.length };
  }
  ```

- [ ] **Step 3: Add thread fetching to prState.js**
  ```javascript
  export async function getUnresolvedThreadsFromBot(prNumber, repo, botUsername) {
    const cmd = `gh api repos/${repo}/pulls/${prNumber}/comments --jq '.[] | select(.user.login == "${botUsername}" and .in_reply_to_id != null) | .id'`;
    const threadIds = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return threadIds;
  }
  ```

- [ ] **Step 4: Add thread resolution to dispatcher**
  ```javascript
  // In dispatcher.decidActions()
  case 'pull_request_review:submitted':
    const reviewer = event.review.user.login;
    if (this.config.settings.autoResolveBots.includes(reviewer)) {
      const threadIds = await this.prStateCache.getUnresolvedThreadsFromBot(
        event.pull_request.number,
        event.repository.full_name,
        reviewer
      );

      if (threadIds.length > 0) {
        actions.push({
          type: ActionType.RESOLVE_THREADS,
          context: { prNumber: event.pull_request.number, repo: event.repository.full_name, threadIds }
        });
        this.lastReasoning = `Auto-resolve ${threadIds.length} threads from bot ${reviewer}`;
      }
    }
    break;
  ```

- [ ] **Step 5: Also handle synchronize events**
  ```javascript
  // In dispatcher.decidActions()
  case 'pull_request:synchronize':
    // After push, bot re-reviews. Resolve threads from bots
    for (const bot of this.config.settings.autoResolveBots) {
      const threadIds = await this.prStateCache.getUnresolvedThreadsFromBot(...);
      if (threadIds.length > 0) {
        actions.push({ type: ActionType.RESOLVE_THREADS, ... });
      }
    }
    break;
  ```

- [ ] **Step 6: Test thread resolution**
  ```bash
  # Get a bot review on a PR
  # Should auto-resolve threads
  # Verify in GitHub UI
  ```

- [ ] **Step 7: Update dashboard**
  - Show autoResolveBots config in Settings
  - Show thread resolution events in log

- [ ] **Step 8: Commit**
  ```bash
  git add -A
  git commit -m "feat: auto-resolve informational review threads from bots

- Configure autoResolveBots list (default: coderabbitai, chatgpt-codex-connector)
- On pull_request_review from bot: auto-resolve their threads
- Also resolve on pull_request:synchronize (new push)
- Use GitHub GraphQL API to resolve threads
- Log resolution attempts and results
- Rate limited per PR (minimum 30s between thread resolutions)"
  ```

---

### Issue #4: Detect and Auto-resolve Merge Conflicts on DIRTY PRs

**Files:**
- Modify: `src/actions/mergePr.js` or create conflict resolution action
- Modify: `src/dispatcher.js` (add conflict detection logic)
- Modify: `src/prState.js` (add mergeable state polling)

**Steps:**

- [ ] **Step 1: Add conflict detection to prState.js**
  ```javascript
  export async function getPRMergeableState(prNumber, repo) {
    const cmd = `gh pr view ${prNumber} --repo ${repo} --json mergeable`;
    const result = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
    return result.mergeable; // CLEAN, BEHIND, DIRTY, UNKNOWN
  }
  ```

- [ ] **Step 2: Create conflict resolution action**
  ```javascript
  // src/actions/resolveConflict.js
  export async function resolveConflict(context) {
    // This spawns an agent to handle conflict resolution
    // Agent will: checkout branch, merge, resolve conflicts, push
    return {
      type: 'SPAWN_AGENT',
      prompt: 'merge_conflict',
      context: {
        prNumber: context.prNumber,
        baseBranch: context.baseBranch,
        headBranch: context.headBranch
      }
    };
  }
  ```

- [ ] **Step 3: Add mergeable polling to prState.js**
  ```javascript
  export function startMergeablePolling(config) {
    setInterval(async () => {
      for (const [repo, repoConfig] of Object.entries(config.repos)) {
        const prs = await listOpenPRs(repo);
        for (const pr of prs) {
          const state = await getPRMergeableState(pr.number, repo);
          if (state === 'DIRTY') {
            // Emit conflict detected event
            emitEvent('conflict_detected', { prNumber: pr.number, repo });
          }
        }
      }
    }, config.settings?.mergeableCheckInterval || 60000);
  }
  ```

- [ ] **Step 4: Add conflict detection to dispatcher**
  ```javascript
  // In dispatcher.decidActions(), handle conflict_detected event
  case 'conflict_detected':
    actions.push({
      type: ActionType.RESOLVE_CONFLICT,
      context: event.context
    });
    this.lastReasoning = 'PR has merge conflicts, spawning agent to resolve';
    break;
  ```

- [ ] **Step 5: Create merge_conflict prompt template**
  ```javascript
  // In config.promptTemplates
  merge_conflict: `
    PR #{{prNumber}}: {{prTitle}} has merge conflicts.

    Base branch: {{baseBranch}}
    Head branch: {{headBranch}}
    Repo: {{repo}}

    Resolve the conflict by:
    1. Checkout the head branch
    2. Merge or rebase onto base branch
    3. Resolve conflicts (prefer keeping our changes)
    4. Commit and push

    Do not force-push if resolution fails.
  `
  ```

- [ ] **Step 6: Test conflict detection**
  ```bash
  # Create a conflict scenario
  # Should be detected and spawned to agent
  # Check logs for agent action
  ```

- [ ] **Step 7: Update dashboard**
  - Show conflict detection events
  - Show conflict resolution attempts

- [ ] **Step 8: Commit**
  ```bash
  git add -A
  git commit -m "feat: detect and auto-resolve merge conflicts on DIRTY PRs

- Poll PR mergeable state (CLEAN/BEHIND/DIRTY)
- When DIRTY detected: spawn agent to resolve conflicts
- Agent merges/rebases, resolves conflicts, commits, pushes
- Add merge_conflict prompt template
- Configurable polling interval
- Falls back gracefully if auto-resolution fails"
  ```

---

## Phase 3: Intelligence & Visibility (Issues #6, #8)

### Issue #6: Add /status Endpoint Showing Current PR States

**Files:**
- Create: `src/api/statusApi.js`
- Modify: `src/prState.js` (add comprehensive PR state fetching)
- Modify: `src/dashboard/app.js` (add status tab)

**Steps:**

- [ ] **Step 1: Extend prState.js with status fetching**
  ```javascript
  export async function getPRStatus(prNumber, repo) {
    // Fetch: mergeable state, check runs, reviews, threads
    const pr = await getPRData(prNumber, repo);
    const checks = await getCheckRuns(prNumber, repo);
    const reviews = await getReviews(prNumber, repo);
    const threads = await getUnresolvedThreadCount(prNumber, repo);

    return {
      number: prNumber,
      title: pr.title,
      branch: pr.headRefName,
      mergeable: pr.mergeable,
      ciStatus: determineCIStatus(checks),
      checks: formatChecks(checks),
      reviewState: determineReviewState(reviews),
      unresolvedThreads: threads,
      blockers: determineBlockers(pr, checks, reviews, threads),
      lastUpdated: Date.now()
    };
  }

  function determineBlockers(pr, checks, reviews, threads) {
    const blockers = [];
    if (pr.mergeable === 'BEHIND') blockers.push('BEHIND base branch');
    if (pr.mergeable === 'DIRTY') blockers.push('DIRTY - merge conflicts');
    if (checks.some(c => c.conclusion === 'failure')) blockers.push('Failed checks');
    if (checks.some(c => c.status === 'pending')) blockers.push('Pending checks');
    if (reviews.some(r => r.state === 'CHANGES_REQUESTED')) blockers.push('Changes requested');
    if (threads > 0) blockers.push(`${threads} unresolved threads`);
    if (!reviews.some(r => r.state === 'APPROVED')) blockers.push('Not approved');
    return blockers;
  }
  ```

- [ ] **Step 2: Create status cache**
  ```javascript
  export class StatusCache {
    constructor(ttl = 30000) {
      this.cache = {};
      this.ttl = ttl;
    }

    async getStatus(prNumber, repo, fetcher) {
      const now = Date.now();
      const cached = this.cache[`${repo}:${prNumber}`];

      if (cached && (now - cached.timestamp) < this.ttl) {
        return cached.data;
      }

      const status = await fetcher(prNumber, repo);
      this.cache[`${repo}:${prNumber}`] = { data: status, timestamp: now };
      return status;
    }

    getAll() {
      return Object.values(this.cache)
        .map(c => c.data)
        .sort((a, b) => a.number - b.number);
    }
  }
  ```

- [ ] **Step 3: Create statusApi.js endpoints**
  ```javascript
  // GET /api/status - returns current state of all open PRs
  // POST /api/status/refresh/:repo - manually refresh cache for repo
  // GET /api/status/:repo/:prNumber - get status for specific PR
  ```

- [ ] **Step 4: Implement background polling (optional)**
  ```javascript
  // In server.js
  const statusCache = new StatusCache(30000);
  const pollingInterval = config.settings?.statusPollingInterval || 60000;

  if (pollingInterval > 0) {
    setInterval(async () => {
      for (const [repo, repoConfig] of Object.entries(config.repos)) {
        const prs = await prStateCache.listOpenPRs(repo);
        for (const pr of prs) {
          await statusCache.getStatus(pr.number, repo, getPRStatus);
        }
      }
    }, pollingInterval);
  }
  ```

- [ ] **Step 5: Add Status dashboard tab**
  ```html
  <!-- Status Tab -->
  <div class="tab-content" id="status">
    <h2>Open PRs Status</h2>
    <div id="pr-board"></div>
  </div>

  <!-- PR Card Component -->
  <template id="pr-card">
    <div class="pr-card">
      <div class="pr-header">
        <h3>#<span class="pr-number"></span> <span class="pr-title"></span></h3>
        <span class="pr-branch"></span>
      </div>
      <div class="pr-badges">
        <span class="badge mergeable"></span>
        <span class="badge ci-status"></span>
        <span class="badge review-state"></span>
      </div>
      <div class="pr-blockers">
        <span class="blocker" hidden></span>
      </div>
    </div>
  </template>
  ```

- [ ] **Step 6: Add dashboard JavaScript to fetch and render**
  ```javascript
  async function loadStatus() {
    const response = await fetch('/api/status');
    const prs = await response.json();

    const board = document.getElementById('pr-board');
    board.innerHTML = '';

    for (const pr of prs) {
      const card = createPRCard(pr);
      board.appendChild(card);
    }
  }

  function createPRCard(pr) {
    const template = document.getElementById('pr-card');
    const card = template.content.cloneNode(true);

    card.querySelector('.pr-number').textContent = pr.number;
    card.querySelector('.pr-title').textContent = pr.title;
    card.querySelector('.pr-branch').textContent = pr.branch;

    card.querySelector('.mergeable').textContent = pr.mergeable;
    card.querySelector('.mergeable').className = `badge mergeable ${pr.mergeable.toLowerCase()}`;

    // ... add blockers list
    const blockersList = card.querySelector('.pr-blockers');
    for (const blocker of pr.blockers) {
      const span = document.createElement('span');
      span.className = 'blocker';
      span.textContent = blocker;
      blockersList.appendChild(span);
    }

    return card;
  }

  // Auto-refresh
  setInterval(loadStatus, 10000);
  ```

- [ ] **Step 7: Add CSS for PR cards**
  ```css
  .pr-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 16px;
  }

  .pr-card {
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    background: #161b22;
  }

  .pr-card.blocked {
    border-color: #f85149;
    background: rgba(248, 81, 73, 0.1);
  }

  .pr-badges {
    display: flex;
    gap: 8px;
    margin: 8px 0;
    flex-wrap: wrap;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  .badge.CLEAN { background: #238636; color: white; }
  .badge.BEHIND { background: #d29922; color: white; }
  .badge.DIRTY { background: #f85149; color: white; }

  .pr-blockers {
    margin-top: 8px;
    font-size: 12px;
    color: #f85149;
  }

  .blocker::before {
    content: "⚠ ";
  }
  ```

- [ ] **Step 8: Test status endpoint**
  ```bash
  curl http://localhost:3847/api/status
  # Should return array of PR states with blockers
  ```

- [ ] **Step 9: Commit**
  ```bash
  git add -A
  git commit -m "feat: add /api/status endpoint and Status dashboard

- Create comprehensive PR state fetcher in prState.js
- Implement StatusCache with 30s TTL to avoid API rate limiting
- GET /api/status returns all open PRs with merge/CI/review state
- Compute blockers array: what prevents merge
- Add Status dashboard tab with PR cards
- Visual badges for mergeable state, CI status, review state
- Optional background polling to keep cache warm
- Manual refresh endpoint: POST /api/status/refresh/:repo"
  ```

---

### Issue #8: Store Monitoring Prompt in Repo for Claude Code Agents

**Files:**
- Create: `prompts/monitoring-agent.md`
- Create: `prompts/README.md`

**Steps:**

- [ ] **Step 1: Create prompts directory structure**
  ```bash
  mkdir -p prompts
  ```

- [ ] **Step 2: Write comprehensive monitoring prompt**
  ```markdown
  # GitHub Webhook Monitor - Manual Monitoring Agent Prompt

  ## Role
  You are a PR monitoring agent responsible for managing the queue of open pull requests during active development. Your job is to keep PRs flowing toward merge by automating repetitive checks, detecting blockers, and suggesting or executing fixes.

  ## Core Responsibilities (in priority order)

  ### 1. CI Status Monitoring
  - Poll all open PRs every 30 seconds
  - Check: build status, test status, lint status, gate check status
  - Identify which PRs are "ready to merge" vs "waiting on CI"
  - Log CI transitions (pending → passing, passing → failing, etc.)

  ### 2. Gate Check Management (Codex Review Gate)
  - The Codex Review Gate has a 5-minute re-run window after other checks pass
  - Monitor for: all non-gate checks passing + gate queued
  - When detected: immediately re-run the gate using `gh api repos/{repo}/check-runs/{id}/rerequest`
  - Log each gate re-run with timestamp
  - Do NOT re-run the same gate more than once per 2 minutes

  ### 3. Branch Staleness (BEHIND state)
  - Monitor mergeable state of all open PRs
  - When a PR becomes BEHIND: run `gh pr update-branch PR#` to sync with base
  - Track the cascade: when PR#1 merges, other PRs become BEHIND, update them
  - For sequential merges: update PR#2 → wait for CI → merge PR#2 → update PR#3, etc.

  ### 4. Merge Conflict Resolution
  - Monitor for DIRTY mergeable state (merge conflicts)
  - When detected: spawn Claude Code agent to resolve
  - Agent should: checkout branch, merge base, resolve conflicts, commit, push
  - Do NOT force-push if conflicts can't be auto-resolved

  ### 5. Review Thread Management
  - Monitor review threads from bot reviewers (coderabbitai, chatgpt-codex-connector)
  - These bots post 5-15 informational threads per PR review
  - Use GitHub GraphQL API to resolve threads:
    ```
    gh api graphql -f query='mutation {
      resolveReviewThread(input: {threadId: "MDEyOklzc3VlQ29tbWVudDE="}) {
        thread { isResolved }
      }
    }'
    ```
  - Resolve ALL unresolved threads from configured auto-resolve bots

  ### 6. Ready-to-Merge Detection
  - A PR is ready to merge when:
    - Mergeable = CLEAN
    - All checks = passing
    - Review state = APPROVED
    - No unresolved threads
  - When ready: either auto-merge (if enabled) or notify human

  ## Decision Tree: What to Do Next

  Given a PR number, check in this order:

  1. **What's the mergeable state?**
     - CLEAN: proceed to step 2
     - BEHIND: update branch, wait 30s for CI, loop back
     - DIRTY: spawn conflict resolution agent, wait, loop back
     - UNKNOWN: fetch fresh PR data, loop back

  2. **Are all checks passing?**
     - All passing: proceed to step 3
     - Some pending: wait 30s, loop back
     - Some failed: spawn agent to fix failures (if not a gate)
     - Gate pending + others passing: re-run gate, loop back

  3. **Is the PR approved?**
     - Approved: proceed to step 4
     - Changes requested: wait for human/agent fix, loop back
     - Not yet: wait, loop back

  4. **Any unresolved threads?**
     - No threads: PR is ready to merge ✓
     - Threads from bots: resolve them, loop back
     - Threads from humans: wait for human to resolve, loop back

  ## GitHub CLI Commands Reference

  ### Check PR status
  ```bash
  gh pr view PR# --repo OWNER/REPO --json number,title,mergeable,reviewDecision
  ```

  ### List all open PRs with mergeable state
  ```bash
  gh pr list --repo OWNER/REPO --state open --json number,title,mergeable
  ```

  ### Update a branch
  ```bash
  gh pr update-branch PR# --repo OWNER/REPO
  ```

  ### Get all check runs for a PR
  ```bash
  gh api repos/OWNER/REPO/commits/SHA/check-runs
  ```

  ### Re-run a specific check
  ```bash
  gh api repos/OWNER/REPO/check-runs/CHECK_RUN_ID/rerequest --method POST
  ```

  ### List review comments
  ```bash
  gh api repos/OWNER/REPO/pulls/PR#/comments
  ```

  ### Resolve a review thread (GraphQL)
  ```bash
  gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "THREAD_ID"}) { thread { isResolved } } }'
  ```

  ### Auto-merge a PR
  ```bash
  gh pr merge PR# --repo OWNER/REPO --auto --squash
  ```

  ## Known Bot Behaviors

  ### coderabbitai
  - Posts detailed review comments on every PR
  - Comments are informational (P2) and don't require action
  - Resolves review threads when you request it
  - Safe to auto-resolve all unresolved threads from this bot

  ### chatgpt-codex-connector
  - Posts review threads with code suggestions
  - Threads block merge until resolved
  - Use GraphQL API to resolve
  - Occasionally posts false positives; human should review if unsure

  ### github-actions[bot]
  - Posts CI check results
  - Ignore review threads from this bot (they don't affect merge)

  ## Rate Limiting & Safety

  - Don't check the same PR more than once per 30 seconds
  - Don't re-run the same check more than once per 2 minutes
  - Don't try to update DIRTY branch more than once per 2 minutes
  - Do NOT force-push unless absolutely necessary
  - When in doubt, escalate to human instead of assuming

  ## Success Metrics

  - All open PRs are either: merged, ready to merge, or explicitly blocked
  - No PR waits more than 5 minutes for actionable steps
  - Branch staleness is caught immediately after each merge
  - Gate checks are re-run within 5-minute window
  - Bot threads don't block the pipeline
  ```

- [ ] **Step 3: Create prompts/README.md**
  ```markdown
  # Monitoring Prompts

  This directory contains reusable prompts for different monitoring scenarios.

  ## Using with Claude Code

  ### Manual PR Monitoring Session

  When you want to manually monitor a repo during active development:

  1. Start Claude Code session in the monitored repo directory
  2. Load the monitoring prompt:
     \`\`\`
     /prompt file:./prompts/monitoring-agent.md
     \`\`\`
  3. Reference your specific values:
     - Replace OWNER/REPO with your repository
     - Replace PR# with specific PR numbers
     - Adjust decision intervals (30s, 2 min, 5 min) based on your workflow

  ### Parameterization

  When using with your own repos, substitute:
  - `OWNER/REPO` → your actual repo (e.g., `vega113/gh-webhook-monitor`)
  - `PR#` → specific PR number
  - `SHA` → specific commit SHA (get with `git rev-parse HEAD`)

  ### Integration with Webhook Server

  The webhook server already implements these behaviors automatically. Use these prompts when:
  - Running Claude Code in a terminal window during active monitoring
  - Testing monitoring logic without the webhook server
  - Documenting the monitoring workflow for team knowledge

  ## Prompts

  - **monitoring-agent.md** — Comprehensive PR monitoring workflow. Handles CI status, gate re-runs, branch updates, conflict resolution, thread management.
  ```

- [ ] **Step 4: Test prompts are accessible**
  ```bash
  ls -la prompts/
  # Should show monitoring-agent.md and README.md
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add -A
  git commit -m "docs: add comprehensive monitoring agent prompt

- Create prompts/monitoring-agent.md with full monitoring workflow
- Document all responsibilities: CI monitoring, gate re-runs, branch updates, conflict resolution, thread resolution, merge detection
- Include decision tree for what to do next given PR state
- Document all relevant gh CLI commands with examples
- Document known bot behaviors (coderabbitai, chatgpt-codex-connector, github-actions)
- Add rate limiting guidance and safety rules
- Create prompts/README.md with usage instructions for Claude Code sessions"
  ```

---

## Execution Summary

**10 Issues, 3 Phases:**

1. **Phase 1: Foundation** — Refactor (#9), Agent Config (#10), Rate Limiting (#5)
2. **Phase 2: Automation** — Action Dispatcher (#7), then Check Run Events (#1), Cascade Updates (#2), Thread Resolution (#3), Conflict Resolution (#4)
3. **Phase 3: Intelligence** — Status Endpoint (#6), Monitoring Prompt (#8)

**Each issue produces 1 PR** with comprehensive code reviews.

**Key dependencies:**
- #9 (refactor) is prerequisite for clean architecture
- #5 (rate limiting) enables deduplication for #1-#4
- #7 (dispatcher) is architectural foundation for intelligent #1-#4

**Total estimated scope:** ~40-50 tasks across 10 issues, ~100-150 hours of implementation work (substantial but well-structured).
