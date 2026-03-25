import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(dirname(__dirname), "logs");

if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

const eventLog = [];
const MAX_EVENT_LOG = 500;

function logEvent(event, action, repo, summary) {
  const ts = new Date().toISOString();
  const line = `${ts} | ${event}:${action} | ${repo} | ${summary}\n`;
  process.stdout.write(line);
  appendFileSync(join(LOG_DIR, "events.log"), line);
  eventLog.unshift({ ts, event, action, repo, summary });
  if (eventLog.length > MAX_EVENT_LOG) {
    eventLog.length = MAX_EVENT_LOG;
  }
}

function getEventLog() {
  return eventLog;
}

function getLogDir() {
  return LOG_DIR;
}

export { logEvent, getEventLog, getLogDir };
