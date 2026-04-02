import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import { setupRoutes } from "../src/api/routes.js";

async function startTestServer(toggleAutoMerge) {
  const app = express();
  app.use(express.json());
  setupRoutes(app, null, null, null, null, {
    toggleAutoMerge,
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("auto-merge endpoint delegates native GitHub auto-merge toggle", async () => {
  const calls = [];
  const { server, baseUrl } = await startTestServer(async (repo, prNumber, enabled) => {
    calls.push({ repo, prNumber, enabled });
    return {
      repo,
      prNumber,
      autoMergeEnabled: enabled,
      mergeMethod: enabled ? "merge" : null,
    };
  });

  try {
    const enableResponse = await fetch(
      `${baseUrl}/api/pr/vega113/incubator-wave/576/auto-merge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }
    );
    assert.equal(enableResponse.status, 200);
    const enabledPayload = await enableResponse.json();
    assert.equal(enabledPayload.ok, true);
    assert.equal(enabledPayload.autoMerge.autoMergeEnabled, true);

    const disableResponse = await fetch(
      `${baseUrl}/api/pr/vega113/incubator-wave/576/auto-merge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }
    );
    assert.equal(disableResponse.status, 200);
    const disabledPayload = await disableResponse.json();
    assert.equal(disabledPayload.ok, true);
    assert.equal(disabledPayload.autoMerge.autoMergeEnabled, false);

    assert.deepEqual(calls, [
      { repo: "vega113/incubator-wave", prNumber: 576, enabled: true },
      { repo: "vega113/incubator-wave", prNumber: 576, enabled: false },
    ]);
  } finally {
    server.close();
  }
});
