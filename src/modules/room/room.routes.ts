import { Router, Response, NextFunction } from 'express';
import { roomController } from './room.controller.js';
import { roomService } from './room.service.js';
import { authGuard, AuthenticatedRequest } from '../../common/guards/auth.guard.js';

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
    await roomService.acceptSpeakInvite(id, userId);
    res.json({ success: true, message: 'Speaker invite accepted' });
  } catch (error) { next(error); }
});

router.post('/:id/invite-speak/decline', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    await roomService.declineSpeakInvite(id, userId);
    res.json({ success: true, message: 'Speaker invite declined' });
  } catch (error) { next(error); }
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

