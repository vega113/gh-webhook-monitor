import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDashboardHTML } from "../src/dashboard/html.js";

test("dashboard exposes a persistent in-page job detail panel", () => {
  const html = getDashboardHTML();

  assert.ok(html.includes("jobDetailPanel"), "missing persistent job detail panel");
  assert.ok(html.includes("Absolute log path"), "missing absolute log path label");
  assert.ok(html.includes("Captured output for"), "missing output detail label");
  assert.ok(html.includes('data-action="openJobDetail"') || html.includes("openJobDetail"), "missing log detail open action");
  assert.ok(html.includes('data-action="closeDetail"') || html.includes("closeDetail"), "missing close detail action");
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

test("dashboard is a single-page live view driven by WebSockets", () => {
  const html = getDashboardHTML();

  assert.equal(html.includes("const TABS ="), false, "tabbed layout should be removed");
  assert.ok(html.includes('id="liveBoard"'), "missing live dashboard container");
  assert.ok(html.includes("Configuration"), "missing configuration section");
  assert.ok(html.includes('<details id="configSection"'), "config section should be collapsible");
  assert.equal(html.includes('<details id="configSection" class="panel" open>'), false, "config section should be collapsed by default");
  assert.ok(html.includes('data-action="saveDefaultAgent"') || html.includes("saveDefaultAgent"), "missing agent config controls");
  assert.equal(html.includes('id="configEditor"'), false, "raw json config editor should be removed");
  assert.ok(html.includes('new WebSocket('), "missing WebSocket bootstrap");
  assert.ok(html.includes('/api/dashboard'), "missing snapshot fallback endpoint");
});
