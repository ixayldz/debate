'use client';

import { apiRequest } from './client';
import type {
  ApiMessageResponse,
  PaginatedRoomResponse,
  RoomDetails,
  RoomJoinResponse,
  RoomLeaveResponse,
  RoomListParams,
  RoomMediaTokenResponse,
  MicRequestItem,
  RoomParticipant,
  RoomParticipantsResponse,
  RoomSearchParams,
  RoomSummary,
  SearchRoomsResponse,
} from './types';

export interface CreateRoomInput {
  title: string;
  description?: string;
  category?: string;
  language?: 'tr' | 'en';
  visibility?: 'public' | 'private';
  maxSpeakers?: number;
  micRequestsEnabled?: boolean;
}

export function getCategories(): Promise<Array<{ id: number; name: string; slug: string; icon?: string; color?: string }>> {
  return apiRequest('/rooms/categories', { auth: true });
}

export function searchRooms(params: RoomSearchParams) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      qs.set(key, String(value));
    }
  }
  return apiRequest<SearchRoomsResponse>(`/rooms/search?${qs.toString()}`, {
    auth: true,
  });
}

export function listRooms(params: RoomListParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      qs.set(key, String(value));
    }
  });
  return apiRequest<PaginatedRoomResponse>(`/rooms?${qs.toString()}`, { auth: true });
}

export function getFeaturedRooms(limit = 10) {
  return apiRequest<RoomSummary[]>(`/rooms/featured?limit=${limit}`, { auth: true });
}

export function getTrendingRooms(limit = 10) {
  return apiRequest<RoomSummary[]>(`/rooms/trending?limit=${limit}`, { auth: true });
}

export function createRoom(input: CreateRoomInput) {
  return apiRequest<RoomSummary>('/rooms', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: true,
  });
}

export function getRoomById(id: string) {
  return apiRequest<RoomDetails>(`/rooms/${id}`, { auth: true });
}

export function updateRoom(id: string, input: Partial<CreateRoomInput>) {
  return apiRequest<RoomSummary>(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    auth: true,
  });
}

export function closeRoom(id: string) {
  return apiRequest<ApiMessageResponse>(`/rooms/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function getRoomParticipants(id: string) {
  return apiRequest<RoomParticipantsResponse>(`/rooms/${id}/participants`, { auth: true });
}

export function joinRoom(id: string) {
  return apiRequest<RoomJoinResponse>(`/rooms/${id}/join`, {
    method: 'POST',
    auth: true,
  });
}

export function leaveRoom(id: string) {
  return apiRequest<RoomLeaveResponse>(`/rooms/${id}/leave`, {
    method: 'POST',
    auth: true,
  });
}

export function getRoomMediaToken(id: string) {
  return apiRequest<RoomMediaTokenResponse>(`/rooms/${id}/media-token`, {
    method: 'POST',
    auth: true,
  });
}

export function requestMic(id: string) {
  return apiRequest<{ success: boolean; queue: MicRequestItem[] }>(`/rooms/${id}/mic/request`, {
    method: 'POST',
    auth: true,
  });
}

export function cancelMicRequest(id: string) {
  return apiRequest<{ success: boolean; queue: MicRequestItem[] }>(`/rooms/${id}/mic/request`, {
    method: 'DELETE',
    auth: true,
  });
}

export function getMicQueue(id: string) {
  return apiRequest<{ queue: MicRequestItem[] }>(`/rooms/${id}/mic/queue`, {
    auth: true,
  });
}

export function acceptMicRequest(id: string, requestId: string) {
  return apiRequest<{ success: boolean; queue: MicRequestItem[] }>(`/rooms/${id}/mic/accept`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
    auth: true,
  });
}

export function rejectMicRequest(id: string, requestId: string) {
  return apiRequest<{ success: boolean; queue: MicRequestItem[] }>(`/rooms/${id}/mic/reject`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
    auth: true,
  });
}

export function inviteToSpeak(id: string, targetUserId: string) {
  return apiRequest<ApiMessageResponse>(`/rooms/${id}/invite-speak`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
    auth: true,
  });
}

export function acceptSpeakInvite(id: string) {
  return apiRequest<ApiMessageResponse>(`/rooms/${id}/invite-speak/accept`, {
    method: 'POST',
    auth: true,
  });
}

export function declineSpeakInvite(id: string) {
  return apiRequest<ApiMessageResponse>(`/rooms/${id}/invite-speak/decline`, {
    method: 'POST',
    auth: true,
  });
}

export function getPendingSpeakInvite(id: string) {
  return apiRequest<{ pending: boolean }>(`/rooms/${id}/invite-speak/pending`, {
    auth: true,
  });
}

export function inviteToPrivateRoom(id: string, targetUserId: string) {
  return apiRequest<ApiMessageResponse>(`/rooms/${id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
    auth: true,
  });
}

export function flattenParticipants(payload: RoomParticipantsResponse): RoomParticipant[] {
  const owner = payload.owner ? [payload.owner] : [];
  return [...owner, ...payload.moderators, ...payload.speakers, ...payload.listeners];
}
