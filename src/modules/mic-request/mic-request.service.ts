import { v4 as uuidv4 } from 'uuid';
import { roomService } from '../room/room.service.js';
import { UserRole } from '../../types/enums.js';
import { BadRequestError, NotFoundError } from '../../common/utils/app-error.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import config from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { MicRequest } from '../../types/global.js';
import database from '../../config/database.js';

export class MicRequestService {
  async addToQueue(roomId: string, userId: string): Promise<void> {
    const room = await roomService.findById(roomId);

    if (!room.mic_requests_enabled) {
      throw new BadRequestError('Mic requests are currently disabled');
    }

    const participant = await roomService.getParticipant(roomId, userId);

    if (participant.role !== UserRole.LISTENER) {
      throw new BadRequestError('Only listeners can request to speak');
    }

    if (participant.is_hand_raised) {
      throw new BadRequestError('You already have a pending request');
    }

    const isOnCooldown = await this.isOnCooldown(roomId, userId);
    if (isOnCooldown) {
      throw new BadRequestError('You are on cooldown after a recent rejection');
    }

    const queue = await this.getQueue(roomId);
    const existingRequest = queue.find(r => r.userId === userId && r.status === 'pending');

    if (existingRequest) {
      throw new BadRequestError('You already have a pending request');
    }

    const request: MicRequest = {
      id: uuidv4(),
      userId,
      roomId,
      timestamp: Date.now(),
      status: 'pending',
    };

    await redisClient.getClient().lpush(
      RedisKeys.roomMicQueue(roomId),
      JSON.stringify(request)
    );

    await database.query(
      'UPDATE room_participants SET is_hand_raised = true WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), parseInt(userId)]
    );

    logger.debug({ roomId, userId, requestId: request.id }, 'Mic request added to queue');
  }

  async removeFromQueue(roomId: string, userId: string): Promise<void> {
    const queue = await this.getQueue(roomId);
    const request = queue.find(r => r.userId === userId && r.status === 'pending');

    if (!request) {
      return;
    }

    const queueKey = RedisKeys.roomMicQueue(roomId);
    const allRequests = await redisClient.getClient().lrange(queueKey, 0, -1);

    for (const req of allRequests) {
      const parsed = JSON.parse(req) as MicRequest;
      if (parsed.userId === userId && parsed.status === 'pending') {
        await redisClient.getClient().lrem(queueKey, 1, req);
        break;
      }
    }

    await database.query(
      'UPDATE room_participants SET is_hand_raised = false WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), parseInt(userId)]
    );

    logger.debug({ roomId, userId }, 'Mic request removed from queue');
  }

  async getQueue(roomId: string): Promise<MicRequest[]> {
    const queueKey = RedisKeys.roomMicQueue(roomId);
    const rawQueue = await redisClient.getClient().lrange(queueKey, 0, -1);

    const queue: MicRequest[] = [];
    for (const item of rawQueue) {
      try {
        const parsed = JSON.parse(item) as MicRequest;
        queue.push(parsed);
      } catch {
        logger.warn({ item }, 'Failed to parse mic request');
      }
    }

    return queue.reverse();
  }

  async acceptRequest(
    roomId: string,
    requestId: string,
    moderatorId: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new BadRequestError('Only moderators can accept mic requests');
    }

    const room = await roomService.findById(roomId);
    const speakerCount = await roomService.getSpeakerCount(roomId);

    if (speakerCount >= room.max_speakers) {
      throw new BadRequestError('Maximum speakers reached');
    }

    const queue = await this.getQueue(roomId);
    const request = queue.find(r => r.id === requestId);

    if (!request) {
      throw new NotFoundError('Mic request');
    }

    await this.removeFromQueue(roomId, request.userId);

    await roomService.changeRole(roomId, request.userId, UserRole.SPEAKER, moderatorId);

    logger.info({ roomId, requestId, moderatorId }, 'Mic request accepted');
  }

  async rejectRequest(roomId: string, requestId: string, moderatorId: string): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new BadRequestError('Only moderators can reject mic requests');
    }

    const queue = await this.getQueue(roomId);
    const request = queue.find(r => r.id === requestId);

    if (!request) {
      throw new NotFoundError('Mic request');
    }

    await this.removeFromQueue(roomId, request.userId);
    await this.startCooldown(roomId, request.userId);

    logger.info({ roomId, requestId, moderatorId }, 'Mic request rejected');
  }

  async startCooldown(roomId: string, userId: string): Promise<void> {
    const cooldownKey = RedisKeys.userCooldown(roomId, userId);
    const expiresAt = Date.now() + config.room.micRequestCooldownSeconds * 1000;

    await redisClient.getClient().set(
      cooldownKey,
      expiresAt.toString(),
      'EX',
      config.room.micRequestCooldownSeconds
    );
  }

  async isOnCooldown(roomId: string, userId: string): Promise<boolean> {
    const cooldownKey = RedisKeys.userCooldown(roomId, userId);
    const expiresAt = await redisClient.getClient().get(cooldownKey);

    if (!expiresAt) {
      return false;
    }

    return Date.now() < parseInt(expiresAt, 10);
  }

  async getCooldownEndTime(roomId: string, userId: string): Promise<number | null> {
    const cooldownKey = RedisKeys.userCooldown(roomId, userId);
    const expiresAt = await redisClient.getClient().get(cooldownKey);

    if (!expiresAt) {
      return null;
    }

    return parseInt(expiresAt, 10);
  }
}

export const micRequestService = new MicRequestService();
export default micRequestService;
