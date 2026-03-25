import { ActionDispatcher } from "./dispatcher.js";
import { PRStateCache } from "./prStateCache.js";
import { getConfig } from "./config.js";

let dispatcher = null;
let prStateCache = null;

function initializeDispatcher() {
  const config = getConfig();
  prStateCache = new PRStateCache(null, 300); // 5 minute TTL
  dispatcher = new ActionDispatcher(prStateCache, config);
  return dispatcher;
}

function getDispatcher() {
  if (!dispatcher) {
    return initializeDispatcher();
  }
  return dispatcher;
}

function getPRStateCache() {
  if (!prStateCache) {
    initializeDispatcher();
  }
  return prStateCache;
}

export { initializeDispatcher, getDispatcher, getPRStateCache };
