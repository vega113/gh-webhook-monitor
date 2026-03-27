import assert from "node:assert/strict";
import test from "node:test";
import { routeAgentJob } from "../src/agentRouter.js";

function makeConfig(overrides = {}) {
  return {
    agentConfig: { defaultAgent: "codex" },
    agent: {
      type: "codex",
      codex: {
        model: "gpt-5.4",
      },
      claude: {
        model: "",
      },
    },
    settings: {
      agentRouter: {
        enabled: true,
        policy: "conservative-hybrid",
        codexMiniModel: "gpt-5.4-mini",
        codexFullModel: "gpt-5.4",
      },
      ...overrides,
    },
  };
}

test("routes read-only Codex triage to gpt-5.4-mini", () => {
  const decision = routeAgentJob({
    config: makeConfig(),
    preferredAgent: "codex",
    jobKey: "ci-fail-vega113/incubator-wave-abc12345",
    routeContext: {
      eventType: "check_suite",
      inspectionOnly: true,
    },
  });

  assert.equal(decision.effectiveAgent, "codex");
  assert.equal(decision.tier, "mini");
  assert.equal(decision.effectiveModel, "gpt-5.4-mini");
});

test("full-tier rules beat mini-tier rules when both match", () => {
  const decision = routeAgentJob({
    config: makeConfig(),
    preferredAgent: "codex",
    jobKey: "issue-vega113/incubator-wave-300",
    routeContext: {
      eventType: "check_suite",
      inspectionOnly: true,
      labels: ["deploy-failure"],
    },
  });

  assert.equal(decision.tier, "full");
  assert.equal(decision.effectiveModel, "gpt-5.4");
});

test("keeps Claude repos on configured Claude defaults in first pass", () => {
  const decision = routeAgentJob({
    config: makeConfig(),
    preferredAgent: "claude",
    jobKey: "review-vega113/incubator-wave-12",
    routeContext: {
      eventType: "pull_request_review",
      reviewState: "commented",
    },
  });

  assert.equal(decision.effectiveAgent, "claude");
  assert.equal(decision.effectiveModel, null);
  assert.match(decision.reason, /Claude tiering is out of scope/i);
});

test("falls back to hardcoded safe defaults when router config is invalid", () => {
  const decision = routeAgentJob({
    config: makeConfig({
      agentRouter: {
        enabled: true,
        policy: "conservative-hybrid",
        codexMiniModel: "",
        codexFullModel: "",
      },
    }),
    preferredAgent: "codex",
    jobKey: "comment-vega113/incubator-wave-123-456",
    routeContext: {
      eventType: "issue_comment",
      inspectionOnly: true,
    },
  });

  assert.equal(decision.effectiveModel, "gpt-5.4-mini");
  assert.match(decision.reason, /mini/i);
});
