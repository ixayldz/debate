import { Registry, Counter, Gauge, Histogram } from 'prom-client';

export const registry = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active WebSocket connections',
  registers: [registry],
});

export const roomCount = new Gauge({
  name: 'room_count',
  help: 'Number of active rooms',
  registers: [registry],
});

export const userCount = new Gauge({
  name: 'user_count',
  help: 'Number of registered users',
  registers: [registry],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

export const handoverStartedTotal = new Counter({
  name: 'handover_started_total',
  help: 'Total number of handover grace periods started',
  registers: [registry],
});

export const handoverCompletedTotal = new Counter({
  name: 'handover_completed_total',
  help: 'Total number of successful handovers',
  registers: [registry],
});

export const handoverFailedTotal = new Counter({
  name: 'handover_failed_total',
  help: 'Total number of failed handovers',
  labelNames: ['reason'],
  registers: [registry],
});

export const gracePeriodCancelledTotal = new Counter({
  name: 'grace_period_cancelled_total',
  help: 'Total number of grace periods cancelled due to owner return',
  registers: [registry],
});

export default registry;
