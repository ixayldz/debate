import database from '../../config/database.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, ConflictError } from '../../common/utils/app-error.js';

export interface UserFollow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: Date;
}

export interface UserBlock {
  id: number;
  blocker_id: number;
  blocked_id: number;
  created_at: Date;
}

export class FollowService {
  async follow(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) {
      throw new ConflictError('You cannot follow yourself');
    }

    const existingBlock = await database.query(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [followingId, followerId]
    );

    if (existingBlock.rows.length > 0) {
      throw new ConflictError('You cannot follow this user');
    }

    try {
      await database.query(
        `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)`,
        [followerId, followingId]
      );

      await database.query(
        'UPDATE users SET follower_count = follower_count + 1 WHERE id = $1',
        [followingId]
      );
      await database.query(
        'UPDATE users SET following_count = following_count + 1 WHERE id = $1',
        [followerId]
      );

      await redisClient.getClient().sadd(RedisKeys.userFollowing(followerId.toString()), followingId.toString());
      await redisClient.getClient().sadd(RedisKeys.userFollowers(followingId.toString()), followerId.toString());

      logger.info({ followerId, followingId }, 'User followed');
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('Already following this user');
      }
      throw error;
    }
  }

  async unfollow(followerId: number, followingId: number): Promise<void> {
    const result = await database.query(
      'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2 RETURNING id',
      [followerId, followingId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Not following this user');
    }

    await database.query(
      'UPDATE users SET follower_count = follower_count - 1 WHERE id = $1 AND follower_count > 0',
      [followingId]
    );
    await database.query(
      'UPDATE users SET following_count = following_count - 1 WHERE id = $1 AND following_count > 0',
      [followerId]
    );

    await redisClient.getClient().srem(RedisKeys.userFollowing(followerId.toString()), followingId.toString());
    await redisClient.getClient().srem(RedisKeys.userFollowers(followingId.toString()), followerId.toString());

    logger.info({ followerId, followingId }, 'User unfollowed');
  }

  async getFollowers(userId: number, page = 1, limit = 20): Promise<{ users: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM user_follows WHERE following_id = $1',
      [userId]
    );

    const result = await database.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, uf.created_at as followed_at
       FROM user_follows uf
       JOIN users u ON uf.follower_id = u.id
       WHERE uf.following_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async getFollowing(userId: number, page = 1, limit = 20): Promise<{ users: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await database.query(
      'SELECT COUNT(*) as total FROM user_follows WHERE follower_id = $1',
      [userId]
    );

    const result = await database.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_verified, uf.created_at as followed_at
       FROM user_follows uf
       JOIN users u ON uf.following_id = u.id
       WHERE uf.follower_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
    };
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const result = await database.query(
      'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export class BlockService {
  async block(blockerId: number, blockedId: number): Promise<void> {
    if (blockerId === blockedId) {
      throw new ConflictError('You cannot block yourself');
    }

    try {
      await database.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`,
        [blockerId, blockedId]
      );

      // Remove follows in both directions, but only update counts if they actually existed
      const result1 = await database.query(
        'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2 RETURNING id',
        [blockerId, blockedId]
      );
      if (result1.rowCount && result1.rowCount > 0) {
        await database.query(
          'UPDATE users SET following_count = following_count - 1 WHERE id = $1 AND following_count > 0',
          [blockerId]
        );
        await database.query(
          'UPDATE users SET follower_count = follower_count - 1 WHERE id = $1 AND follower_count > 0',
          [blockedId]
        );
      }

      const result2 = await database.query(
        'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2 RETURNING id',
        [blockedId, blockerId]
      );
      if (result2.rowCount && result2.rowCount > 0) {
        await database.query(
          'UPDATE users SET following_count = following_count - 1 WHERE id = $1 AND following_count > 0',
          [blockedId]
        );
        await database.query(
          'UPDATE users SET follower_count = follower_count - 1 WHERE id = $1 AND follower_count > 0',
          [blockerId]
        );
      }

      // Clean up Redis follow sets
      await redisClient.getClient().srem(RedisKeys.userFollowing(blockerId.toString()), blockedId.toString());
      await redisClient.getClient().srem(RedisKeys.userFollowers(blockedId.toString()), blockerId.toString());
      await redisClient.getClient().srem(RedisKeys.userFollowing(blockedId.toString()), blockerId.toString());
      await redisClient.getClient().srem(RedisKeys.userFollowers(blockerId.toString()), blockedId.toString());

      await redisClient.getClient().sadd(RedisKeys.userBlocked(blockerId.toString()), blockedId.toString());

      logger.info({ blockerId, blockedId }, 'User blocked');
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('Already blocking this user');
      }
      throw error;
    }
  }

  async unblock(blockerId: number, blockedId: number): Promise<void> {
    const result = await database.query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING id',
      [blockerId, blockedId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Not blocking this user');
    }

    await redisClient.getClient().srem(RedisKeys.userBlocked(blockerId.toString()), blockedId.toString());

    logger.info({ blockerId, blockedId }, 'User unblocked');
  }

  async getBlockedUsers(userId: number): Promise<any[]> {
    const result = await database.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, ub.created_at as blocked_at
       FROM user_blocks ub
       JOIN users u ON ub.blocked_id = u.id
       WHERE ub.blocker_id = $1
       ORDER BY ub.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async isBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    const result = await database.query(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const followService = new FollowService();
export const blockService = new BlockService();
export default { followService, blockService };
