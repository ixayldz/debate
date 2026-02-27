import rateLimit from 'express-rate-limit';
import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import config from '../config/index.js';

interface RateLimitInfo {
  totalHits: number;
  resetTime: Date;
}

interface RateLimitStore {
  init(options: { windowMs: number }): void;
  increment(key: string): Promise<RateLimitInfo>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
  get?(key: string): Promise<RateLimitInfo | undefined>;
}

class LazyRedisStore implements RateLimitStore {
  private windowMs = 60_000;
  prefix = 'rl:';

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  private keyFor(identifier: string): string {
    return `${this.prefix}${identifier}`;
  }

  async increment(identifier: string): Promise<RateLimitInfo> {
    const client = redisClient.getClient();
    const key = this.keyFor(identifier);

    const totalHits = await client.incr(key);
    if (totalHits === 1) {
      await client.pexpire(key, this.windowMs);
    }

    const ttlMs = await client.pttl(key);
    const resetTime = new Date(Date.now() + Math.max(ttlMs, 0));
    return { totalHits, resetTime };
  }

  async decrement(identifier: string): Promise<void> {
    const client = redisClient.getClient();
    const key = this.keyFor(identifier);
    const totalHits = await client.decr(key);
    if (totalHits <= 0) {
      await client.del(key);
    }
  }

  async resetKey(identifier: string): Promise<void> {
    const client = redisClient.getClient();
    await client.del(this.keyFor(identifier));
  }

  async get(identifier: string): Promise<RateLimitInfo | undefined> {
    const client = redisClient.getClient();
    const key = this.keyFor(identifier);
    const value = await client.get(key);

    if (value === null) {
      return undefined;
    }

    const totalHits = parseInt(value, 10);
    const ttlMs = await client.pttl(key);
    const resetTime = new Date(Date.now() + Math.max(ttlMs, 0));
    return { totalHits, resetTime };
  }
}

function createHttpRedisStore(prefix: string): LazyRedisStore {
  const redisPrefix = config.redis.keyPrefix ? `${config.redis.keyPrefix}:` : '';
  return new LazyRedisStore(`${redisPrefix}${prefix}`);
}

export const authLimiter = rateLimit({
  store: createHttpRedisStore('rl:auth:'),
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
});

export const apiLimiter = rateLimit({
  store: createHttpRedisStore('rl:api:'),
  windowMs: 60 * 1000,
  limit: 100,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
});

export const wsLimiter = rateLimit({
  store: createHttpRedisStore('rl:ws:'),
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Too many messages' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
});

export const authLoginLimiter = rateLimit({
  store: createHttpRedisStore('rl:auth-login:'),
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
});

// Redis-backed WebSocket rate limiter
interface WsRateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function createWsRateLimiter(config: WsRateLimitConfig) {
  const { windowMs, maxRequests } = config;
  const windowSeconds = Math.floor(windowMs / 1000);
  const redisPrefix = (process.env.REDIS_KEY_PREFIX || '').trim();

  return async (identifier: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> => {
    const baseKey = `ws:ratelimit:${identifier}`;
    const key = redisPrefix ? `${redisPrefix}:${baseKey}` : baseKey;

    try {
      const client = redisClient.getClient();
      const current = await client.get(key);

      if (current === null) {
        await client.set(key, '1', 'EX', windowSeconds);
        return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds };
      }

      const count = parseInt(current, 10);

      if (count >= maxRequests) {
        const ttl = await client.ttl(key);
        return { allowed: false, remaining: 0, resetIn: ttl > 0 ? ttl : windowSeconds };
      }

      await client.incr(key);
      return { allowed: true, remaining: maxRequests - count - 1, resetIn: await client.ttl(key) };
    } catch (error) {
      // On Redis error, allow the request but log
      logger.error({ err: error, identifier }, 'WebSocket rate limiter error');
      return { allowed: true, remaining: maxRequests, resetIn: windowSeconds };
    }
  };
}

// Pre-configured WebSocket rate limiters
export const wsConnectionLimiter = createWsRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 connections per minute
});

export const wsMessageLimiter = createWsRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 messages per minute
});

export const wsJoinLimiter = createWsRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 room joins per minute
});
