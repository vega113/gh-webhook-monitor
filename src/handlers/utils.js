const cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const AGENT_PR_LABEL = "agent-authored";

function isOnCooldown(key) {
  const last = cooldowns.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) return true;
  return false;
}

function setCooldown(key) {
  cooldowns.set(key, Date.now());
}

function hasLabel(labels, name) {
  return labels.some((l) => (l.name || l) === name);
}

export { isOnCooldown, setCooldown, hasLabel, AGENT_PR_LABEL };
