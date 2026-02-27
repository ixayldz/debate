import database from '../../config/database.js';
import { BadRequestError } from '../utils/app-error.js';

// SQL Injection protection - whitelist validation
const VALID_ORDER_DIRECTIONS = ['ASC', 'DESC'] as const;
const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(identifier: string, type: string): void {
  if (!IDENTIFIER_REGEX.test(identifier)) {
    throw new BadRequestError(`Invalid ${type} name: potential SQL injection detected`);
  }
}

function validateOrderDirection(direction: string): 'ASC' | 'DESC' {
  const upper = direction.toUpperCase();
  if (!VALID_ORDER_DIRECTIONS.includes(upper as any)) {
    throw new BadRequestError('Invalid order direction: must be ASC or DESC');
  }
  return upper as 'ASC' | 'DESC';
}

export class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    validateIdentifier(tableName, 'table');
    this.tableName = tableName;
  }

  async findById(id: number): Promise<any> {
    const result = await database.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findOne(where: Record<string, any>): Promise<any> {
    const keys = Object.keys(where);
    // Validate all column names
    keys.forEach(key => validateIdentifier(key, 'column'));

    const values = Object.values(where);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');

    const result = await database.query(
      `SELECT * FROM ${this.tableName} WHERE ${conditions}`,
      values
    );
    return result.rows[0] || null;
  }

  async findAll(where?: Record<string, any>, options?: { limit?: number; offset?: number; orderBy?: string; order?: 'ASC' | 'DESC' }): Promise<any[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const keys = Object.keys(where);
      // Validate all column names
      keys.forEach(key => validateIdentifier(key, 'column'));

      const values = Object.values(where);
      const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${conditions}`;
      params.push(...values);
    }

    if (options?.orderBy) {
      // Validate orderBy column name to prevent SQL injection
      validateIdentifier(options.orderBy, 'orderBy column');
      const direction = validateOrderDirection(options.order || 'ASC');
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    }

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const result = await database.query(query, params);
    return result.rows;
  }

  async create(data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    // Validate all column names
    keys.forEach(key => validateIdentifier(key, 'column'));

    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const result = await database.query(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async update(id: number, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    // Validate all column names
    keys.forEach(key => validateIdentifier(key, 'column'));

    const values = Object.values(data);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await database.query(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await database.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async count(where?: Record<string, any>): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const keys = Object.keys(where);
      // Validate all column names
      keys.forEach(key => validateIdentifier(key, 'column'));

      const values = Object.values(where);
      const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
      query += ` WHERE ${conditions}`;
      params.push(...values);
    }

    const result = await database.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }
}

export default BaseRepository;
