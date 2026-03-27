# Agent Router Design

## Goal
Add a router to gh-webhook-monitor that chooses both agent family and model strength per job, with a conservative hybrid policy: cheap/read-only first-pass work should use lighter models, but any task involving code edits, merge/conflict handling, deployment-critical fixes, or default-branch incidents should route to full-strength execution.

## Decisions
- Routing happens in monitor code, not by relying on prompt text.
- The router is cross-agent aware: it chooses the effective agent family and the effective model for a given job.
- The router preserves the configured preferred agent per repo unless a future explicit override policy is added.
- Within Codex, the router should choose between `gpt-5.4-mini` and `gpt-5.4`.
- The default routing policy is conservative hybrid:
  - `gpt-5.4-mini` for read-only triage, summaries, informational comment handling, and post-merge observation/reporting.
  - `gpt-5.4` for anything likely to require code writing, merge/conflict resolution, branch updates, auth-sensitive changes, deploy-failure fixes, or default-branch breakage remediation.
- First pass is pre-spawn classification only. No mid-run handoff or dynamic escalation inside a single spawned process.
- Tier priority is explicit: if a job matches both mini-tier and full-tier rules, full-tier wins.

## Scope
This feature affects only how the monitor decides what command-line/model configuration to pass when spawning an agent job. It does not introduce a second-level workflow engine, task decomposition, or prompt-driven model switching.

## Architecture
### 1. Routing module
Add a focused router module that accepts:
- event/job type
- repo name
- preferred agent from config
- raw payload metadata needed for deterministic rules only:
  - action/state fields
  - labels
  - branch/default-branch
  - known high-risk booleans derived by handlers (for example merge-conflict, deploy-failure, auth-sensitive)

It returns a routing decision object such as:
- preferred agent
- effective agent
- model tier (`mini` or `full`)
- effective model string
- human-readable rationale for logs/tests

This module should be pure and easy to unit test.

### 2. Classification policy
The first implementation uses deterministic rules based on event type and known high-signal fields.

### Priority rule
Apply full-tier rules first. If none match, evaluate mini-tier rules. If neither match, fall back to the repo/default configured agent model.

#### Mini-tier cases
Route to mini when the work is expected to be read-only or advisory:
- `check_suite` on default branch when the handler classifies the incident as inspection/reporting only
- `issue_comment` only when no trigger keyword matched and the comment is classified as informational by the existing handler path
- review triage only for `commented` state, not `changes_requested`
- post-merge gate observation and branch health reporting

#### Full-tier cases
Route to full when the task is likely to involve writing code or handling high-risk branch state:
- `agent_task`
- `issue_followup`
- merge conflicts
- PR reviews with `changes_requested`
- tasks labeled `deploy-failure`
- auth/login/registration-sensitive work
- default-branch breakage that is expected to need a fix, not just diagnosis
- any unknown event that is still routed to agent execution by current monitor logic

### 3. Agent-family handling
The repo-level configured agent remains the preferred family:
- if repo is configured for `codex`, route between `gpt-5.4-mini` and `gpt-5.4`
- if repo is configured for `claude`, keep Claude as the effective family and use its configured model/defaults for now

This keeps the first pass small and avoids inventing unsupported cross-vendor model mapping. Claude tiering is an explicit first-pass limitation, not deferred hidden scope: Claude repos keep their configured model until a later dedicated change adds Claude-tier support.

### 4. Spawn integration
`spawnAgent` and `spawnAgentWithReaction` should both use a shared routing helper so there is one classification path and one set of tests.

For Codex jobs:
- full tier sets model to `gpt-5.4`
- mini tier sets model to `gpt-5.4-mini`

For Claude jobs:
- keep the configured Claude model/defaults unchanged in first pass
- log that routing preserved configured Claude settings because Claude tiering is out of scope in first pass

### 5. Observability
Every spawn should log the routing decision:
- preferred agent
- effective agent
- chosen model
- tier (`mini`/`full`)
- reason

This is necessary so the router can be audited when a task was under- or over-powered.

## Data Model
Add a router config section under settings or agent config, for example:
- `enabled`
- `policy` (`conservative-hybrid`)
- explicit model names for codex full/mini
- optional event overrides later

First pass can default to enabled and conservative hybrid without exposing too many knobs. Invalid configured model names must fall back to the router's hardcoded safe defaults and log the fallback.

## Error Handling
- If router inputs are incomplete, fall back in this order:
  - repo-level configured agent/model
  - global configured default agent/model
  - hardcoded safe defaults in the router module
- If a selected agent cannot express a requested tier/model, use that agent’s configured defaults and log fallback reason.
- Routing errors must never prevent the monitor from spawning an agent; they degrade to default behavior.

## Testing
Add unit tests for:
- event classification into mini vs full
- priority/conflict cases where a job matches both mini and full rules
- Codex effective model mapping (`gpt-5.4-mini` vs `gpt-5.4`)
- fallback behavior for Claude repos
- fallback behavior for missing/invalid configured model names
- spawn integration proving the chosen model lands in the built command
- logged rationale or returned routing metadata shape

## Non-goals
- Mid-run escalation/handoff from mini to full
- Multi-agent collaboration inside one job
- Semantic analysis of prompt text
- Automatic switching from Claude repos to Codex repos or vice versa without explicit future policy
