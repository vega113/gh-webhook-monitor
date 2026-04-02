# Dashboard PR Operations Design

**Date:** 2026-04-02

## Goal

Replace the current card-based live dashboard with a repo-grouped PR operations table that scales to large queues, keeps per-PR controls accessible, and surfaces inline operational detail without forcing the page to grow vertically.

## User Requirements

- Replace the current dashboard view rather than adding a second view.
- Show one top-level row per repo.
- Expanding a repo reveals PR rows in a table.
- Infinite scroll applies only to PR rows inside each expanded repo.
- Each PR can expand/collapse for details.
- Log/output must render inline inside the PR panel, not in a global lower panel.
- The dashboard must support filtering.
- The dashboard must support pause/resume per PR.
- Pause means the monitor still polls and updates status, but stops corrective actions such as resolving review threads, resolving conflicts, or responding to unresolved comments.
- The dashboard must support toggling GitHub native auto-merge per PR.
- Time values should be shown in browser-local time.

## Proposed Architecture

Keep the existing server-rendered dashboard and extend the current snapshot-driven API so the view can evolve later into a more paged API without forcing a frontend rewrite now.

The implementation has three layers:

1. Monitor control state
- Add persisted monitor-local PR controls for pause/resume.
- These controls are read by webhook/dispatcher execution paths before corrective actions run.
- Polling and status refresh remain enabled even while paused.

2. Dashboard read model
- Extend dashboard snapshot rows so PRs are represented as table rows with explicit action state.
- Add fields needed by the UI instead of deriving them from badges or free-form logs.
- Keep current snapshot generation, but shape data so per-repo paging can be split into dedicated endpoints later.

3. Dashboard UI
- Replace repo cards + PR cards with repo group rows and expandable PR tables.
- Add per-repo filter state, per-repo lazy row rendering, and inline expanded PR detail panels.
- Move log/output rendering into expanded PR rows.

## Data Model Changes

Each PR row in the snapshot should expose:

- `isPaused`
- `autoMergeEnabled`
- `hasActiveJob`
- `activeJobElapsed`
- `lastJobDuration`
- `nextPollInSeconds` or `nextPollAt`
- `jobCount`
- `latestActionSummary`
- `canPause`
- `canResume`
- `canToggleAutoMerge`

Each repo group should expose:

- repo identity
- summary counts
- full PR row list for now
- enough metadata to support future repo-local paging without changing the row shape

## Pause Behavior

Paused PRs should:

- continue to receive status updates from polling and webhook-driven cache refresh
- remain visible in the dashboard
- remain filterable by paused state
- block monitor corrective actions triggered by webhook handlers and dispatcher action execution

Paused PRs should not:

- auto-resolve review threads
- auto-resolve merge conflicts
- auto-spawn corrective agent runs for unresolved review feedback / review-comment handling

The pause gate should be centralized enough that new corrective actions cannot bypass it silently.

## Auto-Merge Behavior

The per-PR auto-merge toggle should only map to GitHub native auto-merge. It should not create a second monitor-local merge policy flag.

The dashboard should fetch and display current auto-merge state and provide a direct action endpoint to enable or disable it.

## UI Layout

Top level:
- one row per repo
- summary columns visible while collapsed
- clicking expands a PR table for that repo

Expanded repo section:
- sticky header row for PR columns
- vertically scrollable body
- lazy incremental rendering / pagination inside that repo section only

PR row columns:
- PR ref / title
- base branch
- CI status
- review status
- blockers summary
- paused state
- active job state / elapsed time
- last agent work duration
- next poll timing
- auto-merge state
- row actions

Expanded PR detail panel:
- detailed blockers and waiting reason
- recent jobs / actions
- inline log/output viewer
- pause/resume control
- auto-merge toggle

## Filtering

Per-repo filtering should support:

- free text matching PR number, title, branch
- CI failed
- review pending / changes requested
- paused
- active job
- auto-merge enabled

Filtering is repo-local because the UI model is repo-first.

## Inline Log/Output

The existing global detail panel should be removed.

Inline PR detail should:
- render job history directly inside the expanded PR panel
- allow selecting log or output for each job/action
- keep only the requested PR expanded unless the user expands others
- avoid forcing the entire page to jump

## Scalability Strategy

Initial version:
- build on the existing snapshot API
- client renders repo groups and slices visible PR rows per expanded repo
- infinite scroll is implemented as progressive reveal inside each repo section

Future-compatible shape:
- add optional repo-local paged endpoints later without changing row semantics
- keep action endpoints separate from snapshot read models

## Action Endpoints

Add focused write endpoints:

- `POST /api/pr/:owner/:repo/:number/pause`
- `POST /api/pr/:owner/:repo/:number/resume`
- `POST /api/pr/:owner/:repo/:number/auto-merge`

These should return enough state to update the row without a full page reload, while the websocket snapshot remains the source of truth.

## Testing Strategy

- snapshot/data tests for new PR row fields and repo-group rendering data
- handler/dispatcher tests that verify paused PRs suppress corrective actions but still update status-related state
- API tests for pause/resume and auto-merge endpoints
- dashboard HTML tests that validate table layout markers, inline PR detail markers, and removal of the global job detail panel

## Risks

- If pause checks are scattered, corrective actions can still leak through; use one shared pause-state read path.
- If too much derived UI logic stays in HTML generation, the file will become brittle; move row-shaping logic into snapshot/data helpers first.
- If the snapshot becomes too large, follow-up should split repo PR rows into paged endpoints without reworking the action model.
