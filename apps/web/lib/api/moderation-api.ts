'use client';

import { apiRequest } from './client';
import type {
  ApiMessageResponse,
  AuditLogItem,
  ReportItem,
  ReportListResponse,
  ReportSubmission,
  ReportStatus,
} from './types';

function roomUserPath(action: string, roomId: string, userId: string): string {
  return `/moderation/${action}/${roomId}/${userId}`;
}

export function muteUser(roomId: string, userId: string, reason?: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('mute', roomId, userId), {
    method: 'POST',
    body: JSON.stringify({ reason }),
    auth: true,
  });
}

export function unmuteUser(roomId: string, userId: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('unmute', roomId, userId), {
    method: 'POST',
    auth: true,
  });
}

export function kickUser(roomId: string, userId: string, reason?: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('kick', roomId, userId), {
    method: 'POST',
    body: JSON.stringify({ reason }),
    auth: true,
  });
}

export function promoteUser(roomId: string, userId: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('promote', roomId, userId), {
    method: 'POST',
    auth: true,
  });
}

export function demoteUser(roomId: string, userId: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('demote', roomId, userId), {
    method: 'POST',
    auth: true,
  });
}

export function addModerator(roomId: string, userId: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('add-moderator', roomId, userId), {
    method: 'POST',
    auth: true,
  });
}

export function removeModerator(roomId: string, userId: string) {
  return apiRequest<ApiMessageResponse>(roomUserPath('remove-moderator', roomId, userId), {
    method: 'DELETE',
    auth: true,
  });
}

export function reportTarget(input:
  | { targetType: 'user'; targetId: string; category: 'harassment' | 'hate_speech' | 'spam' | 'other'; description?: string }
  | { targetType: 'room'; roomId: string; category: 'harassment' | 'hate_speech' | 'spam' | 'other'; description?: string }
) {
  return apiRequest<ReportSubmission>('/moderation/report', {
    method: 'POST',
    body: JSON.stringify(input),
    auth: true,
  });
}

export function listReports(params: { status?: ReportStatus; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      qs.set(key, String(value));
    }
  });
  return apiRequest<ReportListResponse>(`/moderation/reports?${qs.toString()}`, {
    auth: true,
  });
}

export function getReportById(id: string) {
  return apiRequest<ReportItem>(`/moderation/reports/${id}`, { auth: true });
}

export function resolveReport(id: string) {
  return apiRequest<{ message: string; report: ReportItem }>(`/moderation/reports/${id}/resolve`, {
    method: 'PATCH',
    auth: true,
  });
}

export function dismissReport(id: string) {
  return apiRequest<{ message: string; report: ReportItem }>(`/moderation/reports/${id}/dismiss`, {
    method: 'PATCH',
    auth: true,
  });
}

export function getRoomAudit(roomId: string, limit = 100) {
  return apiRequest<AuditLogItem[]>(`/moderation/audit/room/${roomId}?limit=${limit}`, {
    auth: true,
  });
}

export function getUserAudit(userId: string, limit = 100) {
  return apiRequest<AuditLogItem[]>(`/moderation/audit/user/${userId}?limit=${limit}`, {
    auth: true,
  });
}
