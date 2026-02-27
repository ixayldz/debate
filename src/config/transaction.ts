import database from './database.js';
import { logger } from './logger.js';
import { PoolClient } from 'pg';

/**
 * Execute a function within a PostgreSQL transaction.
 * Automatically commits on success, rolls back on error.
 *
 * Usage:
 * ```ts
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO ...');
 *   await client.query('UPDATE ...');
 *   return someValue;
 * });
 * ```
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database.getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error }, 'Transaction rolled back');
    throw error;
  } finally {
    client.release();
  }
}

export default withTransaction;
