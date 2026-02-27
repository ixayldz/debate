import type { Server } from 'socket.io';
import type { MicRequest } from '../types/global.js';
import { UserRole } from '../types/enums.js';

let ioServer: Server | null = null;

export function registerSocketServer(io: Server): void {
  ioServer = io;
}

export function emitMicQueueUpdated(roomId: string, queue: MicRequest[]): void {
  if (!ioServer) {
    return;
  }

  const payload = { roomId, queue };
  ioServer.of('/mic').to(roomId).emit('mic:queue_updated', payload);
  ioServer.of('/room').to(roomId).emit('room:mic_queue_updated', payload);
}

export function emitMicRequestResult(
  userId: string,
  payload: { roomId: string; requestId: string; action: 'accepted' | 'rejected' }
): void {
  if (!ioServer) {
    return;
  }

  ioServer.of('/mic').to(`user:${userId}`).emit('mic:request_result', payload);
}

export function emitRoomRoleChanged(roomId: string, userId: string, role: UserRole): void {
  if (!ioServer) {
    return;
  }

  ioServer.of('/room').to(roomId).emit('room:role_changed', {
    roomId,
    userId,
    role,
  });
}
