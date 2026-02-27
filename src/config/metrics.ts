import { Request, Response, NextFunction } from 'express';
import {
  registry,
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections,
  roomCount,
  userCount,
  handoverStartedTotal,
  handoverCompletedTotal,
  handoverFailedTotal,
  gracePeriodCancelledTotal,
} from './prometheus.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const durationSeconds = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestDuration.labels(method, route, statusCode).observe(durationSeconds);
    httpRequestsTotal.labels(method, route, statusCode).inc();
  });

  next();
}

export function updateActiveConnections(count: number): void {
  activeConnections.set(count);
}

export function updateRoomCount(count: number): void {
  roomCount.set(count);
}

export function updateUserCount(count: number): void {
  userCount.set(count);
}

export function recordHandoverStarted(): void {
  handoverStartedTotal.inc();
}

export function recordHandoverCompleted(): void {
  handoverCompletedTotal.inc();
}

export function recordHandoverFailed(reason: 'no_successor' | 'error'): void {
  handoverFailedTotal.labels(reason).inc();
}

export function recordGracePeriodCancelled(): void {
  gracePeriodCancelledTotal.inc();
}

export { registry };
