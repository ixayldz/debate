import database from '../../config/database.js';

export class RoomRepository {
  async create(data: {
    title: string;
    description?: string;
    category?: string;
    language?: string;
    visibility?: string;
    max_speakers?: number;
    mic_requests_enabled?: boolean;
    created_by: number;
    status?: string;
  }): Promise<any> {
    const result = await database.query(
      `INSERT INTO rooms (title, description, category, language, visibility, max_speakers, mic_requests_enabled, created_by, status, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        data.title,
        data.description,
        data.category,
        data.language || 'tr',
        data.visibility || 'public',
        data.max_speakers || 6,
        data.mic_requests_enabled !== false,
        data.created_by,
        data.status || 'live'
      ]
    );
    return result.rows[0];
  }

  async findById(id: number): Promise<any> {
    const result = await database.query(
      'SELECT * FROM rooms WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(params: {
    category?: string;
    language?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE visibility = $1';
    const values: any[] = ['public'];

    if (params.status) {
      whereClause += ' AND status = $' + (values.length + 1);
      values.push(params.status);
    } else {
      whereClause += ' AND status = $' + (values.length + 1);
      values.push('live');
    }

    if (params.category) {
      whereClause += ' AND category = $' + (values.length + 1);
      values.push(params.category);
    }

    if (params.language) {
      whereClause += ' AND language = $' + (values.length + 1);
      values.push(params.language);
    }

    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM rooms ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await database.query(
      `SELECT * FROM rooms ${whereClause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return { data: dataResult.rows, total };
  }

  async update(id: number, data: Partial<{
    title: string;
    description: string;
    category: string;
    visibility: string;
    max_speakers: number;
    mic_requests_enabled: boolean;
    status: string;
    grace_period_end: Date | null;
    designated_successor: number | null;
  }>): Promise<any> {
    const allowedColumns = new Set([
      'title', 'description', 'category', 'category_id', 'language',
      'visibility', 'status', 'max_speakers', 'mic_requests_enabled',
      'designated_successor', 'tags', 'is_featured', 'grace_period_end',
      'started_at', 'ended_at', 'viewer_count'
    ]);
    const keys = Object.keys(data).filter(k => allowedColumns.has(k));
    const values = keys.map(k => (data as any)[k]);
    if (keys.length === 0) return this.findById(id);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await database.query(
      `UPDATE rooms SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async close(id: number): Promise<any> {
    const result = await database.query(
      `UPDATE rooms SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await database.query('DELETE FROM rooms WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async setDesignatedSuccessor(roomId: number, userId: number | null): Promise<any> {
    const result = await database.query(
      `UPDATE rooms SET designated_successor = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [userId, roomId]
    );
    return result.rows[0] || null;
  }
}

export const roomRepository = new RoomRepository();
export default roomRepository;
