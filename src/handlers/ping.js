import { logEvent } from "../logger.js";

const defaultDeps = {
  logEvent,
};

function createHandlePing(deps = defaultDeps) {
  return function handlePing(payload) {
    const repo = payload.repository?.full_name || "unknown";
    const hookId = payload.hook_id || "unknown";
    const zen = payload.zen || "GitHub webhook ping";
    deps.logEvent("PING", "github", repo, `hook_id=${hookId} | ${zen}`);
  };
}

const handlePing = createHandlePing();

export { createHandlePing, handlePing };
