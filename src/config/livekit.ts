import {
  AccessToken,
  VideoGrant,
  RoomServiceClient,
} from 'livekit-server-sdk';
import config from './index.js';
import { logger } from './logger.js';

function isLikelyPlaceholder(value: string): boolean {
  return /your-|your_|change|placeholder|example|dummy|test/i.test(value.trim());
}

export class LiveKitService {
  private roomService: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private serviceUrl: string;

  private toServiceUrl(rawUrl: string): string {
    if (rawUrl.startsWith('wss://')) {
      return `https://${rawUrl.slice('wss://'.length)}`;
    }
    if (rawUrl.startsWith('ws://')) {
      return `http://${rawUrl.slice('ws://'.length)}`;
    }
    return rawUrl;
  }

  constructor() {
    this.apiKey = config.livekit.apiKey;
    this.apiSecret = config.livekit.apiSecret;
    this.serviceUrl = this.toServiceUrl(config.livekit.url);
    this.roomService = new RoomServiceClient(
      this.serviceUrl,
      this.apiKey,
      this.apiSecret
    );
  }

  generateToken(params: {
    roomName: string;
    userId: string;
    username: string;
    role: 'owner' | 'moderator' | 'speaker' | 'listener';
  }): string {
    const { roomName, userId, username, role } = params;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: userId,
      name: username,
    });

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: role === 'owner' || role === 'moderator' || role === 'speaker',
      canSubscribe: true,
      canPublishData: true,
    };

    at.addGrant(grant);
    return at.toJwt();
  }

  async createRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 60 * 10,
        maxParticipants: 100,
      });
      logger.info({ roomName }, 'LiveKit room created');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logger.debug({ roomName }, 'LiveKit room already exists');
        return;
      }
      const err = this.extractErrorDetails(error);
      logger.error({ roomName, ...err }, 'Failed to create LiveKit room');
      throw error;
    }
  }

  async endRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      logger.info({ roomName }, 'LiveKit room ended');
    } catch (error) {
      const err = this.extractErrorDetails(error);
      logger.error({ roomName, ...err }, 'Failed to end LiveKit room');
    }
  }

  async muteParticipant(roomName: string, identity: string): Promise<void> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      const participant = participants.find(p => p.identity === identity);
      
      if (participant) {
        const track = participant.tracks?.[0];
        if (track) {
          await this.roomService.mutePublishedTrack(roomName, identity, track as any, true);
        }
      }
      logger.info({ roomName, identity }, 'Participant muted');
    } catch (error) {
      const err = this.extractErrorDetails(error);
      logger.error({ roomName, identity, ...err }, 'Failed to mute participant');
    }
  }

  async unmuteParticipant(roomName: string, identity: string): Promise<void> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      const participant = participants.find(p => p.identity === identity);
      
      if (participant) {
        const track = participant.tracks?.[0];
        if (track) {
          await this.roomService.mutePublishedTrack(roomName, identity, track as any, false);
        }
      }
      logger.info({ roomName, identity }, 'Participant unmuted');
    } catch (error) {
      const err = this.extractErrorDetails(error);
      logger.error({ roomName, identity, ...err }, 'Failed to unmute participant');
    }
  }

  async getParticipants(roomName: string): Promise<string[]> {
    try {
      const room = await this.roomService.listParticipants(roomName);
      return room.map((p) => p.identity);
    } catch (error) {
      const err = this.extractErrorDetails(error);
      logger.error({ roomName, ...err }, 'Failed to get participants');
      return [];
    }
  }

  isConfigured(): boolean {
    const url = config.livekit.url?.trim() || '';
    const apiKey = config.livekit.apiKey?.trim() || '';
    const apiSecret = config.livekit.apiSecret?.trim() || '';

    if (!url || !apiKey || !apiSecret) {
      return false;
    }

    if (
      isLikelyPlaceholder(url) ||
      isLikelyPlaceholder(apiKey) ||
      isLikelyPlaceholder(apiSecret)
    ) {
      return false;
    }

    return true;
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybeAxios = error as {
        message?: string;
        response?: { data?: unknown; status?: number };
      };

      const data = maybeAxios.response?.data;
      if (typeof data === 'string' && data.trim() !== '') {
        return data.trim();
      }

      if (
        data &&
        typeof data === 'object' &&
        'message' in data &&
        typeof (data as { message?: unknown }).message === 'string'
      ) {
        return ((data as { message: string }).message).trim();
      }

      if (maybeAxios.message) {
        return maybeAxios.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown LiveKit error';
  }

  private extractErrorDetails(error: unknown): {
    message: string;
    status?: number;
    code?: string;
  } {
    const message = this.extractErrorMessage(error);

    if (error && typeof error === 'object') {
      const maybeAxios = error as {
        code?: string;
        response?: { status?: number };
      };

      return {
        message,
        status: maybeAxios.response?.status,
        code: maybeAxios.code,
      };
    }

    return { message };
  }

  async verifyConnection(timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'LiveKit is not configured' };
    }

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`LiveKit verification timeout (${timeoutMs}ms)`)), timeoutMs);
      });

      await Promise.race([
        this.roomService.listRooms(),
        timeout,
      ]);

      return { ok: true };
    } catch (error) {
      const details = this.extractErrorDetails(error);
      logger.error(details, 'LiveKit connectivity verification failed');
      return { ok: false, error: details.message };
    }
  }
}

export const livekitService = new LiveKitService();
export default livekitService;
