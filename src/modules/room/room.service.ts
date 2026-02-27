import { roomRepository } from './room.repository.js';
import { UserRole, RoomStatus } from '../../types/enums.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ServiceUnavailableError,
} from '../../common/utils/app-error.js';
import { CreateRoomInput, UpdateRoomInput } from '../../common/utils/validation.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { livekitService } from '../../config/livekit.js';
import { logger } from '../../config/logger.js';
import database from '../../config/database.js';
import config from '../../config/index.js';

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown room service error';
}

export class RoomService {
  async create(userId: string, input: CreateRoomInput): Promise<any> {
    const room = await roomRepository.create({
      title: input.title,
      description: input.description,
      category: input.category,
      language: input.language,
      visibility: input.visibility,
      max_speakers: input.maxSpeakers,
      mic_requests_enabled: input.micRequestsEnabled,
      created_by: parseInt(userId),
      status: 'live',
    });

    await this.addParticipant(room.id, parseInt(userId), UserRole.OWNER_MODERATOR);

    await this.initializeRoomState(room.id.toString());

    if (!livekitService.isConfigured() && config.services.livekitRequired) {
      await this.endRoom(room.id.toString(), { skipLiveKit: true });
      throw new ServiceUnavailableError('LiveKit service is not available');
    }

    if (livekitService.isConfigured()) {
      try {
        await livekitService.createRoom(room.id.toString());
      } catch (error) {
        if (config.services.livekitRequired) {
          await this.endRoom(room.id.toString(), { skipLiveKit: true });
          throw new ServiceUnavailableError('LiveKit room provisioning failed');
        }

        logger.warn(
          { roomId: room.id, message: extractErrorMessage(error) },
          'Failed to create LiveKit room'
        );
      }
    }

    logger.info({ roomId: room.id, userId }, 'Room created');

    return room;
  }

  async findById(roomId: string): Promise<any> {
    const room = await roomRepository.findById(parseInt(roomId));

    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    return room;
  }

  async list(params: {
    page?: number;
    limit?: number;
    category?: string;
    language?: string;
    status?: string;
  }): Promise<{ data: any[]; pagination: any }> {
    const result = await roomRepository.findAll({
      category: params.category,
      language: params.language,
      status: params.status,
      page: params.page,
      limit: params.limit,
    });

    return {
      data: result.data,
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (params.limit || 20)),
      },
    };
  }

  async getRoomParticipants(roomId: string): Promise<any[]> {
    await this.findById(roomId);

    const result = await database.query(
      `SELECT rp.*, u.username, u.display_name, u.avatar_url
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1
       ORDER BY rp.joined_at ASC`,
      [parseInt(roomId)]
    );

    return result.rows;
  }

  async update(roomId: string, userId: string, input: UpdateRoomInput): Promise<any> {
    const room = await this.findById(roomId);

    const participant = await this.getParticipant(roomId, userId);

    if (participant.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Only the owner can update room settings');
    }

    const updateData: any = {};
    if (input.title) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.visibility && input.visibility !== room.visibility) {
      if (room.status === RoomStatus.LIVE) {
        throw new BadRequestError('Room visibility cannot be changed while the room is live');
      }
      updateData.visibility = input.visibility;
    }
    if (input.maxSpeakers) updateData.max_speakers = input.maxSpeakers;
    if (input.micRequestsEnabled !== undefined) {
      updateData.mic_requests_enabled = input.micRequestsEnabled;
      await this.updateRoomState(roomId, { micRequestsEnabled: input.micRequestsEnabled });
    }

    const updated = await roomRepository.update(parseInt(roomId), updateData);

    logger.info({ roomId, userId }, 'Room updated');

    return updated;
  }

  async close(roomId: string, userId: string): Promise<void> {
    await this.findById(roomId);
    const participant = await this.getParticipant(roomId, userId);

    if (participant.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Only the owner can close the room');
    }

    await this.endRoom(roomId);
  }

  async addParticipant(roomId: string, userId: string | number, role: UserRole = UserRole.LISTENER): Promise<any> {
    const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
    const room = await this.findById(roomId);

    // Room ban check
    const banCheck = await database.query(
      'SELECT id FROM room_bans WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), userIdNum]
    );
    if (banCheck.rows.length > 0) {
      throw new ForbiddenError('You are banned from this room.');
    }

    const existing = await database.query(
      'SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), userIdNum]
    );

    if (existing.rows.length > 0) {
      const existingParticipant = existing.rows[0];
      const existingRole = existingParticipant.role as UserRole;
      const pipeline = redisClient.getClient().pipeline();

      // Heal Redis room membership state for reconnecting users in a single round-trip.
      if (
        existingRole === UserRole.SPEAKER ||
        existingRole === UserRole.MODERATOR ||
        existingRole === UserRole.OWNER_MODERATOR
      ) {
        pipeline.sadd(RedisKeys.roomSpeakers(roomId), userIdNum.toString());
        pipeline.srem(RedisKeys.roomListeners(roomId), userIdNum.toString());
      } else {
        pipeline.sadd(RedisKeys.roomListeners(roomId), userIdNum.toString());
        pipeline.srem(RedisKeys.roomSpeakers(roomId), userIdNum.toString());
      }

      if (existingRole === UserRole.MODERATOR || existingRole === UserRole.OWNER_MODERATOR) {
        pipeline.sadd(RedisKeys.roomModerators(roomId), userIdNum.toString());
      } else {
        pipeline.srem(RedisKeys.roomModerators(roomId), userIdNum.toString());
      }

      pipeline.set(RedisKeys.userRoom(userIdNum.toString()), roomId);
      await pipeline.exec();
      return existingParticipant;
    }

    // Multi-room prevention: users can only be in one room at a time
    if (role !== UserRole.OWNER_MODERATOR) {
      const existingRoom = await redisClient.getClient().get(RedisKeys.userRoom(userIdNum.toString()));
      if (existingRoom && existingRoom !== roomId) {
        const existingRoomId = Number(existingRoom);
        if (!Number.isInteger(existingRoomId)) {
          await redisClient.getClient().del(RedisKeys.userRoom(userIdNum.toString()));
        } else {
          const membership = await database.query(
            `SELECT r.status
             FROM room_participants rp
             JOIN rooms r ON r.id = rp.room_id
             WHERE rp.room_id = $1 AND rp.user_id = $2
             LIMIT 1`,
            [existingRoomId, userIdNum]
          );

          const isStaleMembership =
            membership.rows.length === 0 || membership.rows[0].status === RoomStatus.ENDED;

          if (isStaleMembership) {
            await redisClient.getClient().del(RedisKeys.userRoom(userIdNum.toString()));
          } else {
            throw new BadRequestError('You are already in another room. Please leave first.');
          }
        }
      }
    }

    // Private room access control
    if (room.visibility === 'private' && role !== UserRole.OWNER_MODERATOR) {
      const hasInvite = await redisClient.getClient().get(
        RedisKeys.roomInvite(roomId, userIdNum.toString())
      );
      if (!hasInvite && room.created_by !== userIdNum) {
        throw new ForbiddenError('This room is private. You need an invitation to join.');
      }
    }

    const result = await database.query(
      `INSERT INTO room_participants (room_id, user_id, role, is_muted, is_hand_raised, joined_at, stage_joined_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET role = room_participants.role
       RETURNING *`,
      [
        parseInt(roomId),
        userIdNum,
        role,
        role === UserRole.LISTENER,
        false,
        (role === UserRole.SPEAKER || role === UserRole.MODERATOR || role === UserRole.OWNER_MODERATOR) ? new Date() : null
      ]
    );

    const participant = result.rows[0];
    const effectiveRole = participant.role as UserRole;

    const pipeline = redisClient.getClient().pipeline();
    if (effectiveRole === UserRole.SPEAKER || effectiveRole === UserRole.MODERATOR || effectiveRole === UserRole.OWNER_MODERATOR) {
      pipeline.sadd(RedisKeys.roomSpeakers(roomId), userIdNum.toString());
      pipeline.srem(RedisKeys.roomListeners(roomId), userIdNum.toString());
    } else {
      pipeline.sadd(RedisKeys.roomListeners(roomId), userIdNum.toString());
      pipeline.srem(RedisKeys.roomSpeakers(roomId), userIdNum.toString());
    }

    if (effectiveRole === UserRole.MODERATOR || effectiveRole === UserRole.OWNER_MODERATOR) {
      pipeline.sadd(RedisKeys.roomModerators(roomId), userIdNum.toString());
    } else {
      pipeline.srem(RedisKeys.roomModerators(roomId), userIdNum.toString());
    }

    pipeline.set(RedisKeys.userRoom(userIdNum.toString()), roomId);
    await pipeline.exec();

    return participant;
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    const participantResult = await database.query(
      'SELECT role FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), parseInt(userId)]
    );
    const participant = participantResult.rows[0] || null;

    if (participant) {
      await database.query(
        'DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2',
        [parseInt(roomId), parseInt(userId)]
      );
    }

    const pipeline = redisClient.getClient().pipeline();

    if (participant) {
      if (participant.role === UserRole.SPEAKER || participant.role === UserRole.MODERATOR || participant.role === UserRole.OWNER_MODERATOR) {
        pipeline.srem(RedisKeys.roomSpeakers(roomId), userId);
      } else {
        pipeline.srem(RedisKeys.roomListeners(roomId), userId);
      }

      if (participant.role === UserRole.MODERATOR || participant.role === UserRole.OWNER_MODERATOR) {
        pipeline.srem(RedisKeys.roomModerators(roomId), userId);
      }
    } else {
      // Fallback cleanup for stale state when participant row no longer exists.
      pipeline.srem(RedisKeys.roomSpeakers(roomId), userId);
      pipeline.srem(RedisKeys.roomListeners(roomId), userId);
      pipeline.srem(RedisKeys.roomModerators(roomId), userId);
    }

    pipeline.hdel(RedisKeys.roomPresence(roomId), userId);
    pipeline.del(RedisKeys.userRoom(userId));

    await pipeline.exec();
  }

  /**
   * Marks a participant as disconnected from the realtime layer without removing
   * their role/seat from the room. Used for owner grace-period handover flow.
   */
  async markParticipantDisconnected(roomId: string, userId: string): Promise<void> {
    await redisClient.getClient()
      .pipeline()
      .hdel(RedisKeys.roomPresence(roomId), userId)
      .del(RedisKeys.userRoom(userId))
      .exec();
  }

  async getParticipant(roomId: string, userId: string): Promise<any> {
    const result = await database.query(
      'SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [parseInt(roomId), parseInt(userId)]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Participant');
    }

    return result.rows[0];
  }

  async getParticipantWithProfile(roomId: string, userId: string): Promise<any> {
    const result = await database.query(
      `SELECT rp.*, u.username, u.display_name, u.avatar_url
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = $1 AND rp.user_id = $2`,
      [parseInt(roomId), parseInt(userId)]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Participant');
    }

    return result.rows[0];
  }

  async getParticipantsGrouped(roomId: string): Promise<{
    owner: any | null;
    moderators: any[];
    speakers: any[];
    listeners: any[];
  }> {
    const participants = await this.getRoomParticipants(roomId);
    const owner = participants.find((p) => p.role === UserRole.OWNER_MODERATOR) || null;

    return {
      owner,
      moderators: participants.filter((p) => p.role === UserRole.MODERATOR),
      speakers: participants.filter((p) => p.role === UserRole.SPEAKER),
      listeners: participants.filter((p) => p.role === UserRole.LISTENER),
    };
  }

  async getRoomRoleCounts(roomId: string): Promise<{ speakerCount: number; listenerCount: number }> {
    const pipelineResult = await redisClient.getClient()
      .pipeline()
      .scard(RedisKeys.roomSpeakers(roomId))
      .scard(RedisKeys.roomListeners(roomId))
      .exec();

    const speakerCount = Number(pipelineResult?.[0]?.[1] ?? 0);
    const listenerCount = Number(pipelineResult?.[1]?.[1] ?? 0);

    if (Number.isFinite(speakerCount) && Number.isFinite(listenerCount)) {
      return { speakerCount, listenerCount };
    }

    // Fallback when Redis response is unavailable/unexpected.
    const result = await database.query(
      `SELECT
         COUNT(*) FILTER (WHERE role IN ('owner_moderator', 'moderator', 'speaker'))::int AS speaker_count,
         COUNT(*) FILTER (WHERE role = 'listener')::int AS listener_count
       FROM room_participants
       WHERE room_id = $1`,
      [parseInt(roomId)]
    );

    return {
      speakerCount: Number(result.rows[0]?.speaker_count || 0),
      listenerCount: Number(result.rows[0]?.listener_count || 0),
    };
  }

  async changeRole(roomId: string, targetUserId: string, newRole: UserRole, actorId: string): Promise<void> {
    // System-initiated role changes (e.g., handover) skip actor permission checks
    if (actorId !== 'system') {
      const actor = await this.getParticipant(roomId, actorId);

      if (newRole === UserRole.OWNER_MODERATOR && actor.role !== UserRole.OWNER_MODERATOR) {
        throw new ForbiddenError('Only owner can transfer ownership');
      }
    }

    const target = await this.getParticipant(roomId, targetUserId);
    const oldRole = target.role;

    await database.query(
      'UPDATE room_participants SET role = $1, is_muted = $2, stage_joined_at = $3 WHERE room_id = $4 AND user_id = $5',
      [
        newRole,
        newRole === UserRole.LISTENER,
        (newRole === UserRole.SPEAKER || newRole === UserRole.MODERATOR || newRole === UserRole.OWNER_MODERATOR) ? new Date() : null,
        parseInt(roomId),
        parseInt(targetUserId)
      ]
    );

    const pipeline = redisClient.getClient().pipeline();

    if (newRole === UserRole.SPEAKER || newRole === UserRole.MODERATOR || newRole === UserRole.OWNER_MODERATOR) {
      pipeline.srem(RedisKeys.roomListeners(roomId), targetUserId);
      pipeline.sadd(RedisKeys.roomSpeakers(roomId), targetUserId);
    } else {
      pipeline.srem(RedisKeys.roomSpeakers(roomId), targetUserId);
      pipeline.sadd(RedisKeys.roomListeners(roomId), targetUserId);
    }

    if (newRole === UserRole.MODERATOR || newRole === UserRole.OWNER_MODERATOR) {
      pipeline.sadd(RedisKeys.roomModerators(roomId), targetUserId);
    } else if (oldRole === UserRole.MODERATOR || oldRole === UserRole.OWNER_MODERATOR) {
      pipeline.srem(RedisKeys.roomModerators(roomId), targetUserId);
    }

    await pipeline.exec();

    logger.info({ roomId, targetUserId, oldRole, newRole, actorId }, 'Role changed');
  }

  async toggleMute(roomId: string, userId: string, isMuted: boolean): Promise<void> {
    await database.query(
      'UPDATE room_participants SET is_muted = $1 WHERE room_id = $2 AND user_id = $3',
      [isMuted, parseInt(roomId), parseInt(userId)]
    );
  }

  async banUser(roomId: string, userId: string, actorId: string, reason?: string): Promise<void> {
    await database.query(
      `INSERT INTO room_bans (room_id, user_id, banned_by, reason, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (room_id, user_id)
       DO UPDATE SET banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason, created_at = NOW()`,
      [parseInt(roomId), parseInt(userId), parseInt(actorId), reason || null]
    );
  }

  async setMicRequestsEnabled(roomId: string, enabled: boolean, userId: string): Promise<void> {
    const participant = await this.getParticipant(roomId, userId);

    if (participant.role !== UserRole.OWNER_MODERATOR && participant.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can toggle mic requests');
    }

    await roomRepository.update(parseInt(roomId), { mic_requests_enabled: enabled });
    await this.updateRoomState(roomId, { micRequestsEnabled: enabled });
  }

  async getRoomState(roomId: string): Promise<Record<string, string>> {
    const state = await redisClient.getClient().hgetall(RedisKeys.roomState(roomId));
    return state || {};
  }

  private async initializeRoomState(roomId: string): Promise<void> {
    const state = {
      status: RoomStatus.LIVE,
      speakerCount: '0',
      listenerCount: '0',
      micRequestsEnabled: 'true',
      gracePeriodEnd: '',
      updatedAt: Date.now().toString(),
    };

    await redisClient.getClient().hset(RedisKeys.roomState(roomId), state);
    await redisClient.getClient().expire(RedisKeys.roomState(roomId), 24 * 60 * 60);
  }

  private async updateRoomState(roomId: string, changes: Record<string, unknown>): Promise<void> {
    const updates: Record<string, string> = {};

    for (const [key, value] of Object.entries(changes)) {
      updates[key] = String(value);
    }
    updates.updatedAt = Date.now().toString();

    await redisClient.getClient().hset(RedisKeys.roomState(roomId), updates);
  }

  async endRoom(roomId: string, options?: { skipLiveKit?: boolean }): Promise<void> {
    await roomRepository.close(parseInt(roomId));
    await this.cleanupRoomRuntimeState(roomId);

    if (!options?.skipLiveKit && livekitService.isConfigured()) {
      try {
        await livekitService.endRoom(roomId);
      } catch (error) {
        if (config.services.livekitRequired) {
          throw new ServiceUnavailableError('LiveKit room termination failed');
        }

        logger.warn(
          { roomId, message: extractErrorMessage(error) },
          'Failed to end LiveKit room'
        );
      }
    }

    logger.info({ roomId }, 'Room ended');
  }

  private async cleanupRoomRuntimeState(roomId: string): Promise<void> {
    await redisClient.getClient().del(RedisKeys.roomState(roomId));
    await redisClient.getClient().del(RedisKeys.roomSpeakers(roomId));
    await redisClient.getClient().del(RedisKeys.roomListeners(roomId));
    await redisClient.getClient().del(RedisKeys.roomModerators(roomId));
    await redisClient.getClient().del(RedisKeys.roomMicQueue(roomId));
    await redisClient.getClient().del(RedisKeys.roomGraceTimer(roomId));

    const participants = await database.query(
      'SELECT user_id FROM room_participants WHERE room_id = $1',
      [parseInt(roomId)]
    );

    const pipeline = redisClient.getClient().pipeline();
    for (const p of participants.rows) {
      pipeline.del(RedisKeys.userRoom(p.user_id.toString()));
      pipeline.hdel(RedisKeys.roomPresence(roomId), p.user_id.toString());
    }
    await pipeline.exec();

    await database.query('DELETE FROM room_participants WHERE room_id = $1', [parseInt(roomId)]);
  }

  async getSpeakerCount(roomId: string): Promise<number> {
    const counts = await this.getRoomRoleCounts(roomId);
    return counts.speakerCount;
  }

  async getListenerCount(roomId: string): Promise<number> {
    const counts = await this.getRoomRoleCounts(roomId);
    return counts.listenerCount;
  }

  async listEmptyRoomSweepCandidates(minAgeSeconds: number): Promise<string[]> {
    const ageSeconds = Math.max(0, minAgeSeconds);
    const result = await database.query(
      `SELECT id
       FROM rooms
       WHERE status = $1
         AND created_at <= NOW() - make_interval(secs => $2)
         AND NOT EXISTS (
           SELECT 1
           FROM room_participants rp
           WHERE rp.room_id = rooms.id
         )
       ORDER BY id ASC`,
      [RoomStatus.LIVE, ageSeconds]
    );

    return result.rows.map((row) => row.id.toString());
  }

  async endRoomIfLive(roomId: string): Promise<boolean> {
    const room = await roomRepository.findById(parseInt(roomId));

    if (!room || room.status !== RoomStatus.LIVE) {
      return false;
    }

    await this.endRoom(roomId);
    return true;
  }

  /**
   * Invite a listener to become a speaker.
   * Creates a Redis invite key with TTL; target user accepts or declines.
   */
  async inviteToSpeak(
    roomId: string,
    targetUserId: string,
    actorId: string
  ): Promise<void> {
    const actor = await this.getParticipant(roomId, actorId);

    if (actor.role !== UserRole.OWNER_MODERATOR && actor.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can invite to speak');
    }

    const target = await this.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.SPEAKER || target.role === UserRole.MODERATOR || target.role === UserRole.OWNER_MODERATOR) {
      throw new BadRequestError('User is already a speaker or moderator');
    }

    const room = await this.findById(roomId);
    const speakerCount = await this.getSpeakerCount(roomId);
    if (speakerCount >= room.max_speakers) {
      throw new BadRequestError('Maximum speakers reached');
    }

    // Store invite in Redis with 60s expiry
    const inviteExpiry = config.room.inviteExpirySeconds;
    await redisClient.getClient().set(
      `room:${roomId}:speak_invite:${targetUserId}`,
      JSON.stringify({ actorId, createdAt: Date.now() }),
      'EX',
      inviteExpiry
    );

    logger.info({ roomId, targetUserId, actorId }, 'Speaker invite sent');
  }

  async hasPendingSpeakInvite(roomId: string, userId: string): Promise<boolean> {
    const inviteKey = `room:${roomId}:speak_invite:${userId}`;
    const invite = await redisClient.getClient().get(inviteKey);
    return Boolean(invite);
  }

  /**
   * Accept a pending speak invitation.
   */
  async acceptSpeakInvite(roomId: string, userId: string): Promise<boolean> {
    const inviteKey = `room:${roomId}:speak_invite:${userId}`;
    const invite = await redisClient.getClient().get(inviteKey);

    if (!invite) {
      return false;
    }

    await redisClient.getClient().del(inviteKey);

    const room = await this.findById(roomId);
    const speakerCount = await this.getSpeakerCount(roomId);
    if (speakerCount >= room.max_speakers) {
      throw new BadRequestError('Maximum speakers reached');
    }

    await this.changeRole(roomId, userId, UserRole.SPEAKER, 'system');
    logger.info({ roomId, userId }, 'Speaker invite accepted');
    return true;
  }

  /**
   * Decline a pending speak invitation.
   */
  async declineSpeakInvite(roomId: string, userId: string): Promise<boolean> {
    const inviteKey = `room:${roomId}:speak_invite:${userId}`;
    const deleted = await redisClient.getClient().del(inviteKey);
    if (deleted > 0) {
      logger.info({ roomId, userId }, 'Speaker invite declined');
      return true;
    }
    return false;
  }

  /**
   * Invite a user to join a private room.
   */
  async inviteToRoom(
    roomId: string,
    targetUserId: string,
    actorId: string
  ): Promise<void> {
    const room = await this.findById(roomId);

    if (room.visibility !== 'private') {
      throw new BadRequestError('Room invites are only for private rooms');
    }

    const actor = await this.getParticipant(roomId, actorId);
    if (actor.role !== UserRole.OWNER_MODERATOR && actor.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can invite users');
    }

    const inviteExpiry = config.room.inviteExpirySeconds;
    await redisClient.getClient().set(
      RedisKeys.roomInvite(roomId, targetUserId),
      JSON.stringify({ actorId, createdAt: Date.now() }),
      'EX',
      inviteExpiry
    );

    logger.info({ roomId, targetUserId, actorId }, 'Room invite sent');
  }
}

export const roomService = new RoomService();
export default roomService;
