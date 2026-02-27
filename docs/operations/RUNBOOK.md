# Incident Runbook

## Scope
This runbook covers API outage, Redis outage, PostgreSQL outage, and degraded handover behavior.

## Triage Checklist
1. Confirm blast radius (`/health`, `/ready`, `/metrics`).
2. Check recent deploy status and release stage (canary vs full rollout).
3. Check API logs by `requestId`.
4. Check Redis and PostgreSQL connectivity.
5. Run `npm run preflight:prod` and check external dependency status (`/ready` response: `external.services.livekit/email`).

## API Outage
1. Inspect process logs (`error.log`, `combined.log`).
2. Verify DB and Redis health checks.
3. If `HEALTHCHECK_STRICT_EXTERNALS=true`, verify LiveKit and SMTP credentials.
4. Roll back to previous release if 5xx rate remains elevated for 5 minutes.

## Redis Outage
1. Expect degraded features: rate limiting, room ephemeral state, handover timers.
2. Restore Redis service first.
3. Restart API pods after Redis is healthy.
4. Verify `handoverService.recoverTimers()` logs on startup.

## PostgreSQL Outage
1. Place API into degraded mode (readiness should fail).
2. Restore DB primary and verify replication.
3. Re-run smoke checks:
   - `/ready` returns 200
   - auth login path
   - room create/join path

## Handover Failure Spike
1. Check `handover_failed_total` metric (`reason` label).
2. Inspect room participant state in Redis and PostgreSQL consistency.
3. If failures continue, disable canary and roll back.

## Rollback Criteria
Rollback immediately if any is true:
1. API 5xx > 2% for 5+ minutes.
2. Reconnect success drops below 95%.
3. Handover fail ratio exceeds 20% over 15 minutes.

## Post-Incident
1. Capture timeline and root cause.
2. Add test that reproduces failure mode.
3. Update this runbook with the fix and detection signal.
