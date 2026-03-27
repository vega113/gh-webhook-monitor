import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDashboardHTML } from "../src/dashboard/html.js";

test("jobs dashboard exposes a persistent job detail panel with copy actions", () => {
  const html = getDashboardHTML();
  const panelIndex = html.indexOf('id="jobDetailPanel"');
  const historyIndex = html.indexOf('id="jHist"');

  assert.ok(html.includes("jobDetailPanel"), "missing persistent job detail panel");
  assert.ok(html.includes("Absolute log path"), "missing absolute log path label");
  assert.ok(html.includes("Copy path"), "missing copy path action");
  assert.ok(html.includes("Copy output"), "missing copy output action");
  assert.ok(panelIndex >= 0 && historyIndex >= 0 && panelIndex < historyIndex,
    "job detail panel should render above job history so clicks reveal content in-view");
  assert.ok(
    html.includes("insertBefore(panel, historyPanel)"),
    "missing runtime guard that moves the job detail panel above history"
  );
  assert.ok(html.includes('id="sPing"'), "missing ping badge");
  assert.ok(html.includes("getRecentPingCount"), "missing ping count helper");
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
