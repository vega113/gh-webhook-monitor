import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeJobHistoryEntry } from "../src/jobHistory.js";

test("normalizes unknown job duration from the log file mtime", () => {
  const dir = mkdtempSync(join(tmpdir(), "gh-webhook-monitor-"));
  const logFile = join(dir, "job.log");
  writeFileSync(logFile, "hello");

  const start = new Date("2026-03-25T10:00:00.000Z");
  const end = new Date("2026-03-25T10:00:05.400Z");
  utimesSync(logFile, start, end);

  const entry = normalizeJobHistoryEntry({
    key: "issue-vega113-incubator-wave-1",
    duration: "?",
    startTime: start.toISOString(),
    logFile,
  });

  assert.equal(entry.duration, "5.4s");
  rmSync(dir, { recursive: true, force: true });
});
