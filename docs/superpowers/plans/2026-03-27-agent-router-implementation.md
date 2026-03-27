# Agent Router Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative-hybrid router that chooses effective agent/model per job, using `gpt-5.4-mini` for read-only Codex triage and `gpt-5.4` for code-writing or high-risk work while preserving configured Claude defaults.

**Architecture:** Add a pure routing module plus a small config section, wire both spawn paths through a shared routing helper, and log the decision on every spawn. Keep first-pass scope limited to deterministic pre-spawn classification.

**Tech Stack:** Node.js, Express, node:test

---

## Chunk 1: Routing Core

### Task 1: Add failing router classification tests

**Files:**
- Create: `tests/agent-router.test.js`
- Create: `src/agentRouter.js`

- [ ] **Step 1: Write failing tests for mini/full classification, priority, and fallback**
- [ ] **Step 2: Run `node --test tests/agent-router.test.js` and verify failure**
- [ ] **Step 3: Implement the minimal pure routing module**
- [ ] **Step 4: Re-run `node --test tests/agent-router.test.js` and verify pass**

### Task 2: Add router config defaults

**Files:**
- Modify: `src/config.js`
- Modify: `config.json`
- Modify: `config.example.json`
- Test: `tests/agent-router.test.js`

- [ ] **Step 1: Add failing assertions for router config defaults if needed**
- [ ] **Step 2: Implement `agentRouter` config defaults and saved runtime config**
- [ ] **Step 3: Re-run router tests and verify pass**

## Chunk 2: Spawn Integration

### Task 3: Route `spawnAgent` and `spawnAgentWithReaction`

**Files:**
- Modify: `src/actions/spawnAgent.js`
- Modify: `src/actions/spawnAgentWithReaction.js`
- Test: `tests/spawnAgent.test.js`

- [ ] **Step 1: Add failing tests proving Codex jobs use `gpt-5.4-mini` for mini-tier and `gpt-5.4` for full-tier**
- [ ] **Step 2: Run the focused spawn/router tests and verify failure**
- [ ] **Step 3: Wire both spawn paths through a shared routing helper and add routing logs**
- [ ] **Step 4: Re-run the focused tests and verify pass**

### Task 4: Update dashboard-visible defaults

**Files:**
- Modify: `src/dashboard/html.js`
- Test: `tests/agent-model.test.js`

- [ ] **Step 1: Add/update failing assertions if needed for router-exposed Codex defaults**
- [ ] **Step 2: Implement dashboard-facing router config/model defaults**
- [ ] **Step 3: Re-run focused tests and verify pass**

## Chunk 3: End-to-End Verification

### Task 5: Run full suite and review diffs

**Files:**
- Verify only

- [ ] **Step 1: Run `node --test tests/*.test.js`**
- [ ] **Step 2: Inspect `git diff --stat` and ensure no unrelated changes**
- [ ] **Step 3: Restart the monitor if runtime config changed**
