import database from '../../config/database.js';
import { ReportCategory } from '../../types/enums.js';

export interface ReportEntry {
  id: number;
  roomId: number | null;
  reporterId: number;
  reportedUserId: number;
  reason: ReportCategory;
  description: string | null;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolvedBy: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface ReportWithUsers extends ReportEntry {
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  reportedUsername: string | null;
  reportedDisplayName: string | null;
  roomTitle: string | null;
  resolverUsername: string | null;
}

export class ReportRepository {
  async create(data: {
    roomId: number | null;
    reporterId: number;
    reportedUserId: number | null;
    reason: ReportCategory;
    description?: string;
  }): Promise<ReportEntry> {
    const result = await database.query(
      `INSERT INTO reports (room_id, reporter_id, reported_user_id, reason, description, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       RETURNING id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at`,
      [data.roomId, data.reporterId, data.reportedUserId, data.reason, data.description || null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async findById(id: number): Promise<ReportWithUsers | null> {
    const result = await database.query(
      `SELECT
        r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason, r.description,
        r.status, r.resolved_by, r.resolved_at, r.created_at,
        reporter.username as reporter_username,
        reporter.display_name as reporter_display_name,
        reported.username as reported_username,
        reported.display_name as reported_display_name,
        room.title as room_title,
        resolver.username as resolver_username
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN rooms room ON r.room_id = room.id
       LEFT JOIN users resolver ON r.resolved_by = resolver.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToReportWithUsers(result.rows[0]);
  }

  async getReportsByStatus(
    status: 'pending' | 'under_review' | 'resolved' | 'dismissed',
    limit = 20,
    offset = 0
  ): Promise<ReportWithUsers[]> {
    const result = await database.query(
      `SELECT
        r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason, r.description,
        r.status, r.resolved_by, r.resolved_at, r.created_at,
        reporter.username as reporter_username,
        reporter.display_name as reporter_display_name,
        reported.username as reported_username,
        reported.display_name as reported_display_name,
        room.title as room_title,
        resolver.username as resolver_username
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN rooms room ON r.room_id = room.id
       LEFT JOIN users resolver ON r.resolved_by = resolver.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    return result.rows.map(row => this.mapToReportWithUsers(row));
  }

  async getAllReports(limit = 20, offset = 0): Promise<ReportWithUsers[]> {
    const result = await database.query(
      `SELECT
        r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason, r.description,
        r.status, r.resolved_by, r.resolved_at, r.created_at,
        reporter.username as reporter_username,
        reporter.display_name as reporter_display_name,
        reported.username as reported_username,
        reported.display_name as reported_display_name,
        room.title as room_title,
        resolver.username as resolver_username
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN rooms room ON r.room_id = room.id
       LEFT JOIN users resolver ON r.resolved_by = resolver.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map(row => this.mapToReportWithUsers(row));
  }

  async getReportsByReporter(reporterId: number, limit = 20): Promise<ReportWithUsers[]> {
    const result = await database.query(
      `SELECT
        r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason, r.description,
        r.status, r.resolved_by, r.resolved_at, r.created_at,
        reporter.username as reporter_username,
        reporter.display_name as reporter_display_name,
        reported.username as reported_username,
        reported.display_name as reported_display_name,
        room.title as room_title,
        resolver.username as resolver_username
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN rooms room ON r.room_id = room.id
       LEFT JOIN users resolver ON r.resolved_by = resolver.id
       WHERE r.reporter_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [reporterId, limit]
    );

    return result.rows.map(row => this.mapToReportWithUsers(row));
  }

  async getReportsAgainstUser(reportedUserId: number, limit = 20): Promise<ReportWithUsers[]> {
    const result = await database.query(
      `SELECT
        r.id, r.room_id, r.reporter_id, r.reported_user_id, r.reason, r.description,
        r.status, r.resolved_by, r.resolved_at, r.created_at,
        reporter.username as reporter_username,
        reporter.display_name as reporter_display_name,
        reported.username as reported_username,
        reported.display_name as reported_display_name,
        room.title as room_title,
        resolver.username as resolver_username
       FROM reports r
       LEFT JOIN users reporter ON r.reporter_id = reporter.id
       LEFT JOIN users reported ON r.reported_user_id = reported.id
       LEFT JOIN rooms room ON r.room_id = room.id
       LEFT JOIN users resolver ON r.resolved_by = resolver.id
       WHERE r.reported_user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [reportedUserId, limit]
    );

    return result.rows.map(row => this.mapToReportWithUsers(row));
  }

  async resolve(id: number, resolvedBy: number): Promise<ReportEntry> {
    const result = await database.query(
      `UPDATE reports
       SET status = 'resolved', resolved_by = $1, resolved_at = NOW()
       WHERE id = $2
       RETURNING id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at`,
      [resolvedBy, id]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async dismiss(id: number, resolvedBy: number): Promise<ReportEntry> {
    const result = await database.query(
      `UPDATE reports
       SET status = 'dismissed', resolved_by = $1, resolved_at = NOW()
       WHERE id = $2
       RETURNING id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at`,
      [resolvedBy, id]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async setUnderReview(id: number): Promise<ReportEntry> {
    const result = await database.query(
      `UPDATE reports
       SET status = 'under_review'
       WHERE id = $1
       RETURNING id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at`,
      [id]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async checkExistingUserReport(
    reporterId: number,
    reportedUserId: number,
    excludeResolved = true
  ): Promise<ReportEntry | null> {
    const statusCondition = excludeResolved
      ? "AND status NOT IN ('resolved', 'dismissed')"
      : '';

    const result = await database.query(
      `SELECT id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at
       FROM reports
       WHERE reporter_id = $1 AND reported_user_id = $2 ${statusCondition}
       LIMIT 1`,
      [reporterId, reportedUserId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async checkExistingRoomReport(
    reporterId: number,
    roomId: number,
    excludeResolved = true
  ): Promise<ReportEntry | null> {
    const statusCondition = excludeResolved
      ? "AND status NOT IN ('resolved', 'dismissed')"
      : '';

    const result = await database.query(
      `SELECT id, room_id, reporter_id, reported_user_id, reason, description, status, resolved_by, resolved_at, created_at
       FROM reports
       WHERE reporter_id = $1 AND room_id = $2 ${statusCondition}
       LIMIT 1`,
      [reporterId, roomId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  async countByStatus(status: 'pending' | 'under_review' | 'resolved' | 'dismissed'): Promise<number> {
    const result = await database.query(
      'SELECT COUNT(*) as count FROM reports WHERE status = $1',
      [status]
    );
    return parseInt(result.rows[0].count);
  }

  async countAll(): Promise<number> {
    const result = await database.query('SELECT COUNT(*) as count FROM reports');
    return parseInt(result.rows[0].count);
  }

  private mapToReportWithUsers(row: any): ReportWithUsers {
    return {
      id: row.id,
      roomId: row.room_id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      reason: row.reason,
      description: row.description,
      status: row.status,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      reporterUsername: row.reporter_username,
      reporterDisplayName: row.reporter_display_name,
      reportedUsername: row.reported_username,
      reportedDisplayName: row.reported_display_name,
      roomTitle: row.room_title,
      resolverUsername: row.resolver_username,
    };
  }
}

export const reportRepository = new ReportRepository();
export default reportRepository;
