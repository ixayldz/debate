export enum UserRole {
  OWNER_MODERATOR = 'owner_moderator',
  MODERATOR = 'moderator',
  SPEAKER = 'speaker',
  LISTENER = 'listener',
}

export enum RoomStatus {
  CREATING = 'creating',
  LIVE = 'live',
  GRACE_WAITING_FOR_OWNER = 'grace_waiting_for_owner',
  ENDED = 'ended',
}

export enum RoomVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'pending_verification',
  PENDING_EMAIL_VERIFICATION = 'pending_email_verification',
  PENDING_PHONE_VERIFICATION = 'pending_phone_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
  DELETED = 'deleted',
}

export enum ReportCategory {
  HARASSMENT = 'harassment',
  HATE_SPEECH = 'hate_speech',
  SPAM = 'spam',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum AuditAction {
  MUTE = 'mute',
  UNMUTE = 'unmute',
  KICK = 'kick',
  PROMOTE = 'promote',
  DEMOTE = 'demote',
  INVITE = 'invite',
  ADD_MODERATOR = 'add_moderator',
  REMOVE_MODERATOR = 'remove_moderator',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER_MODERATOR]: 4,
  [UserRole.MODERATOR]: 3,
  [UserRole.SPEAKER]: 2,
  [UserRole.LISTENER]: 1,
};

export const PERMISSIONS = {
  CREATE_ROOM: [UserRole.OWNER_MODERATOR],
  CLOSE_ROOM: [UserRole.OWNER_MODERATOR],
  MUTE_OTHERS: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
  KICK_USERS: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
  PROMOTE_TO_SPEAKER: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
  DEMOTE_TO_LISTENER: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
  ADD_MODERATOR: [UserRole.OWNER_MODERATOR],
  REMOVE_MODERATOR: [UserRole.OWNER_MODERATOR],
  INVITE_TO_SPEAK: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
  TOGGLE_MIC_REQUESTS: [UserRole.OWNER_MODERATOR, UserRole.MODERATOR],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
  return allowedRoles.includes(role);
}
