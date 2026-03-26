import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_PROMPT_TEMPLATES } from "../src/config.js";

const monitoringPrompt = readFileSync("prompts/monitoring-agent.md", "utf-8");

function assertContains(text, needle, label) {
  assert.ok(
    text.toLowerCase().includes(needle.toLowerCase()),
    `${label} should include: ${needle}`
  );
}

test("agent task templates instruct agents not to commit secrets and to refresh latest main", () => {
  assertContains(DEFAULT_PROMPT_TEMPLATES.agent_task, "never commit secrets", "agent_task");
  assertContains(DEFAULT_PROMPT_TEMPLATES.agent_task, "git fetch origin", "agent_task");
  assertContains(DEFAULT_PROMPT_TEMPLATES.agent_task, "rebase onto the latest", "agent_task");

  assertContains(DEFAULT_PROMPT_TEMPLATES.issue_followup, "never commit secrets", "issue_followup");
  assertContains(DEFAULT_PROMPT_TEMPLATES.issue_followup, "git fetch origin", "issue_followup");
  assertContains(DEFAULT_PROMPT_TEMPLATES.issue_followup, "rebase onto the latest", "issue_followup");
});

test("monitoring prompt documents secret handling and merge freshness guardrails", () => {
  assertContains(monitoringPrompt, "Never commit secrets", "monitoring-agent.md");
  assertContains(monitoringPrompt, "Use GitHub Actions secrets", "monitoring-agent.md");
  assertContains(monitoringPrompt, "Refresh from the latest base branch before merging", "monitoring-agent.md");
  assertContains(monitoringPrompt, "slow merge cadence", "monitoring-agent.md");
});
