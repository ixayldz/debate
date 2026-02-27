# Debate Web

Next.js web client for the Debate backend.

## Setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
npm install
```

3. Start dev server:

```bash
npm run dev
```

## Required Environment

- `NEXT_PUBLIC_API_BASE_URL`: backend API base URL (example: `http://localhost:3000`)
- `NEXT_PUBLIC_LIVEKIT_URL`: LiveKit websocket URL used by `livekit-client`
- `NEXT_PUBLIC_SOCKET_ROOM_PATH`: Socket.IO namespace for room events (`/room`)
- `NEXT_PUBLIC_SOCKET_MIC_PATH`: Socket.IO namespace for mic queue events (`/mic`)

## Key Routes

- `/login`, `/register`, `/phone` for auth
- `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` for recovery/verification
- `/hall` for room feed
- `/room/[id]` for realtime room + moderation controls
- `/profile/me` and `/profile/[username]` for profile flows
- `/notifications` for user notification feed
- `/admin/reports` and `/admin/audit` for moderation administration

## Build Checks

```bash
npm run typecheck
npm run build
```
