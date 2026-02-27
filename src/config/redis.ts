import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger.js';
import config from './index.js';

class RedisClient {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  async connect(): Promise<void> {
    const { host, port, password, tls } = config.redis;
    
    const options: RedisOptions = {
      host,
      port,
      password: password || undefined,
      tls: tls ? {} : undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis max retries exceeded');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    };

    this.client = new Redis(options);
    this.subscriber = new Redis(options);
    this.publisher = new Redis(options);

    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized');
    }
    return this.subscriber;
  }

  getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error('Redis publisher not initialized');
    }
    return this.publisher;
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client?.quit(),
        this.subscriber?.quit(),
        this.publisher?.quit(),
      ]);
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error({ err: error }, 'Error disconnecting from Redis');
      throw error;
    }
  }
}

export const redisClient = new RedisClient();
export default redisClient;
