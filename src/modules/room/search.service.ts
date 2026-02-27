import database from '../../config/database.js';
import { redisClient } from '../../config/redis.js';

export interface RoomSearchParams {
  query?: string;
  category?: string;
  language?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class RoomSearchService {
  async search(params: RoomSearchParams): Promise<{ rooms: any[]; total: number; page: number; limit: number }> {
    const { query, category, language, status, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(r.title ILIKE $${paramIndex} OR r.description ILIKE $${paramIndex})`);
      values.push(`%${query}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`(r.category = $${paramIndex} OR rc.slug = $${paramIndex})`);
      values.push(category);
      paramIndex++;
    }

    if (language) {
      conditions.push(`r.language = $${paramIndex}`);
      values.push(language);
      paramIndex++;
    }

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    } else {
      conditions.push(`r.status = 'live'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await database.query(
      `SELECT COUNT(*) as total FROM rooms r
       LEFT JOIN room_categories rc ON r.category_id = rc.id
       ${whereClause}`,
      values
    );

    values.push(limit, offset);
    const result = await database.query(
      `SELECT r.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar,
              rc.name as category_name, rc.slug as category_slug, rc.icon as category_icon, rc.color as category_color,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id AND role = 'speaker') as speaker_count,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id AND role = 'listener') as listener_count
       FROM rooms r
       LEFT JOIN room_categories rc ON r.category_id = rc.id
       JOIN users u ON r.created_by = u.id
       ${whereClause}
       ORDER BY 
         CASE WHEN r.is_featured THEN 0 ELSE 1 END,
         r.viewer_count DESC,
         r.started_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    return {
      rooms: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    };
  }

  async getLiveRooms(params: {
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{ rooms: any[]; total: number }> {
    return this.search({
      ...params,
      status: 'live',
    });
  }

  async getTrendingRooms(limit = 10): Promise<any[]> {
    const result = await database.query(
      `SELECT r.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar,
              rc.name as category_name, rc.slug as category_slug, rc.icon as category_icon,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count
       FROM rooms r
       LEFT JOIN room_categories rc ON r.category_id = rc.id
       JOIN users u ON r.created_by = u.id
       WHERE r.status = 'live'
       ORDER BY r.viewer_count DESC, participant_count DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async getFeaturedRooms(limit = 5): Promise<any[]> {
    const result = await database.query(
      `SELECT r.*, u.username as owner_username, u.display_name as owner_display_name, u.avatar_url as owner_avatar,
              rc.name as category_name, rc.slug as category_slug, rc.icon as category_icon
       FROM rooms r
       LEFT JOIN room_categories rc ON r.category_id = rc.id
       JOIN users u ON r.created_by = u.id
       WHERE r.status = 'live' AND r.is_featured = true
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async updateViewerCount(roomId: number, delta: number): Promise<void> {
    await database.query(
      'UPDATE rooms SET viewer_count = viewer_count + $1 WHERE id = $2',
      [delta, roomId]
    );

    await redisClient.getClient().zincrby('room:trending', delta, roomId.toString());
  }
}

export const roomSearchService = new RoomSearchService();
export default roomSearchService;
