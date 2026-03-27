# Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the polling tabbed dashboard with a single actionable one-page live dashboard that groups PRs/issues by repository and updates in place over WebSockets.

**Architecture:** Add a dashboard snapshot builder on the server, expose it through a WebSocket channel and a snapshot API, then simplify the frontend into one page that renders per-repository cards and updates without full-page/tab rerenders. Keep log viewing in-page.

**Tech Stack:** Node.js, Express, ws, node:test

---

## Chunk 1: Data Model and Transport

### Task 1: Add failing dashboard snapshot tests

**Files:**
- Create: `tests/dashboard-snapshot.test.js`
- Create: `src/dashboard/snapshot.js`

- [ ] **Step 1: Write failing tests for repository-grouped actionable snapshot shape**
- [ ] **Step 2: Run `node --test tests/dashboard-snapshot.test.js` and verify failure**
- [ ] **Step 3: Implement minimal snapshot builder**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 2: Add WebSocket server support

**Files:**
- Modify: `package.json`
- Modify: `server.js`
- Create: `src/dashboard/liveHub.js`
- Test: `tests/dashboard-snapshot.test.js`

- [ ] **Step 1: Add the `ws` dependency using current docs/version guidance**
- [ ] **Step 2: Implement a minimal WebSocket hub that sends full snapshots**
- [ ] **Step 3: Wire broadcasts to webhook handling and periodic status refresh points**
- [ ] **Step 4: Re-run focused tests and verify pass**

## Chunk 2: One-Page UI

### Task 3: Add failing dashboard HTML tests

**Files:**
- Modify: `tests/dashboard-html.test.js`
- Modify: `src/dashboard/html.js`

- [ ] **Step 1: Write failing tests for one-page layout and WebSocket bootstrap**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js` and verify failure**
- [ ] **Step 3: Replace the tabbed polling UI with a single live dashboard page**
- [ ] **Step 4: Re-run focused tests and verify pass**

### Task 4: Implement PR/issue/job cards and in-page logs

**Files:**
- Modify: `src/dashboard/html.js`
- Modify: `src/api/routes.js`
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Render repository sections with actionable PRs/issues and job history**
- [ ] **Step 2: Show PR age, iteration count, current wait reason, and log/output links**
- [ ] **Step 3: Keep log viewing in-page without disruptive rerendering**
- [ ] **Step 4: Re-run focused tests and verify pass**

## Chunk 3: End-to-End Verification

### Task 5: Run full suite and restart

**Files:**
- Verify only

- [ ] **Step 1: Run `node --test tests/*.test.js`**
- [ ] **Step 2: Manually verify the live dashboard against the running server**
- [ ] **Step 3: Restart the monitor so the new dashboard is live**
