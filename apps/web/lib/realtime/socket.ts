'use client';

import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, SOCKET_MIC_PATH, SOCKET_ROOM_PATH } from '@/lib/api/config';

export function createRoomSocket(token: string): Socket {
  return io(`${API_BASE_URL}${SOCKET_ROOM_PATH}`, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
  });
}

export function createMicSocket(token: string): Socket {
  return io(`${API_BASE_URL}${SOCKET_MIC_PATH}`, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
  });
}
