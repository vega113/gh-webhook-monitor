# Agent Safety Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the webhook secret to environment-only runtime config and strengthen agent instructions around secret handling and stale-branch merges.

**Architecture:** Keep persisted config focused on non-secret operational settings, add a startup env validation path, and tighten prompt text in the default templates plus the reusable monitoring prompt. Cover the behavior with focused regression tests.

**Tech Stack:** Node.js, Express, node:test

---

## Chunk 1: Runtime Secret Enforcement

### Task 1: Add failing config tests

**Files:**
- Create: `tests/config-secret.test.js`
- Modify: `src/config.js`

- [ ] **Step 1: Write failing tests for env-only secret behavior**
- [ ] **Step 2: Run `node --test tests/config-secret.test.js` and verify failure**
- [ ] **Step 3: Implement minimal config changes to ignore persisted `webhookSecret` and read `GITHUB_WEBHOOK_SECRET` only**
- [ ] **Step 4: Run `node --test tests/config-secret.test.js` and verify pass**

### Task 2: Add startup validation

**Files:**
- Modify: `src/config.js`
- Modify: `server.js`
- Test: `tests/config-secret.test.js`

- [ ] **Step 1: Write a failing test for required startup env validation**
- [ ] **Step 2: Run `node --test tests/config-secret.test.js` and verify failure**
- [ ] **Step 3: Implement `GITHUB_WEBHOOK_SECRET` validation and wire it into startup**
- [ ] **Step 4: Re-run `node --test tests/config-secret.test.js` and verify pass**

## Chunk 2: Prompt and Repo Guardrails

### Task 3: Add failing prompt coverage

**Files:**
- Create: `tests/prompt-templates.test.js`
- Modify: `src/config.js`
- Modify: `prompts/monitoring-agent.md`

- [ ] **Step 1: Write failing tests asserting prompt templates mention secret handling and latest-main refresh**
- [ ] **Step 2: Run `node --test tests/prompt-templates.test.js` and verify failure**
- [ ] **Step 3: Update default templates and monitoring prompt text**
- [ ] **Step 4: Re-run `node --test tests/prompt-templates.test.js` and verify pass**

### Task 4: Remove tracked secret examples and refresh docs

**Files:**
- Modify: `config.example.json`
- Modify: `config.json`
- Modify: `README.md`
- Modify: `setup.sh`

- [ ] **Step 1: Remove `webhookSecret` from tracked config files and update docs/scripts to use `GITHUB_WEBHOOK_SECRET`**
- [ ] **Step 2: Run focused tests plus a full `node --test tests/*.test.js` pass**
- [ ] **Step 3: Review diffs for any remaining tracked secret references**
