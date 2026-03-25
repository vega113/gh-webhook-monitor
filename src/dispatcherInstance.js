import { ActionDispatcher } from "./dispatcher.js";
import { PRStateCache } from "./prStateCache.js";
import { StatusCache } from "./statusCache.js";
import { getConfig } from "./config.js";

let dispatcher = null;
let prStateCache = null;
let statusCache = null;

function initializeDispatcher() {
  const config = getConfig();
  prStateCache = new PRStateCache(null, 300); // 5 minute TTL
  statusCache = new StatusCache(prStateCache, 30); // 30 second TTL
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

function getStatusCache() {
  if (!statusCache) {
    initializeDispatcher();
  }
  return statusCache;
}

export { initializeDispatcher, getDispatcher, getPRStateCache, getStatusCache };
