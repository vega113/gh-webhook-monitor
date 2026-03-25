#!/usr/bin/env node

import { spawn } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Configuration
const CHECK_INTERVAL = 10000; // 10 seconds
const LOG_FILE = path.join(projectRoot, "logs", "watch-restart.log");

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

let serverProcess = null;
let lastKnownCommit = null;
let isRestarting = false;

/**
 * Log messages to console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);

  try {
    fs.appendFileSync(LOG_FILE, logEntry + "\n");
  } catch (err) {
    console.error("Failed to write to log file:", err.message);
  }
}

/**
 * Get the current commit hash of main branch
 */
async function getCurrentCommit() {
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", {
      cwd: projectRoot,
    });
    return stdout.trim();
  } catch (err) {
    log(`Error getting current commit: ${err.message}`);
    return null;
  }
}

/**
 * Fetch latest changes from remote
 */
async function fetchLatestChanges() {
  try {
    await execAsync("git fetch", { cwd: projectRoot });
    log("Fetched latest changes from remote");
  } catch (err) {
    log(`Error fetching changes: ${err.message}`);
  }
}

/**
 * Check if there are new commits to pull
 */
async function hasNewCommits() {
  try {
    const { stdout } = await execAsync(
      'git log --oneline -1 HEAD..origin/main',
      { cwd: projectRoot }
    );
    return stdout.trim().length > 0;
  } catch (err) {
    log(`Error checking for new commits: ${err.message}`);
    return false;
  }
}

/**
 * Pull latest changes
 */
async function pullLatestChanges() {
  try {
    const { stdout } = await execAsync("git pull origin main", {
      cwd: projectRoot,
    });
    log("Pulled latest changes from main");
    log(`Pull output: ${stdout.trim()}`);
  } catch (err) {
    log(`Error pulling changes: ${err.message}`);
    throw err;
  }
}

/**
 * Start the server process
 */
function startServer() {
  log("Starting server...");

  serverProcess = spawn("npm", ["start"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Log server output
  serverProcess.stdout.on("data", (data) => {
    console.log(`[SERVER] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[SERVER ERR] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    log(
      `Server process exited with code ${code}${!isRestarting ? " (unexpected)" : ""}`
    );
  });

  return new Promise((resolve) => {
    // Give server time to start
    setTimeout(() => {
      log(`Server started with PID ${serverProcess.pid}`);
      resolve();
    }, 2000);
  });
}

/**
 * Kill the server process
 */
async function killServer() {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }

    log(`Killing server process (PID: ${serverProcess.pid})`);
    serverProcess.kill("SIGTERM");

    // Give it a moment to die gracefully, then force kill if needed
    const timeout = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        log("Server didn't exit gracefully, force killing...");
        serverProcess.kill("SIGKILL");
      }
    }, 3000);

    serverProcess.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    serverProcess = null;
  });
}

/**
 * Restart the server
 */
async function restartServer() {
  if (isRestarting) {
    log("Restart already in progress, skipping...");
    return;
  }

  isRestarting = true;
  try {
    await killServer();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before restarting
    await startServer();
    log("Server restarted successfully");
  } catch (err) {
    log(`Error during restart: ${err.message}`);
  } finally {
    isRestarting = false;
  }
}

/**
 * Main watch loop
 */
async function watchForUpdates() {
  log("Watch-and-restart monitor started");
  log(`Check interval: ${CHECK_INTERVAL}ms`);
  log(`Project root: ${projectRoot}`);

  // Initialize with current commit
  lastKnownCommit = await getCurrentCommit();
  log(`Current commit: ${lastKnownCommit}`);

  // Start server on startup
  await startServer();

  // Watch loop
  setInterval(async () => {
    try {
      // Fetch latest changes
      await fetchLatestChanges();

      // Check if there are new commits
      const newCommitsAvailable = await hasNewCommits();

      if (newCommitsAvailable) {
        log("New commits detected on main branch");
        log("Pulling changes and restarting server...");

        try {
          await pullLatestChanges();
          const newCommit = await getCurrentCommit();
          log(`Updated to commit: ${newCommit}`);

          await restartServer();
        } catch (err) {
          log(`Failed to pull and restart: ${err.message}`);
        }
      }
    } catch (err) {
      log(`Error in watch loop: ${err.message}`);
    }
  }, CHECK_INTERVAL);
}

/**
 * Graceful shutdown
 */
process.on("SIGINT", async () => {
  log("Received SIGINT, shutting down gracefully...");
  await killServer();
  log("Watch-and-restart monitor stopped");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  log("Received SIGTERM, shutting down gracefully...");
  await killServer();
  log("Watch-and-restart monitor stopped");
  process.exit(0);
});

// Start monitoring
watchForUpdates().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
