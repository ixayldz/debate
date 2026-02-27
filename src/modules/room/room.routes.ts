import { Router, Response, NextFunction } from 'express';
import { roomController } from './room.controller.js';
import { roomService } from './room.service.js';
import { micRequestService } from '../mic-request/mic-request.service.js';
import { authGuard, AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import { UserRole } from '../../types/enums.js';
import {
  emitMicQueueUpdated,
  emitMicRequestResult,
  emitRoomRoleChanged,
} from '../../config/socket-state.js';

const router = Router();

router.get('/categories', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getCategories(req, res, next);
});

router.get('/search', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.search(req, res, next);
});

router.post('/', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.create(req, res, next);
});

router.get('/', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.list(req, res, next);
});

router.get('/featured', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getFeatured(req, res, next);
});

router.get('/trending', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getTrending(req, res, next);
});

router.get('/:id', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getById(req, res, next);
});

router.get('/:id/participants', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getParticipants(req, res, next);
});

router.patch('/:id', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.update(req, res, next);
});

router.delete('/:id', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.close(req, res, next);
});

router.post('/:id/join', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.join(req, res, next);
});

router.post('/:id/leave', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.leave(req, res, next);
});

router.post('/:id/media-token', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.mediaToken(req, res, next);
});

router.post('/:id/mic/request', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    await micRequestService.addToQueue(id, userId);
    const queue = await micRequestService.getQueue(id);
    emitMicQueueUpdated(id, queue);
    res.json({ success: true, queue });
  } catch (error) { next(error); }
});

router.delete('/:id/mic/request', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    await micRequestService.removeFromQueue(id, userId);
    const queue = await micRequestService.getQueue(id);
    emitMicQueueUpdated(id, queue);
    res.json({ success: true, queue });
  } catch (error) { next(error); }
});

router.get('/:id/mic/queue', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const queue = await micRequestService.getQueue(id);
    res.json({ queue });
  } catch (error) { next(error); }
});

router.post('/:id/mic/accept', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { requestId } = req.body;
    const userId = req.user!.userId;
    const request = await micRequestService.acceptRequest(id, requestId, userId);
    const queue = await micRequestService.getQueue(id);
    emitMicQueueUpdated(id, queue);
    emitMicRequestResult(request.userId, {
      roomId: id,
      requestId,
      action: 'accepted',
    });
    emitRoomRoleChanged(id, request.userId, UserRole.SPEAKER);
    res.json({ success: true, queue });
  } catch (error) { next(error); }
});

router.post('/:id/mic/reject', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { requestId } = req.body;
    const userId = req.user!.userId;
    const request = await micRequestService.rejectRequest(id, requestId, userId);
    const queue = await micRequestService.getQueue(id);
    emitMicQueueUpdated(id, queue);
    emitMicRequestResult(request.userId, {
      roomId: id,
      requestId,
      action: 'rejected',
    });
    res.json({ success: true, queue });
  } catch (error) { next(error); }
});

// Invite-to-speak flow
router.post('/:id/invite-speak', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { targetUserId } = req.body;
    const actorId = req.user!.userId;
    await roomService.inviteToSpeak(id, targetUserId, actorId);
    res.json({ success: true, message: 'Speaker invite sent' });
  } catch (error) { next(error); }
});

router.post('/:id/invite-speak/accept', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const accepted = await roomService.acceptSpeakInvite(id, userId);
    res.json({
      success: accepted,
      message: accepted ? 'Speaker invite accepted' : 'No pending speak invitation',
    });
  } catch (error) { next(error); }
});

router.post('/:id/invite-speak/decline', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const declined = await roomService.declineSpeakInvite(id, userId);
    res.json({
      success: declined,
      message: declined ? 'Speaker invite declined' : 'No pending speak invitation',
    });
  } catch (error) { next(error); }
});

router.get('/:id/invite-speak/pending', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  roomController.getPendingSpeakInvite(req, res, next);
});

// Private room invite
router.post('/:id/invite', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { targetUserId } = req.body;
    const actorId = req.user!.userId;
    await roomService.inviteToRoom(id, targetUserId, actorId);
    res.json({ success: true, message: 'Room invite sent' });
  } catch (error) { next(error); }
});

export const roomRoutes = router;
export default roomRoutes;
