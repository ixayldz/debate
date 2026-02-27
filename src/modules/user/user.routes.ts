import { Router, Response, NextFunction } from 'express';
import { userController } from './user.controller.js';
import { authGuard, AuthenticatedRequest } from '../../common/guards/auth.guard.js';

const router = Router();

router.get('/me', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getMe(req, res, next);
});

router.patch('/me', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.updateMe(req, res, next);
});

router.get('/me/rooms', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getMyRooms(req, res, next);
});

router.get('/search', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.searchUsers(req, res, next);
});

router.get('/:username', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getUserByUsername(req, res, next);
});

router.post('/:id/follow', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.followUser(req, res, next);
});

router.delete('/:id/follow', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.unfollowUser(req, res, next);
});

router.get('/:id/followers', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getFollowers(req, res, next);
});

router.get('/:id/following', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getFollowing(req, res, next);
});

router.post('/:id/block', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.blockUser(req, res, next);
});

router.delete('/:id/block', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.unblockUser(req, res, next);
});

router.get('/me/notifications', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.getNotifications(req, res, next);
});

router.patch('/me/notifications/:id/read', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.markNotificationRead(req, res, next);
});

router.patch('/me/notifications/read-all', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  userController.markAllNotificationsRead(req, res, next);
});

export default router;
