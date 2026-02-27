import { roomService } from '../room/room.service.js';
import { RoomStatus, UserRole } from '../../types/enums.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { EventEmitter } from 'events';
import database from '../../config/database.js';
import {
  recordGracePeriodCancelled,
  recordHandoverCompleted,
  recordHandoverFailed,
  recordHandoverStarted,
} from '../../config/metrics.js';

export class HandoverService extends EventEmitter {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly GRACE_TIMER_PREFIX = 'room:grace_timer:';

  async startGracePeriod(roomId: string): Promise<void> {
    const room = await roomService.findById(roomId);

    if (room.status !== RoomStatus.LIVE) {
      return;
    }

    const gracePeriodEnd = Date.now() + config.room.defaultGracePeriodSeconds * 1000;

    await redisClient.getClient().hset(
      RedisKeys.roomState(roomId),
      'status',
      RoomStatus.GRACE_WAITING_FOR_OWNER
    );
    await redisClient.getClient().hset(
      RedisKeys.roomState(roomId),
      'gracePeriodEnd',
      gracePeriodEnd.toString()
    );

    // Store timer metadata in Redis for recovery
    const timerMetadata = JSON.stringify({
      roomId,
      gracePeriodEnd,
      startedAt: Date.now(),
    });
    await redisClient.getClient().set(
      this.GRACE_TIMER_PREFIX + roomId,
      timerMetadata,
      'EX',
      config.room.defaultGracePeriodSeconds + 60 // Slightly longer than grace period
    );

    // Update room in PostgreSQL
    await database.query(
      `UPDATE rooms SET status = $1, grace_period_end = $2, updated_at = NOW() WHERE id = $3`,
      [RoomStatus.GRACE_WAITING_FOR_OWNER, new Date(gracePeriodEnd), parseInt(roomId)]
    );

    logger.info({ roomId, gracePeriodEnd }, 'Grace period started');
    recordHandoverStarted();

    const timer = setTimeout(async () => {
      await this.executeHandover(roomId);
    }, config.room.defaultGracePeriodSeconds * 1000);

    this.timers.set(roomId, timer);

    this.emit('handover:start', roomId);
  }

  async cancelGracePeriod(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }

    // Delete timer metadata from Redis
    await redisClient.getClient().del(this.GRACE_TIMER_PREFIX + roomId);

    const room = await roomService.findById(roomId);

    if (room.status === RoomStatus.GRACE_WAITING_FOR_OWNER) {
      await redisClient.getClient().hset(
        RedisKeys.roomState(roomId),
        'status',
        RoomStatus.LIVE
      );
      await redisClient.getClient().hset(
        RedisKeys.roomState(roomId),
        'gracePeriodEnd',
        ''
      );

      // Update room in PostgreSQL
      await database.query(
        `UPDATE rooms SET status = $1, grace_period_end = NULL, updated_at = NOW() WHERE id = $2`,
        [RoomStatus.LIVE, parseInt(roomId)]
      );

      logger.info({ roomId }, 'Grace period cancelled');
      recordGracePeriodCancelled();
    }
  }

  async executeHandover(roomId: string): Promise<void> {
    // Clean up timer from memory and Redis
    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }
    await redisClient.getClient().del(this.GRACE_TIMER_PREFIX + roomId);

    try {
      const successorId = await this.selectSuccessor(roomId);

      if (!successorId) {
        logger.warn({ roomId }, 'No successor found, ending room');
        await roomService.endRoom(roomId);
        recordHandoverFailed('no_successor');
        this.emit('handover:failed', roomId, 'no_successor');
        return;
      }

      const currentOwners = await database.query(
        `SELECT user_id FROM room_participants WHERE room_id = $1 AND role = $2`,
        [parseInt(roomId), UserRole.OWNER_MODERATOR]
      );

      for (const ownerRow of currentOwners.rows) {
        const currentOwnerId = ownerRow.user_id.toString();
        if (currentOwnerId !== successorId) {
          await roomService.changeRole(roomId, currentOwnerId, UserRole.MODERATOR, 'system');
        }
      }

      await roomService.changeRole(roomId, successorId, UserRole.OWNER_MODERATOR, 'system');

      await redisClient.getClient().hset(
        RedisKeys.roomState(roomId),
        'status',
        RoomStatus.LIVE
      );
      await redisClient.getClient().hset(
        RedisKeys.roomState(roomId),
        'gracePeriodEnd',
        ''
      );

      // Update room in PostgreSQL
      await database.query(
        `UPDATE rooms
         SET status = $1, grace_period_end = NULL, created_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [RoomStatus.LIVE, parseInt(successorId), parseInt(roomId)]
      );

      logger.info({ roomId, successorId }, 'Handover completed');
      recordHandoverCompleted();

      this.emit('handover:complete', roomId, successorId);
    } catch (error) {
      logger.error({ err: error, roomId }, 'Error executing handover');
      await roomService.endRoom(roomId);
      recordHandoverFailed('error');
      this.emit('handover:failed', roomId, 'error');
    }
  }

  async selectSuccessor(roomId: string): Promise<string | null> {
    const moderators = await redisClient.getClient().smembers(RedisKeys.roomModerators(roomId));
    const room = await roomService.findById(roomId);

    const ownerResult = await database.query(
      `SELECT user_id FROM room_participants WHERE room_id = $1 AND role = $2 LIMIT 1`,
      [parseInt(roomId), UserRole.OWNER_MODERATOR]
    );

    const ownerId = ownerResult.rows[0]?.user_id?.toString();
    const otherModerators = ownerId
      ? moderators.filter(m => m !== ownerId)
      : moderators;

    if (otherModerators.length > 0) {
      const sortedByJoinTime = await this.sortByJoinTime(roomId, otherModerators);

      if (sortedByJoinTime.length > 0) {
        logger.debug({ roomId, successorId: sortedByJoinTime[0] }, 'Successor: active moderator');
        return sortedByJoinTime[0];
      }
    }

    if (room.designated_successor) {
      const successorId = room.designated_successor.toString();
      const isInRoom = await redisClient.getClient().sismember(
        RedisKeys.roomSpeakers(roomId),
        successorId
      );
      const isConnected = await redisClient.getClient().hexists(
        RedisKeys.roomPresence(roomId),
        successorId
      );

      if (isInRoom && isConnected) {
        logger.debug({ roomId, successorId }, 'Successor: designated successor');
        return successorId;
      }
    }

    const speakerMembers = await redisClient.getClient().smembers(RedisKeys.roomSpeakers(roomId));
    const speakers = ownerId
      ? speakerMembers.filter(member => member !== ownerId)
      : speakerMembers;

    if (speakers.length > 0) {
      const sortedByStageTime = await this.sortByStageJoinedTime(roomId, speakers);

      if (sortedByStageTime.length > 0) {
        logger.debug({ roomId, successorId: sortedByStageTime[0] }, 'Successor: longest-serving speaker');
        return sortedByStageTime[0];
      }
    }

    logger.warn({ roomId }, 'No successor found');
    return null;
  }

  /**
   * Recover grace period timers after server restart.
   * Queries PostgreSQL for rooms in GRACE_WAITING_FOR_OWNER status
   * and restarts timers with remaining time.
   */
  async recoverTimers(): Promise<{ recovered: number; expired: number }> {
    logger.info('Recovering grace period timers...');

    let recovered = 0;
    let expired = 0;

    try {
      // Find all rooms in grace period state
      const result = await database.query(
        `SELECT id, grace_period_end FROM rooms WHERE status = $1`,
        [RoomStatus.GRACE_WAITING_FOR_OWNER]
      );

      logger.info({ count: result.rows.length }, 'Found rooms in grace period');

      for (const row of result.rows) {
        const roomId = row.id.toString();
        const gracePeriodEnd = row.grace_period_end ? new Date(row.grace_period_end).getTime() : null;

        if (!gracePeriodEnd) {
          // No grace period end set, end the room
          logger.warn({ roomId }, 'Room in grace period without grace_period_end, ending room');
          await roomService.endRoom(roomId);
          expired++;
          continue;
        }

        const remainingMs = gracePeriodEnd - Date.now();

        if (remainingMs <= 0) {
          // Grace period already expired, execute handover immediately
          logger.info({ roomId }, 'Grace period expired, executing handover');
          await this.executeHandover(roomId);
          expired++;
        } else {
          // Restart timer with remaining time
          logger.info({ roomId, remainingMs }, 'Recovering grace period timer');

          const timer = setTimeout(async () => {
            await this.executeHandover(roomId);
          }, remainingMs);

          this.timers.set(roomId, timer);

          // Restore timer metadata in Redis
          const timerMetadata = JSON.stringify({
            roomId,
            gracePeriodEnd,
            startedAt: gracePeriodEnd - config.room.defaultGracePeriodSeconds * 1000,
            recovered: true,
          });
          await redisClient.getClient().set(
            this.GRACE_TIMER_PREFIX + roomId,
            timerMetadata,
            'EX',
            Math.ceil(remainingMs / 1000) + 60
          );

          recovered++;
        }
      }

      logger.info({ recovered, expired }, 'Grace period timer recovery complete');
    } catch (error) {
      logger.error({ err: error }, 'Error recovering grace period timers');
    }

    return { recovered, expired };
  }

  private async sortByJoinTime(roomId: string, userIds: string[]): Promise<string[]> {
    const presenceData = await redisClient.getClient().hmget(
      RedisKeys.roomPresence(roomId),
      ...userIds
    );

    const usersWithTime = userIds
      .map((userId, index) => ({
        userId,
        connectedAt: presenceData[index]
          ? JSON.parse(presenceData[index]).connectedAt
          : 0,
      }))
      .filter(u => u.connectedAt > 0)
      .sort((a, b) => a.connectedAt - b.connectedAt);

    return usersWithTime.map(u => u.userId);
  }

  private async sortByStageJoinedTime(roomId: string, userIds: string[]): Promise<string[]> {
    // Use PostgreSQL instead of Mongoose
    const result = await database.query(
      `SELECT user_id FROM room_participants
       WHERE room_id = $1 AND user_id = ANY($2::int[]) AND stage_joined_at IS NOT NULL
       ORDER BY stage_joined_at ASC`,
      [parseInt(roomId), userIds.map(id => parseInt(id))]
    );

    return result.rows.map(row => row.user_id.toString());
  }

  cleanup(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }
    // Also delete timer metadata from Redis
    redisClient.getClient().del(this.GRACE_TIMER_PREFIX + roomId).catch(err => {
      logger.error({ err, roomId }, 'Error cleaning up grace timer from Redis');
    });
  }
}

export const handoverService = new HandoverService();
export default handoverService;
