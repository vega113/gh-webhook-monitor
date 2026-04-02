import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import { setupRoutes } from "../src/api/routes.js";

function makeControlStore() {
  const state = new Map();
  return {
    get(repo, prNumber) {
      return state.get(`${repo}#${prNumber}`) || {
        repo,
        prNumber,
        isPaused: false,
      };
    },
    setPaused(repo, prNumber, isPaused) {
      const next = { repo, prNumber, isPaused };
      state.set(`${repo}#${prNumber}`, next);
      return next;
    },
    listAll() {
      return Object.fromEntries(state.entries());
    },
  };
}

async function startTestServer(controlStore) {
  const app = express();
  app.use(express.json());
  setupRoutes(app, null, null, null, null, {
    prControlStore: controlStore,
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("pause and resume endpoints return updated PR control state", async () => {
  const controlStore = makeControlStore();
  const { server, baseUrl } = await startTestServer(controlStore);

  try {
    const pauseResponse = await fetch(
      `${baseUrl}/api/pr/vega113/incubator-wave/576/pause`,
      { method: "POST" }
    );
    assert.equal(pauseResponse.status, 200);
    const paused = await pauseResponse.json();
    assert.equal(paused.ok, true);
    assert.equal(paused.control.isPaused, true);

    const resumeResponse = await fetch(
      `${baseUrl}/api/pr/vega113/incubator-wave/576/resume`,
      { method: "POST" }
    );
    assert.equal(resumeResponse.status, 200);
    const resumed = await resumeResponse.json();
    assert.equal(resumed.ok, true);
    assert.equal(resumed.control.isPaused, false);
  } finally {
    server.close();
  }
});
