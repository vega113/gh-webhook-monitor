import { existsSync, statSync } from "node:fs";

function formatDurationMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "?";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function normalizeJobHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;

  const duration = typeof entry.duration === "string" ? entry.duration.trim() : "";
  if (duration && duration !== "?") return entry;

  if (!entry.logFile || !entry.startTime || !existsSync(entry.logFile)) {
    return entry;
  }

  try {
    const startTimeMs = new Date(entry.startTime).getTime();
    const endTimeMs = statSync(entry.logFile).mtimeMs;
    const normalized = formatDurationMs(endTimeMs - startTimeMs);

    if (normalized === "?") return entry;
    return { ...entry, duration: normalized };
  } catch {
    return entry;
  }
}

function normalizeJobHistory(history) {
  if (!Array.isArray(history)) return { history: [], changed: false };

  let changed = false;
  const normalized = history.map((entry) => {
    const next = normalizeJobHistoryEntry(entry);
    if (next !== entry) changed = true;
    return next;
  });

  return { history: normalized, changed };
}

export { formatDurationMs, normalizeJobHistory, normalizeJobHistoryEntry };
