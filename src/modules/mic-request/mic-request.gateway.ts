import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../../common/utils/jwt.js';
import { micRequestService } from './mic-request.service.js';
import { roomService } from '../room/room.service.js';
import { UserRole } from '../../types/enums.js';
import { logger } from '../../config/logger.js';
import { TokenPayload } from '../../types/global.js';

interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

export function setupMicRequestGateway(io: Server): void {
  const micNamespace = io.of('/mic');

  micNamespace.use(async (socket: AuthenticatedSocket, next) => {
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

  micNamespace.on('connection', (socket: AuthenticatedSocket) => {
    logger.debug({ socketId: socket.id, userId: socket.user?.userId }, 'User connected to mic namespace');
    socket.join(`user:${socket.user!.userId}`);

    // Join a room to receive mic queue updates
    socket.on('mic:join_room', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        socket.join(roomId);
        socket.emit('mic:joined', { roomId });
      } catch (error: any) {
        socket.emit('mic:error', { message: 'Failed to join room' });
      }
    });
    socket.on('mic:request', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const userId = socket.user!.userId;

        await roomService.findById(roomId);
        const participant = await roomService.getParticipant(roomId, userId);
        if (participant.role !== UserRole.LISTENER) {
          socket.emit('mic:error', { message: 'Only listeners can request to speak' });
          return;
        }

        // Auto-join socket to room if not already joined
        if (!socket.rooms.has(roomId)) {
          socket.join(roomId);
        }

        await micRequestService.addToQueue(roomId, userId);

        const queue = await micRequestService.getQueue(roomId);

        socket.emit('mic:request_queued', { roomId, queue });
        micNamespace.to(roomId).emit('mic:queue_updated', { roomId, queue });
        io.of('/room').to(roomId).emit('room:mic_queue_updated', { roomId, queue });
      } catch (error: any) {
        logger.error({ err: error }, 'Error requesting mic');
        socket.emit('mic:error', { message: error.message || 'Failed to request mic' });
      }
    });

    socket.on('mic:cancel', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const userId = socket.user!.userId;

        await micRequestService.removeFromQueue(roomId, userId);

        const queue = await micRequestService.getQueue(roomId);

        socket.emit('mic:cancelled', { roomId });
        micNamespace.to(roomId).emit('mic:queue_updated', { roomId, queue });
        io.of('/room').to(roomId).emit('room:mic_queue_updated', { roomId, queue });
      } catch (error: any) {
        logger.error({ err: error }, 'Error cancelling mic request');
        socket.emit('mic:error', { message: error.message || 'Failed to cancel mic request' });
      }
    });

    socket.on('mic:accept', async (data: { roomId: string; requestId: string }) => {
      try {
        const { roomId, requestId } = data;
        const userId = socket.user!.userId;

        const request = await micRequestService.acceptRequest(roomId, requestId, userId);

        const queue = await micRequestService.getQueue(roomId);

        socket.emit('mic:request_handled', {
          roomId,
          requestId,
          action: 'accepted',
          targetUserId: request.userId,
        });
        micNamespace.to(roomId).emit('mic:queue_updated', { roomId, queue });
        io.of('/room').to(roomId).emit('room:mic_queue_updated', { roomId, queue });
        micNamespace.to(`user:${request.userId}`).emit('mic:request_result', {
          roomId,
          requestId,
          action: 'accepted',
        });
        io.of('/room').to(roomId).emit('room:role_changed', {
          roomId,
          userId: request.userId,
          role: UserRole.SPEAKER,
        });
      } catch (error: any) {
        logger.error({ err: error }, 'Error accepting mic request');
        socket.emit('mic:error', { message: error.message || 'Failed to accept mic request' });
      }
    });

    socket.on('mic:reject', async (data: { roomId: string; requestId: string }) => {
      try {
        const { roomId, requestId } = data;
        const userId = socket.user!.userId;

        const request = await micRequestService.rejectRequest(roomId, requestId, userId);

        const queue = await micRequestService.getQueue(roomId);

        socket.emit('mic:request_handled', {
          roomId,
          requestId,
          action: 'rejected',
          targetUserId: request.userId,
        });
        micNamespace.to(roomId).emit('mic:queue_updated', { roomId, queue });
        io.of('/room').to(roomId).emit('room:mic_queue_updated', { roomId, queue });
        micNamespace.to(`user:${request.userId}`).emit('mic:request_result', {
          roomId,
          requestId,
          action: 'rejected',
        });
      } catch (error: any) {
        logger.error({ err: error }, 'Error rejecting mic request');
        socket.emit('mic:error', { message: error.message || 'Failed to reject mic request' });
      }
    });

    socket.on('mic:get_queue', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        const queue = await micRequestService.getQueue(roomId);

        socket.emit('mic:queue', { roomId, queue });
      } catch (error: any) {
        logger.error({ err: error }, 'Error getting mic queue');
        socket.emit('mic:error', { message: error.message || 'Failed to get mic queue' });
      }
    });

    socket.on('mic:get_cooldown', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const userId = socket.user!.userId;

        const cooldownEndTime = await micRequestService.getCooldownEndTime(roomId, userId);

        socket.emit('mic:cooldown', { roomId, cooldownEndTime });
      } catch (error: any) {
        logger.error({ err: error }, 'Error getting cooldown');
      }
    });
  });
}

export default setupMicRequestGateway;
