import { appendFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from "node:fs";
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

/**
 * Clean up old job log files (keep only last 7 days)
 * This prevents the logs directory from consuming too much disk space
 */
function rotateJobLogs() {
  try {
    const now = Date.now();
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Only process job logs (not events.log or job-history.json)
    const files = readdirSync(LOG_DIR).filter(f => f.startsWith('ci-') || f.startsWith('review-') || f.includes('job-'));

    for (const file of files) {
      const filePath = join(LOG_DIR, file);
      try {
        const stat = statSync(filePath);
        const age = now - stat.mtimeMs;

        // Delete files older than 7 days
        if (age > MAX_AGE_MS) {
          unlinkSync(filePath);
          console.log(`[LOG_ROTATION] Deleted old log: ${file} (${(age / (24 * 60 * 60 * 1000)).toFixed(1)} days old)`);
        }
      } catch (err) {
        // Ignore errors for individual files
      }
    }
  } catch (err) {
    console.error('[LOG_ROTATION] Error:', err.message);
  }
}

// Run log rotation on startup
rotateJobLogs();

// Run log rotation every 24 hours
setInterval(rotateJobLogs, 24 * 60 * 60 * 1000);

export { logEvent, getEventLog, getLogDir };
