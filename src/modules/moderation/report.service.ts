import { reportRepository } from './report.repository.js';
import { userRepository } from '../user/user.repository.js';
import { BadRequestError, NotFoundError } from '../../common/utils/app-error.js';
import { ReportCategory } from '../../types/enums.js';
import { logger } from '../../config/logger.js';
import database from '../../config/database.js';

export interface CreateReportInput {
  targetType: 'user' | 'room';
  reporterId: string | number;
  reportedUserId?: string | number;
  roomId?: string | number | null;
  reason: ReportCategory | 'harassment' | 'hate_speech' | 'spam' | 'other';
  description?: string;
}

export class ReportService {
  async create(data: CreateReportInput): Promise<any> {
    const reporterId = parseInt(data.reporterId.toString());
    const roomId = data.roomId ? parseInt(data.roomId.toString()) : null;

    let reportedUserId: number | null = null;
    if (data.targetType === 'user') {
      if (!data.reportedUserId) {
        throw new BadRequestError('reportedUserId is required for user reports');
      }

      reportedUserId = parseInt(data.reportedUserId.toString());
      if (reporterId === reportedUserId) {
        throw new BadRequestError('Cannot report yourself');
      }

      const targetUser = await userRepository.findById(reportedUserId);
      if (!targetUser) {
        throw new NotFoundError('User', data.reportedUserId.toString());
      }

      const existingUserReport = await reportRepository.checkExistingUserReport(
        reporterId,
        reportedUserId,
        true
      );

      if (existingUserReport) {
        throw new BadRequestError('You have already reported this user');
      }
    } else {
      if (!roomId) {
        throw new BadRequestError('roomId is required for room reports');
      }

      const roomResult = await database.query('SELECT id FROM rooms WHERE id = $1', [roomId]);
      if (roomResult.rows.length === 0) {
        throw new NotFoundError('Room', roomId.toString());
      }

      const existingRoomReport = await reportRepository.checkExistingRoomReport(
        reporterId,
        roomId,
        true
      );

      if (existingRoomReport) {
        throw new BadRequestError('You have already reported this room');
      }
    }

    const report = await reportRepository.create({
      roomId,
      reporterId,
      reportedUserId,
      reason: data.reason as ReportCategory,
      description: data.description,
    });

    logger.info(
      { reporterId, reportedUserId, roomId, reason: data.reason },
      'Report created'
    );

    return report;
  }

  async getReportById(id: number): Promise<any> {
    const report = await reportRepository.findById(id);
    if (!report) {
      throw new NotFoundError('Report', id.toString());
    }
    return report;
  }

  async getReportsByStatus(
    status: 'pending' | 'under_review' | 'resolved' | 'dismissed',
    limit = 20,
    page = 1
  ): Promise<{ reports: any[]; total: number; page: number }> {
    const offset = (page - 1) * limit;
    const reports = await reportRepository.getReportsByStatus(status, limit, offset);
    const total = await reportRepository.countByStatus(status);

    return {
      reports,
      total,
      page,
    };
  }

  async getAllReports(
    limit = 20,
    page = 1
  ): Promise<{ reports: any[]; total: number; page: number }> {
    const offset = (page - 1) * limit;
    const reports = await reportRepository.getAllReports(limit, offset);
    const total = await reportRepository.countAll();

    return {
      reports,
      total,
      page,
    };
  }

  async getReportsByReporter(reporterId: string | number, limit = 20): Promise<any[]> {
    return reportRepository.getReportsByReporter(parseInt(reporterId.toString()), limit);
  }

  async getReportsAgainstUser(userId: string | number, limit = 20): Promise<any[]> {
    return reportRepository.getReportsAgainstUser(parseInt(userId.toString()), limit);
  }

  async resolveReport(reportId: number, resolvedBy: string | number): Promise<any> {
    const report = await reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report', reportId.toString());
    }

    if (report.status === 'resolved' || report.status === 'dismissed') {
      throw new BadRequestError('Report already resolved');
    }

    const resolved = await reportRepository.resolve(
      reportId,
      parseInt(resolvedBy.toString())
    );

    logger.info({ reportId, resolvedBy }, 'Report resolved');

    return resolved;
  }

  async dismissReport(reportId: number, resolvedBy: string | number): Promise<any> {
    const report = await reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report', reportId.toString());
    }

    if (report.status === 'resolved' || report.status === 'dismissed') {
      throw new BadRequestError('Report already resolved');
    }

    const dismissed = await reportRepository.dismiss(
      reportId,
      parseInt(resolvedBy.toString())
    );

    logger.info({ reportId, resolvedBy }, 'Report dismissed');

    return dismissed;
  }

  async setUnderReview(reportId: number): Promise<any> {
    const report = await reportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundError('Report', reportId.toString());
    }

    if (report.status !== 'pending') {
      throw new BadRequestError('Can only set pending reports to under review');
    }

    return reportRepository.setUnderReview(reportId);
  }
}

export const reportService = new ReportService();
export default reportService;
