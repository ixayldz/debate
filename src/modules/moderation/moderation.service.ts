import { roomService } from '../room/room.service.js';
import { auditRepository } from './audit.repository.js';
import { UserRole, AuditAction } from '../../types/enums.js';
import { ForbiddenError, BadRequestError } from '../../common/utils/app-error.js';
import { logger } from '../../config/logger.js';

export class ModerationService {
  async mute(
    roomId: string,
    targetUserId: string,
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can mute users');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.OWNER_MODERATOR) {
      throw new BadRequestError('Cannot mute the owner');
    }

    if (target.role === UserRole.LISTENER) {
      throw new BadRequestError('Cannot mute listeners');
    }

    if (target.role === UserRole.MODERATOR && moderator.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Cannot mute other moderators');
    }

    await roomService.toggleMute(roomId, targetUserId, true);

    await this.logAudit(roomId, AuditAction.MUTE, moderatorId, targetUserId, { reason });

    logger.info({ roomId, targetUserId, moderatorId, reason }, 'User muted');
  }

  async unmute(
    roomId: string,
    targetUserId: string,
    moderatorId: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can unmute users');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.LISTENER) {
      throw new BadRequestError('Cannot unmute listeners');
    }

    await roomService.toggleMute(roomId, targetUserId, false);

    await this.logAudit(roomId, AuditAction.UNMUTE, moderatorId, targetUserId);

    logger.info({ roomId, targetUserId, moderatorId }, 'User unmuted');
  }

  async kick(
    roomId: string,
    targetUserId: string,
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can kick users');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.OWNER_MODERATOR) {
      throw new BadRequestError('Cannot kick the owner');
    }

    if (target.role === UserRole.MODERATOR && moderator.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Cannot kick other moderators');
    }

    await roomService.removeParticipant(roomId, targetUserId);
    await roomService.banUser(roomId, targetUserId, moderatorId, reason);

    await this.logAudit(roomId, AuditAction.KICK, moderatorId, targetUserId, { reason });

    logger.info({ roomId, targetUserId, moderatorId, reason }, 'User kicked');
  }

  async promoteToSpeaker(
    roomId: string,
    targetUserId: string,
    moderatorId: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can promote users');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role !== UserRole.LISTENER) {
      throw new BadRequestError('User is already a speaker');
    }

    const room = await roomService.findById(roomId);
    const speakerCount = await roomService.getSpeakerCount(roomId);

    if (speakerCount >= room.max_speakers) {
      throw new BadRequestError('Maximum speakers reached');
    }

    const previousRole = target.role;
    await roomService.changeRole(roomId, targetUserId, UserRole.SPEAKER, moderatorId);

    await this.logAudit(roomId, AuditAction.PROMOTE, moderatorId, targetUserId, {
      previousRole,
      newRole: UserRole.SPEAKER,
    });

    logger.info({ roomId, targetUserId, moderatorId }, 'User promoted to speaker');
  }

  async demoteToListener(
    roomId: string,
    targetUserId: string,
    moderatorId: string
  ): Promise<void> {
    const moderator = await roomService.getParticipant(roomId, moderatorId);

    if (moderator.role !== UserRole.OWNER_MODERATOR && moderator.role !== UserRole.MODERATOR) {
      throw new ForbiddenError('Only moderators can demote users');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.LISTENER) {
      throw new BadRequestError('User is already a listener');
    }

    if (target.role === UserRole.OWNER_MODERATOR) {
      throw new BadRequestError('Cannot demote the owner');
    }

    if (target.role === UserRole.MODERATOR && moderator.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Cannot demote other moderators');
    }

    const previousRole = target.role;
    await roomService.changeRole(roomId, targetUserId, UserRole.LISTENER, moderatorId);

    await this.logAudit(roomId, AuditAction.DEMOTE, moderatorId, targetUserId, {
      previousRole,
      newRole: UserRole.LISTENER,
    });

    logger.info({ roomId, targetUserId, moderatorId }, 'User demoted to listener');
  }

  async addModerator(
    roomId: string,
    targetUserId: string,
    ownerId: string
  ): Promise<void> {
    const owner = await roomService.getParticipant(roomId, ownerId);

    if (owner.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Only the owner can add moderators');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role === UserRole.OWNER_MODERATOR) {
      throw new BadRequestError('User is already the owner');
    }

    if (target.role === UserRole.MODERATOR) {
      throw new BadRequestError('User is already a moderator');
    }

    const previousRole = target.role;
    await roomService.changeRole(roomId, targetUserId, UserRole.MODERATOR, ownerId);

    await this.logAudit(roomId, AuditAction.ADD_MODERATOR, ownerId, targetUserId, {
      previousRole,
      newRole: UserRole.MODERATOR,
    });

    logger.info({ roomId, targetUserId, ownerId }, 'User promoted to moderator');
  }

  async removeModerator(
    roomId: string,
    targetUserId: string,
    ownerId: string
  ): Promise<void> {
    const owner = await roomService.getParticipant(roomId, ownerId);

    if (owner.role !== UserRole.OWNER_MODERATOR) {
      throw new ForbiddenError('Only the owner can remove moderators');
    }

    const target = await roomService.getParticipant(roomId, targetUserId);

    if (target.role !== UserRole.MODERATOR) {
      throw new BadRequestError('User is not a moderator');
    }

    const previousRole = target.role;
    await roomService.changeRole(roomId, targetUserId, UserRole.SPEAKER, ownerId);

    await this.logAudit(roomId, AuditAction.REMOVE_MODERATOR, ownerId, targetUserId, {
      previousRole,
      newRole: UserRole.SPEAKER,
    });

    logger.info({ roomId, targetUserId, ownerId }, 'User demoted from moderator');
  }

  private async logAudit(
    roomId: string,
    action: AuditAction,
    actorId: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await auditRepository.log(roomId, action, actorId, targetId, metadata);
    } catch (error) {
      logger.error({ err: error, roomId, action }, 'Failed to create audit log');
    }
  }
}

export const moderationService = new ModerationService();
export default moderationService;
