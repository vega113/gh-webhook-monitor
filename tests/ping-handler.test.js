import test from "node:test";
import assert from "node:assert/strict";
import { createHandlePing } from "../src/handlers/ping.js";

test("handlePing records a clear handled ping event", () => {
  const calls = [];
  const handlePing = createHandlePing({
    logEvent: (...args) => calls.push(args),
  });

  handlePing({
    zen: "Keep it logically awesome.",
    hook_id: 602615695,
    repository: { full_name: "vega113/incubator-wave" },
  });

  assert.deepEqual(calls, [
    ["PING", "github", "vega113/incubator-wave", "hook_id=602615695 | Keep it logically awesome."],
  ]);
});
