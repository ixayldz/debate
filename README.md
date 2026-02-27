# Debate

Production-focused real-time social audio platform with moderated rooms, role-based permissions, mic queue, handover/grace-period logic, and full web + API integration.

## Overview

Debate is built around three core goals:
1. Structured conversation in live voice rooms
2. Trust and moderation as first-class features
3. Reliable real-time infrastructure for production use

The repository contains:
- Backend API (`Express + TypeScript + PostgreSQL + Redis + Socket.IO + LiveKit`)
- Web frontend (`Next.js + React + Zustand + React Query + LiveKit client`)

## Key Features

- Multi-auth: Email/Password, Phone OTP, Google OAuth, X (Twitter) OAuth
- Secure session model: short-lived access token + HttpOnly refresh cookie rotation
- Room lifecycle: create, join, leave, close, private invites
- Role system: `owner_moderator`, `moderator`, `speaker`, `listener`
- Mic queue: request/cancel/accept/reject with cooldown controls
- Owner handover: grace period + deterministic successor selection
- Moderation: mute/unmute, kick, promote/demote, add/remove moderator
- Trust & Safety: user/room reports + admin report resolution + audit logs
- Ops endpoints: `/live`, `/ready`, `/health`, `/metrics`, Swagger docs

## Repository Structure

```text
src/                    # Backend runtime code
  app.ts                # Main server entrypoint
  modules/              # auth, user, room, moderation, mic-request
  config/               # db, redis, livekit, metrics, migrations, logger
  middleware/           # cors/security/request context/rate limits
  common/               # guards, filters, utilities
  docs/                 # OpenAPI + Swagger setup

apps/web/               # Next.js frontend
tests/                  # Backend unit tests
scripts/                # smoke + preflight scripts
```

## Prerequisites

- Node.js `>=20`
- PostgreSQL `>=16`
- Redis `>=7`
- LiveKit Cloud/Self-hosted credentials
- (Optional) Twilio SMS + SMTP provider

## Environment Setup

1. Copy and edit environment variables:
   - `cp .env.example .env` (Windows: duplicate manually)
2. Fill real credentials for:
   - `DATABASE_URL`, `REDIS_*`
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - `GOOGLE_*`, `TWITTER_*` (if OAuth enabled)
   - `TWILIO_*` (if phone OTP enabled)
   - `EMAIL_*` (if email verification/reset enabled)

Never commit `.env` or secrets.

## Local Development

### Backend

```bash
npm install
npm run dev
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Default URLs:
- API: `http://localhost:3000`
- Web: `http://localhost:5173` (or Next dev port configured in web app)
- Swagger: `http://localhost:3000/api-docs`

## Quality Gates

Backend:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run preflight:prod
npm run build
```

Frontend:

```bash
cd apps/web
npm run lint
npm run typecheck
npm run build
```

## Docker (Local Production-like)

```bash
docker compose up --build
```

This compose file is for local/prod-sim usage, not internet-facing hardened deployment as-is.

## API and Realtime Notes

- REST API is documented in `src/docs/openapi.yaml`
- Swagger UI is served from `/api-docs`
- Room/mic realtime channels:
  - Socket namespace: `/room`
  - Socket namespace: `/mic`
- Media transport is handled via LiveKit tokens from `/rooms/:id/join`

## Production Notes

- Enforce strong JWT secrets in production
- Keep `RUN_MIGRATIONS` / strict migration policy aligned with deployment strategy
- Restrict metrics/swagger in production via internal ops key/network policy
- Use TLS, secure cookies, and strict CORS origin allowlist
- Run preflight checks before each release

## Project Status

Detailed readiness analysis: [`PROD_READINESS_REPORT.md`](./PROD_READINESS_REPORT.md)

