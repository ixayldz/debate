import { randomUUID } from 'crypto';
import database from '../src/config/database.js';
import runMigrations from '../src/config/migrations.js';
import { redisClient } from '../src/config/redis.js';
import { logger } from '../src/config/logger.js';
import config from '../src/config/index.js';

async function verifyDatabase(): Promise<void> {
  await database.connect();
  await runMigrations();

  const health = await database.query('SELECT 1 AS ok');
  if (Number(health.rows[0]?.ok) !== 1) {
    throw new Error('Database health query failed');
  }

  const migrationCountResult = await database.query(
    'SELECT COUNT(*)::int AS count FROM schema_migrations'
  );
  const migrationCount = Number(migrationCountResult.rows[0]?.count ?? 0);
  if (migrationCount < 1) {
    throw new Error('No applied migrations found');
  }

  const username = `ci_smoke_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const insertResult = await database.query(
    `INSERT INTO users (username, display_name, status)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [username, 'CI Smoke User', 'active']
  );
  const userId = Number(insertResult.rows[0]?.id);
  if (!userId) {
    throw new Error('Failed to insert smoke test user');
  }

  await database.query('DELETE FROM users WHERE id = $1', [userId]);
  logger.info({ migrationCount }, 'Database smoke checks passed');
}

async function verifyRedis(): Promise<void> {
  await redisClient.connect();
  const client = redisClient.getClient();

  const baseKey = `ci:smoke:${randomUUID()}`;
  const key = config.redis.keyPrefix ? `${config.redis.keyPrefix}:${baseKey}` : baseKey;
  await client.set(key, 'ok', 'EX', 30);

  const value = await client.get(key);
  if (value !== 'ok') {
    throw new Error('Redis read/write check failed');
  }

  const ttl = await client.ttl(key);
  if (ttl <= 0) {
    throw new Error('Redis TTL check failed');
  }

  await client.del(key);
  logger.info({ ttl }, 'Redis smoke checks passed');
}

async function main(): Promise<void> {
  try {
    await verifyDatabase();
    await verifyRedis();
    logger.info('Infrastructure smoke checks completed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Infrastructure smoke checks failed');
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([
      redisClient.disconnect(),
      database.disconnect(),
    ]);
  }
}

void main();
