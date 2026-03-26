# Agent Safety and Secret Handling Design

## Scope
Tighten the webhook monitor so it does not persist secrets in tracked config, and so agent-created changes are less likely to reintroduce stale code during fast-moving merge windows.

## Decisions
- `webhookSecret` is runtime-only and must come from `GITHUB_WEBHOOK_SECRET`.
- The server fails closed at startup when `GITHUB_WEBHOOK_SECRET` is missing.
- Tracked config files must not contain `settings.webhookSecret`.
- Agent prompts must explicitly forbid writing secrets to tracked files.
- Agent prompts must require refreshing from the latest base branch before merge/push and call out broken deploy windows as a reason to slow or stop merge throughput.

## Design
### Config loading
`src/config.js` will stop defining or persisting `settings.webhookSecret`. Loading a saved config will ignore any legacy `settings.webhookSecret` value. Saving config will omit that field so old local files self-heal on write.

### Runtime enforcement
`server.js` will validate `process.env.GITHUB_WEBHOOK_SECRET` during startup and abort if it is absent. `src/webhook.js` will continue to read the secret through config helpers, but only from the environment.

### Repository guardrails
Tracked config artifacts (`config.json`, `config.example.json`) will be updated to remove the secret field and document environment-based configuration instead.

### Agent workflow guidance
Default prompt templates and `prompts/monitoring-agent.md` will be updated so agents:
- never commit secrets
- use GitHub secrets for hosted automation and env vars for local runtime secrets
- refresh from latest `origin/main` before final push/merge-related actions
- escalate instead of racing merges when deploy or integration health is already broken

### Tests
Add regression coverage for env-only secret loading and for prompt templates carrying the new safety instructions.
