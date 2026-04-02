import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createPRControlStore,
  createPRControlKey,
} from "../src/prControlState.js";

test("pause state persists per PR across store reloads", () => {
  const dir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-pr-controls-"));
  const stateFile = join(dir, "pr-controls.json");

  try {
    const store = createPRControlStore({ stateFile });
    assert.equal(store.get("vega113/incubator-wave", 576).isPaused, false);

    const updated = store.setPaused("vega113/incubator-wave", 576, true);
    assert.equal(updated.isPaused, true);

    const reloaded = createPRControlStore({ stateFile });
    assert.equal(reloaded.get("vega113/incubator-wave", 576).isPaused, true);
    assert.equal(
      reloaded.listAll()[createPRControlKey("vega113/incubator-wave", 576)].isPaused,
      true
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
