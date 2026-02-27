import { Response, NextFunction } from 'express';
import { roomService } from './room.service.js';
import { createRoomSchema, getZodErrorMessage, updateRoomSchema } from '../../common/utils/validation.js';
import { BadRequestError, NotFoundError, ServiceUnavailableError } from '../../common/utils/app-error.js';
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import { RoomStatus, UserRole } from '../../types/enums.js';
import { livekitService } from '../../config/livekit.js';
import { userService } from '../user/user.service.js';
import { categoryService } from './category.service.js';
import { roomSearchService } from './search.service.js';
import { handoverService } from './handover.service.js';
import config from '../../config/index.js';

type LiveKitRole = 'owner' | 'moderator' | 'speaker' | 'listener';

export class RoomController {
  private mapToLiveKitRole(role: UserRole): LiveKitRole {
    switch (role) {
      case UserRole.OWNER_MODERATOR:
        return 'owner';
      case UserRole.MODERATOR:
        return 'moderator';
      case UserRole.SPEAKER:
        return 'speaker';
      default:
        return 'listener';
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createRoomSchema.parse(req.body);
      const room = await roomService.create(req.user!.userId, parsed);

      const user = await userService.findById(req.user!.userId);

      res.status(201).json({
        id: room.id,
        title: room.title,
        description: room.description,
        category: room.category,
        language: room.language,
        visibility: room.visibility,
        maxSpeakers: room.max_speakers,
        micRequestsEnabled: room.mic_requests_enabled,
        status: room.status,
        createdBy: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        },
        createdAt: room.created_at,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, category, language, status } = req.query;

      const result = await roomService.list({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        category: category as string,
        language: language as string,
        status: status as RoomStatus,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const room = await roomService.findById(id);

      const creator = await userService.findById(room.created_by.toString());

      const { speakerCount, listenerCount } = await roomService.getRoomRoleCounts(id);

      res.json({
        id: room.id,
        title: room.title,
        description: room.description,
        category: room.category,
        language: room.language,
        visibility: room.visibility,
        maxSpeakers: room.max_speakers,
        micRequestsEnabled: room.mic_requests_enabled,
        status: room.status,
        speakerCount,
        listenerCount,
        createdBy: {
          id: creator.id,
          username: creator.username,
          displayName: creator.display_name,
          avatarUrl: creator.avatar_url,
        },
        createdAt: room.created_at,
        startedAt: room.started_at,
      });
    } catch (error) {
      next(error);
    }
  }

  async getParticipants(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const grouped = await roomService.getParticipantsGrouped(id);
      res.json(grouped);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = updateRoomSchema.parse(req.body);
      const room = await roomService.update(id, req.user!.userId, parsed);

      res.json({
        id: room.id,
        title: room.title,
        description: room.description,
        category: room.category,
        visibility: room.visibility,
        maxSpeakers: room.max_speakers,
        micRequestsEnabled: room.mic_requests_enabled,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async close(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await roomService.close(id, req.user!.userId);

      res.json({ message: 'Room closed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async join(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const numericUserId = parseInt(userId, 10);

      const room = await roomService.findById(id);

      if (room.status === RoomStatus.ENDED) {
        throw new BadRequestError('Room has ended');
      }

      const desiredRole =
        room.created_by === numericUserId
          ? UserRole.OWNER_MODERATOR
          : UserRole.LISTENER;

      const participant = await roomService.addParticipant(id, userId, desiredRole);
      const participantRole = participant.role as UserRole;
      const livekitRole = this.mapToLiveKitRole(participantRole);
      const username = req.user?.username || `user_${userId}`;

      let livekitToken = '';
      if (config.services.livekitRequired && !livekitService.isConfigured()) {
        throw new ServiceUnavailableError('LiveKit service is not available');
      }

      if (livekitService.isConfigured()) {
        livekitToken = livekitService.generateToken({
          roomName: id,
          userId: userId,
          username,
          role: livekitRole,
        });
      }

      if (config.services.livekitRequired && !livekitToken) {
        throw new ServiceUnavailableError('LiveKit token could not be generated');
      }

      res.json({
        roomId: id,
        role: participantRole,
        token: livekitToken,
        micRequestsEnabled: room.mic_requests_enabled,
      });
    } catch (error) {
      next(error);
    }
  }

  async leave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      let participant: any;
      try {
        participant = await roomService.getParticipant(id, userId);
      } catch (error) {
        if (error instanceof NotFoundError) {
          res.json({ message: 'Already left room' });
          return;
        }
        throw error;
      }

      if (participant.role === UserRole.OWNER_MODERATOR) {
        await roomService.markParticipantDisconnected(id, userId);
        await handoverService.startGracePeriod(id);

        const gracePeriodEnd = Date.now() + config.room.defaultGracePeriodSeconds * 1000;
        res.json({
          message: 'Owner left room. Grace period started.',
          gracePeriodEnd,
        });
        return;
      } else {
        await roomService.removeParticipant(id, userId);
      }

      res.json({ message: 'Left room successfully' });
    } catch (error) {
      next(error);
    }
  }

  async mediaToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const room = await roomService.findById(id);
      if (room.status === RoomStatus.ENDED) {
        throw new BadRequestError('Room has ended');
      }

      const participant = await roomService.getParticipant(id, userId);
      const participantRole = participant.role as UserRole;
      const livekitRole = this.mapToLiveKitRole(participantRole);
      const username = req.user?.username || `user_${userId}`;

      let livekitToken = '';
      if (config.services.livekitRequired && !livekitService.isConfigured()) {
        throw new ServiceUnavailableError('LiveKit service is not available');
      }

      if (livekitService.isConfigured()) {
        livekitToken = livekitService.generateToken({
          roomName: id,
          userId,
          username,
          role: livekitRole,
        });
      }

      if (config.services.livekitRequired && !livekitToken) {
        throw new ServiceUnavailableError('LiveKit token could not be generated');
      }

      res.json({
        roomId: id,
        role: participantRole,
        token: livekitToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await categoryService.getAllCategories();

      res.json(categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
      })));
    } catch (error) {
      next(error);
    }
  }

  async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, category, language, page, limit } = req.query;

      const result = await roomSearchService.search({
        query: q as string,
        category: category as string,
        language: language as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getFeatured(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const rooms = await roomSearchService.getFeaturedRooms(limit);

      res.json(rooms.map(room => ({
        id: room.id,
        title: room.title,
        description: room.description,
        category: room.category_name,
        categorySlug: room.category_slug,
        ownerUsername: room.owner_username,
        ownerDisplayName: room.owner_display_name,
        ownerAvatar: room.owner_avatar,
        viewerCount: room.viewer_count,
        status: room.status,
        createdAt: room.created_at,
      })));
    } catch (error) {
      next(error);
    }
  }

  async getTrending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const rooms = await roomSearchService.getTrendingRooms(limit);

      res.json(rooms.map(room => ({
        id: room.id,
        title: room.title,
        description: room.description,
        category: room.category_name,
        categorySlug: room.category_slug,
        ownerUsername: room.owner_username,
        ownerDisplayName: room.owner_display_name,
        ownerAvatar: room.owner_avatar,
        viewerCount: room.viewer_count,
        participantCount: room.participant_count,
        status: room.status,
        createdAt: room.created_at,
      })));
    } catch (error) {
      next(error);
    }
  }

  async getPendingSpeakInvite(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const pending = await roomService.hasPendingSpeakInvite(id, userId);
      res.json({ pending });
    } catch (error) {
      next(error);
    }
  }
}

export const roomController = new RoomController();
export default roomController;
