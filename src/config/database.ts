import { Pool, QueryResult } from 'pg';
import { logger } from './logger.js';
import config from './index.js';

class Database {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    const connectionString = config.database.url;
    
    this.pool = new Pool({
      connectionString,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
      max: config.database.poolMax,
      idleTimeoutMillis: config.database.idleTimeoutMs,
      connectionTimeoutMillis: config.database.connectionTimeoutMs,
    });

    try {
      const client = await this.pool.connect();
      client.release();
      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to connect to PostgreSQL');
      throw error;
    }
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return this.pool;
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return this.pool.query(text, params);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    }
  }
}

export const database = new Database();
export default database;
