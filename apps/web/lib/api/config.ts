export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';

export const LIVEKIT_URL =
  process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || '';

export const SOCKET_ROOM_PATH =
  process.env.NEXT_PUBLIC_SOCKET_ROOM_PATH?.trim() || '/room';

export const SOCKET_MIC_PATH =
  process.env.NEXT_PUBLIC_SOCKET_MIC_PATH?.trim() || '/mic';
