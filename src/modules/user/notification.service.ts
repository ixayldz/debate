import database from '../../config/database.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { logger } from '../../config/logger.js';

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message?: string;
  data?: any;
  is_read: boolean;
  created_at: Date;
}

export class NotificationService {
  async createNotification(userId: number, data: {
    type: string;
    title: string;
    message?: string;
    data?: any;
  }): Promise<Notification> {
    const result = await database.query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, data.type, data.title, data.message, JSON.stringify(data.data || {})]
    );

    await redisClient.getClient().lpush(
      RedisKeys.notificationQueue(userId.toString()),
      JSON.stringify(result.rows[0])
    );

    logger.debug({ userId, type: data.type }, 'Notification created');
    return result.rows[0];
  }

  async getNotifications(userId: number, page = 1, limit = 20): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const offset = (page - 1) * limit;

    const unreadResult = await database.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const result = await database.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      notifications: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].count),
    };
  }

  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await database.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  async markAllAsRead(userId: number): Promise<void> {
    await database.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    logger.info({ userId }, 'All notifications marked as read');
  }

  async deleteNotification(notificationId: number, userId: number): Promise<void> {
    await database.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }

  async deleteOldNotifications(userId: number, daysOld = 30): Promise<void> {
    // Validate input to prevent abuse
    if (!Number.isInteger(daysOld) || daysOld < 1 || daysOld > 365) {
      daysOld = 30;
    }
    const result = await database.query(
      `DELETE FROM notifications 
       WHERE user_id = $1 AND is_read = true AND created_at < NOW() - INTERVAL '1 day' * $2`,
      [userId, daysOld]
    );

    if (result.rowCount && result.rowCount > 0) {
      logger.info({ userId, deletedCount: result.rowCount }, 'Old notifications deleted');
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
