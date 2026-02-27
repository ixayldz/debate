# Release Strategy (Canary)

## Deployment Stages
1. Stage verification
2. Production canary at 5%
3. Ramp to 25%
4. Ramp to 100%

## Promotion Checks (Each Stage)
1. `npm run ci` green on target commit.
2. `npm run test:integration` passes against target environment.
3. `npm run preflight:prod` passes in target environment.
4. `HEALTHCHECK_STRICT_EXTERNALS=true` on production workloads.
5. API 5xx ratio below 1%.
6. p95 latency below 1s.
7. No abnormal rise in `handover_failed_total`.

## Rollback Procedure
1. Stop ramp-up immediately.
2. Route traffic back to previous stable version.
3. Verify `/ready` and error ratio recovery.
4. Open incident ticket with request IDs and metric snapshot.

## Feature Flag Guidance
Use feature flags for:
1. Phone OTP rollout
2. Report pipeline changes
3. Handover policy changes
