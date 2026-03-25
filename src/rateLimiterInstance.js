/**
 * Global RateLimiter instance
 * Handlers and other modules import this to access the rate limiter
 */

import { RateLimiter } from "./rateLimiter.js";
import { getConfig } from "./config.js";

let rateLimiterInstance = null;

function initializeRateLimiter() {
  const config = getConfig();
  rateLimiterInstance = new RateLimiter(config.settings.rateLimits);
  rateLimiterInstance.startBatchProcessing();
  return rateLimiterInstance;
}

function getRateLimiter() {
  return rateLimiterInstance;
}

export { initializeRateLimiter, getRateLimiter };
