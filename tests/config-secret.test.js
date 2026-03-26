import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getConfig, getSecret, requireWebhookSecret } from "../src/config.js";

function withEnv(name, value, fn) {
  const hadValue = Object.prototype.hasOwnProperty.call(process.env, name);
  const previous = process.env[name];

  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    fn();
  } finally {
    if (hadValue) {
      process.env[name] = previous;
    } else {
      delete process.env[name];
    }
  }
}

test("getSecret reads only GITHUB_WEBHOOK_SECRET and ignores persisted config values", () => {
  const config = getConfig();
  config.settings.webhookSecret = "tracked-secret-should-be-ignored";

  withEnv("GITHUB_WEBHOOK_SECRET", "env-secret", () => {
    assert.equal(getSecret(), "env-secret");
  });

  withEnv("GITHUB_WEBHOOK_SECRET", undefined, () => {
    assert.equal(getSecret(), "");
  });
});

test("requireWebhookSecret fails closed when GITHUB_WEBHOOK_SECRET is missing", () => {
  withEnv("GITHUB_WEBHOOK_SECRET", undefined, () => {
    assert.throws(
      () => requireWebhookSecret(),
      /GITHUB_WEBHOOK_SECRET/,
    );
  });
});

test("requireWebhookSecret returns the configured environment secret", () => {
  withEnv("GITHUB_WEBHOOK_SECRET", "runtime-secret", () => {
    assert.equal(requireWebhookSecret(), "runtime-secret");
  });
});

test("tracked config files do not contain webhookSecret entries", () => {
  const configExample = readFileSync("config.example.json", "utf-8");
  const config = readFileSync("config.json", "utf-8");

  assert.equal(configExample.includes("webhookSecret"), false);
  assert.equal(config.includes("webhookSecret"), false);
});
