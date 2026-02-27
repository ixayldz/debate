export type Language = 'tr' | 'en';
export type UserRole = 'owner_moderator' | 'moderator' | 'speaker' | 'listener';
export type RoomStatus = 'creating' | 'live' | 'grace_waiting_for_owner' | 'ended';
export type RoomVisibility = 'public' | 'private';

export interface ApiErrorShape {
  requestId?: string;
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  language: Language;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  follower_count?: number;
  following_count?: number;
  is_verified?: boolean;
}

export interface RoomSummary {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  language: Language;
  visibility: RoomVisibility;
  maxSpeakers?: number;
  max_speakers?: number;
  micRequestsEnabled?: boolean;
  mic_requests_enabled?: boolean;
  status: RoomStatus | string;
  speakerCount?: number;
  listenerCount?: number;
  createdBy?: PublicUser;
  createdAt?: string;
  created_at?: string;
}

export interface RoomDetails extends RoomSummary {
  startedAt?: string | null;
  started_at?: string | null;
}

export interface RoomParticipant {
  id?: number;
  room_id?: number;
  user_id: number;
  role: UserRole;
  is_muted: boolean;
  is_hand_raised?: boolean;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  joined_at?: string;
  stage_joined_at?: string | null;
}

export interface RoomParticipantsResponse {
  owner: RoomParticipant | null;
  moderators: RoomParticipant[];
  speakers: RoomParticipant[];
  listeners: RoomParticipant[];
}

export interface MicRequestItem {
  id: string;
  userId: string;
  roomId: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';

export interface ReportItem {
  id: number;
  roomId: number | null;
  reporterId: number;
  reportedUserId: number | null;
  reason: 'harassment' | 'hate_speech' | 'spam' | 'other';
  description?: string | null;
  status: ReportStatus;
  resolvedBy: number | null;
  resolvedAt: string | null;
  createdAt: string;
  reporterUsername?: string | null;
  reporterDisplayName?: string | null;
  reportedUsername?: string | null;
  reportedDisplayName?: string | null;
  roomTitle?: string | null;
  resolverUsername?: string | null;
}

export interface AuditLogItem {
  id: number;
  roomId: number | null;
  action: string;
  actorId: number | null;
  targetId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUsername?: string | null;
  actorDisplayName?: string | null;
  targetUsername?: string | null;
  targetDisplayName?: string | null;
  roomTitle?: string | null;
}

export interface ReportSubmission {
  message: string;
  reportId: number;
}

export interface FollowListResponse {
  users: PublicUser[];
  total: number;
}

export interface SearchRoomsResponse {
  rooms: RoomSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedRoomResponse {
  data: RoomSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
  services?: Record<string, unknown>;
}

export interface RootResponse {
  name: string;
  version: string;
  status: string;
  docs: string;
  health: string;
}

export interface RoomJoinResponse {
  roomId: string;
  role: UserRole;
  token: string;
  micRequestsEnabled: boolean;
}

export interface RoomMediaTokenResponse {
  roomId: string;
  role: UserRole;
  token: string;
}

export interface RoomLeaveResponse {
  message: string;
  gracePeriodEnd?: number;
}

export interface ApiMessageResponse {
  success?: boolean;
  message: string;
}

export interface ReportListResponse {
  reports: ReportItem[];
  total: number;
  page: number;
}

export interface RoomSearchParams {
  q?: string;
  category?: string;
  language?: string;
  page?: number;
  limit?: number;
}

export interface RoomListParams {
  page?: number;
  limit?: number;
  category?: string;
  language?: string;
  status?: string;
}

export interface ReportCategoryPayload {
  targetType: 'user' | 'room';
  targetId?: string;
  roomId?: string;
  reason: string;
  description?: string;
}
