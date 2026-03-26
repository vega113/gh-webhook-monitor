import test from "node:test";
import assert from "node:assert/strict";
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
  assert.ok(html.includes('id="sPing"'), "missing ping badge");
  assert.ok(html.includes("getRecentPingCount"), "missing ping count helper");
});
