import { Response, NextFunction } from 'express';
import { userService } from './user.service.js';
import { getZodErrorMessage, updateProfileSchema } from '../../common/utils/validation.js';
import { BadRequestError } from '../../common/utils/app-error.js';
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import { followService, blockService } from './follow.service.js';
import { notificationService } from './notification.service.js';
import { redisClient } from '../../config/redis.js';

export class UserController {
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.user!.userId);

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        interests: user.interests,
        language: user.language,
        createdAt: user.created_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateProfileSchema.parse(req.body);

      // Username change rate limit: 1 change per 30 days
      if (parsed.username) {
        const rateLimitKey = `user:${req.user!.userId}:username_changed`;
        const lastChange = await redisClient.getClient().get(rateLimitKey);
        if (lastChange) {
          const daysLeft = Math.ceil((parseInt(lastChange) + 30 * 86400 * 1000 - Date.now()) / (86400 * 1000));
          throw new BadRequestError(
            `Username can only be changed once every 30 days. ${daysLeft} days remaining.`
          );
        }
        // Set rate limit (30 days TTL)
        await redisClient.getClient().set(rateLimitKey, Date.now().toString(), 'EX', 30 * 86400);
        await userService.updateUsername(req.user!.userId, parsed.username);
      }

      const profileInput = { ...parsed };
      if (profileInput.username) {
        delete profileInput.username;
      }
      const user = await userService.updateProfile(req.user!.userId, profileInput);

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        interests: user.interests,
        language: user.language,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async getUserByUsername(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = req.params;

      // First find user by username, then get public profile by ID
      const user = await userService.findByUsername(username);
      const profile = await userService.getPublicProfile(user.id.toString());

      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async getMyRooms(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rooms = await userService.getUserRooms(req.user!.userId);

      res.json(rooms.map(room => ({
        id: room.id,
        title: room.title,
        category: room.category,
        status: room.status,
        createdAt: room.created_at,
      })));
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit } = req.query;

      if (!q || typeof q !== 'string') {
        throw new BadRequestError('Search query is required');
      }

      const users = await userService.searchUsers(q, limit ? parseInt(limit as string, 10) : 20);

      res.json(users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
      })));
    } catch (error) {
      next(error);
    }
  }

  async followUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      if (isNaN(targetUserId)) {
        throw new BadRequestError('Invalid user ID');
      }

      await followService.follow(parseInt(req.user!.userId), targetUserId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async unfollowUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      if (isNaN(targetUserId)) {
        throw new BadRequestError('Invalid user ID');
      }

      await followService.unfollow(parseInt(req.user!.userId), targetUserId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getFollowers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { page, limit } = req.query;

      if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
      }

      const result = await followService.getFollowers(
        userId,
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getFollowing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { page, limit } = req.query;

      if (isNaN(userId)) {
        throw new BadRequestError('Invalid user ID');
      }

      const result = await followService.getFollowing(
        userId,
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async blockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      if (isNaN(targetUserId)) {
        throw new BadRequestError('Invalid user ID');
      }

      await blockService.block(parseInt(req.user!.userId), targetUserId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async unblockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = parseInt(req.params.id, 10);

      if (isNaN(targetUserId)) {
        throw new BadRequestError('Invalid user ID');
      }

      await blockService.unblock(parseInt(req.user!.userId), targetUserId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query;

      const result = await notificationService.getNotifications(
        parseInt(req.user!.userId),
        page ? parseInt(page as string, 10) : 1,
        limit ? parseInt(limit as string, 10) : 20
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = parseInt(req.params.id, 10);

      if (isNaN(notificationId)) {
        throw new BadRequestError('Invalid notification ID');
      }

      await notificationService.markAsRead(notificationId, parseInt(req.user!.userId));

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(parseInt(req.user!.userId));

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
export default userController;
