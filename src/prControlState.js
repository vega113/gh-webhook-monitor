import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLogDir } from "./logger.js";

function createPRControlKey(repo, prNumber) {
  return `${repo}#${prNumber}`;
}

function createPRControlStore(options = {}) {
  const stateFile = options.stateFile || join(getLogDir(), "pr-control-state.json");
  let state = {};

  try {
    if (existsSync(stateFile)) {
      const parsed = JSON.parse(readFileSync(stateFile, "utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        state = parsed;
      }
    }
  } catch {
    state = {};
  }

  function save() {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

  return {
    get(repo, prNumber) {
      const key = createPRControlKey(repo, prNumber);
      return state[key] || {
        repo,
        prNumber,
        isPaused: false,
      };
    },

    setPaused(repo, prNumber, isPaused) {
      const key = createPRControlKey(repo, prNumber);
      state[key] = {
        repo,
        prNumber,
        isPaused: Boolean(isPaused),
      };
      save();
      return state[key];
    },

    listAll() {
      return { ...state };
    },
  };
}

const prControlStore = createPRControlStore();

function getPRControlStore() {
  return prControlStore;
}

function getPRControl(repo, prNumber, store = prControlStore) {
  return store.get(repo, prNumber);
}

function isPRPaused(repo, prNumber, store = prControlStore) {
  return Boolean(getPRControl(repo, prNumber, store)?.isPaused);
}

export {
  createPRControlKey,
  createPRControlStore,
  getPRControl,
  getPRControlStore,
  isPRPaused,
};
