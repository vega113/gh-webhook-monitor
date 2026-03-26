import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardHTML } from "../src/dashboard/html.js";

test("jobs dashboard exposes a persistent job detail panel with copy actions", () => {
  const html = getDashboardHTML();

  assert.ok(html.includes("jobDetailPanel"), "missing persistent job detail panel");
  assert.ok(html.includes("Absolute log path"), "missing absolute log path label");
  assert.ok(html.includes("Copy path"), "missing copy path action");
  assert.ok(html.includes("Copy output"), "missing copy output action");
});
