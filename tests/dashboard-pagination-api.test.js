import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { setupRoutes } from "../src/api/routes.js";

async function startTestServer() {
  const app = express();
  app.use(express.json());
  setupRoutes(app, null, null, null, null, {
    collectDashboardRepoPrPage: async (_config, _statusCache, repo, options) => ({
      repo,
      rows: [
        {
          repo,
          prNumber: 576,
          title: "fix deploy",
          waitingFor: "Address failing CI checks",
        },
      ],
      totalCount: 51,
      offset: options.offset,
      limit: options.limit,
      hasMore: true,
      nextOffset: options.offset + options.limit,
    }),
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("repo PR pagination endpoint returns paged PR rows for an expanded repo", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(
      `${baseUrl}/api/dashboard/repo/vega113/incubator-wave/prs?offset=25&limit=25&showAll=true&filterText=deploy&statusFilter=ci-failed`
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.page.repo, "vega113/incubator-wave");
    assert.equal(payload.page.rows.length, 1);
    assert.equal(payload.page.offset, 25);
    assert.equal(payload.page.limit, 25);
    assert.equal(payload.page.hasMore, true);
    assert.equal(payload.page.nextOffset, 50);
  } finally {
    server.close();
  }
});
