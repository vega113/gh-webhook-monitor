import assert from "node:assert/strict";
import test from "node:test";
import { getConfig } from "../src/config.js";
import { getDashboardHTML } from "../src/dashboard/html.js";

test("codex default model is gpt-5.4 everywhere the monitor exposes it", () => {
  const config = getConfig();
  const html = getDashboardHTML();

  assert.equal(config.agent.codex.model, "gpt-5.4");
  assert.ok(html.includes("gpt-5.4"), "dashboard should show gpt-5.4");
  assert.equal(html.includes("gpt-5.3-codex"), false);
});
