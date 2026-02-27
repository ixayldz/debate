import database from '../../config/database.js';

export interface AuditLogEntry {
  id: number;
  roomId: number | null;
  action: string;
  actorId: number | null;
  targetId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogWithUsers extends AuditLogEntry {
  actorUsername: string | null;
  actorDisplayName: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
  roomTitle: string | null;
}

export class AuditRepository {
  async log(
    roomId: string | number | null,
    action: string,
    actorId: string | number | null,
    targetId: string | number | null,
    metadata?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    const roomIdNum = roomId ? parseInt(roomId.toString()) : null;
    const actorIdNum = actorId ? parseInt(actorId.toString()) : null;
    const targetIdNum = targetId ? parseInt(targetId.toString()) : null;

    const result = await database.query(
      `INSERT INTO audit_logs (room_id, action, actor_id, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, room_id, action, actor_id, target_id, metadata, created_at`,
      [roomIdNum, action, actorIdNum, targetIdNum, metadata ? JSON.stringify(metadata) : null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      action: row.action,
      actorId: row.actor_id,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  async getRoomLogs(
    roomId: string | number,
    limit = 100
  ): Promise<AuditLogWithUsers[]> {
    const roomIdNum = parseInt(roomId.toString());

    const result = await database.query(
      `SELECT
        al.id, al.room_id, al.action, al.actor_id, al.target_id, al.metadata, al.created_at,
        actor.username as actor_username,
        actor.display_name as actor_display_name,
        target.username as target_username,
        target.display_name as target_display_name,
        r.title as room_title
       FROM audit_logs al
       LEFT JOIN users actor ON al.actor_id = actor.id
       LEFT JOIN users target ON al.target_id = target.id
       LEFT JOIN rooms r ON al.room_id = r.id
       WHERE al.room_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [roomIdNum, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      action: row.action,
      actorId: row.actor_id,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorUsername: row.actor_username,
      actorDisplayName: row.actor_display_name,
      targetUsername: row.target_username,
      targetDisplayName: row.target_display_name,
      roomTitle: row.room_title,
    }));
  }

  async getUserLogs(
    userId: string | number,
    limit = 100
  ): Promise<AuditLogWithUsers[]> {
    const userIdNum = parseInt(userId.toString());

    const result = await database.query(
      `SELECT
        al.id, al.room_id, al.action, al.actor_id, al.target_id, al.metadata, al.created_at,
        actor.username as actor_username,
        actor.display_name as actor_display_name,
        target.username as target_username,
        target.display_name as target_display_name,
        r.title as room_title
       FROM audit_logs al
       LEFT JOIN users actor ON al.actor_id = actor.id
       LEFT JOIN users target ON al.target_id = target.id
       LEFT JOIN rooms r ON al.room_id = r.id
       WHERE al.actor_id = $1 OR al.target_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [userIdNum, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      action: row.action,
      actorId: row.actor_id,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorUsername: row.actor_username,
      actorDisplayName: row.actor_display_name,
      targetUsername: row.target_username,
      targetDisplayName: row.target_display_name,
      roomTitle: row.room_title,
    }));
  }

  async getUserActionsInRoom(
    roomId: string | number,
    userId: string | number,
    limit = 100
  ): Promise<AuditLogWithUsers[]> {
    const roomIdNum = parseInt(roomId.toString());
    const userIdNum = parseInt(userId.toString());

    const result = await database.query(
      `SELECT
        al.id, al.room_id, al.action, al.actor_id, al.target_id, al.metadata, al.created_at,
        actor.username as actor_username,
        actor.display_name as actor_display_name,
        target.username as target_username,
        target.display_name as target_display_name,
        r.title as room_title
       FROM audit_logs al
       LEFT JOIN users actor ON al.actor_id = actor.id
       LEFT JOIN users target ON al.target_id = target.id
       LEFT JOIN rooms r ON al.room_id = r.id
       WHERE al.room_id = $1 AND al.actor_id = $2
       ORDER BY al.created_at DESC
       LIMIT $3`,
      [roomIdNum, userIdNum, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      action: row.action,
      actorId: row.actor_id,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorUsername: row.actor_username,
      actorDisplayName: row.actor_display_name,
      targetUsername: row.target_username,
      targetDisplayName: row.target_display_name,
      roomTitle: row.room_title,
    }));
  }

  async getRecentLogsByAction(
    action: string,
    limit = 100
  ): Promise<AuditLogWithUsers[]> {
    const result = await database.query(
      `SELECT
        al.id, al.room_id, al.action, al.actor_id, al.target_id, al.metadata, al.created_at,
        actor.username as actor_username,
        actor.display_name as actor_display_name,
        target.username as target_username,
        target.display_name as target_display_name,
        r.title as room_title
       FROM audit_logs al
       LEFT JOIN users actor ON al.actor_id = actor.id
       LEFT JOIN users target ON al.target_id = target.id
       LEFT JOIN rooms r ON al.room_id = r.id
       WHERE al.action = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [action, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      action: row.action,
      actorId: row.actor_id,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorUsername: row.actor_username,
      actorDisplayName: row.actor_display_name,
      targetUsername: row.target_username,
      targetDisplayName: row.target_display_name,
      roomTitle: row.room_title,
    }));
  }

  async deleteRoomLogs(roomId: string | number): Promise<void> {
    const roomIdNum = parseInt(roomId.toString());
    await database.query('DELETE FROM audit_logs WHERE room_id = $1', [roomIdNum]);
  }
}

export const auditRepository = new AuditRepository();
export default auditRepository;
