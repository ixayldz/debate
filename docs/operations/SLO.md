# SLO and Alert Baseline

## Service Level Objectives
1. API availability (monthly): 99.9%
2. Join success rate: >= 98%
3. Reconnect success rate: >= 95%
4. Handover success rate after grace period: >= 80%

## Core Indicators
1. `http_requests_total` and `http_request_duration_seconds`
2. `active_connections`
3. `handover_started_total`
4. `handover_completed_total`
5. `handover_failed_total{reason}`
6. `grace_period_cancelled_total`

## Alert Thresholds
1. Critical: API 5xx ratio > 2% for 5 minutes.
2. Critical: `/ready` failing for 3 consecutive checks.
3. Warning: p95 HTTP latency > 1s for 10 minutes.
4. Warning: handover failure ratio > 20% for 15 minutes.

## Error Budget Policy
1. If monthly error budget burn > 50%, freeze non-critical feature changes.
2. If monthly error budget burn > 75%, only reliability/security fixes are allowed.

## Dashboard Panels
1. Request volume, latency, and error ratio by route.
2. Readiness and health status timeline.
3. WebSocket active connection gauge.
4. Handover start/completed/failed trend and fail ratio.
