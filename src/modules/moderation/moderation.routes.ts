import { Router, Response, NextFunction } from 'express';
import { moderationService } from './moderation.service.js';
import { reportService } from './report.service.js';
import { auditRepository } from './audit.repository.js';
import { authGuard, requireAdmin, AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import { getZodErrorMessage, reportSchema } from '../../common/utils/validation.js';
import { BadRequestError } from '../../common/utils/app-error.js';

const router = Router();

// Moderation actions
router.post('/mute/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    const { reason } = req.body;
    await moderationService.mute(roomId, userId, req.user!.userId, reason);
    res.json({ message: 'User muted' });
  } catch (error) {
    next(error);
  }
});

router.post('/unmute/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    await moderationService.unmute(roomId, userId, req.user!.userId);
    res.json({ message: 'User unmuted' });
  } catch (error) {
    next(error);
  }
});

router.post('/kick/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    const { reason } = req.body;
    await moderationService.kick(roomId, userId, req.user!.userId, reason);
    res.json({ message: 'User kicked' });
  } catch (error) {
    next(error);
  }
});

router.post('/promote/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    await moderationService.promoteToSpeaker(roomId, userId, req.user!.userId);
    res.json({ message: 'User promoted to speaker' });
  } catch (error) {
    next(error);
  }
});

router.post('/demote/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    await moderationService.demoteToListener(roomId, userId, req.user!.userId);
    res.json({ message: 'User demoted to listener' });
  } catch (error) {
    next(error);
  }
});

router.post('/add-moderator/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    await moderationService.addModerator(roomId, userId, req.user!.userId);
    res.json({ message: 'User promoted to moderator' });
  } catch (error) {
    next(error);
  }
});

router.delete('/remove-moderator/:roomId/:userId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, userId } = req.params;
    await moderationService.removeModerator(roomId, userId, req.user!.userId);
    res.json({ message: 'User removed from moderator' });
  } catch (error) {
    next(error);
  }
});

// Report submission (all authenticated users)
router.post('/report', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = reportSchema.parse(req.body);

    const reportData: {
      targetType: 'user' | 'room';
      reporterId: string;
      reportedUserId?: string;
      roomId?: string | null;
      reason: 'harassment' | 'hate_speech' | 'spam' | 'other';
      description?: string;
    } = {
      targetType: parsed.targetType,
      reporterId: req.user!.userId,
      reason: parsed.category,
      description: parsed.description,
    };

    if (parsed.targetType === 'user') {
      reportData.reportedUserId = parsed.targetId;
    } else {
      reportData.roomId = parsed.roomId;
    }

    const report = await reportService.create(reportData);
    res.status(201).json({
      message: 'Report submitted',
      reportId: report.id,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      next(new BadRequestError(getZodErrorMessage(error), error));
      return;
    }
    next(error);
  }
});

// Admin report management endpoints
router.get('/reports', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page, limit } = req.query;

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    let result;
    if (status && typeof status === 'string') {
      result = await reportService.getReportsByStatus(
        status as 'pending' | 'under_review' | 'resolved' | 'dismissed',
        limitNum,
        pageNum
      );
    } else {
      result = await reportService.getAllReports(limitNum, pageNum);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/reports/:id', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId)) {
      throw new BadRequestError('Invalid report ID');
    }

    const report = await reportService.getReportById(reportId);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.patch('/reports/:id/resolve', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId)) {
      throw new BadRequestError('Invalid report ID');
    }

    const report = await reportService.resolveReport(reportId, req.user!.userId);
    res.json({
      message: 'Report resolved',
      report,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/reports/:id/dismiss', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reportId = parseInt(req.params.id, 10);

    if (isNaN(reportId)) {
      throw new BadRequestError('Invalid report ID');
    }

    const report = await reportService.dismissReport(reportId, req.user!.userId);
    res.json({
      message: 'Report dismissed',
      report,
    });
  } catch (error) {
    next(error);
  }
});

// Audit log endpoints
router.get('/audit/room/:roomId', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { limit } = req.query;

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const logs = await auditRepository.getRoomLogs(roomId, limitNum);

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.get('/audit/user/:userId', authGuard, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    const logs = await auditRepository.getUserLogs(userId, limitNum);

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
