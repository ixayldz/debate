import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../common/utils/jwt.js';
import { roomService } from './room.service.js';
import { handoverService } from './handover.service.js';
import { UserRole, RoomStatus } from '../../types/enums.js';
import { logger } from '../../config/logger.js';
import { TokenPayload } from '../../types/global.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { redisClient } from '../../config/redis.js';
import config from '../../config/index.js';
import { wsConnectionLimiter, wsMessageLimiter, wsJoinLimiter } from '../../middleware/rate-limiter.js';

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
  roomId?: string;
}

export function setupRoomGateway(io: Server): void {
  const roomNamespace = io.of('/room');

  // Connection rate limiting middleware
  roomNamespace.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const ip = socket.handshake.address || 'unknown';
      const { allowed, resetIn } = await wsConnectionLimiter(ip);

      if (!allowed) {
        logger.warn({ ip, resetIn }, 'WebSocket connection rate limit exceeded');
        return next(new Error('Connection rate limit exceeded. Please try again later.'));
      }

      next();
    } catch (error) {
      // On error, allow the connection
      next();
    }
  });

  // Authentication middleware
  roomNamespace.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      const parsedUserId = parseInt(payload.userId, 10);

      if (Number.isNaN(parsedUserId)) {
        return next(new Error('Invalid token payload'));
      }

      payload.userId = parsedUserId.toString();
      socket.user = payload;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  roomNamespace.on('connection', (socket: AuthenticatedSocket) => {
    logger.debug({ socketId: socket.id, userId: socket.user?.userId }, 'User connected to room namespace');

    socket.on('room:join', async (data: { roomId: string }) => {
      try {
        const userId = socket.user!.userId;

        // Rate limit room joins
        const { allowed, resetIn } = await wsJoinLimiter(userId);
        if (!allowed) {
          socket.emit('room:error', { message: `Rate limit exceeded. Try again in ${resetIn} seconds.` });
          return;
        }

        const { roomId } = data;

        const room = await roomService.findById(roomId);

        if (room.status === RoomStatus.ENDED) {
          socket.emit('room:error', { message: 'Room has ended' });
          return;
        }

        const participant = await roomService.getParticipantWithProfile(roomId, userId);

        // If owner reconnects during grace period, cancel the handover
        if (room.status === RoomStatus.GRACE_WAITING_FOR_OWNER &&
          participant.role === UserRole.OWNER_MODERATOR) {
          await handoverService.cancelGracePeriod(roomId);

          // Notify room that owner has returned
          io.of('/room').to(roomId).emit('room:owner_returned', { roomId, userId });
          logger.info({ roomId, userId }, 'Owner reconnected, grace period cancelled');
        }

        socket.join(roomId);
        socket.roomId = roomId;

        await redisClient.getClient().hset(
          RedisKeys.roomPresence(roomId),
          userId,
          JSON.stringify({
            socketId: socket.id,
            connectedAt: Date.now(),
            role: participant.role,
          })
        );

        await redisClient.getClient().set(RedisKeys.userRoom(userId), roomId);

        const counts = await roomService.getRoomRoleCounts(roomId);
        const syncPayload = await buildRoomSyncPayload(roomId, counts);
        const serverTs = Date.now();

        socket.emit('room:joined', {
          roomId,
          role: participant.role,
          isMuted: participant.is_muted,
          counts,
          serverTs,
        });

        roomNamespace.to(roomId).emit('room:sync_state', syncPayload);

        socket.to(roomId).emit('user:joined', {
          roomId,
          participant,
          counts,
          serverTs,
        });

        logger.debug({ roomId, userId, socketId: socket.id }, 'User joined room');
      } catch (error: any) {
        logger.error({ err: error }, 'Error joining room');
        socket.emit('room:error', { message: error.message || 'Failed to join room' });
      }
    });

    socket.on('room:leave', async () => {
      try {
        const roomId = socket.roomId;
        const userId = socket.user!.userId;

        if (!roomId) return;

        await handleUserLeave(socket, roomId, userId, io);
      } catch (error: any) {
        logger.error({ err: error }, 'Error leaving room');
      }
    });

    socket.on('mic:toggle', async (data: { roomId: string; muted: boolean }) => {
      try {
        const userId = socket.user!.userId;

        // Rate limit mic toggle
        const { allowed, resetIn } = await wsMessageLimiter(`${userId}:mic`);
        if (!allowed) {
          socket.emit('room:error', { message: `Rate limit exceeded. Try again in ${resetIn} seconds.` });
          return;
        }

        const { roomId, muted } = data;

        const participant = await roomService.getParticipant(roomId, userId);

        if (participant.role === UserRole.LISTENER) {
          socket.emit('room:error', { message: 'Listeners cannot toggle mic' });
          return;
        }

        await roomService.toggleMute(roomId, userId, muted);

        socket.to(roomId).emit('user:mute_changed', {
          roomId,
          userId,
          isMuted: muted,
          serverTs: Date.now(),
        });
      } catch (error: any) {
        logger.error({ err: error }, 'Error toggling mic');
      }
    });

    socket.on('disconnect', async () => {
      try {
        const roomId = socket.roomId;
        const userId = socket.user?.userId;

        if (!roomId || !userId) return;

        await handleUserDisconnect(socket, roomId, userId, io);
      } catch (error: any) {
        logger.error({ err: error }, 'Error handling disconnect');
      }
    });
  });
}

async function handleUserLeave(
  socket: AuthenticatedSocket,
  roomId: string,
  userId: string,
  io: Server
): Promise<void> {
  try {
    let participant: any;
    try {
      participant = await roomService.getParticipant(roomId, userId);
    } catch {
      await roomService.removeParticipant(roomId, userId);
      await emitRoomSyncState(io, roomId);
      socket.leave(roomId);
      socket.roomId = undefined;
      return;
    }

    if (participant.role === UserRole.OWNER_MODERATOR) {
      // Owner left voluntarily: keep DB role state for grace-period return.
      await roomService.markParticipantDisconnected(roomId, userId);
      socket.to(roomId).emit('room:owner_left', { roomId });

      const gracePeriodEnd = Date.now() + config.room.defaultGracePeriodSeconds * 1000;
      await handoverService.startGracePeriod(roomId);

      socket.to(roomId).emit('room:grace_period', {
        roomId,
        endsAt: gracePeriodEnd,
      });

      logger.info({ roomId, userId }, 'Owner left voluntarily, grace period started');
    } else {
      await roomService.removeParticipant(roomId, userId);
      const counts = await roomService.getRoomRoleCounts(roomId);
      socket.to(roomId).emit('user:left', {
        roomId,
        userId,
        reason: 'left',
        counts,
        serverTs: Date.now(),
      });
    }

    await emitRoomSyncState(io, roomId);

    socket.leave(roomId);
    socket.roomId = undefined;
  } catch (error: any) {
    logger.error({ err: error }, 'Error handling user leave');
  }
}

async function handleUserDisconnect(
  socket: AuthenticatedSocket,
  roomId: string,
  userId: string,
  io: Server
): Promise<void> {
  try {
    const presence = await redisClient.getClient().hget(RedisKeys.roomPresence(roomId), userId);

    if (!presence) {
      await emitRoomSyncState(io, roomId);
      socket.leave(roomId);
      socket.roomId = undefined;
      return;
    }

    const presenceData = JSON.parse(presence);

    if (presenceData.socketId !== socket.id) {
      return;
    }

    let participant: any;
    try {
      participant = await roomService.getParticipant(roomId, userId);
    } catch {
      await roomService.removeParticipant(roomId, userId);
      await emitRoomSyncState(io, roomId);
      socket.leave(roomId);
      socket.roomId = undefined;
      return;
    }

    if (participant.role === UserRole.OWNER_MODERATOR) {
      await roomService.markParticipantDisconnected(roomId, userId);

      // Use handover service to manage grace period
      await handoverService.startGracePeriod(roomId);

      const gracePeriodEnd = Date.now() + config.room.defaultGracePeriodSeconds * 1000;

      socket.to(roomId).emit('room:grace_period', {
        roomId,
        endsAt: gracePeriodEnd,
      });

      logger.info({ roomId, userId }, 'Owner disconnected, grace period started');
    } else {
      await roomService.removeParticipant(roomId, userId);
      const counts = await roomService.getRoomRoleCounts(roomId);
      socket.to(roomId).emit('user:left', {
        roomId,
        userId,
        reason: 'disconnected',
        counts,
        serverTs: Date.now(),
      });
    }

    await emitRoomSyncState(io, roomId);

    socket.leave(roomId);
    socket.roomId = undefined;
  } catch (error: any) {
    logger.error({ err: error }, 'Error handling user disconnect');
  }
}

async function emitRoomSyncState(io: Server, roomId: string): Promise<void> {
  try {
    const syncPayload = await buildRoomSyncPayload(roomId);
    io.of('/room').to(roomId).emit('room:sync_state', syncPayload);
  } catch (error) {
    logger.debug({ roomId, err: error }, 'Unable to emit room sync state');
  }
}

async function buildRoomSyncPayload(
  roomId: string,
  counts?: { speakerCount: number; listenerCount: number }
): Promise<{
  roomId: string;
  participants: {
    owner: any | null;
    moderators: any[];
    speakers: any[];
    listeners: any[];
  };
  counts: { speakerCount: number; listenerCount: number };
  serverTs: number;
}> {
  const resolvedCounts = counts || await roomService.getRoomRoleCounts(roomId);
  const participants = await roomService.getParticipantsGrouped(roomId);

  return {
    roomId,
    participants,
    counts: resolvedCounts,
    serverTs: Date.now(),
  };
}

export default setupRoomGateway;
