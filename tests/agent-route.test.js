import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import { setConfig, getConfig } from "../src/config.js";
import { setupRoutes } from "../src/api/routes.js";

async function startTestServer() {
  const app = express();
  app.use(express.json({ verify: (_req, _res, buf) => {
    // Keep parity with production server behavior.
    _req.rawBody = buf;
  }}));
  app.use(express.urlencoded({ extended: true }));
  setupRoutes(app, null, null, null, null);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("POST /api/agent updates default agent and mirrors config.agent.type", async () => {
  const originalConfig = structuredClone(getConfig());
  const nextConfig = structuredClone(originalConfig);
  nextConfig.agentConfig.defaultAgent = "claude";
  nextConfig.agent.type = "claude";
  setConfig(nextConfig);

  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAgent: "codex" }),
    });

    assert.equal(response.status, 200);

    const payload = await response.json();
    const updatedConfig = getConfig();

    assert.equal(payload.ok, true);
    assert.equal(payload.agentConfig.defaultAgent, "codex");
    assert.equal(payload.agent.type, "codex");
    assert.equal(updatedConfig.agentConfig.defaultAgent, "codex");
    assert.equal(updatedConfig.agent.type, "codex");
  } finally {
    server.close();
    setConfig(originalConfig);
  }
});

test("POST /api/agent validates defaultAgent value", async () => {
  const originalConfig = structuredClone(getConfig());
  const nextConfig = structuredClone(originalConfig);
  nextConfig.agentConfig.defaultAgent = "claude";
  nextConfig.agent.type = "claude";
  setConfig(nextConfig);

  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAgent: "gpt" }),
    });

    assert.equal(response.status, 400);

    const payload = await response.json();
    assert.equal(payload.error, "Invalid default agent type");
  } finally {
    server.close();
    setConfig(originalConfig);
  }
});
