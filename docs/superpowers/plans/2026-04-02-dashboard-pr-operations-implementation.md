# Dashboard PR Operations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current card-based dashboard with a repo-grouped expandable PR operations table with per-PR pause/resume, native auto-merge toggle, inline log/output, and repo-local infinite scroll.

**Architecture:** Extend the existing snapshot model with explicit PR control/action fields, add persisted monitor-local pause state plus dedicated action endpoints, and then swap the dashboard HTML to a repo-grouped grid that progressively reveals PR rows inside each expanded repo.

**Tech Stack:** Node.js, Express, server-rendered HTML/JS, GitHub CLI/GraphQL, node:test

---

## Chunk 1: Control State And GitHub Actions

### Task 1: Add persisted PR control state storage

**Files:**
- Create: `src/prControlState.js`
- Test: `tests/pr-control-state.test.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `node --test tests/pr-control-state.test.js` and verify it fails**
- [ ] **Step 3: Implement persisted pause-state read/write helpers keyed by `owner/repo#prNumber`**
- [ ] **Step 4: Re-run `node --test tests/pr-control-state.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 2: Add pause/resume API endpoints

**Files:**
- Modify: `src/api/routes.js`
- Modify: `src/api/statusApi.js` if helper extraction is cleaner there
- Test: `tests/pr-control-api.test.js`

- [ ] **Step 1: Write the failing API tests for pause/resume endpoints**
- [ ] **Step 2: Run `node --test tests/pr-control-api.test.js` and verify it fails**
- [ ] **Step 3: Implement pause/resume endpoints returning updated PR control state**
- [ ] **Step 4: Re-run `node --test tests/pr-control-api.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 3: Add native auto-merge toggle endpoint

**Files:**
- Modify: `src/api/routes.js`
- Create or modify: `src/actions/toggleAutoMerge.js`
- Test: `tests/auto-merge-api.test.js`

- [ ] **Step 1: Write the failing API tests for enabling/disabling native auto-merge**
- [ ] **Step 2: Run `node --test tests/auto-merge-api.test.js` and verify it fails**
- [ ] **Step 3: Implement the GitHub CLI/API integration and response shaping**
- [ ] **Step 4: Re-run `node --test tests/auto-merge-api.test.js` and verify it passes**
- [ ] **Step 5: Commit**

## Chunk 2: Pause Enforcement In Monitor Logic

### Task 4: Gate corrective actions behind pause state

**Files:**
- Modify: `server.js`
- Modify: `src/handlers/pullRequestReview.js`
- Modify: `src/handlers/checkSuite.js`
- Modify: `src/handlers/checkRun.js`
- Modify: `src/handlers/pullRequestConflict.js`
- Modify: `src/backlogActions.js` if backlog action generation also needs pause awareness
- Test: `tests/pr-pause-behavior.test.js`

- [ ] **Step 1: Write the failing tests proving paused PRs still refresh status but skip corrective actions**
- [ ] **Step 2: Run `node --test tests/pr-pause-behavior.test.js` and verify it fails**
- [ ] **Step 3: Implement a shared pause check and apply it consistently to corrective action paths**
- [ ] **Step 4: Re-run `node --test tests/pr-pause-behavior.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 5: Surface auto-merge and pause state in snapshot data

**Files:**
- Modify: `src/dashboard/data.js`
- Modify: `src/dashboard/snapshot.js`
- Modify: `src/statusCache.js`
- Test: `tests/dashboard-snapshot.test.js`

- [ ] **Step 1: Write the failing snapshot test for pause state, auto-merge state, active job timing, last job duration, and next poll metadata**
- [ ] **Step 2: Run `node --test tests/dashboard-snapshot.test.js` and verify it fails**
- [ ] **Step 3: Implement snapshot row shaping for the new table fields**
- [ ] **Step 4: Re-run `node --test tests/dashboard-snapshot.test.js` and verify it passes**
- [ ] **Step 5: Commit**

## Chunk 3: Repo-Grouped PR Table UI

### Task 6: Replace card layout with repo-grouped expandable tables

**Files:**
- Modify: `src/dashboard/html.js`
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Write the failing HTML test that expects repo group rows, PR table markup, and removal of the old card-only layout assumptions**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js` and verify it fails**
- [ ] **Step 3: Implement the repo-grouped table shell with collapsible repo sections and PR rows**
- [ ] **Step 4: Re-run `node --test tests/dashboard-html.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 7: Add repo-local filtering and infinite scroll

**Files:**
- Modify: `src/dashboard/html.js`
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Extend tests to expect repo-local filter controls and progressive row rendering hooks**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js` and verify it fails**
- [ ] **Step 3: Implement per-repo filter state and incremental PR row reveal inside expanded repos**
- [ ] **Step 4: Re-run `node --test tests/dashboard-html.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 8: Move log/output into expanded PR detail panels

**Files:**
- Modify: `src/dashboard/html.js`
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Write the failing test expecting inline PR detail log/output hooks and removal of the global job detail panel**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js` and verify it fails**
- [ ] **Step 3: Implement per-PR expandable detail panels with inline log/output rendering**
- [ ] **Step 4: Re-run `node --test tests/dashboard-html.test.js` and verify it passes**
- [ ] **Step 5: Commit**

### Task 9: Add per-PR pause/resume and auto-merge controls to the table

**Files:**
- Modify: `src/dashboard/html.js`
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Write the failing test expecting pause/resume and auto-merge controls in PR rows/details**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js` and verify it fails**
- [ ] **Step 3: Implement the client-side action handlers and optimistic UI refresh path**
- [ ] **Step 4: Re-run `node --test tests/dashboard-html.test.js` and verify it passes**
- [ ] **Step 5: Commit**

## Chunk 4: Final Verification And Integration

### Task 10: Run the full suite and validate deployment flow

**Files:**
- Modify: none unless failures require follow-up fixes
- Test: `tests/*.test.js`

- [ ] **Step 1: Run `node --test tests/*.test.js`**
- [ ] **Step 2: Fix any failing tests minimally and re-run until green**
- [ ] **Step 3: Commit the final integrated dashboard rewrite**
- [ ] **Step 4: Merge back to `main`, push `origin/main`, and restart the server per `AGENTS.md`**
