import { auditRepository, AuditLogWithUsers } from './audit.repository.js';

export class AuditService {
  async log(
    roomId: string | number | null,
    action: string,
    actorId: string | number | null,
    targetId: string | number | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await auditRepository.log(roomId, action, actorId, targetId, metadata);
  }

  async getRoomLogs(roomId: string | number, limit = 100): Promise<AuditLogWithUsers[]> {
    return auditRepository.getRoomLogs(roomId, limit);
  }

  async getUserLogs(userId: string | number, limit = 100): Promise<AuditLogWithUsers[]> {
    return auditRepository.getUserLogs(userId, limit);
  }

  async getUserActionsInRoom(roomId: string | number, userId: string | number): Promise<AuditLogWithUsers[]> {
    return auditRepository.getUserActionsInRoom(roomId, userId);
  }

  async getRecentLogsByAction(action: string, limit = 100): Promise<AuditLogWithUsers[]> {
    return auditRepository.getRecentLogsByAction(action, limit);
  }
}

export const auditService = new AuditService();
export default auditService;
