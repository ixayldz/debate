import express, { NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import config from './config/index.js';
import { logger } from './config/logger.js';
import database from './config/database.js';
import runMigrations from './config/migrations.js';
import { redisClient } from './config/redis.js';
import { errorFilter } from './common/filters/error.filter.js';
import { securityMiddleware, corsMiddleware, requestSanitizer } from './middleware/security.js';
import { requestContextMiddleware, RequestContextRequest } from './middleware/request-context.js';
import { authLimiter, apiLimiter } from './middleware/rate-limiter.js';
import { authRoutes } from './modules/auth/index.js';
import { userRoutes } from './modules/user/index.js';
import { roomRoutes } from './modules/room/room.routes.js';
import { roomService } from './modules/room/room.service.js';
import { moderationRoutes } from './modules/moderation/index.js';
import { setupRoomGateway } from './modules/room/room.gateway.js';
import { setupMicRequestGateway } from './modules/mic-request/index.js';
import { setupSwagger } from './docs/swagger.js';
import { collectDefaultMetrics } from 'prom-client';
import { registry, metricsMiddleware, updateActiveConnections } from './config/metrics.js';
import { handoverService } from './modules/room/handover.service.js';
import { livekitService } from './config/livekit.js';
import { emailService } from './config/email.js';
import { smsService } from './config/sms.js';
import { registerSocketServer } from './config/socket-state.js';

// Collect default Prometheus metrics
collectDefaultMetrics({ register: registry });

interface ExternalDependencyState {
  required: boolean;
  configured: boolean;
  enforced: boolean;
  ok: boolean;
  error?: string;
}

interface ExternalHealthSnapshot {
  checkedAt: string;
  services: {
    livekit: ExternalDependencyState;
    email: ExternalDependencyState;
    sms: ExternalDependencyState;
  };
}

const externalHealthCache: {
  checkedAtMs: number;
  snapshot: ExternalHealthSnapshot | null;
} = {
  checkedAtMs: 0,
  snapshot: null,
};

function collectExternalFailures(snapshot: ExternalHealthSnapshot): string[] {
  const failures: string[] = [];

  for (const [serviceName, serviceStatus] of Object.entries(snapshot.services)) {
    if (serviceStatus.enforced && !serviceStatus.ok) {
      failures.push(`${serviceName}: ${serviceStatus.error || 'unhealthy'}`);
    }
  }

  return failures;
}

async function checkExternalDependencies(force = false): Promise<ExternalHealthSnapshot> {
  const ttlMs = config.health.externalCheckCacheTtlMs;
  const now = Date.now();

  if (!force && externalHealthCache.snapshot && (now - externalHealthCache.checkedAtMs) < ttlMs) {
    return externalHealthCache.snapshot;
  }

  const livekitRequired = config.services.livekitRequired;
  const livekitConfigured = livekitService.isConfigured();
  const livekitEnforced = livekitRequired || livekitConfigured;
  const livekitState: ExternalDependencyState = {
    required: livekitRequired,
    configured: livekitConfigured,
    enforced: livekitEnforced,
    ok: !livekitEnforced,
  };

  if (livekitEnforced) {
    if (!livekitConfigured) {
      livekitState.ok = false;
      livekitState.error = 'LiveKit is required but not configured';
    } else {
      const result = await livekitService.verifyConnection(config.services.externalCheckTimeoutMs);
      livekitState.ok = result.ok;
      livekitState.error = result.error;
    }
  }

  const emailRequired = config.services.emailRequired;
  const emailConfigured = emailService.isConfigured();
  const emailEnforced = emailRequired || emailConfigured;
  const emailState: ExternalDependencyState = {
    required: emailRequired,
    configured: emailConfigured,
    enforced: emailEnforced,
    ok: !emailEnforced,
  };

  if (emailEnforced) {
    if (!emailConfigured) {
      emailState.ok = false;
      emailState.error = 'Email service is required but not configured';
    } else {
      const result = await emailService.verifyConnection(config.services.externalCheckTimeoutMs);
      emailState.ok = result.ok;
      emailState.error = result.error;
    }
  }

  const smsRequired = config.services.smsRequired;
  const smsConfigured = smsService.isConfigured();
  const smsEnforced = smsRequired || smsConfigured;
  const smsState: ExternalDependencyState = {
    required: smsRequired,
    configured: smsConfigured,
    enforced: smsEnforced,
    ok: !smsEnforced,
  };

  if (smsEnforced) {
    if (!smsConfigured) {
      smsState.ok = false;
      smsState.error = 'SMS service is required but not configured';
    } else {
      const result = await smsService.verifyConnection(config.services.externalCheckTimeoutMs);
      smsState.ok = result.ok;
      smsState.error = result.error;
    }
  }

  const snapshot: ExternalHealthSnapshot = {
    checkedAt: new Date().toISOString(),
    services: {
      livekit: livekitState,
      email: emailState,
      sms: smsState,
    },
  };

  externalHealthCache.checkedAtMs = now;
  externalHealthCache.snapshot = snapshot;
  return snapshot;
}

const app = express();
app.set('trust proxy', config.app.trustProxy);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.app.frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
registerSocketServer(io);

// Track active connections and background task state for graceful shutdown.
const activeConnections = new Set<string>();
let emptyRoomSweepTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

app.use(securityMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestSanitizer);
app.use(requestContextMiddleware);

app.use((req: RequestContextRequest, res, next) => {
  logger.debug(
    {
      requestId: req.requestId || res.locals.requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
    },
    'Incoming request'
  );
  next();
});

function normalizeClientIp(ip: string | undefined): string {
  if (!ip) {
    return '';
  }

  return ip.replace(/^::ffff:/, '').trim().toLowerCase();
}

function isPrivateIpv4(ip: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return false;
  }

  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) {
    return true;
  }

  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) {
    return false;
  }

  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

function isPrivateNetworkIp(ip: string): boolean {
  if (!ip) {
    return false;
  }

  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  return isPrivateIpv4(ip);
}

function internalOpsOnly(req: Request, res: Response, next: NextFunction): void {
  if (config.nodeEnv !== 'production') {
    next();
    return;
  }

  const suppliedKey = req.headers['x-internal-ops-key'];
  const candidateKey =
    typeof suppliedKey === 'string'
      ? suppliedKey
      : (Array.isArray(suppliedKey) ? suppliedKey[0] : '');
  if (
    config.ops.internalKey &&
    candidateKey === config.ops.internalKey
  ) {
    next();
    return;
  }

  const sourceIp = normalizeClientIp(req.ip);
  if (isPrivateNetworkIp(sourceIp)) {
    next();
    return;
  }

  res.status(403).json({
    code: 'FORBIDDEN',
    message: 'This endpoint is restricted to internal operations access',
  });
}

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Debate Platform API',
    version: '1.0.0',
    status: 'running',
    docs: '/api-docs',
    health: '/health',
  });
});

app.get('/health', async (_req, res) => {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    dependencies: {
      redis: 'ok',
      database: 'ok',
    },
    external: undefined as ExternalHealthSnapshot | undefined,
  };

  try {
    await redisClient.getClient().ping();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown redis error';
    healthcheck.dependencies.redis = message;
    healthcheck.status = 'degraded';
  }

  try {
    await database.query('SELECT 1');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    healthcheck.dependencies.database = message;
    healthcheck.status = 'degraded';
  }

  const external = await checkExternalDependencies(false);
  healthcheck.external = external;

  if (config.health.strictExternals && collectExternalFailures(external).length > 0) {
    healthcheck.status = 'degraded';
  }

  const statusCode = healthcheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthcheck);
});

// Kubernetes liveness probe - is the app running?
app.get('/live', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Kubernetes readiness probe - is the app ready to serve traffic?
app.get('/ready', async (_req, res) => {
  const errors: string[] = [];

  try {
    await redisClient.getClient().ping();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown redis error';
    errors.push(`redis: ${message}`);
  }

  try {
    await database.query('SELECT 1');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    errors.push(`database: ${message}`);
  }

  const external = await checkExternalDependencies(false);
  if (config.health.strictExternals) {
    errors.push(...collectExternalFailures(external));
  }

  if (errors.length === 0) {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      external,
    });
    return;
  }

  res.status(503).json({
    status: 'not_ready',
    errors,
    timestamp: new Date().toISOString(),
    external,
  });
});

// Prometheus metrics endpoint
const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (error) {
    logger.error({ err: error }, 'Error generating metrics');
    res.status(500).end('Error generating metrics');
  }
};

if (config.nodeEnv === 'production' && !config.ops.enablePublicMetrics) {
  app.get('/metrics', internalOpsOnly, metricsHandler);
} else {
  app.get('/metrics', metricsHandler);
}

// Apply metrics middleware for request tracking
app.use(metricsMiddleware);

app.use('/auth', authLimiter, authRoutes);
app.use('/users', apiLimiter, userRoutes);
app.use('/rooms', apiLimiter, roomRoutes);
app.use('/moderation', apiLimiter, moderationRoutes);

if (config.nodeEnv === 'production' && !config.ops.enableSwagger) {
  setupSwagger(app, { guard: internalOpsOnly });
} else {
  setupSwagger(app);
}

app.use(errorFilter);

async function sweepEmptyLiveRooms(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  try {
    const candidates = await roomService.listEmptyRoomSweepCandidates(config.room.emptyRoomMinAgeSeconds);
    let closedCount = 0;

    for (const roomId of candidates) {
      const sockets = await io.of('/room').in(roomId).fetchSockets();
      if (sockets.length > 0) {
        continue;
      }

      const ended = await roomService.endRoomIfLive(roomId);
      if (ended) {
        closedCount++;
      }
    }

    if (closedCount > 0) {
      logger.info({ closedCount }, 'Auto-closed empty live rooms');
    }
  } catch (error) {
    logger.error({ err: error }, 'Empty room sweep failed');
  }
}

function startEmptyRoomSweepTask(): void {
  const intervalSeconds = Math.max(0, config.room.emptyRoomSweepSeconds);
  if (intervalSeconds === 0) {
    logger.info('Empty room sweep is disabled');
    return;
  }

  const intervalMs = intervalSeconds * 1000;
  emptyRoomSweepTimer = setInterval(() => {
    void sweepEmptyLiveRooms();
  }, intervalMs);

  logger.info(
    {
      intervalSeconds,
      minAgeSeconds: config.room.emptyRoomMinAgeSeconds,
    },
    'Empty room auto-close sweep started'
  );

  // Run once at startup to clean stale rooms from previous sessions.
  void sweepEmptyLiveRooms();
}

async function start(): Promise<void> {
  try {
    logger.info('Starting Debate Server...');

    await database.connect();
    logger.info('Database connected');

    await runMigrations();
    logger.info('Database migrations completed');

    await redisClient.connect();
    logger.info('Redis connected');

    io.adapter(createAdapter(redisClient.getPublisher(), redisClient.getSubscriber()));
    logger.info('Socket.IO Redis adapter initialized');

    const external = await checkExternalDependencies(true);
    const externalFailures = collectExternalFailures(external);
    if (externalFailures.length > 0) {
      if (config.health.strictExternals) {
        throw new Error(`External dependency checks failed: ${externalFailures.join('; ')}`);
      }

      logger.warn({ failures: externalFailures }, 'External dependency checks reported issues');
    } else {
      logger.info('External dependency checks passed');
    }

    // Recover grace period timers from previous instances
    await handoverService.recoverTimers();
    logger.info('Grace period timers recovered');

    // Track all socket connections
    io.on('connection', (socket) => {
      trackConnection(socket);
    });

    setupRoomGateway(io);
    setupMicRequestGateway(io);
    logger.info('WebSocket gateways initialized');
    startEmptyRoomSweepTask();

    httpServer.listen(config.port, () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Server started');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Connection tracking middleware for Socket.IO
function trackConnection(socket: Socket): void {
  activeConnections.add(socket.id);
  updateActiveConnections(activeConnections.size);

  socket.on('disconnect', () => {
    activeConnections.delete(socket.id);
    updateActiveConnections(activeConnections.size);
  });
}

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    logger.info('Already shutting down...');
    return;
  }

  isShuttingDown = true;
  logger.info('Shutting down gracefully...');

  if (emptyRoomSweepTimer) {
    clearInterval(emptyRoomSweepTimer);
    emptyRoomSweepTimer = null;
  }

  // 1. Notify all connected clients about shutdown
  const shutdownMessage = {
    message: 'Server shutting down',
    timestamp: new Date().toISOString(),
    reconnectDelay: 5000,
  };

  io.emit('server:shutdown', shutdownMessage);
  logger.info({ connectionCount: activeConnections.size }, 'Notified clients of shutdown');

  // 2. Stop accepting new connections (both WS and HTTP)
  io.close(() => {
    logger.info('WebSocket server closed');
  });

  httpServer.close(() => {
    logger.info('HTTP server closed - no new connections accepted');
  });

  // 3. Wait for in-flight requests (10 second timeout)
  const shutdownTimeout = config.nodeEnv === 'production' ? 10000 : 3000;
  await new Promise(resolve => setTimeout(resolve, shutdownTimeout));

  // 4. Clean up handover timers for all active rooms
  try {
    const roomsResult = await database.query(
      "SELECT id FROM rooms WHERE status = 'live'"
    );
    for (const row of roomsResult.rows) {
      handoverService.cleanup(row.id.toString());
    }
    logger.info({ roomCount: roomsResult.rows.length }, 'Cleaned up handover timers');
  } catch (error) {
    logger.error({ err: error }, 'Error cleaning up handover timers');
  }

  // 6. Close Redis connection
  try {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from Redis');
  }

  // 7. Close database connection
  try {
    await database.disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from database');
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export default app;
