'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { Crown, DoorOpen, Hand, Mic, MicOff, Shield, UserRoundX, UserRoundPlus, Volume2 } from 'lucide-react';
import { MobileShell } from '@/components/layout/mobile-shell';
import { Button, Card, Input } from '@/components/common/ui';
import { useAuthStore } from '@/lib/stores/auth-store';
import { createMicSocket, createRoomSocket } from '@/lib/realtime/socket';
import { createLiveRoomConnection, type LiveRoomConnection } from '@/lib/realtime/livekit';
import {
  acceptSpeakInvite,
  closeRoom,
  getMicQueue,
  acceptMicRequest,
  cancelMicRequest,
  declineSpeakInvite,
  flattenParticipants,
  getRoomById,
  getPendingSpeakInvite,
  getRoomParticipants,
  getRoomMediaToken,
  inviteToSpeak,
  inviteToPrivateRoom,
  joinRoom,
  leaveRoom,
  requestMic,
  rejectMicRequest,
  updateRoom,
} from '@/lib/api/rooms-api';
import {
  addModerator,
  demoteUser,
  kickUser,
  muteUser,
  promoteUser,
  removeModerator,
  reportTarget,
  unmuteUser,
} from '@/lib/api/moderation-api';
import type {
  MicRequestItem,
  RoomParticipant,
  RoomParticipantsResponse,
  UserRole,
} from '@/lib/api/types';

type ReportCategory = 'harassment' | 'hate_speech' | 'spam' | 'other';

function getParticipantLabel(participant: RoomParticipant): string {
  return participant.display_name || participant.username || `user-${participant.user_id}`;
}

function normalizeRoomId(value: string | string[] | undefined): string {
  if (!value) {
    return '';
  }
  return Array.isArray(value) ? value[0] : value;
}

function roleLabel(role: UserRole): string {
  if (role === 'owner_moderator') {
    return 'Owner';
  }
  if (role === 'moderator') {
    return 'Moderator';
  }
  if (role === 'speaker') {
    return 'Speaker';
  }
  return 'Listener';
}

function regroupParticipants(participants: RoomParticipant[]): RoomParticipantsResponse {
  const dedupedMap = new Map<number, RoomParticipant>();
  for (const participant of participants) {
    dedupedMap.set(participant.user_id, participant);
  }

  const deduped = Array.from(dedupedMap.values());
  const owner = deduped.find((item) => item.role === 'owner_moderator') || null;
  const moderators = deduped.filter((item) => item.role === 'moderator');
  const speakers = deduped.filter((item) => item.role === 'speaker');
  const listeners = deduped.filter((item) => item.role === 'listener');

  return { owner, moderators, speakers, listeners };
}

function upsertRoomParticipant(
  previous: RoomParticipantsResponse | null,
  participant: RoomParticipant
): RoomParticipantsResponse {
  const current = previous
    ? flattenParticipants(previous)
    : [];
  const others = current.filter((item) => item.user_id !== participant.user_id);
  others.push(participant);
  return regroupParticipants(others);
}

function removeRoomParticipant(
  previous: RoomParticipantsResponse | null,
  userId: number
): RoomParticipantsResponse {
  const current = previous ? flattenParticipants(previous) : [];
  return regroupParticipants(current.filter((item) => item.user_id !== userId));
}

function patchRoomParticipantMute(
  previous: RoomParticipantsResponse | null,
  userId: number,
  isMuted: boolean
): RoomParticipantsResponse {
  const current = previous ? flattenParticipants(previous) : [];
  return regroupParticipants(
    current.map((item) => (item.user_id === userId ? { ...item, is_muted: isMuted } : item))
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = normalizeRoomId(params?.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const me = useAuthStore((state) => state.user);

  const roomSocketRef = useRef<Socket | null>(null);
  const micSocketRef = useRef<Socket | null>(null);
  const livekitRef = useRef<LiveRoomConnection | null>(null);
  const leavingRef = useRef(false);
  const joiningRef = useRef(false);
  const joinedRef = useRef(false);

  const [isJoined, setIsJoined] = useState(false);
  const [participantsState, setParticipantsState] = useState<RoomParticipantsResponse | null>(null);
  const [myRole, setMyRole] = useState<UserRole>('listener');
  const [isMuted, setIsMuted] = useState(true);
  const [micQueue, setMicQueue] = useState<MicRequestItem[]>([]);
  const [micRequested, setMicRequested] = useState(false);
  const [micCooldownEnd, setMicCooldownEnd] = useState<number | null>(null);
  const [graceEndsAt, setGraceEndsAt] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('');
  const [joinError, setJoinError] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState<ReportCategory>('other');
  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [roomDescriptionInput, setRoomDescriptionInput] = useState('');
  const [roomMaxSpeakersInput, setRoomMaxSpeakersInput] = useState('6');
  const [inviteUserIdInput, setInviteUserIdInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setParticipantsState(null);
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoomById(roomId),
    enabled: Boolean(roomId),
    staleTime: 20_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const participantsQuery = useQuery({
    queryKey: ['room', roomId, 'participants'],
    queryFn: () => getRoomParticipants(roomId),
    enabled: Boolean(roomId) && Boolean(accessToken),
    staleTime: 30_000,
    refetchInterval: isJoined ? 5_000 : false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (participantsQuery.data) {
      setParticipantsState(participantsQuery.data);
    }
  }, [participantsQuery.data]);

  useEffect(() => {
    if (!roomQuery.data) {
      return;
    }
    setRoomTitleInput(roomQuery.data.title || '');
    setRoomDescriptionInput(roomQuery.data.description || '');
    const maxSpeakers = roomQuery.data.maxSpeakers ?? roomQuery.data.max_speakers ?? 6;
    setRoomMaxSpeakersInput(String(maxSpeakers));
  }, [roomQuery.data]);

  const participants = useMemo(() => {
    if (!participantsState) {
      return [] as RoomParticipant[];
    }
    return flattenParticipants(participantsState);
  }, [participantsState]);

  const participantsById = useMemo(() => {
    const map = new Map<number, RoomParticipant>();
    for (const participant of participants) {
      map.set(participant.user_id, participant);
    }
    return map;
  }, [participants]);

  const roomCreatorId = Number(roomQuery.data?.createdBy?.id || 0);
  const isRoomCreator = roomCreatorId > 0 && roomCreatorId === Number(me?.id || 0);

  const fallbackOwnerParticipant = useMemo<RoomParticipant | null>(() => {
    if (!isRoomCreator || !me) {
      return null;
    }

    return {
      user_id: Number(me.id),
      role: 'owner_moderator',
      is_muted: false,
      username: me.username,
      display_name: me.displayName || me.display_name || me.username,
      avatar_url: me.avatarUrl || me.avatar_url || null,
    };
  }, [isRoomCreator, me]);

  const stageParticipants = useMemo(() => {
    if (!participantsState) {
      return fallbackOwnerParticipant ? [fallbackOwnerParticipant] : [];
    }
    const owner = participantsState.owner ? [participantsState.owner] : [];
    const merged = [...owner, ...participantsState.moderators, ...participantsState.speakers];
    if (merged.length === 0 && fallbackOwnerParticipant) {
      return [fallbackOwnerParticipant];
    }
    return merged;
  }, [fallbackOwnerParticipant, participantsState]);

  const listenerParticipants = participantsState?.listeners || [];
  const meParticipant = participantsById.get(Number(me?.id || 0));
  const meParticipantRole = meParticipant?.role;
  const effectiveRole: UserRole = meParticipant?.role || (isRoomCreator ? 'owner_moderator' : myRole);
  const isOwner = effectiveRole === 'owner_moderator';
  const isModerator = effectiveRole === 'owner_moderator' || effectiveRole === 'moderator';
  const canSpeak = effectiveRole === 'owner_moderator' || effectiveRole === 'moderator' || effectiveRole === 'speaker';

  const micCooldownSeconds = micCooldownEnd ? Math.max(0, Math.ceil((micCooldownEnd - now) / 1000)) : 0;
  const graceSeconds = graceEndsAt ? Math.max(0, Math.ceil((graceEndsAt - now) / 1000)) : 0;

  const reportRoomMutation = useMutation({
    mutationFn: () => reportTarget({ targetType: 'room', roomId, category: reportCategory, description: reportDescription || undefined }),
    onSuccess: () => {
      setStatusText('Room report submitted.');
      setReportDescription('');
      setReportCategory('other');
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Failed to report room.');
    },
  });

  const closeRoomMutation = useMutation({
    mutationFn: () => closeRoom(roomId),
    onSuccess: async () => {
      setStatusText('Room closed.');
      roomSocketRef.current?.disconnect();
      micSocketRef.current?.disconnect();
      await livekitRef.current?.disconnect();
      router.replace('/hall');
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Room close failed.');
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: () => {
      const maxSpeakers = Math.max(2, Math.min(10, Number(roomMaxSpeakersInput) || 6));
      const currentMicRequests = roomQuery.data?.micRequestsEnabled ?? roomQuery.data?.mic_requests_enabled ?? true;
      return updateRoom(roomId, {
        title: roomTitleInput || undefined,
        description: roomDescriptionInput || undefined,
        maxSpeakers,
        micRequestsEnabled: currentMicRequests,
      });
    },
    onSuccess: () => {
      setStatusText('Room settings updated.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Room update failed.');
    },
  });

  const toggleMicRequestsMutation = useMutation({
    mutationFn: () => {
      const current = roomQuery.data?.micRequestsEnabled ?? roomQuery.data?.mic_requests_enabled ?? true;
      return updateRoom(roomId, { micRequestsEnabled: !current });
    },
    onSuccess: () => {
      setStatusText('Mic request setting updated.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Could not toggle mic requests.');
    },
  });

  const invitePrivateMutation = useMutation({
    mutationFn: () => inviteToPrivateRoom(roomId, inviteUserIdInput.trim()),
    onSuccess: () => {
      setStatusText('Private room invite sent.');
      setInviteUserIdInput('');
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Private invite failed.');
    },
  });

  const acceptSpeakInviteMutation = useMutation({
    mutationFn: () => acceptSpeakInvite(roomId),
    onSuccess: (result) => {
      setStatusText(result.message || 'Speak invite handled.');
      void syncParticipants();
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'speak-invite-pending'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'No pending invite.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'speak-invite-pending'] });
    },
  });

  const declineSpeakInviteMutation = useMutation({
    mutationFn: () => declineSpeakInvite(roomId),
    onSuccess: (result) => {
      setStatusText(result.message || 'Speak invite handled.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'speak-invite-pending'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'No pending invite.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'speak-invite-pending'] });
    },
  });

  const requestMicMutation = useMutation({
    mutationFn: () => requestMic(roomId),
    onSuccess: (result) => {
      setMicRequested(true);
      setMicQueue(result.queue || []);
      setStatusText('Mic request queued.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'mic-queue'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Failed to request mic.');
    },
  });

  const cancelMicMutation = useMutation({
    mutationFn: () => cancelMicRequest(roomId),
    onSuccess: (result) => {
      setMicRequested(false);
      setMicQueue(result.queue || []);
      setStatusText('Mic request cancelled.');
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'mic-queue'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Failed to cancel mic request.');
    },
  });

  const acceptMicRequestMutation = useMutation({
    mutationFn: (requestId: string) => acceptMicRequest(roomId, requestId),
    onSuccess: (result) => {
      setMicQueue(result.queue || []);
      setStatusText('Request accepted.');
      void syncParticipants();
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'mic-queue'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Failed to accept request.');
    },
  });

  const rejectMicRequestMutation = useMutation({
    mutationFn: (requestId: string) => rejectMicRequest(roomId, requestId),
    onSuccess: (result) => {
      setMicQueue(result.queue || []);
      setStatusText('Request rejected.');
      void syncParticipants();
      void queryClient.invalidateQueries({ queryKey: ['room', roomId, 'mic-queue'] });
    },
    onError: (error) => {
      setStatusText(error instanceof Error ? error.message : 'Failed to reject request.');
    },
  });

  const syncParticipants = useCallback(async () => {
    if (!roomId) {
      return;
    }

    try {
      const participants = await queryClient.fetchQuery({
        queryKey: ['room', roomId, 'participants'],
        queryFn: () => getRoomParticipants(roomId),
        staleTime: 0,
      });
      setParticipantsState(participants);
    } catch {
      // keep current local participant state if sync fails
    }
  }, [queryClient, roomId]);

  const reconnectLivekitForCurrentRole = useCallback(async (preferredRole?: UserRole) => {
    if (!roomId) {
      return;
    }

    try {
      const media = await getRoomMediaToken(roomId);
      const resolvedRole = media.role || preferredRole || 'listener';
      const token = media.token;

      setMyRole(resolvedRole);
      setIsMuted(true);

      if (!token) {
        setStatusText('Media token unavailable.');
        return;
      }

      if (livekitRef.current) {
        await livekitRef.current.disconnect();
      }

      const livekit = createLiveRoomConnection();
      livekitRef.current = livekit;
      await livekit.connect(token);

      if (resolvedRole !== 'listener') {
        await livekit.setMicrophoneEnabled(false);
      }

      console.info('[livekit] reconnect complete', { roomId, role: resolvedRole });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh media session.';
      console.error('[livekit] reconnect error', error);
      setStatusText(message);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !accessToken) {
      return;
    }

    const timer = window.setInterval(() => {
      void syncParticipants();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [accessToken, roomId, syncParticipants]);

  useEffect(() => {
    if (!isJoined || !meParticipantRole) {
      return;
    }

    if (meParticipantRole === myRole) {
      return;
    }

    setMyRole(meParticipantRole);
    setIsMuted(true);
    void reconnectLivekitForCurrentRole(meParticipantRole);
  }, [isJoined, meParticipantRole, myRole, reconnectLivekitForCurrentRole]);

  const leaveCurrentRoom = useCallback(async (redirectToHall: boolean, explicitLeave = false) => {
    if (!roomId || leavingRef.current) {
      return;
    }
    leavingRef.current = true;

    try {
      if (explicitLeave) {
        roomSocketRef.current?.emit('room:leave');
        await leaveRoom(roomId);
      }
      roomSocketRef.current?.disconnect();
      roomSocketRef.current = null;
      micSocketRef.current?.disconnect();
      micSocketRef.current = null;
      await livekitRef.current?.disconnect();
      livekitRef.current = null;
      joiningRef.current = false;
      joinedRef.current = false;
      setIsJoined(false);
      setParticipantsState(null);
      setSelectedParticipantId(null);
      setMyRole('listener');
      setIsMuted(true);
      await queryClient.cancelQueries({ queryKey: ['room', roomId, 'participants'] });
      queryClient.removeQueries({ queryKey: ['room', roomId, 'participants'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave room.';
      setStatusText(message);
    } finally {
      leavingRef.current = false;
      if (redirectToHall) {
        router.replace('/hall');
      }
    }
  }, [queryClient, roomId, router]);

  type RoomJoinedSocketPayload = {
    roomId: string;
    role: UserRole;
    isMuted: boolean;
    counts?: { speakerCount: number; listenerCount: number };
    serverTs?: number;
  };

  type RoomSyncStatePayload = {
    roomId: string;
    participants: RoomParticipantsResponse;
    counts?: { speakerCount: number; listenerCount: number };
    serverTs?: number;
  };

  type UserJoinedPayload = {
    roomId: string;
    participant?: RoomParticipant;
    counts?: { speakerCount: number; listenerCount: number };
    serverTs?: number;
  };

  type UserLeftPayload = {
    roomId: string;
    userId: string;
    reason: 'left' | 'disconnected';
    counts?: { speakerCount: number; listenerCount: number };
    serverTs?: number;
  };

  type UserMuteChangedPayload = {
    roomId: string;
    userId: string;
    isMuted: boolean;
    serverTs?: number;
  };

  type RoomRoleChangedPayload = {
    roomId: string;
    userId: string;
    role: UserRole;
    serverTs?: number;
  };

  type MicRequestHandledPayload = {
    roomId: string;
    requestId: string;
    action: 'accepted' | 'rejected';
    targetUserId?: string;
  };

  type MicRequestResultPayload = {
    roomId: string;
    requestId: string;
    action: 'accepted' | 'rejected';
  };

  type RoomMicQueuePayload = {
    roomId: string;
    queue: MicRequestItem[];
  };

  useEffect(() => {
    const sessionToken = useAuthStore.getState().accessToken;
    if (!roomId || !sessionToken) {
      return;
    }
    if (joinedRef.current || joiningRef.current) {
      return;
    }

    let active = true;

    const setupRealtime = async () => {
      joiningRef.current = true;
      try {
        setJoinError('');
        const joined = await joinRoom(roomId);
        if (!active) {
          return;
        }

        setMyRole(joined.role);
        setIsJoined(true);
        joinedRef.current = true;
        setStatusText('Connected to room.');
        void syncParticipants();

        const socketToken = useAuthStore.getState().accessToken || sessionToken;
        const roomSocket = createRoomSocket(socketToken);
        roomSocketRef.current = roomSocket;

        const emitRoomJoin = () => {
          roomSocket.emit('room:join', { roomId });
        };

        roomSocket.on('connect', emitRoomJoin);
        if (roomSocket.connected) {
          emitRoomJoin();
        }

        roomSocket.on('connect_error', (error) => {
          console.error('[room-socket] connect_error', error);
          const message = error?.message || 'Room realtime connection failed.';
          setJoinError(message);
          setStatusText(message);
        });

        roomSocket.on('room:joined', (payload: RoomJoinedSocketPayload) => {
          setMyRole(payload.role);
          setIsMuted(payload.isMuted);
        });

        roomSocket.on('room:sync_state', (payload: RoomSyncStatePayload) => {
          setParticipantsState(payload.participants);
        });

        roomSocket.on('user:joined', (payload: UserJoinedPayload) => {
          if (payload?.participant) {
            setParticipantsState((previous) => upsertRoomParticipant(previous, payload.participant!));
            return;
          }

          void syncParticipants();
        });

        roomSocket.on('user:left', (payload: UserLeftPayload) => {
          const userId = Number(payload?.userId);
          if (!Number.isNaN(userId)) {
            setParticipantsState((previous) => removeRoomParticipant(previous, userId));
            return;
          }

          void syncParticipants();
        });

        roomSocket.on('user:mute_changed', (payload: UserMuteChangedPayload) => {
          const userId = Number(payload?.userId);
          if (!Number.isNaN(userId)) {
            setParticipantsState((previous) =>
              patchRoomParticipantMute(previous, userId, Boolean(payload?.isMuted))
            );
          }
        });

        roomSocket.on('room:role_changed', (payload: RoomRoleChangedPayload) => {
          const changedUserId = Number(payload?.userId);
          if (Number.isNaN(changedUserId)) {
            return;
          }

          const currentUserId = Number(useAuthStore.getState().user?.id || 0);
          if (changedUserId === currentUserId) {
            setMyRole(payload.role);
            setIsMuted(true);
            void reconnectLivekitForCurrentRole(payload.role);
          }

          void syncParticipants();
        });

        roomSocket.on('room:mic_queue_updated', (payload: RoomMicQueuePayload) => {
          setMicQueue(payload.queue || []);
        });

        roomSocket.on('room:grace_period', (payload: { endsAt: number }) => {
          setGraceEndsAt(payload.endsAt);
          setStatusText('Owner disconnected. Grace period started.');
        });

        roomSocket.on('room:owner_returned', () => {
          setGraceEndsAt(null);
          setStatusText('Owner returned.');
        });

        roomSocket.on('room:error', (payload: { message: string }) => {
          console.error('[room-socket] room:error', payload);
          setStatusText(payload.message);
        });

        const micSocket = createMicSocket(socketToken);
        micSocketRef.current = micSocket;

        const emitMicJoin = () => {
          micSocket.emit('mic:join_room', { roomId });
          micSocket.emit('mic:get_queue', { roomId });
          micSocket.emit('mic:get_cooldown', { roomId });
        };

        micSocket.on('connect', emitMicJoin);
        if (micSocket.connected) {
          emitMicJoin();
        }

        micSocket.on('connect_error', (error) => {
          console.error('[mic-socket] connect_error', error);
          setStatusText(error?.message || 'Mic realtime connection failed.');
        });

        micSocket.on('mic:queue', (payload: { queue: MicRequestItem[] }) => {
          setMicQueue(payload.queue || []);
        });

        micSocket.on('mic:queue_updated', (payload: { queue: MicRequestItem[] }) => {
          setMicQueue(payload.queue || []);
        });

        micSocket.on('mic:request_queued', (payload: { queue: MicRequestItem[] }) => {
          setMicRequested(true);
          setMicQueue(payload.queue || []);
          setStatusText('Mic request queued.');
        });

        micSocket.on('mic:cancelled', () => {
          setMicRequested(false);
          setStatusText('Mic request cancelled.');
        });

        micSocket.on('mic:request_handled', (payload: MicRequestHandledPayload) => {
          setStatusText(payload.action === 'accepted' ? 'Request accepted.' : 'Request rejected.');
          void syncParticipants();
          micSocket.emit('mic:get_queue', { roomId });
        });

        micSocket.on('mic:request_result', (payload: MicRequestResultPayload) => {
          setMicRequested(false);
          setStatusText(payload.action === 'accepted' ? 'Request accepted.' : 'Request rejected.');

          if (payload.action === 'accepted') {
            void reconnectLivekitForCurrentRole('speaker');
          } else {
            micSocket.emit('mic:get_cooldown', { roomId });
          }

          void syncParticipants();
        });

        micSocket.on('mic:cooldown', (payload: { cooldownEndTime: number | null }) => {
          setMicCooldownEnd(payload.cooldownEndTime);
        });

        micSocket.on('mic:error', (payload: { message: string }) => {
          console.error('[mic-socket] mic:error', payload);
          setStatusText(payload.message);
        });

        if (joined.token) {
          const livekit = createLiveRoomConnection();
          livekitRef.current = livekit;
          await livekit.connect(joined.token);
          if (joined.role !== 'listener') {
            await livekit.setMicrophoneEnabled(false);
          }
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not join room.';
        setJoinError(message);
      } finally {
        joiningRef.current = false;
      }
    };

    void setupRealtime();

    return () => {
      active = false;
      void leaveCurrentRoom(false, false);
    };
  }, [leaveCurrentRoom, reconnectLivekitForCurrentRole, roomId, syncParticipants]);

  const toggleMic = async () => {
    if (!canSpeak) {
      return;
    }

    const previousMuted = isMuted;
    const nextMuted = !isMuted;

    try {
      if (!nextMuted) {
        const media = await getRoomMediaToken(roomId);
        if (media.role === 'listener') {
          throw new Error('You are still listener. Ask for speaker permission first.');
        }
      }

      if (!livekitRef.current) {
        await reconnectLivekitForCurrentRole(effectiveRole);
      }

      if (!livekitRef.current) {
        throw new Error('Media connection is not ready.');
      }

      await livekitRef.current.startAudio();
      await livekitRef.current.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      roomSocketRef.current?.emit('mic:toggle', { roomId, muted: nextMuted });
    } catch (error) {
      setIsMuted(previousMuted);
      setStatusText(error instanceof Error ? error.message : 'Failed to update microphone state.');
    }
  };

  const handleQueueRequest = () => {
    requestMicMutation.mutate();
  };

  const handleQueueCancel = () => {
    cancelMicMutation.mutate();
  };

  const handleQueueAccept = (requestId: string) => {
    const micSocket = micSocketRef.current;
    if (micSocket) {
      micSocket.emit('mic:accept', { roomId, requestId });
      return;
    }
    acceptMicRequestMutation.mutate(requestId);
  };

  const handleQueueReject = (requestId: string) => {
    const micSocket = micSocketRef.current;
    if (micSocket) {
      micSocket.emit('mic:reject', { roomId, requestId });
      return;
    }
    rejectMicRequestMutation.mutate(requestId);
  };

  const runParticipantAction = async (
    label: string,
    operation: () => Promise<unknown>
  ) => {
    setStatusText('');
    try {
      await operation();
      setStatusText(label);
      void syncParticipants();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Action failed.');
    }
  };

  const pendingInviteQuery = useQuery({
    queryKey: ['room', roomId, 'speak-invite-pending'],
    queryFn: () => getPendingSpeakInvite(roomId),
    enabled: Boolean(roomId) && isJoined,
    staleTime: 3_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });

  const micQueueQuery = useQuery({
    queryKey: ['room', roomId, 'mic-queue'],
    queryFn: () => getMicQueue(roomId),
    enabled: Boolean(roomId) && Boolean(accessToken) && isModerator,
    staleTime: 1_000,
    refetchInterval: 2_000,
    refetchOnWindowFocus: true,
    retry: 0,
  });

  useEffect(() => {
    if (micQueueQuery.data?.queue) {
      setMicQueue(micQueueQuery.data.queue);
    }
  }, [micQueueQuery.data]);

  if (!roomId) {
    return (
      <MobileShell title="Oda">
        <Card>Invalid room id.</Card>
      </MobileShell>
    );
  }

  const micRequestsEnabled = roomQuery.data?.micRequestsEnabled ?? roomQuery.data?.mic_requests_enabled ?? true;

  return (
    <MobileShell
      title="Oda Ic Gorunumu"
      rightAction={
        <button
          type="button"
          className="rounded-full border border-border bg-muted p-2"
          onClick={() => void leaveCurrentRoom(true, true)}
        >
          <DoorOpen className="h-4 w-4" />
        </button>
      }
    >
      <Card className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{roomQuery.data?.title || `Room #${roomId}`}</h2>
          <span className="rounded-full bg-muted px-2 py-1 text-[11px]">
            {(roomQuery.data?.status || 'live').toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-text/70">
          {(roomQuery.data?.category || 'General')} | {(roomQuery.data?.language || 'tr').toUpperCase()} | Role: {roleLabel(effectiveRole)}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-text/70">
          <span>Speakers: {stageParticipants.length}</span>
          <span>Audience: {listenerParticipants.length}</span>
        </div>
        {graceSeconds > 0 ? (
          <p className="text-xs text-amber-700">Grace period active: {graceSeconds}s</p>
        ) : null}
        {joinError ? <p className="text-xs text-red-600">{joinError}</p> : null}
        {statusText ? <p className="text-xs text-text/70">{statusText}</p> : null}
      </Card>

      <Card>
        <Button type="button" className="flex items-center justify-center gap-2" onClick={() => void leaveCurrentRoom(true, true)}>
          <DoorOpen className="h-4 w-4" />
          Odadan Ayril
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Top Speaker</h3>
        <div className="grid grid-cols-4 gap-3">
          {stageParticipants.slice(0, 8).map((participant) => (
            <button
              type="button"
              key={`stage-${participant.user_id}`}
              className="space-y-1 text-center"
              onClick={() => setSelectedParticipantId((prev) => (prev === participant.user_id ? null : participant.user_id))}
            >
              <div className="relative mx-auto h-14 w-14 rounded-full border border-border bg-muted" />
              <p className="truncate text-[11px]">{getParticipantLabel(participant)}</p>
              <p className="text-[10px] text-text/55">{roleLabel(participant.role)}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Audience</h3>
        <div className="grid grid-cols-5 gap-2">
          {listenerParticipants.slice(0, 20).map((participant) => (
            <button
              type="button"
              key={`listener-${participant.user_id}`}
              className="space-y-1 text-center"
              onClick={() => setSelectedParticipantId((prev) => (prev === participant.user_id ? null : participant.user_id))}
            >
              <div className="mx-auto h-11 w-11 rounded-full border border-border bg-muted" />
              <p className="truncate text-[10px]">{getParticipantLabel(participant)}</p>
            </button>
          ))}
        </div>
      </Card>

      {selectedParticipantId ? (
        <Card className="space-y-2">
          {(() => {
            const target = participantsById.get(selectedParticipantId);
            if (!target) {
              return <p className="text-xs text-text/70">Participant not found.</p>;
            }
            const isSelf = Number(me?.id || 0) === target.user_id;
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{getParticipantLabel(target)}</p>
                    <p className="text-xs text-text/65">@{target.username} | {roleLabel(target.role)}</p>
                  </div>
                  <Button
                    type="button"
                    className="w-auto px-3 py-2 text-xs"
                    onClick={() => void runParticipantAction('User reported.', () => reportTarget({
                      targetType: 'user',
                      targetId: String(target.user_id),
                      category: 'other',
                    }))}
                  >
                    Report
                  </Button>
                </div>
                {!isSelf && isModerator ? (
                  <div className="grid grid-cols-2 gap-2">
                    {target.role === 'listener' ? (
                      <>
                        <Button
                          type="button"
                          className="flex items-center justify-center gap-1 py-2 text-xs"
                          onClick={() => void runParticipantAction(
                            'Invite sent.',
                            () => inviteToSpeak(roomId, String(target.user_id))
                          )}
                        >
                          <UserRoundPlus className="h-3.5 w-3.5" />
                          Invite
                        </Button>
                        <Button
                          type="button"
                          className="flex items-center justify-center gap-1 py-2 text-xs"
                          onClick={() => void runParticipantAction(
                            'Promoted to speaker.',
                            () => promoteUser(roomId, String(target.user_id))
                          )}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          Promote
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        className="flex items-center justify-center gap-1 py-2 text-xs"
                        onClick={() => void runParticipantAction(
                          'Demoted to listener.',
                          () => demoteUser(roomId, String(target.user_id))
                        )}
                      >
                        <UserRoundX className="h-3.5 w-3.5" />
                        Demote
                      </Button>
                    )}

                    {target.is_muted ? (
                      <Button
                        type="button"
                        className="flex items-center justify-center gap-1 py-2 text-xs"
                        onClick={() => void runParticipantAction(
                          'User unmuted.',
                          () => unmuteUser(roomId, String(target.user_id))
                        )}
                      >
                        <Mic className="h-3.5 w-3.5" />
                        Unmute
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="flex items-center justify-center gap-1 py-2 text-xs"
                        onClick={() => void runParticipantAction(
                          'User muted.',
                          () => muteUser(roomId, String(target.user_id))
                        )}
                      >
                        <MicOff className="h-3.5 w-3.5" />
                        Mute
                      </Button>
                    )}

                    <Button
                      type="button"
                      className="flex items-center justify-center gap-1 py-2 text-xs"
                      onClick={() => void runParticipantAction(
                        'User removed from room.',
                        () => kickUser(roomId, String(target.user_id))
                      )}
                    >
                      <UserRoundX className="h-3.5 w-3.5" />
                      Kick
                    </Button>

                    {isOwner ? (
                      target.role === 'moderator' ? (
                        <Button
                          type="button"
                          className="flex items-center justify-center gap-1 py-2 text-xs"
                          onClick={() => void runParticipantAction(
                            'Moderator removed.',
                            () => removeModerator(roomId, String(target.user_id))
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Remove Mod
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="flex items-center justify-center gap-1 py-2 text-xs"
                          onClick={() => void runParticipantAction(
                            'User promoted to moderator.',
                            () => addModerator(roomId, String(target.user_id))
                          )}
                        >
                          <Crown className="h-3.5 w-3.5" />
                          Add Mod
                        </Button>
                      )
                    ) : null}
                  </div>
                ) : null}
              </>
            );
          })()}
        </Card>
      ) : null}

      {canSpeak ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Mic Control</h3>
          <Button
            type="button"
            className="flex items-center justify-center gap-2"
            onClick={() => void toggleMic()}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isMuted ? 'Unmute Me' : 'Mute Me'}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-2">
          <h3 className="font-semibold">Mic Request</h3>
          {!micRequestsEnabled ? (
            <p className="text-xs text-text/65">Mic requests are disabled by moderator.</p>
          ) : micRequested ? (
            <Button type="button" onClick={handleQueueCancel}>
              Cancel Request
            </Button>
          ) : micCooldownSeconds > 0 ? (
            <Button type="button" disabled>
              Cooldown {micCooldownSeconds}s
            </Button>
          ) : (
            <Button type="button" className="flex items-center justify-center gap-2" onClick={handleQueueRequest}>
              <Hand className="h-4 w-4" />
              Request Mic
            </Button>
          )}
          {pendingInviteQuery.data?.pending ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="py-2 text-xs"
                onClick={() => acceptSpeakInviteMutation.mutate()}
                disabled={acceptSpeakInviteMutation.isPending}
              >
                {acceptSpeakInviteMutation.isPending ? 'Accepting...' : 'Accept Invite'}
              </Button>
              <Button
                type="button"
                className="py-2 text-xs bg-muted"
                onClick={() => declineSpeakInviteMutation.mutate()}
                disabled={declineSpeakInviteMutation.isPending}
              >
                {declineSpeakInviteMutation.isPending ? 'Declining...' : 'Decline Invite'}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-text/65">No pending speak invite.</p>
          )}
        </Card>
      )}

      {isModerator ? (
        <Card className="space-y-3">
          <h3 className="font-semibold">Mic Queue ({micQueue.length})</h3>
          {micQueue.length === 0 ? <p className="text-xs text-text/65">Queue is empty.</p> : null}
          {micQueue.map((request) => {
            const userId = Number(request.userId);
            const participant = participantsById.get(userId);
            const label = participant ? getParticipantLabel(participant) : `User ${request.userId}`;
            return (
              <div key={request.id} className="rounded-2xl border border-border bg-base p-2">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[11px] text-text/60">Requested {new Date(request.timestamp).toLocaleTimeString('tr-TR')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button type="button" className="py-2 text-xs" onClick={() => handleQueueAccept(request.id)}>
                    Accept
                  </Button>
                  <Button type="button" className="py-2 text-xs bg-muted" onClick={() => handleQueueReject(request.id)}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h3 className="font-semibold">Trust & Safety</h3>
        <label className="text-xs text-text/65" htmlFor="report-category">Report category</label>
        <select
          id="report-category"
          className="w-full rounded-full border border-border bg-card px-4 py-3 text-sm outline-none focus:border-text/40 focus:ring-2 focus:ring-accent/50"
          value={reportCategory}
          onChange={(event) => setReportCategory(event.target.value as ReportCategory)}
        >
          <option value="harassment">Harassment</option>
          <option value="hate_speech">Hate speech</option>
          <option value="spam">Spam</option>
          <option value="other">Other</option>
        </select>
        <Input
          placeholder="Optional note for room report"
          value={reportDescription}
          onChange={(event) => setReportDescription(event.target.value)}
        />
        <Button
          type="button"
          onClick={() => reportRoomMutation.mutate()}
          disabled={reportRoomMutation.isPending}
        >
          {reportRoomMutation.isPending ? 'Submitting...' : 'Report Room'}
        </Button>
      </Card>

      {isOwner ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Room Settings</h3>
          <Input
            placeholder="Room title"
            value={roomTitleInput}
            onChange={(event) => setRoomTitleInput(event.target.value)}
          />
          <Input
            placeholder="Room description"
            value={roomDescriptionInput}
            onChange={(event) => setRoomDescriptionInput(event.target.value)}
          />
          <Input
            type="number"
            min={2}
            max={10}
            placeholder="Max speakers"
            value={roomMaxSpeakersInput}
            onChange={(event) => setRoomMaxSpeakersInput(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => updateRoomMutation.mutate()}
              disabled={updateRoomMutation.isPending}
            >
              {updateRoomMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              className="bg-muted"
              onClick={() => toggleMicRequestsMutation.mutate()}
              disabled={toggleMicRequestsMutation.isPending}
            >
              {toggleMicRequestsMutation.isPending
                ? 'Updating...'
                : micRequestsEnabled
                  ? 'Disable Mic Queue'
                  : 'Enable Mic Queue'}
            </Button>
          </div>
        </Card>
      ) : null}

      {isModerator && roomQuery.data?.visibility === 'private' ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Private Room Invite</h3>
          <Input
            placeholder="Target user id"
            value={inviteUserIdInput}
            onChange={(event) => setInviteUserIdInput(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => invitePrivateMutation.mutate()}
            disabled={invitePrivateMutation.isPending || !inviteUserIdInput.trim()}
          >
            {invitePrivateMutation.isPending ? 'Sending...' : 'Send Invite'}
          </Button>
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="space-y-2">
          <h3 className="font-semibold">Owner Actions</h3>
          <Button
            type="button"
            onClick={() => closeRoomMutation.mutate()}
            disabled={closeRoomMutation.isPending}
          >
            {closeRoomMutation.isPending ? 'Closing...' : 'Close Room'}
          </Button>
        </Card>
      ) : null}

      <Card className="text-xs text-text/70">
        <p>Room ID: {roomId}</p>
        <p>
          Need admin moderation views? <Link className="underline underline-offset-2" href="/admin/reports">Open report console</Link>
        </p>
      </Card>
    </MobileShell>
  );
}
