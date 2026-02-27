'use client';

import { apiRequest } from './client';
import type {
  FollowListResponse,
  NotificationItem,
  PublicUser,
  RoomSummary,
} from './types';

export interface MeResponse {
  id: number;
  username: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  language: 'tr' | 'en';
  createdAt?: string;
}

export interface PublicProfileResponse {
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  interests?: string[];
  created_at?: string;
}

export function getMe() {
  return apiRequest<MeResponse>('/users/me', { auth: true });
}

export function updateMe(input: Partial<{
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  interests: string[];
  language: 'tr' | 'en';
}>) {
  return apiRequest<MeResponse>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
    auth: true,
  });
}

export function getMyRooms() {
  return apiRequest<RoomSummary[]>('/users/me/rooms', { auth: true });
}

export function searchUsers(query: string, limit = 20) {
  return apiRequest<PublicUser[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    auth: true,
  });
}

export function getProfileByUsername(username: string) {
  return apiRequest<PublicProfileResponse>(`/users/${encodeURIComponent(username)}`, { auth: true });
}

export function followUser(id: string) {
  return apiRequest<{ success: boolean }>(`/users/${id}/follow`, {
    method: 'POST',
    auth: true,
  });
}

export function unfollowUser(id: string) {
  return apiRequest<{ success: boolean }>(`/users/${id}/follow`, {
    method: 'DELETE',
    auth: true,
  });
}

export function getFollowers(id: string, page = 1, limit = 20) {
  return apiRequest<FollowListResponse>(`/users/${id}/followers?page=${page}&limit=${limit}`, {
    auth: true,
  });
}

export function getFollowing(id: string, page = 1, limit = 20) {
  return apiRequest<FollowListResponse>(`/users/${id}/following?page=${page}&limit=${limit}`, {
    auth: true,
  });
}

export function blockUser(id: string) {
  return apiRequest<{ success: boolean }>(`/users/${id}/block`, {
    method: 'POST',
    auth: true,
  });
}

export function unblockUser(id: string) {
  return apiRequest<{ success: boolean }>(`/users/${id}/block`, {
    method: 'DELETE',
    auth: true,
  });
}

export function getNotifications(page = 1, limit = 20) {
  return apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>(
    `/users/me/notifications?page=${page}&limit=${limit}`,
    {
      auth: true,
    }
  );
}

export function markNotificationRead(id: string) {
  return apiRequest<{ success: boolean }>(`/users/me/notifications/${id}/read`, {
    method: 'PATCH',
    auth: true,
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ success: boolean }>('/users/me/notifications/read-all', {
    method: 'PATCH',
    auth: true,
  });
}
