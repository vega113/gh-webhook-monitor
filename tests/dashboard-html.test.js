import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatDashboardTimestamp, getDashboardHTML } from "../src/dashboard/html.js";

test("dashboard renders inline PR detail instead of a persistent global job detail panel", () => {
  const html = getDashboardHTML();

  assert.equal(html.includes('id="jobDetailPanel"'), false, "global job detail panel should be removed");
  assert.ok(html.includes("renderPrDetailPanel"), "missing inline PR detail renderer");
  assert.ok(html.includes('data-action="togglePrExpanded"') || html.includes("togglePrExpanded"), "missing PR expand/collapse action");
  assert.ok(html.includes('data-action="showInlineJobDetail"') || html.includes("showInlineJobDetail"), "missing inline log/output action");
});

test("dashboard head exposes explicit PNG favicons and a real ICO fallback", () => {
  const html = getDashboardHTML();
  const faviconBytes = readFileSync("public/favicon.ico");

  assert.ok(
    html.includes('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">'),
    "missing 32x32 png favicon link"
  );
  assert.ok(
    html.includes('<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">'),
    "missing 16x16 png favicon link"
  );
  assert.deepEqual(
    Array.from(faviconBytes.subarray(0, 4)),
    [0, 0, 1, 0],
    "favicon.ico should be a real ICO file"
  );
});

test("dashboard is a repo-grouped PR operations table with filter and control hooks", () => {
  const html = getDashboardHTML();

  assert.equal(html.includes("const TABS ="), false, "tabbed layout should be removed");
  assert.ok(html.includes('id="liveBoard"'), "missing live dashboard container");
  assert.ok(html.includes("repo-group"), "missing repo-group table structure");
  assert.ok(html.includes("pr-table"), "missing PR table structure");
  assert.ok(html.includes("renderRepoGroup"), "missing repo group renderer");
  assert.ok(html.includes("repoFilter"), "missing repo-local filter controls");
  assert.ok(html.includes("IntersectionObserver"), "missing repo-local infinite scroll hook");
  assert.ok(html.includes("/api/dashboard/repo/"), "missing repo pagination endpoint hook");
  assert.ok(html.includes("loadRepoPage"), "missing paged repo row loader");
  assert.ok(html.includes('data-action="refreshRepo"') || html.includes("refreshRepo"), "missing force refresh action");
  assert.ok(html.includes('data-action="pausePr"') || html.includes("pausePr"), "missing pause action");
  assert.ok(html.includes('data-action="resumePr"') || html.includes("resumePr"), "missing resume action");
  assert.ok(html.includes('data-action="toggleAutoMerge"') || html.includes("toggleAutoMerge"), "missing auto-merge action");
  assert.ok(html.includes("renderIssuePanel"), "missing issue panel renderer");
  assert.ok(html.includes('class="issue-item"') || html.includes("issue-item"), "missing issue expand/collapse details");
  assert.ok(html.includes("nextPollCountdown"), "missing live next-poll countdown hook");
  assert.ok(html.includes("activeJobTail"), "missing live active-job tail hook");
  assert.ok(html.includes("Configuration"), "missing configuration section");
  assert.ok(html.includes('<details id="configSection"'), "config section should be collapsible");
  assert.equal(html.includes('<details id="configSection" class="panel" open>'), false, "config section should be collapsed by default");
  assert.ok(html.includes('data-action="saveDefaultAgent"') || html.includes("saveDefaultAgent"), "missing agent config controls");
  assert.equal(html.includes('id="configEditor"'), false, "raw json config editor should be removed");
  assert.ok(html.includes('new WebSocket('), "missing WebSocket bootstrap");
  assert.ok(html.includes('/api/dashboard'), "missing snapshot fallback endpoint");
});

test("dashboard formats timestamps in local time instead of raw UTC strings", () => {
  const formatted = formatDashboardTimestamp("2026-04-02T10:50:41.205Z", {
    locale: "en-GB",
    timeZone: "Asia/Jerusalem",
  });

  assert.match(formatted, /02\/04\/2026|2\/4\/2026/, "expected local calendar date");
  assert.match(formatted, /13:50|1:50:41 pm|1:50 pm/i, "expected UTC timestamp converted into local time");
  assert.equal(formatted.includes("10:50:41.205Z"), false, "should not expose the raw UTC timestamp");
});
