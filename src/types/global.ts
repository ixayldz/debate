export interface TokenPayload {
  userId: string;
  email: string;
  username?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RoomQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  language?: string;
  status?: string;
}

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  roomId?: string;
  userId?: string;
  timestamp: number;
}

export interface PresenceData {
  socketId: string;
  connectedAt: number;
  role: string;
}

export interface MicRequest {
  id: string;
  userId: string;
  roomId: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface RoomState {
  status: string;
  speakerCount: number;
  listenerCount: number;
  micRequestsEnabled: boolean;
  gracePeriodEnd: number | null;
  updatedAt: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
