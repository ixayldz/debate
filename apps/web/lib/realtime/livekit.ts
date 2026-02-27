'use client';

import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { LIVEKIT_URL } from '@/lib/api/config';

export interface LiveRoomConnection {
  room: Room;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startAudio: () => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
}

export function createLiveRoomConnection(onParticipantChanged?: () => void): LiveRoomConnection {
  const room = new Room();
  const audioElements = new Map<string, HTMLAudioElement>();
  let unlockAudioHandler: (() => void) | null = null;

  const removeAudioElement = (trackSid: string): void => {
    const element = audioElements.get(trackSid);
    if (!element) {
      return;
    }

    element.pause();
    element.srcObject = null;
    element.remove();
    audioElements.delete(trackSid);
  };

  const attachAudioTrack = (track: RemoteTrack, publication: RemoteTrackPublication): void => {
    if (track.kind !== Track.Kind.Audio) {
      return;
    }

    const trackSid = publication.trackSid || track.sid;
    if (!trackSid) {
      return;
    }

    removeAudioElement(trackSid);

    const mediaElement = track.attach();
    if (!(mediaElement instanceof HTMLAudioElement)) {
      return;
    }

    mediaElement.autoplay = true;
    mediaElement.style.position = 'fixed';
    mediaElement.style.width = '0';
    mediaElement.style.height = '0';
    mediaElement.style.opacity = '0';
    mediaElement.style.pointerEvents = 'none';
    mediaElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mediaElement);
    audioElements.set(trackSid, mediaElement);

    void mediaElement.play().catch(() => {
      // Playback may be blocked until first user gesture; startAudio handles this.
    });
  };

  const detachAudioTrack = (track: RemoteTrack, publication: RemoteTrackPublication): void => {
    if (track.kind !== Track.Kind.Audio) {
      return;
    }

    const trackSid = publication.trackSid || track.sid;
    if (!trackSid) {
      return;
    }

    track.detach();
    removeAudioElement(trackSid);
  };

  if (onParticipantChanged) {
    room.on(RoomEvent.ParticipantConnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChanged);
    room.on(RoomEvent.TrackSubscribed, onParticipantChanged);
    room.on(RoomEvent.TrackUnsubscribed, onParticipantChanged);
  }

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
    attachAudioTrack(track, publication);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication) => {
    detachAudioTrack(track, publication);
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    participant.trackPublications.forEach((publication) => {
      if (publication.track && publication.track.kind === Track.Kind.Audio) {
        const trackSid = publication.trackSid || publication.track.sid;
        if (trackSid) {
          removeAudioElement(trackSid);
        }
      }
    });
  });

  return {
    room,
    connect: async (token: string) => {
      if (!LIVEKIT_URL) {
        throw new Error('NEXT_PUBLIC_LIVEKIT_URL is required for media connection');
      }
      await room.connect(LIVEKIT_URL, token, {
        autoSubscribe: true,
      });

      if (typeof window !== 'undefined') {
        unlockAudioHandler = () => {
          void room.startAudio().catch(() => undefined);
        };
        window.addEventListener('pointerdown', unlockAudioHandler, { once: true });
      }

      // Attempt immediate resume for browsers that already allow autoplay.
      await room.startAudio().catch(() => undefined);
    },
    disconnect: async () => {
      if (typeof window !== 'undefined' && unlockAudioHandler) {
        window.removeEventListener('pointerdown', unlockAudioHandler);
        unlockAudioHandler = null;
      }

      for (const element of audioElements.values()) {
        element.pause();
        element.srcObject = null;
        element.remove();
      }
      audioElements.clear();

      room.disconnect();
    },
    startAudio: async () => {
      await room.startAudio().catch(() => undefined);
    },
    setMicrophoneEnabled: async (enabled: boolean) => {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
  };
}

export function toParticipantCard(
  participant: Participant | RemoteParticipant,
  publication?: RemoteTrackPublication
): {
  id: string;
  name: string;
  speaking: boolean;
  muted: boolean;
} {
  return {
    id: participant.identity,
    name: participant.name || participant.identity,
    speaking: participant.isSpeaking,
    muted: publication?.isMuted || false,
  };
}
