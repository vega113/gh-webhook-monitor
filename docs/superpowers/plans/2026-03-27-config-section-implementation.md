# Config Section Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw JSON config editor in the one-page dashboard with a human-facing Config section for repositories, agents, prompts, and settings.

**Architecture:** Keep the single-page live dashboard, but add a dedicated Config section with grouped forms and save actions. Reuse existing API endpoints where possible so the UI remains the only major change.

**Tech Stack:** Node.js, Express, node:test, existing vanilla JS dashboard

---

## Chunk 1: UI Contract

### Task 1: Add failing dashboard HTML tests

**Files:**
- Modify: `tests/dashboard-html.test.js`
- Modify: `tests/agent-model.test.js`

- [ ] **Step 1: Write failing tests for the dedicated Config section and removal of raw JSON editor**
- [ ] **Step 2: Run `node --test tests/dashboard-html.test.js tests/agent-model.test.js` and verify failure**
- [ ] **Step 3: Implement the minimal HTML structure for the new Config section**
- [ ] **Step 4: Re-run the focused tests and verify pass**

## Chunk 2: Config UX

### Task 2: Add repository and agent controls

**Files:**
- Modify: `src/dashboard/html.js`

- [ ] **Step 1: Add repo table with enable/remove/add controls**
- [ ] **Step 2: Add agent controls for default agent, repo override, codex/claude settings**
- [ ] **Step 3: Reuse existing API calls for persistence**

### Task 3: Add prompts and settings controls

**Files:**
- Modify: `src/dashboard/html.js`

- [ ] **Step 1: Add prompt editors per template with save action**
- [ ] **Step 2: Add human-facing settings controls for the key monitor settings**
- [ ] **Step 3: Remove raw JSON config editor completely**

## Chunk 3: Verification

### Task 4: Run suite and restart

**Files:**
- Verify only

- [ ] **Step 1: Run `node --test tests/*.test.js`**
- [ ] **Step 2: Restart the monitor**
- [ ] **Step 3: Verify the live page exposes the Config section and no raw JSON editor**
